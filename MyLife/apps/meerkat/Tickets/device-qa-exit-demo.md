# Meerkat physical multi-device exit-demo QA checklist

Final readiness item: a human-run, two-phone and three-phone exit demo on real
hardware. This checklist is the manual half of Task 5. The automated half (the
largest honest software substitute) is the multi-node e2e harness in
`packages/meerkat-relay/src/__tests__/`:

- `multi-node-2device-e2e.test.ts` (8 tests)
- `multi-node-3device-e2e.test.ts` (3 tests)
- `support/multi-node-harness.ts` (shared rig)
- `multi-node-config-guard.test.ts` (config drift guard)

## What the harness proves, and what it does NOT

The harness boots a real `RelayServer` on `127.0.0.1` and drives 2 and 3 fully
independent nodes (own identity, own database, own `NativeSyncEngine`) through the
EXACT shipping app session path (`NativeSyncEngine.syncWithConnection` /
`handleIncomingConnection` over `connectRelayPeer`, mirroring `SyncProvider.tsx`).
It imports only symbols that also exist in `packages/sync/src/index.native.ts`,
so it exercises the app's real path, not a Node-only shortcut.

The harness proves PROTOCOL + RELAY correctness only:

- Pairing (real X25519 DH, same secret both ways) and SAS (same five emoji both
  ends; a MITM with a different secret does NOT match).
- Manual relay sessions move a real `mp_pad` row and signed `cm_messages` between
  databases, with a recorded `sync_session` row and zero inbound rejections.
- The channel role gate (`evaluateChannelPost`) denies a member posting to an
  owner-only channel with reason `channel_role_denied`, and rejects a non-member.
- Offline mailbox: a sealed channel burst parks on the relay while the receiver
  is offline, the relay wire bytes contain NO device ids / community id / channel
  id / plaintext, and the receiver drains in HLC order on reconnect.
- Read state lives on the reader's OWN `cm_read_state`; its `maxScope`
  (`personal_replica`) keeps it out of a shared-workspace session.
- Remote share fetch verifies + pins from a real HTTP host, and fails closed on a
  tampered host and on a wrong expected author.
- Three-node convergence with NO silent auto-fanout: a message authored on B is
  absent on C until a direct B<->C session runs.

A GREEN HARNESS IS NOT PHYSICAL SIGN-OFF. The harness uses a loopback relay and
in-memory databases; it cannot exercise the physical transport rungs or the OS.
Until a human completes the steps below, the launch-plan "Physical two-device and
three-device exit-demo QA" bullet STAYS pending.

## Honesty rule for every step

Read only the indicators the app already shows honestly. Never accept a "looks
connected" feeling as a pass. The real indicators are:

- Sync screen recorded-session list: a NEW completed session row with non-zero
  byte counts (the engine recorded a real session; there is no fake "connected"
  light).
- SAS emoji compare screen: the five emoji on both phones.
- Communities unread badges and the channel screen message list (only locally
  recorded `cm_messages` events render).
- Pinned detail screen: a decrypt round-trip of fetched content.

If an indicator does not move, the rung did not move bytes. Mark it FAIL.

## Preconditions

- A dev build (LAN rung needs `react-native-tcp-socket` + `react-native-zeroconf`;
  background sync needs the dev-build flag). Expo Go cannot test LAN/background.
- Phones on the same Wi-Fi LAN for the LAN rung; iOS Local Network permission
  granted (the app sets `NSLocalNetworkUsageDescription` + `NSBonjourServices`).
- A reachable relay URL (a deployed relay or a laptop running
  `pnpm --filter @mylife/meerkat-relay start`, both phones pointed at it).

---

## Two-device exit demo

### Rung 1 - Identity + friend code (device A, device B)

1. On each phone open Identity. Confirm a fingerprint, public key, name, and a
   friend code render (real values from the keychain identity).
2. Relaunch each app. Confirm the identity and any authored shares survive
   (MK-001 keychain persistence).

- Indicator: the Identity screen fields are populated and stable across relaunch.
- Pass: both phones show a persistent fingerprint + friend code.
- Proves on device: keychain-backed identity durability (the harness uses a fresh
  in-memory identity per node, so durability is device-only).

### Rung 2 - Pairing + SAS (device A <-> device B)

1. On A, copy the pairing payload. On B, paste it (or resolve A's friend code via
   the relay). Confirm B reports a successful pair.
2. Open the SAS compare on both. Confirm the five emoji MATCH. Confirm each.

- Indicator: paired-device row appears; SAS emoji identical on both phones.
- Pass: pair succeeds and the five emoji match; both confirm.
- Negative to try: have a third phone paste a tampered payload; confirm the app
  blocks it (signature failure / key-change warning), never silently pairs.
- Harness twin: `multi-node-2device-e2e.test.ts` rung 2 (same secret + same SAS;
  MITM does not match). Device run adds: the real copy/paste/scan UX and the SAS
  screen rendering.

### Rung 3 - Manual relay session (the bellwether pad)

1. Point both phones at the relay URL and a shared phrase. On A edit the pad. On
   B tap Listen; on A tap Sync now.
2. On B open the pad. Confirm A's text arrived.
3. On both phones open the Sync history.

- Indicator: a NEW completed session row with non-zero bytes on both phones; B's
  pad shows A's text.
- Pass: the pad text crosses and a real recorded session row appears (not a
  spinner, not a "connected" badge).
- Harness twin: rung 3 (pad lands in B, `getRecentSyncSessions` > 0, zero
  rejections). Device run adds: real WAN/relay transport and UX.

### Rung 4 - Channel chat over the relay

1. On A create a community with B as a member and a `general` channel plus an
   owner-only `announcements` channel. Share the invite link to B; B joins.
2. On A post two messages in `general`. Run a relay session (Listen on B, Sync on
   A). On B open `general`.
3. On B, attempt to post in `announcements` (owner-only).

- Indicator: B's `general` shows both messages in order; the unread badge clears
  after B reads. B's attempt to post in `announcements` is refused.
- Pass: B sees A's messages; the owner-only post is denied in the UI and is not
  applied if force-synced (role gate).
- Harness twin: rung 4 (delivery + `resolveChannelMessages` match) and rung 4
  NEGATIVE (`channel_role_denied`). Device run adds: invite-link UX + live badges.

### Rung 5 - Offline mailbox (store-and-forward)

1. Background or disconnect B. On A, post several channel messages (they park in
   B's pair-private mailbox on the relay).
2. Bring B to foreground and tap "Run background sync now" (Settings > Background
   sync).

- Indicator: the background-sync result shows a real applied count; the parked
  messages appear in B's channel in order.
- Pass: B drains the parked burst on wake; the status reports only the count it
  actually applied (never an inflated number).
- Harness twin: rung 5 (mailboxed envelope count increments, zero-knowledge wire
  bytes, HLC-ordered drain). Device run adds: real OS background/foreground
  transition and the relay's real TTL window.

### Rung 6 - Read state across the user's OWN devices

1. If A and B are the SAME user's two devices (pair them as personal devices),
   read a channel on one and run a session.

- Indicator: the unread badge state follows the user to the other device; it does
  NOT leak to a different community member.
- Pass: read state replicates between the user's own paired devices and never
  shows up for a non-self member.
- Harness twin: rung 6 (read state on the reader's OWN `cm_read_state`;
  `maxScope` keeps it out of a shared session). Device run adds: the live badge.

### Rung 7 - Remote share fetch (open a link)

1. On A, seal + pin content and build a share link. Host it (a seeder or A's
   node). On B (which never saw the content) open the link and paste the host URL.

- Indicator: B fetches, verifies, pins, and the pinned detail shows a successful
  decrypt round-trip.
- Pass: B opens content it never held; a tampered or wrong-author source is
  refused with a real error (never a silent partial).
- Harness twin: rung 7 (fetch + verify + pin; tampered host skipped; wrong author
  rejected). Device run adds: real HTTP host + the paste-host UX.

### LAN rung (dev build, same Wi-Fi) - device-only

1. On B tap Listen on LAN (it advertises + browses via mDNS). On A, either tap a
   discovered peer or enter B's IP:port and Sync.

- Indicator: a NEW completed session row appears (same recorded-session proof as
  the relay rung), sourced over LAN.
- Pass: the pad / channel messages cross over LAN and a real session row records
  it; without the native modules the action fails with recovery guidance, never a
  crash or a fake success.
- Harness twin: NONE for live interface binding / mDNS. The framed protocol over
  `node:net` is proven in `@mylife/sync`'s `lan-tcp-e2e.test.ts`, but real NIC
  binding, mDNS browse/advertise, and the iOS Local Network permission prompt are
  device-only. This rung MUST be run by a human.

---

## Three-device exit demo

Add a device C. Confirm:

1. B and C each resolve A's friend code COLD (A never met them) and pair + SAS.
2. A posts channel messages; run A<->B then A<->C sessions. Confirm all three
   converge to the SAME channel state.
3. C posts a message; confirm it does NOT appear on B until a direct B<->C (or
   A-relayed) session runs.

- Indicator: identical channel message lists on all three; no message appears on
  a phone that never ran a session carrying it.
- Pass: convergence after each real session; NO silent mesh fan-out.
- Harness twin: `multi-node-3device-e2e.test.ts` (rendezvous fan-in, convergence,
  honest no-auto-fanout). Device run adds: three real radios and UX.

---

## Coverage Gaps (what the harness genuinely cannot prove)

| Area | Why the harness cannot reach it | Where it is covered instead |
|------|--------------------------------|-----------------------------|
| LAN rung live run | Needs `react-native-tcp-socket` + `react-native-zeroconf` and a real NIC | Device LAN rung above; protocol in sync `lan-tcp-e2e.test.ts` |
| mDNS discovery (advertise/browse) | Needs Bonjour/NSD on a real LAN + iOS Local Network permission prompt | Device LAN rung above (human only) |
| BLE transport | Not built in code at all (wake-up pings only, future) | Gap only; nothing to test yet |
| OS background execution limits | iOS/Android suspend WebSocket/relay when backgrounded; budgets are OS-decided | Device rung 5 + the Background sync QA checklist in `launch-plan.md` |
| Push wake delivery | No production push pipeline; APNs/FCM are device + ops | `launch-plan.md` background checklist (human + ops) |
| Force-quit / low-power behavior | OS-only scheduling behavior | `launch-plan.md` background checklist (human only) |
| WAN/NAT/TLS/region latency + soak | Harness relay is loopback `127.0.0.1`; no TLS, no NAT, no scale | Founder ops: `docs/designs/meerkat-relay-fleet-runbook.md` |
| Keychain identity durability across reinstall | Harness uses in-memory identities | Device rung 1 above (human only) |

## Sign-off

The launch-plan physical exit-demo bullet may be marked done ONLY after a human
records a pass on every rung above (including the LAN and three-device rungs) on
real hardware. Until then it stays pending.
