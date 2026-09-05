# Meerkat Full Production Readiness Audit

Date: 2026-07-15

Code candidate: `25c38e51`

Primary remediation commit: `234d7492`

Branch: `fix/meerkat-plan41-audit-findings`

Production release decision: **NO-GO pending live and founder-operated evidence**

Code decision: **PASS for every codable blocker identified by the prior version of this report**

## Executive verdict

The prior version of this report was materially stale. It evaluated candidate `6b70b994` and said Plan 25 was absent, Plan 43 was incomplete, Plan 40 residuals remained, and the production topology did not compose the managed archive and storage services. Those claims are no longer true on the reviewed candidate.

The complete Plan 41 storage system is integrated. Plan 25 direct calls and rooms and the Plan 40 closures are integrated through `b0aaf0dd`. Plan 43 product wiring is integrated through `da314310`. The production topology now composes the OAuth broker, signed storage descriptor, archive intake, ClamAV scanning, seeding, NCMEC filing, registered DMCA identity, least-privilege database roles, and readiness dependencies. The additional audit remediation in `234d7492` closes managed-archive authorization, signed-manifest, quota, replay, atomic-router, restore-activation, identity-recovery, browser database, and native iCloud proof gaps. Browser QA then found and closed a loopback-only Storage & Backup crash in `25c38e51` without weakening the production HTTPS boundary.

Local code and packaging are ready to become a release candidate. Public production launch is still a NO-GO because the exact candidate has not been pushed through remote CI, deployed by immutable digest, exercised against live providers and physical devices, signed for the stores, or backed by the required legal, safety, billing, load, soak, canary, restore, and rollback evidence.

## Decision model

| Layer | Verdict | Meaning |
|---|---|---|
| Product and runtime code | PASS | All code blockers named in the superseded report are present and locally verified. |
| Security remediation | PASS | The reviewed attack paths have regression coverage and pass. |
| Production topology as code | PASS | The complete first-party service graph renders and has topology tests. |
| Local automated verification | PASS | 6,313 unit/integration tests plus browser launch paths pass. |
| Live infrastructure and providers | OPEN | Requires real accounts, credentials, deployments, devices, and evidence. |
| Legal, safety, billing, and stores | OPEN | Requires founder, counsel, vendor, and store actions. |
| Public launch | NO-GO | The open live-evidence layers are mandatory release gates. |

## What changed from the stale snapshot

| Prior claim | Verified current state | Evidence |
|---|---|---|
| Plan 25 calls and rooms were absent | Direct calls, community rooms, LiveKit, TURN policy, native CallKit/PushKit and Android Telecom bridges, call history, and mobile/web UX are integrated. | Merge `b0aaf0dd`; full mobile, web, sync, and relay suites pass. |
| Plan 43 was incomplete | Managed archive status UI, automatic sealed-history lifecycle, operator alert lanes, worker composition, and the final proof target are integrated. | `da314310`; `pnpm test:meerkat-plan43-proof` passes 182 tests. |
| Plan 40 Share Inbox DM and fake-client residuals remained | Share Inbox DM routing is present, retired no-op clients are removed, and push registration has a by-hash getter. | Merge `b0aaf0dd`; mobile/web suites and parity checks pass. |
| Production Compose was stale | The topology now includes OAuth KMS/provider secrets, signed storage, archive workers, ClamAV, NCMEC, DMCA configuration, health gates, and scoped database roles. | `compose.production.yml`; production-topology tests; Compose config rendering passes. |
| Restore activation was insufficient | Mobile and web restore now verify and activate database, blobs, and recovered identity with rollback and torn-journal recovery. | `234d7492`; focused restore tests and full app suites pass. |
| Router truth could split across writes | Router verification, backup, and terminal job state now checkpoint atomically with startup reconciliation. | `234d7492`; injected fault and restart tests pass. |

## Codable findings closed in this audit

### Managed archive and entitlement security

- Hosted entitlements are bound to the authenticated subject. A valid token cannot be shared across owners.
- Archive requests bind method, path, timestamp, nonce, and body digest. A proof cannot be replayed across methods or mutations.
- Nonces are replay-protected and dynamic archive paths share normalized rate-limit buckets.
- Publication approval is resolved authoritatively before intake. Caller-supplied status cannot promote an archive.
- The archive protocol signs the ordered object manifest and root. Intake validates exact object names, byte lengths, and SHA-256 object digests.
- Owner authorization covers create, upload, complete, status, cancel, takedown, and delete boundaries.
- File and PostgreSQL quota reservations are atomic under concurrency.
- Quarantine object keys are hash-qualified, preventing same-name cross-publication collisions.
- Account deletion remains available after entitlement lapse through retained account-store authority.

### Safety and operator plane

- ClamD streaming is bounded and fails closed on protocol errors, size violations, and signature changes during a scan.
- NCMEC responses are bounded and remote text is normalized to stable safe error codes.
- The NCMEC migration preserves a single authoritative filing row and has migration regressions.
- The production topology composes scanner, seeder, and filing workers behind readiness gates.
- Operator console access is network restricted and failed authentication is rate limited.
- DMCA first-party startup validates registered-agent fields and rejects placeholders.

### Storage, backup, and restore

- Router checkpoints commit dependent verification, backup, and job truth atomically.
- Startup reconciliation repairs legacy split state without inventing success.
- Mobile restore uses rotating checksummed journal slots, falls back from a torn newest slot, and rolls back SQLite main, WAL, SHM, and objects idempotently.
- Web restore verifies every object and commits database and blob activation in one IndexedDB transaction.
- Recovered identity is injected deterministically, stored only after verification, and restored to the sync identity tables and secure store.
- IndexedDB open rejects blocked upgrades, closes on version changes, and evicts stale cached handles.
- The iCloud package contains a real Swift native module, podspec, app plugin proof, source parsing, and iOS 15.1 type checking.
- Broker reconnect, schedulers, backup inventory, and restore activation have direct regression tests.

### Browser QA closure

- The launch harness now supplies an explicit loopback hosted API origin so positive and forged-cache entitlement tests exercise the real fetch boundary.
- Storage credential brokers permit HTTP only for loopback hosts in Vite development mode. Production remains HTTPS-only.
- Storage & Backup opens from Settings, renders its honest empty state, opens the destination list, and emits no console warning or error.
- Share Inbox opens and shows the device-local staging boundary with no console warning or error.

## Verification reproduced on the current candidate

| Verification | Result |
|---|---|
| `@mylife/sync` full suite | 192 files passed; 2,372 tests passed; 3 environment cases skipped. Warning-traced rerun is clean. |
| `@mylife/meerkat-relay` full suite | 195 files passed; 1,508 tests passed; 184 live-environment cases skipped. |
| `@mylife/meerkat-app` full suite | 137 files and 1,375 tests passed. |
| `@mylife/meerkat-web` full suite | 131 files and 970 tests passed. |
| `@mylife/meerkat-icloud-storage` | 3 files and 11 tests passed; lint and typecheck pass. |
| `@mylife/entitlements` | 7 files and 77 tests passed; 97.92% statement coverage. |
| Combined package suites | 665 files and 6,313 tests passed. |
| Browser launch paths | 6 passed; the real-relay case skipped honestly because no live relay URL was provided. |
| Plan 43 proof target | 182 tests passed across relay and sync. |
| Function-quality gates | Passed for the full remediation and the browser QA follow-up, including consumer typechecks. |
| Mobile production export | iOS and Android exports passed. |
| Web production build | Passed, 509 modules transformed. |
| Sync package build | Passed. |
| Production Compose rendering | Passed with all required variables represented. |
| Meerkat transport negative controls | Passed. |
| Meerkat parity and full workspace parity | Passed. |
| Generated-artifact guard | Passed. |
| `git diff --check` | Passed before both code commits. |

The web build still reports advisory chunk-size notices for the application, sync, and LiveKit bundles and the standard sql.js browser externalization notices. The build completes and browser launch paths pass. These notices are performance-optimization inputs, not evidence of a functional release failure. Production performance must still be measured under the load and browser budgets in the activation runbook.

## What local verification does not prove

The following skipped or unavailable cases are deliberately not relabeled as passing:

- PostgreSQL and S3 integration suites that require live isolated services.
- A production relay handshake in the browser launch suite.
- Real OAuth provider authorization and revocation.
- Signed iOS and Android builds on physical hardware.
- APNs, FCM, VAPID, LiveKit, TURN, nearby radios, background wake, and terminated-state behavior.
- Live ClamAV definition updates, licensed abuse-hash data, and NCMEC provider acceptance.
- Production migrations, backup, PITR, failover, restore, load, soak, canary, and rollback.
- Store review, export compliance, privacy declarations, legal publication, and operational staffing.

## Remaining release blockers are non-code or live-evidence tasks

### Exact release and remote CI

- The candidate exists only on the local branch. It has not been pushed, reviewed, merged through the protected release path, or tied to remote CI evidence.
- No immutable app build ids, container digests, signed release manifest, SBOM, provenance, vulnerability verdict, canary record, or rollback record is attached.

### Production infrastructure

- No live PostgreSQL 17, S3-compatible object storage, KMS, DNS, TLS, monitoring, alerting, backup, PITR, regional recovery, or restricted operator network evidence is attached.
- Migrations and least-privilege roles have not been exercised against the production database.

### Providers and hardware

- Google Drive, Dropbox, OneDrive, Box, WebDAV, S3, iCloud, Files, SAF, hosted storage, and connected-server matrices require real accounts and devices.
- Calls, rooms, TURN, push, nearby transports, background execution, reboot, permission loss, and radio-off cases require physical-device proof.

### Safety, legal, billing, and stores

- Licensed abuse-hash access, current ClamAV definitions, NCMEC onboarding, DMCA registration, moderation staffing, and incident drills require real organizations and vendors.
- Terms, Privacy Policy, Community Standards, deletion, support, and appeals URLs require approval and publication.
- Apple, Google, RevenueCat, Stripe, APNs, FCM, VAPID, OAuth, and LiveKit accounts and credentials require owner action.
- Export classification, privacy labels, Data Safety, UGC declarations, screenshots, submissions, and store approvals remain open.

### Operational proof

- A production-shaped restore, 10x launch-load run, 48-hour soak, canary hold, failover drill, secret rotation, queue-backlog drill, and rollback rehearsal are not yet evidenced.
- No final evidence ledger or release-owner GO signature exists for an immutable candidate.

## Release rule

Do not turn public availability on until every item in `docs/guides/meerkat-production-activation-runbook-2026-07-15.html` is complete and linked to evidence for one immutable release SHA and artifact set.

Automatic NO-GO conditions include any red remote check, unsigned or mutable artifact, missing restore proof, missing provider/device matrix, absent safety or legal operation, unproven billing or deletion flow, active SLO or safety alert, failed load or soak budget, untested rollback target, or claim that exceeds recorded evidence.

## Final assessment

Meerkat's reviewed code candidate is locally code-ready. Every codable blocker stated in the superseded readiness report is resolved and regression-tested. The production launch remains **NO-GO** because live deployment, provider, device, safety, legal, billing, store, and operational evidence cannot be produced by source changes alone.
