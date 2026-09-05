# 2026-07-11 Meerkat Plan 42 Codeable Scope Complete

**Branch:** `feature/meerkat-production-readiness-2026-07-09` (pushed to origin)

**Commits:** `2b0d9898`, `2740fb6a` (WP-42A), `32a9fc28` (WP-42B), `1ec2b5be` (WP-42C), `56df52a9` (WP-42D), `635f4949` (WP-42E), plus the `push-providers` cross-lib fix and this docs commit

**Launch status:** Production NO-GO (unchanged; native transport ACs are hardware-gated)

## What was done

Plan 42 (native nearby transport, push, background lifecycle) is complete for everything that can be built and verified without a dev build or physical devices, across five work packages implemented by parallel Opus agents with lead specs, adversarial review, and lead-run batteries.

### WP-42A (`2b0d9898`, `2740fb6a`): push gateway and client

One `PushProviderAdapter` contract with dependency-free APNs (node:http2 + ES256 JWT), FCM v1 (RS256 OAuth), and Web Push (VAPID ES256 + RFC 8291 aes128gcm) implementations, plus a fake for tests; outcomes are bounded reason classes, never provider bodies. The gateway registers, rotates, and revokes tokens under an AES-256-GCM keyring cipher that decrypts by envelope version so rotation never orphans a token, mints and revokes capabilities, and drains wakes through the fenced attempt lifecycle. Status is accepted/rejected/unknown, never delivered (NC-42.4); no record carries identity (NC-42.3). The RN-safe `PushGatewayClient` ships on both sync barrels with a legacy facade superset. The lead verified the RFC 8291 crypto first-hand via the round-trip-decrypt test and the RN-safe import graph.

### WP-42B (`32a9fc28`): owned native package and background lifecycle

`@mylife/meerkat-native-transport` exposes exactly the probed bridge contracts with a lazy bridge that returns null when the native side is absent, so an Expo Go or Node run honestly reports the rung unavailable. Loaders probe only the owned name (NC-42.2), task definitions moved to module scope before React mounts (NC-42.7), concurrent triggers coalesce to one drain (AC-42.8), and `registerPushWake` wires into boot and sign-out with rotation and revoke.

### WP-42C (`1ec2b5be`): native transport authorship

Swift MultipeerConnectivity and CoreBluetooth wake, plus Kotlin Wi-Fi Direct with DNS-SD and BLE GATT wake, matching the bridge contracts, with random UUID session handles, bounded sessions and sends, exactly-once close, background teardown, and wake-payload-only BLE with every write refused (NC-42.6). A root `.gitignore` rule was silently swallowing the package's `ios`/`android` source (it would have shipped empty); a narrowly-scoped un-ignore fixed it while the broad Expo-prebuild ignore still applies to app and module native dirs. Sources are unverified pending a dev build; AC-42.1/2/3 stay hardware-gated.

### WP-42D (`56df52a9`): web push

The single service worker gains push, notificationclick, and pushsubscriptionchange handlers alongside the untouched share-target handler. A closed-page push can only show a generic content-free notification and queue a drain-on-open; it cannot mutate the database because the worker holds no DB handle at all, so the closed-page limit is structural, not documented (AC-42.10). Registration carries only endpoint and public keys under a random binding, never identity (NC-42.3); honest status never claims push is on when it is not (NC-42.5). The VAPID keypair is founder-ops.

### WP-42E (`635f4949`): hardening and status ledger

Transport diagnostics report each rung and channel as available-or-unavailable-with-reason from the real availability system. `check:meerkat-transport-nc`, wired into `check:parity`, statically enforces six negative criteria and runs a self-test that plants a violation of each and confirms the gate catches it before the real pass. The device-matrix runbook covers every hardware-gated AC, and the status ledger maps each AC and NC to code-complete, static-gate-enforced, or hardware-gated founder-ops.

## Review catches this session (all verified before trusting)

1. **`.gitignore` swallowing the native package** (wp42c): the owned `ios`/`android` source was never tracked; without the fix the package ships empty. Verified the un-ignore is scoped to only the owned package.
2. **Cross-consumer typecheck gap** (wp42d): `push-providers.ts:621` passed the relay package's Node-libs typecheck but failed meerkat-web's DOM-libs typecheck (the web tests import the relay barrel). A gap in the lead's own WP-42A verification; fixed with a plain `ArrayBuffer` fetch body. Process lesson recorded: shared-package changes need the consumer typechecks, not just the package's own.
3. **Codex Phase 7 review** (carried in from the prior session's debt, resolved this session as `337405a4`): two narrow load-harness fail-open edges fixed; the error-rate probes were degenerate-input false positives.
4. **NC-42.7 gate strengthened at review**: it now requires a module-scope `defineTask` to be present, not just absent from the wrong places, so it cannot pass vacuously.

## Verification (lead-run)

| Gate | Result |
|---|---|
| Relay + sync + native + web typecheck (both lib sets) | Clean |
| Relay suite + live PostgreSQL | 1186 + 155 |
| Sync suite | 1812 |
| Native-transport bridge | 12 |
| Meerkat app suite | 1182 |
| Meerkat-web suite | 795 |
| NC-gate self-test (six planted violations caught) | Green |
| Full parity incl `check:meerkat-transport-nc` | Green |

## Hardware-gated remainder (founder-ops)

Two signed dev builds transferring real bytes over native transports (AC-42.1/2), BLE wake proof (AC-42.3), background-drain and rotation/revoke device evidence (AC-42.7/9), the full device matrix (AC-42.11), and provisioning APNs/FCM/VAPID credentials. Evidence lands in Plan 40. The status ledger at `docs/plans/queue/42-status-ledger.md` is the definitive per-criterion mapping.

## Remaining launch queue

Plans 43 (managed archive and safety), 41 (storage destinations), 25 (calls and rooms), Plan 40 residuals, and the founder-operated launch evidence. Meerkat remains production NO-GO.
