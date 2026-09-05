# Plan 57: Meerkat Community Servers (the Realms Pattern)

- **Project:** Meerkat (`apps/meerkat/`, `apps/meerkat-web/`, `packages/sync/`, `packages/meerkat-relay/`)
- **Created:** 2026-09-01
- **Source review:** `apps/meerkat/docs/reports/REPORT-meerkat-community-server-onboarding-2026-08-31.md`
- **Status:** active (execution started same session on branch `worktree-meerkat-community-servers`)
- **Founder mandate applies:** full production-grade function, no deferred slices. Founder said "Begin" on 2026-09-01.

## Goal

Wire the already-built, orphaned always-on community node into the product so a community can live on a server: client writers (snapshot publish + tail append), host lifecycle (populate `descriptor.hosts`, settings UI, exit), entitlement bearer, durable join queue with admin delegation, and Discord-grade onboarding, per the Realms pattern (only the creator ever sees an infrastructure choice; everyone else sees an invite link).

## Verified starting reality (all re-checked at branch base)

- Server: `packages/meerkat-relay/src/community-node.ts` + `community-node-http.ts` fully implement challenge/manifest/publish/append/piece with rate limits, per-community scoping, descriptor revision monotonicity, and an optional hosted-entitlement bearer gate (`requireHostedEntitlement`, `Authorization: Bearer`, via `@mylife/entitlements` `verifyHostedFeatureEntitlement`).
- Client: `packages/sync/src/node/feed-node-client.ts` exports ONLY `pullCommunityFeed` + `republishCommunityDescriptor`. No content writer exists.
- App: `buildOwnedCommunitySnapshots` / `buildCommunitySnapshotsForId` already build + persist rolling snapshots into `cm_snapshots` with a `SnapshotPieceStore`, but nothing app-side calls them and nothing publishes the result anywhere.
- `createCommunity` omits `hosts` at all 6 call sites; `reviseCommunity` already accepts `changes.hosts`; the invite already carries the whole signed descriptor (including `hosts`).
- Wire contracts (verified): publish body `{descriptor, snapshots: [{channelId, epoch, manifest: object, pieces: base64[]}]}`; append body is one JSON `SealedTailEntry` (built via `signSealedTailEntry` over `encrypt(eventJson, deriveEpochContentKey(secret, communityId, epoch))` with nonce prepended); auth headers `x-mk-device/nonce/ts/sig` from `signFeedAuth` after GET `/challenge`.

## Phase 1: W1 client writers in `@mylife/sync` (protocol layer)

1. `publishCommunityFeed(input)` in `feed-node-client.ts`: challenge → signFeedAuth → POST `/community/{id}/publish` with descriptor + snapshot records read from a `SnapshotPieceStore` (pieces base64-encoded), optional `entitlementToken` sent as `Authorization: Bearer`. Fail-closed result union mirroring pull (`challenge_failed | auth_rejected | http_NNN | reason`).
2. `appendCommunityTail(input)`: seal ONE `ChannelMessageEvent` with the epoch content key (nonce + secretbox, matching `openTailEvent`), `signSealedTailEntry`, challenge + auth, POST `/append`, same result honesty. Also accepts optional bearer.
3. Add optional `entitlementToken` to `pullCommunityFeed` + `republishCommunityDescriptor` (backward-compatible) so entitlement-gated nodes work end to end.
4. Export from both barrels (`index.ts`, `index.native.ts`).
5. Tests: round-trip against the REAL `CommunityNode` (in-memory store) like existing node tests: publish from client → pull from a second member → events verify; append → pull sees tail event; wrong member 401 verbatim; entitlement-gated node rejects missing bearer and accepts a valid one.

## Phase 2: W2 host lifecycle (both surfaces, verbatim twins)

1. `setCommunityHost(db, owner, communityId, url)` / `clearCommunityHost` in `community-core.ts` (+ web twin): `reviseCommunity` with `hosts`, persist via the existing descriptor-update path, republish descriptor to the node (`republishCommunityDescriptor`) when adding, and record the change over the engine so members replicate the revision.
2. "Community server" section in community settings (owner-only, both surfaces): paste/verify a host URL (real `GET /healthz` probe before accepting, candidate-until-verified honesty), show current host with probe state, remove (community exit). No online counts, no fake states.
3. Honest availability line derived from descriptor + probe cache on community screens (C5 copy table from the report).

## Phase 3: W1/W2 wiring (append-on-send, publish job, bearer)

1. Send path: after a channel message records locally, if `communityNodeUrl()` is non-null, best-effort `appendCommunityTail` (async, non-blocking; failures logged to the existing session/audit surface, never faked as delivered). Applies to channel + post + react sends on both surfaces.
2. Snapshot publish job: owner devices run `buildCommunitySnapshotsForId` + `publishCommunityFeed` on community open + after N appends (reuse `runCommunitySnapshotJob` thresholding), throttled like `syncAutomaticCommunityHistory` (5 min).
3. Mint the hosted bearer client-side when the build carries the entitlement secret config; absent config = honest `not_configured` (account-core pattern), gate stays open for self-hosted nodes that do not require entitlement.

## Phase 4: W4 durable join queue + admin delegation

1. Node: durable, restart-surviving parked join-request store (Postgres/file store like descriptors), routes to park (joiner) and drain (owner/admin, feed-auth gated), TTL days not minutes; per-device rate limits.
2. Client: park `JOIN_REQUEST` to the community node when the descriptor has a host (fallback stays relay mailbox); owners/admins drain on app open; joiner honest copy "waiting for an organizer's device".
3. Admin delegation: grant-minting from admin devices (invite verification already validates admin inviters).

**Phase 4 execution note (2026-09-01):** items 1-2 SHIPPED (durable queue with memory+file stores, TTL clamp 1h-30d, per-box/per-community caps, notify seam; park/box/ack routes entitlement-gated + per-IP limited; DATA_DIR/joins in the bin; sync client + drain helper; both providers park host-first and drain host boxes before the relay short-circuit). Item 3 (admin grant-minting) is NOT shipped and cannot be shipped soundly on the current protocol: `reviseCommunity` is owner-signature-only, so an admin cannot produce the signed roster revision a grant requires -- the node's revision monotonicity and every apply-side membership check would reject it. A real implementation needs an owner-countersigned delegation primitive (an owner-signed grant-authority certificate admins present, verified at apply). That protocol design goes to a follow-up plan; until then the durable queue + notify already collapse the join window from 5 minutes to days.

## Phase 5: gates and docs

- `pnpm --filter @mylife/sync test` + typecheck; `pnpm --filter @mylife/meerkat-relay test`; `pnpm --filter @mylife/meerkat-app test` + typecheck; web twin tests; `node scripts/check-meerkat-parity.mjs`; `pnpm gate:function:changed`.
- Codex review of the diff. Session log + memory rows. Conventional commits per phase on the worktree branch; merge to main only after full battery.

## Deferred to follow-up plans (not scope cuts; separately shippable waves per the source report)

- W3 full billing provisioning UI (Stripe/hosted one-tap "Meerkat Keeper" provisioning needs the deployed hosted-api; the client entitlement seam ships here).
- W5 fleet deploy + announce cron (founder-ops).
- W6 onboarding polish (rules screening, first-task guide) and W7 directory, W8 instant-join links: next plan file, they depend on this plan's rails.

## Scope

- `packages/sync/src/node/feed-node-client.ts`, barrels, `__tests__`
- `packages/meerkat-relay/src/community-node*.ts` (join queue), `__tests__`
- `apps/meerkat/app/(root)/data/community-core.ts`, community settings screens, SyncProvider seams
- `apps/meerkat-web/src/lib/meerkat-data.ts`, `MeerkatProvider.tsx`, community settings UI
- `scripts/check-meerkat-parity.mjs` if new locked strings are added
