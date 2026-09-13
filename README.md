# ClipWeave Next.js application

This folder contains both the customer frontend and the server-side AI prompt
backend. It uses Next.js 16, React 19, TypeScript, Supabase, OpenAI, Zod and Lucide.
See the [root README](../README.md) for overall status and [UI_PLAN.md](UI_PLAN.md)
for the interface design.

## Status

### Owner analytics - 2026-09-13

Added `/admin`: owner-only user rankings, generation history, provider cost
estimates, reliability, deposits and partial contribution. See
[admin setup and accounting limitations](docs/ADMIN_ANALYTICS.md) for the
required migration, server-only usage key and configurable pricing. True net
profit is not claimed while expenses are missing. The analytics migration was
applied to the linked Supabase project on 2026-09-13.

### Latest local changes — 2026-09-12

Historical push statements below do not include a verified deployment of these
latest working-tree changes.

- Direct project routes: `/studio/projects/[projectId]?tab=story|references|clips`;
  `/studio/library` for account references. Legacy hash bookmarks migrate.
  `loadProjectSummaries` loads sidebar metadata; `loadAccountProject` scopes full
  clip/reference/history reads to the selected project.
- Quality/ratio settings and suggested-reference linking are implemented and
  persisted. Unresolved suggested references block render submission.
- Clip cards display a spinner with **Generating** while preparing, queued, or
  running. Green wrappers apply only to connected sequences. Desktop internal
  gaps are 4px; mobile retains 8px touch spacing.
- Validation awaits persistence before success. Continuation prerequisites are
  checked within the current chain. Accepted-job acknowledgement retries never
  submit a second GPU job; GET status reads retry transient failures.
- **Merge videos** is available when every clip is validated and has a stored
  video. `POST /api/projects/merge` accepts `{ projectId }`; authenticated
  `GET /api/projects/merge?projectId=...` restores an existing export. The server
  selects only the final cumulative video of each chain and joins them with
  `ffmpeg-static` on CPU. No RunPod generation is submitted for this merge.
- Exports are private MP4s in `comfytr-generated-videos` at
  `USER_ID/PROJECT_ID/exports/SOURCE_HASH.mp4`, with one-hour signed preview and
  download URLs. Inputs are limited to 512 MB; the route requests a 300-second
  execution limit. Production hosting limits and binary packaging need a deployed
  smoke test.

The local four-clip fixture survived reload with all validations and seven
references. Its merged video played at 19.783 seconds, 608×352, without a media
error. The coordinating merge task reported 34 tests, targeted ESLint, and build
passing; the subsequent grouping change passed targeted ESLint. Ordinary paid
customer settlement and production deployment were not tested in this run.

Latest live verification: [2026-09-12 E2E retest](docs/e2e/2026-09-12-live-retest.md).
See that report for real GPU execution/playback evidence and unresolved checks;
historical build and deployment statements below are not a fresh E2E pass.

Both this repo and `runpod-worker-repo/` are pushed to `origin/main` as of
`bb21cfc` (frontend) — see the root README's checkpoint sections for the full
account of what changed and how it was verified. If this deploys to Vercel,
confirm `RUNPOD_S3_VOLUME_ID` and `RUNPOD_S3_REGION` are set there alongside
the existing `RUNPOD_S3_STORAGE_*` credentials before trusting render recovery
in production — it works locally, but has not been checked against the
production environment.

Local development for iterating on this repo: run
`npm run dev -- --hostname 127.0.0.1 --port 3000`, open
`http://localhost:3000/studio`. Localhost needs its own login and an allowed
Supabase redirect to `http://localhost:3000/studio`. It connects to the
configured remote Supabase, OpenAI and RunPod services — writes are real and
inference is billable; no mock render exists.

## Current state

### Project creation and references

New projects accept a book scene or an original idea, plus quality and
device/frame size. These settings remain editable on the Story tab until clips
exist; afterward the UI and database trigger lock them. Every render reads the
saved settings on the server. Existing projects default to Draft.

| Quality | Landscape / desktop (16:9) | Portrait / phone (9:16) | Square (1:1) |
| --- | --- | --- | --- |
| Draft | 608 x 352 | 352 x 608 | 448 x 448 |
| Standard | 960 x 544 | 544 x 960 | 704 x 704 |
| High | 1280 x 736 | 736 x 1280 | 960 x 960 |

These are model-aligned dimensions, not exact mathematical aspect ratios.
Quality changes resolution, not the four-step Turbo sampler. Standard/High GPU
output has not been verified live.

The director can suggest up to four missing image references per planned clip.
Each contains a name and description reused for the same subject across clips.
Linked images have a light green background and **Linked** checkmark; missing
suggestions use light red and **Image needed**. Labels supplement the colours.

- **Upload image** pre-fills the suggested name/description and adds the image to
  the account library and project.
- **Choose from library** links a real image across affected draft clips.
- **Remove** dismisses the matching suggestion across draft clips. Subjects remain
  described in words; suggestions never receive a `<Picture N>` binding.
- Linking marks affected prompts stale and adds a compilation request identifying
  the subject/image mapping. Recompile before generating. Validated clips remain
  unchanged; the nine-image project/clip limits still apply.
- Revisions preserve only remaining suggestions. Both client and render API
  reject unresolved suggestions before video generation.

`directorResponseSchema` requires the suggestion array for strict structured
output. The stored-data parser accepts older clips without that field.

### Project links and loading

`/studio` lists projects. Sidebar/cards link to
`/studio/projects/PROJECT_ID?tab=story|references|clips`; `/studio/library` opens
the account library. Bookmarks, new tabs, direct reload, and Back/Forward work.
Legacy `#/project/ID/TAB` links migrate to the new URL.

`loadProjectSummaries` reads only ID, title, cover, ratio, and update time.
`loadAccountProject(client, ownerId, projectId)` loads the selected project,
its clips, reference links and those clips' prompt versions, renewing signed
video URLs. The reference library refreshes on project entry; active-job recovery
is scoped to that project. Summaries never enter autosave as full projects.
Pending edits are saved through the save queue before the next detail load.
Request cleanup ignores late responses after navigation.

Loading, sign-in, unavailable-project and retry states cover direct visits.
A URL does not grant access: owner filters and database RLS still apply.
Google sign-in preserves the current studio path; configure Supabase's redirect
allow list for deployed studio/project paths and localhost.

### Final video export

Once all clips are validated and have permanent video paths, **Merge videos**
is enabled above the clip sequence. Progress is followed by a preview and
**Download merged video**. Reopening the project retrieves the stored export.
Adding clips changes the export signature so an older film is not offered as
the current result. Errors are shown for retry; source clips remain locked.

The authenticated merge API checks project ownership and validation, orders clips
by position, and selects the last cumulative video from each chain. Concatenating
every preview would duplicate continuation footage. FFmpeg stream-copies video
and audio into MP4 without a new GPU render. Temporary files are cleaned up on
success or failure. The private export filename hashes the ordered source paths;
repeat requests reuse it. Preview/download URLs last one hour and renew on reload.

`npm install` or `npm ci` installs `ffmpeg-static`; its installation script must
run to obtain the platform binary. `next.config.ts` externalizes the package and
includes it in merge-route tracing. The host needs Node.js child-process support
and writable temporary storage; this is not an Edge route. Inputs are capped at
512 MiB, FFmpeg has a 180-second timeout, and the route declares 300 seconds.
Production memory, bundle and execution limits still require deployment QA.
Exports use existing storage policies, with no new table or service-role key.
This is separate from the older RunPod `input.merge` path.

| Implementation | Responsibility |
| --- | --- |
| [studio-forms.tsx](src/components/studio-forms.tsx) | Creation settings and pre-filled uploads |
| [studio-model.ts](src/lib/studio-model.ts) | Shared suggestion resolution |
| [studio-route.ts](src/lib/studio-route.ts) | URLs and legacy bookmark parsing |
| [project-store.ts](src/lib/project-store.ts) | Summaries, scoped loading, persistence |
| [project-merge.tsx](src/components/project-merge.tsx) | Merge progress, preview and download |
| [merge API](src/app/api/projects/merge/route.ts) | Ownership checks and private exports |
| [merge-plan.ts](src/lib/merge-plan.ts) | Final source selection per chain |
| [merge-video.ts](src/lib/server/merge-video.ts) | FFmpeg and temporary-file cleanup |

Migration
[20260912000004_comfyTR_project_quality_references.sql](../supabase/migrations/20260912000004_comfyTR_project_quality_references.sql)
was applied to the linked database this session. Deploy it with these frontend
changes; saves of the new fields fail without it.

Projects, scene input, image-library/account forms and the clip editor are built.
Luna planning and prompt-editing requests are wired to `POST /api/director` with the
uploaded H3 Director skill. A live plan-and-revision request passed on 2026-09-10.

The public ClipWeave launch page is at `/`; the creator workspace is at `/studio`.
Visitors can create an account or sign in from the navigation, hero and footer.
The shared auth dialog supports Google OAuth plus email/password signup with a
name, password confirmation and visibility controls. Confirmed sessions continue
to `/studio`; the waitlist remains a separate early-access registration.
The landing page presents sequential clip validation as a core benefit: creators
verify each clip before continuing so its approved ending guides the next scene.
Supabase stores the waitlist, account reference library, projects, clips, project
reference selections, prompt history, render jobs and generated-video metadata.
`POST /api/renders` submits an authenticated API-format workflow to RunPod and
`GET /api/renders?jobId=...` polls it, copies the completed video into permanent
project storage, attaches it to its clip and marks that clip ready for validation.
The Generate button assembles the H3 Extender workflow, uploads the current clip's
ordered references, submits the job and polls every five seconds. It shows preparation,
queue and generation states before enabling video validation. **Verified live on
2026-09-12 for a two-chain, three-clip sequence**, which then played back from
the private bucket through signed URLs. In the sample project, reference stills
and the sample validated clip remain examples rather than generated videos.

Clips are chained into scenes rather than one project-long take. A clip either
continues the previous one (`continuesPrevious`, defaulting true) or cuts to a
new chain; the director decides this per clip from the story, the customer can
override it, and each chain gets its own `cache_namespace`
(`user:project:chainIndex`) and its own motion context. Only a clip's own chain
is sent to the Extender, so an earlier scene never leaks into a cut. Final
Decode returns the **cumulative video for that chain**, not the newest clip
alone — a two-clip chain's stored video contains both clips, but a fresh cut
is exactly the length of that one clip. Validation, likewise, only waits on
earlier clips in the same chain: a cut scene can be approved independently of
the scene before it.

A render survives a reload or a closed tab. Polling is what copies the finished
video out of RunPod, so on load the app finds any of the user's renders still
in flight and re-attaches to them, and re-reads the session on every poll pass
rather than capturing it once. If RunPod's own job record has already expired
by the time anyone polls it — its result is only queryable for roughly 30
minutes after completion — the video still exists on the Network Volume as an
ordinary side effect of the Extender's cache, and the server reads it from
there directly over signed S3 requests, no RunPod job or GPU charge involved,
for a single-clip chain. A chain with more than one clip needs its segments
joined through the existing recovery path, so that case asks a RunPod
worker to do the join instead. A clip being generated pulses in the sequence
and its Generate button, so an in-flight render is visible without opening it.

The studio includes a prepaid USD wallet. Creem top-ups start at $5. A render
reserves $0.59, then settles the RunPod runtime at the configured hourly rate plus
a $0.30 margin. Submission, generation and video-ingestion failures refund the
reservation automatically.

## Legal identity

ClipWeave is a product operated by **DTECH SOFTWARE LAB ENTERPRISE**, a business
registered in Nigeria. Customer-facing pages and payment surfaces must preserve
this relationship: ClipWeave is the product brand, while DTECH SOFTWARE LAB
ENTERPRISE is the legal business receiving payment and providing the service.
ClipWeave wallet credit is non-transferable, cannot be withdrawn as cash and may
only be used for ClipWeave services.

## Setup

Use Node.js 22.18 or newer. Run commands from this folder:

```powershell
npm install
```

Create `.env` for a fresh checkout, or preserve the existing configuration:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
CHATGPT_KEY=YOUR_OPENAI_API_KEY
RUNPOD_ENDPOINT_API_KEY=YOUR_RUNPOD_API_KEY
RUNPOD_ENDPOINT_ID=nqpfrj6twlaz5h
RUNPOD_S3_STORAGE_ACCESS_KEY=YOUR_RUNPOD_S3_ACCESS_KEY
RUNPOD_S3_STORAGE_API_KEY=YOUR_RUNPOD_S3_SECRET_KEY
RUNPOD_S3_VOLUME_ID=0oaqjjkos5
RUNPOD_S3_REGION=EU-RO-1
SUPABASE_SERVICE_KEY=YOUR_SERVER_ONLY_SERVICE_KEY
CREEM_API_KEY=YOUR_CREEM_API_KEY
CREEM_WEBHOOK_SECRET=YOUR_CREEM_WEBHOOK_SECRET
CREEM_WALLET_PRODUCT_ID=YOUR_ONE_TIME_PRODUCT_ID
CREEM_TEST_MODE=true
RUNPOD_GPU_RATE_CENTS_PER_HOUR=58
CLIPWEAVE_MARGIN_CENTS=30
```

Only the Supabase URL/publishable key are browser configuration. `CHATGPT_KEY`,
`RUNPOD_ENDPOINT_API_KEY` and the `RUNPOD_S3_*` credentials remain server-side —
the latter let the render route read a chain's video directly off the Network
Volume when a job's own status has expired, over the same S3-compatible API
`runpod-worker-repo` uses, via `src/lib/server/runpod-volume.ts`. All `.env*`
files are ignored; never expose a service-role, AI, RunPod or RunPod S3 key
through a `NEXT_PUBLIC_` variable. Next.js loads
`.env.local` ahead of `.env`.

```powershell
npm run skill:upload
npm run dev
```

Open [localhost:3000](http://localhost:3000). The existing skill was successfully
uploaded and its ID/version saved to ignored `.env.local`. The upload script exits
without creating another skill when `OPENAI_DIRECTOR_SKILL_ID` is already set.
Restart the server after environment changes.
Configure Creem's webhook as
`https://clip-weave-omega.vercel.app/api/payments/creem/webhook`.

Enable Email and Google under Supabase Authentication providers. Add the deployed
`https://YOUR_DOMAIN/studio` URL to the Supabase redirect allow list so Google
OAuth can return users to the creator workspace; localhost is used during development.

## Where prompts are edited

### Customer controls

Open **Project → Clips**:

- **Edit description → Update prompt** sends the readable edit for AI compilation.
- **What would you like to change?** accepts a brief instruction; its arrow submits it.
- **Compile/Recompile prompt** compiles the current description and any pending changes.

The backend returns a synchronized description and technical H3 prompt. Successful
revisions retain the previous compiled version in Supabase history and flag later draft
clips for continuity review. Failed requests preserve pending edits. Validated clips
have no editing controls. Validation requires every earlier clip **in the same
chain** to be validated first — a clip that cuts to a new scene starts a fresh
chain, so validating it does not depend on an earlier scene, and validating it
leaves only that chain's own prefix read-only. Supabase enforces the same
chain-scoped immutable-prefix rule.

Choose **Create clip plan** on the Story tab for an empty project. Existing clips
are revised individually. Only image references are supported; picture numbers map
to each clip's ordered reference IDs. The customer editor hides technical prompts,
but downloaded draft backups include them and their history.

### Developer files

| File                                                                                                                     | Edit here for                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [src/lib/server/director.ts](src/lib/server/director.ts)                                                                 | Developer instructions, model settings, OpenAI call and hosted skill attachment |
| [skills/minimax-h3-extender-sequential-director/SKILL.md](skills/minimax-h3-extender-sequential-director/SKILL.md)       | H3 directing rules                                                              |
| [skills/minimax-h3-extender-sequential-director/references/](skills/minimax-h3-extender-sequential-director/references/) | Base, full-reference and Extender continuity guides                             |
| [src/lib/director-contract.ts](src/lib/director-contract.ts)                                                             | Request/output schemas, section-order and reference validation                  |
| [src/app/api/director/route.ts](src/app/api/director/route.ts)                                                           | Endpoint auth, limits and errors                                                |
| [src/components/studio.tsx](src/components/studio.tsx)                                                                   | Prompt editor, API submission and Supabase persistence                          |
| [src/app/page.tsx](src/app/page.tsx)                                                                                     | ClipWeave launch page                                                           |
| [src/components/waitlist.tsx](src/components/waitlist.tsx)                                                               | Waitlist registration and masked queue                                          |
| [src/lib/studio-model.ts](src/lib/studio-model.ts)                                                                       | Revision history, chain assignment (`chainIndexes`/`chainMembers`) and chain-scoped clip locking |
| [src/lib/render-workflow.ts](src/lib/render-workflow.ts)                                                                 | Workflow assembly, scoped to the target clip's own chain                        |
| [src/app/api/renders/route.ts](src/app/api/renders/route.ts)                                                            | Render submission, chain-namespace derivation, status polling and recovery      |
| [src/lib/server/runpod-volume.ts](src/lib/server/runpod-volume.ts)                                                       | Direct S3-signed reads of a chain's video off the Network Volume                |

Generated prompts live in project data, not in `director.ts` or `SKILL.md`.

## RunPod boundary

The deployed Queue endpoint is `my_extender_endpoint` with ID
`nqpfrj6twlaz5h`. Its asynchronous submission URL is
`https://api.runpod.ai/v2/nqpfrj6twlaz5h/run`, and job status is read from
`https://api.runpod.ai/v2/nqpfrj6twlaz5h/status/{job_id}`. Only a server route may
attach the bearer API key.

The render route derives the cache namespace from the verified Supabase user,
the owned project and the target clip's **chain**. The browser cannot choose it.

The separate worker image accepts a ComfyUI API workflow in `input.workflow` and
optional base64 reference images in `input.images`. It returns final MP4/MKV files
in `output.videos`. `src/lib/render-workflow.ts` builds that workflow with the
deployed model names, ordered image inputs, four-step Turbo LoRA settings and a
project-quality canvas (Draft defaults to about 0.2 MP) and only the validated prefix
plus current clip **within the target clip's own chain**, never an earlier
scene. Submission, polling and permanent result storage are implemented and
verified live.

Every request includes `input.cache_namespace`, `${user.id}:${project.id}:${chainIndex}`
— note the added chain index, absent before scene cuts existed. `chainIndex`
increments each time a clip does not continue the previous one; the server
derives it from stored clip order, never the browser. The same value is also
stored on the render job row, so recovery later does not have to recompute a
chain index that could have drifted if clips were reordered or removed since.
Keeping the value stable per chain lets later jobs in that chain reuse validated
clips; different chains, projects and users are isolated into different hashed
directories on the Network Volume.

`RUNPOD_ENDPOINT_API_KEY` remains in server environment variables. It must not
use a `NEXT_PUBLIC_` name or be sent to browser code. Worker setup and the request
contract, including the `merge` and `fetch` job types, are documented in
[RUNPOD_SERVERLESS.md](../runpod-worker-repo/RUNPOD_SERVERLESS.md).

The live endpoint uses a GHCR image **pinned to a digest**, `EU-RO-1` and
Network Volume `0oaqjjkos5`, minimum workers `0`, maximum workers `3`, a
300-second idle timeout and a 30-minute job timeout. The digest pin exists
because the endpoint previously tracked the mutable `runpod-latest` tag: the
fleet ended up mixed mid-rollout, with old-image workers reporting empty model
lists while new-image workers succeeded on the identical job, so which worker
served a request decided whether it passed. Rolling out now means updating the
template (`runpodctl template update uoq6ryaqu6 --image <ref>`), not just
pushing to `main`.

**Recovering an expired render.** A generation job's own `/status` result is
only queryable for roughly 30 minutes after completion — verified live: a job
that had genuinely finished (`executionTime` set, a video in its output) later
404'd. The video survives that window regardless, since the Extender's disk
cache writes it to the volume as ordinary operation. On a 404, the render route
first tries reading the chain directly off the volume itself, over the S3-
compatible API (`src/lib/server/runpod-volume.ts`) — no RunPod job, no GPU
charge — which only works for a single-clip chain, since joining multiple
segments needs ffmpeg. A multi-clip chain instead asks the worker to do that
join via its `fetch` job type, verified live only for the single-segment case
so far.

The partial unique index on `comfyTR_render_jobs` permits only one active render per
project, while different projects may use the endpoint's workers concurrently.

Completed MP4/MKV/WebM/MOV results are copied from RunPod into the private
`comfytr-generated-videos` bucket at
`<user>/<project>/<clip>/<asset>.<extension>`. Publishing a replacement archives
the previous active asset record and atomically sets `comfyTR_clips.video_url` and
status `ready`. Account-scoped signed URLs provide one-hour previews. Archived objects are retained for safe recovery. Validation remains
disabled until the permanent URL is attached, and validated clips reject replacements.

## Updating the hosted skill

Editing local skill files does **not** update the uploaded skill automatically.
The current [upload script](scripts/upload-director-skill.mjs) creates a replacement
skill; it does not publish a new version of an existing skill ID.

For the supported replacement flow:

1. Edit the bundle under `skills/minimax-h3-extender-sequential-director/`.
2. Record the current skill ID/version if you need to roll back.
3. Remove `OPENAI_DIRECTOR_SKILL_ID` and `OPENAI_DIRECTOR_SKILL_VERSION` from local
   env configuration and unset any shell overrides for those variables.
4. Run `npm run skill:upload`. It uploads the local bundle and writes the replacement
   ID/version to `.env.local`. The previous hosted skill is not deleted.
5. Restart the server and, when API credits are available, run the live check below.

Changing the developer instructions in `src/lib/server/director.ts` requires no
skill upload. Deploy/restart the application as appropriate for the environment.

## API behavior and limits

`POST /api/director` accepts `action: "plan"` or `"revise"`, project context,
references and a `clipId` for revision. The server uses `CHATGPT_KEY` with
`gpt-5.6-luna`, medium verbosity/reasoning, standard mode, automatic reasoning
summary and `store: true`. It keeps the requested reasoning/source includes.

The pinned skill is attached through hosted shell with network access disabled.
Its version is serialized as a string for the installed SDK. Project context and
public reference images are sent to OpenAI; raw reasoning is not returned to the UI.

Limits: 12 clips, 9 selected project images, 50,000 story characters and a 500 KB
request. The account image library has no nine-image cap. The response must satisfy
the JSON/H3 contract; these checks do not validate execution on a ComfyUI worker.

Same-origin requests are required. Development on loopback permits guests;
production requires a verified Supabase bearer session. Throttling and overlapping
request prevention are per process. Durable project state, database locks,
distributed quotas and long-running job management remain deployment work.

## Other frontend features

- Projects: grid/list, search, draft/example filters and project creation.
- Story: TXT/Markdown import up to 2 MiB, mentions, aspect ratio and visual direction.
- References: account library, previews and public JPEG/PNG/WebP uploads up to 20 MiB.
- Account: Supabase email/password sign-in, registration and sign-out.
- Navigation: project URLs, legacy fragment migration, keyboard tabs, dialogs and responsive drawer.
- Clip sequence: a horizontally scrolling track on narrow layouts, a stacked
  sidebar on wide ones. Clips sharing a chain render inside one shared, tinted
  container — a gap between containers is a cut, one container holding several
  cards is a continuous run — computed at render time from `chainIndexes`, not
  stored separately. A clip being generated pulses in place.

The frontend uses `comfyTR_reference_images` and `comfytr-reference-images`.
Project reference selections sync to `comfyTR_project_references` by diff (only
changed ids are written), verified live after the autosave bug that used to
delete-and-reinsert the whole set was fixed. Uploads use immutable paths;
metadata failures after file upload are surfaced, and orphan cleanup remains
backend work. See [Supabase docs](../supabase/README.md).

Other implementation files: [studio-forms.tsx](src/components/studio-forms.tsx),
[ui.tsx](src/components/ui.tsx), [supabase.ts](src/lib/supabase.ts), and
[studio.css](src/app/studio.css). Geist fonts load from the pinned Next.js package.
Sample images use public Unsplash URLs with fallback UI.

## Verification

```powershell
npm run lint
npm test
npm run build
```

Latest recorded checks (2026-09-12): production build, targeted ESLint and 34 local
tests passed. Added tests cover reference resolution, strict response schema,
quality dimensions, URL parsing and project-scoped query selection, merge source
ordering, and a real FFmpeg audio/video concat/decode. A later export-signature
guard passed TypeScript. Historical earlier checks: 19 local tests passed. Tests
cover draft/validation guards, revision history, H3 contracts, chain assignment
and scoping (`tests/chains.test.mjs`), and a mocked provider request. Browser
checks covered planning, prompt revision, three live renders across two chains,
playback, validation locking, clip removal and the responsive clip track. The
built browser assets were checked for key exposure; `CHATGPT_KEY` was absent.
Authenticated upload of seven real images and persistence after reload passed
on 2026-09-11.

Note that the local tests do not cover persistence, auth lifecycle or the
render-recovery paths, which is where the worst bugs found so far lived: an
autosave that destroyed project references; effects keyed on the Supabase user
**object** rather than its id, which re-ran the project load on every token
refresh and discarded unsaved edits; and results only ingesting while a tab
kept polling, stranding a render that had already finished on RunPod. All are
fixed; none would have been caught by this suite. The direct-volume recovery
path was instead verified with a standalone script against the real volume —
see `frontend/src/lib/server/runpod-volume.ts`.

Optional live check, which makes real API requests:

```powershell
npm run test:director:live
```

It plans a short scene and revises it, saving `.director-smoke.json` only on success.
The artifact is ignored. The 2026-09-10 run produced one valid T2VA clip and a
changed revision using hosted skill version 1. The live check is separate from the
local test suite.

## Reproducing the end-to-end test

See the [Claude Code end-to-end runbook](docs/e2e/README.md) for exact setup,
fixture, reference paths, browser steps, acceptance checks and debugging entry points.
Latest checkpoint: all four clips in the chain fixture are validated, and its
19.783-second merged export is saved. Direct-project reload and browser Back were
verified. Preserve the existing four-by-five-second project (20 seconds).
