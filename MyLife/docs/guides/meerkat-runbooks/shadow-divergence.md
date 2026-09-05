# Runbook: shadow-divergence (migration-window incident)

Pages: `shadow-divergence-zero`.

## Symptoms

- `meerkat_shadow_events_total{kind="divergence"}` increased during a cutover / migration
  window. In shadow mode the file primary is mirrored to the postgres shadow and every
  result is deep-compared; ANY divergence means the two backends disagree on state that
  gates security or lifecycle. This is an incident, not a degradation.
- A rising `kind="shadow_fault"` rate (ticket) means the shadow was slow (>2s) or threw, so
  the comparator is blind, not that the data diverged.

## First checks

Scrape the affected service's private metrics (persona 9894, community 9890):

```bash
curl -fsS http://community:9890/metrics | grep meerkat_shadow_events_total
```

The series carries static labels `service`, `store`, and `kind`
(`agreement|divergence|shadow_fault`). Identify WHICH `store` diverged (e.g.
`community.publications`, `community.reports`).

Find the divergence events in the service log. Each is a redacted NDJSON line
`{"event":"shadow_divergence", store, method, kind, argsDigest, ...}`. The digest and
method identify the operation without exposing payload.

## Interpretation

- `divergence` on a security/lifecycle store (publications, reports, humanity, persona,
  moderation) is the serious case: the postgres shadow would answer differently than the
  file primary. The primary (file) is still authoritative in shadow mode, so serving is
  safe, but you MUST NOT cut over to postgres until the divergence root cause is fixed and
  a clean digest compare passes.
- `shadow_fault` alone (no divergence) means the shadow path is slow or erroring; serving is
  unaffected but the comparison is not trustworthy until fixed.

## Safe mitigations

- Freeze the cutover. Do not advance from `shadow` to `postgres`.
- Re-run the offline digest comparison to characterize scope:

```bash
MEERKAT_POSTGRES_URL=... MEERKAT_POSTGRES_SSL_MODE=verify-full \
  ./bin/meerkat-postgres-state-import.mjs --digest-compare
```

- If a specific store's postgres adapter is the culprit, the file primary keeps serving
  correctly; fix forward in the adapter, re-import, re-compare to green before any cutover.

## DO-NOT

- Do NOT flip `MEERKAT_STORE_BACKEND=postgres` while any divergence is unresolved. The
  cutover is digest-gated for exactly this reason: `meerkat-postgres-cutover --execute`
  exits non-zero and prints `gate_failed / DO NOT flip env` when digests diverge. Respect
  that gate; do not bypass it.
- Do NOT hand-edit rows in either backend to "reconcile" them. Fix the adapter and re-import
  through the state-import path.

## Escalation

Divergence on a legal/moderation or humanity store -> service owner + founder-ops
immediately; a cutover under divergence risks losing or duplicating a security action.

## Rollback pointer

If a cutover was already in flight when divergence appeared post-flip, run:

```bash
./bin/meerkat-postgres-cutover.mjs --status  --cutover-id <id>
./bin/meerkat-postgres-cutover.mjs --verify  --cutover-id <id> --expected-version <n>
# on a verify failure, record the rollback + honest loss statement:
./bin/meerkat-postgres-cutover.mjs --rollback --cutover-id <id> --expected-version <n>
```

A destructive contract migration must never run inside the rollback window (NC-44.5).
