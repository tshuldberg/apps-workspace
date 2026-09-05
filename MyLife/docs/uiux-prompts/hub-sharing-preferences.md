# Hub Sharing Preferences -- UI/UX Implementation Prompt

**Screen:** Sharing Preferences (collaborators, access control, module sharing)
**Route:** `apps/mobile/app/(hub)/sharing.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/sharing_preferences/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/sharing.tsx` (9.5 KB) |
| Sharing system design | Auto-memory: `backup-and-sharing-systems.md` (P1-9 social sharing controls) |
| Database access | `useDatabase()` from `apps/mobile/components/DatabaseProvider.tsx` |
| Module definitions | `packages/module-registry/src/constants.ts` (per-module sharing config) |

**Notes:**
- Sharing/collaboration features are documented in the memory file `backup-and-sharing-systems.md` as P1-9 priority items. Some features in the Stitch design may be aspirational.
- Collaborator management (invite by email, permission levels) requires a backend service. Mark as "Coming Soon" if not implemented.
- Sharing Activity audit log requires a hub_sharing_activity table or equivalent.
- Per-module granular sharing controls should reference actual enabled modules from the registry.
- "Global Sharing" kill switch should immediately revoke all external access links.
- Access links (e.g., "mylife.app/s/personal-lib-29") require a web sharing service. May be placeholder UI until the service exists.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent, glass morphism)

Component: MyLife Sharing Preferences (collaborator management, sharing activity, granular module sharing controls)
Platform: React Native (Expo)
Route: apps/mobile/app/(hub)/sharing.tsx

Build the MyLife sharing preferences screen. Users manage who has access to their data, control per-module sharing settings, and review sharing activity logs. This is a settings sub-screen with a privacy-first control center design.

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

2. PAGE HEADER
   - Breadcrumb: "PRIVACY CONTROL CENTER" (xs uppercase tracking-widest on-surface-variant)
   - Title: "SHARING PREFERENCES" (4xl extrabold tracking-tight on-surface, uppercase)

3. GLOBAL SHARING TOGGLE
   - Card: bg-surface-container-low, p-6, rounded-lg, flex row between
   - Left: "Global Sharing" title (lg bold) + "Instant pause on all external links" subtitle (sm on-surface-variant)
   - Right: large toggle switch (amber when on)
   - This is a kill switch that disables all sharing immediately

4. ACTIVE COLLABORATORS SECTION
   - Card: bg-surface-container-low, p-6, rounded-lg
   - Header: "Active Collaborators" (xl bold) + "Invite" button (pill, primary bg, on-primary text, sm bold, with person_add icon)
   - Email input row:
     - Text input: bg-surface-container-highest, rounded-full, placeholder "Enter email address..." (on-surface-variant)
     - "Grant Access" button (right, pill, bg-primary, on-primary text, bold sm)
   - Collaborator list (space-y-4):
     Each collaborator:
     - Avatar circle (w-10 h-10 rounded-full, bg-primary-container/30, initials in bold) + name (bold on-surface) + email below (xs on-surface-variant)
     - Permission dropdown: "Can Edit" or "View Only" (pill badge, bg-primary/10 text-primary or bg-surface-container-highest text-on-surface-variant, tappable)
     - Remove button: X icon (right, on-surface-variant, tappable)

   Sample collaborators:
   - JD -- Julian Draxler -- JULIAN@ARCHIVE.IO -- Can Edit
   - SC -- Sarah Chen -- S.CHEN@WEAVE.NET -- View Only

5. SHARING ACTIVITY LOG
   - Card: bg-surface-container-low, p-6, rounded-lg
   - Header: "SHARING ACTIVITY" (sm bold uppercase tracking-widest on-surface-variant)
   - Timeline list (vertical, with left border or dot indicators):
     Each entry:
     - Action text (sm on-surface, bold for emphasis) + timestamp + actor (xs on-surface-variant)
     - Style: left-aligned, compact, timeline dot on left edge

   Sample entries:
   - "Library Export" -- 2 hours ago -- Sarah Chen
   - "New Invite Sent" -- Yesterday -- System
   - "Permission Revoked" -- Oct 24 -- Admin
   - "Module Locked" -- Oct 22 -- Security

   Footer: "VIEW FULL AUDIT LOG" link (primary bold 10px uppercase tracking-widest, centered, py-2)

6. GRANULAR MODULE CONTROLS
   - Section header: "Granular Module Controls" (2xl bold on-surface) + "3 Modules Shared" badge (sm on-surface-variant, right)
   - Vertical list of module sharing cards:

   Each module card:
   - bg-surface-container-low, p-6, rounded-lg
   - Header row: module icon (w-12 h-12 rounded-xl bg-primary/10, primary Material icon) + module name (lg bold) + description (xs on-surface-variant) + access badge
   - Access badges:
     - "PUBLIC ACCESS": bg-primary/10 text-primary, rounded-full pill
     - "PRIVATE": bg-surface-container-highest text-on-surface-variant, rounded-full pill
     - "RESTRICTED": bg-error/10 text-error, rounded-full pill
   - Chevron: expand indicator (right)

   EXPANDED MODULE (e.g., Personal Library):
   - Toggle options:
     - "Allow metadata harvesting" -- toggle switch (amber = on)
     - "Enable collaborative annotations" -- toggle switch (amber = on)
   - Access link display:
     - Label: "ACCESS LINK" (xs uppercase tracking-widest on-surface-variant)
     - URL display: bg-surface-container-highest, rounded-lg, p-3, on-surface text (e.g., "mylife.app/s/personal-lib-29")
     - Copy button (clipboard icon, right)

   Sample modules:
   - Personal Library -- PUBLIC ACCESS (expanded, shows toggles + link)
   - Annotated Manuscripts -- PRIVATE (collapsed)
   - Wishlist & Acquisitions -- RESTRICTED -- "Shared with 2 collaborators"

7. BOTTOM NAV (Settings tab active)

INTERACTIONS:
- Global toggle immediately pauses all sharing with confirmation toast
- Invite sends email invitation via sharing service
- Permission dropdowns open a bottom sheet with options: View Only, Can Edit, Admin, Remove
- "Grant Access" validates email before adding
- Module cards expand/collapse with smooth animation
- Copy link button copies to clipboard with haptic + toast confirmation
- Audit log entries are tappable for detail modal
- Remove collaborator (X) requires confirmation

DESIGN RULES:
- Privacy-first visual language: shield icons, lock badges, security-themed copy
- Collaborator avatars use initials with module accent colors
- Access badges clearly communicate sharing state via color coding
- Timeline uses subtle left-border or dot indicators, not heavy dividers
- No 1px borders for section separation
```
