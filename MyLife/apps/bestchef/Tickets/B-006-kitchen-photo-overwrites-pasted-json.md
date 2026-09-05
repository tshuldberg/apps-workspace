# Kitchen photo — picking a photo silently overwrites pasted candidate JSON

## Summary

If a user manually pastes candidate JSON into the kitchen-photo screen and then picks a photo, the manually pasted JSON is wiped without warning.

## Current Behavior

`app/(root)/kitchen-photo.tsx` line 70 clears `rawCandidates` whenever a new photo is selected, regardless of whether the field already holds user-typed content. There is no confirmation, no diff, no recovery.

## Steps to Reproduce

1. Open Kitchen → Grocery photo flow.
2. Paste a multi-line JSON blob into the candidates field.
3. Tap **Camera** or **Library** to pick a photo.
4. Observe the candidate field is now cleared.

## Expected Behavior

If the candidates field is non-empty, prompt before clearing, or merge / preserve the manually entered content. Picking a photo should not silently destroy the user's input.

## Severity

- [x] **Minor** — only affects power users using manual JSON path, but irritation per occurrence is high.

## Environment
- File: `app/(root)/kitchen-photo.tsx`, line 70.

## Reproducibility
- [x] 100 %.

## Status

Done in P14-B (SHA ed60b8ec6, pantry batch viewer + grocery media + photo overwrite fix).
