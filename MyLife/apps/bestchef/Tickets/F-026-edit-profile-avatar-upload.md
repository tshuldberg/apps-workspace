# Edit profile — upload avatar to cloud storage

## Problem Statement

### Who is affected?
Anyone setting an avatar.

### What is the current experience?
`edit-profile.tsx` line 86 stores the avatar as a local URI in SQLite. The image is never uploaded; other users see the default avatar; the user's own image disappears on app reinstall.

### Pain point
The avatar is functionally device-local. Public profile and comment threads always render the default.

---

## Desired Outcome

When the user picks an avatar, the file is uploaded to cloud storage. The cloud URL is stored on the profile and rendered everywhere a chef avatar appears (profile tab, chef detail, comments, leaderboard, feed).

## Success Criteria

1. [ ] Picking an avatar uploads to cloud storage with progress indication.
2. [ ] Failure shows an error and offers retry; existing avatar is preserved.
3. [ ] Cloud URL replaces the local URI in the profile record.
4. [ ] Avatar is visible to other users on chef detail and comments within seconds of upload.
5. [ ] On reinstall, the avatar is recovered from the cloud.

## Scope Boundaries

**In scope:** Upload, persistence, rendering across the app.

**Not in scope:** Avatar cropping editor.

## Business Case
- [x] **Must have**

## Technical Context
File: `app/(root)/edit-profile.tsx`. Use Supabase Storage per CLAUDE.md cloud guidance.

## Status

Done in P13-C (SHA b6c1ba3dd, handle uniqueness + avatar upload).
