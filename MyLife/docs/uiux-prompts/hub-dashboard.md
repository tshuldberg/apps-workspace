# Hub Dashboard -- UI/UX Implementation Prompt

**Screen:** Dashboard (Home tab)
**Route:** `apps/mobile/app/(hub)/index.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/loom_dashboard/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/index.tsx` (21 KB, functional) |
| Hub layout | `apps/mobile/app/(hub)/_layout.tsx` |
| Root providers | `apps/mobile/app/_layout.tsx` (DatabaseProvider, EntitlementsProvider, etc.) |
| Dock tab config | `packages/module-registry/src/hub-icons.ts` (DOCK_ITEMS array) |
| Module icons | `packages/module-registry/src/hub-icons.ts` (MODULE_ICONS) |
| Module toggle | `apps/mobile/hooks/use-module-toggle.ts` (useModuleToggle) |
| Enabled modules | `useEnabledModules()` from `@mylife/module-registry` |
| Dashboard data | `aggregateDashboardData()` in index.tsx |
| Onboarding check | `useOnboardingComplete()` from `apps/mobile/hooks/use-onboarding.ts` |
| Glass tokens | `packages/ui/src/tokens/glass.ts` |
| Color tokens | `packages/ui/src/tokens/colors.ts` |
| Typography | `packages/ui/src/tokens/typography.ts` |
| Shared components | `Button`, `Card`, `Text`, `TagPill` from `@mylife/ui` |
| Module card | `apps/mobile/components/ModuleCard.tsx` (lock overlay + PurchaseGate) |
| Entitlements | `useModuleUnlocked()` from `apps/mobile/components/EntitlementsProvider.tsx` |
| Tests | `apps/mobile/app/(hub)/__tests__/dashboard.test.tsx` |

**Notes:**
- Current icon library is Lucide, not Material Symbols. Map Stitch icons to Lucide equivalents.
- Current dock has 4 tabs (Hub/Search/Discover/Settings). Stitch adds Sync as 5th tab. Coordinate with hub-icons.ts.
- DockBar is defined inline in index.tsx, not a shared component. Consider extracting to `apps/mobile/components/DockBar.tsx`.
- QuickActionButton, ModuleSummaryCard, ModuleGridItem are also inline in index.tsx.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans typography, #C9894D/#ffb877 amber accent, glass morphism with rgba(255,255,255,0.03) fills and backdrop-blur-20px)

Component: MyLife Hub Dashboard (the main homescreen of the MyLife app)
Platform: React Native (Expo), using expo-blur for glass effects
Route: apps/mobile/app/(hub)/index.tsx

Build the MyLife dashboard homescreen. This is the primary screen users see after opening the app. It uses the Obsidian Noir dark theme with warm amber accents and tonal surface layering (no 1px borders -- use background color shifts for separation).

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container: #1f1f25
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- primary (accent): #ffb877
- primary-container: #c9894d
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5
- tertiary (health/info): #8bcff0
- outline-variant: #52443a

TYPOGRAPHY: Plus Jakarta Sans everywhere. Tight tracking on headlines (-0.02em). Uppercase labels with +0.05em tracking and 10px size.

LAYOUT (top to bottom):

1. TOP APP BAR (fixed, sticky)
   - Glassmorphic: bg-[#131318]/70 with backdrop-blur-xl, h-16
   - Left: hamburger menu icon (amber #C9894D) + "MyLife" wordmark (2xl bold, tight tracking, amber)
   - Right: circular user avatar (w-10 h-10, rounded-full, border border-white/10, overflow-hidden with cover image)
   - No bottom border -- separation via tonal shift only

2. WELCOME HERO
   - Dynamic greeting: "Good morning, {name}" -- time-aware (morning/afternoon/evening)
   - Text: 4xl font-extrabold tracking-tight, color on-surface (#e4e1e9)
   - Subtitle: current date in uppercase, xs font, tracking-wide, on-surface-variant at 70% opacity
   - Format: "WEDNESDAY, OCTOBER 25"

3. BENTO SUMMARY GRID (2x2 on mobile, single column scroll)
   - Each card: glass-card style (rgba(255,255,255,0.03) bg, backdrop-blur 20px, rounded-lg, p-8)
   - Hover/press: transition to bg-white/5
   - Card structure:
     a. Top row: module label (xs, bold, uppercase, tracking-widest, #C9894D) + Material icon (amber at 40% opacity, full amber on hover)
     b. Primary stat: 3xl font-bold (e.g., "3 books", "$2,340", "14 sessions", "82 readiness")
     c. Bottom detail area varies per card:

   CARD 1 -- MyBooks:
   - Label: "MYBOOKS", icon: auto_stories
   - Stat: "3 books"
   - Bottom: row of 3 overlapping book cover thumbnails (w-12 h-16 each, -space-x-3, rounded, shadow-lg, border border-white/5) + "this month" text

   CARD 2 -- MyBudget:
   - Label: "MYBUDGET", icon: payments
   - Stat: "$2,340"
   - Bottom: "remaining this month" text + ultra-thin progress bar (h-1, bg-surface-container-highest track, gradient fill from primary-container to primary, w-2/3)

   CARD 3 -- MyWorkouts:
   - Label: "MYWORKOUTS", icon: fitness_center
   - Stat: "14 sessions"
   - Bottom: mini bar chart (7 vertical bars, varying heights h-10 to h-24, w-2 each, rounded-full, primary at varying opacities 20-100%) + "Weekly streak" label right-aligned

   CARD 4 -- MyHealth:
   - Label: "MYHEALTH", icon: vital_signs
   - Stat: "82 readiness"
   - Bottom left: status dot (w-3 h-3 rounded-full, tertiary #8bcff0 with shadow glow 0 0 8px rgba(139,207,240,0.5)) + "Optimal Flow" label
   - Bottom right: "DEEP SLEEP" label (xs uppercase tracking-widest 60% opacity) + "6h 12m" value (bold)

   NOTE: These 4 cards are user-configurable. Users can choose which modules appear here. This is showing the default set.

4. QUICK ACTIONS ROW
   - Section header: "QUICK ACTIONS" (sm bold uppercase tracking-[0.2em] #C9894D at 60% opacity)
   - Horizontal scroll row (overflow-x-auto, no scrollbar)
   - Each action: vertical stack of:
     a. Circle button (w-14 h-14 rounded-full, bg-surface-container-high, border border-white/5, centered Material icon)
     b. Label below (xs uppercase tracking-widest 60% opacity)
   - On press: scale-90 animation, bg transitions to primary-container with on-primary-container text
   - Default actions: Mood, Fast, Budget, Journal, Workouts
   - Min-width per item: 100px, gap-4

5. LIBRARY MODULES GRID
   - Header row: "LIBRARY MODULES" label (same style as Quick Actions header) + "30 ACTIVE" count (xs 40% opacity, right-aligned)
   - 4-column grid on mobile (grid-cols-4, gap-x-4 gap-y-8)
   - Each module cell:
     a. Icon container: w-12 h-12 rounded-xl, bg-surface-container-low, centered Material Symbols icon in on-surface-variant
     b. Label below: 10px uppercase tracking-tighter 50% opacity
     c. Hover: bg-white/10, icon color transitions to primary
   - Sample modules shown: Reader, Assets, Fuel, Zen, Tasks, Web, Rest, Vault, Social, Goals
   - Last cell: "+" icon at 40% opacity with "More" label (opens Discover)
   - Enabled modules: full opacity. Disabled: dimmed

6. BOTTOM NAVIGATION BAR (fixed, sticky)
   - Glassmorphic: bg-[#131318]/70, backdrop-blur-2xl, rounded-t-3xl, h-20, pb-4
   - Shadow: 0 -8px 32px rgba(0,0,0,0.5)
   - 5 tabs evenly spaced: Home, Discover, Search, Sync, Settings
   - Icons: Material Symbols (dashboard_customize, explore, search, sync, settings)
   - Labels: 10px uppercase tracking-[0.05em] medium weight, Plus Jakarta Sans
   - Active tab (Home): amber #C9894D color + drop-shadow glow (0 0 8px rgba(201,137,77,0.3)) + scale-110 + filled icon variant
   - Inactive tabs: #e4e1e9 at 40% opacity, hover to full opacity

INTERACTIONS:
- Bento cards: tappable, navigate to respective module
- Quick action buttons: tappable with haptic feedback, navigate to module's primary action
- Module grid items: tappable, navigate to module
- Pull-to-refresh on the main scroll view
- Cards use spring animations on press (scale 0.98)

EMPTY STATE (no modules enabled):
- Centered illustration placeholder
- "Browse Modules" CTA button (pill-shaped, primary gradient bg)

DESIGN RULES:
- NO 1px borders for section separation. Use background color tonal shifts only.
- Glass cards: rgba(255,255,255,0.03) with blur, not solid fills
- Shadows: use tonal layering, not traditional drop shadows. If needed, use 24px blur at 8% opacity with on-surface color, never black.
- "Ghost borders" only: 1px inner stroke at outline-variant (#52443a) at 15% opacity where cards need definition against similar backgrounds
- Primary CTA buttons: pill-shaped (rounded-full), gradient from #ffb877 to #c9894d at 135deg
- Progress bars: ultra-thin (4px/h-1), bg-surface-container-highest track, primary accent fill
```
