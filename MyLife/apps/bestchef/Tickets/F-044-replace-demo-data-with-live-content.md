# App-wide — replace `DEMO_*` fixtures with live cloud content

## Problem Statement

### Who is affected?
Every public user, every social/competitive surface.

### What is the current experience?
`DEMO_DISHES`, `DEMO_CHEFS`, `DEMO_BADGES`, `DEMO_CHALLENGES`, `DEMO_SUBMISSIONS`, and `getDemoCommentsForSubmission()` are imported directly into:
- `(tabs)/index.tsx` (line 27, 34) — Home trending list
- `(tabs)/dishes.tsx` (line 16, 50–56) — Dish browser
- `(tabs)/leaderboard.tsx` (lines 53–62) — Rankings
- `(tabs)/profile.tsx` (line 20, 381) — Badges
- `dish/[id].tsx` (lines 18–67) — Dish detail submissions
- `chef/[id].tsx` (lines 16–21, 167) — Chef detail and badges
- `recipe/[id].tsx` (lines 86–109, 206–208) — Sample ingredients/steps fallback
- `feed.tsx` (lines 30–34) — Video feed
- `challenges.tsx` (line 16) — Challenges list
- `comments/[submissionId].tsx` (lines 38–42) — Comments
- `submit.tsx` (line 103) — Dish picker source

The cloud provider (`BestChefCloudProvider`) exists but is gated by `cloud.isReady && cloud.profile`, with no graceful fallback path that distinguishes demo from live.

### Pain point
Public-launch users see demo content as if it were real. Engagement actions (vote, comment, like) cannot move the needle because the fixtures don't update. The competitive premise of the app cannot function until live data is wired everywhere.

---

## Desired Outcome

Every screen that today reads from a `DEMO_*` import reads from the cloud provider. Demo data is gated behind a single dev / preview flag and never appears in a release build. When the cloud provider is offline, screens show a clear "no connection" state rather than fixture content.

## Success Criteria

1. [ ] Production builds contain zero references to `DEMO_*` fixtures or `shouldShowDemoContent()` returning true.
2. [ ] Each surface above is wired to the relevant cloud query (dishes, submissions, badges, comments, challenges, videos).
3. [ ] Loading and error states are present on every surface.
4. [ ] An explicit dev-only flag (`__DEV__` + env var) re-enables fixtures for local development.
5. [ ] No silent fallback from "cloud failed" to "demo data".

## Scope Boundaries

**In scope:** Wiring existing cloud APIs to existing UIs. Identification of any missing cloud endpoints (treated as sub-tickets).

**Not in scope:** Building new endpoints from scratch (each missing endpoint becomes its own ticket as discovered).

## Business Case
- [x] **Must have** — public launch readiness.

Per `CLAUDE.md`: "BestChef public launch readiness must use a standard server-backed path for public users." Demo data is a direct violation of that rule on the read path.

## Technical Context
- Cloud provider: `app/(root)/providers/BestChefCloudProvider.tsx`.
- Demo source files imported from `@mylife/bestchef`.
- A migration order makes sense: Home → Dishes → Leaderboard → Submissions → Comments → Profile → Feed → Challenges.

**Related tickets:** every other feature that depends on live data (F-007 through F-013, F-024, F-037) is implicitly blocked or partially blocked on this ticket.

## Status

Done in P15-D (SHA 8d6e898c9, trust-and-safety report fallback + DEMO removal audit). Carry-over follow-ups filed: F-045 (discover endpoint), F-046 (feed videos endpoint), F-047 (dish catalog endpoint).
