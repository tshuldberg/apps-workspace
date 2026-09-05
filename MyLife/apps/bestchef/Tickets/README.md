# BestChef Functionality Audit — Tickets

Generated 2026-04-27 from a comprehensive review of every screen and interactive element in `apps/bestchef`. Each ticket follows one of the two templates from `/Users/trey/Downloads/general-feature-request-template.md` or `general-bug-report-template.md`.

## Audit Scope

All screens under `app/(root)/`:
- 6 tabs (Home, Dishes, Kitchen, Leaderboard, Profile, Settings)
- 8 detail/secondary screens (dish, chef, recipe, saved-recipe, comments, vote, feed, challenges)
- 8 kitchen flows (grocery, pantry, kitchen-receipt, kitchen-receipt-review, kitchen-photo, kitchen-photo-review, expiration-photo, recipes/new)
- 5 submit/profile/theme screens (submit, edit-profile, creator-program, theme-browser, theme-editor)
- 7 shared components (CookProofCapture, CookProofGallery, MediaSlot, ReportMenu, NutritionPanel, HealthSummary, LanguagePicker)

## Findings Summary

| Category | Count |
|---|---|
| **Total tickets** | 59 |
| **Feature requests (gap or unbuilt capability)** | 47 |
| **Bug reports (broken or incorrect behavior)** | 12 |
| **Critical / Must-have** | 14 |
| **Should-have** | 28 |
| **Nice-to-have** | 14 |

## Reconciliation Summary (updated 2026-07-11; original P16-A, 2026-04-27)

Every ticket carries a `## Status` section. The original BestChef × are-blaze reconciliation remains in `docs/sessions/2026-04-27-bestchef-areblaze-final-qa.md`; its generated mission-control artifacts were removed after the work shipped. Updated 2026-07-03 after the adversarial production review verified claimed-done tickets against code, and again 2026-07-11 after the adversarial production audit (`docs/reports/REPORT-bestchef-adversarial-production-audit-2026-07-10.md`, finding H16) proved the F-045/F-046/F-047 "closed 2026-06-09" claim was still false and the fixtures were genuinely killed the next day. The current launch state is `docs/reports/REPORT-bestchef-production-readiness-status-2026-07-11.html`.

| Status | Count | Notes |
|---|---|---|
| **Done** | 59 | Pre-areblaze workstream + Phases P4 through P15, plus F-045/F-046/F-047, plus F-008/F-010 (now closed, see below). The 2026-06-09 close for F-045/F-046/F-047 was PREMATURE: the cloud read paths landed, but `discover.tsx`, `feed.tsx`, and `recipe/[id].tsx` still substituted `DEMO_*` / `SAMPLE_*` fixtures in public builds (audit H16, 2026-07-10). The fixtures were genuinely removed/gated 2026-07-11 in commit `3247fb2c`, which added the mechanical `check:no-ungated-fixtures` gate (wired into `check:parity`) so the regression cannot silently return. |
| **Reopened** | 0 | F-008 (video-feed comments) and F-010 (bookmarks) were reopened 2026-07-03 (the P4-A "closes F-007..F-011" claim over-counted). Both were genuinely closed 2026-07-04 in commit `c11594e1` (plan 33 Phase 5.6): feed comments route to the cloud `/comments/[submissionId]` surface with real counts, and bookmarks persist to `bc_saved_submissions` (cloud + RLS) with an optimistic local mirror, surviving reinstall. |
| **Won't fix** | 0 | None. |

## Top themes

1. **Mock data pervasive.** Home, Dishes, Leaderboard, and submission lists all read from `DEMO_DISHES` / `DEMO_CHEFS` / `DEMO_BADGES` / `DEMO_CHALLENGES`. Live data is not wired even where cloud providers exist.
2. **Cross-feature integration missing.** The Kitchen ecosystem (grocery / pantry / saved recipes) has no two-way links: saving a recipe never seeds a grocery list, pantry quantities never decrement when recipes are cooked, recipes never surface "you have X already in pantry."
3. **`/soon` placeholder routes count as gaps.** 11 distinct interactions deflect to the `Coming Soon` screen (feed engagement, media slots on grocery / pantry / saved-recipe, kitchen barcode and clipboard imports). Each is a deliberately-surfaced unbuilt feature.
4. **Cloud failure paths are weak.** Submit, ReportMenu, EditProfile, and CreatorProgram all have edge cases where a cloud failure produces silent state loss, a stuck draft, or no fallback persistence.
5. **OCR/import flows are partly stubbed.** Kitchen-receipt and kitchen-photo expose API-key inputs that aren't persisted to secure storage; provider lists are hardcoded to `manual_text` + `claude_vision`; failed runs cannot retry from the review screen.

## Index

### Feature Requests

| ID | Title | Priority |
|---|---|---|
| [F-001](F-001-grocery-add-recipe-populates-ingredients.md) | Grocery — add a saved recipe to a list and auto-populate its ingredients | Must |
| [F-002](F-002-pantry-decrement-when-recipe-cooked.md) | Pantry — decrement on-hand quantities when a recipe is cooked | Should |
| [F-003](F-003-recipe-show-pantry-availability.md) | Recipe detail — show which ingredients are already in the pantry | Should |
| [F-004](F-004-recipe-save-bookmark-to-kitchen.md) | Recipe detail — save a community recipe to my Kitchen | Must |
| [F-005](F-005-saved-recipe-edit.md) | Saved recipe — edit an existing saved recipe | Must |
| [F-006](F-006-saved-recipe-print-export.md) | Saved recipe — print or export to PDF/text | Nice |
| [F-007](F-007-feed-like-videos.md) | Feed — like videos and persist the count | Should |
| [F-008](F-008-feed-comment-on-videos.md) | Feed — comment on videos | Should |
| [F-009](F-009-feed-share-videos.md) | Feed — share a video via the system share sheet | Should |
| [F-010](F-010-feed-bookmark-videos.md) | Feed — bookmark a video to revisit later | Should |
| [F-011](F-011-feed-open-chef-profile.md) | Feed — open the chef profile from a video | Must |
| [F-012](F-012-challenges-interactive-cards.md) | Challenges — open challenge detail and track participation | Must |
| [F-013](F-013-challenges-reward-redemption.md) | Challenges — redeem rewards for completed challenges | Should |
| [F-014](F-014-saved-recipe-media-editing.md) | Saved recipe — add, replace, or remove media | Should |
| [F-015](F-015-pantry-batch-media-viewer.md) | Pantry — view photos / receipts attached to a batch | Should |
| [F-016](F-016-grocery-list-media-attachments.md) | Grocery list — attach photos to a list | Nice |
| [F-017](F-017-kitchen-barcode-lookup.md) | Kitchen — barcode food lookup | Should |
| [F-018](F-018-kitchen-clipboard-recipe-import.md) | Kitchen — clipboard recipe import (paste URL or text) | Should |
| [F-019](F-019-profile-signature-dishes.md) | Profile — populate the Signature Dishes section | Should |
| [F-020](F-020-profile-shareable-public-url.md) | Profile — shareable public profile URL | Nice |
| [F-021](F-021-profile-followed-chefs-list.md) | Profile — view the list of chefs I follow | Should |
| [F-022](F-022-settings-save-feedback-toast.md) | Settings — show confirmation feedback after a setting saves | Should |
| [F-023](F-023-settings-light-dark-toggle.md) | Settings — toggle dark / light mode inline | Nice |
| [F-024](F-024-submit-persist-proposed-dishes.md) | Submit — proposed dishes persist into the public dish catalog | Must |
| [F-025](F-025-edit-profile-handle-uniqueness.md) | Edit profile — validate handle uniqueness against the cloud | Must |
| [F-026](F-026-edit-profile-avatar-upload.md) | Edit profile — upload avatar to cloud storage | Must |
| [F-027](F-027-creator-program-backend-application.md) | Creator program — submit application to the backend, not via mailto | Must |
| [F-028](F-028-creator-program-status-tracking.md) | Creator program — track application status in-app | Should |
| [F-029](F-029-theme-save-named-custom.md) | Theme editor — save named custom themes that survive a relaunch | Should |
| [F-030](F-030-theme-share-import.md) | Theme — share and import themes | Nice |
| [F-031](F-031-comments-reply-to-comment.md) | Comments — reply to a comment | Should |
| [F-032](F-032-comments-edit-delete-own.md) | Comments — edit or delete my own comments | Should |
| [F-033](F-033-comments-persist-helpful-count.md) | Comments — persist mark-helpful counter to the backend | Must |
| [F-034](F-034-recipe-ingredient-parser.md) | Recipe creation — structured ingredient parser (qty / unit / name) | Must |
| [F-035](F-035-recipe-quick-start-templates.md) | Recipe creation — quick-start templates | Nice |
| [F-036](F-036-kitchen-recipe-search-facets.md) | Kitchen — search saved recipes by ingredient and cuisine | Should |
| [F-037](F-037-leaderboard-time-range-filter.md) | Leaderboard — filter rankings by time range | Should |
| [F-038](F-038-dishes-sort-options.md) | Dishes — sort options (popularity, newest, alphabetical) | Nice |
| [F-039](F-039-expiration-photo-pantry-search.md) | Expiration photo — searchable pantry item picker | Should |
| [F-040](F-040-ocr-secure-api-key-storage.md) | OCR — store BYO API keys securely and persistently | Must |
| [F-041](F-041-receipt-review-batch-confirm.md) | Receipt review — batch confirm and select-all | Should |
| [F-042](F-042-receipt-review-undo-edit.md) | Receipt review — undo or re-edit a confirmed line | Should |
| [F-043](F-043-import-retry-ocr-from-review.md) | Import flows — retry OCR from the review screen on failure | Should |
| [F-044](F-044-replace-demo-data-with-live-content.md) | App-wide — replace DEMO_* fixtures with live cloud content | Must |

### Bug Reports

| ID | Title | Severity |
|---|---|---|
| [B-001](B-001-leaderboard-refresh-noop.md) | Leaderboard — pull-to-refresh does not refetch data | Major |
| [B-002](B-002-settings-email-validation-missing.md) | Settings — email recovery accepts malformed addresses | Minor |
| [B-003](B-003-report-menu-public-launch-no-fallback.md) | Reports — cloud failure on public launch loses the report | Critical |
| [B-004](B-004-expiration-photo-confirm-no-validation.md) | Expiration photo — Confirm submits an empty assignment when no item is chosen | Major |
| [B-005](B-005-submit-cloud-failure-no-retry.md) | Submit — cloud upload failure navigates the user away with no retry | Critical |
| [B-006](B-006-kitchen-photo-overwrites-pasted-json.md) | Kitchen photo — picking a photo silently overwrites pasted candidate JSON | Minor |
| [B-007](B-007-kitchen-receipt-stuck-draft.md) | Kitchen receipt — failed review leaves a stuck draft | Major |
| [B-008](B-008-comments-helpful-count-not-persisted.md) | Comments — Mark Helpful resets on every reload | Major |
| [B-009](B-009-challenges-progress-hardcoded-zero.md) | Challenges — progress bar always shows 0 % | Major |
| [B-010](B-010-settings-app-version-hardcoded.md) | Settings — app version label hardcoded to 1.0.0 | Minor |
| [B-011](B-011-profile-cookproof-error-state-missing.md) | Profile — cook-proof fetch errors are not surfaced | Minor |
| [B-012](B-012-receipt-review-confirmed-lines-lock.md) | Receipt review — confirmed or ignored lines lock with no undo | Major |
