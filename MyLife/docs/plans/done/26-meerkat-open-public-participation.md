# Feature Spec: Open Public Participation (Posting Policies + Consumer Public Feed)

## Superseded and Absorbed (2026-07-06): Plan 39 Track B

Founder decision 2026-07-06: this plan's scope is absorbed verbatim into `docs/plans/done/39-meerkat-public-base-feed.md` as Track B (P4 postPolicy, P5 public-post protocol, P6 submit route, P7 humanity middleware completion), with one policy change: NC-2 and AC-6 below are REVERSED for the public tier (viewing now requires a humanity-verified account session on first-party surfaces). Execute this scope through Plan 39, not this file.

## Reconciliation Status (2026-07-07)

Status: Done as superseded scope, not an independent active plan. Moved from
`docs/plans/queue/` to `docs/plans/done/` because Plan 39 implemented the codeable
Track B work against the updated founder policy. This file is retained as historical
context only. Do not execute it directly.

> Meerkat launch plan 26. Turns the read-only public layer (Plan 19) into a participatory
> one: every public community carries an owner-configurable POSTING policy
> (`view_only` / `approval` / `open`), open-mode posts flow as node-mediated signed public
> events (no epoch key required), bans are real (Plan 28), every participant is a
> verified human (Plan 24), and the reader becomes a consumer-grade feed (follows,
> media-first cards, infinite scroll). This is the Instagram/X/Reddit-replacement surface
> of the founder's internet-layer vision: post to first-party public servers, or make
> your own server public and let others post there.

## Metadata

- **Surfaces:** `packages/sync`, `packages/meerkat-relay` (community node),
  `apps/meerkat`, `apps/meerkat-web`, `scripts/check-meerkat-parity.mjs`
- **Priority Score:** 47 / 50 (A-Tier). The consumer growth surface; free viewing without
  participation is a museum, not a network.
- **Estimated CC Time:** 9-12 focused sessions.
- **Depends On (hard):**
  - Plan 19 FF3 close-out (owner-side public-join auto-approve wiring; the approval mode
    IS that path plus policy semantics). Spec: Plan 19 Status Delta items 1-5.
  - Plan 24 (humanity tokens gate joins and open posting; seam: `requireHumanityToken`).
  - Plan 28 (real bans: roster removal + grant rotation; open mode is unshippable without
    a working ban).
- **Depends On (founder-ops):** deployed relay + community node + directory (runbook
  section 2); the whole public layer stays honestly hidden until then.
- **Blocks:** Plan 23 B.3 store listing copy; launch (everything gates launch,
  founder decision 2026-07-01).

---

## The trust-model decision this plan encodes (locked, stated honestly in-app)

The zero-knowledge boundary means no server can mint epoch keys: full membership
(descriptor entry + epoch wrap) requires an online owner/admin committer
(`join-handoff-core.ts:185-317`), which is exactly what APPROVAL mode uses. OPEN mode
(post immediately, no approval) therefore cannot ride the epoch path. Instead:

- Open-mode posts are PUBLIC SIGNED EVENTS: authored and Ed25519-signed by the poster's
  device key, submitted directly to the community's serving node, which verifies
  (a) the poster's redeemed public-join roster standing, (b) a valid humanity token
  (Plan 24 redeem), (c) rate/size caps, then countersigns an acceptance receipt and
  appends the event to the served warm tail.
- Readers verify BOTH signatures (author + serving node) per event, fail-closed, on top
  of the existing per-event verification in `fetchPublicPage`.
- The honest trust label for open-mode communities: authorship and integrity are
  cryptographically verified end-to-end; WHO MAY POST is enforced by the hosting node
  (like Reddit/X), not by end-to-end key possession (unlike private communities). The
  reader UI states this in the community info sheet. Nothing pretends otherwise.
- Content in an open-mode public channel is public by definition; there is no
  confidentiality claim to lose (the public snapshot seal key is already derived from
  public data, `public-snapshot.ts:77-79`).

## Current-State Grounding (verified 2026-07-01)

| Fact | Anchor |
|------|--------|
| `PublicationDescriptor` + conditional-append field pattern (`publicJoin`, `rights`) | `packages/sync/src/protocol/publication.ts:89-137,193-203` |
| `joinPolicy: 'request' | 'open'`; grant confers roster row, ZERO keys | `publication.ts:67,116`; `public-join.ts:50-82` |
| Request path (joiner done; owner auto-approve = Plan 19 FF3 close-out) | `public-join.ts:156-247`; `public-join-client.ts:72` |
| Posting gate for members (approval mode) | `community.ts:373-386` `evaluateChannelPost`; `CommunityChannel.postRoles` (`community.ts:48-52`) |
| Full-membership mint requires online committer | `join-handoff-core.ts:185-317` |
| Node serving + warm tail + per-event verify | `community-node.ts:1017-1106` register, `:1273-1339` page; `community-node-http.ts:459-478` |
| Snapshot rebuild is on-demand (freshness constraint for approval mode) | `community-snapshots.ts:313,348+` |
| Public reports + owner queue + caps + per-IP limiter | `community-node.ts:1135-1200,392-398`; `public-read-limiter.ts:44-185` |
| Per-device action rate limits (token bucket) | `community-node.ts:459-487,644-661` |
| Reader paging + cursor | `fetchPublicPage`; `cm_public_feed_cursor` (device_local) |
| Humanity gate template | Plan 24 `requireHumanityToken` (clone of `community-node-http.ts:502-531`) |

### Net-new (this plan builds)

1. `postPolicy: 'view_only' | 'approval' | 'open'` on `PublicationDescriptor`
   (conditional-append, signature-covered, ABSENT = `view_only` fail-closed).
2. `protocol/public-post.ts`: `PublicPostEvent` (channel-message-shaped, domain
   `meerkat-public-post-v1`), `signPublicPost` / `verifyPublicPost`, node acceptance
   receipt `{ nodeDeviceId, eventHash, acceptedAt, sig }` + `verifyPostAcceptance`.
3. Community node: `POST /public/{publicationId}/{channelId}/submit` (roster check +
   humanity redeem + caps + countersign + append to warm tail + tombstone support);
   node keypair for receipts (persisted in DATA_DIR).
4. Reader: verify author + receipt per event; open-mode trust label; composer for
   verified-joined users; approval-mode "Request to post" CTA riding FF3.
5. Owner surface: policy picker in PublishSheet (3 modes + explanation), moderation:
   remove post (owner-signed tombstone honored by node + readers), ban (Plan 28 removal
   + `grantId` rotation via `revisePublication`).
6. Publish freshness: node-triggered snapshot/warm-tail append on accepted posts (open
   mode is instant by construction); approval-mode member posts reach the public tail via
   the existing owner republish plus a new auto-republish trigger (rate-limited against
   `publishPerWindow`).
7. Consumer feed: follows (device-local `cm_public_follows` + per-pub cursor), unified
   Discover feed of followed publications, media-first cards, infinite scroll on
   `fetchPublicPage`, pull-to-refresh. Both surfaces.

## Policy semantics (locked)

| Mode | Join | Post | Enforced by |
|------|------|------|-------------|
| `view_only` | No join affordance (no `publicJoin` grant) | Nobody but members via private path | Descriptor absence, fail-closed |
| `approval` | `joinPolicy:'request'` -> FF3 park -> owner approves -> FULL member (descriptor + epoch wrap) | `evaluateChannelPost` via `postRoles` | End-to-end (owner-signed roster) |
| `open` | `joinPolicy:'open'` grant + humanity token -> roster row | Immediate via node-mediated signed public posts | Node (roster + humanity + caps) + dual signatures, labeled honestly |

Owner can change modes via `revisePublication` (signed, monotonic); tightening from
`open` rotates `grantId` (existing revoke lever) and the node stops accepting submits at
the new revision.

## Phases

- **P0 policy protocol:** `postPolicy` field + canonical append + verify + tests
  (absent = view_only; signature covers it; revision transitions; unknown value fails to
  view_only).
- **P1 approval mode end-to-end:** consume Plan 19 FF3 close-out; wire `postRoles`
  defaults per mode; auto-republish trigger after owner approval and on member-post
  arrival at the owner device (rate-limited); e2e: request -> approve -> member posts ->
  second device reads it publicly.
- **P2 public-post protocol:** `public-post.ts` + tests (sign/verify, domain separation
  vs channel-message + DM + humanity domains, receipt verify, tombstone event).
- **P3 node submit route:** roster + humanity + caps + countersign + warm-tail append +
  tombstones + `grantId`-rotation cutoff; node keypair persistence; integration tests
  (unjoined submit rejected; spent humanity token rejected; caps enforced; accepted post
  appears on the page route with a valid receipt; tombstoned post disappears).
- **P4 reader + composer (mobile):** dual-signature verify in the page client; open-mode
  composer + join CTA by mode; trust label; approval-mode request CTA; owner moderation
  UI (remove post, ban member); PublishSheet policy picker.
- **P5 web parity + parity guards.**
- **P6 consumer feed:** follows + unified followed-feed + media-first cards + infinite
  scroll + pull-to-refresh, both surfaces; `cm_public_follows` with explicit device_local
  sync-policy rule (C1 fail-closed convention).
- **P7 abuse hardening:** per-member submit caps, per-publication flood caps, report
  path on open posts (reuses `cm_public_reports`), owner kill-switch (mode ->
  view_only in one action), red-team tests (forged receipt, replayed post, banned
  member resubmit, node substitution rejected by receipt key pinning in the descriptor).

## Acceptance Criteria

- AC-1: An owner publishes a community `open`; a stranger on another device joins in two
  taps (verify humanity once) and their post is visible to an anonymous reader within
  seconds, with BOTH signatures verified client-side.
- AC-2: `approval` mode yields real membership; approved members' posts reach public
  readers without manual owner republish action.
- AC-3: `view_only` shows no join or post affordance anywhere.
- AC-4: A banned open-mode member (Plan 28 removal + grant rotation) cannot submit and
  their pending grant is dead; existing posts removable by owner tombstone.
- AC-5: The open-mode trust label is present and accurate; private communities' E2E
  claims are untouched.
- AC-6: ~~Anonymous reading remains free and untracked (no humanity token required to READ; negative test).~~ REVERSED by founder decision 2026-07-06 (Plan 39): first-party reads require a verified session (AC-1 in Plan 39); self-hosted third-party nodes labeled honestly (NC-P4).
- AC-7: Follows + feed work offline against cached pages; honest staleness copy.
- AC-8: All caps enforced server-side; a flood from one member never evicts others'
  posts.

## Negative Criteria

- NC-1: Never imply open-mode posts are E2E-membership-verified; never remove the trust
  label.
- NC-2: ~~Never require verification or an account to VIEW public content.~~ REVERSED by founder decision 2026-07-06 (Plan 39 verify-to-view). See NC-P1..NC-P6 in Plan 39.
- NC-3: Never fabricate a post's acceptance; composer shows sent only on a real receipt.
- NC-4: No new crypto beyond existing Ed25519 wrappers; the node keypair uses the same
  primitives.
- NC-5: `cm_public_follows` and cursors never replicate (device_local, guarded).

## Test Plan

Tier A: protocol pure tests (P0/P2). Tier B: node integration (P3) + approval e2e (P1).
Tier C: app/vitest reader/composer/moderation states + parity twins + view-only
negatives. Tier D (founder QA, needs deployed node): cross-device open-post demo,
ban demo, follows feed on real data.

## Founder-Ops

Deployed relay + community node + directory (runbook section 2); Plan 24 service
deployed; store UGC policy review before launch (runbook 4.8). Everything else codeable.

## Status Delta (2026-07-04)

- Spec current; zero code built as of 2026-07-04.
- Sequenced by docs/plans/done/37-meerkat-launch-completion-mission-control.md (authored 2026-07-04).
