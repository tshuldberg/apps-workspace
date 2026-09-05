# Profile — populate the Signature Dishes section

## Problem Statement

### Who is affected?
Profile viewers, both the user themselves and visiting users.

### What is the current experience?
`app/(root)/(tabs)/profile.tsx` lines 369–374 show a "Signature Dishes" header with a trophy icon and placeholder text. There is no underlying data model; the section is empty by design.

### Pain point
A primary chef-identity surface is empty. Visiting chefs cannot see what someone is known for.

---

## Desired Outcome

The user can pick up to N (suggested 3) of their submissions to mark as Signature. The section on the profile renders these as cards with dish, votes, and submission date. Visitors see the same cards on `chef/[id].tsx`.

## Success Criteria

1. [ ] **Edit signature dishes** action appears on the user's own profile.
2. [ ] Picker lists user's submissions and lets them choose up to 3.
3. [ ] Selected dishes render in the Signature Dishes section.
4. [ ] Same data is visible on the public chef detail screen.
5. [ ] If no signatures, an actionable empty state ("Pick a signature dish") is shown on own profile; visitors see "No signatures yet".

## Scope Boundaries

**In scope:** Selection UI, persistence, rendering on profile and chef detail.

**Not in scope:** Algorithmic auto-pick.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/(tabs)/profile.tsx` lines 369–374; `chef/[id].tsx` for visitor view.

## Status

Done in P13-A (SHAs 68dc27430 + 0d538dfc3, signature dishes + cookproof error state).
