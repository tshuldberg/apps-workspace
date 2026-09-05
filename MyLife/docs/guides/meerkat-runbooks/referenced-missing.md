# Runbook: referenced-missing (object reconciler findings)

Pages: `reconciler-referenced-missing` (page). Also covers `reconciler-orphan-sweep`
(ticket).

> **Signal status: pending_signal.** The reconciler
> (`packages/meerkat-relay/src/object-reconciler.ts`) classifies findings with typed
> outcomes (`referenced_missing`, `orphan_quarantined`, `orphan_swept`,
> `deletion_eligible`), but no production worker runs it on a schedule yet and no metric or
> `reconcile_finding` log event is emitted. This runbook is ready for when a reconciler
> worker ships its signal. Until then, this page cannot fire; do not wire the alert against a
> non-existent metric.

## Symptoms (once the worker emits)

- `referenced_missing`: a ledger row references an object key whose store object is ABSENT.
  A user path for that object returns an exact unavailable state. This is a page: a byte the
  system promised is gone.
- `orphan_quarantined` / `orphan_swept` above baseline (ticket): store objects with no
  ledger row are being quarantined and swept. That is the designed safe path; a rising rate
  means a producer is leaking bytes.

## First checks

Inspect the reconciler finding stream (the worker's redacted NDJSON log). Each finding is
`{outcome, objectKey (opaque), state, detail}`. Cross-check the reference ledger and the
store for the reported key with the service's least-privilege role:

```bash
# Is the ledger row real and referenced?
psql "$HOSTED_DATABASE_URL" -c "select 1 from <object_reference_ledger> where key = '<key>';"
```

(Use the actual ledger table name from the schema; never paste an identity into an incident
channel beyond the opaque object key.)

## Interpretation

- `referenced_missing` -> the byte was lost (bad delete, storage incident, failed
  multipart). The user path already returns unavailable; the fix is to restore the object
  from a backup/version or repair the reference. This is a restore/repair job, not a delete.
- `orphan_quarantined`/`orphan_swept` -> the reconciler is doing its job. Investigate the
  PRODUCER that created store bytes without a ledger row (a half-completed upload path).

## Safe mitigations

- For `referenced_missing`: restore the object from object versioning / backup (founder-ops
  Phase 5 infrastructure) OR repair the ledger reference if the byte is legitimately gone
  and the reference is stale. Confirm the user path returns to available.
- For orphans: let quarantine + sweep run; fix the leaking producer.

## DO-NOT

- **Do NOT delete orphans by hand.** The object deletion queue is the ONLY byte remover. A
  manual `rm` on the bucket or a manual ledger `DELETE` corrupts reconciliation and can turn
  an orphan into a `referenced_missing` for a victim sharing deduped bytes. Enqueue through
  the deletion path; never bypass it.
- Do NOT "fix" a `referenced_missing` by deleting the dangling ledger row before confirming
  the byte is truly unrecoverable; that discards the repair target.

## Escalation

`referenced_missing` on managed user bytes -> founder-ops (object storage / backup restore).
A spike of orphans -> service owner (find the leaking producer path).

## Rollback pointer

Not a cutover event. If findings began right after an object-store cutover, verify the S3 vs
file byte path (`meerkat_object_store_composed` metric on the hosted service: 1 == S3
composed, 0 == file byte path).
