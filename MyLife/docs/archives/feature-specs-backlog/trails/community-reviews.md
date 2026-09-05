# Feature Spec: Community Reviews

## Metadata
- **Module:** trails
- **Priority Score:** 21 / 50 (C-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [1] x2 + CrossModule [2] x1 + PaidUser [2] x1
- **Sprint:** 8
- **Estimated CC Time:** 3-4 hours (Complexity Inverse = 1, "Complex")
- **Depends On:** Trail database integration (V8, for shared trail identifiers)
- **Blocks:** none

## Business Context

### Why This Feature Exists
AllTrails' community reviews are the primary reason hikers choose a trail: 120M+ reviews with photos, difficulty opinions, and condition reports. "Is this trail muddy right now?" and "How crowded is it on weekends?" are questions only recent visitor reviews can answer. Without community reviews, MyTrails is a solo recording tool. Adding reviews transforms it into a community resource where hikers help each other make better trail decisions. However, as a C-tier feature, this is intentionally minimal in V1: basic star ratings and text reviews stored locally, with an optional opt-in sharing mechanism. MyTrails will never require an account or upload data without explicit consent.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AllTrails | Yes | Free to read | 120M+ reviews with 1-5 star ratings, photos, condition tags (muddy, buggy, snowy). Account required to write. Reviews are public. Primary engagement mechanic. |
| Komoot | Yes | Free | "Highlights" on routes: community-submitted points of interest, difficulty opinions, photos. Less structured than AllTrails. 35M+ users. |
| Gaia GPS | No | N/A | No community features. Solo backcountry tool. |
| Strava | Partial | Free | "Kudos" and comments on activities, but not trail reviews. Social feed, not trail guidance. |

### Target User
Hikers deciding between trails who want to know current conditions and other people's experiences. Users who just completed a great (or terrible) hike and want to share their opinion. New hikers who rely on community guidance to pick appropriate trails. Privacy-conscious users who want to contribute reviews without creating an account or sharing their identity.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New TrailReview, ReviewSummary, CreateReviewInput schemas
  db/schema.ts                  -- New tr_reviews table (migration V10)
  db/crud.ts                    -- CRUD for reviews
  definition.ts                 -- Add V10 migration, bump schemaVersion
  index.ts                      -- Export new review functions and types

apps/mobile/app/(trails)/
  trail-detail.tsx              -- Updated: reviews section with rating summary
  write-review.tsx              -- NEW: review composition screen

apps/web/app/trails/
  page.tsx                      -- Updated: reviews section in trail detail
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Trails tab
            └── Trail Detail
                 └── Reviews section ← rating summary + review list
                      └── Write Review ← star rating + text + optional condition tags
```

### Data Model

```sql
-- Migration V10: Community reviews
CREATE TABLE IF NOT EXISTS tr_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  trail_id TEXT NOT NULL REFERENCES tr_trails(id) ON DELETE CASCADE,
  recording_id TEXT REFERENCES tr_recordings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  conditions TEXT,                        -- JSON array: ["muddy", "buggy", "crowded", "snow", "clear"]
  visited_at TEXT,                        -- date of the hike this review is about
  is_shared INTEGER NOT NULL DEFAULT 0,   -- 1 = user opted in to future community sharing
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_reviews_trail ON tr_reviews(trail_id);
CREATE INDEX IF NOT EXISTS idx_tr_reviews_rating ON tr_reviews(trail_id, rating);
CREATE INDEX IF NOT EXISTS idx_tr_reviews_visited ON tr_reviews(visited_at DESC);
```

Reviews are stored locally only in V1. The `is_shared` flag indicates the user's intent to share if community sharing is added in a future version. No data is uploaded without explicit action.

### Dependencies
- **Internal:** `@mylife/trails` (trails, recordings for linking), `@mylife/db` (DatabaseAdapter)
- **External:** None in V1 (local reviews only).
- **Cross-Module:** Journal module has a similar review/reflection concept. Future: link trail reviews to journal entries. Score: 2 (mild).

## Functional Requirements

### User Stories
1. As a hiker who just completed a trail, I want to rate it and write a brief review so that I can remember my experience and (optionally) help others.
2. As a hiker planning a trip, I want to see my own past reviews and ratings to remember what I thought of trails I've done before.
3. As a user, I want to tag trail conditions (muddy, clear, snowy, buggy, crowded) so that I can track seasonal conditions.
4. As a privacy-conscious user, I want my reviews stored locally by default with an opt-in flag for future sharing, not auto-uploaded.
5. As a user browsing my trails, I want to see an average rating and review count on each trail card.

### Behavior Specification

**Writing a review:**
1. User opens a trail detail screen
2. User taps "Write Review" (or prompted after completing a recording on this trail)
3. Review form shows:
   - Star rating: 1-5 stars (required)
   - Title: optional one-line summary
   - Body: optional longer text
   - Conditions: multi-select tags (Clear, Muddy, Snowy, Icy, Buggy, Crowded, Overgrown, Well-maintained)
   - Visit date: defaults to today, can be changed
   - Share toggle: "Allow this review to be shared with the MyTrails community" (default off)
4. User taps "Save"
5. Review is stored locally in `tr_reviews`

**Viewing reviews:**
1. Trail detail screen shows a "Reviews" section
2. Summary at top: average star rating (to one decimal), review count
3. Condition tags: most recent conditions as colored pills
4. Review list: chronological (newest first), each showing stars, title, body excerpt, visit date
5. Tap a review to see full text

**Review after recording:**
1. After completing a recording on a trail, prompt: "Rate your hike?"
2. Quick-rate: tap stars (1-5) inline
3. Tapping stars opens the full review form pre-filled with the recording date and linked recording

**Trail card rating summary:**
1. Trail list cards show average star rating and review count
2. Trails with no reviews show no rating (not "0 stars")

### Edge Cases

- **Multiple reviews for same trail:** Allowed. A user might hike the same trail in different seasons and want separate reviews.
- **Review without recording:** Allowed. Users can review trails they hiked before using the app.
- **Editing a review:** User can edit their own reviews. Updated timestamp shown.
- **Deleting a review:** User can delete reviews. Average rating recalculates.
- **Deleting a trail:** Cascade deletes all reviews for that trail.
- **Rating distribution:** Show a breakdown (5-star: 3, 4-star: 1, etc.) on the review summary if >3 reviews exist.
- **Very long review text:** No character limit but truncate to 500 chars in the list view with "Read more."
- **Conditions freshness:** Conditions are relevant to the visit date. Show "Conditions as of [date]" to avoid stale info being misinterpreted.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can write a review with a 1-5 star rating for any trail
- [ ] **AC-2:** User can add optional title, body text, and condition tags to a review
- [ ] **AC-3:** Trail detail shows average star rating and review count
- [ ] **AC-4:** Trail detail shows most recent condition tags
- [ ] **AC-5:** Review list shows reviews in chronological order (newest first)
- [ ] **AC-6:** After completing a recording, user is prompted to rate the trail
- [ ] **AC-7:** User can edit and delete their own reviews
- [ ] **AC-8:** Trail cards in the list show star rating summary
- [ ] **AC-9:** Share toggle defaults to off; reviews are local-only by default

### Technical Criteria
- [ ] **TC-1:** `tr_reviews` table is created by migration V10
- [ ] **TC-2:** Average rating is calculated correctly as (sum of ratings / count)
- [ ] **TC-3:** Condition tags are stored as JSON array and parsed correctly
- [ ] **TC-4:** Cascade delete: deleting a trail removes all its reviews

### Negative Criteria
- [ ] **NC-1:** Reviews must NOT be uploaded to any server in V1 (even with `is_shared = 1`)
- [ ] **NC-2:** Share toggle must NOT default to on
- [ ] **NC-3:** Review data must NOT include device identifiers or user identity
- [ ] **NC-4:** Deleting a review must NOT affect the linked recording

## UI Specification

### Mobile (Expo)

**Review Summary (trail detail):**
- Glass card with: filled stars (lime `#65A30D`), average rating number, review count
- Condition tag pills: colored by type (green: "Clear," brown: "Muddy," blue: "Snowy," red: "Buggy," orange: "Crowded")
- "Write Review" button

**Review List:**
- Each review card: star rating, title (bold), body excerpt, visit date, condition pills
- Newest first
- "Read more" link for long reviews

**Write Review Form:**
- Background: `#0A0A0F`
- Star picker: 5 large tappable stars (44px tap target each), lime when filled
- Title input: glass background, placeholder "Summarize your experience"
- Body input: glass background, multi-line, placeholder "Tell others about this trail..."
- Condition tags: multi-select pill grid
- Visit date: date picker, defaults to today
- Share toggle: bottom of form, with explanation text "Your review stays on your device unless you opt in"
- "Save" button: lime accent

### Web (Next.js)

- Reviews section in trail detail sidebar
- Review form as a modal
- Same data fields as mobile

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Reviews | "Be the first to review" + "Write Review" CTA | Trail has no reviews |
| Summary | Star average + review count + conditions | Trail has 1+ reviews |
| Review List | Scrollable review cards | User scrolls to reviews section |
| Writing | Review form with star picker and inputs | User tapped "Write Review" |
| Post-Recording | Quick-rate prompt with star picker | User just completed a recording |

## Test Requirements

### Unit Tests
- [ ] `createReview`: creates with correct rating, trail_id, recording_id
- [ ] `getReviewsByTrail`: returns reviews newest first
- [ ] `getReviewsByTrail`: returns empty array for trail with no reviews
- [ ] `updateReview`: updates body, rating, conditions
- [ ] `deleteReview`: removes review
- [ ] `getAverageRating(trailId)`: calculates correct average
- [ ] `getAverageRating(trailId)`: returns null for trail with no reviews
- [ ] `getReviewCount(trailId)`: returns correct count
- [ ] `getRecentConditions(trailId)`: returns conditions from most recent review
- [ ] `parseConditions(json)`: correctly parses JSON array
- [ ] `getRatingDistribution(trailId)`: returns correct count per star level

### Integration Tests
- [ ] Full flow: write review -> save -> verify appears in trail detail
- [ ] Edit flow: write review -> edit -> verify changes persisted
- [ ] Delete flow: write review -> delete -> verify review gone and average recalculated
- [ ] Recording prompt: complete recording -> tap quick-rate -> verify review created with recording link
- [ ] Cascade: delete trail -> verify all reviews deleted

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to a trail with no reviews
3. Verify: "Be the first to review" shown
4. Tap "Write Review"
5. Select 4 stars, add title "Great views," add body text, select "Clear" and "Well-maintained" conditions
6. Verify: share toggle is OFF by default -- corresponds to AC-9
7. Save the review
8. Verify: trail detail shows 4.0 stars, 1 review, "Clear" and "Well-maintained" condition tags -- corresponds to AC-1, AC-2, AC-3, AC-4
9. Write a second review with 5 stars
10. Verify: average shows 4.5 stars, 2 reviews -- corresponds to AC-3
11. View the review list
12. Verify: newest review is first -- corresponds to AC-5
13. Record the trail, complete the recording
14. Verify: "Rate your hike?" prompt appears -- corresponds to AC-6
15. Tap 5 stars in the quick-rate
16. Verify: review created and linked to the recording
17. Edit the first review, change rating to 3 stars
18. Verify: average recalculates -- corresponds to AC-7
19. Delete a review
20. Verify: review removed, count and average updated -- corresponds to AC-7
21. Check the trail card in the trails list
22. Verify: star rating shown on the card -- corresponds to AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to trail detail reviews section, verify all states

### Required: Complexity <= 2 (this feature is Complexity 1 = Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate privacy model and future sharing architecture.

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails have difficulty ratings but no user reviews or condition reports
- No way to remember subjective trail quality across visits
- Trail selection is based on distance/elevation only

### After This Work
- New V10 migration adds `tr_reviews` table
- Trail detail shows review summary, condition tags, and review list
- Users can write, edit, and delete reviews with star ratings and conditions
- Post-recording review prompt for quick rating
- Trail cards show average rating
- All reviews local-only with opt-in sharing flag for future community features

### Files Changed
- `modules/trails/src/types.ts` -- New `TrailReview`, `ReviewSummary`, `CreateReviewInput` schemas
- `modules/trails/src/db/schema.ts` -- V10 migration SQL
- `modules/trails/src/db/crud.ts` -- CRUD for reviews (create, get, update, delete, aggregates)
- `modules/trails/src/definition.ts` -- Add V10 migration
- `modules/trails/src/index.ts` -- Export review functions
- `apps/mobile/app/(trails)/trail-detail.tsx` -- Reviews section
- `apps/mobile/app/(trails)/write-review.tsx` -- Review composition screen
- `apps/web/app/trails/page.tsx` -- Reviews section

### Known Limitations
- **Local-only in V1:** Reviews are stored on-device. No community sharing, no reading other users' reviews. The `is_shared` flag is a forward-looking design for when community features are added.
- **No photos in reviews:** AllTrails reviews often include photos. V1 is text + rating + conditions only. Photo reviews are a future enhancement (could link to `tr_photos`).
- **No moderation:** Since reviews are local-only, moderation is not needed. If community sharing is added later, moderation tools will be required.
- **No import from AllTrails:** Users cannot import their AllTrails reviews. Manual re-entry is the only option.

### Context for Next Agent
- Conditions are stored as a JSON array in a TEXT column: `["muddy", "clear"]`. Use `JSON.parse`/`JSON.stringify` for read/write. Do not store as comma-separated strings.
- The `is_shared` flag is intentionally stored now even though V1 doesn't upload. When community features are added, reviews with `is_shared = 1` can be batch-uploaded with user consent. This avoids needing users to retroactively flag reviews.
- Average rating should round to 1 decimal place for display. Use `Math.round(avg * 10) / 10`.
- The post-recording review prompt should be non-blocking. If the user dismisses it, no review is created. It should not interfere with saving the recording.
- Condition tags are a fixed list in V1. Do not allow free-text conditions (prevents data quality issues for future community aggregation).
