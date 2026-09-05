# Plan 38: Meerkat Community Organization, Per-Community Retheming, and the Data Hub (Plex-style Libraries)

> Founder direction (2026-07-04): "Users should be able to organize and retheme
> any of their servers. Someone should also be able to use it as a data hub
> similar to how Plex sorts movies, if they want to design it that way."
> This plan closes every gap between today's code and that capability, at full
> function per the no-deferral mandate, on BOTH surfaces (apps/meerkat +
> apps/meerkat-web).

## Metadata

- **Surfaces:** `apps/meerkat`, `apps/meerkat-web`, `@mylife/sync` (protocol + policy), `@mylife/meerkat-theme` (extend, do not fork).
- **Terminology (binding):** the founder's "server" = a Meerkat **community** (the Discord sense of "server"). It is NOT the "connection server" (relay). All UI copy in this plan says "community"; the plan title keeps the founder's framing.
- **Priority:** Post-launch-completion feature track. Runs AFTER Plan 37's waves (launch blockers first); Phase 0-2 can interleave with late Plan 37 work because they own different files, except the W2 channel-creation fix dependency noted below.
- **Complexity:** Massive (0) for the full plan; each phase individually Large (2). Route per pipeline: `/plan-eng-review` before build, `/plan-design-review` on Phases 1, 2, 5, 7 UI, all gates per phase.
- **Estimated CC time:** 10-14 days across 9 phases (parallelizable: Track A = Phases 0-2, Track B = Phases 3-7 after Phase 0).
- **Depends on:** Plan 37 Wave 1 (landed); the W2 broken trace fix (mobile channel creation, tracked in Plan 37) must land before Phase 2's channel manager. Plan 22 (billing) only for storage-tier COPY in Phase 8; no hard dependency.
- **Blocks:** nothing in the launch set. Feeds the investor-story "Plex of private networks" positioning.

## Business context

### Why this exists

Two retention engines the current product lacks:

1. **Self-expression at the community level.** Plan 18 gave the USER a theme;
   nothing gives a COMMUNITY an identity. Discord servers have icons, banners,
   roles-colored looks; Plex servers have curated libraries with cover art.
   A Meerkat community today is a name string and a channel list. Owners who
   invest identity into a space do not abandon it, and members recognize and
   trust spaces visually.
2. **A second product shape from the same substrate.** Every Meerkat community
   is already a synced, encrypted, membership-gated content store with a blob
   pipeline, quotas, and per-file verification. That IS a private Plex, minus
   the metadata model and the browse/playback UX. Building the library layer
   turns "private chat app" into "private everything hub" (family media
   libraries, club archives, course material hubs) with zero new crypto and a
   direct upsell path into hosted storage tiers.

### Competitor frame

| Product | Community identity/theming | Media library UX | Gap Meerkat exploits |
|---------|---------------------------|------------------|---------------------|
| Discord | Icon/banner; look gated by Nitro | None (files are a stream) | Free full retheme per community; E2EE |
| Plex / Jellyfin | n/a | Best-in-class libraries, metadata, posters | Cloud-readable (Plex) or self-host-ops-heavy (Jellyfin); neither is social or E2EE |
| Telegram | Chat wallpapers, channel avatars | None | Signed, serverless community themes |
| Google Drive / iCloud | n/a | Folder trees, weak media UX | Zero-knowledge, social, offline-first |

Nobody offers "your private community is also your private Plex." That is the
whole point of this plan.

## Current state (grounded, verified 2026-07-04)

**Exists and is reused, never rebuilt:**

- **Theme system (Plan 18, done):** `packages/meerkat-theme` (schema, codec,
  presets, contrast math, QR export) + Appearance surfaces on both apps.
  App-level, per-device only. No community scoping.
- **Community descriptor:** `packages/sync/src/protocol/community.ts` -
  `CommunityChannel { id, name, postRoles? }` (flat array, no order field, no
  categories, no topic, no type, no archived flag); `CommunityDescriptor` has
  `name` but NO icon, banner, description, accent, or theme. Backward-compatible
  field addition is a PROVEN pattern here: `historyScope`,
  `feedPollIntervalMs`, `transportPolicy` were all added as optional fields
  with conditional canonical append and restrictive/default fallbacks.
- **Signed member profiles + avatars (Plan 32):** `cm_profiles` OR-set rows;
  `resolveCommunityAvatarImage` renders ONLY signature-verified images.
  This is the exact precedent for community icons/banners.
- **Files layer:** `cm_message_attachments` + per-community Files index
  (`apps/meerkat/app/(root)/data/community-files.ts`, `aggregateCommunityFiles`)
  is a FLAT list carrying `name + mimeType` only (link previews excluded).
  Request/approve re-send over the pair-private mailbox; verify-then-pin on
  every fetch; OS share intake stages files; `mk_pinned` indexes pinned content;
  content-addressed sealed blocks in `ExpoNodeStore` / web OPFS store.
- **Tags:** `cm_post_tags` exists for posts only. No file/item tagging.
- **Scope policy:** `COMMUNITY_SYNC_POLICY.defaultScope = device_local`,
  fail-closed; every synced table needs an explicit rule + guard test.
- **Quotas:** `descriptor.quotas.maxStorageBytes` + `NodeStoreStats` exist.
- **Communities list (Plan 31):** cards with name, role chip, unread, muted.
  No pinning, reordering, folders, or per-community visual identity.
- **Community settings screen (Plan 31):** profile, members, owner review,
  reports, make-public, invite, history import, mute, leave. NO channel
  manager (reorder/categories/topics/archive) and NO appearance section.

**Confirmed gaps (the plan's work):**

| # | Gap | Track |
|---|-----|-------|
| G1 | No community identity: icon, banner, description, accent | A |
| G2 | No per-community theme (owner-set, member-overridable) | A |
| G3 | No channel organization: order, categories, topics, archive | A |
| G4 | No device-side community list organization: pin, reorder, folders | A |
| G5 | No library concept: typed collections over the blob store | B |
| G6 | No item metadata model (title/year/cover/series/album/EXIF...) | B |
| G7 | No metadata extraction or enrichment pipeline | B |
| G8 | No library browse UX (poster grid, sort/filter, collections, search) | B |
| G9 | No in-app media playback from sealed blocks | B |
| G10 | No "layout mode": a community cannot present library-first | A+B |
| G11 | No personal (non-community) library surface, despite the auto personal workspace | B |

## Design decisions (binding)

1. **Owner-authoritative structure lives in the signed descriptor; cosmetic
   identity lives in signed cm_ rows.** Channel order, categories, channel
   `kind`, topics, and archived flags are membership-security-adjacent
   structure: they go into `CommunityDescriptor` via the established
   conditional-canonical-append pattern (optional fields, legacy descriptors
   unaffected, unknown values fail to safe defaults). Icon, banner,
   description, accent, and the community theme blob change often and must not
   force descriptor revisions: they are a new owner-signed
   `cm_community_identity` row-set (OR-set, latest-owner-signed-wins),
   modeled on `cm_profiles`, with an explicit `shared_workspace` rule.
   Verification exactly mirrors avatars: an unverified identity row renders
   nothing.
2. **Community theme = a `@mylife/meerkat-theme` blob, owner-signed,
   member-sovereign.** The owner picks a preset or exports their custom theme
   (Plan 18 codec, reused byte-for-byte) into the identity row. Members get a
   three-way per-community setting (device-local): `community` (default, apply
   the owner theme inside that community's screens), `mine` (ignore it), and
   accessibility override: a user's high-contrast selection ALWAYS beats a
   community theme. No theme ever changes app chrome outside the community's
   screens.
3. **A library is a channel `kind`.** `CommunityChannel.kind?: 'chat' | 'library'`
   (absent = `'chat'`, legacy-safe). A library channel renders a library view
   instead of chat. This reuses channel-level `postRoles` as curator roles,
   channel membership/audience rules, per-channel files, and the existing sync
   path unchanged. Personal libraries are the same tables in the auto-created
   personal workspace (G11).
4. **Library items are signed metadata rows referencing content ids.** The
   blob pipeline stays the single source of file truth. `cm_library_items`
   rows carry metadata + the content id of the sealed blob (and cover-art
   content id). Verify-then-pin remains the only ingestion path.
5. **Metadata enrichment is curator-fetch-only (NC: no receiver fetch).**
   Exactly the Plan 32 link-preview rule: the curator's device may (with
   explicit per-action consent) query an external provider (TMDB,
   MusicBrainz, Open Library); the SIGNED result syncs; receivers never
   contact third parties. Offline/no-consent path: local extraction only.
6. **Playback is local-first and honest.** The player plays verified, locally
   pinned blocks (decrypt-to-stream). If an item is not local, the UI shows
   the real fetch flow (existing file-request / host fetch), never a fake
   buffering spinner. No transcoding claims, no "streaming server" copy.
7. **Watch/read progress is personal, never shared.** Resume state rows are
   `device_local` (mirroring the `cm_read_state` never-replicate rule).
   Nothing leaks what a member watched to the community.
8. **Data-hub layout is presentation, not permission.** A community with
   `layout: 'library_first'` (descriptor optional field) opens on its
   libraries with chat one tap away. No security semantics attached.

## Data model (new)

```sql
-- Owner-signed community identity + theme (shared_workspace, explicit rule)
CREATE TABLE IF NOT EXISTS cm_community_identity (
  community_id TEXT NOT NULL,
  revision INTEGER NOT NULL,          -- monotonic per community, owner-signed
  description TEXT,
  accent_color TEXT,                  -- hex, validated
  icon_cid TEXT,                      -- sealed blob content id (image)
  banner_cid TEXT,
  theme_blob TEXT,                    -- @mylife/meerkat-theme codec string, optional
  signed_by TEXT NOT NULL,            -- must verify against descriptor owner
  signature TEXT NOT NULL,
  hlc TEXT NOT NULL,
  PRIMARY KEY (community_id, revision)
);

-- Libraries (one row per library channel's config; shared_workspace)
CREATE TABLE IF NOT EXISTS cm_libraries (
  library_id TEXT PRIMARY KEY,        -- = channel id of the kind:'library' channel
  community_id TEXT NOT NULL,
  media_type TEXT NOT NULL,           -- movie|show|music|photo|book|document|custom
  sort_default TEXT NOT NULL,
  signed_by TEXT NOT NULL, signature TEXT NOT NULL, hlc TEXT NOT NULL
);

-- Items: signed metadata over content ids (shared_workspace)
CREATE TABLE IF NOT EXISTS cm_library_items (
  item_id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  content_cid TEXT NOT NULL,          -- sealed blob (the file itself)
  cover_cid TEXT,                     -- sealed blob (poster/cover art)
  title TEXT NOT NULL,
  sort_title TEXT,
  year INTEGER,
  duration_ms INTEGER,
  metadata_json TEXT NOT NULL,        -- typed per media_type (zod-validated)
  metadata_source TEXT NOT NULL,      -- 'local' | 'curator_fetched:<provider>'
  author_device_id TEXT NOT NULL, signature TEXT NOT NULL, hlc TEXT NOT NULL,
  tombstone INTEGER NOT NULL DEFAULT 0
);

-- Collections + membership (shared_workspace)
CREATE TABLE IF NOT EXISTS cm_library_collections ( ... signed ... );
CREATE TABLE IF NOT EXISTS cm_library_collection_items ( ... signed ... );

-- Personal, never-replicating (device_local; OUTSIDE prefixes where mk_)
CREATE TABLE IF NOT EXISTS mk_library_progress (   -- resume/watched state
  item_id TEXT PRIMARY KEY, position_ms INTEGER, completed INTEGER, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS mk_community_prefs (    -- G4: pin/order/folder
  community_id TEXT PRIMARY KEY, pinned INTEGER, sort_index INTEGER, folder TEXT
);
```

Descriptor additions (all optional, conditional canonical append, guard-tested
against legacy descriptors): `channels[].kind`, `channels[].categoryId`,
`channels[].order`, `channels[].topic`, `channels[].archived`,
`categories: {id, name, order}[]`, `layout: 'chat_first' | 'library_first'`.
Unknown `kind` renders as chat, read-only banner (fail-safe).

## Phases

### Phase 0: Engine foundations (@mylife/sync)
Descriptor optional fields + canonical-append + verify round-trip tests against
legacy fixtures; `cm_community_identity` protocol module (owner-bind: signer
MUST equal descriptor owner at the row's HLC, reject otherwise, tombstone-able);
library table DDL + explicit scope rules + the rule-less-table guard test
extended; zod schemas for `metadata_json` per media type; quota accounting for
library blobs reusing `maxStorageBytes`. Exit: sync suite green with new
protocol tests; no app changes yet.

### Phase 1: Community identity + retheme (Track A, both surfaces)
Owner "Appearance & identity" section in community settings: description,
accent, icon/banner (blob pipeline, same size caps as avatars), theme picker
(presets + "use my current custom theme" via Plan 18 codec) with live preview
and WCAG check (reuse `packages/meerkat-theme/contrast`). Member render path:
verified identity resolves like avatars; per-community member setting
(community/mine) + the high-contrast override rule; community cards and
headers show icon + accent. Parity guards for state strings. Exit: /browse both
surfaces, an unverified or forged identity row provably renders nothing.

### Phase 2: Organization (Track A, both surfaces)
Owner channel manager in community settings: create (depends on the W2 fix),
rename, reorder (drag), categories (create/rename/reorder/assign), topics,
archive/unarchive (archived = hidden from default list, content preserved,
never deleted). Member-side: category groups + unread rollups in the community
screen; Communities tab pin/favorite, manual reorder, optional folders
(`mk_community_prefs`, device-local, explicitly documented as per-device).
Exit: descriptor revision round-trips through a real two-device sync; legacy
communities render unchanged.

### Phase 3: Library substrate (Track B, data/engine both surfaces)
Create-library flow (new channel of kind `library`, media type, curator roles
via `postRoles`); ingestion into `cm_library_items` from: existing channel
files (promote), OS share intake, file picker, and bulk multi-select; every
ingest is verify-then-pin then sign; delete = author/curator tombstone (file
blob unpinned only if unreferenced, reuse the refcount pattern). Exit: two-node
e2e proves an item authored on A browses on B with verified metadata and
fetchable content.

### Phase 4: Metadata pipeline (Track B)
Local extraction on the curator device: filename parser (movie/show/scene
conventions, music `artist - album - track`, ebook name conventions), ID3/EXIF/
MP4+MKV container probing via lazy-loaded libs (Expo-Go-safe null fallback,
lan-backend pattern); cover-art extraction to sealed blob. Curator-consent
external enrichment: provider adapters (TMDB, MusicBrainz, Open Library)
behind ONE explicit per-action consent sheet with honest copy ("this searches
<provider> from YOUR device"); results editable before signing;
`metadata_source` recorded and shown. Manual edit always available. Exit:
enrichment provably never fires on a receiving device (test-asserted).

### Phase 5: Browse UX (Track B, both surfaces)
Library home per media type: poster/cover grid (movies/shows/books), list
(documents), album grid (music), masonry (photos); sort (title/year/added/
duration), filters (genre/tags/year/unwatched), search within library;
collections CRUD + pinned collections row; item detail screens per type
(poster, metadata, files, actions). Continue-watching / recently-added rows
fed ONLY by real local rows (`mk_library_progress` + item HLCs). 10k-item perf
budget with windowed lists (Plan 32 feed perf seams as precedent). Exit:
/design-review batch.

### Phase 6: Playback and open (Track B)
Mobile: expo-video player (precedent: DoWork signed playback) fed by streaming
decrypt of local verified blocks to a temp file with cleanup, resume from
`mk_library_progress`, background audio for music kind; images: full-screen
viewer (existing attachment viewer extended); documents/epub: OS open-in via
temp decrypt + share sheet. Web: MediaSource/object-URL playback from the OPFS
store. Not-local items: real fetch flow with real progress, then play. Honest
copy everywhere: local-first playback, no transcoding, remote fetch requires a
reachable host. Native modules lazy-loaded, Expo Go degrades to open-in-OS.
Exit: a video authored on device A plays on device B after a real session.

### Phase 7: Data-hub layout + personal hub (G10, G11)
Descriptor `layout: 'library_first'`: community opens on a Libraries home
(per-library rows, On Deck = resume + recently added) with Chat as a sibling
tab; owner toggle in settings. Personal hub: "My Library" surface over the
personal workspace using the same tables/screens (no community required), fed
by OS share intake and file picker; this is the pure single-user Plex mode.
Exit: a solo user with zero communities can build and browse a full local
library.

### Phase 8: Hardening, parity, honesty sweep
Adversarial pass: forged identity rows, non-curator item injection (must
reject), tombstone replay, oversized metadata, malicious cover blobs
(decode-bomb guards), quota exhaustion UX; parity script extension
(`check-meerkat-parity.mjs`) locking identity/library state strings across
surfaces; storage meter integration + honest tier copy (Plan 22 alignment);
docs: CLAUDE.md table-prefix + architecture updates, capability-status
entries (`community_theming`, `libraries` with honest lines); errors_log
discipline. Exit: full gate chain + `check:parity` green.

## Acceptance criteria (plan-level)

1. A community owner can set icon, banner, description, accent, and a full
   theme; members see it (verified) with a working "use my theme" override and
   an always-winning high-contrast override.
2. A community owner can reorder channels, group them into categories, set
   topics, and archive channels; members see the structure; legacy communities
   are untouched.
3. A member can pin/reorder/folder their Communities list per device.
4. A user can create a Movies/Shows/Music/Photos/Books/Documents/Custom
   library in any community (or their personal hub), ingest files through
   every existing intake path, get local + optional curator-fetched metadata
   with cover art, browse a poster grid with sort/filter/search/collections,
   and play/open items on both surfaces, with resume state that never leaves
   the device.
5. Every new synced table has an explicit scope rule and a guard test; every
   new signed row type has a forge-rejection test; enrichment provably never
   fires on receive.
6. No UI copy overclaims: no streaming-server, transcoding, or remote-library
   claims; fetch states are real.

## Risks

- **Descriptor churn on reorder:** batching required (channel manager edits
  commit as ONE revision on save, not per drag).
- **Media libs on Expo:** container probing and playback need dev-build
  natives; every adapter must null out Expo-Go-safe (established pattern).
- **Large libraries vs storage quotas:** surface `NodeStoreStats` + per-library
  pin policy (pin-all vs fetch-on-demand) in Phase 5, or big libraries will
  brick small phones.
- **External metadata providers and privacy optics:** consent copy must be
  airtight; default is local-only extraction. Provider keys are curator-side
  config, never shipped secrets.
- **Scope creep into public libraries:** publishing a library through the
  Plan 19 public layer is explicitly OUT of this plan (a natural follow-on).

## Status Delta

- 2026-07-04: Plan authored (founder direction of the same date). Not started.
- 2026-07-04 (later): Full /plan-ceo-review completed in EXPANSION mode with the
  founder: 3 adversarial spec-review iterations (5/10 -> 7/10 -> 9/10 PASS, 29
  issues fixed) + an independent outside-voice challenge (13 findings, all
  dispositioned). Scope expanded (10 accepted expansions, 0 deferred) and the
  Review Amendments section below is BINDING and supersedes conflicting base
  text above. CEO plan record:
  `~/.gstack/projects/MyLife/ceo-plans/2026-07-04-meerkat-plan38-community-theming-data-hub.md`.

## Review Amendments (2026-07-04, BINDING - supersedes conflicting text above)

### A. Approach: platform seams (Approach C)

1. Channel `kind` resolves through an in-code view-contract registry on both
   surfaces. Unknown kind renders as chat read-only with a banner (unchanged
   fail-safe, now a named seam).
2. Media types resolve through an in-code registry map keyed by `media_type`
   (zod schema + sort fields + card shape per entry; adding a type is a
   one-file entry). Unknown `media_type` on an older client renders a generic
   read-only document list with a notice (guard-tested). NOT schema-as-data,
   NOT a plugin framework, no dynamic code loading.

### B. Supersessions of base text

1. Design decision 3 ("library view INSTEAD of chat") is superseded: library
   channels render as Library | Chat segments (library is the default
   segment; chat rides the existing chat kit). One channel = one place.
2. Phase 6 temp-file A/V playback is superseded by the loopback range server
   (D.5 below). Temp-file decrypt remains ONLY for OS open-in (generic
   documents always; A/V only in Expo Go), always behind an explicit
   plaintext-export warning with cleanup. PDFs render in the sealed in-app
   viewer where the platform allows instead of open-in.
3. Phase 6 "documents/epub: OS open-in" is superseded for epub/cbz by the
   in-app sealed reader (C.9 below).
4. Design decision 7 wording relaxes from device_local to PERSONAL: watch
   progress syncs at `personal_replica` scope (your own paired devices ONLY,
   real cross-device resume) and is never community-visible. It still never
   replicates to any community. Requires the scope rule + guard test.
5. Phase sequencing: Phases 3-6 build and demo against the PERSONAL workspace
   first. The personal "My Library" hub (old Phase 7 G11) is the FIRST
   shippable milestone; community-shared libraries and the layout mode layer
   on afterward (see F below).

### C. Accepted scope expansions (founder-approved, all launch scope, none deferred)

1. Community templates at creation: 6 presets (Family Space, Media Library,
   Club, Course Hub, Newsroom, Blank) composing ONLY the shipped kinds
   (`chat`, `library`) + theme/identity/category/layout presets. Lands with
   the community-shared phase, after identity (Ph1) + library provisioning
   (Ph3). Creation is all-or-nothing (staged locally, committed once).
   Theme-adopt-on-create ships inside the template picker.
2. Within-community ingest dedup + all-local stats card. Dedup is LOGICAL
   (reuse the existing pin at the same contentId), fires across libraries of
   the same community, notice: "Already in this community". NEVER
   cross-community (different sealing context; also a plaintext-equality
   oracle). Storage UX states plainly that the same file in N communities
   costs N x disk. Stats card: item count, library logical bytes, this-device
   stored bytes, per-item "held on this device" badge. NO seeder counts
   anywhere (no honest source; rejected twice).
3. Smart collections: signed rule rows (unwatched/genre/year/tag) evaluated
   locally as SQL; unwatched reads local progress at render time. Phase 0:
   scope rule + forge-rejection + unknown-rule-type fail-safe (renders as
   empty collection + notice).
4. Community theme share/adopt via the Plan 18 codec/QR byte-for-byte.
5. Folder-convention bulk import + bounded NFO sidecar parsing: `<movie>` +
   `<episodedetails>`; title/year/plot/genre/runtime only; URL-stub NFOs
   ignored; XML parser hardened (no entity expansion / XXE). Curator-local.
6. Photo timeline (EXIF capture dates) + offline map: MapLibre (dev-build,
   lazy) over founder-hosted STATIC tile packs (z0-z8 world + optional region
   packs to ~z12, <=150 MB per pack, pinned hash, checksum-verified,
   one-time whole-pack download with consent copy: never per-location tile
   queries). Map default-off per library. Founder-ops gains tile-pack
   hosting.
7. Pin-class taxonomy + per-library pin policy + device-wide storage budget +
   LRU eviction. Classes in `mk_pinned.pin_class`: authored (never evicted),
   explicit (never auto-evicted), policy (evicted only on policy change),
   fetch_cache (LRU under budget pressure). Policy lives in device-local
   `mk_library_pin_policy`; budget in `mk_settings`; web OPFS equivalents.
   Last-copy honesty is device-local only: "this device is deleting its
   copy; Meerkat cannot know if other members still hold it." A policy that
   cannot fit the budget surfaces an honest error. Playback holds a temporary
   pin (no eviction mid-play). Availability gap (no seeding-liveness
   protocol) documented in capability-status.
8. Music queue (device-local state) + OS transport controls via
   react-native-track-player (dev-build, lazy, Expo Go honest null-out) +
   MediaSession on web.
9. In-app sealed epub/cbz reader: cbz = in-memory unzip + image viewer;
   epub = local-content WebView, network blocked AND javaScriptEnabled false
   (if pagination requires JS: sandboxed, no bridge, origin null),
   guard-tested; epub bytes are attacker-controlled community data. Resume
   via library progress.
10. Per-community notification identity (icon/accent/sound) behind the SAME
    dev-build background-sync flag; only real applied>0 notifications; sounds
    are a bundled preset list only (identity selects a preset id, never ships
    audio bytes).

### D. Binding technical decisions

1. Owner creates libraries; `cm_libraries` rows are OWNER-SIGNED (same rule
   as community identity; forge-rejection tested). Per-channel `postRoles`
   govern curation (item add/edit/tombstone, collection CRUD).
2. Community theme applies to ALL screens of that community; app chrome and
   DM threads NEVER retheme; user high-contrast override always wins. One
   pure `resolveActiveTheme(communityId)` choke point, web twin,
   parity-guarded. Implementation is a provider boundary wrapped around
   exactly the community route subtrees plus a shared-component leakage
   audit, with a test that a DM thread and the tab bar never pick up a
   community theme.
3. SEALING-KEY MODEL IS A PHASE 0 BLOCKER TASK: decide and document which
   sealing model governs library blobs (the channel-attachment/session-blob
   model vs per-share link keys vs epoch keys), define key delivery for
   `cm_library_items` (a receiver must be able to decrypt `content_cid` and
   `cover_cid`), handle historical epoch rotation if epoch-keyed, and
   RE-DERIVE the dedup/refcount/eviction design on the chosen model. No
   library phase starts before this is settled in the sync package.
4. `mk_pinned` pin-context migration: today it keys on content_id alone; add
   a companion pin-context table (or PK change) on BOTH surfaces so the same
   contentId pinned via two communities coexists; refcount/eviction key on
   (contentId, sealing context).
5. A/V playback on mobile = loopback 127.0.0.1 range server, promoted to its
   OWN sub-phase (6a) with its own eng review and a 2-device exit gate. It is
   a real subsystem: range-request to chunk-index mapping, per-chunk
   streaming decrypt, seek support. Dev-build only (rides the existing
   react-native-tcp-socket dependency, lazy). Per-session token IN THE URL
   PATH (players do not forward custom headers on seeks), constant-time
   compare, 401 otherwise (exit-test asserted), dies with the process. No
   A/V plaintext at rest. WEB playback = MediaSource/object-URL over OPFS
   with an HONEST container matrix: fragmented MP4/WebM stream via MSE;
   small files via object-URL; anything else (e.g., MKV) gets honest "not
   playable in the browser; download or play on mobile" copy. No remuxing
   claims.
6. Descriptor channel-tuple fields (kind/categoryId/order/topic/archived) use
   CONDITIONAL inner-tuple canonical append, with a dedicated legacy-fixture
   test proving a descriptor signed under the OLD serializer still verifies
   byte-for-byte under the new one. The top-level pattern being proven does
   not automatically prove the channel-tuple case.
7. Photo GPS: default = rewrite image bytes to strip EXIF GPS at ingest on
   the curator device (new contentId accepted). Consent to preserve location
   is PER-CONTRIBUTOR at ingest, never an owner toggle. GPS-strip verified on
   output bytes in tests.
8. Enrichment is BYO-key with GUIDED setup: per-provider one-time sheet (link
   to obtain a free key, paste field, live test call), keys curator-side
   config only. First-run story: local extraction (filename/NFO/EXIF/ID3)
   works with zero setup; posters need a free key. No founder proxy.
9. Poster thumbnails: curator derives a ~300px WebP thumbnail as its own
   sealed blob at ingest; grids render thumbnails, detail screens load full
   covers lazily.
10. Item tags reuse/mirror the `cm_post_tags` shape (no second tag model);
    library view logic lives in shared pure `library-view-core.ts` modules
    (channel-view-core precedent) consumed by both surfaces.

### E. Transport reality (honest framing, copy-binding)

Library metadata rows sync over existing community sessions. Library BLOBS
move: (a) during manual sync sessions via the session blob provider (works
today, two devices, LAN or relay), (b) via the existing file-request /
host-fetch flow when a reachable holder exists, (c) at internet-wide
always-available quality ONLY once founder-ops deploys always-on seeding
(relay + community node). UI copy for community libraries must never imply
(c) before it exists. The personal hub has NO transport dependency.

### F. Phase resequencing (personal-first)

- Phase 0: engine foundations + D.3 sealing-key blocker + D.4 pin-context
  migration + smart-rule row type + D.6 legacy-fixture test.
- Phases 1-2: identity/retheme (+ theme share) and organization, unchanged.
- Phases 3-6: library substrate, metadata, browse, playback, built and
  demoed against the PERSONAL workspace. Exit of this arc = the personal
  "My Library" hub shipping-quality on both surfaces (first milestone).
  Phase 6a = loopback server sub-phase (own gates).
- Phase 7: community-shared libraries (transport-honest per E), layout mode
  `library_first`, and community templates (C.1).
- Phase 8: hardening/parity/honesty sweep, now also covering: eviction class
  matrix, loopback 401 + range correctness, GPS-strip byte verification,
  dedup never-cross-community, theme leakage (DM/tab bar), web container
  matrix copy, epub sandbox guard-tests.

### G. Estimate correction

15-20 CC days (was 10-14) across both surfaces, plus a founder-ops
device-QA tail (dev builds with: tcp-socket [existing], track-player,
MapLibre; two-device gates for Phase 6a and Phase 7). Founder-ops registry
additions: tile-pack hosting + pinned hash; enrichment provider key docs.

## Codex Engineering Review Amendments (2026-07-05, BINDING - supersedes conflicting text above)

Independent gpt-5.5 review (`codex exec -s read-only`, full-code verification) ran
2026-07-05; verdict REJECT-as-build-ready with 3 BLOCKERs, 3 HIGHs, 4 MEDIUMs.
All findings were re-verified against the code by the lead before acceptance.
All 10 accepted; they bind as follows:

1. **D.3 RESOLVED - sealed library objects under epoch-wrapped per-object DEKs.**
   Library blobs use the sealed-share MECHANICS (chunked at-rest encryption,
   plaintext-Merkle contentId, author-signed manifest, `NodeStore` blocks) but
   NOT bearer link keys: each object gets a random per-object DEK (=`linkKey`),
   and the SIGNED `cm_library_items` row carries `key_epoch` plus the DEK
   wrapped under a key derived from that workspace epoch secret
   (`deriveEpochLibraryWrapKey(epochSecret, workspaceId, epoch)`). Receivers
   unwrap via `unwrapEpochSecret` history. Consequences (documented, honest):
   `historyScope: full` back-wraps let late joiners read old items;
   `join_point` items before join show an honest locked state; removed members
   keep what they already held (same boundary as messages); new items under
   the post-removal epoch are unreadable to them. Session blob transfer today
   only moves raw `blob_hash` bytes (`collectBlobRefs`), so Phase 0 MUST add
   the sealed-object transfer/fetch leg: library sealed blocks move by
   sealedId through an extended session blob collector AND the existing
   host-fetch path (`fetchAndPinFromHosts` with the unwrapped DEK). "Existing
   sync path unchanged" in base decision 4 is superseded by this.
2. **Library rows carry enforcement columns.** `cm_library_items` (and
   collections/tags/smart rules) gain signed `community_id` and `channel_id`
   columns (`channel_id` = the library channel id; `library_id` alias
   dropped). Row-level transport policy (`rowCommunityId`) and MK-043
   apply-time curator enforcement (`evaluateChannelPost` fires on
   `data.channel_id`) then apply to library rows with zero engine changes.
3. **Apply-time validators for owner-signed row types.** Inbound apply
   generic-inserts past module/scope/channel gates (sync-session.ts:749).
   Phase 0 adds a table-specific inbound validator seam so
   `cm_community_identity`, `cm_libraries`, and smart-collection rule rows
   are signature-verified and owner/role-checked BEFORE insert (read-time
   verification remains the rendering floor, unchanged).
4. **D.4 is an API change, not just a schema change.** `NodeStore`
   (`getManifest`/`deleteManifest`/`INSERT OR REPLACE` by content_id on both
   surfaces) becomes context-aware: manifest load/store/delete keyed by
   (contentId, sealing context = workspaceId), plus sealed-BLOCK refcounts so
   one context's unpin cannot evict blocks another context still references.
5. **Resume state moves out of mk_.** `mk_library_progress` contradicted
   amendment B.4 (`mk_` never replicates). It becomes `cm_library_progress`
   with an explicit `personal_replica` default AND max scope rule
   (`cm_read_state` precedent), guard-tested to never reach shared_workspace.
6. **Tags get their own table.** `cm_post_tags` PK is (post_id, tag);
   items get `cm_library_tags` mirroring its shape/flow (D.10 "reuse/mirror"
   resolves to MIRROR).
7. **Loopback server spec hardened (D.5).** The plan's own sub-phase 6a gains
   explicit scope: HTTP request parsing on react-native-tcp-socket, Range
   validation, 206/416/HEAD semantics, loopback-only bind, short-TTL
   per-session token, and tests for 206/416/401/seek/chunk-boundary decrypt.
   Web stays MSE-for-fMP4/WebM + object-URL-for-small + honest-copy-for-rest.
8. **Parser/ingest security tests move to the phase that builds each parser**
   (XXE, zip/decode bombs, EPUB sandbox, GPS-strip byte checks land with
   Phases 3-4/6 code, not deferred to Phase 8; Phase 8 re-runs them as the
   sweep).
9. **Dedup stays plaintext-oracle-safe.** contentId is plaintext-derived
   (Merkle over plaintext chunk hashes), so within-community dedup = same
   contentId in the same workspace reuses the existing pin and rewraps its
   DEK under the current epoch; the contentId index is NEVER queried across
   workspaces (guard-tested), preserving C.2.
10. **Estimate re-corrected: 25-35 CC days** (was G's 15-20). Founder note:
    scope stays full per the no-deferral mandate; the schedule number moves,
    not the scope.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (2026-07-04) | 10 proposals, 10 accepted, 0 deferred; 8 binding decisions; spec loop 3 iters 29 fixed, final 9/10 |
| Codex Review | `codex exec -s read-only` | Independent 2nd opinion | 1 | CLEAR (2026-07-05) | REJECT-as-build-ready -> 10 findings (3 BLOCKER, 3 HIGH, 4 MEDIUM), all code-verified by lead, all folded as the binding Codex amendments section; D.3 resolved (epoch-wrapped per-object DEKs); estimate 25-35d |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | COVERED (2026-07-05) | the Codex review ran the eng-review agenda (architecture vs real code, D.3 sealing decision, test map, estimate); its amendments are the eng-review output |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | NOT RUN | required for Phases 1, 2, 5, 7 per pipeline |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | - | n/a |

- **CROSS-MODEL:** 4 tension points surfaced (sequencing, enrichment first-run, resume scope, map infra); all 4 resolved by founder 2026-07-04 (resequence accepted; BYO-key guided; personal_replica resume; map kept).
- **UNRESOLVED:** 0
- **VERDICT:** CEO review CLEARED with expansions; Codex eng review CLEARED with
  10 binding amendments (2026-07-05). Build may start at Phase 0.

## Status Delta (append)

- 2026-07-05: Codex (gpt-5.5) engineering review run and folded (see the Codex
  amendments section). D.3 sealing model DECIDED: sealed library objects under
  epoch-wrapped per-object DEKs. Plan moved queue -> active; Phase 0 execution
  started on `feature/meerkat-launch-completion`.

## Status Delta (2026-07-05, close of coding)

- ALL CODEABLE SCOPE COMPLETE on `feature/meerkat-launch-completion`
  (commits `ec1f1d6f`..`730576fb`, all pushed): Phases 0-7 plus every
  accepted expansion C.1-C.10 and the Codex amendments, on both surfaces.
  Phase 8's sweep items were enforced per-phase (parser security tests with
  their parsers, forge rejection at apply, leakage tests, GPS-strip byte
  verification, loopback 401/416/seek matrix, dedup never-cross guard,
  eviction class matrix, honest-copy locks); the parity script now carries
  6 byte-identical twin locks and 40+ cross-surface state strings; CLAUDE.md
  + AGENTS.md updated in sync.
- Final gates: sync 1692/1692, relay 347/347, mobile 953/953, web 643+,
  4 typechecks, FULL repo `check:parity` chain, artifact guard - all green.
- REMAINING = founder-ops only (no code): dev/EAS builds carrying the new
  natives (expo-video, react-native-webview, optional track-player +
  MapLibre); the Phase 6a loopback and Phase 7 community-library TWO-DEVICE
  QA gates; tile-pack hosting + pinned hashes into app.config extra;
  enrichment provider key docs; and the pre-existing launch tail (relay/
  seeding deploy). Plan stays in active/ until the founder-ops exit gates
  run on device.
