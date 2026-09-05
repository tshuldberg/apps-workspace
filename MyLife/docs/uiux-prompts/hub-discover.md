# Hub Discover -- UI/UX Implementation Prompt

**Screen:** Discover (module browser)
**Route:** `apps/mobile/app/(hub)/discover.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/discover_modules/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/discover.tsx` (9.2 KB, SectionList with 6 categories) |
| Module toggle hook | `apps/mobile/hooks/use-module-toggle.ts` (useModuleToggle) |
| Module definitions | `packages/module-registry/src/constants.ts` (30 modules with tier, tagline, icon) |
| Module icons | `packages/module-registry/src/hub-icons.ts` (MODULE_ICONS, Lucide names) |
| Entitlements gate | `apps/mobile/components/EntitlementsProvider.tsx` (useModuleUnlocked) |
| Purchase flow | `apps/mobile/components/PurchaseGate.tsx` (RevenueCat modal) |
| ModuleCard component | `apps/mobile/components/ModuleCard.tsx` (lock overlay, PRO badge) |
| Category groups | Defined in discover.tsx (6 categories matching CLAUDE.md) |
| Glass tokens | `packages/ui/src/tokens/glass.ts` |
| Tests | `apps/mobile/app/(hub)/__tests__/discover.test.tsx` |

**Notes:**
- Existing discover uses SectionList with 6 flat categories. Stitch design uses an asymmetric bento grid with featured hero cards and varying card sizes per category.
- Category names match: Exploration, Finance, Lifestyle, Health & Fitness, Home & Auto, Social & Events.
- Premium lock overlay in Stitch matches existing PurchaseGate pattern.
- Navigation drawer in Stitch is not currently implemented on mobile. Evaluate whether to add it or keep the existing pattern.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent, glass morphism)

Component: MyLife Discover Screen (module browser and marketplace)
Platform: React Native (Expo)
Route: apps/mobile/app/(hub)/discover.tsx

Build the MyLife module discovery screen. Users browse, enable/disable, and configure modules here. Uses an asymmetric bento grid layout with a featured module hero card, category-based module cards, and a premium lock overlay for Pro-only modules.

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- primary: #ffb877 / #C9894D
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5
- on-primary: #4b2700
- tertiary: #8bcff0 (used for beta badges)

LAYOUT:

1. TOP APP BAR (fixed, same as dashboard)
   - Hamburger menu + "MyLife" wordmark (amber) + user avatar

2. HERO SECTION
   - Headline: "Expand Your" (4xl extrabold tracking-tight, on-surface) + "Ecosystem" on next line (italic, #C9894D, text-shadow glow: 0 0 12px rgba(201,137,77,0.4))
   - Search input below: full-width, bg-surface-container-highest, rounded-full, py-5, pl-14, search icon left, placeholder: "Search modules, features, or integrations..." (on-surface-variant at 50%), focus:ring-primary/30

3. MODULE CATEGORY GRID (asymmetric bento)

   FEATURED MODULE (large card, full-width hero):
   - Min-height: 400px, rounded-lg, bg-surface-container-low, p-8, overflow-hidden
   - Background image: atmospheric cover image, opacity-20, scale-105 on hover (700ms transition)
   - Gradient overlay: from-surface-container-low via-transparent to-transparent (bottom to top)
   - Content (relative z-10):
     - Top row: large category icon (5xl, amber, drop-shadow glow) + release badge (pill: "GA" with bg-primary text-on-primary-container, 10px bold uppercase tracking-widest)
     - Title: 3xl bold on-surface
     - Description: on-surface-variant, relaxed leading, max-w-md
   - Bottom row:
     - Left: "Configure" button (pill, bg-primary, on-primary text, bold py-3 px-8) + "Details" button (glass-panel fill rgba(255,255,255,0.04), on-surface text, pill)
     - Right: "Enabled" label (xs uppercase tracking-widest, on-surface-variant) + toggle switch (w-12 h-6, bg-primary when on, knob w-4 h-4 rounded-full bg-on-primary)

   STANDARD MODULE CARD (medium, used for most categories):
   - bg-surface-container-low, rounded-lg, p-6
   - Hover: bg-surface-container-high transition
   - Top: icon container (w-12 h-12 rounded-2xl bg-surface-container-highest, centered Material icon in amber) + optional release badge
   - Badge styles:
     - "GA": bg-primary text-on-primary-container
     - "BETA": bg-surface-container-highest text-tertiary (#8bcff0)
   - Title: xl bold on-surface
   - Description: sm on-surface-variant, relaxed leading
   - Bottom: toggle switch + status text
     - Active: toggle bg-primary, knob right, "ACTIVE" text (10px bold primary uppercase)
     - Disabled: toggle bg-surface-container-highest, knob left + faded, "ENABLE" text (amber bold sm uppercase tracking-widest, tappable)
     - Setup required: "SETUP" text instead of Enable

   PREMIUM LOCKED MODULE (with Pro overlay):
   - Same card size, with background image filling the card
   - Lock overlay: absolute inset-0, bg-[#0E0E13]/80 + backdrop-blur-md
   - Centered content: lock icon (4xl, amber, filled), "Lifestyle Hub" title (lg bold), "PRO SUBSCRIPTION REQUIRED" (xs on-surface-variant uppercase tracking-widest), "Upgrade Now" button (pill, bg-primary, on-primary text, bold sm)

   FULL-WIDTH MODULE CARD (used for Social & Events):
   - Full-width, bg-surface-container-low, rounded-lg, p-8
   - Row layout: icon area (w-14 h-14 rounded-2xl bg-primary/10, amber icon 3xl) + text (2xl bold title + on-surface-variant description)
   - Right side: stacked user avatars (3 circles + "+12" count) + "Enter Hub" CTA button (pill, bg-primary, shadow-primary/20)

   CATEGORY MAPPING (use real MyLife module categories):
   - Exploration: surf, trails, books, recipes, flash
   - Finance: budget, market, subs
   - Lifestyle: journal, mood, notes, voice, words, habits, garden
   - Health & Fitness: health, meds, nutrition, fast, cycle, workouts
   - Home & Auto: homes, car, closet, pets
   - Social & Events: forums, rsvp, mail, stars

4. NAVIGATION DRAWER (slide-in from left on hamburger tap)
   - Fixed left, w-80, bg-[#0E0E13], rounded-r-3xl, shadow-2xl
   - User info: avatar (w-12 h-12 rounded-xl) + "The Curator" title (amber bold) + "Obsidian Level" subtitle (xs, 60% opacity)
   - Nav links: Privacy Dashboard, Import Wizard, Backup & Restore, Sharing Preferences, Recent Activity, Help & Support
   - Each link: flex row with Material icon + text, p-3, hover:bg-[#35343A] rounded-lg
   - Active link: bg-white/5 text-amber font-bold
   - Footer: "Sync Active" label + pulsing amber dot (animate-pulse)

5. BOTTOM NAV (same as dashboard, Discover tab active)

INTERACTIONS:
- Search filters modules in real-time (200ms debounce)
- Toggle switches animate smoothly (spring)
- Premium lock overlay: tap "Upgrade Now" navigates to subscription screen
- Cards are tappable to navigate into module detail/configuration
- Drawer opens with slide animation, closes on outside tap or back gesture

DESIGN RULES:
- No 1px borders for separation
- Featured card uses background image at low opacity with gradient overlay
- Toggle switches: custom styled, not system defaults
- Text shadow glow on "Ecosystem" heading only
```
