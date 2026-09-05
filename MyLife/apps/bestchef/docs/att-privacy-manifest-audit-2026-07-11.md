# BestChef ATT / Privacy Manifest Audit (2026-07-11)

Audit of the App Tracking Transparency (ATT) posture and iOS privacy manifest
claims in `app.json`, in response to plan-45 remediation item M14. The question:
does `app.json` correctly assert "no tracking", and does that claim match the
code and dependencies?

## Conclusion

The privacy manifest claims match reality. BestChef performs no ATT-relevant
tracking, ships no analytics or advertising SDK, and correctly declares
`NSPrivacyTracking: false`. No change to `app.json` was required.

## What was checked

1. **Tracking / analytics / advertising SDKs in dependencies.**
   Scanned `apps/bestchef/package.json` (and the app source tree) for
   AppTrackingTransparency, `expo-tracking-transparency`, IDFA/advertising-ID
   access, and the common analytics vendors (Amplitude, Mixpanel, Segment,
   Firebase, Sentry, PostHog, Bugsnag). Result: NONE present. Dependencies are
   Expo first-party modules, `@supabase/supabase-js`, `lucide-react-native`,
   `@formatjs/*`, and `@mylife/*` workspace packages only. This is consistent
   with the workspace privacy-first mandate (zero analytics, zero telemetry).

2. **ATT plugin / usage string.**
   `app.json` has no `expo-tracking-transparency` plugin and no
   `NSUserTrackingUsageDescription` in `ios.infoPlist`. Correct: an app that
   does not track must NOT prompt for ATT and must NOT declare the usage string.

3. **Privacy manifest claims (`app.json` -> `ios.privacyManifests`).**
   - `NSPrivacyTracking: false` and `NSPrivacyTrackingDomains: []` -> accurate;
     there is no cross-app/cross-site tracking and no tracking domains.
   - `NSPrivacyCollectedDataTypes`: email, photos/videos, other user content,
     coarse location, and user ID are each declared `Tracking: false` with
     purpose `AppFunctionality`. This matches how the app uses them (account
     identity, dish/recipe submissions, chef profile, city auto-detect). None
     are used for tracking or advertising.
   - `NSPrivacyAccessedAPITypes`: UserDefaults (CA92.1), file timestamp
     (C617.1), disk space (E174.1), and system boot time (35F9.1) with the
     standard Apple-approved reason codes. These are the required-reason APIs
     that Expo/React Native touch; the declared reasons are appropriate.

4. **Info.plist usage strings** are limited to camera, microphone, photo
   library, and when-in-use location, each with an accurate,
   feature-specific justification. No tracking-adjacent permissions.

## Verdict

- Tracking: NONE. `NSPrivacyTracking: false` is truthful.
- ATT prompt: correctly absent.
- Privacy manifest: consistent with dependencies and code.
- Action taken: none required. `app.json` was left unchanged.
