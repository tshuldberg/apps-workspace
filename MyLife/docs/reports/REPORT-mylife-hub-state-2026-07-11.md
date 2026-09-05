# MyLife Hub - State Review and Launch Runbook (2026-07-11)

Markdown companion to [REPORT-mylife-hub-state-2026-07-11.html](REPORT-mylife-hub-state-2026-07-11.html), which carries the full visual content: 190 HTML phone-frame recreations covering the hub shell (28 screens), auth/onboarding (5), and every wired module's tab screens, plus a complete 949-screen index and per-module workflows. All claims file-verified on merged main (through `1910aecc`).

## State summary

- 41 registry modules; 38 fully wired on mobile, 30 on web. 949 mobile screens total (28 hub shell + 5 auth/onboarding + 916 module screens), 185+ navigation tabs.
- Identity and build plumbing exist: bundle `com.mytoolbox.mylife`, EAS project + production profile, ASC app record `6761207231`.
- Monetization as coded (`packages/billing-config`): $19.99 hub unlock, $4.99 per-module unlock (31 modules), $9.99 annual update pass, $2.99/$5.99 storage subscriptions, 9 free modules. PurchaseGate paywall UI exists but every purchase dead-ends on "RevenueCat not initialized" (`apps/mobile/app/_layout.tsx:214` passes no SDK/key; `react-native-purchases` not installed).
- Store blockers (7): icon/splash assets absent (and `app.json:81` references a nonexistent notification icon, which is build-breaking), purchases SDK missing, purchase flow dead-ends, no privacy policy/terms, no account-deletion UI, no iOS privacy manifest, no screenshots/listing copy.
- Onboarding truth: Pledge -> Goal -> Kit (OnboardingGate), then hub dashboard; local-first with optional auth.

## Path to production (full detail in the HTML)

Track A (Claude-executable): A1 app icon/splash + fix broken asset path; A2 install react-native-purchases and initialize the existing payment service + harden PurchaseGate/restore; A3 privacy policy, terms, account-deletion screen, iOS privacy manifest, permission audit; A4 preflight script + green `eas build --platform ios --profile production`; A5 screenshots + listing copy.

Track B (founder-only): B1 ASC Paid Apps agreement, banking, tax; B2 RevenueCat project + `EXPO_PUBLIC_REVENUECAT_IOS_KEY` EAS env; B3 create the 35 IAPs in ASC matching billing-config IDs + RevenueCat entitlements/offering; B4 host legal pages; B5 App Privacy questionnaire + age rating; B6 `eas submit` + TestFlight acceptance pass; B7 submit with review notes (local-only data, no demo account, HealthKit in-app only, sandbox IAP); B8 release, verify first live purchase, then Play Store with the same assets.

Realistic elapsed: 1-2 weeks of parallel Track A/B work to a submitted build, Apple review on top.
