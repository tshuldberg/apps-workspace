# Runbook: MyNews service incident

## Purpose

Restore the MyNews service when it is degraded or down, without breaking the invariants that make the product honest: the server never composes an author's words, safety removals are never quietly reversed, and no ledger row is ever rewritten. This runbook covers publishing and reading failures, worker stoppages, moderation queue backlogs past SLA, and support-rail failures. Credential exposure or unauthorized access goes to [breach.md](breach.md) instead. An external dependency failing goes to [vendor-outage.md](vendor-outage.md).

## Severity

| Sev | Definition | Examples |
| --- | --- | --- |
| S1 | A safety lane is not moving, or removed content is publicly reachable | `mynews-ncii-worker` down with overdue `nw_ncii_cases`; a child-safety report past its 24h deadline; a retracted article still served |
| S2 | The product is unusable for a whole role | Publishing 5xx for every journalist; reader feed empty; moderators locked out of the console |
| S3 | One capability degraded, with a correct fallback | Support checkout returning 503; screening vendor unconfigured so everything routes to human review |
| S4 | Cosmetic or single-user | One article's OpenGraph tag wrong |

An S1 is the only severity that justifies bypassing the normal deploy path, and even then only through `scripts/mynews-rollback.sh`, never a hand-edited function in the Supabase dashboard.

## Detection signals

Name the signal, do not guess.

1. **`mynews-health`, which has two modes and you almost always want the second one.**
   - **Shallow, no credential.** `GET $MYNEWS_FUNCTIONS_URL/mynews-health` returns `{"ok":true,"data":{"status":"ok"|"degraded","checkedAt":...,"detailAvailable":bool}}` on HTTP 200. It deliberately carries **no component names at all**, because an unauthenticated payload naming which subsystem is weak is a targeting signal. So this mode tells you *that* something is wrong, never *what*. Do not go looking for component names in it.
   - **Detailed, worker secret.** Send `MYNEWS_HEALTH_SECRET` in the `X-MyNews-Worker-Secret` header (or add `?detail=1`, which requires the same secret) to get the full typed component list with queue depths, queue ages, and worker heartbeats. This is the mode that actually diagnoses. Two refusals to know apart: `detail-unavailable` on HTTP 503 means `MYNEWS_HEALTH_SECRET` is unset on the deployment, so detail is not being served to anyone; `unauthorized` on HTTP 401 means your secret is wrong. Neither ever degrades into serving detail unauthenticated.
   - **`status` on a 200 is only `ok` or `degraded`.** `degraded` means at least one component is unhealthy while the surface still serves. A snapshot the function cannot read is `health-unavailable` on HTTP **503**, never a healthy-looking 200, which is why `scripts/mynews-smoke.sh` fails that case on the status code before it ever reads the body.
   - Read `supabase/functions/mynews-health/index.ts` for the current component list before quoting a component name in an incident channel: the envelope shape is stable, the component list is code.
2. **Smoke script.** `bash scripts/mynews-smoke.sh` gives four binary answers in under a minute: health status, the publish JWT gate, the report JWT gate, and the account-worker secret gate. A `SMOKE FAILED` line names which probe failed and the HTTP code it got.
3. **Structured logs.** Filter Supabase edge logs on `service=mynews-edge`. Then:
   - `outcome=threw` on any `fn` is an unhandled exception and always a bug.
   - `outcome=config` with status 503 means an environment variable or `nw_job_config` row is missing. This is the fail-closed path working, and the fix is configuration, not code.
   - Rising `durationMs` p95 on `fn=mynews-publish` or `fn=mynews-suggest` usually means database contention, not edge slowness.
   - `requestId` is the correlation key when a journalist reports "my publish failed at 14:32".
4. **Console pages, which are the human-visible backlog.** `apps/mynews-console/app/`:
   - `/queue` reports and moderation actions, with assignment and escalation controls.
   - `/ncii` the urgent lane: NCII (48h) and child-safety (24h) cases.
   - `/dmca` and `/dmca/[kind]/[id]` takedown notices and counter-notices.
   - `/screening` pre-publication holds and appeals.
   - `/verification` journalist verification decisions.
   - `/support` the support-ledger reconciliation runs.
   A page that renders but shows a growing count with no assignments is a staffing incident. A page that will not render at all is usually a console environment problem: `MYNEWS_CONSOLE_SUPABASE_SERVICE_ROLE_KEY` or `MYNEWS_CONSOLE_MODERATOR_EMAILS` unset makes the console fail closed and redirect everyone to `/login`, which looks identical to an outage from the outside.
5. **SLA data.** `nw_report_sla` is the seeded deadline table: `child-safety` 24h `urgent`, `ncii` 48h `urgent`, `threats` / `violence` / `self-harm` 24h, `doxxing-privacy` 48h, `hate` / `harassment` / `impersonation` / `fraud-scam` 72h, `spam` 168h, `copyright` 240h. Any triage claim about "past SLA" must be checked against this table, not against memory.

## Triage, in order

1. **Confirm it is real and scope it.** Run `scripts/mynews-smoke.sh`. If every probe passes, the edge surface and JWT gates are alive, and the problem is narrower than "MyNews is down": most likely one function, one console page, or the database.
2. **Ask whether a safety lane is affected.** Open `/ncii` in the console and check for overdue cases. `nw_ncii_cases` is service-role only and append-only, and `nw_reconcile_urgent_case` reads both the lane and the deadline from `nw_report_sla`. If the urgent lane has overdue unresolved cases, this is S1 and the removal backstop takes priority over everything else, including restoring publishing.
3. **Establish what changed.** `git log --oneline -20` on the deployed ref, and check whether the last action was a deploy, a migration, a secret rotation, or a console config change. `scripts/mynews-deploy.sh` prints a per-function summary, so the deploy log tells you exactly which functions moved.
4. **Separate configuration from code.** A 503 with `outcome=config` is configuration. Cross-check the variable against `apps/mynews/docs/ENV_MATRIX.md`, which names every file that reads it. Never "fix" a config 503 by removing the guard.
5. **Check the database directly if the DETAILED health payload says the database component is unhealthy.** The shallow payload cannot tell you this, so fetch detail with `MYNEWS_HEALTH_SECRET` first. Then Supabase dashboard, then connection count, then long-running queries. The MyNews write paths that hold the most locks are `nw_publish_*` and `nw_account_deletion_dispose` (which does an entire account disposition in one transaction).
6. **Check the workers.** `nw_worker_runs` (migration `20260730000012`) holds one heartbeat row per pass for `mynews-ncii-worker`, `mynews-account-worker`, and `mynews-support-worker`. Read it first:
   ```sql
   select worker, ok, started_at, processed, failures, detail
   from public.nw_worker_runs
   order by finished_at desc limit 20;
   ```
   A worker that has never written a row reports UNKNOWN, never OK, so a silent worker cannot read as a healthy one. Cross-check against the cadence: `nw_run_ncii_worker()` every 10 minutes, `nw_run_account_worker()` hourly, `nw_run_support_worker()` daily. Then distinguish the two ways a worker goes quiet, which look identical from the outside:
   - **Not configured.** All three cron callers are deliberate no-ops when `nw_job_config` lacks `functions_base_url` or the matching secret row (`ncii_worker_secret`, `account_worker_secret`, `support_worker_secret`). Confirm those rows exist before escalating anything.
   - **Configured but failing.** Filter the edge logs on `fn=mynews-ncii-worker`, `fn=mynews-account-worker`, or `fn=mynews-support-worker`. An `outcome=config` with 503 means the function's own secret variable is unset, which is a different failure from the `nw_job_config` row being unset, and both have to be true for a worker to run.
7. **Check the support rail only after the above.** A support failure costs money, not safety. `mynews-support` fails closed with 503 when `nw_consume_support_rate_limit` errors and returns 429 on refusal, both before any Stripe call. `nw_support_ledger` is append-only by trigger, so a reconciliation mismatch reported on `/support` is an engineering signal, never something to "correct" by writing a row.

## Decision points

- **Roll back or fix forward?** Roll back when the last deploy is the likely cause and no migration landed with it. Use `scripts/mynews-rollback.sh --to <ref>`. It refuses to run when HEAD has migration files the target ref lacks, unless you pass `--i-have-a-database-plan`, because the schema cannot be walked back automatically. Fix forward when a migration is in the mix, because a code rollback across a schema change is a second incident.
- **Disable a capability or leave it failing?** The capability detectors are affirmative: unsetting `MYNEWS_PAYMENTS_ENABLED` (site) or shipping the app flag off turns the support rail off cleanly, and the legal bundle stops publishing the platform-fee claim in the same move. That is a legitimate mitigation. There is no equivalent switch for publishing or for the safety lanes, and inventing one would be worse than the outage.
- **Restore content that a hold or removal took down?** Only a human, in the console, with explicit confirmation. The default for an NCII or child-safety case is keep-removed, and the worker never clears. A screening hold is cleared by an approval that issues a `nw_screening_allowances` row keyed on author plus sha256, which is what makes the author's identical resubmission go through. Do not clear a hold by editing content status directly.
- **Escalate to founder-ops?** Anything requiring the Supabase dashboard, secret values, PITR, cron configuration, a vendor account, NCMEC, or counsel. See the closing section.

## Escalation

1. On-call engineer runs triage steps 1 through 4.
2. S1 or S2 pages the founder immediately, because every remediation that touches the live project is founder-ops.
3. A safety-lane S1 also pulls in whoever is covering moderation, since the console decisions are human by design and cannot be automated around.
4. Suspected unauthorized access at any point stops this runbook and starts [breach.md](breach.md).

## Communication template

Internal, at detection:

```
MyNews incident, Sev <1-4>, started <UTC timestamp>
Symptom:        <what a user cannot do>
Signal:         mynews-health status=<ok|degraded|down>; smoke=<PASSED|FAILED n of m>
Scope:          <functions / surfaces / roles affected>
Safety lanes:   <clear | N overdue urgent cases>
Suspected:      <deploy <sha> | migration <file> | config <VAR NAME> | vendor <name> | unknown>
Owner:          <name>
Next update:    <UTC timestamp, 30 min for S1/S2>
```

External, only when a user-visible surface is affected. Say what is broken and what is not, never a cause you have not confirmed:

```
Some parts of MyNews are not working right now: <plain description>.
<What still works.> We are working on it and will update this notice by <time>.
```

For a safety-lane S1, do not publish a notice that implies reports are being handled if they are not. If the urgent lane is stalled, the honest statement is that report review is delayed, with the expected recovery time.

## Recovery verification

Do all four. A green health check alone is not recovery.

1. ```bash
   MYNEWS_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1 \
   MYNEWS_SMOKE_ANON_KEY=<publishable anon key> \
   bash scripts/mynews-smoke.sh
   ```
   Expect `SMOKE PASSED (4 probes)`. A 200 from `mynews-publish` here means the JWT gate is off, which is a breach, not a recovery.
2. Structured logs for the affected `fn` show `outcome=ok` on fresh traffic, and no `outcome=threw`.
3. The console page that showed the backlog is draining: `/queue`, `/ncii`, `/dmca`, or `/screening`, with counts moving in the right direction and no case past its `nw_report_sla` deadline.
4. If the support rail was involved, invoke `mynews-support-worker` once with its worker secret and confirm the new `nw_support_reconciliation_runs` row reports ok. A run that could not write its own row reports not-ok on purpose, because a passing row it could not persist would be a lie.

Then write the incident into `errors_log.md` with an absolute date and an honest status, and link a session log under `docs/sessions/` for anything that took real investigation.

## What is founder-ops here

None of the following can be done from this repository, and no script in it pretends otherwise:

- Setting or rotating any secret (`supabase secrets set`), including the three worker secrets and `MYNEWS_DMCA_RATE_SALT`.
- Writing or repairing `nw_job_config` rows and the pg_cron schedules that drive `nw_run_ncii_worker` and `nw_run_account_worker`.
- Anything in the Supabase dashboard: connection limits, compute size, log retention, PITR.
- Stripe, RevenueCat, App Store, and Play configuration.
- Moderation staffing and on-call coverage. The urgent lane's 24h and 48h deadlines are human deadlines; no code change shortens them.
- NCMEC CyberTipline submission. The vendor relationship is not onboarded, so `MYNEWS_NCMEC_CYBERTIPLINE_URL` and `MYNEWS_NCMEC_CYBERTIPLINE_CREDENTIALS` are unset and the worker records a pending human-review state rather than inventing a report reference. Submission is a manual founder action today.
- Public status page wording and any legal or regulatory notification.
