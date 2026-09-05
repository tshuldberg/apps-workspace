# 2026-08-29: Plan 56 C0, the composition spine (composition plan Phases 0 + 1)

## What

Plan 56 (Meerkat Canvas) execution began. C0 = the composition plan's Phase 0
and Phase 1, which Plan 56 depends on and which did not exist on main
(verified: no CORE_TWINS, no cm_layout, no packages/meerkat-layout, no block
registry). Branch `feature/meerkat-plan56-c0-composition-spine`, two commits.

### Stage 0 findings (recorded before any code)

- All plan-referenced seams verified in source; no plan-vs-code contradictions.
  The composition report's three binding corrections hold (descriptor append
  mechanics at community.ts:180-238, single trailing organization slot,
  imperative parity script with unlocked cores).
- Correction 1.3 confirmed live and WIDER than documented: beyond the six named
  cores, call/dm/friends/presence/room/photo/storage cores also had no locks.
- Open Brain MCP tools not exposed in the session despite `claude mcp list`
  showing connected; captures skipped and noted, not faked.
- `docs/plans/active/` contained only stale entries (38/52/53 merged); no
  scope conflict. Plan 56 moved queue -> active.

### Phase 0 (commit 475cd4ae): CORE_TWINS registry + core meta-guard

- `scripts/check-meerkat-parity.mjs`: every pure-core twin lock is now ONE
  declarative CORE_TWINS registry (40+ tuples: full-file, anchored, or bounded
  by an end marker) plus a meta-guard that enumerates every mobile
  `data/*-core.ts` (+ storage-destinations + out-of-convention cores) and
  FAILS when a core has neither a lock entry nor a documented exception.
  Exceptions carry verified reasons (measured drift, mobile-only, platform
  seams). Mutation-tested: a fake core and an injected drift both FAIL.
- Real remediations, not just locks: join-flow unified (deps seam via
  joinFromLink/runPostJoinDrain closures; mobile now maps the `killed` reason
  to the honest blocked-community copy; the three legitimately platform-
  divergent notices moved to JOIN_PLATFORM_COPY preambles); feed-view-core
  perf helpers mirrored to web; isLibraryItemContentHeld mirrored to mobile
  library-store-core; library-reader-core's mount seam moved below a bounded
  lock marker on both surfaces; add-friend-core's web-only line moved to the
  platform preamble. twinLogicLines gained three sanctioned import-path
  normalizations ('./db', chat-kit depth, format path).
- Feed source toggles persist to mk_settings (`feed_controls`) with a
  fail-safe parser, both surfaces, unit-tested.

### Phase 1 (commit on branch): the platform spine

- `packages/meerkat-layout`: layout-document codec (prefix
  `meerkat-layout:v1:`, 32 KB cap, CRC, strict Zod; unknown block types and
  capability slugs are the ONLY forward-compat holes, both fail-safe
  downstream). 14 tests.
- `packages/sync/src/protocol/community-layout.ts`: owner-signed cm_layout
  events, line-for-line on community-identity; validator registered in
  SIGNED_ROW_VALIDATORS (forgery dies before INSERT, DELETE rejected);
  canonical bytes locked by a frozen signature fixture
  (`fixtures/legacy-community-layout-event.json`, never regenerate). 18 tests.
- cm_layout DDL + rules both surfaces; existing rule-less guards cover it.
- block-registry-core + community-layout-core + block-queries (parity-locked
  twins): 16 block contracts, strict schemas, no-URL invariant, two-layer
  capability honesty (declared is never available), default stacks for 9 new
  channel kind VALUES (chat/library keep dedicated surfaces; old clients get
  the unknown-kind banner per correction 1.1), resolveActiveLayout fail-safe
  to legacy, per-node degradation.
- Renderer maps + BlockStack + BlockPlaceholder both surfaces; 7 renderers
  shipped (hero/chat/posts/gallery/files/members/page); gated or
  renderer-pending blocks show honest cards. block-data-scope guard tests.
- Surfaces: mobile community home renders a composed layout above the
  always-present channels panel + settings (2.4 floors); block-backed kind
  channels render Blocks | Chat; web gains the home pane +
  OPEN_COMMUNITY_HOME + sidebar Home entry (only when a VERIFIED document
  exists) + the same channel wiring.
- Layout editor both surfaces with an Edit | Preview mode switch (founder
  request mid-session: preview one tap away at all times), live preview
  through the real registry, per-block config sheets, capability toggles,
  publish/reset (signed rail), template copy/import via codec deep link.
- The composition Phase 1 "local-only toggle UI" already existed
  (CommunitySyncPolicySection, Plan 27); verified, no work needed.

## Verification

Per phase: mobile 1547, web 1074, sync 2558 (+18 layout, 14 codec) tests;
typechecks; `check-meerkat-parity` (incl. the new meta-guard); full
`check:parity`; transport NC gate; `gate:function:changed`; pre-commit gates.

## Remaining in Plan 56

C1 (Canvas core) next, then C2-C5. C6 stays locked. Open Brain capture
skipped (tools unavailable in session); carry forward.
