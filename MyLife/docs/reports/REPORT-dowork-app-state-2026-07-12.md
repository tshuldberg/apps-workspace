# DoWork App State Review - 2026-07-12

Snapshot of the DoWork standalone app (apps/dowork) at merged main `b317711a`. The HTML twin beside this file contains static recreations of all 50+ screens grouped by user workflow; this markdown is the canonical text record.

## Verdict

Code-side production blockers are closed. Plan 46 remediation (2026-07-11) resolved every code-addressable P0-P3 finding from the 8-zone adversarial audit; gates are green (typecheck, 518 app tests, 556 workouts tests, 429 edge-function tests, dowork parity). GO is gated only on founder-operated items F2-F8 plus a production redeploy of the post-07-04 delta, all listed step by step below and in the HTML twin.

## App surface (exact state at b317711a)

- 50+ screens across 6 workflow groups: entry/account, core training loop, programs/plans/tools, progress/analytics, social, trainer platform.
- Local-first: single SQLite `dowork.db`, 18 `wk_*` tables via `@mylife/workouts` (6 migrations). Cloud: Supabase prod `tgyxkoblbiacjsbmiuyn` (10+ migrations, 6 edge functions ACTIVE, pg_net webhooks) for auth, trainer directory, signed video pipeline, coaching loop, purchases ledger, push.
- Monetization implemented end to end in code: $4.99 paid app + RevenueCat trainer subscription ladder (`dowork_trainer_tier_1..8`, $4.99-$39.99/mo), per-platform key validation, trainer_id subscriber attribute, server-truth confirmation poll, honest PaywallSheet states, earnings screen off `dw_get_trainer_earnings` RPC, Restore/Manage in Settings.
- Launch hardening shipped: push end to end with server-enforced per-type prefs, deep links incl. cold start (`dowork://video/[id]`), offline downloads with entitlement re-check and honest revoke, storage meter + sign-out wipe, day-1 truth + a11y pass, security/data-protection config plugins.
- Recent fixes on main: live sessions boot in `playing` (fdf942ea); orphan hub calculator retired for parity (b317711a).

## Production readiness runbook (founder-ops)

Ordered; each step's full click-by-click detail is in the HTML twin.

1. **R0 Redeploy the post-07-04 delta to Supabase prod** - `supabase db push` + `apps/dowork/scripts/deploy-functions.sh` (pins verify_jwt, BK-1); verify Database Webhooks. Required before the next TestFlight build (deploy gate from the 07-04 audit remediation plus plan 46 changes).
2. **F2 App Store Connect** - register `com.dowork.dowork`, create the $4.99 paid app, put the real `ascAppId` into `apps/dowork/eas.json` (currently `REPLACE_WITH_ASC_APP_ID`). EAS project `1f78cafb-496c-48fd-9a38-2bda8cb24b56` + 5 production env vars already exist.
3. **F3 RevenueCat** - create the 8 subscription products `dowork_trainer_tier_1..8` in ASC/Play + RC, wire the RC webhook with its secret, add `EXPO_PUBLIC_DOWORK_RC_KEY_IOS/_ANDROID` to EAS env. `scripts/check-build-env.mjs` fails production builds until set.
4. **F4 Revenue-split decision** - pick the trainer payout percentage; earnings screen then shows real payouts.
5. **F5 Legal hosting** - deploy `apps/dowork/legal/` (privacy, terms, guidelines, trainer-license) to live dowork.app, counsel review, confirm governing law + moderation SLA staffing. Universal links need the live domain.
6. **F6 Push credentials** - APNs key (iOS) + FCM (Android) into EAS credentials.
7. **F8 Icon + splash art** - replace placeholders; finish `plugins/android-res/` adaptive icon resources.
8. **F7 TestFlight white-glove QA** - build + submit, run `Tickets/white-glove-qa-checklist.md` (9 sections) on device with the first trainer; demo review accounts already seeded on prod (passwords in founder keychain; see `Tickets/app-review-notes.md`).
9. **Submit for review** - paste review notes + demo credentials from `Tickets/app-review-notes.md`; after approval, revenue flows from the $4.99 app price and trainer subscriptions.

## Sources

- `docs/plans/done/46-dowork-production-readiness-remediation.md`
- `docs/reports/REPORT-dowork-adversarial-production-audit-2026-07-11.md`
- `apps/dowork/Tickets/launch-plan.md`, `app-review-notes.md`, `white-glove-qa-checklist.md`
- Screen sources under `apps/dowork/app/` at `b317711a` (recreated in the HTML twin)
