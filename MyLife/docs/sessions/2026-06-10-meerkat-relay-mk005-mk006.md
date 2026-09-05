# Meerkat: relay server + client backend (MK-005, MK-006) - 2026-06-10

Build session on `feature/meerkat-network`, continuing M0. The previous session
landed the real node crypto core + the standalone app, all single-device. This
session builds the first transport rung so bytes actually cross between two
clients: the relay server and its client backend.

## What shipped (real, tested)

### MK-005: `@mylife/meerkat-relay` (new workspace package)
A stateless, zero-knowledge relay: clients announce an opaque ephemeral token,
the relay pairs clients sharing a token and forwards ciphertext envelopes. It
holds no group keys, decodes no payloads, persists nothing beyond a short TTL
mailbox for envelopes whose peer has not arrived. Matches the `RelayBackend`
contract already documented in `packages/sync/src/transport/relay-transport.ts`.
- `src/protocol.ts`: JSON frame schemas (zod) + limits (64 KB envelope, 8 peers/token, 200 env/10s, 64-msg/5-min mailbox).
- `src/hub.ts`: `RelayHub`, transport-agnostic routing/mailbox/rate-limit core with an injectable clock. Forwards `env` verbatim; never decodes or logs it.
- `src/server.ts`: `startRelayServer` over `ws` (hello-first, frame-size cap, ws ping/pong heartbeat, periodic mailbox sweep). Logs events/counts only, never envelopes.
- `bin/meerkat-relay.mjs` (stdout structured logs), `Dockerfile` (multi-stage, no volumes), `README.md`.
- Tests: `hub.test.ts` (11: routing, token isolation, verbatim forwarding, mailbox deliver/TTL/cap, rate limit + window reset, peer cap, leave cleanup), `server.test.ts` (3: live two-socket ciphertext relay + the log recorder never receives an envelope, hello-first, malformed-frame rejection).

### MK-006: `WebSocketRelayBackend` in `@mylife/sync`
Implements the existing `RelayBackend` interface against a live relay using the
platform global `WebSocket` (present in React Native, browsers, and Node 22+),
so it adds no dependency and runs everywhere the app does. Speaks hello/env/bye;
base64-encodes the Uint8Array envelope; connect timeout; exported from both
index.ts and index.native.ts.

### The proof (e2e-backend.test.ts, 2 tests)
The real `WebSocketRelayBackend` moves real bytes through the real server:
- raw ciphertext round-trips between two sessions on one token;
- content is sealed on "device A" (`createSealedShare`), shipped as one opaque
  envelope through the live relay, and opened on "device B" (`openSealedShare`,
  expectedAuthor checked) with the link key arriving out of band. The plaintext
  matches; only ciphertext crossed the relay.

This is the first time bytes actually cross between two independent transport
clients in this codebase, with the real node crypto on top.

## Verification
- `pnpm --filter @mylife/meerkat-relay typecheck`: clean. `... test`: 16/16 (hub 11, server 3, e2e 2).
- `pnpm --filter @mylife/sync typecheck`: clean. `... test`: 798/798 (no regression from the new backend + barrel exports).
- `pnpm gate:function:changed`: EXIT 0 (shared-package change -> mobile + web consumer typechecks pass).

## Honest boundary
Code-verified end to end in Node. NOT done: deploying a relay to a region + 24h
soak (ops); reconnect/backoff + TransportManager auto-dial; and wiring the
SyncEngine over this backend inside apps/meerkat so the app UI shows a real
phone-to-phone transfer. Those are MK-007 (LAN), MK-002 (inbound enforcement),
and MK-008 (engine mount), the remainder of M0. The app still shows
"Pending M0" for transport until MK-008 lands.

## Files
- New: `packages/meerkat-relay/**` (package.json, tsconfig, vitest.config, src/{protocol,hub,server,index}.ts, 3 test files, bin, Dockerfile, README).
- New: `packages/sync/src/transport/websocket-relay-backend.ts` + barrel exports in index.ts/index.native.ts.

## Next
MK-007 LAN rung (zeroconf + tcp-socket + iOS local-network preflight), then
MK-008 mounting the engine in apps/meerkat so the Node tab shows a real session,
then a device QA pass. Also: relay reconnect/backoff and a deploy target.
