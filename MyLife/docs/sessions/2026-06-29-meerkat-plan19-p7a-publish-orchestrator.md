# Meerkat Plan 19 P7a — Publish Execution Layer

Date: 2026-06-29
Branch: `feature/meerkat-public-social`

## Scope

Plan 19 §7.3 (publish execution), §7.4 (hosted boundary state transition), §10 P7 step 1-exec + 2 + 3. The publish-sheet UI is P7b (later); this is the EXECUTION layer only.

## What was built

### 1. Publish orchestrator (mobile + web byte-parity)
- `apps/meerkat/app/(root)/data/public-publish.ts` (new) + web twin `apps/meerkat-web/src/lib/public-publish.ts` (new). Byte-parity on all shared logic; the only difference is the channel-event read import (`./community-core` mobile vs `./meerkat-data` web), exactly like feed-core.
- `publishChannelPublicly(deps, input)` drives the REAL P0-P4 path:
  1. List the channel's signed events (`listChannelMessageEvents`). Zero events -> Empty state ("Add at least one post before publishing."), no snapshot built.
  2. `buildPublicSnapshot` with a fresh random 32-byte published key + a throwaway in-memory `SnapshotPieceStore`. `contentId = record.infoHash` (content-addressed, not publicationId-derived; build FIRST).
  3. `createPublication` over the real contentId (publicationId derives from the signed descriptor).
  4. POST `{host}/public/{publicationId}/register` per host with `{descriptor, snapshots:[{channelId, epoch:0, manifest, pieces: base64[]}]}` (pieces base64 via tweetnacl-util). Per-host accept/reject -> Success / Partial ("Published to {m} of {n} hosts.") / Error.
  5. On >=1 accept: `announcePublication` + `announceHeldContent` for each accepting host (so it appears in Discover with a real announcing-host count).
  6. Persist a local `cm_publications` row (signed descriptor) so the owner can later unpublish.
- Returns `PublishResult { state, message, detail?, publicationId, link (meerkat://public/{id}), hosts[], announced }`.
- `PUBLISH_COPY` exports the verbatim §7.3 5-state strings (loading/empty/error-no-host/error-rate-limited/success/partial) + the publish-sheet strings P7b reuses (confirm, audience hosted notice, host field, self-host path, hosted path with price).

### 2. hosted-boundaries state transition (mobile + web)
- `public_posts` / `public_feed` rows are now STATE-DRIVEN via `publicReachItem`:
  - no source -> `unavailable` / "Hidden", unchanged copy.
  - `publicSourceConfigured && publicSourceResponded` -> `local_only` / "Self-served", verbatim §7.4 detail.
  - `hasPublicHostedEntitlement` -> `included` / "Hosted", verbatim §7.4 detail.
- New builder inputs: `publicSourceConfigured`, `publicSourceResponded`, `hasPublicHostedEntitlement` (all default false). `included` only lights up on a real entitlement, which is honestly default-false (no provider wired; founder-ops).

### 3. Billing price reachable
- `HOSTED_MONTHLY_PRICE` / `formatHostedPrice` / `hostedServingPath` read `MEERKAT_HOSTED_MONTHLY_PRODUCT.price` from `@mylife/billing-config` (4.99) — never hardcoded. Added `@mylife/billing-config` + `tweetnacl-util` deps to both apps.

### 4. Live e2e
- `packages/meerkat-relay/src/__tests__/public-publish-app-e2e.test.ts` (new): stands up a LIVE relay + public-directory-node + community-node, imports the SHIPPING app orchestrator at RUNTIME (string-specifier dynamic import to avoid the relay tsconfig rootDir TS6059 boundary; signature pinned to a local structural type), seeds real signed channel events into an in-memory db, publishes, then a SECOND device `browsePublications` + `fetchPublicSnapshot` discovers, pulls, and verifies the bytes from the real serving host. Also asserts the empty-channel guard (Empty, no POST) and the bad-host guard (Error, nothing persisted/announced).

### 5. Parity test
- Added two blocks to `apps/meerkat-web/src/lib/__tests__/post-schema-v2-parity.test.ts`: public-publish twin parity (verbatim PUBLISH_COPY, orchestrator symbols, price-from-billing-config, no hardcoded price) + hosted-boundaries public-reach parity (state-driven inputs + verbatim §7.4 detail).

## Honesty boundaries (deferred, not faked)
- Self-host path is fully real: the host URL the user pastes is the box that serves the bytes (verified by 200 from register). No host accepted -> honest Error state, no announce, no persist.
- The PAID managed-serving endpoint is NOT wired (founder-ops). PUBLISH_COPY surfaces its price for the sheet but P7a lights only the real self-host path.
- The hosted entitlement input defaults FALSE; `included`/"Hosted" only appears when a real entitlement is wired. No fake entitlement provider.

## Verification (all green)
- `pnpm --filter @mylife/meerkat-app typecheck` + `test` (212 tests).
- `pnpm --filter @mylife/meerkat-web typecheck` + `test` (97 tests incl. parity).
- `pnpm --filter @mylife/meerkat-relay typecheck` + `test` (171 tests incl. 3 new e2e).
- `node scripts/check-meerkat-parity.mjs` PASS.
- `pnpm gate:function:changed` exit 0 (incl. hub mobile/web consumer typechecks).

## Files changed
- new: `apps/meerkat/app/(root)/data/public-publish.ts`, `apps/meerkat-web/src/lib/public-publish.ts`, `apps/meerkat/app/__tests__/public-publish.test.ts`, `packages/meerkat-relay/src/__tests__/public-publish-app-e2e.test.ts`
- edited: `apps/meerkat/app/(root)/data/hosted-boundaries.ts`, `apps/meerkat-web/src/lib/hosted-boundaries.ts`, `apps/meerkat/app/__tests__/hosted-boundaries.test.ts`, `apps/meerkat-web/src/lib/__tests__/post-schema-v2-parity.test.ts`, `apps/meerkat/package.json`, `apps/meerkat-web/package.json`, `pnpm-lock.yaml`

## Seam gaps / notes for P7b
- The publish SHEET UI (AudienceSelector wiring, host-URL probe, self-host vs hosted chooser, confirm button enable logic) is P7b; P7a exposes all the verbatim copy + price helpers it needs.
- The relay e2e drives the real app orchestrator via a runtime dynamic import because a static cross-package import breaks the relay's `tsc` rootDir (TS6059, the documented boundary the multi-node guard also works around). The function is REAL; only the module load is deferred to runtime.
