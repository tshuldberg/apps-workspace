# MyPay Launch Operator Runbook

Date: 2026-04-24

## Summary

Added an operator-facing launch evidence runbook helper for MyPay launch review.

This slice does not flip the `payments` release state and does not record real legal, pilot, or release-owner approvals.

## Implemented

- Added `buildPaymentsLaunchOperatorRunbook` in `modules/payments/src/launch/readiness.ts`.
- The runbook consumes:
  - `runPaymentsProviderSandboxDrills`
  - `runPaymentsLaunchReconciliationStatusMatrix`
  - `buildPaymentsDisputeOpsChecklist`
  - `buildPaymentsLaunchReleaseApprovalPacket`
- Added typed runbook sections for:
  - provider sandbox drills
  - reconciliation status matrix
  - dispute operations
  - release approval packet
  - release state
- Added explicit do-not-launch reason ids for:
  - missing provider drills
  - failed provider drills
  - missing reconciliation matrix
  - failed reconciliation matrix
  - missing dispute ops checklist
  - blocked dispute ops checklist
  - missing release approval packet
  - blocked release approval packet
  - stale or invalid approval evidence
  - approval evidence timestamp mismatch
  - provider-profile mismatch
  - hidden payments release state
- Exported the new runbook helper and types through `modules/payments/src/launch/index.ts`.
- Updated `docs/plans/payments/launch-gate.md`, `memory.md`, and `errors_log.md`.

## Tests Added

- Extended `modules/payments/src/launch/__tests__/readiness.test.ts`.

The tests cover:

- a ready operator runbook when all automated evidence, approval packet evidence, provider profile, and release-state evidence pass
- fail-closed missing evidence and hidden-state reasons
- stale approval evidence mapped to do-not-launch reasons
- provider-profile mismatch mapped to do-not-launch reasons

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed.
- `pnpm --filter @mylife/payments test -- --run src/launch/__tests__/readiness.test.ts` passed: 1 file, 10 tests.
- `pnpm --filter @mylife/payments test` passed: 48 files, 152 tests.
- `pnpm gate:function --file modules/payments/src/launch/readiness.ts` passed.
- `pnpm gate:function:changed` remained blocked by the known unrelated mobile Notes lint error after passing the BestChef app subgate.
- `pnpm --dir apps/mobile run lint --quiet` reconfirmed the blocker:
  - `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - `React Hook "useMemo" is called conditionally`
- `pnpm check:parity --quiet` passed.

## Remaining Launch Blockers

- Real legal approval evidence is still not recorded.
- Real pilot approval evidence is still not recorded.
- Real release-owner signoff is still not recorded.
- `payments` remains in the hidden registry bucket.
- The operator runbook is a review artifact only and cannot override the server-authoritative engine, provider sandbox evidence, compliance evidence, risk gates, dispute authority, or release-state registry.

## Next MyPay Prompt

Working in `/Users/trey/Desktop/Apps/MyLife`.

Follow the repo startup checklist in `AGENTS.md` and `CLAUDE.md` before substantial edits. Also review `.claude/settings.local.json`, `.claude/skills-available.md`, and `.claude/plugins.md` if present.

Continue MyPay from the current state as of 2026-04-24:

- MyPay mission-control phases `P0A-P0D`, `P1A-P1D`, `P2A-P2D`, `P3-A-P3-F`, `P4-A-P4-D`, `P5-A-P5-C`, `P6-A-P6-D`, and `P7-A-P7-E` are complete as implementation slices.
- Launch-readiness hardening now includes:
  - provider-sandbox drills for send, funding, cards, remittance, reconciliation, disputes, and degraded-mode fail-closed behavior
  - explicit completed/reversed/failed/returned/disputed reconciliation status-matrix fixtures
  - a typed dispute operations checklist for ledger authority, provisional-credit timing, closure notices, and audit evidence
  - a fail-closed release approval packet for legal review, pilot approval, and release-owner signoff tied to the current automated evidence timestamp/provider profile
  - an operator-facing launch runbook that condenses provider drills, reconciliation matrix, dispute checklist, approval packet, and hidden release state into human-review sections plus explicit do-not-launch reasons
  - a launch gate view model that keeps `payments` hidden until automated evidence, approval packet, and release flip all pass
- Latest phase logs:
  - `docs/sessions/2026-04-24-mypay-launch-readiness-hardening.md`
  - `docs/sessions/2026-04-24-mypay-launch-gate-matrix-dispute-ops.md`
  - `docs/sessions/2026-04-24-mypay-launch-approval-packet.md`
  - `docs/sessions/2026-04-24-mypay-launch-operator-runbook.md`
- Existing layers include money core schema/RPC, domain engine/state machine, provider abstraction, ops/reconciliation/audit, compliance identity/onboarding/tiers, risk controls, disputes, disclosures/receipts/legal copy, wallet/send/request/activity/funding/settings/card/remittance surfaces, web parity routes, cross-module projections, degraded-mode availability, ops console helpers, and launch-readiness evidence helpers.
- `payments` remains hidden in `packages/module-registry/src/release-states.ts`. Do not flip release state unless real current approval evidence is explicitly provided.
- Repo is dirty. Do not revert unrelated changes.

Your task: continue MyPay launch readiness without flipping the product live.

Start from:

- `docs/plans/payments/launch-gate.md`
- `modules/payments/src/launch/readiness.ts`
- `modules/payments/src/ops/console.ts`
- `apps/web/app/ops/payments/`
- `packages/module-registry/src/release-states.ts`

Build:

- Add an operator-facing launch review surface that renders the new launch operator runbook in the existing payments ops console or web ops route.
- Show section status, evidence timestamps, provider profile, hidden release state, and all do-not-launch reasons in a concise review packet.
- Keep Budget, Market, RSVP, Dining, and other cross-module projections read-only advisory surfaces, not financial sources of truth.
- Keep `payments` hidden by default. Do not move `payments` out of `HIDDEN_MODULE_IDS` unless the user explicitly provides real legal, pilot, and release-owner approvals for the current evidence.
- Do not weaken server-authoritative data flow, provider-sandbox boundaries, identity/risk checks, dispute authority, or legal-copy requirements.

Verification:

- `pnpm --filter @mylife/payments exec tsc --noEmit` if module code changes
- `pnpm --filter @mylife/payments test` if module code changes
- run relevant web or mobile typechecks if host files change
- run file-scoped ESLint or function gates for touched host files
- `pnpm gate:function --file <touched-file>` for changed function logic
- `pnpm gate:function:changed` even if still blocked by unrelated lint debt

Known unrelated blockers:

- Mobile package function gates still stop on `apps/mobile/app/(notes)/discovery 2.tsx:48` with `React Hook "useMemo" is called conditionally`.
- Web package function gates still stop on `apps/web/app/shop/purchases/[id]/page.tsx:194` and `:202` because the `@next/next/no-img-element` rule cannot be resolved.
