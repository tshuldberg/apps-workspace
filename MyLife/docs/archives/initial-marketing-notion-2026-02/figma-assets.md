# MyLife Figma Assets - Market Sprint

**Generated:** 2026-02-27

## Figma File

**Landing Page Design (v1 - hero only):** [MyLife Landing Page - Market Sprint](https://www.figma.com/integrations/claim/CKNymShtsADv624NLDq5li)

**Landing Page Design (v2 - full page):** [MyLife Landing Page - Full](https://www.figma.com/integrations/claim/Y4gGFiyqpUAjif6GXGKqTp)

Captured from the MyLife landing page (`docs/2/27/landing-page/index.html`) using Figma MCP html-to-design capture. The v2 file contains the full scrollable landing page with all 8 sections: Hero, App Subscription Tax, One App Solution, Module Showcase (23 modules), Markets Ready for Disruption, Pricing Tiers ($2/$5/$20), Privacy Promise, and CTA/Footer.

---

## Design System Rules

### 1. Token Definitions

Design tokens are defined as CSS custom properties in the landing page and as TypeScript constants in `packages/ui/`:

```css
:root {
  /* Backgrounds */
  --bg-primary: #07070C;
  --bg-secondary: #0E0E18;
  --bg-card: #141422;
  --bg-card-hover: #1A1A2E;

  /* Text */
  --text-primary: #F4EDE2;
  --text-secondary: #9B95A0;
  --text-muted: #6B6572;

  /* Accents */
  --accent-teal: #14B8A6;
  --accent-teal-dim: rgba(20, 184, 166, 0.15);
  --accent-gold: #C9894D;
  --accent-gold-dim: rgba(201, 137, 77, 0.12);
  --accent-red: #EF4444;
  --accent-green: #22C55E;

  /* Gradient */
  --gradient-start: #14B8A6;
  --gradient-end: #7C3AED;

  /* Typography */
  --font-stack: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  /* Spacing & Radii */
  --radius: 16px;
  --radius-sm: 10px;
  --section-padding: clamp(80px, 12vh, 140px);
}
```

### 2. Component Library

| Location | Purpose |
|----------|---------|
| `packages/ui/` | `@mylife/ui` -- unified dark theme tokens and shared components |
| `apps/web/components/` | Next.js web-specific components (Sidebar, ModuleCard, Providers) |
| `apps/mobile/components/` | Expo mobile-specific components (ModuleCard, BackToHubButton) |

Architecture: React functional components with TypeScript. No Storybook currently.

### 3. Frameworks & Libraries

| Layer | Technology |
|-------|-----------|
| **Web** | Next.js 15 (App Router) |
| **Mobile** | Expo (React Native) |
| **Styling** | CSS custom properties (web), React Native StyleSheet (mobile) |
| **Validation** | Zod 3.24 |
| **Monorepo** | Turborepo + pnpm |
| **Testing** | Vitest |

### 4. Asset Management

- Static assets served from `public/` in each app directory
- No CDN configured yet (pre-launch)
- Images use Next.js `<Image>` component for web optimization
- Expo assets managed via `expo-asset`

### 5. Icon System

- Module icons use emoji characters (e.g., books, budget, surf)
- UI icons via system defaults per platform
- No custom icon library currently

### 6. Styling Approach

**Web (Next.js):**
- CSS custom properties for design tokens
- Tailwind CSS available but tokens preferred for brand consistency
- Responsive: `clamp()` for fluid typography, CSS Grid/Flexbox for layout
- Dark theme only (no light mode)

**Mobile (Expo):**
- React Native `StyleSheet.create()` with token constants from `@mylife/ui`
- Dark theme only

**Landing Page Patterns:**
- Fluid typography via `clamp(min, preferred, max)`
- Card-based layouts with `border-radius: var(--radius)` (16px)
- Glassmorphism effects: `backdrop-filter: blur()` with semi-transparent backgrounds
- Gradient borders via `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))`
- Subtle hover animations with `transform: translateY(-4px)` and glow effects

### 7. Project Structure

```
MyLife/
  apps/web/          # Next.js 15 (App Router)
  apps/mobile/       # Expo (React Native)
  modules/           # Per-module business logic (@mylife/<name>)
  packages/ui/       # Shared design tokens and components
  packages/db/       # SQLite adapter
  packages/module-registry/  # Module lifecycle
```

---

## MyLife Brand Tokens Reference

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| Background Primary | `#07070C` | Page background |
| Background Secondary | `#0E0E18` | Section backgrounds, navbars |
| Background Card | `#141422` | Card surfaces |
| Card Hover | `#1A1A2E` | Card hover state |
| Text Primary | `#F4EDE2` | Headings, body text |
| Text Secondary | `#9B95A0` | Descriptions, subtitles |
| Text Muted | `#6B6572` | Metadata, footnotes |
| Accent Teal | `#14B8A6` | Primary CTA, links, active states |
| Accent Gold | `#C9894D` | Premium/Pro badges, highlights |
| Accent Red | `#EF4444` | Destructive actions, warnings |
| Accent Green | `#22C55E` | Success, positive indicators |

### Gradients

| Name | Value |
|------|-------|
| Primary Gradient | `linear-gradient(135deg, #14B8A6, #7C3AED)` |
| Teal Glow (dim) | `rgba(20, 184, 166, 0.15)` |
| Gold Glow (dim) | `rgba(201, 137, 77, 0.12)` |

### Typography

| Property | Value |
|----------|-------|
| Font Family | `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif` |
| Heading Weight | 700 |
| Heading Line-Height | 1.15 |
| Heading Letter-Spacing | -0.02em |
| H1 Size | `clamp(2.8rem, 6vw, 5.5rem)` |
| H2 Size | `clamp(2rem, 4vw, 3.5rem)` |
| H3 Size | `clamp(1.2rem, 2vw, 1.5rem)` |
| Body Size | `clamp(1rem, 1.2vw, 1.2rem)` |
| Body Line-Height | 1.6 |

### Spacing & Radii

| Token | Value |
|-------|-------|
| Border Radius (default) | 16px |
| Border Radius (small) | 10px |
| Section Padding | `clamp(80px, 12vh, 140px)` |

### Effects

| Effect | CSS |
|--------|-----|
| Card shadow | `0 4px 24px rgba(0,0,0,0.3)` |
| Glow (teal) | `0 0 40px rgba(20,184,166,0.3)` |
| Glassmorphism | `backdrop-filter: blur(20px)` + `rgba` background |
| Hover lift | `transform: translateY(-4px)` |

---

## Figma-to-Code Workflow

When using Figma MCP tools (`get_design_context`) to convert designs back to code:

1. **Extract design context** with `nodeId` and `fileKey` from the Figma file
2. **Map Figma tokens to CSS variables** -- use the `var(--*)` tokens above, not raw hex values
3. **Use existing components** from `packages/ui/` and `apps/web/components/` where possible
4. **Follow the stack**: React + TypeScript for web, Expo + TypeScript for mobile
5. **Preserve dark-only theme** -- no light mode variants needed
6. **Match the landing page's fluid typography** pattern using `clamp()` for responsive text
