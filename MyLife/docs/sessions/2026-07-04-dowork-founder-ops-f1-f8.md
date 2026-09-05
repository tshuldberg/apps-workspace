# DoWork founder-ops execution (Plan 36 F1-F8), 2026-07-04

Worked the F1-F8 founder-ops ledger from the plan-36 handoff. Everything
automatable was executed and live-verified against production; what remains is
dashboard sign-ins, hardware, and founder decisions.

## F1: Supabase production, DONE and live-verified

- Created project **DoWork Production**, ref `tgyxkoblbiacjsbmiuyn`, region
  us-west-1, org `BestChef` (`ztyojbhkhpetdvzhxbzm`, free tier, same org as
  BestChef prod). DB password generated and stored in the macOS keychain as
  `DoWork Production Supabase DB`. Caveat recorded: free projects pause after 7
  idle days; keep warm or upgrade before sustained public load.
- Applied all **10 dw_ migrations** in filename order via the Management API
  query endpoint (no psql on this machine; a bare `supabase db push` is a
  foot-gun because the migrations dir is shared with BestChef/Yearn/Manhattan,
  now documented in the runbook). Verified: 19 dw_ tables/views, 8 dw_
  functions (both security-definer RPCs), 47 public + 14 storage policies,
  all 4 buckets with correct visibility, size caps, and MIME lists.
- Deployed all **6 edge functions** (v1 ACTIVE): upload-finalize,
  delete-account, redeem-invite, playback-url (JWT verified) and rc-webhook,
  notify (platform JWT gate off, own shared-secret auth).
- Secrets set: `RC_WEBHOOK_SECRET`, `DOWORK_INTERNAL_SECRET` (generated,
  stored in keychain as `DoWork RC_WEBHOOK_SECRET` /
  `DoWork DOWORK_INTERNAL_SECRET`). The runbook's `DOWORK_SERVICE_ROLE_KEY`
  was runbook drift; no function reads it (platform injects
  SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY). Runbook corrected.
- Database Webhooks wired as `pg_net` AFTER INSERT triggers
  (`dowork_form_check_notify`, `dowork_form_feedback_notify`) calling
  `dw_notify_webhook(type, secret)`, which POSTs the wrapped
  `{ type, record }` payload dowork-notify expects.
- Auth configured via Management API: anonymous sign-ins on, site URL
  `https://dowork.app`, redirect allow-list `dowork://auth-callback, exp://**`.
- **Live verification matrix** (all against prod): notify 401 wrong secret /
  400 bad type / 200 `{ok,sent:0}`; playback-url 401 no JWT / 404 bogus id;
  anonymous signup issues a session; subscriber premium playback 200 signed
  URL; anonymous premium 403 `not_entitled`; anonymous free 200; earnings RPC
  as trainer returns the seeded month row.

## F2: EAS, automatable half DONE

- `eas init` and `eas env:create` fail in this environment (spawned
  `expo config --json` exits 1 silently; errors_log Mitigated row). Bypassed
  via the Expo GraphQL API: project `@trebaybay/dowork` id
  `1f78cafb-496c-48fd-9a38-2bda8cb24b56` written to `app.json`, and 5
  production env vars created: `EXPO_PUBLIC_DOWORK_SUPABASE_URL`,
  `..._SUPABASE_ANON_KEY`, `..._CLOUD_ENV=production`, `..._PUBLIC_LAUNCH=1`,
  `..._AUTH_REDIRECT_URL=dowork://auth-callback`.
- Founder still owns: Apple Developer bundle `com.dowork.dowork`, ASC app at
  $4.99, `ascAppId` into `eas.json`.

## F7 prep: demo accounts seeded through the REAL paths

- `review-trainer@dowork.app` (handle `demo-coach`, verified): created via
  admin API, trainer row minted by actually calling `dowork-redeem-invite`
  with a seeded invite, profile enriched through owner RLS PATCH, **3 videos
  uploaded through the real sign -> storage PUT -> finalize pipeline**
  (2 free, 1 premium; honest labeled test patterns, 5s each).
- `review-client@dowork.app`: active `dowork_trainer_tier_1` subscription
  (period end +365d) + one INITIAL_PURCHASE ledger event ($4.99, raw marked
  `seeded_for_app_review`), subscriber_count recomputed to 1.
- Unclaimed client invite and trainer invite codes are stored in founder
  keychain "DoWork" entries. Passwords in keychain (`DoWork demo trainer password`,
  `DoWork demo client password`), NOT in the repo. `app-review-notes.md`
  updated with all of it.

## QA finding fixed: the app had no sign-in surface

Five screens say "Sign in" but no screen existed to do it; the provider's
`requestEmailLink` had zero consumers, and App Review demo credentials require
password login. Shipped (`2aa6b935`): `signInWithEmailPassword` in account.ts,
`signInWithPassword` on the cloud provider, new `account.tsx` screen (password
sign-in, email link, password recovery, honest unconfigured and signed-in
states, a11y labels), route registration, Settings entry points. 4 new tests;
app suite 326/326, tsc clean, dowork parity green.

## F5: legal drafts ready to host

`apps/dowork/legal/`: terms, privacy, guidelines, trainer-license, index +
deploy README. Paths match the exact URLs shipped in the app (`/terms`,
`/privacy`, `/guidelines`). Trainer revenue share intentionally points to the
individual trainer agreement (F4 undecided). Needs founder + counsel review,
then any static host with clean URLs on the dowork.app domain.

## Commits

| Commit | What |
|---|---|
| `2aa6b935` | feat: email + password sign-in path via new account screen |
| `cde3b822` | chore: F1/F2/F7 executed (app.json projectId, review notes, runbook rewrite) |
| `10b81780` | docs: F5 legal site drafts |

## Remaining founder-ops (dashboards, hardware, decisions)

1. **F2**: ASC app ($4.99) + `ascAppId` in eas.json; Apple Developer bundle id.
2. **F3**: RevenueCat account, 8 products `dowork_trainer_tier_1..8` in
   ASC + RC, webhook URL
   `https://tgyxkoblbiacjsbmiuyn.supabase.co/functions/v1/dowork-rc-webhook`
   with Authorization = keychain `DoWork RC_WEBHOOK_SECRET`, then
   `EXPO_PUBLIC_DOWORK_RC_KEY_IOS` (appl_) + `_ANDROID` (goog_) into EAS
   production env (build guard blocks production builds without them).
3. **F4**: revenue split decision with the trainer (update
   trainer-license.html section 4 if publishing a number).
4. **F5**: register/point dowork.app, deploy `apps/dowork/legal/`, counsel review.
5. **F6**: APNs key + FCM via `eas credentials` (needs founder's Apple login).
6. **F7**: production TestFlight build, then
   `apps/dowork/Tickets/white-glove-qa-checklist.md` on device with the
   trainer including the gym voice session.
7. **F8**: icon/splash final art.
8. **Branch**: decide push vs cherry-pick (main checkout holds a dirty Meerkat
   session); 27 commits unpushed.
