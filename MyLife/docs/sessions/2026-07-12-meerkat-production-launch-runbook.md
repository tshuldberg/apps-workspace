# 2026-07-12 - Meerkat Production Launch Runbook (code-verified)

## What was done

Produced the current, fully code-verified step-by-step path from today's NO-GO to a
production GO for Meerkat:
`docs/reports/REPORT-meerkat-production-launch-runbook-2026-07-12.md` (+ HTML twin, opened
in browser). Per the founder request, no documentation claim was trusted without verifying
the functionality in code.

## Verification performed (branch `feature/meerkat-plan43` @ `8c692a90` + WP-43E working set, committed the same day as `9eab3d8b` by the concurrent commit+push safety sweep)

- Full Meerkat test battery run on this exact tree: relay 1,307 / sync 1,845 / app 1,182 /
  web 795 tests passed (5,129 total; 179 relay Postgres-integration tests skip locally, CI
  runs them against PG 17 + MinIO). All four typechecks green. `check:meerkat-parity` and
  full `check:parity` green.
- Four independent Explore-agent code-verification passes:
  1. Plan 42 (native transport + push): all 7 claims VERIFIED real (Swift
     MultipeerConnectivity, Kotlin Wi-Fi Direct, CoreBluetooth/android BLE wake with
     512-byte gate, real APNs/FCM/VAPID adapters with real crypto, real fetch client, NC
     static gates + vitest twin, module-scope background tasks, honest null bridges).
  2. Plan 44 (production state/observability/supply chain): VERIFIED real (27 PG store
     classes, migrations 0001-0014, S3 via aws-sdk, import/cutover CLIs with fenced proofs,
     Prometheus + livez/readyz, release-images.yml with SBOM/Grype/SLSA/Cosign, fail-closed
     load harness). Backup/DR tooling real; live proof is founder-ops.
  3. Gaps: Plan 25 and Plan 41 CONFIRMED ABSENT in code; R1 (Share Inbox DM) still
     rejected in `share-route.ts:257`; R2 stubs (SignalingClient, TrackerClient,
     PaidContentManager) still in the main sync barrel (not native); PushRelayClient
     replaced by real PushGatewayClient; UI copy honest; push-store O(n) lookup confirmed.
  4. Deploy surface: 8-service compose.production.yml with 65 guarded env vars, 20+ bins,
     20 drill runbooks, ci.yml 11 jobs, release/staging/canary/rollback workflows, billing
     env map, eas.json profiles, legal env (DMCA agent vars). No broken references found.
- Direct reads: billing-config founder-locked prices ($4.99 + $4.99/mo, test-pinned),
  `app.json` `ITSAppUsesNonExemptEncryption: false` flag (needs counsel),
  `docs/releases/meerkat/` absent, WP-43E working set (644-line intake API + 708-line test
  file, 31 tests passing, wired as optional community-node mount).

## Report contents

Phase 0-10 runbook with [CODE]/[FOUNDER-OPS]/[EVIDENCE] tags: Phase 0 codeable close
(WP-43E landing ritual, WP-43F..J, R1, R2, push getRegistration(idHash), founder decision
on Plans 25/41 per NC-40.5, merge + Blackglass rerun + release SHA); Phases 1-4 accounts,
infra (compose topology, roles, migrations, secrets, Commons), backup/restore/drill
evidence, signed release pipeline + evidence ledger creation; Phase 5 safety/legal
(abuse-hash, AV, NCMEC client, DMCA registration, published legal URLs, staffing, drills);
Phase 6 billing (exact SKUs + sandbox matrix); Phase 7 push credentials; Phase 8 EAS builds
+ physical device matrix; Phase 9 store submissions (export-compliance fix first); Phase 10
10x load + 48h soak + final audit + named GO. Plus automatic NO-GO conditions and a
critical-path effort table (Plans 25/41 decision + Phase 5 vendor lead times dominate).

## Files changed

- NEW `docs/reports/REPORT-meerkat-production-launch-runbook-2026-07-12.md` + `.html`
  (opened in browser)
- `docs/reports/README.md` (new current row; state-of-the-app runbook marked superseded)
- `memory.md` (session row)
- NEW this session log

## Remaining items

- The runbook itself is the remaining-items list; nearest action is completing the WP-43E
  packet review ritual (it was committed as `9eab3d8b` by the concurrent safety sweep, but
  its adversarial review and board-state update are still pending) and authoring WP-43F..J,
  plus the founder decision on Plans 25/41.

## Decisions

- None taken for the product; the report frames the Plans 25/41 build-vs-written-scope-cut
  as an explicit founder decision per NC-40.5 rather than recommending a silent cut.
