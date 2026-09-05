# Meerkat Blackglass Production Adversarial Audit

Date: 2026-07-09  
Release decision: **NO-GO**  
Audited branch: `feature/meerkat-production-readiness-2026-07-09`  
Remediated code commit: `47f452d3e185d418b71e87bdc2ecd0487b8af73f`

## Executive ruling

Meerkat is materially safer and more deployable than it was at the start of this audit, but it is not ready for a public production release.

The bounded security and production-wiring defects found in the existing implementation were repaired and committed. The repaired tree passes 4,397 Meerkat tests, 267 Car tests, 90 module-registry tests, six relevant typechecks, six zero-warning lint runs, a six-case real-relay browser suite, iOS and Android Expo exports, a web production build, Expo Doctor, parity gates, dependency audit, production environment validation, Docker Compose validation, and constrained container smoke tests.

That evidence does not erase the launch contract. Plans 25 and 41 remain unimplemented product programs, and the audit also confirmed launch-hard native transport, push/background, managed archive/history/safety, durable production state, recovery, observability, and supply-chain work now owned by Plans 42 through 44. Physical transport, provider, purchase, store, and moderation operations also remain unproven. Shipping the current commit would therefore violate the founder mandate and the explicit Plan 40 close criteria.

### Readiness scores

| Dimension | Score | Ruling |
|---|---:|---|
| Existing implemented code paths | 86 / 100 | Substantially hardened |
| Security controls in the remediated paths | 88 / 100 | Strong local evidence, live-provider evidence pending |
| Deployability of the first-party service topology | 82 / 100 | Images and compose boot locally, production infrastructure absent |
| Full promised product completeness | 56 / 100 | Launch-hard calls/rooms and storage destinations incomplete |
| Actual public release readiness | 63 / 100 | **NO-GO** |

The 63 score is intentionally lower than the code score. A production release is the product, its infrastructure, its third parties, its policies, its operators, its backups, and its physical-device behavior together.

## What was audited

The review covered the mobile app, web app, `@mylife/sync`, the relay and HTTP services, entitlements, build and release configuration, CI, Docker topology, UGC safety and legal surfaces, deletion and export, billing state, hosted storage ingest, dependency state, current launch plans, recent commits, and the untrusted handoff supplied by the user.

The audit used source inspection, commit and diff review, adversarial tests, proof scripts, full suites, production builds, native exports, source-service boots, real WebSocket relay tests, container builds, constrained container runs, dependency audit, parity checks, and an independent adversarial challenge pass. No claim from an earlier session was accepted without repository or executable evidence.

## Untrusted handoff and recent-commit comparison

The supplied handoff was:

`file:///Users/trey/Documents/Codex/2026-07-09/do-a/outputs/meerkat-humanity-token-fix-handoff-2026-07-09.html`

| Source | Verified result | Audit effect |
|---|---|---|
| Humanity-token handoff | The narrow behavior is correct. Commit `e811672c2bc9f52fbe2904a56bad46e0802daaad` preserves a humanity token when a request is rejected by the explicitly pre-redemption per-IP limiter. | Accepted only for that narrow defect. It did not prove general production readiness. |
| Hosted purchase follow-up | Commit `f01c67437ded4164b11534ad7d8a1e4053f344a3` added authenticated, signed hosted purchase linking. | Closed the immediate device-signed bearer mismatch but exposed adjacent cross-rail and lifecycle requirements that were independently repaired. |
| This remediation | Commit `47f452d3e185d418b71e87bdc2ecd0487b8af73f` changes 196 files with 6,025 insertions and 1,773 deletions. | Closes the bounded production defects described below and adds executable regression evidence. |

The prior handoff was useful evidence, not a trusted verdict. Its narrow token claim survived verification. Any broader implication that the app had become production-ready did not.

## Delta from the first audit snapshot

The initial report counted 7 critical, 12 high, and 7 medium findings on the earlier snapshot. All seven original critical defects in the implemented paths were repaired. The high-risk billing, deletion, CORS, environment, container, CI, Terms, storage-ingest, concurrency, and rate-limit defects that were bounded enough to repair in this audit were also closed.

This changes the nature of the NO-GO decision. The largest remaining problems are no longer simple exploitable defects in already-wired code. They are missing launch-hard product programs, live infrastructure and external-service setup, physical-device proof, operating procedures, legal publication, and trust-and-safety operations.

## Planning reconciliation completed on 2026-07-09

The earlier audit correctly identified the missing code, but the plan set was not
complete enough to own every blocker. That planning gap is now closed in commit work
after `a7112731`:

| Plan | Production scope now owned |
|---|---|
| `docs/plans/queue/25-meerkat-calls-and-rooms.md` | Direct P2P calls, self-hosted LiveKit rooms, PushKit/CallKit, Android Telecom, screen share, recording, moderation, and physical media proof. |
| `docs/plans/queue/41-meerkat-storage-destinations.md` | Versioned encrypted backup, destination router, iCloud, Google Drive, Dropbox, OneDrive, Box, file providers, WebDAV, S3, hosted and connected storage, OAuth custody, migration, and atomic restore. |
| `docs/plans/queue/42-meerkat-native-transport-push-background.md` | Owned iOS/Android Nearby and BLE native module, APNs/FCM/Web Push gateway, module-scope background tasks, token rotation, and real-device evidence. |
| `docs/plans/queue/43-meerkat-managed-archive-seeding-safety.md` | Durable archive intake, quarantine, scanning, pinning, public announcement, automatic history, hosted seeding, NCMEC filing, and DMCA runtime configuration. |
| `docs/plans/queue/44-meerkat-production-state-observability-release-supply-chain.md` | PostgreSQL state, object storage, multi-instance safety, backup and restore, SLOs, signed images, SBOM, provenance, canary, and rollback. |
| `docs/plans/queue/40-meerkat-final-launch-plan.md` | Master coverage map, Share Inbox DM routing, exported stub removal, truth reconciliation, founder runbook, evidence ledger, and final GO gate. |

This is a planning result, not blocker closure. The release decision remains NO-GO
until the plans are implemented and their exact evidence requirements pass.

## Remediation completed and committed

### Access, billing, and entitlement integrity

- Centralized the app-unlock policy on mobile and web so paid private features cannot bypass the gate through a route or overlay.
- Revalidates mobile purchase state at boot instead of trusting a stale local unlock forever.
- Uses device-bound RevenueCat customer identities instead of a shared or guessable customer identifier.
- Replaced forgeable web `localStorage` unlock authority with authenticated server grants and signature validation.
- Added cross-rail linking with device-signed authentication and server-issued grants.
- Added refund, expiration, and dispute relock behavior.
- Added Stripe event ordering and idempotency protections so an older event cannot resurrect a newer inactive purchase.
- Made production build validation reject missing launch-critical variables.

Primary evidence: `apps/meerkat/app/(root)/data/app-access-policy.ts`, `apps/meerkat-web/src/lib/app-access-policy.ts`, `apps/meerkat-web/src/lib/hosted-access.ts`, `packages/meerkat-relay/src/hosted-api.ts`, and `packages/meerkat-relay/src/hosted-billing-stripe.ts`.

### Deletion, export, and privacy integrity

- Routed deployed persona deletion through the complete GDPR topology.
- Added an in-flight write barrier so a concurrent write cannot survive deletion or repopulate deleted state.
- Deletion now waits for and verifies raw byte removal before deleting the only keys that can authenticate remote cleanup.
- Mobile and web blob stores gained verified deletion behavior.
- Persona deletion fails closed when complete removal cannot be proved.

Primary evidence: `packages/meerkat-relay/src/gdpr-deletion.ts`, `packages/meerkat-relay/src/persona-service-http.ts`, `apps/meerkat/app/(root)/data/delete-account-core.ts`, and `apps/meerkat-web/src/lib/delete-account-core.ts`.

### Hosted APIs, storage ingest, and service resilience

- Replaced permissive credentialed CORS behavior with strict configured-origin handling.
- Kept only the bounded, credential-free relay health endpoint public across origins.
- Added trusted-proxy-hop handling and bounded memory to hosted rate limiting.
- Added per-storage-path rate limits and tenant caps.
- Added safe upload path construction, traversal rejection, cryptographic hash verification, resumable block tracking, and durable ingest state.
- Mounted storage on persistent volumes in the production topology.
- Added stale-file-lease recovery and serialized durable writes across billing, public-post, moderation, and ingest files.
- Added startup rejection for an empty or invalid abuse-hash input rather than silently running an ineffective scanner.

Primary evidence: `packages/meerkat-relay/src/hosted-rate-limiter.ts`, `packages/meerkat-relay/src/storage-ingest.ts`, `packages/meerkat-relay/src/storage-ingest-store-file.ts`, `packages/meerkat-relay/src/file-lock.ts`, and `packages/meerkat-relay/bin/meerkat-community-node.mjs`.

### UGC, legal, and client honesty

- Added visible Terms, privacy, community-guideline, reporting, and block-user surfaces.
- Added server-enforced Terms-version acceptance for public posting rather than a client-only checkbox.
- Ensured unavailable services and transports remain visibly unavailable instead of being inferred from queued or cached state.
- Split the web production bundle into stable chunks to reduce the original oversized single bundle.

Primary evidence: `apps/meerkat-web/src/ui/settings/LegalSafetySection.tsx`, `apps/meerkat/app/(root)/data/public-safety.ts`, `apps/meerkat-web/src/lib/public-safety.ts`, `packages/sync/src/protocol/public-post.ts`, and `apps/meerkat-web/vite.config.ts`.

### Release, CI, and runtime packaging

- Added a production multi-service Compose topology and Caddy TLS edge configuration.
- Added a self-contained platform Docker image that installs production dependencies during build and performs no runtime package download.
- Corrected CommonJS/ESM import compatibility and runtime React package requirements discovered by actual image boots.
- Added real Meerkat browser E2E to CI, including an actual app-visible relay status assertion and a forged-cache regression.
- Added platform-image build and boot checks.
- Pinned third-party GitHub Actions to immutable commits.
- Aligned Expo and native dependencies. Expo Doctor now passes all 18 checks.

Primary evidence: `packages/meerkat-relay/Dockerfile.platform`, `packages/meerkat-relay/deploy/compose.production.yml`, `packages/meerkat-relay/deploy/Caddyfile.production`, `.github/workflows/ci.yml`, and `apps/meerkat-web/e2e/launch-paths.spec.ts`.

## Independent adversarial challenge results

An independent challenge pass produced 12 findings after the initial repair wave. Each was rechecked and closed in the committed tree.

| Challenge finding | Final state | Closure proof |
|---|---|---|
| Hosted relay/community services omitted entitlement enforcement | Closed | Production entrypoints require and validate hosted entitlements. |
| Browser unlock could be forged through local storage | Closed | Signed grant is required and forged cache remains locked in browser E2E. |
| Mobile refund was not revalidated at boot | Closed | Boot policy now revalidates provider state and relocks inactive purchases. |
| Stripe disputes did not relock access | Closed | Dispute events map to inactive state with ordering protection. |
| GDPR deletion raced concurrent writes | Closed | Coordinator barrier blocks and drains writes before destructive cleanup. |
| SecureStore deletion failures were suppressed | Closed | Verified key deletion fails closed and is regression-tested. |
| File lock could survive a dead process forever | Closed | Lease metadata and stale-lock recovery are bounded and tested. |
| Proxy IP parsing made limits spoofable | Closed | Only configured trusted proxy hops influence the client key. |
| Hosted upload storage was not persistent in deployment | Closed | Named volume and read-only container topology verified by Compose and image smoke. |
| Terms acceptance existed only in the client | Closed | Public submit protocol and service enforce the signed current version. |
| Empty abuse-hash file started as if protected | Closed | Community entrypoint exits fatally on empty or malformed production input. |
| E2E asserted a raw socket, not app behavior | Closed | Playwright now observes the real app connection status against a live relay. |

## Verification ledger

### Automated suites

| Target | Result |
|---|---:|
| `@mylife/meerkat-app` | 1,145 / 1,145 tests passed |
| `@mylife/meerkat-web` | 753 / 753 tests passed |
| `@mylife/meerkat-relay` | 608 / 608 tests passed |
| `@mylife/sync` | 1,814 / 1,814 tests passed |
| `@mylife/entitlements` | 77 / 77 tests passed, 97.9% line coverage |
| Meerkat subtotal | **4,397 / 4,397 tests passed** |
| `@mylife/car` regression suite | 267 / 267 tests passed |
| Module registry | 90 / 90 tests passed |
| Real-relay Playwright | 6 / 6 tests passed |

The first parallel full sync run exposed one timing-sensitive remote-store slope test. The isolated rerun passed, and the complete sync suite then passed 1,814 / 1,814 when rerun alone. The known timing-flake ledger entry remains useful and was not hidden.

### Static, build, dependency, and release gates

- Mobile, web, relay, sync, entitlements, and module-registry typechecks passed.
- Mobile, web, relay, sync, entitlements, and module-registry lint passed with zero warnings.
- `pnpm gate:function:changed` passed manually and through the pre-commit hook.
- `pnpm check:meerkat-parity` passed.
- Full `pnpm check:parity` passed.
- `pnpm check:generated-artifacts` passed.
- `pnpm audit --prod --audit-level=high` found no known production vulnerability at or above the requested threshold.
- Web production build passed.
- iOS and Android Expo exports passed, about 11 MB each.
- Expo Doctor 1.20.0 passed 18 / 18 checks.
- Production environment guard passed with a complete non-secret test configuration and rejects incomplete production configuration in tests.
- Production Compose configuration passed with every required variable supplied by test values.

### Runtime and container proof

- Hosted service source entrypoint booted and returned healthy.
- Relay source entrypoint rejected a tokenless connection when hosted entitlement enforcement was enabled.
- Community source entrypoint exited with `abuse_hash_file_invalid` when given an empty abuse-hash input.
- Slim relay image built as `meerkat-relay:audit-47f452d3`.
- Exact platform image built as `meerkat-platform:audit-47f452d3`.
- Exact platform image ran as a non-root, read-only container with dropped capabilities and tmpfs state, then returned `{"ok":true}` from `/healthz`.
- Platform log reported the expected local URL, data directory, and RevenueCat receipt-validation mode without secret material.

## Remaining release blockers

These blockers are not closed by the remediation commit. They must remain visible in any release decision.

### B-01: Plan 25 calls and rooms is not implemented

Severity: **Critical**  
Owner: product and engineering  
Release effect: hard stop

`docs/plans/queue/25-meerkat-calls-and-rooms.md` explicitly says `NOT STARTED, BUILDABLE`. The repository does not contain the required call-signal protocol, media-session adapter, SFU client/server, voice/video call UI, room UI, screen sharing, closed-app ring path, or call moderation evidence. The existing WebRTC code transports data, not media. Plan 40 AC-40.14 and AC-40.15 forbid launch while this is merely planned.

Closure requires the entire Plan 25 implementation, automated live-relay and SFU proof, cross-network TURN traversal, real voice/video, a multi-party room, permissions and reconnect states, honest E2E-versus-SFU disclosure, and physical-device evidence.

### B-02: Plan 41 user-selected storage destinations is not implemented

Severity: **Critical**  
Owner: product and engineering  
Release effect: hard stop

`docs/plans/queue/41-meerkat-storage-destinations.md` explicitly records that no unified destination router, destination schema, iCloud adapter, Google Drive adapter, storage-health UI, migration flow, or restore-from-selected-storage flow exists. The audit hardened the hosted upload service, but that is not the promised retail storage product. Plan 40 AC-40.16 and AC-40.17 forbid launch while iCloud Drive and Google Drive remain documentation only.

Closure requires the full provider-neutral router, encrypted object and backup contracts, local destination, iCloud Drive, Google Drive, generic file-provider, WebDAV/S3, hosted and connected-server adapters, health/quota evidence, migration, cancel/resume, read-back verification, restore, disconnect, tests, and provider/device QA.

### B-03: Native transport and scheduled-background proof is incomplete

Severity: **Critical**  
Owner: engineering and release operations  
Release effect: hard stop for the advertised transport promise

Nearby and BLE wake depend on real native bridges and custom builds. Scheduled background sync is best-effort OS behavior and remains off by default until a dev build proves it. Local unit tests cannot certify discovery, Android Wi-Fi Direct behavior, BLE wake, iOS suspension timing, Android background restrictions, or two-device mailbox convergence.

Closure requires real iOS and Android builds and the physical-device matrix in the runbook below. A failed rung must remain unavailable in product copy until fixed.

### B-04: No real production infrastructure has been provisioned

Severity: **Critical**  
Owner: founder and infrastructure operations  
Release effect: hard stop

The repository now has deployable service definitions, but this audit did not create production cloud accounts, DNS, TLS certificates, secret-manager entries, provider webhooks, TURN, the Commons publication, public nodes, monitoring, or a 48-hour soak. Local container health is not evidence of public availability.

### B-05: Durable state is single-host, not highly available

Severity: **High**  
Owner: infrastructure and data engineering  
Release effect: hard stop for a public service without an accepted single-host risk posture

File leases and named volumes make the current topology safe for one active writer per durable store. They do not provide multi-replica consensus, automatic failover, point-in-time recovery, or independently tested restoration. Before scale-out, migrate shared service state to a transactional database or enforce a documented single-writer topology with tested backups and recovery objectives.

### B-06: Trust and safety operations are not live

Severity: **Critical**  
Owner: founder, legal, and safety operations  
Release effect: hard stop for public UGC

The code fails closed when its abuse-hash source is absent, records moderation evidence, and supports legal workflows. The audit did not provision a licensed abuse-hash source, staff moderation, establish escalations and response targets, complete NCMEC/vendor onboarding, publish the DMCA agent identity, restrict moderator network access, or run an incident drill. Code cannot substitute for a functioning safety operation.

### B-07: Store, legal, purchase, and real-device release evidence is absent

Severity: **Critical**  
Owner: founder, release, finance, and legal  
Release effect: hard stop

There is no signed App Store or Play Store candidate from this exact commit, no sandbox purchase/refund/dispute/cross-rail evidence, no final privacy and deletion URLs, no completed store privacy declarations, no encryption export classification, and no exact-build physical-device matrix. Local exports prove bundling, not review readiness or real provider behavior.

### B-08: Release governance needs remote enforcement

Severity: **High**  
Owner: repository administrator  
Release effect: hard stop until exact release SHA is protected and green

The local workflows are improved and actions are immutable, but this audit did not verify a remote CI run on the exact release SHA, required status checks, protected branches, artifact provenance, an image registry digest, signing, an SBOM, or a clean release tag. Local green evidence must be reproduced by trusted remote infrastructure.

## Step-by-step production completion runbook

The current commit is not the release commit. Do not begin public submission until B-01 through B-03 are implemented and verified. Then execute the following steps in order.

### 1. Finish every launch-hard code program

1. Implement every phase and acceptance criterion in Plan 44's shared production foundation.
2. Implement Plans 42 and 43 against that foundation while Plan 41 client/provider work proceeds against locked contracts.
3. Implement Plan 25 direct calls, native call integration, and LiveKit rooms against Plans 42 and 44.
4. Implement Plan 41 provider adapters, broker, encryption, migration, and atomic restore.
5. Complete Plan 40 residual Share Inbox DM routing, exported stub removal, and truth reconciliation.
6. Record every automated, provider, browser, native, physical-device, security, load, backup, failover, canary, and rollback result required by the detailed plans.
7. Move Plans 25, 41, 42, 43, and 44 to `docs/plans/done/` only after their close criteria are genuinely satisfied.
8. Re-run this audit on the new candidate. Select the immutable release SHA only after the rerun has no unresolved code blocker.

### 2. Provision the production topology

1. Create isolated production projects, networks, service identities, and least-privilege roles.
2. Assign separate public hosts for relay, humanity verification, hosted API, persona, community, moderation console, and any public directory or Commons node.
3. Set DNS and TLS. Redirect HTTP to HTTPS. Expose only documented public ports.
4. Keep the moderation console on a restricted network or identity-aware proxy.
5. Provision TURN with short-lived credentials and no static credentials embedded in clients.
6. Provision persistent storage for every named volume in `packages/meerkat-relay/deploy/compose.production.yml`.

### 3. Provision secrets without putting them in Git or shell history

1. Create secret-manager entries for entitlement signing, webhook verification, hosted app tokens, persona sessions, humanity signing, moderation administration, operator identity, TURN, Stripe, RevenueCat, Google OAuth, and storage providers.
2. Generate independent secrets per environment. Do not reuse development or staging secrets.
3. Restrict each service to only the secrets it consumes.
4. Record owner, rotation interval, emergency rotation procedure, and last-rotated date.
5. Run the production environment guard from a secret-injected CI job. Do not print secret values.

### 4. Provision the Commons and content-safety inputs

1. Follow `docs/guides/the-commons-provisioning-runbook.md` using the production operator key.
2. Persist the resulting publication descriptors and set `COMMONS_PUBLICATION_IDS` from the real provisioned output.
3. Obtain and load an authorized, nonempty abuse-hash dataset in the format required by the community entrypoint.
4. Confirm startup rejects an empty file in staging, then confirm the authorized file loads without logging its contents.
5. Document refresh cadence, access controls, vendor terms, and incident contacts.

### 5. Configure billing and purchase providers

1. Create the exact Apple, Google, RevenueCat, and Stripe products represented by the checked-in billing configuration.
2. Configure RevenueCat public mobile keys and the server-side REST credential.
3. Configure Stripe secret and webhook signing keys, price IDs, success/cancel origins, and the published webhook endpoint.
4. Subscribe the webhook to purchase, renewal, expiration, cancellation, refund, chargeback, and dispute lifecycle events used by the code.
5. Confirm webhook retries are idempotent and out-of-order delivery cannot reactivate inactive access.
6. In store sandboxes, test buy, restore, reinstall, refund, expire, dispute, cross-rail link, rejected signature, replay, and offline recovery on two separate accounts.

### 6. Build and deploy immutable images

1. Check out the selected release SHA in trusted CI with no working-tree changes.
2. Run all tests, typechecks, lint, function gate, parity, generated-artifact guard, dependency audit, web build, and mobile exports.
3. Generate an SBOM for every image and mobile build input.
4. Build the production platform image with the release SHA as the immutable tag.
5. Scan the image, sign it, push it, and deploy by digest rather than a mutable tag.
6. Validate Compose before deployment:

   ```sh
   docker compose \
     -f packages/meerkat-relay/deploy/compose.production.yml \
     config --quiet
   ```

7. Start services, confirm no container is privileged, and confirm the application containers remain read-only with only required writable mounts.

### 7. Verify live services and fail-closed behavior

1. Fetch every public health endpoint through its production TLS hostname.
2. Open the real app and verify the displayed relay state changes only after the production relay responds.
3. Attempt a hosted relay join with no entitlement and confirm rejection.
4. Attempt a join with a malformed, expired, revoked, wrong-app, and wrong-feature entitlement and confirm rejection.
5. Confirm a valid entitlement succeeds without exposing the device public key in relay logs.
6. Exercise CORS preflight from the exact production web origin. Confirm other credentialed origins are rejected.
7. Confirm storage path traversal, oversized upload, wrong hash, quota overflow, and rate overflow all fail closed.

### 8. Establish backup, restoration, and failover evidence

1. Define RPO and RTO for billing, persona, public posts, moderation, ingest state, and stored bytes.
2. Automate encrypted backups with retention and access separation.
3. Restore every named state store into an isolated staging environment.
4. Verify counts, hashes, entitlement states, deletion markers, and moderation audit continuity after restore.
5. Destroy the staging copies after recording evidence.
6. If running multiple replicas, migrate shared state to a transactional shared store and test concurrent writes and failover. Do not mount the same file store read-write across independent replicas.

### 9. Run the physical-device transport matrix

Use at least two current iPhones and two supported Android devices, plus a desktop browser. Record build IDs, OS versions, network shape, timestamps, and packet-path result.

1. LAN/Bonjour on same Wi-Fi.
2. Android Nearby/Wi-Fi Direct on real hardware.
3. BLE wake with proof that BLE carries no content bytes.
4. WebRTC direct on different networks.
5. Forced TURN traversal under symmetric NAT or an equivalent test network.
6. Relay fallback with one peer offline, mailbox parking, later drain, and signed receipt.
7. Same-account mobile-to-web and web-to-mobile DM convergence.
8. Group-DM receipt exclusion.
9. Foreground auto-connect with explicit opt-in.
10. Scheduled background runs with the app backgrounded and terminated, recording the OS limitations honestly.
11. Loss, reconnect, revoked peer, expired token, clock skew, and network-change cases.

Any unavailable rung must remain unavailable in release copy and UI until its real hardware path passes.

### 10. Run storage-provider and restore drills

1. iCloud Drive on, off, signed out, quota full, permission revoked, and fresh-install restore.
2. Google Drive OAuth on mobile and web, token refresh, token revocation, resumable upload, and restore.
3. Android and iOS file-provider destinations.
4. Web directory picker with honest download/upload fallback where unsupported.
5. WebDAV/S3 wrong credential, TLS failure, quota failure, and checksum mismatch.
6. Hosted and connected-server signed descriptor validation.
7. Migration cancel and resume.
8. Corrupt manifest and wrong recovery key, proving no partial state is applied.

### 11. Complete trust, safety, and legal operations

1. Publish final Terms, Privacy Policy, Community Guidelines, deletion instructions, appeals, and contact pages at durable HTTPS URLs.
2. Put the exact Terms version required by the server at the published URL.
3. Complete DMCA designated-agent details and the applicable registration.
4. Complete NCMEC or approved vendor onboarding and document mandatory-reporting procedures with counsel.
5. Staff moderation, define coverage and response targets, and restrict console access.
6. Run a tabletop exercise for CSAM, credible threat, account compromise, fraudulent purchase, and data-deletion failure.
7. Verify logs contain no content, secrets, full relay tokens, device identities, recovery material, or provider credentials.

### 12. Complete store and policy submissions

1. Produce screenshots from the exact signed release candidates and real states.
2. Complete Apple privacy labels and Google Play Data Safety declarations from actual data flows.
3. Complete encryption export classification with counsel.
4. Document background-mode justifications from the implemented and tested behavior.
5. Ensure store copy does not claim calls, storage providers, always-on availability, background guarantees, or E2E media beyond what the final evidence proves.
6. Submit the web, iOS, and Android candidates tied to the same release SHA and record all build and submission IDs.

### 13. Enforce release governance

1. Protect the release branch and require the exact CI checks.
2. Require signed commits or approved equivalent provenance for release changes.
3. Require review for workflow, Docker, dependency, billing, crypto, moderation, and deletion changes.
4. Verify remote CI on the exact release SHA and retain logs.
5. Record image digests, SBOM locations, signatures, mobile build numbers, web artifact hash, and rollback target.
6. Tag only the clean commit that produced the approved artifacts.

### 14. Final GO criteria

Declare GO only when all of the following are true:

- Plans 25, 40, 41, 42, 43, and 44 meet their close criteria.
- Every blocker in this report is closed with linked evidence.
- Remote CI is green on the exact release SHA.
- Every production service is healthy through real TLS hosts.
- Backups and destructive restore drills passed.
- The physical-device transport, call, purchase, and storage matrices passed.
- Trust and safety operations are staffed and exercised.
- Legal and store materials are published and consistent with code.
- A named release owner signs the exact SHA, image digests, app build numbers, web artifact, and rollback plan.

## Limitations of this audit

This audit did not deploy to a live cloud, configure real store or payment accounts, access a licensed abuse-hash service, run physical-device or provider-account tests, perform legal analysis, conduct a 48-hour public soak, or verify remote branch protection. Those are not implied by the local green evidence.

The report also does not certify cryptographic primitives beyond their tested integration and use of established libraries. A pre-launch specialist review of protocol composition, key lifecycle, and privacy claims remains advisable because Meerkat is a security-sensitive communications product.

## Final decision

**NO-GO.** Commit `47f452d3` is a strong security and production-readiness remediation baseline. It should be preserved and built upon. It is not a releasable product candidate until Plans 25, 41, 42, 43, and 44, the Plan 40 residuals, live infrastructure, physical-device proof, provider integrations, trust-and-safety operation, legal publication, restore drills, and remote release controls are complete.
