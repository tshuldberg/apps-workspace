# MyPresence - Feature Gap Design Doc
**Source:** BePresent Competitive Analysis (2026-03-29)
**Status:** Draft -- new module, not yet scaffolded
**Module ID:** `presence`
**Table Prefix:** `pr_`
**Tagline:** "Put your phone down. Pick your life up."

## Product Vision

MyPresence is a privacy-first digital wellness module that helps users reduce screen time, break doomscrolling habits, and build healthier relationships with their devices. It uses the same psychological techniques that make apps addictive (gamification, social accountability, streaks, variable rewards) to instead enforce healthy phone use. All tracking data stays on-device. No cloud analytics, no usage data sold, no surveillance.

The module tracks phone usage via Apple Screen Time API (iOS) and UsageStatsManager (Android), sets personalized goals, runs focus sessions that block distracting apps, and gamifies the process of being present in real life.

## Competitors Analyzed

| Competitor | Price | Category | Key Strength |
|-----------|-------|----------|-------------|
| BePresent | $25-60/yr | Digital wellness | Gamification (XP, streaks, leaderboards), Beast Mode blocking, real-money stakes |
| Opal | $100/yr | Screen time | Beautiful design, deep blocking, Focus Score, app groups |
| One Sec | $50/yr | Habit interruption | Breathing pause before app opens, intention prompts |
| ScreenZen | Free/$30/yr | Mindful phone use | Per-app open limits with pause screens, usage budgets |
| Apple Screen Time | Free (built-in) | Basic limits | Downtime scheduling, per-app limits, family controls |
| Freedom | $40/yr | Website/app blocker | Cross-device blocking (desktop + mobile), scheduling |
| Forest | $4 one-time | Focus timer | Plant trees while focused, social forest planting |
| Flipd | Free/$50/yr | Student focus | Classroom mode, study groups, university partnerships |

## Feature Inventory: BePresent vs MyPresence (Planned)

### Core Screen Time Tracking

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 1 | Real-time screen time monitoring | Yes (Apple Screen Time API) | Yes | P0 | Medium | iOS: Screen Time API. Android: UsageStatsManager. Both require user permission grants. |
| 2 | Daily screen time goal | Yes | Yes | P0 | Low | User sets target hours/minutes per day. Stored in `pr_settings`. |
| 3 | Daily screen time reports | Yes | Yes | P0 | Low | Breakdown by app category (Social, Entertainment, Productivity, etc.). |
| 4 | Weekly screen time reports | Yes | Yes | P0 | Low | 7-day trend chart, daily averages, best/worst days. |
| 5 | App usage breakdown | Yes | Yes | P0 | Low | Per-app time spent, sorted by usage. Top offenders highlighted. |
| 6 | Historical data / trends | Yes | Yes | P1 | Low | 30/90/365 day views. Show improvement trajectory. |
| 7 | Usage pattern identification | Yes | Yes | P1 | Medium | Detect peak usage hours, most-opened apps, longest sessions. On-device analysis only. |
| 8 | Previous-day review prompt | Yes | Yes | P1 | Low | Morning notification: "Yesterday you spent X hours. Y over/under goal." |
| 9 | Progressive screen time alerts | Yes | Yes | P1 | Low | Escalating notifications: gentle at 1hr, firm at 2hr, urgent at 3hr+. Configurable thresholds. |

### Focus Sessions (Present Sessions)

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 10 | Solo focus session | Yes (Individual) | Yes | P0 | Medium | Timer-based session. Block all apps except whitelist for set duration. |
| 11 | Allowed apps whitelist | Yes | Yes | P0 | Low | Configure which apps remain accessible during sessions (Phone, Maps, etc.). |
| 12 | Session duration picker | Yes | Yes | P0 | Low | 15m, 30m, 45m, 1h, 2h, custom. |
| 13 | Scheduled sessions | Yes | Yes | P1 | Medium | Set sessions to start at specific times (e.g., 9pm daily, 6am-8am weekdays). |
| 14 | Recurring sessions | Yes | Yes | P1 | Medium | Repeat daily/weekdays/weekends. Stored in `pr_scheduled_sessions`. |
| 15 | Group focus sessions | Yes | Yes | P1 | Medium | Invite friends/family to join a shared session. Everyone locks phones together. Local or synced. |
| 16 | Beast Mode (unbreakable) | Yes | Yes | P2 | High | Cannot end session early. Persists through app kill and phone restart. Requires iOS Screen Time API parental-style restrictions. |
| 17 | Session history log | No | Yes | P0 | Low | Record every session: start, end, duration, completed/abandoned, apps blocked. Analytics from session data. |
| 18 | Session streaks | Partial (daily goal streak) | Yes | P0 | Low | Consecutive days with at least one completed focus session. |

### App Intentions (Mindful App Use)

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 19 | Per-app open limits | Yes | Yes | P0 | Medium | "Instagram: 3 opens per day." After limit, show intention screen. |
| 20 | Per-app duration limits | Yes | Yes | P0 | Medium | "TikTok: max 15 minutes per open." Timer overlay after limit. |
| 21 | Intention prompt on open | Yes | Yes | P0 | Medium | "You're about to open Instagram (2 of 3 opens left). What's your intention?" Free-text or predefined options. |
| 22 | Weak spot app selection | Yes | Yes | P0 | Low | User marks specific apps as "weak spots" for special monitoring. |
| 23 | Breathing pause before open | No (One Sec has this) | Yes | P1 | Medium | 5-second breathing animation before a blocked app opens. Friction without full blocking. Cross-module with MyMood breathing. |
| 24 | Post-session reflection | No | Yes | P1 | Low | After using a weak spot app: "Was that worth it? Rate 1-5." Builds self-awareness data. |

### Gamification System

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 25 | XP / points system | Yes | Yes | P0 | Low | Earn points for: meeting daily goal, completing sessions, staying under app limits. |
| 26 | Daily streak counter | Yes | Yes | P0 | Low | Consecutive days meeting screen time goal. Prominently displayed. |
| 27 | Level progression | Yes | Yes | P1 | Low | Levels 1-50+ based on cumulative XP. Each level unlocks a title or badge. |
| 28 | Badges / achievements | Yes | Yes | P1 | Medium | Categories: First Steps (onboarding), Consistency (streaks), Focus Master (sessions), App Tamer (intentions), Social Butterfly (group sessions), Time Lord (milestones). Bronze/Silver/Gold tiers. |
| 29 | Weekly leaderboard | Yes (global + friends) | Yes (friends only) | P2 | Medium | Compete with connected friends on weekly screen time reduction. Privacy-first: no global leaderboard, opt-in only. |
| 30 | Challenges (seasonal) | Yes | Yes | P2 | Medium | Time-limited challenges: "7-Day Digital Detox," "Weekend Warrior," "No Social Sunday." Preset templates + custom creation. |

### Social & Accountability

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 31 | Accountability partners | Yes | Yes | P1 | Medium | Select 1-3 people who get notified when you exceed your screen time goal. Opt-in on both sides. |
| 32 | Group sessions | Yes | Yes | P1 | Medium | (Same as #15 above.) |
| 33 | Friends list | Yes | Yes | P1 | Low | Connection system via share codes. No phone number or email required. |
| 34 | Social feed | Yes | Yes | P2 | Medium | Opt-in activity feed: streaks, badge earned, session completed, challenge progress. Cheers/reactions. |
| 35 | Invite friends | Yes | Yes | P1 | Low | Share code or system share sheet. |

### Commitment Devices

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 36 | Money stakes | Yes (real money) | No | -- | -- | **Intentionally excluded.** Requires payment processing, legal compliance, refund handling. Not aligned with privacy-first approach. Users who want stakes can use Beeminder or similar external tools. |
| 37 | Personal commitment contracts | No | Yes | P2 | Low | Write yourself a commitment note. Surfaced when you're about to break your goal. "I committed to being present at dinner because..." No money, just self-accountability. |

### Rewards & Motivation

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 38 | External rewards (Headspace, ClassPass) | Yes | No | -- | -- | **Intentionally excluded.** Requires brand partnerships, API integrations, affiliate tracking. Not aligned with self-contained module. |
| 39 | Self-set rewards | No | Yes | P1 | Low | User defines their own rewards: "If I hit my goal 7 days straight, I'll treat myself to..." Stored locally, surfaced as congratulations. |
| 40 | Unlock insights as reward | No | Yes | P1 | Low | Deeper analytics and insights unlock as usage grows: 7-day trends at day 3, monthly patterns at day 14, personalized tips at day 30. |

### Notifications & Nudges

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 41 | Scrolling awareness reminders | Yes (hourly) | Yes | P0 | Low | Configurable interval: every 30m, 1h, 2h. "You've been scrolling for 20 minutes." |
| 42 | Progressive screen time alerts | Yes | Yes | P0 | Low | Escalating urgency as usage climbs past goal. |
| 43 | Streak reminders | Yes | Yes | P1 | Low | Evening nudge if daily goal not yet met and streak is at risk. |
| 44 | Session reminders | Yes | Yes | P1 | Low | "Your daily focus session is in 15 minutes." For scheduled sessions. |
| 45 | Accountability alerts | Yes | Yes | P1 | Medium | Notification sent to accountability partner when user exceeds goal. |
| 46 | Morning briefing | No | Yes | P1 | Low | "Good morning. Yesterday: 3h12m (32m under goal). Streak: 14 days." Cross-module with hub dashboard. |
| 47 | Bedtime wind-down | No | Yes | P1 | Low | "It's 10pm. You've used 4h today. Time to put the phone down?" Optional auto-start of a focus session. |

### Analytics & Insights

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 48 | Daily/weekly/monthly summaries | Yes | Yes | P0 | Low | Summary cards with key metrics. |
| 49 | App category breakdown | Yes | Yes | P0 | Low | Social, Entertainment, Productivity, Communication, Other. Pie chart. |
| 50 | Peak usage hours heatmap | No | Yes | P1 | Medium | Hour-by-hour usage heatmap for the week. Identify problem times. |
| 51 | Pickup frequency tracking | No | Yes | P1 | Medium | How many times per day you pick up your phone. Trend over time. |
| 52 | First/last pickup times | No | Yes | P1 | Low | Track when you first check your phone in the morning and last check at night. |
| 53 | Session quality score | No | Yes | P2 | Medium | Rate each focus session 1-5. Correlate with time of day, duration, apps blocked. |
| 54 | Personalized insights engine | No | Yes | P2 | Medium | On-device pattern detection: "You use Instagram 40% more on weekends," "Your focus sessions are most successful before noon." Pure local computation. |
| 55 | Weekly email/notification report | No | Yes | P2 | Low | Opt-in weekly digest with key stats and trends. |

### Educational Content

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 56 | ADHD management tips | Yes | Yes | P2 | Low | Static content cards on screen time and focus management for ADHD. |
| 57 | Sleep improvement content | Yes | Yes | P2 | Low | How screen time before bed affects sleep quality. Cross-module link to MyHealth sleep data. |
| 58 | Mindfulness techniques | Yes | Yes | P2 | Low | Quick breathing exercises, grounding techniques. Cross-module with MyMood. |
| 59 | Research-backed tips | Partial | Yes | P2 | Low | Rotating "Did you know?" cards with sourced research on digital wellness. |

### Settings & Configuration

| # | Feature | BePresent | MyPresence Plan | Priority | Difficulty | Notes |
|---|---------|-----------|----------------|----------|------------|-------|
| 60 | Daily screen time goal | Yes | Yes | P0 | Low | Hours and minutes picker. Adjustable anytime. |
| 61 | Notification preferences | Yes | Yes | P0 | Low | Toggle each notification type independently. |
| 62 | App Intentions config | Yes | Yes | P0 | Low | Per-app open limits, duration limits, intention prompt toggle. |
| 63 | Focus session defaults | Yes | Yes | P1 | Low | Default duration, default whitelist, default recurring schedule. |
| 64 | Theme (follows hub) | N/A | Yes | P0 | Low | Cool Obsidian dark theme from hub. |
| 65 | Data export | No | Yes | P1 | Low | CSV export of screen time history, session log, app usage. |
| 66 | Units (hours:minutes vs decimal) | No | Yes | P2 | Low | Display preference for time format. |

---

## Recommended Build Order

### Phase 1: Core Tracking (P0)
_Minimum viable module. Users can track screen time and set goals._

1. **Screen time tracking engine** -- Connect to Apple Screen Time API (iOS) and UsageStatsManager (Android). Read daily and per-app usage data. Store in `pr_daily_usage` and `pr_app_usage` tables. This is the foundation for everything else.

2. **Daily screen time goal** -- Goal setting with smart defaults based on current usage (suggest 15% reduction from average). Store in `pr_goals`. Progress bar on home screen. Goal met/missed status drives streaks and XP.

3. **Daily/weekly reports** -- Summary cards showing total screen time, app category breakdown (pie chart), comparison to goal, and daily trend for the past 7 days. Computed from `pr_daily_usage` data.

4. **App usage breakdown** -- Per-app usage list sorted by time spent. Category grouping (Social, Entertainment, Productivity). Top 3 "time sinks" highlighted. Pulled from `pr_app_usage`.

5. **Focus sessions (solo)** -- Timer-based focus mode. User selects duration and allowed apps. Session blocks distracting apps via Screen Time API restrictions. Log to `pr_sessions`. Show active session with countdown timer and motivational messages.

6. **App Intentions** -- Per-app open limits and duration limits. Intention prompt screen shown when opening a limited app. Store config in `pr_app_intentions`, track opens in `pr_app_opens`. This is the "mindful friction" feature that differentiates from pure blockers.

7. **Streak tracking** -- Calculate consecutive days meeting screen time goal. Display prominently on home screen. Streak data derived from `pr_daily_usage` vs `pr_goals`.

8. **XP / points system** -- Award points for: meeting daily goal (100 XP), completing a focus session (50 XP per 30 min), staying under all app intention limits (25 XP). Store in `pr_xp_log`. Running total on profile.

9. **Scrolling awareness notifications** -- Configurable interval reminders. Track continuous active screen time and fire notifications at thresholds. Progressive urgency as time increases past goal.

### Phase 2: Engagement & Depth (P1)

10. **Onboarding wizard** -- Permission grants (Screen Time API access), current usage analysis, smart goal suggestion, weak spot app selection, notification preferences, first focus session prompt.

11. **Historical trends (30/90/365 day)** -- Long-range charts showing screen time trajectory. Moving average line. Highlight milestones (first time under 3 hours, best week ever, etc.).

12. **Scheduled / recurring sessions** -- Set focus sessions to auto-start at specific times. Recurring schedules (every weekday at 9pm, every morning 6-8am). Store in `pr_scheduled_sessions` with cron-like recurrence pattern.

13. **Accountability partners** -- Connect with 1-3 people via share codes. They receive a notification when you exceed your daily goal. Both parties must opt in. Store in `pr_accountability_partners`.

14. **Self-set rewards** -- User defines personal rewards for milestone achievements. "7-day streak: buy myself a coffee." Stored in `pr_rewards`. Surfaced as congratulations when earned.

15. **Progressive insight unlocks** -- New analytics features unlock as the user builds history: 7-day trends (day 3), peak usage heatmap (day 7), monthly patterns (day 14), personalized tips (day 30).

16. **Badge system** -- 30+ badges across 6 categories. Bronze/Silver/Gold tiers. Categories: First Steps, Consistency, Focus Master, App Tamer, Social Butterfly, Time Lord. Store in `pr_badges`.

17. **Morning briefing notification** -- "Good morning. Yesterday: 3h12m (32m under goal). Streak: 14 days. Focus session at 9pm." Configurable delivery time.

18. **Bedtime wind-down** -- Evening notification at user-configured time. Optional auto-start of a wind-down focus session. Links to MyMood breathing exercises.

19. **Pickup frequency** -- Track how many times per day the phone is picked up. First pickup and last pickup times. Trend chart over time.

20. **Breathing pause before app open** -- 5-second breathing animation shown before a weak-spot app opens. Cross-module integration with MyMood breathing component. Configurable per-app.

21. **Post-session reflection** -- After using a weak-spot app: "Was that worth it? Rate 1-5." Optional journal prompt. Builds self-awareness data over time.

22. **Data export** -- CSV export of all tracked data: daily usage, app usage, sessions, streaks, app intention compliance.

### Phase 3: Social & Advanced (P2)

23. **Group focus sessions** -- Invite friends to join a shared focus session. Everyone's timer syncs. See who's still going. Opt-in Supabase sync for real-time status.

24. **Friends leaderboard** -- Weekly screen time reduction leaderboard among connected friends. Opt-in. Resets every Monday. Shows percentage improvement, not raw numbers (privacy-respecting).

25. **Challenges** -- Time-limited challenges: "7-Day Digital Detox," "No Social Sunday," "Weekend Warrior." 12 preset templates + custom creation. Challenge feed with participant progress.

26. **Social feed** -- Opt-in activity feed: streaks, badges earned, sessions completed, challenges joined. Cheers/reactions from friends.

27. **Level progression** -- Levels 1-50 based on cumulative XP. Each level has a title: Beginner (1-5), Apprentice (6-15), Focused (16-25), Disciplined (26-35), Master (36-45), Enlightened (46-50). Levels unlocked are shown on profile.

28. **Peak usage hours heatmap** -- 7-day x 24-hour grid showing usage intensity by color. Identify problem hours at a glance.

29. **Personalized insights engine** -- On-device pattern detection: weekend vs weekday differences, correlation between focus sessions and overall usage reduction, most/least successful times for sessions. Pure local computation.

30. **Personal commitment contracts** -- Write a commitment note to yourself. Surfaced when you're about to break your goal. "I committed to being present at dinner because my kids deserve my attention."

31. **Educational content library** -- Cards on: ADHD and screen time, sleep hygiene, mindfulness techniques, research on attention and digital habits. Rotating "Did you know?" on home screen.

32. **Session quality scoring** -- Rate sessions 1-5 after completion. Correlate quality with time of day, duration, and apps blocked. Surface patterns.

---

## Data Model

### SQLite Tables (`pr_` prefix)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `pr_daily_usage` | Daily screen time totals | date, total_minutes, goal_minutes, goal_met, pickups, first_pickup, last_pickup |
| `pr_app_usage` | Per-app daily usage | date, app_id, app_name, category, minutes, opens |
| `pr_goals` | Screen time goals | id, daily_minutes, effective_date, created_at |
| `pr_sessions` | Focus session log | id, start_time, end_time, planned_minutes, actual_minutes, completed, type (solo/group/beast), rating |
| `pr_session_whitelist` | Allowed apps per session | session_id, app_id, app_name |
| `pr_scheduled_sessions` | Recurring session config | id, time, duration_minutes, days_of_week, whitelist_json, active |
| `pr_app_intentions` | Per-app limits | id, app_id, app_name, daily_open_limit, per_open_minutes, breathing_pause, active |
| `pr_app_opens` | Per-app open tracking | id, date, app_id, opened_at, intention_text, post_rating |
| `pr_xp_log` | XP earning events | id, date, source (goal/session/intention), amount, created_at |
| `pr_badges` | Earned badges | id, badge_type, tier (bronze/silver/gold), earned_at |
| `pr_rewards` | Self-set rewards | id, milestone_type, milestone_value, reward_text, earned, earned_at |
| `pr_accountability_partners` | Partner connections | id, partner_name, share_code, active, created_at |
| `pr_challenges` | Active/completed challenges | id, name, type, start_date, end_date, goal_json, status |
| `pr_challenge_members` | Challenge participants | id, challenge_id, profile_id, progress_json |
| `pr_commitment_contracts` | Personal commitment notes | id, text, created_at, active |
| `pr_settings` | Key-value config | key, value |
| `pr_community_profiles` | Social profiles | id, display_name, avatar_emoji, visibility_json |
| `pr_community_connections` | Friend connections | id, from_id, to_id, status, share_code |
| `pr_community_feed` | Activity feed items | id, profile_id, type, data_json, created_at |

### Indexes
- `idx_pr_daily_usage_date` on `pr_daily_usage(date)`
- `idx_pr_app_usage_date` on `pr_app_usage(date)`
- `idx_pr_app_usage_app` on `pr_app_usage(app_id, date)`
- `idx_pr_sessions_date` on `pr_sessions(start_time)`
- `idx_pr_app_opens_date` on `pr_app_opens(date, app_id)`
- `idx_pr_xp_log_date` on `pr_xp_log(date)`

---

## Mobile Screens

### Tab Bar (4 tabs)

| Tab | Screen | Content |
|-----|--------|---------|
| Home | `index.tsx` | Today's screen time progress ring, streak counter, XP total, quick-start session button, daily tip card, challenge banner (when active) |
| Stats | `stats.tsx` | Daily/weekly/monthly toggle, usage bar chart, app category pie chart, top apps list, pickup count, first/last pickup |
| Sessions | `sessions.tsx` | Start new session (solo/group/beast), scheduled sessions list, session history with completion status and ratings |
| Settings | `settings.tsx` | Daily goal, app intentions config, notification preferences, accountability partners, scheduled sessions, rewards, export, theme |

### Hidden Screens (push navigation)

| Screen | Route | Content |
|--------|-------|---------|
| Onboarding | `onboarding.tsx` | 5-step wizard: permission grant, usage analysis, goal setting, weak spot selection, first session |
| App Intentions | `intentions.tsx` | Per-app configuration: select apps, set open limits, duration limits, breathing pause toggle |
| Intention Prompt | `intention-prompt.tsx` | Full-screen prompt shown before opening limited app: "What's your intention?" with remaining opens count |
| Focus Session Active | `session-active.tsx` | Countdown timer, motivational messages, blocked app list, session abandon button (disabled in Beast Mode) |
| Session Complete | `session-complete.tsx` | Celebration screen, XP earned, session rating prompt, streak update |
| Post-App Reflection | `reflection.tsx` | "Was that worth it?" 1-5 rating after using weak-spot app |
| Badges | `badges.tsx` | Grid of all badges with earned/locked states, tap for details |
| Leaderboard | `leaderboard.tsx` | Weekly friends leaderboard with percentage improvements |
| Challenges | `challenges.tsx` | Active and available challenges, join, progress tracking |
| Accountability | `accountability.tsx` | Manage partners, connection requests, notification history |
| Community | `community.tsx` | Social feed, friend connections, cheers |
| Insights | `insights.tsx` | Peak hours heatmap, personalized patterns, trend analysis |
| Rewards | `rewards.tsx` | Self-set rewards list, earned/pending status |
| Report | `report.tsx` | Detailed daily report with all metrics, shareable summary card |
| Education | `education.tsx` | Content library: ADHD, sleep, mindfulness, research cards |
| Commitment | `commitment.tsx` | Write/edit personal commitment contracts |

---

## Web Screens

| Route | Content |
|-------|---------|
| `/app/presence/` | Dashboard: today's usage, streak, XP, weekly chart |
| `/app/presence/stats` | Full analytics: daily/weekly/monthly, app breakdown, heatmap |
| `/app/presence/sessions` | Session history, schedule management (no active session on web) |
| `/app/presence/intentions` | App intentions configuration |
| `/app/presence/badges` | Badge collection grid |
| `/app/presence/community` | Social features: leaderboard, challenges, feed |
| `/app/presence/insights` | Personalized insights and patterns |
| `/app/presence/settings` | All configuration options |

**Note:** Focus sessions, app blocking, and intention prompts are mobile-only features (they require OS-level screen time APIs). Web serves as a dashboard for reviewing stats, configuring settings, and social features.

---

## Privacy Architecture

### Default (zero cloud)
- All screen time data stays in local SQLite. Apple/Google provide usage data on-device only.
- No screen time data, app names, or usage patterns leave the device.
- Focus session history, XP, badges, streaks all computed and stored locally.
- Personalized insights run entirely on-device. No cloud ML.
- No analytics, no telemetry, no advertising.

### Opt-in social layer
- Social features (accountability partners, leaderboard, feed, challenges) require explicit opt-in.
- Accountability notifications share only "over/under goal" status, never raw numbers or app names.
- Leaderboard shows percentage improvement, not raw screen time (protects absolute usage data).
- Feed items are user-initiated (badges, streaks) not auto-generated from usage.
- Users can revoke social access and delete synced data at any time.

### What we never share
- Which specific apps you use
- When you use your phone
- How many times you pick it up
- Your screen time numbers (unless you explicitly share via leaderboard)

### Marketing message
"Your screen time is your business. We help you change it without watching you."

### BePresent contrast
BePresent requires a cloud account and stores usage data on their servers. Their gamification (global leaderboards, monetary stakes, brand reward partnerships) depends on centralized data. MyPresence proves you can gamify digital wellness without surveillance.

---

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyMood** | Breathing exercises before app opens (shared breathing component). Correlate screen time with mood entries. "On days you used your phone less than 3 hours, your mood averaged 7.2 vs 5.8." |
| **MyFast** | "Digital fast" concept: link phone-down sessions with eating windows. "While fasting, I'm also off my phone." Shared timer UI patterns. |
| **MyHabits** | "Under screen time goal" as a trackable daily habit. "Completed focus session" as a habit. Streak data shared. |
| **MyHealth** | Sleep quality correlation with evening screen time. "Your sleep score is 12% better on nights you put your phone down before 10pm." |
| **MyWorkouts** | Auto-start focus session during workout. "Gym Mode" whitelist (only music/podcast apps). |
| **MyJournal** | Post-session reflection entries can flow into journal. "Commitment contract" text stored as journal entries. |
| **Hub Dashboard** | Daily screen time summary card. Streak counter. Active session indicator. |
| **Hub Search** | Searchable sessions, badges, and insights via CrossModuleInterface. |
| **Hub Notifications** | Scrolling awareness, streak risk, accountability alerts routed through hub notification system. |

---

## 10-Star Experience Ladder

```
1-star:  See how much time you spend on your phone
3-star:  Set a goal, track daily, see weekly trends
5-star:  Focus sessions, app intentions, streak tracking, XP
7-star:  Badges, challenges, accountability partners, insights
8-star:  Peak hours heatmap, breathing pauses, personalized tips,
         bedtime wind-down, cross-module mood/sleep correlations
9-star:  The app makes you feel accomplished for NOT using your phone.
         Social accountability feels supportive, not judgmental.
         You genuinely reach for your phone less.
10-star: You forget the app exists because you no longer need it.
         Your relationship with technology is healthy by default.
         The app celebrates its own obsolescence.
```

Target at launch: 5-star (Phase 1 complete).
Target at Phase 2: 7-8 star.
Target at Phase 3: 9-star.

---

## Subscription Tier

| Tier | Features |
|------|----------|
| **Free** | Screen time tracking, daily goal, daily/weekly reports, 1 focus session per day, basic streak |
| **MyLife Pro** | Unlimited sessions, Beast Mode, app intentions, badges, challenges, accountability partners, insights, data export, scheduled sessions |

---

## Technical Considerations

### iOS
- **Screen Time API** (DeviceActivityMonitor framework, iOS 15+): Provides per-app usage data, supports app restrictions and scheduling.
- **FamilyControls** framework: Required for app blocking during focus sessions.
- **ManagedSettings** framework: Apply and remove app restrictions programmatically.
- **Requires entitlement:** `com.apple.developer.family-controls` (must be approved by Apple).

### Android
- **UsageStatsManager** (API 21+): Provides per-app usage data.
- **DevicePolicyManager** or **Accessibility Service**: For app blocking (significant Play Store policy considerations).
- **Digital Wellbeing API**: Limited but growing.

### Expo/React Native
- Native modules required for Screen Time API and UsageStatsManager.
- `expo-modules-api` for bridging native functionality.
- Focus session timer can use `expo-notifications` for foreground/background alerts.
- Background task for usage data collection: `expo-task-manager`.

### Data Freshness
- Screen time data refreshes when the module is foregrounded (pull from OS API).
- Background refresh via `expo-task-manager` every 30 minutes for notification accuracy.
- Historical data backfills on first launch (up to 7 days on iOS, 30 days on Android).
