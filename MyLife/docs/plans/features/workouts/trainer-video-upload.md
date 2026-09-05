# Feature Spec: Trainer Video Upload System

## Metadata
- **Module:** workouts
- **Feature ID:** I12-4a
- **Priority Score:** 34 / 50 (A-Tier)
- **Scoring Breakdown:** Market [5] x3 + Switching [4] x3 + Complexity [2] x2 + CrossModule [1] x1 + PaidUser [4] x1
- **Sprint:** S12
- **Estimated CC Time:** 8-12 hours
- **Depends On:** WO-014 (Video Exercise Demos -- demo playback layer), exercise library (50 exercises seeded)
- **Blocks:** none

## Business Context

### Why This Feature Exists
A real trainer is testing MyWorkouts via TestFlight and needs to upload exercise demonstration videos. The existing WO-014 spec covers passive Lottie animation playback, but the actual content pipeline (how videos get created and assigned to exercises) does not exist. Without a trainer upload workflow, populating the 50-exercise library with video demos requires manual asset bundling per app release. This feature lets a trainer record or pick a video on their phone, assign it to an exercise, and have other users see it immediately.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Trainerize | Yes | Paid ($5-$300/mo) | Trainers upload videos per exercise in a web dashboard |
| TrueCoach | Yes | Paid ($19-$99/mo) | Video upload + assignment via coach portal |
| Caliber | Yes | Paid ($200+/mo) | Coach records demos, assigns to client programs |
| Hevy Coach | Yes | Paid ($49-$89/mo) | Trainers upload custom exercise videos |
| Nike Training Club | No (internal) | N/A | Videos produced by Nike's production team, not trainer-uploaded |

### Target User
**Primary:** Trainer/coach testing via TestFlight who records exercise demo videos on their iPhone and assigns them to exercises in the library. They are creating content, not consuming it.
**Secondary:** End users who see the trainer's uploaded video demos on exercise detail screens instead of "Demo coming soon" placeholders.

## Technical Context

### Where This Lives in MyLife

```
modules/workouts/src/db/schema.ts            -- New wk_exercise_videos table + wk_trainers table
modules/workouts/src/db/crud.ts              -- Video CRUD operations + trainer CRUD
modules/workouts/src/types.ts                -- ExerciseVideo, Trainer, VideoAngle schemas
modules/workouts/src/definition.ts           -- V6 migration
modules/workouts/src/index.ts                -- Export new functions
apps/mobile/app/(workouts)/exercise-detail.tsx    -- Video playback on exercise detail
apps/mobile/app/(workouts)/video-upload.tsx        -- Video upload screen (camera/gallery)
apps/mobile/app/(workouts)/video-manage.tsx        -- Manage videos for an exercise
apps/web/app/workouts/exercises/[id]/videos/       -- Web video management (trainer view)
```

### Wireframe Position

```
Hub Dashboard
  └── MyWorkouts card
       └── Explore tab > Exercise Detail
       │    └── Trainer Demo Video (top, auto-play) ← END USER VIEW
       │    └── [Trainer only] "Upload Demo" FAB ← TRAINER ACTION
       │         └── Video Upload screen
       │              ├── Record with camera
       │              ├── Pick from gallery
       │              ├── Trim/preview
       │              ├── Select angle (front, side, back, detail, common mistakes)
       │              └── Confirm upload
       └── Explore tab > Exercise Detail > "Manage Videos" (trainer only)
            └── Video list with reorder, delete, set-as-primary
```

### Data Model

Two new tables in V6 migration:

```sql
-- Trainer profiles: who is authorized to upload demo content
CREATE TABLE IF NOT EXISTS wk_trainers (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_uri TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exercise demo videos uploaded by trainers
CREATE TABLE IF NOT EXISTS wk_exercise_videos (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  trainer_id TEXT NOT NULL,
  video_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  angle TEXT NOT NULL DEFAULT 'front'
    CHECK (angle IN ('front', 'side', 'back', 'detail', 'common_mistakes')),
  duration_seconds REAL NOT NULL DEFAULT 0,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  storage_type TEXT NOT NULL DEFAULT 'local'
    CHECK (storage_type IN ('local', 'supabase', 'cdn')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Indexes:**
```sql
CREATE INDEX IF NOT EXISTS wk_exercise_videos_exercise_idx
  ON wk_exercise_videos(exercise_id, sort_order);
CREATE INDEX IF NOT EXISTS wk_exercise_videos_trainer_idx
  ON wk_exercise_videos(trainer_id);
CREATE INDEX IF NOT EXISTS wk_exercise_videos_primary_idx
  ON wk_exercise_videos(exercise_id, is_primary);
CREATE INDEX IF NOT EXISTS wk_trainers_active_idx
  ON wk_trainers(is_active);
```

**Relationship to existing schema:**
- `wk_exercise_videos.exercise_id` references `wk_exercises.id` (no FK constraint -- exercises are seeded, not user-created, so referential integrity is managed in application code)
- `wk_exercise_videos.trainer_id` references `wk_trainers.id`
- The existing `wk_exercises.video_url` and `thumbnail_url` columns remain as a fallback for bundled Lottie assets (WO-014). The new `wk_exercise_videos` table takes priority when videos exist.

### Video Storage Strategy

| Phase | Environment | Storage | URI Pattern |
|-------|-------------|---------|-------------|
| TestFlight (now) | Local device | App Documents directory | `file:///.../{exercise_id}/{video_id}.mp4` |
| Production v1 | Cloud | Supabase Storage | `supabase://workouts/demos/{exercise_id}/{video_id}.mp4` |
| Production v2 | CDN | CloudFront/R2 | `https://cdn.mylife.app/demos/{exercise_id}/{video_id}.mp4` |

**TestFlight phase (this implementation):**
- Videos stored in the app's Documents directory under `exercise-demos/`
- SQLite records the `file://` URI
- `storage_type = 'local'`
- Videos persist across app updates but NOT across app reinstalls
- Thumbnail auto-generated from first frame using `expo-video-thumbnails`

**Production migration path:**
- When cloud storage is wired, a background job reads all `storage_type = 'local'` records, uploads to Supabase Storage, updates URI and `storage_type`
- New uploads go directly to Supabase Storage
- CDN layer added later as a caching/delivery optimization

### Dependencies
- **Internal:** `@mylife/db` (SQLite adapter), `@mylife/ui` (tokens, components)
- **External:**
  - `expo-image-picker` (camera + gallery picker, already in project)
  - `expo-video-thumbnails` (auto-generate thumbnail from video)
  - `expo-av` (video playback on exercise detail)
  - `expo-file-system` (local storage management)
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a trainer, I want to record a video demo of an exercise using my phone's camera, so I can show proper form.
2. As a trainer, I want to pick an existing video from my gallery, so I can upload pre-recorded content.
3. As a trainer, I want to trim and preview a video before uploading, so I only publish clean demos.
4. As a trainer, I want to tag a video with an angle (front, side, back, detail, common mistakes), so users can see the exercise from multiple perspectives.
5. As a trainer, I want to manage multiple videos per exercise (reorder, delete, set primary), so the best demo appears first.
6. As a user, I want to see a trainer's video demo on the exercise detail screen, so I learn proper form.
7. As a user, I want to swipe between multiple angle videos for an exercise, so I can study form from different perspectives.

### Behavior Specification

**Trainer Upload Flow:**
1. Trainer navigates to Explore > taps an exercise.
2. Exercise Detail screen opens. If trainer role is active, a "Upload Demo" FAB appears (bottom-right, accent color).
3. Trainer taps FAB. Upload screen opens with two options: "Record Video" and "Choose from Gallery".
4. **Record path:** Camera opens in video mode. Trainer records. On completion, video file is available.
5. **Gallery path:** Image picker opens filtered to videos only. Trainer selects a video.
6. Preview screen shows the video playing in a loop.
7. Trim controls: drag start/end handles on a timeline scrubber. Max duration: 30 seconds. Min duration: 3 seconds.
8. Angle picker: segmented control with options (Front, Side, Back, Detail, Common Mistakes).
9. Optional notes field for the trainer to add context ("Keep elbows tucked").
10. Trainer taps "Upload". System:
    a. Copies video to Documents directory under `exercise-demos/{exercise_id}/`.
    b. Generates thumbnail from first frame.
    c. Reads file metadata (duration, dimensions, file size).
    d. Inserts `wk_exercise_videos` record.
    e. If this is the first video for the exercise, sets `is_primary = 1`.
11. Success confirmation. Trainer returns to exercise detail, video now visible.

**Trainer Video Management:**
1. On exercise detail, trainer sees a "Manage Videos" link below the video player.
2. Management screen shows all videos for this exercise in a sortable list.
3. Each row: thumbnail, angle badge, duration, trainer name, date.
4. Swipe-to-delete with confirmation.
5. Tap-and-hold to reorder (drag handle).
6. Tap a video to set it as primary (star icon).

**End User View (Exercise Detail):**
1. User navigates to exercise detail.
2. If `wk_exercise_videos` has records for this exercise:
   a. Primary video auto-plays (muted, looping) at top of screen.
   b. If multiple videos exist, a horizontal dot indicator shows below the player.
   c. User swipes horizontally to see other angles. Angle label badge overlays top-left.
3. If no uploaded videos exist, falls back to WO-014 behavior (Lottie asset or "Demo coming soon").
4. Below the video: trainer name and angle label.

**Trainer Role:**
1. During TestFlight, trainer status is set via a hidden debug gesture: triple-tap the workouts module header.
2. A prompt asks for the trainer's display name. On confirm, a `wk_trainers` record is created.
3. Trainer flag persists in SQLite. The app checks for an active trainer record to show upload controls.
4. In production, trainer role will be managed via Supabase auth roles (future work).

### Edge Cases
- **Large video file (> 100MB):** Show warning before upload. Compress to 720p if original is 1080p+. Reject files > 200MB.
- **Unsupported format:** Only accept .mp4 and .mov. Show error for other formats.
- **Upload interrupted (app backgrounded):** File copy is atomic (write to temp, then rename). Partial files are cleaned up on next app launch.
- **Multiple trainers uploading to same exercise:** Both videos appear. Each tagged with their trainer_id. Sort by sort_order, then created_at.
- **Exercise deleted from seed data:** Orphaned videos remain in storage. A cleanup function can be run manually. Videos without a matching exercise_id are hidden from UI.
- **Disk space low:** Check available space before upload. Warn if < 500MB free.
- **Video with no audio:** Fine. Demo videos are typically silent. Player is muted by default.
- **Landscape vs portrait video:** Player adapts aspect ratio. Prefer portrait (9:16) for mobile-first. Accept any orientation.
- **Trainer deactivated:** Videos remain visible. Only upload controls are hidden.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Trainer sees "Upload Demo" FAB on exercise detail when trainer role is active.
- [ ] **AC-2:** Tapping FAB presents "Record Video" and "Choose from Gallery" options.
- [ ] **AC-3:** Recording with camera produces a video file that appears in the preview screen.
- [ ] **AC-4:** Picking from gallery opens a video-only picker and selected video appears in preview.
- [ ] **AC-5:** Trim controls allow setting start/end points within 3-30 second range.
- [ ] **AC-6:** Angle picker shows 5 options (Front, Side, Back, Detail, Common Mistakes).
- [ ] **AC-7:** After upload, video immediately appears on the exercise detail screen.
- [ ] **AC-8:** End user sees the primary video auto-playing (muted, looping) on exercise detail.
- [ ] **AC-9:** Swiping horizontally cycles through multiple angle videos with dot indicator.
- [ ] **AC-10:** Angle label badge appears on each video (e.g., "Front View", "Side View").
- [ ] **AC-11:** "Manage Videos" link visible to trainers, hidden from regular users.
- [ ] **AC-12:** Video management screen shows sortable list with delete and reorder.
- [ ] **AC-13:** Setting a video as primary updates the exercise detail to show that video first.
- [ ] **AC-14:** Triple-tap debug gesture activates trainer mode with name prompt.
- [ ] **AC-15:** Non-trainer users see no upload controls, only video playback.

### Technical Criteria
- [ ] **TC-1:** `wk_exercise_videos` table created in V6 migration with correct schema.
- [ ] **TC-2:** `wk_trainers` table created in V6 migration with correct schema.
- [ ] **TC-3:** Video file stored in Documents directory under `exercise-demos/{exercise_id}/`.
- [ ] **TC-4:** Thumbnail auto-generated from first frame via `expo-video-thumbnails`.
- [ ] **TC-5:** File metadata (duration, dimensions, size) correctly extracted and stored.
- [ ] **TC-6:** CRUD operations for exercise videos: create, read (by exercise), update (reorder/primary), delete.
- [ ] **TC-7:** CRUD operations for trainers: create, read, update (deactivate).
- [ ] **TC-8:** Video player falls back to WO-014 Lottie/placeholder when no uploaded videos exist.
- [ ] **TC-9:** Files > 200MB rejected with user-visible error.
- [ ] **TC-10:** Partial uploads cleaned up on next app launch.

### Negative Criteria
- [ ] **NC-1:** Upload controls must NOT appear for non-trainer users.
- [ ] **NC-2:** Video upload must NOT block the main thread (use background file operations).
- [ ] **NC-3:** Uploaded videos must NOT be included in iCloud backup (set `NSURLIsExcludedFromBackupKey`).
- [ ] **NC-4:** Deleting a video from management must NOT affect other exercises' videos.
- [ ] **NC-5:** Trainer deactivation must NOT delete existing uploaded videos.

## UI Specification

### Mobile (Expo)

**Exercise Detail -- Video Player:**
- Full-width, aspect ratio 9:16 (portrait) or 16:9 (landscape), max height 60% screen
- Background: `#0A0A0F` (background token)
- Video plays muted, looping
- Angle badge: top-left, pill shape, `rgba(255,255,255,0.12)` background, white text
- Trainer name: below player, `textSecondary` color
- Dot indicator: centered below player, active dot uses accent `#EF4444`
- "Upload Demo" FAB: bottom-right, 56px circle, accent `#EF4444`, camera icon

**Video Upload Screen:**
- Header: "Upload Demo" with exercise name subtitle
- Two large option cards: "Record Video" (camera icon) and "Choose from Gallery" (photo icon)
- Cards: glass style `rgba(255,255,255,0.04)` with `rgba(255,255,255,0.10)` border
- Preview area: video player with trim timeline below
- Trim handles: accent `#EF4444` circles on timeline
- Angle picker: segmented control, 5 segments, accent highlight
- Notes field: single-line text input, glass border
- Upload button: full-width, accent `#EF4444`, "Upload Demo"

**Video Management Screen:**
- Header: "Manage Videos" with exercise name
- List items: thumbnail (60x80), angle badge, duration, trainer, date
- Drag handle on right for reorder
- Swipe left to reveal red "Delete" action
- Star icon to set as primary (filled star = primary)

### Web (Next.js)
- Video management table at `/workouts/exercises/[id]/videos/`
- Upload via file input (no camera)
- Same video player component with angle tabs instead of swipe
- Trainer role check via same SQLite query

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Videos | WO-014 fallback (Lottie or "Demo coming soon") | No wk_exercise_videos records |
| Single Video | Auto-playing muted video, no dot indicator | One video for exercise |
| Multi-Video | Auto-playing primary video, dot indicator, swipeable | Multiple videos for exercise |
| Uploading | Progress bar overlay on upload button | Upload in progress |
| Upload Error | Red toast "Upload failed" with retry | File copy/metadata error |
| Upload Success | Green toast "Demo uploaded", video appears | Upload complete |
| Trainer Active | FAB visible, "Manage Videos" link visible | Active wk_trainers record |
| Trainer Inactive | No upload controls | No active trainer record |

## Test Requirements

### Unit Tests
- [ ] `createExerciseVideo`: inserts record with correct defaults
- [ ] `createExerciseVideo`: sets is_primary=1 when first video for exercise
- [ ] `getExerciseVideos`: returns videos sorted by sort_order, then created_at
- [ ] `getExerciseVideos`: returns empty array for exercise with no videos
- [ ] `getPrimaryVideo`: returns the is_primary=1 video for an exercise
- [ ] `getPrimaryVideo`: returns null when no videos exist
- [ ] `updateVideoOrder`: updates sort_order for list of video IDs
- [ ] `setPrimaryVideo`: sets target video primary, unsets others for same exercise
- [ ] `deleteExerciseVideo`: removes record and returns deleted video's URI for file cleanup
- [ ] `createTrainer`: inserts trainer record with display_name
- [ ] `getActiveTrainer`: returns trainer when is_active=1, null otherwise
- [ ] `deactivateTrainer`: sets is_active=0
- [ ] `getExerciseVideoCount`: returns correct count per exercise
- [ ] Video angle validation: accepts valid angles, rejects invalid

### Integration Tests
- [ ] Full upload flow: pick video -> set angle -> upload -> record created -> video visible on detail
- [ ] Multi-video flow: upload 3 videos -> reorder -> set primary -> detail shows correct order
- [ ] Trainer activation: triple-tap -> enter name -> trainer created -> FAB appears
- [ ] Fallback flow: no videos -> WO-014 fallback shown -> upload video -> video replaces fallback
- [ ] Delete flow: delete video -> file URI returned -> detail updates -> remaining videos shift

### QA Verification Script (TestFlight)

1. Open app on TestFlight device.
2. Navigate to MyWorkouts > Explore tab.
3. Tap any exercise (e.g., "Push-up").
4. Verify: No upload controls visible (not a trainer yet) -- AC-15.
5. Triple-tap the workouts module header (Home tab title).
6. Enter display name "Coach Mike" in the prompt, confirm.
7. Verify: "Upload Demo" FAB appears on exercise detail -- AC-1, AC-14.
8. Tap FAB.
9. Verify: "Record Video" and "Choose from Gallery" options appear -- AC-2.
10. Tap "Record Video", record a 10-second clip of the exercise.
11. Verify: Preview screen shows the recorded video -- AC-3.
12. Adjust trim handles to 5-second segment.
13. Verify: Trim controls enforce 3-30 second range -- AC-5.
14. Select "Front" angle.
15. Verify: 5 angle options available -- AC-6.
16. Tap "Upload Demo".
17. Verify: Video appears on exercise detail, auto-playing muted -- AC-7, AC-8.
18. Tap FAB again, choose "Choose from Gallery", select a different video.
19. Set angle to "Side", upload.
20. Verify: Dot indicator appears, swiping shows both videos with angle badges -- AC-9, AC-10.
21. Tap "Manage Videos".
22. Verify: Both videos listed with thumbnails and angle badges -- AC-11, AC-12.
23. Set the second video as primary (tap star).
24. Go back to exercise detail.
25. Verify: Second video now plays first -- AC-13.
26. Navigate to a different exercise without videos.
27. Verify: "Demo coming soon" placeholder shown, no video player -- TC-8.
28. Force-quit and reopen app.
29. Verify: Uploaded videos persist and play correctly.

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to exercise detail, upload a video, verify playback
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building (Complexity score: 2)

### Required if this feature contains business logic / calculation engine:
- [ ] N/A (CRUD-heavy, no calculation engine)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
- `wk_exercises` table has `video_url` and `thumbnail_url` columns (null for all 50 exercises)
- No trainer concept exists in the workouts module
- No video upload capability
- Exercise detail screen shows text description only
- WO-014 (Video Exercise Demos) spec exists but covers Lottie animation playback, not content creation

### After This Work
- `wk_exercise_videos` table stores multi-angle trainer-uploaded videos per exercise
- `wk_trainers` table stores trainer profiles with activation state
- Video upload screen with camera record, gallery pick, trim, angle select
- Video management screen with reorder, delete, set-primary
- Exercise detail screen shows uploaded trainer videos (auto-play, muted, swipeable)
- Trainer role activation via debug gesture (TestFlight-appropriate)
- Fallback to WO-014 behavior when no uploaded videos exist

### Files Changed
- `modules/workouts/src/db/schema.ts` -- add CREATE_EXERCISE_VIDEOS, CREATE_TRAINERS tables
- `modules/workouts/src/db/crud.ts` -- add video CRUD (8 functions) and trainer CRUD (4 functions)
- `modules/workouts/src/types.ts` -- add ExerciseVideoSchema, TrainerSchema, VideoAngleSchema
- `modules/workouts/src/definition.ts` -- add WORKOUTS_MIGRATION_V6, bump schemaVersion to 6
- `modules/workouts/src/index.ts` -- export new functions and types
- `apps/mobile/app/(workouts)/video-upload.tsx` -- new: video upload screen
- `apps/mobile/app/(workouts)/video-manage.tsx` -- new: video management screen
- `apps/mobile/app/(workouts)/exercise-detail.tsx` -- modified: add video player, trainer FAB
- `apps/web/app/workouts/exercises/[id]/videos/page.tsx` -- new: web video management

### Known Limitations
- TestFlight videos are device-local only. They do not sync across devices or survive app reinstalls.
- No video compression/transcoding. Source video quality is preserved (may be large files).
- Trainer activation is a debug gesture, not a proper auth flow. Production will use Supabase roles.
- No video streaming. Entire file is loaded into the player. Fine for 3-30 second clips.
- No moderation. Any activated trainer can upload to any exercise.
- Web upload is file-input only (no camera record from browser).

### Context for Next Agent
- The `wk_exercises.video_url` field from WO-014 is a different system (bundled Lottie assets). Do not conflate it with `wk_exercise_videos` (trainer uploads). The exercise detail screen should check `wk_exercise_videos` first, then fall back to `video_url`.
- Production cloud migration: when wiring Supabase Storage, add a `migrateLocalVideosToCloud()` function that iterates `storage_type = 'local'` records, uploads to Supabase Storage bucket `workouts-demos`, and updates the URI + storage_type.
- The `expo-video-thumbnails` package generates thumbnails at a specific timestamp. Use `time = 0` (first frame) for consistency.
- Trainer triple-tap gesture: use `onPress` counter with 500ms timeout reset. Store trainer_id in app state context, not AsyncStorage (SQLite is the source of truth).
- For multi-device sync in production, trainer uploads should go through Supabase and other devices pull from cloud. The local-first approach is intentionally temporary for TestFlight testing.
