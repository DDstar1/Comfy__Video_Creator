import "server-only";

// Free, keyless USD base-rate feed. It refreshes once a day, not tick-by-tick
// -- confirmed live: time_next_update_utc in its response is ~24h after
// time_last_update_utc. That is "dynamic" in the sense of tracking the real
// market without a hardcoded number, but not real-time; know that before
// relying on it for large swings.
const FX_API_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL_MS = 60 * 60 * 1000;

let cached: { ngnPerUsd: number; fetchedAt: number } | null = null;

export async function liveNgnPerUsd(): Promise<number> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.ngnPerUsd;
  const response = await fetch(FX_API_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("Live exchange rate is unavailable.");
  const body = await response.json();
  const rate = Number(body?.rates?.NGN);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Live exchange rate is unavailable.");
  cached = { ngnPerUsd: rate, fetchedAt: Date.now() };
  return rate;
}
