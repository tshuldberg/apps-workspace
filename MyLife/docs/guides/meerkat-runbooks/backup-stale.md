# Runbook: backup-stale (backup freshness / restore proof)

Pages: `backup-freshness`, `backup-restore-proof`.

> **Signal status.** The freshness SIGNAL is real (Plan 44 WP-5A): the
> `backup-freshness` synthetic reads the latest verified `ops.backup_restore_proofs`
> row and fails on a missing or stale proof. What stays **founder-ops** is the
> PROVISIONING: WAL archiving, base backups, object versioning, and actually RUNNING
> the weekly restore-smoke against a real provider backup. A tool that can record a
> proof is not a drill that ran; only a recorded, verified, recent proof clears these
> pages.

## Symptoms

- `backup-freshness`: no VERIFIED restore proof within `maxProofAgeSeconds`, or the
  newest verified proof's recorded RPO exceeds `maxRpoSeconds` (degraded).
- `backup-restore-proof`: the weekly restore-smoke job failed or was never scheduled.

## Governing rule

A backup is NOT healthy without a recent restore proof (NC-44.3). Freshness alone is
insufficient: a backup that exists but cannot restore is a false sense of safety. The
weekly restore-smoke gate is what turns "a backup exists" into "a backup restores".

## First checks (real commands)

Run the freshness probe against the primary ops database using the read-only observer
credential (never a writer role):

```bash
MEERKAT_OBSERVER_URL='postgres://meerkat_observer:<pw>@<host>/<db>' \
  node packages/meerkat-relay/deploy/observability/synthetics/backup-freshness.mjs
# exit 0 = fresh, 1 = degraded (RPO too wide), 2 = fail (missing/stale proof)
```

Inspect the latest recorded proofs directly (observer credential):

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_observer:<pw>@<host>/<db>' \
  pnpm --filter @mylife/meerkat-relay backup:postgres --status
```

Or query the proof table directly (bounded, indexed):

```sql
SELECT proof_id, restored_at, verified, rpo_seconds, rto_seconds
FROM ops.backup_restore_proofs
WHERE verified = true
ORDER BY restored_at DESC, proof_id DESC
LIMIT 5;
```

For object storage: confirm the inventory job ran and reconciles against the reference
ledger (see `disaster-recovery-drill.md`).

## Interpretation

- No verified proof (probe exit 2) -> a backup with no restore proof is NOT a backup.
  Page and block the release health gate.
- Stale proof (probe exit 2) -> the weekly restore-smoke has not run inside the window;
  schedule/re-run it (see `disaster-recovery-drill.md`).
- RPO exceeded (probe exit 1) -> the backup restores, but the data-loss window is wider
  than budget; tighten the backup/WAL cadence.
- Stale WAL archive -> alert BEFORE local WAL fills; act in this window, not after.

## Safe mitigations

- Re-run the founder-ops backup / WAL archive job; confirm freshness returns inside the
  window.
- Run the restore-smoke into a scratch environment (the full procedure is in
  `disaster-recovery-drill.md`); only a passing, verified restore-smoke clears the page.

## DO-NOT

- Do NOT label a backup healthy on freshness alone. The restore proof is mandatory.
- Do NOT record a restore proof with a writer service credential; the digest runs as the
  read-only `meerkat_backup_digest` role, and the proof is written by the `meerkat_ops`
  connection. They are deliberately separate.
- Do NOT proceed with any destructive schema/contract migration while backup freshness or
  a restore proof is failing (NC-44.5).
- Do NOT run a destructive contract migration inside the rollback window.

## Escalation

Backup provisioning (credentials, WAL, object versioning, restore environment) is
founder-ops. Escalate provisioning failures directly to founder-ops; the freshness signal
and the proof query above are the evidence they act on.

## Rollback pointer

If a restore proof is failing because of a recent schema change, hold the cutover: consult
`shadow-divergence.md` and the cutover proof before advancing.
