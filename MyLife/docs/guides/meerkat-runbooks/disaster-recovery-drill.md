# Runbook: disaster-recovery-drill

The end-to-end recovery drill (Plan 44 WP-5A): restore a real provider backup into a
scratch database, prove it restores by semantic digest, record the proof, and decide.

> **Honesty rule.** A drill that was NOT run is NOT evidence. This repository owns the
> VERIFY-AND-PROVE half (digest snapshot, restore-smoke, proof row, freshness). The
> RESTORE half (provider backup, PITR, scratch environment) is founder-ops. The tooling
> never fabricates a proof: a proof row exists only after a real restore was digested and
> compared. A green freshness page means a real restore-smoke ran and matched, nothing
> less.

## When to run

- On the scheduled weekly restore-smoke (feeds `backup-freshness` / `backup-restore-proof`).
- Before any destructive schema/contract migration (NC-44.5 requires a confirmed backup
  and restore proof first).
- As the quarterly full recovery drill.

## Step 0 - Capture a reference snapshot (repo tooling)

Capture a per-store semantic reference digest of the LIVE primary, digested with the
read-only digest role. This is an artifact-on-disk, not a proof (nothing was restored yet):

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_backup_digest:<pw>@<primary-host>/<db>' \
MEERKAT_RELEASE_SHA="$(git rev-parse HEAD)" \
  pnpm --filter @mylife/meerkat-relay backup:postgres \
    --digest-snapshot --digest-role meerkat_backup_digest \
    --out /drill/reference-$(date -u +%Y%m%dT%H%M%SZ).json
```

The snapshot records `capturedAt` from DATABASE time (not the CLI host clock), the release
SHA, and the per-store digests. The recorded `digestRole` is the connection's ACTUAL
`current_user`, never a claim; `--digest-role meerkat_backup_digest` asserts the expected
role so the drill fails fast if the credential is not the read-only digest role. Keep the
snapshot; the restore-smoke compares against it.

## Step 1 - Restore into a scratch database (FOUNDER-OPS)

**FOUNDER-OPS.** This repository hosts no provider backup or PITR configuration. The
founder-ops operator, using the provider console/CLI:

1. Provisions a scratch PostgreSQL instance/database isolated from production.
2. Restores the target base backup (and replays WAL to the recovery target if doing PITR).
3. Records the BACKUP INSTANT (the timestamp the restored data is current as of) as an ISO
   string; the restore-smoke needs it to compute the RPO.
4. Hands back a connection string for the restored scratch database and the ops (primary)
   database where the proof is recorded.

The exact commands depend on the provider (managed Postgres snapshot restore, PITR target,
etc.) and are intentionally NOT scripted here; this runbook states the decision each step
drives, it does not fabricate a provider CLI.

## Step 2 - Restore-smoke (repo tooling)

Re-digest every store on the restored scratch database, compare against the reference, and
record a `backup_restore_proofs` row on the PRIMARY ops database. `verified=true` is
recorded ONLY when every store digest is identical; any divergence is recorded in the
proof's `semantic_digests`, never swallowed.

```bash
MEERKAT_RELEASE_SHA="$(git rev-parse HEAD)" \
  pnpm --filter @mylife/meerkat-relay backup:postgres --restore-smoke \
    --reference /drill/reference-<ts>.json \
    --restored-url 'postgres://meerkat_backup_digest:<pw>@<scratch-host>/<db>' \
    --ops-url 'postgres://meerkat_ops:<pw>@<primary-host>/<db>' \
    --source-backup-id '<provider-backup-id>' \
    --backup-timestamp '<ISO instant the restore is current as of>'
# exit 0 = verified proof recorded; exit 2 = proof recorded with verified=false (divergence)
```

The restored DB is read with the read-only `meerkat_backup_digest` role; the proof is
written by the separate `meerkat_ops` connection. Two smokes on the same proof id cannot
interleave (operations-store lease fencing).

Honesty note on the recorded numbers: `rpo_seconds` is computed from the reference capture
instant minus the backup instant (the at-risk write window). `rto_seconds` is the measured
digest-verification duration, the only part this tooling can prove; the provider restore
wall-clock is founder-ops observed and belongs in the drill notes alongside the proof id.

## Step 3 - Verify the proof

```sql
SELECT proof_id, source_backup_id, release_sha, restored_at,
       rpo_seconds, rto_seconds, verified
FROM ops.backup_restore_proofs
ORDER BY restored_at DESC, proof_id DESC
LIMIT 1;
```

Then run the freshness probe (should exit 0):

```bash
MEERKAT_OBSERVER_URL='postgres://meerkat_observer:<pw>@<primary-host>/<db>' \
  node packages/meerkat-relay/deploy/observability/synthetics/backup-freshness.mjs
```

## Decision criteria

- `verified = true`, RPO within `maxRpoSeconds`, proof age within `maxProofAgeSeconds`
  -> the backup restores; the pages clear; the release health gate may proceed.
- `verified = false` -> the restore does NOT reproduce the source. Read the divergences in
  `semantic_digests`, treat as an incident, and BLOCK any destructive migration and the
  release gate until a subsequent smoke verifies.
- No proof / stale proof -> `backup-freshness` fails (exit 2); the backup is not healthy
  regardless of provider job status.

## Object-versioning note

The first-party object store adapter needs **no bucket versioning for correctness**: every
object is content-addressed and checksum-verified on write, deletion is receipt-verified,
and references are refcounted, so a stale or overwritten version cannot silently corrupt a
served object. Enabling provider bucket versioning is optional **defense-in-depth** that is
purely provider-side: it affects only storage cost and leaves a harmless `__mkver` version
sidecar; it does not change adapter behavior or the inventory rollup. The object-store
backup inventory rollup (`backup:postgres --object-inventory`) records per-prefix counts
and digest rollups so a restore can compare managed bytes before and after.
