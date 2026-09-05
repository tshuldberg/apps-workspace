# Settings — show confirmation feedback after a setting saves

## Problem Statement

### Who is affected?
Anyone changing settings.

### What is the current experience?
On `(tabs)/settings.tsx`, most settings (zip code line 235, default location 282, chef origin 314, notifications 330) save silently when the field loses focus or the toggle changes. There is no visible confirmation; the user has no signal that their change was persisted.

### Pain point
Users repeatedly re-enter values, unsure whether the previous attempt saved.

---

## Desired Outcome

After every successful save, a brief toast (or inline saved indicator) confirms the change. Failures show a clear error and revert the UI to the previous value.

## Success Criteria

1. [ ] Every setting that persists shows a confirmation within 500 ms.
2. [ ] Failures revert the UI and show a retry-able error.
3. [ ] No double toasts when multiple fields save in quick succession (debounce).

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/(tabs)/settings.tsx`.

## Status

Done in P15-C (SHA e40daa8d3, settings + theme hardening bundle).
