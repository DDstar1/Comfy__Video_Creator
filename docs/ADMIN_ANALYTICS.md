# Owner analytics

`/admin` is linked from the Studio toolbar for the verified owner account.
The read-only dashboard includes 7/30/90/365-day filters, daily activity,
provider breakdowns, success/failure counts, sortable users and paginated
per-user generation history. API and database both verify the owner identity.
Responses are private/no-store. No prompt or image payloads appear in analytics.

## Setup

Apply `supabase/migrations/20260913000001_comfyTR_admin_analytics.sql`.
Existing render charges/runtime and wallet balances/deposits are read through
an owner-only RPC without a service key. Trusted new usage writes require the
server-only `SUPABASE_SERVICE_KEY` (the existing project name) or
`SUPABASE_SERVICE_ROLE_KEY`; its absence produces a dashboard warning. Never
use a NEXT_PUBLIC variable for this key.

Configure `RUNPOD_GPU_RATE_CENTS_PER_HOUR` for runtime estimates. For OpenAI,
set `ADMIN_OPENAI_MODEL` to the exact returned model identifier and set
`ADMIN_OPENAI_INPUT_CENTS_PER_MILLION`,
`ADMIN_OPENAI_CACHED_CENTS_PER_MILLION`, `ADMIN_OPENAI_OUTPUT_CENTS_PER_MILLION`.
All rates are nonnegative USD cents; no pricing is guessed. New usage snapshots
rates; legacy RunPod estimates use the currently configured rate.

OpenAI usage is captured before output validation, including billed invalid
responses. Transport failures have unknown cost. Interrupted calls can remain
started. Failed RunPod attempts are recorded when their terminal status is
polled; this is not unattended provider reconciliation. Persistence failures
log a generic warning without sensitive data and do not break generation.

## Accounting limits

Wallet deposits are not earned revenue. Revenue uses recorded render charges.
Partial contribution subtracts known provider estimates, including owner usage.
Net profit is unavailable until tools, idle GPU time, storage, payment fees,
refunds and operating expenses are reconciled. Missing prices/runtime remain
unknown, never zero. Historical OpenAI requests are not backfilled.

Reports group by generation start, not settlement date. Wallet liability is
current rather than period-bound. RPC queries page through data and reject
datasets exceeding 50,000 rows rather than silently truncating totals.
Existing render history can be removed by project deletion; this is not an
immutable accounting ledger. Cost telemetry requires service-role credentials
and a working database; a configured key alone does not prove capture succeeded.

## Verification

Run `npm test`, `npx tsc --noEmit`, and ESLint. The new unit suite covers unknown
costs, cached tokens, failed attempts, owner usage, and SQL authorization guards.
On 2026-09-13 the linked migration was applied successfully with \`supabase db push --yes\`. The service key is available to the local application process. No paid provider generation was submitted to prove live cost capture; treat provider costs as estimates until rate configuration and a normal production generation have been reconciled.

Local checks passed: TypeScript, targeted ESLint, accounting/unit tests, live
unauthenticated API rejection (401), desktop/mobile signed-out rendering, and
mock-data user drill-down/pagination with no browser exceptions. Mock-data
checks do not verify live owner authorization or provider billing capture.
