# Feature Spec: Community Challenges

## Metadata
- **Module:** books
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** BK-006 (Reading Sessions -- implemented), BK-013 (Reading Challenges -- implemented, local personal challenges)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Goodreads' Reading Challenge is their most viral feature, generating millions of social shares annually. StoryGraph has community-wide reading challenges that drive engagement even among users who don't use social features. MyBooks already has a personal challenge system (BK-013 with `bk_challenges` and `bk_challenge_progress` tables) but no community dimension. Community challenges add a shared competitive/cooperative element: users see how many participants joined, aggregate progress, and feel part of a reading community without sacrificing privacy. Crucially, community challenges can work in both local (preset challenge templates) and connected (live participant counts via Supabase) modes.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Goodreads | Yes | Free | Annual Reading Challenge (how many books this year). Very basic: one challenge per year. Extremely viral. |
| StoryGraph | Yes | Free | Community challenges: themed reading prompts (Read a book from every continent, etc.). User-created challenges. |
| Bookly | No | N/A | Personal goals only, no community element. |
| Literal | No | N/A | No challenge features. |

### Target User
Readers who are motivated by community participation and shared goals. These users set annual reading goals on Goodreads and share their progress. They join StoryGraph reading prompts for themed exploration. Community challenges give them the same social motivation within MyBooks while keeping their actual reading data private (only participation and completion status are shared, never specific books or ratings).

## Technical Context

### Where This Lives in MyLife

```
modules/books/src/community-challenges/            -- NEW: community challenge engine
modules/books/src/community-challenges/types.ts     -- CommunityChallenge, Participation, template types
modules/books/src/community-challenges/templates.ts -- Preset challenge templates (seasonal, annual, themed)
modules/books/src/community-challenges/engine.ts    -- Join/leave, progress tracking, template matching
modules/books/src/community-challenges/index.ts     -- Barrel export
modules/books/src/community-challenges/__tests__/   -- Tests
modules/books/src/db/community-challenges.ts        -- NEW: SQLite CRUD
apps/mobile/app/(books)/community-challenges.tsx    -- Mobile community challenges screen
apps/web/app/books/community-challenges/page.tsx    -- Web community challenges page
```

### Wireframe Position

```
Hub Dashboard
  └── MyBooks card
       └── Stats tab
            └── "Community Challenges" section (active challenges count)
                 └── Tap to browse challenges ← YOU ARE HERE
```

### Data Model

Two new local tables (migration V5 or V6, coordinate with clubs/badges):

```sql
-- Community Challenge Templates
CREATE TABLE IF NOT EXISTS bk_community_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type TEXT NOT NULL
    CHECK (challenge_type IN ('books_count', 'pages_count', 'themed', 'genre_diversity', 'author_diversity')),
  target_value INTEGER NOT NULL,
  target_unit TEXT NOT NULL
    CHECK (target_unit IN ('books', 'pages', 'genres', 'authors')),
  time_frame TEXT NOT NULL
    CHECK (time_frame IN ('monthly', 'quarterly', 'yearly', 'seasonal', 'custom')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  theme_prompt TEXT,
  theme_tags TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  is_preset INTEGER NOT NULL DEFAULT 1,
  participant_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local'
    CHECK (source IN ('local', 'community')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User participation in community challenges
CREATE TABLE IF NOT EXISTS bk_community_challenge_participation (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES bk_community_challenges(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  current_value INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS bk_community_challenges_type_idx ON bk_community_challenges(challenge_type);
CREATE INDEX IF NOT EXISTS bk_community_challenges_timeframe_idx ON bk_community_challenges(time_frame);
CREATE INDEX IF NOT EXISTS bk_community_challenges_active_idx ON bk_community_challenges(start_date, end_date);
CREATE INDEX IF NOT EXISTS bk_community_challenge_participation_challenge_idx ON bk_community_challenge_participation(challenge_id);
CREATE INDEX IF NOT EXISTS bk_community_challenge_participation_status_idx ON bk_community_challenge_participation(status);
```

Optional Supabase table for connected mode (participant counts):

```sql
-- Supabase: aggregate participation counts (no personal data)
CREATE TABLE IF NOT EXISTS community_challenge_stats (
  challenge_template_id TEXT PRIMARY KEY,
  participant_count INTEGER NOT NULL DEFAULT 0,
  completion_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Dependencies
- **Internal:** `@mylife/db`, existing challenge engine (`challenges/challenge-engine.ts`), reading sessions, books, mood tags (for genre diversity)
- **External:** Supabase (optional, for live participant counts in connected mode)
- **Cross-Module:** Could contribute to `crossModule.getActivityFeed()` when a user completes a community challenge

## Functional Requirements

### User Stories
1. As a reader, I want to browse available community reading challenges so that I can find motivating goals to work toward.
2. As a reader, I want to join a challenge and track my progress toward the goal so that I feel part of a larger reading community.
3. As a competitive reader, I want to see how many other readers are participating in a challenge so that I feel motivated by the community.
4. As a thematic reader, I want themed challenges (e.g., "Read books from 5 continents") so that I explore outside my comfort zone.
5. As a reader, I want seasonal challenges that refresh quarterly so that there is always something new to work toward.

### Behavior Specification

1. User navigates to Stats tab > "Community Challenges" section.
2. Section shows: active challenge count, next upcoming challenge preview.
3. User taps to view the Community Challenges screen.
4. Screen shows three sections:
   - **Active Challenges** -- challenges the user has joined, with progress bars
   - **Available Challenges** -- challenges the user can join (preset + community if connected)
   - **Completed Challenges** -- past challenges the user finished
5. Each challenge card shows: name, description, difficulty badge (easy/medium/hard/extreme), time remaining, participant count, progress bar (if joined).
6. User taps "Join" on an available challenge.
7. Participation record created. Challenge moves to "Active Challenges" section.
8. As the user reads books matching the challenge criteria, progress auto-updates:
   - `books_count` / `pages_count`: same auto-logging as personal challenges (BK-013)
   - `genre_diversity`: counts distinct genres in finished books during the challenge period
   - `author_diversity`: counts distinct authors in finished books during the challenge period
   - `themed`: manual check-off or auto-match based on `theme_tags` against book mood/genre tags
9. When target is met, status changes to 'completed'. Celebration notification (can reuse badge celebration pattern).
10. User can abandon a challenge (confirmation dialog). Status set to 'abandoned'.
11. Preset challenges refresh seasonally. New templates are seeded on migration or app update.

### Edge Cases

- **Challenge period expired without completion:** Status remains 'active' but marked as expired. User can view their partial progress. No negative consequence.
- **User joins challenge after start date:** Allowed. Progress is computed from the join date (or from the challenge start date for time-based challenges). Join date recorded.
- **User finishes challenge early:** Status set to 'completed' immediately. Can continue reading but progress stops counting.
- **Themed challenge auto-matching:** If `theme_tags` is set (e.g., "science fiction, dystopian"), auto-match books whose mood_tags or subjects overlap. For challenges without tags, user manually marks books as counting toward the challenge.
- **Genre diversity counting:** Uses `bk_mood_tags WHERE tag_type = 'genre'` on finished books within the challenge time period.
- **No network for participant counts:** Show local-only data. Participant count displays "1" (just the user) or cached count.
- **Multiple active challenges:** No limit on concurrent active challenges.
- **Challenge with 0 participants:** Still joinable. Participant count starts at 1 when user joins.
- **Module disabled mid-challenge:** Progress paused but data preserved. Resumes when re-enabled.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Community Challenges screen shows Active, Available, and Completed sections.
- [ ] **AC-2:** At least 12 preset challenges are available (3 per season or 1 per month).
- [ ] **AC-3:** Each challenge card shows name, description, difficulty, time remaining, and participant count.
- [ ] **AC-4:** User can join a challenge by tapping "Join". Challenge moves to Active section.
- [ ] **AC-5:** Progress auto-updates when the user finishes a book matching challenge criteria.
- [ ] **AC-6:** books_count challenges increment when any book is finished during the challenge period.
- [ ] **AC-7:** genre_diversity challenges count distinct genres from finished books during the period.
- [ ] **AC-8:** themed challenges auto-match books based on theme_tags overlap with book mood/genre tags.
- [ ] **AC-9:** Completing a challenge shows a celebration notification.
- [ ] **AC-10:** User can abandon a challenge with confirmation.
- [ ] **AC-11:** Expired challenges show "Expired" badge with partial progress visible.
- [ ] **AC-12:** Completed challenges appear in the "Completed" section with completion date.

### Technical Criteria
- [ ] **TC-1:** Migration creates `bk_community_challenges` and `bk_community_challenge_participation` tables with indexes.
- [ ] **TC-2:** At least 12 preset challenge templates are seeded on migration.
- [ ] **TC-3:** Auto-progress for `books_count`: reuse `logBookCompletion` pattern from existing challenge engine, filtered by challenge time period.
- [ ] **TC-4:** Auto-progress for `genre_diversity`: `SELECT COUNT(DISTINCT mt.value) FROM bk_mood_tags mt JOIN bk_reading_sessions rs ON mt.book_id = rs.book_id WHERE mt.tag_type = 'genre' AND rs.status = 'finished' AND rs.finished_at BETWEEN ? AND ?`.
- [ ] **TC-5:** Auto-progress for `author_diversity`: count distinct parsed authors from finished books in period.
- [ ] **TC-6:** Themed challenge auto-match: `theme_tags` JSON array compared against book's `bk_mood_tags` values. Match if any tag overlaps.
- [ ] **TC-7:** Challenge expiry computed as `end_date < current_date AND status = 'active'`.
- [ ] **TC-8:** Optional Supabase sync increments `community_challenge_stats.participant_count` on join and `completion_count` on complete.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Community challenges must NOT share which specific books a user read. Only participation status and progress count are visible.
- [ ] **NC-2:** Joining/leaving challenges must NOT affect the user's personal challenge data (BK-013 `bk_challenges` and `bk_challenge_progress`).
- [ ] **NC-3:** Auto-progress must NOT count books finished outside the challenge time period.
- [ ] **NC-4:** Community challenges must NOT require network connectivity for core functionality (local preset mode).

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Challenge cards: `rgba(255,255,255,0.04)` (glass) with `rgba(255,255,255,0.10)` border
- Difficulty badges: easy (green `#30D158`), medium (amber `#FF9F0A`), hard (orange `#FF6B35`), extreme (red `#FF453A`)
- Progress bar: accent color `#C9894D` fill on `rgba(255,255,255,0.1)` track
- Participant count: people icon + count in textSecondary
- Time remaining: clock icon + "12 days left" or "Expired" badge (red)
- Section headers: 18px semibold, text token
- "Join" button: accent color, rounded pill
- "Abandon" button: danger color `#FF453A`, requires confirmation dialog

### Web (Next.js)

- Route: `/books/community-challenges`
- Same tokens via CSS variables
- Grid layout: 2 columns for challenge cards on desktop, 1 on mobile
- Filter bar: by difficulty, by type, by status (active/available/completed)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton challenge cards | Initial data fetch |
| Empty | "No community challenges yet. Check back soon!" | No presets seeded (should not happen after migration) |
| Error | "Could not load challenges. Pull down to retry." | Database read failure |
| Success | Active/Available/Completed sections with challenge cards | Challenges exist |
| Partial | Available challenges shown, no active or completed | User hasn't joined any yet |

## Test Requirements

### Unit Tests
- [ ] `joinChallenge`: creates participation record with status 'active' and joined_at
- [ ] `abandonChallenge`: sets status to 'abandoned' with confirmation
- [ ] `completeChallenge`: sets status to 'completed' and completed_at when target met
- [ ] `autoProgressBooksCount`: finishing a book increments books_count challenges
- [ ] `autoProgressGenreDiversity`: finishing books in 3 genres shows current_value = 3
- [ ] `autoProgressAuthorDiversity`: finishing books by 5 authors shows current_value = 5
- [ ] `autoProgressThemed`: finishing a book with matching theme_tags increments progress
- [ ] `doesNotCountOutsidePeriod`: book finished before challenge start_date not counted
- [ ] `challengeExpiry`: challenge past end_date with active status shows as expired
- [ ] `multipleActiveChallenges`: user can join 5 challenges simultaneously
- [ ] `presetTemplatesSeeded`: after migration, at least 12 presets exist
- [ ] `participantCountIncrement`: joining a challenge increments participant_count

### Integration Tests
- [ ] Full flow: seed presets -> join challenge -> finish books -> verify progress -> complete challenge -> verify celebration
- [ ] Expiry flow: join challenge -> pass end_date -> verify expired state with partial progress

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyBooks > Stats tab
3. Verify: "Community Challenges" section visible
4. Tap to view Community Challenges screen
5. Verify: Available section shows at least 12 preset challenges -- corresponds to AC-1, AC-2
6. Verify: each card shows name, difficulty badge, time remaining, participant count -- corresponds to AC-3
7. Tap "Join" on a books_count challenge (e.g., "Read 5 Books This Month")
8. Verify: challenge moves to Active section with progress 0/5 -- corresponds to AC-4
9. Finish a book (mark reading session as 'finished')
10. Navigate back to Community Challenges
11. Verify: progress shows 1/5 -- corresponds to AC-5, AC-6
12. Join a genre_diversity challenge (e.g., "Read from 5 Different Genres")
13. Finish books in 3 different genres
14. Verify: genre diversity progress shows 3/5 -- corresponds to AC-7
15. Join a themed challenge (e.g., "Science Fiction Month")
16. Finish a book with "science fiction" mood tag
17. Verify: themed challenge progress increments -- corresponds to AC-8
18. Complete any challenge by reaching the target
19. Verify: celebration notification appears -- corresponds to AC-9
20. Verify: challenge moves to Completed section -- corresponds to AC-12
21. Tap "Abandon" on an active challenge
22. Confirm abandonment
23. Verify: challenge removed from Active section -- corresponds to AC-10
24. Open the app on web
25. Navigate to Books > Community Challenges
26. Verify: same sections and functionality work

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /books/community-challenges, join a challenge, verify all 5 states

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for community challenge progress engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- verify hub module integrity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The books module has a personal challenge system (BK-013: `bk_challenges`, `bk_challenge_progress`, `challenge-engine.ts`) that supports books_count, pages_count, minutes_count, and themed challenges with auto-progress logging. No community dimension exists.

### After This Work
Two new tables (`bk_community_challenges`, `bk_community_challenge_participation`) exist with 12+ preset challenge templates seeded. A `community-challenges/` directory contains the engine for joining, tracking, and completing community challenges with auto-progress for 5 challenge types. Mobile and web UIs allow browsing, joining, and tracking community challenges.

### Files Changed
- `modules/books/src/db/schema.ts` -- add CREATE_COMMUNITY_CHALLENGES, CREATE_COMMUNITY_CHALLENGE_PARTICIPATION, indexes
- `modules/books/src/definition.ts` -- add community challenge tables to migration V5/V6, seed preset templates
- `modules/books/src/db/community-challenges.ts` -- CRUD for community challenge and participation tables
- `modules/books/src/community-challenges/types.ts` -- CommunityChallenge, Participation, ChallengeDifficulty types
- `modules/books/src/community-challenges/templates.ts` -- 12+ preset challenge definitions
- `modules/books/src/community-challenges/engine.ts` -- joinChallenge, updateProgress, checkCompletion, getGenreDiversity, getAuthorDiversity
- `modules/books/src/community-challenges/index.ts` -- barrel export
- `modules/books/src/community-challenges/__tests__/engine.test.ts` -- 12+ unit tests
- `modules/books/src/models/schemas.ts` -- add CommunityChallenge, Participation Zod schemas
- `modules/books/src/index.ts` -- re-export community-challenges module
- `apps/mobile/app/(books)/community-challenges.tsx` -- mobile community challenges screen
- `apps/web/app/books/community-challenges/page.tsx` -- web community challenges page

### Known Limitations
- Preset challenges only in V1. User-created community challenges are deferred.
- Participant counts are local-only (just the user) unless Supabase integration is active.
- No leaderboard or competitive ranking between participants.
- Themed challenge auto-matching depends on books having mood/genre tags. Books without tags require manual progress logging.

### Context for Next Agent
- The existing personal challenge engine at `modules/books/src/challenges/challenge-engine.ts` has `logBookCompletion(db, bookId, pageCount)` and `logReadingMinutes(db, bookId, minutes)`. Reuse the same event hooks to also update community challenge progress.
- Do NOT modify the personal challenge tables (`bk_challenges`, `bk_challenge_progress`). Community challenges are a separate system.
- Migration coordination: if badges and clubs also add V5 tables, combine all into one migration or sequence. Community challenge tables should come after club and badge tables.
- Preset templates should cover variety: monthly book count (easy), quarterly page count (medium), seasonal themed (medium), annual genre diversity (hard), annual author diversity (hard), and annual book count targets (extreme for high counts).
- Genre diversity uses `bk_mood_tags WHERE tag_type = 'genre'`. Author diversity parses the JSON `authors` column from `bk_books`. Both filter to books finished within the challenge time period.

### Preset Challenge Templates (12 minimum)

| ID | Name | Type | Target | Unit | Timeframe | Difficulty |
|---|---|---|---|---|---|---|
| cc_monthly_5 | Read 5 Books This Month | books_count | 5 | books | monthly | easy |
| cc_monthly_1000 | 1,000 Pages This Month | pages_count | 1000 | pages | monthly | medium |
| cc_quarterly_15 | 15 Books This Quarter | books_count | 15 | books | quarterly | medium |
| cc_yearly_52 | Book a Week (52 in a Year) | books_count | 52 | books | yearly | hard |
| cc_yearly_100 | Century Club (100 Books) | books_count | 100 | books | yearly | extreme |
| cc_genre_5 | Genre Explorer | genre_diversity | 5 | genres | quarterly | easy |
| cc_genre_10 | Genre Master | genre_diversity | 10 | genres | yearly | medium |
| cc_author_10 | Author Sampler | author_diversity | 10 | authors | quarterly | easy |
| cc_author_25 | Author Explorer | author_diversity | 25 | authors | yearly | medium |
| cc_themed_scifi | Science Fiction Month | themed | 3 | books | monthly | easy |
| cc_themed_classic | Classics Quarter | themed | 5 | books | quarterly | medium |
| cc_themed_diverse | Around the World in Books | themed | 7 | books | yearly | hard |
