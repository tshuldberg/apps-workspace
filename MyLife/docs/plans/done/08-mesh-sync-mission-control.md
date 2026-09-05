# Mesh Sync Mission Control (Plan 08)

**Created:** 2026-04-21
**Owner:** sync-dev (lead); module-registry-dev, hub-shell-dev, db-dev teammates
**Design docs:** `docs/designs/mesh-sync-architecture.md`, `docs/designs/mesh-sync-module-policy-matrix.md`
**Anchor substrate:** `packages/sync/` (extend; do not parallel-wire)
**Signal quality:** High. Concept is captured in investor two-pager and confirmed by user.

## Executive Summary

Decentralized mesh sync becomes the primary data communication layer for Meerkat. Phones talk to each other first (LAN, nearby peer, BLE, WebRTC), server-backed relay only for ciphertext fallback. This plan extends the existing `packages/sync/` substrate through 8 phases: foundation, LAN finish, nearby peer, internet transports, pairing/trust UX, low-risk module rollout, high-risk module rollout, and hardening. No code ships before `ModuleSyncPolicy` is declared for the affected module.

## Scope

- Extend `@mylife/sync` with workspace/key/ACL/tombstone/receipt/conflict/preference/relay-token tables and a six-layer transport ladder with ranked-choice preference negotiation.
- Multi-workspace support: personal (auto-created), group, and community workspaces with per-workspace key rotation and storage accounting.
- Relay anonymity via per-session ephemeral recipient tokens.
- Extend `@mylife/module-registry` `ModuleDefinition` with a required `syncPolicy` (including `maxScope` per entity and `resolverComponent` for manual-review entities) post-Phase 0.
- Ship pairing, revocation, workspace management, transport preference, audit, and conflict-resolver UX in `apps/mobile` and `apps/web`.
- Land sync policies for all modules in `packages/module-registry/src/constants.ts:4`.

## Non-goals

- Replace `SyncTier` (billing concept) or `@mylife/sync/torrent` (public content distribution).
- Full anonymity or onion routing (relay anonymity via ephemeral tokens is in scope; network-level metadata hiding is not).
- Group chat.

## Gate Requirements (apply to every phase)

All code-touching phases must pass:
- `pnpm typecheck` across affected packages
- `pnpm gate:function:changed` on every source edit
- `pnpm check:parity --quiet` before marking complete (hub-registry parity, module-parity, passthrough-parity)
- `pnpm check:module-parity` for any module whose `syncPolicy` is added or changed
- Vitest suite for `@mylife/sync` plus target module test suites

---

## Phase 0 — Foundation

**Scope size:** XL
**Dependencies:** none

**Acceptance criteria:**
1. `SyncScope`, `WorkspaceType`, `ConflictStrategy` types added to `packages/sync/src/types.ts` (alongside types.ts:17 existing `SyncTier`). `SyncTransport` enum expanded with `'nearby'` and `'ble'` variants (even though those transports don't ship until Phase 2). `SyncSession` interface gains `workspaceId` field.
2. `ModuleSyncPolicy`, `ModuleEntitySyncRule` (with `maxScope` and `resolverComponent` fields) added to `packages/module-registry/src/types.ts` and `ModuleDefinitionSchema` at types.ts:178 updated (optional during Phase 0, required at end of Phase 5).
3. Ten new sidecar tables from architecture doc Section 8 added to `packages/sync/src/db/schema.ts:242`: `sync_workspaces` (with `workspace_type`, `archived_at`), `sync_workspace_members` (with `admin` role), `sync_workspace_keys`, `sync_entity_acl`, `sync_tombstones`, `sync_receipts`, `sync_conflict_queue` (with `workspace_id`), `sync_transport_preferences`, `sync_session_module_stats`, `sync_relay_tokens`.
4. `db/queries.ts` gains CRUD helpers for: workspaces (create personal/group/community, archive, list by device), members (invite, remove, role change), key wraps, ACL, tombstones, receipts, conflict queue, transport preferences (ranked CRUD), module stats (write + aggregate), relay tokens (mint, lookup, expire).
5. `SyncEngine` (sync-engine.ts:42) accepts a `modulePolicies: Map<ModuleId, ModuleSyncPolicy>` and consults it before writing to `sync_change_log`. Engine enforces: (a) scope check against policy, (b) `maxScope` cap per entity, (c) supabase/drizzle module guard (rejects non-device-local changes), (d) `stripColumns` removal at write time.
6. `db-integration.ts` (at `packages/sync/src/db-integration.ts`) wires all 10 new tables into the database initialization flow.
7. Auto-creation of a `personal` workspace on first launch (triggered by `SyncEngine.initialize`).
8. `@mylife/sync/README.md` documents: `SyncTier` vs `SyncScope` distinction, tier-scope compatibility matrix (architecture doc Section 14), transport ladder, multi-workspace model, anchor-file path corrections (architecture doc Section 13), and `stripColumns` enforcement semantics.
9. Relay anonymity types and token management: `SyncRelayToken` type, `sync_relay_tokens` table, token mint/rotate/expire helpers in `db/queries.ts`. Protocol-level integration deferred to Phase 3 when relay transport ships.

**Files:**
- `packages/sync/src/types.ts`
- `packages/sync/src/db/schema.ts`
- `packages/sync/src/db/queries.ts`
- `packages/sync/src/db-integration.ts`
- `packages/sync/src/engine/sync-engine.ts`
- `packages/module-registry/src/types.ts`
- `packages/sync/README.md`

**Parity impact:** None yet; `syncPolicy` is optional until end of Phase 5.

---

## Phase 1 — LAN Transport

**Scope size:** M
**Dependencies:** Phase 0

**Acceptance criteria:**
1. `packages/sync/src/transport/lan-discovery.ts:71` no longer a stub. Real Bonjour/DNS-SD advertisement via `react-native-zeroconf` (mobile) and a platform shim on web-desktop (Node `mdns` or `bonjour-service`).
2. `LANTransport` confirmed to open an encrypted TCP socket using the workspace key; Noise_XK handshake precedes the channel per architecture Section 6 step 2.
3. `transport-manager.ts:111` proceeds to the next ladder rung instead of throwing (transport-manager.ts:130) when LAN fails.
4. Local-first responder: an incoming LAN connection is accepted even when the engine is idle; the initiator role is symmetric.
5. Integration test: two local SyncEngines in the same Vitest process exchange one signed delta over a simulated LAN transport with workspace-key sealing.

**Files:**
- `packages/sync/src/transport/lan-discovery.ts`
- `packages/sync/src/transport/lan-transport.ts`
- `packages/sync/src/transport/transport-manager.ts`
- `packages/sync/src/__tests__/lan-roundtrip.test.ts` (new)

**Parity impact:** None. No module wiring yet.

---

## Phase 2 — Nearby Peer

**Scope size:** L
**Dependencies:** Phase 1

**Acceptance criteria:**
1. New `transport/nearby-transport.ts` with:
   - iOS / macOS bridge over `MultipeerConnectivity` (`MCSession`, `MCNearbyServiceAdvertiser`, `MCNearbyServiceBrowser`) via an Expo config plugin.
   - Android bridge over `WifiP2pManager` + `WifiAwareSession` via an Expo config plugin.
2. New `transport/ble-transport.ts` as wake-up-only transport using CoreBluetooth and BluetoothGatt. BLE sends a GATT notify with `{deviceId, pendingModules[], totalBytes}` to signal available changes; actual data transfer escalates to a higher-bandwidth layer. No data fragmentation over BLE.
3. `TransportManager.connectToPeer` selector walks LAN → nearby → BLE and records cooldown timers per layer.
4. Device handshake works identically across LAN and nearby layers (Noise_XK is transport-agnostic).
5. Two-device end-to-end test on iOS + Android emulator pair (or documented reproducible manual test) exchanging a signed delta over nearby peer with Wi-Fi disabled.

**Files:**
- `packages/sync/src/transport/nearby-transport.ts` (new)
- `packages/sync/src/transport/ble-transport.ts` (new)
- `packages/sync/src/transport/transport-manager.ts`
- `apps/mobile/plugins/meerkat-nearby.ts` (new Expo config plugin)

**Parity impact:** Mobile-only; web skips layers 2 and 3 and falls straight through.

---

## Phase 3 — Internet Transports + Relay Anonymity

**Scope size:** L
**Dependencies:** Phase 2

**Acceptance criteria:**
1. WebRTC DataChannel extracted from `providers/p2p.ts:53` into `transport/webrtc-transport.ts`. The provider shell stays for tier-based callers.
2. New `transport/relay-transport.ts`: a WebSocket client that sends ciphertext envelopes keyed by ephemeral session tokens (not device pubkeys). Tokens are minted per session using `HKDF(initiator_ephemeral_secret, relay_pubkey)` and stored in `sync_relay_tokens`.
3. Relay anonymity wired into session protocol step 3 (workspace negotiation): if the current session is relay-backed, both sides exchange ephemeral tokens. The relay stores and forwards ciphertext indexed by opaque tokens it cannot correlate across sessions (architecture doc Section 3b).
4. Token rotation: new token per session. The relay never sees the same identifier twice. Tokens expire after session completion (configurable TTL, default 24h for offline delivery).
5. Ciphertext-only relay server spec and contract (JSON over WS, size cap, TTL, token-indexed routing). Server implementation tracked as a separate infra ticket.
6. Transport ladder completes: LAN → nearby → BLE wake-up → WebRTC → relay; relay is terminal.
7. Ranked-choice transport preference negotiation wired into `TransportManager.connectToPeer`: both peers exchange preferences, selector picks highest mutual match (architecture doc Section 3a).
8. Tier-scope enforcement: `TransportManager` checks the user's `SyncTier` against the tier-scope compatibility matrix (architecture doc Section 14) and blocks transport layers the tier does not authorize.
9. Integration test: two SyncEngines behind simulated NATs exchange a delta via WebRTC; a third NAT-hostile test routes via the relay with ephemeral tokens; a fourth test verifies tier enforcement blocks relay for `p2p`-tier users.

**Files:**
- `packages/sync/src/transport/webrtc-transport.ts` (new; factored out of `providers/p2p.ts`)
- `packages/sync/src/transport/relay-transport.ts` (new)
- `packages/sync/src/providers/p2p.ts`
- `packages/sync/src/transport/transport-manager.ts`
- `packages/sync/src/protocol/sync-session.ts` (relay token exchange in workspace negotiation)

**Parity impact:** None yet; modules still do not wire mesh sync.

---

## Phase 4 — Pairing + Trust UX + Multi-Workspace Management

**Scope size:** XL
**Dependencies:** Phase 3

**Acceptance criteria:**
1. QR pairing UX on mobile and web: generate + scan, includes wrapped workspace key per architecture Section 5. Uses `packages/sync/src/identity/pairing.ts` under the hood. Pairing targets a specific workspace (QR encodes `workspaceId`).
2. NFC pairing flow on iOS + Android for high-trust modules (meds, payments). Optional; gated behind a feature flag.
3. Workspace management screens: create new workspace (group/community), list workspaces the user belongs to, workspace detail with member list, show last-seen, revoke device from a specific workspace, archive workspace. Revocation triggers `sync_device_revocations` write and workspace-key rotation for that workspace only.
4. Fingerprint compare prompt on any pairing where a sensitive-module policy is involved (policy matrix "Sensitive? Yes" column).
5. Transport preference screen: Settings > Sync > Transport Preferences. Users rank transport layers. Defaults follow ladder order.
6. Audit UX: Settings > Sync Activity, backed by `sync_sessions` + `sync_session_module_stats`. Per-module byte count breakdown visible per session. Workspace filter on audit view.
7. Key rotation exercised: an owner removes a member from workspace X, all active devices in workspace X eventually rotate to the new `current_key_version`, old wraps are tombstoned. Other workspaces unaffected.
8. Shared `<ConflictResolver>` component in `@mylife/ui` for queue list view and basic "pick A or B" fallback. This is the shell; per-module custom resolvers register via `resolverComponent` field in `ModuleEntitySyncRule` during Phases 5-6.
9. `check:module-parity` extended: any module with `requiresManualResolver: true` must export a registered `resolverComponent`. Gate enforced from Phase 5 onward.

**Files:**
- `apps/mobile/app/(hub)/settings/sync-workspaces.tsx` (new; workspace list)
- `apps/mobile/app/(hub)/settings/sync-workspace-detail.tsx` (new; members, admin)
- `apps/mobile/app/(hub)/settings/sync-activity.tsx` (new)
- `apps/mobile/app/(hub)/settings/pair-device.tsx` (new)
- `apps/mobile/app/(hub)/settings/transport-preferences.tsx` (new)
- `apps/web/app/settings/sync-workspaces/page.tsx` (new)
- `apps/web/app/settings/sync-workspace/[id]/page.tsx` (new)
- `apps/web/app/settings/sync-activity/page.tsx` (new)
- `apps/web/app/settings/pair-device/page.tsx` (new)
- `apps/web/app/settings/transport-preferences/page.tsx` (new)
- `packages/ui/src/sync/ConflictResolver.tsx` (new; shared component)
- `packages/sync/src/identity/pairing.ts` (existing, extended)
- `packages/sync/src/identity/revocation.ts` (existing, extended)

**Parity impact:** Hub shell changes; run `pnpm check:passthrough-parity`. No module-parity impact yet.

---

## Phase 5 — Low-Risk Module Rollout

**Scope size:** L
**Dependencies:** Phase 4

**Target modules (see matrix):** `notes`, `journal`, `recipes`, `rsvp`, `friends`, `homes`, `trails`, plus `presence` shareable entities only (`pr_intentions`, `pr_summaries`; `pr_sessions` stays `personal_replica` via `maxScope`).

Note: `fast` is NOT in Phase 5 despite being low-complexity. It is in `HEALTH_DATA_MODULE_IDS` (constants.ts:64) and belongs in Phase 6 with other health modules.

**Acceptance criteria:**
1. Each target module declares `syncPolicy` in its `modules/<name>/src/definition.ts` and in the corresponding entry of `packages/module-registry/src/constants.ts:119`. `presence` declares split entity rules with `maxScope: 'personal_replica'` on `pr_sessions`.
2. `ModuleDefinitionSchema` (`packages/module-registry/src/types.ts:178`) becomes `syncPolicy: z.object({...})` required for these modules (enforced via test). Remaining modules still optional until end of Phase 6.
3. Document-CRDT entities (`nt_notes.body_md`, `jn_entries.body_md`, `rc_recipes.body_md`, `fn_memories.body_md`) are wired through `DocumentManager` (`packages/sync/src/crdt/document-manager.ts`) and round-trip through a two-device integration test per module.
4. OR-Set entities (tags) merge on add/remove without losing concurrent additions.
5. `shared_workspace` scope works end-to-end for one of the target modules (user picks notes as the bellwether): an invited member sees the shared note after pairing via a group workspace.
6. Multi-workspace sync verified: a user in two group workspaces syncs different note subsets to each. Workspace negotiation (protocol step 3) correctly scopes the session.
7. `maxScope` enforcement verified: `presence.pr_sessions` cannot be escalated to `shared_workspace` even in a group workspace.
8. BestChef kitchen split verified: pantry, pantry batches, receipts, receipt lines, local food products, local food aliases, confirmations, and local nutrition rows are capped at `personal_replica`. Published product cache rows require explicit contribution opt-in, license/attribution metadata, image consent, and moderation approval.
9. All target module test suites pass; `pnpm check:module-parity` clean.

**Files:**
- `modules/notes/src/definition.ts`, `modules/journal/src/definition.ts`, `modules/recipes/src/definition.ts`, `modules/rsvp/src/definition.ts`, `modules/friends/src/definition.ts`, `modules/homes/src/definition.ts`, `modules/trails/src/definition.ts`, `modules/presence/src/definition.ts`
- `packages/module-registry/src/constants.ts`
- `modules/bestchef/src/definition.ts`, `modules/bestchef/src/cloud/schema.sql`
- Tests in each module's `__tests__/`

**Parity impact:** `pnpm check:parity` must be clean for all target modules. Run `pnpm check:module-parity` + `pnpm check:workouts-parity` (workouts untouched, proves no regression).

---

## Phase 6 — High-Risk Module Rollout

**Scope size:** L
**Dependencies:** Phase 5

**Target modules (see matrix):** `budget`, `health`, `meds`, `payments`, `fast`, plus the remaining sensitive tier (`cycle`, `mood`, `nutrition`, `sleep`, `habits`, `workouts` health rows, `sports` financial rows via `maxScope`, `subs`, `presence.pr_sessions` personal data).

Note: `fast` lands here (not Phase 5) because it is in `HEALTH_DATA_MODULE_IDS` (constants.ts:64). `presence` shareable entities shipped in Phase 5; only `pr_sessions` (personal, health-adjacent) gets its policy finalized here.

**Acceptance criteria:**
1. Each target module ships a custom conflict resolver component via `resolverComponent` field for its `manual_review` entities. Resolvers are registered in the module's exports and rendered by the shared `<ConflictResolver>` shell from Phase 4.
2. `check:module-parity` gate validates that every entity with `requiresManualResolver: true` has a registered `resolverComponent`.
3. Explicit consent prompt before any sensitive-module data enters `shared_workspace` scope. Consent is logged in `hub_consents` (existing) with a mesh-sync-specific consent type. Legal review completed before this phase ships.
4. `isSensitive: true` flag in `ModuleSyncPolicy` enforces fingerprint-compare pairing (Phase 4).
5. Financial modules (`budget`, `payments`, `subs`) default to `personal_replica` only; no `shared_workspace` option in UI. `sports.sp_bets` capped via `maxScope: 'personal_replica'`. Matrix confirms.
6. All target module test suites pass; `pnpm check:parity` clean.
7. `ModuleDefinitionSchema` requires `syncPolicy` for all modules in `ModuleId` union; Phase 6 completion closes the schema.

**Files:**
- `modules/budget/src/definition.ts`, `modules/health/src/definition.ts`, `modules/meds/src/definition.ts`, `modules/payments/src/definition.ts`, and the remaining sensitive modules.
- `packages/module-registry/src/constants.ts`
- `packages/module-registry/src/types.ts` (schema tightening)
- Per-module `ConflictResolver` host screens

**Parity impact:** Full parity suite; this is the phase that most stresses `check:module-parity`.

---

## Phase 7 — Hardening

**Scope size:** L
**Dependencies:** Phase 6

**Acceptance criteria:**
1. Threat-model walkthrough (architecture doc Section 12) validated: LAN attacker, relay operator (with anonymity), revoked member, lost-device, cross-workspace attacker, and malicious module author scenarios each exercised in an integration test or documented red-team exercise.
2. Relay anonymity verification: confirm relay cannot correlate sessions across token rotations. Test that a relay operator observing traffic from the same device across multiple sessions sees only distinct opaque tokens.
3. Multi-workspace stress test: a device in 5+ workspaces syncs concurrently. Verify workspace isolation (no data leaks between workspaces), key rotation independence, and storage accounting aggregation.
4. Penetration exercise report in `docs/sessions/YYYY-MM-DD-mesh-sync-redteam.md`.
5. **Conflict resolver review gate:** Dedicated review pass auditing the hybrid resolver model (shared shell + per-module custom resolvers). Evaluate: (a) is the shared/per-module split the right architecture, (b) do custom resolvers render correctly for each module's data shape, (c) is the "pick A or B" fallback adequate for edge cases, (d) mobile/web parity of all resolver screens.
6. Performance: 1000-row delta round-trip under 2s on LAN, under 8s on WebRTC, tracked in `artifacts/perf-audit/mesh-sync/`.
7. Ranked-choice transport preference verified: two users with different preference orders correctly negotiate the highest mutual match. Edge case: no mutual match falls through to default ladder.
8. Module count reconciliation: verify all `ModuleId` union values have a `syncPolicy` declared, and the policy matrix row count matches the `ModuleId` union size.

**Files:**
- `docs/sessions/*` red-team session log
- `packages/sync/README.md`
- `packages/sync/src/__tests__/*.perf.test.ts`
- `artifacts/perf-audit/mesh-sync/`

**Parity impact:** Full parity suite clean. `pnpm check:generated-artifacts` must pass (perf outputs go under `artifacts/`, not `docs/performance/`).

---

## Cross-phase ownership map

| Zone | Owner |
|------|-------|
| `packages/sync/` engine, transports, db | sync-dev |
| `packages/module-registry/` policy types, schema | module-registry-dev |
| `modules/<name>/src/definition.ts` | module-dev per module |
| `apps/mobile/app/(hub)/settings/sync-*` | hub-shell-dev (mobile) |
| `apps/web/app/settings/sync-*` | hub-shell-dev (web) |
| `packages/ui/src/sync/ConflictResolver.tsx` | ui-dev |
| Tests | tester + each owner |

## Risk register

- **R1 (high):** Native modules for Multipeer and Wi-Fi Direct require Expo config plugins and EAS builds. First such EAS build is expected to fail; reference `.claude/memory/feedback_eas_build_prevention.md`.
- **R2 (medium):** `DocumentManager` Automerge dependency footprint across modules; validate bundle size impact in Phase 5.
- **R3 (medium):** Relay server is new infrastructure with ephemeral token routing, introducing a new ops surface. Ciphertext-only contract, token-indexed routing, and rate limits required before any prod traffic.
- **R4 (medium):** Workspace-key rotation on member removal is the highest-stakes code path, now per-workspace scoped. Phase 4 must land automated rotation tests before Phase 6 ships sensitive modules. Multi-workspace rotation independence must be verified.
- **R5 (resolved):** Bonjour service type stays `_mylife-sync._tcp`. No migration needed.
- **R6 (medium):** Multi-workspace complexity. Storage accounting aggregation, workspace negotiation in session protocol, and per-workspace revocation add moving parts. Phase 7 stress test (5+ workspaces, concurrent sync) is the verification gate.
- **R7 (low):** Relay anonymity adds token management overhead. Token expiry, rotation, and offline-delivery windows add edge cases. Phase 3 integration tests must cover token lifecycle thoroughly.
