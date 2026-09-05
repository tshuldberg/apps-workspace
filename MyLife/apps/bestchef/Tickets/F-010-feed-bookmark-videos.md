# Feed — bookmark a video to revisit later

## Problem Statement

### Who is affected?
Feed viewers.

### What is the current experience?
Bookmark button at `app/(root)/feed.tsx` line 287 routes to `/soon`. Users have no way to remember a specific video.

### Pain point
Discoverable videos are lost as soon as the user scrolls past them.

---

## Desired Outcome

Tapping the bookmark icon saves the video. A new "Bookmarks" section in `(tabs)/profile.tsx` (or Kitchen, where saved recipes live) lists every bookmarked video with thumbnail, dish name, and chef handle. Tapping a bookmark replays the video.

---

## Success Criteria

1. [ ] Bookmark toggles on tap; state persists across launches.
2. [ ] Bookmarks list is reachable from the profile tab.
3. [ ] Removing a bookmark from the list updates the icon in the feed.
4. [ ] Bookmark count visible on the profile.

## Scope Boundaries

**Not in scope:** Folder/category organisation of bookmarks.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/feed.tsx` line 285. Likely a new `bestchef_bookmarks` table.

## Status

Done 2026-07-04 (commit `c11594e1`, plan 33 Phase 5.6).

History: Reopened 2026-07-03 (adversarial production review) because the P4-A claim (SHA 238177c7d "closes F-007..F-011") over-counted; at that point the video-feed bookmark button routed to `/soon` and the vote-card bookmark wrote only a device-local SQLite JSON setting that never reached the cloud (lost on reinstall). That reopen was correct.

Genuinely closed 2026-07-04: bookmarks now persist to the cloud `bc_saved_submissions` table (RLS, migration `20260704000001_bestchef_saved_submissions.sql`) with an optimistic local mirror (`rc_saved_submissions_cache`, module migration V32) and a pending-op queue swept on foreground. `feed.tsx` `handleBookmarkPress` calls `toggleSaved` (`app/(root)/data/saved-submissions.ts`): local cache updates instantly, the cloud write follows, so saved state survives reinstall. Folder/category organisation remains out of scope.
