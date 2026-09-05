# Theme editor — save named custom themes that survive a relaunch

## Problem Statement

### Who is affected?
Users customizing the theme.

### What is the current experience?
`theme-editor.tsx` line 287–290 calls `setTheme('custom', draft)` and routes back. The draft is applied to the running app but only the most recent custom theme is remembered; users cannot maintain multiple custom themes, and there is no name attached. Reopening the editor seeds from the last preset chosen.

### Pain point
Users lose their work when experimenting; cannot keep a "morning light" and a "night dark" of their own design.

---

## Desired Outcome

The Save action prompts for a name. Saved themes appear in `theme-browser.tsx` alongside presets. Users can rename, duplicate, and delete their custom themes.

## Success Criteria

1. [ ] Save names the theme; uniqueness checked locally.
2. [ ] Saved themes are listed in the browser with a "Custom" label.
3. [ ] Apply, rename, duplicate, delete each work.
4. [ ] Deleting the active theme reverts to the default preset gracefully.

## Scope Boundaries

**Not in scope:** Cloud sync of custom themes (covered partly by F-030 share/import).

## Business Case
- [x] **Should have**

## Technical Context
Files: `app/(root)/theme-editor.tsx`, `app/(root)/theme-browser.tsx`, `app/(root)/providers/AppThemeProvider.tsx`.

## Status

Done in P15-C (SHA e40daa8d3, settings + theme hardening bundle).
