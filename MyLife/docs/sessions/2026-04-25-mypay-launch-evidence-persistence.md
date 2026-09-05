# MyPay Launch Evidence Persistence

Date: 2026-04-25

## Summary

Added an audit-backed release-evidence persistence seam for MyPay launch readiness while keeping `payments` hidden and the current ops route pending because no real approval records were supplied.

This slice does not flip release state, does not treat persisted evidence as a release approval by itself, and does not make Budget, Market, RSVP, Dining, or other projections financial sources of truth.

## Implemented

- Added `modules/payments/src/launch/evidence-store.ts`.
- Added `createInMemoryPaymentsLaunchEvidenceStore` with:
  - legal, pilot, release-owner, and hidden-state acknowledgement evidence kinds
  - immutable records keyed by evidence id
  - provider profile, automated evidence timestamp, release ticket, and target release-state validation
  - replay-safe idempotency so reconnect submissions return the original record instead of duplicating or mutating evidence
  - explicit rejection codes for missing fields, evidence-id conflicts, idempotency-key conflicts, kind mismatches, reference mismatches, hidden target release states, and missing hidden-state acknowledgement
- Extended payments audit actions and subject typing for:
  - `launch_evidence.captured`
  - `launch_evidence.replayed`
  - `launch_evidence.rejected`
- Added `buildPaymentsLaunchReleaseEvidenceCaptureFromRecords` so persisted records can hydrate the existing captured-evidence review model.
- Exported the new launch evidence store surfaces through `modules/payments/src/launch/index.ts`.
- Extended `buildPaymentsOpsConsoleViewModel` with persisted release-evidence history.
- Rendered persisted release-evidence history in `apps/web/app/ops/payments/page.tsx`.
- Kept `/ops/payments` deterministic and pending by seeding the route with an empty server-side evidence store when no real approvals are supplied.
- Updated `docs/plans/payments/launch-gate.md`, `memory.md`, and `errors_log.md`.

## Tests Added

- `modules/payments/src/launch/__tests__/evidence-store.test.ts`
- `modules/payments/src/launch/__tests__/evidence-store.function-gate.test.ts`
- Updated:
  - `modules/payments/src/ops/__tests__/console.test.ts`
  - `modules/payments/src/ops/__tests__/console.function-gate.test.ts`
  - `apps/web/app/ops/payments/__tests__/page.test.tsx`

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed.
- `pnpm --filter @mylife/payments test -- --run src/launch/__tests__/evidence-store.test.ts src/launch/__tests__/evidence-store.function-gate.test.ts src/ops/__tests__/console.test.ts src/ops/__tests__/console.function-gate.test.ts` passed: 4 files, 16 tests.
- `pnpm --filter @mylife/payments test` passed: 52 files, 174 tests.
- `pnpm --filter @mylife/web typecheck` passed.
- `pnpm --filter @mylife/web test -- --run app/ops/payments/__tests__/page.test.tsx` passed: 1 file, 1 test.
- `pnpm --dir apps/web exec eslint app/ops/payments/page.tsx app/ops/payments/__tests__/page.test.tsx --ext .ts,.tsx` passed.
- `pnpm scaffold:function-test --file modules/payments/src/launch/evidence-store.ts --function createInMemoryPaymentsLaunchEvidenceStore` was attempted; it stopped because `modules/payments/src/launch/__tests__/evidence-store.function-gate.test.ts` already existed. The existing function-gate test was kept and verified.
- `pnpm gate:function --file modules/payments/src/launch/evidence-store.ts` passed.
- `pnpm gate:function --file modules/payments/src/ops/console.ts` passed.
- `pnpm gate:function --file apps/web/app/ops/payments/page.tsx --tests app/ops/payments/__tests__/page.test.tsx` passed with existing web lint warnings only.
- `pnpm gate:function:changed` passed across the dirty tree with existing warning-only mobile and web lint output.
- `pnpm check:parity --quiet` passed with existing standalone-missing warnings.
- `curl --max-time 30 -sS -o /tmp/mypay-ops-evidence-persistence.html -w '%{http_code}\n' http://localhost:3002/ops/payments` returned `200`; rendered HTML includes `Captured release evidence`, `Persisted release evidence`, `0 immutable records`, `No immutable release evidence`, and `Payments remains hidden`.

## Remaining Launch Blockers

- Real legal approval evidence is still not supplied.
- Real pilot approval evidence is still not supplied.
- Real release-owner signoff evidence is still not supplied.
- Real hidden-state acknowledgement evidence is still not supplied.
- `payments` remains in the hidden registry bucket.
- The ops surface cannot override the server-authoritative payments engine, provider sandbox evidence, compliance evidence, risk gates, dispute authority, legal-copy requirements, or release-state registry.

## Next MyPay Prompt

Working in `/Users/trey/Desktop/Apps/MyLife`.

Follow the repo startup checklist in `AGENTS.md` and `CLAUDE.md` before substantial edits. Also review `.claude/settings.local.json`, `.claude/skills-available.md`, and `.claude/plugins.md` if present.

Continue MyPay launch readiness from the current state as of 2026-04-25:

- MyPay mission-control implementation phases are complete.
- Launch readiness now includes provider-sandbox drills, reconciliation status-matrix fixtures, dispute operations checklist, fail-closed release approval packet, operator runbook, read-only `/ops/payments` review surface, typed captured release-evidence review, and an audit-backed immutable release-evidence persistence seam with idempotent replay handling.
- Latest launch logs:
  - `docs/sessions/2026-04-24-mypay-launch-readiness-hardening.md`
  - `docs/sessions/2026-04-24-mypay-launch-gate-matrix-dispute-ops.md`
  - `docs/sessions/2026-04-24-mypay-launch-approval-packet.md`
  - `docs/sessions/2026-04-24-mypay-launch-operator-runbook.md`
  - `docs/sessions/2026-04-24-mypay-launch-ops-review-surface.md`
  - `docs/sessions/2026-04-24-mypay-launch-release-evidence-capture.md`
  - `docs/sessions/2026-04-25-mypay-launch-evidence-persistence.md`
- `payments` remains hidden in `packages/module-registry/src/release-states.ts`. Do not flip release state unless the user explicitly provides real current legal, pilot, release-owner, and hidden-state acknowledgement approvals for the current evidence.
- Repo is dirty. Do not revert unrelated changes.

Your task: continue MyPay launch readiness without flipping the product live.

Start from:

- `docs/plans/payments/launch-gate.md`
- `modules/payments/src/launch/evidence-store.ts`
- `modules/payments/src/launch/readiness.ts`
- `modules/payments/src/ops/console.ts`
- `apps/web/app/ops/payments/page.tsx`
- `packages/module-registry/src/release-states.ts`

Build:

- Add a role-gated ops capture workflow around the release-evidence persistence seam.
- Require explicit operator identity, release ticket, provider profile, automated evidence timestamp, target release state, and idempotency key for each capture.
- Preserve immutable evidence semantics: no capture may mutate an existing evidence id or replay key.
- Add dual-control or reviewer separation where release-owner evidence could otherwise be captured by the same actor that supplied legal or pilot evidence.
- Render capture eligibility and rejected-capture reasons in `/ops/payments` while keeping the route read-only unless real approval inputs are supplied.
- Keep Budget, Market, RSVP, Dining, and other cross-module projections read-only advisory surfaces.
- Keep `payments` hidden by default. Do not move `payments` out of `HIDDEN_MODULE_IDS` unless the user explicitly provides real legal, pilot, release-owner, and hidden-state acknowledgement approvals for the current evidence.

Verification:

- `pnpm --filter @mylife/payments exec tsc --noEmit` if module code changes
- `pnpm --filter @mylife/payments test` if module code changes
- run relevant web or mobile typechecks if host files change
- run file-scoped ESLint or function gates for touched host files
- `pnpm gate:function --file <touched-file>` for changed function logic
- `pnpm gate:function:changed` even if still blocked by unrelated lint debt
