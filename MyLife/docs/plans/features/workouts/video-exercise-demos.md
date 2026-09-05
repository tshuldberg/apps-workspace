# Feature Spec: Video Exercise Demos

## Metadata
- **Module:** workouts
- **Feature ID:** WO-014
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [4] x3 + Switching [3] x3 + Complexity [1] x2 + CrossModule [1] x1 + PaidUser [3] x1
- **Sprint:** S9+
- **Estimated CC Time:** 4-6 hours
- **Depends On:** WO-001 (Exercise Library - exercises to link demos to)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Beginners and intermediate lifters need visual form guidance to perform exercises safely. Every major fitness app (JEFIT, Fitbod, Hevy, Nike Training Club, Peloton) includes exercise demonstration videos or animations. Users switching from these apps will expect visual form references. Poor form leads to injury, which leads to churn. This feature directly reduces the "I don't know how to do this exercise" barrier.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| JEFIT | Yes | Free | 1400+ exercise animations, bodybuilding focus |
| Fitbod | Yes | Paid ($96/yr) | Short video clips for all exercises |
| Hevy | Yes | Free | GIF-style exercise animations for most exercises |
| Nike Training Club | Yes | Free | Full trainer-led video demos |
| Peloton | Yes | Paid ($192/yr) | High-production instructor videos |
| Strong | Partial | Free | Static illustrations for some exercises |

### Target User
Fitness beginners (persona: Sam) who are unsure which exercises target which muscles and need form guidance. Also intermediate lifters learning new exercises from generated workouts or coach-assigned plans.

## Technical Context

### Where This Lives in MyLife
```
modules/workouts/src/demo.ts                         -- Demo asset resolution logic
modules/workouts/src/types.ts                        -- DemoAsset types
modules/workouts/src/data/demos/                     -- Bundled Lottie JSON files (Phase 1)
apps/mobile/app/(workouts)/exercise-demo.tsx          -- Mobile demo modal
apps/mobile/components/workouts/DemoPlayer.tsx        -- Reusable demo player component
apps/mobile/components/workouts/DemoButton.tsx        -- Small demo trigger button
apps/web/app/workouts/exercises/[id]/demo/page.tsx    -- Web demo page
apps/web/components/workouts/DemoPlayer.tsx           -- Web demo player component
```

### Wireframe Position
```
Hub Dashboard
  └── MyWorkouts card
       └── Explore tab > Exercise Detail
       │    └── Demo Player (full-width, auto-play) ← ON EXERCISE DETAIL
       └── Active Workout
            └── Set Logger (per exercise)
                 └── "Demo" button ← DURING WORKOUT
                      └── Demo Modal (overlay, looping animation)
```

### Data Model

No new tables required. Demos use existing fields on the `wk_exercises` table:

```sql
-- Already exists in wk_exercises:
-- video_url TEXT,        -- path to demo animation/video (null if unavailable)
-- thumbnail_url TEXT,    -- path to static preview frame (null if unavailable)
```

These fields are currently null for all exercises. This feature populates them with asset paths for the initial set of exercises and builds the resolution + playback logic.

**Asset URI conventions:**
- Bundled Lottie: `asset://demos/{exercise-slug}.lottie.json`
- Bundled GIF: `asset://demos/{exercise-slug}.gif`
- Remote video: `https://cdn.mylife.app/demos/{exercise-slug}.mp4` (Phase 2)

### Dependencies
- **Internal:** `@mylife/db` (read exercise video_url/thumbnail_url), `@mylife/ui` (tokens)
- **External:**
  - `lottie-react-native` (mobile Lottie player)
  - `@lottiefiles/react-lottie-player` (web Lottie player) or `lottie-web`
  - Bundled Lottie JSON animation files (Phase 1: top 20 exercises)
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a beginner, I want to see a short looping animation of how to perform an exercise on the Exercise Detail screen, so I learn proper form before starting.
2. As a lifter mid-workout, I want to tap a "Demo" button on the exercise card to see a quick form reminder without leaving the workout player.
3. As a user, I want a slow-motion toggle so I can study the movement in detail.
4. As a user on a slow connection, I want demos to load from bundled assets so they work offline.

### Behavior Specification

**Exercise Detail Screen:**
1. User navigates to Explore > taps an exercise.
2. Exercise Detail screen opens.
3. If `video_url` is not null, a demo player auto-plays at the top of the screen in a loop.
4. Player shows the animation at normal speed.
5. Below the player, a "Slow Motion" toggle switches to 0.5x playback speed.
6. If `video_url` is null, the player area shows "Demo coming soon" placeholder.

**During Active Workout:**
1. User is in the Set Logger for a specific exercise.
2. A small "Demo" button (play icon) appears next to the exercise name.
3. If the exercise has a demo (video_url not null), tapping opens a modal overlay.
4. Modal shows the animation looping with a close (X) button and slow motion toggle.
5. If no demo exists, the "Demo" button is hidden.
6. Workout timer continues while the demo modal is open.

**Asset Resolution:**
1. Read `video_url` from the exercise record.
2. If starts with `asset://`: resolve as a bundled local asset (require from app bundle).
3. If starts with `https://`: load from remote URL with caching.
4. If null: show "Demo coming soon" placeholder text.

### Edge Cases
- Bundled asset file missing from bundle (build error): show "Demo unavailable" and log error.
- Remote asset fails to load (network error): show "Demo unavailable" with "Retry" button.
- Lottie animation player crashes: catch error, hide demo for that exercise, app continues.
- User-created custom exercises: no demo available, "Demo" button hidden.
- Very slow animation (> 30 seconds): Lottie animations should be 3-8 seconds max. Enforce this in asset creation.
- Exercise has both video_url and thumbnail_url: show thumbnail as preview/poster while animation loads.
- Demo modal opened during rest timer: rest timer continues to count down behind the modal.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Exercise Detail screen shows a looping animation for exercises with a demo asset.
- [ ] **AC-2:** "Demo coming soon" placeholder appears for exercises without a demo.
- [ ] **AC-3:** "Slow Motion" toggle switches playback to 0.5x speed and back to 1x.
- [ ] **AC-4:** During an active workout, a "Demo" button appears on exercises with demos.
- [ ] **AC-5:** Tapping "Demo" during a workout opens a modal overlay with the animation.
- [ ] **AC-6:** The modal has a close (X) button and slow motion toggle.
- [ ] **AC-7:** The workout timer continues while the demo modal is open.
- [ ] **AC-8:** "Demo" button is hidden for exercises without demo assets.
- [ ] **AC-9:** Bundled demos work offline without network access.
- [ ] **AC-10:** Thumbnail preview shows while animation is loading (if thumbnail_url exists).

### Technical Criteria
- [ ] **TC-1:** `resolveDemoAsset` correctly resolves `asset://` paths to bundled files.
- [ ] **TC-2:** `resolveDemoAsset` correctly resolves `https://` URLs for remote assets.
- [ ] **TC-3:** `resolveDemoAsset` returns null for exercises with no video_url.
- [ ] **TC-4:** Exercise seed data is updated with video_url paths for initial exercise set.
- [ ] **TC-5:** Lottie animation player handles errors gracefully (no crash on bad animation data).
- [ ] **TC-6:** Demo modal does not interrupt the workout engine state machine.

### Negative Criteria
- [ ] **NC-1:** Demo playback must NOT pause or interfere with the workout timer or rest timer.
- [ ] **NC-2:** Remote demo URLs must NOT be fetched if `asset://` path resolves successfully (prefer local).
- [ ] **NC-3:** Demo assets must NOT be included in cloud sync or backup (they're bundled with the app).

## UI Specification

### Mobile (Expo)
- **Exercise Detail demo player:**
  - Full-width, aspect ratio 1:1 or 4:3
  - Background: `#12121A` (surface token)
  - Rounded corners (12px)
  - Slow motion toggle below: pill-shaped, glass style
  - Placeholder: centered text "Demo coming soon" in `textSecondary`

- **Workout demo modal:**
  - Semi-transparent overlay (black 80% opacity)
  - Centered animation player (80% screen width)
  - Close button: top-right, white X on glass circle
  - Slow motion toggle: bottom-center
  - Module accent `#EF4444` for active toggle state

### Web (Next.js)
- Same design tokens
- Exercise Detail: Lottie player at top of exercise page
- No workout modal (web workout player is not yet built); link to demo page instead
- Route: `/workouts/exercises/[id]/demo`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton rectangle with shimmer | Asset loading |
| Playing | Looping animation at 1x speed | Asset loaded, auto-play |
| Slow Motion | Looping animation at 0.5x speed | Slow motion toggle on |
| Unavailable | "Demo coming soon" text | video_url is null |
| Error | "Demo unavailable" with retry | Asset failed to load |

## Test Requirements

### Unit Tests
- [ ] `resolveDemoAsset`: handles `asset://demos/pushup.lottie.json` -> local path
- [ ] `resolveDemoAsset`: handles `https://cdn.example.com/demo.mp4` -> URL passthrough
- [ ] `resolveDemoAsset`: handles null video_url -> returns null
- [ ] `resolveDemoAsset`: handles empty string video_url -> returns null
- [ ] `getDemoStatus`: returns 'available' | 'unavailable' based on video_url presence
- [ ] Exercise seed update: initial exercises have correct video_url paths

### Integration Tests
- [ ] Full flow: navigate to exercise detail -> demo auto-plays -> toggle slow motion -> speed changes
- [ ] Workout flow: start workout -> tap Demo on exercise -> modal opens -> close modal -> workout continues
- [ ] Error flow: corrupt asset path -> "Demo unavailable" shown -> app continues normally

### QA Verification Script
1. Open the app on mobile
2. Navigate to MyWorkouts > Explore tab
3. Tap an exercise that has a demo (e.g., Push-up)
4. Verify: demo animation plays in a loop at the top of the screen -- corresponds to AC-1
5. Tap "Slow Motion" toggle
6. Verify: animation speed visibly slows to half speed -- corresponds to AC-3
7. Navigate back, tap an exercise without a demo
8. Verify: "Demo coming soon" placeholder appears -- corresponds to AC-2
9. Start a workout that includes an exercise with a demo
10. In the Set Logger, verify "Demo" button visible -- corresponds to AC-4
11. Tap "Demo" button
12. Verify: modal overlay opens with looping animation -- corresponds to AC-5
13. Verify: close button and slow motion toggle present -- corresponds to AC-6
14. Verify: workout timer continues behind the modal -- corresponds to AC-7
15. Close the modal, verify workout is still in progress
16. Turn off WiFi/cellular, navigate to an exercise detail with a bundled demo
17. Verify: demo still plays offline -- corresponds to AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to exercise detail, verify demo plays, test slow motion, test unavailable state
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building (Complexity score: 1, inverse: high)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The `wk_exercises` table has `video_url` and `thumbnail_url` columns but they are null for all 50+ exercises. No demo player component exists. No Lottie integration. The exercise detail screen shows text information only.

### After This Work
- `resolveDemoAsset` function for asset path resolution
- DemoPlayer component (mobile + web) with Lottie animation support
- DemoButton component for use in Set Logger during workouts
- Demo modal for mid-workout form reference
- Initial 20 exercises populated with bundled Lottie asset paths
- Seed data updated with video_url values
- Slow motion toggle (0.5x/1x speed)

### Files Changed
- `modules/workouts/src/demo.ts` -- new file: resolveDemoAsset, getDemoStatus
- `modules/workouts/src/types.ts` -- add DemoAsset type, DemoStatus type
- `modules/workouts/src/data/exercise-seed.json` -- update entries with video_url paths
- `modules/workouts/src/data/demos/` -- bundled Lottie JSON files (Phase 1: 20 exercises)
- `modules/workouts/src/index.ts` -- export demo functions
- `apps/mobile/app/(workouts)/exercise-demo.tsx` -- demo modal screen
- `apps/mobile/components/workouts/DemoPlayer.tsx` -- Lottie player component
- `apps/mobile/components/workouts/DemoButton.tsx` -- small trigger button
- `apps/web/app/workouts/exercises/[id]/demo/page.tsx` -- web demo page
- `apps/web/components/workouts/DemoPlayer.tsx` -- web Lottie player

### Known Limitations
- Phase 1 covers 20 exercises only. Remaining exercises show "Demo coming soon".
- No video support in Phase 1 (Lottie animations only). Video CDN delivery is Phase 2.
- No user-contributed demos. All demos are curated by the MyWorkouts team.
- No AI pose estimation or form correction. Demos are passive visual references.

### Context for Next Agent
Lottie JSON files should be sourced from LottieFiles or created with After Effects + Bodymovin. Keep file sizes under 100KB per animation for bundle size. The `asset://` URI scheme is a custom convention resolved at runtime by the DemoPlayer component, not by the OS. The exercise seed JSON file at `src/data/exercise-seed.json` needs a new `videoUrl` field added to each entry that has a demo.
