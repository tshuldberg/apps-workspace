# Feature Spec: Match Game

## Metadata
- **Module:** flash
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** FL-001 (Flashcard Creation -- implemented), FL-003 (Deck Organization -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Quizlet's Match game is one of their most-used features and a key differentiator that keeps students engaged. It turns flashcard study into a fast-paced, timed game that activates different neural pathways than standard review. Students share best times competitively ("I got 12 seconds on my bio deck!"). Match Game is particularly effective for vocabulary and definition memorization. It requires zero new data infrastructure (uses existing cards) and is entirely client-side, making it cheap to build with high engagement impact.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Quizlet | Yes | Free | Timed matching game with front/back tiles, best time tracking, leaderboards. Flagship study mode. |
| Anki | No | N/A | No game modes. Serious study tool only. |
| Brainscape | No | N/A | No game modes. Confidence-based review only. |
| StudyFetch | No | N/A | No game modes. AI-focused. |

### Target User
Students who find standard flashcard review monotonous and want a fun, fast-paced study mode. Also competitive learners who enjoy beating their personal best times. Match Game is the "snack" study mode -- quick, fun, and reinforcing.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/match/                        -- NEW: match game engine
modules/flash/src/match/types.ts                -- MatchTile, MatchBoard, MatchGameState, MatchResult types
modules/flash/src/match/board-generator.ts      -- Board creation, card selection, tile shuffling
modules/flash/src/match/match-engine.ts         -- Game state management, match checking, scoring
modules/flash/src/match/index.ts                -- Barrel export
modules/flash/src/match/__tests__/              -- Tests
modules/flash/src/db/match-results.ts           -- NEW: CRUD for match game results
apps/mobile/app/(flash)/match-game.tsx          -- Mobile match game screen
apps/mobile/app/(flash)/match-results.tsx       -- Mobile match results screen
apps/web/app/flash/match/page.tsx               -- Web match game
apps/web/app/flash/match/results/page.tsx       -- Web match results
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Decks tab -> Deck Detail
            └── "Match Game" button (in study mode picker) ← YOU ARE HERE
```

### Data Model

Two new tables in migration V3 (coordinate with media and MC migrations):

```sql
CREATE TABLE IF NOT EXISTS fl_match_results (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  board_size INTEGER NOT NULL,
  time_ms INTEGER NOT NULL DEFAULT 0,
  mistakes INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL DEFAULT 1 CHECK (stars >= 1 AND stars <= 3),
  card_ids_json TEXT NOT NULL DEFAULT '[]',
  played_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fl_match_bests (
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  board_size INTEGER NOT NULL,
  best_time_ms INTEGER NOT NULL,
  best_stars INTEGER NOT NULL DEFAULT 1,
  achieved_at TEXT NOT NULL,
  PRIMARY KEY (deck_id, board_size)
);

CREATE INDEX IF NOT EXISTS fl_match_results_deck_idx ON fl_match_results(deck_id, played_at DESC);
```

### Dependencies
- **Internal:** `@mylife/db`, flash card CRUD (`listCardsForDeck`), types
- **External:** none (fully local, no network)
- **Cross-Module:** none (flash-internal)

## Functional Requirements

### User Stories
1. As a student, I want to play a matching game where I pair card fronts with backs against a timer so that I can study in a fun, fast-paced way.
2. As a competitive learner, I want to see my best time per deck so that I can challenge myself to improve.
3. As a user with limited time, I want to choose different board sizes so that I can play a quick 3-pair game or a longer 15-pair challenge.

### Behavior Specification

1. User navigates to a deck detail screen.
2. User taps "Match Game" in the study mode picker.
3. Board size selector appears: 6 tiles (3 pairs), 12 tiles (6 pairs, default), 20 tiles (10 pairs), 30 tiles (15 pairs).
4. If the deck has fewer cards than needed, the largest possible size is auto-selected.
5. User taps "Start".
6. **Preview phase (3 seconds):** All tiles are face-up showing content. Countdown: "3... 2... 1..."
7. **Playing phase:** All tiles flip face-down simultaneously. Timer starts at 0:00.
8. User taps a tile: it flips to reveal content (front or back of a card). First selection stays revealed.
9. User taps a second tile:
   - **Match:** Both tiles belong to the same card (one front, one back). Both glow green, then shrink/fade out (300ms). Pairs remaining decrements.
   - **No match:** Both tiles shake (200ms), pause 500ms for reading, then flip back face-down. Mistakes counter increments.
10. User taps the same tile again: deselects (flips back).
11. When all pairs are matched: timer stops, celebration animation plays, results screen appears.
12. **Results screen:** Star rating (1-3), time taken, mistakes count, personal best indicator.
13. Buttons: "Play Again" (reshuffle same deck), "Change Board Size", "Done".
14. Results saved to `fl_match_results`. If time beats previous best for this deck+size, `fl_match_bests` is updated.
15. Match Game does NOT affect FSRS scheduling. No review logs created.

### Edge Cases

- **Deck has fewer than 3 cards:** "Need at least 3 cards to play Match Game." Game unavailable.
- **Deck has 5 cards, user selects 12-tile board:** Auto-downsize to 10 tiles (5 pairs).
- **Suspended/buried cards:** Excluded from card pool.
- **Very long card text:** Truncated to 60 characters with ellipsis for tile display.
- **Cards with identical back text:** Both included (they are different cards, different fronts).
- **User navigates away mid-game:** Game is lost. No partial save. Timer resets.
- **Cloze cards:** Use rendered cloze front (with blank) as the front tile and the cloze answer as the back tile.
- **Reversed card siblings:** Only `templateOrdinal === 0` card is used (avoid duplicate content).
- **Two tiles selected rapidly (race condition):** Lock selection after second tap until match check completes.
- **Device rotation mid-game:** Board re-renders maintaining game state.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Match Game" option appears in deck study mode picker for decks with 3+ cards.
- [ ] **AC-2:** Board size selector offers 6, 12, 20, 30 tiles (auto-adjusted for small decks).
- [ ] **AC-3:** 3-second preview phase shows all tiles face-up with countdown.
- [ ] **AC-4:** After countdown, all tiles flip face-down simultaneously.
- [ ] **AC-5:** Tapping a tile flips it to reveal content with 150ms flip animation.
- [ ] **AC-6:** Matching pair glows green, then shrinks/fades out (300ms).
- [ ] **AC-7:** Non-matching pair shakes (200ms), pauses 500ms, then flips back.
- [ ] **AC-8:** Timer counts up from 0:00 during the playing phase.
- [ ] **AC-9:** Mistakes counter increments on each incorrect pair.
- [ ] **AC-10:** Results screen shows star rating, time, mistakes, and personal best.
- [ ] **AC-11:** "New Record!" badge appears when personal best is beaten.
- [ ] **AC-12:** "Play Again" reshuffles the board with the same deck.

### Technical Criteria
- [ ] **TC-1:** Board generation uses Fisher-Yates shuffle for random tile placement.
- [ ] **TC-2:** Card selection excludes suspended and buried cards.
- [ ] **TC-3:** Tile content truncated to 60 characters.
- [ ] **TC-4:** Star rating formula: for 12-tile (6 pairs): 3 stars = 0-1 mistakes AND <30s, 2 stars = 2-4 mistakes OR <60s, 1 star = 5+ mistakes OR >=60s. Scale proportionally for other sizes.
- [ ] **TC-5:** Match results saved to `fl_match_results` table.
- [ ] **TC-6:** Best times tracked per deck per board size in `fl_match_bests`.
- [ ] **TC-7:** Match Game does NOT create review logs or affect FSRS scheduling.
- [ ] **TC-8:** Selection lock prevents tapping more than 2 tiles simultaneously.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Match Game must NOT create review logs or affect card scheduling.
- [ ] **NC-2:** Must NOT allow starting with fewer than 3 cards.
- [ ] **NC-3:** Must NOT allow selecting a third tile while a match check is in progress.
- [ ] **NC-4:** Timer must NOT run during the preview phase.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Tiles: rounded rectangles, glass card style (`rgba(255,255,255,0.04)`)
- Front tiles: accent color `#FBBF24` border/indicator
- Back tiles: `rgba(255,255,255,0.08)` (slightly different shade to distinguish)
- Face-down state: solid glass with lightning bolt icon watermark
- Matched tiles: green `#30D158` glow, shrink animation
- Incorrect shake: 3x horizontal displacement (5px), 200ms
- Timer: top-right, monospace font, `#F0F0F5`
- Mistakes: top area, "Mistakes: X" in textSecondary
- Grid gaps: 8px between tiles
- Tile text: 14px, centered, max 3 lines
- Results: large star icons (filled `#FBBF24`, empty `rgba(255,255,255,0.2)`), time in 32px bold
- Module accent: `#FBBF24`

### Web (Next.js)

- Route: `/flash/match?deck=:deckId&size=:boardSize`
- Same tile grid, responsive sizing
- Click instead of tap
- Keyboard: no keyboard shortcuts (mouse/touch only game)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Config | Board size selector + "Start" button | User taps "Match Game" from deck |
| Preview | All tiles face-up, "3... 2... 1..." countdown | Game starts |
| Playing | Tiles face-down, timer running | Countdown ends |
| One Selected | One tile revealed, waiting for second | First tile tapped |
| Match | Two tiles glow green, shrink out | Correct pair tapped |
| No Match | Two tiles shake, pause, flip back | Incorrect pair tapped |
| Complete | Celebration, star rating, results | All pairs matched |
| Too Few Cards | "Need at least 3 cards" message | Deck has < 3 cards |

## Test Requirements

### Unit Tests
- [ ] `generateBoard6Tiles`: 3+ cards -> 6 tiles (3 front + 3 back), shuffled
- [ ] `generateBoard12Tiles`: 6+ cards -> 12 tiles, all unique card IDs
- [ ] `autoDownsizeBoard`: 5 cards, 12-tile request -> 10 tiles (5 pairs)
- [ ] `rejectTooFewCards`: 2 cards -> throws "Need at least 3 cards"
- [ ] `excludeSuspended`: suspended card not in tile pool
- [ ] `fisherYatesShuffle`: 100 shuffles produce different orderings (statistical test)
- [ ] `checkMatchCorrect`: tile A (front, card1) + tile B (back, card1) -> match = true
- [ ] `checkMatchIncorrect`: tile A (front, card1) + tile B (back, card2) -> match = false
- [ ] `checkMatchSameSide`: tile A (front, card1) + tile B (front, card1) -> match = false
- [ ] `starRating3Stars`: 12 tiles, 0 mistakes, 25s -> 3 stars
- [ ] `starRating2Stars`: 12 tiles, 3 mistakes, 45s -> 2 stars
- [ ] `starRating1Star`: 12 tiles, 6 mistakes, 75s -> 1 star
- [ ] `scaledStarRating`: 24 tiles, 0 mistakes, 55s -> 3 stars (2x time threshold)
- [ ] `truncateText`: 80-char text -> truncated to 60 + "..."
- [ ] `bestTimeUpdate`: new time < existing best -> best updated

### Integration Tests
- [ ] Full flow: start game -> match all pairs -> verify results saved to fl_match_results
- [ ] Best time flow: play twice -> second is faster -> verify fl_match_bests updated

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyFlash > Decks > select a deck with 10+ cards
3. Verify: "Match Game" option in study mode picker -- corresponds to AC-1
4. Tap "Match Game"
5. Verify: board size selector (6, 12, 20, 30) -- corresponds to AC-2
6. Select 12 tiles, tap "Start"
7. Verify: 3-second preview with all tiles visible and countdown -- corresponds to AC-3
8. Verify: after countdown, all tiles flip face-down -- corresponds to AC-4
9. Verify: timer starts at 0:00 -- corresponds to AC-8
10. Tap a tile
11. Verify: tile flips with animation -- corresponds to AC-5
12. Tap a matching tile
13. Verify: both glow green and shrink out -- corresponds to AC-6
14. Tap two non-matching tiles
15. Verify: both shake, pause, then flip back -- corresponds to AC-7
16. Verify: mistakes counter increments -- corresponds to AC-9
17. Complete the game (match all pairs)
18. Verify: results screen with stars, time, mistakes -- corresponds to AC-10
19. Note the time
20. Tap "Play Again"
21. Complete the game faster
22. Verify: "New Record!" badge appears -- corresponds to AC-11
23. Verify: board is reshuffled -- corresponds to AC-12
24. Try Match Game on a deck with 2 cards
25. Verify: "Need at least 3 cards" message -- corresponds to NC-2
26. Open the app on web
27. Navigate to Flash > deck > Match Game
28. Verify: same game experience with click instead of tap

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /flash/match, play a complete game, verify all states

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyFlash has only standard card review (flip + rate). No game modes exist.

### After This Work
Match Game is a fully functional timed study game accessible from any deck. Board generation, match checking, star rating, and personal best tracking are implemented. Results are persisted. Game is entirely separate from FSRS scheduling.

### Files Changed
- `modules/flash/src/db/schema.ts` -- add CREATE_MATCH_RESULTS, CREATE_MATCH_BESTS, indexes
- `modules/flash/src/definition.ts` -- add match tables to FLASH_MIGRATION_V3
- `modules/flash/src/db/match-results.ts` -- CRUD: saveMatchResult, getMatchBest, updateMatchBest, listMatchResults
- `modules/flash/src/match/types.ts` -- MatchTile, MatchBoard, MatchGameState, MatchResult, TileSide types
- `modules/flash/src/match/board-generator.ts` -- generateBoard, selectCards, createTiles, fisherYatesShuffle
- `modules/flash/src/match/match-engine.ts` -- checkMatch, calculateStars, updateGameState
- `modules/flash/src/match/index.ts` -- barrel export
- `modules/flash/src/match/__tests__/board-generator.test.ts` -- board generation tests
- `modules/flash/src/match/__tests__/match-engine.test.ts` -- match checking and scoring tests
- `modules/flash/src/types.ts` -- add MatchResult Zod schema
- `modules/flash/src/index.ts` -- re-export match module
- `apps/mobile/app/(flash)/match-game.tsx` -- mobile match game screen
- `apps/mobile/app/(flash)/match-results.tsx` -- mobile match results
- `apps/web/app/flash/match/page.tsx` -- web match game

### Known Limitations
- No multiplayer/leaderboard (that's FL-025 Competitive Leagues).
- No difficulty progression. All games use the same star thresholds.
- No haptic feedback on match/mismatch (could be added as polish).
- Tile content is text-only. Media cards show "[Image]" or "[Audio]" placeholder text.

### Context for Next Agent
- Cards are fetched via `listCardsForDeck(db, deckId)`. Filter out `queue === 'suspended'` and `queue === 'buried'`.
- For reversed cards, use `templateOrdinal === 0` only to avoid duplicate content.
- For cloze cards, the front tile shows the rendered cloze (with blank), the back tile shows the cloze answer.
- Fisher-Yates shuffle: iterate from end, swap each element with a random earlier element. Use `Math.random()` (no crypto needed for a game shuffle).
- Star rating scales linearly with board size. Base: 12 tiles = 30s/60s thresholds. Scale factor = boardSize / 12. For 24 tiles: 60s/120s thresholds.
- The `fl_match_bests` table uses a composite PK (deck_id, board_size). Use `INSERT OR REPLACE` to update bests.
- Selection locking: maintain a `selectionLocked` boolean in game state. Set to true after second tile is tapped. Reset after match/no-match animation completes.
