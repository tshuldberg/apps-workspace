# Meerkat Network v2: Encrypted Sync, Communities, and the Private Overlay

Status: Historical design draft from 2026-06-10. Companion to `mesh-sync-architecture.md` (v1 canon, still authoritative for scopes/policy). The superseded visual review remains in git history. Use `docs/README.md` and `docs/reports/README.md` for current execution and launch sources.

## 1. Verdict

The vision (localized encrypted storage, ranked-choice device-to-device communication, friend codes, community hosting by storage-rich members, evolving toward a private overlay) is VALID and substantially pre-built at the brain layer. The repo already contains: a real Ed25519 mutual-auth session protocol, outbound scope/policy enforcement across all 40 modules, a complete torrent math layer (manifests, Merkle roots, rarest-first, seeding policies, 177 tests), blob content addressing, the `community` workspace type, and the `published_blob` scope. What does not exist: any real transport (all mocks), any group key (literal `'<placeholder>'`), inbound policy enforcement, durable key storage in the hub, and any server software (relay, tracker, rendezvous). v2 is therefore a connection + trust + community program, not a rewrite.

Two physics constraints reshape the vision rather than kill it:
- Phones cannot seed. iOS suspends networking minutes after backgrounding; Android FGS dataSync caps at 6h/24h and OEM killers break promises. Seeders are desktop/NAS/always-on nodes ("Meerkat Node"); phones are foreground peers with opportunistic cache.
- Pure P2P loses; relay-first wins. Measured hole-punch success is 70% (libp2p, 4.4M attempts) to ~90% (iroh). The encrypted relay becomes the instant default rung with direct upgrade in the background, exactly like Tailscale DERP and iroh. Ranked choice survives as user sovereignty over which rungs are allowed and preferred.

"Internet 2.0" reframe: not a new address space (that graveyard is full: cjdns, Yggdrasil, GNUnet). It is an app-first private overlay: a useful product that happens to carry a federated, encrypted network underneath, which can later open its relay pool and protocol. Apps recruit users; networks do not.

## 2. Decision log

| # | Decision | Alternatives rejected | Why |
|---|----------|----------------------|-----|
| D1 | Relay-first, upgrade-to-direct connection lifecycle; default ladder order becomes Relay -> LAN -> Direct(QUIC/WebRTC) -> Nearby, with BLE wake-up orthogonal | v1 LAN-first ladder | Eliminates "connecting..." UX; matches DERP/iroh evidence; LAN still wins on same Wi-Fi via background upgrade within seconds |
| D2 | Keep ranked-choice transport preferences (user-sovereign allow/deny + ranking), defaults reordered per D1, honesty labels in UI | Removing the feature | It is the product's signature; only the defaults were wrong |
| D3 | Group crypto = MLS (RFC 9420, OpenMLS) for workspace/community keys; per-device leaves | Hand-rolled group key wrap; Signal sender-keys | Industry converged (Wire, Webex, Discord DAVE, RCS UP 3.0); multi-device falls out free; fixes the placeholder workspace key correctly once |
| D4 | Rust core strategy: spike iroh (+ iroh-blobs, BLAKE3) behind a UniFFI Turbo Module shared by mobile and the desktop node; ADOPT/REJECT gate after a 2-week POC | Hand-rolled NAT traversal; libp2p; Veilid | Delta Chat ships iroh on iOS/Android in production; ~90% direct; stateless self-hostable relays; libp2p has no production RN story; Veilid is pre-1.0 with one demo app |
| D5 | M0 ships real bytes BEFORE the Rust bet: TypeScript WS relay server (existing token contract) + LAN via react-native-tcp-socket + react-native-zeroconf + LWW document manager on native | Waiting for iroh core | Momentum + de-risk; the WS relay is reused later as rendezvous/push bridge regardless |
| D6 | Seeders are desktop/NAS nodes; phones never advertised as hosts; optional "host while plugged in, screen on" party mode only | Phone seeding | Platform physics (see Section 1); honesty beats churned promises |
| D7 | Friend codes: `MEER-XXXX-XXXX-XXXX` (base32, 8B rendezvous id + 2B checksum) resolving via rendezvous to a SIGNED identity bundle; QR carries the full bundle in person; mutual approval always; SAS emoji verification nudged, REQUIRED before `shared_workspace` for `isSensitive` modules (existing CLAUDE.md rule) | Raw pubkey strings; PIN-only codes | Human-shareable, checksummed, offline-capable via QR, and binds DH to Ed25519 identity (closes the pairing MITM gap) |
| D8 | Community = workspace(type community) + MLS group + signed CommunityDescriptor {id, name, hosts[], catalog CID, join policy, quotas} + invite links/codes only (no public directory in v1) | Public discovery feed | Legal posture (no LibGen pattern), Keet/NIP-29 evidence; descriptor portability gives exit rights from any host |
| D9 | Seeding incentives: non-token "Host Credits" (healthy node uptime -> Meerkat Pro free + community quota multiplier); rarest-first replica placement; soft ratio accounting, never hard enforcement | Tokens (Filecoin/Storj path); hard private-tracker ratios | Token economies decayed (Filecoin 30% utilization Q1 2025); hard ratios punish low-bandwidth users; perks cost ~$0 marginal |
| D10 | Abuse/legal rails in protocol: (1) client-side hash matching ONLY at the publish boundary (published_blob/community-public) pre-encryption, never private scopes; (2) reporter-side plaintext reporting (WhatsApp model); (3) kill switch at discovery/relay layer only; (4) relays ciphertext-only, token-addressed, no logs; (5) per-entity keys so crypto-shredding satisfies erasure; clean-hands marketing, no seizure-wipe framing | Scanning everything; scanning nothing | Defensible middle path consistent with 18 USC 2258A, DSA mere-conduit, DMCA 512; EncroChat/Sky ECC died on purpose+marketing, not on encryption |
| D11 | Key recovery: multi-device replicas primary (the desktop node doubles as the always-on key holder), printable high-entropy recovery key canonical, SVR-style PIN+enclave escrow at M5+, recovery contacts later; server never readable | Seed-phrase-only; readable cloud backup | WhatsApp/Signal proved the UX at scale; SSB died partly on single-device identity |
| D12 | VPN: defer to a later "Everything" tier (~$12.99) gated on >20-30k subscribers; white-label first; NetworkExtension competence arrives earlier via relay/push work | Launching VPN now | $3-5/user COGS kills margin at small scale; Play verified-badge regime favors incumbents; distraction from the wedge |
| D13 | Hosted Nodes (founder, 2026-06-10): rentable zero-knowledge server space on Meerkat metal running the identical node binary; usable for seeding, community hosting, mailbox, backup; transparent cost-plus pricing (proposed cost + 25%) with a published live ledger of raw cost vs our take; protocol-only (never public HTTP); communities can fire us by re-signing descriptors | Generic VPS product; opaque SaaS-margin pricing | Closes the always-on-host gap for hardware-less members; first infra revenue line (before VPN); preserves zero-knowledge + DMCA 512(c)/DSA hosting safe-harbor posture; precedents: Element Matrix Services, Nostr paid relays, Mullvad pricing honesty |
| D14 | Communities get the Discord shape: channels (scoped entity streams on existing or_set/document CRDT primitives), roles as descriptor-level grants enforced by MLS membership + signed changes, member lists | Flat single-stream communities; Matrix-style replicated room state | Matches how groups organize; reuses shipped primitives; avoids server-side state resolution entirely |

## 3. Layered architecture

- L0 Device + Identity: Ed25519/X25519 device keys in SecureStore on every app (hub fix required; today only BestChef configures a secret store and the default is an in-memory Map). Portable user identity = signed account doc binding multiple device keys. Recovery per D11.
- L1 Trust: friend codes + QR bundles (D7); SAS verification; Syncthing-style introducer so a workspace admin transitively introduces members (pair once per workspace, not N times); expiring `meerkat://` invite links (Keet pattern); revocation records signed and gossiped, CHECKED IN HANDSHAKE (today only shareEntity checks).
- L2 Sessions + Crypto: keep the real handshake; wire the existing dead NoiseHandshake for forward secrecy; replace `SHA512(secret||info)` KDF with HKDF; add replay windows (nonce cache + timestamp skew); sign individual changes (authorship within multi-member workspaces); MLS group keys for workspaces (D3); enforce scope/maxScope/ACL/membership + tombstones on the INBOUND apply path (today: zero checks); write receipts and only mark changes synced per-peer on ack (today: global markSynced after one session).
- L3 Transports: rung order per D1. Implementations: Relay = M0 TS WS server then iroh relays after D4 gate; LAN = zeroconf + tcp-socket (shippable now); Direct = iroh QUIC (post-gate) with WebRTC fallback (transport exists, needs react-native-webrtc + signaling server); BLE = wake-up only, payload redesigned to fit 31B advertisement (hash, not JSON); Multipeer/Wi-Fi-Direct deferred (foreground-only niche, no maintained cross-platform lib).
- L4 Replication: change log + LWW everywhere; Automerge on native via LwwDocumentManager shim short-term, Automerge-on-Hermes or Rust CRDT evaluation at D4 gate; blobs move to BLAKE3 content addressing (iroh-blobs post-gate; expo-crypto SHA-256 interim) with BLOB_REQUEST/BLOB_DATA actually wired (opcodes reserved today, zero senders); sliding-window sync (UI-visible first).
- L5 Communities + Seeding: CommunityDescriptor (D8) with channels/roles/member lists inside (D14); catalog = manifest list (torrent/ manifest.ts reused nearly as-is); hosts are member-run Meerkat Nodes (desktop/NAS) or rented Hosted Nodes (D13), identical binary either way, with rarest-first placement (piece-manager.ts logic reused) and SeedingPolicy enforcement (torrent_seeding_policy schema exists); personal mailbox mode (Briar pattern): your node buffers for your devices and friends.
- L6 Services (Meerkat Inc.): relay fleet (5-10 first-party floor, community pool with auto-join later, Syncthing strelaysrv pattern); rendezvous/directory (friend-code resolution, community descriptors, takedown surface per D10); Hosted Node rentals at transparent cost-plus with published ledger (D13, MK-041/042); push wake bridge (PushRelayClient stub becomes real); escrow service (M5+); VPN later (D12).
- L7 Trajectory: household -> friends -> communities -> federated relay pool -> published protocol spec. Success metric per stage before advancing.

## 4. Security remediation map (gates new surface area)

| Gap (verified file:line) | Fix | Milestone |
|---|---|---|
| Inbound apply has no scope/ACL/membership/tombstone checks (sync-session.ts:282-323) | Enforce policy table on apply; reject + audit | M0 |
| Workspace key is `'<placeholder>'` (pairing.ts:144); key-wrap table unused | MLS groups (D3); interim: real X25519 key wrap per member | M2 interim, M3 MLS |
| Pairing unauthenticated (pairing.ts:46-165) | Signed bundles + SAS verification (D7) | M2 |
| Hub secret store = in-memory Map (sync-secret-store.ts:32; apps/mobile never configures) | expo-secure-store everywhere + migration | M0 |
| markSynced without acks (sync-session.ts:509-518); receipts unused | Per-peer receipts; outbox per peer | M1 |
| No replay protection (message-codec.ts:68-87) | Nonce window + timestamp validation | M1 |
| Revocation unchecked in handshake (handshake.ts:101,161) | isRevoked in handshake; signed revocation gossip | M2 |
| Nonstandard KDF (keys.ts:49-75) | HKDF-SHA256 | M1 |
| No forward secrecy (NoiseHandshake dead code) | Wire Noise ephemeral handshake | M1 |
| Legacy P2PProvider plaintext + SQL interpolation (p2p.ts:126-131, changeset.ts:74-116) | Delete the legacy path | M0 |
| Native CRDT throws (document-manager.native.ts:24) | LwwDocumentManager native impl | M0 |
| Torrent/blob Node-only crypto/fs | expo-crypto/file-system adapters; BLAKE3 in Rust core later | M4 |

## 5. Open questions for founder

1. Brand the desktop node ("Meerkat Node"? "Den"?) and is macOS-first acceptable (your future SwiftUI app is the natural carrier)?
2. Rust appetite: hire/contract or self-build the UniFFI core after the spike?
3. Bellwether community for M5 dogfood (the BestChef cooking community? a private friends-and-family space?).
4. EU/UK launch posture: hold community features in those markets until CSAR trilogue (~July 2026) and UK s.121 report resolve, or geo-fence later?
5. Money shape: Meerkat Pro at $7.99 or $9.99? Host Credits = free Pro acceptable as the self-host seeder deal? Hosted Node markup: cost + 25% with published ledger, or flat platform fee + cost passthrough?

## 6. Sources

Synthesis of four research passes (2026-06-10): repo history/canon, sync package reality audit, P2P prior art (Syncthing, Briar, SSB, Veilid, IPFS/Filecoin, BitTorrent, Hypercore/Keet, Matrix, Nostr, libp2p, Iroh, Tailscale, overlay graveyard, MLS), and platform/legal/business rails. Full citations embedded in the HTML report.
