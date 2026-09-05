# Feature Spec: Capsule Wardrobe Builder

## Metadata
- **Module:** closet
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** 3
- **Estimated CC Time:** 45 min
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
A capsule wardrobe is a curated collection of 25-40 versatile items that mix and match into many outfits. The concept (popularized by Donna Karen's 1985 "Seven Easy Pieces") has become a major movement in sustainable and minimalist fashion. Cladwell built their entire business around capsule wardrobe creation. MyCloset can offer this as a premium feature because it uses the user's actual wardrobe data to identify their most versatile pieces and reveal gaps.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Cladwell | Yes | $3.99/mo ($48/yr) | Full capsule builder, style quiz, shopping recommendations |
| Indyx | No | N/A | No capsule features |
| Stylebook | No | N/A | Manual collection creation but no capsule logic |
| Clueless | No | N/A | No capsule features |
| Alta | No | N/A | No capsule features |

### Target User
Minimalists and sustainable fashion enthusiasts who want a focused, versatile wardrobe. Users overwhelmed by too many items who want guidance on what to keep. Users interested in the capsule wardrobe concept but who want it applied to their existing items rather than buying a pre-defined set.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/engine/capsule.ts     -- NEW: Capsule analysis engine (versatility scoring, gap detection)
modules/closet/src/types.ts              -- Add CapsuleWardrobe, VersatilityScore, WardrobeGap types
modules/closet/src/db/schema.ts          -- Add cl_capsules, cl_capsule_items tables (V3 migration)
modules/closet/src/db/crud.ts            -- Add capsule CRUD operations
apps/mobile/app/(closet)/capsule.tsx     -- NEW: Capsule builder screen
apps/web/app/closet/capsule/page.tsx     -- NEW: Web capsule page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       ├── Wardrobe tab
       ├── Outfits tab
       │    └── Capsule Wardrobes section  ← YOU ARE HERE
       │         ├── Create Capsule wizard
       │         ├── Active capsule overview
       │         └── Gap analysis
       ├── Calendar tab
       └── Stats tab
```

### Data Model

```sql
-- V3 migration (shared with other V3 features)
CREATE TABLE IF NOT EXISTS cl_capsules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 33,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cl_capsule_items (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL REFERENCES cl_capsules(id) ON DELETE CASCADE,
  clothing_item_id TEXT NOT NULL REFERENCES cl_items(id) ON DELETE CASCADE,
  is_essential INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(capsule_id, clothing_item_id)
);

CREATE INDEX IF NOT EXISTS cl_capsules_active_idx ON cl_capsules(is_active, season);
CREATE INDEX IF NOT EXISTS cl_capsule_items_capsule_idx ON cl_capsule_items(capsule_id);
```

### Dependencies
- **Internal:** `@mylife/closet` (items, outfits, wear logs for versatility scoring), `@mylife/ui`
- **External:** None
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a minimalist, I want to create a capsule wardrobe from my existing items so I can focus on a curated set.
2. As a planner, I want the app to score my items by versatility so I can pick the most mix-and-matchable pieces.
3. As a gap-aware user, I want the app to identify what's missing from my capsule so I can make targeted additions.
4. As a seasonal dresser, I want capsules tied to seasons so I can create different sets for summer and winter.
5. As a capsule user, I want to see how many outfit combinations my capsule generates so I can see the value of fewer pieces.

### Behavior Specification

1. User accesses Capsule Builder via Outfits tab or dedicated entry
2. "Create Capsule" wizard:
   a. **Step 1 - Setup:** Name, season (spring/summer/fall/winter/all-season), target count (default 33, slider 20-50)
   b. **Step 2 - AI Selection:** Engine analyzes wardrobe and suggests items ranked by versatility score. Suggestions grouped by category with recommended counts (e.g., "5 tops, 3 bottoms, 2 dresses, 2 shoes, 1 outerwear")
   c. **Step 3 - Review & Edit:** User reviews suggestions, can add/remove items. Real-time counter shows current/target.
   d. **Step 4 - Gap Analysis:** Engine identifies missing categories or low variety areas. Shows: "Consider adding: 1 neutral bottom, 1 dressy shoe"
   e. **Step 5 - Save:** Capsule saved, becomes active
3. Active capsule view shows:
   a. Item grid (all capsule items)
   b. Stats: total items, outfit combination count (estimated), most versatile item
   c. Category breakdown (pie/donut chart)
   d. Gap analysis card (if gaps detected)
4. "Set as Active" marks one capsule as the current focus (only one active at a time)
5. Wardrobe tab can filter to show "Capsule Only" items

### Versatility Score Engine

Each item scored 0-100 based on:

```
versatility_score = (
  occasion_variety * 25      # more occasions = more versatile (0-25)
  + color_neutrality * 20    # neutral colors mix with everything (0-20)
  + season_breadth * 15      # all-season > single-season (0-15)
  + outfit_inclusion * 20    # appears in many saved outfits (0-20)
  + wear_frequency * 10      # frequently worn = proven versatile (0-10)
  + category_weight * 10     # some categories inherently more versatile (0-10)
)
```

Category distribution target for a 33-piece capsule:
- Tops: 9 (27%)
- Bottoms: 5 (15%)
- Dresses/Jumpsuits: 3 (9%)
- Outerwear: 3 (9%)
- Shoes: 4 (12%)
- Accessories: 5 (15%)
- Activewear: 2 (6%)
- Sleepwear: 2 (6%)

### Edge Cases
- Wardrobe smaller than target count: show all items, note "You have X items -- a capsule of Y would use your whole wardrobe"
- No outfits saved: versatility score uses only occasion tags and color, not outfit inclusion
- All items one color: gap analysis suggests "Add color variety"
- User removes essential category entirely (e.g., no shoes): gap analysis flags it
- Multiple capsules: allow but only one can be "active" at a time
- Capsule item gets donated/sold: auto-remove from capsule, gap analysis updates
- Target count = 0: prevent (min 20)
- Items already in another capsule: allow (capsules are non-exclusive)
- All items marked "all-season": skip season filter, show all

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Capsule builder accessible from Outfits tab
- [ ] **AC-2:** Create wizard has 5 steps: Setup, AI Selection, Review, Gap Analysis, Save
- [ ] **AC-3:** AI Selection ranks items by versatility score with category grouping
- [ ] **AC-4:** Review step shows real-time item count vs target
- [ ] **AC-5:** Gap analysis identifies missing categories and suggests additions
- [ ] **AC-6:** Active capsule view shows item grid, stats, category breakdown
- [ ] **AC-7:** Outfit combination estimate displayed (calculated or approximated)
- [ ] **AC-8:** "Capsule Only" filter available in Wardrobe tab
- [ ] **AC-9:** Only one capsule can be active at a time
- [ ] **AC-10:** Capsule updates if items are deleted from wardrobe

### Technical Criteria
- [ ] **TC-1:** `calculateVersatilityScore(item, outfits, wearLogs)` returns 0-100 score
- [ ] **TC-2:** `suggestCapsuleItems(items, targetCount, season)` returns ranked items with category balance
- [ ] **TC-3:** `analyzeCapsuleGaps(capsuleItems, targetCount)` identifies under-represented categories
- [ ] **TC-4:** `estimateOutfitCombinations(capsuleItems)` returns reasonable estimate
- [ ] **TC-5:** Capsule CRUD: create, get, list, update, delete, addItem, removeItem
- [ ] **TC-6:** V3 migration creates cl_capsules and cl_capsule_items tables
- [ ] **TC-7:** Engine handles 500+ item wardrobes in <300ms

### Negative Criteria
- [ ] **NC-1:** Creating a capsule must NOT change any item's status (active/stored)
- [ ] **NC-2:** Deleting a capsule must NOT delete the underlying clothing items
- [ ] **NC-3:** Feature must NOT require network access
- [ ] **NC-4:** Gap analysis suggestions must NOT auto-create wishlist items

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F`
- Capsule overview card: glass card with category donut chart, item count vs target, accent `#E879A8`
- Wizard steps: bottom sheet with step dots, glass background
- Versatility score badge: circular progress ring (0-100) in accent color on each item suggestion
- Gap analysis card: glass card with warning accent, category icons, "Consider adding" suggestions
- "Capsule Only" filter: toggle pill in Wardrobe tab filter bar

### Web (Next.js)
- Accessible via `/closet/capsule`
- Wizard as multi-step form
- Capsule overview with category chart and gap analysis sidebar
- Same tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton wizard steps | Analyzing wardrobe for suggestions |
| Empty | "Create your first capsule wardrobe" + CTA | No capsules exist |
| Error | "Analysis failed. Try again." | Engine error |
| Success | Active capsule overview with stats and charts | Capsule created |
| Partial | "Add more items for better capsule suggestions" | Very small wardrobe |

## Test Requirements

### Unit Tests
- [ ] `calculateVersatilityScore`: all-season item scores higher than single-season
- [ ] `calculateVersatilityScore`: item in 5 outfits scores higher than item in 0
- [ ] `calculateVersatilityScore`: neutral color (black, white, navy) scores higher than neon
- [ ] `suggestCapsuleItems`: returns items balanced across categories
- [ ] `suggestCapsuleItems`: respects target count
- [ ] `suggestCapsuleItems`: season filter excludes off-season items
- [ ] `analyzeCapsuleGaps`: detects missing category (no shoes)
- [ ] `analyzeCapsuleGaps`: detects under-represented category (1 top out of 33 target)
- [ ] `estimateOutfitCombinations`: returns reasonable number (tops * bottoms * shoes for simple estimate)
- [ ] `estimateOutfitCombinations`: handles empty category gracefully

### Integration Tests
- [ ] Full flow: create capsule -> verify items stored -> view overview -> verify stats
- [ ] Delete flow: delete capsule -> verify items unaffected
- [ ] Gap analysis flow: create capsule missing shoes -> gap shows "Add shoes"

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyCloset module
3. Add 40 items across all categories with varied colors, seasons, occasions
4. Create 5 outfits using various item combinations
5. Log 20+ wear events across different items
6. Navigate to Outfits tab
7. Tap "Create Capsule"
8. Verify: Step 1 setup with name, season, target count -- corresponds to AC-2
9. Set name "Fall Essentials", season "fall", target 33
10. Proceed to Step 2
11. Verify: Items ranked by versatility with scores -- corresponds to AC-3
12. Verify: Category grouping with recommended counts shown
13. Proceed to Step 3 (Review)
14. Verify: Real-time counter shows current selections vs target 33 -- corresponds to AC-4
15. Remove 2 items, add 1 different item
16. Proceed to Step 4 (Gap Analysis)
17. Verify: Any category gaps identified with suggestions -- corresponds to AC-5
18. Save capsule
19. Verify: Capsule overview shows item grid + stats + category chart -- corresponds to AC-6
20. Verify: Outfit combination estimate displayed -- corresponds to AC-7
21. Navigate to Wardrobe tab
22. Toggle "Capsule Only" filter
23. Verify: Only capsule items shown -- corresponds to AC-8
24. Create a second capsule, set it as active
25. Verify: First capsule is no longer active -- corresponds to AC-9
26. Repeat key checks on web at `/closet/capsule`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to capsule builder, step through wizard, verify all states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for versatility scoring engine

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- Users can create outfits manually
- No concept of capsule wardrobes
- No versatility scoring
- No gap analysis

### After This Work
- Capsule wardrobe tables (cl_capsules, cl_capsule_items) in V3 migration
- Versatility scoring engine (pure functions)
- 5-step capsule creation wizard
- Gap analysis engine
- Capsule overview with stats and charts
- "Capsule Only" filter in Wardrobe tab

### Files Changed
- `modules/closet/src/engine/capsule.ts` -- NEW: Versatility scoring, capsule suggestion, gap analysis
- `modules/closet/src/types.ts` -- Add CapsuleWardrobe, CapsuleItem, VersatilityScore, WardrobeGap types
- `modules/closet/src/db/schema.ts` -- Add cl_capsules, cl_capsule_items tables
- `modules/closet/src/db/crud.ts` -- Add capsule CRUD and query operations
- `modules/closet/src/definition.ts` -- V3 migration (shared with other V3 features)
- `modules/closet/src/index.ts` -- Export capsule types and functions
- `modules/closet/src/__tests__/capsule.test.ts` -- NEW: Capsule engine tests
- `apps/mobile/app/(closet)/capsule.tsx` -- NEW: Capsule builder screen
- `apps/mobile/components/closet/CapsuleWizard.tsx` -- NEW: 5-step wizard
- `apps/web/app/closet/capsule/page.tsx` -- NEW: Web capsule page

### Known Limitations
- Outfit combination estimate is approximate (multiplied category counts, not true combinatorial)
- No style quiz or personality-based recommendations (Cladwell's differentiator)
- No shopping recommendations to fill gaps (would need integration with stores)
- Versatility scoring is heuristic -- does not learn from fashion trends

### Context for Next Agent
- The versatility score must be a pure function for testability. Input: item + outfit list + wear logs. Output: 0-100 number.
- Category distribution targets should be configurable but default to the 33-piece standard breakdown.
- Gap analysis compares actual category counts against target distribution and reports deficits.
- Outfit combination estimate: simple formula `tops * bottoms * shoes_if_any`. Don't try to compute true combinatorial sets.
- V3 migration may be shared with other features (wishlist, AI suggestions). Coordinate: put all V3 tables in one migration or use additive separate migrations.
