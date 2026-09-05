# MyPresence — Module Audit

**ID:** presence | **Prefix:** pr_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Put your phone down. Pick your life up.

## User Value
- Daily + per-app usage tracking with categories (14 taxonomy) and pickup counts
- Focus sessions (solo/group/beast) with planned vs actual minutes and post-session rating
- Goal setting + XP + levels + streaks + badges + accountability partners + rewards
- Intention prompts before opening an app; session whitelist for allowed interruptions
- Scheduled recurring sessions + commitment contracts + breathing pauses + reflections

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Daily usage upsert + range | src/db (daily_usage) | shipped |
| Per-app usage + top apps | src/db (app_usage) | shipped |
| Goals (daily_minutes, effective_date) | src/db (goals) | shipped |
| Focus sessions (solo/group/beast, completed, rating) | src/db (focus_sessions) | shipped |
| Session whitelist | src/db (session_whitelist) | shipped |
| App intentions (upsert + deactivate) | src/db (app_intentions) | shipped |
| App opens + per-open rating | src/db (app_opens) | shipped |
| Scheduled sessions (V2, recurring) | src/db (scheduled_sessions) | shipped |
| Badges (V2) | src/db (badges) + engines | shipped |
| Accountability partners (V2, share code, revoke) | src/db (accountability_partners) | shipped |
| Rewards (V2, milestones, evaluated) | src/db (rewards) + engines | shipped |
| Commitment contracts (V2) | src/db (commitment_contracts) | shipped |
| XP log + award + total + per-date | src/db (xp_log) | shipped |
| Streak calculation + at-risk detection | src/engines (calculateStreaks) | shipped |
| XP + level engine + level titles | src/engines (calculateXP, getLevelForXP) | shipped |
| Daily + weekly summaries | src/engines (buildDailySummary, buildWeeklySummary) | shipped |
| Category breakdown | src/engines (buildCategoryBreakdown) | shipped |
| Insight engine (weekend, morning-pickup, session-time-of-day, goal-regression) | src/engines (generatePresenceInsights) | shipped |
| Badge definitions + progress + snapshots | src/engines (BADGE_DEFS, syncBadges) | shipped |
| Reward evaluation + progress + sync | src/engines (evaluateRewards, syncRewards) | shipped |
| Recommendations engine | src/engines (buildPresenceRecommendations) | shipped |
| App library (known-app metadata) | src/data/app-library | shipped |
| CSV export (daily usage, app usage, sessions) | src/export | shipped |
| Cross-module hook | src/cross-module.ts | shipped |

## Data Model
Prefix `pr_`, schema v2. V1 tables: pr_settings, pr_daily_usage, pr_app_usage, pr_goals, pr_sessions, pr_session_whitelist, pr_app_intentions, pr_app_opens, pr_xp_log. V2 tables: pr_scheduled_sessions, pr_badges, pr_accountability_partners, pr_rewards, pr_commitment_contracts.

## Screens / User Flows
Mobile tabs: Home, Stats, Sessions, Settings. Stack screens: onboarding, hub (discover), intentions, intention-prompt, session-active, session-complete, scheduled, accountability, rewards, commitment, breathing-pause, reflection, badges, insights, report. 17 mobile route files, 16 web route files.

## Distinctive / Moat-worthy
- Accountability partner system via share codes — rare in consumer screen-time apps
- Commitment contracts (stakes + deadlines) pair with rewards and streak-at-risk logic
- Insight detectors (weekend pattern, morning-pickup trend, session-time-of-day, goal regression) ship as pure functions

## Gaps vs competitors
- No system-level app blocking on iOS (requires Screen Time APIs + Family Controls entitlement)
- No Opal-style pay-to-unblock monetization layer
- Usage numbers depend on user input or OS-level APIs not verified in module source

## Investor-facing hook
Opal + Forest + One Sec + Freedom + Jomo — unified, privacy-first, with accountability partners and commitment contracts built in.
