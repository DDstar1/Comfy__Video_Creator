import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/server/admin";

export const runtime = "nodejs";

function validSignature(body: string, signature: string | null, legacySignature: string | null, secret: string) {
  if (legacySignature === secret) return true;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secretHash = process.env.FLW_SECRET_HASH;
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretHash || !secretKey) return new Response("Payment webhook is not configured.", { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("flutterwave-signature");
  if (!validSignature(raw, signature, request.headers.get("verif-hash"), secretHash)) return new Response("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw);
  const transactionId = payload?.data?.id;
  if (![payload?.type, payload?.event].includes("charge.completed") || !transactionId) return new Response("ok");
  const verifiedResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(transactionId))}/verify`, {
    headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store",
  });
  const verified = await verifiedResponse.json();
  const data = verified?.data;
  const admin = adminClient();
  const { data: payment } = await admin.from("comfyTR_payment_transactions").select("id,amount_cents,currency,status")
    .eq("provider_reference", data?.tx_ref ?? "").maybeSingle();
  if (!payment || payment.status === "successful") return new Response("ok");
  if (data?.status !== "successful" || data?.currency !== payment.currency || Math.round(Number(data?.amount) * 100) < payment.amount_cents)
    return new Response("Verification mismatch", { status: 400 });
  const credited = await admin.rpc("comfyTR_credit_payment", { payment_uuid: payment.id, transaction_id: String(transactionId) });
  if (credited.error) return new Response("Credit failed", { status: 500 });
  return new Response("ok");
}
