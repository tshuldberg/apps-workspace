# Meerkat bug audit and remediation, 2026-08-24

## Outcome

Reviewed the Meerkat mobile app, sync package, relay services, account boundary, transport selection, and parity seams. Seven product defects were confirmed and fixed. Two development regressions were caught and resolved by the repository gates. No known code-level finding from this audit remains unresolved.

## Resolved findings

| Severity | Defect | Root cause | Resolution |
|---|---|---|---|
| High | Caller-controlled `X-Forwarded-For` could bypass relay and public-service rate limits. | HTTP surfaces treated the first forwarded address as authoritative without an explicit proxy trust boundary. | Added a single client-address resolver that defaults to the direct socket, trusts only a configured hop count, and falls back to the direct address when the chain is incomplete. Every affected service now receives `MEERKAT_TRUST_PROXY_HOPS`; production compose declares the one Caddy hop. |
| High | Delete and recreate could obtain another anonymous credential during the same epoch. | Account deletion erased the only record used to enforce the per-epoch issuance allowance. | Added epoch-bounded SHA-256 subject tombstones to memory, file, and PostgreSQL stores. The PostgreSQL path serializes delete/recreate races with transaction advisory locks. Sign-in fails honestly with `account_deleted` until the epoch boundary, without storing a raw provider subject. |
| Medium | A malformed or far-future LWW timestamp could permanently suppress legitimate sync updates. | Generic LWW conflict resolution delegated validation to permissive JavaScript date parsing and had no future-skew bound. | Added strict canonical RFC3339 UTC and SQLite UTC parsing, real calendar validation, a five-minute skew cap, numeric comparisons, poisoned-local repair, and explicit audit reasons. |
| Medium | React Native WebRTC was shown as available but could never complete through the sync engine. | The native backend requires an external signaling exchange, while the engine created it without signaling. The same path also conflated outgoing and inbound sessions. | Added an engine signaling contract and a mobile signaling manager using pair-authenticated, encrypted, short-lived relay messages. Availability now requires that manager. Inbound and outbound session directions are handled independently. Relay selection remains behind `effectiveRelayUrl`. |
| Medium | Credential Base64 decoding accepted noncanonical aliases. | Decoding validated characters and bytes but did not prove that the input was the unique canonical representation. | Added decode-then-reencode equality enforcement and deterministic forged-credential coverage. |
| Medium | Sync provider effects could retain stale context and mode values. | Required React hook dependencies were omitted, and one dependent UI path retained unused state. | Restored complete dependencies and removed the stale unused state without changing the public behavior. |
| Low | In-person UI implied that unsigned pairing codes were supported. | Copy had drifted from the signed-only parser contract. | Changed the instructions to state the signed pairing-code requirement accurately. |

## Safety properties preserved

- The mobile app still owns no cryptography. New encryption and authentication use `@mylife/sync` primitives.
- WebRTC relay signaling carries pair-encrypted payloads under opaque session tokens, with device binding, expiry, skew checks, replay rejection, and bounded field sizes.
- All relay dialing still passes through `effectiveRelayUrl`, preserving free-default health gating and opt-out behavior.
- Account tombstones are domain-separated hashes. They do not place account identifiers beside Meerkat device or persona identifiers.
- The LWW repair accepts the existing SQLite timestamp form while rejecting ambiguous, invalid, and excessively future values.
- Trusted proxy behavior is off by default. Direct deployments cannot gain trust from a spoofed forwarding header.

## Verification evidence

| Surface | Verification | Result |
|---|---|---|
| Meerkat mobile | Full Vitest suite | 148 files, 1,509 tests passed |
| Sync package | Full Vitest suite | 201 files passed, 2,522 tests passed, 3 skipped |
| Meerkat relay | Full Vitest suite | 208 files passed, 35 skipped; 1,608 tests passed, 189 skipped |
| Changed functions | `pnpm gate:function:changed` | Passed for mobile, web, relay, sync, and downstream mobile/web consumers |
| Static checks | App, web, relay, and sync typechecks; app, web, relay, and sync lint | Passed |
| Product parity | `pnpm check:meerkat-parity` and `pnpm check:parity --quiet` | Passed |
| Transport honesty | `pnpm check:meerkat-transport-nc` | Passed |
| Repository hygiene | `pnpm check:generated-artifacts` and `git diff --check` | Passed |

The changed-function gate includes focused deterministic fuzz, complexity, memory, and contract checks for client address derivation, account tombstone hashing, credential Base64 decoding, LWW document application, and transport availability.

## Validation limits

- The PostgreSQL account-store integration suite contains five environment-gated tests. They were skipped because no integration database was configured; memory and file adapters plus service and HTTP behavior ran locally, and the migration and PostgreSQL implementation passed typecheck and focused static gates.
- The native WebRTC backend and the encrypted signaling manager were tested independently in Node. A real two-device dev-build run is still required to produce hardware and native ICE evidence.

## Change organization

- `packages/sync`: timestamp hardening, canonical credential decoding, and external WebRTC signaling support.
- `apps/meerkat`: encrypted signaling manager, honest transport availability, provider wiring, account copy, dependency corrections, and pairing copy.
- `apps/meerkat-web`: parity-preserving person-identity twin cleanup.
- `packages/meerkat-relay`: trusted-proxy boundary, deletion tombstones, PostgreSQL migration 19, service wiring, deployment configuration, and regressions.

No external service was mutated and no branch was pushed during this audit.

## Post-review addendum (same day, second session)

The tombstone and WebRTC lanes above were re-reviewed by two adversarial agents. The WebRTC lane review returned 2 HIGH resource-safety issues and an architectural duplication finding (all dev-build-only, tracked for rc19). The tombstone lane review found two CRITICAL blockers that the green Vitest suite masked; both are now fixed and verified here.

| Severity | Defect | Root cause | Resolution |
|---|---|---|---|
| Critical | Account service throws `ReferenceError: require is not defined` on first production deploy; sign-in and delete return 500. | `accountSubjectTombstoneHash` and `randomId` obtained `node:crypto` via `require()` inside an ESM (`type: module`) package run under `tsx`. Vitest injects a CJS `require` shim, so all 40 account tests passed while the real runtime threw. | Replaced both lazy requires with a top-level `import { createHash, randomBytes } from 'node:crypto'`. Reproduced the throw under `node --import tsx` and confirmed the fix there. |
| Critical | Delete-and-recreate still mints a second credential for one epoch, one cycle later, defeating the Sybil fix. | `recreateAfterMs` bounded to the current epoch's window, but issuance permits `currentEpoch + 1` during the 7-day renewal window, so a pre-minted next-epoch credential outlived its own tombstone. | Bound the tombstone to the highest claimable epoch (`isWithinRenewalWindow(now) ? currentEpoch + 1 : currentEpoch`). Verified against the reviewer's end-to-end PoC (attack now blocked) and added a renewal-window regression test the prior suite lacked. |

Verification: relay suite 208 files / 1609 tests passed (up one, the new regression test); relay typecheck clean; account suites 46/46.

Still open from the full-system review, tracked for rc19: tombstone HIGH-1 (anti-abuse flags such as `store_minor` are not carried across deletion) and MED-1 (the subject hash is unkeyed SHA-256, a membership oracle to a DB reader; should be HMAC under a server secret), and the 2 HIGH WebRTC resource-safety bugs plus its re-implementation of `call-signal.ts` with weaker semantics.

## Pairing trust-root (the crypto HIGH), resolved for Meerkat

A read-only map of the full pairing surface found that in the Meerkat standalone app every live pairing path (paste an MKPAIR1 code, QR, friend code over relay, in-person tap) already routes through one authenticated rail: `parseSignedPairingPayload` -> `verifySignedIdentityBundle` -> `applyTrustedBundle` -> TOFU pin -> `completePairing`, with the X25519 DH key inside the Ed25519-signed bundle. The unsigned `parsePairingPayloadJson`, the 6-digit code, and the `<placeholder>` workspace-pairing are test-only or live only in the separate MyLife hub app (`apps/mobile` / `apps/web`), which Meerkat does not ship. So the review's "unsigned QR handshake" does not describe a reachable Meerkat path.

The real residual is first-contact MITM: signatures + TOFU authenticate an established device, not the first exchange, and the out-of-band defense (the 5-emoji SAS) was **advisory only** in Meerkat because the mandatory SAS gate (`inbound-policy.ts`) fired solely for `isSensitive` modules and no Meerkat module set that. A shared community therefore replicated from any freshly TOFU-paired peer with no emoji verification.

Fix (this session): decouple the SAS requirement from `isSensitive` (which also implies per-entity content-key encryption that the community-identity model does not need) with a new `requiresSasForShare` policy flag, set it on `COMMUNITY_SYNC_POLICY` on both twins, thread `moduleRequiresSasForShare` through the inbound facts, and extend the gate to `(moduleIsSensitive || moduleRequiresSasForShare)`. The in-person ceremony now records the pairwise SAS verification on commit (the ceremony IS an out-of-band emoji comparison), so the safest pairing path is not undercut by a redundant step; the paste/friend-code paths still correctly require the explicit emoji confirm since they were not out-of-band verified. A `check-meerkat-parity` assertion locks `requiresSasForShare: true` on both surfaces.

Behavior change to note for the ledger: after this ships, a community replicates only from a SAS-verified peer. Peers paired earlier (via friend code) without an emoji confirm must verify once on the Sync/Messages screen before their shared communities resume syncing. Acceptable for beta (near-zero installed base) and the correct security posture; a join-time "verify to sync this community" prompt is a follow-up UX polish, not a security blocker.

Verification: sync 201 files / 2525 tests; meerkat app 148 files / 1509 tests; module-registry + sync + meerkat app + meerkat-web typechecks clean; `check-meerkat-parity` green (new SAS assertion included).

## Three 2026-08-01 deploy-walkthrough defects (grep-verified still open, now fixed)

| Severity | Defect | Root cause | Resolution |
|---|---|---|---|
| High | Mobile "New library" was a silent no-op and the My Library hub showed nothing. | The Meerkat node boots its own identity via `ensureSyncSchema` and never runs `ensureSyncBootstrap`, so no personal `sync_workspaces` row existed; `getPersonalWorkspaceId` returned null and both the library load and create bailed. `ensurePersonalWorkspace` existed only on web. | Added the mobile twin `ensurePersonalWorkspace` (library-hub-core.ts) and call it at `SyncProvider` boot after `ensureSyncSchema`, mirroring the web `MeerkatProvider`. Regression test reproduces the real boot (schema only, no bootstrap workspace) that the existing harness masked. |
| High | Web boot hung forever on "Booting Meerkat…" in a non-secure context. | `resolveOrCreateIdentity` uses the WebCrypto secret store, which throws when `crypto.subtle` is absent (plain http on a LAN IP); the boot IIFE had no `.catch`, so the promise rejected unhandled and the null-value gate never cleared. | Added an upfront `isSecureContext` / `crypto.subtle` guard with honest HTTPS/localhost guidance, wrapped the whole boot in try/catch to surface ANY failure, and render the error at the boot gate instead of the perpetual spinner. |
| Medium | The age gate (legal floor) was not covered by `check-meerkat-parity`. | The parity script never asserted the two thin age-gate adapters both route through the shared `@mylife/sync` core or that both surfaces mount the first-launch gate. | Added parity assertions locking the shared-core usage (`evaluateAgeGateBirthDate`, the `@mylife/sync` import, the `locked` record write, the `isAgeGateLocked`/`isAgeGatePassed` contract) and the first-launch UI gate on both surfaces. The decision function itself is unit-tested in packages/sync. |

Note: defect #2 from that walkthrough (the dead `isSensitive` SAS gate) was already closed by the SAS work above. Verification for this batch: meerkat app + meerkat-web typecheck + lint clean, `check-meerkat-parity` green (age-gate assertions included), full app and web suites green.

## Tombstone lane finished: HIGH-1 (carry flags) + MED-1 (HMAC)

The two CRITICAL tombstone fixes above left two lower-severity findings the reviewer flagged; both are now closed across all three stores (memory, file, PostgreSQL).

| Severity | Defect | Resolution |
|---|---|---|
| High | Deletion still cascaded away anti-abuse flags: the tombstone stored only the quota timer, so a `store_minor` age determination or a renewal flag reset once the account was recreated. | The tombstone now carries `ageStatus`, `ageSource`, `parentalConsentState`, `renewalFlaggedAt`, `flagReasonCode` captured at deletion, re-seeded onto the recreated account (`applyCarriedAntiAbuse`). A re-deletion merges most-restrictively (`mergeCarriedAntiAbuse`: `store_minor` never downgraded, earliest renewal flag kept). File ledger bumped v2 -> v3 with a numeric-tombstone migration; PostgreSQL migration 19 extended with the carried columns (unshipped, so edited in place); DELETE ... RETURNING captures the flags and the INSERT seeds them, all inside the existing advisory-locked transaction. |
| Medium | The subject marker was an unkeyed SHA-256, a membership oracle: a DB reader with a candidate SSO subject could confirm a deletion. | `accountSubjectTombstoneHash` takes an optional server secret and HMAC-SHA256s the marker under it (stable 64-hex, CHECK holds). Threaded through all three store constructors; the account-service bin reads `MEERKAT_ACCOUNT_TOMBSTONE_SECRET` (production compose sets it, required); absent => unkeyed fallback so tests / un-provisioned dev still run, with an honest `tombstoneHash: UNKEYED` line in the ready log. The secret must be stable for the deployment's lifetime. |

Verification: relay 208 files / 1612 tests (three new: flag-carry, v2->v3 migration, HMAC); relay typecheck + lint clean. PostgreSQL flag-carry rides the env-gated integration lane (skipped locally, like the existing account-store integration tests) — the SQL path is exercised there.

## Gate hardening: ban require() in ESM production source

The CRITICAL-1 tombstone bug (a `require('node:crypto')` in an ESM package that 500'd the account service on deploy) passed the entire Vitest suite because Vitest's transform injects a CJS `require` shim; the shared eslint config never enabled `no-require-imports`/`no-var-requires`, so the inline `// eslint-disable-next-line` comments referenced a rule that did not run. Nothing caught it.

Fix: `scripts/check-esm-require.mjs` scans the PRODUCTION source (`src`/`bin`/`app`/`lib`, excluding tests and `.cjs`) of every `"type": "module"` package under `packages/`, `apps/`, `modules/`, and `deploy/self-host`, and fails on any `require()` call (allowing `createRequire` and dynamic `import()`). Unlike a lint rule it cannot be silenced with an inline disable. Wired into `.husky/pre-commit` (after `check:web-barrel`) and the head of the `check:parity` aggregate (so CI catches it too), exposed as `pnpm check:esm-require`. Verified it catches a planted `require` and passes clean on the current tree. This plus the renewal-window regression test added with the CRITICAL-2 fix close both concrete false-confidence gaps this session exposed.

## WebRTC signaling: 2 HIGH resource-safety fixes + honesty correction

The WebRTC sync-signaling lane (dev-build-only rung, fails soft to relay) had two HIGH resource-safety bugs a paired-but-hostile peer could drive.

| Severity | Defect | Resolution |
|---|---|---|
| High | Peer-triggerable relay-listener leak: a verified envelope with a non-offer / malformed inner payload created the session channel BEFORE validating the payload, then bailed without teardown, leaking one WebSocket per bad frame; the channel map was also uncapped. | `handleInviteFrame` now validates the inner offer before `createSessionSignaling`; the channel map is bounded (`MAX_SESSION_CHANNELS`, evict-oldest), and each channel arms an idle-reclaim timer that tears down a listener no consumer ever attaches to (webrtc-sync-signaling.ts). |
| High | Glare / repeated-offer orphan leak: a second dial for the same peer overwrote `_sessions`/`_connections` and orphaned the prior RTCPeerConnection unreachably, so a peer could spawn unbounded live connections keeping only the last. | `WebRTCTransport._closeExistingPeer` closes and drops any existing session/connection for a peer before `connectToPeer` / `acceptConnection` / `_handleIncomingSession` install a new one, bounding it to one per peer. Regression test with a close-tracking backend. |

Honesty correction: `credential-verify.ts` claimed the account service "never sees serials at all"; corrected to the precise "never during blind ISSUANCE; a client-initiated deletion or renewal that submits its own credential does reveal that serial, so unlinkability is one-epoch-forward, not unconditional." (The app key-storage copy already says "stored in the device keychain" — no hardware-backed overclaim to fix.)

Deferred (tracked, NOT launch-blocking — dev-build-only rung, metadata-privacy axis): the reviewer's MED items to (a) reuse the existing `@mylife/sync` `call-signal.ts` frame primitives instead of the app's parallel weaker envelope (adds an Ed25519 signature + DB-persisted replay nonces), (b) day-bucket the WebRTC invite token to remove the static per-pair pseudonym (needs a two-bucket listener to survive day boundaries), and (c) day-bucket the mailbox tokens the same way. These are protocol changes on a rung that is not part of the beta's launch-critical path (relay is the live transport); they are logged for a follow-up hardening pass.

Verification: sync typecheck + full sync suite green (new HIGH-2 regression test); meerkat app typecheck + signaling test green.

## Blackglass 2026-07-09 rows re-verified against HEAD: 10 FIXED, 1 PARTIAL, 0 still-valid

The ~10 "Unresolved" Meerkat rows from the 2026-07-09 Blackglass adversarial audit were re-verified against the current code (a read-only pass, cited to file:line). Every one had been superseded by later work; they were falsely inflating the open-blocker count. Verdicts:

- **FIXED (10):** $4.99 unlock enforcement (central deny-by-default boundary both surfaces, no dev bypass); store->hosted purchase proof (RevenueCat server validation -> single-use cross-rail link -> persona-bound HMAC token, code-wired end to end; live provider round-trip = Steps 8/9); delete-my-data (remote persona delete + storage revocation first, hard-abort on failure, raw-byte stores cleared, key destroyed last); build-env guard (production profile hard-fails on 8 endpoints + RC key + wss + humanity pubkey + TURN + TEST_MODE); UGC policy surfaces (privacy links, terms acceptance gating public compose, block flows, report flows both surfaces); GDPR coordinator wired into the deployable persona-service bin (503 fail-closed when absent); Stripe webhook replay/out-of-order (event-id dedupe + provider-time monotonicity + same-second deny-wins, same pure fn in file + postgres stores under lock); web billing device-signed auth + strict reflected-origin CORS across 10 relay surfaces; Nearby/BLE (dynamic `require(name)` that blocked Metro export is GONE, real Swift/Kotlin bridges ship in `packages/meerkat-native-transport`, registered as an Expo plugin); moderation un-hide decoupled from review lifecycle (`reviewed` stays hidden; only explicit `dismissed` un-hides).
- **PARTIAL (1):** Expo Doctor — re-ran live, now 16/18 (was 6/18 failing). The originally-named failures (invalid config, missing expo-font, New Arch) are gone; what remains is 3 patch-version drifts (expo 54.0.35 vs ~54.0.37, expo-constants, expo-file-system) + a same-version `expo` hoisting warning. NOTE: a naive `pnpm --filter @mylife/meerkat-app update expo@~54.0.37 ...` was attempted and REVERTED this session — it rewrote 1700+ lockfile lines, shuffled expo-router's peer resolution, and broke `expo-router`'s `useLocalSearchParams`/`useRouter` type exports. The drift is low-severity hygiene, so it is left for a controlled bump in the rc19 session (bump the three pins, then verify the app typechecks AND an EAS build succeeds before binding rc19). Do NOT bump it as a side effect.

The `check:esm-require` gate added earlier confirms the ble-backend dynamic require is gone (exit 0, does not flag ble-backend.ts). errors_log.md rows updated in place (11 -> Resolved, Expo Doctor -> Mitigated).

Two residuals worth tracking separately (neither is a Blackglass row, neither breaks anything today): `public-directory-node.ts` serves `/healthz` without CORS headers (only matters if a browser is ever pointed at a directory node's health endpoint; the web card probes the relay, which does send them); and finding #2's verdict is code-wiring only — the StoreKit/Play -> RevenueCat -> hosted-mint -> community-node-accept loop still needs live provider credentials to prove end to end (Steps 8/9).
