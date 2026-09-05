# Hub Data & Sync -- UI/UX Implementation Prompt

**Screen:** Data & Sync (sync tiers, device pairing, network topology)
**Route:** `apps/mobile/app/(hub)/data-sync.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/data_sync/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/data-sync.tsx` (13 KB) |
| Database provider | `apps/mobile/components/DatabaseProvider.tsx` |
| Subscription/entitlements | `apps/mobile/components/EntitlementsProvider.tsx` (tier gating for sync features) |
| Supabase config | `supabase/` directory (shared cloud migrations for surf/workouts) |
| DB package | `packages/db/` (@mylife/db) |

**Notes:**
- Sync tiers (Local/P2P/Free Cloud/Starter/Power) map to subscription tiers. Currently, free modules are defined in the registry; sync tiers may need a separate configuration model.
- P2P device pairing with sync tokens is aspirational. If not implemented, mark as "Coming Soon" in the UI.
- Network Nodes section is informational. Data source depends on sync infrastructure.
- "Expand Storage" should navigate to the subscription upgrade flow (RevenueCat paywall).
- The Sync tab in the bottom nav is new (5th tab). Adding it requires updating DOCK_ITEMS in `packages/module-registry/src/hub-icons.ts`.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent)

Component: MyLife Data & Sync (sync tier selection, device pairing, network nodes)
Platform: React Native (Expo)
Route: apps/mobile/app/(hub)/data-sync.tsx

Build the MyLife Data & Sync screen. Users manage their sync architecture: choose a sync tier, pair devices with zero-knowledge codes, monitor storage usage, and view connected network nodes. This is a settings sub-screen.

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- primary: #ffb877 / #c9894d
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5
- outline-variant: #52443a

LAYOUT:

1. TOP APP BAR (fixed)
   - Left: hamburger + "MyLife" wordmark
   - Center-right: notification bell icon + user avatar

2. PAGE HEADER
   - Title: "Data & Sync" (4xl extrabold tracking-tight on-surface)
   - Subtitle: "Manage your data architecture. Choose how your data is preserved across your devices." (on-surface-variant, lg, relaxed leading)

3. SYNC TIERS (vertical card list)
   - Section header: "SYNC TIERS" (xs bold uppercase tracking-[0.2em] primary) + "Active: P2P" status (right, xs on-surface-variant)
   - 5 tier cards in vertical stack (gap-3):

   Each tier card:
   - bg-surface-container-low, p-6, rounded-lg, flex row between
   - Left: icon container (w-12 h-12 rounded-2xl bg-surface-container-highest, centered Material icon) + text column (title: xl bold + description: sm on-surface-variant)
   - Right: chevron_right icon (on-surface-variant at 40%)
   - Hover: bg-surface-container-high

   ACTIVE tier card (highlighted):
   - bg-surface-container-high, border-2 border-primary/30
   - Badge: "ACTIVE" pill (bg-primary/10 text-primary, 10px bold uppercase, rounded-full) + check circle icon (primary)
   - No chevron on active card

   Tier list:
   a. Local -- hard_drive icon -- "On-device storage only. Maximum privacy."
   b. P2P (ACTIVE) -- hub icon -- "Direct encrypted bridge between your devices."
   c. Free Cloud -- cloud icon -- "Basic automated backups. 5GB limit."
   d. Starter -- auto_awesome icon -- "Global access, high-speed encrypted edge sync."
   e. Power -- diamond icon -- "Infinite archival storage & version history."

4. ARCHIVAL USAGE
   - Card: bg-surface-container-low, p-8, rounded-lg
   - Header: "ARCHIVAL USAGE" (xs bold uppercase tracking-[0.2em] primary)
   - Stats: "12.4 GB USED" (3xl bold on-surface) + "Total: 50.0 GB" (sm on-surface-variant, right)
   - Progress bar: full-width, h-2, rounded-full, bg-surface-container-highest track, primary fill with glow
   - CTA: "Expand Storage" button (glass pill, full-width, centered, primary text, with upload icon, border border-white/10)

5. DEVICE PAIRING
   - Card: bg-surface-container-low, p-8, rounded-lg
   - Header: "DEVICE PAIRING" (xs bold uppercase tracking-[0.2em] primary)
   - Instructions: "Enter this code on your secondary device to initiate a zero-knowledge direct synchronization bridge." (sm on-surface-variant)
   - Pairing code display:
     - Container: bg-surface-container-high, p-8, rounded-xl, centered
     - Label: "SYNC TOKEN" (10px uppercase tracking-widest on-surface-variant at 50%)
     - Code: "LX-928-88P" (4xl font-mono bold primary, tracking-[0.3em], centered)
   - Button: "Generate New Code" (glass pill, centered, with refresh icon)

6. CONNECTED DEVICES (sub-section within pairing)
   - Device entry: icon (device type) + name (bold) + status
   - Example: "MacBook Pro M3 -- Last synced 2m ago" with green status dot

7. NETWORK NODES
   - Section header: "NETWORK NODES" (xs bold uppercase tracking-[0.2em] on-surface-variant)
   - Vertical list of node cards:
   Each node:
   - bg-surface-container-low, p-6, rounded-lg
   - Icon (cloud/relay/device) + node name (bold) + description (xs on-surface-variant)
   - Status indicator: colored dot (primary = active, outline-variant = offline)

   Sample nodes:
   - Primary Cloud -- cloud icon -- "Connected (Frankfurt)" -- amber dot
   - MyLife Relay 01 -- hub icon -- "Direct P2P Link Active" -- amber dot
   - Offline Node -- phone icon -- "iPhone 15 Pro" -- gray dot

8. BOTTOM NAV (Sync tab active)

INTERACTIONS:
- Tier cards are tappable to switch sync tier (requires confirmation for downgrades)
- Pairing code auto-refreshes every 5 minutes, manual refresh on button tap
- Device list shows real connected devices from sync service
- "Expand Storage" navigates to subscription/upgrade flow
- Network nodes are informational (read-only)

DESIGN RULES:
- Active tier card is visually elevated with primary border
- Pairing code uses monospace font for readability
- Storage usage bar matches the thin progress bar style from other screens
- Node status dots use the same glow style as activity feed dots
```
