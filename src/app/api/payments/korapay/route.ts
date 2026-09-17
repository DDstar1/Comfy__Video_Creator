import { z } from "zod";
import { authenticatedClient } from "@/lib/server/render-auth";
import { adminClient } from "@/lib/server/admin";
import { getKorapayMode, korapayKeys } from "@/lib/server/korapay-config";
import { liveNgnPerUsd } from "@/lib/server/exchange-rate";

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

function formatNgn(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

export const runtime = "nodejs";
// The customer enters and is charged an NGN amount directly (not a USD
// amount converted to NGN behind the scenes). Both the $5 minimum and $1000
// maximum wallet-credit bounds are enforced after converting at the live
// rate, so the actual NGN floor/ceiling shown to the customer always tracks
// today's rate rather than drifting stale like a hardcoded NGN number would.
const inputSchema = z.object({ amountNgn: z.number().positive() });

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      return Response.json({ error: "Same-origin requests required." }, { status: 403 });
    const mode = await getKorapayMode();
    const { publicKey } = korapayKeys(mode);
    if (!publicKey) throw new Error(`Korapay ${mode} checkout is not configured yet.`);
    // Rate is fetched live rather than read from a static env var -- no
    // margin added on top anymore. Refusing to start checkout when the feed
    // is down is deliberate -- a guessed rate would silently over- or
    // under-charge every customer, which a temporary outage doesn't justify.
    const ngnPerUsd = await liveNgnPerUsd();
    const { user } = await authenticatedClient(request);
    const admin = adminClient();
    const { amountNgn } = inputSchema.parse(await request.json());
    const amountUsd = amountNgn / ngnPerUsd;
    if (amountUsd < 5 || amountUsd > 1000)
      throw new Error(`Enter an amount between ${formatNgn(5 * ngnPerUsd)} and ${formatNgn(1000 * ngnPerUsd)}.`);
    // Korapay's documented examples (pre-auth/capture/void/refund) all use
    // decimal major-unit values ("10.00", "3"), not kobo -- verified against
    // their docs, not assumed. Confirm against one real sandbox charge before
    // trusting this in production; getting this wrong is a 100x billing bug.
    const amountCents = Math.round(amountUsd * 100);
    // Korapay caps reference at 50 characters; "clipweave-korapay-" plus a
    // full hyphenated UUID was 54 -- confirmed live via a real 422
    // validation_error. Dropping the hyphens keeps full UUID entropy in 32
    // characters, well under the limit.
    const reference = `clipweave-${crypto.randomUUID().replace(/-/g, "")}`;
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

// Read-only rate lookup so the wallet UI can show a live NGN preview as the
// customer types, without starting a checkout (no transaction row, no auth
// needed -- the rate is not sensitive; anyone could derive it from a real
// checkout amount anyway).
export async function GET() {
  try {
    return Response.json({ ngnPerUsd: await liveNgnPerUsd() });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "Live exchange rate is unavailable.") }, { status: 503 });
  }
}
