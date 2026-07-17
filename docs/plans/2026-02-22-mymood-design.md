# MyMood — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## 1. Overview

**MyMood** — Your feelings. Not their data.

A privacy-first mood tracker and emotional wellness journal for iOS, Android, Mac, and web. Log your mood, tag activities, spot patterns in your emotions, and generate therapy-ready exports — all stored locally on your device. No AI therapy chatbot, no cloud sync, no accounts. Part of the My* app family.

### Primary Differentiator

> "Emotional data is the highest sensitivity category. MyMood keeps it where it belongs — on your device."

Mental health apps occupy a uniquely dangerous position in the privacy landscape. BetterHelp paid $7.8M to the FTC for sharing therapy data with Facebook and Snapchat for ad targeting. Woebot's AI therapy conversations are analyzed on remote servers. Daylio syncs mood data to Google Drive by default. MyMood stores everything in local SQLite. Your most intimate emotional data never touches a server.

---

## 2. Problem Statement

Mental health and mood tracking apps exploit the most sensitive category of personal data:

1. **Data sensitivity mismatch** — Mood data is arguably more private than financial or health data. Yet apps like Daylio and BetterHelp treat it with less care than a shopping list. The FTC has settled multiple cases against mental health apps for sharing user data with ad platforms.
2. **Subscription exploitation** — Users in emotional distress are especially vulnerable to subscription pressure. Apps charge $25-90/week for features that require no server infrastructure.
3. **AI therapy liability** — Apps like Woebot and Wysa offer AI-powered therapeutic conversations without clinical oversight, creating both privacy and safety risks. MyMood deliberately avoids this — it's a data collection and visualization tool, not a therapist.
4. **No portability** — Users who track mood for therapy sessions can't easily export their data in a therapist-friendly format. Most apps lock data behind their own interfaces.
5. **Feature bloat** — Gamification, social sharing, and "community" features in mood trackers feel tone-deaf. Nobody wants to share their depression score on a leaderboard.

MyMood solves these by being a simple, private, local-only tool for recording and understanding your emotional patterns.

---

## 3. Target User Persona

### Primary: "The Therapy-Aware Tracker"

- **Age:** 22-40
- **Archetype:** Currently in therapy or considering it. Therapist has suggested keeping a mood diary. Has tried journaling apps but found them too unstructured, or mood apps but got creeped out by the data practices.
- **Pain:** Wants a quick daily check-in (30 seconds), not a 10-minute journal session. Wants to show their therapist patterns over time. Doesn't trust cloud apps with emotional data.
- **Motivation:** Track mood trends to identify triggers and patterns. Generate something useful to bring to therapy sessions.
- **Willingness to pay:** $5-10 one-time. Absolutely will not pay for a subscription for a mood tracker.

### Secondary: "The Self-Aware Optimizer"

- **Age:** 25-45
- **Archetype:** Interested in quantified self, habit tracking, biohacking. Tracks sleep, exercise, diet — wants to add mood as another data point to correlate.
- **Pain:** Existing mood trackers are either too clinical or too gamified. Wants clean data visualization and the ability to export raw data.
- **Motivation:** Understand which activities, sleep patterns, and habits correlate with better mood.

### Anti-Persona: "The Crisis User"

- **MyMood is NOT a crisis tool.** It does not offer AI therapy, crisis hotlines, or real-time intervention. The app will include a static "If you're in crisis" screen linking to 988 Suicide & Crisis Lifeline and Crisis Text Line, but it will not attempt to detect or respond to crisis situations algorithmically.

---

## 4. Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|--------------|
| **Daylio** | Free + $25-50/yr | 15M+ downloads | ~$30M ARR | Syncs to Google Drive by default, analytics SDKs, no E2E encryption | Gamification feels manipulative for mental health. Subscription for basic features. |
| **BetterHelp** | $65-90/week | 4M+ users | ~$800M ARR | **$7.8M FTC settlement** for sharing therapy data with Facebook/Snapchat for ads | Not a mood tracker (therapy platform), but sets privacy expectations for the category. |
| **Woebot** | Free | 2M+ downloads | Funded (Series B) | AI conversations processed on remote servers. Data used for research. | AI therapy without clinical oversight. Privacy policy allows broad data use. |
| **Wysa** | Free + $100/yr | 5M+ downloads | ~$20M ARR | Cloud-processed AI conversations. Claims anonymization. | Same AI therapy concerns as Woebot. Subscription-gated features. |
| **Pixels** | Free + $7/yr | 1M+ downloads | ~$2M ARR | Minimal tracking, local-first option | Very basic — just a color grid. No correlations, no export for therapy. |
| **MyMood** | **$4.99 one-time** | — | — | **Zero cloud. Zero accounts. Zero AI therapy.** | New entrant. No AI-powered insights (intentional). |

### Opportunity

The mental health app market is projected at $17B by 2030. Post-BetterHelp FTC settlement, privacy-conscious users are actively seeking alternatives. The "quantified self" movement wants mood data alongside fitness data. No current app offers a simple, private, one-time-purchase mood tracker with therapy-grade export.

---

## 5. Key Features (MVP)

### P0 — Must Have (Launch)

- [ ] **Mood Check-In** — 5-point scale (1=Very Low, 2=Low, 3=Neutral, 4=Good, 5=Great) with warm, non-clinical icons (not emojis — custom illustrations)
- [ ] **Activity Tags** — Pre-defined + custom tags: exercise, sleep, social, work, family, outdoors, creative, reading, meditation, cooking, alcohol, caffeine, medication, therapy, travel
- [ ] **Brief Note** — Optional free-text note per entry (1-3 sentences, not a full journal)
- [ ] **Mood Trends** — Daily, weekly, monthly, yearly charts showing mood over time
- [ ] **Correlation Insights** — "You tend to rate higher on days with Exercise and Outdoors" — simple statistical correlation, not AI
- [ ] **Therapy Export** — Generate a PDF summary of mood trends, activity correlations, and notable entries for a date range. Formatted for a therapist to review in a session.
- [ ] **Multiple Check-Ins Per Day** — Morning, afternoon, evening (optional — user can check in once or multiple times)
- [ ] **Dark mode** — Default, matching My* brand

### P1 — Should Have (v1.1)

- [ ] Sleep quality tracking (1-5 scale, duration)
- [ ] Custom mood scales (allow 3-point, 5-point, or 10-point)
- [ ] Widget — iOS/Android home screen widget for quick check-in
- [ ] Reminder notifications ("How are you feeling?" at user-set times)
- [ ] Year-in-pixels view (color grid calendar)
- [ ] Streaks (optional — can be disabled, not gamified)

### P2 — Nice to Have (v2.0)

- [ ] Export raw data as JSON/CSV
- [ ] iCloud Drive backup (encrypted SQLite file, user-initiated only)
- [ ] Apple Health integration (read sleep/exercise data to auto-suggest activity tags)
- [ ] Seasonal pattern detection ("Your mood tends to dip in November-February")
- [ ] Medication tracking with mood correlation
- [ ] Menstrual cycle correlation (opt-in, locally stored)

---

## 6. Technical Architecture

### Stack

- **Frontend (Mobile):** Expo (React Native) — iOS + Android from single codebase
- **Frontend (Web):** Next.js 15
- **Database:** SQLite via expo-sqlite (mobile) / better-sqlite3 (web/Mac)
- **Charts:** Victory Native (mobile) / Victory (web) or react-native-chart-kit
- **PDF Generation:** react-native-pdf-lib (mobile) / @react-pdf/renderer (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **Notifications:** expo-notifications (local only)
- **Payments:** RevenueCat (App Store IAP) + Lemon Squeezy (direct sales)
- **License:** FSL → Apache 2.0 after 2 years

### Monorepo Structure

```
MyMood/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   ├── components/        # Mobile-specific components
│   │   ├── hooks/             # Mobile-specific hooks
│   │   └── assets/            # Icons, images, fonts, mood illustrations
│   ├── web/                   # Next.js 15 — Web + Mac
│   │   ├── app/               # App Router
│   │   ├── components/        # Web-specific components
│   │   └── public/            # Static assets
│   └── mac/                   # Mac App Store target (if separate from web)
├── packages/
│   ├── shared/                # Types, utils, business logic
│   │   ├── src/
│   │   │   ├── types/         # MoodEntry, ActivityTag, Trend, Correlation types
│   │   │   ├── models/        # Correlation engine, trend calculator, streak tracker
│   │   │   ├── utils/         # Date helpers, statistics utils
│   │   │   ├── constants/     # Default activity tags, mood labels, color scales
│   │   │   └── db/            # SQLite schema, migrations, queries
│   │   └── package.json
│   ├── ui/                    # Shared component library
│   │   ├── src/
│   │   │   ├── check-in/      # MoodPicker, ActivityTagGrid, NoteInput
│   │   │   ├── charts/        # MoodLineChart, CorrelationBar, YearPixels, WeekHeatmap
│   │   │   ├── cards/         # EntryCard, InsightCard, TrendSummaryCard
│   │   │   ├── export/        # TherapyPDFLayout, ExportPreview
│   │   │   └── layout/        # TabBar, Header, Modal, EmptyState
│   │   └── package.json
│   └── analytics/             # Local statistical analysis (NOT cloud analytics)
│       ├── src/
│       │   ├── correlation.ts # Pearson/Spearman correlation between mood and activities
│       │   ├── trends.ts      # Moving averages, trend detection
│       │   ├── seasonal.ts    # Month-over-month and seasonal patterns
│       │   └── summary.ts     # Natural language summary generation (template-based, not AI)
│       └── package.json
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── CLAUDE.md
├── README.md
└── timeline.md
```

### Data Model (SQLite Schema)

```sql
-- Mood check-in entries
CREATE TABLE mood_entries (
    id TEXT PRIMARY KEY,                           -- UUID
    mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
    mood_label TEXT NOT NULL,                       -- 'very_low', 'low', 'neutral', 'good', 'great'
    note TEXT,                                      -- Optional brief note
    time_of_day TEXT DEFAULT 'unspecified',         -- 'morning', 'afternoon', 'evening', 'night', 'unspecified'
    entry_date TEXT NOT NULL,                       -- ISO date (YYYY-MM-DD)
    entry_time TEXT NOT NULL,                       -- ISO time (HH:MM)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_mood_entries_date ON mood_entries(entry_date DESC);
CREATE INDEX idx_mood_entries_score ON mood_entries(mood_score);

-- Activity tags per mood entry (many-to-many)
CREATE TABLE entry_activities (
    id TEXT PRIMARY KEY,                            -- UUID
    entry_id TEXT NOT NULL REFERENCES mood_entries(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL REFERENCES activities(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_entry_activities_entry ON entry_activities(entry_id);
CREATE INDEX idx_entry_activities_activity ON entry_activities(activity_id);

-- Activity definitions (pre-defined + custom)
CREATE TABLE activities (
    id TEXT PRIMARY KEY,                            -- UUID
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,                              -- Icon identifier
    category TEXT NOT NULL,                          -- 'physical', 'social', 'mental', 'lifestyle', 'substance', 'health', 'custom'
    is_default INTEGER DEFAULT 0,                   -- Pre-defined activity
    is_archived INTEGER DEFAULT 0,                  -- Hidden but preserved in history
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Pre-populated default activities
INSERT INTO activities (id, name, icon, category, is_default, sort_order) VALUES
    ('act-exercise',    'Exercise',    'activity',    'physical',   1, 1),
    ('act-sleep-good',  'Good Sleep',  'moon',        'physical',   1, 2),
    ('act-sleep-bad',   'Poor Sleep',  'moon-off',    'physical',   1, 3),
    ('act-outdoors',    'Outdoors',    'sun',         'physical',   1, 4),
    ('act-social',      'Social',      'users',       'social',     1, 5),
    ('act-family',      'Family',      'heart',       'social',     1, 6),
    ('act-alone-time',  'Alone Time',  'user',        'social',     1, 7),
    ('act-work',        'Work',        'briefcase',   'mental',     1, 8),
    ('act-creative',    'Creative',    'palette',     'mental',     1, 9),
    ('act-reading',     'Reading',     'book',        'mental',     1, 10),
    ('act-meditation',  'Meditation',  'leaf',        'mental',     1, 11),
    ('act-cooking',     'Cooking',     'chef-hat',    'lifestyle',  1, 12),
    ('act-travel',      'Travel',      'plane',       'lifestyle',  1, 13),
    ('act-alcohol',     'Alcohol',     'glass',       'substance',  1, 14),
    ('act-caffeine',    'Caffeine',    'coffee',      'substance',  1, 15),
    ('act-medication',  'Medication',  'pill',        'health',     1, 16),
    ('act-therapy',     'Therapy',     'message-circle', 'health',  1, 17);

-- Cached correlation results (recomputed periodically)
CREATE TABLE correlations (
    id TEXT PRIMARY KEY,                            -- UUID
    activity_id TEXT NOT NULL REFERENCES activities(id),
    period TEXT NOT NULL,                            -- '7d', '30d', '90d', 'all'
    correlation_coefficient REAL NOT NULL,           -- -1.0 to 1.0
    sample_size INTEGER NOT NULL,
    avg_mood_with REAL NOT NULL,                    -- Average mood when activity is tagged
    avg_mood_without REAL NOT NULL,                 -- Average mood when activity is not tagged
    computed_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_correlations_unique ON correlations(activity_id, period);

-- Reminder settings
CREATE TABLE reminders (
    id TEXT PRIMARY KEY,                            -- UUID
    label TEXT NOT NULL,                             -- 'Morning check-in', 'Evening check-in'
    time TEXT NOT NULL,                              -- HH:MM
    days TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',    -- Comma-separated day numbers (1=Mon)
    notification_id TEXT,                            -- OS notification identifier
    is_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- User preferences (key-value store)
CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### Privacy Architecture

- **Zero network calls** — The app makes no HTTP requests. All data is in local SQLite. Statistical analysis runs on-device.
- **No accounts** — No sign-up, no login, no user IDs. The app works immediately on first launch.
- **No telemetry** — No analytics SDKs, no crash reporting services, no event tracking.
- **No AI processing** — Correlation insights use basic statistical methods (Pearson correlation, moving averages), not AI/ML. No data is sent to any model.
- **No AI therapy** — MyMood does not offer conversational therapy, crisis detection, or AI-generated mental health advice. It is a data recording and visualization tool.
- **Export is user-controlled** — Therapy PDF export generates a local file. JSON/CSV export creates a local file. iCloud backup (future) copies the encrypted SQLite file via standard file sync.
- **Permissions are minimal** — Notifications (for check-in reminders). No camera, no location, no contacts, no microphone, no health data (unless user opts into Apple Health read access in v2).

### Correlation Engine

The correlation engine runs locally using simple statistical methods:

```typescript
// packages/analytics/src/correlation.ts

interface CorrelationResult {
  activityId: string
  activityName: string
  coefficient: number        // Pearson correlation coefficient (-1 to 1)
  avgMoodWith: number        // Average mood on days with this activity
  avgMoodWithout: number     // Average mood on days without this activity
  sampleSize: number
  significance: 'strong' | 'moderate' | 'weak' | 'none'
}

function computeCorrelation(
  entries: MoodEntry[],
  activityId: string,
  period: '7d' | '30d' | '90d' | 'all'
): CorrelationResult {
  // Filter entries to period
  const filtered = filterByPeriod(entries, period)

  // Binary array: 1 if activity was tagged on that day, 0 if not
  const activityPresence = filtered.map(e =>
    e.activities.includes(activityId) ? 1 : 0
  )

  // Mood scores array
  const moodScores = filtered.map(e => e.moodScore)

  // Pearson correlation coefficient
  const coefficient = pearsonCorrelation(activityPresence, moodScores)

  // Average mood with/without the activity
  const withActivity = filtered.filter(e => e.activities.includes(activityId))
  const withoutActivity = filtered.filter(e => !e.activities.includes(activityId))

  return {
    activityId,
    activityName: getActivityName(activityId),
    coefficient,
    avgMoodWith: mean(withActivity.map(e => e.moodScore)),
    avgMoodWithout: mean(withoutActivity.map(e => e.moodScore)),
    sampleSize: filtered.length,
    significance: classifySignificance(coefficient, filtered.length)
  }
}

function classifySignificance(r: number, n: number): string {
  const absR = Math.abs(r)
  if (n < 7) return 'none'           // Not enough data
  if (absR > 0.5) return 'strong'
  if (absR > 0.3) return 'moderate'
  if (absR > 0.1) return 'weak'
  return 'none'
}
```

### Therapy Export (PDF)

The therapy export generates a clean, professional PDF designed for a therapist to review during a session:

**PDF Sections:**
1. **Header** — Patient name (optional), date range, generated by MyMood
2. **Mood Overview** — Average mood, standard deviation, trend direction (improving/declining/stable)
3. **Mood Chart** — Line chart of daily average mood over the selected period
4. **Activity Correlations** — Bar chart of top 5 positive and negative correlations
5. **Notable Entries** — Days with mood score 1 or 5, plus entries with notes
6. **Weekly Patterns** — Heatmap showing mood by day of week
7. **Time-of-Day Patterns** — If multiple daily check-ins, show morning vs evening trends
8. **Raw Data Table** — Date, mood score, activities, note (for therapist reference)

**Footer:** "Generated by MyMood. Data stored locally on patient's device. Not a clinical instrument."

---

## 7. UI/UX Direction

### Design Language

- **Theme:** Dark mode default (matching My* brand)
- **Palette:** Dark background (#0D0D0D), warm surface (#1A1A1A). Mood colors on a warm spectrum: Very Low = muted coral (#E06B6B), Low = warm amber (#E09B4F), Neutral = soft gold (#E0C94F), Good = warm green (#6BCB77), Great = bright teal (#4FCCE0)
- **Typography:** Inter (humanist sans-serif). Warm, approachable tone — never clinical.
- **Iconography:** Custom mood illustrations (not stock emojis). Soft, rounded, hand-drawn feel. Avoid medical/clinical imagery.
- **Animations:** Mood icon gently pulses when selected. Check-in completion has a soft glow animation. Charts animate on load.
- **Tone:** Warm and supportive but never therapeutic. "How are you feeling?" not "Rate your mental state."

### Navigation (Bottom Tabs)

| Tab | Label | Screen |
|-----|-------|--------|
| Check-In | Check In | Quick mood entry flow |
| Timeline | Timeline | Chronological list of all entries |
| Insights | Insights | Charts, trends, and correlations |
| Export | Export | Therapy PDF and data export |
| Settings | Settings | Preferences, reminders, about |

### Screen Flows

#### 7.1 Check-In Screen (Home)

The check-in is designed to take **under 30 seconds**:

1. **Mood Picker** — 5 large mood icons in a horizontal row. Tap to select. Selected icon scales up with a gentle glow animation.
2. **Activity Tags** — Scrollable grid of activity icons with labels. Tap to toggle (multi-select). Pre-defined tags shown first, custom tags below.
3. **Note (Optional)** — Single-line text input that expands to multi-line on focus. Placeholder: "Anything on your mind?" Max 500 characters.
4. **Submit** — Large "Save" button. On save: gentle checkmark animation, entry appears in timeline.

**Time-of-day indicator:** If it's morning (6am-12pm), show "Good morning" and auto-tag as morning check-in. Afternoon (12pm-5pm), evening (5pm-9pm), night (9pm-6am) similarly.

**Streak indicator (optional):** Small text at top: "7-day streak" with a subtle warm glow. Can be disabled in settings.

#### 7.2 Timeline Screen

- **View Modes:** List (default) / Calendar / Year Pixels
- **List View:** Cards showing date, mood icon, mood score, activity tags, note preview. Grouped by week with week summary (average mood).
- **Calendar View:** Monthly calendar with mood-colored dots on each day. Tap a day to see entries.
- **Year Pixels View:** 365-day color grid (a la GitHub contributions). Each day colored by average mood. Tap for detail.
- **Filter:** By mood score range, by activity tag, by date range.
- **Search:** Full-text search across notes.

#### 7.3 Insights Screen

- **Period Selector:** 7 days, 30 days, 90 days, Year, All Time
- **Mood Trend Chart:** Line chart with daily average mood. Moving average overlay. Trend indicator (arrow up/down/flat).
- **Activity Correlations:** Horizontal bar chart sorted by correlation strength. Green bars for positive correlation, coral bars for negative. Tap a bar for detail: "On days you exercise, your average mood is 3.8 vs 2.9 on days you don't."
- **Weekly Pattern:** Heatmap or bar chart showing average mood by day of week. "Your best days tend to be Saturdays."
- **Time-of-Day Pattern:** If multiple daily check-ins, show morning vs evening comparison.
- **Distribution:** Pie or donut chart showing percentage of days at each mood level.
- **Insight Cards:** Auto-generated template-based insights: "Your mood has improved 0.4 points on average over the last 30 days." / "Exercise appears in 8 of your 10 highest-mood days."

#### 7.4 Export Screen

- **Therapy Export:** Date range picker → Preview → Generate PDF → Share sheet
- **Data Export:** JSON or CSV toggle → Export all data → Share sheet
- **Backup:** (v2) iCloud Drive backup button with last backup date

#### 7.5 Settings Screen

- **Reminders:** Add/edit check-in reminder times and days
- **Mood Scale:** 5-point (default) or 10-point
- **Activities:** Manage activity tags (reorder, hide, create custom)
- **Streaks:** Enable/disable streak counter
- **Display:** Theme (dark/light/system)
- **Crisis Resources:** Static page with 988 Lifeline, Crisis Text Line, SAMHSA helpline
- **Data:** Export, backup, delete all data
- **About:** Version, licenses, privacy policy, My* family links
- **Source Code:** Link to GitHub repository

---

## 8. Monetization

### Pricing Model

- **Price:** $4.99 one-time (USD)
- **No subscription.** Mental health tools should not create financial anxiety.
- **No ads.** Especially not in a mental health context.
- **No in-app purchases beyond the initial unlock.**

### Revenue Channels

| Channel | Platform | Provider | Cut |
|---------|----------|----------|-----|
| iOS App Store | iPhone, iPad, Mac (Catalyst) | Apple IAP via RevenueCat | 70/30 → 85/15 |
| Google Play Store | Android | Google IAP via RevenueCat | 70/30 → 85/15 |
| Mac App Store | macOS native | Apple IAP via RevenueCat | 70/30 |
| Direct sales | Web, GitHub | Lemon Squeezy | 95/5 |

### Revenue Projections (Conservative)

| Scenario | Downloads/mo | Conversion | Revenue/mo |
|----------|-------------|-----------|-----------|
| Baseline (Month 1-3) | 8,000 | 6% | $3,360 |
| Growing (Month 4-8) | 25,000 | 9% | $15,750 |
| Established (Month 9-12) | 50,000 | 10% | $35,000 |

Mental health app discovery is stronger than most categories due to high search volume ("mood tracker", "mood diary", "therapy journal") and emotional motivation to download.

### Why One-Time Works

- **Zero server costs** — All computation is local
- **No AI costs** — Correlations use basic statistics, not API calls
- **Mental health ethics** — Subscription pressure on users tracking depression is morally questionable
- **Differentiation** — "One-time purchase" is itself a marketing differentiator in this category
- **Long tail** — Mental health apps have high retention. Users who start tracking tend to continue for months/years.

---

## 9. Marketing Angle

### Positioning

**Tagline:** "Your feelings. Not their data."

**Elevator pitch:** MyMood is a mood tracker that keeps your emotional data on your device. Log how you feel, see what helps, and export a summary for your therapist. $4.99 once, no subscription, no cloud, no AI therapy experiments.

### Launch Strategy

1. **Reddit (organic):** Post in r/mentalhealth (1.1M), r/Anxiety (750K), r/depression (1M), r/therapy (200K), r/privacy (2M). Lead with the BetterHelp/FTC angle: "After the BetterHelp settlement, I built a mood tracker that never touches a server."
2. **Therapy communities:** Partner with therapy-focused newsletters and podcasts. The "therapy export" feature is a natural talking point for therapists recommending tools to clients.
3. **Privacy communities:** r/privacy, r/degoogle, r/PrivacyGuides. Cross-promote with other My* apps.
4. **Mental Health Awareness Month (May):** Time a marketing push for Mental Health Awareness Month. Content: "5 things your mood tracker sends to Facebook."
5. **Therapist outreach:** Create a one-page PDF for therapists: "Recommend MyMood to your clients. Here's why it's safe." Distribute through therapy directories and professional communities.
6. **Product Hunt launch:** Position as privacy tool, not just mental health app. Broader appeal.

### Key Messages

- "Your mood diary. Stored on your phone. Period."
- "$4.99 once. Not $25/year. Not $65/week."
- "The therapy export your therapist will actually love."
- "No AI therapy. No chatbot. Just honest data about how you feel."
- "BetterHelp shared your therapy data with Facebook. We don't even have a server."

---

## 10. MVP Timeline (Week-by-Week)

### Phase 1: Foundation (Weeks 1-2)

- [ ] Monorepo scaffold (Turborepo + pnpm + Expo + Next.js)
- [ ] SQLite schema implementation with migrations
- [ ] Core types and shared business logic package
- [ ] Design tokens and UI component library foundation
- [ ] Bottom tab navigation shell
- [ ] Custom mood illustrations (commission or create 5 mood icons)

### Phase 2: Check-In Flow (Weeks 3-4)

- [ ] Mood picker component (5-point scale with custom icons)
- [ ] Activity tag grid (17 default tags + custom tag creation)
- [ ] Note input component
- [ ] Check-in submission and SQLite persistence
- [ ] Time-of-day auto-detection
- [ ] Multiple check-ins per day support
- [ ] Today screen showing last check-in summary

### Phase 3: Timeline & History (Weeks 5-6)

- [ ] Timeline list view with entry cards
- [ ] Calendar view with mood-colored dots
- [ ] Year-in-pixels view
- [ ] Entry detail/edit screen
- [ ] Full-text search across notes
- [ ] Filter by mood score, activity, date range
- [ ] Week/month summary cards

### Phase 4: Insights & Correlations (Weeks 7-8)

- [ ] Analytics package: correlation engine, trend calculator
- [ ] Mood trend line chart (daily average, moving average)
- [ ] Activity correlation bar chart
- [ ] Weekly pattern heatmap
- [ ] Distribution donut chart
- [ ] Template-based insight cards
- [ ] Period selector (7d/30d/90d/year/all)

### Phase 5: Therapy Export & Polish (Weeks 9-10)

- [ ] PDF generation (therapy export layout)
- [ ] PDF preview screen
- [ ] Share sheet integration
- [ ] JSON/CSV data export
- [ ] Settings screen (reminders, activities, display)
- [ ] Check-in reminder notifications
- [ ] Crisis resources screen (988 Lifeline, Crisis Text Line)
- [ ] Onboarding flow (3-screen intro)
- [ ] Empty states

### Phase 6: Launch Prep (Weeks 11-12)

- [ ] App Store / Play Store listing preparation
- [ ] RevenueCat integration (one-time IAP)
- [ ] Lemon Squeezy integration (direct sales)
- [ ] Privacy policy and terms
- [ ] Beta testing (TestFlight + Google Play internal)
- [ ] Web app deployment (Next.js on Vercel)
- [ ] Therapist one-pager PDF
- [ ] Marketing materials and launch posts
- [ ] App icon, splash screen, store screenshots

---

## 11. Acceptance Criteria

The MVP is complete when:

1. **Mood Check-In** — User can log mood on a 5-point scale with activity tags and an optional note in under 30 seconds. Multiple check-ins per day are supported.
2. **Activity Tags** — 17 pre-defined tags are available. User can create, reorder, and hide custom tags.
3. **Timeline** — All entries are viewable in list, calendar, and year-pixels formats. Entries are searchable and filterable.
4. **Insights** — Mood trend chart, activity correlations, weekly patterns, and distribution are computed and displayed for configurable time periods.
5. **Therapy Export** — User can generate a PDF summary for a date range containing mood chart, correlations, notable entries, and raw data table. PDF opens in share sheet.
6. **Reminders** — User can set daily check-in reminders at specific times via local push notifications.
7. **Privacy** — Zero network requests during normal operation. No analytics SDKs. No account creation. App works fully offline.
8. **Crisis Resources** — Static screen links to 988 Suicide & Crisis Lifeline and Crisis Text Line.
9. **Cross-Platform** — Runs on iOS, Android, and web.
10. **Payment** — One-time purchase of $4.99 via App Store IAP and direct sales.
11. **Performance** — App launches in <1.5s. Check-in flow completes in <30 seconds. Charts render in <500ms with 1 year of daily data.

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| App Store rejects for mental health content without clinical review | Launch blocked | MyMood is a data tool, not a therapy tool. No AI therapy, no clinical claims. Include clear disclaimers. Follow Apple's Health App guidelines. |
| Users expect AI-powered insights (market conditioned by Woebot/Wysa) | Negative reviews, low retention | Clear positioning: "Data tool, not a therapist." Focus on the therapy export as the bridge to professional care. Simple statistical insights are more trustworthy than AI black boxes. |
| Correlation engine gives misleading results with small sample sizes | Users make bad decisions based on spurious correlations | Require minimum 7 days of data before showing correlations. Show confidence levels. Add disclaimer: "Correlations are patterns, not causes." |
| Privacy positioning attracts a niche audience but limits mainstream appeal | Revenue below sustainability | Privacy is the hook, but the therapy export and simplicity are the retention features. Target therapy communities, not just privacy communities. |
| Competitors add "local mode" as a feature | Differentiator weakened | Local-first is our architecture, not a toggle. Competitors would need to rebuild their entire stack. First-mover advantage in the privacy-first mood tracking space. |

---

## 13. Ethical Considerations

### What MyMood Will NOT Do

1. **No AI therapy or chatbot** — AI therapy is unregulated, potentially harmful, and a privacy nightmare. MyMood is a data collection and visualization tool.
2. **No crisis detection** — Algorithmically detecting crisis states from mood data is unreliable and creates liability. We include static crisis resources instead.
3. **No diagnostic claims** — MyMood does not diagnose depression, anxiety, or any condition. It tracks mood for the user's own insight.
4. **No social features** — Sharing mood data socially is pressure-laden and potentially harmful. No leaderboards, no sharing, no community.
5. **No dark patterns** — No "your streak will break" guilt messages. No notification spam. No subscription upsells during low-mood entries.
6. **No data monetization** — Not now, not ever. The business model is the purchase price.

### Crisis Resources (Always Accessible)

- **988 Suicide & Crisis Lifeline:** Call or text 988 (US)
- **Crisis Text Line:** Text HOME to 741741 (US)
- **SAMHSA National Helpline:** 1-800-662-4357
- **International Association for Suicide Prevention:** https://www.iasp.info/resources/Crisis_Centres/

These are shown in Settings and on the "About" screen. They are static links, not algorithmic triggers.

---

## 14. Design Tokens (Dark Theme)

```typescript
const theme = {
  colors: {
    background: '#0D0D0D',
    surface: '#1A1A1A',
    surfaceElevated: '#242424',
    text: '#FFFFFF',
    textSecondary: '#999999',
    textTertiary: '#666666',
    accent: '#F59E0B',                // Amber — primary brand color
    accentSecondary: '#14B8A6',       // Teal — secondary actions
    moodVeryLow: '#E06B6B',          // Muted coral
    moodLow: '#E09B4F',              // Warm amber
    moodNeutral: '#E0C94F',          // Soft gold
    moodGood: '#6BCB77',             // Warm green
    moodGreat: '#4FCCE0',            // Bright teal
    positiveCorrelation: '#6BCB77',   // Green
    negativeCorrelation: '#E06B6B',   // Coral
    chartLine: '#F59E0B',
    chartFill: 'rgba(245, 158, 11, 0.15)',
    tabActive: '#FFFFFF',
    tabInactive: '#666666',
    border: '#2A2A2A',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 24 },
  typography: {
    greeting: { fontSize: 24, fontWeight: '700', fontFamily: 'Inter' },
    moodLabel: { fontSize: 18, fontWeight: '600' },
    insightTitle: { fontSize: 16, fontWeight: '600' },
    insightBody: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    sectionHeader: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
    caption: { fontSize: 12, fontWeight: '400', color: '#666666' },
    metric: { fontSize: 32, fontWeight: '700' },
    button: { fontSize: 16, fontWeight: '600' },
  }
}
```
