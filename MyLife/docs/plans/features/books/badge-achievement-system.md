# Feature Spec: Badge/Achievement System

## Metadata
- **Module:** books
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** BK-006 (Reading Sessions -- implemented), BK-009 (Reading Statistics -- implemented), BK-013 (Reading Challenges -- implemented), BK-014 (Encrypted Journal -- implemented)
- **Blocks:** Badge sharing (could integrate with BK-027 Reading Stats Sharing)

## Business Context

### Why This Feature Exists
Gamification drives retention. Goodreads' Reading Challenge badge is the single most-shared feature on the platform, and Bookly's achievement system is cited as a key reason users maintain their subscription. Badges create emotional investment: once a user earns a 365-day streak badge, they are far less likely to switch apps. MyBooks already has the data to power a rich badge system (reading sessions, reviews, challenges, journal entries, genre diversity) but no achievement layer exists. Adding badges is relatively low complexity (pure computation from existing data) with high retention impact.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Goodreads | Yes | Free | Annual Reading Challenge badge. Limited to 1 achievement per year. |
| Bookly | Yes | $30/yr | Multi-category achievements: books read, pages, streaks, reading time. Tiered (bronze/silver/gold). |
| StoryGraph | No | N/A | No badge system. Stats only. |
| Literal | No | N/A | No gamification features. |

### Target User
Habit-forming readers who respond to milestone rewards. These are users who track reading streaks, set annual goals, and feel satisfaction from completing challenges. The badge system gives them ongoing milestones beyond the annual reading goal. Primary migration target: Bookly users ($30/yr) who would switch to MyBooks for the same achievement system without the subscription.

## Technical Context

### Where This Lives in MyLife

```
modules/books/src/badges/                       -- NEW: badge engine + definitions
modules/books/src/badges/types.ts               -- Badge, BadgeDefinition, BadgeCategory, EarnedBadge types
modules/books/src/badges/definitions.ts         -- 31 badge definitions (complete catalog)
modules/books/src/badges/badge-engine.ts         -- Badge evaluation, stat gathering, award logic
modules/books/src/badges/index.ts               -- Barrel export
modules/books/src/badges/__tests__/             -- Tests
modules/books/src/db/badges.ts                  -- NEW: SQLite CRUD for badge table
apps/mobile/app/(books)/badges.tsx              -- Mobile badges screen
apps/web/app/books/badges/page.tsx              -- Web badges page
```

### Wireframe Position

```
Hub Dashboard
  └── MyBooks card
       └── Stats tab
            └── "Badges" section (earned count + latest badge)
                 └── Tap to view all badges ← YOU ARE HERE
```

### Data Model

One new table in migration V5:

```sql
CREATE TABLE IF NOT EXISTS bk_badges (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('volume', 'pages', 'genre', 'author', 'streak', 'challenge', 'speed', 'review', 'journal')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tier TEXT NOT NULL
    CHECK (tier IN ('bronze', 'silver', 'gold')),
  threshold INTEGER NOT NULL,
  icon TEXT NOT NULL,
  earned_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS bk_badges_category_idx ON bk_badges(category);
CREATE INDEX IF NOT EXISTS bk_badges_earned_idx ON bk_badges(earned_at) WHERE earned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS bk_badges_tier_idx ON bk_badges(tier);
```

Badge definitions are seeded on migration. Each row represents a badge that can be earned. `earned_at` is NULL until earned.

### Dependencies
- **Internal:** `@mylife/db`, books stats engine, challenge engine, reading sessions, reviews, journal entries
- **External:** none (fully local computation)
- **Cross-Module:** none (books-internal, but badge count could feed into `crossModule.getDataSummary()`)

## Functional Requirements

### User Stories
1. As a reader, I want to earn badges when I hit reading milestones (10 books, 50 books, etc.) so that I feel rewarded for my reading habits.
2. As a reader, I want to see my progress toward unearned badges so that I know what to work toward next.
3. As a reader who just earned a badge, I want a celebratory notification so that the achievement feels meaningful.
4. As a reader, I want to browse all possible badges by category so that I can see what achievements are available.

### Behavior Specification

1. On app launch or after relevant events (book finished, review written, challenge completed, journal entry created), the badge engine evaluates all unearned badges.
2. If any badge threshold is newly met, the badge's `earned_at` is set to the current timestamp.
3. A celebration toast/modal appears with the badge icon, name, tier, and a brief confetti animation (1-2 seconds).
4. If multiple badges are earned simultaneously, they queue and display one after another.
5. User navigates to Stats tab > "Badges" section showing: earned count / total count, latest earned badge.
6. User taps to view the full Badges screen.
7. Badges screen shows a 4-column grid. Category tab bar at top: All, Volume, Pages, Genres, Authors, Streaks, Challenges, Speed, Reviews, Journal.
8. Earned badges: full color icon with tier border color (bronze/silver/gold), earned date below.
9. Unearned badges: grayed out icon, progress indicator (e.g., "7/10 books").
10. Tap any badge: expanded detail with name, description, criteria, progress bar, and earned date (if earned).

### Edge Cases

- **New user with no activity:** All 31 badges show as unearned with 0 progress. Message: "Start reading to earn your first badge!"
- **Multiple badges earned at once:** Queue celebration notifications. Show them one by one with a brief delay.
- **Book deleted after badge earned:** Badge remains earned. Badges are never revoked.
- **Challenge badge when challenges feature is unused:** Challenge badges show 0/N progress. No special handling needed.
- **Speed badge edge case:** "Finish a book in 1 day" means started_at and finished_at are on the same calendar day (not 24 hours). Handle timezone correctly.
- **Journal badge count includes encrypted entries:** Count all journal entries regardless of encryption status.
- **Streak badge:** Requires streak calculation from `bk_timed_sessions` and `bk_progress_updates`. If no timed sessions exist, streak is 0.
- **Module re-enabled after disable:** Badge state is preserved in SQLite. Re-evaluation on next event.
- **Badge table not yet seeded:** First migration seeds all 31 badge definitions with `earned_at = NULL`.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** When a user finishes their 10th book, the "First Steps" (volume_10) badge is awarded with a celebration notification.
- [ ] **AC-2:** Badges screen shows a 4-column grid with category tab bar filtering.
- [ ] **AC-3:** Earned badges display in full color with tier-colored border and earned date.
- [ ] **AC-4:** Unearned badges display grayed out with progress indicator (e.g., "7/10").
- [ ] **AC-5:** Tapping a badge shows expanded detail: name, description, criteria, progress, earned date.
- [ ] **AC-6:** Multiple simultaneously earned badges show celebrations one after another.
- [ ] **AC-7:** Category tab bar filters badges by category (All, Volume, Pages, etc.).
- [ ] **AC-8:** Stats tab shows a "Badges" summary section with earned count and latest badge.
- [ ] **AC-9:** New user sees all badges grayed out with "Start reading to earn your first badge!" prompt.
- [ ] **AC-10:** Celebration notification includes badge icon, name, tier, and brief confetti animation.

### Technical Criteria
- [ ] **TC-1:** Migration V5 creates `bk_badges` table and seeds all 31 badge definitions.
- [ ] **TC-2:** Badge evaluation runs on: book finished, review written, challenge completed, journal entry created.
- [ ] **TC-3:** Already-earned badges (earned_at IS NOT NULL) are skipped during evaluation.
- [ ] **TC-4:** Volume badges count finished sessions: `SELECT COUNT(DISTINCT book_id) FROM bk_reading_sessions WHERE status = 'finished'`.
- [ ] **TC-5:** Page badges sum page counts: `SELECT SUM(b.page_count) FROM bk_books b JOIN bk_reading_sessions rs ON b.id = rs.book_id WHERE rs.status = 'finished'`.
- [ ] **TC-6:** Genre badges count distinct genres: `SELECT COUNT(DISTINCT value) FROM bk_mood_tags WHERE tag_type = 'genre' AND book_id IN (finished book ids)`.
- [ ] **TC-7:** Author badges count distinct authors from finished books.
- [ ] **TC-8:** Speed badges check: `julianday(finished_at) - julianday(started_at) <= threshold` for each finished session.
- [ ] **TC-9:** Badge evaluation completes in under 200ms for a library of 500 books.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Badges must NEVER be revoked once earned, even if the triggering data is deleted.
- [ ] **NC-2:** Badge evaluation must NOT run on unrelated events (e.g., tag added, shelf changed).
- [ ] **NC-3:** Badge celebration must NOT block app interaction. Dismiss after 3 seconds or on tap.
- [ ] **NC-4:** Badge data must NOT require network connectivity.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Badge grid: 4 columns, 8px gaps, badge icon 64x64px
- Earned badge border: bronze (`#CD7F32`), silver (`#C0C0C0`), gold (`#FFD700`)
- Unearned badge: grayscale filter, `rgba(255,255,255,0.04)` background
- Progress indicator below unearned badge: `rgba(240,240,245,0.65)` (textSecondary), 10px
- Category tab bar: horizontal scroll, glass pill style, selected = accent color `#C9894D`
- Celebration toast: centered modal, glass background with expo-blur, badge icon 96px, confetti (react-native-confetti-cannon or similar), auto-dismiss 3s
- Module accent: `#C9894D`

### Web (Next.js)

- Route: `/books/badges`
- Same grid layout, responsive (4 columns desktop, 3 tablet, 2 mobile)
- Badge hover state: slight scale + glow
- Celebration: CSS confetti animation, glass modal overlay

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton badge grid | Initial data fetch |
| Empty | All badges grayed with "Start reading to earn your first badge!" | New user, no activity |
| Error | "Could not load badges. Pull down to retry." | Database read failure |
| Success | Mix of earned (color) and unearned (gray) badges | User has some activity |
| Celebration | Modal with badge icon, confetti, "You earned a new badge!" | Badge threshold met |

## Test Requirements

### Unit Tests
- [ ] `awardsBadgeAtThreshold`: totalBooks = 10 triggers volume_10 badge
- [ ] `doesNotAwardBelowThreshold`: totalBooks = 9 does not trigger volume_10
- [ ] `skipsAlreadyEarned`: volume_10 already earned, totalBooks = 11, no duplicate award
- [ ] `awardsMultipleSimultaneously`: totalBooks = 50 earns volume_10, volume_25, volume_50 all at once
- [ ] `streakBadge`: 7 consecutive days with sessions triggers streak_7
- [ ] `speedBadge1Day`: book finished same day as started triggers speed_1day
- [ ] `speedBadge3Day`: book finished within 3 days triggers speed_3day
- [ ] `genreBadge`: 5 distinct genre tags on finished books triggers genre_5
- [ ] `authorBadge`: 10 unique authors across finished books triggers author_10
- [ ] `reviewBadge`: 10 reviews triggers review_10
- [ ] `journalBadge`: 10 journal entries triggers journal_10
- [ ] `challengeBadge`: 1 completed challenge triggers challenge_1
- [ ] `neverRevoked`: deleting a book does not un-earn a badge
- [ ] `progressCalculation`: 7 books shows "7/10" for volume_10

### Integration Tests
- [ ] Full flow: finish 10th book -> badge engine evaluates -> volume_10 earned -> celebration shown
- [ ] Bulk evaluation: seed data with stats crossing multiple thresholds -> verify all badges earned correctly

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyBooks > Stats tab
3. Verify: "Badges" section shows "0 / 31 badges earned" -- corresponds to AC-9
4. Tap to view Badges screen
5. Verify: 4-column grid of grayed out badges -- corresponds to AC-2, AC-4
6. Verify: category tab bar visible (All, Volume, Pages, etc.) -- corresponds to AC-7
7. Tap a badge
8. Verify: expanded detail shows name, description, criteria, "0/10" progress -- corresponds to AC-5
9. Go back, finish 10 books (can seed via import or manual creation)
10. Verify: celebration notification appears for "First Steps" badge -- corresponds to AC-1, AC-10
11. Navigate to Badges screen
12. Verify: "First Steps" badge is now in full color with bronze border and earned date -- corresponds to AC-3
13. Tap category "Volume"
14. Verify: only volume badges shown -- corresponds to AC-7
15. Write 10 reviews
16. Verify: "Critic" badge celebration appears
17. Navigate to Badges screen
18. Verify: both badges shown earned, progress updated on all badges -- corresponds to AC-4
19. Delete a book that contributed to the 10-book count
20. Verify: "First Steps" badge is STILL earned -- corresponds to NC-1
21. Open the app on web
22. Navigate to Books > Badges
23. Verify: same badge grid and category filtering works

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /books/badges, verify all 5 states including celebration

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the badge evaluation engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- verify hub module integrity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No badge or achievement system exists. The SPEC-mybooks.md defines BK-026 with 31 badge definitions across 9 categories with bronze/silver/gold tiers. All prerequisite data (reading sessions, reviews, challenges, journal entries) is already collected.

### After This Work
A `bk_badges` table exists with 31 seeded badge definitions. A `badges/` directory contains the badge engine that evaluates thresholds on relevant events. Mobile and web UIs show a browsable badge grid with progress indicators and celebration notifications.

### Files Changed
- `modules/books/src/db/schema.ts` -- add CREATE_BADGES, CREATE_BADGE_INDEXES, SEED_BADGES
- `modules/books/src/definition.ts` -- add badge table to BOOKS_MIGRATION_V5 (coordinate with clubs migration), increment schemaVersion
- `modules/books/src/db/badges.ts` -- badge CRUD: getAll, getEarned, getByCategory, awardBadge
- `modules/books/src/badges/types.ts` -- Badge, BadgeDefinition, BadgeCategory, BadgeProgress types
- `modules/books/src/badges/definitions.ts` -- 31 badge definition constants
- `modules/books/src/badges/badge-engine.ts` -- evaluateBadges, gatherStats, awardNewBadges functions
- `modules/books/src/badges/index.ts` -- barrel export
- `modules/books/src/badges/__tests__/badge-engine.test.ts` -- 14+ unit tests
- `modules/books/src/models/schemas.ts` -- add Badge Zod schema
- `modules/books/src/index.ts` -- re-export badges module
- `apps/mobile/app/(books)/badges.tsx` -- mobile badges screen
- `apps/web/app/books/badges/page.tsx` -- web badges page

### Known Limitations
- Streak badges require streak calculation from timed sessions and progress updates. If BK-030 (Reading Streak Tracking) is built first, reuse its streak computation. Otherwise, implement inline.
- No cloud sync for badges. If user reinstalls, badges are re-evaluated from local data on first launch.
- Badge icons are emoji-based. Custom badge artwork is deferred.
- No badge sharing (integration with Stats Sharing is a future enhancement).

### Context for Next Agent
- Migration V5 coordination: if Book Clubs spec also adds V5 tables, combine both into a single V5 migration in `definition.ts`. Order: club tables first, then badge table, then seeds.
- Badge seed data should use INSERT OR IGNORE to be idempotent.
- The 31 badge definitions are listed in the SPEC-mybooks.md under BK-026, section 3.7. Use those exact IDs, names, thresholds, and tiers.
- Speed badges require comparing `started_at` and `finished_at` from `bk_reading_sessions`. Use `julianday()` SQLite function for day-based comparison.
- Genre count uses `bk_mood_tags WHERE tag_type = 'genre'`. Author count parses the `authors` JSON column from `bk_books`.
- Call `evaluateBadges(db)` after: book status changes to 'finished', review created, challenge completed, journal entry created.
