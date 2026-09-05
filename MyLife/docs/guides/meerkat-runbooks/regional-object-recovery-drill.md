# Runbook: regional-object-recovery-drill

Prove managed BYTES survive a regional object-store loss: after recovery, the
object-store inventory rollup matches the reference, and every DB object reference
resolves to a present, checksum-verified object (no orphans, no dangling references).
Records a `regional_object_recovery` rehearsal proof (AC-44.4's recovery half).

> **Honesty rule.** A drill that was NOT run is NOT evidence; a recorded drill proves
> the RECORD, not the infrastructure. This repository owns the inventory rollup, the
> reference-ledger reconciliation, and the proof row. RESTORING a region (failing over
> the bucket, replicating objects, standing up the recovery endpoint) is founder-ops.
> The tooling never fabricates a rollup: an inventory artifact reflects what the object
> store actually returned, and a reconciliation result reflects the real reference set.

## This drill EXTENDS the disaster-recovery drill

This is the OBJECT-STORE half of recovery. The database half - reference snapshot,
restore-smoke, `backup_restore_proofs`, freshness - is in
[`disaster-recovery-drill.md`](./disaster-recovery-drill.md); do not duplicate it here.
Run the disaster-recovery drill for the database first (its Step 0-3), then run THIS
drill for the managed bytes. The two together prove a full regional recovery: rows AND
the objects those rows reference.

Key adapter fact carried from the disaster-recovery drill: the first-party object store
is content-addressed and checksum-verified on write, deletion is receipt-verified, and
references are refcounted. So a stale or overwritten object cannot silently corrupt a
served byte; provider bucket versioning is optional defense-in-depth, not a correctness
requirement. Recovery correctness is proven by the inventory rollup + reconciliation
below, not by trusting the provider's replication alone.

## Preconditions

- The database half of recovery is complete and verified (`disaster-recovery-drill.md`
  produced a `verified=true` proof for the recovery point you are reconciling against).
- A reference object inventory captured from the PRIMARY region BEFORE the loss (see
  Step 0). Without it there is nothing to compare the recovered region against.
- Object-store credentials for the recovered region wired into the backup CLI env
  (`MEERKAT_OBJECT_STORE_*`, as in `compose.production.yml`).

## Step 0 - Capture a reference inventory (repo tooling, BEFORE the loss)

Roll up per-prefix counts, byte totals, and digest rollups of the LIVE object store.
This is an artifact-on-disk (nothing recovered yet):

```bash
MEERKAT_RELEASE_SHA="$(git rev-parse HEAD)" \
  pnpm --filter @mylife/meerkat-relay backup:postgres --object-inventory \
    --out /drill/object-reference-$(date -u +%Y%m%dT%H%M%SZ).json
# -> { event: "inventory_written", tenants:{count,totalBytes,rollupHex}, archive:{...}, total:{...} }
```

Keep the artifact; the recovery reconciliation compares against it.

## Step 1 - Recover the region (FOUNDER-OPS)

**FOUNDER-OPS.** This repository hosts no object-store replication or regional failover
config. Using the provider console/CLI, the operator:

1. Fails over (or restores) the bucket into the recovery region.
2. Points the backup CLI env at the recovered region's endpoint + credentials.
3. Records the recovery instant (ISO UTC) for the drill notes.

The exact provider steps depend on the object store and are intentionally NOT scripted;
this runbook states the decision each step drives, it does not fabricate a provider CLI.

## Step 2 - Inventory the recovered region (repo tooling)

Re-run the rollup against the RECOVERED region and compare to the reference:

```bash
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
MEERKAT_RELEASE_SHA="$(git rev-parse HEAD)" \
  pnpm --filter @mylife/meerkat-relay backup:postgres --object-inventory \
    --out /drill/object-recovered.json
# Compare per-prefix count, totalBytes, and rollupHex to the reference artifact.
diff <(jq -S '.prefixes' /drill/object-reference-<ts>.json) \
     <(jq -S '.prefixes' /drill/object-recovered.json)
```

Identical `rollupHex` per prefix means the recovered bytes are the same content-
addressed set as the reference (the rollup is a digest over the object set, so a match
is a real byte-level match, not just a count match).

## Step 3 - Reconcile references (repo tooling)

Every DB object reference must resolve to a present object in the recovered region, and
no recovered object may be an orphan the DB does not reference. These are the two
finding classes the object reconciler (`src/object-reconciler.ts`) types:

- **DB reference -> object present:** a reference with no object is a `referenced_missing`
  finding (the user path returns the exact unavailable state; see `deletion-poison.md` /
  `referenced-missing.md`). After a clean recovery there should be NONE.
- **Object -> DB reference present:** an object with no live reference is an orphan the
  reconciler quarantines (no accidental public serving). A handful of in-flight orphans
  may be expected; a large orphan set means the recovery point and the DB recovery point
  are mismatched.

> **Signal note.** As documented in `referenced-missing.md`, no scheduled reconciler
> worker or synthetic ships yet (`pending_signal`): there is no one-command probe to
> invoke here. Reconcile by comparing the recovered inventory rollup (Step 2) against
> the reference ledger with the least-privilege observer role, the same cross-check the
> `referenced-missing.md` page uses:

```bash
# Spot-check that referenced keys resolve in the recovered store, and that the
# recovered object count matches the live reference-ledger row count. Never paste an
# identity into a channel beyond the opaque object key.
psql "$HOSTED_DATABASE_URL" -c "select count(*) from <object_reference_ledger>;"
# Compare to /drill/object-recovered.json total.count; a large mismatch is drift.
```

## Decision criteria

- Per-prefix `rollupHex` matches the reference, the reference-ledger row count matches
  the recovered object count, and the orphan set is empty (or explainable in-flight
  only) -> **PASS**: the region recovered and the byte set reconciles with the DB.
- Any prefix `rollupHex` differs -> the recovered bytes are NOT the reference set. Read
  the count/byte deltas; treat as an incident (`incident-drill.md`) and BLOCK serving
  from the recovered region until reconciled.
- The ledger references more objects than the recovered store holds -> the DB references
  objects the recovered region does not have. Do NOT serve: a served byte would 404 or
  serve stale. Record `failed`.
- A large orphan set -> the DB recovery point and the object recovery point disagree;
  re-align the recovery points before serving.

## Step 4 - Record the proof (repo tooling)

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
    --kind regional_object_recovery --verdict passed --operator '<you>' \
    --started-at "$STARTED_AT" \
    --evidence /drill/object-recovered.json
```

Attach the recovered inventory artifact (and the diff + referenced-missing output as an
NDJSON evidence file if you prefer a combined stream). A `passed` verdict requires
non-vacuous evidence.

## Abort / rollback guidance

- If the recovered region does not reconcile, do NOT flip production serving to it.
  Serving a mismatched object set is worse than an outage: it serves wrong or missing
  bytes. Keep serving from the healthy region (or accept the outage) and re-recover.
- A recovery that did not reconcile is `failed`, not `passed`. A recovery you abandoned
  mid-flight (e.g. the provider failover stalled) is `aborted`.

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure) |
|---|---|---|
| Reference inventory (pre-loss) | `backup:postgres --object-inventory` | — |
| Fail over / restore the region | — | provider console/CLI regional recovery |
| Recovered-region inventory | `backup:postgres --object-inventory` + diff | point env at the recovered region |
| Reference reconciliation | inventory rollup vs. reference ledger (`psql` cross-check) | observed on the recovered region |
| Record the proof | `rehearsal:postgres --record --kind regional_object_recovery` | operator runs it after the real drill |

See also `disaster-recovery-drill.md` (the database half this extends),
`referenced-missing.md`, `deletion-poison.md`, `backup-stale.md`.
