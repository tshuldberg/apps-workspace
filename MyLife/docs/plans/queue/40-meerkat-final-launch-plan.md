# Plan 40 - Meerkat Production Completion and Final Launch Gate

> Master production plan reconciled on 2026-07-09 after the Blackglass adversarial
> audit and refreshed on 2026-07-15 against integrated candidate `6b70b994`. This is the single coverage map for all remaining
> Meerkat code, infrastructure, provider, physical-device, legal, safety, store,
> and release work.

## Status

- **Active master launch gate. Release decision: NO-GO.**
- Remediation baseline: `47f452d3`.
- Audit publication baseline: `a7112731`.
- Current branch at plan authoring: `feature/meerkat-production-readiness-2026-07-09`.
- Own-device linking UX, global Downloads, web launch E2E, legal surfaces, hardened
  purchase linking, deletion barriers, production compose, container boots, Expo
  exports, and local verification are implemented.
- Plan 41 audit remediation, Plan 42 codeable scope, and Plan 44 codeable scope are
  integrated. Plan 43 packets A through D and the WP-43E HTTP component are present,
  but E still lacks production composition. Plan 25 and Plan 43 packets F through J
  remain code blockers; WP-43G exists only on a separate unintegrated branch.
- **Launch rule:** no release-ready, code-complete, production-ready, beta-ready,
  store-ready, or GO claim is allowed until every gate in this document has linked
  evidence for the exact release manifest.

## Purpose

Plan 40 does not duplicate the detailed engineering plans. It owns:

1. the complete remaining-code coverage map;
2. the small residual code tasks not large enough for a separate plan;
3. dependency and merge order across the detailed plans;
4. founder and operator actions that cannot be completed by code alone;
5. the exact evidence ledger and final GO decision.

## What Already Exists

| Area | Verified state | Remaining proof |
|---|---|---|
| Existing implemented paths | 5,823 sync, relay, mobile, web, and iCloud package tests pass on integrated candidate `6b70b994`; both production builds and all repository gates pass | rerun in remote CI on final SHA |
| Own-device DM linking | mobile and web UX use real link rows, message mirrors, and signed receipt state | physical mobile-to-web and web-to-mobile matrix |
| Global Downloads | mobile and web cross-community surfaces, filters, save, report, request-again, and parity checks exist | physical save and open QA |
| Web launch E2E | Playwright covers launch surfaces and real app-visible relay status | remote CI on final SHA |
| Purchase and access | signed grants, refund and dispute relock, receipt validation, webhook ordering | live sandbox and webhook proof |
| Deletion | write barrier, topology deletion, byte verification, key-ordering protection | live deployed destructive drill |
| Legal and safety UX | Terms, privacy, guidelines, reporting, block, DMCA intake, operator console | published URLs, real legal identity, staffing, vendor and incident proof |
| Production packaging | hardened Dockerfiles, compose, Caddy, environment guard, local image boot | full signed topology, live cloud, monitoring, backup, canary, rollback |

## Detailed Plan Set

| Plan | Owns | Code status | Launch evidence |
|---|---|---|---|
| [Plan 25](25-meerkat-calls-and-rooms.md) ([HTML](25-meerkat-calls-and-rooms.html)) | direct voice/video, LiveKit rooms, system call UI, screen share, moderation, recording | not started | call, room, TURN, LiveKit, Egress, native, load, physical-device proof |
| [Plan 41](41-meerkat-storage-destinations.md) ([HTML](41-meerkat-storage-destinations.html)) | backup format, destination router, iCloud, Drive, Dropbox, OneDrive, Box, file providers, WebDAV, S3, hosted, connected server, atomic restore | code PASS after seven-finding remediation in `f29ab80d`, integrated at `6b70b994` | live provider, migration, fresh-install restore, KMS, signed iCloud, physical-device, and browser proof |
| [Plan 42](42-meerkat-native-transport-push-background.md) ([HTML](42-meerkat-native-transport-push-background.html)) | owned Nearby and BLE native module, APNs/FCM/Web Push gateway, correct background lifecycle | codeable scope complete and integrated | two-device radio, push provider, background, and terminated-state proof |
| [Plan 43](43-meerkat-managed-archive-seeding-safety.md) ([HTML](43-meerkat-managed-archive-seeding-safety.html)) | durable managed archive, quarantine, scanning, pinning, announcement, history discovery, seeding, NCMEC filing, DMCA config | packets A through D integrated; E HTTP component present but production composition open; F, H, I, J open; G authored at `3af4ba99` but absent from candidate | clean/rejected archive, takedown, automatic history, filing, safety-ops, and restart proof |
| [Plan 44](44-meerkat-production-state-observability-release-supply-chain.md) ([HTML](44-meerkat-production-state-observability-release-supply-chain.html)) | PostgreSQL, object storage, HA, metrics, SLOs, backup, restore, signed images, SBOM, provenance, canary, rollback | codeable scope complete and integrated | deployed failover, recovery, supply-chain, soak, canary, and release-manifest proof |

## Complete Audit Blocker Coverage

| Audit blocker | Owning plan or task | Coverage status |
|---|---|---|
| B-01 calls and rooms absent | Plan 25 | comprehensive plan created and SFU or native decisions locked |
| B-02 storage destinations absent | Plan 41 | code remediated and integrated; founder-operated provider, KMS, signed-build, browser, and physical restore proof remains |
| B-03 native transport and background unproven | Plan 42 | codeable scope complete; native build, radio, push-provider, and terminated-state proof remain |
| B-04 production infrastructure absent | Plans 25, 42, 43, 44 plus Founder Runbook | topology and execution gates covered |
| B-05 single-host durable state | Plan 44 | codeable PostgreSQL/object-storage/recovery substrate complete; deployed HA, PITR, restore, and regional proof remain |
| B-06 safety operations not live | Plan 43 plus Founder Runbook | packets A through E integrated; client status, sealed announce integration, automatic-history wiring, console lanes, proof pack, vendors, staffing, and drills remain |
| B-07 store, purchase, and device evidence absent | Plan 40 Founder Runbook | all matrices and publication gates covered |
| B-08 remote release governance absent | Plan 44 plus repository administration | attestation, signature, protection, CI, canary, rollback covered |

No verified production code gap from the 2026-07-09 audit is unowned after this plan
set. Execution and evidence remain incomplete.

## Residual Code Plan

These code items are real gaps but do not need separate mission plans.

### R1 - Complete Share Inbox to DM routing

Current mobile and web code advertises DM as a destination capability but cannot route
a staged share into a real DM message.

Required changes:

- Extend mobile `ShareRouteTarget` with a DM target containing the exact thread id
  and participant context required by the existing DM provider.
- Add a DM send dependency that writes through the existing DM core and attachment
  path. Do not write `dm_messages` directly from the Share Inbox.
- Extend web `routeStagedShare` with the same provider-level DM author dependency.
- Render recipient or thread selection on both Share Inbox surfaces.
- Preserve multi-item text, URL, image, audio, video, PDF, and file behavior.
- Mark intake routed only after the real DM row exists.
- Continue deriving `Sent` from the matching `dm_messages` row, never intake status.
- Cover blocked recipient, removed group member, missing blob, retry, duplicate tap,
  attachment failure, and already-routed cases.
- Add parity checks for the visible DM destination and real provider call.

Acceptance:

- AC-40.R1.1: text and file shares reach a 1:1 and group DM on mobile and web.
- AC-40.R1.2: a failed DM send leaves the item staged and retryable.
- AC-40.R1.3: no direct SQL shortcut or fabricated sent state exists.

### R2 - Remove or replace exported no-op clients

The public sync barrels still export three misleading stubs:

- `SignalingClient` reports connected without I/O. Plan 25 replaces it with direct
  call signaling or removes the generic export.
- `PushRelayClient` registers and sends without I/O. Plan 42 replaces it with the
  real push protocol.
- `TrackerClient` and `PaidContentManager` are referenced only by their own tests,
  barrel checks, and exports. No Meerkat product flow reaches them.

Required changes:

- Remove `TrackerClient` and `PaidContentManager` from every public barrel that exposes them and delete
  their stub-only tests and source if a final reachability scan confirms no product use.
- Preserve real torrent manifests, piece transfer, hashing, and seeding code that is
  independently used.
- If a user-facing paid-content or tracker flow is discovered before deletion, stop
  and create a full production plan rather than keeping no-op behavior.
- Add a parity or reachability check that rejects public exported classes whose
  production methods contain phase comments, immediate fake success, or fixed empty data.

Acceptance:

- AC-40.R2.1: no public client reports connected, registered, sent, paid, or scraped
  without real I/O and authoritative state.
- AC-40.R2.2: removal does not break reachable content transfer or public package API
  consumers.

### R3 - Reconcile stale truth claims

Required changes:

- Update `apps/meerkat/Tickets/launch-plan.md`, app instruction files, done-plan
  status deltas, founder runbooks, and store copy after each plan lands.
- Remove stale statements that Downloads is absent, native Nearby or BLE is real
  before its module exists, automatic history is connected before Plan 43, or
  background wake is guaranteed.
- Update both `AGENTS.md` and `CLAUDE.md` for any long-lived transport or release rule.
- Extend `scripts/check-meerkat-parity.mjs` with plan-specific honesty assertions.

Acceptance:

- AC-40.R3.1: code, UI, runbooks, tickets, plans, and store claims agree on the exact
  final release capabilities.
- AC-40.R3.2: no `coming soon`, `Phase 2 stub`, fake success, or contradictory launch
  claim remains in a reachable Meerkat path.

## NOT in Scope

- No promised Meerkat launch capability is deferred by this master plan.
- MyLife modules unrelated to Meerkat are not modified unless a shared dependency
  change requires compatibility work and tests.
- Business-plan snapshot claims under `docs/business-plan/` are not used as current
  release truth.
- Legal judgment, vendor contracting, store approval, and production account ownership
  cannot be produced by code. They remain release gates in the Founder Runbook.

## Dependency Graph

```text
Plan 44 Phase 0: PostgreSQL and production contracts
        |
        +----------------------+----------------------+
        |                      |                      |
        v                      v                      v
Plan 42 native/push      Plan 43 archive/safety   Plan 41 broker/hosted
        |                      |                      |
        v                      |                      |
Plan 25 native calls     +----------+----------------+
        |                           |
        +-------------+-------------+
                      v
              residual R1-R3 closure
                      |
                      v
             integrated release candidate
                      |
                      v
          remote CI + provider + device matrices
                      |
                      v
       live infrastructure + safety + legal + store
                      |
                      v
             48-hour soak + final audit
                      |
                      v
                       GO
```

Plan 44 Phase 0 lands first because Plans 41 through 43 need production state
interfaces. Client, native, scanner, UI, and provider work can proceed against
contract fakes in parallel. Plan 25 consumes Plan 42 call wake. Integration and final
evidence are sequential.

## Parallel Execution Lanes

| Lane | Scope | Primary directories | Depends on |
|---|---|---|---|
| A | Plan 44 PostgreSQL and object storage | `packages/meerkat-relay`, deploy, workflows | none |
| B | Plan 42 native radio and mobile background | native package, `apps/meerkat`, sync push | shared contracts |
| C | Plan 41 storage clients and providers | sync storage, mobile, web, hosted service | Plan 44 DB for broker or hosted production |
| D | Plan 43 archive, history, and safety workers | sync node, relay, mobile, web | Plan 44 DB and object storage |
| E | Plan 25 direct calls and LiveKit | sync, native call package, mobile, web, deploy | Plan 42 call wake; Plan 44 deploy |
| F | residual R1-R3 | mobile, web, sync barrels, docs, parity | stable provider contracts |
| G | integrated QA and launch | all gates, runbooks, evidence | A through F merged |

Use small teams with explicit ownership zones if the user requests agents. Mobile
config, provider files, sync barrels, relay exports, compose, and workflows each need
one designated owner to avoid conflicts.

## Integrated Test Review

```text
CODE
  residual DM share ---------> app/web unit + provider integration + browser QA
  native transport ----------> native unit + two-device radio + fallback
  calls ---------------------> protocol + live relay + LiveKit + physical matrix
  storage -------------------> crypto vectors + provider conformance + restore
  archive/history/safety ----> worker + object + directory + filing + takedown
  production state ----------> conformance + concurrency + failover + restore
  release supply chain ------> workflow + signature + canary + rollback

USER JOURNEYS
  install -> unlock -> pair -> sync -> DM -> share -> call -> room
  publish -> scan -> archive -> discover -> take down
  choose storage -> backup -> reinstall -> restore
  delete account -> verify remote state and bytes removed
  provider refund/revoke/outage -> honest access and recovery state
```

Every detailed plan contains its unit, integration, browser, native, physical,
capacity, failure, security, and operational tests. Plan 40 adds these release-wide
tests:

- exact-release smoke journey across web, iOS, Android, relay, stateful services,
  push, LiveKit, storage broker, archive, seeder, and directory;
- mixed-version clients during server rollout;
- purchase, refund, dispute, reinstall, restore, and cross-rail link;
- full deletion during concurrent write, active call, pending archive, pending backup,
  and queued safety work;
- production config with every dependency healthy, then each dependency failed;
- release rollback while old clients remain active;
- 48-hour production-shaped soak with queue, memory, database, object, WebSocket,
  media, provider, backup, and alert monitoring.

## Release Evidence Ledger

Create `docs/releases/meerkat/<release-id>/evidence.json` and a human-readable HTML
summary for the final candidate. It must identify:

- git SHA and clean status;
- iOS and Android build ids, bundle versions, signatures, and store submissions;
- web artifact digest and deployment id;
- every server image digest, SBOM digest, provenance attestation, and Cosign identity;
- database migration range and backup or restore proof id;
- DNS hosts, TLS expiry, regions, and service deployment ids;
- exact test command results and remote CI run URLs;
- provider sandbox or live evidence ids for Apple, Google, RevenueCat, Stripe,
  Google Drive, Dropbox, OneDrive, Box, WebDAV, S3, APNs, FCM, NCMEC, scanners,
  and any abuse-hash provider;
- physical-device models, OS versions, networks, timestamps, and results;
- safety staffing, escalation, legal publication, DMCA, and incident-drill sign-off;
- SLO dashboard, backup dashboard, 48-hour soak, canary, and rollback evidence;
- named release owner and explicit GO signature.

Evidence files contain references and results, never secrets or private test content.

Plan 41 storage evidence for this ledger:

- [WP-41I automated proof pack, 2026-07-14](../../archives/meerkat-readiness-2026-09-04/REPORT-meerkat-plan41-proof-pack-2026-07-14.md)
- Founder-ops provider, physical-device, broker KMS, signed iCloud, and live-browser evidence remains open and must be attached to the release evidence before GO.

## Founder and Operator Runbook

These steps require accounts, credentials, contracts, counsel, physical hardware, or
production authority. They cannot be completed honestly by source changes alone.

### 1. Create production accounts and ownership

1. Name release, infrastructure, security, safety, legal, finance, and store owners.
2. Create isolated production cloud, DNS, registry, database, object storage,
   monitoring, backup, Apple, Google, RevenueCat, Stripe, provider OAuth, scanner,
   NCMEC or vendor, and support accounts.
3. Require hardware-backed multi-factor authentication and recovery owners.
4. Record access review and emergency contacts.

### 2. Provision production infrastructure

1. Deploy Plan 44 PostgreSQL, standby, object storage, WAL archive, backup account,
   telemetry collector, dashboards, alert routing, and secret manager.
2. Deploy edge, relay pool, community, directory, humanity, persona, hosted, push,
   moderation, seeder, archive worker, operations worker, LiveKit, Redis, Egress,
   TURN, and OAuth broker from signed image digests.
3. Configure DNS, TLS, private networking, least-privilege service identities,
   restricted moderation access, and only documented public routes.
4. Verify liveness, readiness, metrics, synthetics, alerts, backup, restore, canary,
   and rollback.

### 3. Configure secrets and rotation

1. Generate independent production signing, entitlement, webhook, session, humanity,
   persona, moderation, operator, push, TURN, LiveKit, database, object, OAuth, and
   provider credentials.
2. Give each service only its required secrets.
3. Record rotation, overlap, revoke, compromise, and recovery procedures.
4. Run the environment guard without printing values.

### 4. Configure billing and purchases

1. Create exact Apple, Google, RevenueCat, and Stripe products matching checked-in
   billing configuration.
2. Configure receipt validation, webhooks, price ids, origins, and lifecycle events.
3. Test buy, restore, reinstall, refund, expiration, cancellation, dispute,
   chargeback, cross-rail link, bad signature, replay, and provider outage on separate accounts.

### 5. Configure safety and legal operations

1. Supply and continuously refresh authorized malware and abuse-hash sources.
2. Complete NCMEC or approved vendor onboarding and prove the Plan 43 filing path.
3. Register and publish the real DMCA agent configuration.
4. Publish Terms, Privacy Policy, Community Guidelines, deletion, appeals, and
   contact pages at durable HTTPS URLs.
5. Staff moderation coverage, response targets, escalation, evidence access, and
   law-enforcement response with counsel.
6. Run CSAM, credible threat, account compromise, fraudulent purchase, data deletion,
   provider breach, and service outage tabletop drills.

### 6. Run provider and physical-device matrices

1. Complete Plan 42 iOS and Android Nearby, BLE, push, background, terminated, reboot,
   radio-off, and permission cases.
2. Complete Plan 25 cross-platform call, TURN, room, screen-share, background,
   moderation, E2EE-mode, recording, load, and failover cases.
3. Complete Plan 41 every-provider auth, upload, resume, read-back, quota, revoke,
   migrate, fresh-install restore, corruption, and outage case.
4. Complete same-account DM mirror, offline mailbox, group receipt exclusion,
   Downloads save or open, public feed, archive, history, and deletion journeys.
5. Record exact signed builds, device models, OS, accounts, networks, and timestamps.

### 7. Complete store and policy submissions

1. Produce screenshots from exact signed candidates and real product states.
2. Complete Apple privacy labels, Google Data Safety, UGC declarations, encryption
   export classification, background-mode justification, and account deletion.
3. Ensure public copy matches exact call, storage, archive, background, hosted,
   privacy, and E2EE evidence.
4. Record submission, review, rejection, response, and approval ids.

### 8. Enforce remote release governance

1. Protect the release branch and require exact remote checks and reviews.
2. Restrict workflow, dependency, Docker, crypto, billing, deletion, moderation,
   database, and migration changes to designated reviewers.
3. Verify SBOM, scan, provenance, signature, and release manifest before deploy.
4. Promote the same tested digests through staging, canary, and production.
5. Tag only the approved clean SHA.

### 9. Run recovery and soak

1. Execute PostgreSQL point-in-time recovery and object-version recovery in an
   isolated environment.
2. Verify counts, semantic digests, entitlements, personas, kills, safety queues,
   archive pins, provider references, and deletion markers.
3. Execute service failover and exact-release rollback.
4. Run a 48-hour production-shaped soak with alerts active.

### 10. Final audit and GO meeting

1. Rerun the Blackglass audit on the exact release manifest.
2. Close every blocker with linked evidence.
3. Review open incidents, vulnerability exceptions, SLO burn, backup freshness,
   provider health, safety staffing, legal publication, and store status.
4. The named release owner signs GO for the exact SHA, digests, builds, submissions,
   migrations, and rollback release.

## Integrated Failure Gates

The release automatically remains NO-GO if any of these is true:

- any detailed plan remains in queue;
- any residual task R1 through R3 remains incomplete;
- remote CI is missing or red on the release SHA;
- any image is unsigned, unattested, unscanned, or deployed outside the release manifest;
- a required provider or physical-device matrix has missing or failed rows;
- a backup lacks recent restore proof;
- a live service is unready, an SLO alert is active, or soak shows unbounded growth;
- calls, storage, archive, safety, background, purchase, deletion, or E2EE copy exceeds evidence;
- safety staffing, NCMEC path, DMCA identity, legal URLs, or store declarations are incomplete;
- no named owner accepts rollback and incident responsibility.

## Master Failure Modes

| Release-wide failure | Required handling | Evidence |
|---|---|---|
| A detailed plan passes alone but breaks another plan | run the integrated journey and full parity suite on the merged release | remote CI and release smoke |
| Mobile, web, and server are built from different commits | release manifest rejects mismatched source SHA | artifact manifest verification |
| Provider sandbox passes but production credentials are wrong | readiness and synthetic request fail before GO | production synthetic and alert |
| A rollout needs a schema the prior release cannot read | mixed-version gate blocks migration contract | compatibility E2E |
| Physical-device evidence came from an older build | evidence ledger requires exact build id and signature | release-owner review |
| A safety or legal queue is healthy but unstaffed | operational ownership gate remains failed | staffing and escalation sign-off |
| A backup job succeeded but restore is corrupt | restore proof fails and blocks launch | isolated recovery drill |
| Marketing or store copy exceeds final behavior | truth reconciliation and store review fail | copy-to-evidence matrix |
| Canary degrades a user journey | stop rollout and deploy prior signed manifest | rollback rehearsal |

## Master Acceptance Criteria

- AC-40.1: Every audit blocker has implemented code or completed founder-owned
  evidence, not only a plan.
- AC-40.2: Plans 25, 41, 42, 43, and 44 pass their own close criteria on the same
  release manifest.
- AC-40.3: Residual tasks R1 through R3 pass on mobile, web, sync, and parity checks.
- AC-40.4: Remote CI, signed builds, provider sandboxes, live infrastructure,
  physical-device matrices, safety operations, legal publication, stores, backup,
  restore, canary, rollback, and soak all point to the exact release.
- AC-40.5: The final audit reports no unresolved critical or high release blocker.
- AC-40.6: A named owner signs GO and accepts incident and rollback responsibility.

## Master Negative Criteria

- NC-40.1: No local-only test, export, container boot, or document may substitute
  for required live, provider, native, physical, or operator evidence.
- NC-40.2: No explicit founder scope change is inferred from schedule, cost, missing
  credentials, or a difficult provider integration.
- NC-40.3: No stale plan or ticket may be used to claim a missing feature is complete.
- NC-40.4: No release artifact may be rebuilt after approval without a new manifest
  and complete affected evidence.
- NC-40.5: No NO-GO condition may be waived without a written founder decision that
  names the exact criterion, evidence considered, risk owner, and replacement control.

## Required Repository Gates

- Function test scaffolds and `pnpm gate:function:changed` for logic changes.
- Targeted sync, relay, app, web, entitlement, billing, native, worker, and provider tests.
- All relevant typechecks and lint.
- `pnpm check:meerkat-parity`.
- `pnpm check:generated-artifacts`.
- `pnpm check:parity --quiet`.
- Web production build and browser QA.
- iOS and Android export, Expo Doctor, prebuild diff, signed builds, and native tests.
- SQL migration, store conformance, backup, restore, failover, image, SBOM, signature,
  attestation, canary, rollback, load, and soak gates from Plan 44.

## Close Criteria

Plan 40 moves to `docs/plans/done/` only when:

- Plans 25, 41, 42, 43, and 44 are in `docs/plans/done/` with linked evidence;
- residual tasks R1 through R3 are implemented and verified;
- the exact release evidence ledger is complete;
- founder and operator runbook steps have signed pass results;
- the rerun adversarial audit has no unresolved release blocker;
- the release owner signs GO for the exact release manifest and rollback target;
- the worktree is clean, the commits are ready to push when the founder asks, and
  no release artifact depends on uncommitted local state.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | Not run | Founder mandate and audited launch contract retained without scope reduction. |
| Codex Review | `/codex review` | Independent second opinion | 0 | Not run | The prior Blackglass adversarial audit supplied the independent findings baseline. |
| Eng Review | `/plan-eng-review` | Architecture and tests | 1 | CLEAR (PLAN) | 12 planning issues resolved, 0 critical plan gaps, 0 unresolved decisions. |
| Design Review | `/plan-design-review` | UI and UX gaps | 0 | Not run | Required when implementation adds or changes final user surfaces. |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | Not run | Not a release-plan prerequisite. |

- **UNRESOLVED:** 0 architecture or coverage decisions.
- **VERDICT:** ENG CLEARED. The plan set is ready to implement. Product release remains NO-GO until implementation and evidence are complete.
