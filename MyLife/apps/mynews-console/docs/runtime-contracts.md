# mynews-console runtime contracts

Preserved from `MyLife/apps/mynews-console/CLAUDE.md` during the September 5, 2026 instruction reset. Paths in the retained text are relative to the originating project/package unless stated otherwise. Dated rollout notes are historical evidence, not current readiness claims. Consult the relevant contract when changing its implementation; generic agent workflow is governed by AGENTS.md.

## Rules (binding)

- **Service-role isolation is the reason this app exists.** All data access is
  server-side through `lib/supabase-admin.ts` (`server-only`). Never add
  `NEXT_PUBLIC_*` env vars, client-side Supabase, or client components that
  receive secrets. Never merge this surface into `apps/mynews-web` or
  `apps/mynews`.
- **Auth**: Supabase magic link/OTP + email allowlist
  (`MYNEWS_CONSOLE_MODERATOR_EMAILS`, fail closed). Every page AND every server
  action must call `requireModerator()`; middleware alone is not the gate.
- **Enforcement goes through the SECURITY DEFINER RPCs** from migration
  `20260705000007` (`nw_moderate_hide_article`, `nw_moderate_hide_suggestion`,
  `nw_moderate_suspend_profile`, `nw_moderate_resolve_report`), never direct
  status writes to content tables. Each RPC writes an `nw_moderation_actions`
  audit row itself.
- **Target derivation**: every action derives the enforcement target
  server-side from the `nw_reports` row keyed by `reportId`. Form fields never
  choose the target (hidden-field tampering guard).
- The console UI is intentionally English-only (internal ops tool).
- No new SQL here: enforcement schema/RPCs live in the migration, not this app.
- **Three auth gates, never fewer** (plan 48 WP9): email allowlist, then MFA
  (aal2), then an active role in `nw_moderator_roles`. `requireModerator()`
  returns a `ModeratorContext` (email, role, level) and redirects to `/login`,
  `/mfa`, or `/no-role`. **There is no MFA bypass and none may be added**: no env
  var, header, or build flag, and deliberately no local-development escape hatch
  (TOTP needs no vendor to work locally). `/mfa` and `/no-role` are the only two
  pages a below-aal2 or role-less session may reach, and both re-check the session
  themselves.
- **Every enforcement goes through one transactional RPC** from migration
  `20260730000010` (`nw_console_enforce_report`, `_ncii`, `_dmca`, `_screening`,
  `_verification`, `nw_console_dispose_moderation_appeal`). Never call the
  underlying `nw_moderate_*` RPCs from an action again: the wrapper is what adds
  the role floor, the required reason, the version check, the replay-token claim,
  the dual-control interception, the rollback of a partial multi-step failure, and
  the hash-chained audit row. Adding a new console action means adding a case
  inside a wrapper, not a new direct call.
- **Every enforcement form carries three hidden fields**: the row's
  `console_version`, a per-render idempotency `token`, and a required `reason`.
  Use `IntegrityFields` + `ReasonField` from `app/components/integrity.tsx` so a
  new form cannot forget one. A version that moved is a typed `stale-action`; a
  resubmitted form is `replayed`.
- **Role policy lives in SQL.** `lib/roles.ts` is the UI's copy, pinned to the
  migration by `lib/__tests__/console-policy.test.ts`. Change one, change both, or
  the test fails.
- **Dual control is a table CHECK, not a UI rule.** Suspensions over 7 days,
  terminations, restorations, and payout block/unblock become
  `nw_pending_actions` rows that a *different* moderator approves; the constraint
  `nw_pending_actions_second_moderator` refuses a self-approval even from a caller
  that skipped the RPC. The moderator whose decision is under appeal cannot decide
  that appeal (`same-moderator`).
- **`nw_console_audit` is append-only and hash-chained**, and records refusals as
  well as successes. Never write it directly: `nw_console_audit_append` is the
  only writer. `lib/audit-chain.ts` verifies an export independently of the
  database that produced it; keep it in step with `nw_console_audit_row_hash`.
- **Queues paginate by keyset, never OFFSET**, and every value that reaches a
  PostgREST filter goes through `lib/pagination.ts` first. supabase-js does not
  quote filter values, so an unsanitised cursor or search term can add a filter of
  its own.
- **Appeals are one queue over two sources.** Moderation-action appeals live in
  `nw_moderation_appeals`; screening appeals stay on the WP8
  `nw_screening_decisions` row. `/appeals` reads the `nw_console_appeals` view and
  dispatches each disposition back to its own source's RPC. Do not copy screening
  appeal state into a second table.
- Live behavioural proof: `supabase/tests/nw_console_integrity.sql` (rolls back)
  via `pnpm check:mynews-console-integrity`. It covers concurrency, replay,
  partial-failure rollback, dual control, compromised-moderator containment,
  recovery, and chain tampering.
- **`/health` is read-only by design** (plan 48 WP11). It reads `nw_health_snapshot()` with the console's own service-role client and classifies with `classifyHealthSnapshot` from `@mylife/mynews/health`, the SAME function `mynews-health` uses, so the console and the endpoint cannot disagree about what is in alarm. Import that DEEP SUBPATH, never the package barrel: the barrel reaches the signing module and `@mylife/sync`, whose entry re-exports React client hooks, and pulling it into a Server Component fails `next build`. A failed read renders an explicit unavailable banner with NO table; it never renders zeros, because an unreadable snapshot is not a quiet service. Thresholds live in `nw_health_thresholds` (service-role only) so an operator retunes them in the database, not here.
- **`/support` is read-only by design.** It surfaces `nw_support_reconciliation_runs` (the `mynews-support-worker` output: ok/mismatch counts and bounded findings) with no actions. The support ledger is append-only by database trigger, so a mismatch is an engineering signal, not something a moderator can edit away. An empty list means the worker has not run against this project, NOT that the ledger is clean, and the page says so.


## Security headers (plan 48 WP10)

- `lib/security-headers.ts` is the single source: `CONSOLE_STATIC_HEADERS` (applied to `/:path*` from `next.config.ts`) and `buildConsoleCsp()` (applied per response by `middleware.ts`, which is the only place a nonce can be minted). `lib/__tests__/security-headers.test.ts` pins both, because a header that quietly disappears from a console showing report contents and one-click enforcement is invisible in review and in the browser.
- The existing `noindex, nofollow` + `no-store` pair is load-bearing and joined by nosniff, `Referrer-Policy: no-referrer` (a console URL can name a case), a deny-everything `Permissions-Policy`, `X-Frame-Options: DENY`, COOP, CORP, and HSTS. `poweredByHeader: false` and `outputFileTracingRoot` are set too.
- `frame-ancestors 'none'` **moved out of `next.config.ts` into the middleware CSP.** Exactly one CSP header may be emitted: two are intersected by the browser rather than merged, which would have turned the next policy edit into a debugging session. Do not add a second CSP in the config.
- `connect-src` names the Supabase project origin (the auth SDK calls it from the browser) via `supabaseConnectOrigin()`, which accepts https origins only.
- `publickey-credentials-get=(self)` is the one Permissions-Policy allowance, held open for the planned moderator WebAuthn/MFA work rather than denied and then un-denied.
- A deliberate sibling of `apps/mynews-web/lib/security-headers.ts` rather than a shared package: different policies (indexed vs never-indexed, differing referrer posture), separate Next builds with no dependency between them, and a shared package would exist to hold two constants. Each is pinned by its own test.
