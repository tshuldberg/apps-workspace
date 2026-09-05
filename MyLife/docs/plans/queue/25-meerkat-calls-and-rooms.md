# Plan 25 - Meerkat Voice, Video, Calls, and Community Rooms

> Rewritten and engineering-locked on 2026-07-09. This plan replaces the stale
> 2026-06-28 specification and all later status deltas. Build phases are execution
> order, not reduced release scope.

## Status

- **Active queue plan. Execution started 2026-07-12 on `feature/meerkat-plan25-calls`**
  (worktree `.claude/worktrees/meerkat-plan25-calls`, branched from
  `feature/meerkat-plan43` @ `89acfafc`). See the Status Delta packet board at the
  end of this document for live packet states.
- Phase 0 dependency migration LANDED (`296eec6f`): the mobile WebRTC runtime is now
  `@livekit/react-native-webrtc` 144.1.1 with `@livekit/react-native` 2.11.1,
  `livekit-client` 2.20.1, and `@livekit/react-native-expo-plugin` 1.0.2 pinned
  against Expo 54 / RN 0.81.5; the data backend was re-proven after migration.
  The backend still moves data-channel bytes only. No media session, room client,
  SFU deployment, call UI, or physical media proof exists yet.
- **SFU decision is locked:** self-hosted LiveKit for community rooms.
- **Direct-call decision is locked:** 1:1 voice and video remain direct WebRTC P2P,
  with TURN only when ICE requires it.
- **Native call decision is locked:** iOS PushKit plus CallKit and Android Core
  Telecom are release requirements, not optional extensions.
- **Feeds:** Plan 40 final launch.
- **Depends on:** Plan 42 general push registration and Plan 44 production state,
  observability, signed images, Redis, and deployment controls.

## Product Outcome

Users can:

- start and receive a 1:1 voice or video call from a DM or person surface;
- receive an incoming call while the app is backgrounded or terminated, subject to
  platform policy;
- join persistent community voice, video, and screen-sharing rooms;
- mute, deafen, switch camera, choose audio route, raise a hand, share a screen,
  moderate a room, and leave cleanly;
- see an accurate privacy boundary, participant state, recording state, failure,
  reconnect, and call history on mobile and web.

No screen may say connected, ringing, end-to-end encrypted, recording, delivered,
or in room unless a real engine, OS, or server event proves it.

## What Already Exists

| Existing capability | Reuse decision |
|---|---|
| Device identity, pinned bundles, SAS, revocation | Reuse for direct-call peer verification and room admission. |
| DMs and People surfaces on mobile and web | Add call entry points and call history here. |
| Relay `env`, rendezvous, and mailbox | Use for encrypted direct-call signaling. No new direct signaling server. |
| WebRTC manager and data session pattern | Reuse state and injected backend patterns, but build a separate media session. |
| ICE and TURN configuration | Centralize and reuse for direct calls. LiveKit owns its room ICE configuration. |
| Community membership and roles | Issue short-lived room tokens only after current membership and role verification. |
| Community safety and operator moderation | Reuse report and signed removal concepts. |
| Plan 42 push capability model | Extend with call wake scope and provider-specific native call delivery. |

## Binding Architecture Decisions

1. Direct 1:1 media uses direct WebRTC, not the SFU. The relay forwards encrypted
   signaling. TURN forwards encrypted SRTP when needed.
2. Community rooms use self-hosted LiveKit. Its official Expo and React Native SDK,
   self-hosting, reconnection, simulcast, screen share, egress, and distributed
   deployment support remove a large custom SFU surface.
3. Replace the app's plain `react-native-webrtc` package with
   `@livekit/react-native-webrtc` so direct data, direct media, and LiveKit use one
   native WebRTC runtime. Re-run all existing WebRTC data transport tests and device
   evidence after migration.
4. Add `@livekit/react-native`, `@livekit/react-native-expo-plugin`,
   `@livekit/react-native-webrtc`, `livekit-client`, and the server SDK at versions
   verified compatible with Expo SDK 54 and React Native 0.81. Pin the compatible set.
5. LiveKit room names and participant ids are random, short-lived values. The SFU
   never receives a Meerkat device key, persona key, community title, channel title,
   or display name.
6. A Meerkat room-token service verifies current signed community membership and
   room role, then issues a short-lived LiveKit token with the minimum permissions.
7. Direct-call signaling and room-token requests are signed and replay-protected.
8. iOS terminated-state incoming calls use PushKit and must immediately report to
   CallKit. Android uses Core Telecom for concurrency, audio focus, Bluetooth, and
   system call integration.
9. Recording is off by default and requires explicit moderator action plus a real
   room-wide indicator. Recording uses a separate LiveKit Egress service and managed
   storage from Plans 41 or 43.
10. Room E2EE is enabled only when every participant SDK supports and activates the
    same key provider. Otherwise the room states `Encrypted to the room server, not
    end-to-end`. A mobile participant can never inherit a web-only E2EE badge.

Official capability anchors:

- LiveKit Expo SDK setup: <https://docs.livekit.io/home/quickstarts/expo>
- LiveKit self-hosting: <https://docs.livekit.io/transport/self-hosting/>
- LiveKit multi-node deployment: <https://docs.livekit.io/transport/self-hosting/distributed/>
- Apple PushKit and CallKit requirement: <https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit>
- Android Telecom calling integration: <https://developer.android.com/develop/connectivity/telecom>

## NOT in Scope

- PSTN calling, phone numbers, SIP trunks, emergency calling, and contact-book
  upload are not part of Meerkat social calls.
- The SFU does not become a message, file, identity, or membership source of truth.
- A separate direct-call signaling service is not built because the relay already
  provides the opaque carrier.
- Cross-platform room E2EE is not claimed where a client runtime cannot perform it.
  The full supported path and honest transit fallback are both release scope.
- General push and ordinary background sync are owned by Plan 42.

## Architecture

```text
Direct 1:1

DM or People -> signed invite -> relay env/mailbox -> verified callee
                    |                  |
                    |                  +-> Plan 42 call wake capability
                    |                         |
                    |                         +-> PushKit/CallKit or FCM/Telecom
                    v
             offer, answer, ICE
                    |
                    v
        RTCPeerConnection direct or TURN
                    |
                    v
             real audio and video

Community room

current signed membership -> room-token service -> short-lived LiveKit JWT
          |                                             |
          |                                             v
          |                                LiveKit room with ephemeral ids
          |                                             |
          +-> role and removal checks                  SFU media
                                                        |
                                                        +-> optional Egress recording
```

## Security and Privacy Boundary

| Path | Media boundary | Identity boundary |
|---|---|---|
| Direct call without TURN | DTLS-SRTP between peers | relay sees opaque token, timing, and sizes |
| Direct call with TURN | encrypted SRTP passes through TURN | TURN sees network metadata, not media plaintext |
| LiveKit room without E2EE | DTLS-SRTP terminates at the SFU | SFU sees ephemeral room and participant ids |
| LiveKit room with verified E2EE | per-frame encryption remains between supported clients | SFU forwards encrypted frames |
| Recording | recording service receives room media after visible opt-in | output uses explicit retention and access policy |

Direct-call signals are encrypted to the recipient and signed with the existing
device identity. Room-token service requests use a separate signing domain and do
not expose private message content.

## Local Data Model

`call_` tables are device-local and excluded from every sync policy.

```sql
CREATE TABLE call_log (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('voice','video')),
  scope text NOT NULL CHECK (scope IN ('direct','room')),
  peer_anchor text,
  community_id text,
  room_id text,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  state text NOT NULL CHECK (state IN (
    'ringing','connecting','connected','ended','declined','busy','missed',
    'failed','cancelled','kicked'
  )),
  started_at text,
  ended_at text,
  end_reason text,
  created_at text NOT NULL
);

CREATE TABLE call_active (
  call_id text PRIMARY KEY,
  engine text NOT NULL CHECK (engine IN ('direct','livekit')),
  engine_state text NOT NULL,
  ice_state text,
  local_mic_on integer NOT NULL DEFAULT 1,
  local_cam_on integer NOT NULL DEFAULT 0,
  local_screen_on integer NOT NULL DEFAULT 0,
  recording_state text NOT NULL DEFAULT 'off',
  security_mode text NOT NULL CHECK (security_mode IN ('direct_e2e','room_e2ee','room_server_transit')),
  updated_at text NOT NULL
);

CREATE TABLE call_room_participant (
  call_id text NOT NULL,
  ephemeral_participant_id text NOT NULL,
  local_member_ref text,
  role text NOT NULL,
  mic_on integer NOT NULL DEFAULT 0,
  cam_on integer NOT NULL DEFAULT 0,
  screen_on integer NOT NULL DEFAULT 0,
  speaking integer NOT NULL DEFAULT 0,
  hand_raised integer NOT NULL DEFAULT 0,
  joined_at text NOT NULL,
  PRIMARY KEY (call_id, ephemeral_participant_id)
);

CREATE TABLE call_reports (
  id text PRIMARY KEY,
  call_id text NOT NULL,
  local_member_ref text NOT NULL,
  reason text NOT NULL,
  created_at text NOT NULL
);
```

`peer_anchor`, `community_id`, and `local_member_ref` never leave the local database
through the room token or LiveKit participant metadata.

## Protocol Contracts

### Direct-call signal

Add `packages/sync/src/protocol/call-signal.ts`:

```ts
export const CALL_SIGNAL_DOMAIN = 'meerkat-call-signal-v1';
export type CallSignalKind =
  | 'invite' | 'accept' | 'decline' | 'busy' | 'cancel' | 'end'
  | 'offer' | 'answer' | 'ice' | 'restart';

export interface CallSignal {
  version: 1;
  callId: string;
  kind: CallSignalKind;
  fromDeviceId: string;
  toDeviceId: string;
  media: 'voice' | 'video';
  payloadCiphertext?: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  signature: string;
}
```

Requirements:

- Validate ids, size, TTL, signer, recipient, nonce, replay, and signing domain.
- SDP and ICE stay inside recipient-encrypted payloads.
- Derive an ephemeral relay token from call id and a pair secret established by the
  existing trusted pairing. Do not derive a token only from public keys.
- Glare uses deterministic call-id ordering and one winning call state.

### Room admission

Add `packages/sync/src/protocol/room-membership.ts` and server verification:

- Request binds community id, channel or room id, descriptor revision, epoch,
  membership proof, requested permissions, ephemeral participant id, and expiry.
- Token service verifies current membership, signed descriptor, removal state, role,
  room cap, and replay before issuing a LiveKit token.
- LiveKit token grants only room join, publish allowed track types, subscribe, and
  data permissions needed by the role.
- Moderation increments a room admission generation and removes the participant.
  A stale token cannot rejoin after removal.

## Native Call Module

Create `packages/meerkat-call-native/` as an Expo module plus config plugin.

### iOS

- Register PushKit VoIP token and rotate it through Plan 42.
- Report every valid VoIP push to CallKit within the platform deadline.
- Map answer, decline, end, mute, hold, audio-session activation, and route events
  to the JavaScript call coordinator.
- Enable `audio`, `voip`, and `remote-notification` background modes.
- Add a Broadcast Upload Extension and App Group for screen sharing.
- Use stable call UUIDs without identity content.
- Reject stale, malformed, duplicate, or unverifiable pushes without exposing a
  caller name supplied by the server.

### Android

- Integrate the self-managed Core Telecom API and one persistent phone account.
- Declare call, microphone, camera, notification, Bluetooth, and foreground-service
  permissions appropriate to supported OS versions.
- Map answer, reject, disconnect, hold, audio route, focus, and competing-call state.
- Use a foreground service only for an active user-visible call or screen share.
- Implement MediaProjection screen sharing and its foreground-service type.

### Web

- Use Notifications and Web Push where supported, with an in-app ring when active.
- Browser calls require secure origin, media permission, and an active page.
- A closed browser may show a push notification but does not claim system-call parity.

## LiveKit Room Service

Deploy:

- LiveKit server in distributed mode with Redis;
- a Meerkat room-token service;
- LiveKit Egress for explicit recording;
- TURN/TLS and UDP ports required by the official deployment;
- private Prometheus metrics and Plan 44 tracing or log collection;
- staging and production instances with separate keys and domains.

The room-token service stores revocation and admission generation in PostgreSQL.
The SFU stores only ephemeral room state. Recording output is not written until a
moderator starts a real Egress job and all clients receive the recording event.

## Call and Room State Machines

```text
Direct outgoing

idle -> inviting -> ringing -> accepted -> negotiating -> connected
          |          |          |            |             |
          v          v          v            v             v
       failed      missed    declined      failed     reconnecting
                                                       |         |
                                                       v         v
                                                   connected   ended

Room

idle -> authorizing -> connecting -> joined -> reconnecting -> joined
          |               |           |             |
          v               v           v             v
       rejected         failed      kicked         failed
```

Only peer-connection or LiveKit room events can set `connected` or `joined`.
Only a real Egress event can set recording active.

## User Surfaces

Mobile and web must have matching behavior and copy:

- DM header and People row call buttons.
- Incoming system call and in-app ring.
- Direct in-call voice and video screen.
- Persistent channel room entry and active-room indicator.
- Room participant grid or speaker view.
- Mute, deafen, camera, camera switch, speaker or route, hand raise, screen share,
  reconnect, and leave.
- Owner and moderator controls for mute request, role, remove, end stream, record,
  and report.
- Call history with real terminal outcomes and duration only after connection.
- Settings for call permissions, background behavior, ringtone, default camera,
  data use, privacy boundary, and diagnostics.

Each surface covers loading, empty, permission denied, network error, partial media,
reconnecting, success, busy, full room, removed member, and unsupported capability.

## Build Phases

### Phase 0 - Dependency migration and protocol

- Pin the compatible LiveKit package set and migrate the existing data backend to
  `@livekit/react-native-webrtc`.
- Prove existing WebRTC data transfer still works before adding media.
- Build call signal, relay token, replay, glare, and room membership protocols.

### Phase 1 - Direct media engine and signaling

- Build platform-neutral media session and mobile or web adapters.
- Build encrypted signaling over relay env and mailbox.
- Add audio route, media permission, ICE restart, TURN, and connection-quality state.
- Add headless and live-relay 1:1 tests.

### Phase 2 - Native incoming call lifecycle

- Build the Expo native call module and config plugin.
- Wire PushKit and CallKit on iOS, Core Telecom on Android, and Plan 42 call wake.
- Prove foreground, background, terminated, locked, busy, and competing-call states.

### Phase 3 - Direct call UX

- Add mobile and web entry points, ring, voice, video, controls, history, and all
  failure or reconnect states.
- Add cross-network physical-device voice and video proof.

### Phase 4 - LiveKit infrastructure and admission

- Deploy local and staging LiveKit, Redis, token service, TURN, and Egress.
- Build room admission, ephemeral ids, roles, token generations, caps, and removal.
- Add image, config, metrics, and capacity controls through Plan 44.

### Phase 5 - Voice and video rooms

- Build channel room entry, room lifecycle, participants, speaking, mute, deafen,
  hand raise, role, camera, adaptive stream, reconnect, and active-room indicators.
- Derive every participant state from LiveKit events.

### Phase 6 - Screen sharing and background survival

- Add Android MediaProjection and iOS Broadcast Upload Extension.
- Add web screen share.
- Prove active-call audio, Bluetooth, lock-screen, route, background, and return.

### Phase 7 - Moderation, E2EE option, and recording

- Add remove, mute request, role, end stream, report, and stale-token rejection.
- Enable and test LiveKit E2EE on each supported client runtime.
- Add honest room-server fallback when any client cannot activate E2EE.
- Add explicit Egress recording with participant-wide indicator and retention flow.

### Phase 8 - Hardening and production evidence

- Add load, packet loss, reconnect, node drain, Redis loss, SFU loss, Egress failure,
  push delay, duplicate call, permission revoke, and malicious signal tests.
- Complete browser QA, design review, physical-device matrix, accessibility,
  runbooks, store disclosures, and Plan 40 evidence.

## Failure Modes

| Failure | Handling | Test | User-visible result |
|---|---|---|---|
| Forged or replayed invite | verify and drop before ring | protocol adversarial | no ring; bounded security metric |
| Push arrives twice | call id and nonce deduplicate | native integration | one system call |
| CallKit answer occurs before JS is warm | native coordinator retains action until engine attaches | terminated-state device test | connecting, then real result |
| Caller and callee call together | deterministic glare winner | concurrency test | one call, not two |
| Direct ICE fails | TURN attempt then failed state | cross-network device test | could not connect, never connected |
| Network changes mid-call | ICE restart and bounded reconnect | packet-loss and network-switch test | reconnecting or call dropped |
| Room token is stale after removal | generation check rejects and server removes | integration | removed from room |
| LiveKit node drains | SDK reconnects through balanced deployment | staging failover | reconnecting with real state |
| Mobile client lacks room E2EE | room-wide security mode falls back | mixed-client E2E | room-server encryption disclosure |
| Recording start fails | active indicator never sets | Egress fault test | recording could not start |
| App backgrounds during screen share | foreground or broadcast service owns capture | device test | sharing continues or stops explicitly |
| Another phone call starts | Telecom or CallKit coordinates hold or end | physical device test | clear interrupted state |

Every failure has a test, typed handling, and honest user or operator state.

## Test Review Diagram

```text
[signed invite] -> [relay/mailbox] -> [native ring] -> [P2P media]
      |                  |               |               |
   protocol          live relay        device          cross-network

[membership] -> [token service] -> [LiveKit] -> [tracks/events] -> [room UI]
      |                 |              |              |              |
   adversarial       integration     staging E2E   SDK contract   browser/device

[record action] -> [Egress job] -> [real event] -> [indicator] -> [stored output]
       |                 |              |              |               |
 permission test     fault test     integration      UI test       storage E2E
```

Required tests:

- Call signal canonical signing, encryption, wrong domain, wrong recipient, expiry,
  replay, glare, oversize, and fuzz tests.
- Media session state, track replace, mute, camera, ICE restart, TURN, route, and
  teardown tests.
- Real live-relay direct call establishment test.
- iOS native unit and device tests for PushKit, CallKit, audio session, duplicate,
  cold launch, locked screen, and background.
- Android instrumentation and device tests for Core Telecom, focus, Bluetooth,
  foreground service, and MediaProjection.
- Room-token service tests for membership, removal, role, generation, cap, expiry,
  replay, and least privilege.
- LiveKit integration tests for publish, subscribe, speaker, adaptive stream,
  reconnect, removal, screen share, E2EE mode, and Egress.
- Mobile and web five-state UI tests plus accessibility and reduced-motion checks.
- Physical matrix: iPhone to Android, iPhone to web, Android to web, Wi-Fi to cell,
  restrictive NAT through TURN, 3 or more participant room, node drain, Bluetooth,
  background, terminated ring, screen share, moderation, and recording.
- Load tests at room cap, concurrent call target, reconnect storm, and Egress cap.

## Performance and Capacity Requirements

- Direct-call signaling payload, pending ICE, retries, and call lifetime are bounded.
- Configure audio bitrate, video simulcast layers, adaptive subscription, and screen
  share resolution from measured device and network tiers.
- Define free and hosted room caps from real LiveKit load tests and paid entitlement,
  never client-only constants.
- Autoscaling uses CPU, bandwidth, packet loss, room count, participant count, and
  Redis health. Scale-down drains rooms before termination.
- Egress concurrency is separately capped and queued.
- SLOs, alerts, backup, image, and canary requirements come from Plan 44.

## Parallel Work Lanes

| Lane | Modules | Depends on |
|---|---|---|
| A: protocol and direct engine | `packages/sync` | Phase 0 dependency migration |
| B: native call module | native package and mobile config | Plan 42 call wake contract |
| C: LiveKit service | relay service, deploy, DB | Plan 44 foundation |
| D: mobile UI | `apps/meerkat` | A and native mocks |
| E: web UI | `apps/meerkat-web` | A and room service mocks |
| F: QA and release | tests, tickets, runbooks | merged A through E |

Run A, B, and C in parallel after the dependency migration. D and E can build against
contract fakes. One owner coordinates mobile entry and `app.config.ts`. F is sequential.

## Acceptance Criteria

- AC-25.1: A signed mobile or web client can start and receive a real 1:1 voice call.
- AC-25.2: A real 1:1 video call supports mute, camera, route, reconnect, and hangup.
- AC-25.3: iOS and Android receive and control an incoming call from background,
  terminated, and locked states according to platform rules.
- AC-25.4: Direct media uses P2P or TURN and displays connected only from real peer state.
- AC-25.5: A current community member can join a LiveKit voice or video room; a
  non-member, removed member, expired token, or stale generation cannot.
- AC-25.6: Participant count, speaking, mic, camera, screen, and join state match real
  LiveKit events.
- AC-25.7: Screen sharing works on iOS, Android, and supported web browsers.
- AC-25.8: Moderators can remove, manage role, end a stream, and report, with real effect.
- AC-25.9: Security copy distinguishes direct E2E, verified room E2EE, and encryption
  to the room server.
- AC-25.10: Recording is off by default, explicit, visible to all participants, and
  backed by a real Egress job and storage result.
- AC-25.11: Mobile and web support all success, partial, permission, busy, full,
  reconnect, failure, and unavailable states.
- AC-25.12: Physical-device, browser, LiveKit, TURN, load, failure, and store evidence
  is attached to the exact release.

## Negative Criteria

- NC-25.1: No timer, forwarded signal, or optimistic action may set connected or joined.
- NC-25.2: No unverified signal may ring an app or system call UI.
- NC-25.3: No stable Meerkat identity or community title may enter LiveKit metadata.
- NC-25.4: No SFU room may be labeled end-to-end encrypted unless all clients prove it.
- NC-25.5: No recording may start or continue without a real room-wide indicator.
- NC-25.6: No stale room token may rejoin after removal.
- NC-25.7: No call history row may replicate through mesh sync.
- NC-25.8: No Expo Go or unsupported browser build may show an enabled call action.

## Required Gates

- Function test scaffolds and `pnpm gate:function:changed`.
- Sync, relay, mobile, web, native, parity, and generated-artifact suites.
- Expo prebuild review and signed iOS or Android builds.
- Browser QA, mobile QA, design review, accessibility, and physical-device matrix.
- LiveKit staging load, failover, TURN, Egress, E2EE, and reconnect evidence.
- Security review of signaling, room admission, privacy metadata, push, and recording.
- Plan 44 image, SBOM, signature, attestation, observability, backup, and rollback gates.

## Close Criteria

Plan 25 moves to `docs/plans/done/` only after every acceptance and negative criterion
passes on the exact signed builds and server release, direct and room media work on
real networks and devices, native call integration works from terminated state,
LiveKit and Egress are production-operated, and Plan 40 links all automated, physical,
capacity, security, and operational evidence.

## Status Delta (2026-07-12, execution start + packet board)

Execution moved to `feature/meerkat-plan25-calls` (worktree), branched from the
Plan 43 branch tip `89acfafc` so the Plan 42 push substrate and Plan 44 production
state are available. Packets follow the Plan 43 landing ritual: implementation
(codex for clear-spec server/protocol work, taste-tier models for user-facing UI),
adversarial review, Fable verification against primary evidence, function gate +
sync/relay/app/web typechecks + full battery + `check:parity`, then one commit per
packet.

### Work packet board

| Packet | Scope | State |
|---|---|---|
| WP-25A | Phase 0 dependency migration: pin LiveKit set, migrate data backend to `@livekit/react-native-webrtc`, re-prove data path | LANDED `296eec6f` (1,182 app + 1,845 sync tests, typecheck, lint, meerkat parity green) |
| WP-25B | `protocol/call-signal.ts`: signed CallSignal, pair-secret relay token, recipient-encrypted SDP/ICE, TTL/nonce/replay, deterministic glare + adversarial tests | LANDED `3f2e6d5d` + barrels `f1cd996e` (38 adversarial tests; signature binds a sha512 commitment of payloadCiphertext, 120s TTL cap, replay after signature, token distinct from mailbox tokens, symmetric glare, fuzz-safe verify; sync 1,918 green) |
| WP-25C | `protocol/room-membership.ts`: signed RoomAdmissionRequest (communityId, roomId, descriptorRevision, epoch, ephemeral participant id, permission set), strict field allowlist, role-to-permission allowlist over the real WorkspaceMemberRole, replay + fuzz tests | LANDED `19394009` (35 tests; roles owner/admin/member/viewer, 60s TTL cap, unknown-key + 50-value fuzz reject, privacy allowlist) |
| WP-25D | Platform-neutral direct media session core + encrypted signaling over relay env/mailbox + live-relay establishment test | LANDED `7e2115fe`..`<call-session>` (45 tests; pure state machine, NC-25.1 connected-only-on-real-backend-event per-kind matrix, NC-25.2 verify-gate drop suite, glare, tampered-payload, fuzz; sync 1,963 green) |
| WP-25E | Room-token service in `packages/meerkat-relay`: verifies WP-25C requests against live membership/roles/removal, admission generations in PostgreSQL (stale token cannot rejoin, NC-25.6), mints least-privilege short-lived LiveKit JWTs, `livekit-server-sdk` pinned here | LANDED `e735048a` (membership verified before signature; nonce recorded after signature; stale epoch/revision rejected; opaque HMAC room name + generation bump defeats stale tokens; least-privilege grants; ephemeral id only in LiveKit fields; migration 0015 + `meerkat_room_token` role appended last; relay 1,352 green, privacy tests decode a real JWT) |
| WP-25F | `packages/meerkat-call-native`: owned Expo module, iOS PushKit + CallKit (report-before-completion invariant), Android Core Telecom self-managed calls, config plugin, honest null bridge, authored-unproven disclaimers | LANDED `4a8ec00e` (28 TS tests; CallKit report precedes push completion, server caller name never rendered, Telecom isSupported() graceful degradation, UNVERIFIED-until-dev-build disclaimers) |
| WP-25G | Mobile direct-call UX: DM/People entry points, ring, voice/video screens, controls, history, all failure/reconnect states | To author (depends on WP-25B/D/F) |
| WP-25H | Web direct-call UX byte-twin (browser RTCPeerConnection media; no data-transport rung names in the web tree per parity gate) | To author (depends on WP-25B/D) |
| WP-25I (deploy) | LiveKit distributed SFU + Redis + Egress in `compose.production.yml` (+ `livekit.production.yaml`, `egress.production.yaml`, Caddy LiveKit route), room-token activation env contract | LANDED `4935d5be` (compose validates 11 services; SFU sees only opaque room+participant ids; Egress never auto-records NC-25.5) |
| WP-25I (bin wiring) | Community-node bin mounts the WP-25E room-token service: `createCommunityRoomMembershipVerifier` reads the node's real signed roster (removal caught by roster absence; gates on membership + descriptorRevision; zero-knowledge node holds no epoch so returns epoch 0), file/postgres admission store, operator-secret revoke, env-gated activation with honest ready-log state | LANDED (extracted testable verifier, 7 tests incl removed-member + store-fault + barrel resolution; relay battery 1,358 green; bin node --check + typecheck green) |
| WP-25I (mobile UI) | LiveKit room UX (mobile) from real SDK events: participant grid/speaker, permission-gated mic/cam/screen controls, phase states, E2EE-vs-room-server security copy (NC-25.4/9) | LANDED (pure cores `room-view-core` + `room-token-client` + `room-entry`, 24 tests incl NC-25.1 joined-only-on-event + per-participant E2EE truth; LiveKit adapter + room screen + channel entry + hidden route, marked UNVERIFIED-until-dev-build; app 1,206 tests + typecheck + lint + parity green). Remaining: web room UI twin; live device/LiveKit QA |
| WP-25I (web UI) | Web LiveKit room twin (livekit-client browser SDK) | LANDED (2026-07-13). apps/meerkat-web room-view-core/room-token-client/room-entry byte-twins + room-livekit-adapter (livekit-client lazy import, real SDK events -> RoomEvent only, NC-25.1/25.4) + RoomView (participant grid, permission-gated controls, byte-identical roomSecurityCopy + unavailable states); LiveKit URL from `import.meta.env.VITE_MEERKAT_LIVEKIT_URL` (empty = rooms honestly off). meerkat-web 858 tests + typecheck + lint + parity green. Remaining: live LiveKit + browser QA |
| WP-25G (substrate) | Direct-call media backend + call-history model | LANDED (call-media-backend implements WP-25D CallMediaBackend over real getUserMedia + RTCPeerConnection, connection-state from real SDK events only, TURN-vs-direct from candidate pair, null-when-absent UNVERIFIED-until-dev-build, 8 tests; call-log-core pure fold of CallState -> device-local call_log row, duration only after a real connect, monotonic terminal, honest summaries, 9 tests, call_ outside sync prefixes NC-25.7) |
| WP-25G (UX) | DM/People entry, incoming ring (+ WP-25F CallKit bridge), in-call voice/video screen, controls, history list; near-real-time call-signaling transport over the live relay (park/drain WP-25B signals by deriveCallSignalToken) + CallProvider wiring | LANDED (2026-07-13). `transport/call-signal-channel.ts` CallSignalTransport parks/drains sealed WP-25B frames on pair-private tokens (near-real-time forward + TTL park; 15 tests). Sealed relay frames (sealCallSignalFrame/openCallSignalFrame, device ids/kind never cleartext) + invite channel (deriveCallInviteToken). CallProvider wires CallSession + call-media-backend + CallKit/Telecom bridge + persisted nonce replay floor + glare adoption; call_ tables device-local (NC-25.7 guard). Screens: in-call voice/video, ring, history, DM header + People entry. call-provider-core 10 + call-store 8 tests. UNVERIFIED-until dev build + two-device QA. sync 1,978 + app 1,241 green |
| WP-25H | Web direct-call UX byte-twin (browser RTCPeerConnection media; no data-transport rung names in the web tree per parity gate) | LANDED (2026-07-13). apps/meerkat-web call-log-core/call-provider-core/call-store/call-media-backend (browser RTCPeerConnection + getUserMedia, connection state from real events only, TURN-vs-direct from candidate-pair stats, NC-25.8 null-when-absent) + CallProvider (relay-only, in-app ring, verify-before-ring NC-25.2, glare adoption, foldCallLog history, nonce floor) + CallOverlay/CallHistoryView + DM/People entry points. Byte-identical phase/security copy with mobile. meerkat-web 858 tests + typecheck + lint + parity green. Remaining: live browser two-party QA |
| WP-25J | Phase 8 hardening + adversarial proof pack: forged/replayed signals, glare storms, stale-token rejoin, node drain, Egress fault, load; Plan 40 evidence links | LANDED (2026-07-13) `call-hardening-e2e.test.ts`: two real CallSessions over two real CallSignalTransports on a hub-modeling relay; 8 tests (off-pair garbage flood, frame-key-thief forge NC-25.2, wholesale replay nonce floor, in-flight tamper, glare storm convergence, pre-offer ICE flood bounded, park/drain vs post-TTL stale). Node-drain/Egress-fault/room-cap are documented describe.skip (live-LiveKit founder QA); relay stale-token-rejoin/generation/nonce-cap unit-proven in room-token-service.test.ts. sync 1,963 green |

### Founder-ops remainder (never faked in code)

Signed dev/EAS builds compiling the WebRTC runtime + call native module; physical
device matrix (terminated-state ring, CallKit/Telecom, cross-network media, TURN);
LiveKit + Redis + TURN + Egress production deployment with separate staging keys;
recording storage policy; store background-mode and VoIP disclosures.
