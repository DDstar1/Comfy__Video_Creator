# ClipWeave live retest — 2026-09-12

This is a live browser test against local Next.js and the real Supabase, OpenAI
and RunPod services. It is not a mock test or a production deployment check.

## Fixture and limits

- Account: the previously authorized owner account; no wallet deposits or purchases.
- Project: `647b5ca1-17a1-48c6-9a3b-d0dd102100ab`, **Red Signal — Fracture — chain test**.
- Four five-second planned clips, 20 seconds total, seven existing account references.
- Source: the previously supplied Red Signal physical PDF pages 1–3.
- Preserve the older `b60e775c-2c0f-479d-a134-96575fa26bc2` fixture.

## Evidence so far

| Check | Result |
| --- | --- |
| Restore local signed-in account and saved project | PASS: four clips and seven references loaded |
| Existing Clip 2 preview | PASS: played to ended=true, 5.167 seconds; subsequently validated |
| Independent Clip 3 generation gate | Fixed: it incorrectly required validation of clips from other scenes |
| Clip 4 continuation gate | PASS: disabled before Clip 3 validation, enabled after local validation |
| Clip 4 brief change request | PASS: HTTP 200 in 29 seconds; readable and technical prompts changed from revision 1 to 2, duration stayed five seconds |
| Real Clip 3 generation | PASS on RunPod; application tracking required repair, see below |
| Clip 3 ingestion and playback | PASS: attached to clip, reopened, played to `ended=true`, duration 5.167 seconds, 608×352, no media error |
| Clips 2 and 3 validation | PASS after migration: save completed before success; both locks survived browser reload |
| Clip 4 live continuation | PASS: provider completed, ingested, cumulative 9.417-second 608×352 video played to ended=true without media errors |
| Final project merge/export | PASS reported by coordinating task: CPU merge, playable 19.783s, 608×352, no media error |
| Payments / ordinary customer charging | NOT TESTED; owner generation exemption used |
| Production deployment | NOT TESTED |

The Clip 4 revision requested a slow neural-strip handoff with a brief hesitant
pause, preserving references, corridor camera direction, no dialogue, and the
existing five-second duration. No extra scenes were requested.

## Render tracking incident

At 16:26 UTC, the local API accepted the request far enough to submit it to
RunPod, but failed while recording the provider ID. Its catch block marked the
database job failed and discarded the original plain-object error as
`Submission failed`. The browser displayed `Invalid render request`.

- Database job: `21be06a9-707e-48f4-98f2-80b0cec398b8`.
- RunPod job: `e90b6530-cf62-4762-ba97-e93a7278324a-e1`.
- Clip: `7e2916f6-2462-494e-a713-98884b83c88b` (Directed Memory).
- Worker: `lktmz0u6zkevse`, NVIDIA RTX A4500, EU-RO-1.
- RunPod reported COMPLETED, execution 264324 ms, queue delay 25687 ms.
- ComfyUI logged completion in 260.07 seconds at 16:31:36 UTC and output
  `clipweave-7e2916f6-2462-494e-a713-98884b83c88b.mp4`.

After verifying the exact provider job and output, the test restored that one
owner-scoped failed row's provider ID and queued status. Normal browser polling
then ingested it and the row became completed. No duplicate GPU job was submitted
for recovery. Temporary diagnostic/repair code was removed immediately afterward.
The exact original database error was lost by the old handler; do not claim its
root cause was proven.

The fix retries only the database acknowledgement up to three times after a
provider accepts a job. If all saves fail, it preserves the active row and
reservation, logs both non-secret job IDs for recovery, and tells the user not
to resubmit. This is bounded resilience, not a durable background reconciliation
service; an exhausted retry still needs operator recovery.

## Local testing pitfalls

1. The local Next.js process intermittently could not reach Supabase
   (`AuthRetryableFetchError`, status 0), while browser account reads succeeded.
   An out-of-sandbox auth health request returned HTTP 200. Restarting the verified
   project dev process with network access restored authenticated API requests,
   but intermittent transport errors occurred later too. The restart alone does
   not establish the root cause. Do not treat a transport failure as proof the
   user's session is invalid.
2. Generation errors used to disappear with the toast. They now remain visible
   in the clip editor. Plain database error messages are preserved in submission
   responses rather than replaced with a generic message.
3. Another coding process began modifying quality settings and suggested
   references during the run. This changed the checkout after the first green
   checks. A later project save failed and the director schema test failed.
   The user confirmed the parallel work was intentional. We coordinated with
   **Add suggested reference indicators**, which fixed the strict schema and
   applied migration `20260912000004_comfyTR_project_quality_references.sql`.
   Validation then saved successfully. Do not overwrite another process's work.

Final stabilized-code checks passed **28 tests, full ESLint, and production
build**. This includes two new acknowledgement-retry tests and the other task's
four feature tests and three transient-status retry tests. Unauthenticated GET requests to `/api/renders` and
`/api/wallet` returned 401.

Validation now waits for `saveAccountProject` before changing the visible lock
or showing success. A failed save keeps validation unconfirmed instead of
unlocking the continuation clip based only on local state.

The clip card now replaces Draft with a spinning indicator and **Generating**
during preparation, queueing, and generation. Status reads retry transient
network errors, HTTP 429, and server errors up to five attempts without creating
another GPU job. The final badge-only edit passed targeted ESLint.

## Final continuation job

- Database job: `b74d4f49-2faf-4f63-bce3-647fc1167f0d`.
- RunPod job: `b3df768b-e298-406b-ab3d-fa0e94db531c-e1`.
- RunPod reported COMPLETED, execution 306890 ms (about 5 minutes 7 seconds).
- Submission returned HTTP 202 and saved the provider ID successfully.
- Temporary status failures required reconnecting. The existing job was resumed,
  without another generation, and its video appeared in the clip preview.
- Worker logs showed a two-clip chain with 226 frames. Its cumulative preview
  played to `ended=true` at 9.417 seconds, 608×352, with no media error. The
  preview contains the preceding corridor/vault scene and the final handoff.
  This verifies the render/preview flow, not perfect artistic consistency.

## Final validation and next checks

Clip 4 validation saved successfully; the browser then showed all four clips
as Validated. A temporary import mismatch during the concurrent per-project
routing update was subsequently resolved.

The coordinating routing task reported a passing production build, ESLint, and
all 31 tests. Its read-only browser check confirmed direct-link reload of this
fixture, all four saved validation locks, seven references, and Back navigation.
The spinner and render/validation changes were preserved; that follow-up made no
fixture writes or GPU requests.

The current fixture URL is:
`http://localhost:3000/studio/projects/647b5ca1-17a1-48c6-9a3b-d0dd102100ab?tab=clips`.
Old hash bookmarks migrate to the new per-project routes. When resuming, wait for
account hydration and preserve the existing fixture. Do not generate these clips
again merely to verify status: the final continuation video has already played
successfully. Local final project merge also passed. Ordinary customer billing and production
deployment checks remain separate gaps.

## Final merge and visual follow-up

The coordinating task implemented `POST /api/projects/merge` and the Merge videos
button, progress, preview, and download. The CPU FFmpeg path selects the last
cumulative output from each chain and stores a private content-addressed MP4 in
`USER_ID/PROJECT_ID/exports`. Existing exports are restored through GET. It does
not submit a GPU job. Its live fixture result played at 19.783 seconds, 608×352,
without a media error. The task reported 34 tests, ESLint, and production build
passing. This is local verification, not evidence of a production deployment.

The subsequent user-requested UI changes show a spinner with Generating instead
of Draft for active jobs, restrict the green wrapper to connected groups, and
reduce desktop spacing inside those groups to 4px (mobile retains 8px). The
visual grouping edit passed targeted ESLint. Latest changes remain local unless
separately committed/pushed; no new deployment was verified by this retest.
