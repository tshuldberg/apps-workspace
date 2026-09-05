# MyPay Launch Release Evidence Capture

Date: 2026-04-24

## Summary

Added a typed release-evidence capture and review layer for MyPay launch readiness while keeping `payments` hidden.

This slice does not flip release state, does not persist real approvals, and does not treat Budget, Market, RSVP, Dining, or other projections as financial sources of truth.

## Implemented

- Added `buildPaymentsLaunchReleaseEvidenceReview` in `modules/payments/src/launch/readiness.ts`.
- Added typed evidence capture surfaces for:
  - legal review evidence
  - pilot approval evidence
  - release-owner signoff evidence
  - explicit hidden-state acknowledgement
- Validated captured evidence against:
  - approver identity
  - approval timestamp
  - provider profile
  - automated evidence timestamp
  - release ticket
  - target release state
  - explicit acknowledgement that `payments` remains hidden until a separate approved release-state change lands
- Kept the release approval packet fail-closed: captured evidence can become ready for release-owner review while `releaseFlipEnabled` remains false because `payments` is still hidden.
- Extended `buildPaymentsOpsConsoleViewModel` to expose a captured release-evidence review view model.
- Rendered the captured-evidence review state in `apps/web/app/ops/payments/page.tsx` as pending, blocked, or ready for release-owner review.
- Added focused tests:
  - `modules/payments/src/launch/__tests__/readiness.test.ts`
  - `modules/payments/src/launch/__tests__/readiness.function-gate.test.ts`
  - `modules/payments/src/ops/__tests__/console.test.ts`
  - `modules/payments/src/ops/__tests__/console.function-gate.test.ts`
  - `apps/web/app/ops/payments/__tests__/page.test.tsx`
- Updated `docs/plans/payments/launch-gate.md`.

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed.
- `pnpm --filter @mylife/payments test -- --run src/launch/__tests__/readiness.test.ts src/launch/__tests__/readiness.function-gate.test.ts src/ops/__tests__/console.test.ts src/ops/__tests__/console.function-gate.test.ts` passed: 4 files, 23 tests.
- `pnpm --filter @mylife/payments test` passed: 50 files, 164 tests.
- `pnpm --filter @mylife/web typecheck` passed.
- `pnpm --filter @mylife/web test -- --run app/ops/payments/__tests__/page.test.tsx` passed: 1 file, 1 test.
- `pnpm --dir apps/web exec eslint app/ops/payments/page.tsx app/ops/payments/__tests__/page.test.tsx --ext .ts,.tsx` passed.
- `pnpm gate:function --file modules/payments/src/launch/readiness.ts` passed.
- `pnpm gate:function --file modules/payments/src/ops/console.ts` passed.
- `pnpm gate:function --file apps/web/app/ops/payments/page.tsx --tests app/ops/payments/__tests__/page.test.tsx` passed with existing web lint warnings.
- `pnpm gate:function:changed` passed across the dirty tree with existing warning-only mobile and web lint output.
- `pnpm check:parity --quiet` passed with the existing standalone-missing warnings.
- `curl --max-time 30 -sS -o /tmp/mypay-ops-release-evidence.html -w '%{http_code}\n' http://localhost:3002/ops/payments` returned `200`; the rendered HTML includes `Captured release evidence`, `Pending`, and `Payments remains hidden`.

## Remaining Launch Blockers

- Real legal approval evidence is still not attached or persisted.
- Real pilot approval evidence is still not attached or persisted.
- Real release-owner signoff evidence is still not attached or persisted.
- `payments` remains in the hidden registry bucket.
- The ops surface displays a typed review state but cannot override the server-authoritative payments engine, provider sandbox evidence, compliance evidence, risk gates, dispute authority, legal-copy requirements, or release-state registry.

## Next MyPay Prompt

Working in `/Users/trey/Desktop/Apps/MyLife`.

Follow the repo startup checklist in `AGENTS.md` and `CLAUDE.md` before substantial edits. Also review `.claude/settings.local.json`, `.claude/skills-available.md`, and `.claude/plugins.md` if present.

Continue MyPay launch readiness from the current state as of 2026-04-24:

- MyPay mission-control implementation phases are complete.
- Launch readiness now includes provider-sandbox drills, reconciliation status-matrix fixtures, dispute operations checklist, fail-closed release approval packet, operator runbook, read-only `/ops/payments` review surface, and typed captured release-evidence review.
- Latest launch logs:
  - `docs/sessions/2026-04-24-mypay-launch-readiness-hardening.md`
  - `docs/sessions/2026-04-24-mypay-launch-gate-matrix-dispute-ops.md`
  - `docs/sessions/2026-04-24-mypay-launch-approval-packet.md`
  - `docs/sessions/2026-04-24-mypay-launch-operator-runbook.md`
  - `docs/sessions/2026-04-24-mypay-launch-ops-review-surface.md`
  - `docs/sessions/2026-04-24-mypay-launch-release-evidence-capture.md`
- `payments` remains hidden in `packages/module-registry/src/release-states.ts`. Do not flip release state unless real current legal, pilot, and release-owner approvals are explicitly provided.
- Repo is dirty. Do not revert unrelated changes.

Your task: continue MyPay launch readiness without flipping the product live.

Start from:

- `docs/plans/payments/launch-gate.md`
- `modules/payments/src/launch/readiness.ts`
- `modules/payments/src/ops/console.ts`
- `apps/web/app/ops/payments/page.tsx`
- `packages/module-registry/src/release-states.ts`

Build:

- Add an audit-backed, server-authoritative persistence seam for captured legal, pilot, release-owner, and hidden-state acknowledgement evidence.
- Keep the stored evidence immutable by evidence id, provider profile, automated evidence timestamp, release ticket, and target release state.
- Add replay-safe idempotency for evidence capture so reconnects cannot duplicate or mutate approvals.
- Render persisted evidence history in `/ops/payments` while keeping the current deterministic pending state when no real approvals are supplied.
- Keep Budget, Market, RSVP, Dining, and other cross-module projections read-only advisory surfaces.
- Keep `payments` hidden by default. Do not move `payments` out of `HIDDEN_MODULE_IDS` unless the user explicitly provides real legal, pilot, and release-owner approvals for the current evidence.

Verification:

- `pnpm --filter @mylife/payments exec tsc --noEmit` if module code changes
- `pnpm --filter @mylife/payments test` if module code changes
- run relevant web or mobile typechecks if host files change
- run file-scoped ESLint or function gates for touched host files
- `pnpm gate:function --file <touched-file>` for changed function logic
- `pnpm gate:function:changed` even if still blocked by unrelated lint debt
