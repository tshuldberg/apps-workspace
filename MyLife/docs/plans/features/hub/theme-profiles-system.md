# Theme Profiles System

## Overview

User-selectable appearance profiles for MyLife. Ships 8 built-in presets (from design exploration), plus a customization layer where users can create their own themes. Includes an AI-assisted guide for non-technical users.

## Architecture

```
packages/ui/src/
├── tokens/              # existing (becomes "Cool Obsidian" preset values)
├── themes/
│   ├── schema.ts        # ThemeProfile type (the full schema)
│   ├── presets/
│   │   ├── cool-obsidian.ts   # current default (source of truth copy)
│   │   ├── arctic-light.ts
│   │   ├── warm-analog.ts
│   │   ├── neon-terminal.ts
│   │   ├── soft-gradient.ts
│   │   ├── minimal-ink.ts
│   │   ├── candy-glass.ts
│   │   ├── earth-clay.ts
│   │   └── neumorphic-slate.ts
│   ├── index.ts         # exports THEME_PRESETS map + schema
│   └── utils.ts         # mergeTheme, validateTheme, themeToCSS
├── context/
│   └── ThemeProvider.tsx # React context that resolves active theme
```

```
packages/db/src/
└── hub-schema.ts        # hub_theme_profiles table + hub_settings.active_theme_id

apps/mobile/app/(hub)/
├── settings/
│   └── appearance.tsx   # Theme picker screen
│   └── theme-editor.tsx # Custom theme editor

apps/web/app/settings/
├── appearance/
│   └── page.tsx         # Theme picker (web)
│   └── editor/page.tsx  # Custom theme editor (web)
```

## Layer 1: Theme Schema (`packages/ui/src/themes/schema.ts`)

The schema defines every customizable axis. All tokens in the existing system become fields in this type.

```typescript
import { z } from 'zod';

// ─── Color Tokens ────────────────────────────────────────────────────────────
const ColorValue = z.string(); // hex, rgba, or CSS color

const BaseColorsSchema = z.object({
  background: ColorValue,
  surface: ColorValue,
  surfaceElevated: ColorValue,
  text: ColorValue,
  textSecondary: ColorValue,
  textTertiary: ColorValue,
  border: ColorValue,
  danger: ColorValue,
  success: ColorValue,
  warning: ColorValue,
  accent: ColorValue,         // hub-level accent
  primary: ColorValue,        // primary action color
  primaryContainer: ColorValue,
});

const GlassSchema = z.object({
  cardFill: ColorValue,
  cardBorder: ColorValue,
  strongFill: ColorValue,
  strongBorder: ColorValue,
  dockFill: ColorValue,
  dockBorder: ColorValue,
  blurIntensity: z.number().min(0).max(100), // expo-blur intensity
});

// ─── Typography ──────────────────────────────────────────────────────────────
const FontFamilySchema = z.object({
  display: z.string(),       // headings, wordmark
  body: z.string(),          // body text
  mono: z.string().optional(), // code/stats (if applicable)
});

const TypeScaleSchema = z.object({
  heroTitle: z.object({ size: z.number(), weight: z.string(), lineHeight: z.number() }),
  heading: z.object({ size: z.number(), weight: z.string(), lineHeight: z.number() }),
  subheading: z.object({ size: z.number(), weight: z.string(), lineHeight: z.number() }),
  body: z.object({ size: z.number(), weight: z.string(), lineHeight: z.number() }),
  caption: z.object({ size: z.number(), weight: z.string(), lineHeight: z.number() }),
  label: z.object({ size: z.number(), weight: z.string(), lineHeight: z.number(), letterSpacing: z.number() }),
});

// ─── Surfaces & Shape ────────────────────────────────────────────────────────
const SurfaceSchema = z.object({
  treatment: z.enum(['glass', 'solid', 'gradient', 'neumorphic', 'flat']),
  cornerRadius: z.object({
    card: z.number(),
    button: z.number(),
    icon: z.number(),
    tabBar: z.number(),
  }),
  shadows: z.object({
    card: z.string(),       // CSS/RN shadow string or 'none'
    elevated: z.string(),
    pressed: z.string().optional(), // for neumorphic
  }),
});

// ─── Layout ──────────────────────────────────────────────────────────────────
const LayoutSchema = z.object({
  dashboardStyle: z.enum(['bento-grid', 'list', 'cards-horizontal']),
  moduleGridColumns: z.number().min(3).max(5),
  tabBarStyle: z.enum(['floating-pill', 'bottom-attached', 'minimal-dots']),
  headerStyle: z.enum(['wordmark', 'logo', 'minimal']),
  spacing: z.object({
    xs: z.number(),
    sm: z.number(),
    md: z.number(),
    lg: z.number(),
    xl: z.number(),
  }),
});

// ─── Full Theme Profile ──────────────────────────────────────────────────────
export const ThemeProfileSchema = z.object({
  id: z.string(),             // unique slug: 'cool-obsidian', 'arctic-light', 'user-custom-1'
  name: z.string(),           // display name: 'Cool Obsidian'
  description: z.string(),    // one-liner
  author: z.string(),         // 'MyLife' for presets, user name for custom
  version: z.number(),        // schema version for migrations
  colorMode: z.enum(['dark', 'light']),

  colors: BaseColorsSchema,
  glass: GlassSchema,
  fonts: FontFamilySchema,
  typeScale: TypeScaleSchema,
  surfaces: SurfaceSchema,
  layout: LayoutSchema,

  // Module accent colors stay constant across themes (brand identity per module)
  // Only the BASE theme changes. Module accents are NOT part of the profile.
});

export type ThemeProfile = z.infer<typeof ThemeProfileSchema>;
```

## Layer 2: Built-in Presets

Each preset file exports a `ThemeProfile` object. Example skeleton for Arctic Light:

```typescript
// packages/ui/src/themes/presets/arctic-light.ts
import type { ThemeProfile } from '../schema';

export const ARCTIC_LIGHT: ThemeProfile = {
  id: 'arctic-light',
  name: 'Arctic Light',
  description: 'Clean white, hairline borders, Apple Health energy',
  author: 'MyLife',
  version: 1,
  colorMode: 'light',
  colors: {
    background: '#FAFBFD',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: 'rgba(0,0,0,0.04)',
    danger: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    accent: '#007AFF',
    primary: '#007AFF',
    primaryContainer: '#0056B3',
  },
  glass: {
    cardFill: 'rgba(255,255,255,0.92)',
    cardBorder: 'rgba(0,0,0,0.04)',
    strongFill: 'rgba(255,255,255,0.95)',
    strongBorder: 'rgba(0,0,0,0.06)',
    dockFill: 'rgba(250,251,253,0.92)',
    dockBorder: 'rgba(0,0,0,0.08)',
    blurIntensity: 80,
  },
  fonts: {
    display: 'Inter',
    body: 'Inter',
  },
  typeScale: { /* ... standard sizes ... */ },
  surfaces: {
    treatment: 'solid',
    cornerRadius: { card: 16, button: 10, icon: 14, tabBar: 0 },
    shadows: {
      card: '0 1px 3px rgba(0,0,0,0.04)',
      elevated: '0 4px 12px rgba(0,0,0,0.08)',
    },
  },
  layout: {
    dashboardStyle: 'bento-grid',
    moduleGridColumns: 4,
    tabBarStyle: 'bottom-attached',
    headerStyle: 'wordmark',
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
};
```

## Layer 3: ThemeProvider

```typescript
// packages/ui/src/context/ThemeProvider.tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ThemeProfile } from '../themes/schema';
import { COOL_OBSIDIAN } from '../themes/presets/cool-obsidian';

const ThemeContext = createContext<ThemeProfile>(COOL_OBSIDIAN);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeProfile;
  children: ReactNode;
}) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeProfile {
  return useContext(ThemeContext);
}

// Convenience hooks for common access patterns
export function useThemeColors() { return useTheme().colors; }
export function useThemeFonts() { return useTheme().fonts; }
export function useThemeLayout() { return useTheme().layout; }
```

## Layer 4: Database Storage

```sql
-- hub_theme_profiles table (stores custom user themes)
CREATE TABLE IF NOT EXISTS hub_theme_profiles (
  id TEXT PRIMARY KEY,           -- 'user-custom-1', 'imported-xyz'
  name TEXT NOT NULL,
  json TEXT NOT NULL,            -- full ThemeProfile JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT DEFAULT 'user'     -- 'user' | 'imported' | 'ai-generated'
);

-- Active theme stored in hub_settings
-- key: 'active_theme_id', value: 'cool-obsidian' | 'arctic-light' | 'user-custom-1'
```

## Layer 5: Settings UI (Appearance Screen)

### Mobile: `apps/mobile/app/(hub)/settings/appearance.tsx`

**Screen structure:**
1. **Active Theme Preview** - Live mini-preview of current theme at top
2. **Built-in Themes** - Horizontal scroll of 8 preset cards with live previews
3. **My Themes** - Grid of user-created custom themes
4. **Create New** - Button to open theme editor
5. **Import Theme** - Paste JSON or scan QR code

**Interaction:**
- Tap preset = instant switch (writes to hub_settings, ThemeProvider re-renders)
- Long-press preset = full-screen preview before applying
- Tap custom theme = same as preset
- Swipe-to-delete on custom themes

### Web: `apps/web/app/settings/appearance/page.tsx`

Same structure but with side-by-side comparison (pick two themes to compare).

## Layer 6: Theme Editor (Custom Themes)

### Mobile: `apps/mobile/app/(hub)/settings/theme-editor.tsx`

**Not a raw JSON editor.** Visual controls organized by section:

1. **Base** - Light/dark toggle, background color picker, surface color
2. **Colors** - Primary accent, text colors, danger/success/warning
3. **Typography** - Font family picker (from bundled options), size scale slider
4. **Surfaces** - Treatment picker (glass/solid/gradient/neumorphic/flat), corner radius slider, shadow intensity
5. **Layout** - Dashboard style (bento/list/cards), grid columns, tab bar style

**Key UX decisions:**
- Start from a preset (fork, don't start blank)
- Live preview updates as you change values
- "Reset section" button on each section
- "Save as" to create a named theme
- Export as JSON (share with others or back up)

### Remix Mode

For users who like parts of different themes:
- "Use colors from [Theme A]"
- "Use fonts from [Theme B]"
- "Use layout from [Theme C]"

This just deep-merges the relevant section from each source preset.

## Layer 7: AI-Assisted Theme Creation (The Guide)

### In-App Flow (`apps/mobile/app/(hub)/settings/theme-ai-assist.tsx`)

Screen with a text input: "Describe your ideal theme in plain English"

Examples shown:
- "Dark blue like the ocean at night with orange accents"
- "Minimal black and white like a newspaper"
- "Pastel pink and purple, playful, rounded everything"
- "Like the GitHub dark theme but warmer"

**Flow:**
1. User types description
2. App sends to Claude API with the ThemeProfile schema as structured output
3. Claude returns a valid ThemeProfile JSON
4. App shows live preview
5. User can iterate ("make it darker", "bigger text", "less rounded")
6. User saves when happy

**API call structure:**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  messages: [{ role: 'user', content: userDescription }],
  system: `You are a mobile app theme designer. Generate a complete ThemeProfile JSON matching this Zod schema: ${schemaString}. The theme is for a personal life management app called MyLife. Return ONLY valid JSON, no explanation.`,
});
```

### Documentation Guide (for less technical users)

Create `docs/guides/custom-themes.md` and surface it from within the app settings.

```markdown
# Creating Custom MyLife Themes

## Quick Start (No Code Required)

1. Open MyLife > Settings > Appearance > Create New
2. Start from a preset you like (tap "Fork")
3. Adjust colors, fonts, and layout with the visual controls
4. Save with a name

## AI-Assisted (Describe What You Want)

1. Open MyLife > Settings > Appearance > AI Theme Creator
2. Type what you want in plain English:
   - "Warm and cozy, like a coffee shop"
   - "High contrast for accessibility"
   - "Match my iPhone wallpaper colors: navy and gold"
3. Preview and iterate until you like it
4. Save

## Advanced: Edit Theme JSON Directly

Every theme is a JSON file with this structure:
- `colors` - background, text, accent colors
- `fonts` - which font families to use
- `surfaces` - glass effects, shadows, corner roundness
- `layout` - grid vs list, tab bar style, spacing

### Using AI Tools Outside the App

You can ask any AI assistant (Claude, ChatGPT, etc.) to generate a theme:

"Generate a MyLife theme JSON. The schema requires:
- colorMode: 'dark' or 'light'
- colors: background, surface, surfaceElevated, text, textSecondary, 
  textTertiary, border, danger, success, warning, accent, primary, 
  primaryContainer
- fonts: display (headings), body (text)
- surfaces.treatment: 'glass' | 'solid' | 'gradient' | 'neumorphic' | 'flat'
- surfaces.cornerRadius: card, button, icon, tabBar (numbers in px)
- layout.dashboardStyle: 'bento-grid' | 'list' | 'cards-horizontal'
- layout.tabBarStyle: 'floating-pill' | 'bottom-attached' | 'minimal-dots'

I want: [describe your theme here]"

Then paste the JSON into MyLife > Settings > Appearance > Import Theme.

### Sharing Themes

- Export: Settings > Appearance > [Your Theme] > Share (copies JSON)
- Import: Settings > Appearance > Import > Paste JSON
- Community: (future) Browse themes shared by other users

### Tips for Good Themes

- Ensure text/background contrast ratio is at least 4.5:1
- Test both stat numbers AND body text readability
- Module accent colors stay fixed (they're module brand colors)
- If using 'glass' treatment in light mode, ensure cards are visible
- Tab bar must remain usable (sufficient contrast on active/inactive)
```

## Migration Strategy

### Phase 1: Schema + Provider (no UI yet)
1. Create `packages/ui/src/themes/schema.ts` with Zod schema
2. Create `packages/ui/src/themes/presets/cool-obsidian.ts` (copies current values)
3. Create `ThemeProvider` context
4. Wire ThemeProvider at root layout (both mobile and web)
5. Migrate key components to `useTheme()` instead of importing `colors` directly
   - Start with: hub dashboard, tab bar, header, settings
   - Gradually: module screens (they already use module accents correctly)

### Phase 2: All 8 Presets + Persistence
1. Create all 8 preset files
2. Add `hub_theme_profiles` table + migration
3. Add `active_theme_id` to hub_settings
4. Load active theme on app boot, default to 'cool-obsidian'

### Phase 3: Settings UI
1. Build appearance screen (mobile)
2. Build appearance page (web)
3. Theme switching with instant live preview
4. "Restart to apply" NOT needed (context re-render handles it)

### Phase 4: Custom Theme Editor
1. Visual editor with section-based controls
2. Fork from preset workflow
3. Save/delete/rename custom themes
4. Export/import JSON

### Phase 5: AI Assist + Guide
1. AI theme generator screen (Claude API integration)
2. In-app documentation viewer
3. JSON import validator (with friendly error messages)

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Module accents in theme? | No | Module colors are brand identity, not theme |
| Theme hot-swap? | Yes | Context re-render, no restart needed |
| Font bundling? | Ship 5 families, others downloadable | Keeps app size reasonable |
| Custom theme storage | SQLite (hub_theme_profiles) | Offline-first, same as all other data |
| AI model for generation | claude-sonnet-4-6 | Fast, cheap, good at structured output |
| Schema validation | Zod (runtime) | Already in stack, gives friendly errors |
| Fallback on invalid theme | Cool Obsidian | Always have a known-good state |

## Bundled Font Families (5 shipped, covers all presets)

| Font | Used by | Category |
|------|---------|----------|
| Inter | Cool Obsidian, Arctic Light | Sans (neutral) |
| Plus Jakarta Sans | Cool Obsidian (display) | Sans (geometric) |
| JetBrains Mono | Neon Terminal | Mono |
| DM Sans | Soft Gradient | Sans (rounded) |
| Outfit | Earth & Clay, Neumorphic | Sans (modern) |

Additional fonts available for download (user themes):
- Newsreader (serif, Warm Analog)
- Playfair Display (serif, Earth & Clay)
- Space Grotesk (sans, Minimal Ink)
- Nunito (sans, Candy Glass)
- Literata (serif, already bundled for Books module)

## Acceptance Criteria

- [ ] User can switch between 8 presets with instant visual update
- [ ] User can create a custom theme via visual editor
- [ ] User can fork any preset as starting point for customization
- [ ] User can export/import themes as JSON
- [ ] User can use AI text prompt to generate a theme
- [ ] Non-technical guide accessible from within settings
- [ ] Invalid theme JSON shows friendly validation errors
- [ ] App never crashes on malformed theme (fallback to default)
- [ ] Module accent colors remain unchanged across all themes
- [ ] Both mobile and web support theme switching
- [ ] Theme persists across app restarts
- [ ] StatusBar style auto-switches (light/dark) based on colorMode

## Reference

- Design comparison board: `~/.gstack/projects/MyLife/designs/mobile-themes-20260420/design-board.html`
- Current tokens: `packages/ui/src/tokens/`
- DESIGN.md: defines Cool Obsidian as current default
