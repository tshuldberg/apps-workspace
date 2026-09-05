# Meerkat Blackglass Production Audit And Remediation

Date: 2026-07-09

## Outcome

Meerkat remains a production **NO-GO**, but the bounded security, integrity, deployment, billing, deletion, CI, CORS, Terms, storage-ingest, rate-limit, and packaging defects found in the implemented paths were repaired and committed as `47f452d3e185d418b71e87bdc2ecd0487b8af73f`.

The main audit is available as a self-contained report:

- [HTML report](../reports/REPORT-meerkat-blackglass-production-adversarial-audit-2026-07-09.html)
- [Markdown twin](../reports/REPORT-meerkat-blackglass-production-adversarial-audit-2026-07-09.md)

## Untrusted handoff comparison

The supplied humanity-token handoff was independently checked against the repository. Its narrow claim is correct: `e811672c2bc9f52fbe2904a56bad46e0802daaad` preserves a humanity token on the explicit pre-redemption per-IP rejection path. The later `f01c67437ded4164b11534ad7d8a1e4053f344a3` commit correctly added authenticated hosted purchase linking. Neither commit established full production readiness.

## Remediation highlights

- Centralized mobile and web app-unlock gates with boot revalidation.
- Bound RevenueCat customer identity to the device and replaced forgeable browser cache authority with authenticated signed grants.
- Added refund, expiration, and dispute relock plus ordered, idempotent Stripe state.
- Made production build configuration fail closed.
- Routed deletion through the complete GDPR topology, added an in-flight write barrier, and verified raw byte and key deletion.
- Added strict credentialed CORS and bounded public relay health CORS.
- Added trusted-proxy rate limiting, bounded memory, durable file leases, and hardened hosted upload ingest.
- Added production Docker, Compose, Caddy, persistent volumes, immutable action pins, real browser E2E, and platform image boot checks.
- Added server-enforced Terms-version acceptance plus legal and block-user surfaces.
- Made empty abuse-hash input a fatal production startup error.
- Aligned Expo dependencies and split the web production bundle.

## Verification

- Mobile: 1,145 / 1,145 tests.
- Web: 753 / 753 tests.
- Relay: 608 / 608 tests.
- Sync: 1,814 / 1,814 tests.
- Entitlements: 77 / 77 tests and 97.9% line coverage.
- Total Meerkat: 4,397 / 4,397 tests.
- Car: 267 / 267 tests.
- Module registry: 90 / 90 tests.
- Real-relay Playwright: 6 / 6 tests.
- Six relevant typechecks passed.
- Six relevant lint runs passed with zero warnings.
- Changed-function gate, Meerkat parity, full parity, and generated-artifact gate passed.
- Production dependency audit reported no known high-or-higher vulnerability.
- Web production build and iOS plus Android Expo exports passed.
- Expo Doctor passed 18 / 18 checks.
- Production environment and Compose validation passed with non-secret test inputs.
- Slim relay and exact platform images built.
- Exact platform image returned healthy while non-root, read-only, capability-dropped, and tmpfs-backed.
- Hosted entitlement rejection and empty abuse-hash fatal startup were proven on real source entrypoints.

The first parallel sync run exposed one timing-sensitive remote-store slope failure. The test passed in isolation, and the complete sync suite passed 1,814 / 1,814 when rerun alone. The existing timing-flake ledger entry remains visible.

## Remaining hard stops

1. Plan 25 calls and rooms is explicitly not started and is launch-hard.
2. Plan 41 user-selected storage destinations is explicitly incomplete and is launch-hard.
3. Nearby, Wi-Fi Direct, BLE wake, scheduled background work, and same-account convergence need signed-build physical-device proof.
4. Production DNS, TLS, secrets, TURN, nodes, Commons, monitoring, and soak are not provisioned.
5. Durable file-backed state has no multi-replica HA or destructive restore evidence.
6. Licensed abuse-hash input, moderation staffing, vendor onboarding, DMCA/NCMEC operations, and incident drills are not live.
7. Real store purchase lifecycle, legal URLs, store declarations, and exact-build device QA are absent.
8. Remote CI, branch protection, image digest, SBOM, signing, and release-tag enforcement are unverified.

The HTML report contains the ordered operator runbook and exact final GO criteria.

## Files

- `docs/reports/REPORT-meerkat-blackglass-production-adversarial-audit-2026-07-09.md`
- `docs/reports/REPORT-meerkat-blackglass-production-adversarial-audit-2026-07-09.html`
- `docs/sessions/2026-07-09-meerkat-blackglass-production-audit.md`
- `docs/sessions/2026-07-09-meerkat-blackglass-production-audit.html`
- `errors_log.md`
- `memory.md`

The product-function remediation is in `47f452d3`. The final report and ledger update are committed separately as documentation.
