# DoWork Supabase setup runbook

DoWork uses its own Supabase project (separate from BestChef's `BestChef Staging` and `BestChef Production`). All cloud tables use a `dw_` prefix.

## Project provisioning

**DoWork Production is LIVE as of 2026-07-04:** ref `tgyxkoblbiacjsbmiuyn`
(`https://tgyxkoblbiacjsbmiuyn.supabase.co`), org `BestChef` (free tier; upgrade
or transfer to the Pro org before sustained public load; free projects pause
after 7 days of inactivity). DB password, RC webhook secret, and internal secret
are in the founder's macOS keychain (`DoWork Production Supabase DB`,
`DoWork RC_WEBHOOK_SECRET`, `DoWork DOWORK_INTERNAL_SECRET`). All 10 dw_
migrations applied, all 6 functions deployed, webhooks + secrets + auth config
done (see sections below). A staging project has NOT been created yet.

1. If a staging project is later created, capture its ref and add it to
   `apps/dowork/app/(root)/data/launch-environment.ts` `DOWORK_STAGING_PROJECT_REFS`
   so the public-launch guard can recognize non-prod URLs.

## Local migration apply

From the repo root:

```bash
# Apply DoWork migrations only (not BestChef's bc_*)
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260428000001_dowork_bootstrap.sql
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260428000002_dowork_workout_shares.sql
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260428000003_dowork_trainer_videos.sql
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260428000004_dowork_moderation.sql
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260609000001_dowork_security_hardening.sql
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260609000002_dowork_storage_policies.sql
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260609000003_dowork_user_blocks.sql
# Plan 36 trainer platform spine + coaching loop + push
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260703000001_dowork_trainer_platform_v2.sql
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260703000002_dowork_form_check_storage.sql
psql "$DOWORK_STAGING_DATABASE_URL" -f supabase/migrations/20260704000001_dowork_push_prefs.sql
```

`20260609000001` must run after the 20260428 set: it drops the FOR ALL owner policies (trainer self-verification fix, comment rate limit) and replaces them with per-operation policies. `20260704000001` adds `dw_notification_prefs` (per-user, per-type notification preferences enforced by `dowork-notify`).

**Never run a bare `supabase db push` against the DoWork project.** The
`supabase/migrations/` directory is shared across BestChef, Yearn, Manhattan,
and DoWork; `db push` applies EVERY untracked migration in filename order and
would create foreign `bc_*`/`yearn`/`manhattan` schema on the DoWork project.
Apply the `*_dowork_*.sql` files individually: the `psql` lines above, or the
Supabase Management API query endpoint
(`POST /v1/projects/tgyxkoblbiacjsbmiuyn/database/query`) with the CLI access
token, which is how the 2026-07-04 production apply was done (no DB password
needed).

## Mint a trainer invite

Run this only from a service-role context. The invite expires after 30 days.

```sql
with generated as (
  select string_agg(
    substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789', (get_byte(gen_random_bytes(1), 0) % 34) + 1, 1),
    ''
  ) as code
  from generate_series(1, 12)
)
insert into public.dw_trainer_invites (code, expires_at)
select code, now() + interval '30 days'
from generated
returning id, code, expires_at;
```

Generate codes with real randomness and keep returned codes out of git.

## Auth dashboard

- Site URL: `https://dowork.app` (set when domain is registered)
- Redirect URLs: `dowork://auth-callback`, `exp://...` (for dev)
- Provider: **Email** + **Anonymous** enabled in v1; Apple / Google deferred to post-launch
- Email templates: customize for DoWork brand (orange accent, gritty gym tone)

## Storage buckets

Buckets and their RLS policies are created by migration `20260609000002_dowork_storage_policies.sql` (no dashboard step needed; re-running converges size/MIME limits):

- `dowork-avatars` — public read, owner-folder write, 5 MB images
- `dowork-share-media` — public read, owner-folder write, 250 MB images/video
- `dowork-trainer-videos` — private; owner-folder access only, 500 MB video

Path convention is `<user_id>/...` (first folder segment must match `auth.uid()`). Uploads go through the `dowork-upload-finalize` edge function (signed upload URLs); premium trainer-video playback URLs are minted by the planned `dowork-playback-url` edge function after an entitlement check. After `supabase db push`, verify the three buckets exist under Storage in the dashboard.

## Edge functions

Deploy with `apps/dowork/scripts/deploy-functions.sh <project-ref>` (BK-1),
not ad hoc `supabase functions deploy` calls. It encodes the JWT-verification
split declared in `supabase/config.toml [functions.*]` and runs a post-deploy
smoke test that confirms a forged/unsigned JWT is rejected by every
user-facing function:

```bash
apps/dowork/scripts/deploy-functions.sh tgyxkoblbiacjsbmiuyn
```

- JWT-verified (end-user callers): `dowork-upload-finalize`,
  `dowork-delete-account`, `dowork-redeem-invite`, `dowork-playback-url`.
- Machine callers verify their own shared secret, so the platform JWT gate is
  off (`--no-verify-jwt`):
  - `dowork-rc-webhook` -> Authorization header == `RC_WEBHOOK_SECRET`
  - `dowork-notify` -> `x-dowork-internal` header == `DOWORK_INTERNAL_SECRET`

Function roles:

- `dowork-redeem-invite`: the only path that creates a `dw_trainers` row. Validates an unclaimed, unexpired invite, mints the trainer (handle slugged from display name with numeric-suffix collision retry), claims the invite.
- `dowork-playback-url`: re-checks entitlement (free / owner / active subscription / active client link; form checks: participants only) and mints a 60-minute signed Storage URL. Deduped trainer-video view counts (once per user per video per hour).
- `dowork-rc-webhook`: RevenueCat webhook. Idempotent on the RC event id, maps event types to subscription status, recomputes `subscriber_count`.
- `dowork-notify`: internal push fan-out to Expo. Called by `dowork-upload-finalize` (new video) and by Database Webhooks on `dw_form_checks` / `dw_form_feedback` inserts.

Set the function secrets (never ship to client). **DONE 2026-07-04 on
production**; both values are in the founder keychain
(`DoWork RC_WEBHOOK_SECRET`, `DoWork DOWORK_INTERNAL_SECRET`):

```bash
# RevenueCat webhook shared secret. Paste the SAME value into the RevenueCat
# dashboard webhook Authorization header (below).
supabase secrets set RC_WEBHOOK_SECRET=$DOWORK_RC_WEBHOOK_SECRET

# Internal fan-out secret shared by upload-finalize + the Database Webhooks that
# call dowork-notify. Generate once (e.g. `openssl rand -hex 32`) and reuse.
supabase secrets set DOWORK_INTERNAL_SECRET=$DOWORK_INTERNAL_SECRET
```

(The functions read the platform-injected `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` directly; no `DOWORK_SERVICE_ROLE_KEY` secret is
needed, an earlier revision of this runbook was wrong about that.)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for
deployed functions; the code reads those names directly.

## Database Webhooks (coaching-loop push)

**DONE 2026-07-04 on production**, implemented as `pg_net` AFTER INSERT triggers
(the same mechanism the dashboard's Webhooks UI generates), because they let the
payload be wrapped exactly as `dowork-notify` expects:

- `dowork_form_check_notify` on `public.dw_form_checks` INSERT
- `dowork_form_feedback_notify` on `public.dw_form_feedback` INSERT

Both call `public.dw_notify_webhook(type, secret)` which POSTs
`{ "type": "form_check" | "form_feedback", "record": to_jsonb(new) }` to
`https://tgyxkoblbiacjsbmiuyn.supabase.co/functions/v1/dowork-notify` with the
`x-dowork-internal` header. Auth verified live: 401 on wrong secret, 200
`{ok:true}` on a valid payload. If the internal secret is ever rotated, recreate
the two triggers with the new secret (it is embedded in the trigger args, as
with dashboard-created webhooks).

## Notification preferences (server-enforced)

Push opt-outs cannot be applied on the device (Expo delivers before the app can
filter), so `dowork-notify` enforces them before sending, reading
`dw_notification_prefs` (migration `20260704000001`) with the service role:

- One row per user, owner-only CRUD from the app's notification-preferences
  screen. Columns: `new_video`, `form_check`, `form_feedback` (default **true**),
  `marketing` (default **false**).
- For the three transactional types, a recipient is dropped only if their row
  sets that type to `false`. A **missing row means the defaults** (transactional
  on, marketing off), so a user who never opened the screen still gets coaching
  pushes.
- `marketing` is opt-in: `dowork-notify` with `type: 'marketing'` and a
  `{ title, body }` record fans out only to users whose row has
  `marketing = true`. There is no automated marketing trigger; it is a manual
  founder-invoked send (same `x-dowork-internal` auth as the transactional
  types). Nothing sends marketing unless you call it.

No dashboard step: the table and its policies come from the migration. Verify by
toggling a type off in the app and confirming that user drops out of the next
`dowork-notify` send.

## RevenueCat webhook

In the RevenueCat dashboard (Project → Integrations → Webhooks):

- URL: `https://<ref>.functions.supabase.co/dowork-rc-webhook`
- Authorization header: the exact `RC_WEBHOOK_SECRET` value set above (RC sends
  it verbatim as the `Authorization` header; the function compares byte-for-byte).
- The app identifies RevenueCat with the Supabase user id (`app_user_id`) and
  sets a `trainer_id` subscriber attribute at purchase time. The webhook resolves
  the trainer only from that attribute; events without it are stored but never
  create a subscription row (no guessing).

## EAS env wiring

Add to the EAS project (`eas env:create`):

| Variable | Value | Profile |
|----------|-------|---------|
| `EXPO_PUBLIC_DOWORK_SUPABASE_URL` | `https://<staging-ref>.supabase.co` | development, preview |
| `EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY` | staging anon key | development, preview |
| `EXPO_PUBLIC_DOWORK_CLOUD_ENV` | `staging` | development, preview |
| `EXPO_PUBLIC_DOWORK_SUPABASE_URL` | `https://<prod-ref>.supabase.co` | production |
| `EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY` | prod anon key | production |
| `EXPO_PUBLIC_DOWORK_CLOUD_ENV` | `production` | production |
| `EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH` | `1` | production |

## Push credentials + provisioning (founder-ops F2 + F6)

Expo push tokens require the EAS `projectId` and platform push credentials.
Until these are done the app is honest about it: `data/push.ts` returns
`{ ok: false, reason: 'not_provisioned' }` and the notification-preferences
screen shows an "available once the app is provisioned" state instead of faking
a token. No fake token is ever written.

1. **F2 — EAS projectId.** Run `eas init` for `com.dowork.dowork` and replace
   `expo.extra.eas.projectId` in `apps/dowork/app.json` (currently the
   placeholder `REPLACE_WITH_EAS_PROJECT_ID`). `getExpoPushTokenAsync` uses it.
2. **F6 — Apple (APNs).** In the Apple Developer account create/confirm the push
   key, then upload it to Expo: `eas credentials` → iOS → Push Notifications.
   Expo sends via APNs on your behalf.
3. **F6 — Android (FCM).** Create a Firebase project for `com.dowork.dowork`,
   download `google-services.json`, and add the FCM V1 service-account key to
   `eas credentials` → Android → Push Notifications.
4. After a build with these in place, the master toggle in the app registers a
   real token into `dw_push_tokens`, and `dowork-notify` can deliver.

## Universal links / associated domains

Custom-scheme deep links (`dowork://trainer/<handle>`, `dowork://video/<id>`,
`dowork://client-invite/<code>`) work today with no extra setup. HTTPS universal
links (`https://dowork.app/...`) are **not** wired in `app.json` on purpose: the
Associated Domains capability intersects with store provisioning (F2) and needs
a hosted AASA file, so enabling it early would be a dead placeholder. When
dowork.app is live, add to `apps/dowork/app.json`:

```jsonc
"ios": { "associatedDomains": ["applinks:dowork.app"] },
"android": {
  "intentFilters": [
    { "action": "VIEW", "autoVerify": true,
      "data": [{ "scheme": "https", "host": "dowork.app" }],
      "category": ["BROWSABLE", "DEFAULT"] }
  ]
}
```

and host `/.well-known/apple-app-site-association` + `/.well-known/assetlinks.json`
with the `com.dowork.dowork` app id. Expo Router resolves the same route paths as
the custom scheme, so no route changes are needed.

## Verification

After bootstrap, run from a staging dev build:

1. App boots, `dowork.db` created locally
2. Anonymous Supabase session is established (visible in `auth.users` with `is_anonymous=true`)
3. Settings screen shows "Cloud: staging" (when DoWorkCloudProvider sets `environment`)
4. Sign up via email magic link round-trips through `dowork://auth-callback`
5. RLS test: attempt to read another user's `dw_workout_shares` — should fail unless `privacy = 'public'`
6. Notifications: with F2 + F6 done, toggle push on in the notification-preferences
   screen (grants OS permission, writes a `dw_push_tokens` row), toggle a type off
   and confirm the row updates in `dw_notification_prefs`, then insert a
   `dw_form_checks` row and confirm the trainer device receives the tap-routable push
7. Deep link: open `dowork://trainer/<handle>` and `dowork://video/<id>` — they land
   on the profile and the player respectively
