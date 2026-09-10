import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/server/admin";

export const runtime = "nodejs";

function validSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) return new Response("Payment webhook is not configured.", { status: 503 });
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("creem-signature"), secret))
    return new Response("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw);
  if (payload?.eventType !== "checkout.completed") return new Response("ok");
  const checkout = payload?.object;
  const order = checkout?.order;
  const reference = checkout?.request_id;
  const admin = adminClient();
  const { data: payment } = await admin.from("comfyTR_payment_transactions")
    .select("id,amount_cents,currency,status").eq("provider_reference", reference ?? "").maybeSingle();
  if (!payment || payment.status === "successful") return new Response("ok");
  if (checkout?.status !== "completed" || order?.status !== "paid" || order?.currency !== payment.currency || Number(order?.amount) < payment.amount_cents)
    return new Response("Verification mismatch", { status: 400 });
  const credited = await admin.rpc("comfyTR_credit_payment", { payment_uuid: payment.id, transaction_id: String(order.id) });
  if (credited.error) return new Response("Credit failed", { status: 500 });
  return new Response("ok");
}
