# Meerkat file-to-PostgreSQL cutover and rollback runbook

Plan 44 Phase 3 (WP-3C). Drives a Meerkat service's durable state from file mode to
PostgreSQL and back. The cutover CLI runs the verifiable steps and records a
durable, honest proof in `ops.cutover_proofs`; the env flip and service restart are
operator actions performed out of band.

## What the CLI does and does NOT do

- **Does**: verify the target schema, dry-run enumerate source roots, run the final
  delta import, gate on a semantic digest compare, capture the post-boot digest,
  and record a fenced, durable proof of every phase.
- **Does not**: flip `MEERKAT_STORE_BACKEND`, restart services, edit compose, or
  freeze writers. Those are operator actions. The CLI records the writer-freeze as
  an operator attestation; it cannot prove every writer is stopped.

Each phase prints a `lifecycleVersion`; pass it as `--expected-version` to the next
phase (the fencing token). A concurrent run of the same `--cutover-id` is refused
as `contended`.

## Preconditions

- PostgreSQL is migrated to the current schema (`meerkat-postgres-migrate`) and
  reachable via `MEERKAT_POSTGRES_URL` (+ TLS env).
- The file `DATA_DIR` roots are readable. Each service uses different roots, so the
  CLI takes per-root flags or env: `--community-dir` / `MEERKAT_COMMUNITY_DATA_DIR`,
  `--persona-dir`, `--directory-dir`, `--hosted-dir`, `--humanity-dir`.
- A stable `--cutover-id` for this attempt (e.g. `cutover-2026-07-11-community`).
- Object-store bytes (seeder pieces, tenant bytes, archive bytes) are handled
  separately. This runbook covers durable STATE only.

## Recommended sequence

### 1. Import while writers are live (WP-3A)

Run the state import so the bulk of the delta lands before the freeze window:

```
meerkat-postgres-state-import --import --all --community-dir <dir> ...
```

Idempotent and resumable. This shortens the freeze window in step 3.

### 2. Shadow-mode confidence step (WP-3B, recommended)

Before committing to a cutover, run the affected service(s) with
`MEERKAT_STORE_BACKEND=shadow`: file stays the primary authority (serves all
traffic) while PostgreSQL is mirrored and deep-compared, never affecting behavior.
Let it run under real traffic and watch the shadow divergence signal. A clean
shadow window is strong evidence the PostgreSQL adapters match the file behavior on
your real workload, so the cutover gate in step 5 is a formality rather than a
surprise. Shadow is a transient migration-window mode, never the first-party
authority; flip it back to `file` before the freeze.

### 3. Freeze writers (operator action)

Stop or fence every writer for the stores being cut over (drain the service or set
it read-only). No CLI step. This makes the file state final. Record who did it; you
attest to it in preflight.

### 4. Preflight

```
meerkat-postgres-cutover --preflight \
  --cutover-id <id> --release-sha <sha> --operator <you> \
  --writers-frozen-by <who-froze-writers> \
  --community-dir <dir> ... [--probe <url> ...] [--all | --store <id> ...]
```

Verifies the target schema is at the current version, dry-run enumerates every
source root (zero writes, records counts), records the writer-freeze attestation,
and probes any `--probe <url>` you pass. **A service that answers a probe is still
LIVE and FAILS preflight** (exit 2) — freeze it first. On success the proof opens in
state `preflighted`.

### 5. Execute (the gate)

```
meerkat-postgres-cutover --execute \
  --cutover-id <id> --expected-version <n> --community-dir <dir> ... [--store <id> ...]
```

Imports the final delta (idempotent) and compares file vs PostgreSQL digests
store-by-store.

- **Gate passes** (all `identical`): the proof advances to `executed`. Proceed.
- **Gate fails** (`gate_failed`, exit 2): the output lists each divergent store and
  NOTHING is recorded complete. **DO NOT flip env.** Fix the divergence (often an
  extra target row from a prior partial run) and re-run execute.

The import only adds rows; if the target has rows the file state lacks, the gate
reports `extra_in_target` and fails. A cutover must be exact.

### 6. Flip env and restart (operator action, per service)

For each affected service in your compose/deploy, set
`MEERKAT_STORE_BACKEND=postgres` (and the first-party profile as applicable) and
restart so it boots against PostgreSQL. No CLI step. Do this per service — a single
service can be cut over while others stay on file, as long as the `--store` set
matches the service's stores.

### 7. Verify (post-boot)

```
meerkat-postgres-cutover --verify \
  --cutover-id <id> --expected-version <n> [--store <id> ...]
```

Reads the post-boot PostgreSQL digest and requires it match the executed digest. On
an exact match the proof commits (`verified`). On divergence (`verify_failed`, exit
2) the flip is not sound (wrong database, lost writes): roll back.

### 8. Decision window

The proof is `verified`; PostgreSQL is authority. Keep the file tree untouched for a
decision window (staging soak, canary). If anything regresses, roll back.

## Rollback

Flip env back to file mode and restart each service (operator action), then record:

```
meerkat-postgres-cutover --rollback \
  --cutover-id <id> --expected-version <n> --reason "<why>" \
  --community-dir <dir> ... [--store <id> ...]
```

The proof advances to `rolled_back` and records the rollback window (cutover proof
timestamp -> now) plus an honest digest delta.

### Rollback honesty boundary (critical)

Rollback means the file tree resumes as authority. The recorded delta states plainly
`postgresWritesAfterCutoverPreserved: false`, `authorityAfterRollback: "file"`, and
`orphanedPostgresRowsRetainedForForensics: true`. It emits a `lostStores` LOSS list:
the stores whose PostgreSQL digest diverged from the file state, i.e. those with
writes taken against PostgreSQL after the flip that will NOT exist in file mode.
Those rows are NOT deleted — they stay in the database for forensics, but they are
not served. The runbook never pretends a rollback preserves post-cutover PostgreSQL
state; if that state matters, export it from the orphaned rows before re-importing.

## Status and audit

```
meerkat-postgres-cutover --status --cutover-id <id>
```

Prints the current state, lifecycle version, attestation, and phase timestamps. The
full proof (source, executed, post-boot digests, preflight report, rollback delta)
is durable in `ops.cutover_proofs` and readable by the `meerkat_observer` role.

## Failure modes

| Failure | Signal | Action |
|---|---|---|
| Wrong target schema version | `preflight_failed` (schema reason), exit 2 | Migrate to the current version first |
| A probed service is still live | `preflight_failed` (still live), exit 2 | Freeze/stop the service, re-run preflight |
| Missing writer-freeze attestation | `preflight_failed` (attestation), exit 2 | Freeze writers, pass `--writers-frozen-by` |
| Digests diverge at the gate | `gate_failed`, exit 2, per-store `gate_divergence` | Do not flip; fix divergence; re-run execute |
| Post-boot digest diverges | `verify_failed`, exit 2 | Roll back; the flip is not sound |
| Concurrent run of the same id | `transition_rejected` (`contended`), exit 2 | Only one operator drives a cutover id at a time |
| Stale `--expected-version` | `transition_rejected` (`version_conflict`) | Re-read `--status`, retry with the current version |
| Wrong-state transition | `transition_rejected` (`invalid_state`) | Re-read `--status`; the phase already ran or is out of order |
| Rollback after verify | `rolled_back` with `verifiedBeforeRollback: true` + `lostStores` | Expected; orphaned PostgreSQL writes are recorded, not preserved |
