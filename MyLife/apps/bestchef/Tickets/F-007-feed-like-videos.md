# Feed - like videos and persist the count

## Problem Statement

### Who is affected?
Anyone using the video feed (`app/(root)/feed.tsx`).

### What is the current experience?
The Like button at line 270 routes to `/soon?feature=Video likes`. No like count is shown, no engagement is recorded, and the chef receives no signal.

### Pain point
A core social signal is non-functional. Engagement metrics that drive ranking and creator-program eligibility cannot be earned.

---

## Desired Outcome

Tapping the heart icon toggles a like. The icon fills, a count next to it increments locally and syncs to the cloud. The count survives a relaunch and is visible to the chef on their submission detail.

---

## User Scenarios

### Scenario 1 — Like and persist
- **What they do:** Like a video.
- **What they expect:** Heart fills, count increments, the like persists on next app launch.

### Scenario 2 — Unlike
- **What they expect:** Tapping again unfills, decrement; persists.

### Scenario 3 — Offline
- **What they expect:** Like succeeds optimistically; queued for sync; survives a force-quit.

---

## Success Criteria

1. [x] Heart icon toggles state on every tap.
2. [x] Like count is the cloud-truth count, not a local-only counter.
3. [x] One user counts only once per video, regardless of taps.
4. [x] Likes survive offline → online transitions.
5. [x] Submission detail (`recipe/[id].tsx`) reflects the same like count.

## Completion Notes

- Added server-backed submission likes with a unique one-like-per-profile table, `bc_submissions.like_count`, count refresh trigger, RLS policies, and read/write RPCs.
- Added app-local like state and queue tables for optimistic toggles, offline survival, relaunch persistence, and out-of-order cloud response protection.
- Replaced the feed heart placeholder with a real toggle that resolves demo/local submissions to hosted rows when possible and displays the persisted count.
- Added matching submission-detail heart/count state so `recipe/[id].tsx` reflects the same cached/cloud count.
- Added focused app, module, schema, sync policy, and pgTAP coverage for the like model.

## Scope Boundaries

**In scope:** Toggle, optimistic UI, cloud sync, offline queue.

**Not in scope:** Like notifications to the chef (separate ticket).

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/feed.tsx` line 268. Same like model should support submission detail engagement.

## Status

Done in P4-A (SHA 238177c7d, FullScreenSubmissionCard Reels-style closes F-007..F-011).
