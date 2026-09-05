# Meerkat readiness Task 3: background sync / push wake (honest, Vitest-testable slice)

Date: 2026-06-14
Branch: feature/meerkat-network

## Goal

Build the largest honest, software-testable slice of Meerkat background sync and
push wake without faking transport or delivery. Defer the parts that genuinely
need a dev build and two physical devices (OS scheduler cadence, real push token
delivery, iOS background-execution budget) behind a dev-build flag defaulted OFF.

## What was built

### New @mylife/sync primitives (RN-safe, zero expo imports)

- `packages/sync/src/engine/session-job.ts` -- `runSyncSessionJob`: the
  dependency-injected headless twin of the manual relay session. Joins a relay
  on the rendezvous token, wraps it as a TransportConnection, and drives the
  REAL engine (`syncWithConnection` / `handleIncomingConnection`). Because it
  calls the same engine the UI uses, every session writes real `sync_sessions`
  rows. A background initiate with no listener hits the real initiator handshake
  timeout and the engine records a real `failed` row; the job NEVER fabricates a
  `completed` status. Always closes the connection + destroys the backend.
- `packages/sync/src/protocol/mailbox-drain.ts` -- `runMailboxDrainJob`: the
  honest asymmetric background win. For each active, non-revoked paired device
  with a shared secret, derives the recipient mailbox token via the existing
  `deriveMailboxToken(secret, MY_deviceId)`, joins via the injected backend,
  collects the ciphertext the relay drains on join, and opens+verifies it with
  this device's identity via `openChannelMessageMailboxDelta`. Works with NO
  peer online (the relay buffered the deltas). Fail-closed: bad signature /
  wrong recipient / undecryptable is dropped and counted `rejected`, NOTHING is
  written. Revoked / secret-missing / inactive peers are skipped entirely (no
  token derived, no relay join). Reuses `deriveMailboxToken` +
  `decodeMailboxEnvelope` + `openChannelMessageMailboxDelta` verbatim; adds NO
  new wire fields. Also exports `applyDrainedChannelEvents` (the verify+merge
  helper the live receive path can share) and `toMailboxDrainPeers`.
- Both re-exported from `index.native.ts` AND `index.ts` (the app test resolves
  the node `main` barrel; the app runtime resolves the `react-native` barrel).

### App layer

- `apps/meerkat/app/(root)/data/meerkat-db.ts` -- factored the MK-001 boot
  order out of DatabaseProvider into one shared source of truth:
  `getMeerkatDatabase()` configures the sync PRNG (expo-crypto) + secret store
  (expo-secure-store) BEFORE opening the db or any identity/seal call. Both the
  foreground provider and the headless background path call it, so the boot
  order is identical and cannot drift. `resetMeerkatDatabaseCache()` drops the
  singleton on a db reset.
- `apps/meerkat/app/(root)/data/background-sync.ts` -- `runBackgroundSyncCore`
  (pure, injected deps: db, configureCrypto, getIdentity, backend, applyEvents,
  clock) configures crypto first, reconstructs identity, reads relay config,
  drains mailboxes, optionally runs a bounded listen, records ONLY a real run
  timestamp; records nothing when no relay is configured. `runBackgroundSyncOnce`
  is the thin expo wiring (lazy-loads meerkat-db + WebSocketRelayBackend +
  mergeChannelMessageEvents). Flag helpers: `isBackgroundSyncEnabled`
  (default false), `setBackgroundSyncEnabled`, `getLastBackgroundRunAt`.
- `apps/meerkat/app/(root)/data/background-task-registration.ts` -- DEFERRED OS
  scheduler + push wake. Lazy-loads expo-task-manager / expo-background-task /
  expo-notifications with try/catch returning null when absent (mirrors
  lan-backend.ts), so Expo Go and the test path never crash. A data-only push
  only ENQUEUES `runBackgroundSyncOnce`; a "message received" notification is
  emitted ONLY after a real `applied > 0` count.
- `SyncProvider.runRelaySession` refactored to call `runSyncSessionJob` so
  manual + background relay paths cannot drift. Manual behavior preserved (errors
  re-thrown, engine still records the session row).
- `DatabaseProvider` now delegates to `getMeerkatDatabase()` /
  `resetMeerkatDatabaseCache()`; existing reset + error UI preserved.
- Settings screen: a "Run background sync now" debug button (real path, no
  scheduler -- the default-ON honest QA hook), an Enable/Disable scheduled
  background sync toggle (gated; leaves the flag OFF when the native modules are
  absent), a real `last_background_run_at` display, and an honest notice.
- `app.json`: iOS `UIBackgroundModes` + `BGTaskSchedulerPermittedIdentifiers`,
  Android `WAKE_LOCK`. Config-only (no native module install needed).

### Tests (all green)

- `packages/sync/src/__tests__/session-job.test.ts` (3): initiate syncs a pad
  row into the peer DB and records a real `completed` row; initiate with no
  listener records a NON-completed row (never fabricated `completed`); no relay
  URL is a no-op.
- `packages/sync/src/__tests__/mailbox-drain.test.ts` (7): drain+verify+apply a
  sealed event with no peer online; multi-event burst in HLC order; fail-closed
  on tampered signature / wrong recipient / corrupted ciphertext; skip
  revoked/inactive/secret-missing without deriving a token or joining; no relay
  URL skips all.
- `apps/meerkat/app/__tests__/background-sync.test.ts` (3): core drains a parked
  event into cm_messages and records a real run; no relay URL is a no-op that
  writes nothing; MK-001 boot order holds (crypto configured before identity is
  read).

## Honesty guardrails enforced in code

1. The two jobs live in @mylife/sync with zero expo/native imports; they call
   the real engine, so sync_ rows are real; a no-listener initiate records a
   real timeout/failed row, never `completed`.
2. The drain reuses deriveMailboxToken + decode/openChannelMessageMailboxDelta
   verbatim, adds no wire fields, fail-closed on any bad envelope (writes
   nothing), and skips revoked / no-secret peers (no token, no join).
3. runBackgroundSyncCore calls configureCrypto() FIRST, then getIdentity(); the
   shared getMeerkatDatabase() owns the one boot order for provider + headless.
4. runRelaySession now calls runSyncSessionJob; manual app tests still pass.
5. Scheduler/push/app.json native wiring is behind a dev-build flag default OFF
   with lazy native modules; nothing installed, typecheck + tests pass anyway.
6. The Sync-screen copy keeps "scheduled background sync still pending" and adds
   only the truthful on-demand-drain pointer; no live peer auto-dial claim.
7. Push wake only enqueues a run; the notification fires only on applied>0.
8. "Run background sync now" debug button exercises the real path on-device.
9. No em dashes.

## Verification (real)

- `pnpm --filter @mylife/sync test`: 80 files / 1064 tests pass (one isolated
  run); a single full-suite run flaked on the pre-existing
  `remote-store.function-gate` complexity benchmark under CPU load and passed on
  re-run and in isolation (not my code).
- `pnpm --filter @mylife/sync typecheck`: clean.
- `pnpm --filter @mylife/meerkat-app test`: 11 files / 69 tests pass.
- `pnpm --filter @mylife/meerkat-app typecheck`: clean.
- `pnpm --filter @mylife/meerkat-relay test`: 18 files / 81 tests pass.
- `pnpm gate:function:changed`: meerkat-app + meerkat-relay + sync gates green,
  consumer typechecks (mobile + web) green.
- `node scripts/check-meerkat-parity.mjs` + `pnpm check:parity --quiet`: green
  (parity MK-001 assertion repointed to the shared meerkat-db.ts).

## Deferred (needs dev build + two devices)

OS scheduler cadence, iOS background-execution budget (~30s, app must have
launched and not be force-quit), real data-only push delivery + Expo push token,
and WAL SQLite headless concurrency. A two-device QA checklist was added to
`apps/meerkat/Tickets/launch-plan.md`.

## Deviation

The design listed `apps/meerkat/package.json` as a file to modify (add the
native deps). I intentionally did NOT add expo-task-manager / expo-background-task
/ expo-notifications to package.json: they are loaded via optional `require()`
with try/catch, so typecheck + tests stay green WITHOUT a native install. Adding
them (plus plugin entries) is a dev-build follow-up step documented in the
launch-plan QA checklist.

## Docs updated

apps/meerkat/CLAUDE.md + AGENTS.md (transport honesty boundary, file tree,
mk_settings keys, MK-001 durability note), Tickets/launch-plan.md (status + QA
checklist), scripts/check-meerkat-parity.mjs (MK-001 assertion repointed).
