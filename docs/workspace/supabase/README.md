# ClipWeave database and reference storage

## Latest documentation checkpoint — 2026-09-16

This mirrored database handoff remains current: the quality/reference and owner
analytics migrations are applied, private generated-video exports remain in
Supabase storage, and trusted usage writes accept `SUPABASE_SERVICE_KEY` or the
standard compatible `SUPABASE_SERVICE_ROLE_KEY`. The Duration/Render Studio
layout and validated-clip footer buttons were corrected the same day (the
desktop stacking previously described here did not actually apply; see the
root README) — presentation-only, requires no database change. Three further
fixes landed later the same day (disabled-button explanations, a regenerate
spinner, and live @mention highlighting in the description textarea) — all
client-side only, no migration, no new table, no changed query. See the root
README for the full account. Unknown provider costs remain unknown; wallet
deposits are not revenue.

**Later the same day — Korapay payments migration written, not applied.**
Creem is removed from the application code (its routes and UI are deleted),
replaced by Korapay Standard Checkout. Migration
[20260916000001_comfyTR_korapay_payments.sql](../../../../supabase/migrations/20260916000001_comfyTR_korapay_payments.sql)
adds `korapay` to `comfyTR_payment_transactions`'s provider check constraint
(alongside the pre-existing `flutterwave` and the now-unused `creem`, kept in
the constraint rather than removed since dropping it would force revalidating
every historical row for no benefit), adds a nullable `provider_metadata`
jsonb column, adds `paid_currency`/`paid_amount` columns recording what the
customer was actually charged (e.g. `NGN`, `4128.50`) separately from the
wallet's own USD-cent `amount_cents` — the two can differ once a currency
conversion happens, so both sides of the conversion are kept rather than only
the post-conversion USD figure — and adds a `comfyTR_credit_payment(uuid,
text, jsonb)` overload that stores a provider's raw confirmation payload
before crediting. This is needed because Korapay reports NGN while the wallet
stores USD cents, so unlike the Creem webhook there is no matching currency to
check the amount against. **This migration has not been pushed**
(`supabase db push --linked` not run for it). The existing 2-argument
`comfyTR_credit_payment` used by the Creem webhook is untouched. Also raised,
not decided: moving the wallet's base currency from USD to NGN (a "1 NGN = 1
token" model) — would require changing `comfyTR_wallets`'s
`check (currency = 'USD')` constraint, not just this migration.

**Later still — both applied.**
[20260916000002_comfyTR_payment_mode.sql](migrations/20260916000002_comfyTR_payment_mode.sql)
adds `comfyTR_payment_settings` (a singleton row, service-role only, no
authenticated/anon grant) holding `korapay_mode` (`test`/`live`), switchable
from `/admin`, plus a `payment_mode` column on `comfyTR_payment_transactions`
so the webhook verifies each transaction against the secret for the mode it
was actually checked out under, not whatever the admin toggle currently says.
**Both `20260916000001` and `20260916000002` are now applied** to this linked
database — confirmed via `supabase migration list --linked` showing both
present remotely, pushed with `supabase db push --linked` in this session
(dry-run first, one migration applied).


## Current database state — 2026-09-13

This handoff copy mirrors the active Supabase documentation. Both the
project-quality/reference migration and the owner analytics migration are applied.
`comfyTR_generation_usage` stores non-sensitive provider usage metadata through
server-only credentials; the `comfyTR_admin_records` RPC independently verifies
the designated owner before any cross-tenant read. Estimates with missing rates
or runtimes remain unknown, and wallet deposits are not booked as render revenue.

See [../../ADMIN_ANALYTICS.md](../../ADMIN_ANALYTICS.md) for the complete
configuration and accounting limits.


This folder is linked to the existing shared `general_db` Supabase project.
Earlier migrations belong to other applications; do not rename or reset them.
All tables added for this application must use the exact `comfyTR_` prefix.
PostgreSQL identifiers must be quoted, e.g. `public."comfyTR_reference_images"`.
Supabase client table names are case-sensitive: `.from('comfyTR_reference_images')`.

## Reference library foundation

Latest application storage additions (2026-09-12): project quality and suggested
references are persisted by the project-quality/references migration. Final
merged videos use the existing private `comfytr-generated-videos` bucket under
`USER_ID/PROJECT_ID/exports/SOURCE_HASH.mp4`; no new export table is required.
The merge API verifies project ownership and source paths and returns one-hour
signed URLs. Public reference-image access is unchanged. Validation now waits
for its project save to succeed before the UI reports a locked clip.

- `comfyTR_projects`: account-owned project identities and titles.
- `comfyTR_reference_images`: reusable account image records. Each record points
  to immutable image bytes; replacements get a new ID and storage path.
- `comfyTR_project_references`: project image selections and readable mention
  names. Composite foreign keys prevent linking another account's references.
- `comfyTR_custom_users`: private application profiles for email/password and
  Google users, synchronized automatically from `auth.users`.

Image files are publicly readable in `comfytr-reference-images`. Database records
and storage listings remain account-owned through RLS. Authenticated users can
upload into their own UID folder. Upload limit: 20 MiB; JPEG, PNG, and WebP.
Client overwrite and deletion are disabled to preserve project references.
Archive library records with `archived_at`; trusted backend cleanup can later
remove unused files through the Storage API.

## Current frontend integration

### Project settings and suggestions

[20260912000004_comfyTR_project_quality_references.sql](migrations/20260912000004_comfyTR_project_quality_references.sql)
was applied to the linked database on 2026-09-12. It adds:

- `comfyTR_projects.quality`: `draft`, `standard`, or `high`, defaulting to `draft`.
- `comfyTR_clips.suggested_references`: a JSON array of `{name, description}`,
  defaulting to `[]`. These are suggestions, not foreign keys to existing images.
- Column-level authenticated update grants for both new fields.
- `comfyTR_guard_output_settings`: rejects ratio/quality changes once the project
  contains clips, including direct database updates through the client.

Actual uploaded images remain in `comfyTR_reference_images`; project membership
and ordered clip `reference_ids` remain separate. Resolving a suggestion updates
matching draft clips and marks their prompts stale. Removing it leaves subjects
described in words. Validated clips remain immutable.

### Scoped loading and exports

The sidebar reads project metadata only. Opening a project URL loads its project
row, clips, reference links, and prompt versions filtered to those clip IDs.
Queries include `owner_id`; RLS remains authoritative. Client autosave only sees
complete loaded/new projects, never sidebar summaries. Video preview URLs are
re-signed when project details load.

Merged exports are stored in the existing private video bucket at
`OWNER_ID/PROJECT_ID/exports/SHA256_OF_ORDERED_SOURCE_PATHS.mp4`. The merge API
checks ownership, every clip's validated state and each source path's owner/project
prefix. It reads the final cumulative video per chain and uploads an immutable
MP4, without changing clip rows or creating a render job. No new export table,
wallet transaction or migration is needed for merging. Existing owner storage
policies permit listing, reading and insertion. Signed preview/download URLs last
one hour; a later GET finds the stored export and issues new URLs. Different
source sequences get different hashes; retention/cleanup of old exports is not
implemented.

The Next.js application in `../frontend/` connects Supabase Auth, the public image
bucket and `comfyTR_reference_images`. Upload forms and library loading are
implemented. Seven real uploads and project/story/reference persistence after
reload were verified on 2026-09-11.

Project/story/clip drafts, project reference selections and AI prompt revisions
now synchronize to `comfyTR_projects`, `comfyTR_project_references`,
`comfyTR_clips` and `comfyTR_clip_prompt_versions`. `comfyTR_render_jobs` tracks
RunPod work and enforces one active render per project. `comfyTR_clip_video_assets`
keeps active and archived generated-video records. `comfyTR_waitlist` stores the
private launch registrations; public RPC output contains masked emails only.
For normal addresses, the mask shows the first two and last two characters before
`@` and preserves the full domain, for example `da***ar@gmail.com`.
`comfyTR_wallets`, `comfyTR_payment_transactions` and `comfyTR_wallet_ledger`
store balances, verified Creem top-ups and the audit trail. Database functions reserve,
settle and refund render credit while holding row locks.

## Image upload contract

1. Generate a reference UUID and upload with `upsert: false` to
   `<auth-user-id>/<reference-id>/original.<extension>`.
2. Insert the image record with the same ID, `name`, and `storage_path`.
3. Save the storage path, not an expiring URL. Obtain the public URL with
   `storage.from('comfytr-reference-images').getPublicUrl(storage_path)`.
4. The frontend stores project image selections in `comfyTR_project_references`; deleting a
   project must leave the image in the account library.

Public images can be downloaded by anyone with their URL, including RunPod.
Do not expose a service-role key in the frontend.

The prepared RunPod worker accepts base64 reference images in its request. The render
route accepts the assembled workflow and image payload, submits the job, then copies
completed videos into the private `comfytr-generated-videos` bucket under the
authenticated account, project and clip path. The publish RPC archives a replaced
draft asset, attaches the new permanent URL to its clip and marks the clip ready in
one transaction. One-hour signed URLs provide authenticated previews. Archived objects remain stored for recovery; a later retention job
may delete them after a defined grace period.

The deployed worker requires `input.cache_namespace`. The future Next.js route must
derive it from the verified Supabase `auth.uid()` and an owned project ID. This
keeps the namespace authoritative and allows the worker to isolate persistent H3
cache directories without trusting identity values supplied by the browser.

Queue endpoint `nqpfrj6twlaz5h` now mounts the existing volume and can scale to three
workers. Before concurrent production use, the backend/database needs a project-level
job lock: only one worker may generate against a project's continuity cache at a
time, while unrelated projects may run concurrently.

The render-results migration adds account-owned jobs and video assets, the private
video bucket, a distributed active-project lock and transactional result publishing.

If storage upload succeeds but metadata insertion fails, the frontend reports the
partial failure. Orphan cleanup is not implemented. Archiving metadata does not
make an already-public image private.

## Migrations

Use the existing link from the repository root:

```powershell
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
```

Inspect the dry run before pushing; only intended project migrations should be
pending. Do not run database reset against this shared database.

## Applied migration and verification

The applied application migrations are
[20260909000001_comfyTR_reference_library.sql](migrations/20260909000001_comfyTR_reference_library.sql)
and [20260910000001_comfyTR_projects_clips_waitlist.sql](migrations/20260910000001_comfyTR_projects_clips_waitlist.sql).
The follow-up [20260910000002_comfyTR_waitlist_email_mask.sql](migrations/20260910000002_comfyTR_waitlist_email_mask.sql)
keeps the full email domain visible while masking the middle of the local part.
The applied [20260910000003_comfyTR_custom_users.sql](migrations/20260910000003_comfyTR_custom_users.sql)
creates and backfills private user profiles and installs the Auth synchronization trigger.
The applied [20260910000004_comfyTR_render_results.sql](migrations/20260910000004_comfyTR_render_results.sql)
adds render jobs, generated-video assets and permanent video storage.
The applied [20260910000005_comfyTR_wallets.sql](migrations/20260910000005_comfyTR_wallets.sql)
adds prepaid wallets, payment records, the ledger and atomic render accounting.
The applied [20260911000001_comfyTR_creem_payments.sql](migrations/20260911000001_comfyTR_creem_payments.sql)
enables the Creem payment provider and updates top-up ledger descriptions.
Creem's application code has since been removed (see the checkpoint above),
but this migration is not reverted — the `creem` provider value and its
historical transaction rows remain valid.
The applied [20260916000001_comfyTR_korapay_payments.sql](migrations/20260916000001_comfyTR_korapay_payments.sql)
adds Korapay support the same way, plus `paid_currency`/`paid_amount` columns
recording what the customer was actually charged before any conversion. The
applied [20260916000002_comfyTR_payment_mode.sql](migrations/20260916000002_comfyTR_payment_mode.sql)
adds the owner-switchable test/live `comfyTR_payment_settings` row and a
per-transaction `payment_mode` column.
The applied [20260912000001_comfyTR_clip_chains.sql](migrations/20260912000001_comfyTR_clip_chains.sql)
adds `comfyTR_clips.continues_previous` (default `true`, so existing projects keep
behaving as one chain from clip 1), the flag that lets a clip cut to a new scene
instead of continuing the previous one.
The applied [20260912000002_comfyTR_abandon_render.sql](migrations/20260912000002_comfyTR_abandon_render.sql)
adds `comfyTR_abandon_render(job_uuid, reason)`, letting an owner release their own
render job that is stuck `submitting`/`queued`/`running` with no way for the client
to move it forward — `authenticated` only ever held `select, insert` on
`comfyTR_render_jobs`, and the existing `comfyTR_release_render` only releases the
wallet reservation, not job status, so a job whose result was never ingested
permanently blocked that project's one-active-render lock before this existed.
The applied [20260912000003_comfyTR_render_job_namespace.sql](migrations/20260912000003_comfyTR_render_job_namespace.sql)
adds `comfyTR_render_jobs.cache_namespace`, captured at submission time so a
later recovery read does not have to recompute a chain index that could have
drifted if clips were reordered or removed since.
They were applied using this folder's existing project link. Rollback-only checks in
[tests/comfyTR_reference_library.sql](tests/comfyTR_reference_library.sql) previously
passed for ownership isolation, immutable paths, archive behavior, project deletion
and bucket configuration. These are database checks, not a signed-in frontend
upload test. The 2026-09-10 migration was applied successfully after a CLI dry run.

See the [root README](../README.md) for project status and the
[frontend README](../frontend/README.md) for environment setup and prompt editing.

## 2026-09-12 checkpoint

Two clips of the Red Signal fixture rendered and were published through
`comfyTR_publish_render_result`: `comfyTR_clips.video_url` is set, the matching
`comfyTR_clip_video_assets` rows are `active` (1.7 MB and 3.2 MB), and both play
back through one-hour signed URLs. Clip 1 is `validated`.

**A persistence bug destroyed data before it was found.** Two faults combined:

- The reference sync deleted every `comfyTR_project_references` row for a project
  and re-inserted only when the in-memory selection was non-empty, so any save
  carrying an empty selection wiped the links and put nothing back. It now syncs
  by difference — delete only removed ids, insert only added ones.
- Client effects were keyed on the Supabase **user object**, which is recreated on
  every token refresh, so the project load re-ran and replaced local state with
  the database mid-edit. They now key on the stable user id, and the autosave only
  writes projects whose state actually changed.

The symptom was misleading: every director call failed with "A clip contains an
unavailable reference", which was the contract check working correctly on
corrupted state. If that error appears again, check
`comfyTR_project_references` before suspecting the model.

Worth knowing when debugging: clips carry their own `reference_ids`, independent
of `comfyTR_project_references`, so clips can survive intact while the project's
reference links are gone.

**Scene cuts and render recovery, same day.** A cut clip starts a new chain
(`continues_previous = false`) and gets its own `cache_namespace`
(`user:project:chainIndex`), which is captured on the render job row rather
than recomputed later. Validation and workflow assembly are scoped to a clip's
own chain — an earlier scene's clips no longer block or leak into a later one's
render. Three clips across two chains have rendered and played back.

A generation job's own `/status` result on RunPod is only queryable for
roughly 30 minutes after completion, confirmed live: a genuinely completed job
later 404'd. The video survives on the Network Volume regardless, and the
render route now reads it from there directly (a single-clip chain, over a
signed S3 request, no RunPod job) or asks the worker to join and return it (a
multi-clip chain, via its `input.fetch` job). Neither path touches this
database beyond the normal publish/settle calls once bytes are in hand.
Recovering a render that was never polled at all — nobody had the project open
before that window closed — still is not solved; see the root README.

## 2026-09-11 test checkpoint

The frontend now inserts new projects/clips and updates only mutable columns of
existing rows. This avoids sending protected identity columns in an upsert.
Production project/story persistence and seven uploaded reference selections
survived reload. A real four-clip, 20-second plan was generated. Prompt-history
roundtrip, generated-video storage and live validation remain to be verified.
The designated verified owner's billing exemption is server application logic;
no fake wallet balance, payment record or new migration was introduced for it.
Local development still connects to this shared database, so test writes are real.

## Reproducing the end-to-end test

See the [Claude Code end-to-end runbook](../frontend/docs/e2e/README.md) for exact setup,
fixture, reference paths, browser steps, acceptance checks and debugging entry points.
Latest checkpoint: the four-clip chain fixture is fully validated, retains seven
references after reload, and has a saved 19.783-second merged MP4. Preserve the
existing four-by-five-second project (20 seconds). Earlier dated checkpoints above
describe historical results, not the current state.
