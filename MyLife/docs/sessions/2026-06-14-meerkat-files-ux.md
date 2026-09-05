# Session: Meerkat Files & Sharing feature (3 phases)

Date: 2026-06-14
Branch: feature/meerkat-ui-polish (off current main; NOT yet landed)
Mode: orchestrator over opus agent-team workflows (ultracode)

## Goal

After landing Meerkat v2 + the standalone app on main, complete the remaining
software-only work. The genuinely buildable remainder (everything else needs
hardware/cloud/login) was a deferred UI feature. The user chose a Discord/Slack
style file experience and approved an HTML mockup
(`docs/reports/meerkat-files-ux-mockup.html`) before any code. Overlap with the
Node tab and the OS Files app was resolved by putting files in the channel (plus a
per-community Files index), not a redundant global Downloads tab.

## Method

Design + honesty/sequencing audit across all 3 phases (read-only, parallel), then
per-phase implement -> adversarial review -> fix workflows, each verified by the
main session and committed on the feature branch as a gated checkpoint. Strict
order 1 -> 2 -> 3 (shared files: expo-blob-store.ts, the channel screen).

## Phase 1 - in-channel file card (commit bc2f331a1)

Extracted `AttachmentCard` out of the 1046-line channel screen. Per file: View
(unchanged), Save to... (reuses the verified-write save core), Remove. Remove
frees local bytes and renders a dashed placeholder.

Honesty: on-device vs removed is derived LIVE from `ExpoBlobStore.has()`, never a
stored flag and never written onto the signed (immutable) attachment.
`removeBlobLocal` is ref-count aware (`decrementBlobRefCount`; deletes the on-disk
file only at ref 0, so a multiply-referenced blob is never orphaned) and
verifies-after-delete (returns verify-failed if bytes survive, so the UI never
falsely claims freed space). Freed-space copy uses the signed `attachment.size`.
Remove is purely local (no cm_ event, no recordLocalChange, no mailbox). The
"Request again" button shipped disabled behind `REQUEST_AGAIN_ENABLED` (false)
with honest "coming soon" copy. New testable seams with no RN import:
`data/blob-store-core.ts` (injectable `BlobIoAdapter`, ref-count + verify branches
unit-tested via a fake FS), `data/attachment-card-state.ts` (pure view-model),
`theme/format.ts`.

## Phase 2 - per-community Files index + bulk export (commit f20dd8298)

A hidden, community-scoped route `files/[communityId].tsx` (href:null) reached
from the channel header and the community panel. Aggregates files across the
community's channels from RESOLVED message events (`listChannelMessages` ->
`resolveChannelMessages`), never from `cm_message_attachments` rows (never
tombstoned -> ghost files), deduped to one source-of-truth row per blob.
On-device vs removed is a real live `has()` pass re-run on focus. Multi-select +
select-all (present rows only); the bulk-bar total comes from the live presence
map. `saveFilesBulk` (pure, fuzz-tested so saved+failed+skipped===total) returns
honest per-file outcomes with a "{saved} of {total} saved" headline, never a
blanket all-done; removed files are skipped with an honest reason.

iOS bulk avoids N share sheets: `saveBytesToDocuments` writes verified copies into
`documentDirectory/Meerkat` in one pass (app.json `UIFileSharingEnabled` +
`LSSupportsOpeningDocumentsInPlace` make it browsable under On My iPhone >
Meerkat, guarded by an app-config test); Android uses the SAF folder. No global
tab; channel flow + Phase 1 card untouched.

## Phase 3 - request-again / approve / re-send protocol (commit 054f5db8d)

A user who removed a file can request it back from the message owner, who
approves, and the sealed blocks are re-sent and verify-then-pinned. Rides the
EXISTING pair-private mailbox (no relay change): two new sealed payload kinds
(`file-request`, `file-grant`) live inside `sealMailboxDelta`, addressed by
`deriveMailboxToken`, so the relay sees only a 64-hex token + ciphertext (a test
asserts the wire JSON leaks no pubkey/blobHash/kind tag).

Verify-then-pin both directions: the owner re-verifies `blobContentHash` before
sealing (declines if drifted/absent); the requester re-checks the reassembled hash
AND that it matches the blobHash in its OWN signed cm_message event before
`ExpoBlobStore.put`, and flips to "restored" only after put + a live `has()`
confirm. New `mailbox-dispatch.ts` `applyMailboxEnvelope` opens+verifies once then
routes by inner kind and drops unknown kinds fail-closed (counted), without
regressing the channel-message drain; `runMailboxDrainJob` is generalized and both
foreground and background drains share it. `cm_file_requests` is a LOCAL-ONLY
table (absent from `COMMUNITY_SYNC_POLICY.entityRules`, guarded by a test) so it
never replicates. Honest state machine: "waiting" only after a real park
(queued>0) + row, "restored" only after verify-then-pin, decline surfaces the real
reason. Owner-only, paired-members-only, membership + revocation re-checked, manual
approve. `REQUEST_AGAIN_ENABLED` flipped to true and wired to the live
`queueFileRequest`; an honest `runForegroundDrain` on channel-open (the real drain,
no-op without a relay) advances the flow when both users are active.

## Verification (orchestrator-run, final)

- `@mylife/sync`: 1097 tests, typecheck clean (file-request-mailbox 16 +
  restore-e2e 7 incl. no-peer store-and-forward + adversarial wrong-bytes +
  unknown-kind fail-closed).
- `@mylife/meerkat-app`: 149 tests, typecheck clean.
- `@mylife/meerkat-relay`: 110 tests, ZERO diff (unchanged - the protocol rides
  the existing mailbox).
- `pnpm gate:function:changed` exit 0 (mobile + web consumer typechecks against
  the new sync exports). `check-meerkat-parity` green.
- The `background-sync.test.ts` "cannot find module" editor diagnostic was
  transient LSP noise after a large file operation; `tsc` is authoritative and
  clean.

## Commits (on feature/meerkat-ui-polish, NOT landed to main)

- bc2f331a1 feat(meerkat): files Phase 1
- f20dd8298 feat(meerkat): files Phase 2
- 054f5db8d feat(meerkat): files Phase 3
- e4cc8aff1 docs(meerkat): onboarding walkthrough + Files & Sharing UX mockup

## Remaining (needs hardware, not software)

Live two-device QA of the request/approve/restore loop over a real relay (offline
owner parks/drains; large multi-frame blob; relay TTL expiry leaving a re-tryable
state); the device QA checklist patterns in `Tickets/device-qa-exit-demo.md` apply.
Landing this branch to main is pending the user's go-ahead.
