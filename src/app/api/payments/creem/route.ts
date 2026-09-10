import { z } from "zod";
import { authenticatedClient } from "@/lib/server/render-auth";
import { adminClient } from "@/lib/server/admin";

export const runtime = "nodejs";
const inputSchema = z.object({ amountUsd: z.number().min(5).max(1000) });

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      return Response.json({ error: "Same-origin requests required." }, { status: 403 });
    const apiKey = process.env.CREEM_API_KEY;
    const productId = process.env.CREEM_WALLET_PRODUCT_ID;
    if (!apiKey || !productId) throw new Error("Creem checkout is not configured yet.");
    const { user } = await authenticatedClient(request);
    const admin = adminClient();
    const { amountUsd } = inputSchema.parse(await request.json());
    const amountCents = Math.round(amountUsd * 100);
    const reference = `clipweave-${crypto.randomUUID()}`;
    const { data: payment, error } = await admin.from("comfyTR_payment_transactions").insert({
      owner_id: user.id, provider: "creem", provider_reference: reference,
      amount_cents: amountCents, currency: "USD",
    }).select("id").single();
    if (error) throw error;
    const apiOrigin = process.env.CREEM_TEST_MODE === "true" ? "https://test-api.creem.io" : "https://api.creem.io";
    const response = await fetch(`${apiOrigin}/v1/checkouts`, {
      method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, request_id: reference, custom_price: amountCents,
        customer: { email: user.email, name: user.user_metadata?.full_name ?? user.email },
        success_url: `${origin}/studio?payment=return`,
        metadata: { payment_id: payment.id, owner_id: user.id },
      }),
    });
    const result = await response.json();
    const checkoutUrl = result?.checkout_url;
    if (!response.ok || typeof checkoutUrl !== "string") throw new Error(result?.message ?? "Checkout could not be created.");
    await admin.from("comfyTR_payment_transactions").update({ checkout_url: checkoutUrl }).eq("id", payment.id);
    return Response.json({ checkoutUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Checkout could not be created." }, { status: error instanceof z.ZodError ? 400 : 502 });
  }
}
