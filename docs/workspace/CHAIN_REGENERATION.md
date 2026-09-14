# Continued-chain regeneration

A validated clip remains a reviewed result, but a creator can choose **Regenerate from here**.

The confirmation resets the selected clip and every later clip in the same continued take to Draft. It archives and removes their private video objects, then trims the stale final-video segments from the RunPod Network Volume. Earlier validated clips remain the motion-context prefix. Regenerating clip 3 therefore reuses clips 1 and 2 instead of restarting at clip 1. A scene cut starts an independent chain and is never reset by this action.

A continued chain uses a single render profile. **Quick preview** uses the 4-step LoRA; **Cinematic detail** uses the 8-step LoRA. Both the browser workflow and `/api/renders` reject a mixed profile. To change a chain profile, regenerate from its first clip.

The database flow is migration `20260914000002_comfyTR_chain_regeneration.sql`, applied to the connected Supabase project on 2026-09-14.
