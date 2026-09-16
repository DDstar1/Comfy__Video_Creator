import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/server/admin";
import { korapayKeys } from "@/lib/server/korapay-config";

export const runtime = "nodejs";

// Korapay signs only the "data" object, not the whole payload -- confirmed
// from their own docs and example code, and different from Creem's
// whole-raw-body HMAC. Signing a re-stringified object (rather than a raw
// substring) is what their own sample code does too; safe here because
// JSON.parse/JSON.stringify round-trip preserves key order in Node.
function validSignature(data: unknown, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(JSON.stringify(data)).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const raw = await request.text();
  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
  const data = payload.data ?? {};
  const reference = typeof data.reference === "string" ? data.reference : undefined;
  const admin = adminClient();
  const { data: payment } = await admin.from("comfyTR_payment_transactions")
    .select("id,status,payment_mode").eq("provider_reference", reference ?? "").eq("provider", "korapay").maybeSingle();
  if (!payment || payment.status === "successful") return new Response("ok");
  // Verify against the secret for the mode this transaction was actually
  // checked out under -- not whichever mode the admin toggle currently says
  // -- since the toggle could have flipped between checkout and this webhook.
  const { secretKey } = korapayKeys(payment.payment_mode === "live" ? "live" : "test");
  if (!secretKey) return new Response("Payment webhook is not configured.", { status: 503 });
  if (!validSignature(data, request.headers.get("x-korapay-signature"), secretKey))
    return new Response("Invalid signature", { status: 401 });
  if (payload.event !== "charge.success") return new Response("ok");
  if (data.status !== "success") return new Response("Verification mismatch", { status: 400 });
  // Unlike Creem, the reported amount is in NGN while amount_cents is USD
  // cents -- there is no matching currency to cross-check against, so the
  // signature plus the unique per-transaction reference are what make this
  // trustworthy. The raw payload is stored for audit via the 3-arg overload.
  const transactionId = typeof data.payment_reference === "string" ? data.payment_reference : reference ?? "";
  const credited = await admin.rpc("comfyTR_credit_payment", {
    payment_uuid: payment.id, transaction_id: transactionId, metadata: data,
  });
  if (credited.error) return new Response("Credit failed", { status: 500 });
  return new Response("ok");
}
