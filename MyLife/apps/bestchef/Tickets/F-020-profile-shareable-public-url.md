# Profile — shareable public profile URL

## Problem Statement

### Who is affected?
Chefs who want to share their profile externally.

### What is the current experience?
No share action on the profile tab. There is no public web URL for a profile.

### Pain point
Creators cannot link their profile from social bios, Instagram links, or word-of-mouth.

---

## Desired Outcome

A **Share** action on `(tabs)/profile.tsx` opens the system share sheet with a deep link (and a public web URL fallback) to the user's profile. The link works without an account.

## Success Criteria

1. [ ] Share action visible on own profile.
2. [ ] Link opens to the chef's public detail in-app or, on web, to a public profile page.
3. [ ] Profile is visible even to logged-out viewers (if privacy settings allow).
4. [ ] Privacy toggle in Settings can disable sharing.

## Scope Boundaries

**Not in scope:** Custom vanity URLs.

## Business Case
- [x] **Nice to have**

## Technical Context
File: `app/(root)/(tabs)/profile.tsx`.

## Status

Done in P13-B (SHA 25b7df91c, shareable public profile URL + followed chefs list).
