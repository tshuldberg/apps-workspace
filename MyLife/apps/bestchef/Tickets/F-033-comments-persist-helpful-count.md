# Comments — persist Mark Helpful counter to the backend

## Problem Statement

### Who is affected?
Comment readers and chefs trying to surface useful tips.

### What is the current experience?
`comments/[submissionId].tsx` line 102–108 increments a local-only `helpfulCount`. The count is per-device and resets on reload. No de-duplication of repeated taps.

### Pain point
The signal is meaningless — it cannot drive sort order or tip surfacing.

---

## Desired Outcome

Mark Helpful toggles a per-user state on the backend. The displayed count is the cloud truth. Same user cannot inflate it.

## Success Criteria

1. [ ] Tap toggles a per-user helpful flag server-side.
2. [ ] Count survives a relaunch and is consistent across devices.
3. [ ] User cannot increment more than once.
4. [ ] Counter is used to sort comments (default: helpful first) once F-031 lands.

## Business Case
- [x] **Must have** — current behavior is misleading.

## Technical Context
File: `app/(root)/comments/[submissionId].tsx` line 102–108.

## Status

Done in P12-A (SHA 016301651, comments reply + edit/delete + persisted helpful).
