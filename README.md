# ClipWeave Next.js application

This folder contains both the customer frontend and the server-side AI prompt
backend. It uses Next.js 16, React 19, TypeScript, Supabase, OpenAI, Zod and Lucide.
See the [root README](../README.md) for overall status and [UI_PLAN.md](UI_PLAN.md)
for the interface design.

## End-to-end test checkpoint — 2026-09-11

Testing is in progress; this is not a claim that video generation passes.

- Production Google sign-in works on `www.clipweave.xyz`.
- The verified owner account has unlimited platform generation credit. This is
  enforced server-side by `billing-access.ts`; other users retain normal wallet
  reservations. RunPod/OpenAI provider charges still apply. No top-up was made.
- Project persistence now uses explicit inserts and mutable-column updates rather
  than upserts containing protected identity columns (commit `2c04a3a`).
- Owner billing access shipped in `a4d2e94` and was visible in the live wallet.
- Created **Red Signal — Fracture — 20 second test**, project
  `b60e775c-2c0f-479d-a134-96575fa26bc2`, based on physical PDF pages 1–3 of
  *Red Signal: Echo of a Lie, Act 2*. User limit: no project over 20 seconds.
- Uploaded and attached seven supplied images: Lyra, Tomas, Sayen, Wren,
  Infirmary, BaseCorridor and TrainingVault. Project, story and reference
  selections persisted after a full browser reload.
- Live director planning produced four five-second Ref2VA clips: Lyra Wakes,
  Blackout Confrontation, Directed Memory and Neural Strip, totaling 20 seconds.
- Editing the first readable prompt failed with an invalid model-output error;
  the original prompt was preserved. Exact malformed field was not captured.
  Commit `507d32d` requests strict JSON schema output using `zodTextFormat`
  while retaining H3 semantic/reference validation. It also preserves an entered
  reference name when asynchronous image loading completes. Build and all 13
  tests passed; Vercel reported the deployment READY. Live revision retry remains.
- Testing moved to local Next.js for faster server logs and iteration. Run
  `npm run dev -- --hostname 127.0.0.1 --port 3000` from `frontend`; open
  `http://localhost:3000/studio`. Localhost requires its own login and an allowed
  Supabase redirect to `http://localhost:3000/studio`. Use the existing project;
  do not create a duplicate or expand its duration.
- Local testing uses the configured remote Supabase, OpenAI and RunPod services:
  writes are real and inference is billable. No mock render has been substituted.
- Remaining: successful readable edit and brief change request, persisted prompt
  history, first playable RunPod output, storage/preview verification, validation
  locks and continuation into the next clip. Creem payment is outside this test.


## Current state

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
2026-09-11 for two clips**, which then played back from the private bucket
through signed URLs. In the sample project, reference stills and the sample
validated clip remain examples rather than generated videos.

Note that Final Decode returns the **cumulative** chain, not the newest clip
alone: clip 2's stored video contains clip 1 plus the new footage. A clip card's
preview is therefore the whole sequence so far.

The studio includes a prepaid USD wallet. Creem top-ups start at $5. A render
reserves $0.59, then settles the RunPod runtime at the configured hourly rate plus
a $0.30 margin. Submission, generation and video-ingestion failures refund the
reservation automatically.

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
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
CREEM_API_KEY=YOUR_CREEM_API_KEY
CREEM_WEBHOOK_SECRET=YOUR_CREEM_WEBHOOK_SECRET
CREEM_WALLET_PRODUCT_ID=YOUR_ONE_TIME_PRODUCT_ID
CREEM_TEST_MODE=true
RUNPOD_GPU_RATE_CENTS_PER_HOUR=58
CLIPWEAVE_MARGIN_CENTS=30
```

Only the Supabase URL/publishable key are browser configuration. `CHATGPT_KEY` and
`RUNPOD_ENDPOINT_API_KEY` remains server-side. All `.env*` files are ignored; never expose a
service-role, AI or RunPod key through a `NEXT_PUBLIC_` variable. Next.js loads
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
have no editing controls. Because validation requires every earlier clip to be
validated first, validating Clip N leaves Clips 1 through N read-only while later
clips remain editable. Supabase enforces the same immutable validated-prefix rule.

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
| [src/lib/studio-model.ts](src/lib/studio-model.ts)                                                                       | Revision history, continuity flags and clip locking guards                      |

Generated prompts live in project data, not in `director.ts` or `SKILL.md`.

## RunPod boundary

The deployed Queue endpoint is `my_extender_endpoint` with ID
`nqpfrj6twlaz5h`. Its asynchronous submission URL is
`https://api.runpod.ai/v2/nqpfrj6twlaz5h/run`, and job status is read from
`https://api.runpod.ai/v2/nqpfrj6twlaz5h/status/{job_id}`. Only a server route may
attach the bearer API key.

The render route derives the project-specific cache namespace from the verified
Supabase user and the owned project. The browser cannot choose the namespace.

The separate worker image accepts a ComfyUI API workflow in `input.workflow` and
optional base64 reference images in `input.images`. It returns final MP4/MKV files
in `output.videos`. `src/lib/render-workflow.ts` builds that workflow with the
deployed model names, the validated prefix plus current clip, ordered image inputs,
four-step Turbo LoRA settings and a 0.2 MP draft canvas. Submission, polling and
permanent result storage are implemented.

Every request includes `input.cache_namespace`. The server route derives it from
the verified Supabase user and owned project as
`${user.id}:${project.id}`. The browser must not supply the authoritative user ID.
Keeping this value stable lets later jobs reuse validated clips; different projects
are isolated into different hashed directories on the Network Volume.

`RUNPOD_ENDPOINT_API_KEY` remains in server environment variables. It must not
use a `NEXT_PUBLIC_` name or be sent to browser code. Worker setup and the request
contract are documented in
[RUNPOD_SERVERLESS.md](../runpod-worker-repo/RUNPOD_SERVERLESS.md).

The live endpoint uses the published GHCR image, `EU-RO-1` and Network Volume
`0oaqjjkos5`. It currently has minimum workers `0`, maximum workers `3`, a
300-second idle timeout and a 30-minute job timeout (last recorded 2026-09-11).
A playable endpoint render remains unverified.

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
- Navigation: URL fragments, keyboard tabs, native dialogs and responsive drawer.

The frontend uses `comfyTR_reference_images` and `comfytr-reference-images`.
Project selections currently remain local despite the database relationship tables
being available. Uploads use immutable paths; metadata failures after file upload
are surfaced, and orphan cleanup remains backend work. See [Supabase docs](../supabase/README.md).

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

Last recorded checks (2026-09-12): build, lint and 13 local tests passed. Tests
cover draft/validation guards, revision history, H3 contracts and a mocked
provider request. Browser checks covered planning, prompt revision, two live
renders, playback, validation locking, clip removal and the responsive clip
track. The built browser assets were checked for key exposure; `CHATGPT_KEY` was
absent. Authenticated upload of seven real images and persistence after reload
passed on 2026-09-11.

Note that the local tests do not cover persistence or auth lifecycle, which is
where the two worst bugs found so far lived: an autosave that destroyed project
references, and effects keyed on the Supabase user **object** rather than its id,
which re-ran the project load on every token refresh and discarded unsaved edits.
Both are fixed; neither would have been caught by this suite.

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
Latest checkpoint: local Google sign-in and project loading passed. The connected
local prompt-revision retry still returned invalid model output after the schema
change; parser diagnostics are the next step. No render for this project has yet
been submitted. Preserve the existing four-by-five-second project (20 seconds).
