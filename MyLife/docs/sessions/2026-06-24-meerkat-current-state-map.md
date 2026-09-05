# Meerkat Current-State Map

Date: 2026-06-24
Slice: Prompt 00, Current-State Map

## Summary

Created a durable current-state implementation map for the Meerkat user-first
privacy social pivot. This was a docs-only kickoff pass so later agents can
start implementation from observed code state instead of hidden chat context.

## Why

The user identified this as the first execution pass for the Meerkat prompt
board. Prompt 00 called for a short map of existing, partial, missing, and
blocked surfaces before implementation starts.

## What Changed

- Added
  `apps/meerkat/docs/plans/meerkat-user-first-privacy-current-state-map-2026-06-24.md`.
- Mapped mobile tabs, web shell, sync schemas, hosted relay pieces, safety
  primitives, post foundation, and product gaps against prompts 01 through 10.
- Recorded recommended file ownership and verification commands for each slice.
- Recommended Prompt 01: Information Architecture as the next implementation
  prompt.

## Files Changed

- `apps/meerkat/docs/plans/meerkat-user-first-privacy-current-state-map-2026-06-24.md`
- `docs/sessions/2026-06-24-meerkat-current-state-map.md`
- `memory.md`

Pre-existing dirty files were not edited intentionally:

- `.gitignore`
- `errors_log.md`
- `apps/meerkat/docs/plans/meerkat-consumer-front-door-decomposition-2026-06-22.md`

## Verification

- `rg -n "\x{2014}" apps/meerkat/docs/plans/meerkat-user-first-privacy-current-state-map-2026-06-24.md`
  - No matches.
- `git status --short --branch`
  - Confirmed only the new map was added by this pass at that point, with
    pre-existing dirty files still present.

Function gate was not run because no runtime function logic changed.

## Observed Product State

- Mobile is still node-first: `Node`, `Share`, `Identity`, `Communities`,
  `Settings`.
- Web already has a Discord-style community shell but still lacks top-level
  Feed, Friends, and Messages concepts.
- MK-P01 post schema and signed v2 message contract exist, but visible composers
  still send chat-style events.
- Friend codes and paired devices exist, but no user-facing friends graph or DM
  surface exists.
- Hosted entitlement and relay pieces exist, but product hosted boundaries and
  public-cost copy are incomplete.
- Safety primitives exist below UI, but mute, block, report, owner inbox, and
  member removal UX remain missing or blocked.

## Remaining Work

Start Prompt 01 next. The first implementation task is to move Meerkat's primary
surface toward Feed, Communities, Messages, Friends, and Me while keeping Node,
Share, Identity, Sync, and diagnostics accessible behind Me or Settings.

## Errors

No errors were logged. A shell listing typo was immediately corrected and did
not affect repo state.
