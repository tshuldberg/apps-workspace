# MyPay Launch Evidence Capture Workflow

Date: 2026-04-25

## Summary

Added a role-gated ops capture workflow around MyPay launch release-evidence persistence while keeping `payments` hidden and `/ops/payments` read-only with no real approval inputs supplied.

This slice does not flip release state, does not persist fake approvals, and does not treat Budget, Market, RSVP, Dining, or other projections as financial sources of truth.

## Implemented

- Added structured operator identity and operator-role checks to `modules/payments/src/launch/evidence-store.ts`.
- Added `buildPaymentsLaunchEvidenceCaptureEligibility` to evaluate capture readiness before persistence.
- Required evidence id, idempotency key, operator identity, provider profile, automated evidence timestamp, release ticket, and target release state for each capture.
- Preserved immutable evidence ids and replay-key semantics by rejecting alternate replay keys for existing evidence ids.
- Added release-owner separation: if the release owner captured legal or pilot evidence for the same release packet, release-owner signoff requires a separate payments-ops or compliance dual-control reviewer.
- Added rejected-capture audit metadata for operator actor, roles, reviewer actor, and reviewer roles.
- Extended the ops console view model with capture eligibility and rejected-capture reasons.
- Rendered the capture eligibility panel in `/ops/payments` so the current route shows every capture workflow blocked because no real operator, ticket, target state, evidence id, idempotency key, or approval payload is supplied.
- Kept persisted history read-only and kept `payments` hidden.

## Tests Added Or Updated

- `modules/payments/src/launch/__tests__/evidence-store.test.ts`
- `modules/payments/src/launch/__tests__/evidence-store.function-gate.test.ts`
- `modules/payments/src/ops/__tests__/console.test.ts`
- `apps/web/app/ops/payments/__tests__/page.test.tsx`

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed after fixing the provider-profile narrowing noted in `errors_log.md`.
- `pnpm --filter @mylife/payments test -- --run src/launch/__tests__/evidence-store.test.ts src/launch/__tests__/evidence-store.function-gate.test.ts src/ops/__tests__/console.test.ts src/ops/__tests__/console.function-gate.test.ts` passed: 4 files, 19 tests.
- `pnpm --filter @mylife/payments test` passed: 52 files, 177 tests.
- `pnpm --filter @mylife/web test -- --run app/ops/payments/__tests__/page.test.tsx` passed.
- `pnpm --filter @mylife/web typecheck` passed.
- `pnpm --dir apps/web exec eslint app/ops/payments/page.tsx app/ops/payments/__tests__/page.test.tsx --ext .ts,.tsx` passed.
- `pnpm scaffold:function-test --file modules/payments/src/launch/evidence-store.ts --function buildPaymentsLaunchEvidenceCaptureEligibility` refused to overwrite the existing `modules/payments/src/launch/__tests__/evidence-store.function-gate.test.ts`, so the existing focused function-gate file was updated and kept.
- `pnpm gate:function --file modules/payments/src/launch/evidence-store.ts` passed.
- `pnpm gate:function --file modules/payments/src/ops/console.ts` passed.
- `pnpm gate:function --file apps/web/app/ops/payments/page.tsx --tests app/ops/payments/__tests__/page.test.tsx` passed with existing warning-only web lint output.
- `pnpm check:parity --quiet` passed with existing standalone-missing warnings.
- `curl --max-time 30 -sS -o /tmp/mypay-ops-capture-workflow.html -w '%{http_code}\n' http://localhost:3002/ops/payments` returned `200`; rendered HTML includes `Release evidence capture eligibility`, `0 of 4 capture workflows eligible`, `Operator identity required`, `Persisted release evidence`, and `Payments remains hidden`.
- `pnpm gate:function:changed` did not pass because unrelated dirty web Mood insight tests pulled React Native Flow syntax into Vitest (`react-native/index.js` `import typeof`). Payments-specific gates and parity passed; the unrelated blocker is tracked in `errors_log.md`.

## Remaining Launch Blockers

- Real legal approval evidence is still not supplied.
- Real pilot approval evidence is still not supplied.
- Real release-owner signoff evidence is still not supplied.
- Real hidden-state acknowledgement evidence is still not supplied.
- `payments` remains in the hidden registry bucket.
- `/ops/payments` is still a read-only review surface and cannot override server-authoritative payments state.

## Notes

- Open Brain reports connected through `claude mcp list`, but this Codex session did not expose callable `get_briefing` or `capture_memory` tools through `tool_search`, so cross-device capture could not be written from this tool surface.
