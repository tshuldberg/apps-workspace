# Feed — comment on videos

## Problem Statement

### Who is affected?
Viewers and creators in the video feed.

### What is the current experience?
Comment button at `app/(root)/feed.tsx` line 276 routes to `/soon`. No commenting on video content; the existing comments thread (`comments/[submissionId].tsx`) is reachable only from submission detail, never from the feed.

### Pain point
Conversation cannot start where the content is consumed; creators get no community signal from feed views.

---

## Desired Outcome

Tapping the comment icon opens a comment sheet anchored to the video's underlying submission. Posting a comment writes to the same store as `comments/[submissionId].tsx`. Viewing existing comments shows the same thread.

---

## User Scenarios

### Scenario 1 — New comment
- **What they do:** Open feed, tap comment, type "Trying this tomorrow", post.
- **What they expect:** Comment appears in the sheet and on the submission detail comments screen.

### Scenario 2 — Read-only when no submission
- **What they expect:** If a feed video has no associated submission, the comment button is hidden or disabled with a tooltip.

---

## Success Criteria

1. [ ] Comment icon opens an in-feed comment sheet without leaving the video.
2. [ ] Posted comments appear in `comments/[submissionId].tsx`.
3. [ ] Comment count on the icon reflects backend truth.
4. [ ] User can dismiss the sheet and return to playback at the same position.

## Scope Boundaries

**Not in scope:** Replies (F-031), edit/delete (F-032).

## Business Case
- [x] **Should have**

## Technical Context
- `feed.tsx` line 273; reuse `getCommentsForSubmission` etc. from cloud provider.

## Status

Done 2026-07-04 (commit `c11594e1`, plan 33 Phase 5.6).

History: Reopened 2026-07-03 (adversarial production review) because the P4-A claim (SHA 238177c7d "closes F-007..F-011") over-counted; at that point the video-feed comment button still routed to `/soon` and the feed viewmodel hardcoded `comments: 0`. That reopen was correct.

Genuinely closed 2026-07-04: `feed.tsx` `handleCommentsPress` now routes to `/comments/[submissionId]` (the same cloud comments surface the vote card uses), and the feed comment count reads real cloud truth via `video.commentCount` (`app/(root)/data/cloud-videos.ts`), not a hardcoded zero. Replies (F-031) and edit/delete (F-032) remain out of scope.
