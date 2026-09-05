# Meerkat Plan 25 codeable tail + Plan 40 residuals — 2026-07-13

Branch `feature/meerkat-plan25-calls` (worktree `.claude/worktrees/meerkat-plan25-calls`),
continuing from `9accd165`. Resolved every remaining CODEABLE item for Plan 25 (calls and
rooms) plus the Plan 40 residuals. Release decision unchanged: **NO-GO** (remaining path is
founder-operated).

## Baseline

Established green before packet work: meerkat parity, sync 1,963, relay 1,359, app 1,223,
web 795 tests all passing.

## Packets landed (one commit each)

### WP-25G — mobile direct calls (headline)
- `packages/sync/src/transport/call-signal-channel.ts` **CallSignalTransport**: near-real-time
  transport for WP-25B call signals over the existing relay (opaque carrier, no new signaling
  server). `listen()` holds an open per-token listener (immediate forward when both peers are
  joined) and parks to the TTL mailbox otherwise, draining on join; the 120s signal TTL kills
  stale parked frames at verify. Bounded reconnect; honest `listening`/`unavailable`/`stopped`
  status from real connect/close events only.
- `call-signal.ts` gained **sealed relay frames** (`sealCallSignalFrame`/`openCallSignalFrame`,
  device ids + kind never cross the relay in cleartext) and the **pair invite channel**
  (`deriveCallInviteToken`) so a callee can ring before it knows a callId.
- `RelaySession.onClose` seam added; `WebSocketRelaySession` implements it.
- `apps/meerkat` **CallProvider**: wires CallSession (WP-25D) + call-media-backend (WP-25G) +
  CallSignalTransport + WP-25F CallKit/Telecom bridge + a persisted nonce replay floor +
  deterministic glare adoption with per-call channel re-pointing. `call-provider-core.ts` holds
  the pure decisions (`peekInboundCallSignal` verify-before-ring NC-25.2, token routing plan,
  `shouldRingForInvite`, `makeCallId`).
- `call-store.ts` **`call_` tables** (call_log/call_active/call_reports/call_signal_nonces),
  device-local and guarded outside `MEERKAT_SYNC_PREFIXES` (NC-25.7 guard test). History
  persists only through `foldCallLog`.
- Screens: in-call voice/video (`call.tsx`, real stream URLs only, TURN-vs-direct security copy
  from ICE stats, in-app ring, accept/decline/hangup/mute/camera/flip/speaker/reconnect), call
  history (`calls.tsx`), DM header + People sheet call buttons gated on `canCallPeer` (NC-25.8).
- Tests: sync call-signal-transport 15, app call-provider-core 10 + call-store 8. Gates: sync
  1,978 + app 1,241 + typecheck + lint + parity green.
- UNVERIFIED — pending dev/EAS build + two-device live QA for the media + native surfaces.

### WP-25H + WP-25I web (agent-built, Fable-verified)
- `apps/meerkat-web` twins built by a scoped `hub-shell-dev` agent (web tree only; parity script
  and packages untouched — independently confirmed). Direct calls: call-log-core /
  call-provider-core / call-store byte-twins (NC-25.7 web guard), a browser `call-media-backend`
  over `window.RTCPeerConnection` + `getUserMedia` (connection state from real
  connectionstatechange/iceconnectionstatechange events only, TURN vs direct from real
  candidate-pair stats, null when absent NC-25.8), a web CallProvider (relay-only, in-app ring,
  verify-before-ring NC-25.2, glare adoption, nonce floor), CallOverlay + CallHistoryView, DM +
  People entry points. Rooms: room-view-core / room-token-client / room-entry twins,
  `room-livekit-adapter` over the `livekit-client` browser SDK (lazy import, real SDK events ->
  RoomEvent only, NC-25.1/25.4), RoomView with permission-gated controls and byte-identical
  security copy; LiveKit URL from `import.meta.env.VITE_MEERKAT_LIVEKIT_URL` (empty = rooms off).
- Verified independently: meerkat-web 855 tests (+60), typecheck, lint, and meerkat parity green;
  no forbidden web transport strings; NC invariants present. Committed as one packet.

### WP-25J — adversarial hardening
- `packages/sync/src/__tests__/call-hardening-e2e.test.ts`: two real CallSessions over two real
  CallSignalTransports on a hub-modeling relay with a capture tap. 8 tests: off-pair garbage
  flood (cannot seal), frame-key-thief forgery (NC-25.2 verify drops it), wholesale replay (nonce
  floor), in-flight tamper (secretbox), glare storm convergence, pre-offer ICE flood (bounded),
  park/drain vs post-TTL stale. Live-LiveKit items (node drain, Egress fault, room-cap load) are a
  documented `describe.skip` (founder Phase H QA); relay stale-token-rejoin/generation/nonce-cap
  stay unit-proven in `room-token-service.test.ts`.

### Plan 40 residuals
- **R1** (mobile + web): `routeStagedShareToDm` routes a staged Share Inbox item THROUGH the real
  DM provider (`queueDmMessage`) — never a direct `dm_messages` write — marking routed only on the
  real local echo id; a failed/throwing send stays `staged` + retryable; `Sent` reads a real
  `dm_messages` row. Recipient picker (trusted, unblocked pairings) + "Send to person" on both
  surfaces. 5 mobile + 3 web core tests.
- **R2**: removed `SignalingClient`, `TrackerClient`, `PaidContentManager` (no-op fake-success
  stubs) from the sync public barrel after a zero-use reachability scan; deleted their sources +
  stub-only tests; added a permanent parity-gate section forbidding the names and any
  fake-success stub marker in barrel-reachable sync code.
- **push-store**: `getRegistration(idHash)` on both PushRegistrationStore adapters retired the
  O(n) `listRegistrations` walk in `rotateToken` (closes a long-standing tech-debt row).
- **R3**: reconciled `apps/meerkat/Tickets/launch-plan.md` (M8 voice/video now code-complete/
  unverified), the Plan 25 packet board, and the remaining-production-steps runbook (dated-note
  update on both the .md and .html twin). memory.md + this log + Open Brain updated.

## Out of scope (surfaced, not built)
- **Plan 41** (user-selected storage destinations) remains a **founder decision** (build vs a
  written NC-40.5 scope cut). Not built, no copy cut. It blocks the release SHA.
- Founder-ops: signed dev/EAS builds compiling the WebRTC + native call modules; the physical
  device + browser + LiveKit media matrix; LiveKit/Redis/Egress/TURN deployment; recording storage
  policy; store VoIP/background disclosures; vendors, legal, billing, push credentials, infra.

## Verification
Per packet before commit: `pnpm gate:function:changed`, touched-package typechecks (sync, relay,
meerkat-app, meerkat-web), full touched-package test batteries, `node scripts/check-meerkat-parity.mjs`,
and app/relay/web lint. Final state: sync 1,963 (+3 documented skips) / relay 1,360 / app 1,246 / web 858 tests green,
all typechecks + lint + meerkat parity green. Not pushed; not merged. NO-GO stands.
