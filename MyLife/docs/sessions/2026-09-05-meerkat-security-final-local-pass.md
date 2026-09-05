# Meerkat security: final local remediation pass

Date: 2026-09-05. User requested continued resolution through completion. Work remains incomplete overall because the renewal protocol and external acceptance are not closed. This session does not claim release certification, deployment or a reviewed cryptographic fix.

## Implemented

- Account issuance, renewal and exact-response recovery now recheck eligibility inside the memory/file/PostgreSQL quota mutation. Account restrictions, minor status and expired/revoked entitlements introduced after the early service check cannot consume quota or retrieve a response. The clock is read inside the mutation so waiting for a lock does not extend entitlement validity.
- Active entitlements with expired or malformed `validUntil` no longer authorize a pass. Empty expiry strings remain invalid rather than becoming perpetual grants. Account status reports expired grants as lapsed; mobile and web mint affordances independently respect expiry.
- A two-account test proved that deleting an account could revoke another account's copied public pass. The service now refuses that authority: deletion never burns an unproven bearer. Mobile/web omit passes and honestly explain that other copies remain valid through their period and grace interval. Account deletion and local secret cleanup still work. Ownership-bound voluntary revocation remains part of S2.
- The release secret-scan job now proves its configuration with positive and negative controls before scanning source. `scripts/check-meerkat-secret-scanner.mjs` detects a generated synthetic GitHub-token-shaped canary, confirms a clean fixture, validates the detector's report and cleans up owned temporary files. A deliberately disabled-default configuration is rejected. Scanner output is redacted.
- A [renewal-binding proposal](../designs/meerkat-renewal-binding-proposal-2026-09-05.md) makes the remaining protocol decision concrete. It is explicitly unreviewed and not enabled. It addresses why bare factors and unsalted commitments fail, and identifies recovery, legacy, deletion and privacy review requirements.

## Verification

| Check | Result |
|---|---|
| Final service/HTTP/atomic eligibility/key integrity/privacy wall | 71 pass, including 14 memory/file eligibility cases |
| Deletion attack control | New two-account regression fails on prior code and passes after the fix |
| Real PostgreSQL account integration | 12 pass |
| Mobile account and private-mesh isolation tests | 46 pass |
| Web account tests | 51 pass |
| Secret scanner controls | Positive and clean controls pass; disabled detectors rejected |
| Current source scans | No findings in mobile app, web source, sync source or relay source |
| Required function gate | Pass |
| Full parity | Pass |
| Generated-artifact guard | Blocked: unrelated tracked 9.50 MB `apps/meerkat/docs/reports/RESEARCH-jubilee-surrounded-argument-atlas-FULL-2026-09-02.html` exceeds the 2 MB limit |

Tests ran sequentially with one worker. The PostgreSQL fixture used a temporary owned loopback cluster and dedicated test database, both removed afterward. Scanner findings were redacted; no private credential was printed. A preliminary TypeScript run caught a test closure-narrowing error and the wrong fixture age-source label; these were corrected before final checks. A client parity check also caught and corrected a stale web deletion string. The scanner control uses a randomly generated synthetic value because upstream rules can ignore recognizable sequential fixtures. Evidence lives under ignored `.gstack/security-reports/2026-09-05-meerkat-final-local-pass/`.

## Exact remaining blockers

- S2: reviewed ownership-binding implementation for renewal and voluntary pass revocation, complete-loss/expired-period recovery policy and legacy/deleted-history transition. The proposal is not a completed fix.
- S3: trusted provider verification and persisted-state acceptance. Unsupported claims currently fail closed.
- S1/S4/S5: signed physical-device pairing, storage/export/backup/locked-device and native decoder/network acceptance. The registered iPhone was offline; the user was asked about availability.
- S6/release: run the corrected workflow on the exact committed release candidate. The local source scan is not a final native/container artifact scan. No container engine was available for that scan in this session.
- Live provider/service acceptance, final artifact scans and independent protocol/security review remain as specified in the original audit.

The artifact gate failure was logged; the unrelated research deliverable was not changed. No commit, push or deployment was performed. Prior uncommitted remediation and concurrent unrelated edits were preserved. The security audit remains NO-GO, not complete.
