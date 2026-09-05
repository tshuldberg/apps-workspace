# Meerkat Network Deep Dive - 2026-06-10

Autonomous research + architecture session on `feature/manhattan-scaffold`. Founder asked for a full-depth exploration of the core feature: localized encrypted storage + ranked-choice encrypted device communication, evolving into friend codes, user-hosted encrypted communities with torrent-style seeding, and an eventual private overlay ("Internet 2.0"), delivered as an HTML deep-dive (opened in browser at session end) plus a task plan to execute one at a time.

## Deliverables
- `docs/reports/REPORT-meerkat-network-deep-dive-2026-06-10.html` (91 KB, self-contained, opened for founder). 12 sections: vision translation, git archaeology, line-by-line reality audit, 14-system prior-art atlas, platform physics, the v2 layered architecture (layer stack, relay-first ladder, friend-code flow with emoji SAS, community/seeding topology SVG, crypto repair map), legal rails, business rails, 12-decision log, 40-task roadmap board, founder questions, method. Animated canvas mesh hero (phones/hosts/relays with traveling packets), reduced-motion safe. Render-verified headless (favicon 404 only).
- `docs/designs/meerkat-network-v2-architecture.md`: decisions D1-D12, layer model L0-L7, security remediation map, founder questions. DRAFT, uncommitted per brainstorming gate.
- `docs/plans/queue/14-meerkat-network-v2-mission-control.md`: milestones M0-M6, tasks MK-001..MK-040 with sizes/deps/acceptance criteria, validation rig, risks.

## Method
Brainstorming skill adapted to autonomous mode (approval gate routed through the HTML per founder instruction). Four parallel research agents: (1) repo historian (13 sync commits, both canon docs, plan 08, 40-module policy rollout); (2) packages/sync reality auditor (16 subsystems REAL/PARTIAL/MOCK with file:line, end-to-end trace, crypto review, torrent/blob/signaling deep-dive, make-it-real map); (3) P2P prior art with citations (Syncthing, Briar, SSB, Veilid, IPFS/Filecoin, BitTorrent, Hypercore/Keet, Matrix, Nostr, libp2p, iroh, Tailscale, overlay graveyard, MLS); (4) platform/legal/business rails (iOS/Android background truth, RN lib status, store policy, US/EU/UK mid-2026 state, VPN economics, recovery UX).

## Headline findings
- Two birth events: the torrent layer (10 files, 177 tests, manifests/Merkle/rarest-first/web-seed/magnet links) landed 2026-03-14 and sat dormant; all 8 mesh phases landed in 67 minutes on 2026-04-22 against simulated backends.
- Reality: zero real bytes ever moved (every transport send() mocked); workspace key is literally '<placeholder>' (pairing.ts:144); inbound apply has no scope/ACL checks; hub secret store is an in-memory Map; Automerge throws on Hermes; ACL/tombstone/receipt tables have zero production callers; ranked-choice dialing logic IS real.
- Field verdicts: relay-first wins (hole punch measures 70-90%); identity must be multi-device (SSB died on this); MLS is the 2026 group-crypto standard (Wire/Webex/Discord/RCS ship it); non-token seeding works (private trackers), token seeding decayed (Filecoin 30% utilization); phones cannot seed (iOS suspension, Android FGS caps); apps recruit users, networks do not.
- Strategy: D1-D12 locked pending founder veto. Relay-first ladder with ranked choice preserved as sovereignty; friend codes MEER-XXXX-XXXX-XXXX + QR + emoji SAS + introducer; MLS group keys; iroh-in-Rust-core gated bet (Delta Chat precedent) with M0 TypeScript relay+LAN shipping real bytes first; desktop Meerkat Node as seeder; Host Credits not tokens; 5 legal rules as protocol features; VPN deferred to 20-30k subs.

## Files changed
- Created: the three deliverables above + this log. memory.md session row added. No source code changed; nothing committed (founder reviews first).

## Addendum (same session, founder direction)
Founder added: purchasable "Server" space (use for seeding or any community purpose), Discord-style communities hosted by individuals on our servers or their own, transparent near-cost + small published markup as a revenue source. Folded in as D13 (Hosted Nodes: identical zero-knowledge node binary on Meerkat metal, protocol-only, cost + 25% proposed with a published live ledger, communities can fire us via descriptor re-sign; precedents Element Matrix Services / Nostr paid relays / Mullvad honesty) and D14 (channels + roles inside the descriptor via existing CRDT primitives + MLS authz, no Matrix-style room state). New tasks MK-041 (Hosted Nodes MVP), MK-042 (transparent pricing ledger), MK-043 (channels/roles); plan now 43 tasks, decisions now 14. HTML updated (99.6 KB: vision row, hero tile, physics banner, L5/L6, topology hosted-node element, legal hosting addendum, business pricing panel with illustrative tier table, D13/D14 cards, roadmap counts, Ask 5) and reopened; design doc + plan 14 updated to match. Legal note: hosting makes us a 512(c)/DSA hosting provider for ciphertext; safe-harbor posture documented, counsel review gated before MK-041 ships.

## Next
- Founder reviews HTML + answers the 5 questions (node name, Rust appetite, bellwether community, EU/UK posture, money shape incl. Hosted Node markup).
- On approval: move plan 14 queue -> active and start MK-001 (hub secret store), then one task at a time. M0 exit demo: a note synced phone-to-phone over LAN and relay.
