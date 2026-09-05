# Meerkat Community Servers: Research, Review, and Recommended Onboarding Design

Date: 2026-08-31. Codebase: main at `6ed8ce97` (claims spot-verified against source). Inputs: three parallel research passes (Discord mechanics, federated-ecosystem server-choice UX, full Meerkat code map), with the two highest-stakes code claims re-verified directly by the lead.

HTML twin: `REPORT-meerkat-community-server-onboarding-2026-08-31.html`.

---

## Executive summary

**The problem you named:** communities today are local by default. They live on members' devices, sync peer-to-peer in manual sessions, and joining requires the owner's device to come online within a short relay-mailbox window. Nothing is "on a server" the way a Discord server is, and there is no smooth path onto one.

**The discovery that reframes everything:** the server you need already exists in the repo and is production-hardened. `packages/meerkat-relay/src/community-node.ts` (2,433 lines) is an always-on community node that stores a community's rolling snapshots and live tail as opaque ciphertext, gates pulls with per-member signed auth, and holds no keys and no plaintext, ever. Around it sit a multi-tenant hosted service with server-enforced storage caps (free 1 GB, starter 10 GB, community 100 GB, fleet 1 TB), Stripe billing scaffolding, a push gateway, a Postgres fleet deploy config, and even a double-clickable desktop self-host panel with honest reachability verification.

**It is orphaned.** No shipping client ever writes community content to it (the only client call is a descriptor-only republish for member removal). No community ever gets a host address (`hosts: []` at every `createCommunity` call site on both surfaces, so `communityNodeUrl()` is always null). The app's own honesty layer hardcodes the admission: `always_on_node: unavailable, "No always-on hosted community history is configured in this build."` The work is not "build a server." It is "wire the server that exists, then wrap it in Discord-grade onboarding."

**The recommended shape, in one sentence:** adopt the Minecraft Realms pattern. Exactly one person, the community creator, ever makes an infrastructure decision, once, on a single card with a safe default; every other member only ever experiences an invite link.

---

## Part A: Where Meerkat stands today (verified)

### A1. Built and waiting, server side

| Piece | What it does | Where |
|---|---|---|
| Always-on community node | Persists community snapshots + live tail as ciphertext; per-member signed auth; per-community piece scoping; descriptor revision monotonicity (a stale roster cannot re-grant a removed member after restart); per-device rate limits | `packages/meerkat-relay/src/community-node.ts`, routes in `community-node-http.ts:315-339` |
| Hosted multi-tenant service | Same seeder run once per tenant, isolated piece stores, enforced tier caps (1 GB / 10 GB / 100 GB / 1 TB), rolling30 or forever retention, "community exit" by re-signing the descriptor without the host | `src/hosted-node.ts` |
| Entitlement proof | Device-signed bearer (`<pubkey>.<expiry>.<sig>`), verified relay-side; error codes already defined | `src/hosted-auth.ts`, `src/protocol.ts:236-237` |
| Billing scaffolding | Stripe rail + RevenueCat receipt validation (fail-closed) | `src/hosted-api.ts`, `hosted-billing-stripe.ts`, `hosted-receipt-validator.ts` |
| Push gateway | APNs / FCM / WebPush with encrypted provider tokens | relay package |
| Self-host desktop panel | Supervises the real binaries; reports reachable only after a genuine off-host round-trip; withholds the connection card until verified | `packages/meerkat-relay/host/` |
| Fleet deploy config | Compose file with per-service Postgres roles and volumes; Fly per-region template; 19 migrations, ~26 stores (Plan 44 phases 0-7 code-complete) | `deploy/compose.production.yml`, `fly.toml` |

### A2. Built and waiting, client side

- **Pull path:** `pullCommunityFeed` exists and `refreshCommunityFeed` already tries the community node first, falling back to peers with the honest closed source set (`'community node' | 'peer' | 'no host reachable' | 'removed'`). `syncAutomaticCommunityHistory` does sealed-registry host discovery + atomic history commit, throttled, on both surfaces.
- **Invites already carry the server address slot.** A community invite embeds the whole signed descriptor, which includes `hosts: string[]` and `historyScope`. The wire format needs zero changes for a joiner to learn the community's server from the invite itself.
- **The server path is already exempt from the SAS ceremony.** P2P community sync requires SAS verification; the node pull path instead anchors trust in the epoch key plus per-message signatures. That asymmetry is an intentional affordance for exactly this feature.

### A3. The verified gaps (why it feels local-only today)

1. **No writer.** Nothing calls the node's `/publish` (with real snapshots) or `/append`. The node can serve history it is never given. (Verified: `feed-node-client.ts` exports only `pullCommunityFeed` and `republishCommunityDescriptor`.)
2. **No host address, ever.** All six `createCommunity` call sites across mobile and web omit `hosts`; there is no settings UI to add one. (Verified directly.)
3. **Epoch-key custody requires the owner's device online.** The node holds no keys by design, so a new member's read capability can only be minted by an owner (or admin) device. This is the one genuine design problem, not a wiring gap.
4. **The join window is a 5-minute in-memory mailbox** (24 h max via env, cleared on relay restart, 64 envelopes/token). A join handshake that straddles a restart is silently lost.
5. **Node self-announcement is a deferred cron**, so the client's working discovery path is starved.
6. **History import is expert-only** (paste manifest JSON by hand).
7. **Nothing is deployed** and `DEFAULT_RELAY_URL` is empty: a stock build has no out-of-box connectivity at all.
8. **The app never mints the hosted entitlement bearer**; `hosted-boundaries.ts` says so honestly.
9. **Identity-rail tension:** hosted auth keys off the device identity while Plan 51 walls the verification account away from it; the feature must pick a rail without ever putting an account identifier next to a device identifier.

### A4. Constraints any design must respect (non-negotiable)

- Security lives in the payload, never the channel; a hosted node is an untrusted transport. No plaintext, no epoch keys on any server. The node's roster knowledge is the one accepted, bounded exception.
- Scope rules fail closed (`device_local` default; `cm_publications` is the sole `published_blob` escalation); every synced table carries `id = rowId`.
- Honesty copy: no fake online states, no peer counts, no "available" claims without a real reachable host; every number from the engine or `sync_` tables. `lastPulledAt` only on a real successful pull.
- Plan 51 wall: no mk_ table, log, or request carries an account identifier next to a persona or device identifier.
- Pricing is founder-locked: app $4.99 one-time, hosted $4.99/mo with storage included. No new price points get invented by this design.

---

## Part B: What the ecosystem teaches

### B1. Discord (the experience bar)

- **Creation is naming a thing, not provisioning a server.** No region, capacity, or hosting choice is ever shown; sharding is invisible. Templates (45+ official) remove blank-canvas paralysis: one click yields channels, categories, and roles.
- **Invites:** per-channel links, default 24 h expiry and 100 uses, both editable to permanent/unlimited; vanity URLs are an earned upgrade. The critical move: an invite survives account creation. A brand-new user taps the link, signs up in-line, and lands inside the server with no separate accept step.
- **Onboarding is a funnel, not a welcome message:** rules screening (explicit agree before posting) → customization questions that double as a role picker and channel opt-in → a curated 3-5 channel default view → a Server Guide checklist of first tasks. Practitioner consensus: the "wall of channels" is the top driver of joined-but-never-posted, and the first-orientation step is the highest-leverage screen.
- **Discovery is an earned, continuously re-verified status** (1,000+ members, 8+ weeks old, activity re-checked), which keeps the directory from filling with dead servers.
- Adjacent: Slack pre-selects starting channels at invite time; Telegram proves one-tap join with zero screens is possible (at the cost of zero orientation); WhatsApp Communities structurally separate an announcement channel every member gets from opt-in sub-groups.

### B2. Federated ecosystems (the cautionary tales)

- **Mastodon is the on-record proof that server-choice-first onboarding kills conversion.** In May 2023 it demoted the server picker below a one-tap "join mastodon.social" default. Eugen Rochko's stated reason: potential users "bounce and never hear from them again" before experiencing the product, and "if we only attract people who already care about decentralization, our ability to make decentralization mainstream becomes that much harder."
- **Matrix/Element:** pre-filled matrix.org default plus a paid consumer product (Element Home) whose entire pitch is "your own server, zero ops." Self-hosting is sold as the upgrade path, never the entry path. Same pattern at masto.host ($6/mo managed Mastodon) and PikaPods.
- **Bluesky made federation invisible** by decoupling identity from infrastructure: everyone lands on the default PDS, and the "choose" moment users actually enjoy is a vanity domain handle, changeable any time, independent of where data lives. Mastodon and Matrix bake the server into your permanent handle, which is exactly why their choice feels high-stakes and their migrations hurt. **Meerkat already has this right**: identity is a device keypair, not a server name. Keep it that way in every UI string.
- **Nostr** (ideologically maximalist about choice) still converged on hardcoded default relay lists with the picker buried in advanced settings. **Farcaster** shows that when you cannot hide a resource, you can hide its cost (app-sponsored signers); and that fixing one leaky layer just exposes the next one, so after fixing server choice, audit whether pairing or friend codes become the new choose-your-server moment.
- **Mastodon's migration lesson:** an escape hatch that is technically present but lossy (followers-only transfers, 30-day cooldowns) teaches users to distrust the default. Meerkat's "community exit" (re-sign the descriptor without the host; the fired node keeps only ciphertext it cannot read) is already cleaner than anything in this list. Say so in the UI; portability is the anxiety-reducer that makes a default acceptable.

### B3. Minecraft Realms (the exact shape to copy)

Official managed hosting for a normally self-hostable game: the owner pays (from $3.99/mo), invited players pay nothing and never see server config, and joining is a shareable invite link or code redeemed in the client. One person's infrastructure decision covers the whole group; everyone else experiences a join code. That is precisely a Meerkat community with a hosted node.

### B4. Distilled design rules for Meerkat

1. Default to working infrastructure; never show a server picker on the happy path.
2. The community creator is the only human who ever sees an infrastructure choice, once, with a safe default and a visible-but-secondary escape hatch.
3. Keep the server out of identity. Names, friend codes, and handles never contain a host.
4. The invite link is the entire onboarding surface for everyone else; it must survive app install and account setup.
5. Sell self-hosting as the power-user upgrade (the desktop panel is already built for this), not the entry gate.
6. Make portability a stated promise backed by the already-built community-exit mechanics.
7. Curate the first-session view (templates, small default channel set, first-task guidance).
8. Gate public discoverability on sustained activity, not a one-time listing.
9. Where honesty forbids hiding a state (host unreachable, request waiting for owner), show the true state in plain words rather than a fake one.

---

## Part C: Recommended design

Working name for the always-on node in user-facing copy: **the Keeper**. "A Keeper is a server that keeps your community available while everyone's phones are asleep. It stores only sealed data it cannot read." (Name is a suggestion; the mechanics below do not depend on it.)

### C1. The one decision card (creation flow)

After naming the community and picking a template, the creator sees a single card, "Keep it available around the clock?", with three options:

1. **Meerkat Keeper (recommended)**: one tap, provisioned instantly on the hosted service under the existing hosted plan ($4.99/mo, storage included; tier caps already enforced server-side). Copy states plainly what the server can and cannot see.
2. **Run your own**: hands off to the existing desktop panel / compose deployment; the app accepts the panel's verified connection card. Powered by the already-built reachability honesty (a URL is a candidate until an off-host probe verifies it).
3. **Just our devices (default)**: today's behavior, with today's honest copy ("Available from members who have it, when a sync connects").

The choice is reversible in community settings via a new "Community server" section (add host = descriptor revision; remove = the already-designed community exit). Non-creators never see any of this.

### C2. Invites become the whole onboarding

The descriptor already rides inside the invite, so once `hosts` is populated, every invite automatically carries the server address. Build on that:

- **Invite preview sheet** (exists) gains an availability line derived honestly from the descriptor: "Always available via this community's server" vs "Available when members are online."
- **Discord-grade invite controls:** TTL (48 h default exists) plus max-use caps and revocation; permanent invites offered when a Keeper is attached (a permanent invite to an unhosted community would be a lie half the time).
- **Join funnel** (new user): tap link → store listing or web app → the invite fragment survives install/first-run (deferred deep link) → age gate → preview sheet → join → rules screening → land in the template's default channels with a 3-item first-task guide. Rules screening, default-channel curation, and the first-task checklist are the three Discord lessons worth building outright.

### C3. The asleep-owner problem (the one hard design decision)

The node holds no keys, so a late joiner's read capability must be minted by an owner or admin device. Three mechanisms, layered, all honest:

1. **Baseline, ship always: durable join queue + push wake.** Move join requests from the 5-minute in-memory relay mailbox to a durable, restart-surviving queue on the community node (it already legitimately knows the roster, and Plan 44 gave it Postgres). The existing push gateway wakes owner and admin devices: "Someone is asking to join Trail Crew." Owner opens the app; the grant flows over the existing handshake. Joiner-side copy is honest: "Your request is waiting for an organizer's device." This preserves pure key custody and fixes the silent-loss window.
2. **Delegation: admins can grant.** `verifyCommunityInvite` already validates admin inviters; extend grant-minting to admin devices so a community with three admins across time zones effectively answers in minutes. Pure custody, much better latency.
3. **Owner opt-in per invite: instant-join links.** For owners who want true Discord-speed joining, an invite variant that embeds a key-wrap to an ephemeral invite key, making the link itself a bearer read capability, scoped by `historyScope` (default `join_point`), TTL-bound and use-capped. The toggle copy states the tradeoff in plain words: "Anyone who gets this link can read the community without waiting for approval." This is the Realms code, expressed in Meerkat's sealing model. It is opt-in, per-invite, revocable (rotate epoch on abuse, which membership revocation already supports), and never the default.

### C4. Wiring workstreams

| # | Workstream | Anchors | Nature |
|---|---|---|---|
| W1 | Client writers: owner devices publish snapshots; member devices append sealed tail entries on send when a host is present | `feed-node-client.ts` (add publish/append), `community-core.ts` send path | Code |
| W2 | Host lifecycle UX: provision-on-create (hosted rail), accept connection card (self-host rail), "Community server" settings section, populate `descriptor.hosts`, exit flow | `createCommunity` call sites, community settings screens, `reviseCommunity` | Code |
| W3 | Entitlement + billing: mint the device-signed hosted bearer in-app; attach purchase via the existing unlock/Stripe rails; resolve the Plan 51 rail question (bearer stays on the device identity; the account service never learns which community) | `hosted-auth.ts`, `hosted-api.ts`, `account-core.ts` wall | Code + design note |
| W4 | Durable join queue on the node + push wake + admin delegation | `community-node.ts`, `join-handoff-mailbox.ts`, push gateway | Code |
| W5 | Discovery + defaults: run the announce cron; provision the first-party fleet; set `MEERKAT_DEFAULT_RELAY_URL` in builds | `announce()`, `fly.toml`, `app.config.ts:218` | Founder-ops + small code |
| W6 | Onboarding polish: template gallery surfacing (commit path exists), rules screening, curated default channels, first-task guide, invite use-caps/revocation | template-commit files, invite protocol, community screens | Code |
| W7 | Public directory growth: activity-gated listing for communities that opt into discoverability, built on the public directory node + The Commons | `public-directory-node.ts`, `commons-provisioning.ts` | Code, later |
| W8 | Instant-join invite variant (C3.3) with its consent copy and epoch-rotation revocation | invite + sealing protocol | Code, opt-in |

Priority order: **W1 + W2 + W5 make the feature exist** (a community can live on a server and a joiner can pull history). **W4 + W3 make joining smooth and payable.** **W6 + W8 + W7 make it delightful and growable.** Per the founder mandate these are sequencing waves of one full-function feature, not scope cuts; W8's opt-in nature is a security posture, not a deferral.

### C5. Honest state copy (every state the UI can show)

| State | Copy |
|---|---|
| Device-only community | "Available from members who have it, when a sync connects." |
| Keeper attached, probe verified | "Always available via this community's server." |
| Keeper attached, unreachable | "This community's server is not reachable right now. Content syncs from members when connected." |
| Join request parked | "Your request is waiting for an organizer's device to come online." |
| Instant-join link (owner side) | "Anyone who gets this link can read the community without waiting for approval." |
| Hosted not configured in build | Today's `hosted-boundaries.ts` copy stays until W5 lands. |

### C6. What not to build

- No server-side epoch keys outside the explicit, per-invite instant-join consent. No plaintext anywhere server-side, ever.
- No online-member counts, no green dots, no "N people here now" from the node (it could know connection counts; showing them would breach the honesty rule that numbers come from the engine or sync tables and would start an arms race the product's privacy story loses).
- No new prices, no per-tier price invention; the hosted plan is $4.99/mo with storage included, full stop.
- No server name in any identity string, friend code, or handle.

---

## Part D: Dependencies and open decisions for the founder

1. **Fleet provisioning is the gate for everything** (W5): deploy the community node + hosted service, set the default relay URL in builds, run the announce cron. Plan 44's remaining founder-ops evidence list applies.
2. **Billing wiring** (W3): Stripe live keys for the hosted rail; decide whether the hosted community plan is purchasable in-app on iOS (IAP rules) or web-only like other hosted tiers.
3. **Decide on C3.3 (instant-join links)**: recommended as an owner opt-in; if you want launch to stay maximally conservative, W4's durable queue + admin delegation alone already beats today's five-minute window by orders of magnitude.
4. **Naming**: "Keeper" vs plain "community server" in user copy.

## Sources

Primary (all verified in-repo): `packages/meerkat-relay/src/{community-node,community-node-http,hosted-node,hosted-auth,hosted-api,protocol,server,hub}.ts`, `packages/meerkat-relay/host/`, `deploy/compose.production.yml`, `packages/sync/src/protocol/{community,public-join,join-handoff-mailbox,inbound-policy}.ts`, `packages/sync/src/node/feed-node-client.ts`, `apps/meerkat/app/(root)/data/{community-core,hosted-boundaries,effective-relay,auto-connect-core,background-sync}.ts`, `apps/meerkat/app.config.ts`, `docs/designs/mesh-sync-architecture.md`, `docs/plans/queue/44-*.md`.

External (agent-gathered, key claims): Discord support docs on invites/onboarding/discovery via web search; TechCrunch on Mastodon's 2023 default-server change and Rochko's rationale; joinmastodon Server Covenant; Element Matrix Services and Element Home; Bluesky PDS self-hosting docs; nostr-ux.com on relay-choice UX; Farcaster Snapchain announcement; Minecraft Realms official pages; masto.host and PikaPods pricing pages. Flagged as unverified by the agents: exact mastodon.social user-share percentage, third-party Discord drop-off statistics, and third-party hosting price points, none of which are load-bearing for the recommendations.
