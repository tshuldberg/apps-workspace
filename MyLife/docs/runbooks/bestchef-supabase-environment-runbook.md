# BestChef Supabase Environment Runbook

Date: 2026-04-26

Status: Staging inventory captured. Production environment is not ready.

## Current Inventory

Captured with Supabase CLI `2.75.0` and EAS CLI `18.4.0`.

| Area | Staging | Production | Status |
|------|---------|------------|--------|
| Supabase project | `BestChef Staging`, ref `tcikvihyjetsfkjjpljv`, West US Oregon | No separate BestChef production project visible in `supabase projects list` | Production blocked |
| Linked project | Linked to `tcikvihyjetsfkjjpljv` | Not linked | Production blocked |
| Migrations | Remote matched local through `20260426000007_bestchef_account_lifecycle` at inventory time. Local `20260426000008_bestchef_account_deletion_worker` now needs push. | Not configured | Staging needs 00008 push |
| Edge Functions | `supabase functions list` returned none at inventory time | Not configured | Deployment blocked |
| Local functions dir | Local scaffolds exist for provider broker, account deletion, media upload, and media finalize | Not configured | Local scaffold ready |
| Storage config | Supabase Storage enabled in `supabase/config.toml` with local private BestChef media buckets | Not configured | Hosted bucket creation still required |
| Storage buckets | Not captured by current CLI inventory | Not configured | Dashboard or Management API capture required |
| Auth site URL | `https://bestchef.app` in local config | Needs dashboard verification | Blocked on dashboard evidence |
| Auth redirect URLs | `bestchef://auth-callback`, `bestchef:///auth-callback`, `https://bestchef.app/auth/callback` in local config | Needs dashboard verification | Partially configured locally |
| Anonymous auth | Enabled in local config and staging baseline | Public launch policy still needs product decision | Internal beta only |
| EAS env development | Points to staging public URL and anon key | Not applicable | Internal only |
| EAS env preview | Points to staging public URL and anon key | Not applicable | Internal only |
| EAS env production | Points to staging public URL and anon key | No production URL or anon key configured | Public launch blocked |
| Service role secrets | Not present in Expo public env output | Production server-only secrets not configured | Correct client-side posture |

## Local Changes From This Session

- Applied `20260426000007_bestchef_account_lifecycle.sql` to linked staging with `supabase db push`.
- Added local `20260426000008_bestchef_account_deletion_worker.sql` to preserve deletion request rows after Auth user deletion. It has not been pushed in this session.
- Added `bestchef:///auth-callback` to local Supabase redirect URL config to cover Expo native URL formatting.
- Added local private Storage bucket definitions for BestChef submission images, submission videos, thumbnails, product evidence, receipt evidence, and quarantine.
- Added local Edge Function scaffolds for `bestchef-delete-account`, `bestchef-media-upload`, and `bestchef-media-finalize`; provider broker function scaffolds also exist locally.
- Added app-side guardrails:
  - Public-launch builds disable BestChef mesh sync startup.
  - Public or production BestChef builds reject staging Supabase config unless an internal-only staging override is set.
  - Explicit `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` always rejects staging Supabase config.

## Required Production Setup

1. Create `BestChef Production` Supabase project under the production owner organization.
2. Record production project ref, region, database major version, and backup tier.
3. Apply all migrations through `20260426000008`.
4. Configure Auth:
   - Site URL: `https://bestchef.app`
   - Native redirect URLs: `bestchef://auth-callback` and `bestchef:///auth-callback`
   - Web callback: `https://bestchef.app/auth/callback`
   - Email templates for sign-in, email change, and recovery
   - Apple Sign-In for iOS public launch if any third-party provider is enabled
   - Optional Google only after product/legal approval
5. Configure Storage buckets for submission images, submission videos, thumbnails, product evidence, receipt evidence, and quarantine.
6. Deploy Edge Functions for signed upload/finalize, provider broker, moderation actions, account deletion, cleanup, and rate limits. Current local scaffolds:
   - `bestchef-delete-account`
   - `bestchef-media-upload`
   - `bestchef-media-finalize`
   - `bestchef-vision`
   - `bestchef-nutrition`
   - `bestchef-product-identity`
7. Configure production EAS environment:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_BESTCHEF_CLOUD_ENV=production`
   - `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` only for public release candidate builds
8. Keep all service-role secrets server-side only in Supabase or server job secret stores.

## Internal Beta Override

If a production-mode TestFlight build must temporarily point to staging for internal testing, set:

`EXPO_PUBLIC_BESTCHEF_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD=1`

Do not set this for public release candidate, public beta, or GA builds. It is ignored when `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1`.

## Evidence Still Needed

- Supabase production project screenshot or CLI evidence.
- Auth provider dashboard screenshots.
- Storage bucket list and policies.
- Edge Function deploy list and versions.
- EAS production env screenshot or CLI export showing production URL only, with anon key redacted in release evidence.
- RLS smoke test output for anonymous, durable authenticated user, moderator, admin, and unauthenticated public reader.
- Staging rollback drill for migration and Edge Function deploys.
