# Meerkat User, Marketing, and Investor Guides

Date: 2026-09-01

Branch: `docs/meerkat-launch-guides-2026-09-01`

Reviewed commit: `493b2549`

## What Changed

- Created the complete Meerkat user guide in canonical Markdown and self-contained HTML.
- Added 28 source-faithful mobile interface mockups using the app's current Open Burrow tokens, labels, control order, state language, and navigation.
- Created a complete launch marketing operating guide in canonical Markdown and self-contained HTML.
- Created a 14-slide interactive investor pitch in canonical Markdown and self-contained HTML.
- Updated the root documentation map, report catalog, and Meerkat artifact index.
- Superseded the 2026-08-01 investor pitch in the report catalog without deleting its historical snapshot.

## Review Scope

The review covered:

- all mobile routes, components, providers, data modules, and tests under `apps/meerkat`;
- the Meerkat web app and its tests;
- `packages/sync`, `packages/meerkat-relay`, billing configuration, layout, theme, canvas, and Meerkat native-support packages;
- app-touching Git history from the first standalone commit on 2026-06-14 through 2026-09-01;
- current TestFlight environment configuration and fail-closed service defaults;
- official competitor and platform sources used in the marketing and investor artifacts.

Reviewed-scope totals were approximately 1,876 source files and 490,395 lines. Git history contained 239 app-touching commits. These are engineering-scope facts, not traction claims.

## Key Decisions

- Used `Private social, controlled by you.` as the shared product promise.
- Kept pricing exact to `packages/billing-config`: `$4.99` one-time private unlock and optional `$4.99/month` hosting.
- Labeled public services, calls, background scheduling, native transports, and storage providers as build or service dependent.
- Treated the creator-rail plan as a strategic next layer, never a shipped feature or current revenue line.
- Used official competitor sources and avoided unverified market-size or traction claims.
- Preserved the private identity and verification-account wall throughout all explanations.
- Made every sequential user instruction stranger-readable with Where, What you will see, What to click or type, What happens next, Done when, and If it fails.

## Files

- `docs/guides/meerkat-complete-user-guide-2026-09-01.md`
- `docs/guides/meerkat-complete-user-guide-2026-09-01.html`
- `docs/guides/meerkat-launch-marketing-guide-2026-09-01.md`
- `docs/guides/meerkat-launch-marketing-guide-2026-09-01.html`
- `docs/reports/meerkat-investor-pitch-2026-09-01.md`
- `docs/reports/meerkat-investor-pitch-2026-09-01.html`
- `docs/README.md`
- `docs/reports/README.md`
- `apps/meerkat/docs/README.md`
- `memory.md`
- `docs/archives/memory-sessions-2026-08.md`

## Verification

- Mobile typecheck: passed.
- Mobile lint: exit 0 with 9 pre-existing warnings.
- Mobile tests: 165 files, 1,815 tests passed.
- Web typecheck and tests: passed.
- Sync typecheck and tests: 207 files passed, 2,624 tests passed, 3 skipped.
- Relay typecheck and tests: 210 files passed, 35 environment-dependent files skipped; 1,622 tests passed, 189 skipped.
- Layout typecheck and tests: 14 tests passed.
- Theme typecheck and tests: 116 tests passed.
- Canvas typecheck and tests: 7 tests passed.
- Playwright desktop and mobile visual QA: all three HTML artifacts loaded with zero console errors and no horizontal overflow at 390 pixels.
- User-guide browser census: 28 phone mockups and 14 guide sections.
- Investor arrow-key navigation and progress indicator: passed.
- Full repository parity suite: passed, including Meerkat parity and transport negative controls.
- `git diff --check`: passed.
- `pnpm check:generated-artifacts`: passed.

No runtime function logic changed, so `pnpm gate:function:changed` was not required.

## Remaining Work

- The founder must provide verified fundraising inputs before external investor use: raise size, valuation, runway, hiring plan, current revenue, users, retention, hosted conversion, support cost, infrastructure cost, and market sizing.
- General-availability marketing remains gated on signed-build, service, safety, legal, backup, support, and operational evidence listed in the launch guide.

## Reusable Insight

A privacy product's strongest marketing proof is a consistent state vocabulary. The product, user guide, launch copy, and investor story should all distinguish local record, real delivery, reachable infrastructure, and deployed capability in the same words.
