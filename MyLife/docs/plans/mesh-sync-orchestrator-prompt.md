# Mesh Sync Orchestrator Prompt

Paste this prompt into a Claude Code session (Opus 4.6 1M context) to execute the full mesh sync mission control.

---

## Prompt

```
You are the orchestrator for the Mesh Sync Mission Control (Plan 08) in the MyLife codebase. Your job is to execute all 8 phases (0-7) of decentralized mesh sync by spawning and managing worker agents. You do not write code yourself. You plan, delegate, verify, and coordinate.

## Your constraints

1. **Maximum 3 agents running concurrently.** Never spawn a 4th until one of the 3 completes.
2. **Phases are sequential.** Phase N+1 cannot start until Phase N passes all gates. Within a phase, you may parallelize independent tasks across your 3 agent slots.
3. **Every agent gets file ownership.** Before spawning, assign each agent a non-overlapping set of files. Two agents must never edit the same file. If a task needs a file another agent owns, wait for that agent to finish first.
4. **Every agent task ends with a gate run.** The agent must run `pnpm typecheck` and `pnpm gate:function:changed` on its files before reporting done. You verify by checking the agent's output.
5. **Phase gate before advancing.** After all tasks in a phase complete, YOU run the phase gate: `pnpm typecheck`, `pnpm test -- --run packages/sync`, and `pnpm check:parity --quiet`. Only advance to the next phase if all pass.
6. **If an agent fails,** read its output, diagnose the issue, and respawn a corrective agent into the same slot with specific fix instructions. Do not skip or hand-wave failures.
7. **Commit after each phase.** After the phase gate passes, create a commit: `feat(sync): Phase N -- <short description>`.

## Key documents (read these before starting)

- Mission control: `docs/plans/queue/08-mesh-sync-mission-control.md` (phases, acceptance criteria, files)
- Architecture: `docs/designs/mesh-sync-architecture.md` (trust model, protocol, schema, resolved decisions in Section 16)
- Policy matrix: `docs/designs/mesh-sync-module-policy-matrix.md` (per-module scope, conflict strategy, phase assignment)
- Existing sync substrate: `packages/sync/src/` (extend, never parallel-wire)
- Module registry types: `packages/module-registry/src/types.ts` (ModuleDefinition, ModuleId)
- Module registry constants: `packages/module-registry/src/constants.ts` (MODULE_METADATA, HEALTH_DATA_MODULE_IDS)

## File ownership zones

These are the non-overlapping zones you assign to agents. Never let two agents touch the same zone simultaneously.

| Zone | Files |
|------|-------|
| sync-types | `packages/sync/src/types.ts` |
| sync-schema | `packages/sync/src/db/schema.ts`, `packages/sync/src/db/migration.ts` |
| sync-queries | `packages/sync/src/db/queries.ts` |
| sync-engine | `packages/sync/src/engine/sync-engine.ts`, `packages/sync/src/engine/sync-scheduler.ts`, `packages/sync/src/engine/sync-status.ts` |
| sync-db-integration | `packages/sync/src/db-integration.ts` |
| sync-transport | `packages/sync/src/transport/transport-manager.ts`, `packages/sync/src/transport/lan-discovery.ts`, `packages/sync/src/transport/lan-transport.ts` |
| sync-transport-new | `packages/sync/src/transport/nearby-transport.ts`, `packages/sync/src/transport/ble-transport.ts`, `packages/sync/src/transport/webrtc-transport.ts`, `packages/sync/src/transport/relay-transport.ts` |
| sync-protocol | `packages/sync/src/protocol/sync-session.ts`, `packages/sync/src/protocol/handshake.ts`, `packages/sync/src/protocol/message-codec.ts` |
| sync-encryption | `packages/sync/src/encryption/noise-handshake.ts`, `packages/sync/src/encryption/encrypt.ts`, `packages/sync/src/encryption/keys.ts` |
| sync-identity | `packages/sync/src/identity/pairing.ts`, `packages/sync/src/identity/revocation.ts`, `packages/sync/src/identity/device-identity.ts` |
| sync-crdt | `packages/sync/src/crdt/change-tracker.ts`, `packages/sync/src/crdt/document-manager.ts`, `packages/sync/src/crdt/conflict-reporter.ts` |
| sync-providers | `packages/sync/src/providers/p2p.ts`, `packages/sync/src/providers/local-only.ts`, `packages/sync/src/providers/cloud.ts` |
| sync-tests | `packages/sync/src/__tests__/*.ts` |
| sync-docs | `packages/sync/README.md` |
| registry-types | `packages/module-registry/src/types.ts` |
| registry-constants | `packages/module-registry/src/constants.ts` |
| ui-sync | `packages/ui/src/sync/` |
| mobile-settings | `apps/mobile/app/(hub)/settings/sync-*.tsx`, `apps/mobile/app/(hub)/settings/pair-*.tsx`, `apps/mobile/app/(hub)/settings/transport-*.tsx` |
| mobile-plugins | `apps/mobile/plugins/` |
| web-settings | `apps/web/app/settings/sync-*/`, `apps/web/app/settings/pair-*/`, `apps/web/app/settings/transport-*/` |
| module-defs | `modules/*/src/definition.ts` (assign per-module subsets to different agents) |

## Phase execution plan

### PHASE 0 -- Foundation (XL, no deps)

Split into 3 parallel agent tasks:

**Agent 0A: Types + Schema + DB Integration**
- Zones: sync-types, sync-schema, sync-db-integration
- Tasks:
  - Add `SyncScope`, `WorkspaceType`, `ConflictStrategy` types to `packages/sync/src/types.ts`
  - Expand `SyncTransport` with `'nearby'` and `'ble'`
  - Add `workspaceId` to `SyncSession` interface and its Zod schema
  - Add all 10 new sidecar tables to `packages/sync/src/db/schema.ts` (sync_workspaces with workspace_type + archived_at, sync_workspace_members with admin role, sync_workspace_keys, sync_entity_acl, sync_tombstones, sync_receipts, sync_conflict_queue with workspace_id, sync_transport_preferences, sync_session_module_stats, sync_relay_tokens)
  - Add all new TS interfaces: SyncWorkspace, SyncWorkspaceMember, SyncWorkspaceKeyWrap, SyncEntityAcl, SyncTombstone, SyncReceipt, SyncConflictEntry, SyncTransportPreference, SyncSessionModuleStats, SyncRelayToken
  - Wire all 10 tables into db-integration.ts initialization flow
  - Reference: architecture doc Section 8 for exact SQL, Section 16 for resolved decisions

**Agent 0B: Queries + Engine**
- Zones: sync-queries, sync-engine, sync-crdt
- Tasks:
  - CRUD helpers in db/queries.ts for: workspaces (create personal/group/community, archive, list by device), members (invite, remove, role change), key wraps, ACL, tombstones, receipts, conflict queue, transport preferences (ranked CRUD), module stats (write + aggregate), relay tokens (mint, lookup, expire)
  - SyncEngine accepts `modulePolicies: Map<ModuleId, ModuleSyncPolicy>` in constructor
  - Engine enforces at write path: (a) scope check vs policy, (b) maxScope cap per entity, (c) supabase/drizzle module guard rejects non-device-local, (d) stripColumns removal at write time
  - Auto-create personal workspace on SyncEngine.initialize
  - ChangeTracker consults modulePolicies before appending to sync_change_log
  - IMPORTANT: This agent imports types from packages/sync/src/types.ts which Agent 0A is editing. Agent 0A's types must land first. Spawn this agent AFTER Agent 0A completes, OR have this agent stub the imports and note that 0A will provide the real types.

**Agent 0C: Registry Types + Docs**
- Zones: registry-types, sync-docs
- Tasks:
  - Add `ModuleSyncPolicy`, `ModuleEntitySyncRule` (with `maxScope`, `resolverComponent`, `stripColumns`) to packages/module-registry/src/types.ts
  - Add `ConflictStrategy` type
  - Update `ModuleDefinitionSchema` Zod schema to accept optional `syncPolicy` (required tightening deferred to Phase 5)
  - Add `syncPolicy?: ModuleSyncPolicy` to `ModuleDefinition` interface
  - Write packages/sync/README.md documenting: SyncTier vs SyncScope, tier-scope compatibility matrix, transport ladder, multi-workspace model, anchor-file path corrections, stripColumns semantics
  - Reference: architecture doc Section 9 for types, Section 14 for tier-scope matrix, Section 16 for decisions

**Dependency note:** Agent 0B depends on Agent 0A's types. Options:
- Run 0A first, then 0B + 0C in parallel (2 rounds, safer)
- Run all 3 in parallel with 0B stubbing type imports (1 round, may need fixup agent)

Recommended: Run 0A + 0C in parallel (they don't overlap). When 0A finishes, spawn 0B.

After all 3 complete: run phase gate, commit.

### PHASE 1 -- LAN Transport (M, depends on Phase 0)

Split into 2 parallel agents (3rd slot reserved for fixups):

**Agent 1A: LAN Discovery + Transport**
- Zones: sync-transport
- Tasks:
  - Replace LANDiscovery stub with real Bonjour/DNS-SD via react-native-zeroconf (mobile) and bonjour-service (Node)
  - LANTransport opens encrypted TCP with workspace key; Noise_XK handshake first
  - transport-manager.ts proceeds to next rung instead of throwing at line 130
  - Symmetric responder: accept incoming LAN connections even when idle

**Agent 1B: Integration Test**
- Zones: sync-tests
- Tasks:
  - Write `packages/sync/src/__tests__/lan-roundtrip.test.ts`
  - Two SyncEngines in same Vitest process exchange one signed delta over simulated LAN transport with workspace-key sealing
  - Verify the new transport-manager fallthrough behavior

After both complete: run phase gate, commit.

### PHASE 2 -- Nearby Peer (L, depends on Phase 1)

**Agent 2A: Nearby + BLE Transports**
- Zones: sync-transport-new (nearby + ble only), mobile-plugins
- Tasks:
  - nearby-transport.ts: iOS MultipeerConnectivity bridge, Android WifiP2pManager bridge via Expo config plugin
  - ble-transport.ts: Wake-up-only GATT notify with {deviceId, pendingModules[], totalBytes}. No data transfer over BLE.
  - Expo config plugin: apps/mobile/plugins/meerkat-nearby.ts

**Agent 2B: Transport Manager Update**
- Zones: sync-transport (transport-manager.ts only)
- Tasks:
  - Selector walks LAN -> nearby -> BLE with cooldown timers per layer
  - Noise_XK handshake works identically across LAN and nearby

**Agent 2C: Tests + Manual Test Doc**
- Zones: sync-tests
- Tasks:
  - Document reproducible manual test: two devices exchange signed delta over nearby with Wi-Fi disabled
  - Integration test for BLE wake-up signal parsing

After all complete: run phase gate, commit.

### PHASE 3 -- Internet Transports + Relay Anonymity (L, depends on Phase 2)

**Agent 3A: WebRTC + Relay Transports**
- Zones: sync-transport-new (webrtc + relay only), sync-providers
- Tasks:
  - Extract WebRTC DataChannel from providers/p2p.ts into transport/webrtc-transport.ts. Provider shell stays.
  - relay-transport.ts: WebSocket client sending ciphertext keyed by ephemeral session tokens. Tokens minted via HKDF(initiator_ephemeral_secret, relay_pubkey), stored in sync_relay_tokens.
  - Token rotation per session; configurable TTL default 24h.

**Agent 3B: Protocol + Preference Negotiation**
- Zones: sync-protocol, sync-transport (transport-manager.ts)
- Tasks:
  - Relay anonymity wired into sync-session.ts step 3: relay-backed sessions exchange ephemeral tokens
  - Ranked-choice transport preference negotiation in TransportManager.connectToPeer
  - Tier-scope enforcement: TransportManager checks SyncTier vs compatibility matrix, blocks unauthorized layers
  - Complete the ladder: LAN -> nearby -> BLE -> WebRTC -> relay

**Agent 3C: Integration Tests**
- Zones: sync-tests
- Tasks:
  - Two SyncEngines behind simulated NATs exchange delta via WebRTC
  - NAT-hostile test routes via relay with ephemeral tokens
  - Tier enforcement test: relay blocked for p2p-tier users
  - Relay server contract spec document (JSON over WS, size cap, TTL, token-indexed routing)

After all complete: run phase gate, commit.

### PHASE 4 -- Pairing + Trust UX + Multi-Workspace Management (XL, depends on Phase 3)

**Agent 4A: Mobile UX**
- Zones: mobile-settings, sync-identity
- Tasks:
  - sync-workspaces.tsx: workspace list (personal + groups + communities)
  - sync-workspace-detail.tsx: member list, last-seen, revoke, archive
  - sync-activity.tsx: session log with per-module byte breakdown, workspace filter
  - pair-device.tsx: QR generate + scan targeting specific workspace
  - transport-preferences.tsx: ranked drag-and-drop preference editor
  - Extend pairing.ts and revocation.ts for workspace-scoped operations

**Agent 4B: Web UX**
- Zones: web-settings
- Tasks:
  - Mirror all mobile screens for web: sync-workspaces, sync-workspace/[id], sync-activity, pair-device, transport-preferences
  - Ensure mobile/web parity on all screens

**Agent 4C: Shared UI + Parity Gate**
- Zones: ui-sync, registry-types (for parity gate extension)
- Tasks:
  - ConflictResolver.tsx: shared queue list view + "pick A or B" fallback in @mylife/ui
  - Extend check:module-parity to validate resolverComponent exists for requiresManualResolver entities
  - Key rotation integration test: owner removes member from workspace X, all devices rotate, other workspaces unaffected

After all complete: run phase gate (including pnpm check:passthrough-parity), commit.

### PHASE 5 -- Low-Risk Module Rollout (L, depends on Phase 4)

Target modules: notes, journal, recipes, rsvp, friends, homes, trails, presence (shareable entities only).
NOT fast (Phase 6, health data).

Split modules across 3 agents:

**Agent 5A: notes, journal, recipes**
- Zones: module-defs (notes, journal, recipes subset)
- Tasks:
  - Declare syncPolicy in each module's definition.ts and constants.ts entry
  - Wire document-CRDT entities through DocumentManager
  - Integration test per module: two-device round-trip

**Agent 5B: rsvp, friends, homes, trails**
- Zones: module-defs (rsvp, friends, homes, trails subset)
- Tasks:
  - Declare syncPolicy in each
  - OR-Set entities merge correctly
  - Integration test per module

**Agent 5C: presence + schema tightening + verification**
- Zones: module-defs (presence), registry-types, registry-constants, sync-tests
- Tasks:
  - Presence split: pr_sessions maxScope personal_replica, pr_intentions + pr_summaries shareable
  - Tighten ModuleDefinitionSchema to require syncPolicy for Phase 5 modules
  - End-to-end test: shared note visible after pairing via group workspace
  - Multi-workspace test: user in two groups syncs different note subsets
  - maxScope enforcement test: presence.pr_sessions cannot escalate

After all complete: run full parity suite (pnpm check:parity, check:module-parity, check:workouts-parity), commit.

### PHASE 6 -- High-Risk Module Rollout (L, depends on Phase 5)

Target: budget, health, meds, payments, fast, cycle, mood, nutrition, sleep, habits, workouts, sports, subs, presence.pr_sessions.

**Agent 6A: budget, meds, payments, subs (financial + meds)**
- Zones: module-defs subset, per-module resolver screens
- Tasks:
  - syncPolicy with manual_review for transactions/schedules
  - Custom conflict resolver components (BudgetConflictResolver, MedsConflictResolver, etc.)
  - Financial modules: personal_replica only, no shared_workspace in UI
  - sports.sp_bets: maxScope personal_replica

**Agent 6B: health, cycle, mood, nutrition, sleep, fast, habits, workouts, presence**
- Zones: module-defs subset, per-module resolver screens
- Tasks:
  - syncPolicy for all health modules
  - isSensitive: true enforces fingerprint-compare
  - Consent prompt before shared_workspace for sensitive data
  - Custom resolvers for manual_review entities

**Agent 6C: Schema closure + full parity**
- Zones: registry-types, registry-constants
- Tasks:
  - ModuleDefinitionSchema requires syncPolicy for ALL ModuleId values
  - Verify every module in constants.ts has syncPolicy declared
  - check:module-parity validates resolverComponent for all requiresManualResolver entities
  - Run full parity suite

After all complete: run full parity suite + check:generated-artifacts, commit.

### PHASE 7 -- Hardening (L, depends on Phase 6)

**Agent 7A: Security + Red Team**
- Zones: sync-tests (security tests), sync-docs
- Tasks:
  - Threat model walkthrough: integration tests for LAN attacker, relay operator (anonymity), revoked member, lost-device, cross-workspace, malicious module
  - Relay anonymity verification: relay cannot correlate sessions across token rotations
  - Penetration exercise report: docs/sessions/YYYY-MM-DD-mesh-sync-redteam.md

**Agent 7B: Stress + Performance**
- Zones: sync-tests (perf tests)
- Tasks:
  - Multi-workspace stress: 5+ workspaces concurrent sync, verify isolation + key rotation independence + storage accounting
  - Performance: 1000-row delta under 2s LAN, under 8s WebRTC
  - Output to artifacts/perf-audit/mesh-sync/ (NOT docs/performance/)
  - Ranked-choice preference negotiation edge cases

**Agent 7C: Conflict Resolver Review + Reconciliation**
- Zones: ui-sync, module-defs (read-only review)
- Tasks:
  - Review gate: audit shared/per-module resolver split for function + accuracy
  - Verify all custom resolvers render correctly per module data shape
  - Mobile/web parity of all resolver screens
  - Module count reconciliation: ModuleId union size == policy matrix rows == syncPolicy declarations

After all complete: run ALL gates (typecheck, parity, generated-artifacts, full test suite), final commit.

## How to spawn agents

Use the Agent tool with `subagent_type: "general-purpose"` and `mode: "auto"`. Each agent prompt must include:
1. The specific file zones it owns (list exact file paths)
2. The acceptance criteria it must meet (copy from mission control)
3. The gate commands it must run before reporting done
4. A reminder to read CLAUDE.md and the architecture doc before writing code
5. A reminder: extend packages/sync/, never parallel-wire

Example spawn:
```
Agent({
  name: "phase-0a-types-schema",
  description: "Phase 0A: sync types + schema + db-integration",
  mode: "auto",
  prompt: "You are implementing Phase 0A of the mesh sync mission control...[full context]"
})
```

## Your execution loop

1. Read the mission control: `docs/plans/queue/08-mesh-sync-mission-control.md`
2. Read the architecture doc: `docs/designs/mesh-sync-architecture.md`
3. Read the policy matrix: `docs/designs/mesh-sync-module-policy-matrix.md`
4. Read the current sync substrate: `packages/sync/src/types.ts`, `packages/sync/src/db/schema.ts`, `packages/sync/src/engine/sync-engine.ts`, `packages/sync/src/transport/transport-manager.ts`
5. For each phase:
   a. Announce: "Starting Phase N -- [name]"
   b. Plan the agent split (max 3). State which agent gets which zones and tasks.
   c. Spawn agents (respect the 3-slot limit and dependency order within the phase)
   d. When an agent completes, read its output. If it failed, diagnose and respawn a fix agent.
   e. When all agents for the phase complete, run the phase gate yourself.
   f. If the gate fails, spawn a fix agent. Do not advance.
   g. If the gate passes, commit and announce: "Phase N complete. Advancing to Phase N+1."
6. After Phase 7 passes, run the final full gate: `pnpm typecheck && pnpm test -- --run && pnpm check:parity --quiet && pnpm check:generated-artifacts`
7. Update `memory.md` with a session summary.
8. Announce completion.

## Critical rules

- NEVER let two agents edit the same file. This is the #1 cause of merge conflicts.
- NEVER advance a phase until all its agents pass and the phase gate is green.
- NEVER skip a gate failure. Fix it before moving on.
- Read each agent's output carefully. An agent saying "done" does not mean it is correct. Verify acceptance criteria.
- Extend packages/sync/. Do not create parallel sync code anywhere else.
- The Bonjour service type stays `_mylife-sync._tcp`. Do not change it.
- ModuleId has 39 values. The policy matrix has 39 rows. These must stay in sync.
- `fast` is Phase 6, not Phase 5 (it's in HEALTH_DATA_MODULE_IDS).
- `presence` is split: shareable entities Phase 5, pr_sessions Phase 6.
- All agents must follow CLAUDE.md conventions: Conventional Commits, no em dashes, TypeScript strict, Vitest.

Start now. Read the documents, then begin Phase 0.
```

---

## Usage

1. Open a Claude Code session with Opus 4.6 (1M context)
2. Make sure you're in the MyLife repo root: `cd /Users/trey/Desktop/Apps/MyLife`
3. Paste the prompt above
4. Let it run. It will announce each phase and manage agents autonomously.
5. Intervene if it asks for clarification or hits an unresolvable blocker.

## Expected timeline

| Phase | Agents | Estimated rounds |
|-------|--------|-----------------|
| 0 | 3 (2 rounds due to 0B dep on 0A) | 2 |
| 1 | 2 | 1 |
| 2 | 3 | 1 |
| 3 | 3 | 1 |
| 4 | 3 | 1 |
| 5 | 3 | 1 |
| 6 | 3 | 1 |
| 7 | 3 | 1 |
| **Total** | **~24 agent spawns** | **~9 rounds + fixups** |
