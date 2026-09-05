# Meerkat M4: Blob pipeline + sliding window + ladder migration

Date: 2026-06-11
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md` (M4)

## Scope decision (honest gating)

M4's exit is "ADOPT/REJECT decision on iroh recorded; attachments sync
end-to-end either way." The iroh POC (MK-025) requires a Rust toolchain
(absent: no cargo/rustc) and direct-upgrade measurements on 5+ REAL iPhone/Mac
network pairs -- not something a sandbox can produce without fabricating
numbers. MK-025 and the ADOPT-dependent MK-026 are marked founder-ops-gated in
the plan (prep: the MK-021 spike report already documents the shared
uniffi/native-module pipeline both OpenMLS and iroh should ride). The "either
way" half of the exit is delivered: MK-027, MK-028, and MK-029 are done on the
interim TypeScript path.

## MK-027: BLOB_REQUEST/BLOB_DATA live

The message types existed since v1 (codec codes 0x20-0x22) but nothing ever
sent or handled them. Now:

- `protocol/blob-transfer.ts`: 16 KiB blocks (hex-in-JSON plus the encryption
  envelope's second hex pass stays under the relay's 96 KiB frame cap);
  SHA-512 content hashing via tweetnacl (the node layer's documented interim;
  BLAKE3/CID rides the Rust core if MK-025 adopts); `collectBlobRefs` (the
  `blob_hash` column convention); durable staging in the new
  `sync_blob_blocks` table (SYNC_TABLES 30 -> 31); injectable
  `SessionBlobProvider` (app filesystem store; in-memory in tests).
- Session wiring: after applying a batch, the responder requests every
  `blob_hash` it cannot resolve, advertising already-staged block indices so an
  interrupted transfer RESUMES. The initiator serves after the module phase. A
  persistent request collector on the initiator avoids the one-shot-handler
  frame-loss class of bug (the same race the relay mailbox had in MK-008).
  The receiver stages -> reassembles -> verifies the content hash -> enforces
  `sync_blob_policy` size caps (BOTH ends enforce: a peer cannot pull an
  over-cap blob by asking, nor be flooded by one) -> stores + `sync_blobs` row
  -> acks. Sessions record real `blobsSent`/`blobsReceived`.
- `blob-pipeline.test.ts` (6): a multi-block photo attached on A lands on B
  verified and stored; resume sends ONLY the missing blocks (counted on the
  wire); an over-cap blob is refused with nothing stored and staging cleared.

Deferred: the hub notes/journal attachment UI (module wiring; the meerkat app's
pad is text-only).

## MK-028: sliding-window sync (the Matrix lesson)

- `protocol/sync-window.ts` `splitSnapshotForWindow`: ranks the LWW snapshot's
  rows by `updated_at` and splits into a priority window + backfill remainder
  (deterministic, nothing lost or duplicated).
- Sessions with `syncWindow: N` send two SYNC_DATA batches -- window first.
  Receipt change-ids ride the FINAL batch so MK-009's "delivered only when
  fully acked" semantics hold; both batches are MK-013-signed. The receive path
  is unchanged (batches apply in arrival order).
- `sliding-window.test.ts` (4): a 400-row cold start with window 25 puts
  exactly the 25 most-recent rows on the wire first, well inside the 3-second
  visible-data budget; all 400 rows land in the same session; the sender still
  marks the module fully synced.

## MK-029: ladder migration + per-rung stats

- `migrateTransportDefaultsToV2` (bootstrap): an install whose self-preferences
  are EXACTLY the legacy v1 default ([1,2,3,4,5], all enabled) is rewritten to
  the relay-first v2 order. Naturally one-shot -- after the rewrite the rows no
  longer match, and a user-customized ranking never matches, so it is never
  touched. Wired into `ensureSyncBootstrap`.
- `getTransportRungStats`: attempts/successes/last-attempt per transport,
  aggregated from REAL `sync_sessions` rows. Local only.
- Meerkat Sync screen: a "Transport rungs" panel showing those numbers, with
  copy stating they are local and never uploaded.
- `relay-first-defaults.test.ts` +4: migration one-shot; bootstrap-path
  migration; customized rankings untouched; stats aggregation.

## Verification

- `@mylife/sync`: 948 tests (was 934; +6 blob-pipeline, +4 sliding-window,
  +4 MK-029). typecheck clean.
- `@mylife/meerkat-app`: 31 tests, typecheck clean; meerkat parity green.
- `pnpm gate:function:changed`: EXIT 0.

## Next

M5 (Communities + Seeding) per plan 14, or founder unblocks MK-025 (install
Rust toolchain, run the iroh POC on real devices, record the ADOPT/REJECT memo).
