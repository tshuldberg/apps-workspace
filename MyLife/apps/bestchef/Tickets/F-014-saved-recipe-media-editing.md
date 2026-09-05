# Saved recipe — add, replace, or remove media

## Problem Statement

### Who is affected?
Users with saved recipes who want to attach a hero photo, step photos, or a cooking video.

### What is the current experience?
The MediaSlot on `app/(root)/saved-recipe/[id].tsx` line 165 routes to `/soon?feature=Saved recipe media editing`. There is no way to add, swap, or delete media on a saved recipe.

### Pain point
Saved recipes feel half-built; users cannot keep their own visual cues with the recipe.

---

## Desired Outcome

Tapping the media slot opens a sheet with **Take photo**, **Choose from library**, **Replace**, **Remove**. Media is persisted with the saved recipe and shown on the detail screen.

## Success Criteria

1. [ ] Camera and library pickers function on iOS and Android.
2. [ ] Multiple photos supported; reorderable.
3. [ ] Removing media clears the field with confirmation.
4. [ ] Media URIs survive a relaunch.
5. [ ] If permissions denied, a clear error is shown with a path to settings.

## Scope Boundaries

**Not in scope:** Server upload to cloud storage (separate ticket if needed).

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/saved-recipe/[id].tsx` line 158–168. `expo-image-picker` already used in `submit.tsx`.

## Status

Done in P14-A (SHA b2a6760f0, saved recipe media editing).
