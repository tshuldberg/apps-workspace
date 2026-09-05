# DoWork App Review Notes (Plan 36 Phase 7)

Draft of the App Store Connect "Notes for Review" plus the demo-credentials plan.
Items marked FOUNDER-OPS are filled during F1/F7 (they need the production
Supabase project and real accounts); everything else is final copy.

## App summary for the reviewer

DoWork is a $4.99 workout tracker with an invite-only trainer platform. Trainers
upload demonstration videos, publish a public profile, and run a private
coaching loop with clients (form-check videos with timestamped feedback).
Viewers can control video playback hands-free by voice while training.

## Demo credentials (SEEDED on production `tgyxkoblbiacjsbmiuyn`, 2026-07-04)

Passwords are NOT stored in the repo. They live in the founder's macOS keychain
under the service names below; paste them into the ASC review form at submit.

| Field | Value |
|---|---|
| Demo trainer account | `review-trainer@dowork.app` (password: keychain `DoWork demo trainer password`). Handle `demo-coach`, verified, 3 published videos (2 free, 1 premium "Deadlift Masterclass") |
| Demo subscriber account | `review-client@dowork.app` (password: keychain `DoWork demo client password`). ACTIVE `dowork_trainer_tier_1` subscription to demo-coach (period end +365 days), seeded $4.99 INITIAL_PURCHASE ledger event |
| Demo client invite code | (stored in founder keychain - "DoWork" entries) |
| Trainer invite code | (stored in founder keychain - "DoWork" entries) |

Seeding went through the real production paths (invite redemption via
`dowork-redeem-invite`, videos via the signed upload sign -> PUT -> finalize
pipeline). Entitlement verified live 2026-07-04: subscriber premium playback 200,
anonymous premium 403 `not_entitled`, anonymous free 200, earnings RPC returns
the seeded event. Replace the three sample videos with real footage during
white-glove QA if desired; they are honest labeled test patterns.

Trainer and client invite codes must never be committed. The leaked production
codes are being rotated.

## Notes for Review (copy block)

- Trainer accounts are invite-only by design (quality and safety control for a
  coaching product). The trainer directory only shows verified trainers. Use the
  demo trainer credentials above to see the Studio; use the trainer invite code
  to exercise onboarding.
- Subscriptions: each trainer sells one auto-renewing monthly subscription
  (products dowork_trainer_tier_1 through _8; the trainer's tier picks the
  product). Purchases unlock that trainer's premium video library. The demo
  subscriber account already has an active subscription for immediate testing.
- Microphone and speech recognition: used ONLY for hands-free playback control
  while a video is playing (pause, rewind, slow down). Recognition runs on-device
  (SFSpeechRecognizer with requiresOnDeviceRecognition); audio never leaves the
  device and is never stored. The feature is off until the user enables it and
  fully optional (on-screen controls always work).
- User-generated content: trainer videos are gated behind verified trainer
  accounts; social shares and comments carry report and block actions on every
  surface; blocked users are filtered everywhere; account deletion
  (Settings > Delete Account) removes all server data, storage objects, and the
  auth user. The one retention exception: purchase-ledger rows are anonymized
  in place (user id removed, raw payment payload scrubbed) rather than deleted
  so trainer earnings history stays accurate; the retained columns hold no
  personal data.
- Form-check videos are private between one client and their trainer (row-level
  security enforced), signed-URL access only.
- Push notifications are optional, default to transactional types only, and
  marketing is strictly opt-in.

## Permission strings already shipped (app.json)

- NSMicrophoneUsageDescription and NSSpeechRecognitionUsageDescription state
  on-device processing; keep them in sync with the Notes for Review claims.

## Pre-submit checklist (code-side, verified 2026-07-04)

- [x] eas.json appVersionSource remote + production autoIncrement (build stamping)
- [x] eas-build-pre-install env guard (scripts/check-build-env.mjs): production
      builds fail without per-platform RevenueCat keys or Supabase env
- [x] F2 partial (2026-07-04): EAS projectId `1f78cafb-496c-48fd-9a38-2bda8cb24b56`
      in app.json; production EAS env vars set (Supabase URL/anon key, cloud env,
      public launch, auth redirect). RC keys still pending F3.
- [ ] FOUNDER-OPS F2: ASC app at $4.99 + ascAppId replaces the eas.json placeholder
- [ ] FOUNDER-OPS F5: dowork.app/terms + /privacy live (the paywall links them);
      drafts ready in `apps/dowork/legal/`
- [ ] FOUNDER-OPS F8: final icon + splash art
