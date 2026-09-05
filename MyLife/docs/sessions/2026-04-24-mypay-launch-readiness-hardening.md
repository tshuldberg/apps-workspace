# MyPay Launch Readiness Hardening

Date: 2026-04-24

## Summary

Hardened MyPay launch readiness after completing the mission-control implementation phases.

This slice keeps the server-authoritative design intact and does not flip the hidden payments release state.

## Implemented

- Added a new launch-readiness module surface:
  - `modules/payments/src/launch/readiness.ts`
  - `modules/payments/src/launch/index.ts`
- Exported the launch surface through:
  - `modules/payments/src/index.ts`
  - `modules/payments/package.json`
- Added provider-sandbox launch drills for:
  - send transfer and idempotency replay
  - funding intent
  - card issuing
  - remittance quote and settlement
  - reconciliation clean run and balance proofs
  - dispute workflow plus provider sandbox dispute
  - degraded-mode fail-closed availability
- Added a launch-gate view model that keeps release blocked until automated drills, legal approval, pilot approval, and release flip are all complete.
- Moved top-level wallet-home sandbox data into the payments module so mobile/web wallet home no longer carry their own hardcoded demo projection:
  - `apps/mobile/app/(payments)/index.tsx`
  - `apps/web/app/payments/page.tsx`
- Updated `docs/plans/payments/launch-gate.md` to mark automated evidence and remaining blockers explicitly.
- Updated `memory.md` and `errors_log.md`.

## Tests Added

- `modules/payments/src/launch/__tests__/readiness.test.ts`

The tests cover:

- shared wallet-home sandbox snapshot
- successful Synctera sandbox drills across all required rails
- required-rail failure behavior for Unit sandbox card issuing
- release gate remaining hidden until automated, legal, pilot, and release flip gates pass

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed.
- `pnpm --filter @mylife/payments test` passed: 48 files, 146 tests.
- `pnpm --filter @mylife/mobile typecheck` passed.
- `pnpm --filter @mylife/web typecheck` passed.
- File-scoped ESLint passed for:
  - `apps/mobile/app/(payments)/index.tsx`
  - `apps/web/app/payments/page.tsx`
- `pnpm gate:function --file modules/payments/src/launch/readiness.ts` passed.

## Verification Notes

- The first package-wide payments test run exposed a one-run timing flake in `createPaymentsProviderBundle` function-gate slope measurement. Rerunning the same command immediately passed with no code change.
- Initial launch-readiness typecheck/test failures were fixed in the same flow:
  - profile assertion narrowed to wallet owner id
  - reconciliation report carried through async drill execution
  - funding drill seeded settlement pending balance
  - dispute drill uses a completed transfer state before opening a dispute
- `pnpm gate:function --file apps/mobile/app/(payments)/index.tsx` remains blocked by the known unrelated mobile Notes lint error:
  - `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - `React Hook "useMemo" is called conditionally`
- `pnpm gate:function --file apps/web/app/payments/page.tsx` remains blocked by the known unrelated web Shop lint rule error:
  - `apps/web/app/shop/purchases/[id]/page.tsx:194`
  - `apps/web/app/shop/purchases/[id]/page.tsx:202`
  - missing `@next/next/no-img-element` rule
- `pnpm gate:function:changed` ran the BestChef app subgate successfully, then stopped on the same unrelated mobile Notes lint blocker.

## Remaining Launch Blockers

- Add explicit reconciliation fixtures or a launch runbook for reversed, failed, returned, and disputed provider status matrices.
- Attach an ops runbook for dispute ledger actions, approval authority, provisional-credit timing, and closure notices.
- Legal approval is still required for stored-balance, partner-bank, custodial, remittance-cancellation, and error-resolution copy.
- Pilot approval is still required with cohort, limits, monitoring, rollback criteria, provider profile, and any corridor configuration.
- `payments` must remain hidden until the release owner flips it after all gates pass.

## Next MyPay Prompt

Working in `/Users/trey/Desktop/Apps/MyLife`.

Follow the repo startup checklist in `AGENTS.md` and `CLAUDE.md` before substantial edits. Also review `.claude/settings.local.json`, `.claude/skills-available.md`, and `.claude/plugins.md` if present.

Continue MyPay from the current state as of 2026-04-24:

- MyPay mission-control phases `P0A-P0D`, `P1A-P1D`, `P2A-P2D`, `P3-A-P3-F`, `P4-A-P4-D`, `P5-A-P5-C`, `P6-A-P6-D`, and `P7-A-P7-E` are complete as implementation slices.
- Launch-readiness hardening is complete for the first pass:
  - `modules/payments/src/launch/readiness.ts`
  - `modules/payments/src/launch/__tests__/readiness.test.ts`
  - `docs/plans/payments/launch-gate.md`
- Existing layers now include money core schema/RPC, domain engine/state machine, provider abstraction, ops/reconciliation/audit, compliance identity/onboarding/tiers, risk controls, disputes, disclosures/receipts/legal copy, wallet home, send/request/activity/funding/settings/card/remittance mobile surfaces, web parity routes, cross-module projection contracts, card/merchant helpers, remittance/FX helpers, degraded-mode availability, ops console helpers, and launch-readiness provider-sandbox drills.
- `payments` remains hidden. Do not flip release state until all launch gates pass.
- Repo is dirty. Do not revert unrelated changes.

Your task: continue MyPay launch readiness from the remaining blocked gates.

Start from:

- `docs/plans/payments/launch-gate.md`
- `modules/payments/src/launch/readiness.ts`
- `modules/payments/src/ops/reconciliation.ts`
- `modules/payments/src/compliance/disputes/`

Build:

- Add explicit reconciliation fixtures or launch-runbook helpers for reversed, failed, returned, and disputed provider status matrices.
- Add a dispute operations runbook or typed checklist covering ledger-action authority, provisional-credit timing, closure notices, and audit evidence.
- Keep Budget, Market, RSVP, Dining, and other cross-module projections as read-only advisory surfaces, not financial sources of truth.
- Keep `payments` hidden until legal review, pilot approval, and release-owner signoff are all explicitly recorded.
- Do not weaken server-authoritative data flow or provider-sandbox boundaries.

Verification:

- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/payments test`
- run relevant mobile/web typechecks if host files change
- run file-scoped ESLint for touched host files
- `pnpm gate:function --file <touched-file>` for changed function logic
- `pnpm gate:function:changed` even if still blocked by unrelated lint debt

Known unrelated blockers:

- Mobile package function gates still stop on `apps/mobile/app/(notes)/discovery 2.tsx:48` with `React Hook "useMemo" is called conditionally`.
- Web package function gates still stop on `apps/web/app/shop/purchases/[id]/page.tsx:194` and `:202` because the `@next/next/no-img-element` rule cannot be resolved.
