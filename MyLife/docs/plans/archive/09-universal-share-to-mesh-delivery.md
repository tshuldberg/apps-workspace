# Universal Share To Mesh Delivery (Plan 09)

> **ARCHIVED 2026-06-28 — SUPERSEDED.** This Apr-2026 hub + BestChef "Universal Share to Mesh" program predates Meerkat becoming the standalone decentralized social/sync app. Its scope is now delivered by the Meerkat launch plans, and its distinct still-wanted capabilities were harvested: text messaging → plan 21 (DMs); public posting/archive → plan 19 (public social); OS Share-into-app + real WebRTC/Multipeer/BLE transports → plan 20 (connectivity + self-hosting); voice/video calls + Discord-style rooms → plan 25 (calls & rooms); huge-file + forever/public archive ingest → plans 19 + 22. Kept as reference for the detailed transport caps, the chunked/resumable share protocol, the permission model, and the threat model.

**Created:** 2026-04-25
**Owner:** sync-dev lead; iOS-native-dev, hub-shell-dev, BestChef-module-dev, security-reviewer
**Depends on:** `docs/plans/queue/08-mesh-sync-mission-control.md`
**Execution mission control:** `docs/plans/queue/10-universal-share-mission-control.md`
**Build-manager prompt:** `docs/plans/queue/10-universal-share-build-manager-prompt.md`
**Anchor substrate:** `packages/sync/` (extend; do not parallel-wire)
**Primary acceptance target:** Two beta iPhones can share allowed text, links, images, audio, video, and files from other apps into MyLife or BestChef, choose a recipient and permission set, negotiate the best mutually preferred available transport, request/accept the transfer, and deliver verified data into the right inbox or module destination.

## Executive Summary

This plan turns mesh sync from "module data replication" into a user-facing universal share lane. A sender should be able to use the iOS Share Sheet from Photos, Safari, Files, Voice Memos, Notes, or another app, choose MyLife or BestChef, pick a friend/workspace, pick permissions, and send. The recipient should receive an encrypted request, accept or decline, and get the content through the highest-ranked mutual transport that is actually available: LAN, nearby peer, BLE wake-up plus escalation, WebRTC, or encrypted relay.

The core technology is real, but the acceptance bar requires more than the current repo has. Today the repo has mesh sync architecture, share-session primitives, blob primitives, policies, and UI shells. It does not yet have an iOS Share Extension, App Group intake queue, native transport backends wired into the Expo apps, a full attachment manifest protocol, or a complete sender/receiver user experience for arbitrary shared content.

## iOS Share Sheet Plus AirPlay-Like Routing

The primary user entry point is the iOS system Share Sheet. A user should be able to leave the source app in control, tap Share, choose MyLife or BestChef, and send the content to a trusted person or workspace.

AirPlay is the smoothness benchmark for destination discovery and route selection only. This plan is not about using AirPlay as the content transport. The implementation remains MyLife mesh sync, and users should not have to understand LAN, Multipeer, BLE, WebRTC, relay, workspaces, chunks, or cryptographic receipts to complete a normal share.

Both product modes must work:

- System share intake: another app sends text, links, media, or files into MyLife or BestChef through the iOS Share Sheet.
- In-app mesh share: MyLife or BestChef sends an existing app item, module record, media file, or generated artifact to a trusted person or workspace using the same destination picker, permission model, and transport ladder.

The destination experience should feel AirPlay-like:

- One recognizable destination picker.
- Nearby/trusted people appear automatically when available.
- Recent recipients appear first.
- The same friend appears as one destination even if multiple transports are available.
- The app silently picks the best working transport.
- The app silently falls back when the first route fails.
- Users only see technical details in advanced status/history or when action is required.
- Pairing and fingerprint checks happen once per trust relationship, then stay out of the way.
- Permissions default from simple presets, not a wall of switches.
- Progress, pause, retry, and delivered status are obvious.
- If a recipient is unavailable, the app clearly says whether it is waiting nearby, using relay, or blocked by a direct-only policy.
- Share from another app should feel like: Share Sheet, MyLife or BestChef, choose friend, Send.

This does not mean:

- Using Apple's private AirPlay stack.
- Bypassing iOS app extension, background execution, or local network privacy rules.
- Keeping arbitrary P2P sockets alive forever while the app is killed.
- Exposing relay plaintext or sacrificing end-to-end encryption for convenience.

UX acceptance additions:

1. The default sender flow is no more than two decisions after tapping MyLife or BestChef in the Share Sheet: destination and Send.
2. If the sender has a recent trusted recipient and a default permission preset, a one-tap quick send option is available.
3. Transport names are hidden from the primary send screen. The primary copy says "Direct," "Nearby," "Internet," or "Waiting" only when useful.
4. Advanced users can open details to see LAN, nearby, WebRTC, relay, attempts, bytes, and receipts.
5. Recipient setup is guided once. After pairing, trusted recipients behave like stable output targets.
6. Failed transfers explain the next action in plain language: move closer, open the app on the other phone, allow relay, switch to Wi-Fi, reduce file size, or verify trust.
7. BestChef-specific destinations are suggested automatically from content type, for example recipe URL, dish photo, cooking video, grocery text, or receipt image.
8. The app remembers the last recipient, workspace, permission preset, and module destination per content class.

## Platform Reality Check

The final product is achievable, but "whenever we want" must respect iOS rules:

- A Share Extension is short-lived. It should parse and stage the payload quickly, then return control to the host app.
- A Share Extension cannot directly communicate with its containing app. It can share data indirectly through an App Group shared container.
- Launching the containing app from a Share Extension is not the stable system design. Expo's current receive-from-other-apps path documents that its iOS behavior is experimental because it opens the main target instead of processing inside a Share Extension view controller.
- iOS will not let a normal app keep arbitrary peer-to-peer sockets alive forever in the background. Reliable "friend is not currently active" delivery needs encrypted relay plus push/local notification fallback. True direct peer transfer is strongest when both users are active, nearby, or foregrounded.
- Large files need resumable chunking, hash verification, storage quotas, cleanup, and network policy. Audio and video cannot be treated like JSON entity payloads.

## Complete iPhone Transport Surface

The app should support every practical method two iPhones can use for app-controlled data transfer, while clearly separating full data transports from discovery, wake-up, or user-mediated OS features.

Bulk data transports to support:

- Local IP over Wi-Fi or Ethernet adapter:
  - Same Wi-Fi network, same wired LAN through adapter, or same router.
  - Discovery through Bonjour/mDNS.
  - Data over TCP+TLS, QUIC, or WebSocket with MyLife payload encryption.
  - This is the fastest local-first route when both phones are on the same network.
- Peer-to-peer Wi-Fi through Multipeer Connectivity:
  - iOS-supported nearby peer sessions without relying on the public internet.
  - Use for messages, streams, and file resources.
  - Treat this as the main "nearby without setup" iPhone-to-iPhone path.
- Bluetooth through Multipeer Connectivity:
  - Multipeer can use Bluetooth as part of its underlying nearby transport.
  - Use app-level encryption over the Multipeer session.
  - Good for nearby discovery/control and smaller transfers, but not the preferred route for large media.
- Bluetooth Low Energy through Core Bluetooth:
  - Use for discovery, wake-up, capability exchange, tiny messages, and emergency low-bandwidth transfer.
  - Do not make BLE the default for large files.
  - If BLE is the only mutual path, allow small encrypted payloads and explain that large media requires opening the app near the recipient, Wi-Fi, WebRTC, or relay.
- WebRTC DataChannel:
  - Use for direct internet P2P across Wi-Fi or cellular when both devices can establish ICE connectivity.
  - WebRTC already encrypts the channel, but MyLife still encrypts payloads end to end.
  - Best remote direct route when LAN/nearby are unavailable.
- HTTPS/WebSocket/QUIC relay:
  - Use when direct P2P fails or the recipient is offline.
  - Relay forwards ciphertext only.
  - Address by per-session ephemeral tokens, not permanent device public keys.
  - Support TTL, quotas, resumable downloads, and delivery receipts.
- Normal app/server sharing:
  - Optional cloud or web sharing works like normal apps and websites: HTTPS API, object storage, Supabase/cloud tables, web links, or app backend.
  - Local copy remains canonical unless user chooses cloud/shared-server publishing.
  - Public or account-backed server sharing must be an explicit product path, not an accidental relay leak.

Discovery, wake, assist, or OS-mediated options:

- Bonjour:
  - Discovery only. It tells phones where to connect on the local network.
- APNs push notifications:
  - Wake or notify only. Do not put payload data in push notifications beyond minimal encrypted or opaque metadata.
- Background URLSession:
  - Useful for server upload/download continuation, not direct arbitrary peer sockets.
- Nearby Interaction / UWB:
  - Can help with proximity and direction on supported devices, but it is not a bulk data transport.
  - Optional later for "the phone next to you" confidence in the picker.
- NFC:
  - Useful for pairing/bootstrap in some flows, not general iPhone-to-iPhone bulk transfer.
- AirDrop:
  - User-mediated OS sharing, not an app-controlled mesh transport.
  - MyLife or BestChef can receive files shared by the system if registered correctly, but the mesh stack cannot silently select AirDrop as one of its programmable routes.

Encryption rule:

- Every route gets MyLife payload encryption before bytes leave app-controlled memory or storage.
- Also use the best available transport security for that route: TLS/QUIC for local IP and relay, WebRTC channel security, Multipeer security, and Core Bluetooth characteristic permissions where applicable.
- Never rely on link-layer encryption alone for user data.
- Store staged and delivered data locally by default, protected by app storage, App Group protection for extension handoff, and per-share content keys when needed.

## Recommended Data Limits By Transmission Type

These limits are product defaults, not claims about every protocol's theoretical maximum. The app should measure current path quality, storage, battery, foreground state, data saver state, and user permission before starting a transfer.

Global framing rules:

- Control messages: target 16 KB, hard cap 64 KB.
- Preview metadata: target 64 KB, hard cap 256 KB.
- Default logical blob chunk: 256 KB.
- Local IP and relay may group chunks into 1 MB upload/download parts.
- WebRTC should send smaller frames, usually 16 KB to 64 KB, and assemble them into logical chunks.
- BLE should use the connection's reported write length and keep individual frames tiny.
- Any transfer over 25 MB needs resumable state.
- Any transfer over 100 MB needs visible progress and cancel.
- Any transfer over 250 MB should default to Wi-Fi/direct/local or server background upload, not BLE or opportunistic nearby.
- Any transfer over 1 GB requires explicit user confirmation.

| Transmission type | Recommended default | Soft max | Hard beta cap | Use for | Avoid |
|---|---:|---:|---:|---|---|
| APNs push | Under 2 KB | 4 KB platform max for normal remote notifications | 4 KB | Wake/notify with opaque share id | Payload data, previews, files |
| Bonjour/mDNS | Under 1 KB service TXT | 4 KB | 4 KB | Discovery and route hints | User data |
| BLE Core Bluetooth | 1 KB to 8 KB | 64 KB | 256 KB emergency/manual only | Wake-up, discovery, capabilities, tiny encrypted text | Photos, audio, video, files |
| Bluetooth via Multipeer | Under 10 MB | 25 MB | 50 MB if foreground | Small files and nearby control when Wi-Fi path is weak | Large video |
| Multipeer peer-to-peer Wi-Fi | Under 250 MB | 1 GB | 2 GB foreground + Wi-Fi/power warning | Nearby media and files | Background/offline delivery |
| Local Wi-Fi/LAN IP | Under 1 GB | 5 GB | Storage-limited, default app cap 10 GB | Fast local files, video, backups | Offline recipient |
| WebRTC DataChannel | Under 250 MB | 1 GB | 2 GB foreground | Remote P2P files when both users are active | Killed-app background delivery |
| Encrypted relay | Under 250 MB | 1 GB per transfer | Quota-limited, beta default 2 GB | Offline delivery and NAT failure fallback | Unlimited free video storage |
| Normal app/server upload | Under 2 GB | 10 GB with quota | Account/storage quota | Website-style sharing, cloud publish, background URLSession | Silent public sharing |
| iOS Share Extension staging | Under 25 MB inline | 250 MB staged then continue in app | 2 GB with foreground handoff | Intake from other apps | Long-running transfer inside extension |
| AirDrop | Not app-controlled | Not app-controlled | Not app-controlled | User-mediated OS sharing outside mesh | Automatic route selection |

Content-class defaults:

| Content class | Default allowed size | Requires confirmation | Preferred route |
|---|---:|---:|---|
| Text / markdown | 1 MB | Over 256 KB | Any encrypted route |
| URL/link card | 256 KB metadata | Over 64 KB preview | Any encrypted route |
| Image | 50 MB each | Over 25 MB | Local IP, Multipeer Wi-Fi, WebRTC, relay |
| Audio | 250 MB | Over 100 MB | Local IP, Multipeer Wi-Fi, WebRTC, relay |
| Video | 2 GB | Over 250 MB | Local IP first, server/relay for offline |
| PDF/document | 250 MB | Over 100 MB | Local IP, Multipeer Wi-Fi, WebRTC, relay |
| Arbitrary file | 250 MB | Over 100 MB | Local IP, WebRTC, relay, server upload |
| Multi-item share | Sum of item caps | Over 250 MB total | Local IP or server/relay |

Recommended routing by size:

- 0 to 64 KB: any route, including BLE if both users explicitly allow tiny fallback.
- 64 KB to 10 MB: Multipeer, LAN, WebRTC, or relay. BLE should wake/escalate only.
- 10 MB to 250 MB: LAN, Multipeer peer-to-peer Wi-Fi, WebRTC, or relay.
- 250 MB to 1 GB: LAN preferred. WebRTC or relay only with foreground/progress. Server upload allowed if user chooses cloud/web sharing.
- 1 GB to 10 GB: LAN or normal server upload only by default. WebRTC/relay require explicit confirmation, Wi-Fi, power/storage checks, and resumable chunks.
- Over 10 GB: not a beta target. Require a future large-transfer mode with explicit storage quota, charging state, Wi-Fi, and server-side resume support.

Implementation requirements:

- Store the recommended caps in policy, not hardcoded UI copy.
- Allow module policy to be stricter than app policy.
- Allow recipient policy to be stricter than sender policy.
- Block if either device lacks storage for staged ciphertext plus final decoded content.
- Block if the app extension cannot safely stage the item before its time budget.
- Downgrade route automatically when a transfer exceeds the sensible limit for the current transport.
- Never split an APNs notification into multiple pushes for content transfer.
- Never use BLE as the silent fallback for media.
- Always hash each attachment and verify after reassembly.
- Always write transfer state before sending each chunk batch so the app can resume after crash or suspension.

Official references used for these constraints:

- Apple Share Extensions: https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html
- Apple App Extension life cycle and shared container model: https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionOverview.html
- Apple Multipeer Connectivity: https://developer.apple.com/documentation/multipeerconnectivity
- Apple Bonjour local network discovery: https://developer.apple.com/documentation/foundation/bonjour
- Apple Core Bluetooth: https://developer.apple.com/documentation/CoreBluetooth
- Apple Core Bluetooth maximum write length: https://developer.apple.com/documentation/corebluetooth/cbperipheral/maximumwritevaluelength%28for%3A%29
- Apple Nearby Interaction: https://developer.apple.com/documentation/nearbyinteraction
- Apple background URLSession: https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background%28withidentifier%3A%29
- Apple URLSession background file uploads: https://developer.apple.com/documentation/foundation/urlsessionuploadtask
- Apple User Notifications: https://developer.apple.com/documentation/usernotifications
- Apple APNs payload size: https://developer.apple.com/documentation/usernotifications/generating-a-remote-notification
- W3C WebRTC data channel message size model: https://www.w3.org/TR/webrtc/
- RFC 8841 WebRTC data channel max-message-size negotiation: https://datatracker.ietf.org/doc/html/rfc8841
- Expo Sharing: https://docs.expo.dev/versions/latest/sdk/sharing/
- Expo app extensions in managed projects: https://docs.expo.dev/build-reference/app-extensions/
- Android receiving shared content: https://developer.android.com/training/sharing/receive

## Current Repo Baseline

Already present:

- `packages/sync/src/protocol/share-session.ts` implements a one-shot encrypted entity share flow with offer, accept, data, ack, and bye.
- `packages/sync/src/db/schema.ts` includes `sync_share_log`.
- `packages/sync/src/blob/blob-store.ts`, `blob-sync.ts`, and `blob-policy.ts` provide content-addressed storage, chunk splitting, hash verification, and per-module blob policy primitives.
- `packages/sync/src/types.ts` defines `ShareRequest`, `ShareOffer`, `SyncTransport`, and `SyncTransportPreference`.
- `packages/ui/src/sync/ShareButton.tsx` provides an early direct-share UI hook.
- `apps/mobile/plugins/meerkat-nearby.ts` exists and adds local-network, Bonjour, Wi-Fi P2P, and BLE permission metadata.
- BestChef has sync policy work and local change tracking for some social entities.

Missing or incomplete:

- No iOS Share Extension target for MyLife or BestChef.
- No App Group shared intake directory or durable extension-to-app queue.
- `expo-sharing` is not configured in `apps/mobile/app.json` or `apps/bestchef/app.json`.
- The existing nearby plugin is not registered in either app's `plugins` array.
- `@mylife/sync` has no native transport dependencies such as Multipeer, Bonjour, WebRTC, BLE, or TCP socket backends.
- The native sync facade still cannot perform direct sharing end to end.
- The share protocol transfers a single JSON entity, not arbitrary attachments, files, previews, permissions, chunk manifests, resumable state, or module import outcomes.
- There is no sender-side "choose recipient, permissions, destination, transport policy" flow from the Share Sheet.
- There is no recipient-side "incoming request, preview, accept/decline, route to module" flow.
- There is no relay server contract implemented for offline large share delivery.
- There is no full real-device TestFlight acceptance matrix for two beta iPhones.

## Final Acceptance Criteria

1. Sender A and recipient B are both on beta iPhones with MyLife and/or BestChef installed.
2. A and B have paired devices, verified trust fingerprints, and either share a workspace or have direct peer permission.
3. Each user has ranked transport preferences. The selector intersects both lists, checks actual availability, checks tier/policy constraints, and uses the highest mutual working transport.
4. A can open the iOS Share Sheet from another app and choose MyLife or BestChef.
5. The Share Extension accepts all content classes enabled by policy:
   - Plain text
   - Rich text or markdown when the source provides it
   - URLs and web links
   - Images
   - Audio
   - Video
   - PDFs
   - Documents
   - Arbitrary files allowed by MIME type or Uniform Type Identifier
   - Multiple items in one share
6. The extension stages the shared payload into an App Group container without losing data when the extension exits.
7. The app presents a send review flow with recipient, workspace, module destination, permission set, size, transfer cost, and selected transport fallback order.
8. A can choose a permission preset or custom policy before sending.
9. The app creates a signed and encrypted share request containing preview metadata, attachment manifests, permission grants, expiration, and destination hints.
10. B receives a request over the selected transport or a fallback transport.
11. B sees sender identity, trust state, source app label when available, content previews, file names, sizes, permissions, expiration, and destination.
12. B can accept, decline, block sender, or change destination if policy allows.
13. Accepted transfers are chunked, resumable, encrypted, and hash-verified.
14. Declined or expired transfers delete staged ciphertext and mark an auditable receipt.
15. Delivered content lands in the correct module destination or a general Share Inbox when no module resolver is available.
16. Both devices show transfer history, transport used, bytes sent/received, delivery receipt, and failure reasons.
17. Sensitive modules obey `syncPolicy`, `maxScope`, manual resolver requirements, and fingerprint-compare pairing before shared workspace delivery.
18. A full real-device beta matrix passes for text, link, image, audio, video, PDF, arbitrary file, multi-file share, large video, offline recipient relay fallback, cancel/resume, revoked peer, blocked MIME type, blocked size, and bad hash.

## User-Facing Product Scope

Required user surfaces:

- iOS Share Extension compose/review screen.
- MyLife app share intake screen for staged extension payloads.
- BestChef app share intake screen for staged extension payloads.
- Recipient picker with paired devices, workspace members, and recent recipients.
- Permission editor with presets and advanced controls.
- Incoming request screen with accept, decline, block, report, and route options.
- Share Inbox for items that do not map cleanly to a module.
- Share History with receipts, transport attempts, and retry/cancel actions.
- Settings > Sync > Transport Preferences already exists conceptually and must be connected to real share delivery.
- Settings > Sync > Permissions for content type, size, network, workspace, and auto-accept rules.

Out of scope for first acceptance pass:

- Public social posting.
- Anonymous stranger sharing.
- Group chat.
- Cloud plaintext storage.
- Automatic background P2P receiving while both apps are killed. Use encrypted relay plus notification for that case.

## Content And Permission Model

Add a first-class share domain to `packages/sync`, backed by SQLite and App Group storage:

- `ShareIntakeItem`
  - `id`
  - `sourceSurface`: `ios_share_extension`, `android_share_intent`, `in_app`, `web_upload`
  - `sourceAppBundleId` nullable
  - `sourceAppDisplayName` nullable
  - `createdAt`
  - `expiresAt`
  - `status`: `staged`, `reviewing`, `queued`, `offered`, `accepted`, `transferring`, `delivered`, `declined`, `failed`, `expired`, `cancelled`
  - `workspaceId` nullable
  - `senderDeviceId`
  - `recipientDeviceId` nullable
  - `destinationModuleId` nullable
  - `destinationResolverId` nullable
- `SharePayloadItem`
  - `id`
  - `shareId`
  - `kind`: `text`, `url`, `image`, `audio`, `video`, `document`, `file`
  - `uti`
  - `mimeType`
  - `filename`
  - `byteLength`
  - `textValue` nullable
  - `urlValue` nullable
  - `stagedFilePath` nullable
  - `thumbnailBlobHash` nullable
  - `metadataJson`
- `ShareAttachmentManifest`
  - `shareId`
  - `payloadItemId`
  - `blobHash`
  - `totalBytes`
  - `chunkSize`
  - `chunkCount`
  - `mimeType`
  - `uti`
  - `encryptionMode`
  - `contentKeyRef`
  - `previewHash` nullable
- `SharePermissionGrant`
  - `shareId`
  - `recipientDeviceId`
  - `workspaceId` nullable
  - `allowedActions`: view, save, import, edit, reshare, export, delete local copy
  - `allowedContentKinds`
  - `maxBytes`
  - `expiresAt`
  - `autoAcceptAllowed`
  - `requiresManualAccept`
  - `stripMetadata`
  - `allowCellular`
  - `allowRelay`
  - `requireForegroundForLargeFiles`
- `ShareTransferSession`
  - `id`
  - `shareId`
  - `transport`
  - `state`
  - `bytesSent`
  - `bytesReceived`
  - `chunksSent`
  - `chunksAcked`
  - `lastError`
  - `startedAt`
  - `completedAt`
- `ShareTransportAttempt`
  - `id`
  - `shareId`
  - `transport`
  - `rank`
  - `availabilityResult`
  - `failureReason`
  - `startedAt`
  - `endedAt`
- `ShareReceipt`
  - `shareId`
  - `recipientDeviceId`
  - `status`
  - `receivedHash`
  - `acceptedAt`
  - `deliveredAt`
  - `declinedAt`
  - `importResultJson`

Permission presets:

- `View Only`: recipient can view/import into inbox, no reshare flag.
- `Save Copy`: recipient can save the file or module record locally.
- `Collaborate`: recipient can import into a shared workspace module if module policy allows it.
- `Private Drop`: recipient gets a local copy only, no workspace membership change.
- `One-Time`: content expires after first successful delivery.
- `High Privacy`: strips EXIF and source-app metadata, relay disabled unless user overrides.
- `Large Media`: allows Wi-Fi only by default, resumable chunks, no cellular unless explicitly allowed.

Hard policy gates:

- App-level allowed content types.
- Module-level `syncPolicy`.
- Per-entity `maxScope`.
- Recipient/workspace membership.
- Trust level and fingerprint verification.
- Size quota and storage availability.
- Network policy: Wi-Fi only, cellular allowed, relay allowed, foreground-only.
- Legal/safety restrictions for unsupported or dangerous file types.

## iOS Share Extension Work

Required implementation:

- Add a native Share Extension target for `apps/mobile` and `apps/bestchef`.
- Configure `NSExtension` with `com.apple.share-services`.
- Configure `NSExtensionActivationRule` for supported counts and types:
  - `public.plain-text`
  - `public.url`
  - `public.image`
  - `public.movie`
  - `public.audio`
  - `com.adobe.pdf`
  - `public.data`
  - app-specific recipe or share UTTypes if added later
- Add App Group entitlements for the containing app and extension.
- Stage text, URLs, and attachment files into the App Group container.
- Copy provider-backed files into controlled storage before the extension exits.
- Write an atomic intake manifest file or SQLite row that the containing app can process later.
- Generate thumbnails and lightweight previews only when safe and fast.
- Never perform full mesh transfer inside the extension for large payloads.
- Provide a minimal extension UI that lets the user either:
  - Send with last-used recipient and permission preset, or
  - Stage and continue in the main app review flow.
- Ensure EAS credentials know about extension targets through `extra.eas.build.experimental.ios.appExtensions` or a config plugin that declares them.

Preferred path:

- Use a custom Expo config plugin for a stable native Share Extension target.
- Use `expo-sharing` only if it can meet the acceptance criteria without relying on the documented experimental iOS foregrounding behavior. If it cannot, use a custom native extension.

## Android Share Intent Work

Required implementation:

- Add Android manifest intent filters for `ACTION_SEND` and `ACTION_SEND_MULTIPLE`.
- Accept configured MIME types:
  - `text/plain`
  - `text/uri-list`
  - `image/*`
  - `audio/*`
  - `video/*`
  - `application/pdf`
  - `application/octet-stream` or narrower allowed file types
- Read `Intent.EXTRA_TEXT`, `Intent.EXTRA_STREAM`, and multiple streams.
- Copy content URIs into app-controlled staging storage on a background thread.
- Apply the same `ShareIntakeItem`, permission, manifest, and transfer logic as iOS.

Android can follow the iOS acceptance pass, but the data model should not be iOS-only.

## Transport Selection Requirements

Transport selection must be deterministic and auditable:

1. Load sender preference order.
2. Load recipient preference order from last known profile, pairing record, or live exchange.
3. Intersect both preference lists.
4. Remove transports blocked by tier, permission grant, workspace policy, content size, or OS capability.
5. Probe actual availability:
   - LAN: Bonjour service visible and socket backend healthy.
   - Nearby: Multipeer session available on iOS, Wi-Fi Direct/Aware available on Android.
   - BLE: only usable as wake-up, never as bulk transfer.
   - WebRTC: signaling reachable and ICE succeeds.
   - Relay: relay token minted, relay reachable, quota available.
6. Pick the highest-ranked mutual candidate.
7. If the chosen transport fails, record the failure and try the next eligible candidate.
8. Record final transport and all failed attempts in `ShareTransportAttempt`.

Acceptance examples:

- Same Wi-Fi, both prefer LAN: use LAN.
- Nearby without internet, both prefer nearby: use Multipeer.
- BLE sees peer but no Wi-Fi path: use BLE wake-up, then escalate to nearby, LAN, WebRTC, or relay.
- Different networks, WebRTC succeeds: use WebRTC.
- Recipient offline: store encrypted offer and ciphertext with relay token, send push notification, complete when recipient opens.
- Recipient disables relay: fail with a clear "recipient requires direct transfer" message after direct layers fail.

## Transfer Protocol

Extend `share-session.ts` from entity JSON to manifest-based share transfer:

1. `SHARE_OFFER`
   - Sender identity
   - Workspace or direct peer scope
   - Content previews
   - Attachment manifest summary
   - Permission grant
   - Expiration
   - Requested destination
   - Required accept mode
2. `SHARE_ACCEPT` or `SHARE_DECLINE`
   - Recipient selected destination
   - Accepted permissions
   - Missing blob/chunk bitfields if resuming
3. `SHARE_MANIFEST`
   - Full signed manifest
   - Hash tree or per-chunk hash list
   - Encryption metadata
4. `SHARE_CHUNK`
   - Blob hash
   - Chunk index
   - Ciphertext bytes
5. `SHARE_CHUNK_ACK`
   - Highest contiguous index and sparse missing set
6. `SHARE_COMPLETE`
   - Final manifest hash
   - Sender receipt request
7. `SHARE_RECEIPT`
   - Recipient hash verification
   - Import status
   - Final delivery status
8. `BYE`

Required behavior:

- Idempotent retry by `shareId` and `blobHash`.
- Resume from partial chunks.
- Detect duplicate shares and avoid duplicate imports unless user requests a second copy.
- Verify hash before import.
- Refuse import if module policy changed during transfer.
- Support multiple attachments in one share.
- Support text-only shares without blob storage.
- Support very large files through chunked transfer and foreground/relay/background constraints.

## Security And Privacy Requirements

Required:

- End-to-end encryption for offers, manifests, chunks, and receipts.
- Sender signatures on offer and manifest.
- Recipient signatures on acceptance and receipt.
- Trust check before showing auto-accept options.
- Fingerprint compare before sensitive `shared_workspace` scope.
- App Group storage protected with iOS Data Protection.
- Keychain or SecureStore for share keys and identity references.
- No plaintext attachment bytes in logs.
- No plaintext metadata to relay beyond token, size bucket if unavoidable, TTL, and ciphertext envelope.
- Relay tokens are per-session and not device public keys.
- EXIF stripping option for images and videos.
- Filename sanitization.
- MIME and UTI sniffing. Do not trust sender-provided MIME alone.
- Size caps before copy, before offer, before transfer, and before import.
- Quarantine unsupported or unknown file types in Share Inbox.
- Sender blocklist and revocation enforcement before offer display.
- Receipt/audit trails without exposing sensitive payload content.
- Cleanup job for expired staged files, failed partial chunks, and relay ciphertext TTL.

Security review checklist:

- Malicious sender sends wrong MIME type.
- Malicious sender sends file too large.
- Sender offers one hash and sends different bytes.
- Sender replays an old accepted transfer.
- Relay replays stale ciphertext.
- Revoked device attempts delivery.
- Cross-workspace content attempts escalation.
- Module resolver tries to import into a disallowed table.
- Extension-staged file is left behind after failure.
- Logs, crash reports, and test snapshots do not contain payload bytes.

## Module Destination And Resolver Requirements

Every destination module needs a resolver contract:

- `canAcceptShare(payloads, permissionGrant, workspaceId): ShareResolverDecision`
- `previewShare(payloads): SharePreview`
- `importShare(payloads, grant, context): ShareImportResult`
- `requiresManualReview(payloads): boolean`
- `getAllowedShareKinds(): SharePayloadKind[]`

Generic destinations:

- Share Inbox: catch-all for anything allowed but not resolved.
- Notes: text, markdown, URLs, PDFs, documents.
- Voice: audio.
- Recipes/BestChef: recipe URLs, food photos, cooking videos, recipe PDFs, text recipes.
- Journal: text, images, links when user chooses private capture.
- Files/Documents if a generic files module exists later.

BestChef first-pass resolver:

- URL from recipe site: stage to recipe import.
- Plain text recipe: stage as recipe draft.
- Image of dish: stage as submission media or kitchen photo review.
- Video of dish or recipe step: stage as submission media or recipe step media.
- Audio note: stage as recipe/kitchen note only if enabled.
- PDF recipe: stage as saved recipe attachment and import candidate.
- Grocery list text or document: stage to grocery review.
- Receipt image/PDF: stage to kitchen receipt review, with pantry import gated by policy.
- Unknown file: Share Inbox with "Open in BestChef later" action.

BestChef policy cautions:

- Pantry, receipts, nutrition rows, and private kitchen data must stay capped to `personal_replica` unless a later policy explicitly allows broader scope.
- Social submissions/comments/votes can use shared or published scopes only according to `modules/bestchef/src/definition.ts`.
- Media cache can remain `device_local`; sent media should be modeled as explicit share attachments, not automatic cache sync.

MyLife hub resolver:

- Destination picker should show enabled modules that can accept at least one payload item.
- Disabled modules can appear as locked suggestions only if that matches product policy.
- If multiple modules match, default to the last chosen resolver for that sender/content type.
- If no module matches, route to Share Inbox.

## Native Transport Implementation Work

LAN:

- Replace simulated/plain backend with real iOS/Android LAN socket layer.
- Register Bonjour `_mylife-sync._tcp`.
- Add `NSLocalNetworkUsageDescription` and `NSBonjourServices`.
- Encrypt before payload bytes leave the device.
- Test same-Wi-Fi iPhone to iPhone.

Nearby:

- iOS: bridge `MultipeerConnectivity` with advertising, browsing, invitation, session, stream/resource transfer.
- Android: bridge Wi-Fi Direct/Wi-Fi Aware where supported.
- Handle app foreground/background state. Re-advertise and re-browse on foreground.
- Test with internet disabled.

BLE:

- Implement wake-up ping only.
- Do not transfer arbitrary files over BLE.
- Include pending share count, total bytes, sender id alias, and workspace hint only if privacy policy allows.
- Escalate to a higher-bandwidth layer.

WebRTC:

- Wire real React Native WebRTC backend.
- Add signaling service.
- Add ICE server config and privacy review.
- Use DataChannel for chunks and control messages.
- Test NAT success/failure fallback.

Relay:

- Implement ciphertext-only relay server.
- Address messages by ephemeral per-session token.
- TTL, quota, auth, abuse limits, replay protection, and delivery receipts.
- Push notification sends only "pending encrypted share" metadata.
- Relay never receives device public keys as routing identifiers.

## Database And Storage Work

Add migrations for:

- `sync_share_intake`
- `sync_share_payload_items`
- `sync_share_attachment_manifests`
- `sync_share_permission_grants`
- `sync_share_transfer_sessions`
- `sync_share_transport_attempts`
- `sync_share_receipts`
- `sync_share_resolver_results`

Extend existing:

- `sync_share_log` can become a summary/history table, or be migrated into the richer share tables.
- `sync_blobs` needs staging path, encrypted size, original filename, content kind, quarantine status, and last access timestamp.
- `sync_blob_policy` needs share-specific policy by module and workspace.
- `sync_session_module_stats` should include shares and blobs, not only row changes.

Storage locations:

- iOS extension staging: App Group container.
- App-controlled blob store: encrypted or content-addressed path under app documents/support directory.
- Temporary decoded previews: cache directory with aggressive cleanup.
- Relay cache: server-side ciphertext with TTL and quota.

## UX States To Cover

Sender:

- Extension loading shared content.
- Unsupported source item.
- Too many files.
- File too large.
- Staged successfully.
- Continue in app.
- Recipient missing trust verification.
- No mutual transport available.
- Sending offer.
- Waiting for recipient.
- Recipient accepted.
- Transferring with progress.
- Paused due to network policy.
- Retrying fallback.
- Delivered.
- Declined.
- Expired.
- Cancelled.
- Failed with actionable reason.

Recipient:

- Incoming request preview.
- Sender unverified.
- Sender revoked or blocked.
- Trust fingerprint required.
- Permission summary.
- Destination picker.
- Accept.
- Decline.
- Block.
- Receiving progress.
- Hash verification.
- Importing.
- Imported successfully.
- Routed to inbox.
- Failed import with payload retained.
- Failed transfer with retry option.

## Beta Real-Device Test Matrix

Devices:

- iPhone A: sender.
- iPhone B: recipient, TestFlight or internal beta.
- Optional iPhone C: revoked or blocked peer.

Setup:

- Fresh install.
- Pair devices.
- Compare fingerprints.
- Create personal workspace and one shared workspace.
- Configure different transport preferences on A and B.
- Configure permissions on B for auto-accept and manual-accept cases.

Content cases:

- Plain text from Notes.
- URL from Safari.
- Image from Photos.
- Multiple images from Photos.
- Audio from Voice Memos or Files.
- Video from Photos.
- PDF from Files.
- Arbitrary allowed file from Files.
- Unsupported file type.
- File above max size.
- Multi-item mixed share: text plus image plus URL.
- BestChef recipe URL.
- BestChef cooking video.
- BestChef receipt image/PDF.

Transport cases:

- Same Wi-Fi LAN.
- Nearby with internet disabled.
- BLE wake-up with escalation.
- Different Wi-Fi networks using WebRTC.
- WebRTC blocked, relay fallback.
- Recipient offline, relay plus notification.
- Recipient relay disabled, fail with direct-only message.
- Sender preference conflicts with recipient preference, choose highest mutual candidate.

Failure and security cases:

- Recipient declines.
- Sender cancels mid-transfer.
- App killed after extension staging, reopen and resume.
- App backgrounded mid-transfer.
- Network drops mid-file, resume chunks.
- Bad chunk hash.
- Revoked peer tries to send.
- Blocked sender tries to send.
- Content type not allowed by recipient.
- Sensitive destination requires manual resolver.
- EXIF strip enabled and verified.
- Relay TTL expires.

Pass criteria:

- No data loss.
- No duplicate imports unless user chooses duplicate.
- Correct transport shown in history.
- Correct fallback attempt history.
- Correct permission enforcement.
- Correct hash verification.
- Correct cleanup of expired staged data.
- No plaintext payloads in logs.

## Phased Execution Plan

### Phase 0 - Final Product Spec And Policy Contract

Acceptance:

- This plan is reviewed and accepted as the source of truth for universal share delivery.
- Define `SharePayloadKind`, `SharePermissionGrant`, `ShareDestination`, `ShareResolver`, and `ShareTransferState` in `packages/sync`.
- Decide custom native Share Extension versus `expo-sharing`. Default decision should be custom native if Expo's experimental iOS path cannot meet App Store-stable acceptance.
- Define first-pass allowed content types and maximum sizes for MyLife and BestChef.
- Define first-pass permission presets.

### Phase 1 - Durable Intake Model

Acceptance:

- App Group staging spec complete for iOS.
- SQLite tables and queries added.
- Share intake manifest format supports text, URL, files, multiple items, UTI, MIME, source app, thumbnails, and metadata.
- Cleanup job removes expired staged data.
- Unit tests cover manifest parsing, MIME/UTI normalization, size limits, and unsupported types.

### Phase 2 - iOS Share Extension

Acceptance:

- MyLife iOS Share Extension appears in the system Share Sheet for configured content types.
- BestChef iOS Share Extension appears in the system Share Sheet for configured content types.
- Extension stages text, URL, image, audio, video, PDF, and arbitrary allowed file into App Group storage.
- App can recover staged payload after extension exits.
- EAS build includes app extension credentials.
- Physical iPhone test confirms Photos, Safari, Files, and Voice Memos flows.

### Phase 3 - Sender Review And Permissions UX

Acceptance:

- Sender can choose recipient, workspace, destination module, and permission preset.
- Sender can edit advanced permission options.
- Sender sees size, content list, and transport fallback policy before sending.
- Unsupported destination is blocked before offer creation.
- Staged payload can be deleted or saved as draft.

### Phase 4 - Attachment Manifest And Chunk Transfer

Acceptance:

- `share-session.ts` supports offer, accept/decline, manifest, chunks, chunk ack, complete, receipt, and resume.
- Text-only shares avoid blob overhead.
- File shares use blob manifests and hash verification.
- Large video resumes after interruption.
- Integration tests cover two in-memory peers with mixed payloads.

### Phase 5 - Native Transport Backends For iPhone Beta

Acceptance:

- Register nearby/LAN plugin in app config.
- LAN Bonjour and socket backend works on two iPhones on the same Wi-Fi.
- iOS Multipeer backend works on two iPhones without internet.
- WebRTC backend works on two iPhones on different networks.
- Relay fallback prototype works for offline recipient.
- Transport preference negotiation chooses highest mutual available layer and records attempts.

### Phase 6 - Recipient Request UX And Import Routing

Acceptance:

- Incoming request screen shows identity, trust, preview, permissions, destination, and size.
- Recipient can accept, decline, block, or reroute.
- Accepted content imports into Share Inbox or module resolver.
- BestChef handles recipe URL, text recipe, dish image, cooking video, audio note, PDF recipe, grocery text, and receipt image/PDF.
- MyLife hub handles at least Notes, Voice, Recipes/BestChef, Journal, and Share Inbox.

### Phase 7 - Offline Relay And Notifications

Acceptance:

- Relay stores ciphertext by ephemeral token with TTL and quota.
- Recipient gets notification without plaintext content details.
- Recipient opens app and completes pending transfer.
- Relay deletion is confirmed after delivery, expiration, or sender cancel.
- Direct-only permission refuses relay fallback.

### Phase 8 - Permissions, Trust, And Safety Hardening

Acceptance:

- Auto-accept only works for trusted senders and allowed content kinds.
- Sensitive modules require fingerprint compare.
- Revoked and blocked devices cannot send accepted requests.
- Metadata stripping policy works.
- MIME sniffing and hash verification block malicious payloads.
- Cleanup removes orphaned staged files and partial chunks.
- Security review covers replay, relay observation, bad MIME, cross-workspace escalation, and resolver abuse.

### Phase 9 - Beta Acceptance Run

Acceptance:

- Full real-device matrix passes on iPhone A and iPhone B.
- Results recorded in `docs/sessions/YYYY-MM-DD-universal-share-beta-acceptance.md`.
- Any failure creates or updates `errors_log.md` only if it is a real build, test, runtime, or QA failure under repo policy.
- No function gate is skipped for code-touching phases.
- `pnpm check:parity --quiet` passes for parity-impacting phases.

## File Ownership Map

Expected write zones:

- `packages/sync/src/share/` for share intake, manifests, permission grants, resolver contracts, and transfer state.
- `packages/sync/src/protocol/share-session.ts` for protocol extension.
- `packages/sync/src/blob/` for resumable attachment transfer and mobile-safe blob storage.
- `packages/sync/src/db/` for migrations and queries.
- `packages/sync/src/transport/` for real transport backends and fallback attempts.
- `packages/ui/src/sync/` for reusable share, request, progress, and history components.
- `apps/mobile/plugins/` for Expo config plugins.
- `apps/mobile/app/(hub)/settings/` for hub settings screens.
- `apps/mobile/app/(hub)/share/` for MyLife share inbox and intake review.
- `apps/bestchef/plugins/` for BestChef-specific extension/config work if separate from hub.
- `apps/bestchef/app/(root)/share/` for BestChef share intake and routing.
- `modules/bestchef/src/share/` and `modules/bestchef/src/import/` for resolver logic.
- `docs/designs/mesh-sync-architecture.md` for architecture updates after decisions are final.
- `docs/designs/mesh-sync-module-policy-matrix.md` for module policy changes.

Avoid:

- New parallel sync package outside `packages/sync`.
- Standalone app file scatter in the MyLife root.
- Treating BestChef private kitchen/pantry data as social shareable data without explicit policy.

## Dependencies To Evaluate

iOS/native:

- Custom Swift Share Extension target.
- App Group entitlements.
- Multipeer Connectivity bridge.
- Bonjour/DNS-SD bridge.
- TCP or stream transport library.
- React Native WebRTC backend.
- BLE bridge for wake-up pings.

Expo:

- Config plugin for Share Extension and App Group entitlements.
- Config plugin for local-network/nearby permissions.
- EAS app extension declarations and credentials.

Server:

- Signaling service for WebRTC.
- Ciphertext relay service with ephemeral tokens.
- Push notification service for pending encrypted share notifications.
- Quota and abuse controls.

## Open Decisions

1. Should MyLife and BestChef each ship their own Share Extension, or should BestChef route through the MyLife hub extension when installed inside the hub?
2. Should first beta require both users to have the app foregrounded for direct transfers, with relay as the only offline path?
3. What is the default max file size for beta: 50 MB, 250 MB, or user-configurable by transport?
4. Should audio/video be transcoded or transferred original-only in beta?
5. Which permission presets should be visible in the extension UI versus only in the main app?
6. Should BestChef auto-detect recipe URLs in the extension, or always ask in the main app?
7. Should relay be allowed for all beta testers, or only for invited testers with quota?
8. What is the beta privacy stance for source app metadata: keep by default, strip by default, or ask?

## Launch Readiness Definition

This plan is complete when the following concrete scenario works:

1. Trey installs MyLife or BestChef beta on iPhone A.
2. A friend installs the same beta on iPhone B.
3. Trey and friend pair devices, verify fingerprints, and rank transport preferences.
4. Trey opens Photos, shares a video to BestChef, picks the friend, chooses `Large Media`, and sends.
5. The app chooses the highest mutual available transport, records the attempt, and sends an encrypted offer.
6. The friend accepts, receives chunks, verifies the hash, and imports the video into the intended BestChef destination.
7. Both devices show delivered status, selected transport, bytes transferred, and receipt.
8. The same workflow passes for text, URL, audio, PDF, arbitrary allowed file, and a blocked unsupported file with the correct error.
