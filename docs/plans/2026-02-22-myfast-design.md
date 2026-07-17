# MyFast — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyFast** — Zero charges $70/yr for a timer. MyFast charges $4.99 forever.

A minimalist intermittent fasting timer for iOS, Android, Mac, and web. Start/stop fasting timer, preset fasting protocols (16:8, 18:6, 20:4, OMAD, custom), fasting history log, streak tracking, daily/weekly stats, optional weight log, and a home screen widget showing your current fast status. No accounts, no social features, no gamification, no premium upsells. Just a timer and your stats.

### Core Differentiators

1. **Absurdly simple** — It's a timer. Start it when you stop eating. Stop it when you eat. That's it. No "fasting zones", no "autophagy clocks", no pseudo-science gamification.
2. **$4.99 forever** — Zero charges $70/yr for the same core functionality. Fastic charges $50/yr. MyFast charges once and never again.
3. **No accounts required** — All data stored locally. No email, no sign-up, no social profiles, no "fasting community" you didn't ask for.
4. **Widget-first design** — The home screen widget IS the app for most users. Glance at your fast status without opening the app.
5. **Source-available** — FSL license. You can verify the app does exactly what it claims.

---

## Problem Statement

Intermittent fasting is practiced by tens of millions of people worldwide. The most popular fasting app, Zero, charges $70/yr. The second most popular, Fastic, charges $50/yr. Both offer a free tier with aggressive upsells, push notifications begging you to subscribe, and "premium" features that amount to a slightly fancier timer.

The core functionality users need is simple: a timer that tracks when they're fasting, a history of past fasts, and basic stats (streak, averages). This is a single SQLite table and a countdown timer. It does not require a server, a subscription, or a "fasting coach."

The subscription model works for these apps because fasting is a daily habit with high retention — users open the app every day, creating daily upsell opportunities. MyFast rejects this extractive model entirely. The timer is $4.99. There is nothing to upsell because there is nothing behind a paywall.

---

## Target User Persona

### Primary: "Subscription Fatigued Faster"
- **Age:** 25-45
- **Gender:** Split (fasting is popular across genders)
- **Behavior:** Practices 16:8 or 18:6 intermittent fasting daily. Opens their fasting app 1-2 times per day (start fast, end fast). Uses the widget more than the app itself.
- **Pain point:** Paying $70/yr for Zero feels absurd for a timer. Free tier is limited and full of upsell banners. Frustrated by "premium" gates on basic features.
- **Willingness to pay:** Moderate — the price must feel fair for a simple utility. $4.99 is an impulse buy.
- **Tech savvy:** Low to moderate — uses their phone apps daily but isn't technical.
- **Trigger:** Zero's renewal notification arrives, or Fastic's 50th push notification about upgrading finally breaks them.

### Secondary: "Fasting Beginner"
- **Age:** 20-35
- **Behavior:** Just starting intermittent fasting. Saw a TikTok or YouTube video about 16:8. Wants a simple app to track their fasts.
- **Pain point:** Downloaded Zero, immediately overwhelmed by features, upsells, and pseudo-science. Just wants to start a timer.
- **Willingness to pay:** Low initially, but $4.99 is cheap enough that it's not a barrier.
- **Trigger:** Googled "simple fasting timer app" or "intermittent fasting app without subscription."

### Tertiary: "Data Minimalist"
- **Age:** 30-50
- **Behavior:** Practices extended fasting (OMAD, 24h, multi-day). Doesn't want social features or gamification. Wants clean data on their fasting history.
- **Pain point:** Fasting apps are bloated with features they don't use. Wants a clean, focused tool.
- **Willingness to pay:** High — values simplicity and would pay for an app that respects their time.

---

## Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------|
| **Zero** | $70/yr (premium) | 10M+ | ~$100M ARR | Cloud-synced, requires account, tracks usage patterns | Absurdly expensive for a timer, aggressive upsells, pseudo-science "fasting zones" |
| **Fastic** | $50/yr (premium) | 20M+ | ~$80M ARR | Cloud-synced, social features, data stored on servers | Aggressive push notifications, gamification overload, "fasting coach" is just canned content |
| **Life Fasting** | Free (ad-supported) | 5M+ | ~$5M ARR (ads) | Cloud-synced with social | Ads interrupt the fasting experience, social features are unwanted noise |
| **Fastient** | Free / $10 one-time | 500K+ | ~$1M | Local storage option | Dated UI, limited mobile experience, small developer |
| **Simple** | $40/yr (premium) | 5M+ | ~$30M ARR | Cloud-synced, requires account | Another subscription timer with meal logging bloat |
| **BODYFAST** | $50/yr (premium) | 10M+ | ~$60M ARR | Cloud-synced | "AI Coach" is marketing fluff, expensive |
| **Apple Health** | Free | Bundled | $0 | On-device | No fasting timer, just data integration |
| **MyFast** | **$4.99 one-time** | 0 (launch) | TBD | **Local-only, no account, source-available** | New entrant, no brand recognition |

### Market Opportunity

The intermittent fasting app market is valued at ~$800M and growing 10%+ annually. Zero alone has 10M+ users paying up to $70/yr. The gap is obvious: no one has built a high-quality, one-time-purchase fasting timer. The existing market is saturated with subscription apps that are fundamentally overcharging for simple functionality.

The "Zero too expensive" and "fasting app without subscription" searches are growing. Reddit's r/intermittentfasting (2.5M members) regularly features threads asking for cheaper alternatives. MyFast targets this exact demand.

---

## Key Features (MVP)

### Core Timer
1. **Fast timer** — Start/stop fasting timer with a single tap. Large, clear countdown/countup display. Shows elapsed time, remaining time (based on target), and end time.
2. **Preset fasting protocols** — 16:8, 18:6, 20:4, OMAD (23:1), 36-hour, 48-hour, custom. User selects their default protocol. Can override per-fast.
3. **Fasting state indicator** — Clear visual state: "Fasting" (with elapsed time) or "Eating" (with window remaining). Color-coded: teal when fasting, coral when eating.

### History & Stats
4. **Fasting history log** — Chronological list of completed fasts with start time, end time, duration, target hit (yes/no), and optional notes.
5. **Streak tracking** — Current streak (consecutive days hitting target), longest streak, total fasts completed.
6. **Daily/weekly stats** — Average fasting duration, target adherence rate (% of fasts that hit goal), total fasting hours this week/month.
7. **Weight log (optional)** — Log weight alongside fasts. Simple line chart over time. Completely optional — hidden by default, enable in settings.

### Widget & Notifications
8. **Home screen widget** — Shows current fast status (fasting/eating), elapsed time, target progress as a circular ring. Tap to open app.
9. **Optional notifications** — "Fast complete" notification when target reached. "Eating window closing" reminder. All optional, all off by default.

### Simplicity
10. **No accounts** — Data stored locally in SQLite. No email, no password, no sign-up flow.
11. **No social features** — No leaderboards, no friends, no sharing prompts.
12. **No pseudo-science** — No "autophagy zone" claims, no "fat burning phase" indicators, no "fasting coach." Just a timer and data.
13. **Export** — Export fasting history as CSV. Your data, portable.

---

## Technical Architecture

### Stack

- **Frontend (Mobile):** Expo (React Native) — iOS + Android from single codebase
- **Frontend (Web):** Next.js 15
- **Widget (iOS):** SwiftUI WidgetKit (native widget, Expo config plugin)
- **Widget (Android):** Glance (Jetpack Compose widgets, Expo config plugin)
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web)
- **Notifications:** `expo-notifications` (local only — no push server)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere (except native widget code in Swift/Kotlin)
- **License:** FSL-1.1-Apache-2.0

### Monorepo Structure

```
MyFast/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx          # Timer screen (home)
│   │   │   │   ├── history.tsx        # Fasting history
│   │   │   │   ├── stats.tsx          # Stats & trends
│   │   │   │   └── settings.tsx       # Settings
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── timer/         # Timer ring, countdown, controls
│   │   │   ├── history/       # History list, fast card
│   │   │   ├── stats/         # Stat cards, charts
│   │   │   └── weight/        # Weight log input, chart
│   │   ├── widgets/
│   │   │   ├── ios/           # SwiftUI WidgetKit widget
│   │   │   └── android/       # Glance widget
│   │   └── assets/
│   └── web/                   # Next.js 15 — Web
│       ├── app/
│       │   ├── page.tsx               # Timer
│       │   ├── history/page.tsx       # History
│       │   ├── stats/page.tsx         # Stats
│       │   └── settings/page.tsx      # Settings
│       ├── components/
│       └── public/
├── packages/
│   ├── shared/                # Types, utils, business logic
│   │   ├── src/
│   │   │   ├── types/         # Fast, Protocol, WeightEntry types
│   │   │   ├── db/            # SQLite schema, migrations, queries
│   │   │   ├── timer/         # Timer logic, state machine
│   │   │   ├── protocols/     # Fasting protocol definitions
│   │   │   ├── stats/         # Streak, averages, adherence rate
│   │   │   └── export/        # CSV export
│   │   └── package.json
│   └── ui/                    # Shared component library
│       ├── src/
│       │   ├── timer/         # Timer ring component, countdown
│       │   ├── charts/        # Weight chart, fasting duration chart
│       │   ├── cards/         # Stat card, fast history card
│       │   └── theme/         # Design tokens
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
-- Fasting sessions
CREATE TABLE fasts (
    id TEXT PRIMARY KEY,                          -- UUID v4
    protocol TEXT NOT NULL,                        -- '16:8', '18:6', '20:4', '23:1', '36:0', '48:0', 'custom'
    target_hours REAL NOT NULL,                    -- Target fasting duration in hours
    started_at TEXT NOT NULL,                      -- ISO 8601 timestamp
    ended_at TEXT,                                 -- NULL if currently fasting
    duration_seconds INTEGER,                      -- Computed on end (or live via app logic)
    hit_target INTEGER,                            -- Boolean: duration >= target
    notes TEXT,                                    -- Optional user note
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX fasts_started_idx ON fasts(started_at);
CREATE INDEX fasts_protocol_idx ON fasts(protocol);
CREATE INDEX fasts_hit_target_idx ON fasts(hit_target);

-- Weight entries (optional)
CREATE TABLE weight_entries (
    id TEXT PRIMARY KEY,                          -- UUID v4
    weight_value REAL NOT NULL,                    -- Weight in user's preferred unit
    unit TEXT NOT NULL DEFAULT 'lbs',              -- 'lbs' or 'kg'
    date TEXT NOT NULL,                             -- ISO date 'YYYY-MM-DD'
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX weight_date_idx ON weight_entries(date);

-- Fasting protocols (preset + custom)
CREATE TABLE protocols (
    id TEXT PRIMARY KEY,                          -- '16:8', '18:6', etc.
    name TEXT NOT NULL,                            -- 'Lean Gains (16:8)'
    fasting_hours REAL NOT NULL,
    eating_hours REAL NOT NULL,
    description TEXT,                              -- Brief explanation
    is_custom INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,         -- User's selected default
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Streak cache (computed, refreshed on fast completion)
CREATE TABLE streak_cache (
    key TEXT PRIMARY KEY,                          -- 'current_streak', 'longest_streak', 'total_fasts'
    value INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Active fast state (singleton — at most one active fast)
CREATE TABLE active_fast (
    id TEXT PRIMARY KEY DEFAULT 'current',
    fast_id TEXT NOT NULL REFERENCES fasts(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    target_hours REAL NOT NULL,
    started_at TEXT NOT NULL
);

-- App settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Schema versioning
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Seed Data (Protocols)

```sql
INSERT INTO protocols (id, name, fasting_hours, eating_hours, description, sort_order) VALUES
    ('16:8',  'Lean Gains (16:8)',  16, 8, 'Fast 16 hours, eat within an 8-hour window. Most popular protocol for beginners.', 1),
    ('18:6',  'Daily 18:6',         18, 6, 'Fast 18 hours, eat within a 6-hour window. Moderate intensity.', 2),
    ('20:4',  'Warrior (20:4)',     20, 4, 'Fast 20 hours, eat within a 4-hour window. One main meal with snacks.', 3),
    ('23:1',  'OMAD (23:1)',        23, 1, 'One Meal A Day. Fast 23 hours, single eating hour.', 4),
    ('36:0',  'Alternate Day (36h)', 36, 0, 'Full 36-hour fast. Skip an entire day of eating.', 5),
    ('48:0',  'Extended (48h)',     48, 0, 'Full 48-hour fast. Two days without eating.', 6);
```

### Timer State Machine

```typescript
// packages/shared/src/timer/state-machine.ts

type FastState = 'idle' | 'fasting' | 'eating_window';

interface TimerState {
  state: FastState;
  activeFast: {
    id: string;
    protocol: string;
    targetHours: number;
    startedAt: Date;
  } | null;
  elapsed: number;          // Seconds since fast started
  remaining: number;        // Seconds until target reached (0 if passed)
  progress: number;         // 0.0 to 1.0 (can exceed 1.0 if over target)
  targetReached: boolean;
}

function computeTimerState(activeFast: ActiveFast | null, now: Date): TimerState {
  if (!activeFast) {
    return { state: 'idle', activeFast: null, elapsed: 0, remaining: 0, progress: 0, targetReached: false };
  }

  const elapsed = Math.floor((now.getTime() - new Date(activeFast.startedAt).getTime()) / 1000);
  const targetSeconds = activeFast.targetHours * 3600;
  const remaining = Math.max(0, targetSeconds - elapsed);
  const progress = elapsed / targetSeconds;
  const targetReached = elapsed >= targetSeconds;

  return {
    state: 'fasting',
    activeFast,
    elapsed,
    remaining,
    progress: Math.min(progress, 1),  // Cap at 1.0 for ring display
    targetReached
  };
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

### Privacy Architecture

```
┌────────────────────────────────────────────────────┐
│                    MyFast App                       │
│                                                     │
│  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │   Timer UI        │  │   Widget (Native)       │ │
│  │   (React Native / │  │   (SwiftUI / Glance)    │ │
│  │    Next.js)       │  │   Reads shared state    │ │
│  └────────┬──────────┘  └────────────┬────────────┘ │
│           │                          │              │
│  ┌────────▼──────────────────────────▼────────────┐ │
│  │             Business Logic Layer                │ │
│  │  (packages/shared)                             │ │
│  │  - Timer state machine                         │ │
│  │  - Fast CRUD                                   │ │
│  │  - Streak computation                          │ │
│  │  - Stats aggregation                           │ │
│  │  - CSV export                                  │ │
│  └──────────────────┬─────────────────────────────┘ │
│                     │                               │
│  ┌──────────────────▼─────────────────────────────┐ │
│  │            Local SQLite Database                │ │
│  │  - Fasting sessions                            │ │
│  │  - Weight entries (optional)                   │ │
│  │  - Protocols                                   │ │
│  │  - Settings                                    │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ❌ ZERO network permissions requested              │
│  ❌ No accounts or sign-up                         │
│  ❌ No analytics SDK                               │
│  ❌ No crash reporting SDK                         │
│  ❌ No push notification server (local only)       │
│  ❌ No social features                             │
│  ❌ No location access                             │
└────────────────────────────────────────────────────┘
```

**Key privacy decisions:**
- The app requests ZERO network permissions. Not even for analytics or crash reporting.
- Local notifications (fast complete, eating window closing) are handled entirely by `expo-notifications` with no push server.
- The widget reads from a shared App Group (iOS) or SharedPreferences (Android) that the main app writes to. No network involved.
- Weight data is stored locally and never transmitted. Users who want to share it must explicitly export CSV.
- No account means no password to breach, no email to leak, no data to subpoena.

### Widget Architecture

```
iOS Widget (SwiftUI WidgetKit):
┌──────────────────────────────┐
│  Timer state written to       │
│  App Group UserDefaults       │
│  by React Native app          │
│                               │
│  Widget reads from            │
│  App Group UserDefaults       │
│  on timeline refresh          │
│                               │
│  Timeline: refresh every 15m  │
│  (WidgetKit minimum)          │
│  + on-demand when app writes  │
└──────────────────────────────┘

Shared state (JSON in UserDefaults):
{
  "state": "fasting",
  "startedAt": "2026-02-22T20:00:00Z",
  "targetHours": 16,
  "protocol": "16:8"
}

Widget displays:
┌────────────────────┐
│  ◐ Fasting         │    Small widget (2x2)
│  12:34:56          │    Circular ring + elapsed time
│  16:8 · 78%        │    Protocol + progress
└────────────────────┘

┌─────────────────────────────┐
│  ◐ Fasting                  │    Medium widget (4x2)
│  12h 34m 56s elapsed        │    Ring + detailed stats
│  Target: 16:00 · Ends 12pm  │    Target time + end time
│  Streak: 14 days            │    Current streak
└─────────────────────────────┘
```

---

## UI/UX Direction

### Design Philosophy
- **Maximally simple** — The timer is the entire app. If a feature doesn't serve the timer, it doesn't exist.
- **Glanceable** — The most important information (am I fasting? how long?) is visible in <1 second. Big numbers. Clear colors.
- **Zero friction** — Starting a fast is one tap. Ending a fast is one tap. No confirmation dialogs, no "are you sure?", no intermediate screens.
- **Calm, not urgent** — No gamification pressure, no "you're losing your streak!" warnings, no achievement badges, no push notification spam. The app is a tool, not a coach.

### Design Tokens (Dark Theme)

```typescript
const theme = {
  colors: {
    background: '#0D0B0F',          // Deep purple-black
    surface: '#171419',             // Dark surface
    surfaceElevated: '#211D26',     // Elevated card
    text: '#F5F2F8',               // Cool white
    textSecondary: '#9B92A8',      // Muted lavender
    textTertiary: '#5E5669',       // Dim purple-grey
    fasting: '#14B8A6',            // Teal — fasting state
    fastingDim: '#0D7A6E',         // Dimmed teal for ring background
    fastingGlow: '#5EEAD4',        // Bright teal for glow effects
    eating: '#E8725C',             // Coral — eating window state
    eatingDim: '#9A4A3B',          // Dimmed coral
    idle: '#5E5669',               // Grey — no active fast
    accent: '#D4915E',             // Amber — primary action
    success: '#22C55E',            // Green — target reached
    ring: {
      track: '#1E1A23',            // Ring track (unfinished portion)
      fasting: '#14B8A6',          // Ring fill when fasting
      complete: '#22C55E',         // Ring fill when target reached
      overtime: '#D4915E',         // Ring fill when past target
    },
    border: '#252030',
    danger: '#EF4444',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  typography: {
    timer: { fontFamily: 'Inter', fontSize: 56, fontWeight: '700', letterSpacing: -1 },
    timerLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5 },
    heading: { fontFamily: 'Inter', fontSize: 24, fontWeight: '700' },
    subheading: { fontFamily: 'Inter', fontSize: 18, fontWeight: '600' },
    body: { fontFamily: 'Inter', fontSize: 16, fontWeight: '400', lineHeight: 24 },
    stat: { fontFamily: 'Inter', fontSize: 32, fontWeight: '700' },
    statUnit: { fontFamily: 'Inter', fontSize: 14, fontWeight: '500' },
    caption: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500' },
    label: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  }
};
```

### Navigation (Bottom Tabs)

| Tab | Icon | Screen |
|-----|------|--------|
| Timer | Clock | Active timer (home) |
| History | List | Past fasts log |
| Stats | Bar chart | Trends & streaks |
| Settings | Gear | Preferences, weight log, export |

Note: Only 4 tabs. Minimal navigation. The Timer tab is where users spend 95% of their time.

### Screen Flows

#### 1. First Launch / Onboarding
1. Welcome screen: "A fasting timer. That's it." App name, clean illustration of a timer ring.
2. Choose protocol: Grid of 6 preset protocols (16:8, 18:6, 20:4, OMAD, 36h, 48h) + "Custom" option. Each shows fasting/eating hours and a brief description. User taps to select default.
3. Widget prompt: "Add the MyFast widget to your home screen for at-a-glance fasting status." Visual instruction showing widget placement.
4. Done: "Start your first fast." Arrow to timer screen.

#### 2. Timer Screen (Home)

**Idle state (not fasting):**
```
┌─────────────────────────┐
│                          │
│      ┌──────────┐       │
│     ╱   ○ ○ ○    ╲      │    Grey ring (empty)
│    │   NOT FASTING │     │
│    │   Tap to start│     │
│     ╲             ╱      │
│      └──────────┘       │
│                          │
│  Protocol: 16:8          │    Current default protocol
│  Last fast: 16h 23m      │    Most recent completed fast
│  Streak: 14 days         │    Current streak badge
│                          │
│  [ Start Fast ]          │    Large teal button
│                          │
│  Change protocol ▸       │    Small text link
└─────────────────────────┘
```

**Fasting state (active fast):**
```
┌─────────────────────────┐
│                          │
│      ┌──────────┐       │
│     ╱ ████████    ╲      │    Teal ring filling clockwise
│    │                │     │
│    │   12:34:56     │     │    Large elapsed time (teal)
│    │   FASTING      │     │    State label
│    │                │     │
│     ╲  ████████   ╱      │
│      └──────────┘       │
│                          │
│  Target: 16:00           │    Target duration
│  Remaining: 3h 25m 04s   │    Time left to target
│  Ends at: 12:00 PM       │    Predicted end time
│                          │
│  [ End Fast ]            │    Coral button (end)
│                          │
└─────────────────────────┘
```

**Target reached state:**
```
┌─────────────────────────┐
│                          │
│      ┌──────────┐       │
│     ╱ ████████████ ╲     │    Green ring (complete)
│    │    ✓             │   │
│    │   16:42:18       │   │    Elapsed (green, past target)
│    │   TARGET HIT     │   │    Success state
│    │                  │   │
│     ╲ ████████████ ╱     │
│      └──────────┘       │
│                          │
│  Protocol: 16:8          │
│  Over target by: 42m 18s │    How much past the goal
│  Started: 8:00 PM        │
│                          │
│  [ End Fast ]            │    Coral button
│                          │
└─────────────────────────┘
```

- **Ring animation:** Smooth fill animation. Ring fills clockwise from 12 o'clock position. Color transitions from teal (fasting) to green (target reached) with a subtle pulse animation when target is hit.
- **Timer updates:** Every second. Background timer continues when app is closed (computed from `startedAt` timestamp, not a foreground counter).
- **Single-tap start:** "Start Fast" begins immediately with default protocol. No confirmation dialog.
- **Single-tap end:** "End Fast" stops the timer and saves the fast. Shows a brief completion summary toast.

#### 3. History Screen
- **Chronological list** of completed fasts (newest first)
- **Fast card:** Protocol badge | Start time | End time | Duration | Target hit (checkmark or X)
- **Swipe to delete** individual fasts
- **Monthly grouping:** "February 2026" headers
- **Empty state:** "No fasts recorded yet. Start your first fast from the Timer tab."

#### 4. Stats Screen

**Header row (4 stat cards):**
| Current Streak | Longest Streak | Total Fasts | Avg Duration |
|:-:|:-:|:-:|:-:|
| 14 days | 31 days | 127 | 16.4h |

**Charts:**
- **Weekly bar chart:** Fasting hours per day for the past 7 days. Green bars for target hits, amber for misses. Target line overlay.
- **Monthly adherence:** Calendar heatmap showing fasting days. Green = hit target, amber = fasted but missed target, empty = no fast.
- **Duration trend:** Line chart of fasting duration over the past 30 days with 7-day moving average.
- **Weight trend** (if enabled): Line chart of weight entries over time. Weight is always optional and off by default.

#### 5. Settings Screen
- **Default protocol:** Select from presets or create custom (set fasting hours + eating hours)
- **Notifications:** Toggle "Fast complete" and "Eating window closing" (both off by default). Set reminder time for eating window.
- **Weight log:** Toggle weight tracking on/off (off by default). When on, shows weight input after ending a fast.
- **Units:** lbs / kg for weight
- **Appearance:** Theme (Dark / Light). Font size.
- **Export:** Export all data as CSV (fasts + weight entries)
- **Data:** "Erase all data" (danger zone with confirmation)
- **About:** Version, license (FSL), source code link, privacy statement

---

## Monetization

### Pricing Model
- **$4.99 one-time purchase** — Full app, all features, forever
- No free tier, no trial, no subscriptions, no ads, no IAP
- Lowest price point in the My* lineup — fasting timer is the simplest utility

### Revenue Projections (Conservative)

| Metric | Month 1 | Month 6 | Year 1 | Year 2 |
|--------|---------|---------|--------|--------|
| Downloads | 5,000 | 15,000/mo | 120,000 | 400,000 |
| Revenue (gross) | $25,000 | $75,000/mo | $600,000 | $2,000,000 |
| Apple/Google cut (30%→15%) | $7,500 | $22,500/mo | $150,000 | $300,000 |
| Net revenue | $17,500 | $52,500/mo | $450,000 | $1,700,000 |

### Why $4.99 Works
- **Impulse buy territory** — $4.99 is cheaper than a coffee. Users don't deliberate, they just buy.
- **Zero charges $70/yr** — MyFast pays for itself in the first 26 days vs Zero's subscription. This comparison is the entire marketing campaign.
- **Zero marginal cost** — No server, no AI, no data pipeline. Each additional user costs nothing.
- **Word-of-mouth multiplier** — "I replaced my $70/yr fasting app with a $5 one" is the kind of thing people share unprompted in fasting communities.
- **High volume at low price** — The fasting market is massive (tens of millions of active users). Even capturing 1% of Zero's user base at $4.99 = 100K users = $500K.

---

## Marketing Angle

### Tagline
**"A timer shouldn't cost $70/yr."**

### Positioning Statement
MyFast is for people who practice intermittent fasting and are tired of paying subscription prices for a timer. $4.99 once. No accounts. No upsells. No pseudo-science. Just a timer and your stats.

### Launch Channels

| Channel | Approach | Expected Impact |
|---------|----------|----------------|
| **r/intermittentfasting** (2.5M) | "I built a $4.99 fasting timer because Zero charging $70/yr is insane" — founder story | Very high — subscription frustration is the #1 complaint |
| **r/fasting** (600K) | "Simple fasting app with no accounts, no social, no pseudo-science" | High — minimalist approach resonates with serious fasters |
| **r/1200isplenty, r/loseit** (3M+ combined) | "Free yourself from fasting app subscriptions" — casual mention in diet communities | Medium — adjacent audience |
| **Product Hunt** | "Zero charges $70/yr for a timer. MyFast charges $4.99 forever." | Very high — price comparison is Product Hunt's favorite genre |
| **Hacker News** | "Show HN: A fasting timer that costs $5 and stores nothing in the cloud" | High — simplicity + privacy angle |
| **TikTok/Instagram** | Short video: side-by-side of Zero's pricing page vs MyFast | Very high — price shock content performs well |
| **YouTube (fasting creators)** | Partner with IF content creators: "The only fasting app I recommend" | High — trusted recommendations in fasting niche |
| **App Store ASO** | Target keywords: "intermittent fasting timer", "fasting app no subscription", "16:8 timer" | High — long-term organic discovery |
| **Zero 1-star reviews** | Target users frustrated with Zero's pricing — respond to sentiment on social | Medium — capture switching intent at the decision point |

### Content Marketing
- Blog post: "Why Zero charges $70/yr for a timer (and why it doesn't have to)"
- Blog post: "The 6 fasting protocols explained in 60 seconds"
- Comparison page: "Zero vs Fastic vs Life vs MyFast" — feature matrix + 3-year cost comparison
- Infographic: "What $70/yr buys you in Zero vs what $4.99 buys you in MyFast" (spoiler: the same features)
- Social post series: "$70/yr fasting app vs $4.99 fasting app — can you spot the difference?" with screenshot comparisons

### PR Angle
- "Against subscription apps: the $4.99 fasting timer taking on a $100M company"
- Pitch to The Verge, WIRED, and health/fitness publications
- Frame as part of the broader anti-subscription movement in consumer apps

---

## MVP Timeline (Week-by-Week)

### Week 1: Foundation
- [ ] Initialize Turborepo monorepo with pnpm
- [ ] Set up Expo app with file-based routing
- [ ] Set up Next.js 15 web app
- [ ] Configure shared TypeScript config, ESLint, Prettier
- [ ] Implement SQLite schema (fasts, protocols, weight_entries, settings)
- [ ] Write migration system
- [ ] Seed protocol data (16:8, 18:6, 20:4, OMAD, 36h, 48h)
- [ ] Implement timer state machine (start/stop/compute elapsed)

### Week 2: Timer UI
- [ ] Build timer ring component (animated circular progress)
- [ ] Build Timer screen with idle/fasting/target-reached states
- [ ] Implement single-tap start/stop flow
- [ ] Build protocol selector (grid of protocol cards)
- [ ] Implement background timer (computed from startedAt, not foreground counter)
- [ ] Build completion toast/summary
- [ ] Wire up local notifications (fast complete, eating window closing)

### Week 3: History & Stats
- [ ] Build History screen with chronological fast list
- [ ] Build fast card component (protocol, times, duration, target hit)
- [ ] Implement streak computation (consecutive target-hit days)
- [ ] Build Stats screen with 4 stat cards (streak, total, avg duration, adherence)
- [ ] Build weekly bar chart (fasting hours per day)
- [ ] Build monthly adherence heatmap
- [ ] Build duration trend line chart

### Week 4: Widget & Weight
- [ ] Implement iOS widget (SwiftUI WidgetKit) — small and medium sizes
- [ ] Implement Android widget (Glance) — small and medium sizes
- [ ] Build shared state bridge (React Native → App Group UserDefaults / SharedPreferences)
- [ ] Implement optional weight log (input after fast completion, line chart in stats)
- [ ] Build CSV export (fasts + weight entries)
- [ ] Build Settings screen

### Week 5: Polish & Testing
- [ ] Dark theme refinement (deep tones, teal/coral states)
- [ ] Onboarding flow (protocol selection, widget prompt)
- [ ] Timer ring animation polish (smooth fill, color transitions, target pulse)
- [ ] Edge case testing: fast spanning midnight, fast spanning timezone change, long fasts (48h+)
- [ ] Widget refresh reliability testing
- [ ] Battery impact testing (background timer should use zero battery — computed, not polling)

### Week 6: Launch
- [ ] App icon and splash screen design
- [ ] App Store screenshots and description (emphasize: $4.99, no subscription, simple timer)
- [ ] Privacy policy page ("We collect nothing. We don't even have a server to collect things on.")
- [ ] Beta testing (TestFlight + internal)
- [ ] Submit to App Store and Google Play
- [ ] Prepare Product Hunt launch: "$70/yr for a timer. Or $4.99 forever."
- [ ] Write r/intermittentfasting launch post
- [ ] Create TikTok/Instagram price comparison video

---

## Acceptance Criteria

### Must pass before launch:
1. **Timer accuracy:** Timer elapsed time matches wall clock time within 1 second after 24+ hours of fasting, including app kills and device restarts.
2. **Background persistence:** Start a fast, kill the app, wait 8 hours, reopen — elapsed time is correct. Timer was never running in the foreground.
3. **Widget sync:** Widget shows correct fasting state within 15 minutes of starting/ending a fast. Widget shows correct elapsed time (within 15 minutes due to WidgetKit refresh rate).
4. **Streak correctness:** Streak count is accurate across timezone changes, DST transitions, and midnight-spanning fasts.
5. **Protocol presets:** All 6 preset protocols work correctly. Custom protocols accept any valid fasting/eating hour combination.
6. **Notifications:** "Fast complete" notification fires at the correct time (within 1 minute of target). Notifications are silent when disabled.
7. **CSV export:** Exported CSV is valid and contains all fasts with correct timestamps, durations, and protocol labels.
8. **Performance:** App launches in <500ms. Timer screen renders at 60fps. History scrolls smoothly with 1,000+ fasts.
9. **Privacy:** App requests zero network permissions. Verified via iOS privacy report. No DNS queries after install.
10. **Cross-platform parity:** Timer, history, and stats work identically on iOS, Android, and web.

### Quality gates:
- Zero crashes in 72-hour continuous fasting test (app open and backgrounded repeatedly)
- Timer survives: app kill, device restart, low-battery shutdown, airplane mode toggle
- Accessibility: VoiceOver/TalkBack announces timer state, elapsed time, and can start/stop fasts
- Dark mode: no white flashes on any screen transition
- Widget: renders correctly in small and medium sizes on iOS 16+ and Android 12+
- Supports iOS 16+, Android 10+, Chrome/Safari/Firefox (latest 2 versions)
