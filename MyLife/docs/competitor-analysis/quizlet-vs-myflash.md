# Quizlet vs MyFlash: Feature Comparison

**Date:** 2026-03-29
**Source:** Screen recording of Quizlet iOS app (walkthrough of onboarding, home, study set, flashcard mode, card list, create, games)
**Screenshots:** `docs/competitor-analysis/quizlet-screens/labeled/`

## Summary

Quizlet is the dominant flashcard platform with 60M+ monthly users, a $36/yr subscription, and heavy investment in AI-generated study materials and gamification. Our MyFlash module already **exceeds Quizlet** in spaced repetition intelligence (FSRS scheduling, forgetting curves, personal retention modeling, maturity distribution), study analytics depth (session detection, optimal study time, accuracy trends, review forecasts), import ecosystem (Anki .apkg parsing), and advanced card types (cloze deletions, image occlusion, custom templates). The main gaps are in **consumer UX polish** -- onboarding flows, gamified study modes (Blast/Blocks games), swipeable card carousels, photo-to-card creation, shared decks/discovery, and progress resumption ("Jump back in"). MyFlash is a power tool; Quizlet is a consumer product. The task list below bridges that gap.

---

## Feature-by-Feature Comparison

| # | Quizlet Feature | MyFlash Has It? | Notes |
|---|---|---|---|
| **ONBOARDING** | | | |
| 1 | Sign up with Google/Apple/Email | NO | MyFlash has no auth -- fully local, no accounts needed (privacy advantage but no sync) |
| 2 | Birthday + teacher/student toggle | NO | No user profile or role system. Not needed for privacy-first model |
| 3 | School + course selection (university search) | NO | No institution integration. Out of scope for local-first app |
| 4 | Notification opt-in with study reminder value prop | PARTIAL | `reminders.ts` has `buildNotificationContent`, `parseReminderConfig`, `filterDueByDecks` -- engine exists but no onboarding opt-in screen |
| **HOME** | | | |
| 5 | "Jump back in" card with progress bar + Continue CTA | NO | No session resumption. Dashboard shows due/new/reviewed counts but no "continue where you left off" card |
| 6 | "Recents" list (set name, card count, author) | PARTIAL | `listDecks` returns decks but no "recently studied" sort or recency-focused UI |
| 7 | "Personalize your content" based on courses | NO | No course/subject taxonomy. Cards are user-created only |
| 8 | 3-tab nav: Home, Create (+), Library | PARTIAL | 4-tab nav: Study, Decks, Browse, Settings. No dedicated Home or Create tabs |
| 9 | Gamification games: "Play Blast" (space game) | NO | No arcade-style study games |
| 10 | Gamification games: "Play Blocks" (Tetris puzzle) | NO | No puzzle-style study games |
| 11 | "Keep things fresh" section with game-based review | NO | No gamified review section on home screen |
| **STUDY SET** | | | |
| 12 | Swipeable flashcard preview carousel with dot indicators | NO | No horizontal card carousel. Study screen shows one card at a time with flip |
| 13 | Set title, author avatar + name, term count, description | PARTIAL | Decks have name, card count, and description in schema. No author avatar. Description not surfaced in UI |
| 14 | Bookmark/save button on sets | NO | No deck bookmarking (all decks are user-owned, no shared deck browsing) |
| 15 | Download for offline | N/A | Already 100% offline-first -- all data is local SQLite |
| 16 | 6 study modes: Flashcards, Learn, Test, Match, Blast, Blocks | PARTIAL | Has: Flashcard review (FSRS), Match game, Multiple choice, Practice tests. Missing: Learn mode, Blast, Blocks |
| **FLASHCARD MODE** | | | |
| 17 | Card counter (2/100) with progress bar | PARTIAL | Due card count exists in dashboard. No per-session "X/Y" counter with progress bar |
| 18 | Audio/text-to-speech button per card | NO | `media.ts` supports audio attachments but no TTS synthesis |
| 19 | Star/favorite individual cards | NO | Cards can be suspended/buried but not starred/favorited for quick access |
| 20 | Auto-play toggle with play/pause | NO | No auto-advance through cards |
| 21 | Undo button (previous card) | NO | No undo after rating a card. FSRS rating is immediate and permanent |
| 22 | Settings gear icon (in flashcard mode) | PARTIAL | Settings screen exists as a tab but not accessible as inline gear from study mode |
| 23 | Full-screen expand option | NO | No full-screen/focus mode for cards |
| **CARD DETAIL VIEW** | | | |
| 24 | Term + definition list view | YES | `browseFlashcards` provides paginated list with search. Browser screen exists |
| 25 | "Original" vs sorted toggle | PARTIAL | `FlashBrowserSort` schema exists with sort options but no "original order" toggle in UI |
| 26 | Audio button per card in list | NO | No TTS or audio playback in card list view |
| 27 | Star per card in list view | NO | No star/favorite in list view |
| 28 | "Study this set" CTA button | PARTIAL | Study tab is the default landing. No per-deck "Study this set" CTA on deck detail |
| **CREATE** | | | |
| 29 | Photo import: create cards from photos of notes/textbooks | NO | `ai.ts` has `generateCards` and `generateCardsOnDevice` from text but no photo/OCR pipeline |
| 30 | Manual card creation (term + definition) | YES | `createFlashcards` supports basic, reversed, cloze, and custom template cards |
| **SEARCH/DISCOVERY** | | | |
| 31 | Search bar with course-based content | PARTIAL | `parseFlashSearchQuery` provides search with tag/deck/type filters but no course taxonomy |
| 32 | Popular courses at your school | NO | No institution or community content |

---

## Where MyFlash EXCEEDS Quizlet

| Feature | MyFlash | Quizlet |
|---------|---------|---------|
| Spaced repetition algorithm | FSRS-inspired with ease factor, interval tracking, 4 queue states, lapse counting | Basic "Learn" mode with no visible SRS algorithm; flashcard mode is manual |
| Forgetting curve intelligence | Personal retention curves, half-life estimation per ease range, individual card retention prediction | No forgetting curve analysis |
| Study analytics | Retention rate, 7/14/30-day review forecast, study time estimation, daily accuracy trend, difficulty distribution, maturity distribution | Basic "X% completed" progress bar |
| Session detection | Gap-based session detection, session summaries, optimal study time by hour, duration estimation | No session analytics |
| Card types | Basic, reversed, cloze deletions, image occlusion, custom HTML templates | Basic front/back only |
| Anki import | Full .apkg parser (deck hierarchy, scheduling state mapping, HTML stripping, warnings) | No Anki import |
| Practice tests | MC, true/false, short answer, fill-in-blank with Levenshtein scoring | "Test" mode with limited question types |
| AI conversation practice | Multi-mode conversation engine with difficulty levels, card context | No conversation practice |
| Competitive leagues | XP system, tier promotions, weekly leaderboards (opt-in) | No competitive features |
| Custom templates | Arbitrary field types with HTML rendering and placeholder extraction | Fixed front/back template only |
| Image occlusion | Region-based occlusion with percent/pixel conversion, multi-region support | No image occlusion |
| Cross-module integration | Study signals to other MyLife modules, vocabulary cards from books, flashcards from notes | Standalone app, no cross-app integration |
| Privacy | Zero telemetry, 100% local SQLite, no accounts required | Requires account, tracks study behavior, uses data for ad targeting and AI training |
| Offline-first | Everything works offline always | Requires network for most features, offline download is a premium feature |
| Export | Full data export with serialization | Limited export options |

---

## Priority Gaps to Close

### P0 -- High Impact, Should Have

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 1 | **"Jump back in" session resumption** | Quizlet's #1 home UX pattern. Shows last studied deck with progress bar and "Continue" CTA. Users returning to the app need instant re-engagement, not a cold dashboard. | Medium |
| 2 | **Swipeable flashcard carousel** | Quizlet's set preview uses horizontal swipe with dot indicators. Tactile, mobile-native interaction pattern. Current study screen is functional but not delightful. | Medium |
| 3 | **Card counter + session progress bar** | "2/100" with a filling progress bar during study. Gives users a sense of accomplishment and session scope. Dashboard has counts but study mode lacks inline progress. | Small |
| 4 | **Star/favorite cards** | Quizlet lets users star cards during study and in list view. Creates a "difficult cards" subset for focused review. Current suspend/bury is binary and negative-framed. | Small |
| 5 | **Undo last rating** | Rating a card wrong is frustrating with no recovery. Quizlet has an undo button. FSRS rating is currently irreversible. | Small |
| 6 | **Text-to-speech per card** | Quizlet has audio buttons on every card. Critical for language learning. Expo Speech API is free and on-device. | Small |

### P1 -- Nice to Have

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 7 | **Photo-to-card creation (OCR)** | Quizlet's "create from photo" lets users snap pictures of notes/textbooks and auto-generate cards. Massive time saver. Needs on-device OCR + AI generation pipeline. | Large |
| 8 | **Deck description in UI** | Quizlet shows set descriptions prominently. Schema already has `fl_decks.description` but it is not surfaced in deck detail or deck list UI. | Small |
| 9 | **Auto-play mode** | Toggle that auto-flips and advances cards on a timer. Useful for passive review (commuting, walking). | Small |
| 10 | **Full-screen focus mode** | Hide nav chrome, maximize card real estate. Simple but polished. | Small |
| 11 | **"Study this set" CTA on deck detail** | When browsing a deck's cards, a prominent button to jump into study mode filtered to that deck. | Small |
| 12 | **Recently studied sort** | Sort decks by "last studied" date. Quizlet's "Recents" list surfaces recently used sets. Track `last_studied_at` on decks. | Small |
| 13 | **Notification onboarding screen** | Reminder engine exists but no opt-in screen during first-run. A single screen showing "Get study reminders" with time picker. | Small |

### P2 -- Consider Later

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 14 | **Blast game (space shooter)** | Quizlet's arcade game: answer questions to shoot asteroids. Gamification for younger users. Fun but not core to SRS. | Large |
| 15 | **Blocks game (Tetris puzzle)** | Quizlet's puzzle game: match terms to clear blocks. Alternative engagement mechanic. | Large |
| 16 | **Shared deck browser** | Quizlet's entire model is social sets. A privacy-preserving shared deck system (opt-in P2P or curated library) is complex but valuable. | XL |
| 17 | **Course/subject taxonomy** | Quizlet organizes by school + course. Would require a content taxonomy system. Low value for privacy-first model. | Large |
| 18 | **Personalized content recommendations** | "Personalize your content" based on study history. Cross-module signals partially cover this but no dedicated recommendation engine for flash. | Medium |

### Out of Scope (By Design)

| Feature | Reason |
|---------|--------|
| User accounts / sign-up | Privacy-first, fully offline. No mandatory accounts. |
| School/university integration | No institution data collection. Users organize decks themselves. |
| Social profiles / avatars | No social graph. Leagues are opt-in and anonymous by default. |
| Ad-supported tier | Zero-ad model is core to MyLife's value proposition. |
| Cloud-first storage | Local SQLite is the privacy foundation. Sync is future opt-in. |
| Course-based content curation | Requires centralized content moderation and institution partnerships. |

---

## Screenshot Reference

All labeled screenshots are in:
```
docs/competitor-analysis/quizlet-screens/labeled/
+-- 01-onboarding/      (5 images: signup, birthday, notifications, school-courses, course-search)
+-- 02-home/            (1 image: home-jump-back)
+-- 03-study-set/       (1 image: study-modes)
+-- 04-flashcard-mode/  (1 image: card-view)
+-- 05-card-list/       (1 image: card-list)
+-- 06-create/          (1 image: photo-import)
+-- 07-games/           (1 image: blocks-game)
```
