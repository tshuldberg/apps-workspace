# 2026-08-28: Meerkat ITMS-90592 export-compliance fix, build 13 submitted

Apple rejected pilot build 12 with ITMS-90592 (export compliance key value [] does not match documentation).

## Root cause

`ITSAppUsesNonExemptEncryption: true` in app.json requires a matching `ITSEncryptionExportComplianceCode`, but Apple only issues codes for uploaded-documentation lanes (France declaration / CCATS). Completed the app-level App Encryption Documentation declaration in ASC (via Claude-in-Chrome on the founder's session: app purpose; standard algorithms instead of/in addition to OS crypto; France distribution: No, founder-confirmed) and Apple's flow concluded NO documents are needed, so no code exists and `true` can never deliver. `false` would falsely claim exempt encryption and skip the questionnaire (the guard test's original red flag).

## Fix (commit d15c148b)

- Removed `ITSAppUsesNonExemptEncryption` from app.json entirely: the honest, deliverable state; each build answers the ASC export questionnaire (Missing Compliance -> Manage in TestFlight).
- Updated the guard test `app-config.test.ts` to assert the key is ABSENT with the full rationale (13/13 green; function gate green).
- Corrected the pilot deployment guide (md + html twins) Step 5 export-compliance note.

## Result

Build 1.0.0 (13) built on EAS (id 3306e25d-26a2-4e1b-b4ad-d151e8e66fc0) and SUBMITTED to App Store Connect successfully (no ITMS-90592).

## Founder next actions

1. When build 13 finishes processing: TestFlight shows "Missing Compliance" -> Manage -> answer yes-uses-encryption / standard algorithms (consistent with the saved declaration).
2. Add build 13 to the B1 internal group; install via TestFlight.
3. Remember: IAP/RevenueCat still deferred, so the app stays locked past the free paths until guide Step 2 + a rebuild.

## Addendum (same day, evening)

Build 13 processed as Complete (builds 12 and 10 show Failed). Via Claude-in-Chrome on the founder's ASC session: completed the per-build export compliance questionnaire (standard algorithms in addition to OS crypto; France: No, matching the app-level declaration and the founder's confirmed choice), which flipped build 13 from Missing Compliance to Ready to Submit; then added the founder (tshuldberg999@gmail.com) as a tester to the INTERNAL group B1 (1 tester, 1 build; TestFlight invite emailed). Noted for the founder: the A1 group is EXTERNAL testing and requires Beta App Review; the internal B1 lane is the pilot path. Remaining founder action: accept the TestFlight invite on the phone and install.

## Second defect (same evening): fresh-install boot crash, root-caused and fixed

First real fresh install of build 13 crashed at launch: "no such table: sync_communities" (prepareSync). Investigation (via /investigate): the Feed tab reads `listCommunities(db)` in a render-phase useState initializer ((tabs)/index.tsx:80); React fires child renders and child effects before a parent's effect, so SyncProvider's `ensureSyncSchema` effect (SyncProvider.tsx:844), the ONLY creator of sync_/cm_ tables, always loses that race on a brand-new meerkat.db. Deterministic on any fresh install; never seen because every dev/testbed device had an existing db and builds 10/12 never delivered, so build 13 was the first true first-run.

Fix (root cause, minimal diff): `openActiveDatabase` in data/meerkat-db.ts now runs `ensureSyncSchema` synchronously right after `ensureMeerkatTables`, making full-schema existence an invariant of holding a db handle (render-order-proof; also fixes the identical latent hazard in the headless background path). All DDL is idempotent; SyncProvider's effect call remains as a no-op. dm_ tables were checked and are self-ensuring at their call sites. Regression tests: app/__tests__/fresh-install-boot.test.ts (fresh-db failure mode, exact boot sequence, source-text guard on openActiveDatabase). Build 14 rebuilt + resubmitted after the full app suite passed.

## LIVE VERIFICATION (founder device, 2026-08-28 evening)

Build 1.0.0(15) LAUNCHES CLEAN on a fresh install on the founder's iPhone 16e. This is the first live evidence that the fresh-install boot crash is actually dead; the test suite could only prove the boot sequence in isolation. The class-level fix (schema-boot.ts creating every table family at database open) is therefore confirmed on device, not just green locally.

Remaining pilot blocker at that moment was entitlement, not stability: the app correctly locked at the $4.99 gate past the free paths, so user testing could not proceed. Resolved by the temporary pilot unlock override (commit 7a2bd570, build 16), because the Paid Apps Agreement is Pending User Info (needs founder bank + W-9) and StoreKit vends no product until it is Active, making even a free sandbox purchase impossible.

## Founder-ops opened this session

- App Store Connect IAP `meerkat_app_unlock` CREATED (Apple ID 6806448603, Non-Consumable, $4.99 US base across 175 territories, English localization) via browser control.
- BLOCKED on founder: Business > Agreements needs (1) bank account, (2) U.S. Form W-9, (3) acceptance of the updated Apple Developer Program License Agreement. Until the Paid Apps Agreement is Active, no IAP (sandbox or real) can complete.
- Once Active: obtain the RevenueCat `appl_` key, wire it into the testflight profile, REMOVE the dev-unlock override, rebuild, and prove the real sandbox purchase path.
