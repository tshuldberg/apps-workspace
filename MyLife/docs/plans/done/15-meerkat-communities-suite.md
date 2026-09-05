# Plan 15: Meerkat Communities Suite (full social platform)

## Mission

Take Meerkat communities from "signed structure" (channels, roles, membership, but
no content) to a complete Discord/Slack-class social platform: text channels with
real history, voice channels, full admin and moderation tooling, optional user
profiles, custom emoji and reactions. It runs on a server the community controls
(self-hosted or Meerkat-hosted), with end-to-end encryption as the core philosophy
so neither Meerkat the company nor the host operator can read the conversation. The
data lives only where the community chooses and goes nowhere else.

## Status

DRAFT FOR FOUNDER REVIEW (2026-06-13). Extends plan 14 (M0-M6 complete). Builds on
the shipped community descriptor (MK-030/043), catalog + rarest-first seeding
(MK-031/032), desktop + hosted nodes (MK-031/041), the transparent pricing engine
(MK-042), blob transfer (MK-027), the workspace + group-key machinery (M3), and the
audit-hardened session layer (2026-06-12: default-required encryption, frame
envelope, policy-before-merge, admin-only trust authority). Ticket numbers MK-044
through MK-049 are reserved for the 2026-06-12 audit-remediation work; this program
starts at MK-050.

## Non-goals (this program)

- Public community directory / discovery. Invite-only stays (D8).
- Federation with non-Meerkat servers (Matrix-style). A later program.
- Phone-as-host (D6). Hosts are desktop / NAS / Meerkat-hosted.
- Bots, an app platform, webhooks, slash-command integrations. A later program once
  the human-facing core is solid.
- Crypto tokens for hosting (D9). Host Credits only.

## Hard rules carried forward (from plan 14 + the 2026-06-12 audit)

1. Security lives in the payload; relays and host nodes see ciphertext addressed by
   ephemeral tokens only. (Voice is the one scoped exception: audio is E2E, but the
   media server sees participation metadata. Stated plainly, never hidden.)
2. Every new synced entity declares a `syncPolicy` with `scope`/`maxScope`/
   `conflictStrategy`/`stripColumns`/`isSensitive`, enforced OUTBOUND
   (`ChangeTracker.filterForSync`) and INBOUND (`evaluateInboundChange`).
3. `isSensitive` content requires global, per-pairing SAS verification before it can
   reach `shared_workspace` (the 2026-06-12 SAS fix made verification global).
4. Honesty boundary: never show a channel as live, a message as delivered, a member
   as online, or a call as connected unless it actually is. History that depends on
   a host being online is labeled as such.
5. Every milestone extends the red-team / acceptance suite. No milestone ships with
   its gate tests red. Gate + parity green per commit.
6. The signed descriptor is the room state. There is no server-side authoritative
   room state anywhere (the only transient server state is the voice SFU's live
   session, which holds no durable content).

## New decisions (extends the plan-14 decision log)

**D15 - Channel messages are an add-only set of signed, immutable events.**
Realized on the existing `or_set` CRDT primitive (the one D14 already chose for
channels): each message is an immutable, sender-signed event addressed by its
content hash, added to the channel's set. Order is a hybrid logical clock (wall
clock + per-author Lamport counter + deviceId tiebreak) applied at read time, so
order is stable across devices without a server clock. Not LWW rows (chat appends,
it does not overwrite) and not a full text CRDT (overkill). An edit is a new event
that supersedes a prior one; a delete is an `or_set` tombstone, which also gives
clean redaction (crypto-shred the entity key per MK-024). Rides the existing
signed-batch + inbound-policy path and the `evaluateChannelPost` gate already
enforced on every device.

**D16 - History is host-seeded catalog snapshots plus live gossip.**
Recent messages move live in sessions and via the mailbox for offline recipients.
Durable history is periodically rolled into signed, group-key-encrypted catalog
pieces published to the community catalog and seeded by host nodes
(`MeerkatSeederNode` / `HostedNodeService`), fetched rarest-first with web-seed
cold-start on join or scrollback. With no host online, history is best-effort from
peers and the UI says so. This is why M10 (hosting) makes M7 reliable at scale.

**D17 - A profile is personal content shared into communities.**
A profile (display name, avatar, bio, pronouns, status) is `personal_replica` by
default and shared at `shared_workspace` into each community the user is a member
of, with per-community visibility and optional per-community nickname. Avatars are
blobs. Profiles are entirely optional; no profile is required to participate.

**D18 - Custom emoji are a community-owned blob set in the descriptor.**
Emoji metadata (shortcode to blob hash) lives in the signed descriptor under admin
control; the images are blobs seeded like any other content. Reactions are an
`or_set` of (messageId, emojiShortcode, memberId), so concurrent add/remove merges
cleanly.

**D19 - Hosting is one binary behind two front doors.**
The identical node binary is either self-run (a turnkey "Meerkat Community Server"
desktop/NAS app with a 3-step setup) or Meerkat-hosted (`HostedNodeService` +
Stripe + the transparent cost+25% ledger). A community binds hosts via
`descriptor.hosts[]`; firing a host is re-signing the descriptor without it (D13
exit right). Both are protocol-only and zero-knowledge by construction.

**D20 - Real-time media (voice, video, screen share) is end-to-end encrypted over a chosen server.**
Voice, camera video, and screen/application sharing all use WebRTC and the same
media path: calls beyond a small mesh (~6) use an SFU that runs on the
server-you-choose (self-hosted or Meerkat-hosted). Every track (audio, camera,
screen) is end-to-end encrypted with SFrame / insertable streams keyed off the
community group key, so the SFU forwards opaque media and cannot watch or listen. It
sees participation metadata (who is in a call, when, who is sharing), which we state
plainly. Screen share is a higher-bitrate video track with its own quality ladder
(resolution/framerate tiers, "share a window vs the whole screen", optional audio
of the shared app) but rides the exact same encryption, SFU, and presence model as
camera video. Signaling rides the relay. This whole real-time layer is the single
deliberate, scoped relaxation of pure zero-knowledge, limited to live sessions. M11
carries a dedicated architecture sub-spec before any real-time-media code.

## Data model additions

All tables use the `cm_` prefix (community content) and declare a `syncPolicy`.
Descriptor additions are signed fields on `CommunityDescriptor`.

| Entity | Scope | maxScope | conflict | sensitive | Notes |
|--------|-------|----------|----------|-----------|-------|
| `cm_messages` | shared_workspace | shared_workspace | or_set (add-only signed events) | no | author, channel_id (gated by descriptor), body, hybrid clock, supersededBy |
| `cm_message_attachments` | shared_workspace | shared_workspace | lww | no | blob-hash refs; images/files via blob-transfer |
| `cm_reactions` | shared_workspace | shared_workspace | or_set | no | (messageId, emojiShortcode, memberId) |
| `cm_read_state` | personal_replica | personal_replica | lww | no | last-read + unread per channel; syncs across your own devices, never to the group |
| `cm_profiles` | personal_replica | shared_workspace | lww | no | displayName, avatarBlob, bio, pronouns, status; shared per community |
| descriptor: `channels[].kind` | n/a | n/a | n/a | n/a | 'text' \| 'voice' |
| descriptor: `channels[].categoryId`, `.topic`, `.perms` | n/a | n/a | n/a | n/a | category grouping, topic, per-role grants |
| descriptor: `categories[]` | n/a | n/a | n/a | n/a | ordered category list |
| descriptor: `emojis[]` | n/a | n/a | n/a | n/a | shortcode to blob hash, admin-controlled |
| descriptor: `roles[]` / `perms` | n/a | n/a | n/a | n/a | named roles with permission grants beyond postRoles |
| `cm_voice_sessions` | device_local | device_local | n/a | no | transient presence/signaling state; no durable content |

Voice signaling rides the relay (ephemeral, token-addressed). The SFU holds only
live session state, never durable content.

---

## M7: Channel Chat (the substrate)

Exit demo: two members post in #general and #announcements from two devices;
messages appear in the same order on both; a third member joins later and loads
prior history from a host node; an image attachment sends and renders; with no host
online the UI honestly shows partial history.

| ID | Task | Size | Depends | Acceptance |
|----|------|------|---------|------------|
| MK-050 | `cm_messages` model + `protocol/channel-message.ts`: signed immutable event (author, channelId, communityId, body, hybridClock, supersededBy?), content-hash id, canonical sign/verify, hybrid-clock compare. syncPolicy: shared_workspace append-log. | L | MK-043 | Pure unit tests: sign/verify, tamper rejected, deterministic total order across shuffled inputs, edit/delete supersede semantics. |
| MK-051 | Outbound + inbound wiring: messages ride the workspace-bridge session; `evaluateChannelPost` gates channelId on every receiver (already built); signed-batch author binding; tombstone/supersede applied via the LWW/append path. | L | MK-050 | Live two-engine session test: A posts to a channel B is in, lands ordered in B; a non-poster role is rejected + audited; an edit supersedes; a delete redacts. |
| MK-052 | Channel view UI: message list (ordered, grouped by author/time), composer, send, optimistic local echo that reconciles to the real recorded event, per-channel switch. Honest states (sending / sent / failed / partial-history). | L | MK-051 | `/browse` the screen, all 5 states; no message shown as delivered before a recorded event exists. |
| MK-053 | Message edit + delete UI + redaction: edit re-signs a supersede event; delete tombstones and crypto-shreds the entity key (MK-024) so seeded ciphertext goes dark. | M | MK-052 | Deleting a message removes it on a second device and renders prior seeded ciphertext unreadable (captured-bytes test). |
| MK-054 | Attachments: image/file picker -> blob via `blob-transfer` (16KiB blocks, hash-verified, size-capped), `cm_message_attachments` ref in the event; inline render + download with wifi_only default policy. | L | MK-052, MK-027 | A multi-block image posts A->B, verifies, renders; over-cap refused; resume works mid-transfer. |
| MK-055 | History snapshots (D16): periodic signed, group-key-encrypted channel-history pieces published to the community catalog (`buildCommunityCatalog`); descriptor `catalogCid` updated by admin/host. | L | MK-050, MK-032 | A history snapshot builds, every piece verifies, and the catalog round-trips through the existing catalog tests. |
| MK-056 | History fetch + scrollback: on join / scroll-up, fetch missing history rarest-first from hosts with web-seed cold-start; decrypt with the group key; merge into the ordered log; dedupe against live events. | L | MK-055, MK-031 | A third member with zero live history loads the full backlog from a lone host node over real HTTP; ordering matches the authors' devices. |
| MK-057 | Offline delivery: messages to absent members park in the mailbox (MK-033 v2, sealed, no cleartext ids) and drain on reconnect into the ordered log. | M | MK-051, MK-033 | A member offline during a burst receives every message in order after reconnect; mailbox TTL purge respected. |
| MK-058 | Read state + unread counts: `cm_read_state` (personal_replica) tracks last-read per channel, syncs across the user's own devices; unread badges; mark-read. | M | MK-052 | Reading on phone clears the unread badge on laptop after a personal-sync session; never leaks read state to the group. |

---

## M8: Run the Place (management and moderation)

Exit demo: an admin makes a category and a voice + text channel, sets per-role
permissions, promotes a member to moderator, removes a troublemaker, deletes a
message everywhere, and revokes an invite. All via signed descriptor revisions,
enforced on every device, with a signed audit trail.

| ID | Task | Size | Depends | Acceptance |
|----|------|------|---------|------------|
| MK-059 | Channel + category CRUD via `reviseCommunity`: create/rename/reorder/delete channels and categories, set topic and kind (text/voice). Owner/admin only; chained re-sign. | M | MK-043 | Descriptor revisions add/remove channels; every device converges; non-admin edit rejected. |
| MK-060 | Role + permission model: named roles with explicit grants (view / post / manage-channel / manage-members / manage-server / mention-everyone) per channel, superseding the flat `postRoles`. Pure `evaluatePermission`. | L | MK-059 | Red-team matrix: each grant enforced at apply on every receiver; backward-compatible with existing postRoles. |
| MK-061 | Member management UI: invite, promote/demote, assign roles, view members; all as descriptor revisions. | M | MK-060 | Admin promotes a member to a role and it takes effect on a second device; viewer cannot manage. |
| MK-062 | Kick / ban: remove a member from the descriptor (kick) and add a signed ban entry + device revocation (ban) so the device is rejected at handshake. Admin-only (reuses the 2026-06-12 self+admin revocation authority). | M | MK-060, MK-019 | A banned member is dropped from the group key on next rotation and rejected at handshake; a non-admin cannot ban. |
| MK-063 | Mute / timeout: a time-boxed role grant removal; enforced at apply (a muted member's posts are rejected + audited). | S | MK-060 | A muted member's messages are rejected on every device until the timeout passes. |
| MK-064 | Moderation: message delete by a moderator (not just the author) via a signed mod-action that tombstones + crypto-shreds; reason recorded. | M | MK-053, MK-060 | A mod deletes another member's message; it disappears everywhere and the ciphertext goes dark. |
| MK-065 | Signed moderation audit log: every admin/mod action is a signed `cm_mod_actions` entry visible to admins; tamper-evident, no server. | M | MK-062 | The audit log replays the actions in order on a second admin's device; a forged entry is rejected. |
| MK-066 | Invite management: multiple named invites, max-uses, expiry, revoke; reuses the signed invite (MK-016/030) with a revocation list in the descriptor. | M | MK-043 | A revoked invite fails to join even before expiry; max-uses enforced. |
| MK-067 | Community settings screen: name, icon (blob), description, default-role, retention policy, host bindings, danger zone (delete/leave/fork). | M | MK-059 | `/browse` the settings; each control writes a verified descriptor revision or local setting. |

---

## M9: Make it Yours (profiles, emoji, reactions)

Exit demo: a user sets an avatar and bio that show on their messages; an admin
uploads a custom :partyparrot:; members react to a message with it.

| ID | Task | Size | Depends | Acceptance |
|----|------|------|---------|------------|
| MK-068 | `cm_profiles` model + editor (display name, avatar blob, bio, pronouns, status). personal_replica, shared into communities at shared_workspace. | M | MK-027 | Profile round-trips across the user's own devices; optional (no profile = anonymous handle). |
| MK-069 | Avatar blobs + render: avatar image via blob-transfer; shown on messages and member lists; falls back to an identicon from the device key. | M | MK-068, MK-054 | An avatar posts and renders on a peer; missing avatar shows the identicon. |
| MK-070 | Per-community profile sharing + nickname: choose which profile fields a community sees; optional per-community nickname. | M | MK-068 | A member shows a nickname in community A and their real name in B. |
| MK-071 | Custom emoji set in the descriptor (D18): admin uploads (shortcode + blob), lists, removes; quota-capped. | M | MK-059, MK-054 | An admin adds an emoji; it appears for every member after the descriptor + blob sync. |
| MK-072 | Emoji picker + inline render in the composer and messages (custom + standard unicode). | M | MK-071 | `:partyparrot:` autocompletes and renders inline on a peer device. |
| MK-073 | Reactions (`cm_reactions`, or_set): add/remove emoji reactions on messages; concurrent reactions merge. | M | MK-050, MK-071 | Two devices react concurrently; both reactions show on both; removal merges. |
| MK-074 | Reaction + mention notifications surface in unread/badges (local), honest counts. | S | MK-073, MK-058 | A reaction and an @mention bump the right local counters; nothing fabricated. |

---

## M10: Hosting (your server or ours)

Exit demo: a user spins up a self-hosted Community Server on a Mac in 3 steps and
binds their community to it; another uses Meerkat-hosted via Stripe checkout that
shows the cost+25% ledger; both keep history online 24/7; a community fires its host
by re-signing.

| ID | Task | Size | Depends | Acceptance |
|----|------|------|---------|------------|
| MK-075 | Turnkey self-host "Community Server" app/binary wrapping `MeerkatSeederNode` + `startSeederHttp` + relay registration: 3-step setup (pick storage, paste a bind code, run). | L | MK-031 | A non-engineer runs the binary and the node serves a community's catalog over real HTTP. |
| MK-076 | Bind / unbind a host in the descriptor: a host advertises a bind code; an admin adds it to `descriptor.hosts[]` (re-sign); members route history fetch to it. | M | MK-075, MK-055 | Binding a host makes scrollback reliable; unbinding (fire) stops new traffic, host keeps only ciphertext (D13). |
| MK-077 | Meerkat-hosted productization: `HostedNodeService` provisioning UX (pick a tier, provision a tenant, get a bind code), tenant isolation surfaced. | L | MK-041 | Provisioning a tenant yields a bound host serving the community; cross-tenant serve impossible (existing isolation test). |
| MK-078 | Stripe billing for hosted tiers: checkout, subscription, quota enforcement, dunning; tied to the tenant lifecycle. | L | MK-077 | A paid subscription provisions a tenant; cancellation deprovisions after grace; quota caps enforced. |
| MK-079 | Transparent pricing page (D13/MK-042): render `pricingLedger` (cost itemized + 25% take), illustrative flagging until real invoices, in-app + web. | M | MK-042 | The page shows raw cost vs take per tier; illustrative notice present until real costs set. |
| MK-080 | Host Credits surfacing (D9/MK-035): a member running a healthy node earns Pro-free + quota multiplier; show earned status and ratio stats. | M | MK-035, MK-075 | A healthy self-host shows the earned perk; self-attestation rejected (existing test). |
| MK-081 | Server settings + retention: storage usage, retention window, member cap, history pruning (crypto-shred old pieces), per-channel retention. | M | MK-076 | Setting a 30-day retention prunes + shreds older history pieces; usage reflects reality. |
| MK-082 | Relay + host selection: pick the nearest healthy relay (MK-036) and the best host for fetch; failover. | M | MK-036 | With two hosts, fetch picks the live one; relay selection carries a session (existing e2e). |
| MK-083 | Multi-host replication for a community: rarest-first placement across a community's hosts so one host dying keeps history available (kill-one-host AC from MK-032 applied to live history). | M | MK-076, MK-032 | With r=2 hosts, killing one keeps full history available. |

---

## M11: Voice, Video, and Screen Share (real-time media; separate architecture track)

Pre-req: MK-084 writes a dedicated real-time-media architecture sub-spec and gets
sign-off before any code. Exit demo: two members talk in a voice channel with
end-to-end-encrypted audio over a self-hostable SFU; one turns on camera video;
another shares a window or their whole screen (with optional app audio); presence
shows who is in the channel, who is speaking, and who is sharing; a 10-person call
runs through the SFU; the app never shows a session as connected before media
actually flows.

| ID | Task | Size | Depends | Acceptance |
|----|------|------|---------|------------|
| MK-084 | Real-time-media architecture sub-spec: WebRTC topology, P2P-mesh vs SFU threshold, SFU choice (build vs adopt, self-hostable + Meerkat-hosted), E2E media via SFrame/insertable streams keyed off the group epoch key for ALL track types (audio, camera, screen), per-track quality ladders, signaling over the relay, STUN/TURN, NAT traversal, presence model, exactly what the SFU sees, honesty copy. | L | M10 | Founder-approved sub-spec committed under docs/designs. |
| MK-085 | Signaling over the relay: offer/answer/ICE exchange as sealed relay frames addressed by an ephemeral session token; multi-track (audio/video/screen) negotiation; no identities to the relay. | L | MK-084 | Two clients complete a multi-track WebRTC handshake over the live relay with no plaintext identity on the wire. |
| MK-086 | STUN/TURN integration (self-hostable + Meerkat-hosted) for NAT traversal. | M | MK-085 | Two clients behind NAT connect via TURN relay fallback. |
| MK-087 | Small-group P2P voice (<=6): direct WebRTC mesh, E2E audio, no SFU. | L | MK-086 | A 4-person call runs P2P with audible E2E audio; leaving cleans up. |
| MK-088 | SFU for larger calls: self-hostable + Meerkat-hosted; forwards SFrame-encrypted media (any track type) it cannot decode. | L | MK-087 | A 10-person call routes through the SFU; captured SFU media is opaque without the group key. |
| MK-089 | E2E media keying off the community group epoch key (MK-021..023) for every track; rekey on membership change so a removed member cannot decode new audio/video/screen. | L | MK-088, MK-023 | After a member is removed and the epoch rotates, captured post-removal media is undecodable with the old key. |
| MK-090 | Voice channel UI: join/leave, mute, deafen, speaking indicator, participant list. | M | MK-087 | `/browse` the voice channel; controls reflect real state; no fake "connected". |
| MK-091 | Camera video: add/remove a camera track in a session; tiled video UI; per-tile mute/pin; bandwidth-aware simulcast layers. | L | MK-088 | A member turns on camera; peers see live E2E video; toggling off stops the track. |
| MK-092 | Screen / application share: capture a window or the full screen (+ optional shared-app audio) as a high-bitrate E2E video track with its own quality ladder; viewer can full-screen/pin it; only one or few simultaneous shares per channel by policy. | L | MK-091 | A member shares a window; peers watch the live E2E screen stream; stopping share ends the track; captured SFU bytes are opaque. |
| MK-093 | Presence for real-time: who is in a channel, who is speaking, who has camera/screen on, live, ephemeral, scoped to the server; never durable. | M | MK-090 | Presence shows real occupants + their live track state and clears on leave/disconnect. |
| MK-094 | Honesty gating: voice/video/screen UI is shown only where a real SFU/relay path exists (dev build / hosted); recovery copy when unavailable, never a crash or a fake session. | M | MK-090 | With no media path, the UI explains why; nothing fabricated. |
| MK-095 | Scale + quality pass: jitter buffer, packet loss handling, simulcast/SVC for video + screen, 10-50 participant SFU load test with mixed audio/video/screen tracks (real measured numbers, no fabrication). | L | MK-088 | Documented load test with real measured numbers across track types. |

---

## M12: Presence and Notifications (polish)

Exit demo: members see "online now" and "typing", get a push when mentioned or
called even with the app closed (best-effort wake), and search message history.

| ID | Task | Size | Depends | Acceptance |
|----|------|------|---------|------------|
| MK-096 | Live presence (online / idle / offline) over active sessions + last-seen fallback; honest (no fake green dots without a live connection). | M | M7 | Presence reflects real connection state; offline shows last-seen, not "online". |
| MK-097 | Typing indicators: ephemeral, in-channel, over live sessions only. | S | MK-096 | Typing shows only while a live session carries it; never persisted. |
| MK-098 | Push wake for messages / mentions / calls via the push-relay bridge (MK-037), best-effort, content fetched after wake (no plaintext in the push). | L | MK-037 | A mention wakes a backgrounded app; the push carries no readable content. |
| MK-099 | Notification settings: per-community / per-channel mute, mentions-only, call rings. | M | MK-098 | Settings change which events wake the device; respected. |
| MK-100 | Message search over local + host history (client-side, decrypted locally). | M | MK-056 | Searching finds messages in local + fetched history; never sends queries to a server. |
| MK-101 | Mention + unread polish: @member, @role, @everyone (permission-gated), jump-to-unread. | M | MK-073 | Mentions notify the right people; @everyone gated by permission. |
| MK-102 | Large-community scale pass: descriptor size, member fan-out, history piece count at 10k members; document limits, no silent caps. | L | M10 | Documented behavior + limits at 10k members; any cap logged, not silent. |

---

## Sequencing and dependencies

M7 is the keystone: every later milestone renders or moderates messages. M8 and M9
layer on M7 and are largely parallel to each other. M10 makes history and hosting
reliable at scale (a soft dependency under M7's history). M11 (voice) is independent
of M7-M9 but depends on M10's server/SFU hosting model and needs its own approved
sub-spec (MK-084) before any code. M12 is polish across everything. Within a
milestone, build in ticket order; each milestone ends green (gate + parity + its
acceptance demo) before the next begins.

## Honesty + encryption posture (the through-line)

Every content type is encrypted under the community group key and declares a
`syncPolicy` enforced both directions. Hosts and relays only ever hold ciphertext
addressed by ephemeral tokens. The single, deliberate, scoped exception is voice
media routing through an SFU, where audio stays end-to-end encrypted but the SFU
observes participation metadata; the product says so plainly. Nothing is shown as
working until it is, and history that depends on a host being online is labeled.
