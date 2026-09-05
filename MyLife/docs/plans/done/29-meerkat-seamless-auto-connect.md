# Feature Spec: Seamless Auto-Connect (Automatic Sessions + Background Mesh Graduation)

> Meerkat launch plan 29. Replaces "manual sessions only" with honest automatic session
> dialing: paired devices and community peers sync on real triggers (app foreground, LAN
> peer discovered, network regained, pending changes) with no typed phrase and no button
> press, plus graduation of the dev-flagged background sync to a shipped feature. This is
> the "smooth encrypted data flow" leg of the internet-layer vision: the mesh feels alive
> with no fake online dots and no fabricated connectivity. Presence exists only as an
> opt-in, peer-validated, sealed signed beacon with honest TTL (see the 2026-07-01
> amendment below); the relay never runs a who-is-online registry.

## Reconciliation Status (2026-07-07)

Status: Done for codeable repository scope. Moved from `docs/plans/queue/` to
`docs/plans/done/` after verification against local `main` (`3807c60b` before this
docs-only reconciliation). Verified anchors include session rendezvous tokens,
`runAutoConnectJob`, per-peer backoff, mobile/web auto-connect cores and cards,
foreground trigger wiring, composed drain-plus-session rounds, `gossip:true` sessions,
Plan 27 transport-policy consultation, opt-in presence beacons, real presence counts,
per-community appear-online toggles, and parity locks. The app still does not claim
guaranteed closed-app background delivery. Default-on OS background graduation and
device timing QA remain Plan 23 founder-ops.

## Amendment (2026-07-01, founder): opt-in peer-validated presence is now IN scope

This plan originally declared "no presence service and there will be none". The founder
AMENDED that: presence is added as an OPT-IN, peer-validated, end-to-end feature. The
relay stays blind, so the honesty boundary holds (counts come from real verified signed
rows with a TTL, never a server-side who-is-online registry, never a fabricated dot).

1. Async store-and-forward delivery is a HARD requirement (already the architecture:
   compose-time mailbox park + fail-closed drain). A message sent days after the last
   session must reach the recipient with no shared LAN, Signal-like. Feeling Signal-like
   is gated on relay deploy (founder-ops), push-wake graduation (Phase 4 here), and this
   plan's auto-connect.
2. Opt-in peer-validated presence counts: a user may CHOOSE to share that they are
   connected. Before their presence counts for a community, the system validates they are
   a real member via SIGNED ROSTER MEMBERSHIP; the UI shows the count of validated members
   currently sharing. User-based and E2E to peers only.
3. "Online" is a per-user, per-community toggle, DEFAULT OFF, shown with honest TTL
   freshness from a recent verified signed beacon, never fabricated. Beacons are sealed so
   the relay learns nothing.

Adds a new Phase 6 (presence) below; NC-1 is revised accordingly. Presence beacons must
never carry content and never escalate a device-local/local-only community onto a wider
transport than its Plan 27 policy allows.

## Metadata

- **Surfaces:** `packages/sync` (`@mylife/sync`), `apps/meerkat`, `apps/meerkat-web`,
  `scripts/check-meerkat-parity.mjs`, `apps/meerkat/CLAUDE.md` + `AGENTS.md` (honesty copy)
- **Priority Score:** 44 / 50 (A-Tier). Market 5x3 + Switching 4x3 + Complexity 2x2 +
  CrossModule 2x1 + PaidUser 3x1. Every competitor syncs automatically; Meerkat requiring a
  typed shared phrase and two simultaneous button presses is the single largest smoothness
  gap ("I can download Signal and send encrypted messages without thinking about setup").
- **Estimated CC Time:** 6-8 focused sessions.
- **Depends On (hard):** Plan 20 (code-complete: `effectiveRelayUrl` health gate, real
  transport backends, `mk_relay_probe`). A deployed default relay (founder-ops) for
  out-of-box internet auto-connect; LAN/Nearby auto-connect works without it.
- **Depends On (soft):** Plan 27 (community transport policies): the auto-dialer MUST
  consult per-community transport policy before dialing (a local-only community is never
  auto-dialed over relay). Build order: Plan 27 P0 (policy read API) before this plan's P2.
- **Blocks / feeds into:** Plan 21 Phases 4-5 (DM delivery feels instant when sessions
  auto-run), Plan 23 Phase 4 (device QA covers auto-connect), Plan 25 (call notifications
  ride the push-wake path this plan graduates).
- **Explicit prior scope carve-out being closed:** Plan 20 line 646 declared "Auto-dial /
  background presence remain out of scope here (separate engine work)". This is that work.
  `apps/meerkat/Tickets/launch-plan.md:63-64` lists it as a known pending gap.

---

## Business Context

### Why This Feature Exists

Today every sync session is manual: `sync.tsx:87-90` requires a typed relay URL plus a
shared phrase, and `onRunSession` (`sync.tsx:142-156`) runs only when a human taps Listen
on one device and Sync now on the other, at the same time. Mainstream users will not do
this twice, let alone daily. The honest copy "Manual sessions only... There is no automatic
device dialing" (`sync.tsx:402`, `settings.tsx:402,446`) is accurate and must stay accurate
until the day this plan ships real automatic dialing, at which point the copy is REPLACED
with new honest copy describing what automation actually does.

### What honest auto-connect means here

There is no presence service and there will be none: relays are zero-knowledge and a
`PairedDevice` row has no online field (`packages/sync/src/types.ts:144-164`). Auto-connect
is therefore attempt-based: the app dials on real triggers, a success is a real engine
session recorded in `sync_sessions`, a failure is a real `failed` row with backoff
(`runSyncSessionJob` never fabricates `completed`, `session-job.ts:12`). The UI shows last
attempt / last real session per peer, never "online" or "connected" outside a live session.

### Target User

Anyone who pairs two devices or joins a community and expects their content to just be
there on the other device, the way iCloud, Signal, and WhatsApp behave, without a sync
ritual.

---

## Current-State Grounding (verified 2026-07-01)

### Already real (reuse verbatim, do NOT reimplement)

| Capability | Anchor |
|-----------|--------|
| Session-driving primitive (dial + drive engine, honest failure rows) | `packages/sync/src/engine/session-job.ts:76-114` `runSyncSessionJob` |
| Mailbox drain (receive side, foreground + background shared) | `packages/sync/src/protocol/mailbox-drain.ts:56+`; `apps/meerkat/app/(root)/data/background-sync.ts:129-186` |
| Ranked-choice transport ladder (pure, importable standalone) | `packages/sync/src/transport/transport-manager.ts:76-130` `DEFAULT_TRANSPORT_LAYER_ORDER`, `buildTransportLayerDialOrder`, `selectDialableTransportLayers`; `:379-384` `getAvailableDataLayers` |
| Adaptive backoff scheduler shape (interval, backoff, battery/cellular gates) | `packages/sync/src/engine/sync-scheduler.ts:29-164` `SyncScheduler` (currently wired only to the unused full `SyncEngine`) |
| mDNS peer found/lost events already firing | `packages/sync/src/transport/lan-discovery.ts:120-121`; consumed at `SyncProvider.tsx:1253-1289` (informational only today) |
| Pending-changes signal, already observable | `packages/sync/src/crdt/change-tracker.ts:186-188` `getPendingCount`; `engine/sync-status.ts:56-59`; rendered at `sync.tsx:209` |
| Relay health pre-check pattern | `packages/sync/src/transport/relay-selector.ts:24-71` `probeRelays`; `effectiveRelayUrl` + `mk_relay_probe` |
| Token derivation family to clone for the session token | `packages/sync/src/protocol/mailbox.ts` `deriveMailboxToken` (pair-secret HKDF) |
| Opportunistic background LISTEN (off by default, listen-only) | `background-sync.ts:156-171` |
| Deferred OS scheduler + push wake (lazy natives, no-op absent) | `apps/meerkat/app/(root)/data/background-task-registration.ts:41-151` |
| AppState trigger hook pattern (elsewhere in monorepo) | `apps/mobile/hooks/use-auto-backup.ts`; `apps/dowork/.../DoWorkCloudProvider.tsx:196-206` |
| Manual dial call sites the scheduler will reuse | `SyncProvider.tsx:1208-1231` `runRelaySession`, `:1233-1251` `runLanSession` |

### Genuinely net-new (this plan builds)

1. Per-pairing, no-human-input, rotating session rendezvous token (today the live-session
   token is one global typed phrase, `sync-core.ts:162-164` `buildRendezvousToken`).
2. A pure dial scheduler + `runAutoConnectJob` (nothing drives `runSyncSessionJob` on a
   trigger today; retry/backoff is absent from the shipping path, grep-verified).
3. Failed-dial handling policy (record + backoff; channel messages already park at compose
   time via `queueChannelMessageMailbox`, `SyncProvider.tsx:481-547`, so no new fallback
   send path is needed; the scheduler just avoids hot-looping).
4. Per-peer auto-connect eligibility (new engine column) + per-community transport policy
   consultation (Plan 27 seam).
5. Trigger wiring in the apps: AppState, LAN peer-found, visibility (web), optional NetInfo
   and battery gates (lazy natives, null-safe, `lan-backend.ts` pattern).
6. Honest UI: per-peer last-attempt / last-session surface; retirement of the "no automatic
   device dialing" strings on BOTH surfaces + parity guard + CLAUDE.md/AGENTS.md update.
7. Background graduation: declare `expo-task-manager`, `expo-background-task`,
   `expo-notifications` in `package.json` + config plugins, keep the lazy-load pattern.

---

## Technical Context

```
packages/sync/src/
  protocol/session-token.ts        -- NET-NEW: deriveSessionRendezvousToken(pairSecret, utcDayBucket)
  engine/auto-connect.ts           -- NET-NEW: AutoConnectPolicy, planAutoConnectRound (pure),
                                      runAutoConnectJob (DI, mirrors runBackgroundSyncCore)
  engine/sync-scheduler.ts         -- REUSE: backoff math referenced, not rewired to full engine
  db/schema.ts + queries.ts        -- EXTEND: auto_connect INTEGER DEFAULT 1 on sync_paired_devices
                                      + getAutoConnectPeers(db)
  index.ts / index.native.ts       -- EXPORT new pure symbols (RN-safe)

apps/meerkat/app/(root)/
  data/auto-connect-core.ts        -- NET-NEW: mk_settings keys (auto_connect_enabled default ON,
                                      auto_connect_wifi_only default ON), trigger throttle state,
                                      last-attempt ledger read model
  providers/SyncProvider.tsx       -- EXTEND: autoConnectRound() calling runAutoConnectJob with
                                      runRelaySession/runLanSession deps; LANDiscovery onPeerFound
                                      -> opportunistic LAN dial; expose per-peer attempt state
  components/AutoConnectCard.tsx   -- NET-NEW: honest status card (enabled state, last round,
                                      per-peer last real session, never an online dot)
  (tabs)/settings.tsx + sync.tsx   -- EDIT: replace the manual-only copy with new honest copy;
                                      per-peer toggle rows; "Sync all now" manual round button
  _layout.tsx / app hooks          -- NET-NEW: useAutoConnectTriggers (AppState + optional NetInfo,
                                      lazy, null-safe)
  data/background-task-registration.ts -- EDIT: graduation (deps declared; registration honest)

apps/meerkat-web/src/
  lib/auto-connect-core.ts         -- NET-NEW: twin (visibilitychange/focus triggers, relay-only)
  lib/MeerkatProvider.tsx          -- EXTEND: same round runner + triggers
  ui/sync/AutoConnectCard.tsx      -- NET-NEW: twin card

scripts/check-meerkat-parity.mjs   -- EXTEND: lock the new copy strings + twin files
apps/meerkat/CLAUDE.md, AGENTS.md  -- EDIT: transport honesty section rewrite (same session)
```

### Design decisions (locked)

1. **Session token:** `deriveSessionRendezvousToken(pairSecret, dayBucket)` =
   HKDF-SHA512(pairSecret, info: `meerkat-live-session-v1:` + UTC date `YYYY-MM-DD`),
   first 64 hex chars. Deterministic on both ends with no input; rotates daily so the relay
   cannot build a long-lived pair identifier; dialer tries current bucket then previous
   (clock-skew window). Distinct domain string so it can never collide with mailbox or
   join tokens. Pure, in `protocol/session-token.ts`, cloned from `deriveMailboxToken`.
2. **Scheduler is pure and app-driven.** `planAutoConnectRound(state, peers, policy, now)`
   returns an ordered dial list + next-earliest-retry; `runAutoConnectJob(deps)` executes
   one round (per peer: skip if backoff window open, skip if a completed session with that
   peer is younger than `minSessionIntervalMs` (default 5 min) AND `pendingChanges === 0`,
   pre-check relay via the `mk_relay_probe`/`effectiveRelayUrl` gate, then LAN-first if that
   peer was mDNS-discovered, else relay). Backoff: 30s, 2m, 10m, 30m, cap 2h, reset on any
   real completed session. All state in a small `sync_auto_connect_state` table (per-peer
   backoff row) so foreground and background rounds share it.
3. **Roles without coordination:** both sides of a pair may dial. Round policy: the device
   with the lexicographically LOWER deviceId initiates, the other listens for a bounded
   window (30s) when its own trigger fires. If the listen window catches no initiator, that
   is a normal no-op, not an error row. This avoids double-initiate storms with no
   presence signal.
4. **Plan 27 seam:** before dialing for community payloads, filter by the per-community
   transport policy read API (Plan 27). Until Plan 27 lands, the seam is a no-op allow-all
   function `transportPolicyAllows(layerId, communityId) => true` defined HERE so the call
   sites exist and Plan 27 only swaps the implementation.
5. **Defaults:** `auto_connect_enabled` ON (foreground triggers only),
   `auto_connect_wifi_only` ON (cellular dialing opt-in), background scheduled rounds
   remain gated by the existing `background_sync_enabled` (default false until device QA
   passes, then flipped in Plan 23 Phase 4 sign-off).
6. **Honesty:** the card never shows "online"/"connected to N peers". It shows: automation
   enabled/disabled, time of last round, per peer the last REAL session result from
   `sync_sessions` and last attempt from `sync_auto_connect_state`. Failure text is
   factual: "Last attempt 16:04, no listener reachable."

---

## Phases

### Phase 0: session token + schema (pure engine)
- T0.1 `protocol/session-token.ts`: `deriveSessionRendezvousToken` + tests
  (`session-token.test.ts`): determinism across both ends, day rotation, domain separation
  vs `deriveMailboxToken` output on identical secret (NC: tokens differ), previous-bucket
  fallback helper `sessionTokenCandidates(secret, now)` returns [today, yesterday].
- T0.2 `db/schema.ts`: `auto_connect INTEGER NOT NULL DEFAULT 1` on `sync_paired_devices`
  via the existing `createSyncTables` additive-column pattern; `sync_auto_connect_state`
  (peer_device_id TEXT PK, failure_count INTEGER, next_attempt_at INTEGER,
  last_attempt_at INTEGER, last_result TEXT). Queries: `getAutoConnectPeers`,
  `readAutoConnectState`, `writeAutoConnectState`, `setPeerAutoConnect`.
- T0.3 Barrel exports both `index.ts` and `index.native.ts`; RN-safe import test.

### Phase 1: pure auto-connect job (engine)
- T1.1 `engine/auto-connect.ts`: `planAutoConnectRound` (pure; unit-test the skip rules,
  backoff ladder 30s/2m/10m/30m/2h, lower-deviceId-initiates rule, LAN-preferred-when-
  discovered ordering, Plan 27 seam filter).
- T1.2 `runAutoConnectJob(deps)`: DI exactly like `runBackgroundSyncCore` (deps: db,
  engine, backend factory, connectRelay, connectLan, discoveredPeers, policy, now). Per
  dial calls `runSyncSessionJob`; writes `sync_auto_connect_state`; returns honest counts
  `{ attempted, completed, failed, skipped }`. Node integration test: two in-memory
  engines + loopback relay backend, a full auto round completes a REAL session and resets
  backoff; an offline peer produces a failed row + backoff advance; a second immediate
  round skips (min interval) unless pendingChanges > 0.
- T1.3 NC tests: no dial when `auto_connect=0` for the peer; no relay dial when the health
  gate has no fresh probe; token used is the session token, never the mailbox token.

### Phase 2: mobile wiring + honest UI
- T2.1 `data/auto-connect-core.ts`: settings keys + trigger throttle (a trigger may fire a
  round at most every 60s) + read models.
- T2.2 `SyncProvider.tsx`: `autoConnectRound()` (wraps `runAutoConnectJob` with the same
  deps as manual paths); wire LANDiscovery `onPeerFound` to an opportunistic LAN dial for
  that peer (this replaces tap-to-fill-only behavior; keep the picker row too);
  `useAutoConnectTriggers` hook: AppState active -> round; optional lazy NetInfo
  (`@react-native-community/netinfo`, lazy require, null-safe like `lan-backend.ts`)
  network-regained -> round; engine statusStore pendingChanges>0 -> round (throttled).
- T2.3 `AutoConnectCard.tsx` + settings/sync screen integration: global toggle, wifi-only
  toggle, per-peer toggles, last round + per-peer honest rows, "Sync all now".
- T2.4 COPY RETIREMENT (same commit as T2.2): replace `sync.tsx:402` and
  `settings.tsx:402,446` manual-only strings with the new honest copy: "Automatic sync
  runs when you open the app, when a paired device appears on your network, and on a
  schedule if background sync is on. Nothing shows as connected unless a real session
  ran." Update `apps/meerkat/CLAUDE.md` + `AGENTS.md` transport-honesty section and the
  parity guard strings in the SAME session (the guard locks these strings).

### Phase 3: web parity
- T3.1 `lib/auto-connect-core.ts` twin; triggers: `visibilitychange` visible + `online`
  event + manual button. Relay-only ladder (web has no LAN by Plan 20 parity rule).
- T3.2 `MeerkatProvider.tsx` round runner + `AutoConnectCard` twin; parity guard entries.

### Phase 4: background graduation
- T4.1 Declare `expo-task-manager`, `expo-background-task`, `expo-notifications` in
  `apps/meerkat/package.json` + `app.config.ts` plugins (keep every lazy-load/no-op-absent
  path exactly as is; Expo Go must keep working).
- T4.2 Extend `runBackgroundSyncCore`: after the drain, run one auto-connect round with
  `role` decided by the lower-deviceId rule (replaces listen-only opportunistic mode as
  the default when `background_sync_enabled` is on); keep counts honest.
- T4.3 Battery gate: lazy `expo-battery`; skip background rounds under 20% unless
  charging; unit-test the gate with an injected battery reader.
- T4.4 Tier-D ticket: extend `apps/meerkat/Tickets/launch-plan.md` background QA checklist
  with auto-connect rows (2 devices: foreground trigger sync, LAN discovery sync,
  scheduled background round, push-wake round, backoff after peer offline).

### Phase 6: opt-in peer-validated presence (2026-07-01 amendment)
- T6.1 (engine, pure) `protocol/presence-beacon.ts`: a SIGNED presence beacon
  `{ version:1, communityId, deviceId, issuedAt, ttlSeconds, sig }`, `signPresenceBeacon` /
  `verifyPresenceBeacon(beacon, expectedSignerDeviceId, now)` returning fresh/expired/invalid.
  Distinct signing domain `meerkat-presence-v1` (cross-domain isolation test vs session/DM/
  channel/humanity domains). No content, no location, no last-seen text: a beacon asserts
  only "this signed device is currently sharing presence in this community, valid until
  issuedAt+ttl". Sealed for transport (reuse the mailbox/beacon seal) so the relay reads
  only a token + size.
- T6.2 (engine) validate the beacon signer is a real member: `presenceCounts(db, communityId,
  now)` counts DISTINCT signer device ids that (a) have a fresh verified beacon AND (b) appear
  in the community's signed roster (`communityRole !== null` against the stored descriptor).
  A non-member beacon is dropped fail-closed (never counted). Device-local storage
  `cm_presence_beacons` (received beacons, TTL-pruned) with an explicit device_local sync
  rule per the C1 convention.
- T6.3 (app, both surfaces) a per-user per-community "Appear online to members" toggle
  (`mk_settings` / community setting, DEFAULT OFF). When on, the auto-connect round (or a
  lightweight beacon round) seals+parks a fresh beacon to co-members over the SAME transport
  the community's Plan 27 policy allows (a local_only community's beacon never rides relay).
  Honest UI: "N members sharing presence" from `presenceCounts`, each with a TTL-fresh dot;
  the count is real signed rows, never a fabricated dot or a server figure.
- T6.4 Red-team: a forged beacon (non-member signer) is not counted; an expired beacon drops
  from the count at TTL; the relay artifact carries no device id or membership fact (sealed);
  a local_only community's presence never appears on a relay transport.

### Phase 5: hardening + ship
- T5.1 Red-team tests: token linkability (relay sees a different token each UTC day; token
  reveals no deviceId), double-initiate storm (both devices trigger simultaneously ->
  exactly one session), backoff persistence across restart.
- T5.2 `/qa` + `/design-review` passes; docs (`apps/meerkat/CLAUDE.md` architecture + table
  prefix sections; `docs/guides/` tester guide note); parity suite green; function gate.

---

## Acceptance Criteria

- AC-1: With a deployed relay and two paired devices, opening the app on device A while B
  is foregrounded results in a REAL completed session within 60s with zero taps and zero
  typed phrases, recorded in `sync_sessions` on both.
- AC-2: Two paired devices on the same Wi-Fi with no relay configured sync automatically
  when both apps are open (mDNS-triggered LAN session), dev build.
- AC-3: A peer that is offline produces honest failed attempts with backoff (30s -> 2h cap)
  and never a fabricated status; the card shows the real last attempt and last session.
- AC-4: Per-peer toggle off means that peer is never auto-dialed (engine-verified, not
  UI-only). Global toggle off restores exact pre-plan manual behavior.
- AC-5: No UI anywhere shows online status, peer counts, or "connected" outside a live
  session. The retired manual-only strings are gone from BOTH surfaces and the
  CLAUDE.md/AGENTS.md honesty sections are updated in the same change.
- AC-6: Web auto-connects on tab focus over relay only; parity guard locks the twins.
- AC-7: Local-only communities (Plan 27) are never auto-dialed over relay once Plan 27
  lands; until then the seam function exists and is covered by a test asserting it is
  consulted for every community dial.
- AC-8: Everything remains Expo-Go-safe: absent native modules degrade to foreground
  AppState triggers only, with honest capability copy.

## Negative Criteria (never do)

- NC-1 (revised per the 2026-07-01 amendment): No SERVER-SIDE presence registry and no
  plaintext presence to any relay. Presence is OPT-IN (default off, per-user per-community),
  peer-validated by signed roster membership, delivered as SEALED beacons the relay cannot
  read, and displayed only with honest TTL freshness from a real verified signed beacon.
  Never a fabricated online dot, never a "last seen" the recipient did not actually sign.
- NC-2: Never reuse the mailbox token or friend-code token as the live-session token.
- NC-3: Never dial a community's payload over a transport its policy forbids.
- NC-4: Never auto-flip `background_sync_enabled`; graduation to default-on happens only in
  Plan 23 Phase 4 after device QA sign-off.
- NC-5: No new cryptography; the token derivation clones the existing HKDF family.

## Test Plan

- Tier A (pure, Node): session-token determinism/rotation/domain-separation; planner skip
  rules + backoff ladder; battery/wifi gates with injected readers.
- Tier B (integration, Node): two engines + loopback relay full auto round; offline-peer
  failure honesty; double-trigger single-session; state persistence.
- Tier C (app, vitest): provider round with mocked deps; trigger throttling; copy
  retirement (test asserts the old strings are ABSENT and new strings present, both
  surfaces); parity script extension.
- Tier D (device, founder QA): the Phase 4 ticket rows.

## Founder-Ops Boundary

Deployed default relay (runbook section 2) for out-of-box internet auto-connect; dev/EAS
build for LAN/NetInfo/battery/background natives; 2-device QA rows. Everything else in
this plan is codeable now.

## Status Delta (2026-07-05)

- P0-P1 built under Plan 37 Wave 1: session-token derivation with daily candidates, `sync_paired_devices.auto_connect`, `sync_auto_connect_state`, auto-connect query helpers, pure planner, and `runAutoConnectJob`.
- The planner consults the Plan 27 policy seam before dialing, persists failure/backoff state, uses the live session token rather than mailbox tokens, and keeps responders listening inside the min-interval window so a lower-device peer with pending changes can connect.
- Verified: `pnpm --filter @mylife/sync test -- session-token auto-connect-plan auto-connect-schema auto-connect-job local-join-handoff humanity-credential humanity-gate`, `pnpm --filter @mylife/sync typecheck`, and `node scripts/check-meerkat-parity.mjs`.
- Remaining codeable: Phases 2-6, including mobile/web wiring, honest UI, background graduation, opt-in peer-validated presence, and hardening.
- The 2026-07-01 presence amendment (001b9b6b: opt-in, peer-validated signed beacons, honest TTL, relay blind, default off, Phase 6) stands.
