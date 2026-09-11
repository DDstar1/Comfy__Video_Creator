import "server-only";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import {
  directorInputSchema,
  checkDirectorInput,
} from "@/lib/director-contract";
import { runDirector } from "@/lib/server/director";

export const runtime = "nodejs";
export const maxDuration = 300;
const busy = new Set<string>();
const recent = new Map<string, number>();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  if (!origin || origin !== url.origin)
    return Response.json(
      { error: "Same-origin requests required." },
      { status: 403 },
    );
  const local =
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  let owner = "local-development";
  if (!local) {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (
      !token ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return Response.json(
        { error: "Sign in to use the writing assistant." },
        { status: 401 },
      );
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user)
      return Response.json(
        { error: "Your session expired. Sign in again." },
        { status: 401 },
      );
    owner = data.user.id;
  }
  let input;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 500000)
      return Response.json(
        { error: "Project is too large for one request." },
        { status: 413 },
      );
    input = directorInputSchema.parse(JSON.parse(body));
    checkDirectorInput(input);
    for (const reference of input.references) {
      const image = new URL(reference.url);
      const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isStorage =
        storage &&
        image.origin === new URL(storage).origin &&
        image.pathname.startsWith(
          "/storage/v1/object/public/comfytr-reference-images/",
        );
      if (
        image.protocol !== "https:" ||
        (!isStorage && image.hostname !== "images.unsplash.com")
      )
        throw new Error("Reference images must come from your library.");
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error &&
          error.name !== "ZodError" &&
          error.name !== "SyntaxError"
            ? error.message
            : "Invalid project request. Check the story, clip and reference limits.",
      },
      { status: 400 },
    );
  }
  // Check and reserve together after the asynchronous body read.
  if (busy.has(owner) || Date.now() - (recent.get(owner) ?? 0) < 10000)
    return Response.json(
      { error: "Please wait before starting another prompt request." },
      { status: 429 },
    );
  busy.add(owner);
  recent.set(owner, Date.now());
  for (const [id, time] of recent)
    if (Date.now() - time > 60000) recent.delete(id);
  try {
    return Response.json(await runDirector(input, request.signal));
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Director provider failure", {
          type: error.name,
          status: error.status,
          code: error.code,
          requestId: error.requestID,
        });
      }
      // Do not send provider request bodies, prompts or credentials to logs or clients.
      const status = error.status === 429 ? 429 : 502;
      return Response.json(
        {
          error:
            error.status === 401
              ? "OpenAI rejected CHATGPT_KEY. Check the server environment."
              : error.code === "credit_balance_exhausted"
                ? "The OpenAI API account has no credits remaining. Add API credits to the account associated with CHATGPT_KEY, then retry."
                : error.status === 429
                  ? "OpenAI quota or rate limit reached. Try again later."
                  : `OpenAI could not complete this request (HTTP ${error.status ?? "unknown"}). Check model and skill access.`,
        },
        { status },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error &&
          error.name !== "ZodError" &&
          error.name !== "SyntaxError"
            ? error.message
            : "The model returned an invalid prompt. Your previous version is unchanged; please retry.",
      },
      { status: 502 },
    );
  } finally {
    busy.delete(owner);
  }
}
