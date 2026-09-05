# Meerkat issuance continuity, 2026-09-05

## Implemented

Continued the authorized production remediation on `7a40639d`, preserving unrelated changes. Another active session began editing the iOS private-storage migration. This session removed its own unused native bridge draft and left that migration to its existing writer.

S2 is partially remediated, not closed. Direct issuance now atomically requires no previous credential issuance. Renewal must name the account’s latest issued epoch, and the target epoch must advance. Memory, file-ledger and PostgreSQL stores enforce the same compare-and-set policy; omitted predecessor defaults to initial issuance and cannot bypass continuity. File stores retain the epoch across restarts and recover it from older issuance arrays. Deletion carries this epoch in the existing protected subject tombstone, so recreation cannot reset it. PostgreSQL migration 20 adds epoch-only columns and backfills active accounts from quota rows. No serial, persona identifier, finished token, blinding factor or account/persona link was added to the server store. It now retains the SHA-256 digest of the latest blinded request to recover an identical mint response; this digest is not the anonymous credential serial.

The mobile account panel now explains a refusal and the lack of automatic lost/expired-pass replacement. Deletion copy discloses the retained period/restriction marker. Clean in-window renewal still works. Private messaging, communities, mandatory safety verification and consent boundaries are unchanged. Correction after final parity inspection: the web twin is `apps/meerkat-web/src/lib/account.ts`. It was missed by the earlier assessment and is now updated and tested alongside mobile.

## Additional recovery and validity fixes

The mobile client formerly deleted pending blinding state after network failures and before the finished credential was saved. A lost response could consume the server quota while leaving no resumable request. Requests now persist their exact blinded body, public key and client-only blinding state in the isolated account keychain. A digest of the service/session context prevents reuse under a different session. Same-operation calls coalesce; conflicting operations refuse honestly. Failures retain pending data. Exact replay returns the same signature from memory, file and PostgreSQL stores without another quota row; a different blinded request remains refused. Pending state is removed only after the credential write succeeds. A changed session, period or incompatible legacy request is explicitly unrecoverable automatically and remains preserved.

Renewal also previously replaced a still-valid current pass with a future pass, and the presentation path checked only expiry. The client now stores latest and previous passes in one keychain write, sends only a credential whose validity interval includes the current time, switches at the boundary and prevents duplicate next-period renewal. The account panel distinguishes active, scheduled, expired and absent passes. Wire serialization projects only the public credential fields, never the storage wrapper or the other pass. Existing future-only records show scheduled rather than claiming active access. Deletion clears the same credential key, including both locally held periods; the existing server route revokes only the submitted latest pass, with unsubmitted passes still bounded by their own validity windows.

## Verification

- Focused service/store/foundation/privacy-wall tests: 46 passed before the final fail-closed default and parser hardening; final service/store subset: 29 passed.
- Three new service regressions failed against the reviewed service code, with the new store’s then-compatible legacy quota mode: direct next-period issuance, delete/recreate issuance, and a borrowed bearer with no matching issuance epoch. Temporary control files were removed. These are fixture RSA credentials, not real accounts.
- File-store checks cover two concurrent store instances, matching renewal, stale predecessor refusal, legacy ledger history and restart/deletion continuity.
- Real PostgreSQL 16: **8 passed**, including schema-19 upgrade/backfill, concurrent cross-epoch issuance and deletion carry. Homebrew PostgreSQL existed outside PATH. Three disposable runs used 16 MB shared buffers, 1 MB work memory and one test worker. All instances were stopped and their fixture directories removed. Docker stayed stopped. No deployed service was migrated.
- `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed` passed: affected lint/type/tests plus hub consumer typechecks. Final selected runs: mobile 209, web 139, relay 82 (eight PostgreSQL cases skipped in that run), sync 17. PostgreSQL subsequently ran independently as above. Final privacy-wall/foundation checks: 17 passed. Full parity and generated-artifact guard passed; `git diff --check` passed. No new browser, signed-device, provider or production-load proof is claimed. Existing multiple-lockfile warning remains.

- Final focused client suite: **31 passed**; service/file/privacy-wall suite: **34 passed**. Six recovery/period checks fail against the reviewed mobile client (new state-helper assertions omitted from the control so failures expose behavior). Temporary control files were removed. Final function gate rerun and full parity passed after these additions.

## Remaining blockers and decisions

S2 still blocks the public layer. A borrowed clean bearer from an account with the same latest epoch is not cryptographically bound to the renewing account. Epoch history cannot solve that. Lost-pass and missed-renewal-window recovery remain unavailable; the new guard deliberately does not treat credential loss as a clean reset. Previously deleted issuance history cannot be reconstructed from old tombstones. Those records require an explicit transition/recovery policy before release. Lost-response recovery now works within the same service/session and period. Session-change, older-format pending requests and full credential loss still require the broader recovery design.

The current blind-credential contract keeps blinding material on the client. Sending it to bind a renewal would change that protocol and its privacy analysis. No improvised proof, account/persona mapping or blanket public-layer success claim was introduced. Next engineering task: specify and implement a reviewed issuance-bound renewal/recovery proof using shared `packages/sync` primitives, with same-epoch borrowing, revocation retention, lost response, lost credential, account recreation and rollover acceptance tests.

Actions/provider/device evidence remains external. This session did not deploy, purchase, change account access, send messages, commit or push. Other sessions’ processes were left alone.

## Final web parity and cleanup follow-through

The web account client now retains exact pending requests and current/next passes, applies both validity boundaries, and projects only public credential fields. Its synchronous vault seam explicitly flushes before sending any new or recovered request, before discarding completed scratch, and before returning mint success. Failed persistence retains recovery material. Web UI distinguishes scheduled, expired and absent passes, permits initial mint during the renewal window, and uses matching refusal/recovery/deletion copy. A copy-parity regression guards both clients. The old claim that the web client did not exist was an investigation error, corrected here.

Both clients now serialize issuance across different session contexts, because those contexts still write one account-secret namespace. A finished, signature-verified stored pass permits deletion of obsolete pending scratch after a cleanup failure. An unfinished or unmatched request remains protected. Changed-session recovery remains unavailable when no finished pass was saved. Deletion copy no longer promises an incorrect 30-day upper bound; pre-issued and unsubmitted passes retain their actual period/grace limits. This changes no revocation protocol.

Focused results: 34 mobile account cases and 41 web account cases pass. Browser-specific tests inject permanent vault-flush failure before submission and after signature response, assert no premature durable success, and recover without another issuance. Other regressions cover lost response, failed credential write, conflicting-session overlap, cleanup failure, validity transitions and public-only serialization.

The user explicitly authorized committing and pushing this session's remediation on September 5. Task-owned source and evidence are being selected separately from concurrent private-storage, native release-polish, instruction-reorganization and research work. The default pre-commit wrapper stashes whole package scopes, raises the Node heap to 16 GB and kills newly observed test processes. Its checks will run explicitly with one worker; the destructive-to-concurrent-work wrapper will not run during this commit.

GitHub read-only recheck on September 5 still reports Actions disabled. Latest listed Release Verify remains cancelled run 30716741802, SHA 43a357a3d8f761207d6400ddaf78beccea6bcc2b. Push authorization does not enable Actions or establish signed-device/provider proof.

### Final pre-commit evidence

- Seven new web recovery assertions fail against reviewed `7a40639d` in 41 ms of test execution; the temporary control files were removed. Failures are behavioral, without missing-export or timer-timeout failures.
- `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed` passed; the subsequent `--staged` gate also passed affected lint/type checks, hub consumer typechecks, and 152 mobile / 200 web / 82 relay / 42 sync selected tests. Eight PostgreSQL tests were skipped in this gate, with their separate real PostgreSQL result recorded above.
- Meerkat parity and transport checks passed against an archive of the exact staged tree. The temporary archive was removed. Full `pnpm check:parity` initially encountered a concurrently added onboarding core with no registry entry; after that session registered its twin, the full rerun passed. Those new onboarding changes remain outside this commit.
- Generated-artifact, web-barrel, ESM-require and staged whitespace checks passed. No new browser/device/provider proof is claimed; earlier shared-IndexedDB browser evidence remains recorded in the storage and relay sessions.
- Commit scope includes this session's integrated store-capability/hosted-access guard changes. Other sessions' native-storage migration, native permission/image-pin changes, onboarding, instruction reorganization, research and unrelated service work remain unstaged. Shared reports, memory, error log and native config were staged by content so the other writers' hunks stay intact.

### Delivery receipt

Implementation commit [`b550402f`](https://github.com/tshuldberg/MyLife/commit/b550402f9076761d82beb0cf7558e022dd080f7f) was pushed successfully to `origin/fix/meerkat-orphan-watchdog`. `git ls-remote` returned the exact full implementation SHA. The commit contains 147 selected files; concurrent native-storage, native-pin/permission, onboarding, instruction and research changes remain intact and uncommitted by this session. This documentation receipt follows the implementation commit. No deployment, account-access change, purchase or external message was performed.

Next priority remains issuance-bound renewal and recovery, including same-epoch borrowed-pass refusal and a fail-closed policy for legacy deleted history. This is unfinished local protocol engineering. Actions administration and signed-device/provider acceptance are separate external evidence requirements.

The delivery receipt changes documentation only. Generated-artifact and whitespace guards passed; no function logic changed, so the function gate was not repeated for this receipt.
