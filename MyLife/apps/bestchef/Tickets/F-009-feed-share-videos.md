# Feed — share a video via the system share sheet

## Problem Statement

### Who is affected?
Viewers who want to share videos out of the app.

### What is the current experience?
Share button at `app/(root)/feed.tsx` line 282 routes to `/soon`. There is no way to share videos.

### Pain point
Word-of-mouth distribution is impossible.

---

## Desired Outcome

Tapping the share icon opens the system share sheet with a deep link to the video (and a fallback web link), the dish name, and the chef handle.

---

## Success Criteria

1. [ ] Share opens the OS share sheet within ~300 ms.
2. [ ] Payload includes a deep link to `/feed?videoId=...` and a public web URL fallback.
3. [ ] Sharing does not pause playback unexpectedly when the sheet is dismissed.
4. [ ] Telemetry (or local persistence) records the share for engagement metrics.

## User Scenarios
- **Happy path:** Share to Messages → recipient opens link → BestChef opens to that video (or App Store if not installed).
- **Edge:** Share when offline — deep link still copies to clipboard; system sheet still opens.

## Scope Boundaries

**Not in scope:** Server-rendered preview cards (Open Graph) — separate ticket.

## Business Case
- [x] **Should have**

## Technical Context
React Native `Share`, `expo-linking`. File: `app/(root)/feed.tsx` line 279.

## Status

Done in P4-A (SHA 238177c7d, FullScreenSubmissionCard Reels-style closes F-007..F-011).
