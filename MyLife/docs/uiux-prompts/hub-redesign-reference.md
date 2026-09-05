# Hub Redesign -- Codebase Reference

**Purpose:** Maps the Stitch "Obsidian Noir" visual designs to the existing MyLife codebase. Developers should read this before implementing any hub-redesign prompt.

---

## Token Mapping: Stitch Obsidian Noir -> Cool Obsidian

The Stitch designs use a slightly warmer, higher-contrast palette. Developers should decide whether to adopt the Stitch values or keep the existing Cool Obsidian tokens. Both are listed here for reference.

| Role | Stitch (Obsidian Noir) | Current (Cool Obsidian) | Token Path |
|------|----------------------|------------------------|------------|
| Background | `#131318` | `#0A0A0F` | `colors.background` |
| Surface | `#131318` | `#12121A` | `colors.surface` |
| Surface Low | `#1b1b20` | -- | (new tier) |
| Surface Container | `#1f1f25` | -- | (new tier) |
| Surface High | `#2a292f` | `#1A1A24` | `colors.surfaceElevated` |
| Surface Highest | `#35343a` | -- | (new tier) |
| Surface Lowest | `#0e0e13` | -- | (new tier) |
| Primary Text | `#e4e1e9` | `#F0F0F5` | `colors.text` |
| Secondary Text | `#d6c3b5` | `rgba(240,240,245,0.65)` | `colors.textSecondary` |
| Primary Accent | `#ffb877` | (per-module) | `colors.moduleAccent.books` = `#C9894D` |
| Primary Container | `#c9894d` | -- | (new token) |
| Glass Fill | `rgba(255,255,255,0.03)` | `rgba(255,255,255,0.04)` | `glass.card.backgroundColor` |
| Glass Border | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.10)` | `colors.glassBorder` |
| Error | `#ffb4ab` | `#FF453A` | `colors.danger` |
| Success | -- | `#30D158` | `colors.success` |
| Tertiary/Info | `#8bcff0` | -- | (new token) |

### Key Differences

1. **Font**: Stitch uses Plus Jakarta Sans. Codebase uses Inter (with Literata for books). Keep Inter unless a font migration is planned.
2. **Icons**: Stitch uses Material Symbols Outlined. Codebase uses Lucide icons (via `lucide-react-native`). Keep Lucide unless an icon library migration is planned.
3. **Surface tiers**: Stitch has 5 surface tiers (lowest/low/container/high/highest). Current codebase has 3 (background/surface/surfaceElevated). Adoption of the 5-tier system would require updating `packages/ui/src/tokens/colors.ts`.
4. **Amber accent**: Stitch uses `#ffb877`/`#c9894d` as a universal hub accent. Current codebase uses per-module accent colors with no hub-level accent. The books accent `#C9894D` is closest.
5. **Bottom tabs**: Stitch has 5 tabs (Home, Discover, Search, Sync, Settings). Current codebase has 4 (Hub, Search, Discover, Settings). Adding a Sync tab requires updating `packages/module-registry/src/hub-icons.ts` (DOCK_ITEMS).

---

## Existing Files Being Redesigned

These files already exist and contain functional implementations. The redesign prompts describe the visual target; developers should refactor existing code rather than starting from scratch.

| Screen | Existing File | Size | Key Hooks/Imports |
|--------|--------------|------|-------------------|
| Dashboard | `apps/mobile/app/(hub)/index.tsx` | 21 KB | `useRouter`, `useEnabledModules`, `useDatabase`, `useOnboardingComplete`, `aggregateDashboardData` |
| Discover | `apps/mobile/app/(hub)/discover.tsx` | 9.2 KB | `useModuleToggle`, SectionList, 6 category groups |
| Settings | `apps/mobile/app/(hub)/settings.tsx` | 9.1 KB | Subscription status, mode selector |
| Search | `apps/mobile/app/(hub)/search.tsx` | 11 KB | `@mylife/search` package, full-text search |
| Backup & Restore | `apps/mobile/app/(hub)/backup.tsx` | 8.5 KB | Backup management |
| Data & Sync | `apps/mobile/app/(hub)/data-sync.tsx` | 13 KB | Cloud sync controls |
| Import Wizard | `apps/mobile/app/(hub)/import-wizard.tsx` | 17 KB | Import orchestration |
| Privacy Dashboard | `apps/mobile/app/(hub)/privacy.tsx` | 16 KB | Privacy controls |
| Sharing | `apps/mobile/app/(hub)/sharing.tsx` | 9.5 KB | Social sharing controls |
| Onboarding | `apps/mobile/app/(onboarding)/index.tsx` | 22 KB | `useOnboarding` FSM, 7 steps |

---

## Hub Layout & Navigation

**Hub layout:** `apps/mobile/app/(hub)/_layout.tsx` (1.7 KB)
- Registers 13 screens via Stack.Screen
- All screens share the same Stack navigator

**Root layout:** `apps/mobile/app/_layout.tsx` (8.3 KB)
- Provider chain: ModuleErrorBoundary -> RegistryProvider -> DatabaseProvider -> AuthProvider -> EntitlementsProvider -> Stack
- Registers 27 module definitions via `safeRegister()`
- Initial route: `(hub)`

**Bottom dock:** Defined in `packages/module-registry/src/hub-icons.ts`
- Current tabs: `hub`, `search`, `discover`, `settings`
- Icons: Lucide names (`layout-grid`, `search`, `compass`, `settings`)

---

## Shared Components to Reuse

| Component | Import | Usage |
|-----------|--------|-------|
| `Button` | `@mylife/ui` | Primary/secondary/ghost variants |
| `Card` | `@mylife/ui` | Standard + elevated variants |
| `Text` | `@mylife/ui` | Typography variants (heading, body, stat, label, etc.) |
| `SearchBar` | `@mylife/ui` | Surface bg, search icon, scan button |
| `TagPill` | `@mylife/ui` | Status badges, filter chips |
| `ModuleThemeProvider` | `@mylife/ui` | Per-module accent color context |
| `ModuleCard` | `apps/mobile/components/ModuleCard.tsx` | Grid card with lock overlay + PurchaseGate |
| `EntitlementsProvider` | `apps/mobile/components/EntitlementsProvider.tsx` | `useModuleUnlocked()`, `usePayment()` |
| `DatabaseProvider` | `apps/mobile/components/DatabaseProvider.tsx` | `useDatabase()` |
| `BackToHubButton` | `apps/mobile/components/BackToHubButton.tsx` | Navigation back to hub |

---

## Glass Morphism Implementation

**Mobile (React Native):**
```typescript
import { glassStyles } from '@mylife/ui';
// glassStyles.card = { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16 }
// glassStyles.dock = { backgroundColor: 'rgba(18,18,26,0.65)', borderRadius: 24 }
```
Use `expo-blur` `BlurView` for actual blur effects on mobile.

**Web (CSS):**
```css
backdrop-filter: blur(40px) saturate(180%);  /* card */
backdrop-filter: blur(80px) saturate(200%);  /* dock */
```

---

## Module Registry Constants

**Free modules:** fast, forums, journal, market, mood, notes, voice
**Module count:** 30 IDs defined, 28 wired on mobile, 19 on web
**Source of truth:** `packages/module-registry/src/constants.ts`
**Definition interface:** `packages/module-registry/src/types.ts`

---

## Key Hooks for Hub Screens

| Hook | Import | Purpose |
|------|--------|---------|
| `useEnabledModules()` | `@mylife/module-registry` | List of user-enabled modules |
| `useModuleToggle()` | `apps/mobile/hooks/use-module-toggle.ts` | Enable/disable module (runs migrations on enable) |
| `useOnboardingComplete()` | `apps/mobile/hooks/use-onboarding.ts` | Check if onboarding is done |
| `useOnboarding()` | `apps/mobile/hooks/use-onboarding.ts` | Full onboarding FSM (next, skip, back, setContentPrefs, setSelectedModules) |
| `useDatabase()` | `apps/mobile/components/DatabaseProvider.tsx` | Access hub SQLite database |
| `useEntitlements()` | `apps/mobile/components/EntitlementsProvider.tsx` | Purchase/subscription state |
| `useModuleUnlocked()` | `apps/mobile/components/EntitlementsProvider.tsx` | Check if specific module is unlocked |
| `useAutoBackup()` | `apps/mobile/hooks/use-auto-backup.ts` | Periodic backup logic |

---

## Tests

Existing test files in `apps/mobile/app/(hub)/__tests__/`:
- `dashboard.test.tsx`, `discover.test.tsx`, `settings.test.tsx`, `onboarding-mode.test.tsx`, `self-host.test.tsx`

After redesigning screens, update corresponding tests.
