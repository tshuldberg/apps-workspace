# MyWorkouts - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Implemented (6 tables)

## Current State

MyWorkouts is a workout tracking module with an exercise library of 100+ exercises, a body map for muscle targeting, a workout builder, form recording (video), progress tracking, voice commands during workouts, set/rep/weight logging, and a coach portal for trainers. Data is stored in Supabase (cloud module) for cross-device sync. This is one of two cloud-backed modules alongside MySurf.

## Competitors Analyzed

| Competitor | Price | Category | Key Strength |
|-----------|-------|----------|-------------|
| Strong | $30/yr | Strength training | Clean UI, rest timer, plate calculator, strong community |
| Hevy | $50/yr | Strength training | Social feed, workout sharing, exercise videos |
| Fitbod | $96/yr | AI workouts | AI-generated workouts, recovery tracking, progressive overload |
| Sweat | $120/yr | Guided programs | Trainer-led programs (Kayla Itsines), community |
| Strava | $80/yr | Endurance/GPS | GPS tracking, segments, massive running/cycling community |
| Nike Training Club | Free | Guided workouts | Free trainer-led workouts, 20+ data types collected |
| Peloton | $192/yr | Connected fitness | Live/on-demand classes, leaderboards, hardware integration |

## Feature Gaps

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Rest timer | P0 | Strong, Hevy | Low | Configurable rest timer between sets with auto-start after logging a set. Per-exercise defaults. Vibration/sound alert. This is table-stakes for any workout app. |
| Previous performance display | P0 | Strong, Hevy, Fitbod | Low | Show last workout's weight/reps for each exercise inline during active workout. "Last time: 185 lbs x 8 reps." Critical for progressive overload. |
| Video exercise demos | P1 | Hevy, Fitbod, Sweat, NTC, Peloton | Medium | Short clips (5-10 seconds) showing proper form for each exercise. Can start with animated illustrations or GIFs to avoid video hosting costs. Bundled with the app or lazy-loaded. |
| AI workout generation | P1 | Fitbod | Medium | Generate a workout based on target muscles, available equipment, time constraint, and recovery state. Uses exercise library metadata and recent workout history. Can run as a rule-based engine first, add ML later. |
| Progressive overload automation | P1 | Fitbod | Medium | Auto-suggest weight/rep increases based on performance history. "You hit 8 reps at 185 lbs last 3 sessions. Try 190 lbs today." Configurable progression rules per exercise. |
| Muscle recovery heatmap | P1 | Fitbod | Medium | Visual body map showing which muscles are fresh (green), moderate (yellow), or fatigued (red) based on recent training volume and time since last worked. Extends existing body map feature. |
| GPS route recording | P1 | Strava | High | Record runs, rides, and hikes with map trace, pace splits, elevation profile. Requires background location, battery optimization, and map rendering. Significant engineering effort. |
| Plate calculator | P2 | Strong | Low | Input target barbell weight, show which plates to load on each side. Account for bar weight (45 lbs standard, 35 lbs women's, 15 lbs EZ curl). Simple utility screen. |
| Progress photos | P2 | Hevy, Sweat | Low | Take and store body transformation photos with date stamps. Side-by-side comparison view. Photos stored locally on device, never uploaded. |
| Workout sharing | P2 | Hevy, Strava | Low | Generate a workout summary card (exercises, volume, duration, PRs) as a shareable image. Share via system share sheet. |
| Apple Watch app | P1 | Hevy, Fitbod, Sweat, Strava, NTC | High | Log sets from wrist during workout. Show current exercise, set count, rest timer. Read heart rate in real-time. Requires watchOS companion app with WatchConnectivity. |
| Social feed | P2 | Hevy, Strava, Peloton | Medium | Activity feed showing friends' workouts, PRs, and milestones. Opt-in with granular privacy controls. |
| Trainer-led programs | P3 | Sweat, NTC, Peloton | High | Structured multi-week training programs with progressive difficulty. Content creation heavy. Could support community-created programs via the coach portal. |
| Segment leaderboards | P3 | Strava | High | Competitive segments on GPS routes. Requires significant infrastructure for segment matching and leaderboard computation. |
| Clubs/community | P3 | Sweat, Strava, Peloton | High | Groups with shared challenges, group workouts, community leaderboards. Large feature surface area. |

## Recommended Features to Build

1. **Rest timer** - Add a configurable rest timer that auto-starts after logging a set. Per-exercise default rest times (compound lifts: 3 min, isolation: 90 sec, etc.) with manual override. Vibration and optional sound alert when rest period ends. Show countdown prominently during active workout. This is the most basic missing feature and should ship immediately.

2. **Previous performance display** - During an active workout, show the previous session's weight/reps for each exercise inline below the input fields. "Last: 185 lbs x 8, 185 x 7, 185 x 6." Query from workout history in Supabase. This is essential for users to know what weight to load.

3. **Progressive overload automation** - After displaying previous performance, add auto-suggestions for the current session. Rules: if the user hit their target reps for all sets last session, suggest increasing weight by the minimum increment (5 lbs barbell, 2.5 lbs dumbbell). Configurable per exercise. Show as a subtle suggestion, not forced.

4. **Muscle recovery heatmap** - Extend the existing body map to show recovery state. Calculate per-muscle-group fatigue based on: exercises performed (muscle involvement), total volume (sets x reps x weight), and hours since last training. Display as a color gradient from green (fully recovered) to red (needs rest). Update daily.

5. **AI workout generation** - Build a rule-based workout generator that takes inputs: target muscles (from body map tap), available equipment (home gym, full gym, bodyweight), time available (15/30/45/60 min), and recovery state (from heatmap). Select exercises from the 100+ library, assign sets/reps based on goals (strength: 5x5, hypertrophy: 4x8-12, endurance: 3x15-20). Can evolve into ML-based generation later.

6. **Plate calculator** - Simple utility: input target weight, select bar type, display plate layout for each side. Include common bar weights and plate inventories (standard gym, home gym custom). Show as a bottom sheet accessible from the active workout screen.

7. **Video exercise demos** - Start with animated illustrations (Lottie animations or GIF sequences) for the top 50 most-used exercises. Expand to full library over time. Display as a tappable overlay on the exercise card during active workout. Bundle with the app to work offline.

8. **Progress photos** - Camera capture with date/time overlay. Store photos in the app's local documents directory (not camera roll, for privacy). Side-by-side comparison slider. Monthly/quarterly timeline view. Never uploaded to Supabase.

9. **Workout sharing** - Generate a post-workout summary card as an image: exercises performed, total volume, duration, personal records hit, muscle groups worked. Share via system share sheet. No account or social network required.

10. **Apple Watch app** - watchOS companion showing current exercise name, set counter, rest timer countdown, and heart rate. Quick-log buttons for completing sets with pre-filled weight/reps from previous performance. Requires significant development effort but is a top user request.

11. **GPS route recording** - Record outdoor activities (run, bike, hike) with GPS trace, pace per mile/km splits, elevation gain, and total distance. Save route as a polyline for map replay. This is a large feature that competes directly with Strava; consider whether it belongs in MyWorkouts or a separate MyTrails module.

## Privacy Competitive Advantage

The fitness tracking space has significant privacy concerns:

- **Strava** exposed the locations of military bases and secret government facilities through its global heatmap in 2018. It has repeatedly leaked the movements of world leaders' security teams through public activity data.
- **Peloton** faces a class-action lawsuit for using AI to process customer chat data without consent. Its always-on camera and microphone in home gyms raise surveillance concerns.
- **Nike Training Club** collects 20 data types including racial/ethnic background, and shares data with advertising partners.
- **Fitbod** and **Hevy** store complete workout histories on their servers with no local-only option.

MyWorkouts stores workout data in Supabase for cross-device sync, but with key differences: no advertising, no data sharing with third parties, no telemetry, and no behavioral profiling. Progress photos are stored locally and never uploaded. GPS routes (when built) will have privacy zones to exclude home/work areas from any shared data.

For users who want zero cloud exposure, a future offline-only mode could store everything in local SQLite instead of Supabase.

Marketing angle: "Your workout data should make you stronger, not make advertisers richer."

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyHealth** | Heart rate data during workouts (via HealthKit). Recovery metrics (HRV, resting heart rate) feed into the muscle recovery heatmap. Sleep data affects recovery calculations. |
| **MyFast** | Show fasting zone context on workout entries. "Chest day performed in the Fat Burning zone (hour 14 of 16:8 fast)." Help users time workouts relative to eating windows. |
| **MyHabits** | Workout frequency as a trackable habit. "Gym 4x/week" streak tracking. Rest day compliance tracking. |
| **MyMeds** | Exercise timing relative to medication schedules. Some medications affect exercise performance or have timing constraints around physical activity. |
| **MyNutrition** | Pre-workout and post-workout meal suggestions. Protein intake tracking relative to training volume. "You lifted heavy today. Aim for 40g protein in your next meal." |
| **MyMood** | Correlate workout completion with mood entries. "Your mood is consistently higher on days you exercise." |
