# Meerkat observability inputs (Plan 44 Phase 4 WP-4C)

These files are the **inputs** an operator loads into their own alerting stack. This
repository hosts no scraper, rule evaluator, dashboard, or pager: that is founder-ops. The
service code emits the signals (Plan 44 WP-4A private `/metrics`, `/livez`, `/readyz`); this
directory turns those signals into machine-readable SLOs, synthetic probes, and runbook
links.

## Contents

- `slo-definitions.json` — per-service SLOs and multi-window burn-rate alert rules, each
  linked to the exact metric / probe / log event it derives from and the runbook it pages
  to. JSON (not YAML) so the validation test parses it with `JSON.parse` and needs no parser
  dependency. Objectives whose signal is not yet wired are marked `status: pending_signal`
  (missing emitter named) or `status: founder_ops` (backup/proof infrastructure this repo
  does not host). Nothing here is faked.
- `synthetics/` — plain `node` `.mjs` probes for the PUBLIC surfaces. They add NO new
  dependency: the HTTP probes use only the Node standard library, and the one DB-reading
  probe uses `pg`, already this package's core dependency. Each emits one NDJSON result
  line and exits `0` ok / `1` degraded / `2` fail.
  - `relay-healthz-shape.mjs` — asserts the relay `/healthz` body is EXACTLY
    `{ok, connections}`. A third field is a zero-knowledge regression and fails hard.
  - `service-readyz.mjs` — walks a stateful service's public `/readyz` and reports readiness
    plus the non-identifying names of any failing dependency checks.
  - `humanity-challenge.mjs` — exercises the humanity `/humanity/challenge` mint path only.
    There is no synthetic attestation bypass, so it stops before issue/redeem and says so on
    every run.
  - `backup-freshness.mjs` — reads the latest VERIFIED `ops.backup_restore_proofs` row via
    the read-only observer credential and compares its age/RPO against the `backup-freshness`
    thresholds in `slo-definitions.json`. A missing, stale, or future-dated proof fails hard
    (NC-44.3), and so does a missing or malformed SLO file: broken alerting configuration
    never softens into permissive defaults.
  - `lib/probe.mjs` — shared std-lib helpers (bounded GET, arg parsing, NDJSON emit).

## `slo-definitions.json` schema

The file is the input an operator loads into whatever alerting stack exists. Top-level keys:

- `_doc` — one-paragraph summary of what the file is and its honesty rules (JSON has no
  comments, so the narrative that a YAML header would carry lives here and in this section).
- `version` — integer schema version of the file.
- `defaults.burnRate.{fast,slow}` — reusable multi-window burn-rate windows and factors.
  `factor` is the error-budget burn multiple; an alert fires when the measured error ratio
  over BOTH windows exceeds `factor * (1 - objective)`. Fast catches an acute outage; slow
  catches a steady error-budget bleed.
- `services` — map of service to `{ publicPort, metricsPort, readyzPath | healthzPath,
  healthzShape? }`. `relay.metricsPort` is `null` by design (the slim relay has no private
  metrics listener), and `relay.healthzShape` pins the EXACT allowed key set `["ok",
  "connections"]`; any extra key is a regression.
- `objectives` — list of SLO entries. Each entry:
  - `id` — stable kebab id, unique in the file.
  - `service` — a key in `services`, or `fleet` for cross-service.
  - `title`, `description` — human label and one-sentence purpose.
  - `objective` — a ratio in `[0,1]` for availability/success SLOs, or a threshold object
    `{ comparator, value, unit }` for saturation/rate SLOs.
  - `window` — the measurement window for ratio objectives.
  - `derivesFrom` — EXACTLY ONE of:
    - `metric: { name, labels?, note? }` — a metric the code emits today,
    - `probe: { script, note? }` — a synthetic under `synthetics/`, or
    - `logEvent: { event, note? }` — a structured NDJSON event with no metric yet.
  - `status` — `active` (signal exists now), `pending_signal` (the metric/exporter is NOT
    wired yet; the named emitter must ship first), or `founder_ops` (data source is
    infrastructure this repo does not host).
  - `alerts` — list of `{ severity: page|ticket, kind, condition?/uses?, runbook }`.
    `runbook` is a filename under `docs/guides/meerkat-runbooks/`. Every page-severity alert
    names a runbook that exists (enforced by `src/__tests__/slo-definitions.test.ts`).

### Honesty rules encoded in the file

- No objective reads any relay field beyond `{ok, connections}`.
- Metric label sets are static (`service`, `store`, `kind`, outcome class); no objective
  groups by an identity, token, content address, tenant, publication, or community id.
- The object reconciler and deletion queue exist in code but are not run by any production
  worker and export no counter yet, so their objectives are `pending_signal` with the exact
  missing emitter named, never a fabricated metric name. Backup/proof objectives are
  `founder_ops` for the same honesty reason.

## Running a probe

```bash
node synthetics/relay-healthz-shape.mjs --url http://relay:8787/healthz --timeout 3000
node synthetics/service-readyz.mjs      --service persona --host persona --port 8894
node synthetics/humanity-challenge.mjs  --url http://humanity:8892
MEERKAT_OBSERVER_URL='postgres://meerkat_observer:<pw>@<host>/<db>' \
  node synthetics/backup-freshness.mjs
```

Exit code is the machine verdict; the NDJSON stdout line is for a scraper or cron to tail.

## Runbooks

One runbook per page in `slo-definitions.json` lives in `docs/guides/meerkat-runbooks/`.
Every page-severity alert names a runbook that exists.

## Zero-knowledge

Probes read only public surfaces and assert on shape, never on payload identity. SLO metric
label sets are static (`service`, `store`, `kind`, outcome class). No objective groups by an
identity, token, content address, or tenant. There is no cross-service trace; correlation
stays inside one service's NDJSON log (see
`docs/designs/meerkat-correlation-design.md`).
