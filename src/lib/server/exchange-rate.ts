import "server-only";

const CACHE_TTL_MS = 60 * 60 * 1000;
let cached: { ngnPerUsd: number; fetchedAt: number } | null = null;

// Primary: abokidollar.com's Black Market Sell Rate -- the parallel-market
// rate closest to what a business actually pays to buy dollars in Nigeria.
// Confirmed live via a plain unauthenticated GET (no bot protection, unlike
// Western Union's session-bound quote API). Its own "CBN" category showed an
// inconsistent buy/sell spread when checked, so only the Black Market row is
// used here.
async function abokiUsdRate(): Promise<number> {
  const response = await fetch("https://abokidollar.com/api/rates", { cache: "no-store" });
  if (!response.ok) throw new Error("Aboki rate feed unavailable.");
  const body: unknown = await response.json();
  const entry = Array.isArray(body)
    ? body.find((row) => row?.Type === "Black Market" && row?.Code === "USD")
    : undefined;
  const rate = Number(entry?.["Sell Rate"]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Aboki rate feed unavailable.");
  return rate;
}

// Backup, used only when Aboki is unreachable: Nigeria Customs Service's
// officially gazetted rate. Confirmed callable server-side with no bot
// protection, but Customs only refreshes it on their own schedule (observed
// weeks-stale at times) -- exactly why this is the fallback, not the primary.
async function customsUsdRate(): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const response = await fetch(`https://api.customs.gov.ng/api/exchange-rates?date=${date}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Customs rate feed unavailable.");
  const body: { rates?: Array<{ code?: string; sellingRate?: number }> } = await response.json();
  const entry = body.rates?.find((row) => row.code === "USD");
  const rate = Number(entry?.sellingRate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Customs rate feed unavailable.");
  return rate;
}

export async function liveNgnPerUsd(): Promise<number> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.ngnPerUsd;
  let rate: number;
  try {
    rate = await abokiUsdRate();
  } catch {
    // Only reached when Aboki itself failed; if Customs also fails, this
    // throws and callers correctly see the rate as unavailable rather than
    // silently falling back to a guess.
    rate = await customsUsdRate();
  }
  cached = { ngnPerUsd: rate, fetchedAt: Date.now() };
  return rate;
}
