# Deferred Feature Gaps: Task Prompts

> 18 tasks to resolve all deferred competitor review gaps.
> Each task is self-contained and executable by a Claude Code session.
> Tasks must run in phase order. Compact context at 60% fill.
> Run `pnpm gate:function:changed` after each task.

## Execution Guide

- Phase 0 must complete before Phases 2-4 (dependency install)
- Phase 1 has zero dependencies, can run anytime
- Within a phase, tasks can run in parallel if they target different modules
- Each prompt includes exact file paths, function names, and acceptance criteria

---

## Phase 0: Install Dependencies

### DEF-00: Install expo-notifications, expo-sharing, expo-local-authentication
**Depends on:** None
**Files to edit:** `apps/mobile/package.json`, `apps/mobile/app.json`
**Prompt:**
> Install three Expo dependencies in the mobile app:
> 1. `cd apps/mobile && npx expo install expo-notifications expo-sharing expo-local-authentication`
> 2. Verify all three appear in `apps/mobile/package.json` dependencies
> 3. Add notification permissions to `apps/mobile/app.json` under `expo.plugins` if not already present: `["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#22C55E" }]`
> 4. Run `pnpm install` from the repo root to update the lockfile
> 5. Verify the app still typechecks: `npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | tail -5`
> Acceptance: all three packages installed, lockfile updated, typecheck clean.

---

## Phase 1: No-Dependency Features (Workouts)

### DEF-01: Workouts Social Feed Mobile UI
**Depends on:** None
**Module:** workouts
**Files to create:** `apps/mobile/app/(workouts)/social-feed.tsx`
**Reference logic:** `modules/workouts/src/social/feed.ts` (sortFeedChronological, paginateFeed, enrichPost, isPostVisible), `modules/workouts/src/sharing.ts` (buildWorkoutSummary), `modules/workouts/src/social/privacy.ts`, `modules/workouts/src/types.ts` (SocialPost, WorkoutSummaryCard)
**Prompt:**
> Create `apps/mobile/app/(workouts)/social-feed.tsx`. Read `modules/workouts/src/index.ts` first to find exact export names. Build a ScrollView-based feed screen. Use `useDatabase` from `../../components/DatabaseProvider`. On mount, query workout sessions, build `SocialPost` objects using `buildWorkoutSummary`, then pipe through `sortFeedChronological` and `paginateFeed`. Each feed card shows: workout title, date, duration/volume stats, exercise list, like/comment count (from `enrichPost`). Use ACCENT = `colors.modules.workouts`, Cool Obsidian tokens. Add empty state: "Complete workouts to build your feed." Add to hamburger menu in `apps/mobile/app/(workouts)/index.tsx` as `{ label: 'Social Feed', route: '/(workouts)/social-feed' }`. Typecheck: `npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | grep "(workouts)"`. Acceptance: screen loads, feed renders chronologically, accessible from menu.

### DEF-02: Workouts Profile Completion Progress
**Depends on:** None
**Module:** workouts
**Files to edit:** `apps/mobile/app/(workouts)/index.tsx`
**Prompt:**
> Add a "Profile Completion" card to the workouts home screen (`apps/mobile/app/(workouts)/index.tsx`). Read the file first. Calculate completion percentage based on: has workouts (20%), has exercises (20%), has sessions (20%), has measurements (20%), has plans (20%). Use existing `getWorkoutDashboard(db)` which returns `workouts`, `exercises`, `sessions` counts. Check `getWorkouts(db)` and `getWorkoutMetrics(db)` for additional data. Render a Card below the metric grid showing: "Profile X% complete" text, a horizontal progress bar (View with width percentage, backgroundColor ACCENT, borderRadius 999), and a list of incomplete items as checkmarks. Use Cool Obsidian tokens. Typecheck after editing. Acceptance: card appears showing completion %, progress bar fills based on actual data, completed items show checkmarks.

---

## Phase 2: Workouts Notifications + Sharing

### DEF-03: Workouts Rest Timer Background Notification
**Depends on:** DEF-00
**Module:** workouts
**Files to edit:** `apps/mobile/app/(workouts)/session.tsx`
**Reference logic:** `expo-notifications` (scheduleNotificationAsync, cancelAllScheduledNotificationsAsync, requestPermissionsAsync)
**Prompt:**
> Edit `apps/mobile/app/(workouts)/session.tsx`. Read the file first. Import `* as Notifications` from `expo-notifications`. Add a `useEffect` that requests notification permissions on mount: `Notifications.requestPermissionsAsync()`. When the rest timer starts (status.state transitions to 'rest'), schedule a local notification: `Notifications.scheduleNotificationAsync({ content: { title: 'Rest Complete', body: 'Time for your next set!', sound: true }, trigger: { seconds: status.restRemaining / 1000 } })`. When rest ends or user skips, cancel: `Notifications.cancelAllScheduledNotificationsAsync()`. Also cancel on unmount. Do NOT change any existing rest timer UI logic. Typecheck after editing. Acceptance: rest timer notification fires when app is backgrounded, cancels when rest ends.

### DEF-04: Workouts Shareable Workout Cards
**Depends on:** DEF-00
**Module:** workouts
**Files to create:** `apps/mobile/app/(workouts)/share-workout.tsx`
**Reference logic:** `modules/workouts/src/sharing.ts` (buildWorkoutSummary, WorkoutSummaryCard), `expo-sharing` (shareAsync)
**Prompt:**
> Create `apps/mobile/app/(workouts)/share-workout.tsx`. Read `modules/workouts/src/index.ts` for exact export names. Accept `sessionId` from `useLocalSearchParams`. Call `buildWorkoutSummary(db, sessionId)` to get the card data. Render a visual card with: workout title, date, duration, total volume (lbs), exercise list with set counts, muscle groups trained, PRs hit. Below the card, show share action buttons: "Copy Text" (copies summary to clipboard via `Clipboard.setStringAsync`), "Share" (formats as text and calls `Sharing.shareAsync`). Card styling: dark background with ACCENT border, large stat numbers, exercise list with small icons. Add to hamburger menu as `{ label: 'Share Workout', route: '/(workouts)/share-workout' }`. Also wire the "Done" button on the celebration screen to offer "Share" as an option. Typecheck after. Acceptance: card renders with workout data, copy and share actions work.

---

## Phase 3: Meds Notification Suite

### DEF-05: Meds Notification Permission + Critical Alerts
**Depends on:** DEF-00
**Module:** meds
**Files to create:** `apps/mobile/app/(meds)/notification-setup.tsx`
**Reference logic:** `expo-notifications` (requestPermissionsAsync, getPermissionsAsync, setNotificationHandler, scheduleNotificationAsync)
**Prompt:**
> Create `apps/mobile/app/(meds)/notification-setup.tsx`. Build a notification setup wizard screen. Step 1: explain why notifications matter for medication adherence ("Never miss a dose"). Step 2: request permissions via `Notifications.requestPermissionsAsync()`. Show permission status with green checkmark or red X. Step 3: if denied, show instructions to enable in Settings with a "Go to Settings" button (use `Linking.openSettings()`). At the top, set up the notification handler: `Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }) })`. Add a helper function `scheduleMedReminder(medName: string, scheduledTime: Date)` that calls `scheduleNotificationAsync` with the med name in the title. Add to hamburger menu in `apps/mobile/app/(meds)/index.tsx`. Typecheck. Acceptance: permissions requested, handler set, screen shows status.

### DEF-06: Meds Custom Notification Sounds
**Depends on:** DEF-05
**Module:** meds
**Files to edit:** `apps/mobile/app/(meds)/notification-setup.tsx`
**Prompt:**
> Edit `apps/mobile/app/(meds)/notification-setup.tsx`. Add a "Notification Sound" section below the permission section. Show a list of 6 sound options as radio buttons: "Default", "Gentle Chime", "Alert Bell", "Morning Bird", "Soft Ping", "Silent". Store the selected sound in hub_settings via `db.execute('INSERT INTO hub_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['meds.notification_sound', selectedSound])`. When scheduling notifications, pass the sound name in the notification content's `sound` field. Note: actual custom sound files would need to be bundled as assets -- for now store the preference and use the default system sound. Typecheck. Acceptance: sound preference saved, selection persists across app restarts.

### DEF-07: Meds Notification Settings Screen
**Depends on:** DEF-05
**Module:** meds
**Files to create:** `apps/mobile/app/(meds)/notification-settings.tsx`
**Prompt:**
> Create `apps/mobile/app/(meds)/notification-settings.tsx`. Build a settings screen with these toggles (stored in hub_settings with `meds.` prefix): (1) "Show Medication Names" toggle (privacy: hide med names in notifications, default ON). (2) "Morning Summary" toggle (daily summary notification at configured time, default OFF). (3) "Snooze Duration" picker (5min, 10min, 15min, 30min, default 10min). (4) "Custom Message" text input (template for notification body, placeholder: "Time to take your {med_name}"). Each setting reads from `db.query('SELECT value FROM hub_settings WHERE key = ?')` on mount and writes via `INSERT ON CONFLICT`. Use Card components for each section, Cool Obsidian tokens, ACCENT = `colors.modules.meds`. Add to hamburger menu. Typecheck. Acceptance: all 4 settings persist, screen renders correctly.

---

## Phase 4: Meds Passcode + Onboarding

### DEF-08: Meds Passcode / Biometric Lock
**Depends on:** DEF-00
**Module:** meds
**Files to create:** `apps/mobile/app/(meds)/passcode-lock.tsx`
**Reference logic:** `expo-local-authentication` (authenticateAsync, hasHardwareAsync, isEnrolledAsync, supportedAuthenticationTypesAsync)
**Prompt:**
> Create `apps/mobile/app/(meds)/passcode-lock.tsx`. Build a passcode/biometric lock settings screen. On mount, check device capabilities: `LocalAuthentication.hasHardwareAsync()`, `LocalAuthentication.isEnrolledAsync()`, `LocalAuthentication.supportedAuthenticationTypesAsync()`. Show: (1) "App Lock" toggle -- when enabled, require authentication on app open. Store preference in hub_settings as `meds.passcode_enabled`. (2) Supported auth types display (Face ID / Touch ID / None). (3) "Test Authentication" button that calls `LocalAuthentication.authenticateAsync({ promptMessage: 'Verify your identity', cancelLabel: 'Cancel' })` and shows success/failure. (4) If no biometrics enrolled, show message: "Set up Face ID or Touch ID in your device Settings to enable app lock." Use Card layout, Cool Obsidian tokens. Add to hamburger menu. Typecheck. Acceptance: capabilities detected, preference stored, test auth works.

### DEF-09: Meds Guided Onboarding Wizard
**Depends on:** None
**Module:** meds
**Files to create:** `apps/mobile/app/(meds)/onboarding.tsx`
**Reference logic:** `modules/meds/src/medication/` (createMedication), `modules/meds/src/models/` (types)
**Prompt:**
> Create `apps/mobile/app/(meds)/onboarding.tsx`. Build a 5-step onboarding wizard: Step 1: Welcome ("Track your medications, completely private") with pill emoji hero. Step 2: "What do you take?" -- simple text input for first medication name + dosage + frequency picker (daily/twice daily/weekly/as needed). Step 3: "When do you take it?" -- time picker for reminder (morning/noon/evening/bedtime chips). Step 4: "Anyone helping you?" -- optional caregiver name + phone for missed dose alerts. Step 5: Review + "Get Started" button. Store onboarding completion in hub_settings as `meds.onboarding_complete`. On the meds home screen (`apps/mobile/app/(meds)/index.tsx`), add a useEffect that checks this setting and redirects to onboarding if not complete AND no medications exist. Use Card layout, spacing tokens, ACCENT = `colors.modules.meds`. Add to hamburger menu. Typecheck. Acceptance: 5-step flow works, first med created, redirects on fresh install.

---

## Phase 5: Books API + Social

### DEF-10: Books Open Library Ratings API + Community Rating Counts
**Depends on:** None
**Module:** books
**Files to create:** `modules/books/src/api/ratings.ts`
**Files to edit:** `modules/books/src/api/index.ts`, `modules/books/src/index.ts`, `modules/books/src/db/schema.ts`, `modules/books/src/definition.ts`
**Prompt:**
> Add Open Library community ratings to the books module. Step 1: Create `modules/books/src/api/ratings.ts` with a function `fetchWorkRatings(workId: string): Promise<{ average: number; count: number } | null>` that calls `https://openlibrary.org/works/${workId}/ratings.json` and extracts `summary.average` and `summary.count`. Handle errors gracefully (return null). Step 2: Add a V8 migration to `definition.ts` that adds two columns: `ALTER TABLE bk_books ADD COLUMN ol_rating_average REAL; ALTER TABLE bk_books ADD COLUMN ol_rating_count INTEGER;`. Step 3: Create a function `syncBookRatings(db, bookId)` that reads the book's `open_library_id`, calls `fetchWorkRatings`, and updates the columns. Step 4: Export both functions from `src/index.ts`. Step 5: In the mobile book detail screen, display "X.XX - N ratings" below the book title when `ol_rating_average` is populated. Run `pnpm test -- --filter @mylife/books` to verify existing tests still pass. Typecheck. Acceptance: ratings fetch works, migration runs, book detail shows community rating.

### DEF-11: Books Friends' Challenge Visibility
**Depends on:** None (uses existing Supabase social infrastructure)
**Module:** books
**Files to create:** `apps/mobile/app/(books)/friends-challenge.tsx`
**Reference logic:** `modules/books/src/social/` (existing Supabase feed infrastructure)
**Prompt:**
> Create `apps/mobile/app/(books)/friends-challenge.tsx`. This screen shows friends' reading challenge progress. Since the social layer uses Supabase and friend connections already exist via `@mylife/books` social module, build the UI that would display this data. For now, build the screen with mock data structure: a list of friend cards showing: avatar placeholder (first initial in circle), username, books read vs goal (e.g., "12 of 24 books"), progress bar (width percentage), and "2026 Reading Challenge" label. Include an empty state: "Connect with friends to see their reading challenges." Add a "Find Friends" button that navigates to `/(books)/social`. Add to hamburger menu in `apps/mobile/app/(books)/index.tsx`. Use ACCENT = `colors.modules.books`. Typecheck. Acceptance: screen renders with empty state, navigable from menu, ready for Supabase data wiring.

---

## Phase 6: Budget Bank Connection

### DEF-12: Budget Bank Connection Screen
**Depends on:** None (UI only, Plaid integration is separate)
**Module:** budget
**Files to create:** `apps/mobile/app/(budget)/connect-bank.tsx`
**Reference logic:** `modules/budget/src/bank-sync/` (existing Plaid integration code)
**Prompt:**
> Create `apps/mobile/app/(budget)/connect-bank.tsx`. Build the bank connection screen with: (1) Header: "Add Accounts" with search bar ("Search by institution name"). (2) Popular banks grid (2 columns): Chase, Capital One, American Express, Bank of America, Citi, Discover, Wells Fargo, Ally, USAA, Apple Card. Each bank is a Pressable card with the bank name in bold text and a colored background matching the bank's brand (use approximate hex colors). (3) Below the grid: "or" divider and "Add an Unlinked Account" button for manual tracking. (4) Tapping a bank shows an Alert: "Bank connection requires Plaid integration. Coming soon!" (placeholder until Plaid production keys are available). (5) Tapping "Add an Unlinked Account" navigates to `/(budget)/accounts`. Add to hamburger menu. Use ACCENT = `colors.modules.budget`. Typecheck. Acceptance: screen renders with bank grid, search works as filter, unlinked account navigates correctly.

---

## Phase 7: Polish Items

### DEF-13: Meds Home Screen Style Selection
**Depends on:** None
**Module:** meds
**Files to create:** `apps/mobile/app/(meds)/home-style.tsx`
**Files to edit:** `apps/mobile/app/(meds)/index.tsx`
**Prompt:**
> Create `apps/mobile/app/(meds)/home-style.tsx`. Build a style picker screen with 3 layout options: (1) "Timeline" -- chronological list of today's medications with times (current default). (2) "Pillbox" -- grid of medication cards organized by time of day (morning/noon/evening/bedtime rows). (3) "Simple List" -- flat list of all active medications with next-due indicator. Each option shows a preview thumbnail (a small View with approximate layout using colored rectangles). Store selection in hub_settings as `meds.home_style` (values: 'timeline', 'pillbox', 'simple'). On the meds home screen, read this setting and adjust the medication list rendering accordingly. For "pillbox" mode, group medications by their schedule time into 4 rows. For "simple" mode, show a flat sorted list. Add to hamburger menu. Typecheck. Acceptance: 3 styles selectable, preference persists, home screen renders differently per style.

### DEF-14: Budget Emotional Onboarding Copy
**Depends on:** None
**Module:** budget
**Files to edit:** `apps/mobile/app/(budget)/onboarding.tsx`
**Prompt:**
> Edit `apps/mobile/app/(budget)/onboarding.tsx`. Read the file first. Enhance the onboarding copy with emotional, YNAB-inspired messaging. Update step text: Step 1 hero subtitle: "We'll help you get good with money, so you never have to worry again." Add a testimonial card after the goal selection step: a Card with a user photo placeholder (circle with initials), quote text "We paid off $8K in debt AND paid for a family vacation", attribution "-- 6 months into budgeting". Add stats card: "92% of users report feeling less financial stress." Keep all existing functionality. Use Cool Obsidian tokens. Typecheck. Acceptance: enhanced copy renders, no functional changes.

### DEF-15: Budget In-App Knowledge Base
**Depends on:** None
**Module:** budget
**Files to create:** `apps/mobile/app/(budget)/help.tsx`
**Prompt:**
> Create `apps/mobile/app/(budget)/help.tsx`. Build a searchable FAQ / knowledge base screen. Define 10 FAQ items as a const array: [{ q: "What is envelope budgeting?", a: "..." }, ...]. Cover: envelope budgeting concept, how to create envelopes, recording transactions, what happens when you overspend, savings goals, recurring transactions, CSV import, bank sync, subscription tracking, getting started tips. Render as expandable accordion cards (Pressable toggles answer visibility). Add a TextInput search bar at top that filters questions by keyword match. Include a "Questions? We've got answers!" header. Add a "Contact Support" link at bottom (placeholder). Add to hamburger menu. Use ACCENT = `colors.modules.budget`. Typecheck. Acceptance: FAQ renders, search filters, accordions expand/collapse.

---

## Phase 8: Large Native Features (Defer Further If Needed)

### DEF-16: Books Cover Scanning (Apple Vision)
**Depends on:** Native Swift module
**Module:** books
**Prompt:**
> This task requires building a native Swift module that uses Apple's Vision framework for text/image recognition to identify book covers. This is a large effort requiring: (1) A native Expo module (`expo-modules-core` config plugin) with Swift code that captures a camera frame, runs VNRecognizeTextRequest + VNClassifyImageRequest, and returns recognized text (title/author). (2) Integration with the Open Library search API to match recognized text to book records. (3) A React Native bridge to call the native module from the scan screen. **Estimated effort: 2-3 sessions.** For now, document the approach in `modules/books/CLAUDE.md` under a "Future: Cover Scanning" section. Do not attempt to build the native module in this task.

### DEF-17: Meds Drug Database Search (FDA/RxNorm)
**Depends on:** External API evaluation
**Module:** meds
**Prompt:**
> This task requires evaluating and integrating an external drug database API. Options: (1) FDA NDC (National Drug Code) database -- free, public domain, ~100K drugs. (2) RxNorm API from NLM -- free, comprehensive drug naming. (3) OpenFDA API -- free, drug label data. **Estimated effort: 2-3 sessions.** For now, document the approach in `modules/meds/CLAUDE.md` under a "Future: Drug Database" section with API comparison table and recommended integration path. Build a stub function `searchDrugDatabase(query: string)` that returns an empty array with a TODO comment. Do not integrate a real API in this task.

---

## Kickoff Prompt

Copy this to start execution:

```
Execute the deferred feature gaps mission control.

Plan: docs/plans/active/deferred-gaps-mission-control.md
Tasks: docs/plans/active/deferred-gaps-tasks.md

Start with Phase 0 (install dependencies), then Phase 1 (no-dep features),
then proceed through Phases 2-7 sequentially. Phase 8 is documentation only.

RULES:
- Read each target file BEFORE editing
- Read module index.ts for types BEFORE writing screens
- Use camelCase matching module types
- Typecheck after EACH file
- Add new screens to hamburger menu
- Compact context at 60% fill
- Commit after each phase completes

Report progress at each phase transition.
```
