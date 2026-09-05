# Meerkat native transport, push, and background device matrix (Plan 42 P7)

This runbook is the HARDWARE half of Plan 42. Every acceptance criterion listed
here cannot be proven by code or a static gate: it needs two or more signed
physical-device builds, real radios, real OS scheduling, and (for push) live
provider credentials. The codeable half is done and fenced (see the status ledger
at `docs/plans/queue/42-status-ledger.md`); this file is what a human runs to turn
"code-complete" into "device-proven".

A GREEN test suite and a green NC gate are NOT device sign-off. The transport
availability system already reports every native rung unavailable until a dev
build proves it, and no authored-but-uncompiled Swift/Kotlin path ever sets
`isReal` or claims AC-42.1/2/3. Until a human records a pass on every rung below,
those ACs stay HARDWARE-GATED.

## Dev-build prerequisites (do this once, before any rung)

1. Build two (three for the convergence rung) signed development builds, NOT Expo
   Go. Expo Go cannot link the native modules and every native rung will honestly
   report "Not available on this build".
   - The builds must include `@mylife/meerkat-native-transport` (the owned Nearby
     + BLE module), `react-native-tcp-socket` + `react-native-zeroconf` (LAN), and
     `react-native-webrtc` (WebRTC), plus `expo-task-manager`,
     `expo-background-task`, and `expo-notifications` (background + push).
2. Configure `MEERKAT_PUSH_GATEWAY_URL` (and, for web, the VAPID public key) so the
   push channels are not `not_configured`. Deploy the push gateway first
   (`docs/guides/deploy-the-meerkat-push-gateway.md`) with real APNs and FCM
   credentials.
3. iOS: grant Local Network permission (LAN/Nearby Bonjour) and Notifications
   permission on first prompt. Android 12+: grant the Bluetooth runtime
   permissions; Android 13+: grant the nearby-Wi-Fi permission.
4. Open **Settings > Connection options > Transport diagnostics** on each device.
   This is the honest read-out you check throughout: each rung and push channel
   shows `Available` (native module/config present) or `Unavailable` with a machine
   reason. A rung must read `Available` here before you can expect it to move bytes.

## Honest indicators (read these, never a "looks connected" feeling)

- **Transport diagnostics screen**: per-rung `Available`/`Unavailable` + reason.
  `Available` means the native module is linked, not that a session is live.
- **Sync screen recorded-session list**: a NEW completed session row with non-zero
  byte counts is the ONLY proof a rung moved real bytes. No fake "connected" light.
- **SAS compare screen**: the five emoji match on both devices.
- **Channel message list / unread badges**: only locally recorded `cm_messages`
  render; a message you can read crossed a real session.
- **Background sync status (Settings)**: last attempted, last completed, applied
  count, exact error. It never displays "always on".
- **Notification**: a "message received" notification fires ONLY after a drain
  applied > 0 real events.

---

## AC-42.1 — iOS Nearby transfers real encrypted bytes (MultipeerConnectivity)

Needs: two signed iOS builds on the same physical space (Bluetooth + Wi-Fi on).

1. On both devices confirm **Transport diagnostics > Nearby** reads `Available`.
   If it reads `Unavailable / native_module_absent`, the build did not link the
   owned module; stop and rebuild.
2. Pair the two devices (Sync screen) and confirm the SAS five emoji match.
3. Force both LAN and relay OFF for this rung (turn off Wi-Fi infra / point at no
   relay) so the selector must choose Nearby. Edit the bellwether pad on A.
4. On B tap Listen; on A tap Sync now.

- Pass: B's pad shows A's text AND both Sync histories show a NEW completed session
  row with non-zero bytes, transport = nearby.
- Fail: no new recorded session row, or the diagnostics rung was not `Available`.
- Evidence to capture: device models, iOS versions, both session-row byte counts,
  a screen recording of the SAS match + the pad crossing.

## AC-42.2 — Android Nearby transfers real encrypted bytes (Wi-Fi Direct + DNS-SD)

Needs: two signed Android builds, Bluetooth + Location/Nearby-Wi-Fi permission on.

Same steps as AC-42.1 with **Transport diagnostics > Nearby** on Android. The group
owner/client socket forms over Wi-Fi Direct and DNS-SD discovers the peer.

- Pass: pad/channel messages cross over Nearby and both histories record a real
  session with non-zero bytes.
- Evidence: device models, Android versions, byte counts, recording.

## AC-42.3 — BLE wakes a peer and carries NO data bytes

Needs: two signed builds, Bluetooth on. BLE is the wake-only rung (NC-42.6).

1. Confirm **Transport diagnostics > Bluetooth wake** reads `Available` and is
   labelled "wake only".
2. Background B. On A trigger a state that advertises a wake (post channel
   messages so A has pending changes to signal).
3. Observe B receive the wake and escalate: B should run a drain over a DATA rung
   (LAN / Nearby / relay), NOT over BLE.

- Pass: B wakes and then drains over a data rung; the recorded session's transport
  is NEVER `ble`. No file/media bytes ever cross BLE.
- Fail: any recorded session claims BLE moved data, or a malformed wake is acted on.
- Evidence: a capture of the wake causing an escalation, and the recorded session
  showing a data rung (not BLE) carried the bytes.

## AC-42.4 — Native module missing → unavailable + fallback (also a code AC)

Partly codeable (the selector fallback is unit-proven), but the DEVICE half is:
on an Expo Go / a build without the native module, the diagnostics screen shows
Nearby/BLE/WebRTC/LAN `Unavailable` and a dial falls through to relay without a
crash or a fake success.

- Pass: with the native modules absent, the app never crashes, never shows a fake
  "connected", and a relay session still records honestly.

## AC-42.5 — Opaque push wake without exposing device identity (also partly codeable)

Needs: two signed builds + the deployed push gateway with live credentials.

1. Confirm **Transport diagnostics > (APNs on iOS / FCM on Android)** reads
   `Available` (gateway configured + a real device token registered). If it reads
   `no_native_token` or `not_configured`, fix the build/gateway first.
2. Pair A and B; through the encrypted paired flow B learns A's random wake
   capability.
3. Background A. From B, send a wake to A's capability.

- Pass: A wakes and drains; the gateway logs an attempt addressed by the random
  capability only. The gateway record carries NO device pubkey, community id,
  message id, or plaintext (verify against the gateway's redacted logs; the NC-42.3
  static gate already fences the record shapes).
- Evidence: the gateway attempt id + provider status, and a capture of A waking.

## AC-42.6 — Provider acceptance recorded, never "delivered"

Needs: the push gateway + a live wake (piggyback on AC-42.5).

1. After sending a wake, open the status route / gateway console for that attempt.

- Pass: the status reads `provider_accepted`, `provider_rejected`, or `unknown` —
  never "delivered". (The NC-42.4 static gate fences this in code; the device step
  confirms the live provider path also never overclaims.)

## AC-42.7 — Scheduled + push tasks defined before React mounts; real drain

Needs: one signed build. The NC-42.7 static gate proves `defineTask` is at module
scope; the DEVICE step proves a headless launch actually runs the drain.

1. Enable scheduled background sync (Settings, dev-build flag). Park messages for
   this device from a peer.
2. Force-quit the app (remove it from the app switcher). Wait for the OS to fire a
   background fetch (may take the OS's own interval; iOS decides timing).

- Pass: on the next open, the Background sync status shows a real applied count and
  a last-completed timestamp from WHILE the app was not foregrounded, and the parked
  messages are present. The task ran headless (React never mounted) and still drained.
- Fail: nothing drained until you manually opened and tapped "Run background sync".
- Evidence: the last-completed timestamp predating your manual open, applied count.

## AC-42.8 — Concurrent triggers do not double-apply (also codeable)

The coalescer is unit-proven (background-coalescer.test.ts). The device step: fire
a foreground resume, a scheduled run, and a push wake in a tight window and confirm
exactly one notification and no duplicated messages.

- Pass: one accurate "message received" notification; each message appears once.

## AC-42.9 — Token rotation, revoke, reinstall, sign-out, permission revoke

Needs: signed builds + the push gateway. Run each sub-case and read the honest state:

1. **Rotate**: force an OS push-token rotation (reinstall triggers one, or wait for
   the OS). Confirm wakes keep landing after rotation (the client re-registers,
   rotating the server token before dropping the old generation).
2. **Revoke a peer**: revoke a peer's wake capability; confirm that peer can no
   longer wake this device, and the diagnostics/gateway show the capability gone.
3. **Reinstall**: reinstall the app; confirm a NEW random registration handle is
   minted (the old one is unlinkable) and push re-registers.
4. **Sign-out / delete data**: confirm the server registration is revoked and no
   drain fires after sign-out.
5. **Permission revoke**: revoke Notifications permission in OS settings; confirm
   the push channel reads `Unavailable` and the app never claims push is on.

- Pass: every sub-case reads honestly; no false "delivered" or fake "available".
- Evidence: per sub-case, the diagnostics/gateway state before and after.

## AC-42.10 — Web Push works in supported browsers; states its closed-page limit

Needs: the deployed gateway + VAPID key. Mostly browser-testable (see
`web-push-*` and the service worker), but the closed-page behavior needs a real
browser:

1. In a supported browser, grant notification permission; confirm **Transport
   diagnostics-equivalent** (web capability status) shows web push active.
2. Fully close the page/tab. Send a wake.

- Pass: a closed page shows only a notification; opening it THEN drains. The service
  worker never mutates the page's SQLite DB. The UI states the closed-page limit.
- Evidence: a recording of the closed-page notification + drain-on-open.

## AC-42.11 — Full state matrix (foreground/background/terminated/reboot/battery/offline/radio)

Needs: signed builds. Run the mailbox-drain + wake path in EACH state and record:

| State | Setup | Pass condition |
|---|---|---|
| Foreground | app open | manual + auto drain apply real counts |
| Background | app backgrounded | a wake drains; status timestamp updates |
| Terminated | force-quit | AC-42.7 headless drain runs (OS-timed) |
| Reboot | reboot device, do not open app | on next OS-scheduled run, drain works; no cadence promise |
| Low battery | enable low-power mode | drain may be skipped_battery; status says so honestly, never a fake run |
| Offline | airplane mode | dial fails to the honest "not reachable" copy; no fake success |
| Radio/permission off | Wi-Fi/BT/permission off | the rung reads `Unavailable` with the right reason; selector falls back |

- Pass: every cell reads an honest indicator; nothing fabricates a run, a cadence,
  or a delivery. `skipped_battery` and `retryable_error` surface as themselves.
- Evidence: a filled copy of this table with device models, OS versions, networks,
  timestamps, and the honest indicator observed per cell.

---

## Where evidence lands (Plan 40)

Record all of the above in the Plan 40 release evidence ledger:
`docs/releases/meerkat/<release-id>/evidence.json` (+ its HTML twin), with device
models, OS versions, networks, timestamps, session-row byte counts, gateway attempt
ids, and provider statuses. Plan 42 moves to `docs/plans/done/` only after this
matrix is filled on real hardware and Plan 40 links the exact commits, signed
builds, and the running push gateway. Until then the ledger marks these ACs
HARDWARE-GATED / FOUNDER-OPS.

The loopback protocol/relay half (pairing, SAS, manual sessions, channel delivery,
offline mailbox, convergence) is separately covered by the automated multi-node
harness and the manual `apps/meerkat/Tickets/device-qa-exit-demo.md` checklist;
this runbook is specifically the native-radio, push-provider, and OS-scheduling
half that the harness cannot reach.
