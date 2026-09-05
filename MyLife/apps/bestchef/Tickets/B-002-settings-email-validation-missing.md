# Settings — email recovery accepts malformed addresses before submitting

## Summary

The email field used for magic-link login and password recovery on `(tabs)/settings.tsx` does not validate format before invoking the cloud action.

## Current Behavior

A user types `notanemail` into the recovery email input and taps **Send link**. The app calls `requestEmailLink('notanemail')`, which then fails server-side. Depending on the network, the failure surfaces as a generic alert that does not point to the formatting issue. The local state still shows the bad value.

## Steps to Reproduce

1. Open Settings tab.
2. Enter `notanemail` (or any string without an @) into the email field.
3. Tap **Send link**.
4. Observe a delayed generic failure alert.

## Expected Behavior

Inline format check on blur or before submit. The submit button is disabled or the input shows a "Please enter a valid email" hint until the value matches a basic email regex. The cloud call is not made for known-invalid inputs.

## Actual vs Expected

| | Actual | Expected |
|---|--------|----------|
| What the user sees | spinner, generic error | inline hint, submit disabled |
| What the system does | calls cloud with garbage | rejects locally |

## Severity

- [x] **Minor** — error eventually surfaces; user can correct.

## Environment
- File: `app/(root)/(tabs)/settings.tsx`, line 162.

## Reproducibility
- [x] 100 %.

## Status

Done in P15-C (SHA e40daa8d3, settings + theme hardening bundle).
