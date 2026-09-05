# Hub Theme Profiles -- UI/UX Implementation Prompt

**Feature:** User-selectable appearance themes + custom theme creation
**Routes:** `apps/mobile/app/(hub)/appearance.tsx`, `theme-editor.tsx`, `theme-ai.tsx`
**Design System:** Adapts to active theme (default: Cool Obsidian)
**Platform:** React Native (Expo) + Next.js 15 (Web)
**Reference:** `docs/plans/features/hub/theme-profiles-system.md`
**Design Board:** `~/.gstack/projects/MyLife/designs/mobile-themes-20260420/design-board.html`

---

## Codebase Connections

| What | Where |
|------|-------|
| Current tokens | `packages/ui/src/tokens/` (colors, typography, glass, spacing, shadows) |
| Token barrel | `packages/ui/src/tokens/index.ts` |
| Hub settings screen | `apps/mobile/app/(hub)/settings.tsx` |
| Hub layout | `apps/mobile/app/(hub)/_layout.tsx` |
| Root layout | `apps/mobile/app/_layout.tsx` |
| DB package | `packages/db/` |
| UI package | `packages/ui/` |
| Module registry | `packages/module-registry/` (module accent colors stay fixed) |

---

## Screens Overview (7 screens total)

| # | Screen | Route | Purpose |
|---|--------|-------|---------|
| 1 | Appearance Settings | `(hub)/appearance` | Theme browser + active preview |
| 2 | Theme Preview | `(hub)/appearance/preview` | Full-screen live preview before applying |
| 3 | Theme Editor | `(hub)/theme-editor` | Visual editor for custom themes |
| 4 | AI Theme Creator | `(hub)/theme-ai` | Natural language theme generation |
| 5 | Import Theme | `(hub)/appearance/import` | Paste JSON or QR scan |
| 6 | Theme Guide | `(hub)/appearance/guide` | Documentation for non-technical users |
| 7 | Theme Share | `(hub)/appearance/share` | Export/share a custom theme |

---

## Screen 1: Appearance Settings

**Route:** `apps/mobile/app/(hub)/appearance.tsx`
**Entry point:** Settings > Appearance

### Layout (top to bottom)

**1. ACTIVE THEME PREVIEW (hero area)**
- Mini phone frame (180px tall) showing current theme applied to a dashboard mock
- Theme name below in heading style
- "Customize" pill button if it's a custom theme

**2. SECTION: Built-in Themes**
- Section header: "THEMES" (label style, uppercase)
- Horizontal scroll of theme cards (140px wide, 200px tall each)
- Each card shows:
  - Mini preview (dashboard mock in that theme's colors/layout)
  - Theme name below (caption, centered)
  - Checkmark overlay on active theme
  - Border glow on active theme (using that theme's primary color)
- Cards: Cool Obsidian, Arctic Light, Warm Analog, Neon Terminal, Soft Gradient, Minimal Ink, Candy Glass, Earth & Clay, Neumorphic Slate (9 total including current default)
- Tap = instant apply (with haptic feedback)
- Long press = open full-screen preview (Screen 2)

**3. SECTION: My Themes**
- Section header: "MY THEMES" + "New +" button (right-aligned)
- Grid (2 columns) of user-created themes
- Same card format as built-in but with:
  - "..." menu (rename, duplicate, delete, share)
  - Edit icon overlay
- Empty state: "Create your first custom theme" with illustration
- "New +" button opens action sheet:
  - "Start from a preset" (goes to editor with preset forked)
  - "Describe with AI" (goes to AI Creator, Screen 4)
  - "Import JSON" (goes to Import, Screen 5)

**4. SECTION: Quick Settings**
- Toggle: "Match system appearance" (auto dark/light based on OS)
- Toggle: "Animate transitions" (cross-fade when switching themes)
- Link: "Theme creation guide" (goes to Screen 6)

### Interaction Details

- Theme switching: write `active_theme_id` to hub_settings, trigger ThemeProvider re-render
- No "restart required" indicator. Change is instant.
- StatusBar automatically flips light/dark based on `colorMode`
- If user has "Match system" on, the active theme is overridden by system preference. Show indicator: "Using [Light/Dark] variant per system setting"

---

## Screen 2: Theme Preview

**Route:** `apps/mobile/app/(hub)/appearance/preview.tsx`
**Entry:** Long-press a theme card on Screen 1

### Layout

Full-screen preview that renders the actual hub dashboard (or a representative mock) in the selected theme. NOT a static image. Uses ThemeProvider with the preview theme wrapping a simplified dashboard render.

**Header:**
- Back arrow (top-left)
- Theme name (centered, heading)
- "Apply" button (top-right, primary color of the previewed theme)

**Body:**
- Full hub dashboard rendered in the selected theme
- Includes: greeting, quick actions row, bento cards, module grid, tab bar
- Scrollable to see all sections

**Footer:**
- Sticky bottom: "Apply [Theme Name]" full-width button
- Secondary: "Customize first" text link (forks to editor)

### States
- Loading: skeleton shimmer in the preview theme's colors
- Applied: brief confetti/pulse animation, auto-navigate back

---

## Screen 3: Theme Editor

**Route:** `apps/mobile/app/(hub)/theme-editor.tsx`
**Entry:** "New +" > "Start from a preset", or tap edit on custom theme

### Layout

**Header:**
- Back arrow
- "Edit Theme" title
- "Save" button (disabled until changes made)

**Live Preview Strip (sticky top, 100px tall)**
- Miniature dashboard preview that updates in real-time as user changes values
- Tap to expand to full-screen preview

**Section Tabs (horizontal pill selector)**
- Colors | Typography | Surfaces | Layout

**TAB: Colors**
- Color mode toggle: Light / Dark
- Color swatches in groups:
  - Background & Surface (3 chips: bg, surface, surfaceElevated)
  - Text (3 chips: primary, secondary, tertiary)
  - Accent (1 large chip: primary color)
  - Semantic (3 chips: danger, success, warning)
- Tap any chip = open color picker (HSL wheel + hex input)
- "Reset to preset" button at bottom of section

**TAB: Typography**
- Font family picker (scrollable list with preview of each):
  - Bundled: Inter, Plus Jakarta Sans, JetBrains Mono, DM Sans, Outfit
  - Downloadable: Newsreader, Playfair Display, Space Grotesk, Nunito
  - Downloadable fonts show download icon + size (e.g., "1.2 MB")
- Size scale slider (compact / default / large / extra large)
- Weight preference: Light / Regular / Bold display headers

**TAB: Surfaces**
- Treatment picker (5 options, visual preview of each):
  - Glass (blur + transparency)
  - Solid (opaque fills)
  - Gradient (color shift fills)
  - Neumorphic (soft 3D shadows)
  - Flat (no shadows, borders only)
- Corner radius slider: 0 (sharp) to 28 (pill)
  - Live preview on a sample card
- Shadow intensity slider: None / Subtle / Medium / Strong

**TAB: Layout**
- Dashboard style picker (3 options, mini mockups):
  - Bento Grid (current default)
  - Flat List (like Minimal Ink)
  - Horizontal Cards (swipeable)
- Grid columns: 3 / 4 / 5 (slider)
- Tab bar style picker (3 options):
  - Floating Pill (current default)
  - Bottom Attached (traditional iOS)
  - Minimal Dots (icons only, no labels)
- Spacing: Compact / Default / Spacious

### Bottom Actions Bar
- "Save Theme" button (full-width, primary)
- "Save as copy" text link
- "Discard changes" text link (with confirmation dialog)

### Naming Flow
On first save, bottom sheet asks for theme name:
- Input: "Theme name" (pre-filled with "[Preset Name] Custom")
- "Save" button
- Character limit: 30

---

## Screen 4: AI Theme Creator

**Route:** `apps/mobile/app/(hub)/theme-ai.tsx`
**Entry:** "New +" > "Describe with AI"

### Layout

**Header:** "AI Theme Creator" with sparkle icon

**1. INPUT AREA**
- Large text input (multiline, 3 rows visible)
- Placeholder: "Describe your ideal theme..."
- Examples button (shows slide-up with example prompts):
  - "Dark blue like the ocean at night with warm orange accents"
  - "Minimal black and white, bold typography, no rounded corners"
  - "Pastel pink and lavender, soft and calming, rounded everything"
  - "Like the Spotify dark theme but with green replaced by amber"
  - "High contrast for reading at night, easy on the eyes"
  - "Retro terminal look, green on black, monospace font"

**2. GENERATE BUTTON**
- "Generate Theme" (full-width, primary with sparkle icon)
- Loading state: pulsing animation with "Designing your theme..."

**3. RESULT AREA (appears after generation)**
- Full live preview (same as Screen 2 body)
- Below preview:
  - "Looks good, save it" button (primary)
  - "Make changes" text input (for iteration):
    - "Make it darker"
    - "Bigger text"
    - "More rounded"
    - "Different font"
  - "Start over" text link

**4. ITERATION HISTORY (collapsible)**
- Shows previous prompts + thumbnail of what they produced
- Tap to revert to that version

### API Integration
- Uses Claude Sonnet for structured output generation
- System prompt includes ThemeProfile schema
- Each iteration sends full conversation history for context
- Validates returned JSON against Zod schema before rendering
- On validation failure: "I couldn't generate a valid theme from that. Try being more specific about colors or style."

### Offline State
- "AI theme creation requires an internet connection"
- Falls back to manual editor link

---

## Screen 5: Import Theme

**Route:** `apps/mobile/app/(hub)/appearance/import.tsx`
**Entry:** "New +" > "Import JSON"

### Layout

**Header:** "Import Theme"

**1. INPUT METHOD TABS**
- Paste JSON | Scan QR

**TAB: Paste JSON**
- Large monospace text area (full width, 60% height)
- Placeholder shows example structure (abbreviated)
- "Validate & Preview" button
- On valid: shows live preview + "Import" button
- On invalid: red error banner with specific Zod validation errors in plain English:
  - "Missing required field: colors.background"
  - "Invalid value for layout.dashboardStyle: got 'grid', expected 'bento-grid', 'list', or 'cards-horizontal'"

**TAB: Scan QR**
- Camera view (full frame)
- QR encodes compressed theme JSON (base64 + zlib)
- On scan: same validate + preview flow

### Naming
After validation, asks for a name (pre-filled from theme JSON `name` field if present)

---

## Screen 6: Theme Guide

**Route:** `apps/mobile/app/(hub)/appearance/guide.tsx`
**Entry:** Settings > Appearance > "Theme creation guide"

### Layout

Scrollable documentation page with these sections:

**1. "Quick Start" (collapsed by default = open)**
- 3-step visual guide:
  1. Pick a preset you like
  2. Tap "..." > "Customize"
  3. Adjust colors, fonts, layout
- Animated illustration for each step

**2. "Use AI to Design" (collapsed)**
- Explains the AI creator flow
- Shows example prompts that work well
- Tips: "Be specific about colors and moods. Reference apps you like."

**3. "Advanced: Edit JSON" (collapsed)**
- Full schema reference (simplified for non-technical users)
- Each field explained in plain English:
  - `colors.background` = "The main app background color"
  - `surfaces.treatment` = "How cards look: glass (see-through), solid (opaque), gradient (color shifts), flat (no effects)"
- Copy-paste template button
- "Ask any AI assistant to generate this for you" with suggested prompt template

**4. "Share & Discover" (collapsed)**
- How to export your theme
- How to import from a friend
- QR code sharing explanation

**5. "Accessibility Tips" (collapsed)**
- Contrast ratio basics (4.5:1 minimum)
- "Test with large text" toggle
- "Dark mode is easier on eyes at night"
- Link to system accessibility settings

---

## Screen 7: Theme Share

**Route:** `apps/mobile/app/(hub)/appearance/share.tsx`
**Entry:** "..." menu on a custom theme > "Share"

### Layout

**Header:** "Share [Theme Name]"

**1. PREVIEW**
- Mini phone frame showing the theme

**2. SHARE OPTIONS**
- "Copy JSON" - copies full ThemeProfile JSON to clipboard
- "Show QR Code" - renders QR that others can scan
- "Share Link" (future) - generates a mylife:// deep link

**3. QR CODE VIEW (if tapped)**
- Large QR code centered
- Theme name below
- "Save to Photos" button (renders QR as image)

---

## 8 Built-in Theme Presets (Reference)

| ID | Name | Mode | Font Display | Font Body | Surface | Layout | Accent |
|----|------|------|-------------|-----------|---------|--------|--------|
| `cool-obsidian` | Cool Obsidian | dark | Plus Jakarta Sans | Inter | glass | bento-grid, floating-pill | #C9894D amber |
| `arctic-light` | Arctic Light | light | Inter | Inter | solid | bento-grid, bottom-attached | #007AFF blue |
| `warm-analog` | Warm Analog | light | Newsreader | Newsreader | solid | bento-grid, bottom-attached | #8B6D47 brown |
| `neon-terminal` | Neon Terminal | dark | JetBrains Mono | JetBrains Mono | flat | bento-grid, bottom-attached | #00FF88 green |
| `soft-gradient` | Soft Gradient | dark | DM Sans | DM Sans | gradient | bento-grid, floating-pill | #A78BFA violet |
| `minimal-ink` | Minimal Ink | light | Space Grotesk | Space Grotesk | flat | list, bottom-attached | #000000 black |
| `candy-glass` | Candy Glass | light | Nunito | Nunito | glass | bento-grid, floating-pill | #FF6B9D pink |
| `earth-clay` | Earth & Clay | dark | Playfair Display | Outfit | solid | bento-grid, bottom-attached | #DEC6A8 sand |
| `neumorphic-slate` | Neumorphic Slate | light | Outfit | Outfit | neumorphic | bento-grid, bottom-attached | #4A5060 slate |

---

## Theme Schema Axes (What Users Customize)

| Axis | Options | Default (Cool Obsidian) |
|------|---------|------------------------|
| Color mode | dark, light | dark |
| Background | any color | #131318 |
| Surface fills | any color | #131318, #2A292F |
| Text colors | primary, secondary, tertiary | #E4E1E9, #D6C3B5, 35% opacity |
| Accent color | any color | #C9894D |
| Display font | Inter, Plus Jakarta, JetBrains Mono, DM Sans, Outfit, Newsreader, Playfair, Space Grotesk, Nunito | Plus Jakarta Sans |
| Body font | same options | Inter |
| Surface treatment | glass, solid, gradient, neumorphic, flat | glass |
| Corner radius | 0-28px | 16px cards, 24px tab bar |
| Shadow style | none, subtle, medium, strong | subtle |
| Dashboard layout | bento-grid, list, cards-horizontal | bento-grid |
| Grid columns | 3, 4, 5 | 4 |
| Tab bar style | floating-pill, bottom-attached, minimal-dots | floating-pill |
| Spacing density | compact, default, spacious | default |

**Fixed across all themes (NOT customizable):**
- Module accent colors (Books = amber, Budget = green, etc.)
- Module icons
- Navigation structure
- Content/data

---

## Animation & Transitions

| Trigger | Animation |
|---------|-----------|
| Switch theme | 300ms cross-fade on all surfaces, colors interpolated |
| Open editor | slide-from-right (standard stack push) |
| Color picker open | bottom sheet slide-up |
| AI generation | pulsing skeleton in target theme's estimated colors |
| Theme applied | 150ms scale pulse (1.0 > 1.02 > 1.0) + haptic |
| Preview expand | shared element transition from mini-frame to full-screen |

---

## Data Model

```sql
-- Store custom themes
CREATE TABLE IF NOT EXISTS hub_theme_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  json TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Active theme in hub_settings
-- key = 'active_theme_id', value = theme id string
-- key = 'theme_match_system', value = '0' or '1'
-- key = 'theme_animate_transitions', value = '0' or '1'
```

---

## Accessibility

- All text/background combinations must meet WCAG 2.1 AA (4.5:1 contrast)
- Theme editor shows real-time contrast ratio next to color pickers
- Warning badge on themes that fail contrast check
- "High Contrast" toggle that ensures minimum 7:1 ratio (AAA)
- Screen reader: "Current theme: Cool Obsidian. Double tap to change."
- Reduce Motion: skip cross-fade animations, instant switch

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Malformed theme JSON | Fallback to Cool Obsidian + error toast |
| Missing font family | Fall back to Inter |
| Invalid color value | Use nearest valid color or default |
| AI generation fails | Show error + retry button + link to manual editor |
| Database write fails | Keep in-memory, retry on next app open |
| Theme deleted while active | Revert to Cool Obsidian |

---

## Implementation Phases

| Phase | Screens | Estimated Effort |
|-------|---------|-----------------|
| P0: Schema + Provider | (infrastructure only) | 2-3 hours |
| P1: Presets + Switching | Screen 1, 2 | 3-4 hours |
| P2: Custom Editor | Screen 3 | 4-5 hours |
| P3: AI Creator | Screen 4 | 2-3 hours |
| P4: Import/Export/Guide | Screens 5, 6, 7 | 2-3 hours |

---

## Non-Technical User Guide (In-App Content)

### "How to Make MyLife Look Exactly How You Want"

**Option 1: Pick a preset (10 seconds)**
Swipe through 9 built-in themes. Tap one. Done.

**Option 2: Tweak a preset (2 minutes)**
Long-press any theme > "Customize." Slide the controls. Save.

**Option 3: Describe it in words (30 seconds)**
Open AI Theme Creator. Type what you want. "Dark with teal accents, rounded corners, clean font." Hit generate.

**Option 4: Use AI outside the app (for power users)**
Ask Claude, ChatGPT, or any AI: "Generate a MyLife theme JSON with [your description]. Use this schema: [paste schema]." Then import the JSON.

**Option 5: Get a theme from someone else**
Ask them to share (QR code or JSON). Open Import. Scan or paste. Done.
