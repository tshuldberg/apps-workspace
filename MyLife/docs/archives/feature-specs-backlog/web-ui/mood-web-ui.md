# MyMood Full Functional Web UI

**Task:** W14-4
**Module:** mood (`@mylife/mood`)
**Accent:** `#FB923C` (orange)
**Tier:** free
**Status:** SPEC COMPLETE
**Pipeline:** /office-hours -> /plan-eng-review -> /plan-design-review -> /design-consultation

## Executive Summary

Build a full functional web UI for MyMood, replacing 5 static stub files with 11 data-bound page routes (plus layout and actions files). The web experience is an **Analytics Command Center** -- mobile captures mood data, web reveals patterns through Year-in-Pixels heatmaps, trend charts, activity correlations, and experiment analysis. All 11 feature subsystems get dedicated web routes for full parity. Suggestions surface inline on the dashboard rather than as a separate route.

## Design Philosophy

**Mobile is for capture. Web is for reflection.**

On mobile, you log a mood in 5 seconds on the bus. On web, you sit down with a coffee and ask "what patterns do my emotions reveal?" The entire web UX is built around this asymmetry.

The Year-in-Pixels heatmap calendar is the centerpiece: 365 days of emotional data rendered as a color-coded grid. You see seasonal patterns, weekly rhythms, and emotional trends that are invisible on a phone screen. This is THE desktop-native visualization that makes users say "I need this on desktop."

## Route Structure

```
apps/web/app/mood/
  layout.tsx            # Module header with sub-nav links
  page.tsx              # Dashboard: heatmap hero + metrics + trends + correlations
  actions.ts            # Server actions wrapping all @mylife/mood CRUD
  log/page.tsx          # Full capture: score slider, Plutchik emotions, activities, note
  history/page.tsx      # Entry table with filters, sort, pagination, delete
  insights/page.tsx     # 8 pattern detectors with insight cards + severity badges
  experiments/page.tsx  # Active experiment + template browser + past results
  breathing/page.tsx    # 3 breathing patterns with animated visualization
  meditation/page.tsx   # Template browser (15 templates, 5 categories) + session timer
  focus/page.tsx        # Soundscape mixer: layer controls, preset browser, session timer
  pet/page.tsx          # Virtual pet: feed, evolve, happiness meter, activity history
  sos/page.tsx          # Crisis support: grounding flow, breathing, affirmations, contacts
  settings/page.tsx     # Privacy lock config + module preferences
```

**Delete existing stubs:** `experiments/page.tsx`, `insights/page.tsx`, `lock/page.tsx`, `settings/lock/` directory. These are replaced by the new routes above. `layout.tsx` and `actions.ts` do not exist yet and must be created from scratch (books module pattern).

**File count:** 13 files total (11 renderable page routes + 1 layout + 1 actions). When the spec says "routes," it means the 11 page routes that render UI.

## Page-by-Page Wireframes

### 1. layout.tsx -- Module Shell

```
+------------------------------------------------------------------+
|  MyMood                [+ Log Mood]                               |
|  Track your emotional wellness                                    |
+------------------------------------------------------------------+
|  Dashboard  History  Insights  Experiments  Breathing  Meditation |
|  Focus  Pet  SOS  Settings                                        |
+------------------------------------------------------------------+
|  {children}                                                       |
+------------------------------------------------------------------+
```

**Pattern:** Follow books layout.tsx exactly. Glass morphism header with backdrop-filter. Nav links as plain `<Link>` elements. Max-width 1120px centered. Module accent in title.

**Nav links array:**
```typescript
const navLinks = [
  { href: '/mood', label: 'Dashboard' },
  { href: '/mood/log', label: 'Log Mood' },
  { href: '/mood/history', label: 'History' },
  { href: '/mood/insights', label: 'Insights' },
  { href: '/mood/experiments', label: 'Experiments' },
  { href: '/mood/breathing', label: 'Breathing' },
  { href: '/mood/meditation', label: 'Meditation' },
  { href: '/mood/focus', label: 'Focus' },
  { href: '/mood/pet', label: 'Pet' },
  { href: '/mood/sos', label: 'SOS' },
  { href: '/mood/settings', label: 'Settings' },
];
```

### 2. page.tsx -- Dashboard (Analytics Command Center)

```
+------------------------------------------------------------------+
|  YEAR IN PIXELS (2026)                                            |
|  +--------------------------------------------------------------+ |
|  | Jan  ██░█▓██░▓█░██▓█░██░▓█░██▓█░██                          | |
|  | Feb  ▓█░██▓█░▓█░██░▓█░██▓█░██░▓█░█                          | |
|  | Mar  ██▓█░██░▓█░██▓█░██ <- hover tooltip                     | |
|  | ...                                                           | |
|  | Dec  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                         | |
|  +--------------------------------------------------------------+ |
|  Color: 1■ 2■ 3■ 4■ 5■ 6■ 7■ 8■ 9■ 10■                        |
|                                                                    |
|  +----------+ +----------+ +----------+ +----------+              |
|  | Today    | | Week Avg | | Streak   | | Total    |              |
|  | 7.5      | | 6.8      | | 14 days  | | 342      |              |
|  +----------+ +----------+ +----------+ +----------+              |
|                                                                    |
|  Trends (30d)                    Activity Correlations              |
|  +-------------------+          +------------------------+         |
|  |    /\    /\       |          | Exercise      +0.4  r  |         |
|  |   /  \  /  \      |          | Sleep         +0.3  r  |         |
|  |  /    \/    \     |          | Social        +0.1     |         |
|  | /            \    |          | Work          -0.2  r  |         |
|  +-------------------+          +------------------------+         |
|                                                                    |
|  Top Emotions (30d)              Active Experiment                 |
|  +-------------------+          +------------------------+         |
|  | Joy          24   |          | Morning Exercise       |         |
|  | Serenity     18   |          | Baseline Day 8/14      |         |
|  | Interest     12   |          | ████████░░  57%        |         |
|  | Anticipation  9   |          +------------------------+         |
|  +-------------------+                                             |
+------------------------------------------------------------------+
```

**Data sources:**
- `getMoodDashboard(db)` -- today/week/month averages, streaks, total entries
- `getDailyAverages(db, startOfYear, today)` -- heatmap data (365 cells)
- `getActivityCorrelations(db, 30)` -- correlation table
- `getTopEmotions(db, start30d, today, 8)` -- emotion distribution
- `getActiveExperiment(db)` -- experiment status card
- `scoreToPixelColor(score)` -- heatmap cell colors (10-color scale)

**Heatmap implementation:**
- CSS Grid: 7 columns (Mon-Sun) x 53 rows (weeks). Each cell is a 14x14px rounded square.
- Color values from `scoreToPixelColor()` for each day's average score.
- Empty days (no entries) use `rgba(255,255,255,0.04)`.
- Hover: tooltip showing date, score, top emotion, note preview. CSS `position: absolute` popover.
- Click: navigate to `/mood/history?date={date}` with that day's entries filtered.

**States:**
- Loading: skeleton grid (53x7 pulsing squares) + 4 metric skeletons
- Empty: "Your emotional journey starts here" + CTA to log first mood
- Error: glass card + "Something went wrong" + retry button
- Partial: heatmap shows available data, missing months use empty cells

### 3. log/page.tsx -- Full Capture Flow

```
+------------------------------------------------------------------+
|  LOG YOUR MOOD                                                     |
|                                                                    |
|  How are you feeling?                                              |
|  +--------------------------------------------------------------+ |
|  |  1  2  3  4  5  6  7  8  9  10                               | |
|  |        [====slider====]                                       | |
|  |              "Good" (7)                                       | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Emotions (Plutchik)                                               |
|  +--------------------------------------------------------------+ |
|  | [Ecstasy] [Joy] [Serenity]    -- Joy axis                    | |
|  | [Admiration] [Trust] [Acceptance] -- Trust axis               | |
|  | [Terror] [Fear] [Apprehension] -- Fear axis                   | |
|  | ... (8 axes x 3 intensity = 24 emotions, chip selectors)     | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Activities                                                        |
|  +--------------------------------------------------------------+ |
|  | [Exercise] [Work] [Social] [Reading] [Music] [Cooking] ...   | |
|  | (15 default + custom. Multi-select chip grid)                 | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Note (optional)                                                   |
|  +--------------------------------------------------------------+ |
|  | [textarea -- expandable, max 500 chars]                       | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  [Cancel]                               [Save Mood Entry]         |
+------------------------------------------------------------------+
```

**Data sources:**
- `getActivities(db)` -- load activity list (seed defaults if empty via `seedDefaultActivities`)
- `createMoodEntry(db, id, { score, note, emotions: [{emotion, intensity}], activityIds })` -- save

**Score slider:** Range input 1-10, styled with accent color track. Shows `MoodScoreDescriptors[score].label` below.

**Emotion picker:** Organized by Plutchik's 8 axes (joy, trust, fear, surprise, sadness, disgust, anger, anticipation). Each axis shows 3 intensity levels. Multi-select chips. Each selected emotion also gets an intensity selector (1-3).

**Activity picker:** Grid of chips. Multi-select. Shows icon + name. `DEFAULT_ACTIVITIES` has 15 items across 4 categories.

**Success:** After save, show brief confirmation toast + redirect to dashboard. Dashboard tick counter refreshes.

### 4. history/page.tsx -- Entry Table

```
+------------------------------------------------------------------+
|  MOOD HISTORY                        [Filter] [Export CSV]         |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | Date       | Score | Emotions          | Activities | Note    | |
|  |------------|-------|-------------------|------------|---------|  |
|  | 2026-03-23 |  8    | Joy, Serenity     | Exercise   | Good... |  |
|  | 2026-03-22 |  6    | Interest          | Work       | Busy... |  |
|  | 2026-03-21 |  7    | Joy, Trust        | Social     | Met...  |  |
|  | ...        |       |                   |            |         |  |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Filters:                                                          |
|  Date range: [start] - [end]                                       |
|  Score range: [min] - [max]                                        |
|  Showing 1-50 of 342  [< Prev] [Next >]                           |
+------------------------------------------------------------------+
```

**Data sources:**
- `getMoodEntries(db, filter)` -- paginated, with startDate/endDate/minScore/maxScore
- `getEmotionTagsForEntry(db, entryId)` -- loaded per visible entry
- `getActivitiesForEntry(db, entryId)` -- loaded per visible entry
- `deleteMoodEntry(db, id)` -- delete with confirmation dialog

**Sort:** Click column headers to sort by date, score. Default: date DESC.
**Filter:** Collapsible filter bar. Date range picker, score range (dual slider).
**Pagination:** 50 entries per page via `filter.limit` and `filter.offset`.
**Delete:** Trash icon per row, confirmation dialog ("This will permanently delete this entry and its emotions and activities").

### 5. insights/page.tsx -- Pattern Detectors

```
+------------------------------------------------------------------+
|  MOOD INSIGHTS                                 [Refresh]           |
|                                                                    |
|  YOUR PATTERNS                                                     |
|  +--------------------------------------------------------------+ |
|  | [Calendar] Day of Week                        [Notable]       | |
|  | Your mood is 1.2 pts higher on Fridays        Metric: +1.2   | |
|  |                                               [Dismiss]       | |
|  +--------------------------------------------------------------+ |
|  | [Clock] Time of Day                           [Actionable]    | |
|  | Morning entries average 7.1 vs evening 5.8    Metric: -1.3   | |
|  |                                               [Dismiss]       | |
|  +--------------------------------------------------------------+ |
|  | [Muscle] Activity Impact                      [Info]          | |
|  | Exercise days score 1.4 pts above average     Metric: +1.4   | |
|  +--------------------------------------------------------------+ |
|  ...                                                               |
+------------------------------------------------------------------+
```

**Data sources:**
- `getMoodEntryCount(db)` -- check if >= 14 entries (minimum for insights)
- `getMoodEntries(db, { startDate: 30dAgo, endDate: today })` -- raw data
- `getActivityCorrelations(db, 30)` -- for activity impact detector
- `getTopEmotions(db, start, end)` -- for emotion cluster detector
- `generateInsights(input)` -- run all 8 pattern detectors

**8 detectors:** `day_of_week_pattern`, `time_of_day_pattern`, `activity_impact`, `emotion_cluster`, `streak_impact`, `trend_direction`, `volatility_alert`, `best_worst_day`

**Severity badges:** info (gray), notable (yellow), actionable (green). Use `SEVERITY_COLORS` mapping from mobile.

**Insufficient data state:** Progress bar showing X/14 entries, "Keep logging! After 2 weeks, we'll start spotting patterns."

### 6. experiments/page.tsx -- A/B Lifestyle Testing

```
+------------------------------------------------------------------+
|  EXPERIMENTS                          [+ New Experiment]           |
|                                                                    |
|  ACTIVE EXPERIMENT                                                 |
|  +--------------------------------------------------------------+ |
|  | "Morning exercise improves my mood"                           | |
|  | Baseline (Day 8 of 14)                ████████░░ 57%          | |
|  | Avg so far: 6.8                                               | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  TEMPLATES (10)                                                    |
|  +--------+ +--------+ +--------+ +--------+ +--------+          |
|  |Exercise| |Meditate| |Sleep   | |Social  | |Digital |          |
|  |14 days | |14 days | |14 days | |14 days | |14 days |          |
|  +--------+ +--------+ +--------+ +--------+ +--------+          |
|                                                                    |
|  PAST EXPERIMENTS                                                  |
|  +--------------------------------------------------------------+ |
|  | Caffeine Cutoff   | Completed | +0.8 pts | Significant       | |
|  | Nature Walk       | Abandoned | --       | --                 | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Data sources:**
- `getActiveExperiment(db)` -- current experiment with progress
- `getExperiments(db)` -- all past experiments
- `getTemplates(db)` -- 10 built-in templates
- `getTemplatesByCategory(db, category)` -- filtered view
- `createExperiment(db, id, input)` -- start new from template or custom
- `updateExperimentStatus(db, id, status)` -- transition experiment state
- `analyzeExperiment(...)` -- compute statistical results
- `getScoresInDateRange(db, start, end)` -- scores for analysis

**New experiment form (inline or modal):** Hypothesis text, period days (7/14/21/28), start date. OR select a template (pre-fills hypothesis + description + suggested days).

**Results display (completed):** Baseline avg vs intervention avg, score diff, percent change, Pearson r, significance badge (p < 0.05), AI-generated conclusion.

### 7. breathing/page.tsx -- Breathing Exercises

```
+------------------------------------------------------------------+
|  BREATHING                                                         |
|                                                                    |
|  [Box Breathing] [4-7-8] [Relaxing]                                |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |                                                                | |
|  |              +----------+                                      | |
|  |              |          |   "Inhale"                           | |
|  |              |  (ring)  |   4 seconds                         | |
|  |              |          |                                      | |
|  |              +----------+                                      | |
|  |                                                                | |
|  |  Cycle 3 of 8          Duration: 2:30 / 4:00                  | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Duration:  [2 min] [4 min] [6 min] [10 min]                      |
|                                                                    |
|  [Start Breathing]                                                 |
+------------------------------------------------------------------+
```

**Data sources:**
- `BREATHING_PATTERNS` -- 3 patterns with step definitions
- `getBreathingCycleSteps(pattern)` -- step sequence (inhale/hold/exhale/hold)
- `getCycleDuration(pattern)` -- seconds per cycle
- `getCyclesForDuration(pattern, targetSeconds)` -- how many cycles to fill duration
- `createBreathingSession(db, id, input)` -- save completed session
- `getBreathingSessions(db)` -- past sessions (optional history section)

**Animation:** CSS animation on a circle element. Expand on inhale, hold, contract on exhale. Transition durations match pattern timing. `prefers-reduced-motion`: instant state changes, text-only step indicator.

### 8. meditation/page.tsx -- Guided Meditation

```
+------------------------------------------------------------------+
|  MEDITATION                                                        |
|                                                                    |
|  CATEGORIES                                                        |
|  [All] [Beginner] [Body Scan] [Visualization] [Mindfulness] [Sleep]|
|                                                                    |
|  +--------+ +--------+ +--------+ +--------+ +--------+          |
|  |First   | |Getting | |Ten Min | |Quick   | |Present |          |
|  |Breath  | |Started | |Calm    | |Body Chk| |Moment  |          |
|  |3 min   | |5 min   | |10 min  | |5 min   | |5 min   |          |
|  |Beginner| |Beginner| |Beginner| |BodyScan| |Mindful |          |
|  +--------+ +--------+ +--------+ +--------+ +--------+          |
|                                                                    |
|  SESSION (active)                                                  |
|  +--------------------------------------------------------------+ |
|  |  "Focus on the sensation of air entering your nostrils"       | |
|  |  Step 4 of 7          ████████░░░  60%                        | |
|  |  Remaining: 3:15                                               | |
|  |  [Pause]  [End Session]                                        | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Data sources:**
- `getMeditationTemplates(db)` -- all 15 templates
- `getMeditationTemplatesByCategory(db, category)` -- filtered
- `getMeditationTemplateById(db, id)` -- single template with steps
- `createMeditationSession(db, id, input)` -- start session
- `completeMeditationSession(db, id, input)` -- complete with pre/post mood
- Timer engine: `createTimerState()`, `tickTimer()`, `getCurrentStep()`, `getRemainingTime()`, `getTotalProgress()`
- `getMeditationSessions(db)` -- past sessions

**Timer:** `setInterval` at 1s. Show current step instruction, step progress, overall progress bar, remaining time. Pre-mood score prompt before start, post-mood after completion.

### 9. focus/page.tsx -- Soundscape Mixer

```
+------------------------------------------------------------------+
|  FOCUS MUSIC                                                       |
|                                                                    |
|  PRESETS                                                           |
|  [Rain] [Ocean] [Forest] [Cafe] [White Noise] [+ Custom]          |
|                                                                    |
|  MIXER                                                             |
|  +--------------------------------------------------------------+ |
|  | Rain           [====|=========] 70%                           | |
|  | Thunder        [==|===========] 20%                           | |
|  | + Add Layer                                                    | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Duration: [15 min] [30 min] [45 min] [60 min] [Custom]           |
|                                                                    |
|  SESSION                                                           |
|  +--------------------------------------------------------------+ |
|  | Playing: Rain    Elapsed: 12:30 / 30:00                       | |
|  | [Pause]  [End Session]                                         | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Data sources:**
- `SOUND_LIBRARY` -- all available sounds by category
- `DEFAULT_PRESETS` -- 5 built-in presets
- `getSoundPresets(db)` -- all presets including custom
- `createSoundPreset(db, id, input)` -- save custom preset
- `deleteSoundPreset(db, id)` -- delete custom preset
- `createFocusSession(db, id, input)` -- start session
- `completeFocusSession(db, id, input)` -- end session with pre/post mood
- `validateLayers(layers)` / `mixLayers(layers)` -- mixer engine

**Note:** No actual audio playback (would require audio files not in the module). This is a visual timer + mixer UI. Audio implementation is a future concern. Focus session tracking (duration, pre/post mood comparison) works without actual audio.

### 10. pet/page.tsx -- Virtual Pet

```
+------------------------------------------------------------------+
|  MY PET                                                            |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |                                                                | |
|  |              Buddy (Level 3)                                   | |
|  |              [pet emoji/visual]                                | |
|  |                                                                | |
|  |  Happiness: ████████░░ 78%                                     | |
|  |  Experience: 245 XP                                            | |
|  |  Stage: Companion (evolves at 500 XP)                          | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  FEED YOUR PET                                                     |
|  +--------+ +--------+ +--------+ +--------+                     |
|  |Mood Log| |Breathe | |Meditate| |Journal |                     |
|  |  +5 XP | |  +3 XP | |  +8 XP | |  +4 XP |                     |
|  +--------+ +--------+ +--------+ +--------+                     |
|                                                                    |
|  RECENT ACTIVITY                                                   |
|  +--------------------------------------------------------------+ |
|  | mood_log     +5 happiness  +5 XP    2 hours ago               | |
|  | breathing    +3 happiness  +3 XP    yesterday                  | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Data sources:**
- `getPet(db)` -- singleton pet (or null if not created)
- `createPet(db, 'singleton', input)` -- create pet on first visit
- `updatePetStats(db, 'singleton', updates)` -- update after feed
- `renamePet(db, 'singleton', name)` -- rename
- `feedPet(pet, activityType)` -- compute feed result
- `applyDecay(pet)` / `computeHappinessDecay(pet)` -- daily decay
- `getEvolutionStage(experience)` -- current stage name
- `getPetActivities(db)` / `getPetActivitiesToday(db)` -- activity log
- `EVOLUTION_THRESHOLDS` / `EVOLUTION_NAMES` / `FEED_REWARDS` -- constants

**First visit:** If `getPet(db)` returns null, show "Hatch Your Pet" CTA. Requires `HATCH_MOOD_ENTRIES_REQUIRED` mood entries to hatch. If not enough entries, show progress bar.

### 11. sos/page.tsx -- Crisis Support

```
+------------------------------------------------------------------+
|  SOS                                                               |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |  You're not alone. Let's work through this together.          | |
|  |                                                                | |
|  |  How are you feeling? (1-10 score)                            | |
|  |  [====slider====]                                              | |
|  |                                                                | |
|  |  [Start SOS Flow]                                              | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  EMERGENCY CONTACTS                                                |
|  +--------------------------------------------------------------+ |
|  | Mom           555-0123       Family         [Call] [Delete]   | |
|  | Therapist     555-0456       Professional   [Call] [Delete]   | |
|  | [+ Add Contact]                                                | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  PAST SOS SESSIONS                                                 |
|  +--------------------------------------------------------------+ |
|  | Mar 15  | Trigger: 2 | Exit: 5 | 4 steps | 8 min             | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Data sources:**
- `getSosFlow(triggerScore)` -- step sequence (breathing, grounding, affirmation)
- `getRandomAffirmation()` -- positive affirmation
- `createSosSession(db, id, input)` -- start session
- `completeSosSession(db, id, input)` -- end session with exit score
- `getSosSessions(db)` -- past sessions
- `getEmergencyContacts(db)` -- contact list
- `createEmergencyContact(db, id, input)` -- add contact
- `deleteEmergencyContact(db, id)` -- remove contact
- `GROUNDING_SENSES` -- 5 senses grounding exercise

**SOS flow (when started):** Multi-step guided flow -- breathing exercise, 5-4-3-2-1 grounding (5 things you see, 4 hear, 3 touch, 2 smell, 1 taste), affirmation. Each step auto-advances on timer. Exit mood score at end.

### 12. settings/page.tsx -- Privacy Lock + Preferences

```
+------------------------------------------------------------------+
|  SETTINGS                                                          |
|                                                                    |
|  PRIVACY LOCK                                                      |
|  +--------------------------------------------------------------+ |
|  | Enable Lock              [toggle]                             | |
|  |                                                                | |
|  | Method:  [PIN]  [Biometric]  [Both]                           | |
|  |                                                                | |
|  | Auto-lock:  (o) Immediately                                   | |
|  |             ( ) 1 minute                                       | |
|  |             ( ) 5 minutes                                      | |
|  |             ( ) 15 minutes                                     | |
|  |                                                                | |
|  | [Change PIN]  [Reset Lock]                                    | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  MODULE PREFERENCES                                                |
|  +--------------------------------------------------------------+ |
|  | Default activities visible     [toggle]                       | |
|  | Show streak badge              [toggle]                       | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Data sources:**
- `getLockConfig(db)` -- current lock state
- `setLockConfig(db, config)` -- update config
- `disableLock(db)` -- disable lock
- `getSetting(db, key)` / `setSetting(db, key, value)` -- module preferences
- `hashPin(pin, salt)` / `verifyPin(pin, hash, salt)` -- PIN operations
- `generateSalt()` -- for new PINs

**Web lock enforcement:** On web, privacy lock shows a PIN entry overlay (full-screen modal) before allowing access to any mood route. Lock state checked in `layout.tsx` or a client-side wrapper. Biometric not available on web -- PIN only.

## actions.ts -- Server Actions

```typescript
'use server';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import { /* all needed imports */ } from '@mylife/mood';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('mood');
  return adapter;
}
```

**Required server actions (51 total):**

| Category | Actions |
|----------|---------|
| Dashboard | `fetchDashboard`, `fetchDailyAverages`, `fetchActivityCorrelations`, `fetchTopEmotions` |
| Entries | `fetchEntries`, `fetchEntriesByDate`, `fetchEntryById`, `addEntry`, `removeEntry`, `fetchEntryCount` |
| Emotions | `fetchEmotionTagsForEntry` |
| Activities | `fetchActivities`, `addActivity`, `editActivity`, `removeActivity`, `fetchActivitiesForEntry`, `initDefaultActivities` |
| Breathing | `addBreathingSession`, `fetchBreathingSessions` |
| Settings | `fetchSetting`, `saveSetting` |
| Experiments | `fetchActiveExperiment`, `fetchExperiments`, `fetchTemplates`, `fetchTemplatesByCategory`, `addExperiment`, `changeExperimentStatus`, `saveExperimentResults`, `cancelExperiment`, `fetchScoresInRange` |
| Lock | `fetchLockConfig`, `saveLockConfig`, `addFailedAttempt`, `clearFailedAttempts`, `setLockedUntilTime`, `removeLock` |
| Insights | _(uses engine functions client-side after fetching raw data via fetchEntries)_ |
| SOS | `addSosSession`, `endSosSession`, `fetchSosSessions`, `addEmergencyContact`, `fetchEmergencyContacts`, `removeEmergencyContact` |
| Attachments | `addAttachment`, `fetchAttachmentsForEntry`, `removeAttachment` |
| Suggestions | `addSuggestionHistory`, `updateSuggestionAction`, `fetchSuggestionHistory`, `fetchRecentSuggestionKeys` |
| Meditation | `fetchMeditationTemplates`, `fetchMeditationTemplatesByCategory`, `addMeditationSession`, `endMeditationSession`, `fetchMeditationSessions` |
| Pet | `fetchPet`, `addPet`, `editPetStats`, `editPetName`, `addPetActivity`, `fetchPetActivities`, `fetchPetActivitiesToday` |
| Focus | `addFocusSession`, `endFocusSession`, `fetchFocusSessions`, `fetchSoundPresets`, `addSoundPreset`, `removeSoundPreset` |

**Pattern:** Each action is `async`, wraps the corresponding `@mylife/mood` CRUD function, passes `db()` as first arg, uses `crypto.randomUUID()` for new IDs. All wrapped in try/catch/finally per the web error handling rule.

## Data Flow

```
User interaction (client component)
  -> useEffect calls server action
  -> server action calls db() (singleton better-sqlite3 adapter)
  -> db() calls ensureModuleMigrations('mood')
  -> server action calls @mylife/mood CRUD function
  -> returns typed data to client
  -> client updates local state via useState
```

**No client-side DB access.** All data flows through server actions. Client components use `useEffect` + `useState` for data fetching (same pattern as books).

**Engine functions used client-side:** `scoreToPixelColor()`, `MoodScoreDescriptors`, `BREATHING_PATTERNS`, `getBreathingCycleSteps()`, `getCycleDuration()`, `getCyclesForDuration()`, `generateInsights()`, `createTimerState()`, `tickTimer()`, `getCurrentStep()`, `feedPet()`, `getEvolutionStage()`, `EVOLUTION_THRESHOLDS`, `EVOLUTION_NAMES`, `getSosFlow()`, `getRandomAffirmation()`, `GROUNDING_SENSES`, `SOUND_LIBRARY`, `DEFAULT_PRESETS`, `mixLayers()`, `validateLayers()`, `SUGGESTION_CATALOG`, `generateSuggestions()`.

These are pure functions with no DB dependency -- safe for client-side import.

## Component Inventory

### From packages/ui/
- `Card` -- glass card wrapper (used everywhere)
- `Text` -- typography variants (heading, body, caption, label)
- `Button` -- primary/secondary/ghost/destructive
- `colors` -- Cool Obsidian token values
- `spacing` -- spacing scale
- `borderRadius` -- radius scale

### New Components (module-local, in page files)
- `YearInPixelsHeatmap` -- 365-day grid with hover tooltips
- `MetricCard` -- stat display (label + value + accent color)
- `ScoreSlider` -- range input 1-10 with descriptor label
- `EmotionPicker` -- Plutchik 24-emotion chip grid with intensity
- `ActivityPicker` -- multi-select chip grid
- `InsightCard` -- pattern insight with severity badge + dismiss
- `ExperimentCard` -- experiment status with progress bar
- `BreathingCircle` -- animated CSS circle for breathing exercises
- `MeditationTimer` -- step-by-step timer with progress
- `SoundscapeMixer` -- layer volume sliders + preset selector
- `PetDisplay` -- pet visual with happiness/XP meters
- `SosFlowStepper` -- multi-step crisis support flow
- `LockOverlay` -- full-screen PIN entry gate
- `EntryTable` -- sortable data table for history
- `FilterBar` -- collapsible filter controls

## Design System Compliance (Cool Obsidian)

| Token | Usage in Mood |
|-------|--------------|
| `#0A0A0F` (background) | Page backgrounds, section margins |
| `#12121A` (surface) | Cards, table rows, form fields |
| `#1A1A24` (surfaceElevated) | Modals, popovers, hover tooltips |
| `#F0F0F5` (text) | Headings, primary text, score values |
| `rgba(240,240,245,0.65)` (textSecondary) | Labels, descriptions, metadata |
| `rgba(255,255,255,0.06)` (border) | Card borders, table borders |
| `rgba(255,255,255,0.04)` (glass) | Glass card backgrounds |
| `rgba(255,255,255,0.08)` (glassStrong) | Hover states, active tabs |
| `#FB923C` (accent) | CTA buttons, active nav, score highlights, slider track |
| `#FF453A` (danger) | Delete buttons, low score indicators |
| `#30D158` (success) | Positive correlations, completed experiments |

**Glass morphism on web:** `backdrop-filter: blur(40px) saturate(180%)` for cards, `blur(14px)` for header.

**Typography:** Inter font. heroTitle (36px/800) for dashboard greeting, heading (24px/700) for page titles, subheading (18px/600) for section headers, body (16px/400) for content, caption (13px/500) for metadata, label (12px/600/uppercase) for category badges.

**Anti-patterns avoided:**
- No light theme cards
- No "No items found" empty states (use warm CTAs)
- No spinners (skeleton screens only)
- No bouncy animations
- No placeholder buttons that do nothing

## 5-State Design Checklist

| Page | Loading | Empty | Error | Success | Partial |
|------|---------|-------|-------|---------|---------|
| Dashboard | Skeleton grid + metric cards | "Your emotional journey starts here" + Log CTA | Glass card + retry | Full heatmap + metrics | Heatmap with empty months |
| Log | N/A (form) | Pre-filled defaults | Inline validation errors | Toast + redirect | N/A |
| History | Skeleton table rows | "Start logging to build your history" | Glass card + retry | Full table | Entries without emotions shown |
| Insights | "Analyzing patterns..." | Progress bar X/14 entries | Glass card + retry | Insight cards | Some detectors insufficient data |
| Experiments | Skeleton cards | "Run your first experiment" + templates | Glass card + retry | Active experiment card | Only templates, no past |
| Breathing | N/A (interactive) | Pattern selector | N/A | Session complete toast | Mid-session state |
| Meditation | Skeleton template grid | "Choose a meditation to begin" | Glass card + retry | Session complete with mood delta | Mid-session timer |
| Focus | Skeleton preset list | "Create your first soundscape" | Glass card + retry | Session complete | Custom preset with no sessions |
| Pet | N/A | "Hatch your pet" + entry progress | Glass card + retry | Pet with stats + feed buttons | Egg state (pre-hatch) |
| SOS | N/A (interactive) | "You're not alone" + start CTA | N/A | Exit mood score | Mid-flow step |
| Settings | Skeleton toggles | Default settings | Glass card + retry | Saved confirmation | Lock enabled, no PIN set |

## Test Plan

### Unit Tests (per page)
- Dashboard: verify heatmap renders correct colors from `scoreToPixelColor()`
- Log: score validation (1-10), emotion selection, activity selection, form submission
- History: filter application, sort toggle, pagination, delete confirmation
- Insights: insufficient data state (<14 entries), insight card rendering, dismiss
- Experiments: template selection, experiment creation, status transitions, analysis display
- Settings: lock toggle, method selection, timeout selection

### Integration Tests
- Full capture flow: log mood -> verify appears in history -> verify dashboard updates
- Experiment lifecycle: create from template -> baseline -> intervention -> complete -> view results
- Lock enforcement: enable lock -> navigate away -> return -> PIN required

### Test File Location
```
apps/web/app/mood/__tests__/
  page.test.tsx          # Dashboard tests
  actions.test.ts        # Server action tests
  log.test.tsx           # Log page tests
  history.test.tsx       # History page tests
  insights.test.tsx      # Insights page tests
  experiments.test.tsx   # Experiments page tests
```

## QA Checklist

### Pre-QA Gate
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (no new failures)
- [ ] `pnpm gate:function:changed` passes

### Functional QA (per route)
- [ ] Dashboard loads with real data from SQLite
- [ ] Year-in-Pixels heatmap renders 365 cells with correct colors
- [ ] Heatmap hover shows tooltip with score + emotions
- [ ] Heatmap click navigates to filtered history
- [ ] Metric cards show today/week/streak/total from `getMoodDashboard()`
- [ ] Log page: score slider works 1-10 with descriptor labels
- [ ] Log page: emotion picker shows 24 Plutchik emotions
- [ ] Log page: activity picker shows 15 defaults
- [ ] Log page: save creates entry with emotions + activities
- [ ] History page: table shows entries with emotions and activities
- [ ] History page: date/score filters work
- [ ] History page: sort by date/score works
- [ ] History page: pagination works (50 per page)
- [ ] History page: delete removes entry + cascades
- [ ] Insights page: shows "keep logging" when < 14 entries
- [ ] Insights page: shows pattern cards when sufficient data
- [ ] Insights page: dismiss hides card
- [ ] Experiments page: shows templates (10 built-in)
- [ ] Experiments page: create experiment from template
- [ ] Experiments page: shows active experiment with progress
- [ ] Experiments page: shows past experiments with results
- [ ] Breathing page: all 3 patterns selectable
- [ ] Breathing page: animation plays with correct timing
- [ ] Breathing page: session saved on completion
- [ ] Meditation page: 15 templates across 5 categories
- [ ] Meditation page: category filter works
- [ ] Meditation page: timer advances through steps
- [ ] Meditation page: pre/post mood score capture
- [ ] Focus page: 5 default presets display
- [ ] Focus page: layer volume sliders work
- [ ] Focus page: custom preset save/delete
- [ ] Focus page: session timer works
- [ ] Pet page: shows "hatch" state when no pet
- [ ] Pet page: displays pet with happiness/XP when exists
- [ ] Pet page: feed buttons work (with daily limits)
- [ ] Pet page: evolution stage display correct
- [ ] SOS page: flow progresses through steps
- [ ] SOS page: emergency contacts CRUD
- [ ] SOS page: exit mood score captured
- [ ] Settings page: lock toggle enables/disables
- [ ] Settings page: lock method selector works
- [ ] Settings page: timeout selector works

### Visual QA
- [ ] All pages use Cool Obsidian tokens (no light theme elements)
- [ ] Glass morphism renders on header and cards
- [ ] Module accent `#FB923C` used consistently
- [ ] All empty states have warm CTAs (not "No items found")
- [ ] All loading states use skeletons (not spinners)
- [ ] Responsive: single column on mobile, full layout on desktop
- [ ] Typography hierarchy: heroTitle > heading > subheading > body > caption

### Edge Cases
- [ ] Dashboard with 0 entries
- [ ] Dashboard with 1000+ entries (performance)
- [ ] Log mood with no emotions selected
- [ ] Log mood with all 24 emotions selected
- [ ] History with date filter returning 0 results
- [ ] Experiment with 0 entries in baseline period
- [ ] Pet happiness at 0% after decay
- [ ] Lock with 5 failed PIN attempts (lockout)

## Implementation Order

1. `actions.ts` -- all 51 server actions (foundation)
2. `layout.tsx` -- module shell with nav
3. `page.tsx` -- dashboard with heatmap hero
4. `log/page.tsx` -- full capture flow
5. `history/page.tsx` -- entry table with filters
6. `insights/page.tsx` -- pattern detector cards
7. `experiments/page.tsx` -- A/B experiment management
8. `settings/page.tsx` -- lock + preferences
9. `breathing/page.tsx` -- breathing exercises
10. `meditation/page.tsx` -- guided meditation
11. `focus/page.tsx` -- soundscape mixer
12. `pet/page.tsx` -- virtual pet
13. `sos/page.tsx` -- crisis support

## Engineering Notes

- **No new module code needed.** All CRUD functions exist in `@mylife/mood`. 19 tables across V1-V3 schema (6 in V1, 3 in V2, 10 in V3), ~266 individual exports.
- **No schema migrations needed.** V3 is current. All tables for all 11 subsystems already exist.
- **Web adapter ready.** `MOOD_MODULE` is already imported in `apps/web/lib/db.ts` and registered in `MODULE_DEFINITIONS_WITH_MIGRATIONS`.
- **Missing: `updateMoodEntry`.** There is no update function for mood entries in the module. Web history supports create + delete only (matching mobile behavior). If edit is needed, add it to the module first.
- **Lock gating mechanism.** `layout.tsx` checks lock config via `fetchLockConfig()` server action. If lock is enabled, it renders a `<LockOverlay>` component (full-screen PIN entry) instead of `{children}`. Once the user enters the correct PIN (verified via `verifyPin()`), a client-side state flag allows rendering children. Biometric is not available on web -- PIN only.
- **Focus music: UI + timer only, no audio playback.** RESOLVED: The `SOUND_LIBRARY` provides sound metadata but no audio files. The focus page ships as a soundscape mixer UI that saves presets, tracks session durations, and captures pre/post mood scores. A "Playback requires mobile app" note is shown in the UI. Audio integration is a future concern.
- **Suggestions surface on dashboard.** `generateSuggestions(input)` requires assembling `SuggestionInput` from multiple queries (entries, activities, streaks). The dashboard shows 1-2 suggestion cards inline when sufficient data exists. No dedicated suggestions route.
- **Heatmap implementation details.** Current year displayed by default with year navigation arrows. Week starts on Monday (ISO 8601). Grid: 53 columns (weeks) x 7 rows (days), each cell 14x14px with 2px gap. Hover tooltip is a `position: absolute` div (not a popover) showing date, score, top emotions, note truncated to 80 chars. Minimum viewport width for full grid: 768px. Below that, show a compact monthly summary instead.
- **Meditation categories.** The 5 categories in the template seeds are: `beginner`, `body_scan`, `visualization`, `mindfulness`, `sleep`. Note that "beginner" is used as both a category name and a difficulty level -- the UI should display the category filter separate from difficulty badges.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Office Hours | `/office-hours` | Brainstorm & scope | 1 | DONE | Analytics Command Center chosen, full parity, Year-in-Pixels hero |
| Eng Review | `/plan-eng-review` | Architecture & data flow | 1 | DONE | All 51 server actions mapped, no new module code needed |
| Design Review | `/plan-design-review` | UI/UX & Cool Obsidian | 1 | DONE | 5-state checklist complete, all 13 pages wireframed |
| Design Consultation | `/design-consultation` | Design system alignment | 1 | DONE | Component inventory, token mapping, anti-pattern checklist |

**VERDICT:** SPEC COMPLETE -- ready for implementation.
