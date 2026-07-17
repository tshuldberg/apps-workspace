# MyHabits — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyHabits** is a privacy-first habit tracker that strips away gamification bloat and subscription pricing to deliver a single, beautiful experience: track your daily habits, see your streaks, and visualize your consistency over time. All data stays on your device. No accounts, no cloud sync, no leaderboards, no XP systems, no social features — just you and your habits rendered in a GitHub-style contribution heatmap.

---

## Problem Statement

Habit tracking is one of the most searched self-improvement categories on app stores, yet the landscape fails users in three specific ways:

1. **Gamification undermines the habit itself.** Habitica turns habit tracking into an RPG. Fabulous wraps habits in a "journey" narrative with animations and unlockable content. These apps shift the user's motivation from building the actual habit to feeding the app's engagement loop. When the novelty of the game mechanics wears off, the habits die with it. Research on extrinsic vs. intrinsic motivation (Deci & Ryan, Self-Determination Theory) consistently shows that gamification can undermine the intrinsic motivation that sustains long-term behavior change.

2. **Subscription pricing for a checkbox.** Habitify charges $29.99/year for what is fundamentally a checklist with a calendar. Productive charges $39.99/year. Tandemon charges $59.99/year. These apps are charging recurring revenue for an app that, at its core, needs to store a boolean per habit per day in a local database. The marginal cost to serve each user is effectively zero — there's no server, no AI model, no content library that justifies ongoing payment.

3. **Feature creep kills simplicity.** Streaks (the iOS app) started beautifully simple but is iOS-only at $4.99. Every cross-platform alternative has bloated into a "productivity suite" with habit grouping, habit templates from a marketplace, habit challenges, habit coaching, journaling, mood tracking, goal setting, and pomodoro timers. Users who want a clean, focused habit tracker have to wade through features they'll never use.

---

## Target User Persona

**Primary: Alex, 32, Self-Improvement Enthusiast**

- Reads r/getdisciplined, r/selfimprovement, and r/theXeffect (the "don't break the chain" method)
- Has tried Habitica (too gamified), Habitify (too expensive), and a spreadsheet (too cumbersome)
- Currently uses a physical habit tracker notebook or a notes app with checkboxes
- Wants to track 3-8 daily habits (exercise, reading, meditation, journaling, water intake, etc.)
- Motivated by visual progress — loves the GitHub contribution graph aesthetic
- Values simplicity: the app should take <10 seconds to log all habits for the day
- Privacy-conscious but not paranoid — appreciates local-only as a bonus, not the primary purchase driver
- Willing to pay once for a well-designed tool; allergic to subscriptions for simple apps
- Age range: 20-45
- Technical level: Moderate
- Platforms: iOS and Android equally

**Secondary: Students tracking study habits, fitness enthusiasts tracking workout consistency, anyone doing a "30-day challenge"**

---

## Competitive Landscape

| Competitor | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|---|---|---|---|---|---|
| **Streaks** | $4.99 one-time | ~2M downloads | ~$10M lifetime | Fully local (iCloud sync optional) | iOS only. No Android. No web. Limited to 24 habits max (arbitrary cap) |
| **Habitica** | Free / $47.99/yr | ~10M downloads | ~$15M ARR | Cloud-based, account required, social features expose data | Gamification overwhelms the habit itself. RPG mechanics are a distraction. Requires account |
| **Habitify** | Free / $29.99/yr | ~3M downloads | ~$10M ARR | Cloud-synced with account required | Subscription for basic features. Free tier limited to 3 habits. Aggressive upsells |
| **Productive** | Free / $39.99/yr | ~5M downloads | ~$15M ARR | Cloud-synced with account required | Subscription pricing. Feature bloat (routines, challenges, habit templates) |
| **Tandemon** | Free / $59.99/yr | ~1M downloads | ~$5M ARR | Cloud-based, social habit tracking | Social-first design. Expensive subscription. Not useful for solo tracking |
| **Loop Habit Tracker** | Free (open source) | ~5M downloads (Android) | $0 | Fully local, open source | Android only. Dated UI. No iOS version. Development slowed |
| **Notion/Spreadsheet** | Free-ish | N/A | N/A | Depends on platform | Not purpose-built. No quick daily check-in. No visualizations. Friction kills consistency |

**Market opportunity:** "Habit tracker" is a perennially top-searched category on both app stores. The category leader (Habitica) has 10M+ downloads despite a niche RPG mechanic — proving massive demand. Streaks proved that simple + beautiful + one-time-purchase works on iOS, but it has no Android version. Loop proved the demand for a free, local, non-gamified tracker on Android, but its UX is stuck in 2018. The gap: a cross-platform, beautifully designed, local-only habit tracker with heatmap visualization at a one-time price point.

---

## Key Features (MVP)

### Habit Management
- **Create habit:** Name, emoji icon (picker from system emoji), frequency (daily, specific days of week, X times per week), optional target time of day (morning / afternoon / evening — for sorting, not reminders in MVP)
- **Edit habit:** Modify name, icon, frequency, time of day, color
- **Archive habit:** Remove from daily view without deleting data. Archived habits and their history remain in the database. Can be unarchived.
- **Delete habit:** Permanent deletion with confirmation. Removes all associated completion data.
- **Reorder habits:** Drag-and-drop to reorder habits in the daily checklist
- **Habit limit:** None. Track as many habits as you want (no artificial cap like Streaks' 24-habit limit)

### Daily Check-In
- **Today view (default screen):** List of today's active habits. Each row: emoji icon, habit name, streak count, and a circular checkbox. Tap the checkbox to mark complete — satisfying haptic feedback + fill animation
- **Completion is binary:** Done or not done. No percentages, no half-completions, no "almost did it" states. Simplicity is the feature.
- **Undo:** Tap a completed habit to un-complete it (toggle). No confirmation needed — it's a checkbox.
- **Quick entry:** The entire daily check-in should take <10 seconds for a user with 5 habits. One tap per habit, no modals, no extra screens.

### Streaks
- **Current streak:** Consecutive days the habit was completed (respecting the habit's frequency — a M/W/F habit doesn't break its streak on Tuesday)
- **Best streak:** All-time longest streak for each habit
- **Streak display:** Current streak number shown inline on the Today view next to each habit. Best streak shown on the habit detail screen.

### Heatmap Visualization
- **GitHub-style contribution heatmap** — the signature feature. Grid of squares, one per day, colored by completion ratio:
  - Empty (dark gray): No habits completed
  - Light: 1-33% of habits completed
  - Medium: 34-66% completed
  - Full (vibrant amber): 67-100% completed
- **Per-habit heatmap:** Each habit has its own heatmap on its detail screen (binary: completed = amber, not completed = dark)
- **Global heatmap:** Insights screen shows an aggregate heatmap across all habits
- **Time range:** Shows last 12 months by default (scrollable for older data)
- **Inspired by:** GitHub contribution graph, r/theXeffect's "don't break the chain" index cards

### Weekly & Monthly Views
- **Week view:** Bar chart showing completion percentage per day for the current week
- **Month view:** Calendar grid with completion dots (similar to the heatmap but in calendar layout)

### Widget
- **iOS widget (Small, 2x2):** Shows today's habits with completion status. Tap a habit in the widget to mark it complete without opening the app (via App Intent)
- **iOS widget (Medium, 4x2):** Shows today's habits + current streaks
- **Android widget:** Same as iOS small widget — today's habits with tap-to-complete

### Data Management
- **Export:** CSV or JSON export of all habit data (habits + completions + streaks)
- **Import:** CSV import for users migrating from other trackers
- **Wipe all data:** Single button with confirmation to permanently delete everything

---

## Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Mobile framework | Expo (React Native) with Expo Router |
| Web framework | Next.js 15 (App Router) |
| Local database | expo-sqlite (mobile) / IndexedDB via Dexie.js (web) |
| State management | Zustand with SQLite persistence layer |
| UI components | Custom component library, dark mode native |
| Haptics | expo-haptics |
| Drag and drop | react-native-reanimated + gesture-handler |
| Heatmap/charts | react-native-svg (custom heatmap component) |
| Widget (iOS) | expo-widgets or native WidgetKit module |
| Widget (Android) | expo-widgets or native AppWidgetProvider module |
| Monorepo | Turborepo |
| Package manager | pnpm |
| Language | TypeScript 5.9 everywhere |
| Testing | Vitest (shared logic), Jest (React Native) |

### Data Model (SQLite)

```sql
-- Habit definitions
CREATE TABLE habits (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '✅',     -- Emoji icon
  color       TEXT NOT NULL DEFAULT '#F5A623', -- Hex color for heatmap
  frequency   TEXT NOT NULL DEFAULT 'daily',   -- 'daily' | 'specific_days' | 'x_per_week'
  days_of_week TEXT,                           -- JSON array: [1,3,5] for Mon/Wed/Fri (ISO weekday)
  times_per_week INTEGER,                      -- For 'x_per_week' frequency
  time_of_day TEXT DEFAULT 'anytime',          -- 'morning' | 'afternoon' | 'evening' | 'anytime'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,      -- 0 = active, 1 = archived
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_habits_archived ON habits(archived);
CREATE INDEX idx_habits_sort_order ON habits(sort_order);

-- Daily completions (one row per habit per day)
CREATE TABLE completions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  habit_id    TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,                   -- ISO 8601 date (YYYY-MM-DD)
  completed   INTEGER NOT NULL DEFAULT 1,      -- 1 = completed (only rows for completed days exist)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(habit_id, date)
);

CREATE INDEX idx_completions_habit_date ON completions(habit_id, date);
CREATE INDEX idx_completions_date ON completions(date);

-- Precomputed streak cache (updated on each completion toggle)
CREATE TABLE streak_cache (
  habit_id        TEXT PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  best_streak     INTEGER NOT NULL DEFAULT 0,
  last_completed  TEXT,                        -- ISO 8601 date of most recent completion
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings (key-value store)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Schema version for migrations
CREATE TABLE schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Streak Calculation Algorithm

```
Algorithm: Frequency-Aware Streak Calculation
──────────────────────────────────────────────

Input:  habit (with frequency config), completions[] sorted by date DESC
Output: current_streak, best_streak

For DAILY habits:
  1. Start from today (or yesterday if today is not yet logged)
  2. Walk backwards through dates
  3. Current streak = consecutive days with a completion record
  4. Break at the first missing day
  5. Best streak = max streak found across all contiguous runs

For SPECIFIC_DAYS habits (e.g., Mon/Wed/Fri):
  1. Generate the list of "expected" dates going backwards from today
     (only include days that match the habit's days_of_week)
  2. Walk backwards through expected dates
  3. Current streak = consecutive expected dates with a completion record
  4. A non-expected day (e.g., Tuesday for a M/W/F habit) does NOT break the streak
  5. Best streak = max streak across all contiguous runs of expected dates

For X_PER_WEEK habits (e.g., 3x per week):
  1. Group completions by ISO week
  2. Current streak = consecutive weeks where completions >= times_per_week
  3. Best streak = max streak of qualifying weeks

Edge cases:
  - Today not yet logged: Current streak counts through yesterday (grace period)
  - Habit created today with no completions: streak = 0
  - Archived habit: streak frozen at time of archival
```

### Privacy Architecture

**Identical to MyCycle's privacy model:**

- Zero network requests — no analytics, no crash reporting, no remote config
- SQLite database in app sandbox, excluded from cloud backups
- No account creation, no email collection, no identifiers
- `Info.plist` and `AndroidManifest.xml` declare no network permissions
- "Wipe All Data" with destructive confirmation
- Source-available under FSL — anyone can verify the zero-network claim

**Additional consideration for MyHabits:** Habit names themselves can be sensitive (e.g., "Take antidepressant," "AA meeting," "Therapy appointment"). The local-only architecture ensures these labels never leave the device. No analytics SDK can capture screen contents or input fields because no analytics SDK exists in the app.

---

## UI/UX Direction

### Design Language

- **Color palette:** Dark background (#0A0A0F), warm amber primary (#F5A623), habit-specific colors (user-selectable from a curated palette of 12 warm-to-cool options), muted grays for secondary UI
- **Typography:** Inter — clean, humanist, excellent number rendering for streak counts
- **Heatmap colors (global):** Dark gray (#1A1A2E) for empty, graduating through amber shades (#3D2E0A, #7A5C14, #B88A1E, #F5A623) for completion levels. Per-habit heatmaps use the habit's chosen color
- **Shape language:** Rounded squares for heatmap cells (2px gap), circular checkboxes, rounded rectangle cards
- **Motion:** Checkbox fill animation (circle wipe from center, 200ms spring), haptic on completion (medium impact), streak counter number rolls up when incrementing, heatmap squares fade in on scroll

### Navigation Structure

Bottom tab bar with 3 tabs:

```
[Today]     [Heatmap]     [Settings]
```

1. **Today tab (default):** Vertical list of today's active habits. Each row:
   ```
   ┌──────────────────────────────────────┐
   │  📚  Read 30 minutes          🔥 14  │
   │                              [ ○ ]   │
   └──────────────────────────────────────┘
   ```
   Emoji icon, habit name, flame + current streak count (right-aligned), circular checkbox (far right). Tap checkbox to complete — circle fills with the habit's color, haptic fires, streak count increments with a roll animation.

   Below the habit list: a daily completion percentage ring showing "4/6 today" or similar.

   FAB (floating action button) or "+" in the top-right to create a new habit.

2. **Heatmap tab:** Full-screen scrollable heatmap.
   - Top section: Global heatmap (all habits aggregated) — 52 columns (weeks) x 7 rows (days), most recent week on the right. Each cell colored by daily completion percentage.
   - Below: Per-habit heatmaps in a vertical list. Each shows the habit name, emoji, current/best streak, and its own 12-month heatmap in the habit's color.
   - Tap any cell to see the date and completion details in a tooltip.

3. **Settings tab:**
   - Manage habits (reorder, archive, delete)
   - Export data (CSV / JSON)
   - Import data
   - Wipe all data
   - Appearance (future: light mode option)
   - About MyHabits

### Key Screen Flows

**Creating a habit:**
```
Screen: New Habit (pushed from Today tab)
┌──────────────────────────────────────┐
│  Name                                │
│  [____________________________]      │
│                                      │
│  Icon                                │
│  [Emoji picker grid — recent + all]  │
│                                      │
│  Color                               │
│  [● ● ● ● ● ● ● ● ● ● ● ●]       │
│  (12 curated colors in a row)        │
│                                      │
│  Frequency                           │
│  [Daily]  [Specific Days]  [X/Week]  │
│                                      │
│  (If Specific Days:)                 │
│  [M] [T] [W] [T] [F] [S] [S]       │
│                                      │
│  (If X/Week:)                        │
│  [  3  ] times per week              │
│                                      │
│  Time of Day                         │
│  [Morning] [Afternoon] [Evening]     │
│  [Anytime]                           │
│                                      │
│           [Save Habit]               │
└──────────────────────────────────────┘
```

**Habit detail (tap habit name on Today tab):**
```
Screen: Habit Detail
┌──────────────────────────────────────┐
│  📚  Read 30 minutes                 │
│                                      │
│  Current streak: 14 days 🔥          │
│  Best streak: 31 days                │
│  Total completions: 89               │
│  Completion rate: 78%                │
│                                      │
│  [12-month heatmap in habit color]   │
│                                      │
│  [Edit]  [Archive]  [Delete]         │
└──────────────────────────────────────┘
```

### Widget Design

**iOS Small Widget (2x2):**
```
┌─────────────┐
│ MyHabits     │
│ 📚 ✅  🏃 ○ │
│ 🧘 ✅  💧 ○ │
│ 4/6 today    │
└─────────────┘
```

Tapping a habit circle in the widget marks it complete via App Intent (no app launch needed). Background updates via WidgetKit timeline.

---

## Monetization

### Pricing

- **$4.99 one-time purchase** via App Store / Google Play (RevenueCat)
- **$4.99 one-time purchase** via direct sale (Lemon Squeezy)
- **No free tier, no subscription, no ads, no in-app purchases beyond the initial buy**
- Price point matches Streaks ($4.99) while offering cross-platform availability. At $4.99, the decision cost is negligible for the target audience.

### Revenue Model

- Target: 100,000 paid downloads in year 1 = ~$425,000 gross (after App Store cut via Small Business Program)
- Lower price point than MyCycle but larger addressable market (habit tracking is gender-neutral)
- Zero ongoing costs — no servers, no APIs, no cloud infrastructure
- Direct sales via Lemon Squeezy for users who find the app through GitHub or the website

### Why $4.99

- Streaks proved the iOS market supports $4.99 one-time for a habit tracker
- $4.99 is a psychological "less than a coffee" price point
- Cross-platform availability (iOS + Android + Web) at the same price as iOS-only Streaks
- Low enough to be an impulse purchase; high enough to signal quality over free alternatives

---

## Marketing Angle

### One-Sentence Pitch

**"Track your habits without tracking you."**

### Expanded Pitch

MyHabits is a $5 habit tracker with a GitHub-style heatmap that keeps all your data on your device. No accounts, no gamification, no subscription. Just beautiful streaks and a satisfying daily check-in that takes 10 seconds. Your habits are your business — literally, the app can't see them.

### Target Communities

1. **r/getdisciplined** (2.1M members) — Core audience. Habit tracking is the #1 topic. Lead with the heatmap visualization and simplicity angle.
2. **r/selfimprovement** (2.5M members) — Broader self-improvement audience. Position as "the tool that gets out of your way."
3. **r/theXeffect** (130K members) — The "don't break the chain" community. The heatmap IS the X-effect, digitized. Perfect product-market fit.
4. **r/privacy** (1.7M members) — Secondary audience. The "no tracking" angle resonates here as a bonus feature.
5. **ProductHunt** — Launch with the "GitHub contribution graph for your habits" visual hook. Strong ProductHunt category fit.
6. **Indie hacker communities** (HackerNews, IndieHackers) — Source-available, one-time-purchase, privacy-first — this checks every box the indie community values. Expect organic amplification.

### Press-Worthy Elements

- **Visual hook:** The GitHub heatmap applied to habit tracking is immediately recognizable and shareable. Screenshots sell themselves.
- **Anti-gamification stance:** In a market dominated by RPGs, challenges, and leaderboards, "we removed all that" is a story.
- **Source-available:** Verifiable privacy claims. Code review by the community.
- **Price disruption:** $5 one-time vs $30-60/year subscriptions. "Why are you paying monthly for a checklist?"

---

## MVP Timeline

### Pre-Development (Week 0)
- Finalize design document
- Set up Turborepo monorepo (shared with other MyApps if scaffold already exists)
- Configure pnpm, TypeScript, ESLint, Prettier
- CI setup (GitHub Actions)

### Week 1: Data Layer + Streak Logic
- Implement SQLite schema and migration system
- Build streak calculation algorithm in `packages/shared/` (with frequency-aware logic)
- Comprehensive tests: daily streaks, specific-day streaks, X-per-week streaks, edge cases (grace period, gaps, archival)
- Implement Zustand store with SQLite persistence
- Build data export/import utilities

### Week 2: Today View + Daily Check-In
- Build habit list component with checkbox, emoji, streak display
- Implement checkbox animation (circle wipe) and haptic feedback
- Build habit creation screen (name, emoji picker, color selector, frequency)
- Implement drag-and-drop reorder (react-native-reanimated)
- Wire completion toggle to SQLite + streak recalculation

### Week 3: Heatmap
- Build custom heatmap component in react-native-svg (reusable for global + per-habit)
- Implement color interpolation for completion percentage heatmap cells
- Build the Heatmap tab with global aggregate heatmap
- Build per-habit heatmap cards in a scrollable list
- Implement tap-to-inspect on heatmap cells (tooltip with date and details)

### Week 4: Habit Detail + Settings
- Build habit detail screen (stats, per-habit heatmap, edit/archive/delete)
- Build settings screen (manage habits, export, import, wipe)
- Implement archive/unarchive flow
- Build completion percentage ring on Today view
- Polish all transitions and animations

### Week 5: Widget + Web
- Build iOS widget (WidgetKit via expo-widgets or native module)
- Implement App Intent for tap-to-complete in widget
- Build Android widget (AppWidgetProvider)
- Port core UI to Next.js web app
- Cross-platform testing

### Week 6: Polish + Distribution
- Accessibility pass (VoiceOver, TalkBack, dynamic type)
- Performance profiling (heatmap rendering with 365+ days of data)
- App Store screenshots and metadata
- RevenueCat IAP configuration
- Lemon Squeezy storefront
- Source-available repository setup
- Landing page
- Submit to App Store review

---

## Acceptance Criteria

The MVP is complete when ALL of the following are true:

### Functional
- [ ] User can create a habit with name, emoji, color, and frequency (daily, specific days, X/week)
- [ ] User can reorder habits via drag-and-drop
- [ ] User can complete a habit with a single tap (checkbox animation + haptic)
- [ ] User can un-complete a habit with a single tap (toggle)
- [ ] Streak calculation is correct for daily habits (consecutive days)
- [ ] Streak calculation is correct for specific-day habits (only expected days count)
- [ ] Streak calculation is correct for X-per-week habits (weekly threshold)
- [ ] Today's incomplete habits that are past due are not marked (no auto-fail, just unchecked)
- [ ] Global heatmap renders 12 months of data with correct color mapping
- [ ] Per-habit heatmap renders on habit detail screen
- [ ] Tapping a heatmap cell shows date and completion info
- [ ] Habit detail screen shows current streak, best streak, total completions, completion rate
- [ ] Habits can be archived (hidden from Today, data preserved)
- [ ] Habits can be deleted (data permanently removed with confirmation)
- [ ] Data can be exported as CSV and JSON
- [ ] Data can be imported from CSV
- [ ] All data can be wiped with confirmation
- [ ] iOS widget shows today's habits with tap-to-complete
- [ ] Daily check-in for 5 habits takes <10 seconds (measured in user testing)

### Privacy
- [ ] Zero network requests confirmed via packet capture
- [ ] No analytics, crash reporting, or remote config SDKs in dependency tree
- [ ] SQLite database excluded from iCloud/Google backup
- [ ] No account creation, no email, no identifiers
- [ ] Source code published under FSL license

### Quality
- [ ] Heatmap renders smoothly with 2+ years of data (no jank on scroll)
- [ ] App launches in <2 seconds
- [ ] Checkbox tap response is <50ms (feels instant)
- [ ] VoiceOver and TalkBack fully navigate all screens
- [ ] Dynamic type / font scaling doesn't break layouts

### Distribution
- [ ] Available on iOS App Store
- [ ] Available on Google Play Store
- [ ] Available as a web app (Next.js)
- [ ] iOS and Android widgets functional
- [ ] RevenueCat IAP configured and tested
- [ ] Lemon Squeezy storefront live
- [ ] Landing page live
