# Hub Settings -- UI/UX Implementation Prompt

**Screen:** Settings (account, sync, preferences hub)
**Route:** `apps/mobile/app/(hub)/settings.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/hub_settings/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/settings.tsx` (9.1 KB) |
| Entitlements/subscription | `apps/mobile/components/EntitlementsProvider.tsx` (useEntitlements, usePayment) |
| Purchase flow | `apps/mobile/components/PurchaseGate.tsx` (RevenueCat) |
| Subscription package | `packages/subscription/` (@mylife/subscription) |
| Sub-screen routes | privacy, sharing, import-wizard, data-sync, backup (all in (hub)/ layout) |
| Hub layout | `apps/mobile/app/(hub)/_layout.tsx` (all sub-screens registered as Stack.Screen) |
| Glass tokens | `packages/ui/src/tokens/glass.ts` |
| Tests | `apps/mobile/app/(hub)/__tests__/settings.test.tsx` |

**Notes:**
- Subscription card uses RevenueCat for mobile, Stripe for web. The metallic gradient card is purely visual.
- Sync mode selector (Local/P2P/Cloud) maps to existing mode settings. Current implementation may be simpler.
- Navigation cards link to sub-screens that are already registered in the hub layout.
- "MyLife Pro" and "Obsidian Level Curator" are branding terms from the Stitch design. Verify against current RevenueCat product names.
- Version/build info can pull from `expo-constants` or app config.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent, glass morphism)

Component: MyLife Hub Settings (account, subscription, and system preferences)
Platform: React Native (Expo)
Route: apps/mobile/app/(hub)/settings.tsx

Build the MyLife settings screen. This is the hub for account management, subscription status, sync configuration, and navigation to sub-settings screens. Features a prominent subscription card with metallic gradient.

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- surface-container-lowest: #0e0e13
- primary: #ffb877
- primary-container: #c9894d
- on-primary: #4b2700
- on-primary-container: #4a2600
- primary-fixed-dim: #ffb877
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5

LAYOUT:

1. TOP APP BAR (fixed, same as other screens)

2. SUBSCRIPTION PLAN SECTION
   - Section header: "SUBSCRIPTION PLAN" (xs font-medium uppercase tracking-[0.05em] on-surface-variant, left) + "RENEWING AUG 12" (10px uppercase tracking-widest primary bold, right)
   - Subscription card:
     - METALLIC GRADIENT background: linear-gradient(135deg, #ffb877 0%, #c9894d 100%)
     - Rounded-lg, p-8, shadow-2xl, relative overflow-hidden
     - Ambient light: absolute positioned div -right-12 -top-12, w-48 h-48, bg-white/10, rounded-full, blur-3xl (intensifies on hover to white/20)
     - Content (relative z-10):
       - Title: "MyLife Pro" (3xl extrabold tracking-tighter, on-primary-container, leading-none)
       - Subtitle: "Obsidian Level Curator" (on-primary-container at 70% opacity, sm font-medium)
       - Verified badge icon: 4xl, on-primary-container at 40% opacity (top-right)
       - Action row: "Manage Plan" button (bg-on-primary-container, text-primary-fixed-dim, px-6 py-2, rounded-full, sm bold, shadow-lg) + "5+" badge (w-8 h-8 rounded-full, border-2 border-primary-container, bg-surface-container-high, 10px bold centered)
     - Hover: scale-[1.01] transition 300ms
     - Free tier variant: same layout but bg-surface-container-high instead of gradient, "MyLife Free" title, "Upgrade to Pro" CTA button

3. SYNC MODE SELECTOR
   - Section header: "SYNC MODE STRATEGY" (xs font-medium uppercase tracking-[0.05em] on-surface-variant)
   - Segmented control: 3 segments in a pill container
     - Container: grid-cols-3, gap-2, p-1.5, bg-surface-container-lowest, rounded-full, border border-white/5
     - Options: Local | P2P | Cloud
     - Each segment: py-3 px-4, rounded-full, xs bold
     - Active segment: bg-white/5, text-primary, shadow-sm
     - Inactive: text-on-surface at 40% opacity, hover to full opacity
   - Helper text below: 11px italic centered, on-surface-variant at 60% opacity
     - "Cloud synchronization ensures your data is persistent across all authorized devices."

4. PREFERENCES & PRIVACY NAVIGATION
   - Section header: "PREFERENCES & PRIVACY" (xs font-medium uppercase tracking-[0.05em] on-surface-variant)
   - Vertical list of glass navigation cards (gap-3):

   Each card:
   - Glass fill: rgba(255,255,255,0.04) + backdrop-blur-20px
   - p-5, rounded-lg, flex row between
   - Left side: icon circle (w-10 h-10 rounded-full bg-surface-container-high, centered Material icon in primary, hover:scale-110 transition) + text column (title: bold on-surface tracking-tight + subtitle: xs on-surface-variant at 70%)
   - Right side: chevron_right icon (on-surface-variant at 40%)
   - Interaction: hover:bg-white/10, active:scale-[0.98]
   - Tappable: navigates to the respective sub-screen

   Cards (in order):
   a. Privacy Dashboard -- shield icon -- "Control your digital footprint"
   b. Sharing Preferences -- groups icon -- "Manage peer access levels"
   c. Import Wizard -- download icon -- "Ingest external library data"
   d. Data & Sync -- cloud icon -- "Topology and relay settings"
   e. Backup & Restore -- archive icon -- "Cold storage and snapshots"

5. VERSION INFO SECTION
   - Divider: border-t border-white/5, pt-8
   - Centered column:
     - Version badge: pill-shaped (px-3 py-1, bg-surface-container-high, rounded-full, 10px bold on-surface-variant at 60%, uppercase tracking-widest): "MYLIFE BUILD 4.2.0-STABLE"
     - Sync status: 10px on-surface-variant at 40%, centered, uppercase tracking-widest: "LAST SYNCED 2 MINUTES AGO"

6. BOTTOM NAV (Settings tab active with amber highlight)

INTERACTIONS:
- Subscription card: tappable, opens subscription management (RevenueCat paywall or manage screen)
- Sync mode segments: tappable, selection animates slide transition
- Navigation cards: tappable with press feedback (scale 0.98), navigate to respective routes
- Each sub-screen (Privacy, Sharing, Import, Sync, Backup) has its own screen prompt

DESIGN RULES:
- Metallic gradient card is the visual hero of this screen
- No 1px border separators between sections; use spacer gaps
- Glass cards use the standard rgba(255,255,255,0.04) + blur formula
- Section headers all follow the same xs/uppercase/tracking style
```
