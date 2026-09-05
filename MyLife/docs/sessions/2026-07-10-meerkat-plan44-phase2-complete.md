# 2026-07-10 Meerkat Plan 44 Phase 2 Completion

**Branch:** `feature/meerkat-production-readiness-2026-07-09` (local, not pushed)

**Commits:** `49f8c377` (execution contract), `2710d33a` (WP-2A), `e2c2c04f` (WP-2B), `1d4238aa` (WP-2C + WP-2D), `522192ba` (error ledger), `c5e81b09` (WP-2E), plus this docs commit

**Launch status:** Production NO-GO (unchanged; Phase 2 closes the object-storage dependency, not the launch gate)

## What was done

Plan 44 Phase 2 (production object storage) is complete: one object-store byte boundary, an S3 adapter with live proof, reference accounting with fenced reconciliation and deletion jobs, and both the hosted and archive byte paths composed behind the contract. Work was orchestrated across five work packages implemented by Opus 4.8 agents; planning, specification, adversarial review, and every gate battery were run by the lead session.

### WP-2A (`2710d33a`): MeerkatObjectStore contract, memory/file adapters, conformance

Contract supersets the existing `HostedStorageObjectStore` boundary (a projection adapter proves it) and adds S3-shaped multipart with per-part sha256, checksum-verified finalize that rejects into a never-served state, atomic quarantine-to-durable promote with streaming re-verification, monotonic per-key versioning, idempotent deletion receipts, and bounded cursor-paged inventory. Review rejected the first file adapter (bytes base64 inside the JSON ledger: O(store) rewrite per mutation, whole-store memory residency, V8 string-cap failure); the rework stores bytes as individual files with a metadata-only ledger, write-ahead ordering whose crash residue is always a sweepable orphan and never a dangling reference, and streaming multipart assembly.

### WP-2B (`e2c2c04f`): S3 adapter with live MinIO proof

State and versioning ride in object metadata with a bytes-free sidecar preserving the version high-water across delete-then-rewrite (no versioned bucket required). Whole-object sha256 is verified by streaming read-back because S3 composite checksums are hashes-of-hashes. Presigned PUTs bind length and checksum into the signature. Only a clean 404 is absence; everything else is typed unavailability under bounded jittered retries. CI gained a digest-pinned MinIO job running the shared conformance suite live.

### WP-2C + WP-2D (`1d4238aa`): reference accounting and hosted bytes

Reference ledger triple (migration 8, verb-exact `meerkat_ops` grants proven live), fenced inventory reconciler with a durable orphan-first-sighting grace window and typed findings, deletion jobs with monotonic fencing tokens, SKIP LOCKED claims, poison terminal, and append-only audit. The hosted resumable ingest protocol lands blocks through the contract with fail-closed `putBlock`; review rejected the first cap-accounting design (O(entire bucket) LIST per 4 MiB block) and authorized an additive contract amendment pushing an optional prefix down to ListObjectsV2, plus a first-use prefix sweep and write-lock counter. Object-store config lives in the runtime resolver with secrets-file-only credentials and fail-closed first-party requirements. Proven live end to end against MinIO and PostgreSQL: upload, interrupt, restart, resume via bitfield from durable inventory, cap refusal before write.

### WP-2E (`c5e81b09`): archive bytes

The contract's promote is the archive quarantine-to-durable move; serving re-hashes actual bytes before returning. The reference ledger is the single liveness authority (the archive refcount is a projection). Review rejected the first promote ordering (edge written after promote), which left a crash window whose residue the reconciler would eventually delete as an orphan; the accepted ordering writes the edge first so the same crash surfaces as a loud `referenced_missing` finding, proven by a crash-window test against the real reconciler and live against MinIO.

## Review findings (all fixed before commit)

1. File adapter stored bytes in the JSON ledger (scale failure). Reworked.
2. Hosted cap accounting was O(bucket) per block (no prefix scoping). Contract amended, counter added.
3. Archive promote ordering inverted (silent-deletion crash window). Inverted to edge-first with crash-window proof.
4. Pre-commit staged-snapshot gate fails on partial commits when multiple agents' barrel edits interleave; full verified snapshots commit cleanly.

## Verification (final battery, run by the lead)

| Gate | Result |
|---|---|
| Relay lint / typecheck | Passed |
| Full relay suite | 141 files passed, 17 skipped; 916 tests passed, 97 skipped |
| Live PostgreSQL 17 (55444) | 87 tests passed |
| Live MinIO S3 suites (55490): adapter, hosted ingest, archive | 10 tests passed |
| Production compose parse (complete env) | Exit 0 |

## Honest boundaries

- The hosted reservation/activation metadata flow and the archive lifecycle flow have no runtime bin consumers yet; the boundaries are built and composed, not faked.
- A literal first-party live bin boot needs a TLS-terminated PostgreSQL fixture; the live end-to-end proof runs the identical byte-path composition in self-host+s3 mode.
- The live community bin test tier still needs CI-provisioned role URLs.

## Remaining Plan 44 work

Phase 3 (import, semantic digest, shadow read, cutover, rollback tooling), Phase 4 (HA, PITR, backup, recovery evidence), Phase 5 (observability, SLOs), Phase 6 (supply chain), Phase 7 (rehearsal and soak). Meerkat remains production NO-GO.
