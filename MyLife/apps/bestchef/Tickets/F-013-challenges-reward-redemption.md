# Challenges — redeem rewards for completed challenges

## Problem Statement

### Who is affected?
Users who complete challenges (depends on F-012).

### What is the current experience?
No reward redemption exists. Even if F-012 lands, completed challenges have nothing to claim.

---

## Desired Outcome

When a challenge completes, the user sees a **Claim reward** affordance. Rewards may be a badge, a creator-program credit, or a feature unlock. Claimed rewards are recorded on the profile and reflected in the badges grid.

## Success Criteria

1. [ ] Completed challenges show a claim CTA exactly once per user per challenge.
2. [ ] Reward is recorded server-side and reflected in the profile badges.
3. [ ] Re-claiming after a successful redemption is a no-op (no duplicate awards).
4. [ ] Unclaimed rewards never expire silently — user sees an expiry timer.

## Scope Boundaries

**In scope:** UI flow + idempotent claim API.

**Not in scope:** Monetary rewards; full creator-program payout system.

## Business Case
- [x] **Should have** — incentive layer for the social product.

## Technical Context
Builds on F-012. Profile `BadgePlaceholder` at `(tabs)/profile.tsx` line 56 already exists for display.

## Status

Done in P13-E (SHA d29a4f2e7, challenges interactive cards + reward redemption).
