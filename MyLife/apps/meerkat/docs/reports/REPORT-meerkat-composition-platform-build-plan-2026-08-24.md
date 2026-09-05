# Meerkat Composition Platform: Engineering Build Plan

Date: 2026-08-24
Scope: apps/meerkat, apps/meerkat-web, packages/sync, packages/meerkat-relay
Method: Fable-authored; 6 parallel code-verification agents; every seam claim checked against source
Companions: REPORT-meerkat-full-system-review-2026-08-24.html, REPORT-meerkat-community-platform-features-2026-08-24.html
Posture: Full ambition, founder mandate. No MVP framing. Every phase ships at full function for its capability.

---

## 0. The honest baseline (confirmed before planning)

Both prior reports and `capability-status.ts` were read in full. The baseline: Meerkat is a code-complete, ~11,000-test private community platform (communities, channels, roles, posts, threads, reactions, DMs, files, theming, sealed media libraries) on real classical E2EE (X25519/Ed25519/XSalsa20-Poly1305, Noise NK forward secrecy, epoch group keys, RSABSSA blind credential), currently NO-GO at rc18 only on founder-ops (deploy relay/Postgres fleet, counsel, NCMEC/DMCA, TestFlight, live and 2-device evidence). Live rungs today: manual relay sessions and live-wake mailbox listening (live), LAN and in-person (dev build), calls/rooms/WebRTC/nearby (built, deployment- and device-gated), A/V playback via loopback decrypt server (dev build). The consumption feed, video pipeline, live broadcast, short-form, monetization, follow graph, and commerce do not exist as products; their foundations (deterministic local feed, sealed library schema, LiveKit room stack with a subscribe-only viewer role, a written-but-unwired torrent stack, pin/budget/LRU offline layer) are real and verified below.

## 1. Verified seam ground truth, and three corrections to the companion report

Six verification agents ran against source; I re-read the load-bearing lines myself. The five seams hold, with sharper detail than the companion feature report assumed. Three findings change the design:

### 1.1 Correction: new descriptor FIELDS break old verifiers; new TABLES and new kind VALUES degrade gracefully

The conditional canonical append mechanism (`packages/sync/src/protocol/community.ts:180-238`) keeps NEW code verifying OLD descriptors byte-for-byte. It does not do the reverse: an old client verifying a new descriptor canonicalizes only the fields it knows, produces different bytes than the owner signed, and rejects the revision. So a descriptor-level `layoutDocument` field would make every legacy client treat a re-layouted community as forged.

By contrast:
- A new channel `kind` VALUE rides an existing slot. Old clients serialize the string as-is, signatures verify, and `channelKind()` (community.ts:526) returns `'unknown'`, rendering the designed read-only banner.
- A new owner-signed EVENT TABLE (the `cm_community_identity` pattern) is simply unknown to old clients: their `COMMUNITY_SYNC_POLICY` has no rule for it, `defaultScope: 'device_local'` fails the inbound row closed, and they render the legacy surface. No signature breakage, no forgery scare.

Decision: the layout document, capability manifest, and tier definitions ride ONE new owner-signed event table (`cm_layout`), not descriptor fields. The descriptor gains nothing in Phase 1. New channel kinds ride the existing kind slot. The descriptor extension mechanism (below) is reserved for later verifier-visible needs only.

### 1.2 Correction: there is exactly one trailing conditional descriptor slot; a second is positionally ambiguous

`canonicalDescriptor` ends with `...(organization ? [organization] : [])`. A second naive trailing conditional slot would collide positionally with the organization slot. When a verifier-visible descriptor field is eventually needed (e.g. server-enforceable tier rosters), the only signature-safe mechanism is NESTED conditional append inside the existing organization slot: the slot serializes as `[categories, layout]` today and `[categories, layout, <newField>]` when the new field is non-default; inner array length disambiguates; every existing descriptor's bytes are unchanged. Any other shape needs a versioned serializer. This constraint is documented here so no implementer adds a second trailing slot.

### 1.3 Correction: the parity gate does not self-extend, and several shipped cores are already unlocked

`scripts/check-meerkat-parity.mjs` is imperative. The `chatKitTwins` tuple list (line ~490: `[label, mobilePath, webPath, anchorExport]`) is the extension model, but nothing fails when a `*-core.ts` exists with no lock: `feed-view-core.ts`, `join-flow.ts` (which already carries ~106 lines of real drift), `public-directory-client.ts`, `discover-core.ts`, `public-reader-core.ts`, and `public-join-client.ts` are all unlocked today. Phase 0 fixes this before the platform multiplies core files.

### 1.4 Other verified facts the plan builds on (agent-reported, spot-checked)

- Theme choke point: `resolveActiveTheme` (data/community-theme-core.ts:68) is pure/total, priority high-contrast > mine > verified blob > accent > base; blob capped 16 KB on `cm_community_identity.theme_blob`; verified at apply (`inbound-row-validators.ts:56`, `SIGNED_ROW_VALIDATORS`) and at read (`resolveCommunityIdentity`). Boundary providers wrap only community subtrees, with leakage tests on both surfaces.
- Media-type registry: `MEDIA_TYPE_REGISTRY` (library-metadata-core.ts:85) maps type to `{schema, sortFields, defaultSort, cardShape}` with a never-throwing `unknown_type` fail-safe. This is the block-registry template.
- Loopback playback: `loopback-server-core.ts` is a real RFC 7233 single-range HTTP core with token-in-path (players drop headers on seek), constant-time token compare, per-chunk HKDF decrypt plus SHA-512 verify against the SIGNED manifest before any byte is yielded. Web is a pure planner (`library-playback.ts`): MSE for fragmented MP4/WebM, object URL under 256 MB, honest unsupported copy otherwise.
- Poster/thumbnail generation for video: does not exist anywhere. No ffmpeg or A/V frame dependency in the repo (only `expo-video`). `cm_library_items` has `thumb_cid` but NO `thumb_wrapped_key` column, so a separately keyed thumbnail is unpersistable today; `ResizeCover` is declared and never implemented; enrichment `posterUrl` has zero consumers. Schema is the blocking item.
- Offline layer: pin classes (`authored/explicit/policy` protected, `fetch_cache` LRU-evictable), device budget presets, `evictToBudget` with honest `impossible` reporting, keep-on-device, last-copy honesty copy. Gap: the playback-hold registry exists but eviction is NOT wired to it.
- Torrent stack: the swarm half (`SwarmManager`, `TorrentDownloader`, `PieceManager` rarest-first, `publisher`, `deep-link`) is pure bookkeeping, zero production consumers, no wire protocol (no HAVE/REQUEST/PIECE frames anywhere), excluded from `index.native.ts` (node `crypto` dependency). The catalog/web-seed half (`manifest.ts`, `community-catalog.ts`, `web-seed.ts`, `SeedingEngine`) is LIVE in channel-history and the relay seeder. Two content models exist: catalog pieces (index-addressed) vs sealed-share chunks (content-addressed); the shipped fetch path (`fetchAndPinFromHosts`, remote-store.ts:121) is sequential single-host over sealed chunks. `blob-transfer.ts` already has request-with-`have` resume over real `TransportConnection`s. A deployable always-on seeder exists (`meerkat-node.mjs`, serving the exact `/manifest/{contentId}` + `/block/{sealedId}` shape the fetch path consumes) but is NOT in `compose.production.yml`; the host registry announce/lookup is fully implemented on both client and relay. Web-seed docstrings claim BEP 19/Range but the implementation is whole-piece-per-request.
- Rooms/live: `room-membership.ts` has a real subscribe-only `viewer` role (`permissionsAllowedForRole`), Ed25519 admission requests with ephemeral participant ids (the SFU never sees Meerkat identity), HMAC-opaque SFU room names, revocation by generation bump. LiveKit is group-rooms only; 1:1 calls are peer WebRTC with STUN only (no TURN default). A default build has NO rooms (`livekitUrl` defaults empty). Zero RTMP/HLS/egress/recording code exists. Room E2EE is declared-but-unwired: the adapter never emits `e2ee` events, so the security banner honestly always reads encrypted-to-server. Call signaling (`offer/answer/ice/restart` sealed frames over pair tokens) is the ready-made glue for the WebRTC transport rung.
- Feed: six item kinds (`post/reply/mention/unread/file/public`), no video kind, fixed deterministic `KIND_RANK` scalar, engagement inputs deliberately excluded from ranking (NC-5), no strategy abstraction, source toggles NOT persisted (useState only), "why did I see this" is real per-item reasons.
- Monetization substrate: $4.99 unlock is real and deny-by-default routed (`app-access-policy.ts`); hosted Stripe billing service is real server-side (checkout/portal/webhook/entitlements, 402 fail-closed, tenant caps DB-enforced) with NO client purchase surface; pay-to-post is the unlock SKU re-presented (no per-post fee exists); `host-credits.ts` and `seeder-quota-controller.ts` are implemented with zero production consumers. Boot revalidation deletes the unlock cache on ANY non-ok result including network errors (offline paid users get re-locked; fix in Phase 9).
- Two-identity wall: textual import-graph allowlists on both surfaces (mobile stricter); credential message carries NO attribute/tier field; serials computable by holder/verifier, never issuer; the wall constraints for money flows are enumerated in section 10.
- Follow: `cm_public_follows` exists, device-local with `maxScope: 'device_local'`, one-directional, invisible to targets; no follower side exists anywhere; `listPublicFollows` has zero consumers (no Following feed). Friend rows are device-keyed projections of `sync_paired_devices`. A creator graph will be the first replicated social edge in the system.
- Public directory: WebSocket-only relay node with verified-publication storage, anti-rollback kills, real distinct announcing-host counts; `joinPolicy` is exactly `'open' | 'request'`; grants ride inside the signed descriptor (unforgeable); invites are self-contained signed links with 48 h TTL and no revocation list; web is missing the invite deep-link listener entirely (paste-only).

## 2. Platform architecture: the composition spine

The spine is four artifacts. Everything else in this plan is a block plugged into them.

### 2.1 Block registry (BUILD)

The generalization of `MEDIA_TYPE_REGISTRY`, delivered as a pure core.

- Create `apps/meerkat/app/(root)/data/block-registry-core.ts` + byte twin `apps/meerkat-web/src/lib/block-registry-core.ts`.
- `BLOCK_REGISTRY: Record<KnownBlockType, BlockContract>` where

```ts
interface BlockContract {
  configSchema: ZodType;            // per-block config carried in the layout document
  dataSources: readonly string[];   // exact cm_/mk_ tables + blob classes this block may read
  requires: readonly CapabilityKey[]; // capability-manifest gates
  surfaces: 'home' | 'channel' | 'both';
  channelKind?: CommunityChannelKind; // when the block is the view contract for a kind
  fallback: 'placeholder';          // unknown/ungated blocks render a safe honest card
}
```

- Block types v1: `hero`, `chat`, `posts`, `timeline`, `gallery`, `video_gallery`, `video_player`, `live_stage`, `shortform_pager`, `files`, `store`, `tiers`, `embed`, `events`, `page`, `members`.
- Renderers stay OUT of the core (they touch native modules): per-surface renderer maps `apps/meerkat/app/(root)/components/blocks/registry.tsx` and `apps/meerkat-web/src/ui/blocks/registry.tsx`, keyed by block type, mirroring how the theme seam separates pure resolution from rendering. An unregistered or capability-ungated type renders `BlockPlaceholder` with honest copy ("This community uses a block this build does not support yet").
- Sandbox rule, enforced by test: a block renderer receives a `BlockDataContext` that exposes ONLY query functions for the tables its contract declares. A new lint-style test (`block-data-scope.test.ts`, both surfaces) greps each renderer for db access outside its contract, in the style of `chat-kit-no-providers.test.ts`. Blocks never fetch the network directly; the embed block's consent gate is the single sanctioned exception (section 9).

### 2.2 The community composition document: `cm_layout` (BUILD, on the identity-event pattern)

One new owner-signed event table carries layout, capability manifest, and tier definitions together, modeled line-for-line on `cm_community_identity`:

- Table `cm_layout`: `id` (signature-bound event id), `community_id`, `revision`, `layout_blob` (capped 32 KB), `tombstone`, `updated_at`, `signed_by`, `signature`. Entity rule `shared_workspace/shared_workspace`, lww. The two existing rule-less-table guard tests cover it automatically once the DDL and rule land together; the `id = rowId` sync invariant applies.
- Protocol file `packages/sync/src/protocol/community-layout.ts`: canonical bytes domain `meerkat-community-layout-v1` (version, communityId, revision, layoutBlob, tombstone, updatedAt, signedBy), `createCommunityLayoutEvent`, `verifyCommunityLayoutEvent` (owner-only, fail-closed shape checks, cap enforcement), `resolveCommunityLayout(events, ownerDeviceId)` (re-verify all, highest verified revision, null on tombstone). Register `validateCommunityLayoutRow` in `SIGNED_ROW_VALIDATORS` (inbound-row-validators.ts) so forgeries die before INSERT, and DELETE is rejected (tombstone events only).
- Blob format: new package `packages/meerkat-layout/` mirroring `packages/meerkat-theme` (codec with `meerkat-layout:v1:` prefix, Zod schema, size cap, typed decode errors). Content: `{ capabilities: CapabilityKey[], tiers: TierDef[], home: BlockNode[], channels: Record<channelId, BlockNode[]> }` where `BlockNode = { type, config }`. The sync package carries the blob opaquely as a capped string, exactly like the theme blob.
- Resolution choke point: `data/community-layout-core.ts` (+ byte twin) exports `resolveActiveLayout(input)` mirroring `resolveActiveTheme`: verified blob decoded and schema-validated, else fail SAFE to the legacy rendering (`communityLayout()` chat_first/library_first). Malformed or unknown block nodes degrade per-node to placeholder, never whole-screen.
- Old clients: never see the table (fail-closed inbound), render legacy surfaces. New clients in a legacy community: no `cm_layout` rows resolve to null, render legacy. Both directions degrade with zero signature risk.

### 2.3 Capability manifest semantics (BUILD, inside cm_layout)

`capabilities` in the layout blob declares what the community turns on: `video`, `live`, `shortform`, `store`, `tiers`, `embeds`, `offline_download`, plus the existing signed `transportPolicy` continuing to govern transport. Two-layer honesty, exactly the `capability-status.ts` pattern:

- DECLARED: the owner turned it on (signed, gossiped).
- AVAILABLE: declared AND the runtime substrate exists (dev-build module present, SFU configured, seeder reachable). `resolveBlockAvailability(contract, declaredCaps, runtime)` in the registry core computes this; a declared-but-unavailable block renders its honest pending card ("Live stage is enabled here, but this build has no room server configured"). Copy never claims a capability the runtime cannot deliver.
- Safety/entitlement logic can reason about a community from the manifest without reading content.

### 2.4 Layout editor (BUILD, on the theme-editor pattern)

- Mobile `app/(root)/(tabs)/community/[communityId]/layout-editor.tsx`, web `src/ui/community/LayoutEditor.tsx`, owner-gated from community settings.
- Same shape as `theme-editor.tsx`: a draft layout document in local state, live preview rendered through the real block registry (so preview IS the product), publish = one signed `cm_layout` revision. Reordering via drag handles; per-block config sheets generated from each block's Zod `configSchema`.
- Shareable layout templates: `meerkat-layout:v1:` blobs exported/imported via the existing deep-link + QR machinery (`buildThemeDeepLink` pattern), so "make my community look like a YouTube channel" is a paste.
- Non-removable floors, enforced in the registry (not the editor): every community always exposes its channel list and settings; any block presenting ranked content always renders the ranking picker with `chronological` present (section 5.2). A layout document cannot hide the honesty surfaces.

### 2.5 Parity and the auto-guard (Phase 0, prerequisite)

- Convert the imperative parity script's core-lock section to a declarative registry (extend `chatKitTwins` into `CORE_TWINS` with the same tuple shape), then add the missing meta-guard: enumerate `apps/meerkat/app/(root)/data/*-core.ts` + known out-of-convention cores, FAIL if any core file has no lock entry (with an explicit documented-exception list for the two legitimately divergent files, `channel-view-core` and `chat-compose`).
- Add lock entries for the currently unlocked cores; reconcile `join-flow.ts` drift (real remediation, not just a lock).
- Every new core in this plan (`block-registry-core`, `community-layout-core`, `feed-rank-core`, `download-core`, `watch-core`, `shortform-core`, `store-core`, `tier-core`, `embed-core`, `live-core`, `follow-core`) lands with its `CORE_TWINS` entry in the same commit; the meta-guard makes forgetting impossible.

## 3. New channel kinds

Extend `KNOWN_CHANNEL_KINDS` from `['chat','library']` to add: `video` (video gallery + watch pages over a library-backed store), `live` (live stage + chat), `shortform` (vertical pager source), `forum` (posts-first presentation of the existing posts substrate), `timeline` (microblog presentation of posts with quote/repost), `gallery` (image-first), `store`, `events`, `page`. Each kind maps to a default block stack in the registry; the layout document can override per channel. Old clients render unknown kinds as the existing read-only banner. Kind is already inside the signed channel tuple, so a tampered kind breaks the descriptor signature.

The channel tuple extension caveat: today the tuple is 3 (legacy) or 8 (organization) elements. Any future per-channel field (e.g. `tierId`, section 10) appends as element 9+, all-or-nothing with the 5-slot extension, length-disambiguated; same nested-append discipline as 1.2.

## 4. Video VOD (YouTube parity)

### 4.1 Data model

- Schema migration (signed-row canonical append on library items): add `thumb_wrapped_key TEXT` (the anticipated "Phase 5" column) and `extra_manifests_json TEXT` to `cm_library_items`. `extra_manifests_json` is an array of `{ label, contentCid, keyEpoch, wrappedKey, manifest, manifestSignature }` covering renditions, caption tracks, and the filmstrip sprite. Extend the item-signature canonical bytes with these fields via conditional append (absent = legacy bytes; fixture-lock a legacy item). Extend `collectBlobRefs` (blob-transfer.ts:96) to walk the array so all sealed sidecars ride the existing session blob pipeline automatically.
- `metadata_json.video` (inside the existing 16 KB curator-signed metadata, schema extension on `movie`/`show`/`custom`): `{ chapters: [{title, startMs}], captionsMeta: [{lang, label}], durationMs, defaultRendition }`.
- Watch signals: new table `cm_view_events` (shared_workspace, or_set), a SIGNED opt-in "I watched this" event `{itemId, deviceId, signature, at}`. Sharing that you watched is OFF by default per member per community; `cm_library_progress` stays personal and thin (the privacy property that a community cannot learn what you watched is preserved because view events exist only when a member explicitly opts in). The watch page shows `N members shared they watched`, counted from verified events, never a fabricated or extrapolated "views" number.
- Comments: a post thread anchored to the item (`cm_posts` with a signed `itemId` anchor field on the v2 message payload), rendered by the existing chat kit. Likes: existing reaction model against the anchor. Up-next queue: device-local (reuses the music sibling-queue pattern).

### 4.2 Playback and page

- `watch-core.ts` (pure, twinned): assembles the watch view model (rendition choice, caption cues parsed from WebVTT, chapter index, resume position from `cm_library_progress`, verified view count, honest availability line).
- Mobile watch page `library/watch/[itemId].tsx` on the loopback server (dev build; Expo Go renders the existing honest export-only fallback). Captions rendered as our own overlay from parsed VTT cues synced to player position (works on both surfaces, no native subtitle dependency). Chapter markers on the scrub bar; filmstrip sprite decoded from its sealed sidecar for scrub preview.
- Web watch page via the existing `playbackPlan` (MSE/object URL); rendition switch = plan re-evaluation against the chosen rendition manifest.
- `video` channel kind + `video_gallery` block: poster grid off `thumb_cid`/`thumb_wrapped_key`, duration badges from signed metadata.

### 4.3 Posters, filmstrips, transcode: where the work runs (hard problem, resolved)

Transcoding requires plaintext; Meerkat's servers hold ciphertext. Three lanes, all producing the identical sealed output shape, so downstream code never knows where the work ran:

1. AUTHOR DEVICE (default, ships first): poster + filmstrip via `expo-video-thumbnails` (new dev-build-gated native seam `data/video-frames-backend.ts`, lazy-loaded, honest-null in Expo Go, mirroring `lan-backend.ts`); cover downscale finally implements the declared `ResizeCover` seam. No on-device full ABR ladder: ffmpeg-kit is retired upstream and shipping a maintained on-phone transcoder is not currently defensible; a phone uploads its native rendition plus thumbnails.
2. AUTHOR WEB/DESKTOP (the real ladder): a WebCodecs transcode worker in meerkat-web (VideoDecoder/VideoEncoder + JS muxer) producing the fMP4 ladder (e.g. 480p/720p/1080p) client-side, sealed client-side. Plaintext never leaves author custody. This makes the desktop browser the creator studio, which is the right product shape anyway.
3. HOSTED, CONSENT-GATED (founder-ops): a transcode job on the hosted node for communities that already trust a hosted server with availability. The upload flow states explicitly that the server will decrypt to transcode; the key grant is a per-object DEK share, never the epoch key. Fail-closed when unconfigured. This lane is code plus founder-ops (ffmpeg on hosted infra) and lands last.

Honesty rule: a video with no ladder plays single-rendition decode-what-you-can, exactly as today, and the UI says so ("One quality available").

### 4.4 What is code vs founder-ops vs live-only

- Code: schema + canonical append, watch core/pages, caption/chapter/filmstrip pipeline, device thumbnails, WebCodecs ladder, view events.
- Founder-ops: hosted transcode lane deployment.
- Live-only evidence: loopback playback + scrub on physical devices (dev build), large-file session transfer soak between two devices.

## 5. Short-form vertical pager (TikTok parity) and the ranking-strategy interface

### 5.1 Pager

- New feed item kind `video` in `feed-core.ts` (sourced from `video`/`shortform` channel items and video posts). `shortform-core.ts` (pure, twinned): builds the pager queue, preload window (next 2 sealed items via the existing fetch path), autoplay eligibility, mute state machine, per-item "why" passthrough.
- Mobile `(tabs)/shortform.tsx` (or a `shortform_pager` block on a community home): full-bleed snap FlatList (`pagingEnabled`), one loopback player mounted for the on-screen item only, mute-by-default tap-to-unmute, the engagement row wired to the real reaction/comment substrate. Expo Go: honest poster cards with a "playback needs the full app build" notice, never a silent dead surface.
- Web: scroll-snap column with the MSE planner per item.
- Every number on the pager (reactions, comments, shared-watch count) comes from verified rows; there is no view counter at all unless opt-in view events exist.

### 5.2 Ranking-strategy interface (the pick-your-algorithm promise)

- `feed-rank-core.ts` (pure, twinned): `interface FeedRanker { id, label, score(item, features): number }` over a FIXED feature set (kind, recency, unreadCount, replyCount, reactionCount, isFollowedAuthor, isSameCommunity). Built-ins: `chronological` (hard-wired, never removable), `focused` (today's KIND_RANK behavior, remains default), `most_reacted`, `follows_first`.
- Community-authored rankers are DATA, not code: a signed JSON weight vector over that fixed feature set, carried in the layout document, clamped per-feature, schema-validated, fail-safe to `chronological` on any invalid weight. No expression language, no eval, no fetch. This is the algorithm-marketplace safety resolution: the marketplace trades weight vectors, the client's fixed scorer runs them, and the plain timeline is structurally always one tap away (the registry-enforced floor from 2.4).
- Persistence fix rides along: feed source toggles and the chosen ranker persist to `mk_settings` (`feed_controls`, `feed_ranking_strategy`); today's useState-only toggles are a verified gap.
- The "why did I see this" sheet gains the active ranker's name and the item's feature values, keeping the transparency property as ranking becomes pluggable.

## 6. Offline: download manager, background pre-fetch, progressive watch

- `download-core.ts` (pure, twinned) + device-local `mk_download_queue` (`content_id, pin_context, priority, policy(wifi_only|any), status, staged_blocks, total_blocks, created_at, updated_at`). Progress is real staged-block counts from the store, never a synthetic percentage.
- One-tap "Download to watch offline" = queue entry + pin class `explicit` on completion. Pause/resume: extend `fetchAndPinFromHosts`/`loadFromRemote` with per-chunk existence checks against the store so a resumed download fetches only missing sealed chunks (the session path already has `have`-list resume in blob-transfer; this brings the HTTP path to parity).
- Background pre-fetch: a `runDownloadDrainJob` composed into the existing `runBackgroundSyncOnce` round (same honest recorded-run pattern; OS-scheduled cadence remains dev-build-flag-gated exactly as today). It also triggers opportunistically when a holder peer appears in a live session (the auto-connect round already provides the hook).
- Progressive watch: playback is permitted when a contiguous prefix of chunks is present; `makeChunkStream` gains an honest stall at the first missing chunk (buffering UI + priority-fetch of the next chunks), never silent gaps. Requires wiring the existing playback-hold registry into `runLibraryEviction` (a verified open gap) so LRU can never evict the file mid-play.
- Local-only communities get this for free: `transportPolicy 'local_only'` content already lives on device; download is instant and offline is the baseline. The community settings toggle (owner-signed revision through the existing `transportPolicy` field) plus honest copy is an EXTEND, shipped in Phase 1.
- Live-only evidence: multi-hour download soak on device, eviction-under-pressure QA.

## 7. Multi-peer swarm and the seeder (hosted + P2P availability)

Standardize on the sealed-share chunk model (the shipped one). The catalog piece model stays what it is today: the live interchange for channel-history snapshots and the relay seeder catalog. The dead swarm classes are a design quarry, not a dependency: port their good ideas (rarest-first, piece bookkeeping) onto the chunk model; retire `publisher.ts`/`deep-link.ts` fantasy URLs (`share.mylife.app`, `tracker.mylife.app`) and the docstring Range claims (verified inaccurate) in the same change.

Three deliverables, independently shippable:

1. PARALLEL MULTI-HOST FETCH (code): a chunk scheduler in `remote-store.ts` that assigns missing chunks across all reachable hosts concurrently (bounded parallelism, per-host failover, verify-then-pin unchanged). No new wire protocol; immediate speedup wherever more than one host announces.
2. PEER CHUNK EXCHANGE (code, new protocol): extend `blob-transfer.ts` with `BLOB_HAVE` (availability bitmap exchange at session open for pinned contentIds in the shared workspace) and multi-peer scheduling with rarest-first chunk selection, riding existing sessions over LAN/nearby/relay `TransportConnection`s. Phones remain resolve-only to the open network (no inbound HTTP listener); phone-to-phone transfer happens only inside authenticated sessions, which is both the privacy posture and the NAT answer.
3. SEEDER DEPLOY (code + founder-ops): add `meerkat-node.mjs` to `compose.production.yml` with health checks; wire its existing `announceHeldShareContent` refresh loop; connect hosted-tenant pinning (the `seeder_manifests` table exists) so the $4.99/mo hosted server actually seeds its community's libraries 24/7. Founder-ops: deploy, storage provisioning, soak. Honest copy stays exactly as CLAUDE.md mandates until the seeder is live ("Available from members who have it, when a sync connects"), then upgrades to availability language backed by a real reachable-host probe.

Live-only evidence: 3+ device swarm session, seeder 24/7 soak, tampered-host negative on production infra.

## 8. Live broadcast (Twitch/YouTube Live parity)

### 8.1 What exists vs what this builds

The admission/roles/SFU substrate is built and verified (viewer role, signed admission, opaque room names, generation revocation). A default build has no rooms at all (`livekitUrl` empty); nothing RTMP/egress/recording exists. Live is therefore mostly a deployment-gated product build, not a protocol build.

### 8.2 Build

- `live-core.ts` (pure, twinned): broadcast state machine (idle/preparing/live/ended from REAL room events only), viewer count from real LiveKit participant events, stream health from real connection stats, moderation actions mapped to existing community roles.
- Go Live: `live` channel kind + `live_stage` block. Host joins its room publishing; every other member's join path requests `['subscribe']` only (the admission request already carries requested permissions; `isPermissionSubset` allows requesting less than your role). Live chat is the channel's existing chat at the live-loop hot cadence, rendered as an overlay.
- Announce honestly: an owner/host-signed `going_live` event row (`cm_live_announces`, shared_workspace, lww, apply-time validated like other signed rows) lets members see "Live now" ONLY when a verified fresh announce exists AND the viewer's own join probe succeeds. Copy never claims live from the announce alone.
- Record-to-VOD: LiveKit Egress writes the recording on operator infra; the recording is NOT E2EE (the SFU model already is not, and the room banner already says so). The finished file enters the community library through the normal sealing path: host (or hosted node, consent lane 4.3.3) seals it, producing a standard library item. The security copy on a live stage always states the SFU trust model; record-to-VOD copy states who held plaintext.
- Optional hardening item: wire LiveKit's frame-encryption events into the existing `e2eeActive` reducer (verified declared-but-unwired) for small symmetric rooms; large fan-out stays server-trusted and honestly labeled.
- RTMP ingress (OBS) and HLS egress for very large audiences: LiveKit Ingress/Egress services. Code: ingest key minting UI on the owner surface, egress trigger, imported-recording flow. Founder-ops: deploy Ingress/Egress + Redis + TURN (TURN also unblocks the verified STUN-only 1:1 call gap), capacity planning.
- Live-only evidence: 2+ device broadcast, viewer-scale test, ingest from OBS, recording round-trip. None of this can be claimed from tests.

## 9. Embeds (the external-content bridge)

- `embed-core.ts` (pure, twinned) + `embed` block. An embed is authored as a sender-generated preview (the existing NC-2 link-preview pattern: title, thumbnail, canonical URL as a verified sealed blob). The receiving device NEVER fetches the URL by default; the strict no-receiver-fetch rule holds.
- Tap = explicit consent interstitial naming the destination ("This will connect you to YouTube and share your IP address with Google"), then either in-app webview or OS browser. Per-destination consent memory in device-local `mk_embed_consent` (`host, decision, updated_at`), with "always allow for this site" as informed opt-in, revocable in settings.
- Import-natively is the promoted path on the interstitial: for content the author owns, the flow routes to the library ingest path so the video becomes a sealed, offline-capable, P2P-distributable item. Copy frames embedding as the compatibility bridge and import as the real thing.
- Privacy-proxy embed (relay fetches media on the viewer's behalf) is designed but deliberately NOT in the build sequence: it shifts trust to the relay operator, adds copyright/abuse surface on operated infra, and the consent gate plus import already satisfy the honesty bar. Revisit only with founder sign-off; noted as founder-ops-heavy.

## 10. Monetization: tiers, tips, storefront, payouts

The rails exist server-side (Stripe billing service, entitlements 402-fail-closed, RevenueCat unlock, blind-credential humanity gate). What follows keeps the two-identity wall intact under money flow; the six wall constraints verified in code review are binding on every item below: no joining column anywhere reachable from persona/device rows; credential and session bearer never on the same request; payment state account-side in aggregates only; no tier encoded in the credential (anonymity set collapse); import-graph allowlist changes are reviewed one-line diffs; deletion copy stays honest about tax-retention records.

### 10.1 Membership tiers (Patreon/Twitch subs)

- A tier is a KEY LANE, not a flag: per tier, a child workspace (`communityId:tier:<tierId>`) with its own epoch key chain via the existing `commitMemberAdd`/`commitMemberRemoval`. Tier-gated channels' content syncs under that workspace's key; non-payers structurally cannot read it (membership IS the read capability, unchanged). Leaving/lapsing = member removal = epoch rotation forward; history access follows the tier's `historyScope`.
- Tier definitions (name, price ref, perks, channel mapping) live in the signed layout document; the channel-to-tier mapping later graduates to the descriptor channel tuple (nested append per 3) if server-side enforcement needs it.
- Purchase flow: web/hosted via Stripe Checkout against the existing billing service (the missing client purchase surface gets built here for both hosted-server and tiers); iOS in-app digital-content tiers must use IAP (RevenueCat products) per App Store policy; the plan treats Apple's 30% and product-approval cycle as a founder-ops constraint, with web purchase always offered where policy allows.
- Entitlement to key grant: payment settles on the ACCOUNT layer; the buyer's device then presents a tier voucher to the community owner's device (mailbox message), and the owner device (or its delegated hosted node) commits the member-add to the tier workspace. The voucher is a per-community blind-signed token minted by the billing service against a per-community-tier key: anonymity set = that tier's buyers, which the buyer consents to by subscribing (this is disclosed in copy; it is the same set the creator sees as "my subscribers"). No platform-wide credential ever encodes tier.
- Delivery lines stay honest: "Access granted" only after the key wrap row verifiably lands on the buyer's device.

### 10.2 Tips and one-time unlocks

- Creator-directed one-time payments on the same rails: Stripe on web/hosted; on iOS, tips for digital content are IAP consumables (policy), with the web path linked where allowed. A tip mints an optional signed, non-identifying "supporter" receipt the tipper may attach to a message (never automatic).
- Per-content one-time unlocks reuse the tier machinery with a single-item key lane.

### 10.3 Storefront (commerce block)

- `store-core.ts` (pure, twinned) + `cm_store_listings` (shared_workspace, lww, curator-signed: title, price, currency, kind digital|physical, checkoutRef, fulfillment descriptor, tombstone). The store block renders verified listings only.
- Checkout: Stripe Checkout links minted by the hosted billing service per listing (physical goods and external services are policy-clean on mobile; digital goods purchased in-app on iOS route through IAP or are web-linked per current policy). Orders never become cm_ rows: order state lives on the billing service (account layer) and device-locally for the buyer; a digital purchase fulfills as a sealed download grant (single-item key lane).
- Payouts: Stripe Connect Express on the hosted billing service. Payout identity (bank, tax) is strictly account-layer; per-content earnings aggregate persona-side only as periodic totals crossing the wall under the compute-use-discard discipline. Founder-ops: Stripe Connect platform enablement, tax reporting, refund/dispute ops.
- Fix rides along: the boot revalidation bug that re-locks paid users on a network error (verified in `_layout.tsx:99-109`) is corrected to fail-open-to-cache on transient errors with a bounded revalidation window, keeping fail-closed only on a definitive negative.

### 10.4 What is code vs founder-ops

- Code: tier workspaces + voucher flow, purchase surfaces (web + IAP), store block, listings, fulfillment grants, payout aggregation seams, unlock-cache fix.
- Founder-ops: Stripe Connect + products, App Store IAP products at founder-locked pricing conventions, tax/counsel review (creator payouts are a regulatory step up from selling your own app; counsel is already the gating launch step), refund/dispute staffing.
- Live-only: end-to-end purchase, refund, revocation (epoch rotation on refund), and payout proofs on production rails.

## 11. Follow graph and discovery

- Private follows stay as built (`cm_public_follows`, device-local, invisible to targets). Phase 8 finally consumes `listPublicFollows`: a Following feed source + the `follows_first` ranker.
- Public follower registration (the first replicated social edge, deliberately server-side not mesh-replicated): opt-in "Follow publicly" registers `sha512(personaPubkey || followerCredentialSerial-derived-tag)` on the directory node, humanity-gated by the existing blind credential to keep counts sybil-resistant. Counts shown are distinct verified registrations, labeled "N registered followers"; the existing refusal to render fabricated totals (`public-profile.ts`) is replaced by the real number only when the registry responds. Follower lists are never enumerable; creators see counts, not identities.
- New-content notification for follows rides the existing mailbox/push honesty path (a data-only wake enqueues a directory poll; a notification fires only after verified new content is actually fetched).
- Discovery: the Discover tab grows directory browse (categories + trending frames already exist server-side), community cards from verified publications only, and the web invite deep-link listener + `community/join` route (verified missing on web) lands here for cross-surface invite parity.

## 12. Consolidated hard problems and their resolutions

| Problem | Resolution in this plan |
|---|---|
| On-device vs hosted transcoding under E2EE | Three lanes, identical sealed output: device thumbnails (ships first), WebCodecs ladder on author's browser (plaintext stays in author custody), consent-gated hosted lane last. Never silent server decryption. (4.3) |
| Live at scale, NAT, TURN | SFU fan-out with subscribe-only viewers (substrate verified); founder-ops deploys LiveKit + TURN + Ingress/Egress; TURN also fixes the verified STUN-only 1:1 gap; honest non-E2EE labeling preserved; large-scale claims only from live evidence. (8) |
| Phones cannot seed | Structural, not fixable on-device: resolve-only phones + peer exchange inside authenticated sessions + the always-on seeder/hosted node as the availability product. Copy never claims always-on until the seeder is deployed and probed. (7) |
| Embed privacy vs the no-receiver-fetch rule | Sender-generated verified previews + explicit named-destination consent gate + import-natively promoted; privacy proxy consciously deferred. (9) |
| Algorithm marketplace safety | Rankers are clamped, schema-validated weight vectors over a fixed feature set; no code, no eval, no fetch; chronological hard-wired and registry-enforced; "why" sheet shows the active ranker and features. (5.2) |
| Descriptor evolution vs old clients | New capability = new signed event table (graceful) or new kind value (graceful); descriptor fields only via nested append in the single organization slot, only when a verifier must see them; documented ambiguity constraint. (1.1, 1.2) |
| Tier keys vs anonymity | Per-tier child workspaces reuse the proven epoch machinery; tier vouchers are per-community-tier blind tokens (disclosed anonymity set), never a platform credential attribute; the six wall constraints bind every money flow. (10) |
| Apple policy on tiers/tips | IAP on iOS for digital content, Stripe on web/hosted, both honest about entitlement state; founder-ops owns product setup and policy review. (10) |

## 13. Build sequence, dependencies, effort

Every phase is independently shippable and leaves the app releasable. Estimates are engineering effort for this repo's solo-founder-plus-agent-fleet workflow (calendar weeks at sustained pace); founder-ops items are listed, not estimated.

| Phase | Delivers | Depends on | Effort | Founder-ops |
|---|---|---|---|---|
| 0. Parity hardening | CORE_TWINS registry + meta-guard, lock unlocked cores, fix join-flow drift, persist feed controls | none | ~1 wk | none |
| 1. Platform spine | Block registry, `cm_layout` + protocol + validators, `packages/meerkat-layout`, `resolveActiveLayout`, layout editor, capability manifest, existing blocks wrapped (hero/chat/posts/library/files/members/page), local-only toggle UI, new channel kinds registered | 0 | ~3-4 wk | none |
| 2. Video VOD | Library schema append (`thumb_wrapped_key`, `extra_manifests_json`) + `collectBlobRefs` walk, device posters/filmstrip, watch page (captions, chapters, opt-in view events, comments/likes), `video` kind + gallery block | 1 | ~3 wk | none |
| 3. Offline | Download manager + queue, chunk-level resume, background pre-fetch job, progressive watch, playback-hold/eviction wiring | 2 | ~2-3 wk | device soak QA |
| 4. Short-form + ranking | Vertical pager (both surfaces), `video` feed kind, ranking-strategy interface + weight-vector rankers, persisted controls | 2 (players), 0 | ~2 wk | none |
| 5. Swarm + seeder | Parallel multi-host fetch; BLOB_HAVE peer exchange + rarest-first; seeder into production compose + announce loop + hosted-tenant pinning; retire dead swarm scaffolding + fix Range docstrings | 3 | ~3-4 wk | seeder deploy + 24/7 soak |
| 6. Transcode/ABR | WebCodecs author-side ladder (web studio), rendition switch UX, consent-gated hosted lane | 2 | ~3 wk | hosted ffmpeg infra |
| 7. Live broadcast | `live` kind + live stage block, Go Live, subscribe-only viewers, honest live announces + counts, live chat overlay, record-to-VOD import, ingest-key UI, optional room E2EE wiring | 1; SFU deploy | ~2-3 wk code | LiveKit + TURN + Ingress/Egress deploy, 2+ device QA, scale test |
| 8. Timeline + follows + discovery | Timeline block (quote/repost on posts substrate), Following feed, public follower registration + honest counts, directory browse in Discover, web invite listener parity | 1, 4 | ~2-3 wk | directory node deploy (shared with launch) |
| 9. Monetization | Tier workspaces + vouchers + purchase surfaces (Stripe web + IAP mobile), tips, store block + listings + fulfillment, payouts (Connect), unlock-cache offline fix | 1; counsel | ~4-6 wk | Stripe Connect, IAP products, counsel/tax, refund ops |
| 10. Embeds | Embed block, consent interstitial + per-site memory, import-natively promotion | 1 | ~1-2 wk | none |

Total code effort: roughly 26 to 34 engineering weeks, front-loaded so that after Phase 1 a community owner can already compose real interfaces from the blocks that exist today, and each subsequent phase adds catalog entries without touching the spine.

Sequencing rationale: the spine multiplies everything after it, so it goes first behind only the parity guard it depends on. VOD precedes short-form (player dependency) and transcode (pipeline dependency). Offline precedes swarm (the download manager is the consumer that makes multi-peer fetch observable). Live and monetization sit later not because they are less important but because both are gated on founder-ops (SFU deploy; counsel/Stripe/IAP) that can proceed in parallel from day one; their code phases start whenever those clear.

## 14. Honesty invariants carried through every phase (binding checklist)

1. Every count (viewers, views, followers, seeds, progress) derives from engine events, sync_ tables, verified signed rows, or real store stats. No extrapolation, no placeholders.
2. Every capability distinguishes implemented+tested vs dev-build-only vs founder-ops/deployment-gated, in `capability-status.ts` (which gains entries per phase, derived from real flags) and in per-block availability copy.
3. Staged is never sent; declared is never available; recorded is never delivered without a verified receipt.
4. The receiving device never fetches sender-supplied URLs outside the embed consent gate.
5. Every new pure core ships as byte-identical twins with a CORE_TWINS lock entry, enforced by the Phase 0 meta-guard.
6. The two-identity wall constraints (10) bind every money flow; the import-graph allowlists change only by reviewed one-line diffs.
7. The plain chronological timeline is registry-enforced and cannot be removed by any layout document.

---

Prepared 2026-08-24. Grounded in six agent verification reports cross-checked against source by the author. This is a planning artifact: statuses reflect the repo at rc18 (43a357a3) and must be re-verified against code before each phase begins.
