# MyMood - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05), CEO Review (2026-03-24)
**Status:** Complete (100% competitive parity)

## Current State
Full emotional wellness toolkit with 10 engines, 3 schema migrations, 6+ table groups, 245 tests. Free tier module, offline-first, privacy-first. No cloud dependency.

MyMood is the emotional intelligence hub of the MyLife suite. It provides mood tracking, activity correlation, breathing exercises, guided meditation, focus music, SOS crisis support, virtual pet gamification, self-care suggestions, AI-powered insights, and A/B lifestyle experiments -- all on-device with zero analytics.

## Competitors Analyzed

| App | Pricing | Focus | MyMood Advantage |
|-----|---------|-------|------------------|
| Daylio | $36/yr | Mood journaling with activity tracking | MyMood adds experiments, meditation, SOS, pet, focus music, AI insights |
| Finch | $15-70/yr | Gamified self-care with virtual pet | MyMood adds correlations, experiments, breathing, meditation, focus music |
| Bearable | $35/yr | Symptom and mood correlation tracker | MyMood adds meditation, pet, focus music, SOS, 8 AI insight detectors |
| Calm | $80/yr | Meditation and relaxation | MyMood adds mood tracking, experiments, correlations, pet, insights |
| Headspace | $70/yr | Guided meditation and mindfulness | MyMood adds mood tracking, experiments, correlations, pet, Year-in-Pixels |
| Reflectly | $60/yr | AI-powered journaling prompts | MyMood adds experiments, meditation, focus music, SOS, pet, correlations |

**All of the above charge $15-80/yr. MyMood is free.**

## Feature Completion

### P0 - Core Tracking (all complete)

| Feature | Status | Implementation |
|---------|--------|----------------|
| 1-10 mood scoring with labels | Done | `MoodScoreDescriptors`, `CreateMoodEntryInputSchema` |
| Plutchik emotion tagging (24 emotions) | Done | `PlutchikEmotionSchema`, `MoodEmotionTagSchema` |
| Activity tracking (15 default + custom) | Done | `DEFAULT_ACTIVITIES`, `createActivity`, `seedDefaultActivities` |
| Notes with mood entries | Done | `note` field on `MoodEntrySchema` (500 char max) |
| Streak tracking | Done | `engine/streak.ts`: `calculateStreaks` |
| Year-in-Pixels visualization | Done | `engine/streak.ts`: `scoreToPixelColor` (10 colors) |
| Daily/weekly/monthly averaging | Done | `db/crud.ts`: `getDailyAverages`, `getMoodDashboard` |
| Dashboard | Done | `db/crud.ts`: `getMoodDashboard` (today/week/month averages, streaks, totals) |
| Top emotions analysis | Done | `db/crud.ts`: `getTopEmotions` |
| Weekly reports | Done | `engine/streak.ts`: `generateWeeklyReport` |

### P1 - Correlation + Privacy (all complete)

| Feature | Status | Implementation |
|---------|--------|----------------|
| Mood-activity correlation (Pearson r) | Done | `db/crud.ts`: `getActivityCorrelations`, `engine/streak.ts`: `pearsonCorrelation` |
| Custom activities/factors | Done | `createActivity`, `updateActivity` with categories |
| Custom experiments (A/B lifestyle testing) | Done | `engine/experiment.ts`: state machine, analysis, conclusion generator. `db/experiments.ts`: full CRUD + templates |
| Photo/voice attachments | Done | `db/attachments.ts`: photo + voice with thumbnails, file size, duration, MIME |
| Guided breathing (5 patterns) | Done | `engine/breathing.ts`: box, 4-7-8, relaxing, energizing, sleep |
| PIN/biometric lock | Done | `engine/lock.ts`: PIN hash/verify, lockout state, biometric + combined. `db/lock.ts`: config CRUD |

### P2 - Wellness + Gamification (all complete)

| Feature | Status | Implementation |
|---------|--------|----------------|
| Virtual pet gamification | Done | `engine/pet.ts`: 6 species, 6 evolution stages, happiness decay, cross-module feeding. `db/pet.ts`: full CRUD |
| Self-care suggestions | Done | `engine/suggestions.ts`: 26 items across 5 categories, data-driven + cross-module (9 modules) + catalog sources |
| Guided meditation | Done | `engine/meditation.ts`: step-based timer, progress tracking. `db/meditation.ts`: templates by category/difficulty, sessions with pre/post mood |
| Focus music/ambient sounds | Done | `engine/soundscape.ts`: 13 sounds, 5 presets, layer mixing. `db/focus.ts`: sessions + custom presets |
| SOS/panic button | Done | `engine/sos.ts`: 4-step flow (breathing, 5-4-3-2-1 grounding, affirmation, exit check). `db/sos.ts`: sessions + emergency contacts |
| AI mood insights | Done | `engine/insight.ts`: 8 detectors (day-of-week, time-of-day, activity impact, emotion cluster, streak impact, trend direction, volatility alert, best/worst day) |

## Privacy Competitive Advantage

Bearable has been criticized for clinical data access. Calm and Headspace collect behavioral data including session timing, usage patterns, and engagement metrics. Daylio is one of the better options for privacy (local-first with PIN lock), but still offers optional cloud sync.

MyMood surpasses all competitors on privacy: zero cloud, zero analytics, zero telemetry, full on-device processing. The PIN/biometric lock adds a second layer of protection for sensitive mood data. The cross-module correlation engine discovers mood patterns (mood + exercise, mood + sleep, mood + medication) without any data leaving the device.

## Cross-Module Integration

| Module | Integration | Suggestion |
|--------|-------------|------------|
| **MyMeds** | Mood-medication correlation (MyMeds engine). MyMood provides the mood data source. | -- |
| **MyHealth** | Mood as a health metric. Share mood data for holistic health dashboard. | "Log Your Vitals" |
| **MyHabits** | Mood-habit correlation. Show how habit streaks affect mood over time. | "Check Off a Habit" |
| **MyJournal** | Mood-based prompts for journaling. Cross-module suggestion. | "Write in Your Journal" |
| **MyWorkouts** | Exercise-mood correlation. Track how different workout types affect mood. | "Log a Workout" |
| **MyFast** | Fasting-mood correlation. Track mood during and after fasting windows. | "Check Your Fasting Window" |
| **MyBooks** | Reading-mood correlation. Track how reading sessions affect mood. | "Read a Chapter" |
| **MyRecipes** | Cooking as self-care activity. Cross-module suggestion. | "Cook a Recipe" |
| **MyStars** | Stargazing for calm. Cross-module suggestion. | "Check Tonight's Sky" |
| **MyVoice** | Voice journaling for emotional processing. Cross-module suggestion. | "Record a Voice Memo" |

## Engine Inventory

| Engine | File | Functions | Tests |
|--------|------|-----------|-------|
| Streak + Analytics | `engine/streak.ts` | `calculateStreaks`, `scoreToPixelColor`, `pearsonCorrelation`, `isSignificantCorrelation`, `generateWeeklyReport` | 13 |
| Breathing | `engine/breathing.ts` | `getBreathingCycleSteps`, `getCycleDuration`, `getCyclesForDuration` | 7 |
| Experiment | `engine/experiment.ts` | `computeDateRanges`, `transitionExperiment`, `analyzeExperiment`, `isSignificantExperiment`, `generateConclusion`, `correlationStrength` | in features.test.ts |
| Lock | `engine/lock.ts` | `hashPin`, `verifyPin`, `generateSalt`, `checkLockout`, `computeLockedUntil`, `isTimeoutElapsed` | in features.test.ts |
| Insight | `engine/insight.ts` | 8 detectors + `generateInsights` orchestrator, `standardDeviation` | in features.test.ts |
| SOS | `engine/sos.ts` | `getSosFlow`, `getRandomAffirmation`, `computeSosDuration`, `getSosStepCount` | 15 |
| Suggestions | `engine/suggestions.ts` | `generateSuggestions`, `getSuggestionsByCategory`, SUGGESTION_CATALOG (26 items) | 15 |
| Meditation | `engine/meditation.ts` | `createTimerState`, `tickTimer`, `getStepProgress`, `getTotalProgress`, `getCurrentStep`, `getRemainingTime`, `getCompletedStepCount` | 29 |
| Pet | `engine/pet.ts` | `feedPet`, `computeHappinessDecay`, `applyDecay`, `getEvolutionStage` | 27 |
| Soundscape | `engine/soundscape.ts` | `getSoundById`, `getSoundsByCategory`, `validateLayers`, `mixLayers`, SOUND_LIBRARY (13), DEFAULT_PRESETS (5) | 24 |
