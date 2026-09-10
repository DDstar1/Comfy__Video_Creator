---
name: minimax-h3-extender-sequential-director
description: Write official MiniMax H3 prompts for T2VA, I2VA, FL2VA, L2VA, Ref2VA, and continuous H3 Extender sequences. Combines MiniMax's official base/full-reference prompt rules with strict clip-to-clip motion continuity, repeated active reference definitions, filtered current-state references, stable identity/skin conditioning, camera continuity, dialogue, and audio continuity.
---

# MiniMax H3 + H3 Extender Sequential Director

Use this skill for ordinary MiniMax H3 prompting and for multi-clip H3 Extender sequences.

## Source of truth

The bundled MiniMax guides are authoritative for official H3 syntax:

- `references/base-en.txt` — T2VA, I2VA, FL2VA, L2VA
- `references/ref-en.txt` — full-reference Ref2VA
- `references/extender-en.txt` — H3 Extender continuity and sequential-directing layer

Do not replace official field names, label conventions, shot notation, dialogue syntax, or mode-specific section order.

## Workflow

1. Determine whether the request is:
   - ordinary H3 generation, or
   - H3 Extender / a sequence of clips that must form one continuous video.

2. Determine the H3 input mode:
   - T2VA
   - I2VA
   - FL2VA
   - L2VA
   - full-reference Ref2VA

3. Read the matching official guide:
   - base modes → `references/base-en.txt`
   - Ref2VA → `references/ref-en.txt`

4. If the request is H3 Extender or multi-clip continuation, ALSO read `references/extender-en.txt` and apply it across the entire sequence.

5. For Extender, silently build a continuity map before writing:
   previous final state → next physical action → camera continuation → current valid references → color-rendering continuity → new final state.

6. Automatically anchor color rendering directly to `<Picture 1>` on EVERY clip when it is the primary visual reference. The previous clip provides motion and physical continuity only; color grading, saturation, contrast, exposure, white balance, color temperature, skin tones, environment colors, and ambient-light rendering must be matched back to the active picture reference on each continuation clip.

7. Each clip must be a complete independently copyable H3 prompt in the correct official mode.

## Reference behavior for Extender

When original references are supplied again on continuation clips, re-declare their ACTIVE roles on every clip.

For Ref2VA, repeat the required `subject_definitions` on every clip using the same stable `<Subject N>` labels.

Persistent character definitions should preserve, when applicable:

- identity
- face
- skin
- hairstyle
- body proportions
- currently valid clothing/accessories
- stable environment anchors
- other still-valid visual traits

If a reference attribute became obsolete because the timeline changed it, omit that attribute from subsequent active definitions. Describe only the current valid state.

Never use negative persistence wording that names an obsolete visual element in order to forbid its return, including phrases such as `must not reappear`, `do not restore`, `do not regenerate`, `do not recreate`, or equivalent formulations.

## Priority

When instructions interact, use this order:

1. explicit user intent
2. official MiniMax H3 syntax for the active mode
3. current physical/visual/audio state inherited from the previous Extender clip
4. active reference identity and scene anchors
5. current continuation action
6. cinematic enrichment

Continuity and current state override obsolete reference attributes, while unchanged reference traits continue to reinforce visual quality.
