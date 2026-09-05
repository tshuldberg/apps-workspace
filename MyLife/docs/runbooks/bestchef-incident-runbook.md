# BestChef Incident Runbook

Date: 2026-07-11

Scope: operational incident response for the BestChef public launch (plan 45
item 2.2, audit H14). Covers where each health signal surfaces, first-response
actions per scenario, and the backup/restore drill. BestChef is the suite's
first public consumer launch, so the observability posture here is deliberately
minimal and privacy-preserving (see "Privacy posture" below), not a full APM
stack.

This runbook assumes the reader has service-role SQL access to the production
Supabase project (`zjxabnazbdocrqpyixgo`) via the dashboard SQL editor or a
service-role client. Steps that mutate production or the hosted project are
marked FOUNDER: they require the founder to execute on the hosted project.

---

## Signal sources (where each thing surfaces)

| Signal | Where it surfaces | How to read it |
|--------|-------------------|----------------|
| App crashes / render errors | Sentry project `bestchef` (only if `EXPO_PUBLIC_BESTCHEF_SENTRY_DSN` is set in the EAS production profile) | Sentry Issues. PII-scrubbed; no user identity attached. |
| Edge function errors | Supabase Dashboard, Logs Explorer, filter by function | Each captured error is one JSON line: `{"level":"error","service":"bestchef-edge","fn":"<function>","op":"<where>","message":"...","stack":"...","timestamp":"..."}` |
| Edge function errors (mirrored) | Sentry (only if `SENTRY_DSN` is set as a function env secret) | Same errors forwarded from the edge tier, tagged `fn`. Fail-silent; the Supabase log line is the source of truth. |
| Scheduled-job + queue health | `bc_job_health()` (service-role RPC) and `scripts/check-bestchef-health.mjs` | One JSON payload with every worker's config/scheduling state plus queue depths. `healthy: true` gates a clean deploy. |
| Deploy-time config | `pnpm --filter @mylife/bestchef-app seed:job-config -- --verify` | Fails the deploy if any `bc_job_config` row is missing (missing row = silent worker no-op). |

### The health check script

`scripts/check-bestchef-health.mjs` (npm alias `pnpm --filter @mylife/bestchef-app check:health`)
is the runtime alerting primitive. It calls `bc_job_health()` once and:

- fails (exit 1) if `healthy` is false (any worker secret missing, extension
  not installed, cron job not scheduled, no action rate limits, or the provider
  kill switch is ON), naming the specific failing check;
- fails (exit 1) if any queue depth exceeds its threshold (deletion backlog and
  age, vote-proof moderation queue, media-screening queue, push outbox,
  purgeable media, expiring playback URLs);
- exits 2 if it could not run (missing `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY`, or the RPC errored), so "could not run" is
  distinguishable from "unhealthy";
- exits 0 when everything is within thresholds.

Thresholds default conservatively and are overridable via env
(`BESTCHEF_HEALTH_MAX_*`, documented in the script header). `--json` emits a
machine-readable payload including the full `bc_job_health()` result.

Required env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service-role, since
`bc_job_health()` is service-role only).

---

## Wiring the alert (FOUNDER, environment-specific)

The health script is designed so the SCHEDULER's own failure notification is
the alert. Pick one; the script itself is scheduler-agnostic. The workflow file
is intentionally NOT committed because CI wiring and secret storage are
founder-environment-specific.

### Option A: GitHub Actions (sample, do not commit as-is)

```yaml
# .github/workflows/bestchef-health.yml  (FOUNDER creates this)
name: BestChef health
on:
  schedule:
    - cron: '*/15 * * * *'   # every 15 minutes
  workflow_dispatch:
jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: bc_job_health check
        env:
          SUPABASE_URL: ${{ secrets.BESTCHEF_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.BESTCHEF_SUPABASE_SERVICE_ROLE_KEY }}
        run: node apps/bestchef/scripts/check-bestchef-health.mjs
```

A failed run emails the repo admins / posts to the configured Actions
notification channel. That is the alert. Do not put the service-role key
anywhere but GitHub encrypted secrets.

### Option B: Supabase-native (no external CI)

- Supabase Dashboard, Project Settings, Log Drains: forward function logs to a
  destination (Datadog, a webhook, an S3 bucket) and alert on the
  `"level":"error"` JSON lines from `service: bestchef-edge`.
- Or a `pg_cron` job that calls `bc_job_health()` and uses `pg_net` to POST to a
  Slack/Discord/webhook when `healthy` is false. This keeps alerting entirely
  inside the hosted project (same substrate the workers already use).

### Option C: any external cron

Run the script from any box with the two env vars set (a cron host, a Fly
machine, a serverless cron). Treat a nonzero exit as page-worthy.

---

## Triage flows

### 1. Job unhealthy (`healthy: false`)

Symptom: `check:health` exits 1 with one or more `CONFIG:` lines, or a raw
`bc_job_health()` shows `healthy: false`.

First response:
1. Read WHICH check failed from the script output (it names each one).
2. If a `config_*_secret` or `config_functions_base_url` is false: a
   `bc_job_config` row is missing, so that worker is silently no-op'ing. Re-run
   the seeder against production: `seed:job-config` with the worker secrets in
   env, then `-- --verify`. (FOUNDER: needs production service-role key +
   worker secrets.)
3. If `pg_cron_installed` / `pg_net_installed` is false: the extensions are not
   enabled on the project. Enable them in Dashboard, Database, Extensions.
   (FOUNDER)
4. If a `*_job_scheduled` is false but the extension is present: the scheduling
   migration did not run or the cron job was dropped. Re-apply the relevant
   migration; verify with `select jobname from cron.job where jobname like 'bestchef-%';`.
5. If `action_limits_enabled_rows` is 0: rate limits are off. Restore
   `bc_action_limits` rows (social spam floor). If `action_kill_switch` is ON,
   see scenario 3.

### 2. Moderation backlog spike

Symptom: `pending_vote_proof_moderation` or `pending_media_screening` over
threshold.

Where: `bc_job_health()` fields, plus the moderator console queue.

First response:
1. Confirm the worker job is scheduled and its secret is configured (scenario
   1). A backlog with a healthy config means the queue is arriving faster than
   the batch cadence drains it, not a broken worker.
2. Check the edge logs for the worker (`fn: moderate_vote_proof` or
   `fn: bestchef-media-screening`) for a `fatal: moderation_provider_config`
   error. That means the classifier providers are misconfigured and the worker
   is refusing to run rather than auto-approving (correct fail-closed
   behavior). Fix the provider env and redeploy.
3. If providers are healthy but the queue is deep, manually kick the worker
   (invoke the function with the worker secret) or temporarily raise its cron
   frequency. See `bestchef-moderation-ops-runbook.md` for decision RPCs.
4. Watch the oldest-item age; a rising backlog with correct config is a
   capacity signal, not an incident, unless it breaches the moderation SLA.

### 3. Storage / quota denials

Symptom: users report failed uploads; edge logs show provider quota or kill
switch errors; `action_kill_switch: true`.

Where: `bc_job_health().action_kill_switch`; edge logs from the provider
brokers; `bc_consume_provider_quota` ledger.

First response:
1. If `action_kill_switch` is ON, someone (or an automated guard) tripped the
   provider kill switch, blocking all provider calls. Confirm this was
   intentional. If not, clear it: `update bc_action_controls set kill_switch = false where id = true;` (FOUNDER, service-role).
2. If uploads fail with storage errors, check the bucket exists and is private
   (submission images are private as of the 20260711 storage-privacy
   migration; only `bc-avatars` is public). Verify signed-URL minting is
   working (`bestchef-url-resign` logs).
3. If provider quota is exhausted, the brokers fail-closed by design. Confirm
   the quota ceiling and provider billing; the ledger is durable in
   `bc_consume_provider_quota`.

### 4. Push failures

Symptom: `pending_push_fanout` over threshold; users not receiving pushes.

Where: `bc_job_health().pending_push_fanout`; edge logs `fn: bestchef-push-fanout`.

First response:
1. Confirm `push_fanout_job_scheduled` is true and `config_push_fanout_secret`
   is present (scenario 1).
2. Check `fn: bestchef-push-fanout` logs for Expo push send errors. A rising
   outbox with a scheduled job usually means the Expo push endpoint is
   rejecting tokens (expired/invalid) or is unreachable. The worker retries
   with attempts < 5; entries stuck at attempts = 5 are dead-lettered and stop
   counting toward the backlog.
3. If the whole outbox is backed up, invoke the fanout worker manually with its
   secret to drain, then investigate the send errors.

### 5. Crash spike (app)

Symptom: Sentry issue volume jumps, or user reports of the "Something went
wrong" screen (the app's `ErrorBoundary`).

Where: Sentry project `bestchef` (if DSN configured). Every render crash caught
by `ErrorBoundary` is reported via `captureAppException`, PII-scrubbed.

First response:
1. Group by release (`bestchef@<version>`) to see if the spike correlates with
   a specific build. If so, the offending build is identifiable for a rollback
   / hotfix decision (FOUNDER: TestFlight/App Store).
2. Read the scrubbed stack. Note that file paths, emails, and tokens are
   redacted; the stack frames and error type are intact.
3. If no DSN is configured (Sentry inert), the only signal is user reports and
   the on-device crash screen. Configuring the DSN is the fix for visibility.

---

## Privacy posture (what is and is NOT collected)

This is operational crash/error reporting, deliberately kept distinct from the
suite's zero-analytics product stance.

App (Sentry via `@sentry/react-native`, `app/(root)/observability/sentry.ts`):
- Inert unless `EXPO_PUBLIC_BESTCHEF_SENTRY_DSN` is set. No DSN = no client, no
  network.
- `tracesSampleRate: 0` (no performance/behavioral tracing), `sendDefaultPii: false`.
- `beforeSend` runs `scrubEvent()`: deletes `event.user`, `request`,
  `server_name`, and device context; redacts emails, bearer/JWT tokens, and
  user home/sandbox file paths from messages, exception values, and breadcrumbs.
- `beforeBreadcrumb` drops all console breadcrumbs and scrubs the rest.
- NOT collected: user id, email, IP, username, session replay, navigation
  traces, behavioral events. Only the anonymous per-install Sentry session
  scope plus the release/build tag.

Edge (`supabase/functions/_shared/observability.ts`):
- Always emits a structured `console.error` JSON line (Supabase captures it
  natively). Optionally forwards to Sentry when `SENTRY_DSN` is set, fail-silent.
- Forwards only `fn`, `op`, message, stack, and non-PII `extra`. No user scope
  is ever attached from the edge tier (e.g. the account-export worker
  explicitly does not attach the userId it holds).

Data residency: the DSN chooses the ingest region. Point both the app and edge
DSNs at Sentry's EU ingest, or a self-hosted Sentry, to keep crash data
in-region. The code is region-agnostic.

### Enabling symbolicated stack traces (FOUNDER, optional)

By default the Sentry Expo config plugin runs with `disableAutoUpload: true`
(set in `app.json`). This is deliberate: without real Sentry credentials the
plugin's Xcode Release build phase would FAIL the source-map upload and thereby
fail the whole EAS build, which would burn the first production build (the exact
failure class `scripts/assert-eas-production-env.mjs` exists to prevent).
Credential-less builds succeed and runtime crash capture works unchanged; only
symbolication (readable minified stack frames in Sentry) is deferred.

To turn symbolication on:
1. Set `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` in the EAS
   production profile env (dashboard secrets, never committed).
2. Replace the placeholder `organization`/`project` in the `app.json`
   `@sentry/react-native/expo` plugin props with the real values, and flip
   `disableAutoUpload` to `false` (or remove it).
3. Rebuild. The Release phase will now upload source maps with the auth token.

---

## Backup and restore drill (FOUNDER, hosted project)

BestChef's public data (identity, media metadata, social graph, moderation
records) lives in the production Supabase Postgres. Losing it is
unrecoverable without backups, so verify the backup path BEFORE launch and
drill the restore.

### Backup configuration (verify once, pre-launch)

1. FOUNDER: In the production project Dashboard, Database, Backups, confirm the
   plan includes daily backups. For a public launch, enable Point-in-Time
   Recovery (PITR) so recovery granularity is minutes, not a day.
2. Record the retention window and the backup tier in
   `bestchef-supabase-environment-runbook.md`.
3. Storage buckets are backed up separately from Postgres. Confirm the media
   buckets (submission images/videos, thumbnails, product/receipt evidence,
   quarantine) are included in the project's storage backup or have an
   independent copy policy. Quarantined child-safety evidence has a legal
   retention requirement (audit C5) and must not be lost.

### Restore drill (run against a scratch project, NOT production)

Do this at least once before launch and after any major schema change, so the
restore path is proven, not theoretical.

1. FOUNDER: Create a throwaway Supabase project (the restore target).
2. Trigger a restore from the most recent production backup (or a PITR
   timestamp) into the throwaway project. Time it; record how long a full
   restore takes so the launch-day RTO is known.
3. Verification checklist on the restored copy:
   - `select count(*) from bc_submissions;` and a few other `bc_*` tables
     return plausible non-zero counts matching the backup point.
   - `select bc_job_health();` runs (function + dependent tables restored).
   - RLS is intact: a non-service query cannot read another user's private
     rows.
   - A sample media `storage_key` resolves (Storage restored or re-linked).
   - Migrations table (`supabase_migrations.schema_migrations`) matches the
     expected head; no half-applied migration.
4. Tear down the throwaway project.
5. Record the drill date, restore duration, and any gaps found in a session log
   and in `bestchef-supabase-environment-runbook.md`.

### If a real restore is needed (production incident)

1. FOUNDER: Stop writes if the incident is ongoing corruption (put the app in
   maintenance / disable the affected workers by clearing their `bc_job_config`
   rows so they no-op).
2. Choose the restore point (last good PITR timestamp) to minimize data loss.
3. Restore, then run the verification checklist above against production.
4. Re-seed `bc_job_config` (`seed:job-config -- --verify`) so workers resume.
5. Post-incident: append a row to `errors_log.md`, write a session log, and
   re-run the restore drill on a scratch project to confirm the path still
   works.
