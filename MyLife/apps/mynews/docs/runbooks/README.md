# MyNews operational runbooks

Operational runbooks for the MyNews server surface: 18 `mynews-*` Supabase edge functions, the `nw_*` Postgres schema, the public site (`apps/mynews-web`), the moderation console (`apps/mynews-console`), and the Expo app (`apps/mynews`).

These are written against this repository's actual architecture. Every table, function, console page, environment variable, and command named here exists in the tree, or is called out explicitly as not existing yet.

| Runbook | Use it when |
| --- | --- |
| [incident.md](incident.md) | The service is degraded or down: publishing fails, the reader surface is empty, a worker stopped, a queue is aging past its SLA. |
| [vendor-outage.md](vendor-outage.md) | An external dependency is failing: Supabase, Stripe, RevenueCat, the screening vendor, the NCII hash vendor, NCMEC. |
| [backup-pitr-restore-drill.md](backup-pitr-restore-drill.md) | You need to verify backups, plan a restore, or run the periodic restore drill. |
| [breach.md](breach.md) | Credential exposure, unauthorized data access, service-role key leak, moderator account compromise, or a suspected data exfiltration. |

## Shared facts every runbook assumes

**Edge functions.** `supabase/functions/mynews-*`. Derive the live list at runtime; do not trust a copied list:

```bash
ls -d supabase/functions/mynews-*/ | xargs -n1 basename
```

Today that is `mynews-account`, `mynews-account-worker`, `mynews-comment`, `mynews-dmca`, `mynews-health`, `mynews-my-notices`, `mynews-ncii-worker`, `mynews-payments-webhook`, `mynews-publish`, `mynews-register-key`, `mynews-report`, `mynews-review`, `mynews-screening`, `mynews-set-meta`, `mynews-suggest`, `mynews-support`, `mynews-support-worker`, `mynews-verification`.

**Structured logs.** Every instrumented edge function emits one JSON line per request through `supabase/functions/_shared/mynews-observability.ts` with `service: "mynews-edge"` plus `fn`, `action`, `outcome`, `durationMs`, and `requestId`. `outcome` is the typed envelope code from our own source (never user input), `ok` on success, `threw` when a handler throws, and `no-response` when it returns nothing. Filter on `service=mynews-edge` first, then narrow by `fn` and `outcome`. A client that sent `x-request-id` gets it echoed back through `requestId`, which is the only reliable way to correlate one user report with one log line.

**JWT posture.** `supabase/config.toml` is the source of truth. `verify_jwt = false` is declared only for `mynews-ncii-worker`, `mynews-account-worker`, `mynews-support-worker`, and `mynews-payments-webhook`. Those four authenticate themselves: the three workers compare `X-MyNews-Worker-Secret` against their own secret, and the webhook verifies the Stripe signature. Everything else relies on gateway JWT verification. If an unauthenticated request ever succeeds against a user-facing function, treat it as a breach, not an incident.

**Worker cadence.** `nw_run_ncii_worker()` (every 10 minutes) and `nw_run_account_worker()` (hourly) are pg_cron plus pg_net callers that read `functions_base_url` and the worker secret from `nw_job_config`. Both are no-ops when those rows are absent, by design.

**Signals available as of 2026-07-30, all landed in the same work package as these runbooks:**

- `nw_worker_runs` (migration `20260730000012`) holds one heartbeat row per worker pass, written by `recordWorkerRun` in `_shared/mynews-observability.ts`. `mynews-ncii-worker`, `mynews-account-worker`, and `mynews-support-worker` all write it. A worker that has never written a row reports UNKNOWN in the console, never OK, so a silent worker cannot read as a healthy one.
- `nw_run_support_worker()` (same migration) schedules `mynews-support-worker` daily. Like its two siblings it is a no-op until founder-ops writes the `functions_base_url` and `support_worker_secret` rows in `nw_job_config`, so an unconfigured project makes no call rather than a failing one.
- `supabase/functions/mynews-health` is live. Its shallow payload (`{status, checkedAt}`) is public so an uptime probe works without a credential; the detailed payload (queue depths, ages, worker heartbeats) needs `MYNEWS_HEALTH_SECRET` in the `X-MyNews-Worker-Secret` header. With that secret unset the detailed payload is UNAVAILABLE (503) rather than open.
- Structured logs: every `mynews-*` function emits one JSON line per request with `service=mynews-edge` plus `fn`, `action`, `outcome`, `status`, `durationMs`, and `requestId`. Filter the Supabase Logs Explorer on those fields. There is no email, IP, token, URL, or request body in a log line by construction, and a canary test enforces that, so do not go looking for user identifiers there; correlate on `subjectHash` instead.

**Still founder-ops, so no runbook step may assume it:** `nw_job_config` rows and pg_cron schedules against a live project, `MYNEWS_HEALTH_SECRET` and every worker secret being set with `supabase secrets set`, and PITR configuration.

**Verification command after every recovery, in every runbook:**

```bash
MYNEWS_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1 \
MYNEWS_SMOKE_ANON_KEY=<publishable anon key> \
bash scripts/mynews-smoke.sh
```

It probes health, proves the JWT gate refuses an unauthenticated publish and report with 401, and proves `mynews-account-worker` refuses a call with no worker secret. It exits non-zero if any probe fails and prints `SMOKE FAILED (n of m probes failed)`. There is no flag that makes it pass without passing.

**Environment.** `apps/mynews/docs/ENV_MATRIX.md` is generated from source and lists every variable, which surface reads it, the files that read it, whether it is a secret, and what it does. Regenerate with `node scripts/gen-mynews-env-matrix.mjs`; verify with `pnpm check:mynews-env-matrix`.

## Format choice

These are Markdown only. The repository rule that a report gets a same-basename HTML twin applies to reports, reviews, audits, and long-form findings documents. Runbooks are operational procedure read during an incident, where a browser-rendered snapshot is a liability: it goes stale silently and gives no indication that the Markdown next to it moved on. One canonical file per runbook, versioned in git, is the correct artifact.
