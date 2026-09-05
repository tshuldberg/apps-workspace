# Feature Spec: Color Palette Analysis

## Metadata
- **Module:** closet
- **Priority Score:** 16 / 50 (C-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 1 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** 3
- **Estimated CC Time:** 30 min
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Most people unknowingly buy clothing in the same 3-4 colors. Visualizing wardrobe color distribution reveals patterns: "80% of my wardrobe is black and navy." Color analysis helps users identify gaps ("I don't own anything in warm tones"), avoid redundancy ("I have 12 gray tops"), and build more coordinated outfits. Stylebook offers this as a style statistics feature that drives engagement and repeat opens.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Stylebook | Yes | $5.99 one-time | Color breakdown chart, wardrobe color wheel, per-category color distribution |
| Indyx | No | N/A | No color analysis |
| Clueless | No | N/A | No color analysis |
| Alta | Partial | Free | AI detects colors from photos, but no wardrobe-wide analysis |

### Target User
Style-conscious users who want to understand their color patterns. Users building capsule wardrobes who need color variety data. Users who want outfit color coordination guidance. Fashion enthusiasts who enjoy wardrobe analytics.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/engine/color.ts       -- NEW: Color analysis engine
modules/closet/src/types.ts              -- Add ColorPalette, ColorAnalysis, ColorCategory types
modules/closet/src/db/crud.ts            -- Add getColorAnalysis() aggregation
apps/mobile/app/(closet)/stats.tsx       -- Add Color Palette section to Stats tab
apps/mobile/components/closet/ColorPaletteChart.tsx -- NEW: Color visualization
apps/web/app/closet/stats/page.tsx       -- Web color palette section
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       └── Stats tab
            ├── Cost-Per-Wear section
            └── Color Palette section  ← YOU ARE HERE
                 ├── Overall color distribution (donut chart)
                 ├── Color wheel visualization
                 ├── Per-category color breakdown
                 └── Color harmony suggestions
```

### Data Model
No new tables needed. Uses existing `cl_items.color` field (TEXT, nullable).

Color normalization map (engine logic):
```typescript
// User-entered colors mapped to canonical color categories
const COLOR_MAP: Record<string, ColorCategory> = {
  'black': 'black', 'noir': 'black',
  'white': 'white', 'cream': 'white', 'ivory': 'white', 'off-white': 'white',
  'gray': 'gray', 'grey': 'gray', 'charcoal': 'gray', 'silver': 'gray',
  'navy': 'blue', 'blue': 'blue', 'cobalt': 'blue', 'indigo': 'blue', 'teal': 'blue',
  'red': 'red', 'burgundy': 'red', 'maroon': 'red', 'crimson': 'red', 'wine': 'red',
  'green': 'green', 'olive': 'green', 'sage': 'green', 'emerald': 'green', 'forest': 'green', 'khaki': 'green',
  'pink': 'pink', 'rose': 'pink', 'blush': 'pink', 'coral': 'pink', 'salmon': 'pink',
  'yellow': 'yellow', 'gold': 'yellow', 'mustard': 'yellow',
  'orange': 'orange', 'rust': 'orange', 'terracotta': 'orange', 'copper': 'orange',
  'purple': 'purple', 'lavender': 'purple', 'plum': 'purple', 'violet': 'purple', 'mauve': 'purple',
  'brown': 'brown', 'tan': 'brown', 'beige': 'brown', 'camel': 'brown', 'chocolate': 'brown', 'cognac': 'brown',
  'multi': 'multi', 'pattern': 'multi', 'print': 'multi', 'stripe': 'multi', 'plaid': 'multi',
};
```

ColorCategory enum: `'black' | 'white' | 'gray' | 'blue' | 'red' | 'green' | 'pink' | 'yellow' | 'orange' | 'purple' | 'brown' | 'multi' | 'unknown'`

### Dependencies
- **Internal:** `@mylife/closet` (items with color field), `@mylife/ui`
- **External:** None
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a closet user, I want to see my wardrobe's color distribution so I can understand my color patterns.
2. As a style-aware user, I want per-category color breakdowns (tops by color, bottoms by color) to see where I'm heavy or light.
3. As an outfit builder, I want color harmony suggestions based on my wardrobe's actual colors.
4. As a shopper, I want to see which colors are under-represented so I can shop strategically.

### Behavior Specification

1. User opens Stats tab, scrolls to Color Palette section
2. **Overall Distribution:** Donut chart showing percentage of wardrobe per color category
   - Only active-status items counted
   - Items with null color grouped as "Unset" with prompt to add colors
   - Chart legend shows: color swatch, category name, item count, percentage
3. **Color Wheel:** Visual wheel showing wardrobe colors positioned on the color spectrum
   - Segment size proportional to item count
   - Complementary colors highlighted with connecting lines
   - Warm tones (red/orange/yellow) on one side, cool tones (blue/green/purple) on the other
4. **Per-Category Breakdown:** Expandable sections for each clothing category
   - Each shows a horizontal stacked bar with color proportions
   - E.g., "Tops: 40% black, 25% white, 20% blue, 15% gray"
5. **Insights Card:** Auto-generated observations:
   - "Your wardrobe is X% neutrals" (black + white + gray + brown)
   - "You could add [least-represented color family] for more variety"
   - "Your tops and bottoms share [overlapping colors] -- great for mix-and-match!"
   - "X items don't have a color set" (with CTA to add)
6. Tapping a color category in the donut chart filters the item list to show all items of that color

### Edge Cases
- No items have color set: show "Add colors to your items for palette analysis" with CTA
- All items are one color: show the distribution (100% one color) with insight "Your wardrobe is monochromatic -- consider adding variety"
- Multi-color/pattern items: grouped under "Multi/Pattern" category
- Unknown color strings not in map: grouped as "Other" with fuzzy match attempt
- Color strings with extra whitespace or capitalization: normalize before mapping (trim, lowercase)
- Very large wardrobe (1000+ items): pre-aggregate in SQL, don't iterate in JS
- Items with status != active: excluded from analysis

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Color Palette section appears on Stats tab
- [ ] **AC-2:** Donut chart shows overall color distribution with percentages
- [ ] **AC-3:** Color wheel visualization shows spectrum with wardrobe coverage
- [ ] **AC-4:** Per-category breakdown shows stacked color bars
- [ ] **AC-5:** Insights card shows at least 2 auto-generated observations
- [ ] **AC-6:** Tapping a color in the donut chart filters item list to that color
- [ ] **AC-7:** Items without color show "Unset" group with prompt to add
- [ ] **AC-8:** Only active-status items included in analysis

### Technical Criteria
- [ ] **TC-1:** `normalizeColor(input)` maps user-entered color strings to canonical ColorCategory
- [ ] **TC-2:** `getColorDistribution(items)` returns category -> count map
- [ ] **TC-3:** `getColorDistributionByCategory(items)` returns clothing-category -> color-category -> count
- [ ] **TC-4:** `generateColorInsights(distribution)` returns 2-4 insight strings
- [ ] **TC-5:** Color normalization handles 50+ common color name variants
- [ ] **TC-6:** Analysis completes in <100ms for 1000 items
- [ ] **TC-7:** Unknown colors mapped to 'unknown' category, not silently dropped

### Negative Criteria
- [ ] **NC-1:** Feature must NOT modify any item's color field
- [ ] **NC-2:** Feature must NOT require network access
- [ ] **NC-3:** Feature must NOT use image analysis or photo processing (uses text color field only)
- [ ] **NC-4:** Donated/sold/archived items must NOT be included in analysis

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F`
- Donut chart: colored segments with white gap lines, center shows total item count
- Color swatches: small circles with the actual color (hex mapped from category), glass background labels
- Color wheel: circular SVG with segments sized by count, accent ring outline
- Category bars: horizontal stacked bars with smooth transitions, glass card per category
- Insights card: glass card with lightbulb icon, insight text in secondary color
- Color legend mapping:
  - black: `#1A1A1A`, white: `#F5F5F5`, gray: `#808080`, blue: `#3478F6`,
  - red: `#FF3B30`, green: `#34C759`, pink: `#E879A8`, yellow: `#FFD60A`,
  - orange: `#FF9500`, purple: `#AF52DE`, brown: `#A2845E`, multi: rainbow gradient

### Web (Next.js)
- Same visualizations in Stats page section
- Donut chart: SVG or chart library
- Interactive: hover for tooltips, click to filter

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton donut + bar placeholders | Computing analysis |
| Empty | "Add colors to your items for palette analysis" | No items with colors |
| Error | "Couldn't analyze colors" + retry | Query failure |
| Success | Full color analysis with charts and insights | Items with colors exist |
| Partial | Partial chart + "X items need colors" prompt | Some items have colors, some don't |

## Test Requirements

### Unit Tests
- [ ] `normalizeColor`: "black" -> "black"
- [ ] `normalizeColor`: "Navy" -> "blue" (case insensitive)
- [ ] `normalizeColor`: "  Burgundy  " -> "red" (trim + map)
- [ ] `normalizeColor`: "chartreuse" -> "unknown" (not in map)
- [ ] `normalizeColor`: null -> "unknown"
- [ ] `normalizeColor`: "" -> "unknown"
- [ ] `getColorDistribution`: empty items returns empty map
- [ ] `getColorDistribution`: 5 black items, 3 white -> correct counts
- [ ] `getColorDistribution`: excludes non-active items
- [ ] `getColorDistributionByCategory`: groups by clothing category then color
- [ ] `generateColorInsights`: >70% neutrals generates "monochromatic" insight
- [ ] `generateColorInsights`: missing color family generates "add variety" insight
- [ ] `generateColorInsights`: unset colors generate "add colors" prompt
- [ ] `getColorHarmonyPairs`: identifies complementary color pairs in wardrobe

### Integration Tests
- [ ] Full flow: create items with colors -> view analysis -> verify chart data matches
- [ ] Filter flow: tap blue segment -> item list shows only blue items
- [ ] Partial flow: mix of colored and uncolored items -> both groups shown

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyCloset module
3. Add 15 items with colors: 5 black, 3 navy, 2 white, 2 gray, 1 red, 1 green, 1 (no color set)
4. Navigate to Stats tab, scroll to Color Palette section
5. Verify: Donut chart shows black (largest), blue, white, gray, red, green segments -- corresponds to AC-2
6. Verify: "Unset" group shows with "1 item needs a color" -- corresponds to AC-7
7. Verify: Insights card shows "Your wardrobe is X% neutrals" -- corresponds to AC-5
8. Verify: Insights show suggestion for under-represented colors (pink, orange, etc.) -- corresponds to AC-5
9. Tap the "black" segment in donut chart
10. Verify: Item list filters to show only black items (5 items) -- corresponds to AC-6
11. Scroll to per-category breakdown
12. Verify: Tops category shows color bar with proportions -- corresponds to AC-4
13. Verify: Color wheel shows spectrum with wardrobe coverage -- corresponds to AC-3
14. Mark 2 items as "donated"
15. Verify: Chart updates, donated items excluded -- corresponds to AC-8
16. Repeat key checks on web at `/closet/stats`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to stats tab color section, verify all states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for color analysis engine

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- Items have a `color` text field (nullable, free-text)
- No color normalization or categorization
- No color analysis or visualization

### After This Work
- Color normalization engine mapping 50+ color names to 12 canonical categories
- Distribution analysis (overall + per-clothing-category)
- Auto-generated color insights
- Color palette visualization (donut chart + color wheel)
- Interactive filtering by color

### Files Changed
- `modules/closet/src/engine/color.ts` -- NEW: Color normalization, distribution, insights engine
- `modules/closet/src/types.ts` -- Add ColorCategory, ColorDistribution, ColorInsight types
- `modules/closet/src/db/crud.ts` -- Add getColorAnalysis() query
- `modules/closet/src/index.ts` -- Export color engine functions
- `modules/closet/src/__tests__/color.test.ts` -- NEW: Color engine tests
- `apps/mobile/app/(closet)/stats.tsx` -- Add Color Palette section
- `apps/mobile/components/closet/ColorPaletteChart.tsx` -- NEW: Donut chart component
- `apps/mobile/components/closet/ColorWheel.tsx` -- NEW: Color wheel component
- `apps/web/app/closet/stats/page.tsx` -- Web color palette section

### Known Limitations
- Uses text-based color field, not image analysis (no photo color extraction)
- Color map is finite -- unusual color names may map to "unknown"
- No personal color season analysis (spring/summer/autumn/winter skin tone matching)
- Color harmony is basic (complementary pairs) -- not a full fashion color theory engine

### Context for Next Agent
- The color normalization map is the core of this feature. Make it comprehensive (50+ entries) and easily extensible.
- All analysis functions should be pure: items in, analysis out. No side effects.
- The `color` field on items is free-text entered by users. Expect variations: "dark blue", "light gray", "navy blue", "NAVY", "  navy  ".
- Normalize by: trim -> lowercase -> exact match in map -> word-by-word fallback (e.g., "light gray" -> try "light gray", then "gray") -> "unknown".
- For the donut chart, use SVG on both platforms (React Native SVG / web SVG). Don't add a heavy chart library dependency for one chart.
