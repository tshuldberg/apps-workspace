# Feature Spec: Companion Planting Guide

## Metadata
- **Module:** garden
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none
- **Blocks:** garden layout planner (companion data informs layout suggestions)

## Business Context

### Why This Feature Exists
Companion planting (growing mutually beneficial plants together) is fundamental to organic gardening. Tomatoes grow better next to basil. Carrots and onions repel each other's pests. Walnut trees produce chemicals that kill nearby plants. Gardeners need this information when planning their beds but currently have to consult separate charts, books, or websites. Planter's companion planting guide is one of its marquee features and a primary selling point. A bundled, searchable companion planting matrix gives users instant answers about plant compatibility without leaving the app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Planter | Yes | Premium ($49.99 lifetime) | Interactive companion planting matrix, color-coded compatibility, benefit descriptions |
| Seed to Spoon | Yes | Premium ($46.99/yr) | Companion planting recommendations per plant, text-based guide |
| GrowVeg | Yes | Premium ($35) | Companion planting chart in garden planner, visual indicators on bed layout |
| PlantIn | No | N/A | No companion planting (houseplant-focused) |

### Target User
Vegetable gardeners and herb growers who want to maximize yields and reduce pest issues through strategic plant placement. Users who currently consult printed companion planting charts or separate apps. Planter users ($49.99) would get this as part of the MyLife suite at $5/yr.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/engine/companion-data.ts        -- Bundled companion planting matrix (200+ plant pairs)
modules/garden/src/engine/companion.ts             -- Companion lookup, compatibility checker
modules/garden/src/types.ts                        -- CompanionRelationship, CompanionResult types
apps/mobile/app/(garden)/companions.tsx            -- Companion planting guide screen
apps/mobile/app/(garden)/components/CompanionMatrix.tsx  -- Interactive matrix view
apps/mobile/app/(garden)/components/CompanionCard.tsx    -- Relationship card
apps/web/app/garden/companions/page.tsx            -- Web companion guide
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── Top action bar: "Companions" icon
                 └── Companion Planting Guide ← YOU ARE HERE
       └── Plant Detail
            └── "Companion Plants" section
```

### Data Model

No new database tables required. The companion planting matrix is a bundled TypeScript data structure (read-only reference data), not user-generated data.

```typescript
// companion-data.ts (bundled knowledge base, NOT a migration)
interface CompanionEntry {
  plantA: string;       // e.g., "tomato"
  plantB: string;       // e.g., "basil"
  relationship: 'companion' | 'antagonist' | 'neutral';
  benefit: string;      // e.g., "Basil repels aphids and improves tomato flavor"
  category: 'pest_control' | 'growth_boost' | 'flavor_enhancement' | 'nutrient_sharing' | 'shade_provision' | 'chemical_inhibition';
}
```

**Data source:** ~200 curated plant pair relationships covering the most common vegetables, herbs, flowers, and fruit. Data compiled from university extension service publications (public domain, well-established horticultural science).

### Dependencies
- **Internal:** `@mylife/garden` (types), `@mylife/ui`
- **External:** None
- **Cross-Module:** None for V1. Future: recipes module could suggest companion herbs for vegetables the user grows.

## Functional Requirements

### User Stories
1. As a gardener, I want to look up which plants grow well together so that I can plan my garden beds for maximum compatibility.
2. As a gardener, I want to know which plants should NOT be planted near each other so that I avoid growth inhibition or pest attraction.
3. As a gardener, I want to see why two plants are companions (or antagonists) so that I understand the science and can make informed decisions.
4. As a gardener, I want to see all companions for a specific plant from my collection so that I can find the best neighbors for plants I already own.
5. As a gardener, I want to check compatibility between two specific plants so that I get a quick answer for a specific planting decision.

### Behavior Specification

**Companion guide screen (browse mode):**
1. User taps "Companions" icon from Garden tab or accesses from navigation
2. Top: search bar for filtering plants in the matrix
3. "My Plants" toggle: when on, only shows plants from user's collection. When off, shows full database.
4. Browse view: alphabetical list of plants, each showing a count of companions/antagonists
5. Tapping a plant expands to show two sections: "Good Companions" (green) and "Bad Neighbors" (red)
6. Each companion/antagonist entry shows: plant name, relationship badge, benefit description, category icon

**Quick compatibility check (pair mode):**
1. User selects "Check Compatibility" (or uses search with two plants)
2. Two plant pickers (dropdowns or search fields): Plant A and Plant B
3. Result shows: relationship type (companion/antagonist/neutral), benefit/risk description, category
4. If neutral: "No known strong interaction between [A] and [B]. They can be planted near each other."

**From Plant Detail:**
1. Plant Detail page shows a "Companion Plants" section
2. Lists top 5 companions and top 3 antagonists for this plant's species/crop type
3. "See All" link navigates to the full companion guide filtered to this plant

**Interactive matrix view (web):**
1. Grid/table showing plant-to-plant compatibility
2. Rows and columns are plant names
3. Cells are color-coded: green (companion), red (antagonist), gray (neutral/no data)
4. Hovering a cell shows the benefit/risk tooltip
5. Filterable by: plant category (vegetable, herb, flower), relationship type

### Edge Cases

- **Plant not in companion database:** Show "No companion data available for [plant name]. Try searching by crop type." Also suggest adding the plant's species or crop type.
- **User's plant has no species set:** Match by plant name (fuzzy match against companion database). If no match, show "Set a species or crop type to get companion recommendations."
- **Searching for a plant with no companions/antagonists:** Show "No known companion relationships for [plant]. This plant can be safely placed next to most others."
- **Very long companion lists:** Some plants (e.g., marigolds) are companions to 30+ others. Paginate at 20 with "Show More."
- **A is companion to B, but B is antagonist to C:** No contradiction -- show independently. Don't imply transitive relationships.
- **Same plant paired with itself:** Exclude self-pairs from display.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Companion guide screen shows alphabetical plant list with companion/antagonist counts
- [ ] **AC-2:** Tapping a plant shows "Good Companions" (green) and "Bad Neighbors" (red) lists
- [ ] **AC-3:** Each relationship entry shows plant name, benefit description, and category icon
- [ ] **AC-4:** "My Plants" toggle filters to only show plants in user's collection
- [ ] **AC-5:** Quick compatibility check accepts two plants and shows their relationship
- [ ] **AC-6:** Plant Detail shows top 5 companions and top 3 antagonists
- [ ] **AC-7:** Search bar filters plants in the companion list
- [ ] **AC-8:** Neutral relationship shown when no strong interaction exists
- [ ] **AC-9:** Web matrix view shows color-coded grid with hover tooltips

### Technical Criteria
- [ ] **TC-1:** Companion database contains 200+ plant pair relationships
- [ ] **TC-2:** Lookup by plant name returns results in <50ms (in-memory data)
- [ ] **TC-3:** Fuzzy matching handles common name variations (e.g., "tomato" matches "cherry tomato")
- [ ] **TC-4:** Relationship data is bidirectional (if A companions B, then B companions A)
- [ ] **TC-5:** No network calls -- entire database bundled as TypeScript data
- [ ] **TC-6:** "My Plants" filter correctly matches user plants to companion database entries

### Negative Criteria
- [ ] **NC-1:** Companion data must NOT require network access
- [ ] **NC-2:** Feature must NOT modify any plant records or garden data
- [ ] **NC-3:** Feature must NOT create any database tables (read-only reference data)
- [ ] **NC-4:** Must NOT show contradictory information for the same plant pair

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E`
- Companion badge: pill with green background (#30D158 at 20% opacity), green text, checkmark icon
- Antagonist badge: pill with red background (#FF453A at 20% opacity), red text, X icon
- Neutral badge: pill with gray background, gray text, minus icon
- Category icons: 🐛 pest_control, 📈 growth_boost, 🫒 flavor_enhancement, 🌱 nutrient_sharing, ☂️ shade_provision, ⚠️ chemical_inhibition
- Plant list: alphabetical with section headers (A, B, C...), each row shows plant name + companion count (green) + antagonist count (red)
- Expanded view: glass cards for each companion/antagonist with icon, name, benefit text

### Web (Next.js)

- Same tokens via CSS variables
- Route: `/garden/companions`
- Interactive matrix: table with sticky headers, cells 40x40px, color-coded, hover tooltip
- Side panel: selecting a row/column highlights it and shows full relationship details
- Searchable filter above the matrix

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton plant list | Initial render (near-instant since data is bundled) |
| Empty | Full companion database (no user filter) | "My Plants" toggle off |
| Filtered | Only plants from user's collection | "My Plants" toggle on |
| No Results | "No companion data for this plant" | Plant not in database |
| Search Active | Filtered list matching search query | User types in search bar |
| Pair Check | Compatibility result card for 2 plants | Quick compatibility mode |

## Test Requirements

### Unit Tests
- [ ] `getCompanions()`: returns all companions for a given plant
- [ ] `getAntagonists()`: returns all antagonists for a given plant
- [ ] `checkCompatibility()`: returns correct relationship for known pair
- [ ] `checkCompatibility()`: returns 'neutral' for unknown pair
- [ ] `searchPlants()`: fuzzy matches common name variations
- [ ] `searchPlants()`: case-insensitive matching
- [ ] Bidirectionality: if A->B exists, B->A returns same relationship
- [ ] `getCompanionsForUserPlants()`: filters by plant IDs in collection
- [ ] Database integrity: no self-pairs, no contradictory entries

### Integration Tests
- [ ] Full flow: open guide -> search plant -> view companions -> check pair compatibility
- [ ] "My Plants" flow: add plant with known species -> toggle filter -> verify plant appears

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden module
3. Tap "Companions" (or navigate to companion guide)
4. Verify: alphabetical plant list with companion/antagonist counts -- AC-1
5. Tap "Tomato"
6. Verify: "Good Companions" list includes Basil, Carrot, etc. (green) -- AC-2
7. Verify: "Bad Neighbors" list includes Fennel, Brassicas, etc. (red) -- AC-2
8. Verify: each entry shows benefit description and category icon -- AC-3
9. Toggle "My Plants" on
10. Verify: only plants from user's collection shown -- AC-4
11. Use "Check Compatibility" with Tomato and Basil
12. Verify: shows "Companion" with benefit description -- AC-5
13. Check compatibility between Tomato and Fennel
14. Verify: shows "Antagonist" with warning -- AC-5
15. Check two plants with no known interaction
16. Verify: shows "Neutral" message -- AC-8
17. Navigate to a plant's detail page
18. Verify: "Companion Plants" section shows top companions and antagonists -- AC-6
19. Use search bar to filter plants
20. Verify: list filters in real-time -- AC-7
21. On web: navigate to /garden/companions
22. Verify: interactive matrix with color-coded cells and hover tooltips -- AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No companion planting information in the garden module. Users have no way to check plant compatibility within the app.

### After This Work
- Bundled companion planting database with 200+ plant pair relationships
- Companion lookup engine with fuzzy name matching
- Companion guide browse screen with alphabetical list and expanded details
- Quick compatibility check for any two plants
- Plant Detail integration showing companions/antagonists
- Web matrix view for visual overview
- "My Plants" filter for personalized recommendations

### Files Changed
- `modules/garden/src/engine/companion-data.ts` -- 200+ companion planting entries
- `modules/garden/src/engine/companion.ts` -- Lookup, compatibility check, fuzzy matching
- `modules/garden/src/types.ts` -- CompanionRelationship, CompanionResult, CompanionCategory types
- `apps/mobile/app/(garden)/companions.tsx` -- Guide screen
- `apps/mobile/app/(garden)/components/CompanionMatrix.tsx` -- Matrix component (web focus)
- `apps/mobile/app/(garden)/components/CompanionCard.tsx` -- Relationship card
- `apps/web/app/garden/companions/page.tsx` -- Web guide with interactive matrix

### Known Limitations
- 200+ plant pairs covers common vegetables, herbs, and flowers. Exotic or ornamental plants may not be included.
- Companion planting science is empirical and sometimes debated. The database uses well-established relationships from university extension publications.
- The matrix view on mobile is impractical for 200+ plants -- mobile uses list view, web uses matrix.

### Context for Next Agent
- The companion-data.ts file should be a flat array of CompanionEntry objects, not nested. This makes search/filter simple and avoids duplication.
- Relationships must be stored as normalized pairs (alphabetical order: plantA < plantB) to prevent duplication and ensure bidirectionality.
- The garden layout planner feature (separate spec) will consume companion data to suggest or warn about plant placement. Design the API so it's easily queryable: `getRelationship(plantA, plantB)` should be O(1) via a lookup map.
- Fuzzy matching should normalize common variations: "tomato" = "cherry tomato" = "roma tomato" (group by crop family).
