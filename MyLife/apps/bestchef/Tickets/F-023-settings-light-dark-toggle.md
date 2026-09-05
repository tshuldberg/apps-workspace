# Settings — toggle dark / light mode inline

## Problem Statement

### Who is affected?
Users who prefer a different color scheme.

### What is the current experience?
Themes are browsable in `theme-browser.tsx` and editable in `theme-editor.tsx`, but there is no quick light / dark toggle in `(tabs)/settings.tsx` or anywhere else. The hub defaults to a dark Obsidian Noir.

### Pain point
A common user expectation — switch to light mode for daytime kitchen use — is not directly available.

---

## Desired Outcome

Settings shows a **Appearance** row with three options: System, Light, Dark. Selection applies immediately and persists. Theme editor remains available for power users.

## Success Criteria

1. [ ] Selection applies on tap, no relaunch required.
2. [ ] System default tracks OS-level preference live.
3. [ ] Choice survives a relaunch.
4. [ ] Custom theme (from `theme-editor`) is preserved as a fourth option once saved.

## Scope Boundaries

**Not in scope:** Per-screen overrides.

## Business Case
- [x] **Nice to have**

## Technical Context
Files: `app/(root)/(tabs)/settings.tsx`, `app/(root)/providers/AppThemeProvider.tsx`.

## Status

Done in P15-C (SHA e40daa8d3, settings + theme hardening bundle).
