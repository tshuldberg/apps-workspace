# Profile — view the list of chefs I follow

## Problem Statement

### Who is affected?
Anyone following one or more chefs.

### What is the current experience?
`(tabs)/profile.tsx` shows a follower / following count pill (lines 353–357) but tapping it does nothing. There is no list of followed chefs.

### Pain point
Once a user follows a chef, the relationship is invisible and unmanageable; there is no easy way to revisit a followed chef's content or unfollow.

---

## Desired Outcome

Tapping the "Following" pill opens a list of every chef the user follows, with avatar, handle, and an unfollow action. Tapping a row routes to that chef detail.

## Success Criteria

1. [ ] Pill is interactive.
2. [ ] List loads followed chefs from the cloud.
3. [ ] Unfollow has confirmation; the count updates immediately.
4. [ ] Empty state explains how to find chefs to follow.
5. [ ] Followers count is similarly tappable to view followers (or explicitly hidden if privacy demands).

## Scope Boundaries

**In scope:** Following list. Followers list optional based on privacy decision.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/(tabs)/profile.tsx` lines 348–360.

## Status

Done in P13-B (SHA 25b7df91c, shareable public profile URL + followed chefs list).
