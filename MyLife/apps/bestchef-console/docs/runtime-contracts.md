# bestchef-console runtime contracts

Preserved from `MyLife/apps/bestchef-console/CLAUDE.md` during the September 5, 2026 instruction reset. Paths in the retained text are relative to the originating project/package unless stated otherwise. Dated rollout notes are historical evidence, not current readiness claims. Consult the relevant contract when changing its implementation; generic agent workflow is governed by AGENTS.md.

## Rules (binding)

- **Service-role isolation is the reason this app exists.** All data access is
  server-side through `lib/supabase-admin.ts` (`server-only`). Never add
  `NEXT_PUBLIC_*` env vars, client-side Supabase, or client components that
  receive secrets. Never merge this surface into `apps/web` or `apps/bestchef`.
- **Auth**: Supabase magic link/OTP + email allowlist
  (`BESTCHEF_CONSOLE_MODERATOR_EMAILS`, fail closed). Every page AND every
  server action must call `requireModerator()`; middleware alone is not the
  gate.
- **Decisions go through the existing RPCs** (`bc_apply_moderation_decision`,
  `bc_resolve_appeal`), never direct status writes to content tables. Flag and
  photo-report bookkeeping rows are the only direct table updates.
- **Attribution**: always pass `console_moderator` metadata through
  `lib/actions-shared.ts` `applyModerationDecision`; do not call the RPC
  directly from actions.
- **Statement of reasons**: required for reject/hide/remove and for every
  appeal resolution (DSA Art. 20).
- The console UI is intentionally English-only (internal ops tool). Do NOT add
  strings to the consumer app's 21-catalog i18n corpus from here.
- No new SQL: if the console seems to need a migration, that work belongs to
  plan 33 phases, not this app.


## Aggregate metrics (plan 45 item 2.5)

The `/metrics` page (moderators/founder only, same allowlist gate as every
other page) reads `bc_daily_metrics`: a privacy-respecting, aggregate-only
launch counter table. It is the honest analytics posture for a privacy-first
suite that otherwise defaults to zero analytics and zero telemetry.

**What is counted** (aggregate daily integers, one row per `(day, metric)`):

| metric | incremented when |
|--------|------------------|
| `accounts_created` | a profile's FIRST BestChef terms acceptance (BestChef-specific; `social_profiles` is suite-shared so it is not the signal) |
| `submissions` | a new pending submission is enqueued for moderation |
| `votes` | an accepted vote is recorded (also an engagement proxy) |
| `reports` | a content report is filed |
| `appeals` | a moderation appeal is filed |
| `push_registrations` | a push token is registered/refreshed (coarse push-enabled activity, not distinct devices) |
| `account_deletions` | a NEW deletion request is created (idempotent re-taps are not counted) |

Each increment is a side effect inside an existing server-side `SECURITY
DEFINER` chokepoint (the vote/submission/report/appeal/push/deletion RPCs and
the terms-acceptance trigger), via `bc_bump_metric(metric)`. That helper is
exception-swallowing, so a metrics failure can never abort or roll back the
business action that triggered it.

**What is deliberately NOT collected**: no device identifiers (IDFA/GAID/IP/
user-agent), no per-user event trail (we record only that a counted action
happened on a UTC day, never who did it), no client-side tracking SDK (app
clients are untouched by this feature), and no distinct-user DAU/MAU table.
Engagement is proxied by the raw votes/submissions counts and labelled as such.

This is the only exception to the "no new SQL" rule above: the counter table,
`bc_bump_metric`, and the metric tails live in a single plan-45 migration
(`supabase/migrations/20260711000011_bestchef_aggregate_metrics.sql`), not in
this app. The console only READS the table through the service-role client.
The metric tails were added as faithful copies of the existing definer
functions plus one `perform bc_bump_metric(...)` line each; the vote path
(`bc_cast_vote`) is a clause-for-clause copy of the v5 body from migration
`20260711000003` plus that single tail.
