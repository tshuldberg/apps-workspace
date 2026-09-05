# 2026-07-05: Meerkat Plan 38 Codex review + Phase 0 engine foundations

## What was done

1. **Codex (gpt-5.5) engineering review of Plan 38** (`codex exec -s read-only`,
   full-code verification). Verdict REJECT-as-build-ready: 3 BLOCKERs, 3 HIGHs,
   4 MEDIUMs. Every finding re-verified against the code by the lead
   (rowCommunityId/evaluateChannelPost/generic-insert claims confirmed in
   sync-session.ts). All 10 folded into the plan as a BINDING
   "Codex Engineering Review Amendments (2026-07-05)" section; plan moved
   queue -> active. Estimate re-corrected to 25-35 CC days (scope unchanged).
2. **D.3 sealing decision RESOLVED**: library blobs are sealed shares
   (at-rest chunk encryption, plaintext-Merkle contentId, signed manifest)
   whose per-object DEK wraps under the workspace epoch key inside the signed
   library row (`key_epoch` + `wrapped_key`). historyScope governs late
   joiners; removal boundary same as messages; dedup stays within-workspace
   (plaintext-oracle-safe).
3. **Phase 0 sync-package foundations shipped** (3 commits):
   - `6fd56a21` descriptor organization fields (channels[].kind/categoryId/
     order/topic/archived + categories + layout) via CONDITIONAL canonical
     append; frozen pre-change fixture proves legacy signatures verify
     byte-for-byte (D.6); fail-safe readers (channelKind 'unknown', layout ->
     chat_first, orderedChannels); cm_community_identity protocol module
     (owner-signed, caps at create AND verify, tombstone-able,
     resolveCommunityIdentity latest-verified-revision-wins). Plus fix:
     ensureSyncColumn missing-table guard (pre-existing 2-test failure from
     Plan 29 P0 on this branch; errors_log row added, Resolved).
   - `84b7...` (library objects) `protocol/library-objects.ts`:
     deriveEpochLibraryWrapKey (domain meerkat-library-wrap-v1),
     wrap/unwrapLibraryObjectKey, unwrapLibraryObjectKeyForDevice,
     sealLibraryObject/openLibraryObject. Tests prove join_point locks
     pre-join items, full back-wraps open them, removed member cannot read
     post-removal items, ciphertext at rest, fail-closed opens.
   - (validator seam) `protocol/inbound-row-validators.ts` wired into
     applyReceivedDocumentChanges after the channel gate: registered
     owner-signed tables verify BEFORE insert; raw DELETEs rejected
     (signed tombstone is the sanctioned delete); row<->event mapping
     single-sourced in community-identity. 7 apply-time forge tests.

## Verification

- sync suite 1674/1674 green (was 1646 with 2 pre-existing failures).
- `pnpm --filter @mylife/sync typecheck` green; barrel parity green
  (all new symbols exported from BOTH index.ts and index.native.ts).
- tsconfig include gained `src/**/*.json` for the frozen fixture.

## Remaining Phase 0 (tracked in session tasks)

- Library tables DDL + scope rules + zod metadata registry + smart-rule rows
  + quota accounting (app side, both surfaces; items carry community_id +
  channel_id per Codex amendment 2; progress = cm_library_progress at
  personal_replica).
- D.4 NodeStore context-aware API (contentId, workspaceId) + sealed-block
  refcounts, ExpoNodeStore + browser-node-store.
- Sealed-object session transfer leg (collectBlobRefs extension) + two-node
  e2e.

## Decisions

- The Codex review SERVES AS the required /plan-eng-review (same agenda,
  deeper code grounding); recorded in the plan's GSTACK table.
- Validator posture: unknown community fails CLOSED (row re-syncs after the
  descriptor lands); read-time verification stays as the rendering floor.

## Phase 0 completion addendum (same session, later)

- App substrate landed via two parallel module-dev agents + lead integration:
  library DDL + explicit scope rules (cm_library_progress locked at
  personal_replica) + library-metadata-core twins (zod registry, fail-safe
  unknown media/rule types, 16 KB cap, quota helper) on both surfaces;
  D.4 context-aware NodeStore (pin_context PK rebuild, pin_class column,
  sealed-block refcounts) across InMemory/Expo/browser stores.
- Two-node e2e (Phase 0 exit) caught a REAL engine-convention bug: inbound
  apply injects id=rowId when data.id is absent and buildInsertSql does not
  filter to real columns, so an id-less synced table fails INSERT silently
  (swallowed by the per-change catch). cm_library_items and
  cm_library_progress now carry id TEXT PRIMARY KEY (cm_read_state
  precedent). RULE FOR FUTURE TABLES: every synced table carries an id column
  equal to the sync rowId.
- Final: sync 1687/1687, app 719/719, web 484/484, 3 typechecks, Meerkat
  parity, artifact guard. Branch pushed to origin.

## Track A completion addendum (same session)

- Phase 1 (identity + retheme, commits through 131af702): 1a protocol media
  rework (in-row icon under the avatar gate; banner = sealed library object
  with epoch-wrapped DEK + banner_manifest_json feeding the blob collector);
  1b resolveActiveTheme pure twin choke point + owner-gated identity data
  layer; 1c UI both surfaces (agents theme-core/ui-mobile/ui-web) with D.2
  provider boundary + leakage tests and 6 parity-locked state strings.
- Phase 2 (organization, ec3dd964, agents org-mobile/org-web + lead): W2
  channel-creation fix (regression-tested), draft channel manager with
  ONE-revision-per-save batching, category groups + unread rollups, archived
  channels read-only (banner + composers hidden, lead-reconciled on mobile),
  device-local mk_community_prefs (pin/reorder/folders, 'Only on this
  device'), 5 parity-locked strings + prefs DDL twin lock, engine gossip
  round-trip exit test (c8ef85e0).
- Known flake: saveFilesBulk perf slope gate fails under concurrent test
  load, green in isolation (pre-existing pattern).
- Track B started: lib-data agent building the Phase 3 personal-first library
  data layer.

## Track B progress addendum (same session)

- Phase 3 data layer (f643435e, agent lib-data): library-data-core twins
  (create/add/list/tombstone/ingest/progress), within-workspace dedup proven
  block-count-neutral and never cross-workspace, verified-only read models,
  parity twin lock.
- Phases 4+5 (514d39a5, agents meta-pipeline/browse-mobile/browse-web):
  extraction twins (filename parsers, XXE-hardened bounded NFO, pure-byte GPS
  strip verified on output bytes, consent default OFF), lazy probe seams,
  BYO-key enrichment with receiver-never-fetches throwing-fetch tests;
  personal My Library hub both surfaces (On Deck/Recently added from real
  rows), per-media-type browse grids w/ windowed 10k perf, item detail w/
  Held-on-this-device badge, Library|Chat segments for library channels, all
  3 ingest paths + dedup notice. 2 twin locks + 9 string locks added.
- Phase 6a loopback core (943d79ba, agent loopback-core): pure range-server
  protocol (token-in-path constant-time+TTL, RFC7233 ranges, fail-closed
  per-chunk verified streaming decrypt), 45 tests over real sealed fixtures.
- In flight: playback-web (MSE matrix + sealed cbz/epub readers) and
  playback-mobile (tcp glue + expo-video + music queue + mobile readers).
- Suites at last checkpoint: mobile 870/870, web 588/588, parity green.

## Session close (Plan 38 coding complete)

Waves after the last addendum: Phase 6 playback (loopback pure core 45 tests
+ mobile glue w/ expo-video/music queue/sealed readers; web MSE matrix +
sandboxed cbz/epub readers), Phase 7 (templates all-or-nothing, library_first,
theme share/adopt, C.7 storage model + C.2 stats), C.10 notification identity
(verified-only, preset ids, dev-build flag), C.6 photo timeline + offline map
(checksum-verified whole-pack tiles, consent copy, no per-location queries).
Docs: meerkat CLAUDE.md/AGENTS.md resynced with the Plan 38 section.
Final chain all green (sync 1692 / relay 347 / mobile 953 / web 643+ / 4
typechecks / full check:parity / artifacts). 20+ commits pushed through
730576fb. Founder-ops handoff recorded in the plan Status Delta.
