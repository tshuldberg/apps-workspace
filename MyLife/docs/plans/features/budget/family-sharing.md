# Feature Spec: Family Sharing

## Metadata
- **Module:** budget
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 0 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 3+
- **Estimated CC Time:** 6-8 hours
- **Depends On:** SQLite backup mechanism (P0 -- family sharing needs reliable data sync foundation)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Monarch Money ($99.99/yr) and YNAB ($109/yr) both offer household/family budgeting as a core premium feature. Couples and families need to share budget envelopes, see each other's transactions, and collaborate on financial goals. The budget module already has a `bg_shared_envelopes` table (V4) with device-based sharing scaffolding, but no sync mechanism, no family member management, and no conflict resolution. Family sharing is the #1 requested feature in budgeting apps and a key differentiator that converts individual users into household subscribers.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Monarch Money | Yes | Yes ($99.99/yr) | Full collaborative budgeting. Shared budget with partner. Both see same data. Cloud-synced. Invite via email. |
| YNAB | Yes | Yes ($109/yr) | Budget sharing via account access (same login). Up to 2 users. All data shared. |
| Copilot | No | N/A | Single-user only. No sharing. |
| Rocket Money | Partial | Yes ($48-144/yr) | "Couples" tier for shared bill tracking. Limited collaboration. |
| PocketGuard | No | N/A | No sharing features. |

### Target User
Couples who budget together and families managing household finances. Migration path: Monarch couple paying $99.99/yr for shared budgeting gets the same capability at $5/yr. Also YNAB couples sharing a single login (poor UX) who want proper multi-user access.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/
  sharing/
    family-manager.ts            -- NEW: Family creation, member management, invites
    sync-engine.ts               -- NEW: Conflict-free sync for shared data
    permissions.ts               -- NEW: Per-envelope sharing permissions
    types.ts                     -- NEW: Family, Member, SyncPayload types
    index.ts                     -- NEW: Barrel export
  db/
    schema.ts                    -- MODIFY: V6 migration adds bg_families, bg_family_members, bg_sync_log
    crud.ts                      -- MODIFY: Add family CRUD
  types.ts                       -- MODIFY: Add family schemas
  definition.ts                  -- MODIFY: V6 migration
  index.ts                       -- MODIFY: Export sharing types
apps/mobile/app/(budget)/
  family-settings.tsx            -- NEW: Family management screen
  invite-member.tsx              -- NEW: Invite flow (QR code + link)
apps/web/app/budget/
  family/page.tsx                -- NEW: Family management page
  actions.ts                     -- MODIFY: Add family server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       │    └── Shared envelopes marked with 👥 icon
       ├── Transactions tab
       │    └── Shared transactions show member avatar
       ├── Settings
       │    └── Family Sharing                         ← MANAGEMENT SCREEN
       │         ├── Create/Join Family
       │         ├── Members list
       │         ├── Sharing permissions per envelope
       │         └── Invite via QR / link
```

### Data Model

```sql
-- V6 migration: Family sharing infrastructure
CREATE TABLE IF NOT EXISTS bg_families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Family',
  created_by_device_id TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bg_family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES bg_families(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '👤',
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_sync_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  UNIQUE(family_id, device_id)
);

CREATE TABLE IF NOT EXISTS bg_envelope_sharing (
  id TEXT PRIMARY KEY,
  envelope_id TEXT NOT NULL REFERENCES bg_envelopes(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES bg_families(id) ON DELETE CASCADE,
  sharing_mode TEXT NOT NULL DEFAULT 'shared'
    CHECK (sharing_mode IN ('shared', 'visible', 'private')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(envelope_id, family_id)
);

CREATE TABLE IF NOT EXISTS bg_sync_log (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES bg_families(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  operation TEXT NOT NULL
    CHECK (operation IN ('create', 'update', 'delete')),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,          -- JSON of the changed record
  timestamp TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0 CHECK (applied IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS bg_family_members_family_idx ON bg_family_members(family_id);
CREATE INDEX IF NOT EXISTS bg_family_members_device_idx ON bg_family_members(device_id);
CREATE INDEX IF NOT EXISTS bg_envelope_sharing_envelope_idx ON bg_envelope_sharing(envelope_id);
CREATE INDEX IF NOT EXISTS bg_envelope_sharing_family_idx ON bg_envelope_sharing(family_id);
CREATE INDEX IF NOT EXISTS bg_sync_log_family_idx ON bg_sync_log(family_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS bg_sync_log_applied_idx ON bg_sync_log(applied, timestamp);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing `bg_shared_envelopes` table (V4), `@mylife/auth` (device identity)
- **External:** Local network discovery (Bonjour/mDNS) for same-network sync, or manual invite code exchange. No cloud required for initial version.
- **Cross-Module:** Hub-level family concept could extend to other modules (shared grocery lists via recipes, shared pet care via pets, shared home maintenance via homes). The `bg_families` and `bg_family_members` tables should be designed with this extensibility in mind, potentially moving to `hub_` prefix in a future refactor.

## Functional Requirements

### User Stories
1. As a budget user, I want to create a family group and invite my partner so we can share a budget.
2. As a family member, I want to see shared envelopes and transactions from all family members.
3. As a budget user, I want to control which envelopes are shared, visible-only, or private.
4. As a family member, I want to see who made each transaction (member attribution).
5. As a family owner, I want to manage member roles (admin, member, viewer).
6. As a family member, I want changes to sync between devices when we're on the same network.

### Behavior Specification

1. User navigates to Settings > Family Sharing
2. User creates a family (auto-generated invite code, 8-char alphanumeric)
3. User shares invite code with partner via QR code or text
4. Partner opens Family Sharing > "Join Family" > enters invite code
5. Partner's device joins the family, syncs shared envelope data
6. Owner sets per-envelope sharing mode:
   - **Shared:** All members can view and add transactions
   - **Visible:** All members can view but only owner can edit
   - **Private:** Only envelope owner sees it (default for existing envelopes)
7. Shared envelopes show 👥 icon in budget view
8. Transactions in shared envelopes show member avatar/emoji
9. Sync mechanism (v1 -- local network):
   a. Devices on same WiFi discover each other via mDNS
   b. Changes logged to bg_sync_log with timestamps
   c. On sync: exchange sync logs since last sync, apply changes
   d. Conflict resolution: last-write-wins based on timestamp
10. Family dashboard shows: member list, sync status, shared envelope summary

### Edge Cases

- Both members edit same transaction simultaneously: last-write-wins, both see final state on next sync
- Member removed from family: their transactions remain but are re-attributed to "Former member"
- Family owner leaves: ownership transfers to next admin, or family dissolved if no admins
- Offline sync (no network): changes queue in bg_sync_log, applied when devices reconnect
- Device ID changes (app reinstall): user must rejoin family with invite code
- 100+ transactions synced at once: batch apply with progress indicator
- Envelope deleted by one member while other is adding transactions: cascade delete, sync deletion event
- Partner has different base currency: shared envelopes use family's base currency setting
- Invite code guessed/leaked: codes expire after 24 hours or first use (whichever comes first)
- Family of 1 (user creates family but no one joins): functions as normal, no sync needed

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Create Family" generates invite code (QR + alphanumeric)
- [ ] **AC-2:** "Join Family" accepts invite code and connects devices
- [ ] **AC-3:** Per-envelope sharing mode selector: shared / visible / private
- [ ] **AC-4:** Shared envelopes display 👥 icon in budget view
- [ ] **AC-5:** Transactions show member avatar emoji for attribution
- [ ] **AC-6:** Family settings shows member list with roles and last sync time
- [ ] **AC-7:** Member roles editable by owner/admin: owner, admin, member, viewer
- [ ] **AC-8:** Viewer role can see shared envelopes but cannot add transactions
- [ ] **AC-9:** Private envelopes not visible to other family members
- [ ] **AC-10:** Sync status indicator shows last successful sync time

### Technical Criteria
- [ ] **TC-1:** Invite codes are 8-character alphanumeric, unique, and expire after 24 hours or first use
- [ ] **TC-2:** Changes logged to bg_sync_log with device_id, operation, timestamp, and payload
- [ ] **TC-3:** Sync uses last-write-wins conflict resolution based on timestamp
- [ ] **TC-4:** Local network sync via mDNS discovery (no cloud dependency)
- [ ] **TC-5:** bg_families, bg_family_members, bg_envelope_sharing, bg_sync_log created in V6
- [ ] **TC-6:** Sync payload is JSON-serialized record state (not diffs) for idempotent application
- [ ] **TC-7:** Removed member's transactions preserved with "Former member" attribution

### Negative Criteria
- [ ] **NC-1:** Private envelopes and their transactions must NOT be visible to other members
- [ ] **NC-2:** Viewer role must NOT be able to create, edit, or delete transactions
- [ ] **NC-3:** Sync must NOT require internet (local network only in v1)
- [ ] **NC-4:** Family data must NOT be sent to any cloud service
- [ ] **NC-5:** Removing a member must NOT delete their contributed transactions
- [ ] **NC-6:** Invite codes must NOT be reusable after first successful join

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Family card: `rgba(255,255,255,0.04)` (glass token) with member avatars in a row
- Module accent: `#22C55E` (budget green)
- Invite code display: large monospace text with QR code below
- Member rows: avatar emoji + display name + role badge + last sync
- Sharing mode toggles: three-state selector (shared/visible/private) per envelope
- Sync indicator: green dot (synced <5min), amber (5min-1hr), red (>1hr or never)

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/budget/family`
- QR code rendered via canvas, invite code as copyable text
- Member management table with role dropdowns

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Spinner while syncing | Sync in progress |
| Empty | "Create or join a family" with two CTA buttons | No family configured |
| Error | "Sync failed" + retry + last successful sync time | Network/sync error |
| Success | Family dashboard with members, sync status, shared envelopes | Active family |
| Partial | Family created but no other members ("Invite someone!") | Solo family |

## Test Requirements

### Unit Tests
- [ ] `generateInviteCode`: produces 8-char alphanumeric string
- [ ] `generateInviteCode`: produces unique codes on repeated calls
- [ ] `isInviteExpired`: returns true after 24 hours
- [ ] `resolveConflict`: last-write-wins selects record with later timestamp
- [ ] `resolveConflict`: equal timestamps favor the record with lexically later device_id
- [ ] `buildSyncPayload`: serializes changed records since last sync timestamp
- [ ] `applySyncPayload`: applies create/update/delete operations correctly
- [ ] `getEnvelopeVisibility`: returns correct mode based on bg_envelope_sharing
- [ ] Family CRUD: create family, add member, update role, remove member
- [ ] Sync log CRUD: write entry, read since timestamp, mark applied

### Integration Tests
- [ ] Full flow: create family -> invite member -> share envelope -> add transaction -> sync -> both see it
- [ ] Permission flow: set envelope to viewer -> verify member cannot edit
- [ ] Removal flow: remove member -> verify their transactions persist with attribution
- [ ] Conflict flow: both edit same record -> sync -> last-write-wins applied correctly

### QA Verification Script

1. Open app on iOS simulator (Device A)
2. Navigate to MyBudget > Settings > Family Sharing
3. Verify: "Create or Join" options shown -- Empty state
4. Tap "Create Family"
5. Verify: invite code displayed with QR -- AC-1
6. Open app on second simulator (Device B)
7. Navigate to Family Sharing > "Join Family"
8. Enter invite code from Device A
9. Verify: Device B joins family -- AC-2
10. On Device A, navigate to Budget tab
11. Set "Groceries" envelope to "shared" mode
12. Verify: 👥 icon appears on Groceries -- AC-3, AC-4
13. Set "Fun Money" to "private"
14. On Device B, verify: Groceries visible, Fun Money NOT visible -- AC-9, NC-1
15. On Device B, add a transaction to Groceries
16. Sync (same network)
17. On Device A, verify: transaction appears with Device B's avatar -- AC-5
18. Navigate to Family settings on Device A
19. Verify: both members listed with sync times -- AC-6
20. Change Device B's role to "viewer" -- AC-7
21. On Device B, attempt to add transaction to shared envelope
22. Verify: action blocked (viewer cannot edit) -- AC-8, NC-2
23. On Device A, remove Device B from family
24. Verify: Device B's transactions still visible with "Former member" -- NC-5, TC-7
25. On web at `/budget/family`
26. Verify: family management renders with same data

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/budget/family`, test create/invite flows
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- Complexity score is 0, run on this spec BEFORE building

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate sync approach before implementation

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for sync engine

### Post-merge:
- [ ] `/parity-check` -- budget module has archived standalone

## Handoff State

### Before This Work
Budget module has `bg_shared_envelopes` table (V4) with device_id-based sharing scaffolding and `SharedEnvelope` type. No sync mechanism, no family concept, no member management, no conflict resolution.

### After This Work
Full family sharing system: create family, invite members via QR/code, per-envelope sharing permissions (shared/visible/private), member attribution on transactions, role-based access control, local-network sync with last-write-wins conflict resolution, sync log for offline queueing.

### Files Changed
- `modules/budget/src/sharing/family-manager.ts` -- Family lifecycle management
- `modules/budget/src/sharing/sync-engine.ts` -- Conflict-free sync engine
- `modules/budget/src/sharing/permissions.ts` -- Per-envelope permission checks
- `modules/budget/src/sharing/types.ts` -- Family, Member, SyncPayload types
- `modules/budget/src/sharing/index.ts` -- Barrel export
- `modules/budget/src/db/schema.ts` -- V6: bg_families, bg_family_members, bg_envelope_sharing, bg_sync_log
- `modules/budget/src/db/crud.ts` -- Family and sync CRUD
- `modules/budget/src/types.ts` -- Family Zod schemas
- `modules/budget/src/definition.ts` -- V6 migration
- `modules/budget/src/index.ts` -- Export sharing types
- `apps/mobile/app/(budget)/family-settings.tsx` -- Family management screen
- `apps/mobile/app/(budget)/invite-member.tsx` -- Invite flow
- `apps/web/app/budget/family/page.tsx` -- Web family management
- `apps/web/app/budget/actions.ts` -- Family server actions

### Known Limitations
- V1 sync is local-network only (same WiFi). No cloud relay for remote sync.
- Last-write-wins conflict resolution may lose edits in rare simultaneous-edit scenarios
- No end-to-end encryption on sync payloads (local network assumed trusted)
- Maximum family size: 6 members (practical limit for household budgeting)
- No real-time push notifications for partner changes (poll on app open)
- The bg_families/bg_family_members tables use bg_ prefix but conceptually could be hub-level -- a future refactor may migrate them to hub_ prefix for cross-module family sharing

### Context for Next Agent
- The existing `bg_shared_envelopes` table (V4) can be deprecated in favor of the new `bg_envelope_sharing` table which adds family_id and three sharing modes
- Device ID should come from `@mylife/auth` or a stable device identifier (expo-device or expo-application)
- mDNS discovery on iOS requires the `Bonjour Services` entitlement in app.json
- Sync payload format: `{ operation, table_name, record_id, record: {...}, timestamp, device_id }`
- For conflict resolution, compare timestamps as ISO strings (lexicographic comparison works for ISO 8601)
- The family concept is budget-scoped in v1 but should be designed so the tables can migrate to hub-level in the future
