# Feed — open the chef profile from a video

## Problem Statement

### Who is affected?
Feed viewers wanting to follow or explore a chef they discovered.

### What is the current experience?
Chef handle at `app/(root)/feed.tsx` line 254 routes to `/soon?feature=Chef video profile`. There is a working chef detail screen at `chef/[id].tsx` — feed simply does not link to it.

### Pain point
Discovery is dead-ended at the video; no path to follow or browse a chef's other dishes.

---

## Desired Outcome

Tapping the chef handle / avatar overlay on a feed video routes to `chef/[chefId]`. Playback pauses; on back-navigation, playback resumes from where it left off.

## Success Criteria
1. [ ] Tapping the chef handle routes to the existing chef detail.
2. [ ] Video playback pauses when leaving and resumes on return.
3. [ ] If a video has no associated chef id, the handle is non-interactive (no broken link).

## Scope Boundaries
**In scope:** Routing only. Chef profile already exists.

## Business Case
- [x] **Must have** — trivial fix that re-opens the discovery loop.

## Technical Context
File: `app/(root)/feed.tsx` line 252; replace `/soon` push with `router.push('/chef/' + video.chefId)`.

## Status

Done in P4-A (SHA 238177c7d, FullScreenSubmissionCard Reels-style closes F-007..F-011).
