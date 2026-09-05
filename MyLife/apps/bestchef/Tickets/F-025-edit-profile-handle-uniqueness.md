# Edit profile — validate handle uniqueness against the cloud

## Problem Statement

### Who is affected?
Users picking or changing their `@handle`.

### What is the current experience?
`edit-profile.tsx` saves the handle to the local SQLite store with no uniqueness check. Two users on different devices can pick the same handle. There is no live availability check.

### Pain point
Public-facing identity is duplicate-prone; share links and mentions become ambiguous.

---

## Desired Outcome

As the user types a handle, the app checks availability against the server. The field shows "Available" / "Taken" / "Checking…". Save is blocked when "Taken". Once saved, the handle is reserved server-side.

## Success Criteria

1. [ ] Availability check fires on debounce while typing.
2. [ ] Reserved handle states are surfaced clearly.
3. [ ] Save is disabled when the handle is taken or invalid.
4. [ ] Handle changes propagate to all surfaces (profile, comments, submissions).
5. [ ] Recently-released handles have a cooldown (server-side).

## Scope Boundaries

**Not in scope:** Reserved-word lists; brand-protection workflow.

## Business Case
- [x] **Must have** — public identity correctness.

## Technical Context
File: `app/(root)/edit-profile.tsx`. Cloud provider must expose handle reservation.

## Status

Done in P13-C (SHA b6c1ba3dd, handle uniqueness + avatar upload).
