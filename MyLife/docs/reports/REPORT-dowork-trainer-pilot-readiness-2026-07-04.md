# DoWork trainer-pilot readiness, 2026-07-04 (post-remediation)

Branch: `feature/dowork-trainer-launch` at `9ce76ef3`. Prior state: dp-audit-2026-07-04 scored 6.8/10 with 22 findings.

## Verdict

**Code-side: ready for a supervised trainer pilot (9/10).** Every audit finding is fixed, the two remaining codeable deferred items were closed today, and the server-side fixes are LIVE on the production Supabase project.

**Can you hand it to a real trainer today: not yet.** The blocker is not code; it is that no installable build exists. There has never been an EAS build or TestFlight upload of this app, push credentials are not configured, and none of the device-bound flows (voice, camera form checks, GPS, push, purchases) have run on real hardware. Those are founder-ops items, roughly one focused day, then a QA session with the trainer.

## What is done and verified

### Product surface (code-complete, 402 tests, parity green)

- Trainer platform: invite-only trainer creation, directory, public profile with free/premium libraries, Trainer Studio (upload queue, manage grid, profile editor), earnings.
- Coaching loop: client invites (QR + deep link + manual code), My Trainer space, form-check video exchange with timestamped feedback and video replies, read-only ended relationships, offline-safe text feedback with honest state copy.
- Playback: voice-controlled player over 60-minute signed URLs, offline downloads with honest entitlement re-check, hands-free voice that survives normal Android silence.
- Safety: report + block on every UGC surface including private form checks; blocked trainers filtered from all discovery; moderation deactivation stops uploads AND serving server-side.
- Account lifecycle: anonymous-first, email+password, magic link and password recovery that really establish a session (PKCE), full account deletion with purchase-ledger anonymization.
- Monetization: RevenueCat paywall with store-price truth (now fail-closed if the store has no localized price), server-truth entitlement, paid-through cancellation semantics.

### Server truth (deployed to prod `tgyxkoblbiacjsbmiuyn` today)

- Migrations `20260704000002` (entitlement hardening) and `20260704000003` (coaching state) applied via Management API and verified (policies + report-kind constraint inspected).
- Functions redeployed and live-probed: `dowork-delete-account` v3, `dowork-playback-url` v3, `dowork-upload-finalize` v3 (all JWT-verified, 401 without JWT), `dowork-rc-webhook` v3 (own shared-secret auth, 401 on wrong secret).

### Environment checks

- Expo SDK graph from `apps/dowork` is a consistent SDK 54 set (expo 54.0.33, metro-runtime 6.1.2, RN 0.81.5, expo-location 18.1.6, expo-keep-awake 15.0.8). The previously feared 55.x hoist skew does not leak into DoWork's resolution; the errors_log row can stay Mitigated pending the first real EAS build.

## What blocks a real trainer + clients (in order)

| # | Item | Owner | Needed for pilot? |
|---|------|-------|-------------------|
| 1 | ASC app record ($4.99 paid app) + `ascAppId` into eas.json (F2 second half) | Founder (dashboard) | Yes |
| 2 | App icon + splash art (F8) | Founder | Yes (build requirement) |
| 3 | First EAS build + TestFlight internal testing | Founder terminal (`eas build`; eas-cli broken in this sandbox, see errors_log) | Yes |
| 4 | APNs key via `eas credentials` (F6) | Founder | Yes for push (form-check/feedback alerts); app works without, coaching loop degrades to manual refresh |
| 5 | White-glove device QA with the trainer (`Tickets/white-glove-qa-checklist.md`) incl. gym voice QA, camera form checks, 2-device coaching loop | Founder + trainer | Yes, before clients join |
| 6 | RevenueCat account + 8 tier products + webhook secret + `EXPO_PUBLIC_DOWORK_RC_KEY_*` (F3), split decision (F4) | Founder | No for a comped pilot (client-link entitlement bypasses payments); yes before any public subscriber |
| 7 | Host `apps/dowork/legal/` at dowork.app + counsel review (F5) | Founder | No for TestFlight internal; yes for App Store submission |
| 8 | Supabase free tier pauses after 7 idle days; upgrade or keep warm | Founder | Yes (silent outage risk mid-pilot) |

Demo accounts, trainer invite codes, and a seeded coach with real-pipeline videos already exist (F7 done; codes in `app-review-notes.md`, passwords in the founder keychain).

## Known remaining non-blockers

- Two-brand visual seams and thin a11y on the ported solo-lifter half (builder, calculators, history). Cosmetic; the trainer/coaching surfaces are polished.
- Builder-first first-workout funnel (solo-lifter onboarding nicety).
- Device-bound validation of voice/GPS/push/purchases is pending item 5 above by definition.

## Recommended pilot path

1. Founder: items 1-4 (about a day: ASC record, icon, `eas build --profile production` + TestFlight, APNs).
2. Run the white-glove checklist with the trainer on TestFlight (invite code redemption, 3 uploads, client invite to a second device, form-check round trip, voice in a gym).
3. Onboard 2-3 real clients via client invites (no payments involved).
4. Before opening paid subscriptions to the public: F3 RevenueCat + sandbox purchase matrix, F5 legal hosting, then App Store submission with the already-written review notes.
