# Meerkat Production Activation Runbook

Date: 2026-07-15

Purpose: ordered human and live-environment work required after the code-ready candidate.

Starting code candidate: `25c38e51`

Launch state: **NO-GO until every step is complete for one immutable release**

## How to use this runbook

Complete the steps in order. Do not mark a step complete because a configuration exists or a command started. Mark it complete only when its exit gate is satisfied and its evidence is stored in the release ledger.

Use this evidence directory for the selected release:

```text
docs/releases/meerkat/<release-id>/
  evidence.json
  evidence-summary.html
  artifacts/
  providers/
  devices/
  drills/
  stores/
```

Never store passwords, private keys, OAuth client secrets, provider tokens, recovery codes, private user content, or abuse material in the repository. Evidence should contain identifiers, timestamps, redacted outputs, digests, verdicts, and links to restricted systems.

Status vocabulary:

- `OPEN`: work has not started.
- `IN_PROGRESS`: an owner is actively collecting evidence.
- `PASS`: the exact exit gate passed for the selected release.
- `FAIL`: the exit gate failed. Stop promotion until resolved and rerun.
- `WAIVED`: prohibited for mandatory launch gates unless the founder and relevant legal or security owner explicitly sign a documented exception.

## Step 1: select the immutable release candidate

Owner: release owner

- [ ] Confirm the working tree is clean with `git status --short`.
- [ ] Push `fix/meerkat-plan41-audit-findings` without force.
- [ ] Open a pull request to the protected release branch.
- [ ] Require review and all repository checks.
- [ ] Merge through the protected path.
- [ ] Record the final release SHA from `git rev-parse HEAD`.
- [ ] Create a release id such as `meerkat-2026-07-15-rc1`.
- [ ] Create `docs/releases/meerkat/<release-id>/evidence.json` bound to that SHA.

Evidence:

- Release id, full SHA, branch, pull request URL, merge commit, reviewer identities, and remote CI run URLs.

Exit gate:

- The exact SHA is immutable, remotely available, protected, reviewed, and green. Any later code change creates a new release candidate and restarts affected evidence.

## Step 2: assign accountable owners and freeze launch changes

Owner: founder

- [ ] Name one owner each for release, infrastructure, security, safety, legal, privacy, billing, Apple release, Google release, support, and incident command.
- [ ] Name a primary and backup rollback decision-maker.
- [ ] Record escalation contacts and response windows.
- [ ] Start a release change freeze. Only release-blocking fixes may enter the candidate.
- [ ] Require a new SHA and rerun matrix for every accepted fix.

Evidence:

- Owner roster, approval timestamp, escalation tree, and change-freeze policy.

Exit gate:

- Every mandatory lane has an accepting human owner and backup.

## Step 3: approve and publish legal and safety policy

Owners: legal, privacy, safety

- [ ] Approve Terms of Use.
- [ ] Approve Privacy Policy and data-retention disclosures.
- [ ] Approve Community Standards and UGC moderation rules.
- [ ] Approve account deletion, appeal, safety support, law-enforcement, and contact procedures.
- [ ] Resolve encryption export classification for iOS, Android, web, and container distribution.
- [ ] Register the designated DMCA agent with the correct legal entity and contact data.
- [ ] Publish every URL over HTTPS on the production domains.
- [ ] Verify each URL from an unauthenticated browser and mobile device.
- [ ] Enter the exact production values for every `MEERKAT_DMCA_AGENT_*` field.

Evidence:

- Counsel approvals, DMCA registration reference, policy version ids, public URLs, TLS screenshots, and effective dates.

Exit gate:

- All required documents are approved, public, internally consistent, and match observed product behavior.

## Step 4: create production accounts and secure access

Owners: infrastructure, security

- [ ] Create isolated production projects for cloud, DNS, registry, PostgreSQL, object storage, KMS, monitoring, logging, backup, Apple, Google, Stripe, RevenueCat, OAuth providers, LiveKit, safety vendors, and support.
- [ ] Prohibit shared personal credentials.
- [ ] Require hardware-backed MFA for privileged users.
- [ ] Store recovery codes in the approved offline process.
- [ ] Create named service identities and least-privilege operator groups.
- [ ] Configure a two-person break-glass procedure.
- [ ] Review and record every privileged grant.

Evidence:

- Redacted account inventory, role matrix, MFA status, access-review export, and break-glass drill result.

Exit gate:

- No production system depends on a shared personal credential or an unreviewed privileged grant.

## Step 5: provision the production data and network plane

Owners: infrastructure, database, security

- [ ] Provision PostgreSQL 17 with verified TLS, automated backups, WAL archiving, HA, PITR, and monitoring.
- [ ] Provision versioned S3-compatible object storage with encryption, lifecycle policy, access logs, replication or regional recovery, and deletion controls.
- [ ] Provision DNS, certificates, edge routing, restricted operator network, metrics, logs, and alert delivery.
- [ ] Provision KMS and secret-manager custody for OAuth envelopes, storage signing, push token encryption, service TLS, database credentials, object-store credentials, and operator secrets.
- [ ] Configure retention and deletion schedules approved in Step 3.
- [ ] Confirm clocks and time sources are monitored because signed requests and nonce windows depend on time.

Evidence:

- Resource ids, regions, topology diagram, TLS reports, backup policy, object versioning, KMS key ids, monitoring links, and access boundaries.

Exit gate:

- The data and network plane meets the approved availability, privacy, retention, and recovery requirements before any application service is deployed.

## Step 6: register external providers and load secrets

Owners: infrastructure, billing, release

- [ ] Register Google Drive OAuth client and exact redirect allowlist.
- [ ] Register Dropbox OAuth client and exact redirect allowlist.
- [ ] Register Microsoft OneDrive OAuth client and exact redirect allowlist.
- [ ] Register Box OAuth client and exact redirect allowlist.
- [ ] Configure Apple iCloud containers and app entitlements.
- [ ] Configure APNs keys, FCM service account, and web VAPID keys.
- [ ] Configure LiveKit production project, TURN endpoints, webhook verification, and recording policy if recording is enabled.
- [ ] Configure Stripe, RevenueCat, App Store Connect, and Play Console products with the founder-approved identifiers and prices.
- [ ] Mount every secret through files or the approved secret manager. Do not place secrets in images, source, shell history, evidence, or plain environment dumps.
- [ ] Verify rotation ownership and expiry alerts.

Evidence:

- Provider application ids, redirect allowlists, product ids, key versions, secret mount names, owner, rotation date, and redacted provider screenshots.

Exit gate:

- Every provider is production-approved, exact identifiers match the candidate configuration, and no placeholder remains.

## Step 7: deploy the complete topology by immutable digest

Owners: release, infrastructure

- [ ] Build every service image from the selected SHA.
- [ ] Record each image digest before deployment.
- [ ] Render `packages/meerkat-relay/deploy/compose.production.yml` or the equivalent production orchestrator configuration with the approved variables.
- [ ] Deploy edge, relay, humanity, hosted, persona, push, verification-account, directory, community, LiveKit, ClamAV, archive scanner, archive seeder, and NCMEC filing worker.
- [ ] Confirm no service installs packages or downloads executable code at runtime.
- [ ] Confirm operator endpoints are reachable only from the approved network.
- [ ] Verify liveness and readiness for every service.
- [ ] Verify edge startup remains blocked when scanner, seeder, or filing dependencies are unhealthy.

Evidence:

- SHA, image digests, deployment ids, rendered service inventory, readiness output, operator-network denial proof, and dependency-failure proof.

Exit gate:

- The deployed digest set exactly matches the release manifest and every required service is healthy without fallback to file or in-memory production state.

## Step 8: run migrations and prove least privilege

Owners: database, security

- [ ] Run all migrations in order against a production-shaped staging restore first.
- [ ] Record migration checksums and durations.
- [ ] Apply production migrations during the approved maintenance window.
- [ ] Apply the generated per-service roles and grants.
- [ ] From each service identity, prove allowed operations succeed.
- [ ] From each service identity, prove prohibited cross-service and destructive operations fail.
- [ ] Verify NCMEC filing, archive lifecycle, OAuth custody, hosted storage, release, promotion, and backup evidence tables are present and constrained.

Evidence:

- Migration ledger, schema digest, role/grant export, positive tests, negative permission tests, and database readiness result.

Exit gate:

- Schema and grants match the selected SHA, every negative permission control fails as expected, and no service uses an owner or superuser connection.

## Step 9: activate malware, abuse, NCMEC, DMCA, and moderation operations

Owners: safety, legal, security

- [ ] Configure current ClamAV engine and definition versions with freshness alerts.
- [ ] Contract and configure the legally authorized abuse-hash source.
- [ ] Complete NCMEC CyberTipline or approved vendor onboarding.
- [ ] Configure the real NCMEC client and verify that `filed` is recorded only after provider acceptance.
- [ ] Verify the DMCA agent identity shown by the service matches Step 3.
- [ ] Staff moderation coverage and define backlog, escalation, and on-call thresholds.
- [ ] Test operator console authentication, network restriction, failed-auth rate limiting, alert lanes, audit records, and access revocation.
- [ ] Run synthetic malware, hash-match, CSAM escalation, credible threat, DMCA deadline, appeal, and safety-provider outage drills using lawful non-sensitive fixtures.

Evidence:

- Vendor references, engine and definitions versions, synthetic drill ids, provider acceptance id, queue timings, operator audit ids, and incident-owner sign-off.

Exit gate:

- Safety queues cannot silently pass, `filed` cannot be fabricated, operators receive and resolve alerts within the approved windows, and all drills pass.

## Step 10: prove billing, entitlement, refund, and deletion behavior

Owners: billing, release, privacy

- [ ] Purchase the one-time app unlock through Apple, Google, and Stripe where applicable.
- [ ] Purchase hosted storage through each supported billing rail.
- [ ] Restore purchases after reinstall and on a second device.
- [ ] Test cross-rail link creation, single use, expiry, replay refusal, and invalid signature.
- [ ] Test refund, cancellation, expiry, dispute, billing outage, webhook delay, and duplicate webhook behavior.
- [ ] Confirm hosted access follows authoritative entitlement state.
- [ ] Confirm account deletion remains available after entitlement lapse.
- [ ] Delete an account with local data, broker vaults, hosted objects, publications, and remote destinations. Confirm idempotent retry after an injected remote failure.
- [ ] Verification-account layer (Plan 51): sign in with Apple and Google against the live account service, mint a blind credential, then delete the verification account with SSO re-auth. Confirm the account row, entitlements, and issuance bookkeeping are gone; the client-submitted credential serial is revoked; renewal is refused; and inner-layer data is untouched. Repeat the deletion without the device present and confirm the outstanding credential is honestly reported as expiring at epoch end, never falsely reported as revoked.
- [ ] Run the AC-2 wall guard expectations against the production schema: no credential serial and no persona or device identifier exists anywhere in the account service database. Capture the output.

Evidence:

- Redacted transaction ids, entitlement states, webhook ids, refund results, deletion job ids, final zero-inventory proof, and privacy-owner approval.
- Account-layer deletion evidence: redacted account id, deletion response with deletionScope account_layer_only, revocation-list entry for the client-submitted serial (serial only, no account field), refused-renewal proof, and the AC-2 wall-guard output.

Exit gate:

- All supported billing rails agree, failure states are honest, replay is refused, and deletion finishes without requiring an active subscription. Verification-account deletion works with entitlement lapsed, revokes what the client submits, states honestly what it cannot reach, and leaves the inner layer untouched.

## Step 11: execute the complete Plan 41 provider matrix

Owners: QA, release

Run each supported destination through authorize, write, read-back verification, list, quota, resume, revoke, credential rotation, backup, restore, move, delete, and reconnect.

- [ ] Local destination on iOS.
- [ ] Local destination on Android.
- [ ] Browser local destination with persistence granted and denied.
- [ ] iCloud Drive in a signed iOS build.
- [ ] iOS Files provider.
- [ ] Android Storage Access Framework.
- [ ] Google Drive.
- [ ] Dropbox.
- [ ] OneDrive.
- [ ] Box.
- [ ] WebDAV over trusted HTTPS.
- [ ] S3-compatible storage with versioning.
- [ ] Meerkat hosted storage.
- [ ] Signed connected server.
- [ ] Fresh-install restore of database, blobs, and identity on mobile.
- [ ] Fresh-browser restore of database, blobs, and identity on web.
- [ ] Corruption, wrong key, torn journal, quota, provider outage, lost response, and interrupted-move cases.

Evidence:

- Provider, platform, app build id, test account id, operation results, backup manifest id, byte/hash comparison, restored identity fingerprint, and cleanup confirmation.

Exit gate:

- Every applicable cell passes. Unsupported platform cells must show the intended unavailable state, not a simulated success.

## Step 12: execute calls, rooms, push, mesh, and background device matrices

Owners: QA, mobile, infrastructure

- [ ] Direct audio and video calls on iOS to iOS, Android to Android, and iOS to Android.
- [ ] Community rooms on mobile and web with LiveKit and TURN fallback.
- [ ] Incoming call behavior in foreground, background, locked, and terminated states.
- [ ] CallKit, PushKit, Android Telecom, microphone, camera, Bluetooth audio, interruption, handoff, and permission-denied cases.
- [ ] APNs, FCM, and VAPID provider acceptance and actual wake.
- [ ] LAN Bonjour, Android DNS-SD/Wi-Fi Direct, BLE wake-only, WebRTC, encrypted relay fallback, and ranked-choice negotiation.
- [ ] Radio off, network change, captive portal, reboot, revoked permission, token rotation, member removal, device revocation, and stale epoch cases.
- [ ] Verify BLE never transports application payload data.

Evidence:

- Device models, OS versions, signed build ids, network path, transport diagnostic output, call ids, provider attempt ids, screenshots or recordings, and pass/fail matrix.

Exit gate:

- Required physical-device cells pass with real media, real wake, real transport selection, and no fabricated completion state.

## Step 13: prove backup, PITR, restore, failover, and regional recovery

Owners: database, infrastructure, release

- [ ] Produce a production backup and record its source id and timestamp.
- [ ] Restore it into an isolated environment that is not the production database.
- [ ] Compare schema and semantic digests.
- [ ] Run application smoke tests against the restore.
- [ ] Execute a PITR restore to an exact timestamp.
- [ ] Fail over PostgreSQL and verify application recovery.
- [ ] Simulate object-store regional loss and recover from the approved path.
- [ ] Rotate database, KMS, storage, OAuth, push, and service credentials.
- [ ] Prove backups continue and old credentials stop working.

Evidence:

- Backup id, timestamps, restore target, digest comparison, recovery time, recovery point, failover logs, rotation versions, and signed drill verdicts.

Exit gate:

- Restore, PITR, failover, regional recovery, and rotation meet the approved RPO and RTO with no data-authority ambiguity.

## Step 14: verify supply chain and signed artifacts

Owners: release, security

- [ ] Build mobile, web, and container artifacts from the immutable SHA in remote CI.
- [ ] Generate SBOMs.
- [ ] Run blocking dependency, image, license, and secret scans.
- [ ] Generate provenance and sign every artifact.
- [ ] Verify signatures using the pinned CI identity.
- [ ] Confirm the staged and canary digests equal the release manifest.
- [ ] Confirm no mutable tag is used as release evidence.

Evidence:

- CI URLs, build ids, artifact hashes, image digests, SBOM hashes, scan verdicts, provenance references, signature verification, and manifest.

Exit gate:

- Every distributed artifact is reproducibly tied to the selected SHA and passes the blocking security policy.

## Step 15: run production-shaped browser, load, soak, canary, and rollback

Owners: performance, infrastructure, release

- [ ] Deploy the web artifact behind production TLS with the production content-security policy.
- [ ] Run the browser launch suite against real hosted and relay URLs.
- [ ] Measure initial load, interaction latency, and the large sync, LiveKit, and app chunks on supported desktop and mobile browsers.
- [ ] Run 10x expected launch load with published latency, error, saturation, and queue budgets.
- [ ] Run a 48-hour soak with alerts active.
- [ ] Verify no unbounded memory, socket, database, object, retry, moderation, archive, push, or NCMEC queue growth.
- [ ] Promote the same digests to canary.
- [ ] Hold canary for the approved duration.
- [ ] Execute rollback to the recorded compatible target and verify recovery.

Evidence:

- Browser report, performance traces, load report, soak report, SLO dashboard, canary record, alert history, rollback command reference, and post-rollback health.

Exit gate:

- Budgets pass, no unbounded growth exists, canary remains healthy, and rollback succeeds with the documented target.

## Step 16: complete store compliance and submit exact builds

Owners: Apple release, Google release, legal, privacy

- [ ] Complete App Privacy and Google Data Safety from observed behavior.
- [ ] Complete UGC, moderation, account deletion, encryption, background mode, push, camera, microphone, local network, nearby devices, and file-access declarations.
- [ ] Enter the approved legal, support, privacy, and deletion URLs.
- [ ] Capture screenshots and metadata from the exact signed candidates.
- [ ] Verify product ids and review accounts.
- [ ] Submit iOS and Android builds produced from the selected SHA.
- [ ] Record review questions, responses, approvals, and any required resubmission SHA.

Evidence:

- Store build ids, declaration exports, screenshots, metadata version, submission ids, review correspondence, and approval status.

Exit gate:

- Both stores approve the exact release artifacts and all declarations match real behavior.

## Step 17: assemble the immutable evidence ledger and rerun the final audit

Owner: release owner

- [ ] Confirm every prior step links evidence in `evidence.json`.
- [ ] Confirm all evidence references the same SHA, digest set, build ids, and configuration version.
- [ ] Confirm secrets and private content are absent.
- [ ] Render `evidence-summary.html` for human review.
- [ ] Rerun the production-readiness and adversarial audits against the immutable manifest.
- [ ] Close every finding or record a signed mandatory exception.
- [ ] Verify all SLO, safety, backup, billing, provider, and store dashboards are green.

Evidence:

- Final evidence ledger, HTML summary, final audit, exception register, and dashboard snapshot references.

Exit gate:

- The ledger is complete, internally consistent, reviewable, and contains no open mandatory finding.

## Step 18: sign GO and activate public availability

Owners: founder, release, security, safety, legal, incident command

- [ ] Hold the final GO review using the evidence ledger.
- [ ] Confirm the exact SHA, artifact digests, app build ids, migration version, canary, and rollback target.
- [ ] Confirm named incident and rollback owners are on duty.
- [ ] Record GO signatures and timestamp.
- [ ] Enable public availability in the approved sequence.
- [ ] Watch SLO, safety, billing, provider, store, and support signals continuously through the launch window.
- [ ] Roll back immediately if an automatic NO-GO condition appears.

Evidence:

- Signed GO record, activation timestamps, duty roster, dashboard references, and launch-window incident log.

Exit gate:

- Public launch is active only for the exact approved artifact set, with owners monitoring and a proven rollback path ready.

## Automatic stop conditions

Stop promotion and return the affected step to `FAIL` if any of these occurs:

- The release SHA or artifact digest changes.
- Remote CI is missing, red, or bypassed.
- A service uses an in-memory or file authority in first-party production.
- A migration, role, signature, provenance, scan, readiness, or negative control fails.
- Provider, device, restore, deletion, safety, billing, push, or store evidence is missing.
- An unsigned or mutable artifact reaches staging, canary, or a store.
- A backup has no successful restore proof.
- A safety queue can silently pass or an NCMEC record can be marked filed without provider acceptance.
- A load or soak budget fails, growth is unbounded, or an SLO remains active.
- Rollback is unavailable, incompatible, or untested.
- Product, store, legal, or release claims exceed the evidence.
- No named human owns the incident and rollback decision.
