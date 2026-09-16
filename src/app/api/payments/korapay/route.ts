import { z } from "zod";
import { authenticatedClient } from "@/lib/server/render-auth";
import { adminClient } from "@/lib/server/admin";
import { getKorapayMode, korapayKeys } from "@/lib/server/korapay-config";
import { liveNgnPerUsd } from "@/lib/server/exchange-rate";

// Flat margin added on top of the live USD->NGN rate, chosen by the business
// rather than a percentage -- ₦300 covers roughly a stable slice of margin
// regardless of the underlying rate's daily movement.
const KORAPAY_NGN_MARGIN = Number(process.env.KORAPAY_NGN_MARGIN ?? 300);

// Supabase errors are plain objects, not Error instances, so
// `error instanceof Error` misses them and hides the real cause behind a
// generic message -- this happened for real when the Korapay migrations
// hadn't been applied yet and the resulting PostgrestError got swallowed.
function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string")
    return error.message;
  return fallback;
}

export const runtime = "nodejs";
// Same bounds as the Creem top-up, kept identical so the wallet UI does not
// need to know which provider is active.
const inputSchema = z.object({ amountUsd: z.number().min(5).max(1000) });

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      return Response.json({ error: "Same-origin requests required." }, { status: 403 });
    const mode = await getKorapayMode();
    const { publicKey } = korapayKeys(mode);
    if (!publicKey) throw new Error(`Korapay ${mode} checkout is not configured yet.`);
    // Rate is fetched live rather than read from a static env var, plus the
    // fixed margin above -- refusing to start checkout when the feed is down
    // is deliberate -- a guessed rate would silently over- or under-charge
    // every customer, which a temporary outage doesn't justify risking.
    const ngnPerUsd = (await liveNgnPerUsd()) + KORAPAY_NGN_MARGIN;
    const { user } = await authenticatedClient(request);
    const admin = adminClient();
    const { amountUsd } = inputSchema.parse(await request.json());
    const amountCents = Math.round(amountUsd * 100);
    // Korapay's documented examples (pre-auth/capture/void/refund) all use
    // decimal major-unit values ("10.00", "3"), not kobo -- verified against
    // their docs, not assumed. Confirm against one real sandbox charge before
    // trusting this in production; getting this wrong is a 100x billing bug.
    const amountNgn = Math.round(amountUsd * ngnPerUsd * 100) / 100;
    const reference = `clipweave-korapay-${crypto.randomUUID()}`;
    const { error } = await admin.from("comfyTR_payment_transactions").insert({
      owner_id: user.id, provider: "korapay", provider_reference: reference,
      amount_cents: amountCents, currency: "USD",
      paid_currency: "NGN", paid_amount: amountNgn, payment_mode: mode,
    });
    if (error) throw error;
    // Korapay's Standard Checkout is client-initiated (window.Korapay.initialize),
    // unlike Creem's server-created checkout session -- there is no API call
    // here to create anything server-side; the pending transaction row above
    // is what the webhook will match against once the client-side modal
    // reports success.
    return Response.json({
      reference,
      amountNgn,
      publicKey,
      customer: { name: user.user_metadata?.full_name ?? user.email, email: user.email },
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "Checkout could not be started.") }, { status: error instanceof z.ZodError ? 400 : 502 });
  }
}
