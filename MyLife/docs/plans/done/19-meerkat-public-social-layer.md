# Plan 19 — Meerkat Public Social Layer (free-to-view channels / communities / forums + discovery)

> Buildable implementation plan for founder review and later execution.
> Surfaces: `apps/meerkat` (Expo Router mobile), `apps/meerkat-web` (Vite React SPA), `packages/sync` (@mylife/sync engine), `packages/meerkat-relay` (@mylife/meerkat-relay infra), `packages/ui` (shared primitives).
> Theme: Open Burrow tokens (warm-paper light / sea-green dark). This plan is NOT the theme system; it consumes it.

---

## Reconciliation Status (2026-07-07)

Status: Done for codeable repository scope. Moved from `docs/plans/queue/` to
`docs/plans/done/` after verification against local `main` (`3807c60b` before this
docs-only reconciliation). The public join request dispatcher, owner handler,
mobile/web review UI, public directory, serving node, warm-tail reads, and parity
guards exist in code. Remaining relay, community-node, directory-node, scanning,
and store-review work is founder-ops and is tracked in
`docs/guides/meerkat-founder-ops-runbook.md`. Do not execute this historical plan
as active queue work.

## Founder Policy Reversal (2026-07-06, binding: Plan 39)

The founder direction of 2026-07-06, recorded in `docs/plans/done/39-meerkat-public-base-feed.md`, reverses this plan's free-anonymous-viewing posture for the public tier. All in-app public surfaces and first-party hosted read routes now require a humanity-verified account session to VIEW (verify-to-view), and every public write requires the $4.99 one-time `meerkat_app_unlock`. This is a recorded founder decision, not drift. NC-5 and the viewing clauses of AC-8 and AC-13 are annotated below; the "viewing is free / anonymous" copy throughout the rest of this historical plan is superseded by Plan 39's NC-P criteria set. Self-hosted third-party nodes may still serve openly and the app states that boundary honestly (NC-P4). The private mesh tier is untouched (NC-P1).

## 1. Metadata

| Field | Value |
|---|---|
| Plan id | `19-meerkat-public-social-layer` |
| Complexity | **0 / Massive** (multi-surface, new sync scope, new hosted serving path, moderation-at-scale, durable public archive) |
| Estimated effort | **~29-38 CC sessions** across 10 phases (P0-P9). Engine ~10, relay/infra ~8, mobile ~6, web ~6, moderation ~4, public archive ~3-4. |
| Depends on (hard) | **Plan: Connectivity + Self-Hosting** (a real deployed relay + public directory + at least one always-on serving host; `DEFAULT_RELAY_URL` is `''` today, `apps/meerkat/app/(root)/data/sync-core.ts:103`). Without a real serving source this feature CANNOT honestly turn on. |
| Depends on (soft) | **Plan: Monetization + Billing** (the PAID hosting tier; free self-host path ships without it; also owns the durable PUBLIC ARCHIVE storage/quota/cap/meter axis, §9A). **Plan: Theme System** (Open Burrow tokens for new Discover surfaces). |
| Blocks | **Plan: Launch Readiness** (public reach is a headline launch claim; cannot be marketed until this lands behind a real source). Public forums interplay with **Plan: Full DMs** only at the "reply privately to a public post" seam (out-of-band; documented in §12). |
| Build order | After Connectivity+Self-Hosting reaches "one relay + one serving host deployed and probeable". Engine phases (P0-P3) can begin in parallel against the LIVE relay e2e harness before a production host exists. |
| Owners (file zones) | engine = `packages/sync/src/{protocol,node}` (incl. new `protocol/public-archive.ts`); infra = `packages/meerkat-relay/src` (durable pin + host moderation queue on community-node/seeder + `public-directory-node`); mobile = `apps/meerkat/app/(root)`; web = `apps/meerkat-web/src`; registry = `packages/module-registry/src`. |

---

## Status Delta (2026-07-01, read first)

- P0 through P9 are CODE-COMPLETE and locally verified (sessions 2026-06-29 and 2026-06-30, branch feature/meerkat-launch-finish). Fast-follows FF1 (owner terminal takedown), FF2 (warm-tail paging), FF4 (Unicode tokenizer), FF5 (public-publish twin parity guard), FF6 (mobile test typecheck) are done. Wave-1 adversarial hardening (C1 scope-leak, C2 directory replay tombstone, C3 refcounted dedupe removal) is done.
- FF3 (link-free public join) is code-complete on the joiner side and the grant/redeem engine, but NOT end-to-end. The one remaining codeable work item is the owner-side auto-approve consumption path:
  1. packages/sync/src/protocol/mailbox-dispatch.ts: the central switch (lines 158-176) has NO case for PUBLIC_JOIN_REQUEST_MAILBOX_KIND (defined in protocol/public-join.ts), so parked public-join requests are dropped fail-closed at the default branch. Add a dispatchPublicJoinRequest routing case plus a publicJoinRequest handler slot on the MailboxEnvelopeHandlers interface (lines 75-129).
  2. openPublicJoinRequest (protocol/public-join.ts) is built and unit-tested (7/7 in packages/sync/src/__tests__/public-join.test.ts) but called only from tests. Wire it as the handler implementation.
  3. App data layer owner-side handler (mobile: new public-join handling in community-core.ts or a sibling public-join-core.ts mirroring join-handoff-core.ts; web twin in meerkat-data.ts): on a verified opened request, perform member add (mirroring redeemPublicJoinGrant's roster-row write or the existing commitMemberAdd) plus the real key handoff via the owner-gated key-wrap path already used for invite joins (join-handoff-core.ts).
  4. Register the new handler in the shared drain-handlers object built by SyncProvider/background-sync (mobile) and MeerkatProvider (web) so foreground and background drains cannot drift.
  5. Owner-facing review/approve UI: the communities.tsx review panel currently handles only the invite-link JOIN_REQUEST_MAILBOX_KIND; extend it (shared code path or parallel queue row) for the public variant. Plus an end-to-end drain test proving a parked public-join request applies through the dispatcher into a real membership + key wrap.
- The joiner side is DONE: queuePublicJoinRequest is wired from apps/meerkat/app/(root)/data/public-join-client.ts:72 (requestPublicJoin), sealing and parking over effectiveRelayUrl. createPublicJoinGrant / redeemPublicJoinGrant (roster row only, ZERO key access) are live on both surfaces.
- Founder-ops gates (not codeable): deploy relay + always-on community node + public-directory-node (three services, GHCR images, TLS); flip DEFAULT_RELAY_URL / VITE_MEERKAT_DEFAULT_RELAY_URL only after a real GET /healthz; deploy the edge per-IP limiter (Caddy) in front of open read routes; deploy a real AV/malware/CSAM-hash scanner feeding cm_archive_moderation; real provider-cost backfill of hosted pricing; store UGC policy review; 2-device FF3 QA over a real relay once the owner-side wiring lands.
- 2026-07-01 founder decisions that EXTEND this plan's scope downstream: public posting becomes owner-configurable per public community (view-only / post-after-approval / open-posting) in new Plan 26, which builds directly on this plan's joinPolicy + grant/request machinery; a humanity-verification credential (new Plan 24) becomes a base requirement for public participation. This plan's own scope is UNCHANGED; close FF3 here first.

---

## 2. Business Context

### Why this exists
Meerkat today is a **closed** product: every surface is private-by-construction and the app deliberately HIDES public. The Feed "Public" control is force-disabled (`apps/meerkat/app/(root)/data/feed-core.ts:121` force-sets `public:false`; `:163` hardcodes `publicSourcesAvailable=false`), the Settings "Public posts" and "Public feed" rows render "Hidden" (`apps/meerkat/app/(root)/data/hosted-boundaries.ts:96-109`), and the audience model has a full `public` rule defined but unreachable in any composer (`packages/sync/src/protocol/audience-rule.ts:106-111,153-154`). The honesty boundary copy is explicit: *"The Public control is hidden until a real public hosted source exists"* (`apps/meerkat/app/(root)/(tabs)/index.tsx:205`).

A private-only social app has no top-of-funnel. Public, free-to-view communities/channels/forums are the acquisition surface: a new user can browse and read before they ever create an identity or pay, exactly like X, Reddit, TikTok, and Facebook public pages. This plan builds the real public layer: publish to public, browse/search/trending discovery, a real hosted serving source, moderation-at-scale, and an honest paid boundary where **viewing is free** and **hosting at scale** is the paid/self-host axis.

### Which competitor's users this wins
- **Reddit refugees** (post-API-monetization, post-moderation-controversy): people who want public topic forums but distrust a central ad-funded owner. Meerkat offers signed, portable, fork-able communities (`packages/sync/src/protocol/community.ts:8-12` — any member can fork and keep the catalog + member list) with public read access and no ad surveillance.
- **X/Twitter skeptics** who want a public broadcast feed without algorithmic opacity. Meerkat's trending is computed from **verifiable** signals only (real announcing-host count, signed snapshot event count, recency) — no black-box engagement scoring, no fabricated view counts.
- **Mastodon/Bluesky users** frustrated by instance-admin power and operational fragility: Meerkat's public content is author-signed and content-addressed, so a host cannot forge or silently tamper, and a community can migrate hosts by re-signing its descriptor.

### Target user / migration path
"A Reddit moderator who wants a public, ownerless topic community their members can read without an account, that they can self-host for free on a Mac mini and optionally pay $4.99/mo to make always-on." The wedge: free public reach on day one (self-host) with an upgrade to managed hosting, versus Reddit/Discord where the platform owns the room and the audience.

### Competitor landscape

| Competitor | Public free-to-view? | Behind paywall? | Their implementation |
|---|---|---|---|
| Reddit | Yes | No (read free; API paid) | Central servers, central moderation, platform-owned content |
| X / Twitter | Yes | Partial (some gated) | Central servers, algorithmic feed, central moderation |
| TikTok | Yes | No to view | Central CDN + recommender |
| Facebook Pages/Groups | Public pages free | No to view | Central servers, central moderation |
| Mastodon | Yes | No | Federated instances; per-instance admin/moderation/storage |
| Bluesky | Yes | No | AT Protocol PDS + relays + app-views (central-ish) |
| **Meerkat (this plan)** | **Yes (free to view)** | **Hosting-at-scale paid or self-host; viewing always free** | Author-signed content-addressed snapshots served by an open public host + zero-knowledge-style public directory; portable, fork-able communities |

---

## 3. Current-State Grounding (what exists vs net-new)

### Already REAL (reuse, do not rebuild)
- **`public` audience rule** — full copy + actor set + `requiresHostedStorage:true` + `publicModerationRequired:true` already modeled: `packages/sync/src/protocol/audience-rule.ts:7,106-111,135-137,153-154`. The `AudienceSelector` radio component exists but is wired nowhere (`apps/meerkat/app/(root)/components/AudienceRule.tsx:39-78`; dossier `m-posts.md` §6).
- **`published_blob` scope** is a first-class `SyncScope` value already: `packages/module-registry/src/types.ts:131,208`. `maxScope` + `ConflictStrategy` already in the policy schema: `:132,137-138,209,214-215`.
- **Signed channel events + rolling snapshots** — the history primitives `buildChannelHistory`/`parseChannelHistory` live in `packages/sync/src/protocol/channel-history.ts:213,379` (seal helper `sealHistorySnapshot` `:201`). The per-channel orchestrators `buildCommunitySnapshots`/`importSnapshotFromPieces`/`runCommunitySnapshotJob` live in `packages/sync/src/protocol/community-snapshots.ts:150,285,357` and call the history primitives at `:175,295`. Local snapshot/cursor tables already exist and are LOCAL-ONLY: `cm_snapshots`, `cm_feed_cursor` (`apps/meerkat/app/(root)/data/community-core.ts:310,326,1366`).
- **Zero-knowledge content-host registry** — `deriveContentRegistryId`/`announceHeldContent`/`lookupContentHosts` (`packages/sync/src/node/host-registry.ts:48,120,150`) over the relay `announce`/`lookup` verbs (`packages/meerkat-relay/src/hub.ts:221-279`). This is the TEMPLATE for the public directory; it seals records so only link-holders read — the public directory will deliberately NOT seal (public = readable by all), see §5.
- **Always-on community node** — per-member signed-auth, durable revisions, rate limits, per-community piece scoping: `packages/meerkat-relay/src/community-node.ts` (`publish` `:417`, `append` `:542`, `servePieceForCommunity` `:596`, `issueChallenge` `:342`, `verifyRequest` `:370`). This is the TEMPLATE for the public serving node; public serving drops per-member auth (open read) but keeps owner-only publish + hash verification.
- **Seeder node** — content-agnostic web seed, per-piece hash verify, pin/sweep: `packages/meerkat-relay/src/seeder-node.ts:224+`. Reusable as a free self-host serving box.
- **Moderation primitives** — `AbuseReport`/`createAbuseReport`/`openAbuseReport`, `evaluatePublishBoundary`, `DescriptorKill`/`createDescriptorKill`/`verifyDescriptorKill`/`isDescriptorKilled` (`packages/sync/src/protocol/abuse-rails.ts:46,57,74,100,143,163,184`). These back moderation-at-scale and takedown.
- **Inbound policy fail-closed gate** — `evaluateInboundChange` enforces scope-exceeds-cap, never laundering a row above its `maxScope` (`packages/sync/src/protocol/inbound-policy.ts:92-160`; DB wrapper `sync-session.ts:527-682`). This is the security spine for the new public scope.
- **Hosted-pricing ledger + entitlement crypto + HostedNodeService runtime** — cost-plus engine, `issueMeerkatHostedEntitlement`/`verifyHostedFeatureEntitlement`, multi-tenant runtime (`packages/meerkat-relay/src/{hosted-pricing.ts,hosted-node.ts}`; `packages/entitlements/src/meerkat-hosted.ts:151-211`). Backs the paid hosting tier.

### Net-new (this plan builds)
1. **Public publication unit** — a signed `PublicationDescriptor` (engine) + `cm_publications` local table (apps) representing "this community/channel/post is published public".
2. **Public snapshot variant** — author-signed, content-addressed, **non-confidential** snapshot pieces servable openly (engine: `protocol/public-snapshot.ts`).
3. **Public directory** — an OPEN, browseable registry of signed `PublicationDescriptor`s with categories, search, and verifiable trending (engine client `node/public-directory.ts` + relay service `public-directory-node.ts`).
4. **Public serving endpoint** — open (no per-member auth) read path on the community/seeder node for public snapshots (`community-node` PUBLIC routes).
5. **Real public feed wiring** — un-force-disable the Feed `public` control, drive `publicSourcesAvailable` from a real configured + responsive source, and add public feed items only from content a real host actually served.
6. **Discover/Browse surface** — search, trending, categories, community/channel/forum browse, and a public reader; mobile tab + web pane.
7. **Moderation-at-scale** — public report intake on the host, owner-review-at-scale, signed takedown/unpublish, anti-spam publication caps.
8. **Honest paid boundary** — `public_posts`/`public_feed` hosted-boundary rows transition from "Hidden" to real states once a real public source is connected; free self-host path; paid managed-hosting path.
9. **Public archive / forever archive** (§9A) — a DURABLE, content-addressed, deduped tier of the public snapshot: explicit publish CONSENT gate + rights/provenance/license metadata, a host moderation queue with at-scale abuse/malware scanning, and takedown/deletion propagation. Viewing is free; durable hosting at scale consumes real server space (free self-host while online, or paid always-on managed, storage/quota/cap owned by Plan 22).

### What stays untouched (negative scope)
- Private community messaging, DMs, friends graph, pairing, recovery — unchanged. `cm_messages` stays capped at `shared_workspace` (`apps/meerkat/app/(root)/data/community-core.ts:79-132`); a private message is NEVER auto-escalated to public.
- No new cryptography. We extend `@mylife/sync` (mandate 3).

---

## 4. Data Model / SQLite Schema + Sync Policy

All new app-side tables use the existing community `cm_` prefix family (one owned prefix per module):
- Content/cache tables that mirror existing community feed tables (local-only, recomputed): `cm_public_directory_cache`, `cm_public_feed_cursor`.
- Publication + moderation tables that participate in sync: `cm_publications`, `cm_public_reports`. These keep the `cm_` prefix rather than a separate publication-only prefix family because `ChangeTracker.resolveModule` resolves a table to its module by a single owned prefix (a table under an unowned prefix resolves to null and is rejected as `unknown_table` before the scope cap is consulted). `cm_publications` is the one place a row may reach `published_blob`.

> Security framing first: public content must be **separable** from private content at the schema level so the inbound-policy `maxScope` cap can keep private `cm_messages` (`maxScope: shared_workspace`) from ever being laundered to `published_blob`. Publishing is an explicit, owner/author-signed action that writes a SEPARATE `cm_publications` row referencing the content by id — it never rewrites a `cm_messages` row's scope.

### 4.1 New tables (mobile `community-core.ts`, web `lib/schema.ts` — keep byte-parity)

```sql
-- cm_publications: the signed decision to publish content publicly.
-- The ONLY table in the community family whose maxScope is published_blob.
CREATE TABLE IF NOT EXISTS cm_publications (
  publication_id   TEXT PRIMARY KEY,          -- derived from signed descriptor genesis hash
  community_id     TEXT NOT NULL,
  channel_id       TEXT,                       -- null = whole-community publication
  post_id          TEXT,                       -- null = channel/community-level; set = single post
  kind             TEXT NOT NULL,              -- 'community' | 'channel' | 'forum' | 'post'
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  category         TEXT NOT NULL,              -- one of a fixed taxonomy (see §4.4)
  owner_device_id  TEXT NOT NULL,              -- signer (community owner or post author)
  content_id       TEXT NOT NULL,              -- public snapshot infoHash (content-addressed)
  public_key_hex   TEXT NOT NULL,              -- the PUBLISHED read key (no confidentiality, see §5)
  host_urls        TEXT NOT NULL DEFAULT '[]', -- JSON: reachable serving hosts (real, probed)
  revision         INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'active', -- 'active' | 'unpublished' | 'killed'
  join_policy      TEXT NOT NULL DEFAULT 'request', -- 'request' | 'open' (public-join, §7.2.1)
  signature_hex    TEXT NOT NULL,              -- Ed25519 over canonical descriptor
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- cm_public_reports: signed abuse reports filed against PUBLIC content.
-- Travels to the publishing owner (mailbox) AND the host abuse endpoint.
CREATE TABLE IF NOT EXISTS cm_public_reports (
  report_id        TEXT PRIMARY KEY,
  publication_id   TEXT NOT NULL,
  target_kind      TEXT NOT NULL,              -- 'post' | 'reply' | 'file' | 'community'
  target_id        TEXT NOT NULL,
  reason           TEXT NOT NULL,              -- fixed reason codes (see §9 moderation)
  reporter_device_id TEXT NOT NULL,
  signature_hex    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open', -- 'open' | 'reviewed' | 'actioned'
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- cm_public_directory_cache: LOCAL-ONLY cache of browse/search/trending results.
-- Every row carries its real source host + fetch time; recomputed, never synced.
CREATE TABLE IF NOT EXISTS cm_public_directory_cache (
  publication_id   TEXT PRIMARY KEY,
  kind             TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL,
  owner_device_id  TEXT NOT NULL,
  content_id       TEXT NOT NULL,
  public_key_hex   TEXT NOT NULL,
  host_urls        TEXT NOT NULL,              -- JSON
  announcing_hosts INTEGER NOT NULL DEFAULT 0, -- REAL count of distinct hosts that announced it
  event_count      INTEGER NOT NULL DEFAULT 0, -- from the SIGNED snapshot, verified
  latest_wall      TEXT NOT NULL DEFAULT '',   -- HLC of newest signed event
  source_host      TEXT NOT NULL,              -- which directory host served this row
  fetched_at       TEXT NOT NULL DEFAULT (datetime('now')),
  verified         INTEGER NOT NULL DEFAULT 0  -- 1 only after signature + content-id verify
);

-- cm_public_feed_cursor: LOCAL-ONLY warm-tail cursor per (publication, channel).
CREATE TABLE IF NOT EXISTS cm_public_feed_cursor (
  publication_id   TEXT NOT NULL,
  channel_id       TEXT NOT NULL,
  last_wall        TEXT NOT NULL DEFAULT '',
  last_counter     INTEGER NOT NULL DEFAULT 0,
  source_host      TEXT NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (publication_id, channel_id)
);
```

### 4.2 Sync policy changes (`packages/module-registry` + the Meerkat community policy)

Add entity policies. Cite the contract: `SyncScope`/`ConflictStrategy`/`maxScope` (`packages/module-registry/src/types.ts:131-138,208-215`).

| Entity (table) | defaultScope | maxScope | conflictStrategy | Rationale |
|---|---|---|---|---|
| `cm_publications` | `shared_workspace` | **`published_blob`** | `lww` | The publication descriptor is the only escalation point; it is owner-signed and revision-chained. LWW by revision. |
| `cm_public_reports` | `shared_workspace` | `shared_workspace` | `or_set` | Reports aggregate (OR-set add); each is independently signed. Delivered to owner via mailbox, NOT published. |
| `cm_public_directory_cache` | `device_local` | `device_local` | `lww` | Pure local cache; never leaves the device. |
| `cm_public_feed_cursor` | `device_local` | `device_local` | `lww` | Personal read position; like `cm_read_state` it must NEVER be sent (`apps/meerkat/CLAUDE.md` table notes). |
| `cm_messages` (existing) | `shared_workspace` | `shared_workspace` | (unchanged) | **Explicitly unchanged.** Guards against laundering private content to public. |

### 4.3 Security note (schema)
- **No silent escalation.** Only `cm_publications` may reach `published_blob`. `evaluateInboundChange` (`packages/sync/src/protocol/inbound-policy.ts:92-160`; `scope_exceeds_cap` verdict at `:133`) returns the reject verdict for any inbound row whose declared scope exceeds its policy `maxScope`, fail-closed; the `sync_inbound_audit` row is then written by `recordInboundReject` (`packages/sync/src/protocol/sync-session.ts:491`) via `insertInboundAudit` (`packages/sync/src/db/queries.ts:860-862`, schema `db/schema.ts:412`) — NOT inside `inbound-policy.ts`. A malicious peer cannot push a `cm_messages` row tagged `published_blob`; the cap rejects it.
- **Cursors never sync.** `cm_public_feed_cursor` is `device_local` for the same reason `cm_read_state` is (`apps/meerkat/CLAUDE.md`): a synced cursor would leak what a user has read.
- **Directory cache is untrusted until verified.** `verified=0` rows are display-suppressed until signature + content-id verification passes (see §5 security analysis).

---

## 5. Protocol / Engine Changes (`@mylife/sync`) + Security Analysis

> Mandate 3: extend the engine; reimplement no crypto. All new files are PURE `protocol/` modules or `node/` modules that inject backends (RN-safe from `index.native.ts`).

### 5.1 `protocol/publication.ts` (new) — the signed publication descriptor
```ts
export interface PublicationDescriptor {
  version: 1;
  publicationId: string;          // derived from genesis canonical hash (like communityId)
  kind: 'community' | 'channel' | 'forum' | 'post';
  communityId: string;
  channelId: string | null;
  postId: string | null;
  title: string;
  description: string;
  category: PublicCategory;       // fixed taxonomy, §4.4
  ownerDeviceId: string;          // signer
  contentId: string;             // public snapshot infoHash
  publicKeyHex: string;          // the PUBLISHED read key (carried in the clear)
  hostUrls: string[];            // reachability hints (probed before display)
  revision: number;
  previousHash: string | null;
  status: 'active' | 'unpublished' | 'killed';
  joinPolicy: 'request' | 'open'; // public-join policy (§7.2.1); read is always anonymous
  createdAt: string;
  updatedAt: string;
}
export interface SignedPublicationDescriptor { descriptor: PublicationDescriptor; signature: string; }
export function createPublication(owner: DeviceIdentity, opts: CreatePublicationOptions): SignedPublicationDescriptor;
export function revisePublication(owner, prev, changes): SignedPublicationDescriptor;  // owner-only, chained
export function unpublish(owner, prev): SignedPublicationDescriptor;                   // status -> 'unpublished'
export function verifyPublication(signed): 'ok' | 'invalid' | 'not_owner' | 'killed';
```
Mirrors `community.ts` (`createCommunity` `:166`, `reviseCommunity` `:212`, canonical signing `:111-138`). Only `ownerDeviceId` (the community owner for community/channel/forum kinds, or the post author for post kind) may sign a publication or its revisions.

### 5.2 `protocol/public-snapshot.ts` (new) — non-confidential, author-signed snapshots
Reuses the history primitives `buildChannelHistory`/`parseChannelHistory` (`channel-history.ts:213,379`; called today from `community-snapshots.ts:175,295`). It does NOT roll a parallel seal. Today `buildChannelHistory` seals internally via `sealHistorySnapshot` (`channel-history.ts:201`) keyed off the community epoch carried in its input — there is no injectable seal key. So this phase EXTENDS the existing seal path: add an optional `sealKey?: Uint8Array` (a NON-SECRET **published content key** derived from `publicKeyHex`) to `sealHistorySnapshot`/`buildChannelHistory`/`parseChannelHistory`; when present it replaces the epoch key, when absent the private epoch path is byte-for-byte unchanged. This is a real engine step (P1) with its own injected-key round-trip test AND an epoch-path-unchanged regression test — not a drop-in reuse.
```ts
export function buildPublicSnapshot(input: {
  identity: DeviceIdentity; publicationId: string; communityId: string; channelId: string;
  events: ChannelMessageEvent[]; publicKey: Uint8Array; pieceStore: SnapshotPieceStore; webSeeds?: string[];
}): Promise<PublicSnapshotRecord>;     // returns infoHash + signed catalog manifest
export function importPublicSnapshot(input: {
  publicationId; channelId; manifest; pieceStore; publicKey; sinceHlc?: Hlc | null;
}): Promise<ImportSnapshotResult>;      // verifies Ed25519 author sigs + content-id; fail-closed
```

#### Security analysis (public-snapshot)
- **Confidentiality is intentionally ZERO.** Public content is readable by anyone with the link/directory entry; the `publicKeyHex` is published in the clear. We do NOT pretend otherwise. The injected `sealKey` (the published content key) exists only to keep one uniform code path through the extended `sealHistorySnapshot` (`channel-history.ts:201`); it is a transparency wrapper carried in the clear, not a secret. UI copy must say public content is readable by anyone (see §7 honesty copy).
- **Integrity + authenticity are FULL.** Every event inside the snapshot is Ed25519-signed by its author (`createChannelMessageV2`/`verifyChannelMessage`); `importPublicSnapshot` verifies every signature, the content-id (Merkle root), every piece hash, and size, fail-closed on any mismatch — the same posture as `openSealedShare` (`packages/sync/src/node/sealed-share.ts:170`; `createSealedShare` at `:128`). A host CANNOT forge, inject, reorder, or silently drop signed events without detection.
- **A host cannot impersonate the owner.** The `PublicationDescriptor` is owner-signed; a host re-serving a stale/older revision is caught by the revision chain + the durable-revision monotonicity already enforced for community descriptors (`packages/meerkat-relay/src/community-node.ts:122-145,417-535`). A removed-then-restored older publication cannot resurrect.
- **No private epoch key is ever exposed.** Public snapshots are built from a SEPARATE published key; the private community epoch key (`group-keys.ts`) is never used for public content, so publishing publicly does not weaken private confidentiality. Crucially, only events the author already authored/holds are included; per-entity crypto-shredded rows (`entity-keys.ts`) that were deleted remain unreadable and are excluded.

### 5.3 `node/public-directory.ts` (new) — OPEN browse/search/trending client
Twin of `host-registry.ts` (`:48-169`) but **deliberately not sealed** (public must be readable by all):
```ts
export function deriveCategoryRid(category: PublicCategory): string;          // HKDF(namespace + category), 64 hex
export function deriveSearchRid(termToken: string): string;                   // HKDF(namespace + normalized term)
export async function announcePublication(input: { url; signed: SignedPublicationDescriptor; ttlMs? }): Promise<void>;
export async function browsePublications(input: { url; category?; }): Promise<DirectoryEntry[]>;
export async function searchPublications(input: { url; terms: string[]; }): Promise<DirectoryEntry[]>;
export async function lookupPublicationHosts(input: { url; contentId; }): Promise<string[]>; // real serving hosts
```
- Records are signed `PublicationDescriptor`s stored verbatim; the client **verifies the signature and recomputes `publicationId`** before trusting any field (a directory operator cannot forge entries — they only relay signed bytes, exactly like the relay forwards opaque envelopes `hub.ts:8-12`).
- `announcingHosts` (the trending signal) is the **real** count the directory returns of distinct hosts that announced a given `contentId` via the host-registry verbs — not a fabricated popularity number.

#### Security analysis (directory)
- **The directory is a forwarder, not an authority.** Every entry is independently signature-verified client-side against `ownerDeviceId`; a tampered or forged entry fails `verifyPublication` and is dropped (`verified=0`, suppressed). The directory operator can censor (omit) but cannot forge or alter — censorship resistance is provided by multiple directory hosts + the share-link fallback (a publication is openable directly from a `meerkat://public/...` link even if no directory lists it).
- **Metadata exposure is acknowledged and bounded.** Unlike the private host-registry, a public directory by definition reveals titles/categories/owner pubkeys — that is the POINT of public. We surface no MORE than the owner chose to publish. The owner's MAIN identity is only exposed if they publish under it; the plan recommends publishing under a community pseudonymous profile (`cm_profiles`, already signed `community-core.ts:862-998`).
- **Anti-enumeration / anti-spam.** The relay's WebSocket caps (`packages/meerkat-relay/src/protocol.ts:17-66`) are per-connection envelope rate (`rateMaxPerWindow: 200`) + global (`maxConnections: 10_000`) + a per-IP connection-COUNT cap (`maxConnectionsPerClient: 64`, XFF/remoteAddress-keyed at `server.ts:205-207`); they govern the WS relay verbs, NOT the new open HTTP directory reads. So the directory adds its own real per-IP request limiter (see §5.4 DoS surface) plus per-owner publication-rate caps + an `evaluatePublishBoundary` gate (`abuse-rails.ts:100`) so a single key cannot flood categories.

### 5.4 Relay/infra: public serving + public directory service (`packages/meerkat-relay`)
- **`src/public-directory-node.ts` (new)** — a deployable service (third image alongside relay + community node) that: stores signed publication records in category + search-term buckets; serves `browse`/`search`/`trending`; computes trending from real `announcingHosts` (distinct serving-host count) + recency (owner-signed `descriptor.updatedAt`) only, NO fabricated metrics (the directory node holds no snapshots, so an owner-claimed `eventCount` is inflatable and is NOT a rank input; a verified `eventCount` rank signal would require the node to fetch and verify snapshots and is deferred); enforces per-owner publication caps + global rate caps; honors signed `DescriptorKill` takedowns (`abuse-rails.ts:143-184`). Reuses the hub registry verbs and the durable descriptor store pattern (`community-node.ts:122-145`).
- **`src/community-node.ts` PUBLIC routes (extend)** — add open (no per-member auth) read endpoints for content a publication marks public: `GET /public/{publicationId}/manifest`, `GET /public/{publicationId}/{infoHash}/{index}`. Owner-only publish stays signed; only READ drops auth (public = open read). Per-publication piece scoping is preserved (a public read for publication A cannot fetch B's private pieces). The existing private routes (`servePieceForCommunity` `:596`) are untouched.
- **`src/seeder-node.ts` (reuse)** — a free self-host serving box can pin + serve public snapshot pieces over the same web-seed shape; `announcePublication` + `announceHeldContent` advertise it.

#### Security analysis (infra)
- **Open read is intentional and bounded.** Public read endpoints serve only content referenced by an `active` publication; an `unpublished`/`killed` publication stops being served (host checks status + honors `DescriptorKill`). No private (epoch-sealed) piece is ever reachable through a public route — the route only resolves `contentId`s registered as public.
- **DoS surface (real per-IP limiting).** Public open read is the largest new attack surface, and the existing relay caps do NOT cover it: `protocol.ts:17-66` rate-limits the WebSocket relay per connection (`rateMaxPerWindow: 200`) + globally (`maxConnections`) + a per-IP connection-COUNT cap (`maxConnectionsPerClient: 64`); none of that throttles request or byte rate on the NEW open HTTP read routes. So this plan builds a real per-IP/edge limiter for the open routes: (a) an XFF-keyed token-bucket at the edge/reverse proxy (Caddy `rate_limit` keyed on `{client_ip}` / first `X-Forwarded-For` hop) in front of `public-directory-node` + the `community-node-http` public routes, and (b) an in-process per-IP request+byte limiter on those routes that derives the client key exactly like the relay does (first XFF hop, else `req.socket.remoteAddress`, `server.ts:205-207`) so it cannot be bypassed by opening many connections from one IP. Plus per-publication byte ceilings and the honest-cap oversize signal already in snapshots (`community-snapshots.ts:90-101,200-216`). A host over limit returns 429, never fabricated success.
- **Entitlement gate stays OFF for viewing.** Per existing default (`server.ts:35-36` "self-host relays remain open"), public viewing requires no entitlement. The entitlement gate applies only to PAID managed HOSTING (who pays for the always-on box), never to readers.

### 5.5 Moderation events (extend `abuse-rails.ts`)
- Public reports use `createAbuseReport`/`openAbuseReport` (`:57,74`), delivered to the publishing owner via the existing zero-knowledge mailbox (`protocol/mailbox.ts`) and to the host's new abuse intake.
- Takedown = owner signs `unpublish()` (status flip) OR, for platform-level abuse, a `DescriptorKill` (`:143-184`) the directory + host honor (`isDescriptorKilled` `:184`). Killed publications are dropped from browse/search/trending and stop being served.

### 5.6 Public paging wire protocol (backs `cm_public_feed_cursor`)
Open reads are warm-tail PAGED, not all-or-nothing. The `community-node-http` public routes + the seeder expose, alongside `GET /public/{publicationId}/manifest`:

- `GET /public/{publicationId}/{channelId}/page?after={wall}.{counter}&limit={n}` — returns up to `limit` (server-clamped, default 50, max 200) signed events in ascending HLC order strictly AFTER the `(wall, counter)` cursor, plus `nextCursor: "{wall}.{counter}"` (the HLC+counter of the last returned event) and `hasMore: boolean`. `after` omitted = from genesis. Events ship as the same content-addressed pieces the manifest indexes; the client verifies each piece hash + author sig + content-id before display (fail-closed, §5.2).
- **Cursor advance:** the client persists `(last_wall, last_counter)` into `cm_public_feed_cursor` only for pieces that PASSED verification; a failed piece never advances the cursor, so a tampered tail cannot silently skip history. Re-fetching the same `after` is idempotent and returns the same ordered window.
- **Range semantics:** HALF-OPEN, exclusive of the cursor, ordered ascending by HLC then `counter` tiebreak (matches snapshot event ordering). `limit` is a server cap, not a client promise; `hasMore` drives the Reader Partial state ("Loading older history… {n} more pieces").
- The route is read-only and stateless per request (no server-side cursor session); the cursor lives entirely on the client, consistent with `cm_public_feed_cursor` being `device_local` and never synced. P5/P6 Reader paging tests assert against THIS wire format.

---

## 6. Feed wiring change (honesty-critical)

Today the Feed `public` control is force-off and `publicSourcesAvailable` is hardcoded `false` (`feed-core.ts:121,163`). Change, on BOTH mobile and web `feed-core.ts` (keep byte-parity):

1. `normalizeFeedControls` stops force-resetting `public:false`. It instead respects the caller's control **only when a real source exists**.
2. Add `EvaluateFeedInput.publicSource?: { configured: boolean; respondedAt: string | null; entries: VerifiedPublicEntry[] }` — supplied by the app after a REAL directory probe. `publicSourcesAvailable = publicSource.configured && publicSource.respondedAt !== null && publicSource.entries.length > 0`. A configured source that responded with ZERO verified entries keeps `publicSourcesAvailable=false` and the Feed Public control HIDDEN; the responded-but-empty case surfaces only as the Discover tab's Empty state (§7.1), never as a visible-but-empty Public feed control. This is the TC-5 semantics (no `>= 0` tautology).
3. Public feed items are built ONLY from `publicSource.entries` that are signature+content-id `verified=1` and were actually pulled from a responding host. If no source responded — or a source responded with zero verified entries — `publicSourcesAvailable=false`, the control stays hidden, and the excluded-source line stays (`feed-core.ts:164-168`).
4. `VISIBLE_FEED_CONTROLS` includes `public` ONLY when `publicSourcesAvailable` is true at render (computed gating, not a constant flip).

**Honesty invariant:** every public feed card's numbers (event count, host count, recency) come from a verified signed snapshot or a real directory response row; there is no path that renders a public item without a real host having served it.

---

## 7. UI Screens — Mobile (`apps/meerkat`) + Web (`apps/meerkat-web`)

Parity is mandatory (mandate 4). Mobile = new `Discover` tab + a public reader stack; web = new `discover` `MainPane` (`view-state.ts:21` add `'discover'`) + reader pane. All copy uses Open Burrow tokens and the `HonestNotice` dot style (`apps/meerkat/app/(root)/components/kit.tsx:91-99`; web `ui/shell/HonestNotice.tsx`).

### 7.1 Discover / Browse screen
**Mobile:** new tab `Discover` (`Compass` icon) added to `(tabs)/_layout.tsx` (becomes 6th tab; or replaces nothing — founder decision noted in §11). **Web:** full nav wiring, not just the pane name — add `'discover'` to `MainPane` (`ui/navigation/view-state.ts:21`), an `OPEN_DISCOVER` `ViewAction` (`view-state.ts:35`), a `case 'OPEN_DISCOVER'` in `viewReducer` (`view-state.ts:53`), a Discover entry in `CommunityRail` (`ui/community/CommunityRail.tsx`) + `MobilePrimaryNav` (`ui/shell/MobilePrimaryNav.tsx`), and the `discover` pane render in `App.tsx` (`:57-101`).

- Header title: **"Discover"**; subtitle: **"Public communities, channels, and forums anyone can read."**
- Search field placeholder: **"Search public communities and forums"**
- Category chips render the FULL fixed taxonomy (§8, 9 categories): **"Technology"**, **"Gaming"**, **"News"**, **"Sports"**, **"Local"**, **"Hobbies"**, **"Creative"**, **"Discussion"**, **"Other"** — the rendered chip set and the engine enum are the same closed set (no chip omits a category).
- Trending section header: **"Trending"**; hint: **"Ranked by how many hosts serve it and how recent it is. No view counts."**
- Each result card: title, category pill, owner pseudonym, and **honest metrics only**: `"{N} posts · served by {M} host{s} · updated {when}"` where N = verified snapshot event count, M = real announcing-host count, when = HLC-derived locale time. NO likes/views.
- Honest notice (verbatim): **"This list comes from public directory hosts you can reach right now. Counts come from signed content and the number of hosts actually serving it, never from view or like tracking."**

#### 5-state coverage (Discover)
| State | What user sees | Trigger |
|---|---|---|
| Loading | Skeleton cards + **"Reaching public directory hosts…"** | Directory probe in flight |
| Empty | **"No public communities found here yet"** / **"No reachable directory host returned results. Try another search or check your connection server in Settings."** | Probe returned zero verified entries |
| Error | **"Could not reach a public directory"** + **"Retry"** + **"No directory host responded. Public browsing needs a connection server with a public directory."** | Probe failed / no source configured |
| Success | Trending + category + search results | Verified entries present |
| Partial | Results list + inline **"Still verifying {n} entries…"** footer; unverified entries hidden until verified | Some entries pulled, signature/content-id verification pending |

### 7.2 Public Reader (open a public community/channel/forum/post)
**Mobile:** `app/(root)/(tabs)/public/[publicationId].tsx` (+ `public/[publicationId]/[channelId].tsx`, `public/post/[publicationId]/[channelId]/[postId].tsx`). **Web:** reader rendered in the `discover` pane (reuses `ChannelView`/`PostThreadView` in read-only mode).

- Read-only rendering of the verified public snapshot (posts, replies, files-as-links).
- Audience badge fixed to **"Public"** (warning-tone styling already in `AudienceRule.tsx:11-14`).
- A persistent banner: **"You are reading public content. Anyone can read this. It is signed by its authors so it cannot be forged, but it is not private."**
- A **"Report"** chip on each item -> §9 moderation flow.
- A **"Reply"** / **"Join to participate"** affordance: reading is free; replying requires an identity + joining via the public-join flow (§7.2.1) — NOT an invite link, which a public community has none of by construction. Copy: **"Reading is free. Create an identity and join to post or reply."**

#### 5-state coverage (Reader)
| State | What user sees | Trigger |
|---|---|---|
| Loading | **"Fetching public content from a serving host…"** | Pulling snapshot pieces |
| Empty | **"This public space has no posts yet"** | Verified snapshot, zero events |
| Error | **"Could not load this public content"** + **"No serving host returned verified content. The publisher may have unpublished it, or no host is online."** | All hosts failed / verify failed / killed |
| Success | Read-only feed of verified posts/replies | Snapshot verified + rendered |
| Partial | Loaded posts + **"Loading older history… {n} more pieces"**; verify-fail pieces skipped with **"{k} items skipped (failed verification)"** | Warm-tail paging / partial verify |

#### 7.2.1 Public-join flow (no invite link)
A public community has no expiring invite link (today's join path is signed invite links, `community.ts:8-12`), so participation needs a real, link-free variant. Reading stays fully anonymous (no identity required). To PARTICIPATE:

1. The no-identity reader first creates a LOCAL device identity (existing identity-create flow) — still no server account.
2. The owner-signed `PublicationDescriptor.joinPolicy` (`'request' | 'open'`, §5.1) decides the path:
   - **`request`** (default): the new identity sends a self-signed join request to the publishing owner's zero-knowledge mailbox (reuse the existing join-request rail; honesty copy mirrors `communities.tsx:122-135` — "Saved on this device; sent when a connection server is available"). The owner approves in the existing review panel; approval issues normal community membership. Owner-revocable.
   - **`open`**: the descriptor carries an owner-signed public-join GRANT (verified against `ownerDeviceId`) that any holder of a valid identity redeems WITHOUT an owner round-trip, becoming a member immediately. No invite link, no shared secret. Still owner-revocable + `DescriptorKill`-able.
3. Either path writes a normal membership row and does NOT change the public READ path (reading never requires membership). This is a new entry point into the existing invite/join flow, not a parallel join engine (mandate: extend, don't fork).

### 7.3 Publish-to-Public (owner/author action)
Entry: in the existing community panel (`communities.tsx`) for owners/admins, a new row **"Make public"**; on a post, a **"Publish post publicly"** action. **Web:** mirror in `community` view + `PostsPanel`/`MessageActions`.

- Wires the dormant `AudienceSelector` (`AudienceRule.tsx:39-78`) so the author explicitly chooses `Public`. Selecting Public surfaces the `public` rule's hosted notice verbatim: **"Public posts use hosted storage and moderation."** (`audience-rule.ts:110`).
- A publish sheet:
  - Title field, description field, category picker.
  - Serving-host field: **"Where will this be served? Paste your serving host URL, or connect hosted serving."** with two honest paths:
    - **Self-host (free):** **"Serve it yourself from a Mac mini, NAS, or VPS. Free. It is public only while your host is online."** (links to the deploy guide `docs/guides/deploy-a-meerkat-relay.md`).
    - **Hosted (paid):** **"Always-on managed serving is a paid service ({price}/mo). Viewing stays free for everyone; you pay for the server space your public content uses."** Price from `billing-config` (`MEERKAT_HOSTED_MONTHLY_PRODUCT.price`, `packages/billing-config/src/index.ts:135-139`) — never hardcoded.
- Confirm button: **"Publish publicly"**. Disabled until title + category + a reachable host (probed) are present.

#### 5-state coverage (Publish)
| State | What user sees | Trigger |
|---|---|---|
| Loading | **"Building and signing your public snapshot…"** | Snapshot build + sign |
| Empty | (n/a — guarded; cannot publish an empty channel) **"Add at least one post before publishing."** | No events to publish |
| Error | **"Could not publish"** + reason: **"No serving host accepted the content. Check your host URL or connect hosted serving."** / **"This host rejected the publication (rate limited). Try again later."** | Host POST failed / 429 / verify mismatch |
| Success | **"Published. Anyone with a reachable host can now read it."** + a copyable `meerkat://public/{publicationId}` link | Snapshot served + directory announced |
| Partial | **"Published to {m} of {n} hosts."** + **"Some hosts did not accept it; it is still readable from the ones that did."** | Multi-host publish, partial accept |

### 7.4 Settings — hosted boundary transition (honesty)
Update `hosted-boundaries.ts` (mobile + web, byte-parity `:96-109`). The `public_posts` / `public_feed` rows become **state-driven**, not hardcoded `unavailable`:
- No public source configured -> unchanged copy: **"Public feed inclusion is a paid hosted service. The Public feed stays hidden until a real hosted source exists."** (`:108`).
- A self-host/community public source configured + responding -> state `local_only`, pill **"Self-served"**, detail: **"Public reach is live through the host you configured. It is public only while that host is online; this is free self-hosting, not paid managed serving."**
- A first-party hosted serving entitlement present -> state `included`, pill **"Hosted"**, detail: **"Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity."**

---

## 8. Public taxonomy (§4.4)
Fixed category enum (engine constant, shared mobile/web): `technology | gaming | news | sports | local | hobbies | creative | discussion | other`. Closed set keeps directory buckets bounded and prevents category-spam. Search is term-tokenized over title + description only (no full-content indexing on the directory — content stays content-addressed and verified client-side).

---

## 9. Moderation-at-Scale

1. **Report (any reader, free).** `Report` on a public item -> `createAbuseReport` (`abuse-rails.ts:57`), signed, written to `cm_public_reports`, sealed + parked to the publishing owner's mailbox AND POSTed to the host abuse intake. Reasons (fixed): `spam | harassment | illegal | csam | violence | other`. CSAM/illegal reasons additionally flag for host-level priority review.
2. **Owner review at scale.** The existing owner-review panel (`communities.tsx:389-418`) extends to a "Public reports" queue: count, target, reason, and a **"Reviewed"** + **"Unpublish"** action. Unpublish signs `unpublish()` -> directory + hosts drop it.
3. **Host/platform takedown.** A directory/host operator honors a signed `DescriptorKill` (`:143-184`) for platform-abuse content; killed publications are removed from browse/search/trending and stop being served (`isDescriptorKilled` `:184`). This is the only central lever and it is signed + auditable.
4. **Anti-spam (publish side).** `evaluatePublishBoundary` (`abuse-rails.ts:100`) + per-owner publication-rate caps on the directory + the directory's real per-IP HTTP request limiter (§5.4). (The WS relay caps at `protocol.ts:17-66` are per-connection + global + per-IP connection-count — NOT a per-IP HTTP request limiter — so they do not cover this surface.) New publications from a brand-new key are rate-throttled.
5. **Anti-spam (read side).** Open read endpoints rate-limited per IP via the real edge + in-process limiter of §5.4 (NOT the WS relay caps); oversize snapshots flagged (`community-snapshots.ts:200-216`) and byte-capped.

#### Moderation honesty
- Reports show **"Sent to the publisher and the host."** only after a real mailbox park / host POST succeeds; otherwise **"Saved on this device. It will be sent when a connection server is available."** (mirrors existing join-request honesty `communities.tsx:122-135`).
- Hiding a reported item is LOCAL until an owner unpublish / kill actually propagates — same honest boundary as existing report copy (*"It does not remove it for other members."* `communities.tsx`).

---

## 9A. Public Archive / Forever Archive (durable, content-addressed public publishing)

> Harvested from the archived Universal Share **Phase 14 — Archive Server And Forever Archive** (`docs/plans/archive/10-universal-share-mission-control.md:505-539`, USM-1401..1415; consent/rights/moderation/takedown also in `docs/plans/archive/09-universal-share-to-mesh-delivery.md:105-108,300-405`). Retargeted from the hub's private/shared/public archive-job model onto Meerkat's `published_blob` PUBLIC layer. The public archive is the DURABLE tier of the public snapshot (§5.2): the same author-signed, content-addressed pieces, but pinned on a real serving source (community-node / seeder), deduped by `contentId`, indexed + discoverable through the public directory (§5.3), gated by explicit publish CONSENT, carrying rights/provenance/license metadata, passing a host moderation queue with at-scale abuse/malware scanning, and honoring takedown/deletion propagation.

### 9A.1 Honesty frame (read first)
- **Viewing the public archive is FREE** (NC-5 holds unchanged). Durable HOSTING at scale consumes real server space: that is the FREE self-host path (durable only while your host is online) or the PAID always-on managed path. The storage / quota / cap / billing axis is owned by **Plan 22 (Monetization + Billing)** — usage meters read real `SeederNodeStats` / `HostedTenantStats` (`packages/meerkat-relay/src/seeder-node.ts:135-149`, `src/hosted-node.ts:125-131`; cross-ref `docs/plans/done/22-meerkat-monetization-and-billing.md:61,78-79`), never fabricated bytes.
- **No "forever" overclaim.** "Forever archive" is honest ONLY while at least one real host pins the content. A self-host archive is labeled *public only while your host is online*; permanence beyond that is provided solely by paid always-on managed hosting or by other members re-seeding the content-addressed pieces. The app never renders a permanence claim a real pinned host does not back (NC-7).
- **No confidentiality.** The archive is `published_blob`: readable by anyone, author-signed, content-addressed. Identical posture to §5.2 (integrity + authenticity FULL, confidentiality ZERO).
- **Dedupe is real, not estimated.** Two publications referencing the same `contentId` pin ONE physical copy; reported bytes come from real host stats, never a computed "you saved X" number (TC-11).

### 9A.2 Archive job model (extends §4 `cm_` family; harvest USM-1401)
Three new tables. NONE escalates to `published_blob` — the signed `PublicationDescriptor` (§5.1) remains the SINGLE escalation point (§4.3, TC-1 unchanged). Rights / provenance / license / consent are carried INSIDE the signed descriptor so they ride the one published row; the operational tables below stay at or below `personal_replica`.

```sql
-- cm_archive_jobs: the durable-pin lifecycle for a publication's public snapshot.
-- content_id is the DEDUPE KEY (content-addressed); one logical job per (publication_id, content_id).
CREATE TABLE IF NOT EXISTS cm_archive_jobs (
  job_id           TEXT PRIMARY KEY,            -- signed job genesis hash
  publication_id   TEXT NOT NULL,
  content_id       TEXT NOT NULL,               -- public snapshot infoHash; dedupe key
  tier             TEXT NOT NULL DEFAULT 'self_host', -- 'self_host' | 'managed'
  host_url         TEXT NOT NULL,               -- the durable serving host (real, probed)
  status           TEXT NOT NULL DEFAULT 'consented',
    -- 'consented'|'pinning'|'pending_review'|'published'|'rejected'|'taken_down'|'unpinned'
  total_bytes      INTEGER NOT NULL DEFAULT 0,  -- real, from SeederNodeStats; never fabricated
  pieces           INTEGER NOT NULL DEFAULT 0,
  consent_sig_hex  TEXT NOT NULL,               -- owner's explicit publish-consent signature
  signature_hex    TEXT NOT NULL,               -- Ed25519 over canonical job
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- cm_archive_moderation: LOCAL mirror of the host moderation-queue decision for a candidate.
-- The authoritative queue lives on the host; this row is recomputed from host responses.
CREATE TABLE IF NOT EXISTS cm_archive_moderation (
  publication_id   TEXT NOT NULL,
  content_id       TEXT NOT NULL,
  host_url         TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'scanning'|'approved'|'rejected'|'flagged'
  scan_result      TEXT NOT NULL DEFAULT 'unscanned', -- 'unscanned'|'clean'|'malware'|'abuse_hash_match'
  decided_at       TEXT,
  source_host      TEXT NOT NULL,
  fetched_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (publication_id, host_url)
);

-- cm_publication_rights: LOCAL cache of the rights/provenance/license + consent the owner declared.
-- CANONICAL copy lives inside the signed PublicationDescriptor; this mirrors it for query.
CREATE TABLE IF NOT EXISTS cm_publication_rights (
  publication_id   TEXT PRIMARY KEY,
  license          TEXT NOT NULL,               -- fixed taxonomy (§9A.4)
  rights_assertion TEXT NOT NULL,               -- 'i_own'|'i_have_permission'|'public_domain'|'fair_use'
  provenance       TEXT NOT NULL DEFAULT '',    -- author-stated source/attribution
  consent_at       TEXT NOT NULL,
  signature_hex    TEXT NOT NULL                -- owner Ed25519 over the rights block
);
```

Sync policy (extends §4.2):

| Entity (table) | defaultScope | maxScope | conflictStrategy | Rationale |
|---|---|---|---|---|
| `cm_archive_jobs` | `device_local` | `personal_replica` | `lww` | Owner's durable-pin lifecycle; replicates across the owner's OWN devices, NEVER published. |
| `cm_archive_moderation` | `device_local` | `device_local` | `lww` | Local mirror of the host queue; recomputed, never sent. |
| `cm_publication_rights` | `device_local` | `device_local` | `lww` | Local cache; canonical rights live in the signed descriptor. |

### 9A.3 Engine: `protocol/public-archive.ts` (new; harvest USM-1405,1408,1412)
Pure module; EXTENDS — does not fork — the publication descriptor and reuses content addressing (mandate 3: no new crypto).
```ts
export type ArchiveLicense = 'all_rights_reserved'|'cc_by'|'cc_by_sa'|'cc0'|'public_domain'|'other';
export type RightsAssertion = 'i_own'|'i_have_permission'|'public_domain'|'fair_use';
export interface PublicationRights { license: ArchiveLicense; rightsAssertion: RightsAssertion; provenance: string; consentAt: string; }
export interface ArchiveJob { version: 1; jobId: string; publicationId: string; contentId: string; tier: 'self_host'|'managed'; hostUrl: string; rights: PublicationRights; createdAt: string; }
export interface SignedArchiveJob { job: ArchiveJob; rightsSignature: string; signature: string; }
export function createArchiveJob(owner: DeviceIdentity, publication: SignedPublicationDescriptor, opts: CreateArchiveJobOptions): SignedArchiveJob; // requires explicit rights + consent
export function verifyArchiveJob(signed: SignedArchiveJob): 'ok'|'invalid'|'not_owner'|'no_consent'|'no_rights';
export function deriveArchiveIndexKey(contentId: string): string; // == deriveContentRegistryId(contentId) — the DEDUPE + index key
```
- **Dedupe + content-addressed index** reuse `deriveContentRegistryId` / `announceHeldContent` / `lookupContentHosts` (`packages/sync/src/node/host-registry.ts:48,120,150`): the `contentId` IS the dedupe key; two publications with the same `contentId` resolve to ONE stored copy on a host and ONE index entry.
- **Consent + rights are signed** into the descriptor's rights block; `verifyArchiveJob` fails closed when consent or rights are absent (NC-8). No durable pin proceeds without both.
- Signing reuses the device-identity Ed25519 path; the rights block is owner-signed exactly like `PublicationDescriptor` revisions (§5.1).

### 9A.4 Rights / provenance / license taxonomy (harvest USM-1408)
Fixed license enum (engine constant, shared mobile/web): `all_rights_reserved | cc_by | cc_by_sa | cc0 | public_domain | other`. Fixed rights-assertion enum: `i_own | i_have_permission | public_domain | fair_use`. Provenance is free text (author-stated source/attribution), surfaced verbatim on the reader so viewers see the declared origin. These are CLAIMS by the publisher, not platform verification; the reader banner states so.

### 9A.5 Durable serving + dedupe (reuse seeder / community-node; harvest USM-1402,1404,1405,1412)
No new image. The archive is the durable tier of the public snapshot (§5.2 / §5.4):
- **Durable pin** = the community-node / seeder `pin` path (cap-enforced `PinResult`, per-piece hash verify, `sweep` auto-deletes only NON-pinned content): `packages/meerkat-relay/src/seeder-node.ts` (store interface `:37-44`, real stats `:135-149`). A pinned public `contentId` is served openly over the §5.4 public-read routes; viewing requires no auth/entitlement.
- **Dedupe** is structural: `FileSeederPieceStore` keys pieces by `infoHash` (`seeder-node.ts:70-90`), so two publications referencing one `contentId` occupy ONE on-disk copy. Reported usage = real `SeederNodeStats` (TC-11), surfaced through Plan 22's meter.
- **Retention tiers** map to Plan 22: free self-host (online-only, no cap purchase) vs paid managed (always-on, `storage_cap` raised by the tier — `seeder-node.ts` `PinResult` `storage_cap`; plan 22 TC-6). Over cap returns a real `storage_cap` reject, never fabricated success.
- **Server-side verification** is already content-addressed (`verifyCatalogPiece`, `openSealedShare` fail-closed); a host cannot serve tampered archive bytes (§5.2).

### 9A.6 Moderation queue + at-scale scanning (harvest USM-1407,1409,1410)
- **Publish-boundary scan (client).** `evaluatePublishBoundary` (`packages/sync/src/protocol/abuse-rails.ts:100`) hashes the content pre-encryption ONLY for `published_blob` and blocks a flagged hash before it ever leaves the device. Private scopes are provably unscanned (the evaluator never invokes the hash fn for them, `abuse-rails.ts:106-108`).
- **Host moderation queue (at scale).** A durable-pin candidate enters the host review queue (`cm_archive_moderation.state = 'pending'`). The host runs a REAL abuse-hash + malware/AV scan hook; only a `clean` result transitions the candidate to `approved` and announces it to the public directory (§5.3). A `malware` / `abuse_hash_match` / flagged result is NOT announced and NOT served (TC-10). The scan STATE is honest: publisher and reader see `scanning…` until a real result returns, never a fabricated "clean."
- **Owner report queue** (§9) still applies to live archive content; reports route to the owner mailbox + the host abuse intake.
- At-scale AV / hash-set OPERATION (deploying + updating the scanner, CSAM-hash subscriptions) is manual / ops (Tier D), not a code gate, same posture as archived USM-1409 + the launch-readiness UGC gate (§14.5).

### 9A.7 Takedown + deletion propagation (harvest USM-1411,1415)
- **Owner takedown** = `unpublish()` (§5.1) flips status; the host un-pins (`removeContent`, `seeder-node.ts:41,58-62,88-90`) and stops serving; the directory drops it.
- **Platform takedown** = a signed `DescriptorKill` (`abuse-rails.ts:143-184`) the host + directory honor (`isDescriptorKilled` `:184`); killed content is un-pinned, removed from browse / search / trending, and stops being served.
- **Propagation + no-resurrection.** On a second device the item disappears within one refresh (mirrors AC-7); the MK-002 tombstone-no-resurrection invariant + community-node durable-revision monotonicity (`packages/meerkat-relay/src/community-node.ts:122-145`) prevent a killed / unpinned archive from resurrecting under an older revision.
- **Audit.** Each archive job + kill is signed and auditable; inbound rejects write `sync_inbound_audit` (§4.3). The host records serve / access counts via real stats without exposing plaintext (zero-knowledge; `packages/meerkat-relay/CLAUDE.md`).

### 9A.8 Publish-to-archive workflow (extends §7.3; harvest USM-1413)
The §7.3 publish sheet gains a durable-archive step BEFORE confirm:
1. **Consent gate** (verbatim): **"Publishing to the public archive makes this readable by anyone, durably hosted, and discoverable. Anyone can copy it. You can take it down, but copies others already made may remain."** A required checkbox; confirm stays disabled until checked.
2. **Rights + license picker:** rights-assertion radio (`I own this` / `I have permission` / `Public domain` / `Fair use`) + license picker (§9A.4) + an optional provenance / source field. Required, no default rights selection (NC-8).
3. **Tier choice** reuses §7.3's honest paths: **Self-host (free, online-only)** vs **Managed always-on (paid, {price}/mo from billing-config — `packages/billing-config/src/index.ts:135-139`)**. Copy: **"Viewing stays free for everyone. Durable hosting uses server space: host it yourself for free while your device is online, or pay for always-on managed hosting."**
4. **Scan + queue state** surfaces honestly: **"Scanning and queued for review…"** then **"Published to the public archive."** (or the rejection reason). NO "permanent / forever" word appears unless a managed always-on host backs it (NC-7).

#### 5-state coverage (Publish-to-archive)
| State | What user sees | Trigger |
|---|---|---|
| Loading | **"Pinning and scanning your public archive copy…"** | Durable pin + scan in flight |
| Empty | **"Add at least one post before archiving."** | No events to archive |
| Error | **"Could not archive"** + reason: **"Host is over its storage cap (add space or self-host)."** / **"This content was flagged in review and was not published."** | `storage_cap` reject / flagged / pin fail |
| Success | **"Published to the public archive. Viewing is free; it stays online while a host serves it."** + copyable `meerkat://public/{publicationId}` | Pinned + scanned clean + announced |
| Partial | **"Pinned to {m} of {n} hosts; scanning on {k}."** | Multi-host durable pin, partial accept / scan |

### 9A.9 What stays OUT of archive scope (negative)
- **Private "get to the right hands" durable handoff** (archived USM-1414) and **private encrypted archive objects** (USM-1406) are OUT of scope here. This section is the PUBLIC (`published_blob`) archive only. Private durable delivery routes to Files / DMs (Plan 21); a private `cm_messages` row is NEVER auto-archived (TC-1, NC-1 hold).
- No silent / automatic archiving: every durable pin is an explicit, consented, owner-signed action.

---

## 10. Phased BUILD plan (test-FIRST / TDD)

> Each phase: write failing tests first (Tier noted), implement, gate. Run `pnpm --filter @mylife/sync test`, `pnpm --filter @mylife/meerkat-relay test`, `pnpm --filter @mylife/meerkat-app test`, then `/function-gate-runner` + `/review`. UI phases add `/browse`.

### P0 — Engine: publication descriptor + sync policy (Tier A/B)
1. TEST: `publication.test.ts` — create/verify/revise/unpublish; `not_owner`, `killed`, revision-chain monotonicity, id-derivation stability.
2. TEST: inbound-policy — a `cm_publications` row at `published_blob` is accepted; a `cm_messages` row claiming `published_blob` is REJECTED (scope-exceeds-cap).
3. BUILD `protocol/publication.ts`; export from `index.ts` + `index.native.ts`; add the entity policies to the Meerkat community sync policy + `module-registry` types as needed.

### P1 — Engine: seal-key injection + public snapshot build/import (Tier A/B + C harness)
1. TEST: `channel-history.test.ts` (extend) — `buildChannelHistory`/`parseChannelHistory` round-trip with an injected non-secret `sealKey`; PLUS a regression test proving the EPOCH path (no `sealKey`) is byte-for-byte unchanged.
2. TEST: `public-snapshot.test.ts` — build -> import round-trip; tamper a piece -> fail-closed; wrong key -> fail; verify author sigs; oversize flag.
3. BUILD the seal-path extension first: add the optional non-secret `sealKey` param to `sealHistorySnapshot`/`buildChannelHistory`/`parseChannelHistory` (`channel-history.ts:201,213,379`); then `protocol/public-snapshot.ts` reusing them — NO parallel seal.

### P2 — Engine: public directory client (Tier A/B)
1. TEST: `public-directory.test.ts` — announce -> browse/search round-trip; forged (bad-sig) entry dropped; category rid stability; host lookup dedupe.
2. BUILD `node/public-directory.ts`.

### P3 — Infra: public directory node + public serving routes (Tier B/C)
1. TEST: `public-directory-node.test.ts` — store/serve, trending = real announcing-host count + recency, per-owner cap, `DescriptorKill` honored.
2. TEST: `community-node` public-read e2e — open GET serves a public snapshot; private piece NOT reachable via public route; 429 under rate cap; unpublished -> 404.
3. BUILD `src/public-directory-node.ts` + CLI bin; extend `community-node.ts` + `community-node-http.ts` with public routes; reuse seeder for self-host.

### P4 — Cross-client e2e over LIVE relay + real host (Tier C)
1. TEST: two engines + a live relay + a live public-directory-node + a live seeder: device A publishes -> device B browses, discovers, pulls, verifies, renders — REAL bytes, no simulation. (Pattern: `engine-relay-e2e`, `community-node-e2e`.)
2. TEST: B reports -> owner A receives via mailbox -> A unpublishes -> B no longer discovers/serves.

### P5 — Mobile: Discover + Reader + feed wiring (Tier B + manual device)
1. TEST: `feed-core.test.ts` — `public` control hidden when no source; visible + items present when `publicSource` responds with verified entries; never items without a responding host.
2. BUILD Discover tab, Public reader stack, feed `public` un-gate, directory probe service (`data/public-directory-client.ts`), `cm_*` publication/cache schema in `community-core.ts`.
3. `/browse` all 5 states.

### P6 — Web: Discover pane + Reader + feed wiring (Tier B + `/browse`)
1. Mirror P5 in `apps/meerkat-web`: add `discover` `MainPane` + `OPEN_DISCOVER` `ViewAction` + `viewReducer` case (`ui/navigation/view-state.ts:21,35,53`), Discover entries in `CommunityRail` (`ui/community/CommunityRail.tsx`) + `MobilePrimaryNav` (`ui/shell/MobilePrimaryNav.tsx`), the `discover` pane in `App.tsx`, `ui/discover/DiscoverView.tsx`, reader reuse of `ChannelView`/`PostThreadView` read-only, `lib/feed-core.ts` parity edit, `lib/schema.ts` parity tables, `lib/public-directory-client.ts`.
2. Parity check vs mobile copy (byte-identical honest strings where shared).

### P7 — Publish flow + paid boundary (Tier B/C + `/browse`)
1. Wire `AudienceSelector` -> publish sheet (mobile + web); host-URL probe; self-host vs hosted paths; price from `billing-config`.
2. Update `hosted-boundaries.ts` (mobile + web) state-driven `public_posts`/`public_feed`.
3. e2e: publish from the app -> appears in Discover on a second device.

### P8 — Moderation-at-scale + anti-spam (Tier B/C)
1. Public report intake on host; owner "Public reports" queue; unpublish + `DescriptorKill` honoring; per-owner publish caps; the real per-IP HTTP read limiter (edge + in-process, §5.4).
2. e2e: report -> owner review -> unpublish/kill -> removed everywhere reachable.

### P9 — Public Archive / Forever Archive (durable publishing) (Tier A/B + C)
1. TEST: `public-archive.test.ts` — `createArchiveJob`/`verifyArchiveJob` (owner-only, consent-required, rights-required, `deriveArchiveIndexKey` == `deriveContentRegistryId` stability); rights/provenance/license carried + signed; tamper -> fail-closed; `no_consent`/`no_rights` verdicts.
2. TEST: host archive e2e — candidate enters `pending_review`; clean scan -> `approved` -> announced + discoverable; flagged scan -> NOT announced, NOT served; dedupe: two publications, one `contentId` -> ONE stored copy (assert real `SeederNodeStats` bytes); `unpublish`/`DescriptorKill` -> un-pinned + dropped on a second device within one refresh.
3. BUILD `protocol/public-archive.ts` + the descriptor rights/consent extension; extend community-node/seeder durable pin + a host moderation queue + scan hook; `public-directory-node` announce-on-approve; app consent + rights + tier + archive-status UI in the §7.3 publish flow; `cm_archive_*` schema (mobile + web byte-parity); sync policy.
4. `/browse` the consent, rights, tier, and scan/status states (mobile + web).

> Parity + docs close-out: `node scripts/check-meerkat-parity.mjs`, update `apps/meerkat/CLAUDE.md` + `apps/meerkat-web` notes + `packages/sync/CLAUDE.md` exports, `memory.md` + session log, capture to Open Brain (`"personal, mylife"`).

---

## 11. Acceptance Criteria

### User-facing (AC)
- **AC-1** A user with NO identity can open Discover, browse categories, search, and READ a public community/channel/forum/post without creating an account or paying.
- **AC-2** Discover trending lists are ranked by real announcing-host count + recency (owner-signed `updatedAt`); event count may be DISPLAYED on a card only when read from a verified snapshot (it is not a directory trending-rank input); NO view/like numbers appear anywhere.
- **AC-3** An owner can publish a community/channel/forum publicly and a post author can publish a single post publicly, choosing a category + title + serving host.
- **AC-4** A published item appears in Discover on a SECOND device pulled from a real serving host (not the publisher's device).
- **AC-5** The Feed "Public" control becomes visible/usable ONLY when a real public source is configured and responding with at least one verified entry; otherwise (no source, or responded-empty) it stays hidden with the existing honest copy.
- **AC-6** Any reader can Report public content; the owner sees it in a "Public reports" queue and can Unpublish.
- **AC-7** Unpublishing (or a signed kill) removes the item from browse/search/trending and stops it being served, on a second device, within one refresh.
- **AC-8** The publish flow shows the free self-host path and the paid hosted path with a price read from billing config; viewing is never gated. [Viewing clause REVERSED 2026-07-06, see Plan 39 verify-to-view.]
- **AC-9** All 5 states render with the exact copy in §7 on both mobile and web.
- **AC-10** Publishing to the public archive requires an explicit consent checkbox AND a rights-assertion + license declaration; without both, the durable pin is blocked.
- **AC-11** The same content published twice (same `contentId`) is stored ONCE on a host (dedupe); the flow shows real byte usage from host stats, never a fabricated dedupe-savings figure.
- **AC-12** A taken-down or unpinned archive item is removed from browse/search/trending and stops being served on a second device within one refresh, and cannot resurrect.
- **AC-13** The archive UI never claims permanence: self-host is labeled public-only-while-online; always-on durability is the paid managed path (price from billing config); viewing is always free. [Viewing clause REVERSED 2026-07-06, see Plan 39 verify-to-view.]

### Technical (TC)
- **TC-1** `cm_publications` is the only community-family entity that may reach `published_blob`; `cm_messages` `maxScope` stays `shared_workspace`.
- **TC-2** `importPublicSnapshot` fails closed on any tampered piece, bad author signature, content-id mismatch, or size mismatch (no partial trust).
- **TC-3** A directory entry with an invalid signature or mismatched `publicationId` is dropped (`verified=0`, never displayed).
- **TC-4** A public read route cannot serve a private (epoch-sealed) piece; per-publication scoping holds.
- **TC-5** `publicSourcesAvailable` is true only when a real host responded with at least one signature+content-id-verified public entry; with no source — or a source that responded with zero verified entries — it is false, no public feed items exist, and the Feed Public control stays hidden.
- **TC-6** Trending numbers equal the directory's real announcing-host count for that content (asserted in e2e against a live node).
- **TC-7** `cm_public_feed_cursor` and `cm_public_directory_cache` never appear in any outbound sync batch.
- **TC-8** P4/P7/P8 e2e move REAL bytes across a LIVE relay + real serving host (no in-memory simulation passing as transport).
- **TC-9** `cm_archive_jobs` / `cm_archive_moderation` / `cm_publication_rights` never reach `published_blob`; the signed `PublicationDescriptor` stays the only `published_blob` escalation point (TC-1 holds).
- **TC-10** A durable-pin whose host scan result is `malware` / `abuse_hash_match` / flagged is NOT announced to the directory and NOT served; the host returns a real scan state, never a fabricated `clean`.
- **TC-11** Dedupe is by `contentId`: two publications referencing one `contentId` yield ONE stored copy; reported bytes equal real `SeederNodeStats`, not a computed estimate.

### Negative (NC)
- **NC-1** Publishing public content must NOT alter, escalate, or expose any private `cm_messages` row or the community epoch key.
- **NC-2** A reader must NOT be able to obtain private community content through any public route.
- **NC-3** The UI must NOT display a public feed item, host count, or trending entry that no real host served (no fabrication).
- **NC-4** The directory operator must NOT be able to forge or alter a publication's content or authorship (only omit/censor).
- **NC-5** ~~Public viewing must NOT require any entitlement, account, or payment.~~ REVERSED by founder decision 2026-07-06 (Plan 39): first-party public viewing requires a verified account session. Replaced by NC-P1..NC-P6 in `docs/plans/done/39-meerkat-public-base-feed.md`.
- **NC-6** A `killed`/`unpublished` publication must NOT be served or discovered after propagation.
- **NC-7** The archive must NOT claim permanent / "forever" hosting beyond a real pinned host; a self-host archive must be labeled public-only-while-online.
- **NC-8** A consent-less or rights-less publish must NOT reach the durable archive or the public directory.
- **NC-9** Durable archive hosting at scale must NOT be framed as free / unlimited; it is paid managed hosting or free self-host (online-only), with usage from real host stats (cross-ref Plan 22).

---

## 12. Test Plan + Verification Tiers

Tier ladder (from `packages/sync/CLAUDE.md` e2e posture):
- **Tier A** — pure unit, in-memory (`protocol/*` functions). Deterministic.
- **Tier B** — DB-backed integration, single process (app helpers + schema + policy).
- **Tier C** — cross-client e2e: two real engines over a LIVE relay + a real `public-directory-node` + a real `seeder`/`community-node` (real bytes).
- **Tier D** — deployed soak: a real production relay + directory + always-on host under load; ops/manual.

| Area | Tests | Reaches |
|---|---|---|
| `publication.ts`, `public-snapshot.ts`, `public-directory.ts` | unit round-trips, fail-closed, forgery rejection | **A** |
| inbound-policy scope cap (cp vs cm) | unit + DB | **A/B** |
| app schema + sync-policy + feed wiring | integration | **B** |
| publish -> discover -> read -> report -> unpublish | two-engine e2e over live relay + live host | **C** |
| public read rate caps, 429, oversize | e2e | **C** |
| Discover/Reader/Publish UI 5 states | `/browse` mobile + web | **B** (UI) |
| `public-archive.ts` (archive job + rights + consent + dedupe key) | unit round-trips, fail-closed, consent/rights-required, dedupe-key stability | **A** |
| durable pin + host moderation queue + scan hook + takedown | two-engine e2e over live relay + real community-node/seeder | **C** |
| Deployed public directory + always-on host under real load | **manual / ops** — owned by Connectivity+Self-Hosting + Launch Readiness | **D (remains manual)** |

**Remains manual/ops:** standing up the production public-directory-node + always-on serving host, NAT/TLS, the GHCR image publish for the new directory image, real provider-cost backfill of the hosted-pricing ledger (`hosted-pricing.ts:133-135` illustrative), the at-scale malware/AV scanner + abuse-/CSAM-hash-set deployment and updates feeding the §9A.6 host moderation queue, durable-archive retention/cap ops (Plan 22), and App/Play store review of a public-content app (UGC + moderation policy compliance).

---

## 13. Edge Cases
- **No source configured (default):** Discover shows the error/empty state; Feed Public stays hidden; identical to today's honest behavior.
- **Source configured but offline:** probe fails -> error state + retry; nothing fabricated.
- **Partial host set:** publish to 3 hosts, 1 accepts -> "Published to 1 of 3 hosts"; reads succeed from the one that accepted.
- **Stale/older revision served by a malicious host:** revision-chain monotonicity rejects it (`community-node.ts:122-145`).
- **Tampered snapshot piece:** skipped fail-closed; reader shows "{k} items skipped (failed verification)".
- **Publisher goes offline (self-host):** content becomes unreadable until a host is back; reader error copy says exactly that.
- **Owner unpublishes while a reader is mid-scroll:** next pull 404s -> reader error state; cached verified rows may remain until refresh (honest: cache shows `fetched_at`).
- **Empty community/channel publish:** guarded (`"Add at least one post before publishing."`).
- **Oversize snapshot:** built + served in FULL (never truncated), flagged oversized for re-baseline (`community-snapshots.ts:90-101`).
- **Category/term spam:** per-owner publish caps + `evaluatePublishBoundary` throttle.
- **Reply-to-public-post privacy:** a public reply is public (audience inherits, `audience-rule.ts:151-152`); a PRIVATE reply to a public author is out-of-scope here and routes to the DMs plan — copy must not imply private reply exists until that lands.
- **Module disabled / app reset mid-publish:** publication descriptor is signed + idempotent by id; re-publish is safe.

## 14. Risks + Honesty Landmines
1. **Hard dependency on a deployed serving source.** Until Connectivity+Self-Hosting ships a real relay + directory + host, this feature must REMAIN hidden (do not flip the Feed control or the hosted-boundary rows on a fabricated source). Landmine: shipping Discover with a stubbed/seeded "demo" directory would violate the honesty rule. Mitigation: `publicSourcesAvailable` is computed from a real probe only; with no source the UI is the honest empty/error state.
2. **Fabricated trending.** The biggest temptation is view/like/engagement counts. Mitigation: trending uses ONLY verifiable signals (real announcing-host count, signed event count, recency). No analytics, no telemetry.
3. **Public read DoS.** Open endpoints are the new attack surface. Mitigation: a real per-IP/edge request+byte limiter on the open HTTP read routes (XFF-keyed at Caddy + an in-process limiter, §5.4) — distinct from the WS relay's per-connection/global/per-IP-connection-count caps (`protocol.ts:17-66`), which do not throttle these routes — plus per-publication byte ceilings and 429-not-fake-success.
4. **Metadata exposure.** Public directory reveals titles/categories/owner keys by design; recommend pseudonymous community profiles; document clearly. Landmine: exposing the user's MAIN identity. Mitigation: publish under `cm_profiles` pseudonym; reader banner states public is not private.
5. **Moderation / legal (UGC).** A public layer invites CSAM/illegal content and app-store UGC review. Mitigation: signed reports + owner-review-at-scale + signed `DescriptorKill` takedown + priority CSAM/illegal flags; this is a launch-readiness gate, not a code gate.
6. **Pricing inconsistency.** The repo has three meanings of "$4.99" (`m-hosted-paywall.md` §6). Landmine: publish-flow copy must read the hosted-serving price from `billing-config` and frame it as MONTHLY hosting capacity, distinct from any one-time app price. Reconcile with the Monetization+Billing plan before shipping copy.
7. **Scope-cap regression.** A future refactor that lets `cm_messages` reach `published_blob` would silently leak private content. Mitigation: TC-1 + NC-1 are permanent regression tests; the inbound-policy gate is the enforced boundary, not the UI.
8. **"Forever archive" overclaim + free-unlimited-storage illusion (§9A).** Calling it a "forever" archive tempts a permanence claim no real host backs, and a public archive tempts an implied free-unlimited store. Mitigation: NC-7/NC-9, self-host is labeled public-only-while-online, durability beyond that is paid always-on managed hosting (Plan 22), viewing is free, and every byte shown comes from real `SeederNodeStats`/`HostedTenantStats`, never a fabricated or estimated number. Landmine: showing a "scanned & safe" badge before a real scan result returns; mitigation: the scan STATE is `scanning…` until a real `clean` result (TC-10).
9. **Rights/provenance are claims, not verification.** The license + rights-assertion + provenance a publisher attaches (§9A.4) are self-declared, not platform-verified; presenting them as verified would be dishonest. Mitigation: the reader surfaces them verbatim and states they are publisher claims; the DMCA/takedown path (`DescriptorKill`, §9A.7) is the real remedy, and DMCA-agent registration is a founder/legal ops item (archived `09-...:23`).

## 15. Sequencing vs the other 5 Meerkat launch plans
- **Theme System** (soft dep): Discover/Reader/Publish consume Open Burrow tokens; build after tokens stabilize to avoid re-skinning.
- **Connectivity + Self-Hosting** (HARD dep): provides the deployed relay + the new public-directory-node + at least one always-on serving host and a non-empty reachable source. This plan's P3/P4/P7/P8 cannot reach Tier C/D without it. Engine phases P0-P2 can proceed in parallel against the live-relay e2e harness.
- **Monetization + Billing** (soft dep): the PAID managed-serving tier (entitlement + Stripe wiring for `MEERKAT_HOSTED_MONTHLY_PRODUCT`). The FREE self-host path ships without it; the paid path lights up when billing lands. The **Public Archive / Forever Archive** (§9A) shares this axis: durable hosting at scale consumes server space, so its storage/quota/cap/meter lives in Plan 22 (real `SeederNodeStats`/`HostedTenantStats`, `docs/plans/done/22-meerkat-monetization-and-billing.md:61,78-79`); viewing the archive is always free, and durability beyond self-host (online-only) is the paid managed tier.
- **Full DMs** (seam only): "reply privately to a public author" routes to the DMs plan (Plan 21); public replies are public. No shared schema; only a copy seam. **Frozen read-API contract (reciprocal with Plan 21):** any surface here that ever shows opt-in DM content as a feed source MUST go through Plan 21's frozen seam — `listFeedOptInConversations()` / `getFeedSourceMessages()`, hard-filtered `WHERE feed_opt_in = 1` (default `0` ⇒ empty), which throws if asked for a non-opt-in conversation. This plan does NOT define or read DM tables directly and does NOT auto-include any DM content; the public layer only un-gates the `public` feed control, never the DM source. Plan 21 owns the seam; this plan consumes it read-only if/when opt-in DM-in-feed is surfaced.
- **Launch Readiness** (this BLOCKS it): public reach is a headline launch claim and a UGC-moderation compliance surface; cannot be marketed or store-submitted until this lands behind a real source with moderation live.

Recommended order: Theme -> Connectivity+Self-Hosting -> **Public Social Layer (this)** in parallel-engine-first -> Monetization+Billing (lights paid hosting) -> Full DMs -> Launch Readiness.

## Status Delta (2026-07-04)

- Code-complete P0-P9 + FF1-FF6, verified against code in the 2026-07-04 production audit.
- Correction to the 2026-07-01 delta: FF3 owner-side dispatch IS wired end to end. The `PUBLIC_JOIN_REQUEST` case lands at `packages/sync/src/protocol/mailbox-dispatch.ts:308` and the owner Approve/Decline UI shipped 2026-07-01 (commits 1cec0347..a4621e7b).
- No codeable work remains on this plan.
- Remaining is founder-ops only: relay, community node, and public directory node deploys (runbook section 2).
- The launch-finish branch is fully merged to main and pushed (merge bcb45871).
