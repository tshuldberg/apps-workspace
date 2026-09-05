# Feature Spec: Subscription Detection

## Metadata
- **Module:** subs
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 4 x3 + Complexity 1 x2 + CrossModule 3 x1 + PaidUser 5 x1
- **Sprint:** Sprint 8
- **Estimated CC Time:** 6-8 hours
- **Depends On:** Database schema, All CRUD functions
- **Blocks:** none

## Business Context

### Why This Feature Exists
Rocket Money's #1 value proposition is finding subscriptions users forgot about. Their bank sync detects recurring charges automatically and surfaces "hidden" subscriptions. MySubs is privacy-first (no bank access), so detection works differently: it uses a curated catalog of 200+ known subscription services combined with on-device heuristics. Users can also scan their email for subscription confirmation/receipt patterns. This is the feature most likely to convert free users to paid -- the "wow, I didn't realize I was paying for that" moment.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Yes | Yes ($48-144/yr) | Bank sync detects recurring transactions. Auto-categorizes. Surfaces "forgotten" subscriptions. Requires bank login credentials (Plaid). |
| Bobby | No | N/A | Manual entry only. No detection. |

### Target User
Rocket Money users who refuse to give a third party their bank credentials but still want subscription discovery. Users who know they have subscriptions they've forgotten about but don't want to comb through bank statements. Privacy-conscious users who want detection without sharing financial data.

## Technical Context

### Where This Lives in MyLife

```
modules/subs/src/
  engines/
    detection.ts             -- NEW: Subscription detection engine
    catalog.ts               -- NEW: Curated subscription catalog (200+ services)
    __tests__/
      detection.test.ts      -- NEW: Engine tests
      catalog.test.ts        -- NEW: Catalog tests
  types.ts                   -- MODIFY: Add detection-related types
  index.ts                   -- MODIFY: Export detection engine and catalog
apps/mobile/app/(subs)/
  detect.tsx                 -- NEW: Detection wizard screen
  subscription/
    add.tsx                  -- MODIFY: Pre-fill from catalog selection
apps/web/app/subs/
  detect/
    page.tsx                 -- NEW: Detection wizard page
```

### Wireframe Position

```
Hub Dashboard
  └── MySubs card
       └── Dashboard tab
            └── "Find Subscriptions" button  ← Entry point
       └── Subs tab
            └── "Detect" button in header    ← Alternative entry point
                 └── Detection Wizard        ← YOU ARE HERE
```

### Data Model

```sql
-- Subscription catalog: curated list of known subscription services
CREATE TABLE IF NOT EXISTS sb_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES sb_categories(id) ON DELETE SET NULL,
  typical_cost_cents INTEGER,
  typical_billing_cycle TEXT DEFAULT 'monthly'
    CHECK (typical_billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  cancel_url TEXT,
  website_url TEXT,
  icon_uri TEXT,
  search_terms TEXT,
  popularity_rank INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sb_catalog_name_idx
  ON sb_catalog(name);
CREATE INDEX IF NOT EXISTS sb_catalog_category_idx
  ON sb_catalog(category_id);
CREATE INDEX IF NOT EXISTS sb_catalog_popularity_idx
  ON sb_catalog(popularity_rank);
```

This table is added to the V1 migration (or a V2 migration if Database Schema shipped separately). Seeded with catalog data at migration time.

### Dependencies
- **Internal:** `@mylife/subs` (CRUD functions for creating subscriptions from detections), `@mylife/db` (DatabaseAdapter)
- **External:** None. No bank API, no network calls for detection. Catalog is bundled on-device.
- **Cross-Module:** Budget module has a 215-entry subscription catalog at `modules/budget/src/subscriptions/catalog.ts`. The Subs catalog should be seeded from the same data to maintain consistency. Cross-reference but do not import directly (modules are independent).

## Functional Requirements

### User Stories
1. As a user, I want to browse a catalog of known subscriptions and quickly add ones I have, so I don't have to type everything manually.
2. As a user, I want the catalog to suggest popular subscriptions first, so common services are easy to find.
3. As a user, I want to search the catalog by service name, so I can quickly find a specific subscription.
4. As a user, I want the catalog to pre-fill cost, billing cycle, category, and cancel URL when I select a service, so adding is nearly zero-effort.
5. As a user, I want to see which catalog entries I've already added, so I don't duplicate subscriptions.
6. As a user, I want a guided "detection wizard" that walks me through common subscription categories to help me remember forgotten services.

### Behavior Specification

**Subscription Catalog:**

The catalog contains 200+ entries organized by category. Each entry includes:
- Name (e.g., "Netflix", "Spotify Premium")
- Typical monthly cost in cents
- Billing cycle
- Category (Streaming, Music, Cloud Storage, etc.)
- Cancel URL (direct link to cancellation page)
- Website URL
- Icon URI (service logo or emoji fallback)
- Search terms (alternative names, e.g., "AMZN" for "Amazon Prime")
- Popularity rank (1 = most popular, used for default sort)

Initial catalog categories and top entries:

**Streaming (20+ entries):** Netflix ($22.99/mo), Hulu ($17.99/mo), Disney+ ($13.99/mo), HBO Max ($16.99/mo), Amazon Prime Video ($8.99/mo), Apple TV+ ($9.99/mo), Peacock ($13.99/mo), Paramount+ ($12.99/mo), YouTube Premium ($13.99/mo), Crunchyroll ($7.99/mo), ESPN+ ($10.99/mo), Discovery+ ($8.99/mo), Starz ($9.99/mo), Showtime ($11.99/mo), AMC+ ($8.99/mo), BritBox ($8.99/mo), Shudder ($6.99/mo), Criterion Channel ($10.99/mo), MUBI ($14.99/mo), Tubi (free)

**Music (10+ entries):** Spotify ($10.99/mo), Apple Music ($10.99/mo), YouTube Music ($10.99/mo), Tidal ($10.99/mo), Amazon Music ($9.99/mo), Deezer ($10.99/mo), Pandora ($10.99/mo), SoundCloud Go+ ($9.99/mo), Audible ($14.95/mo), Calm ($69.99/yr)

**Cloud Storage (8+ entries):** iCloud+ ($2.99/mo), Google One ($2.99/mo), Dropbox ($11.99/mo), OneDrive ($1.99/mo), pCloud ($4.99/mo), Box ($15/mo), Backblaze ($9/mo), IDrive ($6.95/mo)

**Productivity (15+ entries):** Microsoft 365 ($9.99/mo), Adobe Creative Cloud ($59.99/mo), Notion ($10/mo), 1Password ($2.99/mo), Todoist ($4/mo), Evernote ($14.99/mo), Canva Pro ($12.99/mo), Figma ($15/mo), Grammarly ($12/mo), Slack ($8.75/mo), Zoom ($13.33/mo), ChatGPT Plus ($20/mo), Claude Pro ($20/mo), GitHub Copilot ($10/mo), Linear ($8/mo)

**Gaming (10+ entries):** Xbox Game Pass ($16.99/mo), PlayStation Plus ($59.99/yr), Nintendo Switch Online ($19.99/yr), EA Play ($4.99/mo), GeForce Now ($9.99/mo), Xbox Live Gold ($9.99/mo), Humble Bundle ($11.99/mo), Apple Arcade ($6.99/mo), Google Play Pass ($4.99/mo), Ubisoft+ ($17.99/mo)

**Health & Fitness (10+ entries):** Peloton ($44/mo), ClassPass ($49/mo), Headspace ($12.99/mo), Calm ($69.99/yr), MyFitnessPal ($19.99/mo), Strava ($11.99/mo), Fitbod ($12.99/mo), Noom ($59/mo), BetterHelp ($65/wk), Talkspace ($69/wk)

**News & Media (10+ entries):** New York Times ($4.25/wk), Wall Street Journal ($4/mo), Washington Post ($4/mo), The Athletic ($9.99/mo), Economist ($23.99/mo), Substack (varies), Medium ($5/mo), Bloomberg ($34.99/mo), Financial Times ($39/mo), Wired ($29.99/yr)

**Shopping & Delivery (8+ entries):** Amazon Prime ($14.99/mo), Walmart+ ($12.95/mo), Costco ($65/yr), Instacart+ ($9.99/mo), DashPass ($9.99/mo), Grubhub+ ($9.99/mo), Uber One ($9.99/mo), Shipt ($10.99/mo)

**VPN & Security (8+ entries):** NordVPN ($12.99/mo), ExpressVPN ($12.95/mo), Surfshark ($12.95/mo), Bitwarden ($10/yr), LastPass ($3/mo), Norton ($9.99/mo), McAfee ($3.33/mo), Malwarebytes ($5/mo)

**Education (8+ entries):** Coursera Plus ($59/mo), Skillshare ($14/mo), MasterClass ($10/mo), LinkedIn Learning ($29.99/mo), Duolingo Plus ($6.99/mo), Brilliant ($24.99/mo), Blinkist ($12.99/mo), Kindle Unlimited ($11.99/mo)

Total: 200+ entries across 10 categories.

**Detection Wizard:**

The wizard walks users through categories one at a time:

1. **Welcome screen:** "Let's find your subscriptions. We'll go through common categories. This usually takes 2-3 minutes."
2. **Category screen (repeated for each category):**
   - Category name and icon at top
   - Grid of service logos/icons sorted by popularity
   - Already-added services shown with a checkmark (greyed out)
   - Tap a service to select it
   - Selected services get a green checkmark border
   - "None of these" button to skip category
   - "Next Category" button
3. **Review screen:**
   - List of all selected services with pre-filled costs
   - User can adjust cost for each (some services have multiple tiers)
   - "Add All" button
4. **Summary screen:**
   - "Added X subscriptions totaling $Y/month"
   - "View Subscriptions" button to go to the list

**Catalog Browse (alternative to wizard):**
- Accessible from the Subs tab header ("Detect" button)
- Full searchable list of catalog entries
- Tap to pre-fill the add subscription form
- Search by name or search_terms
- Filter by category

**Duplicate Prevention:**
- Before adding a catalog entry, check if `sb_subscriptions` already has an entry with the same name (case-insensitive)
- If duplicate found, show warning: "You already have [name]. Add another?" with Yes/No
- In the wizard, already-tracked services are visually distinguished (checkmark, greyed out)

### Edge Cases

- **Catalog entry with no cost:** Some services have variable pricing (e.g., Substack). Show "varies" and require user to enter cost manually.
- **User has a service not in catalog:** Wizard has "Add custom subscription" button on each category screen. Falls through to the manual add form.
- **Service pricing has changed:** Catalog prices are approximate. The pre-filled cost is editable. Show "(typical)" label next to pre-filled cost.
- **User goes back mid-wizard:** Selections are preserved. User can navigate back to previous categories.
- **User closes wizard without completing:** No subscriptions are added. No partial state saved.
- **Catalog data is stale:** Catalog is bundled at build time. Prices may be outdated. Always show as "typical" and let user edit. No network updates.
- **User selects 50+ services:** Performance consideration. `createSubscription` called for each. Use a transaction batch for the "Add All" action.
- **Duplicate search terms:** Multiple catalog entries might match the same search query. Show all matches sorted by popularity.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Find Subscriptions" button on Dashboard launches the detection wizard
- [ ] **AC-2:** Wizard walks through categories one at a time with service grids
- [ ] **AC-3:** Tapping a service selects it with a green checkmark border
- [ ] **AC-4:** Already-tracked services shown with a grey checkmark (not selectable)
- [ ] **AC-5:** Review screen shows all selected services with editable pre-filled costs
- [ ] **AC-6:** "Add All" creates subscriptions and shows summary with total monthly cost
- [ ] **AC-7:** Catalog search returns matching services by name and search terms
- [ ] **AC-8:** Selecting a catalog entry pre-fills the add subscription form with name, cost, cycle, category, URL
- [ ] **AC-9:** "None of these" skips to the next category
- [ ] **AC-10:** Summary screen shows correct count and total
- [ ] **AC-11:** Feature works on both mobile and web
- [ ] **AC-12:** Wizard can be exited at any point without side effects

### Technical Criteria
- [ ] **TC-1:** Catalog contains 200+ entries across 10 categories
- [ ] **TC-2:** Each catalog entry has name, typical_cost_cents, billing_cycle, category, and at least one of cancel_url or website_url
- [ ] **TC-3:** Catalog is seeded during migration (bundled, no network fetch)
- [ ] **TC-4:** Catalog search uses LIKE on both name and search_terms columns
- [ ] **TC-5:** "Add All" uses a transaction batch (not 50 individual inserts)
- [ ] **TC-6:** Duplicate detection checks by case-insensitive name match
- [ ] **TC-7:** Wizard state (selections per category) is held in React state, not persisted until "Add All"
- [ ] **TC-8:** `sb_catalog` table is read-only from the user's perspective (no CRUD for catalog entries)
- [ ] **TC-9:** `pnpm typecheck` passes with no errors
- [ ] **TC-10:** Catalog data is exported as a typed constant for easy maintenance

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Detection must NOT require network access or bank credentials
- [ ] **NC-2:** Must NOT auto-add subscriptions without user confirmation
- [ ] **NC-3:** Wizard must NOT persist any data until the user explicitly taps "Add All"
- [ ] **NC-4:** Must NOT allow editing or deleting catalog entries from the UI (catalog is read-only)
- [ ] **NC-5:** Must NOT crash or hang with 50+ selections in the wizard

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#10B981` (emerald green)
- Selected: `#10B981` border with `rgba(16,185,129,0.1)` background
- Already tracked: `rgba(255,255,255,0.02)` background with grey checkmark
- Category header: icon + name in accent color

Wizard category screen:
```
[← Back]          Streaming          [Skip →]

  ┌──────┐  ┌──────┐  ┌──────┐
  │ ✓    │  │      │  │      │
  │Netflx│  │ Hulu │  │Disny+│
  │$22.99│  │$17.99│  │$13.99│
  └──────┘  └──────┘  └──────┘

  ┌──────┐  ┌──────┐  ┌──────┐
  │      │  │ ✓ ✓  │  │      │
  │HBO Mx│  │AplTV+│  │Peacck│
  │$16.99│  │$9.99 │  │$13.99│
  └──────┘  └──────┘  └──────┘

  [+ Add custom subscription]

                    [Next Category →]
```
(✓✓ = already tracked, green ✓ = selected this session)

Review screen:
```
[Review Your Selections]         4 subscriptions

  Netflix          $22.99/mo    [edit cost]
  Disney+          $13.99/mo    [edit cost]
  Spotify          $10.99/mo    [edit cost]
  iCloud+          $2.99/mo     [edit cost]

  Total: $50.96/mo ($611.52/yr)

                         [Add All Subscriptions]
```

### Web (Next.js)

- Route: `/subs/detect` for the wizard
- Catalog browse accessible from `/subs/subscriptions` header
- Service grid uses responsive columns (3 on mobile, 4-5 on desktop)
- Review is a modal overlay, not a separate page

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton grid while catalog loads from SQLite | Wizard opened |
| Category view | Grid of services for current category | Wizard step |
| No matches | "No services found" for search query | Search with no results |
| Review | Selected services with costs | User taps "Review" / reaches end |
| Adding | Progress indicator during batch insert | User taps "Add All" |
| Complete | Summary with count and total | All subscriptions created |
| Error | "Could not add subscriptions" with retry | Insert fails |

## Test Requirements

### Unit Tests
- [ ] Catalog has 200+ entries
- [ ] Every catalog entry has required fields (name, typical_cost_cents, billing_cycle)
- [ ] No duplicate catalog entry names
- [ ] Search "netflix" returns Netflix entry
- [ ] Search "AMZN" returns Amazon Prime entry (via search_terms)
- [ ] Search with no matches returns empty array
- [ ] Category filter returns only entries in that category
- [ ] `isAlreadyTracked(db, catalogEntry)` returns true for existing subscription with same name
- [ ] `isAlreadyTracked(db, catalogEntry)` is case-insensitive
- [ ] `batchCreateFromCatalog(db, selections)` creates correct number of subscriptions
- [ ] `batchCreateFromCatalog` uses a transaction (all-or-nothing)
- [ ] `batchCreateFromCatalog` with cost overrides uses the override, not catalog default
- [ ] Catalog entries sorted by popularity_rank by default

### Integration Tests
- [ ] Full wizard flow: open wizard -> select 3 services across 2 categories -> review -> add all -> 3 subs in database
- [ ] Duplicate prevention: add Netflix manually -> open wizard -> Netflix shown as already tracked
- [ ] Cost override: select service -> change cost on review -> added subscription has custom cost
- [ ] Cancel wizard: select services -> close wizard -> no subscriptions added

### QA Verification Script

1. Open MySubs on iOS/web
2. Verify Dashboard has "Find Subscriptions" button -- AC-1
3. Tap "Find Subscriptions"
4. Verify: Wizard opens with welcome screen -- AC-2
5. Proceed to first category (Streaming)
6. Verify: Grid shows Netflix, Hulu, Disney+, etc. sorted by popularity -- AC-2
7. Tap Netflix -- AC-3
8. Verify: Green checkmark border appears -- AC-3
9. Tap Disney+
10. Tap "Next Category"
11. Proceed to Music category
12. Tap Spotify
13. Tap "None of these" on Cloud Storage -- AC-9
14. Skip remaining categories
15. Verify: Review screen shows Netflix, Disney+, Spotify with pre-filled costs -- AC-5
16. Change Spotify cost to $16.99 (family plan)
17. Tap "Add All" -- AC-6
18. Verify: Summary shows "Added 3 subscriptions totaling $53.97/month" -- AC-10
19. Navigate to Subs tab
20. Verify: All 3 subscriptions appear in list
21. Go back to wizard
22. Verify: Netflix, Disney+, Spotify shown as already tracked (grey checkmarks) -- AC-4
23. Go to Subs tab, tap "Detect" button in header
24. Verify: Catalog search appears -- AC-7
25. Search "apple" -- AC-7
26. Verify: Apple TV+, Apple Music, Apple Arcade, Apple One appear -- AC-7
27. Tap Apple TV+ -- AC-8
28. Verify: Add form pre-filled with $9.99/mo, Streaming, apple.com URL -- AC-8
29. Close wizard without adding
30. Verify: No new subscriptions added -- AC-12
31. Repeat key steps on web -- AC-11

## gstack Quality Gates

Based on Complexity score 1 (Complex), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Complex features (Complexity <= 1):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /subs/detect, walk through wizard flow, verify all states

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- subs has no standalone counterpart, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- CRUD functions and UI exist. Users add subscriptions manually by typing all details. No catalog, no detection, no wizard.

### After This Work
- 200+ entry subscription catalog in `sb_catalog` table.
- Detection wizard that walks through categories and batch-adds selected services.
- Catalog search and browse from the Subs tab.
- Pre-fill from catalog when adding subscriptions.
- Duplicate prevention against already-tracked subscriptions.

### Files Changed
- `modules/subs/src/engines/detection.ts` -- NEW: Detection engine (search, batch create, duplicate check)
- `modules/subs/src/engines/catalog.ts` -- NEW: Catalog data (200+ entries as typed constants)
- `modules/subs/src/engines/__tests__/detection.test.ts` -- NEW: Detection tests
- `modules/subs/src/engines/__tests__/catalog.test.ts` -- NEW: Catalog data validation tests
- `modules/subs/src/db/schema.ts` -- MODIFY: Add sb_catalog table DDL
- `modules/subs/src/db/migrations.ts` -- MODIFY: Add catalog table creation and seeding to migration
- `modules/subs/src/types.ts` -- MODIFY: Add CatalogEntry, DetectionSelection types
- `modules/subs/src/index.ts` -- MODIFY: Export detection engine and catalog
- `apps/mobile/app/(subs)/detect.tsx` -- NEW: Detection wizard screen
- `apps/mobile/app/(subs)/subscription/add.tsx` -- MODIFY: Accept catalog pre-fill props
- `apps/web/app/subs/detect/page.tsx` -- NEW: Detection wizard page

### Known Limitations
- **No bank sync.** Detection is catalog-based, not transaction-based. Users still need to know what they're paying for.
- **No email scanning.** A future enhancement could parse email receipts for subscription confirmations. Privacy implications need careful design.
- **Catalog data ages.** Prices change, services launch/shut down. The catalog is a snapshot at build time. No auto-update mechanism.
- **No service logos.** Icon URIs are emoji fallbacks, not actual brand logos. Logos require licensing or API access (future enhancement).
- **US-centric pricing.** Catalog prices are USD. International pricing varies. Users should always verify and adjust.

### Context for Next Agent
- The catalog data constant in `catalog.ts` should be a large typed array. Use `satisfies CatalogEntry[]` for type safety while keeping the data as a plain object for easy maintenance.
- Seeding 200+ rows at migration time: use a single INSERT with multiple VALUE rows or a loop within a transaction. Do not make 200 individual INSERT calls.
- The Budget module has a similar catalog at `modules/budget/src/subscriptions/catalog.ts`. Cross-reference for data consistency but do not import from Budget. Modules are independent.
- The `search_terms` field enables matching alternative names (e.g., "AMZN" for Amazon, "MS365" for Microsoft 365). Populate these for the most common abbreviations.
- Cancel URLs are the most valuable metadata. Prioritize finding direct cancellation page URLs for the top 50 services. For others, use the general website URL.
- The `popularity_rank` field drives default sort order. Rank by US market penetration (Netflix #1, Spotify #2, Amazon Prime #3, etc.).
