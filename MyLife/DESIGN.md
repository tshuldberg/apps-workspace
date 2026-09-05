# DESIGN.md -- Cool Obsidian Design System

The design system for all MyLife apps and modules. Every UI decision references this document. When in doubt, this is the source of truth.

## Design Identity

**Name:** Cool Obsidian
**Aesthetic:** iOS glass morphism meets deep space. Dark, cool-toned, translucent surfaces that feel premium and private. The UI should feel like holding a piece of polished obsidian -- smooth, dark, subtly reflective.
**Personality:** Calm, confident, protective. Not corporate. Not playful. Trusted.

## Color System

### Base Palette
| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0A0A0F` | App background, deepest layer |
| `surface` | `#12121A` | Card/panel fill, content containers |
| `surfaceElevated` | `#1A1A24` | Modals, popovers, elevated content |
| `text` | `#F0F0F5` | Primary text, headings |
| `textSecondary` | `rgba(240,240,245,0.65)` | Supporting text, descriptions |
| `textTertiary` | `rgba(240,240,245,0.35)` | Placeholder text, disabled labels |
| `border` | `rgba(255,255,255,0.06)` | Subtle dividers, card borders |
| `danger` | `#FF453A` | iOS system red -- destructive actions, errors |
| `success` | `#30D158` | iOS system green -- confirmations, positive states |
| `warning` | `#FF9F0A` | iOS system orange -- warnings, caution states |
| `accent` | `#3B82F6` | Default accent (overridden by module accent) |

### Glass Morphism
| Token | Background | Border | Blur (web) | Usage |
|-------|-----------|--------|------------|-------|
| `glass.card` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.06)` | `blur(40px) saturate(180%)` | Standard cards |
| `glass.strong` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.10)` | `blur(60px) saturate(200%)` | Elevated cards, active states |
| `glass.dock` | `rgba(18,18,26,0.65)` | `rgba(255,255,255,0.08)` | `blur(80px) saturate(200%)` | Bottom nav, docks |

**Mobile:** Use `expo-blur` BlurView component
**Web:** Use CSS `backdrop-filter` from `glassWeb` tokens

### Module Accent Colors
Each module has a unique accent color used for: header highlights, active tab indicators, primary CTA buttons, and card border gradients.

| Module | Color | Module | Color |
|--------|-------|--------|-------|
| Books | `#C9894D` (warm amber) | Meds | `#06B6D4` (cyan) |
| Budget | `#22C55E` (green) | Mood | `#FB923C` (orange) |
| Car | `#6366F1` (indigo) | Notes | `#64748B` (slate) |
| Closet | `#E879A8` (pink) | Nutrition | `#F97316` (orange) |
| Cycle | `#F472B6` (pink) | Pets | `#F59E0B` (amber) |
| Fast | `#14B8A6` (teal) | Recipes | `#F97316` (orange) |
| Flash | `#FBBF24` (yellow) | RSVP | `#FB7185` (rose) |
| Garden | `#22C55E` (green) | Stars | `#8B5CF6` (purple) |
| Habits | `#8B5CF6` (purple) | Surf | `#3B82F6` (blue) |
| Health | `#10B981` (emerald) | Trails | `#65A30D` (lime) |
| Homes | `#D97706` (amber) | Voice | `#EF4444` (red) |
| Journal | `#A78BFA` (violet) | Words | `#0EA5E9` (sky) |
| Mail | `#3B82F6` (blue) | Workouts | `#EF4444` (red) |

Source of truth: `packages/ui/src/tokens/colors.ts`

## Typography

**Primary font:** Inter (all platforms)
**Domain font:** Literata (books module only -- literary serif)

| Variant | Size | Weight | Usage |
|---------|------|--------|-------|
| `heroTitle` | 36px | 800 | Dashboard greeting, module hero |
| `stat` | 36px | 700 | Large numbers (streak count, budget total) |
| `heading` | 24px | 700 | Section headings, screen titles |
| `subheading` | 18px | 600 | Card titles, sub-sections |
| `body` | 16px / 26px LH | 400 | Body text, descriptions |
| `caption` | 13px | 500 | Timestamps, metadata |
| `label` | 12px | 600, UPPERCASE, 0.8 LS | Category labels, badges |
| `iconCaption` | 12px | 600 | Icon labels in grids |

Source of truth: `packages/ui/src/tokens/typography.ts`

## Spacing & Layout

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps (icon-to-label, badge padding) |
| `sm` | 8px | Small gaps (list item padding, inline spacing) |
| `md` | 16px | Standard gaps (card padding, section spacing) |
| `lg` | 24px | Large gaps (between sections, modal padding) |
| `xl` | 32px | Extra large (screen padding, major sections) |
| `xxl` | 48px | Page-level spacing, hero sections |

| Border Radius | Value | Usage |
|---------------|-------|-------|
| `sm` | 4px | Small elements (badges, chips) |
| `md` | 8px | Buttons, inputs |
| `lg` | 12px | Small cards, tags |
| `xl` | 16px | Standard cards (glass cards use this) |
| `xxl` | 24px | Large cards, dock |
| `pill` | 999px | Pill buttons, avatars |

Source of truth: `packages/ui/src/tokens/spacing.ts`

## Component Patterns

### Cards (Glass)
- Background: `glass.card` token
- Border radius: `xl` (16px)
- Padding: `md` (16px)
- Module cards: add subtle gradient border using module accent color at 20% opacity

### Buttons
- **Primary:** Module accent color background, white text, `md` border radius
- **Secondary:** `glass.strong` background, `text` color, `md` border radius
- **Destructive:** `danger` background, white text
- **Ghost:** transparent background, `textSecondary` color
- Touch target minimum: 44px x 44px (iOS HIG)
- Active state: scale(0.97) + slight opacity reduction

### Navigation
- **Mobile bottom tab:** 4 tabs max. Icon + label. Active tab: module accent color. Glass dock background.
- **Web sidebar:** Fixed left. Collapsed on mobile (<768px). Module icons with accent color dots. Hover: glass.strong background.

### Empty States
Pattern for all empty states:
1. Module-specific icon or illustration (not generic)
2. Warm headline: "Your library is waiting" (not "No items found")
3. Supporting text: 1 sentence about what this module does
4. Primary CTA button: module accent color

### Error States
- Inline errors: `danger` color text below the affected element
- Full-screen errors: glass card with error message + retry button
- Network errors: "You're offline. Your data is safe -- it's all on your device."
- NEVER show technical error messages. "Something went wrong" + retry.

### Loading States
- Skeleton screens: glass card shapes pulsing at 60% opacity
- NOT spinners. Skeletons match the layout of the content they're replacing.
- Inline loading: subtle pulsing dot animation

## Motion & Animation

- **Micro-interactions:** 200ms ease-out. Button press scale, toggle slide, card appear.
- **Page transitions:** 300ms. Mobile: iOS-native push/pop. Web: fade + slight slide.
- **Card appearance:** Stagger children by 50ms for cascade effect on dashboard.
- **No bouncy animations.** Cool Obsidian is calm, not playful.
- **Reduce Motion:** Respect `prefers-reduced-motion`. Replace animations with instant state changes.

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | <768px | Single column, bottom tab nav, full-bleed cards |
| Tablet | 768-1024px | Sidebar collapsed by default, 2-column card grid |
| Desktop | >1024px | Sidebar expanded, 3-column card grid, wider content area |

## Accessibility

- **Color contrast:** All text meets WCAG 2.1 AA (4.5:1 minimum for body, 3:1 for large text)
- **Touch targets:** Minimum 44px x 44px on all interactive elements
- **Keyboard navigation:** All interactive elements focusable. Tab order matches visual order. Focus indicators: 2px accent color outline.
- **Screen readers:** ARIA landmarks on all pages. Alt text on all images. Module names announced with context.
- **Dark mode only:** The entire app is dark. No light mode toggle. This simplifies accessibility testing.

## Platform Design References

### Mobile (iOS / Android)
**Reference:** Native iOS with glass morphism. Apple Health, Apple Music, Apple Wallet.
- Bottom tab navigation with persistent Home tab
- Modules have their own tab bars that replace middle tabs when active
- Push/pop transitions between screens
- System haptics on key actions (toggle, delete, confirm)

### Web
**Reference:** Linear.app, Raycast, Arc browser aesthetic.
- Command palette (`Cmd+K`) as primary navigation and search
- Sidebar with module list (collapsible)
- Dense information layout -- no wasted space
- Keyboard-first with mouse as secondary input
- Dark, professional, fast-loading
- No hero sections, no marketing chrome inside the app

## Anti-Patterns (DO NOT DO)

- No light theme cards inside dark backgrounds (workouts audit lesson)
- No developer-facing text visible to users ("Requested route: /workouts")
- No generic "No items found" empty states
- No spinner-only loading states (use skeletons)
- No bouncy/playful animations (Cool Obsidian is calm)
- No "Sign up" as first screen (privacy-first = no required account)
- No placeholder buttons that do nothing (every button must work)
- No "Coming Soon" text on visible features
