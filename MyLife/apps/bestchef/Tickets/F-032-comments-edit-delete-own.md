# Comments — edit or delete my own comments

## Problem Statement

### Who is affected?
Anyone who has commented on a submission.

### What is the current experience?
Comments are append-only. A typo or regretted comment can only be reported (which targets others' comments) — no edit, no delete for the author.

### Pain point
Users self-censor or post nothing rather than risk a permanent typo.

---

## Desired Outcome

A comment authored by the current user shows **Edit** and **Delete** actions. Edit opens an inline composer; Delete confirms then removes (or tombstones server-side).

## Success Criteria

1. [ ] Edit and Delete only appear on the user's own comments.
2. [ ] Edit updates the comment in place; an "edited" tag appears.
3. [ ] Delete removes the comment from the thread; replies (per F-031) survive with "comment deleted" placeholder.
4. [ ] Cannot edit a comment older than N hours (configurable; sensible default 24h) — server-enforced.

## Scope Boundaries

**Not in scope:** Edit history view.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/comments/[submissionId].tsx`.

## Status

Done in P12-A (SHA 016301651, comments reply + edit/delete + persisted helpful).
