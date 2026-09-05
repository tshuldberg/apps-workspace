# Runbook: pool-saturation (PostgreSQL connection pool)

Pages: `postgres-pool-saturation`.

## Symptoms

- `meerkat_postgres_pool_connections{state="waiting"}` is above zero for 5+ minutes
  (ticket), or waiting persists 15+ minutes / idle is pinned at zero with waiters (page).
- Downstream: `/readyz` starts reporting `postgres` `timeout`, request latency climbs,
  statement timeouts appear.

## First checks (real metric + DB)

Scrape the private metrics port for the affected service (internal network only; not
published):

```bash
# persona example; ports: community 9890, directory 9891, humanity 9892, hosted 9893, persona 9894
curl -fsS http://persona:9894/metrics | grep meerkat_postgres_pool_connections
```

The series is `{state="total|idle|waiting"}`. The community node emits the suffixed
families `meerkat_postgres_pool_connections_community` and `_moderation` for its two pools.

Look at the database side with the service's least-privilege role:

```bash
psql "$PERSONA_DATABASE_URL" -c \
  "select state, wait_event_type, count(*) from pg_stat_activity group by 1,2 order by 3 desc;"
psql "$PERSONA_DATABASE_URL" -c \
  "select pid, now()-query_start as age, left(query,60) from pg_stat_activity \
   where state <> 'idle' order by age desc limit 10;"
```

## Interpretation

Pool timeout policy (defaults, from `src/postgres/pool.ts`): connection 5s, statement 10s,
lock 5s, idle-in-transaction 15s. Waiters mean demand exceeds the pool size or a query is
holding a connection too long.

- Long-running queries at the top of the `age` list -> a slow query or a missing index is
  holding connections. Note the query shape (never paste identities).
- `wait_event_type = Lock` -> lock contention; find the blocker with
  `pg_blocking_pids()`.
- Steady waiting with fast queries -> the pool is simply undersized for load, or the DB
  connection cap is the ceiling (size pools from DB capacity, not instance count).

## Safe mitigations

- If one query is pathological and it is safe, cancel it:
  `select pg_cancel_backend(<pid>);` (cancel, not terminate, first).
- If the pool is undersized and the DB has headroom, raise the service's pool size env and
  do a rolling restart of that service only. Do not exceed the DB's connection cap summed
  across all services.
- If a provider incident is throttling connections, shed load at the edge rather than
  hammering reconnects.

## DO-NOT

- Do NOT `pg_terminate_backend` a transaction mid-flight unless you have confirmed it is not
  a security-sensitive mutation (billing, humanity issuance, moderation). Terminating can
  leave a saga mid-step; the code is idempotent but prefer cancel + let it retry.
- Do NOT raise the pool size beyond the database's own connection cap; that moves the
  saturation to the DB and can starve other services.
- Do NOT restart into a different store backend to "reset" the pool.

## Escalation

Provider-side connection limits, replication lag, or a failover -> founder-ops (database
provider).

## Rollback pointer

Not a cutover event. If saturation began exactly at a cutover, treat it as a cutover
regression and consult `shadow-divergence.md`.
