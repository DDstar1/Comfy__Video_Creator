# Scene cuts, continuity chains, and the final merge

Status: **design, not built.** Written 2026-09-12 after the first successful
two-clip render. Nothing in this document is implemented except the RunPod merge
handler, which is noted inline.

## The problem

The Extender chains clips into one continuous take. Clip N is generated from
clip N-1's final latent frames as motion context, and there is no cut primitive.
Asking it to change location and cast between clips does not produce a cut; it
produces a morph.

This is observable. In the Red Signal test, clip 1 ends with Lyra on a cot in the
infirmary and clip 2 asks for a corridor terminal with Tomas, Sayen and Wren.
The render transformed Lyra into the new characters and the infirmary into the
corridor, because that is the only way to satisfy "start here, end there" without
a cut.

The H3 Director skill already names this as the anti-pattern
([`extender-en.txt`](../../skills/minimax-h3-extender-sequential-director/references/extender-en.txt)):

> CLIP 2 continues from the final state of CLIP 1. Never treat continuation clips
> as independent generations. Think: PREVIOUS FINAL STATE → NEXT ACTION → MOTION
> → NEW FINAL STATE. Not: NEW SCENE → NEW CHARACTER → NEW DESCRIPTION.

Clip 2 was exactly `NEW SCENE → NEW CHARACTER → NEW DESCRIPTION`. It also carried
no Lyra or Infirmary reference, so the model had nothing anchoring what it was
transforming out of — only where it had to arrive.

Nothing in the planner's instructions forbids planning a scene change, and
nothing in the pipeline catches one. A bad plan costs a full render (~5 minutes
of GPU) before the morph is visible.

### The node cannot cut

Confirmed by reading `extender.py`: the only per-clip fields accepted in
`clips_json` are

```
prompt · seed · seed_mode · duration · validated · trim_frames · color_adjustment
```

There is no "new scene", "reset" or "independent" flag. `trim_frames` only
discards overlap frames at the seam to smooth the join; it cannot break
continuity. There is no setting that produces a cut.

## The model

A cut is the *absence* of motion context. Clip 1 had none, which is why it
rendered as a clean self-contained shot. So a cut is produced by starting a new
chain, not by asking the node for one.

Each clip carries a **`continues_previous`** flag. A clip with the flag false
starts a new chain. Clips within a chain behave exactly as they do today.

```
clip 1  Lyra Wakes             continues_previous = false   ─┐ chain A
clip 2  Blackout Confrontation continues_previous = false   ─┐ chain B
clip 3  Directed Memory        continues_previous = false   ─┐ chain C
clip 4  Neural Strip           continues_previous = true    ─┘ chain C
```

Three chains, two cuts, and clip 4 continuing clip 3 because Wren catching up
with Lyra in the same corridor genuinely is one take. Continuity is preserved
where it is wanted and absent where it is not.

The test is not "did the location change" but "is this one camera take". A
memory intrusion mid-walk is arguably *meant* to morph, so keeping it inside one
chain may give that effect for free.

**The flag must be user-overridable.** The planner will misjudge it, and the cost
of a wrong call is a wasted render.

## What changes

1. **`continues_previous` on `comfyTR_clips`**, set by the director, editable by
   the customer.
2. **`cache_namespace` becomes per chain** — `user.id:project.id:chainIndex`,
   where `chainIndex` increments at each cut. The worker already hashes this
   value into its own cache directory, so this is the existing isolation
   mechanism applied one level finer. It stays server-derived; the browser must
   never supply it.
3. **`render-workflow.ts` must scope the prefix to the current chain.** It
   currently sends the validated prefix for the whole project. Sending clips
   from an earlier chain would re-introduce the morph.
4. **Validation locking becomes per chain.** The ordered-prefix rule in
   `studio-model.ts` and the matching database constraint both assume a single
   chain from clip 1. Scoped per chain, scenes can be worked on independently
   rather than strictly front to back.
5. **A merge step** joins the chains into the finished film.

### Consequences worth having

- **Re-rolling one scene stops meaning re-rendering the film.** On the 30-clip
  projection that is the difference between ~$2.22 and a few cents per fix.
- **Chains are independent, so scenes could render concurrently.** The endpoint
  already allows three workers; today everything is strictly serial.

## The merge

Each chain's finished video already lives on the same Network Volume the worker
mounts, under the cache root:

```
/runpod-volume/comfytr-cache/<prefix>/<sha256-of-namespace>/
    chain_*.final.video/ref2va_0000.mp4, ref2va_0001.mp4, …
    chain_*.preview.mp4
```

So the merge moves no video. The backend sends the ordered chain namespaces; the
worker hashes each one exactly as a render does, finds the finished segments on
the volume, and concatenates. `imageio-ffmpeg` is already a dependency, so ffmpeg
is present in the image.

Because every chain is produced by the same workflow — H.264, one resolution,
24 fps, same CRF — the concat can be a stream copy. That is lossless and takes
seconds rather than minutes. It falls back to a re-encode if a chain's
parameters ever differ.

**Volume first, Supabase as fallback.** Reading the volume is free and fast, but
the cache is a derived artifact: it is truncated when a clip is edited and
nothing guarantees retention. Making the final deliverable depend on it would
turn a cache into production data. So the request carries a signed Supabase URL
for each chain alongside its namespace, and the worker downloads only the chains
it cannot find on the volume.

This part **is implemented** — see `input.merge` in
[`runpod_handler.py`](../../../runpod-worker-repo/runpod_handler.py) and the
request contract in
[`RUNPOD_SERVERLESS.md`](../../../runpod-worker-repo/RUNPOD_SERVERLESS.md).
The application side — the chain model, the merge button, and gating it on every
clip being validated — is not.

## Open questions

- **Where the merged film is stored.** Presumably a new bucket path alongside the
  per-clip videos, with its own asset record. Not designed.
- **What a customer sees per clip.** Final Decode returns the *cumulative* chain,
  not the individual clip, so clip N's preview is the whole scene so far. That
  may be desirable as a running preview, but today it is implicit rather than
  chosen.
- **Cache retention.** Deliberately out of scope for now. Worth noting that the
  volume is 100 GB with roughly 69 GB of models, and no cleanup job exists.
