# BestChef Moderator Console

Internal trust-and-safety console for BestChef (plan 33 Phase 1.3). A separate
minimal Next.js app, deliberately NOT part of the consumer hub web app: it runs
with the Supabase service-role key server-side and needs its own deploy target,
env, and access gate so that key can never reach a consumer bundle.

## What it does

- **Overview**: queue counts, `bc_job_health()` panel (config rows, pg_cron and
  pg_net, scheduled jobs, rankings freshness, deletion backlog, quota engine),
  ops levers (social-write kill switch, provider kill switch, per-action
  durable caps).
- **Vote proofs**: `bc_moderation_queue` kind `vote_proof` with cross-user
  hash-reuse flags, private evidence via short-lived signed URLs, one-click
  approve or reject through `bc_apply_moderation_decision` (rejection requires
  a DSA statement of reasons).
- **Reports**: open `bc_flags` (with target labels) and `bc_photo_reports`;
  content decisions through the same RPC; flag and report bookkeeping updated
  in the same action.
- **Appeals** (DSA Art. 20): open `bc_appeals` with the original decision;
  resolution via `bc_resolve_appeal` (statement of reasons required); on
  overturn the console composes the separate decision-RPC call that reverses
  the enforcement.
- **Language filter**: queues carry a language column and filter; values
  activate when plan 33 Phase 2.5 lands UGC language tagging.

## Security model

- All Supabase access is server-side. There are no `NEXT_PUBLIC_*` env vars,
  no client-side Supabase, and `lib/supabase-admin.ts` is `server-only`.
- Sign-in: Supabase Auth magic link or 6-digit code (founder decision
  2026-07-03). `shouldCreateUser` is false (founder decision 2026-07-03):
  the console never creates accounts, so a new moderator's auth account must
  exist first (dashboard pre-provisioning). Authorization is a server-checked
  email allowlist (`BESTCHEF_CONSOLE_MODERATOR_EMAILS`); empty allowlist
  admits nobody. Login responses are floored to a minimum latency so timing
  does not leak allowlist membership.
- The gate runs three times: middleware, `requireModerator()` in every page,
  and `requireModerator()` in every server action. Requests with no Supabase
  auth cookie are redirected without an auth-server round trip.
- Sign-out (and callback rejection) uses `scope: 'local'` so console session
  handling never revokes the moderator's consumer-app sessions on the shared
  project.
- Decision targets are always derived server-side from the authoritative
  `bc_flags`/`bc_appeals` row; form fields cannot choose what gets enforced.
  Appeal overturns reverse content BEFORE resolving the appeal, so a failed
  reversal stays retryable.
- Ops-lever updates assert exactly one row changed; a missing control row
  fails loudly instead of a kill switch silently no-oping.
- `bc_is_admin()` accepts the service role, so decision RPCs work as-is.
- Moderator attribution: RPCs record `actor_profile_id` null under service
  role, so every decision this console makes carries
  `metadata.console_moderator = <email>`. Known limitation: appeal rows
  record `resolved_by` null when upheld with no reversal decision; the
  statement of reasons is still recorded.
- Pages render only machine error codes (sanitized); raw PostgREST detail
  goes to server logs. Anti-framing headers (`frame-ancestors 'none'`,
  `X-Frame-Options: DENY`) are set explicitly.

## Setup

1. `cp .env.example .env.local` and fill values (staging ref
   `tcikvihyjetsfkjjpljv`, prod ref `zjxabnazbdocrqpyixgo`).
2. Supabase dashboard, Auth, URL Configuration: add
   `<BESTCHEF_CONSOLE_ORIGIN>/auth/callback` to Redirect URLs (magic-link
   path). The 6-digit code path works without it if the email template
   includes `{{ .Token }}`.
3. `pnpm --filter @mylife/bestchef-console dev` (port 3105).

## Commands

```bash
pnpm --filter @mylife/bestchef-console dev        # dev server :3105
pnpm --filter @mylife/bestchef-console test       # vitest (pure lib logic)
pnpm --filter @mylife/bestchef-console typecheck
pnpm --filter @mylife/bestchef-console build
```

## Deploy (founder-ops)

Deploy separately from the consumer web app (own Vercel project or host), set
the five `BESTCHEF_CONSOLE_*` env vars, and keep the deployment private
(allowlist is the gate; consider network-level protection on top). Never add
this app to any consumer routing layer.
