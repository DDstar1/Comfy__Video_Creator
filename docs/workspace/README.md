# ClipWeave — book-to-video studio

## Latest documentation checkpoint — 2026-09-16

This handoff copy mirrors the active project state: direct project routes,
fixed project quality/frame settings, suggested-reference resolution,
chain-aware rendering and validated-chain CPU FFmpeg exports are implemented.
The shared ClipWeave mark is used throughout the web experience and the applied
analytics migration backs `/admin` with server-only cost tracking.

**Correction, same day.** Duration/Render did not actually stack at desktop as
previously stated — the rule was scoped to a mobile-only query. Fixed by
reusing mobile's layout unscoped, so desktop and mobile now render identically
(55px label, 160px column shared by the select and lock icon, note hidden
everywhere). The validated-clip footer's Regenerate/Next-clip buttons got the
same fix and now stack full width at every viewport. A CSS specificity bug
along the way — a generic `.editor-footer > div` rule outranking the intended
`.editor-footer-actions` grid rule — caused the buttons to render overlapping
before it was traced and fixed. Verified live by measuring rendered element
positions, not by eye. This changes only presentation, not rendering behavior,
clip duration, render-profile locks, or saved values. Targeted type/lint and
live CSS-layout checks passed.

**Later the same day:** three more fixes, each found by direct user testing.
(1) Every reason Generate/Validate can be disabled is now shown as red text
above the button instead of only one of eight conditions ever explaining
itself — a real user hit a silent case and asked why. (2) The regenerate
confirmation button now shows a spinner while its API call and project reload
are in flight, and clicking a disabled button shakes the reason text instead
of doing nothing — both needed dropping the native `disabled` attribute for
`aria-disabled` plus a manual click guard, since a truly disabled button never
fires `onClick`. (3) The description textarea now highlights `@mentions`
green (matched, with a small thumbnail) or red (unmatched) live while typing,
via a mirror-overlay `<div>` behind a transparent textarea. A user screenshot
caught a real bug in this: the thumbnail's original left-of-word placement
landed on top of whatever word preceded the mention on the same line — fixed
by floating it above instead, since horizontal placement can't reserve space
without desyncing the overlay's line-wrapping from the real textarea's.
**That fix has not yet been re-verified live** in the browser. See the root
README for the full account. TypeScript and targeted ESLint passed; no paid
provider request was needed.


## Current product state — 2026-09-13

This workspace handoff copy mirrors the root project state. ClipWeave now has
direct project URLs, fixed-per-project quality/frame settings, suggested versus
linked reference handling, chain-scoped rendering and validated-chain FFmpeg
exports. The owner-only `/admin` dashboard is backed by the applied analytics
migration, while net profit remains unavailable until all real operating costs
are reconciled.

The shared generated mark at
[../../public/brand/clipweave-mark.png](../../public/brand/clipweave-mark.png)
is used on landing, policy and Studio surfaces plus browser metadata. The current
local check passed 39 tests, TypeScript, targeted ESLint and responsive browser
loading without submitting a paid provider generation.


## Latest local state — 2026-09-12

This checkpoint supersedes historical push/build statements below. The latest
changes are in the local checkout; a new commit, push, and production deployment
have not been verified.

- Projects use `/studio/projects/[projectId]?tab=...`; the library uses
  `/studio/library`. Old hash links migrate. The sidebar loads project summaries,
  while clips and prompt history load only for the selected project.
- Project quality/aspect-ratio settings and suggested reference indicators are
  persisted. Missing suggested references must be resolved before rendering.
- Active clip cards show a spinner and **Generating**. Only connected clip
  groups share the green background; desktop spacing within a group is tighter.
- Validation waits for a successful database save before showing a lock. Earlier
  validation prerequisites are scoped to the current scene chain.
- Accepted render acknowledgements retry database saves without resubmitting to
  RunPod. Status polling retries transient failures; exhausted acknowledgement
  retries still require operator recovery.
- **Merge videos** joins the last cumulative video from each validated chain on
  the Next.js CPU using FFmpeg, avoiding duplicated continuation footage and a
  new GPU job. Preview/download and reload of the stored export are implemented.
- Live local verification: all four clips validated and survived reload; the
  merged result played at 19.783 seconds, 608×352 without a media error. The
  coordinating merge task reported 34 tests, ESLint, and production build passing.
  The later grouping-only edit passed targeted ESLint.

Production merge limits/FFmpeg packaging, ordinary customer billing, live Creem
payment, and unattended render reconciliation still need verification/work.
See the dated E2E report for detailed evidence and historical recovery incidents.

For the latest local browser test, job recovery, and outstanding checks, read the
[2026-09-12 live E2E retest](frontend/docs/e2e/2026-09-12-live-retest.md).
Its dated evidence supersedes earlier testing checkpoints below.

ClipWeave turns book scenes and video ideas into editable clip plans for MiniMax H3
Extender. The Next.js workspace, AI prompt backend, reference library and deployable
RunPod Serverless worker image, render pipeline and prepaid wallet are implemented.

**Historical push checkpoint: `bb21cfc` (not the latest local changes).** `frontend/` (`DDstar1/Comfy__Video_Creator`)
and `runpod-worker-repo/` (`DDstar1/ComfyUI_MiniMax_H3_Extender`) are on `origin/main`
with everything this README describes: the render pipeline, the chain/cuts
model and render recovery. If `Comfy__Video_Creator` is wired to Vercel, that
push triggers a production deploy — confirm `RUNPOD_S3_VOLUME_ID` and
`RUNPOD_S3_REGION` are actually set there, alongside the existing
`RUNPOD_S3_STORAGE_*` credentials, or the volume-direct recovery path added
this session will fail in production even though it works locally.

## Scene cuts and render recovery — 2026-09-12, later the same day

Clips no longer have to be one continuous take per project. Each clip carries
`continuesPrevious`; a clip that does not continue starts a new chain with its
own `cache_namespace` and its own motion context, so a genuine scene change
cuts instead of morphing the previous subject into the new one. Validation and
render workflow assembly are scoped to a clip's own chain. The director sets
the flag from the story and is told to prefer a cut when unsure; the customer
can override it per clip. **Verified live**: a fresh project's plan correctly
marked two of its four beats as cuts and one as a continuation, matching the
story, and the resulting chains rendered with the right durations — a cut clip
came back at its own ~5s rather than the ~9.4s cumulative a wrongly-continued
clip produced earlier in the day.

Two more real bugs surfaced while proving this out, both fixed:

- **Results were only ingested while a tab kept polling.** A render that had
  already completed on RunPod (`executionTime` set, a video in its output)
  stayed `queued` forever in the database because nothing was reading its
  status. Polling is now resumable: on load, the app finds any of the user's
  jobs still in flight and re-attaches to them, and re-reads the session on
  every poll pass instead of capturing it once.
- **A stranded job permanently blocked its project.** The one-active-render
  lock has no timeout, and nothing could clear a job stuck mid-flight —
  `authenticated` only ever held `select, insert` on render jobs, and the
  existing `comfyTR_release_render` releases wallet credit, not job status.
  A new `comfyTR_abandon_render` function lets an owner release their own
  stranded job.

That led to a further discovery: a generation job's own RunPod `/status`
result is only queryable for roughly 30 minutes after completion — confirmed
live, a genuinely finished job 404'd once that window passed. The video
survives regardless, on the Network Volume, as an ordinary side effect of the
Extender's disk cache. Recovering it went through two iterations:

1. First, a worker job type (`input.fetch`) that reads the cached file and
   returns it like a normal render. Built pointing at the wrong file
   (`chain_*.preview.mp4`, which this workflow never writes) and initially
   verified against a mixed fleet before the corrected image had fully rolled
   out — worth remembering that a fix isn't proven until it's tested after
   the old workers have actually cycled out. Corrected to read
   `chain_*.final.video/ref2va_NNNN.<ext>`, the file that is always present,
   confirmed by listing the volume directly for both a validated and an
   unvalidated chain.
2. Then, a cheaper path for the common case: the Next.js server already holds
   RunPod S3 credentials, unused, in its environment. For a single-clip chain
   it now reads the volume directly over a signed request — no RunPod job, no
   GPU charge, no cold start. RunPod's S3 API does not support presigned URLs
   (verified: a correctly-signed query-string GET with no `Authorization`
   header returns 401), so this can only ever produce bytes on the server,
   never a link for the browser; a multi-clip chain, which needs ffmpeg to
   join its segments, still falls back to the worker.

Both recovery paths are verified live against the real volume, independently:
the worker's `input.fetch` completed and returned the expected file and byte
count, and the server's direct read (proven first with a standalone script
mirroring its exact logic, before trusting it in the route) downloaded the
same file and confirmed a valid MP4 signature on the bytes.

**Still not solved:** recovering a render that nobody ever polled at all — if
no browser opens the project before RunPod's own window closes, nothing
triggers recovery, worker-side or server-side. Closing that gap needs a
webhook or a server-side cron, both of which need service-role access this
deployment doesn't have configured.

## End-to-end test checkpoint — 2026-09-12

**Video generation works.** Two clips of the Red Signal fixture rendered, stored
and played back. Clip 1: 5.167 s, 608×352, with audio, 4 m 51 s of GPU runtime.
Clip 2: 9.417 s in 5 m 23 s. Both live in the private `comfytr-generated-videos`
bucket at `<user>/<project>/<clip>/<asset>.mp4` behind signed URLs. Clip 1 is
validated and locked.

Clip 2's output is **cumulative** — it contains clip 1 plus the new footage,
minus the seam trim. That is the proof the H3 disk cache reused validated clip 1
as motion context across two separate jobs on different workers, which is exactly
what the per-project cache isolation exists to enable. Note that Final Decode
returns the whole chain, not the newest clip alone.

Seven defects were fixed to get here. Each was hidden behind the previous one:

1. `APIError.request_id` renamed to `requestID` in the OpenAI v7 SDK — type
   checking failed, so nothing could deploy.
2. The director parsed `response.output_text`, which concatenates **every**
   assistant message. When the model answered once before consulting the skill
   and again afterwards, parsing saw `{…}{…}` and threw. Only the final message
   is authoritative.
3. `class_type: "String"` came from a third-party pack absent from the worker
   image; replaced with ComfyUI's built-in `PrimitiveStringMultiline`.
4. The server-side node allowlist still listed `String`, rejecting the new node
   before it reached RunPod. The allowlist has to move with the workflow builder.
5. `MiniMaxH3MotionContextDiskFinalDecode` requires an `autoplay` input; API
   format does not apply widget defaults the way the UI does.
6. **The models were never at `/runpod-volume/models`.** The Pod setup installs
   ComfyUI onto the volume, so the weights live at `runpod-slim/ComfyUI/models`.
   A Pod mounts at `/workspace` and finds them; Serverless mounts at
   `/runpod-volume` and did not. Fixed by appending an `extra_model_paths` entry
   in the image rather than moving ~52 GB onto a volume with ~30 GB free. Two
   documented filenames were also wrong: the text encoder is `int8`, not `int4`,
   and the Turbo LoRA has no `(1)` suffix.
7. **The autosave destroyed project data.** `onAuthStateChange` hands back a new
   user object on every token refresh or tab focus; effects keyed on that object
   re-ran the project load and replaced local state with the database, silently
   discarding edits that had not finished saving. Separately the reference sync
   deleted every link and re-inserted only when the selection was non-empty, so
   one save carrying an empty selection wiped a project's references. Both fixed.

The endpoint is now **pinned to an image digest** rather than the mutable
`runpod-latest` tag. Before pinning, the fleet was mixed — some workers ran the
old image and reported empty model lists while others succeeded, so identical
jobs failed at random. Future CI builds will not auto-deploy; roll out with
`runpodctl template update uoq6ryaqu6 --image <ref>`.

The original fixture, **Red Signal — Fracture — 20 second test**
(`b60e775c-2c0f-479d-a134-96575fa26bc2`), predates the chain model: its four
clips were planned before cuts existed, one clip's project could not be
deleted afterward because `comfyTR_wallet_ledger` holds a non-cascading
reference to its render jobs — an intentional immutability guarantee, and a
real product gap, since any project that has ever rendered can never be
deleted through the client today. A second fixture, **Red Signal — Fracture —
chain test** (`647b5ca1-17a1-48c6-9a3b-d0dd102100ab`), was created fresh with
the same story and references to verify chains: same four beats, same seven
references (Lyra, Tomas, Sayen, Wren, Infirmary, BaseCorridor, TrainingVault),
no project over 20 seconds.

The verified owner account has unlimited **platform** generation credit, enforced
server-side by `billing-access.ts`; other users get normal wallet reservations.
RunPod and OpenAI provider charges still apply. Every render so far has settled
at either `charged_cents: 0` (owner exemption) or the configured floor charge
(a volume-recovered render, billed for zero new GPU runtime), so the wallet's
reserve/settle/refund path is still unproven on a real charge.

Local testing runs against the configured remote Supabase, OpenAI and RunPod:
writes are real and inference is billable. No mock render has been substituted.

**Still unverified:** clips 3–4 and continuation past the first validated clip,
production OAuth, a live Creem payment, and the merge job. See the
[e2e runbook](frontend/docs/e2e/README.md).


## Current state

| Area | Implemented | Remaining / verification limit |
| --- | --- | --- |
| Next.js workspace | Public launch page, email/password and Google signup, masked waitlist at `/`; projects, story input, references and clip editor at `/studio` | Local sign-in and the full clip flow verified; production OAuth still unverified |
| Supabase | Auth, public image library, account projects/clips/prompt versions, project references, masked waitlist and database clip locks | Verified live, including recovery after the autosave bug |
| AI director | Server-side Luna Responses request, uploaded H3 skill, live clip planning and revisions verified | Works; the open problem is planning quality, not plumbing — see the scene-cut note below |
| Prompt revisions | Readable description and H3 prompt updated together; history persists in Supabase; later drafts flagged for continuity review | Verified live on clips 1 and 2: revision increments, history persists, continuity flag clears |
| Clip validation | UI/model/API guards plus database immutability and ordered-prefix enforcement, scoped per chain | Verified live; validated clips reject edits and removal; a cut clip validates independently of the scene before it |
| RunPod worker | Custom H3 Extender image, endpoint `nqpfrj6twlaz5h` pinned to a digest, models resolved via `extra_model_paths`, MP4/MKV responses, `input.merge` and `input.fetch` job types | Rendering and `fetch` verified live for a single-clip chain; **merge never executed against a real multi-clip chain** |
| Application render pipeline | API workflow assembly (scoped per chain), authenticated RunPod submission, resumable polling, one-active-job project lock (recoverable via `comfyTR_abandon_render`), private video storage with signed previews, and volume-direct render recovery | Verified live for three clips across two chains |
| Wallet and payments | $5 minimum Creem checkout, USD wallet ledger, render reservation, runtime settlement plus $0.30 margin, and automatic failure refunds | Never exercised on a real charge; all renders so far were owner-exempt or settled at the zero-runtime floor |

## Scene cuts and final exports

Scene chains are implemented. The current Merge videos action joins stored chain
exports on the Next.js CPU and has passed the local 19.783-second fixture test.
The older RunPod input.merge implementation is a separate path and was not
exercised by that test. See the latest checkpoint and E2E report above.

## Workflow

1. Create a project from a typed idea, pasted scene or TXT/Markdown file. Select
   Draft, Standard or High quality and landscape, portrait or square frame size.
   Settings apply to every render and become fixed once clips exist.
2. Upload images to the account library and select project references. Use named
   `@mentions` such as `@Elena` in the story.
3. Choose **Create clip plan** for an empty project. The director returns readable
   descriptions, complete H3 prompts, image bindings and proposed end states.
   Linked images appear green; missing suggestions appear red. Upload an image,
   choose one from the library, or remove the suggestion. Linking updates matching
   draft clips and requires prompt recompilation before rendering.
4. In **Project → Clips**, use **Edit description → Update prompt**, submit a short
   change request, or choose **Compile/Recompile prompt**. Successful results save
   both prompt versions together; failed requests preserve pending edits for retry.
5. Next.js assembles an executable workflow and sends it with its reference images
   to RunPod after reserving generation credit. The worker returns video artifacts.
6. Preview the rendered clip and validate it. Earlier clips in the same continuous
   chain must be validated first; other chains are independent. The UI waits for
   the database save before showing a lock.
7. When every clip is validated, use **Merge videos** on the Clips tab. The server
   joins saved chain exports without another GPU render, then shows a preview and
   **Download merged video**. The private export is retained for subsequent visits.

Each project has a bookmarkable `/studio/projects/PROJECT_ID?tab=clips` URL.
Opening it fetches that project's saved details; sidebar entries load lightweight
summaries. Story and References tabs also have URLs, and old hash links migrate.
Account ownership is still required. Pending edits are saved before switching
project detail loads; late requests cannot replace the selected project.

For exact output dimensions, reference-resolution behaviour, source files, merge
limits and FFmpeg deployment setup, see the [frontend README](frontend/README.md#current-state).
The quality/reference migration
[20260912000004](supabase/migrations/20260912000004_comfyTR_project_quality_references.sql)
was applied to the linked database. Standard/High GPU rendering and production
merge packaging remain unverified. Existing projects retain Draft resolution.

Only image references are supported by ClipWeave. The current AI endpoint allows
12 clips, 9 selected project images, 50,000 story characters and a 500 KB request.
The account library can contain more than nine images. Each clip's ordered image
IDs determine its `<Picture N>` bindings. The broader vendored node supports modes
and media types that the customer frontend does not yet expose.

## Code layout and prompt editing

All application UI and AI request code is inside the Next.js **`frontend/`** folder.

| Location | Purpose |
| --- | --- |
| [frontend/src/components/studio.tsx](frontend/src/components/studio.tsx) | Screens, readable prompt editor, API calls and Supabase project persistence |
| [frontend/src/app/page.tsx](frontend/src/app/page.tsx) | ClipWeave launch page and early-access offer |
| [frontend/src/lib/server/director.ts](frontend/src/lib/server/director.ts) | Developer instructions, model settings and skill attachment |
| [frontend/src/app/api/director/route.ts](frontend/src/app/api/director/route.ts) | `POST /api/director`, auth, request checks and error handling |
| [frontend/src/lib/director-contract.ts](frontend/src/lib/director-contract.ts) | Input/output contracts, H3 section order and reference checks |
| [frontend/src/lib/studio-model.ts](frontend/src/lib/studio-model.ts) | Clip guards, synchronized revisions, history and continuity flags |
| [frontend/skills/minimax-h3-extender-sequential-director/SKILL.md](frontend/skills/minimax-h3-extender-sequential-director/SKILL.md) | H3 Director rules; detailed guides are in its `references/` folder |
| [supabase/](supabase/README.md) | Shared database link, migrations, RLS and image storage |
| [node/](node/README.md) | Vendored Extender; local changes documented in [FORK_NOTES.md](node/FORK_NOTES.md) |

Generated prompts are project data in account-scoped Supabase records, not source
files. Downloaded draft JSON includes technical prompts,
reference bindings and revision history; it is not an executable ComfyUI workflow.

## Local setup

Use Node.js 22.18 or newer. From the repository root:

```powershell
cd frontend
npm install
```

Set these variables in ignored `frontend/.env` (placeholder values only):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
CHATGPT_KEY=YOUR_OPENAI_API_KEY
RUNPOD_ENDPOINT_API_KEY=YOUR_RUNPOD_API_KEY
RUNPOD_ENDPOINT_ID=nqpfrj6twlaz5h
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
CREEM_API_KEY=YOUR_CREEM_API_KEY
CREEM_WEBHOOK_SECRET=YOUR_CREEM_WEBHOOK_SECRET
CREEM_WALLET_PRODUCT_ID=YOUR_ONE_TIME_PRODUCT_ID
CREEM_TEST_MODE=true
RUNPOD_GPU_RATE_CENTS_PER_HOUR=58
CLIPWEAVE_MARGIN_CENTS=30
```

The two `NEXT_PUBLIC_` values configure the browser's Supabase client. `CHATGPT_KEY`
and `RUNPOD_ENDPOINT_API_KEY` stay server-side. `RUNPOD_ENDPOINT_ID` is server configuration.
The existing checkout already has env configuration; preserve it. Never commit env
files or put service-role, OpenAI or RunPod credentials in browser variables.

```powershell
npm run skill:upload
npm run dev
```

Open [localhost:3000](http://localhost:3000). The skill upload saves
`OPENAI_DIRECTOR_SKILL_ID` and `OPENAI_DIRECTOR_SKILL_VERSION` in ignored
`.env.local`. It skips uploading when an ID is already configured. Restart the
server after changing env values. See the [frontend README](frontend/README.md)
for prompt-rule changes and replacement skill uploads.

## AI planning and prompt editing

The backend uses `gpt-5.6-luna`, medium verbosity, medium reasoning, standard mode,
automatic reasoning summaries, `store: true`, and the requested reasoning/source
includes. It reads `CHATGPT_KEY`, not `OPENAI_API_KEY`.

The uploaded H3 Director skill is pinned by ID/version and mounted through hosted
shell with networking disabled. The model is instructed to read its guides. The
current SDK expects the version as a string. Project data and reference images are
sent to OpenAI; response storage is enabled. Raw reasoning is not sent to the UI.

`plan` is limited to empty projects; `revise` targets one unvalidated clip. Output
checks cover required fields, H3 section order and image bindings. These checks do
not prove creative quality or compatibility with a running ComfyUI worker.

Same-origin requests are required. Development on loopback permits guest requests;
production requires verified Supabase bearer authentication. Request throttling and
overlap prevention are per server process, not distributed quotas or job locks.

The live plan-and-revision check passed on 2026-09-10. Run it again from `frontend/`
after changing the model, skill or request contract:

```powershell
npm run test:director:live
```

This makes real API requests to plan and revise a short scene. On success it saves
an ignored `.director-smoke.json` artifact. It is not part of `npm test`.

## Supabase and persistence

The existing `supabase/` folder links to shared `general_db`. Preserve unrelated
migrations. All application tables use the exact case-sensitive `comfyTR_` prefix.

| Resource | Current use |
| --- | --- |
| `comfyTR_projects` | Live account-owned project stories, settings and cover images |
| `comfyTR_reference_images` | Live account image metadata used by the frontend |
| `comfyTR_project_references` | Live project image selections and mention names |
| `comfyTR_clips` | Ordered clip state with validated-clip immutability |
| `comfyTR_clip_prompt_versions` | Immutable readable and technical prompt history |
| `comfyTR_waitlist` | Private emails exposed publicly only through a masked queue RPC |
| `comfyTR_custom_users` | Private app profiles synchronized automatically from Supabase Auth |
| `comfyTR_wallets` | Available and reserved USD cents for each account |
| `comfyTR_payment_transactions` | Idempotent Creem top-up records |
| `comfyTR_wallet_ledger` | Immutable top-up, reserve, settlement and refund entries |
| `comfytr-reference-images` | Public image bucket; JPEG/PNG/WebP, 20 MiB maximum |

Images are public by URL as requested. Metadata and uploads are account-owned
through RLS. Image replacements require new IDs/paths; client overwrite and deletion
are disabled. See [supabase/README.md](supabase/README.md) for upload behavior,
migrations and rollback-only database checks.

## RunPod Serverless worker

Project cache isolation is implemented in the published worker. Each request carries
a stable namespace instead of allowing every project to share one cache directory.

The deployable worker lives in `runpod-worker-repo/` and is also pushed to
[DDstar1/ComfyUI_MiniMax_H3_Extender](https://github.com/DDstar1/ComfyUI_MiniMax_H3_Extender).
GitHub Actions successfully built commit `e1c4c07` as `linux/amd64` and published:

```text
ghcr.io/ddstar1/comfyui_minimax_h3_extender:runpod-latest
```

The image installs the custom node into RunPod's official ComfyUI worker and the
H3 disk cache defaults to `/runpod-volume/comfytr-cache`. The wrapper around
RunPod's normal ComfyUI handler accepts `input.workflow` plus optional
`input.images` and returns final MP4/MKV files under `output.videos`. It also
accepts `input.merge` to join finished chains.

**Models are not under `/runpod-volume/models`.** The Pod setup installs ComfyUI
onto the volume itself, so the weights live at `runpod-slim/ComfyUI/models`. A
Pod mounts the volume at `/workspace` and finds them; Serverless mounts it at
`/runpod-volume` and does not. The image appends an `extra_model_paths` entry
pointing at the real location. Relocating the weights was not an option: the
volume is 100 GB with 69.26 GB used and the five H3 models are ~52 GB.

Each render request must include a stable `input.cache_namespace` derived server-side
from the authenticated user and project IDs. The worker hashes it into a separate
directory beneath the cache root and serializes jobs within a worker. This preserves
validated continuity for the same project without sharing cache files across projects.

A live Queue endpoint now exists:

| Setting | Last recorded configuration 2026-09-12 |
| --- | --- |
| Name / ID | `my_extender_endpoint` / `nqpfrj6twlaz5h` |
| Template | `uoq6ryaqu6` |
| Image | pinned digest `…@sha256:85acd4ab…`, **not** the mutable `runpod-latest` tag |
| Region / volume | `EU-RO-1` / `my_100gb_volume` (`0oaqjjkos5`) |
| Workers | minimum `0`, maximum `3`, idle timeout `300` seconds |
| Job timeout | `1800000` ms (30 minutes) |
| GPU pools | `AMPERE_16`, `AMPERE_24` |
| FlashBoot | Off |

**Why the digest pin matters.** While the endpoint tracked `runpod-latest`, the
fleet ran a mix of images: workers that had pulled the new image found the
models, workers still on the cached old image reported empty model lists. The
same unchanged job then succeeded or failed depending on which worker picked it
up. Pinning to a digest makes the fleet uniform. The trade-off is that CI builds
no longer deploy themselves — rolling out is now an explicit
`runpodctl template update uoq6ryaqu6 --image <ref>`.

Measured on this endpoint: clip 1 took 4 m 51 s and clip 2 took 5 m 23 s of GPU
runtime at the 0.2 MP draft canvas, both at 608×352 with audio. Clip 2 produced
nearly double the footage for a similar runtime because validated clip 1 was
reused from cache rather than re-sampled.

### Measured Pod benchmark

Manual generation on an RTX 2000 Ada 16 GB Pod billed at $0.26/hour produced:

| Resolution selector | Six-second render | Approximate compute per clip | Thirty-clip projection |
| --- | ---: | ---: | ---: |
| 0.2 MP | 8m 48s and 9m 7s; 8m 58s average | $0.039 | 4h 29m / $1.17 |
| 0.4 MP | 17m 6s | $0.074 | 8h 33m / $2.22 |

The 0.4 MP test almost doubled runtime. At the lower setting the GPU reached 100%
VRAM while utilization was around 20%, so larger canvases can increase offloading
or fail on 16 GB. Resolution Selector outputs are connected to the Extender width
and height inputs. Changing resolution invalidates cached sequence geometry: use
one resolution for the whole sequence and regenerate from Clip 1. See
[the deployment guide](runpod-worker-repo/RUNPOD_SERVERLESS.md).

## Remaining backend work

- Verify the implemented CPU merge on the deployed host, including FFmpeg
  packaging, execution limits, and larger exports. Local merge is verified.
- Close the one remaining render-recovery gap: nothing catches a render that
  nobody ever polled at all, since neither the browser resume nor the
  server's direct-volume read triggers without someone opening the project.
  Needs a webhook or a server-side cron, both of which need service-role
  access this deployment doesn't have configured yet.
- Add the server-only Supabase and Creem secrets to Vercel, configure the Creem
  webhook, and complete one live $5 top-up. Wallet settlement has never run on a
  real charge — every settlement so far has been either owner-exempt or the
  zero-runtime recovery floor.
- Finish cancellation and operational retry controls.
- Decide how a project that has ever rendered can be deleted or archived.
  `comfyTR_wallet_ledger` holds a non-cascading reference to render jobs, so
  the client can delete a never-rendered project but not one with render
  history — confirmed live when the original fixture project could not be
  removed. Needs a soft-delete/archive design, not a schema change to weaken
  the audit trail.
- Add distributed quotas, idempotency and immutable render inputs. Director
  throttling is still per server process, not distributed.
- Decide cache retention. The volume is 100 GB with ~69 GB of models and no
  cleanup job, and both merge and render recovery read chain caches from it.
- Rollout is now an explicit step (`runpodctl template update uoq6ryaqu6
  --image <ref>`) since the endpoint is pinned to a digest rather than the
  mutable tag; decide whether to keep it that way or accept CI auto-deploying
  again.

The intended RunPod design is one clip per queued job and one job per worker.
Cache isolation is implemented in the worker and verified per chain: a
continuing clip reuses its own chain's validated prefix across separate jobs
on different workers, and a cut clip renders with none of an earlier chain's
context. Next.js derives the namespace server-side from the authenticated
user, project and chain. See [node/FORK_NOTES.md](node/FORK_NOTES.md).

## Checks and further documentation

Run from `frontend/`:

```powershell
npm run lint
npm test
npm run build
```

- [Frontend setup, prompt files and skill lifecycle](frontend/README.md)
- [UI plan](frontend/UI_PLAN.md)
- [Database and storage](supabase/README.md)
- [Vendored Extender documentation](node/README.md)
- [RunPod Serverless image and API contract](runpod-worker-repo/RUNPOD_SERVERLESS.md)

## Reproducing the end-to-end test

See the [Claude Code end-to-end runbook](frontend/docs/e2e/README.md) for exact setup,
fixture, reference paths, browser steps, acceptance checks and debugging entry points.
Latest checkpoint: local Google sign-in and project loading passed. The connected
local prompt-revision retry still returned invalid model output after the schema
change; parser diagnostics are the next step. No render for this project has yet
been submitted. Preserve the existing four-by-five-second project (20 seconds).

