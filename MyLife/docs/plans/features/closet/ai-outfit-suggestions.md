# Feature Spec: AI Outfit Suggestions

## Metadata
- **Module:** closet
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** 3
- **Estimated CC Time:** 60 min
- **Depends On:** none (but benefits from weather-aware recommendations if available)
- **Blocks:** none

## Business Context

### Why This Feature Exists
"What should I wear today?" is the fundamental question closet apps exist to answer. Clueless charges $69/yr primarily for AI outfit suggestions. Alta uses AI for virtual outfit generation. An on-device outfit recommender that considers weather, occasion, recent wear history, color coordination, and laundry status is the killer feature that turns a wardrobe tracker into a daily-use fashion assistant. This is the highest paid-user-value feature in the closet module.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Clueless | Yes | $69/yr | AI suggestions based on weather, calendar, style preferences |
| Alta | Yes | Freemium | AI outfit generation from wardrobe photos, virtual try-on |
| Indyx | Partial | Free | Styling tips but not personalized AI suggestions |
| Stylebook | No | N/A | Manual outfit creation only |

### Target User
Users who want a daily outfit recommendation without manual browsing. Users who own many items and struggle with decision fatigue. Users who value getting more value from their existing wardrobe rather than buying new items.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/engine/outfit-suggest.ts  -- NEW: Outfit suggestion engine (rule-based, no cloud AI)
modules/closet/src/types.ts                  -- Add OutfitSuggestion, SuggestionContext types
modules/closet/src/db/crud.ts                -- Add getSuggestedOutfits(), recordSuggestionFeedback()
modules/closet/src/db/schema.ts              -- Add cl_suggestion_feedback table (V3 migration)
apps/mobile/app/(closet)/outfits.tsx         -- Add "Suggested For You" section
apps/mobile/components/closet/OutfitSuggestionCard.tsx -- NEW
apps/web/app/closet/outfits/page.tsx         -- Web suggestions section
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       └── Outfits tab
            ├── Suggested For You (top)  ← YOU ARE HERE
            │    ├── 3 outfit suggestions
            │    ├── Context label ("For today's 72F and sunny")
            │    ├── Thumbs up/down feedback
            │    └── "Wear This" quick-log button
            └── My Outfits (existing saved outfits)
```

### Data Model

```sql
-- V3 migration (or shared with other V3 features)
CREATE TABLE IF NOT EXISTS cl_suggestion_feedback (
  id TEXT PRIMARY KEY,
  suggestion_hash TEXT NOT NULL,
  item_ids_json TEXT NOT NULL,
  feedback TEXT NOT NULL,
  context_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cl_suggestion_feedback_hash_idx ON cl_suggestion_feedback(suggestion_hash, feedback);
```

The engine is rule-based (no cloud AI required for MVP). It scores outfit combinations from the user's wardrobe using:

1. **Completeness:** Must include at least top + bottom (or dress). Bonus for shoes, outerwear when appropriate.
2. **Availability:** All items must be clean and active status.
3. **Weather match:** If weather data available, score by temperature-appropriate categories.
4. **Color harmony:** Basic color coordination rules (complementary, analogous, neutral pairing).
5. **Freshness:** Penalize items worn in last 3 days, bonus for unworn items.
6. **Occasion match:** If user specifies occasion, filter by item occasion tags.
7. **Feedback learning:** User thumbs-up/down adjusts future scoring for item combinations.

### Dependencies
- **Internal:** `@mylife/closet` (items, outfits, wear logs, weather engine if available), `@mylife/ui`
- **External:** None for MVP (rule-based engine). Future: on-device ML or Claude API for advanced suggestions.
- **Cross-Module:** Calendar module (future: suggest outfits for calendar events with dress code)

## Functional Requirements

### User Stories
1. As a closet user, I want the app to suggest complete outfits from my wardrobe so I save time deciding what to wear.
2. As a style-conscious user, I want suggestions to consider color coordination so outfits look good together.
3. As a practical user, I want suggestions to only use clean, available items so I can actually wear them.
4. As a user who provides feedback, I want thumbs up/down to improve future suggestions.
5. As a user with occasions, I want to request suggestions for a specific occasion (casual, work, formal, active).

### Behavior Specification

1. User opens Outfits tab
2. "Suggested For You" section appears at top with 3 outfit cards
3. Each outfit card shows:
   a. Assembled item thumbnails in outfit layout (top + bottom + optional shoes/outerwear)
   b. Context label: "For today's weather" or "Based on your style" or "For [occasion]"
   c. Match score (e.g., "92% match") based on scoring criteria
   d. "Wear This" button -- logs a wear event for all items in the outfit
   e. Thumbs up / thumbs down feedback buttons
4. User can tap "Refresh" to get 3 new suggestions (different combinations)
5. Occasion filter: dropdown at top (All, Casual, Work, Formal, Active) to refine suggestions
6. Tapping an outfit card expands to show full item list with individual item details
7. "Wear This" flow:
   a. Confirms: "Log wearing this outfit today?"
   b. On confirm: calls `logWearEvent` with all item IDs
   c. Shows brief success toast
8. Feedback flow:
   a. Thumbs up: stores positive feedback for this item combination
   b. Thumbs down: stores negative feedback, reduces future score for this combo
   c. Feedback persists in cl_suggestion_feedback for learning

### Edge Cases
- Fewer than 3 possible outfits: show as many as possible (1 or 2)
- No tops and no dresses: show "Add more items for outfit suggestions"
- All items dirty: show "Your wardrobe needs some laundry love!" with link to laundry basket
- Only 1 item per category: show the one possible outfit
- Weather not available: fall back to season-based or occasion-based suggestions
- User dislikes all suggestions: "Refresh" generates new combos, avoids previously disliked patterns
- Items worn yesterday: penalized but not excluded (user might re-wear a favorite jacket)
- Outfit suggestion identical to a saved outfit: label as "Your saved outfit: [name]"
- Very large wardrobe (500+ items): limit combinatorial explosion with pre-filtering (clean + active + matching season)

### Scoring Algorithm Detail

```
Base score for each candidate outfit:
  +100: all items are clean
  +50:  per item not worn in 7+ days (freshness bonus)
  +30:  weather-appropriate categories present
  +25:  occasion tags match request
  +20:  basic color harmony detected
  -20:  per item worn in last 3 days
  -50:  per dirty item (should not happen due to pre-filter)
  +/- feedback_adjustment from cl_suggestion_feedback
```

Generate top 20 outfit candidates, sort by score, return top 3. Shuffle slightly to avoid monotony (randomize among ties).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Suggested For You" section shows at top of Outfits tab
- [ ] **AC-2:** 3 outfit suggestions displayed, each with item thumbnails in layout
- [ ] **AC-3:** Each suggestion shows context label and match score
- [ ] **AC-4:** "Wear This" button logs a wear event for all outfit items
- [ ] **AC-5:** Thumbs up/down buttons record feedback
- [ ] **AC-6:** "Refresh" generates new suggestions avoiding previously shown combos
- [ ] **AC-7:** Occasion filter refines suggestions (All, Casual, Work, Formal, Active)
- [ ] **AC-8:** Tapping outfit card expands to show item details
- [ ] **AC-9:** Feedback improves subsequent suggestions (thumbs-downed combos scored lower)
- [ ] **AC-10:** Empty state shown when insufficient items for outfit suggestions

### Technical Criteria
- [ ] **TC-1:** Suggestion engine generates outfits in <200ms for 500 items
- [ ] **TC-2:** Engine pre-filters to clean + active items before combinatorial generation
- [ ] **TC-3:** Scoring formula considers availability, freshness, weather, color, occasion, and feedback
- [ ] **TC-4:** `cl_suggestion_feedback` persists user feedback with item combination hash
- [ ] **TC-5:** Suggestion hash is deterministic for the same item set (sorted IDs, hashed)
- [ ] **TC-6:** "Wear This" calls existing `logWearEvent` -- no separate code path
- [ ] **TC-7:** Engine avoids suggesting exact same outfit on consecutive calls

### Negative Criteria
- [ ] **NC-1:** Suggestions must NOT include dirty items as primary suggestions
- [ ] **NC-2:** Suggestions must NOT include items with status other than 'active'
- [ ] **NC-3:** Engine must NOT require network access (rule-based, fully on-device)
- [ ] **NC-4:** Feedback data must NOT be uploaded anywhere
- [ ] **NC-5:** Engine must NOT run expensive computations on the UI thread (use worker or memoize)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F`
- Suggestion cards: glass card with arranged item thumbnails (2x2 or 1+2 layout depending on item count)
- Match score: small pill in accent color `#E879A8` with percentage
- Context label: secondary text below thumbnails
- "Wear This" button: accent border, glass fill, centered
- Feedback buttons: small thumbs icons, glass background, accent fill when tapped
- Occasion filter: horizontal chip scroll at section top
- Expanded view: full-width card showing each item as a row (thumbnail, name, category, last worn)

### Web (Next.js)
- Suggestions as horizontal card row at top of outfits page
- Same scoring and display logic
- Accessible via `/closet/outfits`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 3 skeleton outfit cards | Engine computing suggestions |
| Empty | "Add more items to get outfit suggestions" | Fewer than 2 categories of items |
| Error | "Couldn't generate suggestions" + retry | Engine failure |
| Success | 3 outfit cards with scores and actions | Sufficient items for combinations |
| Partial | 1-2 suggestions + "Add more items for variety" | Limited wardrobe |

## Test Requirements

### Unit Tests
- [ ] `generateOutfitSuggestions`: returns 3 suggestions for wardrobe with 10+ items
- [ ] `generateOutfitSuggestions`: returns 0 for empty wardrobe
- [ ] `generateOutfitSuggestions`: excludes dirty items
- [ ] `generateOutfitSuggestions`: excludes non-active items
- [ ] `scoreOutfit`: clean items score higher than dirty
- [ ] `scoreOutfit`: recently worn items score lower
- [ ] `scoreOutfit`: weather-matching items score higher
- [ ] `scoreOutfit`: feedback-adjusted scores reflect user preferences
- [ ] `hashOutfitItems`: deterministic hash for same items in different order
- [ ] `generateOutfitSuggestions`: respects occasion filter
- [ ] `generateOutfitSuggestions`: each outfit includes top+bottom or dress minimum
- [ ] `applyColorHarmonyBonus`: complementary colors score higher than clashing

### Integration Tests
- [ ] Full flow: create items -> generate suggestions -> "Wear This" -> verify wear logged
- [ ] Feedback flow: generate -> thumbs down -> refresh -> disliked combo not repeated
- [ ] Occasion flow: set filter to "work" -> only work-tagged items in suggestions

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyCloset module
3. Add 12 items: 3 tops (different colors), 3 bottoms, 2 shoes, 2 outerwear, 1 dress, 1 activewear
4. Tag items with occasions (work, casual, active)
5. Log some wear events on a few items
6. Navigate to Outfits tab
7. Verify: "Suggested For You" shows 3 outfit suggestions -- corresponds to AC-1, AC-2
8. Verify: Each has context label and match score -- corresponds to AC-3
9. Tap first suggestion to expand
10. Verify: Full item list visible -- corresponds to AC-8
11. Tap "Wear This" on one suggestion
12. Verify: Wear event logged for all items in outfit -- corresponds to AC-4
13. Tap thumbs down on another suggestion
14. Verify: Feedback recorded (visual confirmation) -- corresponds to AC-5
15. Tap "Refresh"
16. Verify: New suggestions appear, thumbs-downed combo not repeated -- corresponds to AC-6, AC-9
17. Select "Work" occasion filter
18. Verify: Only work-tagged items in suggestions -- corresponds to AC-7
19. Mark all items dirty
20. Verify: "Your wardrobe needs some laundry love!" message -- corresponds to AC-10
21. Repeat key checks on web at `/closet/outfits`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to outfits tab, verify suggestion section in all states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for outfit suggestion engine

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- Outfits can be created and saved manually
- Wear logging exists
- No automated outfit suggestion engine
- No feedback mechanism

### After This Work
- Rule-based outfit suggestion engine (pure functions, no cloud dependency)
- "Suggested For You" section on Outfits tab with 3 daily suggestions
- Scoring considers availability, freshness, weather, color, occasion, feedback
- Feedback persistence in cl_suggestion_feedback table
- "Wear This" quick-log integration

### Files Changed
- `modules/closet/src/engine/outfit-suggest.ts` -- NEW: Suggestion engine, scoring, color harmony
- `modules/closet/src/types.ts` -- Add OutfitSuggestion, SuggestionContext, SuggestionFeedback types
- `modules/closet/src/db/schema.ts` -- Add cl_suggestion_feedback table (V3 migration)
- `modules/closet/src/db/crud.ts` -- Add getSuggestedOutfits(), recordSuggestionFeedback()
- `modules/closet/src/definition.ts` -- V3 migration (shared with other V3 features)
- `modules/closet/src/index.ts` -- Export suggestion engine functions
- `modules/closet/src/__tests__/outfit-suggest.test.ts` -- NEW: Suggestion engine tests
- `apps/mobile/app/(closet)/outfits.tsx` -- Add suggestions section
- `apps/mobile/components/closet/OutfitSuggestionCard.tsx` -- NEW
- `apps/web/app/closet/outfits/page.tsx` -- Web suggestions section

### Known Limitations
- Rule-based only (no neural network or LLM in MVP)
- Color harmony rules are basic (complementary, analogous, neutral) -- not a trained style model
- No virtual try-on or photo composition
- No learning from broader fashion trends or social data
- Suggestion quality is proportional to wardrobe completeness and tag quality

### Context for Next Agent
- This is the most complex feature in the closet module. The engine must be performant (<200ms for 500 items).
- Pre-filter aggressively: clean + active + matching season/occasion. Then generate combinations from the filtered set.
- Avoid O(n^k) combinatorial explosion: don't enumerate all possible outfits. Instead, pick best-in-category for each slot (top, bottom, shoes, outerwear) and combine.
- Color harmony: use a simple color-category map (neutral, warm, cool, accent) rather than full HSL analysis. Most clothing items have basic color strings ("black", "navy", "white").
- The feedback table uses a `suggestion_hash` (sorted item IDs, SHA-256 or simpler hash) to identify unique outfits.
- If weather engine from weather-aware-recommendations feature exists, import and use it. If not, skip weather scoring.
