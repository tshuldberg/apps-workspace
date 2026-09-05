# Hub Onboarding -- UI/UX Implementation Prompt

**Screen:** Onboarding Flow (first launch)
**Route:** `apps/mobile/app/(onboarding)/index.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/loom_onboarding/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(onboarding)/index.tsx` (22 KB, 7-step flow) |
| Onboarding layout | `apps/mobile/app/(onboarding)/_layout.tsx` (headerShown: false) |
| Onboarding FSM hook | `apps/mobile/hooks/use-onboarding.ts` (useOnboarding: next, skip, back, setContentPrefs, setSelectedModules) |
| Completion check | `useOnboardingComplete()` |
| Onboarding store | `@mylife/onboarding` package (SqliteOnboardingStore) |
| Privacy sub-screen | `apps/mobile/app/(hub)/onboarding-privacy.tsx` (728 B) |
| Mode sub-screen | `apps/mobile/app/(hub)/onboarding-mode.tsx` (3.1 KB) |
| Self-host sub-screen | `apps/mobile/app/(hub)/self-host.tsx` (14 KB) |
| Shared onboarding UI | `packages/ui/src/components/OnboardingPage.tsx`, `OnboardingFlow.tsx` |
| Module registry | `packages/module-registry/src/constants.ts` (30 modules for selection grid) |
| Glass tokens | `packages/ui/src/tokens/glass.ts` |
| Tests | `apps/mobile/app/(hub)/__tests__/onboarding-mode.test.tsx`, `self-host.test.tsx` |

**Notes:**
- Existing onboarding has 7 steps: WELCOME, CONTENT_PREFS, MODULE_SELECTION, IMPORT, AI_PREFS, BIO_VERIFY, DASHBOARD_REVEAL. The Stitch design collapses this into a 4-step vertical scroll.
- The Stitch design includes self-host setup inline; current codebase has it as a separate screen.
- Module selection grid should use real ModuleDefinition data from the registry, not placeholder names.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent, glass morphism)

Component: MyLife Onboarding Flow (first-launch experience)
Platform: React Native (Expo)
Route: apps/mobile/app/(onboarding)/index.tsx

Build the MyLife first-launch onboarding flow. This is a multi-step vertical scroll experience shown once on first app launch. It guides users through privacy consent, sync architecture selection, optional self-hosting, and initial module selection.

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- surface-container-lowest: #0e0e13
- primary: #ffb877
- primary-container: #c9894d
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5
- on-primary: #4b2700
- on-primary-container: #4a2600

LAYOUT (top to bottom, single scrollable flow):

1. TOP BAR (fixed)
   - Left: "MyLife" wordmark (2xl bold tight tracking, amber)
   - Right: step indicator "STEP 01 / 04" (10px uppercase tracking-[0.1em] semibold, on-surface-variant) + progress bar (w-24 h-1 rounded-full, bg-surface-container-highest track, primary fill width = step/4, with subtle glow shadow)

2. STEP 1: PRIVACY CONSENT (centered, generous padding py-12)
   - Large shield icon: centered, 8xl size, primary color, filled variant
   - Behind icon: diffuse amber glow (absolute, primary at 20% opacity, blur-3xl, rounded-full)
   - Headline: "Your Data. Your Sanctuary." (4xl font-extrabold tracking-tight, on-surface, centered)
   - Body text: "MyLife is built on the principle of sovereign identity. We never see your keys, your connections, or your thoughts. Everything is encrypted by default." (on-surface-variant, lg size, relaxed line-height, centered, max-w-2xl)
   - Action buttons (centered, gap-4, pt-4):
     a. Primary: "I Understand & Accept" -- pill-shaped, bg-gradient from primary to primary-container, on-primary text, font-bold, px-8 py-4, shadow-lg, hover:scale-105 active:scale-95
     b. Secondary: "Read Manifesto" -- pill-shaped, obsidian-glass fill (rgba(31,31,37,0.4) + backdrop-blur-20px), on-surface text, font-medium

3. STEP 2: SYNC ARCHITECTURE PICKER (asymmetric bento layout)
   - Section label: "PROTOCOL SELECTION" (xs bold tracking-[0.2em] primary uppercase)
   - Headline: "Choose your architecture" (3xl bold)
   - Subtitle: "Define how MyLife syncs your data across your devices." (on-surface-variant, sm)
   - Three cards in vertical stack on mobile:

   CARD A -- Local Only (compact):
   - bg-surface-container-low, p-8, rounded-lg, border border-white/5
   - Icon: hard_drive (primary, 3xl, mb-6)
   - Title: "Local Only" (xl bold)
   - Description: "Pure offline experience. Data never leaves this device. Ideal for maximum security." (sm, on-surface-variant)
   - Tappable, hover: bg-surface-container-high

   CARD B -- P2P Sync (featured, recommended):
   - bg-surface-container-high, p-8, rounded-lg, border-2 border-primary/30
   - Ambient glow: absolute positioned div, -right-10 -top-10, w-40 h-40, primary at 10% opacity, blur-3xl
   - Badge: "RECOMMENDED" pill (bg-primary/10, text-primary, 10px, uppercase tracking-wider)
   - Icon: hub (primary, 3xl)
   - Title: "Peer-to-Peer Sync" (2xl bold)
   - Description: "Encrypted device-to-device synchronization. No central server. No middleman." (on-surface-variant)
   - CTA link: "Explore Mesh Network ->" (primary bold sm, with arrow icon)

   CARD C -- Encrypted Cloud (full-width):
   - bg-surface-container-low, p-8, rounded-lg, border border-white/5
   - Row layout: icon + text left, "Configure Cloud" button right
   - Icon: filter_drama (on-surface-variant, 4xl)
   - Title: "Encrypted Cloud" (xl bold)
   - Description: "Standard convenience with zero-knowledge encryption." (sm, on-surface-variant)
   - Button: obsidian-glass + border-white/10, pill-shaped, sm bold

4. STEP 3: SELF-HOST SETUP (contextual, collapsible)
   - Outer wrapper: bg-surface-container-lowest, rounded-xl, border border-white/5, p-1
   - Inner content: bg-surface, p-8, rounded-lg
   - Headline: "Self-Host Setup" (3xl bold)
   - Description: "Prefer to host your own MyLife instance? Deploy the Docker container and point your curator here." (on-surface-variant)
   - Numbered steps:
     a. Step 1 "Pull the Image": number badge (w-10 h-10 rounded-full, bg-surface-container-highest, primary text) + code block (bg-surface-container-lowest, p-3, rounded, monospace, xs, border-white/5): `docker pull mylife/curator:latest`
     b. Step 2 "Instance URL": same number badge + text input (bg-surface-container-lowest, rounded-lg, no border, focus:ring-primary, placeholder "https://curator.yourdomain.com")
     c. Step 3 "Test Connection": check icon badge + "Test Connection" link (primary bold sm uppercase tracking-widest) with refresh icon
   - Status display: "MyLife Curator v4.2.0-stable" (10px monospace, on-surface-variant)

5. STEP 4: MODULE SELECTION GRID
   - Headline: "Curate Your Interface" (3xl bold, centered)
   - Subtitle: "Select the initial modules for your library. You can always expand later." (on-surface-variant, centered, max-w-lg)
   - 2-column grid (grid-cols-2, gap-6)
   - Each module card:
     a. bg-surface-container-low, p-6, rounded-xl, border border-white/5
     b. Icon container: w-16 h-16 rounded-2xl bg-surface-container-highest, centered Material icon (primary or on-surface-variant)
     c. Module name: bold sm text, centered
     d. Selection indicator: w-5 h-5 rounded-full, border-2 border-primary/30. Selected: inner dot w-2 h-2 bg-primary. Unselected: empty
     e. Selected card: border-2 border-primary/40, bg-primary/5, shadow glow
     f. Hover: border-primary/50, bg-surface-container-high, icon scale-110
   - Show real MyLife modules: MyBooks, MyBudget, MyWorkouts, MyHealth, etc.

6. FINAL CTA SECTION
   - Divider: border-t border-white/5, mt-24, pt-12
   - Left text: "Ready to get started?" (xl bold) + "Your configuration is saved to your local vault." (on-surface-variant, sm)
   - CTA button: "GET STARTED ->" -- pill-shaped, bg-gradient from primary to primary-container, on-primary text, font-black uppercase tracking-[0.2em], px-12 py-5, shadow glow (0 8px 32px rgba(201,137,77,0.3)), arrow icon animates right on hover

7. BOTTOM NAV (same as dashboard, but with Home tab active)

INTERACTIONS:
- Scroll-based step progression (step indicator updates as user scrolls)
- Module cards toggle on tap with spring animation
- Privacy consent must be accepted before proceeding
- "Get Started" saves selections and navigates to dashboard
- Haptic feedback on button presses

DESIGN RULES:
- Same no-border, tonal layering rules as dashboard
- Glass effects: rgba(31,31,37,0.4) with 20px backdrop-blur for obsidian-glass
- Optional: subtle grain overlay (SVG noise filter at 3% opacity, mix-blend-overlay) for texture
```
