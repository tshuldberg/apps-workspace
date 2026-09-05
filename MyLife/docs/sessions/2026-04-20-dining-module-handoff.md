# MyDining Module Handoff - Session 2026-04-20

## What Was Built (P0 through P5 Complete)

The MyDining consumer module (`modules/dining/`) has been built from scratch across 6 implementation phases. All code compiles clean, 143 tests pass across 13 test files, and mobile+web parity is maintained.

## Architecture

### Module Package: `modules/dining/`

**36 source files**, schema version 6 with 6 migrations:
- V1: `dn_settings`
- V2: `dn_restaurants`, `dn_tags`, `dn_restaurant_tags`
- V3: `dn_visits`, `dn_photos`, `dn_companions`
- V4: `dn_watchlist`
- V5: `dn_dishes`, `dn_wines`
- V6: `dn_reservations`, `dn_imports`

**CRUD files** (10): restaurants, tags, visits, photos, companions, watchlist, dishes, wines, reservations, imports

**Engine files** (4): url-parser (Resy/OpenTable/Tock/Yelp/Google Maps parsing), deeplink (booking URL builder), email-parser (confirmation email extraction), photo-pipeline (compression/EXIF strip)

**Test files** (13): restaurants (9), tags (7), visits (14), photos (4), companions (3), watchlist (10), dishes (11), wines (8), reservations (13), imports (6), url-parser (38), deeplink (9), email-parser (11) = **143 total tests**

### Mobile App: `apps/mobile/app/(dining)/`

**19 screen files** with 6 tabs + 13 hidden sub-routes:

Tabs: index (Restaurants), visits (Visits), reservations (Reservations), wishlist (Wishlist), map (Map), settings (Settings)

Sub-routes:
- `restaurant/[id].tsx`, `restaurant/add.tsx`, `restaurant/edit/[id].tsx`
- `visit/[id].tsx`, `visit/add.tsx`
- `dish/[id].tsx`, `dish/add.tsx`
- `wine/[id].tsx`, `wine/add.tsx`
- `reservation/[id].tsx`, `reservation/add.tsx`, `reservation/import.tsx`

### Web App: `apps/web/app/dining/`

**20 files** (1 actions.ts + 1 layout.tsx + 18 page files):

Pages: page.tsx (list), settings, map, visits, wishlist, reservations + restaurant/[id], restaurant/[id]/edit, restaurant/add + visit/[id], visit/add + dish/[id], dish/add + wine/[id], wine/add + reservation/[id], reservation/add, reservation/import

`actions.ts` contains ~45 server actions covering all CRUD operations.

### Registry Integration

- `packages/module-registry/src/types.ts`: 'dining' in ModuleId union (31 total)
- `packages/module-registry/src/constants.ts`: MODULE_METADATA entry
- `packages/module-registry/src/release-states.ts`: 'dining' in HIDDEN_MODULE_IDS
- `packages/billing-config/src/index.ts`: dining standalone module entry
- `packages/ui/src/tokens/colors.ts`: dining: '#DC2626'
- `apps/mobile/app/_layout.tsx`: DINING_MODULE registered
- `apps/web/components/Providers.tsx`: DINING_MODULE registered
- `apps/web/components/Sidebar.tsx`: dining route added
- `apps/web/lib/modules.ts`: 'dining' in WEB_SUPPORTED_MODULE_IDS
- `apps/web/lib/db.ts`: DINING_MODULE in module definitions
- `apps/web/lib/module-icons.ts`: UtensilsCrossed icon
- `apps/web/app/globals.css`: --accent-dining: #DC2626

## Completed Phases

| Phase | Scope | What Was Built |
|-------|-------|---------------|
| P0-A | Module scaffold + registry | ModuleDefinition, types, schema V1, registry wiring |
| P0-B | Restaurant CRUD + engines | V2 migration, restaurant/tag CRUD, URL parser, photo pipeline, seeds, 54 tests |
| P0-C | Mobile + web app routes | Layout, placeholder screens, sidebar, providers |
| P1-A | Test suite | 85 tests across 7 files |
| P1-B | Add restaurant flow | Mobile + web add forms with URL paste + auto-parse |
| P1-C | List/detail/map | Mobile + web list screens with search/filter/sort, detail pages, map placeholder |
| P2-A | Visits/photos/companions backend | V3 migration, visit/photo/companion CRUD, 21 tests |
| P2-B | Visit log UI | Mobile + web visit forms, visit detail, visits list with month grouping |
| P3-A | Dishes/wines backend | V5 migration, dish/wine CRUD, allergen engine, 19 tests |
| P3-B | Dish/wine UI | Mobile + web dish/wine forms, detail screens, allergen chips, "Order Again" |
| P4-A | Wishlist/watchlist | V4 migration, watchlist CRUD, full wishlist/watchlist screens on both platforms |
| P5-A | Reservations backend | V6 migration, reservation/import CRUD, deeplink engine, email parser, 39 tests |
| P5-B | Reservations UI | Mobile + web reservation management, "Book on [Platform]" buttons, email import |

## Remaining Phases

### Phase P6 -- Cross-Module Integration (Week 16-18)

**Goal:** Dining data connects to 7 other MyLife modules.

**Tasks (each is an independent integration file):**
1. **Recipes** (`modules/recipes/src/integrations/dining.ts`): "Recreate this dish" button on dish detail opens recipe creation with name + notes pre-filled. Mobile: navigate to `/(recipes)/add?fromDish=X`. Web: link to `/recipes/add?fromDish=X`.
2. **Nutrition** (`modules/nutrition/src/integrations/dining.ts`): "Log to Nutrition" on visit opens nutrition log with restaurant pre-filled.
3. **Budget** (`modules/budget/src/integrations/dining.ts`): Auto-suggest "Dining Out" category for matching transactions; visit to budget transaction link.
4. **RSVP** (`modules/rsvp/src/integrations/dining.ts`): "Invite friends" on visit opens RSVP group event creation.
5. **Trails** (`modules/trails/src/integrations/dining.ts`): When trip active, surface "Did you eat anywhere worth remembering?"
6. **Mood** (`modules/mood/src/integrations/dining.ts`): Correlation view -- mood scores on days with top-rated restaurant visits vs other days.
7. **Pets** (`modules/pets/src/integrations/dining.ts`): Pet-friendly tag on restaurant; "Brought a pet" toggle on visit.

**Important:** Each integration must be a no-op if dining module is disabled. Check `isModuleEnabled('dining')` before accessing dining data. Integration files live in the HOST module, not in dining.

**UI changes needed per integration:**
- Dining dish detail (mobile + web): Add "Recreate" button if recipes module enabled
- Dining visit detail: Add "Log to Nutrition" and "Invite Friends" buttons
- Dining restaurant detail: Add "Pet-Friendly" badge if pets module enabled
- Dining visit form: Add "Brought a pet" toggle if pets module enabled

### Phase P7 -- Advanced Consumer Features (Week 19-22, optional)

**Goal:** Year-in-review, import wizard, advanced analytics.

**Tasks:**
1. **Year-in-review engine** (`modules/dining/src/engine/year-review.ts`): Query all visits, dishes, wines for a 365-day period. Compute: best meals (highest-rated visits), most-visited restaurants, dish of the year, cuisine breakdown, spending totals, monthly visit frequency. Return structured data for rendering.
2. **Year-in-review UI** (mobile + web): Visual summary screen with stats cards, top lists, monthly chart.
3. **CSV import wizard** (`modules/dining/src/engine/csv-importer.ts`): Parse CSV with columns: name, address, city, cuisine, rating, notes. Map to CreateRestaurantInput. Handle 1000+ rows.
4. **Google Maps / Apple Maps import**: Parse exported location history or saved places. Extract restaurant names + addresses.
5. **Multi-currency**: Add `currency` column to dn_visits and dn_dishes. Display prices in original currency with optional conversion.
6. **Restaurant heatmap**: Aggregate visits by city. Mobile: colored dots on map. Web: interactive map.
7. **Export to PDF**: Generate a formatted "Restaurant Bible" with all restaurants, ratings, notes, top dishes.

## Verification Commands

```bash
pnpm --filter @mylife/dining typecheck    # Must pass clean
pnpm --filter @mylife/dining test         # 143 tests, all pass
pnpm --filter mobile typecheck            # Passes for dining files; health module has pre-existing errors
pnpm --filter web typecheck               # Passes clean
```

## Design System Reference

- Accent: `#DC2626` (warm red)
- Background: `#0E0E13`
- Surface tiers: `#1B1B20`, `#1F1F25`, `#2A292F`, `#35343A`
- Text: `#E4E1E9` primary, `#D6C3B5` secondary
- Glass: `rgba(255,255,255,0.03)` fill, `rgba(255,255,255,0.06)` border
- Stars: `#FFB877`
- Success: `#30D158`, Danger: `#FFB4AB`, Info: `#8BCFF0`

## Code Patterns

- Mobile: `StyleSheet.create()`, `Text` from `@mylife/ui`, `Pressable`, `useFocusEffect` + `useCallback` for refresh, synchronous DB calls via `useDatabase()`
- Web: `'use client'` pages, inline `CSSProperties`, `useEffect` for server action calls, `useParams`/`useRouter` from `next/navigation`
- Module: `DatabaseAdapter` from `@mylife/db`, Zod `.parse()` validation, caller-provided UUID strings, ISO date strings, booleans as INTEGER 0/1
- Server actions: `'use server'` in `actions.ts`, `getAdapter()` + `ensureModuleMigrations('dining')` via `db()` helper

## Known Issues

- Mobile `(health)` module has ~100+ pre-existing TypeScript errors (unrelated to dining)
- LSP sometimes shows phantom errors claiming Visit type uses camelCase (`restaurantId`) instead of actual snake_case (`restaurant_id`). Real typecheck always passes.
- `packages/module-registry/src/release-states.ts` had merge conflict markers that were resolved during P5-B
- Dining settings screen is still a placeholder (no user preferences UI yet)
- Map view is a placeholder list (Mapbox integration deferred)
- Photo pipeline exists but no actual camera/image picker integration on mobile yet
