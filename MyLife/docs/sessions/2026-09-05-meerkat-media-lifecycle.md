# Meerkat media lifecycle remediation, 2026-09-05

## Scope and fixes

Continued authorized production remediation after `48a9073d`, with commit/push authorization retained. Concurrent account, onboarding, native storage, configuration and instruction edits remain separate. Tests run sequentially with one worker; no unrelated process is stopped.

- Native call and room loaders probe registered WebRTC/LiveKit bridges before evaluating optional native packages. This closes the remaining Expo Go package-evaluation path behind the previously recorded red overlay. Installed LiveKit React Native 2.11.1 and WebRTC 144.1.1 sources establish the bridge names; native reload proof is still required.
- Both room adapters now match exact SDK states, including `signalReconnecting`. Previously `disconnected` matched the `connected` substring. Unknown strings no longer fabricate a state. Failed joins, remote disconnect and manual leave dispose listeners and close the room once; native teardown also stops the audio session. Late SDK callbacks cannot revive a closed session. Missing media controls and controls after leave reject honestly.
- Both call adapters unsubscribe ICE/state listeners, ignore stale asynchronous statistics and post-close callbacks, and stop every acquired track even if another stop throws. Hangup is idempotent. Connection events are delivered immediately from the peer connection; diagnostic reads cannot delay them indefinitely.
- Shared `selectedWebRtcTransport` in `packages/sync` resolves the selected pair and both candidate references, using the [W3C statistics contract](https://www.w3.org/TR/webrtc-stats/#dom-rtctransportstats-selectedcandidatepairid). A successful or nominated check alone is not proof of selection. Missing evidence remains unknown; either selected relay candidate establishes a relayed path. No candidate addresses or credentials enter app logs or labels.
- Chromium exposed statistics lag after connection events. Route metadata gets at most five reads with 100/250/500/1000 ms waits, cancelled on unsubscribe or close. Elapsed time never becomes route evidence. The shared call state and both call screens distinguish unknown route evidence from direct/relayed paths, including recovery.

No transport or cryptography was reimplemented. The current account protocol work belongs to another active session. Static TURN credential issuance/quota design remains a separate F7 requirement; a correct route label does not make embedded credentials safe.

## Verification

- Focused native/app tests: 31 pass, including both room adapters through the same injected SDK harness, native bridge probes, call teardown and bounded diagnostics.
- Focused web call tests: 15 pass. Shared call/session/statistics tests: 53 pass.
- Negative controls against `48a9073d`: 11 room tests fail and five call teardown/diagnostic tests fail per surface. Temporary control files were removed. These failures expose behavior, not unavailable exports.
- Real Chromium loopback test uses the actual browser peer connection, synthetic audio devices, no STUN/TURN servers and one worker. Both peers establish the selected direct path, receive one remote audio track and end their local tracks on hangup. This proves the browser adapter path only, not physical media, TURN, room-provider interoperability or native bridge behavior.
- `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed` passed affected lint, type checks, selected regressions and hub consumer type checks. The first run encountered another session's missing `HonestNotice` import; that writer repaired it. An optional test unsubscribe needed an explicit type guard before the final pass.
- Final Chromium rerun: 1 passed. Full `pnpm check:parity`, generated-artifact, web-barrel and ESM-require guards passed.
- Fresh read-only GitHub inspection still reports Actions `enabled: false`; latest Release Verify remains cancelled run `30716741802`, SHA `43a357a3d8f761207d6400ddaf78beccea6bcc2b`, August 1. This candidate has no provider verification.

The browser test uses a dedicated ephemeral localhost Vite port, and Playwright shuts its browser/server down. No credentials, provider account, purchase, deployment or external message is involved. Reports and errors retain the outstanding provider/device and S2 protocol boundaries.

## Delivery

Only this media batch is staged. The repository hook stashes whole changed packages and kills newly observed Vitest processes, which can disrupt the other active sessions. Its applicable checks are run explicitly with one worker before committing with the hook wrapper disabled; no checks are waived. `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed --staged` passed; commit and remote verification will be recorded after delivery.


## F2 and F8 follow-through

Media implementation committed as `d97dd752a5c4fdd1cac4a9b46c40b7c9c2ef9174` and pushed to `origin/fix/meerkat-orphan-watchdog`. Read-only `git ls-remote` matched the full SHA.

The F8 review found a remaining F2 recovery defect: the emergency database download could reject without visible guidance or a handled promise. The UI now catches SQLite/download preparation failures, makes the action temporarily unavailable during preparation, releases any created object URL, and allows retry. It never changes pending revisions or claims durable save/download completion.

The added browser regression fails on `d97dd752` because no failure message appears. After the fix, **all 8 shared-IndexedDB storage browser tests pass**, including the new export-failure/retry case and the existing owner/crash/legacy-fence/quota recovery cases. The new case confirms no page error and preserves the pending row after a successful download request. Native parity is not applicable to this browser-only SQLite failure banner. `FUNCTION_GATE_MAX_WORKERS=1 pnpm gate:function:changed` and full parity passed after this change.

The [F8 local-storage threat model](../designs/meerkat-local-storage-threat-model.md) records ordinary message/attachment storage, sealed content, secret-vault limits, encrypted complete backups, encrypted identity recovery and the unencrypted emergency database download separately. It covers unlocked devices, browser compromise, snapshots, exports, deletion and key-lifecycle acceptance. Application database encryption, privacy app lock and physical protection remain unresolved release decisions. The paid app-unlock gate is not a privacy lock.

Final export staged gate: **1,309 web tests pass**, with lint and type checks. An earlier run ended on `ERR_IPC_CHANNEL_CLOSED` without a preceding assertion failure; cause was not established, and the one-worker rerun passed. Both original failure controls and successful browser runs are recorded above.


## Final delivery and remaining work

Export recovery and the F8 threat model committed as `7bf969f09654a120cdabb17bf48e44a2ad511158`. Push succeeded to `origin/fix/meerkat-orphan-watchdog`; `git ls-remote` matched the full SHA. Task-owned source/report/design files are clean. Unrelated account, native storage, onboarding, release configuration, instructions and other-app changes remain in the shared working tree and are not included in these commits.

Next highest-priority work is S2 same-epoch borrowed-pass binding and complete-loss/expired-pass recovery, reconciled with the active account session without weakening unlinkability. Actions is disabled and needs administrator action plus exact-candidate Release Verify. Temporary TURN issuance still needs the provider choice requested in chat. Physical media, native privacy protection, store purchase and configured provider acceptance require the corresponding devices/accounts. F10 local search, bounded feed work and device performance remain open; no new performance improvement is claimed. Creator commerce and public expansion remain separate programs.

This final delivery record changes documentation only, so no additional function gate is required. The code gates and their failed/rerun evidence are recorded above; the generated-artifact and whitespace guards are checked before committing the receipt.
