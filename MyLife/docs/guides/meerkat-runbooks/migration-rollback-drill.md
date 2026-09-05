# Runbook: migration-rollback-drill

Prove a schema change can be rolled back by re-pointing images WITHOUT losing data:
migrations follow expand/migrate/contract, the contract (destructive) step never runs
inside the rollback window, and old + new service versions coexist during the rollout.
Records a `migration_rollback` rehearsal proof.

> **Honesty rule.** A drill that was NOT run is NOT evidence; a recorded drill proves
> the RECORD, not the infrastructure. This repository owns the migration runner, the
> expand/migrate/contract discipline, the mixed-version compatibility tests, and the
> rollback record's honest non-reversal markers. Executing the rollout on a real fleet
> is founder-ops. The tooling records what is honestly NOT undone: **a rollback
> re-points images; it never un-writes the database.**

## The rule this drill enforces (NC-44.5)

**No destructive (contract) migration may run inside the rollback window.** A schema
change that DROPS a column, DROPS a table, or REWRITES data cannot be undone by
re-pointing images. So the rollout is staged:

1. **Expand** (safe, additive, reversible): add the new column/table/index. Old code
   ignores it; new code can use it. Both versions run against this schema.
2. **Migrate** (backfill): populate the new shape. Still reversible: the old shape is
   intact.
3. **Contract** (destructive, IRREVERSIBLE): drop the old column/table only AFTER the
   new release is fully promoted, soaked, and the rollback window has CLOSED.

The rollback window is the span during which you might still re-point to the prior
release. While it is OPEN, only expand + migrate may have run. The contract step is
gated behind window closure precisely because it is the one step a rollback cannot
survive.

## Mixed-version coexistence

During a rolling deploy, old and new service instances run against the SAME schema at
once. That is only safe if the expand schema is compatible with BOTH. This is proven in
the package by the mixed-version integration tests:

- `src/postgres/__tests__/push-mixed-version-old-writer.integration.test.ts` (an old
  writer against the migrated schema), and
- `src/postgres/__tests__/adapter-contracts-compatibility-migration.integration.test.ts`
  (adapter contracts survive the compatibility migration).

Run the drill; do not re-derive these contracts by hand. If a planned migration cannot
pass a mixed-version test, it is NOT expand-safe and must be re-staged.

## Preconditions

- A staging fleet at release N (the rollback target), approved and recorded.
- Release N+1 built, approved, and recorded, carrying the EXPAND migration only (the
  contract migration is a SEPARATE later release, per the discipline above).
- A fresh backup proof (`backup-stale.md` exit 0). NC-44.5 requires a confirmed backup
  and restore proof before any destructive migration; the drill also needs it as the
  safety net for the expand rollout.
- `psql` with `meerkat_ops` + `meerkat_observer` URLs.

## Step 1 - Baseline + backup gate (repo tooling)

```bash
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# The backup gate MUST be green before touching the schema.
MEERKAT_OBSERVER_URL='postgres://meerkat_observer:<pw>@<host>/<db>' \
  node packages/meerkat-relay/deploy/observability/synthetics/backup-freshness.mjs   # expect exit 0
# The current schema head (the runner reports the applied range on completion).
DATABASE_URL='postgres://meerkat_ops:<pw>@<host>/<db>' \
  pnpm --filter @mylife/meerkat-relay migrate:postgres
```

## Step 2 - Apply the EXPAND migration (repo tooling + founder-ops deploy)

```bash
# The migration runner applies every pending migration and prints the applied range.
# Expand migrations are additive and reversible; stage the destructive contract
# migration as a SEPARATE later release, never here.
DATABASE_URL='postgres://meerkat_ops:<pw>@<host>/<db>' \
  pnpm --filter @mylife/meerkat-relay migrate:postgres
# -> { event: "migrations_complete", ... } ; a nonzero exit is a failed migration.
```

**FOUNDER-OPS.** Roll the fleet to N+1 via the promotion ladder (`release-promotion.md`),
staging -> canary -> production, each rung gated on a passing canary verdict. During the
rolling restart, old (N) and new (N+1) instances coexist against the expand schema; the
mixed-version tests are the evidence this is safe.

## Step 3 - Roll back to N (the drill) (repo tooling + founder-ops deploy)

Simulate a regression discovered AFTER N+1 is live but while the rollback window is
still OPEN (contract migration NOT yet run):

**FOUNDER-OPS.** Re-point the deploy at release N's pinned images (the emergency
rollback flow in `release-promotion.md`). Confirm N boots against the expand schema:
because the schema is additive, N ignores the new columns and runs unchanged.

Record the rollback transition with its honest non-reversal markers:

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay promotion:postgres --rollback \
    --release-id '<N+1 id>' --rollback-to '<N id>' --operator '<you>'
# Stamps dataReversalClaimed=false, postgresWritesAfterFlipReversed=false. Rows written
# while N+1 was live REMAIN; reconcile them deliberately (see below).
```

## Step 4 - Reconcile the writes N+1 made (repo tooling + operator)

The rollback re-pointed images; it did NOT un-write the database. Rows N+1 wrote using
the expanded shape are still present. Because the schema was additive and both versions
were compatible, N reads them safely, but any semantics unique to N+1 need a deliberate
reconciliation decision. Verify readiness on N and confirm the user path is correct:

```bash
curl -fsS http://<host>:8894/readyz | jq -c '{ready}'   # expect ready:true on N
```

## Decision criteria

- N booted against the expand schema, `/readyz` is green, the user path is correct, and
  the rollback record stamped the honest non-reversal markers -> **PASS**.
- A destructive/contract migration had ALREADY run inside the rollback window, so N
  cannot boot (its columns are gone) -> **FAIL**: NC-44.5 was violated. This is the
  failure the discipline exists to prevent; record `failed` and fix the migration
  staging.
- The rollback record was refused because evidence claimed data reversal -> the record
  is honest by construction; re-record without the false claim.
- N+1's writes left the database in a state N cannot serve honestly -> **FAIL**: the
  expand migration was not truly compatible. Record `failed`; consult the mixed-version
  tests for the gap.

## Step 5 - Record the proof (repo tooling)

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
    --kind migration_rollback --verdict passed --operator '<you>' \
    --started-at "$STARTED_AT" \
    --evidence /drill/migration-rollback.ndjson
```

Evidence: the migrate `migrations_complete` output before/after, the promotion
`--history` showing the
forward promotion and the rolled_back record, and the readyz JSON on N. A `passed`
verdict requires non-vacuous evidence.

## Abort / rollback guidance

- If N cannot boot against the current schema, the contract step ran too early. STOP:
  restore from the fresh backup (`disaster-recovery-drill.md`) rather than forcing a
  destructive re-migration. That is an `aborted` drill.
- NEVER run the contract migration to "clean up" during a rollback. The window is open;
  the destructive step waits until it closes.

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure) |
|---|---|---|
| Backup gate | `backup-freshness.mjs` | — |
| Apply expand migration | `migrate:postgres` (runs pending) | operator runs it against the real db |
| Roll fleet N -> N+1 | promotion ladder records (`release-promotion.md`) | compose pull/up on real hosts |
| Mixed-version safety | proven in mixed-version integration tests | observed on the real fleet |
| Re-point to N (rollback) | `promotion:postgres --rollback` (honest markers) | compose pull/up prior images |
| Record the proof | `rehearsal:postgres --record --kind migration_rollback` | operator runs it after the real drill |

See also `release-promotion.md` (rollback flow + NC-44.5), `shadow-divergence.md`
(migration-window comparator), `backup-stale.md`.
