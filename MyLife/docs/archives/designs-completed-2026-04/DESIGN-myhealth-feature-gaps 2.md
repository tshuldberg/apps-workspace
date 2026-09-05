# MyHealth - Feature Gap Design Doc

**Source:** Competitive Feature Analysis (2026-03-05), updated 2026-03-24 (CEO review GP-17-10a)
**Status:** All 18 competitor features implemented. 21 tables across V1/V2/V3. 99% competitive parity.

## Current State

MyHealth is the consolidated health hub module with 7+ database tables. It absorbs and unifies data from fasting, medications, menstrual cycle, vitals, sleep, document vault, emergency info, health goals, and wellness timeline. Current features include a consolidated health dashboard, sleep session logging, sleep quality scoring, vitals tracking, medication correlation, mood-medication correlation, doctor reports, emergency medical info, trend visualization, and drug interactions. All data is stored locally in SQLite.

## Competitors Analyzed

| Competitor | Pricing | Category |
|------------|---------|----------|
| Apple Health | Free | Health data aggregation (iOS only) |
| Samsung Health | Free | Health data aggregation (Android-focused) |
| Google Fit | Free | Activity and health tracking |
| Sleep Cycle | $30/yr | Sleep tracking, smart alarm |
| Pillow | $28/yr | Sleep tracking, heart rate |
| AutoSleep | $8 once | Automatic sleep tracking |
| Calm | $80/yr | Meditation, sleep, mental wellness |
| Headspace | $70/yr | Meditation, mindfulness, CBT |
| Finch | Freemium | Self-care companion, breathing |
| Garmin Connect | Free (with device) | Fitness, HRV, readiness |
| Whoop | $30/mo ($360/yr) | Recovery, strain, HRV |
| Stoic | $30/yr | Mental wellness, CBT journaling |

## Feature Gaps

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Apple Health/HealthKit integration | P0 | ALL health/fitness apps | Medium | Import heart rate, steps, sleep, HRV, blood oxygen, activity from Apple Watch and HealthKit-connected apps. THE most impactful cross-module feature. |
| Breathing exercises | P0 | Calm, Headspace, Finch | Low | Box breathing, 4-7-8, coherent breathing with visual guides |
| Wellness timeline | P0 | Unique to MyLife | Low | Already partially built. Unified chronological view of all health events across modules. |
| Sleep stage analysis | P1 | Sleep Cycle, Pillow, AutoSleep | Medium (needs Watch data) | Show light/deep/REM sleep stages from Apple Watch data |
| Heart rate during sleep | P1 | Sleep Cycle, Pillow, AutoSleep | Low (with HealthKit) | Display overnight heart rate from Apple Watch |
| Blood oxygen (SpO2) tracking | P1 | AutoSleep | Low (with HealthKit) | Log and trend blood oxygen levels |
| Readiness score | P1 | AutoSleep, Garmin, Whoop | Medium | Daily readiness based on sleep quality, HRV, recovery |
| Guided meditation | P1 | Calm ($80/yr), Headspace ($70/yr), Finch | Medium (content creation) | Breathing exercises, body scan, mindfulness sessions |
| Activity tracking (steps, active minutes) | P1 | Apple Health, Samsung Health, Google Fit | Low (with HealthKit) | Daily step count, active minutes, movement reminders |
| HRV tracking | P1 | Garmin, Whoop | Low (with HealthKit) | Heart rate variability trending and insights |
| Smart alarm (light sleep wake) | P2 | Sleep Cycle, Pillow, AutoSleep | Medium | Wake user during light sleep phase within a window |
| Snore detection/recording | P2 | Sleep Cycle, Pillow | Medium | Use microphone to detect and record snoring episodes |
| Sleep Bank (credit/debt) | P2 | AutoSleep | Low | Track cumulative sleep surplus/deficit |
| Sleep aid sounds/white noise | P2 | Calm, Sleep Cycle, Pillow | Low (audio files) | Rain, ocean, brown noise for sleep |
| CBT exercises | P2 | Headspace (Ebb), Stoic | Medium | Cognitive restructuring worksheets, thought records |
| SOS/panic sessions | P2 | Headspace | Low | Quick calming exercises for anxiety/panic moments |
| Multi-app data aggregation | P2 | Apple Health, Samsung Health | Medium | Pull data from multiple health apps into unified timeline |
| Body composition | P2 | Samsung Health, Garmin | Low | Weight, body fat %, muscle mass tracking |
| Sleep apnea risk indicators | P3 | AutoSleep | Medium | Flag patterns suggesting sleep apnea |
| Progressive courses | P3 | Calm, Headspace | High (content heavy) | Multi-day meditation/wellness programs |
| Clinical health records import | P3 | Apple Health | High | Import medical records from healthcare providers |

## Recommended Features to Build

1. **Apple Health/HealthKit integration** - This is the single most impactful feature across all MyLife modules. Reading HealthKit data unlocks automatic population of heart rate, steps, sleep stages, HRV, blood oxygen, activity, and more. Every health and fitness competitor integrates with HealthKit. Without it, users must manually enter data that their Apple Watch already collects. Implementation involves the `expo-health-connect` or `react-native-health` library with permission prompts for each data type. This is a cross-module enabler: MyHealth reads and displays, MyWorkouts reads activity, MyHabits auto-completes, MyMeds correlates.

2. **Breathing exercises** - Box breathing (4-4-4-4), 4-7-8 technique, and coherent breathing (5.5 breaths/minute) with animated visual guides. This is a low-effort, high-value feature that directly competes with Calm ($80/yr) and Headspace ($70/yr). The visual guide is a simple expanding/contracting circle or bar with timed phases. No content licensing required since breathing patterns are not copyrightable.

3. **Wellness timeline (completion)** - The partially built wellness timeline should be finished as a unified chronological feed of all health events: medications taken, vitals logged, workouts completed, sleep sessions, fasting windows, mood entries, and symptoms. This is unique to MyLife since no single competitor aggregates across all these categories. The timeline becomes the "home feed" of the health module.

4. **Sleep stage analysis and overnight vitals** - With HealthKit integration, display light/deep/REM sleep stages, overnight heart rate curve, and blood oxygen readings. This replaces Sleep Cycle ($30/yr), Pillow ($28/yr), and AutoSleep ($8). Present the data in a clear sleep report card format with trends over time.

5. **Readiness score** - Calculate a daily readiness/recovery score based on sleep quality, sleep duration, HRV, resting heart rate, and recent activity load. Garmin and Whoop ($360/yr) popularized this concept. The algorithm can be straightforward: weighted composite of normalized metrics with historical baseline comparison.

6. **HRV tracking and insights** - Heart rate variability is increasingly recognized as a key health indicator. Import HRV data from HealthKit, display daily/weekly trends, and provide context (higher HRV generally indicates better recovery and stress resilience). Low implementation cost if HealthKit integration is already built.

7. **Activity tracking (steps, active minutes)** - Display daily step count, active minutes, and movement history from HealthKit. Include configurable daily goals and streak tracking. This is table stakes for any health app and comes nearly free once HealthKit integration exists.

8. **Guided meditation and mindfulness** - Start with 5-10 built-in sessions: body scan, progressive muscle relaxation, mindfulness meditation, and sleep meditation. Use text-to-speech or record simple audio guides. This does not need to match Calm's 1000+ session library on day one. Even a small, high-quality collection replaces the core value proposition of Calm ($80/yr) and Headspace ($70/yr).

9. **SOS/panic sessions** - Quick-access calming exercises for acute anxiety or panic. Includes guided breathing with haptic feedback, grounding exercises (5-4-3-2-1 senses), and a "calm down" sequence. Low implementation cost and high value for users who experience anxiety.

10. **Body composition tracking** - Manual entry for weight, body fat percentage, muscle mass, and body measurements. Include trend charts and goal setting. Simple data entry with powerful visualization.

## Privacy Competitive Advantage

The health data aggregation space reveals a stark divide between privacy-respecting and privacy-exploiting platforms:

- **Samsung Health** forced users in 2025 to accept expanded data sharing terms or permanently delete all their health data. Users who had years of health history were given an ultimatum. A GDPR complaint was filed.
- **Whoop** faces a class-action lawsuit for sharing biometric data (heart rate, HRV, sleep patterns) with Segment, a customer data platform owned by Twilio. Users paying $30/month for a "premium" health tracker had their biometric data sent to an analytics company.
- **Calm and Headspace** track meditation session data, user engagement patterns, and behavioral metrics for product analytics and marketing purposes.
- **Google Fit** feeds into Google's advertising profile. Health and activity data influences ad targeting.

MyHealth takes the Apple Health approach to privacy but goes further:

- **All data stays on-device.** No cloud account required. No sync to any server.
- **HealthKit data is read-only.** MyHealth imports data from HealthKit but never writes back or shares with other apps.
- **No analytics or telemetry.** Zero tracking of user behavior, session length, or feature usage.
- **No data monetization.** The business model is a suite subscription, not data harvesting.
- **Cross-platform privacy.** Unlike Apple Health (iOS only), MyHealth provides the same privacy guarantees on Android and web.
- **Export control.** Users can export their data in standard formats. They own it completely.

For users who track sensitive health metrics (mental health, sleep disorders, chronic conditions), MyHealth offers the peace of mind that their most personal data is truly private.

## Cross-Module Integration

| Integration | Module | Description |
|-------------|--------|-------------|
| Medication impact on sleep/vitals | MyMeds | Correlate medication timing and adherence with sleep quality and vital sign trends |
| Recovery scoring from workouts | MyWorkouts | Factor workout intensity and recovery time into readiness score calculations |
| Fasting impact on vitals | MyFast | Overlay fasting windows on vital sign charts to visualize metabolic effects |
| Sleep as habit metric | MyHabits | Surface sleep duration and quality as auto-tracked habits |
| Meditation as habit | MyHabits | Log completed breathing exercises and meditation sessions as habit completions |
| Sleep-mood correlation | MyMood | Chart sleep quality trends against mood entries to identify patterns |
| Drowsiness warnings | MyCar | Flag driving risk based on accumulated sleep debt (Sleep Bank feature) |
| Nutrition-health correlation | MyNutrition | Cross-reference dietary intake with energy levels, sleep quality, and vitals |
| Cycle-health overlay | MyHabits (cycle) | Display menstrual cycle phase on health dashboard for context on symptom patterns |
| HealthKit as shared infrastructure | All health modules | HealthKit integration built in MyHealth becomes available to MyWorkouts, MyHabits, MyMeds, and MyFast |
