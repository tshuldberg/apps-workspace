# MyPay Launch Gate

Date: 2026-04-25

Payments stays hidden until every gate below is explicitly marked complete. Automated launch-readiness helpers now live in `modules/payments/src/launch/`.

## Verification Matrix

| Area | Status | Evidence / Blocker |
|------|--------|--------------------|
| Unit and integration tests | Automated, passing | `pnpm --filter @mylife/payments exec tsc --noEmit` and `pnpm --filter @mylife/payments test` pass after the launch-readiness slice. |
| Provider sandbox drills | Automated, passing for full sandbox | `runPaymentsProviderSandboxDrills` covers send idempotency, funding intent, card issuance, remittance quote/settlement, clean reconciliation, dispute/provider submission, and degraded-mode fail-closed behavior. Focused coverage: `modules/payments/src/launch/__tests__/readiness.test.ts`. |
| Reconciliation | Automated, passing for launch matrix | `runPaymentsLaunchReconciliationStatusMatrix` covers completed/settled, reversed/refunded, failed/failed, failed/returned, and disputed/chargeback provider status mappings with clean balance proofs. Existing reconciliation tests also cover drift, stale transfers, missing transfers, duplicate callbacks, and balance mismatch. |
| Disputes and holds | Checklist helper added, release-instance evidence required | Unit coverage exercises customer report, evidence, provider submission, operator action, ledger decision, and closure. The launch drill opens a domain dispute and provider sandbox dispute. `buildPaymentsDisputeOpsChecklist` blocks launch until ledger-action authority, dual control, provisional-credit timing, closure notices, and audit evidence are recorded for the release instance. |
| Provider outage | Automated, passing | `buildPaymentsAvailabilityViewModel` is exercised by launch drills so send, funding, card, and remittance disable independently while balance/history surfaces remain readable. |
| Legal review | Approval packet helper added, release-instance evidence required | `buildPaymentsLaunchReleaseApprovalPacket` blocks legal review unless counsel approval references the current automated evidence timestamp/provider profile and explicitly approves stored-balance, partner-bank, custodial, remittance-cancellation, and error-resolution copy. `buildPaymentsLaunchReleaseEvidenceReview` now exposes a separate captured-evidence review state without changing release state. `createInMemoryPaymentsLaunchEvidenceStore` can persist immutable legal evidence records with audit entries and idempotent replay protection. |
| Pilot | Approval packet helper added, release-instance evidence required | `buildPaymentsLaunchReleaseApprovalPacket` blocks pilot readiness unless cohort, limit profile, monitoring, rollback, corridor review, provider profile, approver, and evidence timestamp all match the current launch evidence. Captured pilot evidence is reviewed alongside legal, release-owner, and hidden-state acknowledgement evidence before release-owner review. The evidence store keeps captured pilot records immutable by evidence id, provider profile, automated evidence timestamp, release ticket, and target state. |
| Release flip | Blocked and fail-closed | `payments` remains hidden by default. Release-owner signoff must reference the current automated evidence, target a visible release state, include a release ticket, and show the feature is no longer hidden before the gate can pass. The captured-evidence review can be ready for release-owner review while the release flip remains blocked. No release-state file was flipped by this launch-readiness work. |
| Evidence persistence | Seam added, no real approvals supplied | `createInMemoryPaymentsLaunchEvidenceStore` adds an audit-backed, server-authoritative persistence seam for legal, pilot, release-owner, and hidden-state acknowledgement records. Captures are immutable, provider/timestamp/ticket/state checked, role-gated by structured operator identity, and idempotent so reconnect replays cannot duplicate or mutate approvals. Release-owner capture also requires actor separation from legal/pilot evidence or a separate payments-ops/compliance dual-control reviewer. `buildPaymentsLaunchReleaseEvidenceCaptureFromRecords` hydrates review input from persisted records. |
| Ops capture workflow | Automated, fail-closed | `buildPaymentsLaunchEvidenceCaptureEligibility` reports capture eligibility for each release-evidence kind before persistence. It requires operator identity, evidence id, idempotency key, release ticket, provider profile, automated evidence timestamp, and target release state, and exposes rejected-capture reasons for `/ops/payments`. |
| Operator review packet | Automated, fail-closed | `buildPaymentsLaunchOperatorRunbook` condenses the drill report, reconciliation matrix, dispute checklist, and approval packet into human-review sections plus explicit do-not-launch reasons for missing evidence, stale or mismatched approvals, provider-profile drift, and hidden release state. The web ops route at `/ops/payments` renders that packet, captured release-evidence review state, capture eligibility, rejected-capture reasons, and persisted release-evidence history while remaining pending when no real approval records are supplied. |

## Launch Rule

The release-state change is a consequence of passing the gate. It is not a roadmap marker or design decision by itself.

## Runbook Inputs

Launch readiness must attach current evidence from:

- `runPaymentsProviderSandboxDrills`
- `runPaymentsLaunchReconciliationStatusMatrix`
- `buildPaymentsDisputeOpsChecklist`
- `buildPaymentsLaunchReleaseApprovalPacket`
- `buildPaymentsLaunchReleaseEvidenceReview`
- `buildPaymentsLaunchEvidenceCaptureEligibility`
- `createInMemoryPaymentsLaunchEvidenceStore`
- `buildPaymentsLaunchReleaseEvidenceCaptureFromRecords`
- `buildPaymentsLaunchOperatorRunbook`

The release gate remains blocked unless those automated inputs pass, legal review is approved, pilot approval is recorded, and the release owner enables the final flag. Budget, Market, RSVP, Dining, and other cross-module projections remain read-only advisory consumers and are not financial sources of truth.

Approval evidence must fail closed when it is missing, stale, future-dated, mismatched to the automated evidence timestamp, mismatched to the provider profile, mismatched to the release ticket, missing an authorized operator role, missing release-owner actor separation or dual-control review, or targeted at the hidden release state. `payments` remains in the hidden registry bucket until a separate release-owner-approved change moves it into a visible release state.

The operator runbook is a review artifact only. It does not flip release state, override the server-authoritative payments engine, or treat cross-module projections as financial evidence.

The `/ops/payments` review surface is also read-only. It displays deterministic launch evidence, the typed captured-evidence review state, capture eligibility with rejected-capture reasons, and persisted evidence history for operators. The current route supplies no real approval records, so every capture workflow remains blocked, the review remains pending, and it does not change `packages/module-registry/src/release-states.ts`.
