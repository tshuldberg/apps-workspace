# dowork runtime contracts

Preserved from `MyLife/apps/dowork/CLAUDE.md` during the September 5, 2026 instruction reset. Paths in the retained text are relative to the originating project/package unless stated otherwise. Dated rollout notes are historical evidence, not current readiness claims. Consult the relevant contract when changing its implementation; generic agent workflow is governed by AGENTS.md.

## Relationship to Hub Module

- Module ID: `workouts` (in `@mylife/workouts`)
- The standalone app imports business logic from `@mylife/workouts`
- Hub `(workouts)` routes still ship inside `apps/mobile/app/(workouts)/` - DoWork is additive, not a replacement
- Both share `WK_*` tokens from `@mylife/workouts/ui` (DoWork overlays its own `DW_*` brand tokens on top for accent + surface palette)
- DoWork strips cross-module insights (`detectMoodLiftCorrelation`, `detectFastingPerformance`, `detectProteinRecovery`) - keeps workout-internal detectors only
- DoWork uses its own `dowork.db` and its own Supabase project (separate from BestChef's `bc_*` cloud schema)


## Cloud Architecture

DoWork ships with a server-backed cloud layer for auth, social, the trainer platform, coaching, monetization, and push. See `docs/runbooks/dowork-supabase-setup.md` for project provisioning. All entitlement is enforced server-side (RLS + edge functions); the client mirrors those rules for UX but never gates alone.

- **JWT split (BK-1):** user-facing functions (`dowork-upload-finalize`, `dowork-delete-account`, `dowork-redeem-invite`, `dowork-playback-url`) rely on gateway JWT verification and MUST NOT deploy `--no-verify-jwt`; machine-caller functions (`dowork-rc-webhook`, `dowork-notify`) authenticate via their own shared-secret header, not a user JWT, and MUST deploy `--no-verify-jwt`. Encoded in `apps/dowork/scripts/deploy-functions.sh` and declaratively in `supabase/config.toml [functions.*]`.

- **Auth:** anonymous-first (Supabase `signInAnonymously`), upgradeable via email magic link
- **Social tables:** `dw_workout_shares`, `dw_likes`, `dw_comments` with RLS (public + owner read, owner write)
- **Trainer platform:** `dw_trainers` + `dw_trainer_videos` (invite-only creation; the DB paywall `dw_trainer_videos_select_entitled` grants a premium video on 4 paths: free, owner, active subscription, active client link). `dw_trainer_invites` is service-role only (no enumeration).
- **Coaching loop:** `dw_client_links`, `dw_form_checks`, `dw_form_feedback` (participants-only RLS); join goes through the `dw_redeem_client_invite` security-definer RPC (codes are never selectable).
- **Monetization:** `dw_trainer_subscriptions` + append-only `dw_purchase_events` (service-role only) written by `dowork-rc-webhook`; earnings read through the `dw_get_trainer_earnings` RPC, never the raw ledger.
- **Playback:** `dowork-playback-url` re-checks entitlement and mints a 60-minute signed URL; `dw_video_view_marks` dedups view counts (service-role only).
- **Push:** `dw_push_tokens` (owner CRUD) + `dowork-notify` (internal-secret Expo fan-out) for new videos, form checks, and feedback.
- **Moderation:** `dw_reports` + `dw_moderation_decisions` (audited; service-role-only writes for decisions)
- **Storage:** signed uploads via `dowork-upload-finalize` (`trainer_video` / `form_check` / avatars / share media); form checks land in the private `dowork-form-checks` bucket with participant RLS.
- **Account deletion:** `dowork-delete-account` cascades all `dw_*` tables + storage prefixes + the auth user; the client also wipes offline downloads (FS sandbox, outside the db).
- **Offline downloads:** entitled trainer videos download to the app sandbox (`downloads.ts`), keyed by video id with a `hub_settings` KV index; entitlement is re-verified at open and a server-confirmed revoke deletes the file honestly. A local file is never faked; an offline check keeps the file the user already owned.


## Public Launch Policy

`getDoWorkCloudConfig()` enforces:
- Public-launch builds (`EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH=1` or `NODE_ENV=production`) must use a production Supabase project unless an internal-build override is explicit
- Supabase URL must be HTTPS
- Auth redirect URLs must use the `dowork://`, `https://`, or Expo dev schemes
