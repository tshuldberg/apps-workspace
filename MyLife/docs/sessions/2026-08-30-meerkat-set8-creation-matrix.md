# 2026-08-30 - Meerkat Set 8: community-creation variation matrix (final sweep set)

Final set (8 of 8) of the 2026-08-30 hardening sweep. Instead of a page sweep, creation was exercised as a variation matrix through the real cores on both surfaces, plus a live Chrome session. Full report and sweep-wide handoff: `apps/meerkat/docs/prompts/PROMPT-009-creation-matrix.md`.

## What

Five defects found and fixed at the root:

1. Mobile create-community failure copy rendered behind the open sheet's Modal backdrop (invisible error). Now an in-sheet `createError` above the Create button, cleared on retype/close. `apps/meerkat/app/(root)/(tabs)/communities.tsx`.
2. Mobile `addCategoryToDraft` minted position-based category ids that collide after delete-then-add (duplicate ids render channels under two groups). Now uniqueness-checked. `apps/meerkat/app/(root)/data/community-org-core.ts`.
3. Purge-on-failure left ghost `sync_change_log` rows for the committed epoch key wraps on BOTH surfaces (a later session would ship wraps for a purged community). Purge now deletes them by `<communityId>:%` row-id prefix. Both `community-template-commit.ts` files.
4. Invisible-only (zero-width) community names passed `trim()` and created blank-card communities via three entry points. New `visibleCommunityName` helper in the byte-twin `community-templates.ts` (both surfaces), enforced in both template commits and the web scratch `createCommunity`.
5. Web channel-manager add-channel row rendered under the category groups while always adding uncategorized (misleading affordance, reproduced live). Moved next to the uncategorized rows. `apps/meerkat-web/src/ui/community/CommunityOrganizationSection.tsx`.

New tests: `community-creation-matrix.test.ts` on both surfaces (22 mobile + 11 web) covering all 6 templates x theme adoption, entityRule coverage via the real ChangeTracker, invite round-trip over org-extended descriptors, archived-at-creation vs later, degenerate names, rapid creates, purge hygiene (revert-checked); +2 wiring locks in `communities-wiring.test.ts`.

## Verification

Mobile typecheck clean, 1798 tests green (164 files). Web typecheck clean, 1214 tests green (150 files). `check-meerkat-parity.mjs` all-pass. `gate:function:changed` exit 0; zero diagnostics in changed files. Live Chrome session (Vite :5199 + entitlement stub): Family Space template create (library_first landing, honest 0-item/1-member states, retheme), scratch create with duplicate name, category+channel+archive single-save (read-only archived banner, composer gone), invite mint over the revised descriptor; console clean throughout (zero errors, zero `[BrowserSecretStore]`).

## Remaining

Carried follow-ups and Set-9 candidates (join-side matrix as a second device, live sync over template-created communities, Plan 56 creation intersections) are listed in PROMPT-009 section 4. All work uncommitted in the working tree alongside Sets 0-7.
