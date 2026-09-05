# Feature Spec: Seasonal Rotation Reminders

## Metadata
- **Module:** closet
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** 2
- **Estimated CC Time:** 30 min
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Most people have seasonal wardrobes. When spring arrives, winter coats should be stored and spring items pulled out. Without reminders, users forget to rotate until they're frantically searching for shorts on the first hot day. Indyx and Clueless both prompt seasonal rotation, which drives regular engagement (4x/year minimum) and keeps the wardrobe inventory accurate (stored vs active).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Indyx | Yes | Free | Seasonal storage reminders, "time to swap" notifications |
| Clueless | Yes | $69/yr | Calendar-based rotation alerts, season-tagged items |
| Stylebook | No | N/A | Has seasons on items but no proactive reminders |
| Alta | No | N/A | No seasonal features |

### Target User
Users with distinct seasonal wardrobes (cold winters, hot summers). Users who store off-season items and need reminders to swap. Users in temperate climates with 4 distinct seasons.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/engine/seasonal.ts    -- NEW: Season detection, rotation analysis, reminder generation
modules/closet/src/types.ts              -- Add SeasonalRotation, RotationReminder types
modules/closet/src/db/crud.ts            -- Add getSeasonalRotationStatus(), getItemsForSeason()
apps/mobile/app/(closet)/wardrobe.tsx    -- Add seasonal rotation banner
apps/mobile/components/closet/SeasonalBanner.tsx -- NEW: Rotation reminder component
apps/web/app/closet/page.tsx             -- Web seasonal banner
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       └── Wardrobe tab
            ├── Seasonal Rotation Banner (conditional)  ← YOU ARE HERE
            │    ├── "Time to rotate! Spring is here"
            │    ├── Items to store: [winter items still active]
            │    ├── Items to bring out: [spring items still stored]
            │    └── "Start Rotation" action
            ├── Weather Card (if enabled)
            └── Item grid
```

### Data Model
No new tables needed. Uses existing fields:

- `cl_items.seasons_json` -- JSON array of seasons per item (e.g., `["winter"]`, `["spring", "fall"]`, `["all-season"]`)
- `cl_items.status` -- 'active' or 'stored' (existing enum values)

New settings in cl_settings (added via V3 migration or runtime):
```sql
INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('seasonalReminderEnabled', '1');
INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('seasonalReminderAdvanceDays', '14');
INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('lastSeasonalRotationDate', '');
INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('hemisphere', 'northern');
```

### Dependencies
- **Internal:** `@mylife/closet` (items with seasons, status field), `@mylife/ui`
- **External:** None (season detection is date-based, no weather API needed)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a closet user, I want to be reminded when it's time to rotate my wardrobe so I'm prepared for the new season.
2. As a user starting a rotation, I want to see which items should be stored and which should be brought out.
3. As a user completing a rotation, I want to batch-update item statuses (active <-> stored) efficiently.
4. As a user in the southern hemisphere, I want correct season detection for my location.

### Behavior Specification

1. Season detection engine determines current season based on date and hemisphere setting:
   - Northern: Spring (Mar-May), Summer (Jun-Aug), Fall (Sep-Nov), Winter (Dec-Feb)
   - Southern: Spring (Sep-Nov), Summer (Dec-Feb), Fall (Mar-May), Winter (Jun-Aug)
2. When current season differs from the last rotation, and `seasonalReminderEnabled` is true:
   a. Banner appears at top of Wardrobe tab: "Time to rotate for [Season]!"
   b. Shows count of items to store (tagged with previous season, currently active) and items to bring out (tagged with current season, currently stored)
3. Tapping "Start Rotation" opens the Rotation Flow:
   a. **Step 1 - Store:** List of active items tagged with the outgoing season. Checkbox to mark each for storage. "Store Selected" button.
   b. **Step 2 - Activate:** List of stored items tagged with the incoming season. Checkbox to mark each for activation. "Activate Selected" button.
   c. **Step 3 - Summary:** "Rotation complete! Stored X items, activated Y items." Updates `lastSeasonalRotationDate`.
4. Reminder triggers `seasonalReminderAdvanceDays` before the season change (default 14 days)
5. Dismissing the banner hides it until the next season change
6. Settings: Enable/disable reminders, advance days (7/14/30), hemisphere toggle

### Edge Cases
- Items tagged "all-season": never suggested for storage, always stay active
- Items tagged with multiple seasons (e.g., ["spring", "fall"]): only suggested for storage when none of their seasons match current
- No season tags on any items: banner shows "Tag your items with seasons to get rotation reminders"
- User in southern hemisphere: season dates flip correctly
- Mid-season rotation: if user rotates in April (mid-spring), show remaining un-rotated items
- Back-to-back same season (e.g., warm climate, always "summer"): no rotation needed, no banner
- Already rotated this season: banner hidden until next season boundary
- Items with 'donated'/'sold'/'archived' status: excluded from rotation suggestions

### Edge Case: Season Transition Math
Season boundaries (northern hemisphere): Mar 1, Jun 1, Sep 1, Dec 1. Advance reminder = boundary minus `seasonalReminderAdvanceDays`. If today is Feb 15 and advance = 14, show spring rotation reminder.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Seasonal rotation banner appears when current season differs from last rotation
- [ ] **AC-2:** Banner shows season name, items to store count, items to bring out count
- [ ] **AC-3:** "Start Rotation" opens the rotation wizard flow
- [ ] **AC-4:** Step 1 lists active items from outgoing season with checkboxes
- [ ] **AC-5:** Step 2 lists stored items from incoming season with checkboxes
- [ ] **AC-6:** Step 3 shows summary with stored/activated counts
- [ ] **AC-7:** After rotation, `lastSeasonalRotationDate` is updated
- [ ] **AC-8:** Banner is hidden after completing rotation
- [ ] **AC-9:** Dismiss button hides banner until next season
- [ ] **AC-10:** Settings allow toggling reminders, advance days, hemisphere

### Technical Criteria
- [ ] **TC-1:** `detectCurrentSeason(date, hemisphere)` returns correct season for both hemispheres
- [ ] **TC-2:** `shouldShowRotationReminder(settings, currentDate)` checks season boundary + advance days
- [ ] **TC-3:** `getItemsToStore(items, outgoingSeason)` returns active items tagged only with outgoing season
- [ ] **TC-4:** `getItemsToActivate(items, incomingSeason)` returns stored items tagged with incoming season
- [ ] **TC-5:** Batch status update (active -> stored, stored -> active) executes in single transaction
- [ ] **TC-6:** "all-season" items are never included in store suggestions

### Negative Criteria
- [ ] **NC-1:** Rotation must NOT auto-change item status -- always requires user confirmation
- [ ] **NC-2:** "all-season" items must NEVER be suggested for storage
- [ ] **NC-3:** Feature must NOT require network access
- [ ] **NC-4:** Rotation must NOT delete any items or wear logs

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F`
- Rotation banner: glass card with seasonal gradient (spring=soft green, summer=warm amber, fall=burnt orange, winter=cool blue)
- Season icon: emoji (spring=🌷, summer=☀️, fall=🍂, winter=❄️)
- Rotation wizard: bottom sheet with 3 steps, progress indicator at top
- Item checkboxes: same style as laundry basket (circular, accent fill)
- Summary: glass card with check icon, stored/activated counts in accent color

### Web (Next.js)
- Banner at top of closet dashboard
- Rotation wizard as a multi-step modal
- Same tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton banner | Checking season/settings |
| Empty | No banner (hidden) | Already rotated this season or reminders disabled |
| Error | No banner (fails silently) | Settings query failure |
| Success | Rotation banner with counts | Season change detected, not yet rotated |
| Partial | "Tag your items with seasons" prompt | Items exist but none have season tags |

## Test Requirements

### Unit Tests
- [ ] `detectCurrentSeason`: March 15 northern = spring
- [ ] `detectCurrentSeason`: March 15 southern = fall
- [ ] `detectCurrentSeason`: December 1 northern = winter
- [ ] `detectCurrentSeason`: June 15 southern = winter
- [ ] `shouldShowRotationReminder`: returns true when season changed and not rotated
- [ ] `shouldShowRotationReminder`: returns false when already rotated this season
- [ ] `shouldShowRotationReminder`: returns true when within advance-days window
- [ ] `getItemsToStore`: returns only active items tagged with outgoing season
- [ ] `getItemsToStore`: excludes all-season items
- [ ] `getItemsToStore`: excludes items tagged with multiple seasons including current
- [ ] `getItemsToActivate`: returns only stored items tagged with incoming season
- [ ] `getItemsToActivate`: excludes all-season items (they should already be active)

### Integration Tests
- [ ] Full flow: set season -> create seasonal items -> trigger rotation -> verify status changes
- [ ] Hemisphere flow: toggle to southern -> verify season detection flips
- [ ] Dismiss flow: dismiss banner -> verify hidden -> advance to next season -> verify shown again

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyCloset, Settings
3. Set hemisphere to "Northern" and enable seasonal reminders
4. Add items: "Parka" (winter), "Rain Jacket" (spring, fall), "Tank Top" (summer), "All-Season Jeans" (all-season)
5. Set device date to March 1 (or mock date in test)
6. Navigate to Wardrobe tab
7. Verify: Seasonal banner shows "Time to rotate for Spring!" -- corresponds to AC-1
8. Verify: Shows "1 item to store" (Parka) and "1 item to bring out" (Rain Jacket is already active by default, but if stored...) -- corresponds to AC-2
9. Tap "Start Rotation"
10. Verify: Step 1 shows Parka with checkbox -- corresponds to AC-4
11. Verify: Jeans NOT shown (all-season) -- corresponds to NC-2
12. Select Parka, tap "Store Selected"
13. Verify: Step 2 shows any stored spring items -- corresponds to AC-5
14. Complete rotation
15. Verify: Summary shows counts -- corresponds to AC-6
16. Verify: Banner is hidden -- corresponds to AC-8
17. Check Parka status is now "stored"
18. Set device date to June 1 (summer)
19. Verify: New rotation banner appears for summer
20. Repeat key checks on web

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to wardrobe tab, verify banner states

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for season detection engine

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- Items have `seasons_json` array and `status` field (active/stored/donated/sold/archived)
- `inferPackingSeason` exists in `engine/packing.ts` (can be reused or refactored)
- No rotation detection, no seasonal banner

### After This Work
- Seasonal detection engine with hemisphere support
- Rotation reminder logic with advance-days setting
- Rotation wizard (3-step flow) with batch status updates
- Seasonal banner on Wardrobe tab
- New settings: seasonalReminderEnabled, seasonalReminderAdvanceDays, lastSeasonalRotationDate, hemisphere

### Files Changed
- `modules/closet/src/engine/seasonal.ts` -- NEW: Season detection, rotation analysis
- `modules/closet/src/types.ts` -- Add SeasonalRotation types
- `modules/closet/src/db/crud.ts` -- Add getSeasonalRotationStatus(), batchUpdateItemStatus()
- `modules/closet/src/index.ts` -- Export seasonal engine functions
- `modules/closet/src/__tests__/seasonal.test.ts` -- NEW: Seasonal engine tests
- `apps/mobile/app/(closet)/wardrobe.tsx` -- Add SeasonalBanner
- `apps/mobile/components/closet/SeasonalBanner.tsx` -- NEW: Banner component
- `apps/mobile/components/closet/RotationWizard.tsx` -- NEW: 3-step rotation flow
- `apps/web/app/closet/page.tsx` -- Web seasonal banner

### Known Limitations
- Season boundaries are fixed dates (Mar/Jun/Sep/Dec 1), not astronomical solstices/equinoxes
- No microclimate support (e.g., San Francisco has different season patterns)
- Reminder notifications require expo-notifications integration (separate from this feature)
- Does not consider weather forecasts, only calendar dates

### Context for Next Agent
- Reuse `inferPackingSeason` from `engine/packing.ts` as a starting point for season detection -- but extend with hemisphere support.
- The `status` field on items already supports 'stored'. Use `updateClothingItem` with `{ status: 'stored' }` or `{ status: 'active' }`.
- Settings are read/written via `getClosetSetting`/`setClosetSetting`. Add new keys at runtime (no schema change needed for settings, they're key-value).
- Keep the rotation wizard as a pure state machine -- each step is a function that takes items + selections and returns the next state.
