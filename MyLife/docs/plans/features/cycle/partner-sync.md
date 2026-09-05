# Feature Spec: Partner Sync

## Metadata
- **Module:** cycle
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** 5
- **Estimated CC Time:** 4-6 hours
- **Depends On:** none (can be built independently of temperature tracking and pregnancy mode)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Partner sync allows a user's partner to have read-only visibility into cycle data (phases, predictions, fertile windows) without accessing the full app or the user's private notes. Flo and Clue both offer this because partners frequently ask "where are you in your cycle?" and users want a way to share that context without repeated conversations. It reduces friction in relationships, supports fertility planning as a team activity, and is a key retention driver because it creates a two-person dependency on the app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Flo | Yes | Yes ($49.99/yr) | Partner app with limited view, push notifications for period predictions |
| Clue | Yes | Yes ($39.99/yr) | Shareable link with read-only cycle view, customizable data sharing |
| Natural Cycles | No | N/A | No partner feature |
| Ovia | Yes | No (free) | Partner mode with pregnancy week tracking, notifications |

### Target User
Couples who want to coordinate around cycle awareness, whether for fertility planning, symptom understanding, or simply better communication. The primary user controls what is shared. The partner gets a minimal, read-only view. This is especially valuable for couples trying to conceive (TTC) who want shared fertile window visibility.

## Technical Context

### Where This Lives in MyLife

```
modules/cycle/src/types.ts                  -- New schemas: PartnerLink, SharedCycleView
modules/cycle/src/db/schema.ts              -- New table: cy_partner_links
modules/cycle/src/db/crud.ts                -- Partner link CRUD functions
modules/cycle/src/engine/sharing.ts         -- Generate shared view, link code management
modules/cycle/src/index.ts                  -- Export new functions and types
apps/mobile/app/(cycle)/settings.tsx        -- Partner sync toggle and share code UI
apps/mobile/app/(cycle)/partner-view.tsx    -- Read-only partner view screen
apps/web/app/cycle/partner/                 -- Web partner view
```

### Wireframe Position

```
Hub Dashboard
  └── MyCycle card
       └── Settings tab
            └── Partner Sync section ← YOU ARE HERE (setup)
                 ├── Generate share code
                 ├── Manage active link
                 └── Configure shared data
       └── [Partner's device]
            └── MyCycle card
                 └── Partner View tab ← YOU ARE HERE (consumption)
                      ├── Current phase indicator
                      ├── Period prediction dates
                      ├── Fertile window (if shared)
                      └── Pregnancy week (if applicable)
```

### Data Model

```sql
-- Partner link configuration (on the primary user's device)
CREATE TABLE IF NOT EXISTS cy_partner_links (
  id TEXT PRIMARY KEY,
  link_code TEXT NOT NULL UNIQUE,          -- 6-char alphanumeric share code
  partner_name TEXT,                       -- Display name for the partner
  status TEXT NOT NULL DEFAULT 'active',   -- active | revoked
  share_phase INTEGER NOT NULL DEFAULT 1,  -- Share current phase
  share_predictions INTEGER NOT NULL DEFAULT 1,  -- Share period predictions
  share_fertile_window INTEGER NOT NULL DEFAULT 0, -- Share fertile window (opt-in)
  share_symptoms INTEGER NOT NULL DEFAULT 0,       -- Share symptom summary (opt-in)
  share_pregnancy INTEGER NOT NULL DEFAULT 1,      -- Share pregnancy status/week
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cy_partner_link_code_idx ON cy_partner_links(link_code);
CREATE INDEX IF NOT EXISTS cy_partner_link_status_idx ON cy_partner_links(status);
```

**Note on sync architecture:** MyLife is offline-first with no cloud backend for the cycle module. Partner sync uses a **local peer-to-peer model** via share codes. The primary user generates a share code. The partner enters this code on their device. Data exchange happens via one of these mechanisms (in priority order):

1. **Local network sync (primary):** Both devices on the same WiFi network. The primary user's device runs a minimal local HTTP server (Bonjour/mDNS discovery) that serves the shared view JSON. The partner's device polls this endpoint periodically.
2. **QR code / manual refresh (fallback):** The primary user can generate a QR code or text snapshot of their current cycle state. The partner scans or receives it via any messaging channel. This is a manual sync, not real-time.
3. **Future: optional cloud relay:** If MyLife adds an optional cloud layer, partner sync could use it for real-time push. This is explicitly NOT in scope for the initial implementation.

For the initial implementation, use **mechanism #2 (manual export/import)** as the simplest offline-first approach. The primary user generates a "partner snapshot" (JSON blob) that can be shared via any channel (AirDrop, iMessage, email, QR code). The partner imports this snapshot into their MyCycle instance in partner view mode.

**Shared view JSON schema (exported by primary, imported by partner):**

```typescript
export const SharedCycleViewSchema = z.object({
  version: z.literal(1),
  linkCode: z.string(),
  generatedAt: z.string(),             // ISO timestamp
  currentPhase: CyclePhaseSchema.nullable(),
  cycleDay: z.number().int().nullable(), // Day N of cycle
  predictedNextPeriod: z.string().nullable(),
  fertileWindowStart: z.string().nullable(),
  fertileWindowEnd: z.string().nullable(),
  symptomSummary: z.string().nullable(), // "3 symptoms logged today" (no details)
  pregnancyWeek: z.number().int().nullable(),
  pregnancyDueDate: z.string().nullable(),
  partnerName: z.string().nullable(),    // Primary user's display name
});
export type SharedCycleView = z.infer<typeof SharedCycleViewSchema>;
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing prediction engine for generating shared predictions, pregnancy engine (if pregnancy mode is active)
- **External:** None for initial implementation. Future: Bonjour/mDNS for local network discovery.
- **Cross-Module:** None directly. The shared view is self-contained cycle data.

## Functional Requirements

### User Stories
1. As a cycle tracker, I want to share my cycle phase and predictions with my partner so that they can be aware without me having to tell them.
2. As a cycle tracker, I want to control exactly what data my partner sees (phase yes, symptoms no, fertile window opt-in) so that I maintain privacy over sensitive details.
3. As a partner, I want to see my partner's current cycle phase and upcoming period prediction so that I can be supportive and plan accordingly.
4. As a cycle tracker, I want to revoke partner access at any time so that I remain in full control of my data.
5. As a cycle tracker who is pregnant, I want my partner to see my pregnancy week and due date instead of cycle data.

### Behavior Specification

**Setting up partner sync (primary user):**
1. User navigates to MyCycle Settings tab
2. User taps "Partner Sync" section
3. System presents the partner sync setup:
   a. "Share your cycle with a partner"
   b. Toggle controls for what to share:
      - Current phase (default: on)
      - Period predictions (default: on)
      - Fertile window (default: off, with note "This reveals fertility-sensitive data")
      - Symptom summary (default: off, note: "Shows count only, not specific symptoms")
      - Pregnancy status (default: on, if pregnancy mode is active)
   c. Optional: enter a display name for yourself (what the partner sees)
   d. Optional: enter a name for the partner (for your reference)
4. User taps "Generate Share Code"
5. System generates a 6-character alphanumeric code (uppercase, no ambiguous chars: excludes 0/O, 1/I/L)
6. System creates a cy_partner_links row
7. The share code is displayed with options:
   - Copy code to clipboard
   - Share via system share sheet (AirDrop, iMessage, etc.)
   - Show as QR code
8. Below the code: "Send Partner Snapshot" button that generates and shares the SharedCycleView JSON

**Sharing a snapshot (primary user, ongoing):**
1. User navigates to MyCycle Settings > Partner Sync
2. Taps "Send Update to Partner"
3. System generates a SharedCycleView JSON based on current cycle state and sharing preferences
4. System opens the share sheet with the JSON (as a small file or deep link)
5. Partner receives the snapshot via whatever channel was used

**Receiving a snapshot (partner):**
1. Partner opens MyCycle on their device
2. Partner navigates to Settings > Partner Sync
3. Partner taps "I'm a partner - Enter Share Code"
4. Partner enters the 6-character code
5. System stores the code locally and enters "partner view" mode
6. Partner taps "Import Update" and selects the received snapshot file (or scans QR)
7. System validates the snapshot's linkCode matches the entered code
8. System displays the SharedCycleView data in a read-only partner view

**Partner view (read-only):**
1. A new "Partner View" tab appears in MyCycle for the partner
2. Shows (based on what the primary user shared):
   - Current phase with color indicator and phase name
   - "Day [N] of cycle"
   - "Next period expected: [date]" (if predictions shared)
   - "Fertile window: [start] - [end]" (if fertile window shared)
   - "[N] symptoms logged today" (if symptom summary shared, no specifics)
   - "Week [N] of pregnancy - Due [date]" (if pregnant and shared)
3. Shows "Last updated: [timestamp]" at the bottom
4. "Request Update" button that opens a message to the primary user asking for a fresh snapshot

**Revoking access (primary user):**
1. User navigates to Settings > Partner Sync
2. User taps "Revoke Access"
3. System sets the partner link status to 'revoked'
4. The share code is invalidated
5. The partner's existing snapshot still displays but cannot be updated
6. Primary user sees "No active partner link" state

**Regenerating code:**
1. User can revoke the old code and generate a new one
2. The old code is invalidated; the partner must re-enter the new code

### Edge Cases

- **Partner enters wrong code:** Error message "Invalid share code. Check with your partner." No data revealed.
- **Partner enters revoked code:** Error message "This share code is no longer active."
- **Snapshot is from a different link code:** Validation rejects it: "This update doesn't match your link code."
- **Snapshot is very old (>30 days):** Display a warning: "This data was generated [N] days ago and may be outdated. Ask your partner for an update."
- **Primary user deletes the module:** Partner link is deleted. Partner's existing snapshot remains but shows a "link no longer active" banner.
- **Multiple partners:** Not supported in v1. One active link at a time. User must revoke before creating a new link.
- **Both partners track cycles:** Each user's cycle data is independent. One can be the "primary" and the other the "partner" for sharing purposes, or both can set up bidirectional sharing (each generates their own code).
- **Pregnancy mode activates:** If share_pregnancy is enabled, the shared view automatically switches from cycle data to pregnancy data (week + due date).
- **No completed cycles yet:** Shared view shows phase as null and predictions as null. Partner sees "Your partner hasn't logged enough data for predictions yet."
- **Share code generation collision:** Extremely unlikely with 6 chars from a 32-char alphabet (32^6 = ~1B combinations). If collision occurs, regenerate.
- **Module disabled:** Partner link data is preserved. Re-enabling restores the active link.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Partner Sync section appears in MyCycle Settings with toggles for each data category
- [ ] **AC-2:** Toggling "Fertile window" on shows a privacy warning before enabling
- [ ] **AC-3:** Tapping "Generate Share Code" produces a 6-character code displayed prominently
- [ ] **AC-4:** The share code can be copied to clipboard or shared via system share sheet
- [ ] **AC-5:** "Send Update to Partner" generates and shares a snapshot reflecting current cycle state and sharing preferences
- [ ] **AC-6:** On the partner's device, entering a valid share code enables partner view mode
- [ ] **AC-7:** Importing a valid snapshot populates the partner view with the shared data
- [ ] **AC-8:** Partner view shows only the data categories the primary user enabled (e.g., no fertile window if toggled off)
- [ ] **AC-9:** Partner view clearly shows "Last updated: [timestamp]" so the partner knows data freshness
- [ ] **AC-10:** Revoking access invalidates the code and the partner can no longer import new snapshots
- [ ] **AC-11:** If the primary user is pregnant and sharing pregnancy status, the partner view shows pregnancy week and due date instead of cycle data
- [ ] **AC-12:** Partner view is read-only with no way to edit, delete, or log data on behalf of the primary user
- [ ] **AC-13:** Stale snapshot (>30 days old) shows a freshness warning on the partner view

### Technical Criteria
- [ ] **TC-1:** cy_partner_links table is created by migration with correct schema and indexes
- [ ] **TC-2:** Share code generation uses a safe alphabet (excludes 0/O, 1/I/L) and produces 6-character codes
- [ ] **TC-3:** SharedCycleView JSON validates against the Zod schema on both export and import
- [ ] **TC-4:** Snapshot generation respects sharing preferences (e.g., fertile window omitted if share_fertile_window=0)
- [ ] **TC-5:** Link code validation rejects invalid, revoked, and mismatched codes with appropriate error messages
- [ ] **TC-6:** Only one active partner link can exist at a time (enforced in code)
- [ ] **TC-7:** Revoking a link sets status='revoked' and preserves the record (no deletion)
- [ ] **TC-8:** Snapshot includes pregnancy data when pregnancy mode is active and share_pregnancy=1

### Negative Criteria
- [ ] **NC-1:** Partner view must NOT allow any write operations (no logging, editing, or deleting data)
- [ ] **NC-2:** Specific symptom names must NOT be included in the snapshot, only a count ("3 symptoms logged")
- [ ] **NC-3:** User's private notes must NEVER appear in the shared view
- [ ] **NC-4:** Partner sync must NOT require an internet connection or cloud account
- [ ] **NC-5:** The share code must NOT be derivable from or reveal any cycle data

## UI Specification

### Mobile (Expo)

**Settings - Partner Sync section:**
- Section header "Partner Sync" with `#F472B6` accent icon (link/share icon)
- Toggle switches for each data category in glass cards
- Fertile window toggle has an inline warning: `rgba(255,69,58,0.15)` background (subtle danger)
- "Generate Share Code" button: `#F472B6` accent, full-width
- Generated code displayed in large monospace font, `#F0F0F5` text, glass card background
- Copy/Share/QR buttons below the code
- "Revoke Access" button: `#FF453A` (danger) text, no fill

**Partner View tab:**
- Large phase indicator circle with phase color
- Phase name in `#F0F0F5`, "Day [N]" in `rgba(240,240,245,0.65)` (textSecondary)
- Prediction and fertile window in glass cards
- "Last updated" timestamp in `rgba(240,240,245,0.65)` at the bottom
- "Request Update" button: subtle outline style
- If stale (>30 days): amber warning banner at top

### Web (Next.js)
- Same tokens via CSS variables
- Partner sync settings at `/cycle/settings` with same toggle controls
- Partner view at `/cycle/partner` route
- Share code displayed with copy button

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No link | "Share your cycle with a partner" setup prompt | No active partner link |
| Active link | Share code displayed, "Send Update" and "Revoke" buttons | Active partner link |
| Revoked | "No active partner link" with "Create New" option | Link revoked |
| Partner - no data | "Enter share code" prompt with code input | Partner mode, no snapshot |
| Partner - data loaded | Read-only cycle view with shared data | Valid snapshot imported |
| Partner - stale | Data shown with amber "outdated" warning | Snapshot >30 days old |

## Test Requirements

### Unit Tests
- [ ] `generateShareCode`: produces 6-character string from safe alphabet
- [ ] `generateShareCode`: excludes ambiguous characters (0, O, 1, I, L)
- [ ] `createPartnerLink`: stores link with correct defaults
- [ ] `createPartnerLink`: rejects creation when active link exists
- [ ] `getActivePartnerLink`: returns active link or null
- [ ] `revokePartnerLink`: sets status to 'revoked'
- [ ] `generateSharedView`: includes phase and predictions when enabled
- [ ] `generateSharedView`: excludes fertile window when share_fertile_window=0
- [ ] `generateSharedView`: excludes symptom summary when share_symptoms=0
- [ ] `generateSharedView`: includes pregnancy data when pregnant and share_pregnancy=1
- [ ] `generateSharedView`: symptom summary shows count only, not names
- [ ] `generateSharedView`: never includes notes
- [ ] `validateSnapshot`: accepts valid snapshot with matching link code
- [ ] `validateSnapshot`: rejects snapshot with mismatched link code
- [ ] `validateSnapshot`: rejects malformed JSON
- [ ] `isSnapshotStale`: returns true for snapshots older than 30 days
- [ ] `isSnapshotStale`: returns false for recent snapshots

### Integration Tests
- [ ] Full flow: create link -> generate code -> generate snapshot -> validate snapshot on partner side -> partner view renders
- [ ] Revocation flow: create link -> revoke -> attempt import with old code -> rejected
- [ ] Privacy flow: disable fertile window sharing -> generate snapshot -> snapshot contains null fertile window

### QA Verification Script

1. Open the app on iOS simulator (Device A - primary user)
2. Navigate to MyCycle > Settings tab
3. Scroll to "Partner Sync" section
4. Verify: Toggles appear for phase, predictions, fertile window (off), symptoms (off), pregnancy -- corresponds to AC-1
5. Toggle "Fertile window" on
6. Verify: Privacy warning appears -- corresponds to AC-2
7. Toggle it back off
8. Tap "Generate Share Code"
9. Verify: 6-character code appears in large monospace font -- corresponds to AC-3
10. Tap "Copy"
11. Verify: Code copied to clipboard -- corresponds to AC-4
12. Tap "Send Update to Partner"
13. Verify: Share sheet opens with snapshot data -- corresponds to AC-5
14. Open the app on a second simulator (Device B - partner)
15. Navigate to MyCycle > Settings > Partner Sync
16. Tap "I'm a partner - Enter Share Code"
17. Enter the code from Device A
18. Verify: Partner mode activates -- corresponds to AC-6
19. Import the snapshot from Device A
20. Verify: Partner view shows current phase and predictions -- corresponds to AC-7
21. On Device A, toggle off "Predictions", generate new snapshot
22. Import on Device B
23. Verify: Predictions no longer shown in partner view -- corresponds to AC-8
24. Verify: "Last updated" timestamp is visible -- corresponds to AC-9
25. On Device A, tap "Revoke Access"
26. On Device B, attempt to import a new snapshot
27. Verify: Import rejected with "code no longer active" message -- corresponds to AC-10
28. On Device A, activate pregnancy mode, create new partner link with pregnancy sharing on
29. Generate and send snapshot
30. On Device B, enter new code and import
31. Verify: Partner view shows pregnancy week and due date -- corresponds to AC-11
32. On Device B, verify no edit/log/delete controls are visible -- corresponds to AC-12
33. Manually set the snapshot's generatedAt to 31 days ago (for testing)
34. Verify: Amber "outdated" warning appears -- corresponds to AC-13

## gstack Quality Gates

Based on Complexity 1 (Inverse), this feature is "Complex" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- cycle has no standalone counterpart (skip)

## Handoff State

### Before This Work
Cycle module is single-user only. No mechanism to share any cycle data with another person. Users who want to inform their partner about their cycle must do so verbally or via screenshots.

### After This Work
- Partner link system with share code generation and management
- Configurable data sharing (5 toggleable categories with privacy-first defaults)
- SharedCycleView JSON format for offline data exchange
- Partner view mode (read-only) on the partner's device
- Snapshot import/export via system share sheet
- Link revocation with data preservation
- Stale data warning for outdated snapshots
- Pregnancy-aware sharing (auto-switches to pregnancy view when applicable)

### Files Changed
- `modules/cycle/src/types.ts` -- Added PartnerLink, SharedCycleView, share-related schemas
- `modules/cycle/src/db/schema.ts` -- Added cy_partner_links DDL
- `modules/cycle/src/db/crud.ts` -- Added partner link CRUD functions
- `modules/cycle/src/engine/sharing.ts` -- New file: share code generation, snapshot generation, validation
- `modules/cycle/src/definition.ts` -- Added migration version (next sequential)
- `modules/cycle/src/index.ts` -- Exported new types and functions
- `modules/cycle/src/__tests__/sharing.test.ts` -- New test file
- `apps/mobile/app/(cycle)/settings.tsx` -- Partner sync section
- `apps/mobile/app/(cycle)/partner-view.tsx` -- New screen: read-only partner view

### Known Limitations
- Manual snapshot exchange only (no automatic real-time sync)
- One active partner link at a time (no multi-partner sharing)
- No push notifications to partner when data changes
- No local network auto-sync (Bonjour/mDNS is a future enhancement)
- Partner cannot request specific data; they see what the primary user configured
- No end-to-end encryption on the snapshot (relies on the transport channel's security, e.g., iMessage)

### Context for Next Agent
- The share code alphabet should be: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (32 chars, no 0/O/1/I/L for readability)
- SharedCycleView is a versioned JSON schema (version: 1). Future versions can add fields while remaining backwards-compatible
- Partner view mode is determined by the presence of a stored link_code + imported snapshot on the partner's device, not by a server-side flag
- The privacy defaults are intentionally conservative (fertile window OFF, symptoms OFF). The primary user must explicitly opt in to share sensitive data
- Notes field from cy_cycle_days is NEVER included in any shared view, regardless of settings. This is a hard privacy boundary.
- If implementing local network sync in the future, use Expo's Network module for WiFi detection and a lightweight HTTP server (e.g., express-like) for serving the SharedCycleView endpoint
