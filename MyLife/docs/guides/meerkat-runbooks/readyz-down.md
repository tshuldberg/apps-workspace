# Runbook: readyz-down (availability / readiness flap)

Pages: `relay-availability`, `stateful-readyz-availability`, `readyz-flap`.

## Symptoms

- The availability burn-rate alert fired: the relay `/healthz` or a service `/readyz`
  synthetic is returning fail/degraded above the error budget.
- OR the flap alert fired: a service is oscillating ready<->not-ready more than ~6 times an
  hour, churning the orchestrator.

## First checks (real endpoints)

Relay (public liveness, exact two-field shape):

```bash
curl -fsS http://relay:8787/healthz    # expect {"ok":true,"connections":<n>}
```

Each stateful service (public readiness; 200 == ready, 503 == honestly not-ready):

```bash
for svc in community:8890 directory:8891 humanity:8892 hosted:8893 persona:8894; do
  echo "== $svc =="; curl -s -o /dev/stderr -w '%{http_code}\n' "http://${svc%%:*}:${svc##*:}/readyz"
done
```

Read the `checks` array in a 503 body. Each entry is `{name, ok, detailClass}` with
`detailClass` a bounded enum (`unavailable`, `timeout`, `faulted`, `not_configured`). The
`name` tells you which dependency: `postgres`, `object_store`, `data_dir`, or the community
node's `postgres_community` / `postgres_moderation`.

Run the synthetic directly for the NDJSON verdict + failing-check names:

```bash
node packages/meerkat-relay/deploy/observability/synthetics/service-readyz.mjs \
  --service persona --host persona --port 8894
```

## Interpretation

- `postgres` `unavailable` -> the database is unreachable or the pool is dead. Go to
  `pool-saturation.md` first; if the pool is empty and the DB is up, check the DB provider
  and TLS (`MEERKAT_POSTGRES_SSL_MODE=verify-full` requires a valid CA at
  `MEERKAT_POSTGRES_SSL_CA_FILE`).
- `object_store` `unavailable` (hosted only) -> the S3 endpoint/credentials are failing.
  Check the mounted secret files; the service fails closed by design.
- `data_dir` `unavailable` (file mode) -> the volume is unmounted or read-only.
- Flapping with `timeout` -> the dependency is slow, not down. Look at pool saturation and
  slow queries before restarting.

## Safe mitigations

- If a single replica is unhealthy and others are ready, let the orchestrator drain it; do
  not restart the whole fleet.
- If the database is the cause and it is a provider failover in progress, clients reconnect
  with backoff on their own; confirm recovery via `/readyz` rather than forcing restarts.
- Restart a replica ONLY if it is wedged (livez ok, readyz never recovers though the
  dependency is healthy). A restart preserves mode: it re-reads `MEERKAT_STORE_BACKEND`.

## DO-NOT

- Do NOT flip `MEERKAT_STORE_BACKEND` to `postgres` to "fix" readiness. If the service is
  in `file` or `shadow` mode, that is a deliberate cutover state; see
  `shadow-divergence.md` and the cutover proof, not an env edit.
- Do NOT silence the flap alert by widening the readyz timeout; that hides a real slow
  dependency.

## Escalation

Persistent `postgres unavailable` across services -> founder-ops (database provider /
network policy). Persistent relay unreachable with healthy replicas -> founder-ops (TLS
edge / DNS).

## Rollback pointer

If readiness collapsed immediately after a store cutover, this is a cutover failure, not a
capacity event: go to `shadow-divergence.md` and run
`meerkat-postgres-cutover --status --cutover-id <id>`; a `--rollback` may be required.
