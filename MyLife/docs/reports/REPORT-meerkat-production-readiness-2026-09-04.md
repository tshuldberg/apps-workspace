# Meerkat: the production decision

**Current assessment: 2026-09-04. Reviewed tree: `7a40639d1e364ee384f92f0debbd036d995e7b4c`. Latest product change: `a3152851`. Reviewer: Astra.**

**Latest update:** [September 5 media lifecycle fixes](#media-lifecycle). Release approval remains blocked.

This is the current production-readiness assessment, replacing the older Meerkat readiness reports listed in the [archive manifest](../archives/meerkat-readiness-2026-09-04/README.html). It is a dated decision document, not a release approval. Current code and newly collected release evidence outrank this snapshot.

## Media lifecycle update, September 5 {#media-lifecycle}

Room disconnects no longer report connected. Both clients now clean up failed joins, ended calls and subscriptions, reject unavailable controls, and retain an honest unknown route until selected-path statistics arrive. Native loaders check registered bridges before importing optional packages. Shared sync primitives classify real route evidence; diagnostic retries are bounded and cannot delay connection events.

Focused checks pass: **31 app, 15 web and 53 shared cases**. Pre-fix controls expose **21 failing assertions**. A real Chromium loopback call with synthetic audio confirms direct-path classification, remote tracks and hangup cleanup. Function gate, hub consumer types, full parity and repository guards pass. Fresh read-only inspection still finds Actions disabled. This is not native-device, TURN-provider or room-provider proof. S2 and release evidence remain open. [Implementation and verification](../sessions/2026-09-05-meerkat-media-lifecycle.md).

F2 follow-through: emergency export failures now show recovery guidance and permit retry without dropping pending rows. The original browser control fails; all **8 storage browser cases pass** after the fix. F8 now has a [source-based local-storage threat model](../designs/meerkat-local-storage-threat-model.md), separating ordinary database/attachment data from encrypted backups and key storage. Database encryption, privacy app lock and physical-device acceptance remain open.

## Issuance continuity update, September 5 {#issuance-continuity}

**S2 is partially remediated and still release-blocking.** Direct issuance now requires no prior issuance; renewal atomically advances the account’s latest issued epoch. The epoch survives file-store restart and account recreation. PostgreSQL migration 20 backfills active issuance history. Eight real PostgreSQL 16 tests passed, including upgrade, concurrency and recreation; no deployed service was migrated. No account/persona or serial linkage was added. Mobile refusal/deletion copy states the retained history and unavailable automatic recovery.

Three new assertions exposed the reviewed service’s bypasses; the focused service/store checks pass, including clean renewal and concurrent file-store callers. Same-epoch borrowed-bearer binding, lost/expired-pass recovery and already-deleted history remain unresolved. The disposable PostgreSQL instance used 16 MB shared buffers and was stopped afterward. Function gate, full parity and generated-artifact checks passed; Docker stayed stopped. [Implementation, verification and boundaries](../sessions/2026-09-05-meerkat-issuance-continuity.md).



Mint-response recovery and period handling are also fixed locally. The client retains exact protected requests through network/keychain failures; identical replay recovers the same signature without another pass. Current and next-period credentials are stored together, and only a presently valid credential is sent. Mobile and web copy distinguish scheduled and expired passes. The previously missed web account twin now has matching recovery and period handling, with explicit vault flushes before submission and durable success. Both clients reject conflicting-session mint overlap and recover obsolete scratch only from a verified saved pass. **34 mobile and 41 web client tests, 34 service/store/privacy tests and 8 real PostgreSQL tests pass**; six recovery/period assertions fail on the reviewed client. Final affected lint/type/regression gate and full parity passed after these additions. Broader session-change/lost-pass recovery and same-epoch borrowed-pass binding remain open. Seven web recovery assertions fail against the reviewed client. The staged function gate, exact staged Meerkat parity/transport checks, full parity rerun and repository guards pass. Other sessions’ changes remain outside this candidate.

## Follow-through: relay, invitations and security {#follow-through}

The latest code closes additional sender-authorization and verification defects. **Release remains NO-GO.** [Detailed session and limitations](../sessions/2026-09-04-meerkat-relay-security-remediation.md).

| Area | Implemented and verified | Remaining evidence |
|---|---|---|
| F1 data loss | Prior authoritative-writer design remains covered by shared IndexedDB takeover, crash and legacy-fencing browser tests. | Signed-device storage matrix and release candidate proof. |
| F2 persistence failure | Prior bounded retry/pending-write design remains covered by real-browser quota and recovery tests. | Native lifecycle and production storage limits. |
| F5 hosted delivery | Relay connection success waits for actual admission; mobile acquires scoped, bounded hosted access through shared primitives. Local paid relay rejection/acceptance and byte transfer pass. | Configured billing/provider and real-device proof. |
| F6 invitations | Preview dismissal retains intent; publication receipt carries actual server expiry; legacy expiry is unknown; expired QR/copy actions require republishing. Browser restart and local relay expiry checks pass. | Camera/device scanning and remaining join/receipt journeys. |
| S1 recipient privacy | Explicit personal-device ownership, signed community recipient filtering, per-batch acknowledgement IDs and authorized blob references on both app surfaces. Ten session regressions pass; six of the original seven fail on reviewed code. | Physical transports, large-history performance and release security acceptance. |
| S3 age assertions | Unsupported client age assertions rejected; minors preserved; unattested adult records reported unknown. 14 HTTP/service tests pass. | Provider attestation and treatment of previously issued/client-cached passes. |
| S5 preview images | Bounded guarded fetch and local raster decoder input, mobile/web parity; 70 focused cases each. | Native execution and DNS/private-resolution guarantees. |
| S6 scanner | Default detectors enabled; exact reviewed fixture exclusions; clean current source and positive fake-token control. Checksum-pinned release job added. | Actions remains disabled; no remote scan claim. |

Verification: shared full suite **2,655 pass / 3 skip**, mobile **1,843 pass**, web **1,254 pass** before final preview additions; relay separate full rerun **1,656 pass / 189 skip**; browser **19 pass / 1 skip**. The initial concurrent relay run had one exit-143 process-test failure; focused and separate full reruns passed. Final affected checks cover later changes. Final affected lint/type/regression checks and hub consumer typechecks passed through `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed`; full parity, generated-artifact guard, Release Verify YAML parsing and web production build passed. Existing large-chunk and multiple-lockfile warnings remain. The final 10-case recipient suite also covers live pairing deactivation/rekeying and an edit arriving during snapshot delivery.

GitHub Actions is still disabled. The latest [Release Verify run](https://github.com/tshuldberg/MyLife/actions/runs/30716741802) is cancelled and predates this candidate. Local fixture entitlement tests are not billing-provider, purchase, signed-device or hosted-release proof. Gitleaks is pinned to the checksum of the [official 8.30.1 release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).

Next: resolve **S2 blind-credential revocation across issuance/renewal/recovery** without weakening unlinkability. S4 cannot be fixed by disabling Files alone because existing bulk exports depend on it; private storage and export migration must ship together. TURN configuration and device/provider access remain external dependencies. Creator commerce and public expansion remain separate programs.

## The decision {#decision}

**NO-GO for general availability today. Continue a supervised private pilot after containing the web data-loss defects.** Meerkat has enough implemented product breadth to justify a focused private-community launch. It does not yet have the demonstrated durability, effortless joining, dependable day-to-day delivery, or operational evidence needed to sell that experience broadly. The full creator-commerce and mass-market social ambition also has material feature gaps.

The most consequential new finding is mundane: the browser's SQLite persistence can lose one tab's changes when another tab saves. A second reproduced defect retries failed database writes in a tight loop. Cryptographic authenticity cannot recover a local message or membership update that was overwritten before replication.

The launch product should be **a private home for a small community's conversations, posts, and shared library**, with expressive spaces as a distinctive benefit. Prove that an invited person can join, receive a reply, return tomorrow, and recover their data. Keep the larger platform roadmap, but give each capability a separate graduation gate.

| Release lane | Decision now | What changes the decision |
|---|---|---|
| Supervised pilot | Conditional | Contain multi-tab database loss, disclose delivery limitations, use consenting test groups and recoverable data; pass fresh-install, purchase, and basic two-device checks on the chosen binary. |
| Private community general availability | No-go | Close F1–F5 below, pass core device/durability/billing/safety audits, prove ordinary invite and return journeys, bind evidence to exact mobile and web artifacts. |
| Managed hosting and public participation | No-go | Above plus deployed service topology, durable host delivery, abuse operations, provider integration, billing/refund, backup and incident drills. |
| Creator memberships, shops, public websites | Not feature-complete | Plan 58 authority, commerce, fulfillment, audience and publishing work, plus store/payment/content review. Existing visual blocks do not constitute a commerce product. |
| TikTok/Reels, Facebook, Reddit replacement | Long-term program | Distinct social graph, events/discovery, publishing, video creation and ranking work, plus content supply and moderation capacity. Do not promise replacement at this launch. |

## Remediation update, September 4 {#remediation}

**F1/F2 are fixed and verified locally. General availability remains NO-GO.** This update supersedes the original findings' implementation status, not the release evidence requirements. The findings and original test totals below remain the record of the reviewed baseline. Work is uncommitted on top of `7a40639d`; unrelated changes were preserved.

| Finding | Current remediation status | Acceptance evidence and remaining boundary |
|---|---|---|
| F1, browser data loss | Fixed in the current working tree | Lifetime writer ownership before vault/SQLite boot; blocked secondary tab and safe reopen; IndexedDB v5 fences legacy writers; flush-before-close and restore ownership. Deterministic transactions/deletes/takeover plus actual shared-IndexedDB tabs, renderer crash, legacy upgrade, and signed-message/key preservation pass. Original unit and browser exclusion tests fail against the old adapter. |
| F2, persistence retries | Fixed in the current working tree | Four automatic attempts with backoff, retained revisions, rejecting flush, exhausted-budget guard, explicit retry, visible unsaved state/export and unload protection. Independent secret-vault retries are now bounded, and keys flush before referenced database rows. Permanent/transient failures, concurrent edits, recovery and shutdown are tested. Original browser control made 21 immediate attempts and incorrectly resolved; fixed control rejects after one failed attempt. |
| F3, store configuration | Local guard fixed; artifact evidence open | All store profiles resolve inheritance/distribution. `MEERKAT_RELEASE_CAPABILITIES=full-platform` is explicit; private-only declarations fail until corresponding runtime gates exist. TestFlight can no longer bypass required configuration. Existing native-image history supports the retained pin; no new signed build was produced. |
| F4, release authority | Still blocked externally | Read-only GitHub API still reports Actions disabled; latest listed Release Verify remains cancelled August 1. Existing workflow covers the necessary local/configuration lanes. Owner action and exact-candidate run remain required. |
| F5/F6, everyday invitations and delivery | Concrete workflow fixes complete; full acceptance open | Device-local invite intent survives locked onboarding/restart and simulated purchase return; retry intent survives a failed first approval park. Verified previews expire live; pending approval copy is explicit; QR/copy requires a real publish acknowledgement and explains unknown server expiry/one-use status. Onboarding exposes the existing opt-in catch-up control. Device/store/owner-asleep/stranger proof and full friend-link/install handoff remain. |
| F7/F8/F10 | Open with clarified boundaries | TURN credentials remain extractable client configuration with unverified lifetime/quotas. SQLite messages and recovery exports are plaintext local data; sealed blobs and key-vault encryption do not change that. Full local search, device performance and accessibility remain work. |
| F9, permission copy | Local/config fix verified in concurrent session | Current camera/microphone wording and generated native configuration checked. Physical permission sheets and signed-device behavior remain unverified. |

Fresh final local evidence: **1,839 mobile tests and 1,243 web tests passed**; affected type checks/lint, `pnpm gate:function:changed`, full repository parity, generated-artifact guard, web barrel guard, transport static negative controls, and web build passed. **18 distinct Chromium browser checks passed**, with one relay-dependent test skipped: 17 passed in the complete run, then the added signed-message/key takeover check passed independently. The build retains its large-chunk warning. Browser failure tests inject quota errors over the real persistence path; they do not fill a physical disk. Entitlement responses in purchase-return tests are fixtures, not payment evidence.

### Catch-up continuation, September 4

**F5: additional confirmed delivery-status defects fixed locally.** A real listener handshake timeout recorded a failed session but returned one completion to the catch-up card. The shared sync job now carries the actual responder result; completion requires a recorded completed session on either side. Listener connection failures advance backoff, retry eligibility reflects the finished attempt, and overlapping triggers share one session round. Mobile and web show skipped-mailbox, failure and retry guidance, and retain errors from automatic triggers. Safety checks and connection consent remain unchanged.

Fresh continuation evidence: **2,633 shared-sync tests passed (3 skipped), 1,842 mobile tests passed, and 1,246 web tests passed**. Three new assertions exposed the original outcome/backoff defects before the fix. One additional Chromium application test passed for missing-connection guidance, visible automatic-trigger persistence failure and manual recovery. Function gate, affected lint/types, hub consumer type checks, full parity and web build passed. Existing bundle-size warnings remain. These results add to the earlier storage/browser evidence; no new provider, payment or signed-device proof is claimed.

**Next local connection gap:** mobile paid-hosted relay sessions/mailbox paths construct backends without a hosted entitlement; web supplies an origin-scoped token. Implement and test mobile access acquisition/scoping through existing shared primitives before claiming paid-hosted connection parity. Never send hosted credentials to arbitrary self-hosted addresses. This is source evidence, not a measured production rejection. [Continuation details and verification](../sessions/2026-09-04-meerkat-catchup-outcome-remediation.md).

Durability means a completed persistence operation. A forced process kill can still lose visibly pending in-memory changes; the renderer-crash test proves the last durable revision survives and does not count the pending revision as saved. Browser eviction and deliberate site-data deletion still require backups. Browsers without Web Locks fail closed. A rollout must allow legacy tabs to save/export before closing; the version fence prevents stale overwrites but cannot rescue their unsaved memory.

Next: close mobile paid-hosted connection parity, review and freeze a candidate, restore exact-SHA Release Verify, and run the signed-device invitation/purchase/return matrix. Continue scoped friend links with explicit publication expiry receipts and install/paste fallback, then temporary TURN allocation credentials. Keep mandatory safety verification and explicit connection consent. No deployment, purchase, account-access change, or external message was performed.

[Detailed remediation and owner handoff](../sessions/2026-09-04-meerkat-storage-workflow-remediation.md) · [Concurrent F3/F9 evidence](../sessions/2026-09-04-meerkat-release-guard-polish.md).

## What was actually reviewed {#evidence}

Scope: the standalone Expo app, Vite/React browser app, shared sync substrate, relay/community services, build configuration, recent security fixes, browser storage, onboarding and navigation, release workflows, release ledgers, active plans, historical reports, and current official competitor sources. This was a broad, risk-based review, not a line-by-line independent cryptographic certification. No product implementation was changed.

The repository already had unrelated dirty settings, memory, and research files. They were preserved. No deployment, purchase, publication, credential change, or outreach was performed. Public competitor research and a read-only pilot health check were performed. No physical iPhone/Android walkthrough, live store purchase, provider integration matrix, or full production infrastructure audit was performed.

### Fresh verification on this tree

| Check | Result | What it does not establish |
|---|---|---|
| `@mylife/sync` tests | 2,630 passed; 3 skipped | Not a third-party protocol audit. |
| Meerkat mobile tests | 1,817 passed | Node tests do not execute native device lifecycles. |
| Meerkat web tests | 1,230 passed | Two real persistence defects escaped these tests. |
| Relay tests | 1,653 passed; 189 skipped | Environment-gated PostgreSQL and object-storage tests did not run. |
| Four package type checks and linters | All passed | Type safety cannot establish persistence or payment correctness. |
| Full repository parity suite; Meerkat parity and transport negative-control script | Passed | Static agreement and invariant checks, not native radio proof. |
| Web production build | Passed; large-chunk warning | Largest app index 760.70 kB, sync chunk 647.21 kB, LiveKit chunk 531.04 kB, before gzip. |
| Browser launch suite | 8 passed; 1 relay test skipped | Private-flow entitlement responses are intercepted fixtures. The relay case checks handshake/status, not two-user delivery. |
| Pilot relay `/healthz` | HTTP 200, `ok: true` | One observation, not availability history, peer presence, or delivered content. |
| GitHub Actions permissions | `enabled: false` | Latest listed Release Verify run was cancelled on 2026-08-01. No green run for this candidate. |
| New database adversarial probes | Two defects reproduced | Adapter-level deterministic reproduction; full browser reproduction remains a fix acceptance requirement. |

Commands ran from `/Users/trey/Desktop/Apps/MyLife`: `pnpm --filter @mylife/meerkat-app --filter @mylife/meerkat-web --filter @mylife/sync --filter @mylife/meerkat-relay test`, the same filter set with `typecheck` and `lint`, `node scripts/check-meerkat-parity.mjs`, `node scripts/check-meerkat-transport-nc.mjs`, and `pnpm --filter @mylife/meerkat-web test:e2e` / `build`. Supporting raw logs are in `/tmp/meerkat-review-20260904/`; essential results and reproduction instructions are preserved here.

### Performance: improved, still a user-experience risk

I reran the existing real-signed-event benchmark with three warmups and nine measured runs. Feed evaluation used seven queries at every tested size. Median time was **41.73 ms at 20 posts, 168.43 ms at 80, and 679.03 ms at 320**, with 704.63 ms p95 at 320. This confirms the September 2 batching improvement. It also leaves roughly two-thirds of a second of synchronous host work at a modest fixture size. It is not a measured phone freeze or a production load test.

Acceptance should target responsive input while fresh signed data is verified, bounded work for visible content, and invalidation-safe verified projections. Do not achieve a fast benchmark by skipping signatures or reusing verification after signed bytes, membership, or safety state changes. Measure cold load, scrolling, incremental sync, large libraries, memory, battery, and slow storage on release devices. [Benchmark source](../../apps/meerkat/scripts/benchmark-feed-read-model.ts), [feed implementation](../../apps/meerkat/app/(root)/data/feed-core.ts).

## What the history says {#history}

The four reviewed product directories have **429 touching commits**: March 3, April 10, June 76, July 260, August 65, September 15. Directory history begins in March with earlier shared-module work; the named mesh foundation landed April 22 (`880f1803`), and the standalone app landed June 14 (`1af44fb3`). Counts include merge and documentation commits, not 429 independently shipped improvements.

The current inventory contains 1,769 TypeScript/TSX files and 476,165 lines across these directories, including tests and tooling, excluding dependencies/build output. File volume is an assurance burden, not evidence of customer value.

| Period / commit | What happened | Adversarial interpretation |
|---|---|---|
| April–June foundations | Transport ladder, signed identities, sealed shares, standalone and web clients | Real architecture exists. “Thin UI” is now an outdated description of product complexity. |
| July, 260 touching commits | Release candidates, security, storage providers, operational hardening | Extensive infrastructure work did not produce a completed release ledger. Require accepted evidence, not another completion headline. |
| August 24–25 (`2fc8427a`, `cdfea6d6`) | Safety-code verification and transport/token hardening | Trust checks matter. Do not move mandatory verification out of a protected sharing flow merely to reduce taps. |
| August 28 (`221b5d04`, `62f82df2`) | Fresh-install schema crashes fixed twice, then all table families created at boot | Mature local test data concealed first-run failures. Every candidate needs clean-device installation, upgrade, and interrupted-boot tests. |
| August 29, Plan 56 | Canvas, pages, badges, stickers, asset packs, themed layouts | Differentiation expanded faster than the evidence for ordinary joining and delivery. Preserve it, but stop adding launch dependencies. |
| August 30 (`c93874f1`) | Secret-vault concurrency, entitlement state machine, navigation and recovery fixes | Good fixes, but the same whole-state-write and retry pattern survives in the separate SQLite adapter. Audit sibling mechanisms after a root cause is found. |
| September 1 (`06c4da0a`, `8e474012`, `813461c8`) | Host lifecycle and send/pull wiring, durable join queue, resource-exhaustion fixes | The older “node exists but has no writer” claim is stale. Conversely, a durable join request is not proof that an absent owner can approve it or supply keys. |
| September 2 (`a3152851`) | Query batching, random identifier cleanup, dependency and lint work | Verified improvement. Remaining host latency and missing device measurements still matter. |

The August 25 **RC19 ledger remains NO-GO** and binds to `cdfea6d6`, before Canvas, later billing fixes, host wiring and this latest performance work. Older browser evidence cannot simply be carried over to this much-changed tree. The current review rejects the September 1 blanket conclusion that only founder operations remain: F1 and F2 are code defects. [RC19 evidence](../releases/meerkat/meerkat-2026-08-25-rc19/evidence.json).

## Findings that change the launch decision {#findings}

Severity measures impact within the affected lane. “Observed” means code or configuration was inspected; “reproduced” means a controlled execution demonstrated the failure. No critical remote exploit was demonstrated.

### F1. High: two browser tabs can overwrite database changes

**Reproduced. Blocks unrestricted web release.** `createIdbDbBytesStore` writes an entire sql.js database image to one IndexedDB key. Each adapter/tab holds an independent in-memory database. `persistNow` exports that local image without cross-tab ownership, revision checking, or reconciliation. The secret vault's lock does not protect this store. The adapter has not changed since `62943a1c` on June 15.

Probe: initialize an empty table, open adapters A and B on the same baseline, insert row A and flush, then insert row B and flush. Reopen C. **Actual: only B remains. Expected: both rows, or an explicit denial of the second writer.** The production adapter with an injected durable byte store produced `[{"id":"b","body":"message from tab B"}]`.

Fix direction: establish one authoritative database writer per browser origin, with explicit read-only or forwarded operations from other tabs and safe ownership transfer. Merely locking whole-image writes still loses stale changes. A merge design must preserve transactions, deletes, counters and signed event semantics. Add two-browser-context tests using real IndexedDB, including refresh and takeover after crash. [Adapter, lines 29–36 and 75–92](../../apps/meerkat-web/src/lib/storage/browser-database-adapter.ts), [boot path](../../apps/meerkat-web/src/lib/browser-sync-init.ts).

### F2. High: storage failure causes unbounded immediate retry

**Reproduced. Blocks unrestricted web release.** The same adapter catches a failed write, sets `dirty = true`, then recursively calls `persistNow()` immediately. Injecting 20 failures caused **21 attempts in 3.11 ms** before the deliberately allowed success. Real IndexedDB requests may yield more slowly, but there is still no retry budget or backoff. Permanent failure can keep flush pending and repeatedly export/write the database.

Fix direction: bounded retry with backoff, explicit durable/unsaved state, retained dirty work, manual retry, and a safe export path. Acceptance: a permanent quota or permission failure settles to a visible recoverable state without a hot loop; later recovery persists pending data exactly once. The August 30 secret-store remedy is a useful precedent, not an automatic fix for this adapter. [Adapter, lines 75–100](../../apps/meerkat-web/src/lib/storage/browser-database-adapter.ts).

### F3. High release-control gap: store profile bypasses configuration checks

**Implementation follow-up, 2026-09-04:** F3 code fix verified locally. All store profiles now resolve EAS inheritance/platform distribution and run the existing full-capability guard; TestFlight cannot bypass it. No private-only profile exists. Production pins the historically proven TestFlight image. Signed-build and service evidence remain open. [Verification log](../sessions/2026-09-04-meerkat-release-guard-polish.md).

**Reproduced. Blocks promotion without an equivalent artifact check.** `checkBuildEnv` validates only the literal `production` profile. `testflight` extends production and uses store distribution, but returns `{ok:true, skipped:true}`. An empty production probe returns 15 errors; the equivalent TestFlight probe returns none. This is not evidence that the current pilot binary lacks all configuration. It shows that a promotable store binary can bypass the intended guard.

Define the release capability set explicitly and validate every store-distributed artifact against it. A private-only build may legitimately omit public services, but its feature gates, copy, purchase flow and declaration must agree. Do not solve this by requiring unused services or by quietly skipping validation. Also pin a proven native image for the release lane: production still says `latest`, while TestFlight pins Xcode 26.0. [Build guard, lines 55–62](../../apps/meerkat/scripts/check-build-env.mjs), [EAS profiles](../../apps/meerkat/eas.json).

### F4. High assurance gap: no current automated release authority

**Live observed.** GitHub API reports Actions disabled. The latest listed Release Verify run is [cancelled](https://github.com/tshuldberg/MyLife/actions/runs/30716741802); older ledgers are not approval for this tree. Local success does not replace the omitted PostgreSQL, object-storage, image, supply-chain and release checks. Release owner must restore the existing workflow, run it against an immutable candidate, and attach results. The cause of the disabled setting was not independently diagnosed; do not assert billing is still the cause.

### F5. High product gap: returning to a conversation is not yet a proven default experience

**Code observed; device outcome unverified.** Automatic foreground connections require the device-local opt-in flag. Scheduled background work remains disabled by default and needs native/provider proof. The browser has no mobile transport ladder. Host send/pull and join queues now exist, but a healthy relay does not mean a community's content is continuously available.

Make delivery state legible and recovery actionable. Offer an explicit onboarding choice to keep conversations up to date, respecting existing opt-in rules. Validate foreground return, background, force-quit, permission denial, cellular/Wi-Fi handoff, sleeping owner, delayed grants and duplicate deliveries. A generic “server reachable” card must never become “your friends are online.” [Automatic setting](../../apps/meerkat/app/(root)/data/auto-connect-core.ts), [background registration](../../apps/meerkat/app/(root)/data/background-task-registration.ts), [host writer client](../../packages/sync/src/node/feed-node-client.ts).

### F6. High workflow gap: the person shown in a QR may not be addable

**Observed.** The QR encodes the bare friend code before or after publication. The user must publish explicitly; the success copy says it is available for a short time. Universal-link association and a friend route are absent in the inspected app configuration. A code can look ready to share while its lookup is unavailable.

Ship a revocable, scoped invitation link with verified preview, explicit availability/expiry, in-app scan plus paste fallback, and a deliberate resume path after installation. Do not silently convert one-time private rendezvous into a permanent globally trackable identity. An install cannot be assumed to preserve a link across every store/browser; provide “Return to your invitation” and re-scan/copy fallback. Mandatory safety verification stays mandatory where policy requires it. [Add friend, lines 96–113 and 191](../../apps/meerkat/app/(root)/(tabs)/add-friend.tsx), [Plan 59](../plans/queue/59-meerkat-for-everyone.md).

### F7. Medium/high security audit item: deployment TURN credentials enter the client

**Observed design exposure, not a leaked secret reproduced here.** `buildIceServers` puts environment-supplied TURN username and credential into `extra.iceServers`. Clients necessarily receive credentials to use the relay; any static deployment credential shipped in a binary is extractable. Determine production credential lifetime and quotas. Prefer short-lived scoped allocation credentials, rate limits and spend ceilings; test expired credentials, replay and refresh. Do not market build-time environment variables as secret storage. [Config, lines 54–69 and 282](../../apps/meerkat/app.config.ts).

### F8. Medium claim boundary: local message history is not the sealed-blob vault

**Observed.** `cm_messages.body` and `dm_messages.body` are ordinary text columns; mobile opens standard Expo SQLite and web stores raw sql.js database bytes in IndexedDB. Sealed attachments and keychain-held secrets do not imply that every local chat row is application-encrypted at rest. OS device protection still matters; this is not a demonstrated remote disclosure.

Document a data-at-rest threat model covering unlocked devices, backups, browser extensions, injected scripts and exports. Decide whether app-level database encryption, an app lock and redacted app-switcher previews are required for the launch audience. Keep network encryption, local encryption and identity unlinkability claims separate. [Community schema](../../apps/meerkat/app/(root)/data/community-core.ts), [DM schema](../../apps/meerkat/app/(root)/data/dm-core.ts), [mobile open](../../apps/meerkat/app/(root)/data/meerkat-db.ts).

### F9. Medium: media permission explanations still describe future functionality

**Implementation follow-up, 2026-09-04:** Both camera plugin strings and microphone copy now describe current calls, rooms and QR scanning. Expo native-config introspection confirms the generated iOS wording and Android permissions. Physical permission-sheet verification remains open. [Verification log](../sessions/2026-09-04-meerkat-release-guard-polish.md).

**Observed in config; generated native wording needs verification.** The WebRTC plugin strings say Meerkat does not record audio/video and only a future feature uses the microphone/camera, while calls and camera-based flows exist. Another plugin may affect the final native values. Inspect the generated Info.plist and Android permissions, then test real permission sheets. Explain present purposes plainly. [Config, lines 135–142](../../apps/meerkat/app.config.ts).

### F10. Medium: feature count is outrunning discoverability and performance

Five top-level tabs coexist with extensive hidden routes and settings. The latest benchmark still scales linearly with signature-heavy history; bundles contain large chunks. Global message search was not found in the inspected shell/channel/feed surfaces, although downloads/library search exists. Prioritize bounded local search, catch-up, navigation and recovery before adding another editor mode. Audit accessibility on the actual screens, not only on these report concepts.

## Capability inventory and full-function destination {#features}

“Implemented” below means code paths exist. It does not mean signed-build or provider acceptance was collected today.

| Capability | Current evidence | Remaining production work / destination |
|---|---|---|
| Local identity and safety comparison | Shared sync identity, signed bundles, TOFU pinning, safety verification | Clean-device key durability, key-loss recovery, device replacement and mandatory verification usability. |
| DMs and group DMs | Shared chat kit, local DM rows, receipt-based states | Real two-device and multi-device replay, return, ordering, block and notification matrix. |
| Communities, channels, threads | Signed events, edits/tombstones, roles, mentions, reactions | Permission change and offline convergence under adversarial timing; simple first task. |
| Feed and unread | Local ranker with explanation and verified projections | Incremental computation, true catch-up, no hidden network fetching for previews. |
| Always-on community service | Writer/lifecycle wiring and durable join queue landed Sept 1 | Deployed host capacity, outage and asleep-owner grant behavior; queued does not mean admitted. |
| Library, files, readers and playback | Sealed blobs, pin policy, local readers, streaming implementation | Provider-specific restore, large media, hostile archive/HTML, low disk, interruption and unavailable-holder proof. |
| Backup and recovery | Identity recovery and storage destination machinery | Explain identity versus history versus attachments; prove each restored class on another device. |
| LAN/Nearby/WebRTC/BLE | Native adapters; BLE wake only; web relay-only | Real release hardware matrix, denial and missing-module states, no synthetic peer counts. |
| Calls and rooms | LiveKit/native integration and call routes | TURN/provider configuration, background incoming call, audio routing, interrupted call and removal tests. |
| Canvas, themes, pages, assets | Signed creative layer and owner/member authority rules | Accessible editor/reader, bounded media and parser stress, undo/conflict behavior, discoverability. |
| Public feed, personas, verification | Implemented public layers with fail-closed services and isolated account boundary | End-to-end deployment, moderation/appeals, anonymous-read proof, age/content policy and data deletion. |
| App purchase and hosted subscription | RevenueCat + hosted billing boundaries | Real purchase, restore, cancellation/refund, offline eligibility, web linking and cross-device entitlement proof. |
| Creator subscriptions and commerce | Layout types and placeholder-oriented block registry; Plan 58 queued | Real tier key lanes, claim/revocation, product schema, fulfillment, refunds/disputes, creator onboarding and store rules. |
| Public personal sites | Design/plan, not verified complete publishing path | Public-only renderer, custom domain, draft/preview/publish, accessibility and private-content leak tests. |
| Events, polls and cross-channel search | No complete general-purpose workflow established in this review | Search is launch-priority for working groups; events/RSVP and polls are next for clubs. |
| Clips and broader social graph | Media player and local feed are foundations, not a short-video platform | Capture/edit/compress/caption, vertical player, local ranking, public content supply, creator tools and moderation. |

Keep the full end state: private collaboration, expressive community pages, creator-owned commerce, and an optional public discovery layer. **Sequence by user dependency:** reliable private loop → useful community home → creator authority/commerce → public publishing/discovery → clips. Nothing about a good private beta establishes readiness for paid tier fulfillment or a public media network.

## The workflows people must be able to finish {#workflows}

These are proposed acceptance contracts, not measured conversion rates. Use 12 previously uninvolved participants across technical confidence levels, including keyboard/screen-reader participants. Do not count the founder guiding someone through a problem as unassisted success.

| Journey | Current friction | Proposed simple workflow | Acceptance target |
|---|---|---|---|
| Invited newcomer | Age/name/onboarding, purchase boundary, technical joining and unavailable grants can interrupt intent | Open invite → see inviter/community and cost → name → required safety check → join/request → first conversation. Preserve destination across every interruption. | At least 10/12 finish without coaching within 3 minutes, excluding payment/store install time; all can explain whether membership is pending. |
| Add a friend | Publish/code/relay details; bare QR | My code / Scan → signed preview → Add → conversation; show expiry before sharing and keep safety policy intact | 10/12 on native camera link or explicit fallback; expired/used/forged links never imply friendship. |
| Return tomorrow | Foreground opt-in, background limitations, host availability | App shows local history immediately → catches up when possible → exact pending/retry status | 100 scripted online/offline transitions without silent loss/duplicate application; latency distribution recorded. |
| Send a file | OS intake, staging, permission, recipient and storage are distinct | Choose destination once → show audience and size → send → recorded state → recipient verifies/opens | Every failure offers retry/cancel; “sent”, received and read remain separate evidence states. |
| Recover on a new phone | Recovery key and encrypted backup can be confused with all content | Backup status → recovery material → restore preview of identity/history/files → verify → resume | Ten synthetic destructive recovery drills, zero unexplained missing rows/files; lost capabilities explicitly enumerated. |
| Run a small community | Too many hosting/editor choices | Choose a starter layout → create one conversation and library → configure availability as owner → invite | Owner completes in 10 minutes; members never configure transport. Hosted option only appears purchasable when service is available. |
| Publish or sell | Attractive blocks can imply finished commerce | Preview as visitor/member/tier → validate audience/key authority → publish or fulfill confirmed purchase | No cross-audience bytes, no paid access from UI-only flags, no “paid” state without durable authority. |

The visual lab below recreates the existing Open Burrow palette and five-tab structure, then proposes simpler information order. All people, messages and receipts are sample content. Animations demonstrate proposed state transitions, never live delivery or implemented product behavior.

The [interactive HTML workflow lab](REPORT-meerkat-production-readiness-2026-09-04.html#visual-lab) includes four mobile journeys (invitation, delivery, recovery and profile/settings) and four community-home views (home, conversations, library and page).

### UI changes worth shipping

1. **One primary next action per empty screen.** An invited user sees the pending community first. An uninvited user sees “Create a space” or “Add a friend.” Service failures remain visible in context with a recovery action, not as the introductory story.
2. **Keep the five-tab information architecture for this release.** Fix labels, focus, back navigation and intent preservation before moving every route. The Public tab should explain availability and offer a useful exit when configuration is absent. It must not impersonate an active network.
3. **Make Me human-readable.** Name, avatar, add/share and backup status first. Fingerprints under safety verification; storage counters in Storage. Use exact terms such as “recovery key” until the format actually becomes a phrase.
4. **Separate everyday settings from diagnostics.** Profile, appearance, notifications, backup, privacy and help up front. Relay URLs, transport traces and development flags behind Advanced. Do not remove consent or security information.
5. **Add local search that respects permissions.** Search only locally available verified content, label incomplete history, and invalidate results on removal and deletion. Indexing must not create a second unprotected plaintext history export.
6. **Make custom spaces accessible.** High contrast beats theme; visible focus and large text survive wallpaper; canvas content has a reading-order/list alternative. Never hide essential chat navigation under freeform art.
7. **Use motion as feedback.** A 160–220 ms panel transition shows where an invite went. A receipt changes only on evidence. Reduced motion removes travel effects. No animated online lights, fake progress bars or endless ambient motion.

## Competitor gaps and defensible positioning {#competitors}

Official sources checked September 4, 2026. This is feature/workflow comparison, not a benchmark of security strength or an estimate of market share. Competitor list prices and offers change. No market size or traction is invented.

| Competitor / job | Established expectation | Meerkat's credible differentiation | Gap and priority |
|---|---|---|---|
| Signal: private conversation | Simple contact initiation, calls, groups, transfers/backups and common messaging tools. [Features](https://support.signal.org/hc/en-us/sections/360001602792-Signal-Messenger-Features), [usernames](https://support.signal.org/hc/en-us/articles/6712070553754-Phone-Number-Privacy-and-Usernames) | Community structure, local libraries and creative spaces alongside private messaging | Catch-up, contact links, recovery and notification trust are P0. Do not claim Signal-equivalent assurance from primitive choice. |
| Discord: community home | Familiar channels and voice/video; current audio/video is end-to-end encrypted. Its privacy model distinguishes message content. [Calls](https://discord.com/blog/every-voice-and-video-call-on-discord-is-now-end-to-end-encrypted), [privacy](https://discord.com/privacy) | Signed private community data and portable, expressive spaces | Daily delivery, live rooms, search and inviting are P0/P1. “Discord has no encryption” would be false. |
| Slack: finding and doing work | Search, channels and workflow integrations. [Features](https://slack.com/features), [search](https://slack.com/help/articles/202528808-Search-in-Slack) | Private local content and community ownership | Cross-channel search, notification controls, integrations, enterprise identity/admin and retention are gaps. Target small groups, not regulated enterprise replacement. |
| Element/Matrix: encrypted self-hosted collaboration | Encrypted messaging, calls, device verification, open-protocol interoperability and self-hosting. [Plans/features](https://element.io/pricing) | Potentially simpler personal-first libraries, creative spaces and explicit publishing boundary | Meerkat needs demonstrated ease and recovery; self-hosting plus encryption is not unique. Element's encrypted search is platform-dependent; do not imply universal parity. [Help](https://element.io/en/help) |
| SimpleX: privacy without global identifiers | Pairwise addresses, encrypted groups/media, calls and portable storage. [Product](https://simplex.chat/messaging/) | Rich structured community home and sharing | Minimized metadata is already a competitive category. Prove invitation usability without weakening privacy. |
| Briar: resilient offline communication | Direct sync, Wi-Fi/Bluetooth/Tor and asynchronous mailbox capability. [How it works](https://briarproject.org/how-it-works/) | Cross-platform community/content ambitions | Meerkat's native rungs need device proof; its BLE is wake-only. Do not claim disaster-ready equivalence. |
| Telegram: fast large-group communication | Cloud continuity and groups; Secret Chats are a distinct encryption mode. [FAQ](https://www.telegram.org/faq) | Private signed community architecture and explicit server trust boundaries | Fast joining, delivery and searchable history are expected. Explain encryption by feature instead of attacking all server-backed products. |
| Circle: paid community operation | Courses, events, memberships, directory, site tools and automations. [Plans](https://circle.so/pricing) | Personal data control and creative community composition | Events, onboarding automation, commerce and course progression are substantive gaps. A custom layout does not replace an operator workflow. |
| Patreon: creator revenue | Memberships, one-time sales, chats and publishing; standard page lists 10% plus additional fees. [Product/pricing](https://www.patreon.com/product/pricing) | Proposed creator-defined commerce with private content ownership | Tier enforcement, fulfillment, lapses, refunds, support and creator onboarding remain Plan 58 work. “0% Meerkat take” must not imply zero processor/store fees. |
| Reddit and TikTok: discovery and attention | Community content supply and moderation, or a personalized video feed. [Reddit community guide](https://support.reddithelp.com/hc/en-us/articles/15484256976148-Growing-your-community), [TikTok recommendations](https://support.tiktok.com/en/using-tiktok/exploring-videos/how-tiktok-recommends-content) | A chosen-community feed and possible local ranking | Content supply, discovery, video creation and moderation are separate programs. A private app with empty communities cannot substitute for these habits at launch. |

**The best opening is a community that already knows why it exists.** A 15–50 person art collective, club or independent project group has conversations and files to move, an organizer who can invite, and a reason to return. Treat this segment as a hypothesis to test, not established demand. High-risk activists and regulated organizations should not be the initial safety claim or assurance target.

## Audits required before each lane graduates {#audits}

Each audit must produce candidate hash/build IDs, configuration fingerprint without secrets, environment, timestamp, responsible owner, positive and negative controls, results, and remaining exceptions. A green screenshot or a plan marked done is insufficient.

| Audit / owner | Required adversarial cases | Exit evidence / lane |
|---|---|---|
| Browser durability / storage engineer | Two tabs; crash during flush; quota exhaustion; denied persistence; eviction; private browsing; upgrade; key/DB mismatch | F1/F2 regression and real-browser proof, bounded unsaved state, intact identity/history/files after recovery. Web/pilot gate. |
| Native lifecycle / mobile engineer + device testers | Fresh install, upgrade, kill during setup, cold link, foreground return, force-quit, permission denial, OS background restriction | Signed iOS and Android device recordings and state assertions. Every advertised platform. |
| Independent protocol/security review / external reviewer | Identity substitution; safety comparison; replay/reorder; downgrade; membership removal; epoch/history access; per-message versus group secrecy; cross-device linking | Written threat model and resolved high-severity findings. All private lanes. Shared sync owns crypto; do not parallel-build primitives. |
| Host and transport abuse / backend engineer | Unauthenticated resource allocation, join queue caps, stale/forged descriptor, host impersonation, replay, payload bounds, TURN abuse | Bounded disk/memory/CPU, fail-closed authorization, load traces and spend limits. Hosted/public lanes. |
| Isolation and privacy / security + privacy owner | Account/persona correlation, request logs, crash exports, CDN/push metadata, public/private boundary, storage plaintext | Data flow inventory and sanitized logs; no private identity linked to verification account. Private and public, scope-specific. |
| Billing and entitlement / billing owner | Purchase/restore, refund, chargeback, cancellation, offline/revalidation, duplicate webhook, cross-device purchase, outage | Actual store/provider sandbox then selected live proof; access follows durable authority. Every paid lane. |
| Restore and migration / storage owner | Each advertised provider; revoked OAuth, partial upload, corrupted block, wrong key, low disk, device loss, schema rollback | Another-device recovery of known fixture hashes; no orphaned keys or silent omissions. Every advertised backup route. |
| Community authority / application security | Removal racing an offline send; reaction/tombstone replay; tier/role downgrade; forged canvas/assets; stale join approval | End-to-end multi-client state convergence and revoked future access. Community/creator lanes. |
| Safety and store policy / safety owner + counsel | Report/block flows, appeal and incident queue, anonymous/public content, age signals, prohibited content and processor restrictions | Approved applicable policy, staffed escalation, dry-run case records and accurate listings. Private UGC is not automatically exempt. |
| Media and editor / security + accessibility | Hostile EPUB/CBZ/HTML/SVG; decompression bombs; image metadata; external fetches; giant canvas; wallpaper contrast | Parser/resource bounds, no unintended network, readable alternate view and accessible controls. Files/creative lanes. |
| Accessibility and usability / designer + participants | Screen reader, keyboard, 200% text, focus after modals, touch targets, reduced motion, novice joining | Core journeys completed without coaching; issues fixed and retested. General availability. |
| Operations / release + infrastructure owner | Replica/store outage, corrupt backup, unavailable founder, certificate expiry, provider failure, rollback with schema compatibility | Practiced restore/rollback, observable alerts, named response coverage, recovery targets. Hosted/public lanes. |
| Supply chain / release engineer | Current dependency scan, native compatibility, signed artifacts, image digest/provenance, config/profile checks | Exact-candidate Release Verify plus artifact attestation. No reuse of September 2 advisory counts as today's clean scan. |
| Performance / performance engineer | Slow phone, 10k event history, large library, incremental updates, 24h soak, battery and data budget | Agreed latency/memory/battery thresholds on hardware; no verification shortcuts. General availability. |
| Creator commerce / commerce engineer + counsel | Replay/double claim, lapse/removal, partial fulfillment, refund, audience leak, lost owner key, payment policy | Real tier keys and durable fulfillment; named dispute process. Required before marketing shops/memberships. |

Apple's review guidelines require appropriate controls for user-generated content and have specific payment rules. Google Play also requires moderation/reporting/blocking appropriate to the UGC experience. “Invite only” does not remove every obligation. A neutral age gate does not automatically make all lawful adult content store-distributable. The Plan 58 “any legal content” ambition needs explicit distribution and processor-policy review before it is a promise. This is a product-policy audit requirement, not legal clearance. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en).

### Threat rehearsal: what an adversary or ordinary failure would try

| Actor / failure | Attack on the product promise | Required defense to demonstrate |
|---|---|---|
| Two legitimate tabs | Each saves a valid but stale database | One writer or semantic concurrency; no lost local work. |
| Full disk / browser quota | App reports success before durable persistence | Distinguish locally displayed from durably saved; retain/retry/export safely. |
| Malicious invite sender | Spoof a name, inject a host, reuse an expired grant | Signature and scope checks; endpoint bounds; verified preview; no implicit trust in an address. |
| Removed member | Replay old grants or ask for new library keys | Epoch enforcement and history policy survive offline timing. |
| Compromised community host | Reorder/drop events or return forged content | Verify before apply; surface unavailability; host receipt never means human receipt. |
| Abusive public participant | Flood uploads/reports or evade moderation | Bounded intake and operated safety workflows; not private-message scanning by accident. |
| Stolen unlocked device | Read SQLite history, exports and notifications | Explicit at-rest/app-lock policy and realistic claims. |
| Founder unavailable | Incident needs credentials and judgment no one else has | Practiced rollback, recovery access and coverage; launch timing alone is not resilience. |

## Launch and marketing {#launch}

### Positioning and proof

Proposed headline: **“A private home for your community.”** Supporting line: “Conversations, posts, and a shared library in a space your group makes its own.” Demonstrate one small group doing a real task. Explain privacy with concrete boundaries after the value is clear.

A draft acquisition page should show: a real community home; invite-to-first-reply demonstration; useful library; clear app and optional hosting prices; a short privacy/availability explanation; and a call to action matching actual availability. Today that action is **“Join the pilot”**, not “Start your always-on community.” Do not publish or collect signups until the intended destination and consent are configured.

Repository pricing is founder-locked at **$4.99 one-time app unlock** and **$4.99/month optional hosting**. These are product configuration amounts, not verified regional storefront quotes. The hosted subscription includes storage subject to configured quota. Preserve those prices in launch materials; no pricing change was made or assumed. [Billing configuration](../../packages/billing-config/src/index.ts).

### Community-led launch sequence

| Stage | Work and owner | Evidence to advance |
|---|---|---|
| Readiness work | Engineering closes F1/F2 and release guard; release owner chooses capability set; designer tests invitation/recovery | All core audit gates above pass. Marketing can prepare assets meanwhile. |
| Concierge pilot, proposed 2 weeks | Founder recruits five organizers through existing relationships; each brings 10–25 consenting people; seed an introduction, one question and one useful file | Record actual group return, friction and support load. Numbers are recruitment targets, not current traction. |
| Second cohort, proposed 2 weeks | Add 10 communities across two validated use cases; organizer receives invite kit and a short setup session | Groups can start and operate without founder rescue; no silent loss; clear delivery expectations. |
| Public release | Release owner signs exact-artifact go decision; launch owner publishes proven demo, store pages, comparison page and honest FAQ | Operations and support coverage active; links and purchases tested; release can be rolled back. |
| Expansion | Follow the use cases that retain; ship local search/events where demand supports it; graduate creator rails independently | Repeatable activation and contribution from members besides the organizer. |

Channel order: organizer introductions, demonstrations in relevant communities with moderator permission, credible privacy/open-source writeups, then broader launch venues. Use “moving our project archive and discussion” case studies. Paid acquisition is a later experiment, because buying installs into an unreliable or empty network magnifies churn. This is a strategic recommendation, not a forecast. Reddit's own guidance favors useful seeded content and relevant, permission-respecting promotion. [Community promotion guidance](https://support.reddithelp.com/hc/en-us/articles/15484256976148-Growing-your-community).

### Measure usefulness without surveillance

Use consented pilot interviews, organizer-maintained cohort totals and optional local diagnostic exports reviewed by the participant. Do not add SDK analytics, advertising pixels, fingerprinting or a central private social graph. Keep account/payment records separate from private device/community identities. Delete interview notes on an agreed schedule and avoid private message content in reports.

Proposed decision thresholds: at least 10/12 unassisted invite completions; at least four of five pilot groups still using the app in week two; at least three contributing members besides the organizer in each retained group; zero unreconciled lost-data incidents; all seeded reliability scenarios accounted for. These are gates to learn from small cohorts, not statistical proof of product-market fit. Capture reasons when groups leave.

### Marketing assets and claim limits

| Asset / message | Ready-to-produce direction | Evidence needed before publication |
|---|---|---|
| 45–60 second demo | Invitation → real reply → open shared file → next-day return | Capture actual release devices, not this report's simulated UI. |
| Store screenshots | Community home, chat, library, privacy choices, recovery | Every depicted control works in the submitted build. |
| Discord/Signal comparison | Community structure and ownership alongside familiar messaging | Cite feature-specific claims; no “only encrypted community app” superlative. |
| Pricing FAQ | App unlock versus optional hosting; who pays; storage quota; restore/refund | Current store offerings and hosted-service behavior. No promise of unlimited lifetime server service. |
| Privacy explainer | Device-local data, encrypted transfers, public publishing as an explicit choice | At-rest and metadata boundaries from the audit; no “untraceable”, “zero metadata” or universal deletion claim. |
| Creator story | Expressive community design today; commerce roadmap clearly labeled | No paid-membership or storefront promise until tier authority and fulfillment graduate. |
| Availability FAQ | Offline reading of locally held content; transfer depends on reachable holders/services | Hardware/provider results for every claimed rung and notification mode. |

A one-time app sale does not inherently fund indefinite relay bandwidth, support and safety operations. Before broad promotion, measure per-active-community hosting, storage, transfer, payment and support costs with privacy-safe aggregate operational data. Use those costs to set honest capacity and service terms within the existing pricing decision; do not invent margins or forecast revenue.

## Execution order and exit contract {#next}

1. **Storage engineer:** in `apps/meerkat-web/src/lib/storage/browser-database-adapter.ts`, fix F1/F2 first. Add real concurrent-context and failure/recovery tests. Done when both probes fail against the old code and pass against the fix, with no lost signed events, deletes or keys. If implementation requires a single-tab mode first, make the second tab explicitly read-only and test safe takeover.
2. **Release engineer:** in `apps/meerkat/scripts/check-build-env.mjs` and `apps/meerkat/eas.json`, define a private release capability set and validate store-distributed profiles. Done when missing required configuration rejects the artifact, while intentionally unavailable capabilities are gated honestly. Investigate native image drift before changing the pinned version.
3. **Release owner:** restore GitHub Actions and run the existing [Release Verify workflow](https://github.com/tshuldberg/MyLife/actions/workflows/release-verify.yml) against a frozen commit. Administrative access/billing actions belong to the owner. Done when the candidate has an attached successful run and all required integration jobs actually execute; a disabled workflow or skipped required service remains a no-go. The existing [founder operations runbook](../guides/meerkat-founder-ops-runbook.md) provides the operational handoff.
4. **Product and engineering:** implement the invitation, catch-up, recovery and settings improvements within Plans 57/59. Keep safety verification and opt-in boundaries. Done when the workflow study and device scenarios pass. If a service is absent, show a truthful alternate action and keep the relevant release lane closed.
5. **Security, safety, billing and operations owners:** collect lane-specific evidence from the audit matrix. These are independent sign-offs; missing counsel/provider/device work does not block local code fixes, but it does block claims that depend on it.
6. **Founder:** choose the capability set and initial community segment, then sign the go/no-go record for exact artifacts. Broad launch begins only after the gates pass. No date estimate in this report substitutes for that decision.

The private general-availability exit contract is: no unresolved high-severity defect in the released surface; core user journeys validated; durable recovery demonstrated; real purchase and return delivery proven; appropriate safety operations and store policies satisfied; current automated release checks; and a practiced operational recovery path. Public, hosting and creator-commerce capabilities add their own gates rather than inheriting approval.

## Reproduction and provenance {#appendix}

### Database probes

The probe used the production `createBrowserDatabaseAdapter` and the real sql.js engine, with a deterministic byte store implementing its `DbBytesStore` interface. It did not edit a user's browser database.

```typescript
// Shared store models the one IndexedDB sqlite/db record.
let bytes: Uint8Array | null = null;
const store = {
  async read() { return bytes; },
  async write(next: Uint8Array) { bytes = new Uint8Array(next); },
};
// Create table and flush with a seed adapter. Then load A and B.
// A inserts ('a', 'message from tab A'), flushes.
// B inserts ('b', 'message from tab B'), flushes.
// A fresh adapter reads only b, demonstrating stale whole-image overwrite.
// For retry: injected write throws on attempts 1..20, succeeds on 21.
// flush() attempts all 21 immediately; production has no retry cap/backoff.
```

The complete runnable probe is preserved in [the session log](../sessions/2026-09-04-meerkat-production-review.md). It supplies `locateFile` from the browser package's installed sql.js and uses only in-memory fixture bytes. Run with the workspace relay package's installed `tsx`; root `pnpm exec tsx` is unavailable in this checkout. No product function logic changed, so the function-change gate is not applicable to this report-only task.

### Evidence hierarchy

Fresh executions and directly inspected code support F1–F10. Historical reports informed investigation but were not accepted as current proof. Plan 58's missing tier/commerce work was cross-checked against the layout types and registry. The full end-to-end feature inventory is a code-level assessment with the limits stated above. No numeric readiness score is assigned because it would conceal lane-specific blockers. The generated-artifact guard also passed; archive checksums and report source links were verified.

[Archive manifest](../archives/meerkat-readiness-2026-09-04/README.html) identifies superseded reports. Release ledgers, legal drafts, designs and user guides remain supporting historical or operational artifacts; they are not a competing launch verdict. Report prototypes are proposals and are explicitly disconnected from production data.
