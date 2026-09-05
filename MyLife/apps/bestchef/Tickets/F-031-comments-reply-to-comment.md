# Comments — reply to a comment

## Problem Statement

### Who is affected?
Anyone discussing a recipe.

### What is the current experience?
`comments/[submissionId].tsx` shows a flat list. There is no way to reply to a specific comment; @-mention is not a substitute because there is no notification path.

### Pain point
Multi-thread discussions devolve into chronological noise; chefs cannot answer specific questions in context.

---

## Desired Outcome

Each comment has a **Reply** action. Tapping opens the composer with the parent comment quoted. Replies render indented or threaded under the parent.

## Success Criteria

1. [ ] Reply action visible on every comment.
2. [ ] Reply post associates with the parent id.
3. [ ] Threads render with at least one level of indent or expandable thread view.
4. [ ] Reply count visible on the parent.

## Scope Boundaries

**In scope:** Single reply level (or expandable thread).

**Not in scope:** Deep nesting beyond 2 levels.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/comments/[submissionId].tsx`.

## Status

Done in P12-A (SHA 016301651, comments reply + edit/delete + persisted helpful).
