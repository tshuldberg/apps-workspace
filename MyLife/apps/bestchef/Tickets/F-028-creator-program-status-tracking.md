# Creator program — track application status in-app

## Problem Statement

### Who is affected?
Applicants to the creator program.

### What is the current experience?
After tapping Apply, the user has no in-app way to confirm their application was received or to check progress. (Depends on F-027 landing first.)

### Pain point
Applicants nag the team for status; team has no central place to communicate decisions.

---

## Desired Outcome

The creator program screen shows the user's most recent application status (Submitted, Under review, Approved, Declined, More info needed). Each state explains next steps. Approved unlocks creator features.

## Success Criteria

1. [ ] Status visible without leaving the app.
2. [ ] Each state has an actionable next step (or none, where appropriate).
3. [ ] Status updates reach the user's device (poll or push).
4. [ ] Approved status unlocks creator-only surfaces (analytics, monetization tab) — gating is server-truth.

## Scope Boundaries

**Not in scope:** Reviewer-side admin tools.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/creator-program.tsx`. Builds on F-027.

## Status

Done in P13-D (SHA fe7110693, creator program backend application + status tracking).
