# Runbook: deletion-poison (object deletion queue)

Pages: `deletion-poison` (page).

> **Signal status: pending_signal.** The deletion queue
> (`packages/meerkat-relay/src/object-deletion-jobs-*.ts`) implements a `poison()`
> transition and `listPoison()`, but no production deletion worker bin runs the queue yet
> and no metric exports the poison count. This runbook is ready for when a deletion worker
> ships. The natural wiring is a `collect()` gauge over `listPoison()` length (or a
> `deletion_poison` NDJSON event). Until then, this page cannot fire.

## Symptoms (once the worker emits)

- The deletion-poison count is above zero. A poisoned job is a byte the system decided to
  delete but could not, repeatedly (the job exceeded its retry budget). The byte is stuck in
  a half-deleted state: possibly already unreferenced but not yet removed, or failing its
  final store delete.

## Why this is a page

The deletion queue is the ONLY component that removes managed bytes. A poison means the
sole safe byte-removal path is stuck. Left alone, poisoned jobs accumulate and real deletes
(including legally required removals) stop completing.

## First checks

List the poisoned jobs through the worker/queue interface (never delete bytes directly):

```bash
# Once a deletion worker/CLI exists, list poison via its interface, e.g.:
#   <deletion-worker> --list-poison
# Or read the durable poison file/table (opaque object keys only).
```

Inspect the store + reference state for a poisoned key with the least-privilege role to
understand WHY the delete failed (store returned an error, key already gone, lease fenced):

```bash
psql "$HOSTED_DATABASE_URL" -c "select state from <deletion_jobs> where key = '<key>';"
```

## Interpretation

- Store delete keeps failing (permissions, endpoint down) -> fix the store access, then let
  the job retry (unpoison through the queue's own re-enqueue path if provided).
- Key already absent in the store but the job cannot confirm -> a reconciliation issue;
  the object may have been removed out of band (which itself is a DO-NOT that happened).
- A fenced/stale lease -> a worker died mid-delete; the fencing prevented a double action,
  which is correct. Re-drive through the queue.

## Safe mitigations

- Restore store access (credentials / endpoint) so the delete can complete, then re-drive
  the poisoned jobs through the queue.
- If the byte is confirmed already gone, resolve the job through the queue's own
  reconcile/complete path so the ledger and store agree.

## DO-NOT

- **Do NOT delete the byte or the ledger row by hand to "clear" a poison.** The deletion
  queue is the only byte remover; a manual delete defeats the fencing and idempotency that
  make deletion safe, and can wipe a victim that shares deduped bytes.
- Do NOT drop poisoned jobs to zero the metric. A dropped deletion is a byte that should
  have been removed (a compliance/privacy failure) silently surviving.

## Escalation

Sustained poison with store access healthy -> service owner (deletion worker bug). Poison
tied to a legal takedown (NCMEC/DMCA) not completing -> founder-ops immediately.

## Rollback pointer

Not a cutover event. If poison began after an object-store cutover, verify the byte path via
`meerkat_object_store_composed` on the hosted service.
