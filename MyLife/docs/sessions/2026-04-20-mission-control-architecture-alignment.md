# Mission Control Architecture Alignment

## Summary

Updated the 10 new mission-control HTML trackers for the proposed module wave so they align with the live MyLife hub architecture before implementation starts.

## Scope

- `docs/plans/mymusic-mission-control.html`
- `docs/plans/mygaming-mission-control.html`
- `docs/plans/myfriends-mission-control.html`
- `docs/plans/myclasses-mission-control.html`
- `docs/plans/mysports-mission-control.html`
- `docs/plans/mywatch-mission-control.html`
- `docs/plans/mycreate-mission-control.html`
- `docs/plans/mysleep-mission-control.html`
- `docs/plans/mytravel-mission-control.html`
- `docs/plans/myshop-mission-control.html`

## What Changed

- Replaced invalid web route targets from `apps/web/app/(modules)/...` to the real host structure under `apps/web/app/<module>/...`.
- Replaced stale `tier: 'pro'` contract language with the real `ModuleDefinition` tier enum: `free | premium`.
- Updated registry wording so foundation prompts now point at `ModuleId`, `ModuleIdSchema`, `MODULE_IDS`, and `MODULE_METADATA` instead of the nonexistent `MODULE_REGISTRY` concept.
- Added explicit host-wiring cues for `apps/mobile/app/_layout.tsx` and `apps/web/components/Providers.tsx` so the new modules do not stop at package scaffolding.
- Added “Implementation Guardrails” sections to each tracker to encode repo-specific architecture constraints and verification expectations.
- Replaced leftover Phase 1 CRUD prompt references that still pointed at Forums or nonexistent Books CRUD paths with real existing CRUD references (`modules/books/src/db/books.ts`, `modules/closet/src/db/wishlist.ts`) so implementation starts from the right local-data patterns.
- Swapped several misleading reference surfaces:
  - Music, Gaming, Classes, and Create now point at tracker-style module references instead of Forums.
  - Sports points at Surf-style data surfaces.
  - Sleep points at Health sleep surfaces rather than Mood.
  - Friends points at Social route references and calls out `packages/social` reuse.
  - Shop points at personal-item tracking references rather than community/forum shells.
  - Watch now explicitly distinguishes media tracking from the existing Apple Watch companion code.

## Why

The original trackers were written against a partially hypothetical structure. Left unchanged, they would have pushed implementation into wrong web paths, stale registry APIs, incomplete host registration, and duplicated infrastructure around social, sleep, watch, and shop-related features.

This pass keeps the new modules viable as first-class hub modules while reducing the amount of corrective work needed during implementation and testing.

## Verification

- Searched the 10 edited files to confirm there are no remaining implementation-facing `apps/web/app/(modules)/...` targets. Remaining matches are only explanatory guardrail warnings telling implementers not to use that path shape.
- Searched the 10 edited files to confirm no remaining `tier 'pro'`, `tier: 'pro'`, or `MODULE_REGISTRY entry` strings remain outside explanatory guardrails.
- Spot-checked foundation sections to confirm host registration cues and module-specific guardrails were added.

## Remaining Risks

- Some later-phase prompts still reference existing module internals as inspiration. That is acceptable as guidance, but each implementation pass should still validate the exact target APIs against the live codebase before coding.
- `MyFriends`, `MySleep`, `MyWatch`, and `MyShop` still need careful product-boundary decisions during implementation because they sit near existing social, health, watch, and market surfaces.
