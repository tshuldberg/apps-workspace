# 2026-07-10 Meerkat Plan 44 Phase 4 Completion

**Branch:** `feature/meerkat-production-readiness-2026-07-09` (local, not pushed)

**Commits:** `9dff04eb` (execution contract), `9cef02e1` (WP-4B redaction core), `2f4416fd` (WP-4A endpoints/metrics + WP-4B wiring), `5f11b1b8` (WP-4C), plus this docs commit

**Launch status:** Production NO-GO (unchanged)

## What was done

Plan 44 Phase 4 (observability and SLOs) is code-complete under hard zero-knowledge boundaries: the slim relay is untouched and its two-field `/healthz` is now actively defended by a shape-regression synthetic; no metric is keyed by an identity; readiness never fakes a capability; correlation identifiers never cross the relay.

### WP-4B (`9cef02e1`, wiring in `2f4416fd`): redaction and canaries

A pure redaction helper with a documented rule table: key denylist with a public-key allowlist, URL userinfo and credential-query scrubbing, bearer-blob detection, env-assignment scrubbing on fatal paths, and a deliberate refusal of width or entropy rules since content hashes are the codebase's honest names. All five stateful bins route their NDJSON logs through it. Hermetic canary boots of every bin (including fail-closed postgres fatal paths) prove no canary secret reaches stdout or stderr, with a verified negative control: removing redaction makes the canary fail.

### WP-4A (`2f4416fd`): honest readiness and private metrics

`/livez` and `/readyz` on all five stateful services, with dependency checks reporting only a fixed detail-class enum and thrown error text deliberately discarded so a probe failure cannot leak a connection string. A hand-rolled Prometheus exporter (no new dependency) serves an opt-in metrics listener bound to a private interface with static label sets only. Community readiness requires both least-privilege pools while a dead shadow never gates; hosted readiness requires the object store only when S3 is composed. Compose healthchecks moved to `/readyz` with unpublished private metrics ports.

### WP-4C (`5f11b1b8`): SLOs, synthetics, runbooks, correlation design

Machine-readable JSON SLO and alert definitions derived from the failure-modes table (shadow divergence is zero-or-incident; referenced-missing and deletion poison page; backup freshness is an explicit founder-ops placeholder), with a validation test enforcing full referential integrity: every named metric exists, every page alert names a runbook, every runbook and probe script exists on disk. Honest dependency-free synthetics: the relay probe fails on any extra `/healthz` field as a zero-knowledge regression alarm, and the humanity synthetic stops at the challenge mint stating why rather than inventing an attestation bypass. Eight operator runbooks with exact first-check commands and explicit DO-NOTs (the deletion queue is the only byte remover; never flip to postgres mode without a cutover proof). The correlation design rejects W3C traceparent across the relay on metadata-linkage grounds and specifies per-service edge-generated request ids only.

## Review notes

- One preemptive intervention: a runtime `js-yaml` dependency was headed into the SLO tooling; redirected to a JSON definitions file keeping validation dependency-free.
- One review fix in WP-4A/4B round: none required beyond the earlier-logged shadow guard ordering (fixed pre-commit in `9bbb8362`).
- Both parallel agents held their file partitions; the interleaved bin hunks were committed jointly with attribution.

## Verification (final battery, lead-run)

| Gate | Result |
|---|---|
| Relay lint / typecheck | Passed |
| Full relay suite | 1021 tests passed, 130 skipped |
| Live PostgreSQL 17 (55444) | 119 tests passed |
| Compose parse (complete env) | Passed |
| Relay log-hygiene E2E and `/healthz` invariants | Untouched and green |

## Honest boundaries

- Dashboards and pager wiring are founder-ops: the SLO file is the input to whatever alerting stack is provisioned, and says so.
- The full challenge-issue-redeem synthetic requires a synthetic attestation path that deliberately does not exist; the synthetic stops at challenge mint and reports why.
- Correlation ids are a design doc plus plan; implementation is a later package.

## Remaining Plan 44 work

Phase 5 (backup and recovery), Phase 6 (supply chain and images), Phase 7 (production rehearsal). Meerkat remains production NO-GO.
