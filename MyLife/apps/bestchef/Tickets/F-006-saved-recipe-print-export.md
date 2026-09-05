# Saved recipe — print or export to PDF / text

## Problem Statement

### Who is affected?
Users who want to share a recipe outside the app or hold a paper copy in the kitchen.

### What is the current experience?
`saved-recipe/[id].tsx` has no export. The only way to get a recipe out of the app is to screenshot it.

### Pain point
Sharing recipes with non-app users (family group threads, paper recipe binders) is impossible.

---

## Desired Outcome

An **Export** action on saved recipes opens the system share sheet with options to print, save as PDF, or share as plain text. Output includes title, attribution, ingredients, steps, optionally photo.

---

## User Scenarios

### Scenario 1 — Print
- **What they do:** Tap **Export** → **Print**.
- **What they expect:** System print dialog with a clean recipe layout.

### Scenario 2 — Plain-text share
- **What they expect:** Recipe rendered as plain text suitable for SMS / email.

---

## Success Criteria

1. [x] Export action accessible from saved recipe detail.
2. [x] Output includes title, ingredients, steps, optional hero photo.
3. [x] PDF layout is readable on letter and A4 paper.
4. [x] Plain-text version contains no markup.

## Completion Notes

- Added an Export action to saved recipe detail with Print / Save PDF, Share PDF, and Plain Text options.
- Added an app-local export helper that renders saved recipes to clean printable HTML and markup-free plain text.
- Included recipe title, source attribution, original URL when present, hero photo when present, metadata, ingredients, and instructions.
- Added focused export helper coverage and UIUX contract checks.

## Scope Boundaries

**Not in scope:** Sharing community submissions (those have a separate share flow).

## Business Case
- [x] **Nice to have**

## Technical Context
- Use `expo-print` for PDF; React Native `Share` for plain text.
- File: `app/(root)/saved-recipe/[id].tsx`.

## Status

Done in pre-areblaze workstream (see docs/sessions/2026-04-27-bestchef-f006-saved-recipe-export.md).
