# Settings — app version label hardcoded to 1.0.0

## Summary

The "About" section on Settings displays a hardcoded `1.0.0` regardless of the actual build version.

## Current Behavior

`app/(root)/(tabs)/settings.tsx` line 40 declares `const APP_VERSION = '1.0.0'` and renders that constant in the About row. New builds keep showing 1.0.0.

## Steps to Reproduce

1. Update the version in `app.json` (e.g., to `1.2.3`).
2. Rebuild and reopen the app.
3. Open Settings → About.
4. Observe `1.0.0` even though the build is 1.2.3.

## Expected Behavior

App version should come from the runtime — `expo-constants` (`Constants.expoConfig.version`) or `Application.nativeApplicationVersion` — and reflect the actual installed build. Build / commit identifier should also be visible for support purposes.

## Severity

- [x] **Minor** — label only; no functional impact, but support requests will be confused.

## Environment
- File: `app/(root)/(tabs)/settings.tsx`, line 40.

## Reproducibility
- [x] 100 %.

## Status

Done in P15-C (SHA e40daa8d3, settings + theme hardening bundle).
