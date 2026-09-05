# Hub Shell -- UI/UX Design Prompts

**Component:** Hub Shell (container app, not a module)
**Design System:** Cool Obsidian
**Total Screens:** 10 mobile + 6 web = 16

---

## Prompt 1: Mobile Screens 1--10

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Component: Hub Shell (the container app for all MyLife modules)
This is the app-level shell, not a module. It provides the dashboard, module discovery, settings, and system-level screens.

Design 10 mobile screens for the MyLife hub shell. All screens use the Cool Obsidian dark theme with glass morphism, #12121A surface panels, and rgba(255,255,255,0.06) subtle borders.

1. DASHBOARD ((hub)/index.tsx)
   - Dynamic greeting header: "Good morning, Trey" (time-aware, large text, #F0F0F5)
   - 4 customizable module summary cards in 2x2 grid (glass fill rgba(255,255,255,0.04), glassBorder rgba(255,255,255,0.10))
   - Each summary card: module icon, module name, 1-2 live stats (e.g., "3 books this month", "$2,340 budget remaining"), module accent color accent bar on left edge
   - Quick action row: 5 circular icon buttons (mood/fast/budget/journal/workouts) with labels below, tappable
   - All-modules grid: 4-column icon grid, each cell is module icon + name below, enabled modules full opacity, disabled modules dimmed
   - Empty state (no modules enabled): illustration, "Browse Modules" CTA button
   - Sticky dock bar at bottom with hub nav icons

2. DISCOVER ((hub)/discover.tsx)
   - 6 category sections with section headers:
     - Lifestyle (journal, mood, notes, voice, words, habits, garden)
     - Health & Fitness (health, meds, nutrition, fast, cycle, workouts)
     - Finance (budget, market, subs)
     - Home & Auto (homes, car, closet, pets)
     - Social & Events (forums, rsvp, mail, stars)
     - Exploration (surf, trails, books, recipes, flash)
   - Per-module card: icon, name, tagline, enable/disable toggle switch
   - Release state badges: "GA" (green pill) / "Beta" (yellow pill)
   - Premium lock overlay: lock icon + "Pro" badge on premium modules when not subscribed
   - Search bar at top to filter modules by name

3. SETTINGS ((hub)/settings.tsx)
   - Subscription plan display card: plan name ("MyLife Pro" or "Free"), renewal date, manage button
   - Sync mode selector: Local / P2P / Cloud (segmented control with descriptions)
   - Info section: app version, database version, privacy policy link, terms link
   - Navigation links (glass cards, tappable):
     - Privacy Dashboard (shield icon)
     - Sharing Preferences (people icon)
     - Import Wizard (download icon)
     - Data & Sync (cloud icon)
     - Backup & Restore (archive icon)
   - Section dividers with rgba(255,255,255,0.06) borders

4. SEARCH ((hub)/search.tsx)
   - Cross-module search input (large, top, magnifying glass icon, 200ms debounce)
   - Recent activity feed (15 items) when search is empty: module icon, action text, timestamp, module accent color dot
   - Search results grouped by module: module name header with accent color, result items with bold keyword highlights
   - Each result: module icon, item title (highlighted), preview text, timestamp
   - "No results" empty state with search icon

5. DATA & SYNC ((hub)/data-sync.tsx)
   - 5 sync tier cards (vertical list):
     - Local Only (free): device icon, "Data stays on device"
     - P2P Sync (free): peer icon, "Sync between your devices"
     - Free Cloud (free): cloud icon, "500MB cloud backup"
     - Starter ($X/mo): cloud icon, "5GB + auto backup"
     - Power ($X/mo): cloud icon, "Unlimited + priority sync"
   - Current tier highlighted with accent border
   - Storage usage bar: used/total with percentage label
   - P2P pairing section: pairing code display (large monospace), "Generate New Code" button, paired devices list

6. IMPORT WIZARD ((hub)/import-wizard.tsx)
   - 4-step flow with step indicator (numbered dots with connecting lines)
   - Step 1: App selection grid (Goodreads / YNAB / MyFitnessPal / Day One / CSV), each as tappable card with app icon and name
   - Step 2: Export instructions (app-specific text with numbered steps, screenshots placeholder)
   - Step 3: File upload area (dashed border, tap to select) + progress bar (animated, accent color)
   - Step 4: Results summary: imported count, skipped count, error count (red if >0), error details expandable
   - "Next" / "Back" / "Done" navigation buttons

7. PRIVACY DASHBOARD ((hub)/privacy.tsx)
   - Per-module data listing (expandable accordion sections)
   - Each module section: module icon + name header, table row counts per data type, cloud vs local badge per table
   - Storage breakdown: local (device icon) vs cloud (cloud icon) with sizes
   - "Delete All Data" button at bottom (red #FF453A, with double confirmation: "Are you sure?" then "Type DELETE to confirm")
   - Per-module "Delete Module Data" button (red outlined)

8. BACKUP & RESTORE ((hub)/backup.tsx)
   - SQLite file section:
     - "Export Database" button (creates .sqlite file for sharing)
     - "Import Database" button (file picker, with overwrite warning)
   - Cloud backup section:
     - Cloud backup toggle switch
     - Last backup date and time
     - "Backup Now" button
     - Backup history list (date, size, status)
   - Restore section:
     - "Restore from Cloud" button with backup picker
     - Warning text about data overwrite

9. SHARING PREFERENCES ((hub)/sharing.tsx)
   - Per-module sharing controls (accordion list)
   - Each module: module icon + name, sharing toggle (on/off), collaborator list (if sharing enabled)
   - Collaborator management: add by email/code, permission level (view/edit), remove button
   - Global sharing toggle at top ("Disable all sharing")
   - Sharing activity log (who accessed what, when)

10. ONBOARDING ((hub)/onboarding.tsx)
    - Multi-step welcome flow with progress dots
    - Step 1: Privacy consent screen: shield icon (large), "Your data, your rules" headline, bullet points (no analytics, no telemetry, offline-first), "I Agree" button
    - Step 2: Mode picker: 3 large cards for Local / P2P / Cloud, each with icon, title, description, recommendation badge on "Local"
    - Step 3: Self-host setup guide (if cloud selected): server URL input, API key input, test connection button, or "Use MyLife Cloud" button
    - Step 4: Choose first modules (mini discover grid with toggles)
    - "Get Started" final button (prominent, accent colored)
```

---

## Prompt 2: Web Screens 11--16

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Component: Hub Shell (Web)
Layout: Persistent left sidebar with main content area

Design 6 web screens for the MyLife hub shell. Desktop-optimized with wider layouts, multi-column grids, and persistent sidebar navigation. Same Cool Obsidian dark theme.

11. DASHBOARD (/)
    - Module grid: enabled modules as cards (3-4 columns), each card with module icon, name, 1-2 live stats, accent color top border
    - Enable/disable toggle per card (gear icon hover state)
    - Summary cards row at top: total modules enabled, recent activity count, subscription status
    - Quick actions bar: mood/fast/budget/journal shortcuts as icon buttons
    - "Discover Modules" CTA if fewer than 3 modules enabled
    - Responsive: 4 columns on wide, 2 on narrow

12. DISCOVER (/discover)
    - Module browser organized by category (same 6 categories as mobile)
    - Grid layout: 3-4 columns of module cards
    - Each card: icon (large), module name, tagline, tier badge (Free/Pro), release state (GA/Beta), enable/disable toggle
    - Category filter tabs at top (horizontal)
    - Search input to filter by name or tagline
    - Premium lock overlay with "Upgrade to Pro" link

13. SETTINGS (/settings)
    - Left column: navigation menu (Account, Subscription, Sync, Backup, Export, Privacy)
    - Right column: active section content
    - Account section: profile info, email
    - Subscription section: current plan card, upgrade/manage buttons, billing history table
    - Sync section: sync mode selector, storage usage, P2P pairing
    - Backup section: cloud backup toggle, backup history table, manual backup/restore buttons
    - Export section: full data export (JSON/CSV), per-module export
    - Privacy section: per-module data listing, delete options

14. SIDEBAR (Sidebar.tsx)
    - Persistent left navigation panel (#12121A background)
    - MyLife logo/wordmark at top
    - Hub links: Dashboard (home icon), Discover (compass icon), Search (magnifying glass), Settings (gear icon)
    - Divider line (rgba(255,255,255,0.06))
    - Enabled module icons in vertical list: module icon with accent color, module name text, active state (left border accent bar + brighter opacity)
    - Hover state: surfaceElevated (#1A1A24) background
    - Collapse/expand toggle at bottom (hamburger icon)
    - User avatar and name at very bottom

15. COMMAND PALETTE (CommandPalette.tsx)
    - Cmd+K triggered overlay (centered modal with backdrop blur)
    - Search input at top (large, autofocused)
    - Results grouped by type: Modules, Screens, Actions, Recent
    - Each result: icon, name, breadcrumb path (e.g., "MyBooks > Reading List"), keyboard shortcut hint (if applicable)
    - Arrow keys to navigate, Enter to select, Esc to close
    - "No results" state with suggestions
    - Glass morphism card (rgba(255,255,255,0.08) fill, backdrop-filter blur)

16. PROVIDERS (Providers.tsx)
    - This is a developer/debug screen (not user-facing in production)
    - Provider status dashboard: list of all context providers
    - Database initialization status: connected/initializing/error badge, database file path, size
    - Module registry status: loaded module count, registered vs active count, last refresh
    - Auth provider status: authenticated/anonymous, user ID
    - Entitlements provider: subscription tier, active entitlements list
    - "Reinitialize" button per provider (for debugging)
    - System info: app version, build number, environment (dev/staging/prod)
```
