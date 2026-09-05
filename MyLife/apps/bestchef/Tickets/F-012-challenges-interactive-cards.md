# Challenges — open challenge detail and track participation

## Problem Statement

### Who is affected?
All users on `app/(root)/challenges.tsx`.

### What is the current experience?
Challenges screen lists hardcoded `DEMO_CHALLENGES` cards (line 16). Cards have no `onPress` (lines 45–64). The progress bar width is hardcoded to `'0%'` (line 58). There is no detail view, no enrolment, no completion mechanic.

### Pain point
The Challenges feature is decorative; nothing about it is functional.

---

## Desired Outcome

Each challenge card opens a detail screen describing the challenge, eligibility, end date, and reward. The user can **Join** a challenge; the screen shows their progress (e.g., 2 of 5 submissions). Joining and progress are persisted; progress increments automatically when matching submissions are made.

---

## User Scenarios

### Scenario 1 — Join and progress
- **What they do:** Open Spring Soup Challenge, tap **Join**, submit a soup recipe.
- **What they expect:** Progress bar advances from 0/5 to 1/5; challenge appears in a "Joined" section on the profile.

### Scenario 2 — Completion
- **What they expect:** On hitting target, badge unlocks (or notification fires) and progress shows complete.

---

## Success Criteria

1. [ ] Challenges sourced from cloud, not `DEMO_CHALLENGES`.
2. [ ] Tapping a card opens a detail route.
3. [ ] **Join** is idempotent and persists across launches.
4. [ ] Progress reflects backend truth, not 0%.
5. [ ] Completed challenges are clearly distinguished.
6. [ ] User can leave a challenge before completion.

## Scope Boundaries

**In scope:** Detail screen, join/leave, progress display.

**Not in scope:** Reward redemption (F-013); admin-side challenge creation.

## Business Case
- [x] **Must have** — feature today is non-functional.

## Technical Context
File: `app/(root)/challenges.tsx`. Will need cloud schema for challenges and user enrolment.

## Status

Done in P13-E (SHA d29a4f2e7, challenges interactive cards + reward redemption).
