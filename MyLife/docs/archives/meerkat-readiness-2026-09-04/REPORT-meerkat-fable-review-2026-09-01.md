# Meerkat Full Review (Fable 5.1), 2026-09-01

Reviewer: Claude Fable 5.1, inline. Tree: `ee80cd7b` on `docs/meerkat-launch-guides-2026-09-01` (14 commits ahead of `origin/main`, includes the plan 57 merge). A seven-agent parallel fleet was dispatched and every agent died at spawn on the account session limit (resets 11:50pm America/New_York); the fleet prompts are saved in `apps/meerkat/docs/prompts/REVIEW-FLEET-2026-09-01.md` for re-dispatch. Everything below was verified by the orchestrator directly against code, gates, or a proof-of-concept run.

## 1. Verdict

Meerkat is in a stronger state than its own open-issue ledger suggests. The full gate battery is green on HEAD, the crypto and honesty invariants that earlier audits fixed still hold, and the codebase has no import cycles and near-zero hygiene debt. The concentrated risk is in the newest, least-reviewed layer: the plan 57 self-host community node, where two resource-exhaustion paths are confirmed. Behind that sit three structural debts that raise the cost of every future change: unlocked twin drift across roughly 40 shared cores, four god files over 2,400 lines, and a stale process ledger (31 auto-logged error rows and an instruction file that no longer matches the tab bar).

## 2. Baseline (ground truth, measured tonight)

| Surface | Typecheck | Tests | Notes |
|---|---|---|---|
| `packages/sync` | clean | 207 files, 2,624 passed, 3 skipped | |
| `packages/meerkat-relay` | clean | 210 files passed, 35 skipped; 1,622 passed, 189 skipped | skips are env-gated integration lanes (PostgreSQL, S3, LiveKit, loopback) |
| `apps/meerkat` | clean | 165 files, 1,815 passed | |
| `apps/meerkat-web` | clean | 151 files, 1,230 passed | |
| Parity | `check-meerkat-parity` green | | `check:esm-require` green |

Code shape: mobile 126k lines, web 96k, sync 126k, relay 134k. Import cycles: zero in all four packages (Tarjan scan over non-test modules). Production `any` uses: 17 total across four packages. `@ts-ignore`: zero. `console.log` in production source: zero. Source-lock tests (tests that read source text) are 14 of 164 mobile test files and 13 of 151 web, so about 9 percent; the rest are behavioral.

## 3. Invariants re-verified as holding

- Sync sessions default to required encryption; plaintext only when both sides explicitly opt `encryptionMode 'off'` (`packages/sync/src/protocol/sync-session.ts:943-951`). Every session wraps in the pairwise frame envelope and fails before the first byte if the peer is not paired (`:952-975`). Batch signatures are mandatory on send (`:2103`) and verified on receive with `missing_batch_signature` / `bad_batch_signature` rejects (`:1866-1883`).
- The community sync policy matrix is identical on both twins (46 rules; every created `cm_` table has a rule; `cm_read_state`, `cm_library_progress` stay `personal_replica`; `cm_publications` is the sole `published_blob` escalation).
- Web CSP is strict (`script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`, `base-uri 'none'`). The epub reader renders in a sandboxed `srcdoc` iframe with its own CSP; no `dangerouslySetInnerHTML` anywhere in web UI; `localStorage` holds only the theme key.
- Mobile `EXPO_PUBLIC_*` reads are all literal member expressions (the babel-inlining trap fixed on 2026-08-30 has not regressed).
- Relay WebSocket servers set `maxPayload`; trusted-proxy hop handling is used by the community node's per-IP limiter; join-queue tokens are validated against a 64-hex pattern and envelopes are size-capped.

## 4. Findings

Severity: CRITICAL / HIGH / MED / LOW. Confidence: CONFIRMED (traced or reproduced) or PLAUSIBLE.

### R1. HIGH, CONFIRMED (PoC). Unauthenticated challenge requests leave one file per arbitrary community id on the self-host node, forever

`GET /community/{id}/challenge` (`packages/meerkat-relay/src/community-node-http.ts:733-745`) is open by design, is the only community route that does not pass through `admitPublicRequest` (the per-IP limiter), and `CommunityNode.issueChallenge` (`community-node.ts:1099-1112`) never checks `hasCommunity`, so any id is accepted. With `FileCommunityPrivateStateStore` (the DATA_DIR self-host authority), `issueChallenge` writes `<hex(id)>.private-state.json` for the new id (`community-private-state-store-file.ts:137-160`). `evictUnclaimedAtLimit` and `sweepExpired` only empty the `challenges` map; neither ever unlinks a file (`:431-443`, `:505-530`). PoC (`scratchpad/poc-private-state-files.mts`, run tonight): six challenges with `maxUnclaimedCommunities=2` produced six files; after TTL expiry and `sweepExpired` the six files remain while `trackedCommunityCount` reports zero. Every subsequent issuance re-reads every file under the global lock, so cost grows linearly with the spray. Attacker: anyone who can reach a self-hosted node (hosted deployments require a bearer entitlement first, which bounds the attacker to paying users). Impact: inode and disk exhaustion plus O(N) IO per challenge. Fix: (a) route the challenge path through `admitPublicRequest`; (b) unlink the state file when a community is unclaimed and has no live challenge (in sweep and evict); (c) bound `communityId` length at the route (`safeDecode`) so hex filenames cannot exceed the filesystem limit and throw inside the store.

### R2. HIGH, CONFIRMED (traced). The durable join queue file can grow to about 1 GiB per community and is fully parsed on every operation

`JOIN_QUEUE_LIMITS` allows 512 tokens x 32 entries x 64 KiB envelopes per community (`community-join-queue.ts:52-64`). `FileCommunityJoinStore` keeps one JSON file per community and `JSON.parse`s the whole file on every `park`, `list`, `ack`, `count`, and `tokenCount` (`:236-330`), and `CommunityJoinQueue.park` calls `store.sweep` first, which reads and rewrites every community file in the directory (`:120-128`, `:298-320`). The unauthenticated park lane accepts any token derivable from the descriptor (`community-node-http.ts:851-865`), so any descriptor holder (every member, any ex-member who kept it) can fill every member's box. Per-IP limiting (120 requests per minute) slows a single source but does not bound the file. Impact: a self-host node becomes IO-bound and every join operation for that community stalls. Fix: cap total parked bytes per community (for example 8 MiB) and refuse with a typed `community_full`; store one file per token box instead of one per community; throttle the directory-wide sweep to at most once per interval rather than per park.

### R3. MED, CONFIRMED (design-accepted, should be revisited). Any descriptor holder can ack (delete) another member's parked join handshakes

The header comment in `community-join-queue.ts` states possession of a derivable token is the read and ack capability, "exactly as on the relay". On the relay the mailbox is a 5-minute cache; on the node it is the durability guarantee plan 57 W4 exists to provide. A malicious member can derive the owner's token and ack every parked request, silently reproducing the asleep-owner loss the feature was built to close. Fix: require the ack to be signed by the recipient device key (the node already verifies feed-auth headers for the authenticated park lane; reuse that verifier for ack).

### R4. MED, CONFIRMED. No process-level rejection handlers in any of the 24 relay binaries

No `bin/*.mjs` or `src/*.ts` registers `process.on('unhandledRejection')` or `uncaughtException`. Under Node 15+ an unhandled rejection terminates the process; compose restarts it (`restart: unless-stopped`), so the effect is a connection-dropping restart, not data loss, but any request path that can produce an unhandled rejection is a one-request denial of service. Fix: register a handler in each bin that logs a structured line and keeps serving (or exits deliberately after draining), and add a test that a rejected promise in a route handler yields a 500 rather than a crash.

### A1. MED, CONFIRMED (mobile); web instance refuted on inspection. Provider promise chain with no catch

- Mobile `SyncProvider.tsx:892`: `void engine.initialize().then(...)` with no `.catch`. If the engine fails to initialize (schema error, secure-store failure), the rejection is unhandled and the provider stays in its pre-initialized state with no error surfaced to the user.
- Web `MeerkatProvider.tsx:3959`: `void db.flush().then(() => refresh())` in the mailbox `onApplied` seam looked like the same class, but on inspection the browser database adapter's `persistNow` catches its own write failure and re-arms (`storage/browser-database-adapter.ts:83-87`), so `flush()` never rejects there. Not a live defect; the refresh was made unconditional as a defensive change only.

Fix (mobile): catch the rejection into an `initError` context value and have the Sync screen say "Engine failed to start: ..." instead of spinning. Applied in this session.

### P1. MED, CONFIRMED. Roughly 40 shared cores drift between the mobile and web twins with no lock

A file-level diff of `apps/meerkat/app/(root)/data/*.ts` against `apps/meerkat-web/src/lib/*.ts` shows large non-comment drift in cores that are supposed to be shared logic, not platform adapters. Examples: `channel-view-core.ts` (mobile maps `ChannelChatItem` wrappers, web maps raw events, different function names `mapChatItemToKit` vs `mapEventToKit`), `humanity-core.ts` (mobile deletes the token setting when empty, web writes an empty string; the mobile enum has three challenge kinds, web one), `channel-history-import.ts` (mobile has `replicateImportedHistoryEvents`, web has a different result type and no replication helper in the same file), `community-template-commit.ts` (different input types; this file was the rc13 defect site). `check-meerkat-parity` locks specific strings and a handful of twins, not these cores. Impact: the 2026-07-29 rc13 defect class (web template commit drifted from mobile) is structurally free to recur. Fix: move the pure cores into a shared package (`packages/meerkat-core` or `packages/sync/src/app-core`) consumed by both apps, leaving only the adapters (`expo-*`, `web-*`) per surface; until then, extend the parity script with a byte-identical lock list for every file whose only intended difference is its import lines.

### P2. MED, CONFIRMED. Four god files over 2,400 lines, two over 4,200

`community-core.ts` 4,294; `MeerkatProvider.tsx` 4,286; `meerkat-data.ts` 4,214; `SyncProvider.tsx` 2,899; `community-node.ts` 2,445; `sync-session.ts` 2,268; `storage/router.ts` 2,265. Churn confirms these are the change hotspots (the two providers are the second and fourth most-committed files). Impact: every feature wave touches the same files, reviews are shallow, and the plan 58 worktree is already editing `MeerkatProvider.tsx` and `meerkat-data.ts` concurrently with this branch. Fix: split by domain (community, dm, library, canvas, public) with the existing pure cores as the seams; the providers should compose domain hooks rather than own every seam.

### P3. LOW, CONFIRMED. 31 Unresolved auto-logged error rows dated 2026-07-29 are stale

All 31 are `PostToolUse` stubs of mid-edit typecheck and test failures (for example `Cannot find name 'listDmOwnDevices'`, `person-identity-core.test.ts` failures). Tonight's green baseline proves none reproduce. Older stubs from 2026-07-06 and 2026-07-12 are in the same state. Impact: the ledger overstates open defects and hides the two real Unresolved rows (2026-08-29 asset-pack block-fetch bound; 2026-07-11 push-gateway O(n) rotate). Fix: mark the stubs Resolved with the baseline as evidence in one pass.

### P4. LOW, CONFIRMED. `apps/meerkat/AGENTS.md` describes a tab bar that no longer exists

It says the five visible tabs are Feed, Communities, Discover, Messages, Me. The layout (`app/(root)/(tabs)/_layout.tsx:61-107`) ships Feed, Communities, Public, Messages, Me, with Discover hidden via `href: null`. Fix: correct the sentence.

### S1. LOW, PLAUSIBLE. Sync barrel split is intentional but undocumented

`index.ts` exports 30 names `index.native.ts` does not (BlobStore, LANTransport, PieceManager, handshake helpers, `createSyncManager`, `runShareSession`), and native exports 17 names web does not (BLE, Nearby, WebRTC transports and their `Simulated*` backends). Nothing asserts the shared subset stays identical. Fix: a test that the intersection of exported names is identical in signature, and a comment block naming the intended platform-only sets.

## 5. Product goals versus code (what was checked)

The 2026-09-01 investor pitch and the AGENTS.md honesty boundary were read against the code. The pitch's "implemented and demonstrable today" list is consistent with what the code does: it explicitly disclaims hosted-node operations and creator rails as not shipped, and every capability card in the app derives from probes and recorded sessions. No UI string implying a peer is online or a message was delivered without a protocol row was found in the seams checked (connection card, mailbox drain, join queue copy). The plan 57 community server is shipped as code on both surfaces and is the surface with the findings above, which is the expected profile for a two-day-old wave. The plan 58 creator rails are in flight in a separate worktree and were not reviewed.

## 6. Improvements ranked by leverage

1. Fix R1 and R2 before any self-host node is offered to a community owner; both are cheap and the node is the product's next revenue surface.
2. Extract shared pure cores into one package consumed by both apps (P1), then let the parity script shrink to true platform seams. This is the single change that most reduces future defect rate.
3. Split the four god files by domain (P2) in the same pass, since the extraction forces the seams anyway.
4. Add rejection handlers to relay binaries and the two provider chains (R4, A1).
5. Re-run the seven-agent fleet after the limit resets to cover what this pass could not: full adversarial crypto review of the sync protocol, full relay authz sweep, full screen-by-screen mobile and web sweeps, and the git-history process audit.

## 7. Fixes applied in this session (branch `fix/meerkat-fable-review-2026-09-01`)

- R1: challenge route rides the per-IP limiter; community ids bounded to 96 chars at the edge; the file store removes an unclaimed community's file when it owns nothing (`isEmptyState`). PoC re-run: 2 files at the cap, 0 after sweep. New test `community-node-challenge-spray.test.ts`.
- R2: `maxBytesPerCommunity` (8 MiB) on the join queue with `byteCount` on both stores, typed `community_full` refusal; directory sweep throttled to once per 60 s with `list` filtering expired entries itself. Two new tests in `community-join-queue-e2e.test.ts`.
- R4: `unhandledRejection` (log and keep serving) and `uncaughtException` (log and exit 1) guards in the 15 long-running relay bins.
- A1: mobile `initError` in the sync context and on the Sync screen.
- P3: 52 stale auto-logged stubs (2026-07-06, 07-12, 07-29) marked Resolved with the baseline as evidence.
- P4: AGENTS.md tab-bar sentence corrected.
- Not done (recommended follow-ups): R3 signed ack, P1 shared-core extraction, P2 god-file split, S1 barrel lock.

## 8. Coverage and limits

Verified directly: baseline gates; sync session security defaults; policy matrix parity; web CSP, sandboxing, storage; mobile env inlining; relay community-node challenge, join-park, join-box, join-ack, piece routes; join queue store; private-state file store; provider promise hygiene; twin drift measurement; import cycles; hygiene counts; error-log currency; AGENTS.md tab claim.

Not covered tonight (needs the fleet or a second session): the account service and blind-credential server end to end; Stripe and hosted billing; archive intake, malware scan, DMCA, GDPR flows; postgres stores; every screen on both surfaces; sync storage router, CRDT, blob pipeline internals; git-history commit-claim audit; dependency advisories (the audit command timed out). `pnpm audit` should be run per package in a later session.
