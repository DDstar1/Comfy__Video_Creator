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
    const secret = process.env.FLW_SECRET_KEY;
    if (!secret) throw new Error("Flutterwave checkout is not configured yet.");
    const { user } = await authenticatedClient(request);
    const admin = adminClient();
    const { amountUsd } = inputSchema.parse(await request.json());
    const amountCents = Math.round(amountUsd * 100);
    const reference = `clipweave-${crypto.randomUUID()}`;
    const { data: payment, error } = await admin.from("comfyTR_payment_transactions").insert({
      owner_id: user.id, provider: "flutterwave", provider_reference: reference,
      amount_cents: amountCents, currency: "USD",
    }).select("id").single();
    if (error) throw error;
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tx_ref: reference, amount: (amountCents / 100).toFixed(2), currency: "USD",
        redirect_url: `${origin}/studio?payment=return`,
        customer: { email: user.email, name: user.user_metadata?.full_name ?? user.email },
        meta: { payment_id: payment.id, owner_id: user.id },
        customizations: { title: "ClipWeave wallet", description: "Add generation credit" },
      }),
    });
    const result = await response.json();
    const checkoutUrl = result?.data?.link;
    if (!response.ok || typeof checkoutUrl !== "string") throw new Error(result?.message ?? "Checkout could not be created.");
    await admin.from("comfyTR_payment_transactions").update({ checkout_url: checkoutUrl }).eq("id", payment.id);
    return Response.json({ checkoutUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Checkout could not be created." }, { status: error instanceof z.ZodError ? 400 : 502 });
  }
}
