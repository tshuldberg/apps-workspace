# Session: Meerkat launch-readiness orchestration (5 remaining tasks)

Date: 2026-06-14
Branch: feature/meerkat-network
Mode: orchestrator over opus agent-team workflows (ultracode)

## Goal

Complete the five remaining Meerkat launch-readiness tasks called out at the end
of the prior readiness session, with the main session acting as orchestrator:
design, dispatch implementation agents, review every result, and independently
test and confirm each before moving on. No faked transport or connectivity at
any point (the Meerkat honesty boundary is a hard guardrail).

The five tasks:
1. Automatic share-link host discovery
2. First-class save-destination UX for downloaded files
3. Background sync / push wake
4. Production relay/host deployment
5. Physical multi-device QA

## Method

1. **Design + audit workflow** (read-only, parallel): five architect agents (one
   per task) produced structured designs citing real files/symbols, plus a sixth
   honesty-boundary + sequencing auditor. Audit verdict: GO on all five, build
   order 4 -> 3 -> 1 -> 2 -> 5, with Task 3 gated (needs-guardrails). The only
   hard serial constraints were shared app files (share.tsx / remote-share.ts:
   Task 1 before Task 2; settings.tsx: Task 3 before Task 2) and Task 5 as the
   capstone that exercises everything else.
2. **Per-task implementation workflows** (sequential): each ran implement ->
   adversarial review -> conditional fix. The orchestrator then re-ran the real
   test/typecheck/gate/parity commands itself before proceeding.
3. A clean green baseline was captured first (meerkat 66, sync 1054, relay 73).
   The sync negotiation-timeout and remote-store complexity-slope tests are
   CPU-load-flaky (~10s real timeouts); a lone failure there was treated as
   flake and re-run, never a rollback.

## What landed

### Task 4 - production relay deploy (most isolated; fixed a real blocking bug)

The relay Docker image could not start: `bin/meerkat-relay.mjs` imported
`startRelayServer` from the `src/index.ts` barrel, which pulls
`seeder-node.ts` + `hosted-node.ts` (both import `@mylife/sync`), while the
Dockerfile installed with `--ignore-workspace`, so `@mylife/sync` never
resolved at runtime.

- New slim entrypoint `bin/meerkat-relay-server.mjs` imports `startRelayServer`
  directly from `src/server.ts` (ws + zod only). `server.ts`/`hub.ts`/
  `protocol.ts` carry no `@mylife/sync` import.
- Corrected multi-stage Dockerfile: compiles the relay graph to CJS (also fixes a
  second latent bug, extensionless-ESM imports under plain node), generates a
  ws+zod-only `package.runtime.json`, installs `--omit=dev`, runs the slim bin.
- Deploy templates: `deploy/docker-compose.yml` (read-only rootfs, no volumes,
  cap_drop ALL), `Caddyfile`, `fly.toml`, `render.yaml`, `.env.example`.
- `scripts/smoke-relay.mjs` boots the real bin child process, hits `/healthz`,
  carries a live session, asserts logs leak no ciphertext, clean SIGTERM.
- Tests: `smoke-relay.test.ts` (real child + full NativeSyncEngine session),
  `log-hygiene-e2e.test.ts` (process-boundary stdout leak), `relay-image-deps.test.ts`
  (static guard: bin imports server.ts not the barrel; relay core stays sync-free).
- Zero-knowledge held: no new `/healthz` field, no relay env secret, no relay disk
  volume. Seeder/hosted node kept a separate documented-but-not-built image.

### Task 3 - honest background-sync slice (gated; highest honesty-drift risk)

- New RN-safe `@mylife/sync` primitives: `runSyncSessionJob`
  (`engine/session-job.ts`, headless twin of `SyncProvider.runRelaySession`) and
  `runMailboxDrainJob` (`protocol/mailbox-drain.ts`, the missing RECEIVE twin of
  MK-057's send side). The drain reuses `deriveMailboxToken` +
  `decodeMailboxEnvelope` + `openChannelMessageMailboxDelta` verbatim, adds no
  wire fields, and is fail-closed (bad signature / wrong recipient /
  undecryptable -> counted as rejected, nothing written).
- `SyncProvider.runRelaySession` now calls `runSyncSessionJob` so manual and
  background paths cannot drift. The jobs synthesize no status; a no-listener
  background initiate records a real non-completed session, never a fabricated
  completed (test waits the genuine ~10s engine timeout to prove it).
- New shared `data/meerkat-db.ts` factors `getMeerkatDatabase()` + the MK-001
  PRNG/secret-store boot order out of `DatabaseProvider`, so the headless
  `runBackgroundSyncOnce` shares one boot order (crypto-before-identity,
  test-asserted). The parity script's MK-001 assertion was repointed accordingly.
- A default-ON "Run background sync now" debug button (Settings) exercises the
  real drain path with no scheduler. OS scheduler (expo-task-manager /
  expo-background-task) + data-only push wake (expo-notifications) are wired but
  DEFERRED behind `mk_settings background_sync_enabled` (default false); native
  modules are lazy `require()`+try/catch (Expo-Go-safe, mirrors lan-backend.ts)
  and were intentionally not added to package.json so typecheck/tests pass
  without a native install.
- The Sync-screen "pending" copy is gated on runtime `registration.registered`,
  never code presence; a push only enqueues a drain and notifies only when
  `applied > 0`.

### Task 1 - automatic share-link host discovery

- Relay gained pure ws+zod `ann`/`lk` verbs (`RelayHub.announce`/`lookup`,
  multi-announcer, non-consuming, with `maxRegistryRids`/`maxAnnouncersPerRid`/
  `registryTtlMs` caps + sweep; new error codes appended, existing untouched).
  `protocol.ts`/`hub.ts`/`server.ts` stay `@mylife/sync`-free.
- New sync primitives in `node/host-registry.ts`: `deriveContentRegistryId`
  (HKDF+sha512Hex opaque 64-hex rid, relay never sees the contentId),
  `deriveContentRegistryKey` + secretbox record (fresh nonce, only share-link
  holders can decrypt), `announceHeldContent` / `lookupContentHosts`;
  `transport/registry-client.ts` `announceHost` / `lookupHosts`.
- App is resolve-only: `remote-share.ts` `discoverShareHosts` + `openRemoteShare`
  union discovered + pasted hosts (relayUrl-unset path byte-identical to before).
  `share.tsx` shows a candidate count equal to real recs returned, never
  "connected to N seeders"; trust stays entirely in
  `fetchAndPinFromHosts -> openSealedShare`. The standalone app never announces
  its own pins (a phone has no inbound HTTP web seed).
- Three reviewer should-fixes also resolved: collapsed a double discovery
  round-trip; `log-hygiene-e2e` now directly pushes `ann`/`lk` and asserts no
  rec/rid leak; fixed an announce-shape mismatch by adding `startNodeStoreHttp`
  (serves the `/manifest`+`/block` NodeStore shape `httpNodeSource` fetches) and
  rewiring `announceHeldShareContent(config, store)` + `bin/meerkat-node.mjs`
  (off unless `DISCOVERY_RELAY_URL` + `PUBLIC_BASE_URL` set).

### Task 2 - first-class save-destination UX

- New `data/file-save.ts`: a pure, injectable `FileSaveAdapter` boundary (all
  expo-file-system/legacy + expo-sharing access behind it). Every `saved` result
  is gated on `verifyWrite()` (getInfoAsync `exists === true` and `size > 0` for
  non-empty bytes); any throw/missing/empty becomes `failed` with the real error.
- iOS `saved` means "wrote a verified cacheDirectory temp file + opened the OS
  share sheet"; copy never claims a final Files location. Android persists a SAF
  tree in `mk_settings` (`FILE_SAVE_DIR_ANDROID`); a stale/revoked tree fails
  loud and the UI re-offers the picker. The module only ever handles
  already-decrypted bytes, never ExpoNodeStore ciphertext or any transport.
- Wired into the share decrypted-result Save button, channel attachment Save,
  NodeProvider `saveContent`/`getSaveDestination`/`chooseSaveDestination`/
  `clearSaveDestination`, and a Settings "Saved files" panel. The alpha-readiness
  `files` item is now input-driven (Android ready iff a destination exists; iOS
  ready via the share sheet). Rebased cleanly onto Task 1 + Task 3.

### Task 5 - multi-device QA capstone

- Automated e2e harness over a live relay driving 2 and 3 fully independent nodes
  through the real shipping engine path (`engine.syncWithConnection` /
  `handleIncomingConnection`, never raw `runInitiatorSession`):
  `multi-node-2device-e2e.test.ts`, `multi-node-3device-e2e.test.ts`,
  `support/multi-node-harness.ts`, `multi-node-config-guard.test.ts`. Imports only
  symbols present in `index.native.ts` (the RN surface the app ships).
- Covers pairing/SAS (with MITM negative), manual relay session, channel delivery
  + role gate, offline mailbox with a zero-knowledge wire-byte assertion,
  read-state scope, remote-share fetch with tamper/wrong-author fail-closed
  negatives, and three-node convergence with no silent auto-fanout. Asserts only
  on real local rows + engine status.
- The module-config drift guard does not live-import the app (the relay tsconfig
  rootDir would break the typecheck gate, verified); it deep-equals the harness
  config against transcribed source-of-truth literals with file+line citations.
- `Tickets/device-qa-exit-demo.md` is a rung-by-rung physical checklist that maps
  every assertion to a real on-screen indicator and states plainly that a green
  harness is NOT physical sign-off, with a Coverage Gaps table (LAN/mDNS, BLE, OS
  background, push, force-quit, WAN/NAT/TLS/soak, keychain durability). The
  launch-plan physical exit-demo bullet stays pending.

## Orchestrator consistency pass

Task 1 did not edit launch-plan.md / CLAUDE.md / AGENTS.md (not in its file set),
so the orchestrator reconciled the now-stale "automatic host discovery is
pending" copy in launch-plan.md, apps/meerkat CLAUDE.md, and apps/meerkat
AGENTS.md (kept as a synchronized pair). Also cleaned a pre-existing em dash in
sync.tsx's Revoked badge and an unused test var in file-save.test.ts.

## Verification (orchestrator-run, final)

- meerkat-app: typecheck clean, 94 tests pass.
- sync: typecheck clean, 1074 tests pass (clean isolated run; one sweep flake on
  the known CPU-load timeout tests, re-run green).
- meerkat-relay: typecheck clean, 110 tests pass.
- `pnpm gate:function:changed`: exit 0 (incl. mobile + web consumer typechecks).
- `pnpm check:parity --quiet`: passed (52 module layouts consistent).
- `node scripts/check-meerkat-parity.mjs`: all checks passed.
- `git diff --check`: clean. Em-dash scan: only pre-existing memory.md history.

## Not committed

Per the commit-only-when-asked rule, all five tasks accumulate uncommitted in the
working tree (34 modified + 28 new files, roughly +1820 / -196). Suggested commit
split: one conventional commit per task (T4 chore/feat sync+relay deploy, T3 feat
sync background-drain, T1 feat sync host-discovery, T2 feat meerkat save-dest, T5
test relay multi-node-qa) plus the docs/consistency edits.

## Remaining (founder ops / hardware, honestly out of software scope)

- Physical 2/3-device exit-demo QA on real hardware (run `device-qa-exit-demo.md`).
- Live production relay/host deployment: cloud account, domain/DNS, TLS issuance,
  per-region machines, external uptime monitor, packaged seeder/community-host
  image (artifacts + runbook are ready; `docker build`/`fly deploy` are founder ops).
- Dev-build verification of the OS background scheduler + push wake (cadence, iOS
  background budget, real push token/APNs/FCM, WAL concurrency).
- Production loop for automatic host discovery: a deployed discovery relay + an
  always-on announcing seeder (the standalone app stays resolve-only).
- LAN/mDNS live run, BLE transport (not built), polished native scrollback.
