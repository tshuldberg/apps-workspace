# Meerkat launch plan

Maps the standalone Meerkat app to the active mesh sync v2 and communities plans:
`docs/plans/active/14-meerkat-network-v2-mission-control.md`,
`docs/plans/active/15-meerkat-communities-suite.md`, and
`docs/plans/active/15-M7-channel-chat-implementation.md`. This app is the
product front door; the network is built underneath it milestone by milestone.

## Current state

Real and testable in code:

- Persistent device identity in the keychain (MK-001 secret-store + PRNG fix).
- Friend codes and relay rendezvous (generate, publish, resolve, checksum-validate).
- Seal -> pin -> share link -> open round trip, all verified end to end.
- Manual encrypted relay sessions and development-build LAN sessions through the
  native sync engine.
- Signed communities with channels, roles, invites, local channel chat,
  attachments, unread badges, and best-effort offline mailbox delivery.
- Manual host-history import from a pasted signed manifest, verified with the
  current community group key before local insertion.
- Remote share-link fetch from HTTP node hosts, either pasted by the user or
  discovered automatically: when a relay is configured, opening a
  `meerkat://share` with no pasted host looks up candidate hosts from a
  zero-knowledge relay registry (opaque HKDF rid, secretboxed records), then
  verifies sealed blocks with the share link key and author before pinning
  locally. Discovery only produces candidate hosts; trust stays in the existing
  verify-then-pin path.
- A working, smoke-tested production relay image (ws+zod-only, stateless,
  zero-knowledge) plus deploy templates (docker-compose, Caddyfile, fly.toml,
  render.yaml). `scripts/smoke-relay.mjs` boots the real bin and carries a live
  engine session; a log-hygiene e2e proves stdout never leaks ciphertext.
- Honest UI: transport, delivery, history, and file availability are only shown
  when backed by local records or real sessions.

Still pending before broad production:

- Physical two-device and three-device exit-demo QA. STILL PENDING (human +
  hardware). The largest honest software substitute now exists: the multi-node
  e2e harness (`packages/meerkat-relay/src/__tests__/multi-node-2device-e2e.test.ts`,
  `multi-node-3device-e2e.test.ts`, `support/multi-node-harness.ts`,
  `multi-node-config-guard.test.ts`) boots a real relay and drives 2 and 3 fully
  independent nodes through the exact shipping engine path, proving PROTOCOL +
  RELAY correctness only (pairing/SAS, manual relay sessions, channel delivery +
  role gate, offline mailbox with zero-knowledge wire bytes, read-state scope,
  remote-share fetch with fail-closed negatives, three-node convergence with no
  silent auto-fanout). It does NOT prove the physical transport/OS rungs
  (LAN/mDNS, BLE, OS background limits, push); those remain UNVERIFIED until a
  human runs the rung-by-rung checklist in `Tickets/device-qa-exit-demo.md`. A
  green harness is NOT physical sign-off, so this bullet stays pending.
- Background mailbox drain is code-complete and honest: `runBackgroundSyncOnce`
  -> `runMailboxDrainJob` opens and applies channel messages a paired device
  parked while this device was offline (fail-closed), exercised on demand via
  the "Run background sync now" button (Settings > Background sync). The OS
  scheduler (expo-task-manager / expo-background-task) and data-only push wake
  (expo-notifications) are wired but DEFERRED behind a dev-build flag
  (`background_sync_enabled`, default off) with native modules lazy-loaded.
  Still requires a dev build + two devices to verify: real OS cadence, iOS
  background-execution budget (~30s, opportunistic, app must have launched once
  and not be force-quit), real push token + APNs/FCM delivery, and WAL SQLite
  access from a headless background process while the app may be open. See the
  Background sync QA checklist below.
- Automatic live peer auto-dial / always-connected mesh (no honest software
  slice yet).
- Production loop for automatic share-link host discovery: the resolve side is
  code-complete, but the end-to-end win needs a deployed discovery relay plus an
  always-on seeder that announces what it holds (a phone has no inbound HTTP, so
  the standalone app is resolve-only and never announces). The seeder announce
  helper ships off by default (needs `DISCOVERY_RELAY_URL` + `PUBLIC_BASE_URL`).
- A standalone Downloads browser screen and bulk/multi-file save (the per-item
  Save flow below is built; a dedicated downloads surface is not).
- Live production relay fleet: the image and templates exist and are smoke-tested,
  but the cloud account, domain/DNS, TLS issuance, per-region machines, external
  uptime monitor, and the packaged seeder/community-host image remain founder ops
  (see `docs/designs/meerkat-relay-fleet-runbook.md`).
- Automatic host catalog discovery and polished native scrollback.

## Milestone map

| Milestone | Theme | What lands in this app |
|-----------|-------|------------------------|
| M0-M2 | First bytes, hardening, trust | Manual relay sessions, dev-build LAN, signed pairing, friend-code rendezvous, SAS verification, revocation. Code-complete with device QA still required. |
| M3-M4 | Group keys and blobs | Group-key and blob-transfer primitives exist; channel attachments use the blob path. Share-link host fetch works from pasted hosts and from a zero-knowledge relay host registry (resolve side complete); the production announce/relay deployment loop remains ops. |
| M5-M6 | Communities and services | Signed communities, seeder/hosted node primitives, relay selector, and pricing engines exist. Production relay/host deployment remains ops/product work. |
| M7 | Channel chat | Signed channel messages, edit/delete, attachments, host-history protocol, manual native history import, offline mailbox, and read state are code-complete. Native exit-demo QA and automatic host catalog discovery remain. |
| M8+ | Full social platform | Channel/admin CRUD, moderation, profiles, reactions, search, notifications, and presence exist. Voice/video calls and community rooms are CODE-COMPLETE (Plan 25 WP-25A..J: signaling, direct-call state machine + media backend, LiveKit room admission + UI, native CallKit/Telecom, mobile + web) but UNVERIFIED until a dev/EAS build compiles the WebRTC + native modules and the device/LiveKit matrix runs. Screen share and the recording flow remain founder-operated Phase H work. |

## Background sync QA checklist (dev build + two devices)

The pure jobs are Vitest-covered; these steps need a dev build and physical
devices because the OS scheduler, push delivery, and background execution
budget cannot be simulated in Node.

1. Dev-build profile installs expo-task-manager, expo-background-task, and
   expo-notifications, then flips `background_sync_enabled` on from Settings.
2. Offline-park then drain-on-wake: pair device A and B on a relay phrase. With
   B backgrounded/offline, send channel messages from A (they park in B's
   mailbox). Bring B to foreground and tap "Run background sync now"; confirm
   the parked messages appear and the status shows the real applied count.
3. Scheduled drain: leave B enabled and backgrounded; confirm (over minutes to
   hours, OS-decided) a scheduled run drains queued messages. Expect runs to be
   sparse and never guaranteed.
4. Push wake: send a data-only push to B; confirm it ENQUEUES a drain and a
   "message received" notification appears ONLY when real events were applied.
5. Force-quit behavior: confirm a force-quit app does not run scheduled jobs
   (iOS), and the on-demand button still works on next launch.
6. Low-power mode: confirm scheduled cadence degrades gracefully and copy never
   overstates what ran.
7. WAL concurrency: with the app open AND a background run firing, confirm no
   SQLite corruption and that both writers see consistent cm_messages.

## Save-destination QA checklist (device-only paths)

The save core (`data/file-save.ts`), write-verification, SAF persistence,
filename sanitization, base64 encoding, and the input-driven `files` readiness
item are Vitest-covered behind the injected `FileSaveAdapter`. The live OS
dialogs cannot run in Node and need real builds:

1. Android folder pick (dev build): Settings > Saved files > Choose default
   folder. Pick a folder via the SAF picker. Confirm the readiness `files` item
   flips to Ready and the setting persists across a relaunch.
2. Android save + verify: open a share link or a channel attachment, tap Save.
   Confirm the file appears in the chosen folder (Files app) and the UI says
   "Saved to your folder and verified on disk" only after the write lands.
3. Android stale tree: delete the chosen folder or revoke the SAF grant, then
   Save. Confirm the UI shows a real failure and re-offers the folder picker;
   the file is never silently discarded.
4. Android cancelled picker: trigger Choose folder and cancel. Confirm no
   default is set and the readiness item stays Needs action.
5. iOS share sheet: open a decrypted note or attachment, tap Save. Confirm the
   OS share sheet opens, "Save to Files" works, and the copy says it opened the
   save sheet (never asserting a final on-disk Files location).
6. iOS readiness: confirm the `files` item is Ready on iOS with no folder
   configured (the share sheet is always available).

## Guardrails

- Do not fake connectivity, delivery, read receipts, peer counts, or storage
  availability. A status only goes live when the rung behind it actually moves
  bytes or a local protocol row records it.
- Keep `mk_`, `mp_`, `cm_`, and `sync_` boundaries intact.
- Keep the secret-store-first boot order.
