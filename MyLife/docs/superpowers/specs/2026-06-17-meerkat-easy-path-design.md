# Meerkat Easy Path: one-link join, no pairing, hosted-by-default relay

Date: 2026-06-17
Status: Design approved (verbal), spec under review
Owner: Trey
Scope: web client first (`apps/meerkat-web`), `@mylife/sync`, `@mylife/meerkat-relay`

## Problem

A non-technical person cannot currently join a Meerkat community and post such that
the organizer sees it without a chain of technical steps. On the web client the only
working community-message path is the pairwise device-pairing flow plus a manual relay
session: set a relay URL, copy/paste pairing payloads both directions, type a 16+ char
shared phrase, pick the peer device, then one side clicks Listen and the other Sync now,
re-run per batch. There is no default relay, no shareable join bundle, and standing up a
relay is a deploy-it-yourself task. The goal is a true user-friendly path: a friend taps
one link, types a name, and is in, with posts flowing both ways automatically.

## Decision

**Hosting model: hosted zero-knowledge relay + always-on community node as the default,
plus one-tap bring-your-own self-host.** The default makes onboarding instant; BYO keeps
the "run your own private relay" promise for those who want it. The relay/node never see
plaintext, identity, contacts, or community content (only sealed bytes addressed by opaque
one-time tokens), so a default Meerkat-operated server is consistent with the privacy
model as long as copy stays honest that it is zero-knowledge, not "no server at all."

## Current state (verified from source, 2026-06-17)

- **Pairing is mandatory for community messaging on web today**, enforced at the transport
  frame-envelope layer: an unpaired peer has no frame key and the session times out
  (`packages/sync/src/protocol/payload-security.ts` `resolvePairSharedSecret`;
  `packages/sync/src/protocol/sync-session.ts` frame-envelope key check). Community
  membership only authorizes inbound writes inside an already-handshaken paired session.
- **A real community-feed protocol exists on `main` (PR #17, commit `16d1ae3b`)** that does
  NOT use pairwise pairing: a community is a signed descriptor; confidentiality uses a
  per-community epoch group key (`packages/sync/src/.../group-keys.ts`,
  `createGroupCommit` mints a 32-byte secret wrapped per member via X25519/HKDF/secretbox);
  an always-on community node stores rolling snapshots + a live tail as ciphertext and
  gates access with per-member challenge-response signatures; members pull via
  `pullCommunityFeed` and decrypt locally.
- **Two gaps keep that easy path from closing on web, even on `main`:**
  1. **Web push is not wired.** `sendChannelMessage` only inserts the row and calls
     `engine.recordChange`; it never calls the node `/append` or `/publish`
     (`apps/meerkat-web/src/lib/MeerkatProvider.tsx`). PULL (`refreshFeed`) is wired.
  2. **Group-key handoff on invite-join is not wired.** The owner mints epoch 1 only for
     itself and never learns a joiner's `dhPublicKey` from `joinCommunityFromLink`, so a
     fresh joiner holds no epoch key and `pullCommunityFeed` returns `no_epoch_key`. PR #17
     explicitly lists this as the one honest open gap.
- **The rich web UI (onboarding modal + 3-column shell) is on `feature/meerkat-web-client`,
  which diverged before PR #17**, so the feed protocol files do not exist on that branch.
  The easy path needs the rich UI AND the feed protocol in one place.
- **Relay deploy onboarding (PR #18, `d2b57e4b`)** ships Render/Fly/Docker paths and an
  in-app chooser that links out to a GitHub guide; there is no in-app provisioning, no
  default relay, ~$7/mo for an always-on host, and the prebuilt image is not yet published.
- **The relay alone is not enough for async delivery:** it brokers only while two devices
  are online plus a ~5-minute in-memory mailbox. "Post now, friend sees later" requires the
  always-on community node.

## Target experience

**Member (the friend):** taps one join link/QR -> the app opens -> enters a display name
-> is in the community and can post. Others' posts appear automatically (auto-update on);
his posts appear on theirs. No pairing, no shared phrase, no manual Listen/Sync, no relay
URL entry.

**Organizer:** creates a community -> receives one shareable join link/QR that carries
`{app URL, relay+node URL, community invite}` -> shares it. A toggle offers "use my own
private relay" via a one-tap self-host that writes the resulting URL into the bundle.

## Architecture and components

Each unit below has a single purpose, a defined interface, and isolated dependencies.

1. **Hosted zero-knowledge infra (founder-ops + config).** A deployed Meerkat relay and an
   always-on community node (the durable feed). The node stores only ciphertext and gates
   by per-member signed auth; the relay brokers ciphertext. Both are zero-knowledge.
   Interface: a `wss://` relay URL and an `https://` node URL baked into the default join
   bundle. BYO replaces these with the organizer's own deployed URLs.

2. **Closed community-feed loop on web (code).** Three changes in `@mylife/sync` consumers
   and the web provider:
   - **Push on send:** `sendChannelMessage` additionally seals + signs the event and POSTs
     it to the community node `/append` (the client + protocol already exist in
     `@mylife/sync`; only the web call site is missing).
   - **Key handoff on join:** carry/relay the joiner's `dhPublicKey` so the owner runs
     `commitMemberAdd` and the joiner auto-receives the epoch group key (close
     `no_epoch_key`).
   - **Auto-update default on:** poll the node on a sane interval (>= 60s) so members see
     new posts without a manual Refresh. Pairwise pairing is not used on this path.

3. **Join bundle (code).** A single URL (hash-fragment payload) + QR encoding `{app URL,
   relay URL, node URL, signed community invite}`. On open, the app verifies the invite,
   auto-sets the relay/node, auto-joins the community, and shows only a name prompt.
   Interface: `buildJoinBundle(community, hosts)` -> URL/QR; `parseJoinBundle(url)` ->
   `{invite, relay, node}` consumed at first load.

4. **Simplified join UX (code).** A name-only entry screen when arriving via a join bundle,
   then straight into the channel. Reuses the existing onboarding identity creation.

5. **One-tap self-host (code + config).** The existing deploy chooser, extended so a
   completed deploy URL flows back into the join bundle builder. (Full in-app provisioning
   is out of scope for this cut; the chooser + paste-back is enough.)

## Data flow

- **Post:** member types -> `sendChannelMessage` seals event with the epoch content key,
  signs it, writes locally, and POSTs the sealed tail entry to node `/append` (outer author
  signature over ciphertext). -> Other members' auto-update poll pulls via `/challenge` ->
  `/manifest` -> opaque pieces -> decrypt locally with the epoch key -> inner
  `verifyChannelMessage` -> merged into the channel. Fail-closed: bad signature / wrong
  member / undecryptable is dropped, nothing written, no fake delivery claimed.
- **Join:** member opens bundle -> verify invite -> auto-set relay/node -> `joinFromLink`
  (roster membership) -> joiner `dhPublicKey` reaches the owner -> owner `commitMemberAdd`
  wraps the epoch key for the joiner -> joiner drains the wrapped key -> can now decrypt the
  feed and append.

## Phased build plan

- **Phase 0 - Reconcile branches.** Get the rich UI and the feed protocol into one branch
  (merge `main` into `feature/meerkat-web-client`, or land the rich-UI slices onto `main`
  first). Gates everything; highest conflict risk in `apps/meerkat-web`. Lock the approach
  in eng review.
- **Phase 1 - Close the loop (code, locally verifiable).** Wire push + key handoff +
  auto-update default. Verify the full "friend posts -> organizer sees it, no pairing" loop
  against a community node run locally. No production infra required to prove correctness.
- **Phase 2 - One-link join (code).** Join bundle encode/decode, auto-configure-on-open,
  name-only join screen.
- **Phase 3 - Hosted infra (founder-ops + config).** Deploy the zero-knowledge relay +
  community node, publish the prebuilt image, point the default bundle at the hosted URLs,
  finish the BYO paste-back. Code/config by me; the always-on servers and accounts/billing
  are Trey's.

## Error handling and honesty

- Fail-closed everywhere: undecryptable / unauthorized / unverifiable entries are dropped
  and counted, never written, never surfaced as delivered.
- No fabricated status: no "connected", peer counts, or "delivered"/"read". Feed state
  shows honest sources ("community node" | "no host reachable"), and `lastPulledAt` is set
  only on a real pull.
- Copy must say zero-knowledge relay/node, not "no server". The relay/node see only
  ciphertext, sizes, and timing, plus (node only) which member pulled (accepted tradeoff).

## Testing

- Node e2e for the closed loop: two browser-adapter nodes + a locally-run community node;
  member A appends a sealed post, member B pulls and decrypts and verifies it (extends the
  existing `web-node-relay-e2e` harness).
- Key-handoff test: a fresh joiner with no epoch key joins via bundle, receives the wrapped
  key, and successfully pulls (no `no_epoch_key`).
- Join-bundle round-trip unit tests: build -> parse -> auto-config applies relay/node/invite.
- Manual: friend on a second machine taps the bundle, types a name, posts; organizer sees
  it via auto-update (the original acceptance test), first locally then on hosted infra.

## Out of scope (YAGNI for this cut)

Mobile parity, moderation/roles UI, multi-region infra, full in-app relay provisioning
(deploy chooser + paste-back only), descriptor (new-channel) auto-sync.

## Open items / founder-ops

- Branch reconciliation approach (Phase 0) to be locked in the implementation plan.
- Hosted relay + community node deployment, image publish, domain/TLS, and cost are Trey's
  cloud accounts; I provide all config and a walkthrough.
- Whether the default hosted node is single-tenant per community or shared multi-tenant
  (shared is fine; it only holds ciphertext) - confirm during Phase 3.
