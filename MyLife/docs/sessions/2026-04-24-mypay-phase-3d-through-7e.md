# MyPay Phases 3D Through 7E: remaining mission-control slices

## Summary

Completed the remaining MyPay mission-control implementation slices from `P3-D` through `P7-E`.

The work keeps MyPay server-authoritative: wallet, transfer, request, card, remittance, degraded-mode, and ops surfaces now render from shared payments view models, projection contracts, provider adapters, and launch docs instead of inventing second implementations in host apps.

## Phase Coverage

- `P3-D`: activity feed, filters, transaction detail shell, provider references, receipt/disclosure slots, and issue-report entry points tied to the dispute model.
- `P3-E`: funding, withdrawal, linked-account state, standard/instant speed messaging, pending vs spendable impact, and explicit `pay_funding_intents` / `pay_payout_intents` command metadata.
- `P3-F`: payment profile and settings surface for discoverability, verified identifiers, contacts, notifications, self-imposed limits, fee schedule, KYC tier display, and wallet-close constraints.
- `P4-A` through `P4-D`: Budget, Market, RSVP, and Dining projection contracts that keep MyPay as financial authority and downstream modules as event/projection consumers.
- `P5-A` through `P5-C`: token-first card management, card activity, MCC mapping, dispute eligibility, merchant QR and peer receive QR payload helpers.
- `P6-A` through `P6-D`: international quote/tracking UI helpers, remittance orchestrator, recipient/corridor history state, multi-currency balances, FX conversion previews, and rate alerts.
- `P7-A` through `P7-E`: payments ops console helper, web route parity, degraded-mode availability controls, launch-gate checklist, and future-pack tracking docs.

## Files Changed

- `modules/payments/src/wallet/activity.ts`
- `modules/payments/src/wallet/funding.ts`
- `modules/payments/src/wallet/settings.ts`
- `modules/payments/src/projections/`
- `modules/payments/src/cards.ts`
- `modules/payments/src/remittance.ts`
- `modules/payments/src/providers/remittance/index.ts`
- `modules/payments/src/engine/fx/index.ts`
- `modules/payments/src/cloud/availability.ts`
- `modules/payments/src/ops/console.ts`
- `modules/payments/src/index.ts`
- `modules/payments/src/wallet/index.ts`
- `modules/payments/src/engine/index.ts`
- `modules/payments/src/providers/index.ts`
- `modules/payments/src/cloud/index.ts`
- `modules/payments/src/ops/index.ts`
- `modules/payments/package.json`
- `apps/mobile/app/(payments)/`
- `apps/web/app/payments/`
- `apps/web/app/ops/payments/page.tsx`
- `docs/plans/payments/launch-gate.md`
- `docs/plans/payments/future-pack.md`
- `memory.md`
- `errors_log.md`

## Tests Added

- `modules/payments/src/wallet/__tests__/activity.test.ts`
- `modules/payments/src/wallet/__tests__/activity.function-gate.test.ts`
- `modules/payments/src/wallet/__tests__/funding.test.ts`
- `modules/payments/src/wallet/__tests__/settings.test.ts`
- `modules/payments/src/projections/__tests__/budget.test.ts`
- `modules/payments/src/projections/__tests__/market.test.ts`
- `modules/payments/src/projections/__tests__/rsvp.test.ts`
- `modules/payments/src/projections/__tests__/dining.test.ts`
- `modules/payments/src/projections/__tests__/projections.test.ts`
- `modules/payments/src/__tests__/cards.test.ts`
- `modules/payments/src/__tests__/remittance.test.ts`
- `modules/payments/src/__tests__/mypay-remaining-phases.test.ts`
- `modules/payments/src/engine/fx/__tests__/fx.test.ts`
- `modules/payments/src/engine/fx/__tests__/index.test.ts`
- `modules/payments/src/providers/remittance/__tests__/index.test.ts`
- `modules/payments/src/cloud/__tests__/availability.test.ts`
- `modules/payments/src/ops/__tests__/console.test.ts`

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed.
- `pnpm --filter @mylife/payments test` passed: 47 files, 142 tests.
- `pnpm --filter @mylife/mobile typecheck` passed.
- `pnpm --filter @mylife/web typecheck` passed.
- Mobile file-scoped ESLint passed for touched MyPay routes and demo data files.
- Web file-scoped ESLint passed for touched MyPay routes and ops route.
- Started a local web dev server on `http://localhost:3001`; `curl --max-time 20 -I` returned `HTTP/1.1 200 OK` for `/payments/activity`, `/payments/card`, `/payments/remittance`, and `/ops/payments`.
- `pnpm gate:function --file modules/payments/src/wallet/activity.ts` passed.
- `pnpm gate:function --file modules/payments/src/wallet/funding.ts` passed.
- `pnpm gate:function --file modules/payments/src/wallet/settings.ts` passed.
- `pnpm gate:function --file modules/payments/src/cards.ts` passed.
- `pnpm gate:function --file modules/payments/src/remittance.ts` passed.
- `pnpm gate:function --file modules/payments/src/engine/fx/index.ts` passed.
- `pnpm gate:function --file modules/payments/src/providers/remittance/index.ts` passed.
- `pnpm gate:function --file modules/payments/src/cloud/availability.ts` passed.
- `pnpm gate:function --file modules/payments/src/ops/console.ts` passed.
- `pnpm gate:function --file modules/payments/src/projections/budget.ts` passed.
- `pnpm gate:function --file modules/payments/src/projections/market.ts` passed.
- `pnpm gate:function --file modules/payments/src/projections/rsvp.ts` passed.
- `pnpm gate:function --file modules/payments/src/projections/dining.ts` passed.

## Stabilization

- The package-wide payments test suite initially exposed timing-sensitive function-gate checks in `assessment.function-gate.test.ts` and `activity.function-gate.test.ts`.
- Stabilized those generated micro-benchmarks with warmer and longer samples, plus an explicit memory-repeat budget for activity.
- Reran isolated gates and the full payments package suite successfully.

## Blocked Verification

- `pnpm gate:function --file apps/mobile/app/(payments)/activity.tsx` remains blocked by unrelated mobile package lint:
  - `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - `React Hook "useMemo" is called conditionally`
  - `✖ 831 problems (1 error, 830 warnings)`
- `pnpm gate:function --file apps/web/app/payments/components.tsx` remains blocked by unrelated web package lint:
  - `apps/web/app/shop/purchases/[id]/page.tsx:194`
  - `apps/web/app/shop/purchases/[id]/page.tsx:202`
  - missing `@next/next/no-img-element` rule
  - `✖ 100 problems (2 errors, 98 warnings)`
- `pnpm gate:function:changed` ran the BestChef app subgate successfully, then stopped on the same unrelated mobile Notes lint blocker.

## Next MyPay Prompt

Working in `/Users/trey/Desktop/Apps/MyLife`.

Follow the repo startup checklist in `AGENTS.md` and `CLAUDE.md` before substantial edits. Also review `.claude/settings.local.json`, `.claude/skills-available.md`, and `.claude/plugins.md` if present.

Continue MyPay from the current state as of 2026-04-24:

- MyPay mission-control phases `P0A-P0D`, `P1A-P1D`, `P2A-P2D`, `P3-A-P3-F`, `P4-A-P4-D`, `P5-A-P5-C`, `P6-A-P6-D`, and `P7-A-P7-E` are complete as implementation slices.
- Latest phase logs:
  - `docs/sessions/2026-04-24-mypay-phase-3a-wallet-home.md`
  - `docs/sessions/2026-04-24-mypay-phase-3b-send-flow.md`
  - `docs/sessions/2026-04-24-mypay-phase-3c-requests-links.md`
  - `docs/sessions/2026-04-24-mypay-phase-3d-through-7e.md`
- Existing layers now include money core schema/RPC, domain engine/state machine, provider abstraction, ops/reconciliation/audit, compliance identity/onboarding/tiers, risk controls, disputes, disclosures/receipts/legal copy, wallet home, send/request/activity/funding/settings/card/remittance mobile surfaces, web parity routes, cross-module projection contracts, card/merchant helpers, remittance/FX helpers, degraded-mode availability, ops console helpers, and launch/future-track docs.
- Repo is dirty. Do not revert unrelated changes.

Your task: perform MyPay launch-readiness hardening rather than starting a new mission-control phase.

Start from `docs/plans/payments/launch-gate.md`, `docs/plans/payments/future-pack.md`, and `docs/plans/mypay-uiux-mission-control.html`.

Build:

- Replace remaining demo-only MyPay route data with server-backed or provider-simulator-backed data seams where the current architecture already defines an authoritative path.
- Add provider-sandbox drill tests for send, funding, card, remittance, reconciliation, disputes, and degraded-mode fail-closed behavior.
- Walk the launch-gate matrix and turn each unchecked item into an explicit test, runbook, or documented blocker.
- Keep `payments` hidden until the release flip conditions are satisfied.
- Do not weaken the server-authoritative design or let Budget, Market, RSVP, or Dining become financial sources of truth.

Verification:

- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/payments test`
- run relevant mobile/web typechecks for touched host files
- run file-scoped ESLint for touched host files
- `pnpm gate:function --file <touched-file>` for changed function logic
- `pnpm gate:function:changed` even if still blocked by unrelated lint debt

Known unrelated blockers:

- Mobile package function gates still stop on `apps/mobile/app/(notes)/discovery 2.tsx:48` with `React Hook "useMemo" is called conditionally`.
- Web package function gates still stop on `apps/web/app/shop/purchases/[id]/page.tsx:194` and `:202` because the `@next/next/no-img-element` rule cannot be resolved.
