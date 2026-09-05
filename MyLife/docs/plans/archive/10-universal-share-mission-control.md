# Universal Share, Mesh Communications, And Archive Ingest Mission Control

> **ARCHIVED 2026-06-28 — SUPERSEDED.** This Apr-2026 hub + BestChef mission-control program is superseded by the standalone Meerkat launch plans. Harvest map: text → plan 21 (DMs); public → plan 19; OS Share-into-app + real transports → plan 20; calls + rooms (SFU) → plan 25; huge-file + archive ingest → plans 19 + 22. Kept as the reference design for transports, the share protocol, permissions, realtime media, archive policy, and the threat model.

Date: 2026-04-26

Status: Planned. No implementation phase is complete until its verification evidence is attached.

Primary spec: `docs/plans/queue/09-universal-share-to-mesh-delivery.md`

Depends on: `docs/plans/queue/08-mesh-sync-mission-control.md`

Canonical substrate: `packages/sync/`. Extend it. Do not create a parallel communication stack.

Scope: MyLife hub, standalone BestChef, `@mylife/sync`, app-controlled iPhone transports, iOS Share Sheet intake, in-app sharing, text messaging, voice/video calling, room streaming, file transfer, local-first storage, encrypted relay, server-backed archive ingest, moderation, security, and beta acceptance.

## Executive Verdict

The product goal is achievable, but it is not one feature. It is a platform made of four layers:

1. Share intake and local storage.
2. Encrypted transport selection for close-range and far-range delivery.
3. Real-time communication for calls and streaming rooms.
4. Server/archive ingest for durable, very large, or public content.

The correct build sequence is not "add every transport first." The correct sequence is:

1. Define one share envelope, one permission model, one transfer state machine, and one local storage model.
2. Make iOS Share Sheet intake reliable.
3. Make the sender/recipient UX simple.
4. Implement routes from fastest/most local to most reliable/server-backed.
5. Add real-time rooms on WebRTC/SFU as a separate but policy-compatible surface.
6. Add archive ingest as an explicit opt-in product path, not a hidden fallback.

## Final Product Acceptance

The full program is complete when all of these work on real devices and production-like infrastructure:

1. iPhone A shares text, links, images, audio, video, PDFs, and allowed files from another app into MyLife or BestChef through the iOS Share Sheet.
2. MyLife or BestChef stages the payload locally, opens a simple AirPlay-like destination picker, applies remembered permissions, and sends.
3. iPhone B receives an encrypted request, accepts or declines, and imports into the right module or Share Inbox.
4. The app automatically chooses the best mutual available route across local Wi-Fi/LAN, Multipeer, BLE wake-up, WebRTC, relay, or server path.
5. User data is encrypted at the payload layer before it leaves app-controlled memory or storage.
6. Local data remains local by default.
7. Server/archive sharing is explicit and follows private, shared, or public archive rules.
8. Text chat, 1:1 calls, voice rooms, video rooms, file uploads, streaming playback, and huge archive uploads use different transport defaults but the same identity, permission, audit, and safety model.
9. Transfers survive app interruption, network drops, duplicate attempts, bad hashes, revoked devices, blocked senders, storage pressure, and quota failures.
10. Real-device beta evidence covers close range, far range, offline recipient, direct-only policy, relay fallback, and archive upload.

## Product Action Routing Matrix

| Action | Close-range regular path | Far-range regular path | Server path | Notes |
|---|---|---|---|---|
| Text | Multipeer, LAN, WebRTC | WebRTC or relay | Optional message sync | Any route works. Keep latency low. |
| 1:1 voice call | WebRTC direct | WebRTC with TURN | Media server fallback only if needed | Calls are not file transfer. |
| Voice room like Discord | WebRTC for tiny local rooms | SFU/media server | Required for regular rooms | Server-hosted SFU is the real product path. |
| Video call room | WebRTC for tiny local rooms | SFU/media server | Required | Phone mesh does not scale well for rooms. |
| Screen/video streaming room | WebRTC local only for tiny demos | SFU/media server | Required | Use SFU and adaptive bitrate. |
| Video file share/upload | LAN or Multipeer Wi-Fi | Relay or server upload | Object storage | Chunk, resume, hash verify. |
| Video streaming playback | LAN/WebRTC for nearby playback | HLS/DASH from server | Object storage + CDN | Upload and playback are separate systems. |
| Picture share/upload | Any encrypted route | Relay/server | Object storage | Easy path, still hash and sanitize. |
| Large file up to 10 GB | LAN only by default | Server upload | Object storage multipart | WebRTC/relay only with explicit confirmation. |
| Large file up to 500 GB | Not regular phone-to-phone | Server upload only | Object storage multipart | Requires charging/Wi-Fi/resume/quota. |
| Large file up to 1 TB | Not phone-to-phone | Archive ingest only | Object storage multipart/archive | Treat as archive pipeline. |
| Phone to archive server | Background URLSession upload | Background URLSession upload | Required | Private, shared, or public archive policy. |

## Transport Capability Policy

| Transport | Primary role | Normal cap | Hard beta cap | Completion requirement |
|---|---|---:|---:|---|
| APNs | Wake/notify | 2 KB | 4 KB | Opaque pending-share notification only. |
| Bonjour/mDNS | Discovery | 1 KB TXT | 4 KB | No user payload. |
| BLE Core Bluetooth | Wake/tiny fallback | 1 to 8 KB | 256 KB manual emergency | Never silent media fallback. |
| Multipeer Bluetooth | Nearby small transfer | 10 MB | 50 MB foreground | Works for tiny files/control. |
| Multipeer peer-to-peer Wi-Fi | Nearby file transfer | 250 MB | 2 GB foreground | Works between two iPhones without internet. |
| Local Wi-Fi/LAN IP | Nearby large transfer | 1 GB | 10 GB app cap | Fastest big-file local route. |
| WebRTC DataChannel | Direct remote transfer | 250 MB | 2 GB foreground | Works across networks with TURN fallback. |
| Relay | Offline/NAT fallback | 250 MB | 2 GB beta quota | Ciphertext only, ephemeral tokens. |
| Server upload | Durable/cloud/archive | 2 GB | Quota-based | Multipart, resumable, background-capable. |
| SFU/media server | Real-time rooms | Bitrate-based | Policy-based | Required for voice/video rooms. |

## Gate Model

| Gate | Status | Purpose |
|---|---|---|
| Gate A: Architecture freeze | Blocked | Data model, protocol, routing, permissions, and server/archive policy accepted. |
| Gate B: Local share beta | Blocked | iOS Share Sheet, local staging, sender UX, recipient UX, LAN/Multipeer transfer work on two iPhones. |
| Gate C: Far-range beta | Blocked | WebRTC, relay, APNs wake, offline delivery, and quota behavior work. |
| Gate D: Realtime beta | Blocked | 1:1 calls and room media via WebRTC/SFU work with security and moderation controls. |
| Gate E: Archive ingest beta | Blocked | Phone-to-server large upload, private handling, public archive flow, moderation, takedown, and indexing work. |
| Gate F: Public release | Blocked | All P0/P1 risks closed, device matrix green, ops runbooks complete. |

## Workstream Ownership

| Workstream | Owner | Write zones |
|---|---|---|
| Product contract | product + sync-dev | `docs/plans/queue/`, `docs/designs/` |
| Sync domain model | sync-dev | `packages/sync/src/types.ts`, `packages/sync/src/share/`, `packages/sync/src/db/` |
| iOS native intake | iOS-native-dev | `apps/mobile/plugins/`, `apps/bestchef/plugins/`, native extension targets |
| Sender/recipient UX | hub-shell-dev + BestChef-module-dev | `apps/mobile/app/`, `apps/bestchef/app/`, `packages/ui/src/sync/` |
| Transports | sync-dev + iOS-native-dev | `packages/sync/src/transport/`, config plugins |
| Realtime media | realtime-dev | WebRTC client, SFU integration, call/room surfaces |
| Archive server | backend-dev + ops | server/API/storage/docs, Supabase or object storage paths |
| Module resolvers | module owners | `modules/*/src/share/`, `modules/bestchef/src/share/` |
| Security/privacy | security-reviewer | threat model, tests, runbooks, key management |
| QA/release | qa-dev + ops | tests, evidence, TestFlight, runbooks |

## Phase Plan

### Phase 0: Architecture Freeze

Status: Not started

Goal: Convert Plan 09 into binding implementation contracts.

Tasks:

- USM-0001: Freeze product modes: iOS Share Sheet intake, in-app mesh share, realtime media, archive ingest.
- USM-0002: Freeze content classes: text, URL, image, audio, video, document, arbitrary file, multi-item share.
- USM-0003: Freeze transport classes: local IP, Multipeer Wi-Fi, Multipeer Bluetooth, BLE, WebRTC, relay, server upload, SFU.
- USM-0004: Freeze data limits and confirmation thresholds.
- USM-0005: Freeze permission presets and advanced permissions.
- USM-0006: Freeze private/shared/public archive policy.
- USM-0007: Freeze exact iOS extension approach: custom native Share Extension unless `expo-sharing` can prove stable enough.
- USM-0008: Freeze acceptance matrix and required evidence format.

Acceptance:

- Plan 09 and this mission control agree.
- No transport or content class has undefined limits.
- Product signs off on public archive consent and moderation requirements.
- Engineering signs off that implementation extends `packages/sync`.

Verification:

- Docs review.
- Architecture review note in `docs/sessions/YYYY-MM-DD-universal-share-architecture-freeze.md`.

### Phase 1: Share Domain Model And Local Storage

Status: Not started

Goal: Add the durable model that all share, call, stream, and archive surfaces use.

Tasks:

- USM-0101: Add `SharePayloadKind`, `ShareSourceSurface`, `ShareTransferState`, `SharePermissionGrant`, `ShareDestination`, `ShareRoute`, and `ShareReceipt` types.
- USM-0102: Add `ShareResolver` interface for module imports.
- USM-0103: Add SQLite tables for intake, payload items, attachment manifests, permission grants, transfer sessions, route attempts, receipts, resolver results, and archive jobs.
- USM-0104: Add migrations and schema tests.
- USM-0105: Add App Group staging manifest format for iOS extension handoff.
- USM-0106: Add content-addressed blob store abstraction that works on native mobile without Node `fs`/`crypto` assumptions.
- USM-0107: Add per-share content key references and hash verification fields.
- USM-0108: Add cleanup policy for expired staged files, partial chunks, failed offers, and archive temp files.
- USM-0109: Add policy-based data-limit evaluator.
- USM-0110: Add local-only default storage policy.

Acceptance:

- Text-only, file-only, and mixed shares can be represented without lossy conversion.
- A staged payload can survive app restart and be resumed or deleted.
- Policy evaluation can answer allowed, blocked, requires confirmation, or requires route change.

Verification:

- Unit tests for schemas, policies, manifests, cleanup, hash verification.
- `pnpm --filter @mylife/sync test`
- `pnpm gate:function:changed`

### Phase 2: iOS Share Extension Intake

Status: Not started

Goal: MyLife and BestChef appear in the iOS Share Sheet and stage incoming payloads reliably.

Tasks:

- USM-0201: Build Expo config plugin for iOS Share Extension target.
- USM-0202: Add App Group entitlement to app and extension.
- USM-0203: Add extension activation rules for text, URL, image, movie, audio, PDF, document, and public data.
- USM-0204: Implement native extension view/controller for MyLife.
- USM-0205: Implement native extension view/controller for BestChef or shared extension with app-specific branding.
- USM-0206: Copy provider-backed file URLs into App Group storage before completion.
- USM-0207: Write atomic intake manifest.
- USM-0208: Add quick-send and continue-in-app modes.
- USM-0209: Add extension-safe size guard.
- USM-0210: Add TestFlight build configuration for extension credentials.

Acceptance:

- Share Sheet shows MyLife and BestChef for every supported content class.
- Extension returns promptly.
- App recovers staged payload after extension exits, app kill, and device restart.

Verification:

- Physical iPhone tests from Safari, Photos, Files, Voice Memos, Notes.
- EAS iOS development build.
- Screenshot/video evidence.

### Phase 3: Android Share Intent Intake

Status: Not started

Goal: Keep the model cross-platform even if iOS beta ships first.

Tasks:

- USM-0301: Add manifest filters for `ACTION_SEND` and `ACTION_SEND_MULTIPLE`.
- USM-0302: Accept text, URL, image, audio, video, PDF, documents, and allowed arbitrary files.
- USM-0303: Copy content URIs into app-controlled storage.
- USM-0304: Reuse same share intake schema and policy evaluator.
- USM-0305: Add Android smoke tests and manual QA checklist.

Acceptance:

- Android intake produces the same `ShareIntakeItem` model as iOS.

Verification:

- Android emulator and physical device share intent tests.

### Phase 4: Sender Review, Destination Picker, And Permissions

Status: Not started

Goal: Make sending feel as simple as Share Sheet, MyLife/BestChef, choose friend, Send.

Tasks:

- USM-0401: Build reusable destination picker in `packages/ui/src/sync/`.
- USM-0402: Add recent recipients, trusted nearby recipients, workspace members, and search.
- USM-0403: Collapse multiple routes for one friend into one destination.
- USM-0404: Add permission preset picker.
- USM-0405: Add advanced permission editor.
- USM-0406: Add content preview list with size and risk indicators.
- USM-0407: Add route summary using plain labels: Direct, Nearby, Internet, Waiting.
- USM-0408: Add one-tap quick send for trusted recent recipient.
- USM-0409: Persist last recipient/workspace/permission/destination per content class.
- USM-0410: Add sender cancel and staged draft delete.

Acceptance:

- Default flow has no more than destination plus Send.
- Technical route details are hidden by default and visible in details/history.
- Policy blocks are explained in plain language.

Verification:

- UI tests for default, advanced, blocked, quick-send, and no-recipient states.
- Real-device screenshot evidence.

### Phase 5: Recipient Request, Import, And Share Inbox

Status: Not started

Goal: Receiver gets a secure request, can accept/decline, and content lands somewhere useful.

Tasks:

- USM-0501: Build incoming request surface.
- USM-0502: Show sender identity, trust state, permissions, source app, previews, size, and destination.
- USM-0503: Add accept, decline, block, report, reroute, and save-to-inbox.
- USM-0504: Add Share Inbox catch-all.
- USM-0505: Add transfer progress and failure recovery.
- USM-0506: Add import result receipts.
- USM-0507: Add duplicate detection and "save another copy" option.
- USM-0508: Add notification-to-request deep link.

Acceptance:

- Receiver can safely decide before data import.
- Unknown content never disappears. It goes to Share Inbox or is retained for retry/delete.

Verification:

- UI tests and real-device tests for accept, decline, block, retry, duplicate, unknown file.

### Phase 6: Share Protocol, Encryption, And Chunking

Status: Not started

Goal: Upgrade `share-session.ts` from single JSON entity delivery to robust encrypted manifest transfer.

Tasks:

- USM-0601: Add `SHARE_OFFER`.
- USM-0602: Add `SHARE_ACCEPT` and `SHARE_DECLINE`.
- USM-0603: Add `SHARE_MANIFEST`.
- USM-0604: Add `SHARE_CHUNK`.
- USM-0605: Add `SHARE_CHUNK_ACK`.
- USM-0606: Add `SHARE_COMPLETE`.
- USM-0607: Add `SHARE_RECEIPT`.
- USM-0608: Add resume by `shareId`, `blobHash`, and chunk bitfield.
- USM-0609: Add signed manifests and signed receipts.
- USM-0610: Add per-route frame sizing.
- USM-0611: Add bad-hash rejection.
- USM-0612: Add idempotent retry and duplicate protection.

Acceptance:

- Mixed text plus files transfer between two simulated peers.
- Transfer resumes after interruption.
- Bad hash blocks import and records failure.
- All payload bytes are encrypted before transport send.

Verification:

- Protocol unit tests.
- Fuzz tests for malformed messages and chunk order.
- Integration test for simulated peers.

### Phase 7: Local IP, Bonjour, And LAN Transfer

Status: Not started

Goal: Fast direct local Wi-Fi/LAN transfers when both devices are on the same network.

Tasks:

- USM-0701: Register Bonjour service `_mylife-sync._tcp`.
- USM-0702: Add local network permissions to app configs.
- USM-0703: Implement native local IP listener/client.
- USM-0704: Add TLS/QUIC/WebSocket choice and payload encryption.
- USM-0705: Add route probing and local-only verification.
- USM-0706: Add LAN transfer progress and fallback.
- USM-0707: Add tests for local network unavailable and client isolation.

Acceptance:

- Two iPhones on same Wi-Fi transfer text, image, video, and 10 GB test file when storage allows.
- ISP path is not used for local transfer.

Verification:

- Physical same-Wi-Fi test.
- Router traffic observation or network path evidence.

### Phase 8: Multipeer And BLE Nearby

Status: Not started

Goal: Make nearby iPhone-to-iPhone sharing work without internet or shared Wi-Fi setup.

Tasks:

- USM-0801: Implement Multipeer advertiser.
- USM-0802: Implement Multipeer browser.
- USM-0803: Implement invitation/trust flow.
- USM-0804: Implement Multipeer data stream/resource transfer.
- USM-0805: Add app payload encryption over Multipeer.
- USM-0806: Implement BLE wake-up/capability pings.
- USM-0807: Add BLE tiny encrypted fallback only when explicitly allowed.
- USM-0808: Add nearby availability scoring.
- USM-0809: Add no-internet two-iPhone test.

Acceptance:

- Two iPhones can share nearby with internet disabled.
- BLE wakes/escalates but does not silently move media.

Verification:

- Physical no-internet test.
- Transfer limit tests for BLE, Multipeer Bluetooth, and Multipeer Wi-Fi.

### Phase 9: WebRTC, TURN, Relay, And APNs

Status: Not started

Goal: Far-range direct or fallback delivery.

Tasks:

- USM-0901: Wire real React Native WebRTC backend.
- USM-0902: Add signaling service.
- USM-0903: Add TURN config and credential flow.
- USM-0904: Add WebRTC DataChannel frame sizing.
- USM-0905: Implement encrypted relay client.
- USM-0906: Implement relay server with ephemeral token addressing.
- USM-0907: Add relay TTL, quota, replay protection, and deletion.
- USM-0908: Add APNs pending-share notification.
- USM-0909: Add offline recipient flow.
- USM-0910: Add direct-only policy behavior.

Acceptance:

- Far-range transfer succeeds through WebRTC when possible.
- Relay fallback works when WebRTC fails or recipient is offline.
- Direct-only policy refuses relay clearly.

Verification:

- NAT tests.
- Relay ciphertext inspection.
- Push notification test.

### Phase 10: Text Messaging

Status: Not started

Goal: Use the same identity, route, encryption, and receipt model for lightweight text.

Tasks:

- USM-1001: Define message envelope as a share/message specialization.
- USM-1002: Add conversation state and receipts.
- USM-1003: Add local, relay, and server-backed message sync modes.
- USM-1004: Add typing/presence only where policy allows.
- USM-1005: Add spam/block/report controls.

Acceptance:

- Text can send close-range, far-range, offline, and through server sync.
- Messages are local-first and encrypted by default.

Verification:

- Unit and device tests for send, receive, offline, block, revoke.

### Phase 11: Voice Calls And Voice Rooms

Status: Not started

Goal: 1:1 calls and Discord-like voice rooms work through the right media architecture.

Tasks:

- USM-1101: Add 1:1 WebRTC voice call flow.
- USM-1102: Add call invite, accept, decline, busy, timeout, and missed call.
- USM-1103: Add microphone permission and device routing.
- USM-1104: Add TURN fallback.
- USM-1105: Add SFU/media server integration for rooms.
- USM-1106: Add room roles, mute, deafen, speaker state, and moderation.
- USM-1107: Add encrypted signaling and media security policy.
- USM-1108: Add call quality metrics without sensitive audio content.

Acceptance:

- 1:1 calls work remote.
- Voice rooms use server SFU for regular use.
- Moderation and permission controls exist before public rooms.

Verification:

- Device tests on Wi-Fi and cellular.
- Room load test.

### Phase 12: Video Calls, Screen Streaming, And Video Rooms

Status: Not started

Goal: Live video and Discord-style streaming use SFU/server paths, not file-transfer paths.

Tasks:

- USM-1201: Add 1:1 video call flow.
- USM-1202: Add camera/screen/media permissions.
- USM-1203: Add SFU video room integration.
- USM-1204: Add adaptive bitrate and simulcast if supported.
- USM-1205: Add screen/video stream mode.
- USM-1206: Add room moderation: kick, mute video, report, end stream.
- USM-1207: Add recording policy, default off.
- USM-1208: Add bandwidth warnings and fallback to audio.

Acceptance:

- Small 1:1 video works with WebRTC.
- Rooms and streams work through SFU.
- Recording/archive is explicit opt-in.

Verification:

- Two-device, three-device, and room-load tests.

### Phase 13: Video, Picture, And File Sharing

Status: Not started

Goal: Media/file sharing is reliable and separate from live streaming.

Tasks:

- USM-1301: Add image metadata strip/transcode policy.
- USM-1302: Add video file upload/transcode policy.
- USM-1303: Add PDF/document preview handling.
- USM-1304: Add arbitrary file quarantine.
- USM-1305: Add 10 GB transfer path via LAN and server upload.
- USM-1306: Add 500 GB archive-upload path.
- USM-1307: Add 1 TB archive-upload path.
- USM-1308: Add storage pressure checks.
- USM-1309: Add large upload resume after app crash, network loss, and server restart.

Acceptance:

- Images, videos, PDFs, arbitrary files, and 10 GB test payload work.
- 500 GB and 1 TB are archive-ingest only, not phone-to-phone chat features.

Verification:

- Large synthetic-file tests.
- Storage quota tests.
- Hash verification tests.

### Phase 14: Archive Server And Forever Archive

Status: Not started

Goal: Build the phone-to-server path for private routing, shared handoff, and public archive contribution.

Tasks:

- USM-1401: Define archive job model: private handoff, shared workspace, public archive candidate.
- USM-1402: Build authenticated multipart upload API.
- USM-1403: Add background URLSession-compatible upload flow.
- USM-1404: Add object storage layout and retention tiers.
- USM-1405: Add client-side hash and server-side verification.
- USM-1406: Add private encrypted object handling for sensitive uploads.
- USM-1407: Add public archive consent screen.
- USM-1408: Add rights/license/provenance metadata.
- USM-1409: Add abuse scanning and malware scanning.
- USM-1410: Add moderation queue.
- USM-1411: Add takedown/deletion process.
- USM-1412: Add dedupe and content-addressed indexing.
- USM-1413: Add public archive publishing workflow.
- USM-1414: Add private "get to the right hands" routing workflow.
- USM-1415: Add audit trail for who can access private uploads.

Acceptance:

- Private uploads stay private and encrypted as required.
- Public archive uploads require explicit consent, rights metadata, moderation, and publish approval.
- Huge uploads resume and verify.

Verification:

- 10 GB, 500 GB simulation, and 1 TB simulation test plans.
- Security review.
- Moderation/takedown drill.

### Phase 15: Module Resolvers

Status: Not started

Goal: Make shared content land in useful app destinations.

Tasks:

- USM-1501: Implement generic Share Inbox resolver.
- USM-1502: Implement Notes resolver for text, markdown, URLs, PDFs, documents.
- USM-1503: Implement Voice resolver for audio.
- USM-1504: Implement Journal resolver for private capture.
- USM-1505: Implement Recipes resolver.
- USM-1506: Implement BestChef recipe URL resolver.
- USM-1507: Implement BestChef dish image resolver.
- USM-1508: Implement BestChef cooking video resolver.
- USM-1509: Implement BestChef audio note resolver.
- USM-1510: Implement BestChef PDF recipe resolver.
- USM-1511: Implement BestChef grocery text/document resolver.
- USM-1512: Implement BestChef receipt image/PDF resolver.
- USM-1513: Implement unknown-file quarantine/inbox.

Acceptance:

- Content routes automatically when obvious.
- Ambiguous content asks the user.
- Private BestChef kitchen/pantry data does not become public/shared accidentally.

Verification:

- Resolver unit tests.
- App import tests.
- Parity checks for hub and standalone BestChef.

### Phase 16: Security, Privacy, Abuse, And Compliance

Status: Not started

Goal: Do not ship a powerful transfer/archive platform without guardrails.

Tasks:

- USM-1601: Threat model local network observer, ISP, relay operator, malicious sender, malicious recipient, revoked device, public archive abuse, server breach.
- USM-1602: Replace or formally review simplified crypto handshakes before production.
- USM-1603: Add no-plaintext-log enforcement.
- USM-1604: Add filename/path sanitization.
- USM-1605: Add MIME/UTI sniffing.
- USM-1606: Add EXIF stripping.
- USM-1607: Add block/report/revoke across share, message, call, room, archive.
- USM-1608: Add sensitive-data classification for archive upload.
- USM-1609: Add public archive consent and rights checks.
- USM-1610: Add rate limits and quota.
- USM-1611: Add account deletion and takedown propagation.
- USM-1612: Add abuse response runbook.

Acceptance:

- Sensitive content cannot accidentally become public.
- Blocked/revoked users cannot deliver accepted transfers.
- Relay/server cannot read private payloads that are supposed to stay encrypted.

Verification:

- Red-team session.
- Security unit tests.
- Manual abuse flow tests.

### Phase 17: Testing, Evidence, And Release

Status: Not started

Goal: Ship only when the whole matrix is proven.

Tasks:

- USM-1701: Create two-iPhone TestFlight checklist.
- USM-1702: Create close-range tests: LAN, Multipeer Wi-Fi, Multipeer Bluetooth, BLE wake-up.
- USM-1703: Create far-range tests: WebRTC, TURN, relay, offline recipient.
- USM-1704: Create server/archive tests: 10 GB, 500 GB simulation, 1 TB simulation.
- USM-1705: Create real-time tests: 1:1 call, voice room, video room, screen stream.
- USM-1706: Create failure tests: bad hash, duplicate, cancel, app kill, storage full, network drop, revoked peer, blocked sender.
- USM-1707: Create accessibility and UX polish pass.
- USM-1708: Create release runbook.
- USM-1709: Create incident response runbook.
- USM-1710: Record acceptance evidence under `docs/sessions/`.

Acceptance:

- All P0 and P1 tests pass.
- Known failures are logged and triaged.
- Public launch blockers are explicit.

Verification:

- `pnpm typecheck`
- `pnpm --filter @mylife/sync test`
- affected app/module tests
- `pnpm gate:function:changed`
- `pnpm check:parity --quiet`
- EAS iOS build
- real-device evidence

## P0 Build Blockers

| ID | Blocker | Owner | Status |
|---|---|---|---|
| BLOCK-P0-01 | No native iOS Share Extension target | iOS-native-dev | Open |
| BLOCK-P0-02 | No App Group intake queue | iOS-native-dev + sync-dev | Open |
| BLOCK-P0-03 | Native transport backends are not production-wired | sync-dev | Open |
| BLOCK-P0-04 | Share protocol only covers single JSON entity | sync-dev | Open |
| BLOCK-P0-05 | No recipient request UX | hub-shell-dev | Open |
| BLOCK-P0-06 | No archive ingest server | backend-dev | Open |
| BLOCK-P0-07 | No SFU/media server for rooms | realtime-dev | Open |
| BLOCK-P0-08 | Crypto requires production review | security-reviewer | Open |
| BLOCK-P0-09 | Public archive consent/moderation/takedown not defined | product + legal + ops | Open |
| BLOCK-P0-10 | No real-device acceptance matrix | qa-dev | Open |

## Definition Of Done By Action

### Text

- Close range: Multipeer, LAN, and WebRTC work.
- Far range: WebRTC and relay/server sync work.
- Offline: relay notification and later delivery work.
- Security: encrypted, signed, blocked/revoked enforced.

### Calls

- 1:1 voice and video use WebRTC.
- TURN fallback works.
- Call state is correct for accept, decline, missed, timeout, busy, network drop.

### Voice Rooms

- Rooms use SFU/media server for normal use.
- Roles, mute, deafen, kick, report, and leave work.
- Abuse controls exist before public rooms.

### Video Rooms And Streaming

- Rooms use SFU/media server.
- Adaptive bitrate works.
- Recording/archive is explicit opt-in.
- Moderator controls exist.

### File And Media Share

- Images, audio, videos, PDFs, documents, and arbitrary allowed files transfer with chunking/resume/hash verification.
- Local Wi-Fi/LAN preferred for big nearby files.
- WebRTC/relay/server used for far range.

### Huge Files

- 10 GB: LAN and server upload supported.
- 500 GB: server archive upload only.
- 1 TB: server archive upload only.
- All huge uploads require Wi-Fi, charging/storage warnings, resume, hash verification, quota, and explicit confirmation.

### Archive Server

- Private handoff, shared workspace, and public archive are separate destinations.
- Sensitive private data is handled securely.
- Public archive requires explicit consent, rights/provenance metadata, moderation, takedown, and publication approval.
- Server records access/audit without exposing private payloads unnecessarily.

## Verification Matrix

| Area | Required evidence |
|---|---|
| iOS Share Sheet | Screens/video from Safari, Photos, Files, Voice Memos, Notes |
| Local transfer | Two-iPhone same-Wi-Fi LAN transfer logs and screenshots |
| Nearby transfer | Two-iPhone no-internet Multipeer transfer evidence |
| BLE | Wake-up/capability evidence and media-block evidence |
| WebRTC | Different-network transfer and 1:1 call evidence |
| Relay | Offline recipient, relay TTL, quota, ciphertext-only evidence |
| SFU | Voice room and video room evidence |
| Archive | Multipart upload, resume, hash verification, moderation evidence |
| Security | Red-team report, bad hash, revoked peer, blocked sender |
| UX | Default two-decision flow and advanced detail flow screenshots |
| Parity | MyLife hub and BestChef standalone acceptance |

## Session Logging Requirements

Every implementation session must update or create one session note when work is non-trivial:

- `docs/sessions/YYYY-MM-DD-universal-share-<slug>.md`

Every real failure that matches `AGENTS.md` error-log triggers must update `errors_log.md` immediately.

Do not log transient tool errors, typos fixed in the same edit, or duplicate known failures.

## Completion Order Recommendation

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8
9. Phase 9
10. Phase 15 for Share Inbox and BestChef first
11. Phase 14 for archive ingest
12. Phase 10
13. Phase 11
14. Phase 12
15. Phase 13 huge-file hardening
16. Phase 16
17. Phase 17

Rationale: users can get real value from Share Sheet intake and local/remote file delivery before voice/video rooms and huge archive ingest are complete.

