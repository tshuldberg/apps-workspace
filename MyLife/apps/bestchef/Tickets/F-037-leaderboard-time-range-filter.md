# Leaderboard — filter rankings by time range

## Problem Statement

### Who is affected?
Anyone reading the leaderboard.

### What is the current experience?
`(tabs)/leaderboard.tsx` shows only an all-time ranking sourced from `DEMO_DISHES`. There is no time selector.

### Pain point
Trending vs all-time vs this-week is the core utility of a leaderboard. Users cannot answer "what's hot now".

---

## Desired Outcome

Above the rankings, a segmented control: **Today / This week / This month / All time**. Selection refetches the leaderboard for that window. Trending tab uses the same window.

## Success Criteria

1. [ ] Selector visible and accessible without scrolling.
2. [ ] Selection refetches data; loading state shown.
3. [ ] All-time is the default for first run.
4. [ ] Selected window persists per session.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/(tabs)/leaderboard.tsx`. Depends on F-044 (live data) for non-fixture results.

## Status

Done in P15-A (SHA df2041df4, leaderboard time-range filter + pull-to-refresh fix).
