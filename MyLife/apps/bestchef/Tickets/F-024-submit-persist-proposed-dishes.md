# Submit — proposed dishes persist into the public dish catalog

## Problem Statement

### Who is affected?
Users submitting a recipe for a dish that does not yet exist in the dish catalog.

### What is the current experience?
`app/(root)/submit.tsx` line 263 generates a temporary id `new-${Date.now()}` for proposed dishes. The id is never reconciled with a public dish entity; subsequent submissions of the same dish from other users will create yet another temp id, fragmenting the catalog.

### Pain point
A submission appears under a one-off dish that no other user can find. The leaderboard, dish browser, and competitive layer break.

---

## Desired Outcome

When a user proposes a new dish, the app calls a server endpoint that either creates a moderation-pending dish entity or links to an existing one (fuzzy match by name and cuisine). The submission stores the cloud dish id, not a temp id.

## Success Criteria

1. [ ] Proposed dish persists to the cloud catalog (pending or live, depending on moderation policy).
2. [ ] Submissions reference a cloud dish id.
3. [ ] Duplicate proposals are detected (same name + cuisine) and unified.
4. [ ] If moderation is required, the submission is hidden from public surfaces until the dish is approved.
5. [ ] If the cloud call fails, the submission is queued and retried; user is informed.

## Scope Boundaries

**In scope:** Cloud writes for proposed dishes.

**Not in scope:** Building a moderation admin UI from scratch (table-stakes endpoint only).

## Business Case
- [x] **Must have** — the catalog cannot be the source of truth without this.

## Technical Context
File: `app/(root)/submit.tsx` line 240–270 (proposed dish flow).

## Status

Done in P11-A (SHA ab99fa614, submit cloud retry queue + proposed dish persistence).
