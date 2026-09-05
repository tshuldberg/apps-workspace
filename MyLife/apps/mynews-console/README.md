# MyNews Moderator Console

Internal trust-and-safety console for MyNews (Plan 39 T8, Track 1 Phase 3). A
moderator signs in, reviews the open content-report queue with per-target
context, and takes one of four enforcement actions. It is a separate app from
`apps/mynews-web` so the Supabase service-role key never meets a consumer
bundle.

## The enforcement layer

Reports land in `nw_reports` (migration `20260705000005`, function
`mynews-report`). This console reads the open queue and calls the enforcement
RPCs added in migration `20260705000007`:

| Action | RPC | Effect |
|--------|-----|--------|
| Retract article | `nw_moderate_hide_article` | `nw_articles.status` -> `retracted` |
| Hide suggestion | `nw_moderate_hide_suggestion` | `nw_edit_suggestions.status` -> `rejected` |
| Suspend profile | `nw_moderate_suspend_profile` | `nw_profiles.suspended_until` set |
| Dismiss report | `nw_moderate_resolve_report` | report -> `no_action` |

Every RPC is `security definer`, granted to `service_role` only (revoked from
`public`/`anon`/`authenticated`), and writes an `nw_moderation_actions` audit
row in the same call. `nw_moderation_actions` has RLS enabled with zero client
policies, so no browser session can read the trail.

### Suspension teeth

A suspended profile (`suspended_until` in the future) is blocked from
publishing, suggesting, and reporting: the `mynews-publish`, `mynews-suggest`,
and `mynews-report` edge functions call `isProfileSuspended` right after
resolving the actor profile and return a typed `suspended` 403. A lapsed
suspension reads as active again automatically.

## Auth: three gates, all of which must pass

`requireModerator()` runs on every page and every server action. Middleware is a
first pass, not the gate.

1. **Email allowlist.** `MYNEWS_CONSOLE_MODERATOR_EMAILS`, fail closed. Decides
   who may hold a console session at all. Enforced in middleware with no database
   round trip, so a database that hands out a role row still cannot admit someone
   the operator never listed.
2. **MFA (aal2).** The session's access token must carry `aal: aal2`.
3. **Role.** `nw_moderator_roles` must hold an active role for that address.

An allowlisted moderator who has not verified a second factor reaches `/mfa` and
nothing else. One who has verified but holds no role reaches `/no-role`.

### MFA has no bypass

There is no environment variable, header, request parameter, or build flag that
skips the second factor, and there is deliberately no local-development escape
hatch. TOTP needs no mail provider, no SMS vendor, and no external service, so
enrolling against a development Supabase project takes the same thirty seconds it
takes in production. An escape hatch would exist only to be forgotten in a
deployment.

`lib/auth.ts` reads the `aal` claim out of the access token that
`supabase.auth.getUser()` just verified against the auth server. Because the
signature covers the whole payload, a cookie that passes `getUser()` cannot carry
a forged `aal`. Anything unreadable, missing, or not exactly `aal2` is treated as
`aal1`.

**Lost authenticator.** An admin cannot reset another moderator's factor from the
console, on purpose: console access alone must never be able to strip someone
else's second factor. Recovery is a Supabase dashboard operation on the auth
project (delete the user's MFA factor), performed by whoever holds project
access, and it should be recorded in the operator's own change log because the
console cannot audit an action taken outside it.

## Roles

Three roles, checked in SQL by every RPC and mirrored in `lib/roles.ts` for the
UI (a drift test pins the two together):

| Role | Can do |
|------|--------|
| `reviewer` | Per-item content decisions: hide an article or suggestion, dismiss a report, approve or reject a screening hold, work the urgent queue short of clearing a case. |
| `senior` | All of the above, plus suspensions, copyright strikes, clearing an NCII case, revoking a verification badge, DMCA closure and legal posture, deciding appeals, and proposing dual-control actions. |
| `admin` | All of the above, plus granting and revoking roles, payout block/unblock, and the audit export. |

An action with no registered role floor defaults to admin, so a new action is
harder to run rather than easier.

### Bootstrapping the first admin (founder-ops)

`nw_moderator_role_grant` requires an active admin, so the first one cannot be
granted through the console. `nw_moderator_bootstrap_admin` exists for exactly
that, and it works **only while no active admin row exists**; every later call
returns `admin-exists`. Run it once against the project with the service role:

```sql
select public.nw_moderator_bootstrap_admin('founder@yourdomain.example', 'initial seed');
```

Then add that address to `MYNEWS_CONSOLE_MODERATOR_EMAILS`, sign in, enrol a
factor, and grant the rest of the team from `/roles`. The bootstrap writes its own
audit row. The last active admin cannot be demoted or revoked, so the console
cannot be locked out of its own role administration.

## Dual control

Four kinds of action never complete with one moderator. Proposing records a row in
`nw_pending_actions`; a **different** moderator approves it on `/approvals`, and
the approval executes the action in the same transaction (a failed execution rolls
back and marks the proposal `failed` rather than leaving it approved-but-unapplied).

| Kind | Approver | Triggered by |
|------|----------|--------------|
| `suspend_long` | senior | A suspension over 7 days from the report queue |
| `terminate_account` | admin | A permanent suspension |
| `restore_content` | senior | The DMCA `restore_content` step |
| `payout_block` / `payout_unblock` | admin | The Payouts screen |

Self-approval is refused by a `CHECK` constraint on the table, not only by the
RPC and not only by the UI, so a caller that bypassed both still cannot do it.

Appeals use the same principle without a third person: the moderator whose
decision is under appeal cannot decide that appeal, which the RPC enforces.

## Immutable audit

`nw_console_audit` records every console action **including the refusals**: an
insufficient role, a stale version, a self-approval attempt, and a rolled-back
enforcement all leave a row, because a blocked attempt is exactly what an
investigation wants to find. It is distinct from `nw_moderation_actions`, which is
the user-facing statement-of-reasons feed.

Each row hashes the previous row's hash together with its own octet-length-prefixed
fields, and the table refuses `UPDATE`, `DELETE`, and `TRUNCATE` by trigger.
`/audit` (admin only) verifies the chain in SQL and offers a JSON export that
carries each row's exact payload text, its hashes, and the anchor hash, so a
recipient recomputes every hash without database access and without trusting the
database that produced it. `lib/audit-chain.ts` is that verifier, and the export
states the recipe.

## Concurrency, replay, and versions

Every console-facing queue row carries `console_version`, bumped by a trigger on
every update. A form renders the version it read, and the RPC refuses a version
that moved: two moderators acting on the same report produce one enforcement and
one typed `stale-action` conflict.

Every form also carries a per-render idempotency token. A resubmitted form (double
click, back button, refresh-repost) is answered `replayed` with the original
outcome instead of enforcing twice.

## Env

See `.env.example`. All `MYNEWS_CONSOLE_*`, all server-side, no `NEXT_PUBLIC_*`.

## Commands

```bash
pnpm --filter @mylife/mynews-console dev      # :3106
pnpm --filter @mylife/mynews-console test
pnpm --filter @mylife/mynews-console typecheck
pnpm --filter @mylife/mynews-console build

# Behavioural suite against a real database (rolls back; safe on any project).
DATABASE_URL=postgres://... pnpm check:mynews-console-integrity

# Adds a two-session concurrency test. Commits fixtures and leaves append-only
# audit rows behind, so ephemeral or development databases only.
DATABASE_URL=postgres://... pnpm check:mynews-console-integrity --with-concurrency
```
