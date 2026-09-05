# Feature Spec: Workout Sharing

## Metadata
- **Module:** workouts
- **Feature ID:** WO-021
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [4] x3 + Switching [2] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** S9+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** WO-004 (Set/Rep/Weight Logging - session data)
- **Blocks:** WO-023 (Social Feed - uses workout summary data for posts)

## Business Context

### Why This Feature Exists
Gym-goers routinely share workout summaries on Instagram Stories, Twitter, and group chats. Currently they screenshot the completion screen, which looks unprofessional and lacks branding. A purpose-built share card with clean design, stats, and PR badges turns every completed workout into organic marketing for MyWorkouts. Strava pioneered this pattern (their activity share cards are iconic), and Hevy has adopted it. This is a low-effort, high-visibility feature that drives word-of-mouth acquisition.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Strava | Yes | Free | Polished activity cards with route map, stats, segments. Iconic orange branding |
| Hevy | Yes | Free | Workout summary card with exercises, volume, duration. Clean layout |
| Strong | No | N/A | No share functionality beyond screenshots |
| JEFIT | No | N/A | No share cards |
| Fitbod | No | N/A | No share cards |

### Target User
Any gym-goer who shares fitness content on social media. Primary: lifters who post to Instagram Stories (18-35 demographic). Secondary: group chat sharers who send workout summaries to accountability partners.

## Technical Context

### Where This Lives in MyLife
```
modules/workouts/src/sharing.ts                    -- Summary generation + card data builder
modules/workouts/src/types.ts                      -- WorkoutSummaryCard type
apps/mobile/app/(workouts)/share-card.tsx           -- Mobile share card renderer + share sheet
apps/mobile/components/workouts/ShareCardView.tsx   -- Renderable card component (for react-native-view-shot)
apps/web/app/workouts/share/[sessionId]/page.tsx    -- Web share card page + download
```

### Wireframe Position
```
Hub Dashboard
  └── MyWorkouts card
       └── Active Workout (complete)
            └── Workout Completion Summary
                 └── "Share" button ← YOU ARE HERE
                      └── Share Card (generated image)
                           └── System Share Sheet
```

### Data Model

No new tables required. The share card is computed from existing data:
- `wk_workout_sessions` (session duration, exercises completed)
- `wk_workout_set_weights` (per-set weight/reps for volume calculation)
- `wk_exercise_1rm_history` (PR detection)
- `wk_exercises` (exercise names, muscle groups)

A `WorkoutSummaryCard` type is computed at share time and not persisted.

### Dependencies
- **Internal:** `@mylife/db` (session/set data queries), `@mylife/ui` (Cool Obsidian tokens for card styling), body-map module (mini body map for muscle groups worked)
- **External:** `react-native-view-shot` (mobile image capture), Canvas API (web image generation), `expo-sharing` (mobile share sheet)
- **Cross-Module:** none for sharing itself, but WO-023 (Social Feed) will consume this summary format

## Functional Requirements

### User Stories
1. As a gym-goer who just finished a hard workout, I want to tap "Share" and get a beautiful summary card I can post to Instagram Stories.
2. As a lifter who hit a PR, I want the share card to highlight my personal record so my friends can see my achievement.
3. As a user, I want to save the share card to my photo library without posting it anywhere.
4. As a web user, I want to download the share card as a PNG.

### Behavior Specification

1. User completes a workout session (all exercises done or user taps "Finish Workout").
2. Workout Completion Summary screen appears with session stats.
3. User taps "Share" button.
4. System generates a `WorkoutSummaryCard` by aggregating session data:
   - Query `wk_workout_set_weights` for this session to calculate total volume.
   - Query `wk_exercise_1rm_history` to detect if any PRs were set during this session.
   - Collect muscle groups from all completed exercises.
5. System renders the card as a styled component:
   - MyWorkouts branding header (logo + "MyWorkouts")
   - Workout title and date
   - Stats grid: Duration, Exercises, Sets, Reps, Volume
   - PR badges (gold star icons with exercise name + new 1RM)
   - Mini body map showing worked muscle groups highlighted
   - "MyWorkouts" watermark footer
6. System captures the rendered component as an image (1080x1920 for Stories format).
7. System opens the platform share sheet with the image.
8. User shares to their chosen destination or saves to photo library.

### Edge Cases
- Session with zero set weights logged: show duration and exercise count but omit volume.
- Session with zero completed exercises (user started and immediately finished): show "Workout started" with duration only.
- Very long workout title (> 40 chars): truncate with ellipsis on the card.
- Many PRs in one session (> 5): show first 3 with "+N more" badge.
- Image generation fails: show error toast "Could not create share card" and let user screenshot the summary screen.
- Share sheet cancelled by user: no action, return to summary screen.
- Offline: sharing works because all data is local. No network needed.
- Web: "Share" uses Web Share API if available, falls back to "Download PNG".

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Share" button is visible on the Workout Completion Summary screen.
- [ ] **AC-2:** Tapping "Share" generates a visually polished card with workout title, date, and stats.
- [ ] **AC-3:** The card shows total duration, exercise count, total sets, total reps, and total volume.
- [ ] **AC-4:** If PRs were achieved, gold PR badges appear on the card with exercise names.
- [ ] **AC-5:** A mini body map on the card highlights the muscle groups worked.
- [ ] **AC-6:** The card includes MyWorkouts branding (logo and app name).
- [ ] **AC-7:** The system share sheet opens with the card image at 1080x1920 resolution.
- [ ] **AC-8:** "Save to Photos" saves the card image to the device photo library.
- [ ] **AC-9:** On web, a "Download PNG" button downloads the card image.

### Technical Criteria
- [ ] **TC-1:** `buildWorkoutSummary` correctly aggregates volume from set weights.
- [ ] **TC-2:** `buildWorkoutSummary` correctly detects PRs by comparing session 1RM values to historical max.
- [ ] **TC-3:** Card image is generated at 1080x1920 pixels (2:1 aspect ratio, Stories format).
- [ ] **TC-4:** Summary generation completes in < 500ms.
- [ ] **TC-5:** Muscle group collection correctly maps exercise IDs to muscle groups via `wk_exercises`.

### Negative Criteria
- [ ] **NC-1:** No workout data is sent to any server during sharing. The image is generated locally.
- [ ] **NC-2:** The share card must NOT include the user's name or profile information (privacy).
- [ ] **NC-3:** Sharing must NOT require an account or authentication.

## UI Specification

### Mobile (Expo)
- Card background: gradient from `#0A0A0F` to `#1A1A24`
- MyWorkouts logo top-center with "MyWorkouts" text in `#F0F0F5`
- Workout title in large bold text, date in `textSecondary`
- Stats grid: 2x3 grid of stat cards (glass style) with icon, value, and label
- PR badges: gold (#FFD700) star icon with exercise name and 1RM value
- Mini body map: simplified body outline with muscle groups filled in `#EF4444` (module accent)
- Watermark: "MyWorkouts" in subtle text at bottom
- Card rendered via `react-native-view-shot` for image capture

### Web (Next.js)
- Same visual design
- Card rendered via HTML Canvas or a styled div captured with `html2canvas`
- "Download PNG" button alongside "Share" (Web Share API)
- Route: `/workouts/share/[sessionId]`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton card with shimmer | Generating summary |
| Success | Polished share card with stats | Summary computed |
| No Volume | Card without volume stat (shows "-") | No set weights logged |
| Error | Toast: "Could not create share card" | Image generation failure |
| Shared | Share sheet opens | User taps Share |

## Test Requirements

### Unit Tests
- [ ] `buildWorkoutSummary`: calculates correct total volume (sum of weight * reps per set)
- [ ] `buildWorkoutSummary`: detects PRs when session has new 1RM records
- [ ] `buildWorkoutSummary`: returns empty prsHit when no PRs achieved
- [ ] `buildWorkoutSummary`: collects correct muscle groups from exercises
- [ ] `buildWorkoutSummary`: handles session with zero set weights (volume = 0)
- [ ] `buildWorkoutSummary`: truncates workout title to 40 characters
- [ ] `buildWorkoutSummary`: caps PR badges at 3 with "+N more" indicator

### Integration Tests
- [ ] Full flow: complete workout -> tap Share -> card generated -> share sheet opens
- [ ] Web flow: complete workout -> card rendered -> Download PNG works

### QA Verification Script
1. Open the app on mobile
2. Navigate to MyWorkouts > start a workout with 3+ exercises
3. Log set weights for each exercise (include at least one heavy set for PR potential)
4. Complete the workout
5. On the Completion Summary screen, verify "Share" button is visible -- corresponds to AC-1
6. Tap "Share"
7. Verify: a styled card appears with workout title, date, and stats grid -- corresponds to AC-2, AC-3
8. Verify: if a PR was hit, gold badge appears on the card -- corresponds to AC-4
9. Verify: mini body map shows highlighted muscle groups -- corresponds to AC-5
10. Verify: MyWorkouts branding visible at top and bottom -- corresponds to AC-6
11. Verify: system share sheet opens with the image -- corresponds to AC-7
12. Cancel sharing, tap "Save to Photos" option -- corresponds to AC-8
13. Verify: image saved to photo library at high resolution

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to workout completion, tap Share, verify card renders
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
Workout completion shows a basic summary with stats. No share card generation, no image export, no share sheet integration. The data needed (sessions, set weights, 1RM history, exercises) all exists and is queryable.

### After This Work
- `buildWorkoutSummary` function computes summary from session data
- Share card rendered as a styled component captured as an image
- System share sheet integration (mobile)
- Download PNG (web)
- PR detection and badge rendering

### Files Changed
- `modules/workouts/src/sharing.ts` -- new file: buildWorkoutSummary, WorkoutSummaryCard type
- `modules/workouts/src/types.ts` -- add WorkoutSummaryCard interface
- `modules/workouts/src/index.ts` -- export sharing functions
- `apps/mobile/app/(workouts)/share-card.tsx` -- share card screen
- `apps/mobile/components/workouts/ShareCardView.tsx` -- renderable card component
- `apps/web/app/workouts/share/[sessionId]/page.tsx` -- web share card page

### Known Limitations
- Card design is static (no user customization of colors or layout).
- No direct posting to Instagram/Twitter APIs (uses system share sheet only).
- Mini body map is a simplified illustration, not the full interactive body map.
- No share history tracking (we don't record when/where the user shared).

### Context for Next Agent
The `WorkoutSummaryCard` type created here is also consumed by WO-023 (Social Feed). Design the type with that reuse in mind. The body map highlighting reuses `buildHighlightData` from `modules/workouts/src/body-map.ts`. For `react-native-view-shot`, wrap the card in a `ViewShot` ref and call `captureRef` to get a URI.
