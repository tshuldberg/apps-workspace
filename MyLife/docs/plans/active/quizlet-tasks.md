# Quizlet Gap Tasks -- MyFlash Module

**Created:** 2026-03-29
**Source:** `docs/competitor-analysis/quizlet-vs-myflash.md`
**Module:** `modules/flash/` + `apps/mobile/app/(flash)/`

---

## Rules (apply to every task)

- Add new screens to the hamburger menu in `apps/mobile/app/(flash)/study.tsx` (lines 64-72)
- Use `ACCENT = FLASH_MODULE.accentColor` (`#FBBF24`) and Cool Obsidian tokens from `@mylife/ui`
- Run `pnpm typecheck` after editing each file
- Read `modules/flash/src/index.ts` before writing any module code
- All new engine functions must be pure (no DB calls, no side effects)
- All new DB functions go in `modules/flash/src/db/`
- Export new public API items from `modules/flash/src/index.ts`
- New screens go in `apps/mobile/app/(flash)/`
- Register new screens in `apps/mobile/app/(flash)/_layout.tsx` with `href: null` (hamburger-only screens)

---

## FLASH-01: "Jump Back In" Session Resumption Card

**Depends on:** None
**Priority:** P0
**Complexity:** Medium

**Files to create/edit:**
- `modules/flash/src/db/crud.ts` (edit: add `getLastStudiedDeck` function)
- `modules/flash/src/db/index.ts` (edit: re-export)
- `modules/flash/src/index.ts` (edit: export `getLastStudiedDeck`)
- `apps/mobile/app/(flash)/study.tsx` (edit: add Jump Back In card)

**Reference logic:**
- `getFlashDashboard(db)` from `modules/flash/src/db/crud.ts` -- returns due/new/reviewed counts
- `listDueFlashcards(db, deckId, now, limit)` from `modules/flash/src/db/crud.ts` -- gets due cards for a deck
- `fl_review_logs.reviewed_at` column -- can query MAX(reviewed_at) grouped by deck to find last studied
- `detectSessions(reviews)` from `modules/flash/src/engine/session.ts` -- session detection logic

**Prompt:**

Add a "Jump back in" card to the MyFlash Study screen that shows the user's last studied deck with progress and a Continue button.

Requirements:

1. Create `getLastStudiedDeck(db)` in `modules/flash/src/db/crud.ts` that:
   - Queries `fl_review_logs` joined with `fl_cards` and `fl_decks` to find the deck with the most recent `reviewed_at` timestamp.
   - Returns `{ deckId: string, deckName: string, lastStudiedAt: string, dueCount: number, totalCount: number } | null`.
   - `dueCount` is the count of cards in that deck with `queue IN ('new','learning','review')` and `due_at <= now`.
   - `totalCount` is total cards in that deck.
   - Returns null if no review logs exist (fresh user).

2. In `study.tsx`, add a "Jump back in" card above the "Study Queue" card:
   - Only visible when `getLastStudiedDeck` returns non-null AND the current deck filter is "All decks" (not already filtered to a specific deck).
   - Shows: deck name (bold, `variant="subheading"`), "X cards remaining" caption, a horizontal progress bar (completed = totalCount - dueCount, total = totalCount) using `ACCENT` color.
   - "Continue" button: `Pressable` with `ACCENT` background, white text, borderRadius 12. On press, sets `selectedDeckId` to the last studied deck ID (auto-filters study to that deck).
   - "Last studied X ago" caption using relative time (minutes/hours/days).
   - Card style: same `Card` component, with a subtle left-border accent (4px wide, `ACCENT` color).

3. Progress bar implementation: `View` with `height: 6, borderRadius: 3, backgroundColor: colors.surfaceElevated`. Inner `View` with `width: ${percentage}%, backgroundColor: ACCENT`. Percentage = `((totalCount - dueCount) / totalCount) * 100`, clamped 0-100.

Acceptance criteria:
- Fresh user (no reviews) sees no "Jump back in" card
- After studying a deck, returning to the study screen shows the card with correct deck name and progress
- Tapping "Continue" filters to that deck
- Progress bar fills proportionally to completion
- Typecheck passes

---

## FLASH-02: Swipeable Flashcard Carousel

**Depends on:** None
**Priority:** P0
**Complexity:** Medium

**Files to create/edit:**
- `apps/mobile/app/(flash)/study.tsx` (edit: replace static card with carousel)

**Reference logic:**
- `listDueFlashcards(db, deckId, now, limit)` -- already used, returns array of `Flashcard`
- Current card rendering in `study.tsx` lines 129-225 -- the existing flip-to-reveal card UI
- `rateFlashcard(db, cardId, rating, now)` -- called after rating

**Prompt:**

Replace the single-card study view with a horizontally swipeable flashcard carousel with dot indicators.

Requirements:

1. Replace the current single-card `Pressable` (lines 139-151 of `study.tsx`) with a horizontal `FlatList` showing up to 5 upcoming due cards.
   - `horizontal={true}`, `pagingEnabled={true}`, `showsHorizontalScrollIndicator={false}`.
   - Each card is `width: screenWidth - (spacing.md * 2) - 16` (full width minus padding minus gap), `height: 260`.
   - `snapToInterval` set to card width + gap (8px). `decelerationRate="fast"`.
   - `getItemLayout` for performance.

2. Each carousel card is the same flip-to-reveal Pressable already used:
   - Front: "Prompt" label + `card.front` text + card type tag line.
   - Tap to flip and show back.
   - Card style: same `flashcard` style (borderRadius 20, surfaceElevated bg, border).

3. Dot indicators below the carousel:
   - Row of circles: 8px diameter, gap 6px. Active dot is `ACCENT`, inactive dots are `colors.border`.
   - Track active index via `onMomentumScrollEnd` calculating `Math.round(event.nativeEvent.contentOffset.x / snapInterval)`.

4. Rating buttons remain below the carousel. They apply to the currently visible (active index) card.
   - After rating, remove that card from the list (filter the dueCards array), reset to index 0 or stay in place.

5. Card counter text above the carousel: "Card {activeIndex + 1} of {dueCards.length}" in `variant="caption"` with `colors.textSecondary`.

Acceptance criteria:
- User can swipe left/right between due cards
- Dot indicators reflect current position
- Rating buttons apply to the visible card
- After rating, the rated card is removed and the next card appears
- Card counter updates on swipe
- Empty state still shows when no cards are due
- Typecheck passes

---

## FLASH-03: Session Progress Counter

**Depends on:** None
**Priority:** P0
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(flash)/study.tsx` (edit: add session counter and progress bar)

**Reference logic:**
- `listDueFlashcards(db, deckId, now, limit)` returns current due cards
- `getFlashDashboard(db)` returns `dueCount`, `newCount`, `reviewedCount`
- Current `Stat` component (lines 21-27) for styling reference

**Prompt:**

Add a session progress counter and linear progress bar to the MyFlash study screen.

Requirements:

1. Track session-level state with `useState`:
   - `sessionTotal`: set to `dueCards.length` when the study screen mounts or when a new deck is selected. This is the starting count for this session.
   - `sessionCompleted`: increments by 1 each time the user rates a card (in the `onPress` handler of rating buttons).

2. Render a progress header between the "Study Queue" card and the card display area:
   - Text: "{sessionCompleted}/{sessionTotal}" in `variant="subheading"` color `ACCENT`.
   - Below it, a horizontal progress bar: outer `View` with `height: 4, borderRadius: 2, backgroundColor: colors.surfaceElevated, width: '100%'`. Inner `View` with `backgroundColor: ACCENT`, width percentage = `(sessionCompleted / sessionTotal) * 100`, clamped 0-100. `borderRadius: 2`.
   - When `sessionTotal === 0`, hide the progress bar entirely.

3. When `sessionCompleted === sessionTotal` and `sessionTotal > 0`, show a completion message: "Session complete!" in `variant="subheading"` color `colors.success` with a "Study more" button that resets the counter.

Acceptance criteria:
- Counter starts at 0/N where N is the number of due cards
- Each rating increments the completed count
- Progress bar fills left-to-right as cards are reviewed
- Completion message appears when all cards are reviewed
- Switching deck filter resets the counter
- Typecheck passes

---

## FLASH-04: Star/Favorite Cards

**Depends on:** None
**Priority:** P0
**Complexity:** Small

**Files to create/edit:**
- `modules/flash/src/db/schema.ts` (edit: add V5 migration for `starred` column)
- `modules/flash/src/db/crud.ts` (edit: add `starFlashcard`, `unstarFlashcard`, `listStarredFlashcards`)
- `modules/flash/src/db/index.ts` (edit: re-export)
- `modules/flash/src/types.ts` (edit: add `starred` to FlashcardSchema)
- `modules/flash/src/definition.ts` (edit: add V5 migration, bump version)
- `modules/flash/src/index.ts` (edit: export new functions)
- `apps/mobile/app/(flash)/study.tsx` (edit: add star button on card)
- `apps/mobile/app/(flash)/browser.tsx` (edit: add star icon per card in list)

**Reference logic:**
- `FlashcardSchema` in `modules/flash/src/types.ts` -- add `starred: z.boolean()` field
- `fl_cards` table in `modules/flash/src/db/schema.ts` -- add `starred INTEGER NOT NULL DEFAULT 0` column
- `browseFlashcards(db, input)` in `modules/flash/src/db/crud.ts` -- must include starred field in SELECT
- Study screen card rendering (study.tsx lines 139-151)

**Prompt:**

Add star/favorite functionality to flashcards so users can mark cards for focused review.

Requirements:

Schema:
1. Add V5 migration to `schema.ts`: `ALTER TABLE fl_cards ADD COLUMN starred INTEGER NOT NULL DEFAULT 0`.
2. Add `starred: z.boolean()` to `FlashcardSchema` in `types.ts`.
3. Register V5 in `definition.ts` migrations array. Bump module version.

DB:
4. Add `starFlashcard(db, cardId)` -- sets `starred = 1` for the given card ID. Updates `updated_at`.
5. Add `unstarFlashcard(db, cardId)` -- sets `starred = 0`. Updates `updated_at`.
6. Add `listStarredFlashcards(db, deckId?)` -- returns all cards where `starred = 1`, optionally filtered by deck. Ordered by `updated_at DESC`.
7. Update all SELECT queries in `crud.ts` that read from `fl_cards` to include `starred` in the column list and map it to boolean in the result.

UI -- Study screen:
8. Add a star icon button in the top-right corner of the flashcard Pressable in `study.tsx`.
   - When `currentCard.starred` is false: outline star (Unicode star outline or Text with color `colors.textSecondary`).
   - When starred: filled star with color `ACCENT`.
   - On press: toggle star state, call `starFlashcard` or `unstarFlashcard`, then `refresh()`.
   - Star button: `position: 'absolute', top: 12, right: 12`, `hitSlop: 12`.

UI -- Browser screen:
9. In `browser.tsx`, add a small star icon next to each card in the list. Same toggle behavior.

Export:
10. Export `starFlashcard`, `unstarFlashcard`, `listStarredFlashcards` from `modules/flash/src/index.ts`.

Acceptance criteria:
- Fresh migration runs without error on existing databases
- Starring a card persists across app restarts
- Star icon toggles visually on tap in both study and browser screens
- `listStarredFlashcards` returns only starred cards
- Typecheck passes

---

## FLASH-05: Undo Last Rating

**Depends on:** None
**Priority:** P0
**Complexity:** Small

**Files to create/edit:**
- `modules/flash/src/db/crud.ts` (edit: add `undoLastRating` function)
- `modules/flash/src/db/index.ts` (edit: re-export)
- `modules/flash/src/index.ts` (edit: export `undoLastRating`)
- `apps/mobile/app/(flash)/study.tsx` (edit: add undo button)

**Reference logic:**
- `rateFlashcard(db, cardId, rating, now)` in `modules/flash/src/db/crud.ts` -- creates review log + updates card scheduling
- `fl_review_logs` table: has `scheduled_before_at` and `scheduled_after_at` columns storing pre/post scheduling state
- `fl_cards` columns: `queue`, `interval_days`, `ease`, `due_at`, `last_review_at`, `review_count`, `lapse_count`
- `scheduleFlashcard(card, rating)` in `modules/flash/src/engine/scheduler.ts` -- pure scheduling function

**Prompt:**

Add an undo button that reverses the last card rating, restoring the card's previous scheduling state.

Requirements:

DB:
1. Add `undoLastRating(db, cardId)` to `crud.ts`:
   - Query the most recent `fl_review_logs` entry for `cardId` (ORDER BY `reviewed_at` DESC LIMIT 1).
   - If no review log found, return `{ undone: false }`.
   - Delete that review log row.
   - Restore the card's scheduling state from the review log's `scheduled_before_at` field. Parse it as JSON containing `{ queue, intervalDays, ease, dueAt, lastReviewAt, reviewCount, lapseCount }`.
   - If `scheduled_before_at` is null (edge case: very old log), return `{ undone: false }`.
   - UPDATE `fl_cards` SET all scheduling columns to the restored values. Set `updated_at` to now.
   - Return `{ undone: true, restoredCardId: cardId }`.
   - Wrap in a transaction.

2. Verify that `rateFlashcard` currently stores sufficient before-state in `scheduled_before_at`. If not, update it to serialize `{ queue, intervalDays, ease, dueAt, lastReviewAt, reviewCount, lapseCount }` as JSON before applying the rating.

UI:
3. In `study.tsx`, add an "Undo" button next to the Suspend/Bury/Bury Note action row.
   - Track `lastRatedCardId` in state. Set it after each successful `rateFlashcard` call.
   - Undo button visible only when `lastRatedCardId` is not null.
   - On press: call `undoLastRating(db, lastRatedCardId)`. If `undone: true`, clear `lastRatedCardId`, call `refresh()`, show the card again.
   - Style: same as `secondaryButton` but with a left-facing arrow or "Undo" text. Color: `colors.textSecondary`.
   - Clear `lastRatedCardId` when switching decks or when the component unmounts.

Export:
4. Export `undoLastRating` from `modules/flash/src/index.ts`.

Acceptance criteria:
- After rating a card, the "Undo" button appears
- Tapping Undo restores the card to its pre-rating scheduling state
- The review log is deleted
- The card reappears in the due queue
- Undo is only available for the most recently rated card (not arbitrary history)
- Typecheck passes

---

## FLASH-06: Text-to-Speech Per Card

**Depends on:** None
**Priority:** P0
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(flash)/study.tsx` (edit: add TTS button on card)
- `apps/mobile/app/(flash)/browser.tsx` (edit: add TTS button in card list)

**Reference logic:**
- Expo Speech API: `import * as Speech from 'expo-speech'` -- `Speech.speak(text, options)`, `Speech.stop()`
- Card data: `currentCard.front` and `currentCard.back` are the text to speak
- Study card Pressable (study.tsx lines 139-151) -- add button inside

**Prompt:**

Add a text-to-speech button on each flashcard that reads the visible card text aloud using the Expo Speech API.

Requirements:

1. Install `expo-speech` if not already present: `pnpm add expo-speech --filter @mylife/mobile`.

2. In `study.tsx`:
   - Import `* as Speech from 'expo-speech'`.
   - Add a speaker icon button in the top-left corner of the flashcard Pressable (position: absolute, top: 12, left: 12).
   - On press: `Speech.speak(revealed ? currentCard.back : currentCard.front)`. If the card back is empty, speak "No answer provided".
   - Track `isSpeaking` state. Set to true on speak, false on completion (use `Speech.speak(text, { onDone: () => setIsSpeaking(false) })`).
   - While speaking, show a "stop" icon. On press while speaking: `Speech.stop()`.
   - Button style: 32x32 circle, `backgroundColor: colors.glass`, icon is a speaker emoji or unicode character.

3. In `browser.tsx`:
   - Add a small speaker button next to each card in the list view.
   - On press: `Speech.speak(card.front)`.
   - Same styling pattern: 28x28 circle, `backgroundColor: colors.glass`.

4. Clean up: call `Speech.stop()` in a cleanup effect (`useEffect` return) when the component unmounts.

Acceptance criteria:
- Tapping the speaker icon reads the current card text aloud
- Shows the front text when card is not revealed, back text when revealed
- Tapping while speaking stops playback
- Speaker button is visible in both study and browser screens
- Component cleanup stops any active speech
- Typecheck passes

---

## FLASH-07: Photo-to-Card Creation (OCR + AI)

**Depends on:** None
**Priority:** P1
**Complexity:** Large

**Files to create/edit:**
- `modules/flash/src/ai.ts` (edit: add `generateCardsFromImage` function)
- `modules/flash/src/index.ts` (edit: export new function)
- `apps/mobile/app/(flash)/photo-create.tsx` (create: new screen)
- `apps/mobile/app/(flash)/_layout.tsx` (edit: register screen with href: null)
- `apps/mobile/app/(flash)/study.tsx` (edit: add "Photo Create" to hamburger menu)

**Reference logic:**
- `generateCardsOnDevice(text, config)` from `modules/flash/src/ai.ts` -- existing on-device card generation from text
- `generateCards(text, config)` from `modules/flash/src/ai.ts` -- cloud-backed generation
- `extractDefinitions(text)`, `extractColonDefinitions(text)`, `extractBoldTerms(text)` -- existing text extraction helpers
- `createFlashcards(db, deckId, cards)` from `modules/flash/src/db/crud.ts` -- saves generated cards
- `expo-camera` for camera access, `expo-image-picker` for gallery selection

**Prompt:**

Add a "Photo to Cards" screen that lets users take photos of notes or textbooks and auto-generate flashcards using OCR and the existing AI card generation pipeline.

Requirements:

Engine:
1. Add `generateCardsFromImage(imageBase64: string, config: GenerationConfig)` to `ai.ts`:
   - Accept a base64-encoded image string.
   - Use Apple's on-device OCR via `expo-image-manipulator` or `react-native-mlkit-ocr` (prefer on-device, no cloud dependency).
   - Extract text from the image.
   - Pass extracted text to the existing `generateCardsOnDevice(text, config)` pipeline.
   - Return the same `GenerationResult` type.
   - If OCR returns empty text, return `{ cards: [], warnings: ['No text detected in image'] }`.

UI:
2. Create `apps/mobile/app/(flash)/photo-create.tsx`:
   - Header: "Photo to Cards" with back button.
   - Two buttons: "Take Photo" (opens camera) and "Choose from Library" (opens image picker).
   - After image selection, show a preview of the image with a "Generate Cards" button.
   - While generating, show a loading spinner with "Extracting text..." then "Generating cards...".
   - After generation, show a list of generated cards (front/back) with checkboxes. All checked by default.
   - "Save to Deck" button at the bottom: opens a deck picker (dropdown of `listDecks` results), then calls `createFlashcards` with checked cards.
   - Success toast: "X cards created in {deckName}".

3. Register the screen:
   - `_layout.tsx`: add `<Tabs.Screen name="photo-create" options={{ href: null, title: 'Photo Create' }} />`.
   - `study.tsx` hamburger menu: add `{ label: 'Photo to Cards', route: '/(flash)/photo-create' }` to the menu items array.

4. Permissions: request camera permission on first "Take Photo" tap. Show a permission denied message if not granted.

Acceptance criteria:
- User can take a photo or choose from gallery
- OCR extracts text from the image (test with a photo of printed text)
- AI generates reasonable flashcards from the extracted text
- User can review, deselect, and save cards to a specific deck
- Empty image (no text) shows a helpful message
- Screen is accessible from hamburger menu
- Typecheck passes

---

## FLASH-08: Deck Description in UI

**Depends on:** None
**Priority:** P1
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(flash)/decks.tsx` (edit: show description in deck list and deck detail)

**Reference logic:**
- `DeckSchema` in `modules/flash/src/types.ts` -- already has `description: z.string().nullable()`
- `fl_decks.description` column already exists in schema
- `listDecks(db)` returns decks with description field
- `updateDeck(db, id, input)` from `modules/flash/src/db/crud.ts` -- already supports updating description

**Prompt:**

Surface the existing deck description field in the Decks UI.

Requirements:

1. In the deck list view (`decks.tsx`):
   - Below each deck name, show `deck.description` in `variant="caption"` color `colors.textSecondary`.
   - If description is null or empty, do not render the caption (no blank space).
   - Truncate to 2 lines with `numberOfLines={2}`.

2. In the deck detail/edit view (wherever deck editing happens):
   - Add a "Description" text input field below the deck name input.
   - Placeholder: "What is this deck about? (optional)".
   - Style: `TextInput` with `multiline={true}`, `maxLength={500}`, `backgroundColor: colors.surfaceElevated`, `borderColor: colors.border`, `borderRadius: 12`, `padding: spacing.md`, `color: colors.text`, `fontFamily: 'Inter'`.
   - Save description via `updateDeck(db, deckId, { description: value })`.

Acceptance criteria:
- Decks with descriptions show the text below the name in the list
- Decks without descriptions show no extra space
- Users can add/edit descriptions in the deck edit view
- Description persists after app restart
- Typecheck passes

---

## FLASH-09: Auto-Play Mode

**Depends on:** None
**Priority:** P1
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(flash)/study.tsx` (edit: add auto-play toggle and timer logic)

**Reference logic:**
- Current card rendering in `study.tsx` lines 129-225
- `rateFlashcard(db, cardId, rating, now)` -- needs to auto-rate with 'good' on auto-advance
- `getFlashSetting(db, key)` / `setFlashSetting(db, key, value)` -- can persist auto-play speed preference

**Prompt:**

Add an auto-play toggle to the flashcard study mode that automatically flips and advances cards on a timer.

Requirements:

1. Add auto-play state:
   - `autoPlay: boolean` (default false).
   - `autoPlaySpeed: number` (seconds per side, default 5). Configurable: 3, 5, 8, 10 seconds.

2. Auto-play button in the study screen's top row (next to the hamburger menu):
   - Play icon when stopped, pause icon when playing.
   - Style: same as `menuButton` (44x44, surfaceElevated bg, border).
   - Long-press opens speed selector (horizontal row of speed options: "3s", "5s", "8s", "10s").

3. Auto-play behavior:
   - When enabled, after `autoPlaySpeed` seconds on the front, auto-flip to reveal.
   - After `autoPlaySpeed` seconds on the back, auto-rate with 'good' and advance to next card.
   - Use `useEffect` with `setInterval` keyed on `autoPlay` and `revealed` state.
   - Clear interval on unmount, deck change, or toggle off.
   - Tapping the card manually while auto-play is running resets the timer but does not disable auto-play.
   - Manual rating during auto-play advances immediately and resets the timer.

4. Persist speed preference: `setFlashSetting(db, 'autoPlaySpeed', String(speed))` on change. Load on mount with `getFlashSetting(db, 'autoPlaySpeed')`.

5. Visual indicator: when auto-play is active, show a thin animated progress bar at the top of the card (filling from left to right over `autoPlaySpeed` seconds). Use `Animated.timing` or a simple width interpolation.

Acceptance criteria:
- Toggle starts/stops auto-play
- Cards flip and advance automatically at the configured speed
- Speed is configurable and persists
- Manual interaction during auto-play works correctly (doesn't double-advance)
- Component cleanup stops the timer
- Typecheck passes

---

## FLASH-10: Full-Screen Focus Mode

**Depends on:** None
**Priority:** P1
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(flash)/study.tsx` (edit: add focus mode toggle)

**Reference logic:**
- Current study screen layout in `study.tsx`
- `expo-router` Stack/Tabs header control: `navigation.setOptions({ headerShown: false })`
- Tab bar hiding: `tabBarStyle: { display: 'none' }` or `expo-router` `tabBarVisible` option

**Prompt:**

Add a full-screen focus mode that hides all navigation chrome and maximizes the flashcard for distraction-free study.

Requirements:

1. Add `focusMode: boolean` state (default false).

2. Focus mode toggle button:
   - Expand icon (Unicode or text) in the study screen top row, between the title and hamburger menu.
   - Style: same `menuButton` pattern (44x44, surfaceElevated bg).
   - On press, toggle `focusMode`.

3. When focus mode is active:
   - Hide the tab bar: use `expo-router`'s `useNavigation` to call `navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } })`.
   - Hide the header: `navigation.setOptions({ headerShown: false })`.
   - Hide the "Study Queue" stats card, deck filter card, and hamburger menu.
   - Show only: the flashcard (full height, `flex: 1`), rating buttons, and a small "X" close button in the top-right corner to exit focus mode.
   - Card should expand to fill available space: `minHeight: undefined`, `flex: 1`.
   - Background: `colors.background` full screen.

4. Exiting focus mode:
   - Tap the "X" button.
   - Restore tab bar: `tabBarStyle: { display: 'flex', backgroundColor: colors.surface, ... }`.
   - Restore header: `headerShown: true`.
   - Show all hidden UI elements.

5. Physical back button / swipe back should also exit focus mode.

Acceptance criteria:
- Tapping expand icon enters focus mode, hides all chrome
- Card fills the screen with rating buttons below
- "X" button exits focus mode, restores all UI
- Back gesture/button exits focus mode
- Typecheck passes

---

## FLASH-11: "Study This Set" CTA on Deck Detail

**Depends on:** None
**Priority:** P1
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(flash)/decks.tsx` (edit: add Study button to deck detail)

**Reference logic:**
- `listDueFlashcards(db, deckId, now, limit)` -- to show due count for the deck
- Router: `router.push({ pathname: '/(flash)/study', params: { deckId } })` -- navigate to study with pre-selected deck
- Current deck list rendering in `decks.tsx`

**Prompt:**

Add a prominent "Study this deck" button on each deck card and deck detail view.

Requirements:

1. On each deck card in the deck list:
   - Add a "Study" button at the bottom-right of the card.
   - Shows due count: "Study (X due)" where X = `deck.dueCount`.
   - If `dueCount === 0`, show "Study (all caught up)" in disabled state.
   - Style: `ACCENT` background when due > 0, `colors.surfaceElevated` when 0. White text, borderRadius 8, paddingHorizontal 12, paddingVertical 6.
   - On press: navigate to study screen with the deck pre-selected. Use `router.push('/(flash)/study')` and set a route param or use a shared state/context to pre-filter.

2. Since Expo Router params may not directly set `selectedDeckId` in the study screen, use `useLocalSearchParams` in `study.tsx` to check for an incoming `deckId` param. If present, initialize `selectedDeckId` to that value.

3. In `study.tsx`:
   - Import `useLocalSearchParams` from `expo-router`.
   - Read `params.deckId` on mount. If present, set `selectedDeckId` to it.

Acceptance criteria:
- Each deck card shows a Study button with due count
- Tapping Study navigates to the study screen filtered to that deck
- Decks with zero due cards show disabled button
- Typecheck passes

---

## FLASH-12: Recently Studied Sort

**Depends on:** None
**Priority:** P1
**Complexity:** Small

**Files to create/edit:**
- `modules/flash/src/db/schema.ts` (edit: add V6 migration for `last_studied_at` column on `fl_decks`)
- `modules/flash/src/db/crud.ts` (edit: update `rateFlashcard` to touch deck's `last_studied_at`, add sort option)
- `modules/flash/src/types.ts` (edit: add `lastStudiedAt` to `DeckSchema`)
- `modules/flash/src/definition.ts` (edit: add V6 migration)
- `modules/flash/src/index.ts` (edit: export if needed)
- `apps/mobile/app/(flash)/decks.tsx` (edit: add sort toggle)

**Reference logic:**
- `DeckSchema` in `types.ts` -- add `lastStudiedAt: z.string().nullable()`
- `fl_decks` table -- add `last_studied_at TEXT` column
- `rateFlashcard(db, cardId, rating, now)` in `crud.ts` -- after rating, update the card's deck `last_studied_at`
- `listDecks(db)` -- add optional sort param

**Prompt:**

Add a "last studied" timestamp to decks and a sort toggle in the deck list.

Requirements:

Schema:
1. Add V6 migration: `ALTER TABLE fl_decks ADD COLUMN last_studied_at TEXT`.
2. Add `lastStudiedAt: z.string().nullable()` to `DeckSchema` in `types.ts`.
3. Register V6 in `definition.ts`. Bump version. (If V5 is taken by FLASH-04, use the next available version number.)

DB:
4. In `rateFlashcard`, after inserting the review log and updating the card, also UPDATE `fl_decks SET last_studied_at = ?` where `id` = the card's `deck_id`. Pass the review timestamp.
5. Update `listDecks` to accept an optional `sort?: 'name' | 'recent'` parameter. Default `'name'` (current behavior). When `'recent'`, ORDER BY `last_studied_at DESC NULLS LAST, name ASC`.

UI:
6. In `decks.tsx`, add a sort toggle at the top of the deck list:
   - Two pills: "A-Z" and "Recent". Active pill uses `ACCENT` background, inactive uses `colors.surfaceElevated`.
   - State: `sortMode: 'name' | 'recent'` (default 'name').
   - Pass `sortMode` to `listDecks(db, sort)`.
   - Show "Last studied X ago" caption on each deck card when `lastStudiedAt` is not null and sort is 'recent'.

Acceptance criteria:
- Migration adds column without error
- Rating a card updates the deck's `last_studied_at`
- Sort toggle switches between alphabetical and recent order
- Decks never studied appear at the bottom in recent sort
- Typecheck passes

---

## FLASH-13: Notification Onboarding Screen

**Depends on:** None
**Priority:** P1
**Complexity:** Small

**Files to create/edit:**
- `apps/mobile/app/(flash)/notification-setup.tsx` (create: onboarding screen)
- `apps/mobile/app/(flash)/_layout.tsx` (edit: register screen)
- `apps/mobile/app/(flash)/study.tsx` (edit: show onboarding prompt for first-time users)

**Reference logic:**
- `buildNotificationContent(config)` from `modules/flash/src/reminders.ts` -- builds notification payload
- `parseReminderConfig(raw)` from `modules/flash/src/reminders.ts` -- parses config
- `getFlashSetting(db, 'remindersEnabled')` / `setFlashSetting(db, key, value)` -- persists preference
- `expo-notifications` for permission request and scheduling

**Prompt:**

Add a notification onboarding screen that prompts first-time users to enable study reminders.

Requirements:

1. Create `apps/mobile/app/(flash)/notification-setup.tsx`:
   - Full-screen modal-style layout with `colors.background`.
   - Illustration area: large flash emoji (zap emoji) centered, 80px font size.
   - Headline: "Never miss a review" in `variant="heading"`.
   - Body: "Get daily reminders when cards are due. Study consistently to build strong memory retention." in `variant="body"` color `colors.textSecondary`.
   - Time picker: a simple hour selector (6 AM to 10 PM in 1-hour increments). Default: 9 AM. Styled as horizontal scroll pills.
   - "Enable Reminders" button: full-width, `ACCENT` background, white text, borderRadius 12, paddingVertical 14.
   - "Not now" link below: `variant="caption"` color `colors.textSecondary`, underlined.

2. On "Enable Reminders":
   - Request notification permission via `expo-notifications`.
   - If granted: `setFlashSetting(db, 'remindersEnabled', 'true')` and `setFlashSetting(db, 'reminderHour', String(selectedHour))`.
   - Schedule a daily notification using `expo-notifications` `scheduleNotificationAsync` with a daily trigger at the selected hour.
   - Navigate back to study screen.

3. On "Not now":
   - `setFlashSetting(db, 'remindersDismissed', 'true')`.
   - Navigate back.

4. Show the onboarding prompt:
   - In `study.tsx`, on mount, check `getFlashSetting(db, 'remindersEnabled')` and `getFlashSetting(db, 'remindersDismissed')`.
   - If both are null/undefined (first-time user who has not seen this screen), and the user has at least 1 deck with cards, auto-navigate to `/(flash)/notification-setup` once.
   - Do NOT show if the user has already enabled or dismissed.

5. Register in `_layout.tsx`: `<Tabs.Screen name="notification-setup" options={{ href: null, title: 'Study Reminders' }} />`.

Acceptance criteria:
- First-time users with cards see the notification setup screen once
- Users who dismiss are never prompted again
- Enabling reminders requests permission and schedules a daily notification
- Time preference persists
- Typecheck passes

---

## Kickoff Prompt

Copy this into a new Claude Code session to begin execution:

```
Read the following files in order:
1. modules/flash/src/index.ts
2. apps/mobile/app/(flash)/_layout.tsx
3. apps/mobile/app/(flash)/study.tsx
4. docs/plans/active/quizlet-tasks.md

Then execute FLASH-01 through FLASH-06 (P0 tasks) in order. After each task:
- Run pnpm typecheck
- Verify the feature works by reading the output
- Move to the next task

Rules reminder:
- ACCENT = FLASH_MODULE.accentColor (#FBBF24)
- Cool Obsidian tokens from @mylife/ui
- New screens register in _layout.tsx with href: null
- New hamburger items go in study.tsx menu array (lines 64-72)
- Export all new public API from modules/flash/src/index.ts
- Run pnpm typecheck after each file edit
```
