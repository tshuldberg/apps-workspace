# Plan 56: Meerkat Canvas, the Freeform Community Creation Layer

Date authored: 2026-08-28
Scope: apps/meerkat, apps/meerkat-web, packages/sync, packages/meerkat-canvas (new), scripts/check-meerkat-parity.mjs
Method: Fable-authored over three research tracks (in-repo architecture map; customization precedent survey MySpace through Roblox/Notion/Figma; safe-UGC rendering research on Expo SDK 54 / RN 0.81 / Hermes). Every seam claim below was verified against source by the architecture track.
Posture: founder mandate, full function. Phases are dependency sequencing, not scope cuts. No MVP framing anywhere in this plan.
Relationship: this is the MEMBER-side complement to `apps/meerkat/docs/reports/REPORT-meerkat-composition-platform-build-plan-2026-08-24.md` (the owner-side composition spine: block registry, `cm_layout`, capability manifest, layout editor). This plan depends on that plan's Phase 0 (parity meta-guard) and Phase 1 (spine) and duplicates none of it.

---

## 1. Product vision

The composition platform lets an OWNER design a community's interface. Canvas lets EVERY MEMBER build on the community itself: decorate it, draw on it, pin stickers to it, leave notes in it, mint badges from it, hang art in it, soundtrack it, build whole new pages onto it (a video feed, a wiki, a webpage-style layout, any custom layout the editor can express) that owners promote into community tabs, and design a different profile page in every community they belong to. The way people once built MySpace pages and Geocities rings, with the freedom of free-editing a webpage. The demand is proven and current (SpaceHey reached 1.9M users on exactly this promise; mmm.page, straw.page, and Hotglue are a live genre), and no encrypted messenger has ever shipped it.

Meerkat has three structural advantages no precedent had:

1. **Signed authorship on every object.** Every decoration is cryptographically attributed. MySpace glitter was anonymous wallpaper; a Canvas sticker is social currency with an unforgeable author line. The research is unanimous that legible authorship, not raw power, is what drove engagement on every beloved platform.
2. **Content-addressed sealed assets.** A decoration can only reference sealed blobs by content id, never a URL. This structurally kills the CSS-exfiltration, byte-swap-after-review, and hotlink-tracking attack classes that burned every markup-era platform.
3. **An append-only event log.** Vandalism is reversible, history is scrubbable (time machine), and snapshots are free.

The product promise, in honest copy: "Your community is a place. Build on it."

## 2. Research findings that bind this design

These are conclusions, not preferences. Each one forecloses a design branch.

- **F1. Declarative-first is the only design that ships.** React Native has no DOM and no CSS; a markup surface cannot port. Separately, no acceptable script sandbox exists on Hermes today: WASM is absent from Hermes (facebook/hermes#429 open; the RN 0.84 release notes do not mention it), quickjs-emscripten requires WASM, the QuickJS TurboModule wrappers are 0.0.x with no threat model, and same-VM sandboxes are permanently refuted by Figma's documented Realms escapes and Screeps' vm-to-isolated-vm migration. Everything in Phases 1 to 5 is therefore pure signed data rendered by host-owned components. User code is a gated deferred track (section 14), and over 90 percent of the aggressive feature catalog needs none of it.
- **F2. CSS-style strings are not safe even though they look declarative.** Attribute-selector keyloggers and content rewriting are documented attacks. All styling is closed token vocabularies (enums and clamped numerics), never strings. Assets are content ids, never URLs; a Canvas object is structurally incapable of naming a network destination.
- **F3. The `cm_community_identity` pattern is the proven spine.** Owner or author signed event tables, apply-time validators in `SIGNED_ROW_VALIDATORS` (forgery dies before INSERT, raw DELETE rejected, deletion only by signed tombstone), read-time re-verification, fail-closed `defaultScope: 'device_local'` for rule-less tables, `id = rowId`. Canvas adds event kinds to this spine, never a parallel system.
- **F4. Descriptor fields break old verifiers; new tables and new kind values degrade gracefully.** (Composition plan corrections 1.1 and 1.2, independently verified.) Canvas therefore ships as new signed tables plus one new channel kind value, and touches the descriptor zero times.
- **F5. Per-object LWW beats a CRDT library here.** Yjs/Automerge updates are opaque binary merges that erase per-op authorship, which is structurally incompatible with apply-time signature validation (a valid member could launder a forged edit inside a valid envelope). The Excalidraw model (per-element `version` + `versionNonce`, deterministic tie-break, every element independently signed and independently droppable) converges without new sync machinery and preserves fail-closed verification. Automerge is WASM-blocked on Hermes anyway, and the Yjs expo-sqlite persistence story is not production-grade.
- **F6. Receiver-side rendering control is the only moderation that works with no server.** VRChat's trust-ranked feature toggles and Bluesky's subscribable labelers are the proven decentralized patterns. Every member gets local dials over what they render; nothing can be taken down centrally, so nothing is forced on a viewer locally.
- **F7. UI spoofing is the top threat, above XSS.** A freeform surface that can draw arbitrary text and shapes can fake a Verified badge, an encryption indicator, or a connection status line. This attacks the transport-honesty boundary directly. Reserved chrome must be structurally unreachable, and trust indicators must never share pixels with member content (guard-tested, like the existing theme-leakage tests).
- **F8. Type-exact schema validation is the security boundary.** ProseMirror's CVE-2024-40626 was type confusion in a node attribute, not a missing allowlist. Every node type gets a total, closed, type-exact Zod parse; unknown keys stripped; unknown node types render nothing.
- **F9. Fonts and Lottie are excluded from member content.** FreeType CVE-2025-27363 (actively exploited, zero-click) rules out member font files; Lottie expressions embed JavaScript (a program in a data costume). Curated host-shipped sets only.
- **F10. Version skew is permanent and adversarial in P2P.** Every node type carries `schemaVersion` with a forward migration sequence, tldraw-style; an unknown version renders the honest placeholder, never a guess.

## 3. Architecture: one spine, six subsystems

### 3.1 The canvas document model

A canvas is a set of independently signed node rows, not a document blob.

- **`cm_canvas`**: the canvas registry row (author-signed; owner-signed for community-level canvases). Columns: `id`, `community_id`, `kind` (`commons` | `channel_topper` | `profile` | `post` | `pixel_board` | `page`), `subject_id` (channel id, device id, or post id the canvas attaches to), `policy_json` (layer permission map, member-build toggle, caps profile, `layout: 'free' | 'flow'`), `revision`, `tombstone`, `updated_at`, `signed_by`, `signature`. Entity rule `shared_workspace/shared_workspace`, lww.
- **Layout modes**: `free` is the mmm.page model (absolute position, overlap, rotation). `flow` is the webpage model: nodes stack as full-width sections in order, auto-height, responsive by construction. One data model, two renderers; a page can nest `free` regions inside a `flow` document via the `frame` node. This is what makes "a base webpage style layout" and "any custom layout" the same editor.
- **`cm_canvas_nodes`**: one row per placed object, author-signed. Columns: `id` (signature-bound event id), `canvas_id`, `community_id`, `author_device`, `node_type`, `schema_version`, `props_json` (8 KB cap, type-exact Zod parse per node type), `layer` (`background` | `structure` | `open`), `x`, `y`, `w`, `h`, `rotation`, `z`, `version`, `version_nonce`, `tombstone`, `created_at`, `updated_at`, `signed_by`, `signature`. Entity rule `shared_workspace/shared_workspace`, lww.
- **`cm_canvas_strokes`**: freehand drawing, append-only signed stroke events (point array, brush enum, color token, width), or_set. Strokes are immutable; erasing is a signed tombstone.
- **Merge rule** (`canvas-core.ts`, pure, twinned): per node, higher `version` wins; tie broken by lower `version_nonce`; deterministic on every peer. A node failing signature or schema verification is dropped ALONE; the rest of the canvas renders. Reparenting/moving never changes read permissions (content tree and permission scope are separate fields, the Notion lesson).
- **Protocol**: `packages/sync/src/protocol/community-canvas.ts`, canonical-bytes domains `meerkat-canvas-v1` / `meerkat-canvas-node-v1` / `meerkat-canvas-stroke-v1`, `create*Event` / `verify*Event` / `resolve*` mirroring `community-identity.ts` line for line. Validators registered in `SIGNED_ROW_VALIDATORS` for all three tables (forgeries rejected before INSERT, DELETE rejected, tombstones only).
- **Assets**: every image, sticker, sound, or file a node references is a sealed share addressed by content id, wrapped under the workspace epoch key exactly like library objects (`key_epoch` + `wrapped_key` in the signed row). Node prop columns that carry manifests are named `*_manifest_json` so `collectBlobRefs` replicates their blocks with zero pipeline changes. Membership is the read capability; `historyScope` and removal semantics apply automatically.

### 3.2 The node registry

The generalization pattern from `MEDIA_TYPE_REGISTRY` and the composition plan's block registry, delivered as `canvas-node-registry-core.ts` (pure, twinned) plus per-surface renderer maps (`components/canvas/registry.tsx` on each surface):

```ts
interface CanvasNodeContract {
  propsSchema: ZodType;              // total, closed, type-exact; unknown keys stripped
  schemaVersion: number;             // with migration sequence
  layers: readonly Layer[];          // which layers this type may live on
  behaviors: readonly BehaviorKey[]; // closed enum: none|toggle|flip|counter|open|reveal
  maxPerCanvas?: number;             // per-type cap
  receiverClass: 'static' | 'animated' | 'audio' | 'interactive' | 'external_link';
  fallback: 'placeholder';           // unknown type/version renders honest placeholder
}
```

`receiverClass` is what the receiver-side dials key on (3.6). An unregistered type, a failed parse, or a future `schemaVersion` renders `NodePlaceholder` with honest copy ("A decoration this build does not support yet").

**The bridge node: `block_embed`.** One node type wraps any block from the composition plan's block registry: props are `{blockType, config}` validated against that registry's own `configSchema`, rendered through that registry's renderer map, gated by the same capability manifest, reading only the tables the block's contract declares. This single node type is what turns a member page into "anything": a video feed tab is a `flow` page with a `video_gallery` or `shortform_pager` block; a forum page embeds `posts`; a files hub embeds `files`; a landing page mixes hero blocks with freeform canvas regions. A declared-but-unavailable block renders the composition plan's honest pending card unchanged. Canvas never reimplements a block, so the two systems cannot drift.

### 3.3 Interactivity without code: the closed action vocabulary

The Adaptive Cards lesson: a fixed verb set covers most of what people mean by "interactive," with zero execution. v1 verbs, dispatched by a host-owned reducer (`canvas-actions-core.ts`, pure, twinned):

- `toggleVisibility(targetNodeId)` and `reveal(targetNodeId)` (scratch-offs, spoilers, advent doors; time-gated variants resolve from device clock)
- `setLocalState(key, value)` (device-local, never replicated; tabs, accordions, collapsed states)
- `navigate(target)` where target is a channel, post, canvas, or member profile inside the community (never a URL)
- `increment(counterId)` emitting a real signed counter event (guestbook waves, hit counters, honest by construction)
- `vote(pollNodeId, option)` emitting a signed vote event
- `playSound(packId, soundId)` (receiver-gated, tap-only by default)
- `openExternal(linkNodeId)` routing through the embed consent interstitial from the composition plan (named destination, per-site memory); the ONLY path to the network, and it is user-initiated by definition
- `submitAnswer(nodeId, text)` checked against a hash commitment in the node props (treasure hunts and puzzles with verifiable answers and no oracle)

Behaviors on nodes (the Habbo furni lesson) are the same verbs bound to tap targets. State changes are ordinary signed events or device-local state; nothing else exists.

### 3.4 Parameterized generative content

Members choose parameters and seeds, never code (the Minecraft datapack lesson, the SkSL refusal). A host-owned effect catalog (`canvas-effects-core.ts`, pure, twinned): confetti, sparkle, drift/rain/snow particles, gradient sweeps, generative-art nodes (flow fields, truchet tiles, l-system plants) driven by clamped numeric params plus a PRNG seed carried in the signed node. Every member renders the identical result from the seed. Reduced-motion and high-contrast overrides always win (already the `resolveActiveTheme` rule; it extends to effects and is guard-tested). Rendering uses declarative Skia nodes if `@shopify/react-native-skia` is adopted, else RN primitives + SVG subset; no member-supplied shader source ever.

### 3.5 The rule engine (declarative behavior for the community itself)

The Minecraft-datapack / Twitch-channel-points tier: `cm_rules`, owner/curator-signed declarative rule cards over a fixed trigger/condition/action vocabulary, evaluated locally by a bounded engine (`rules-engine-core.ts`, pure, twinned; evaluation budget per event, no network reach, no clock beyond device time, every action is an ordinary signed event or local effect):

- Triggers: message posted (channel, pattern class), member joined, date/time window, milestone count reached, reward redeemed.
- Conditions: channel, role, count thresholds, content class (link, image, file).
- Actions: add reaction, post templated message (attributed to the rule, never impersonating a member), award badge, unlock reveal node, apply seasonal theme window.

Custom slash commands (`/roll`, `/standup`, `/vibecheck`) are rule cards with a command trigger. Redeemable rewards (Twitch model, hard cap 50 per community) are rule cards with a redemption trigger and a real signed redemption event. Community labelers (Bluesky model) are signed label events other members can subscribe to in their receiver dials. Loop safety: rule-emitted events never trigger rules (one-hop fuse, guard-tested).

### 3.6 Receiver-side render control (moderation without a server)

`mk_render_prefs`, device-local, never replicated. Per community and globally, every member dials: animations (on/reduced/off), sounds (on/tap-only/off), custom fonts n/a (excluded by F9), backgrounds and wallpapers (on/dimmed/off), stickers and drawings from non-curators (on/off), external link cards (on/off), effects (on/off), specific-author mute (hide everything by a device id, locally). Defaults are conservative: sounds tap-only, everything else on. High contrast and reduced motion from OS accessibility settings always win over everything. Subscribed labels (3.5) can auto-collapse matching content behind an honest notice. This is the entire moderation answer for a serverless system, and it works offline.

Owner/curator moderation is the signed tombstone: a curator-signed `curator_remove` tombstone on any open-layer node (reversible, logged, visible in the time machine as "removed by curator"). The author's original event remains in history; the canvas renders the removal. No silent deletion exists.

## 4. Surfaces (where Canvas appears)

1. **The Commons**: one community-wide freeform canvas, a new channel kind value `canvas` (rides the existing kind slot; old clients render the standard unknown-kind read-only banner, verified graceful). The mmm.page model: absolute positioning, free overlap, free rotation, no grid.
2. **Channel toppers**: a decoratable header canvas above any channel's message list (encountered in normal flow, not a destination nobody visits). Bounded height, structure layer only by default.
3. **Profile pages, one per community**: every member's per-community profile is a full designable page (the MySpace profile reborn, built with the same editor, free or flow layout): stickers, blocks, top-8 friends module, profile song, guestbook, badge case, 88x31 button strip, embedded posts. A member designs a DIFFERENT profile in every community if they want: the profile canvas keys on (community_id, device_id), extending the existing per-community signed `cm_profiles` v2 pattern (which already scopes avatar and name per community) with a canvas id. A member with no designed profile in a community renders the standard profile card; an optional "use my default design here" copies a chosen design forward as a starting draft, never a live link (each community's profile stays independently editable and independently signed, and content sealed under one community's epoch keys never references another's). Verified rendering follows the `resolveCommunityAvatarImage` precedent: only signature-valid pages render, per node.
4. **Member pages and custom tabs**: any member (role-gated by the community's member-build policy) builds full pages with the editor: a video feed, a wiki-style page, a links hub, a fan shrine, an event hub, a storefront, or any custom layout, mixing `block_embed` blocks and freeform nodes. Every community gets a **Pages directory** (a host surface, always present) listing member pages with author attribution, newest and pinned first. Owners and curators **promote** a page to a top-level community tab: one descriptor revision appends a channel with kind `page` bound to the canvas id (a new kind VALUE riding the existing signed kind slot, so old clients degrade to the standard read-only banner and signatures never break, per F4). Member tab creation is therefore propose-then-promote, honoring the owner-signed descriptor; within a page the member's creative control is total, subject only to the security invariants in section 7. Demotion is another revision; the page survives demotion in the directory.
5. **Canvas posts**: a freeform mini-canvas as a first-class post type in the existing posts substrate (the Farcaster lesson: the post is the container, blast radius one card). Renders in feed via a new feed item kind mapped in `feed-view-core.ts`.
6. **The Plaza**: a shared pixel board (r/place model), `pixel_board` canvas kind: fixed grid, one signed pixel event per placement, per-member rate limit enforced at apply time (a validator can count), full history replayable as a timelapse. Pure or_set append, spectacular communal artifact, zero execution.
7. **Snapshot dreams** (the Animal Crossing lesson): freeze any canvas into a signed, immutable, content-addressed sealed share, distributable as a standard Meerkat share link. Read-only by construction, cannot touch the live community, works over the existing share-link + verify-then-pin path with no session. This is also the template-sharing mechanism: "make my Commons look like theirs" is an import of a snapshot into draft state.

## 5. The feature catalog

Tags: [D] pure declarative data. [A] declarative + sealed asset bytes. [R] rule-engine. [S] deferred code track (section 14). Phase in parentheses.

### Visual and theming
1. [D] Extended community theme tokens: typography scale, corner radius, border weight, shadow depth, bubble shape, density, background treatment; closed enums layered on the existing 22-token profile (P1)
2. [A] Community wallpapers and pattern tiles with automatic contrast-safe scrim (host-enforced legibility, never member-disableable) (P1)
3. [D] Per-channel theme overrides via `cm_canvas` policy on the topper, never via descriptor fields (P2)
4. [D] Message bubble skins per role or member, from a closed shape catalog (P2)
5. [A] Custom reaction emoji and animated sticker packs (`cm_asset_packs`, uploader-signed, sealed blobs, refcounted; slots capped) wired into the existing v2 `react` intent read model (P2)
6. [D] Member name colors picked from the community palette (contrast-valid by construction) (P2)
7. [A] Web cursor trails and press effects; mobile haptic and touch-ripple signatures, from a host catalog (P3)
8. [R] AI-assisted theme and canvas generation: the generator emits only closed-vocabulary tokens and node records, so a hostile prompt cannot produce a hostile artifact (P5)
9. [D] High-contrast and reduced-motion always win, surfaced in the editor so authors design against them (P1)

### Spatial and canvas
10. [D] The Commons freeform canvas (P1)
11. [D] Channel toppers (P1)
12. [D] Sticker layer over message threads: stickers dropped at x/y over conversation history, signed and timestamped (P2)
13. [D] Node behaviors: toggle, flip, open, reveal, counter (P1)
14. [D] Three-layer permission model with per-layer roles and the one-bit "Members can build" toggle (the Gather lesson) (P1)
15. [A] Community map rooms: a Gather-style tile grid where channels are rooms and members place furniture (P5)
16. [D] Snapshot dreams: read-only shareable canvas snapshots (P3)
17. [D] Time machine: scrub the community's appearance backward through the signed event log; falls out of the data model (P3)
18. [D] The Plaza pixel board with rate-limited placements and timelapse replay (P3)
19. [D] Collaborative drawing: signed stroke events, replayable (P3)
20. [D] Live co-decorating during real sync sessions with live cursors from actually connected peers only (never a fabricated presence) (P3)

### Interactive
21. [R] Rule cards (P4)
22. [R] Custom slash commands (P4)
23. [D] Polls, forms, and templates as canvas nodes and post types with signed responses (P2)
24. [R] Community feed filters and sort orders as shareable signed weight vectors (extends the composition plan's ranking interface; chronological structurally always available) (P4)
25. [R] Redeemable rewards, 50 cap, real signed redemptions (P4)
26. [R] Community labelers: signed content labels, subscribable receiver-side (P4)
27. [D] Treasure hunts, puzzles, scratch-offs, advent calendars: hash-committed answers and time-gated reveals, verifiable with no oracle (P4)
28. [D] Guestbooks: append-only signed visit notes, distinct from chat (P2)
29. [D] Hit counters and presence stones counting only real recorded events; if it cannot be counted honestly it does not ship (P2)
30. [D] Countdown and celebration cards (launch days, anniversaries, streaks from real counts) (P2)

### Audio and music
31. [A] Community soundboard: sealed audio, rate-limited, receiver tap-only by default (P3)
32. [A] Profile songs: never autoplay, always attributed, listener always in control (P3)
33. [A] Custom notification and join sounds per community with a global user override (P3)
34. [D] Collaborative playlists as signed member contributions (data, not a streaming integration) (P3)
35. [A] Voice-note stickers: 3-second clips on the canvas or as reactions, never leaving the encrypted room (P3)
36. [D] Tone sequencer nodes: tracker-style pattern grids (notes, instrument ids from a host catalog, effects enums, all integers, voice and length caps) rendered by `react-native-audio-api`; composition as pure data (P5)

### Collectibles and economy
37. [D] Community-minted badges: owner-signed mint with a signed supply cap, awarded to members, displayed on avatars and profile canvases; scarcity is verifiable, not promised (the Habbo rares lesson) (P2)
38. [D] 88x31 buttons: tiny declarative badges members design, trade, and strip onto profiles; near-free to build, culturally enormous (P2)
39. [D] Decoration packs as signed, remixable objects carrying Second-Life-style creator permissions (`remix` / `copy` / `transfer`) in the signed payload (P5)
40. [D] Attribution trails: every decoration shows its author; remixes show cryptographic lineage (P2, deepened P5)
41. [D] Contribution wall: an auto-composed canvas of who added what (P3)
42. [D] Seasonal and limited-edition sticker drops (owner mints edition of N) (P3)
43. [D] Webrings between communities: signed mutual-link nodes rendered as a ring strip on the Commons; discovery stays in the verify-then-pin path (P5)

### Ritual and ambient
44. [R] Seasonal scheduled theme and sticker windows resolved from device clock (P3)
45. [R] Community weather and mood: ambient visual state computed from real recorded activity only, deterministic, never decorative fiction (P4)
46. [D] Milestone and anniversary auto-cards from real counts (P2)
47. [R] The burrow pet: a community mascot that grows through real recorded activity counts, deterministic across members, honest by construction (P4)

### Pages and tabs
48. [D] Member-built pages: full custom pages in free or flow layout, mixing blocks and canvas nodes (P1)
49. [D] The Pages directory: always-present, attributed, pinnable listing of member pages per community (P1)
50. [D] Promote-to-tab: owner/curator promotion of any member page to a top-level community tab via one descriptor revision (`page` kind channel) (P1)
51. [D] Video feed tabs, forum tabs, files hubs, event hubs, storefront pages: `block_embed` over the composition block registry inside member pages; each block arrives when its composition phase ships and renders the honest pending card before that (P1 bridge, blocks per composition schedule)
52. [D] Page templates: starter layouts (fan shrine, wiki page, link hub, zine, gallery wall) shipped as host presets plus community-shared snapshot templates (P2)

### Identity
53. [D] Per-community personas: avatar, name color, bio, pronouns, badge case per community (extends signed `cm_profiles`) (P2)
54. [D] Per-community designable profile pages: a different full profile design in every community, same editor, top-8 module, song, guestbook, button strip, default-design copy-forward (P2)

### Deferred code track
55. [S] Post-scoped mini-apps (iframe sandbox) and the Meerkat widget DSL (section 14) (P6, gated)

## 6. Data model and sync policy summary

New tables, all covered by the existing rule-less-table guard test the moment DDL and entity rules land together, all with `id` = rowId:

| Table | Scope (default/max) | Strategy | Signed by | Validator |
|---|---|---|---|---|
| `cm_canvas` | shared_workspace | lww | owner (community kinds), author (profile/post) | yes |
| `cm_canvas_nodes` | shared_workspace | lww | author | yes |
| `cm_canvas_strokes` | shared_workspace | or_set | author | yes |
| `cm_asset_packs` | shared_workspace | lww | uploader | yes |
| `cm_rules` | shared_workspace | lww | owner/curator | yes |
| `cm_badges` | shared_workspace | or_set | owner (mint), owner/curator (award) | yes |
| `cm_canvas_counters` | shared_workspace | or_set | author of each increment | yes |
| `mk_render_prefs` | device_local | n/a | n/a | n/a |
| `mk_canvas_drafts` | device_local | n/a | n/a | n/a |

Signed moderation (`curator_remove`) and all deletions are tombstone events. Raw DELETE is rejected by the validators (existing `signed_row_delete_rejected` behavior). Asset manifests live in `*_manifest_json` columns so `collectBlobRefs` replicates sealed blocks automatically. Per-viewer state (widget local state, collapsed nodes, scroll, dials) is device-local and never replicates, same treatment as `mk_share_intake` and `cm_public_feed_cursor`.

## 7. Security and honesty invariants (binding checklist)

1. **No execution.** Phases 1 to 5 contain zero paths where member-authored bytes are executed, interpreted as code, or compiled. Interactivity is the closed verb set; generativity is params + seed.
2. **No URLs.** No node prop, style token, or asset reference can name a network destination. Assets are content ids resolved through pinned blobs or verify-then-pin. `openExternal` link nodes route through the embed consent interstitial and render a host-drawn destination chip the author cannot style.
3. **Reserved chrome is unreachable.** Canvas renders only inside canvas boundaries within community route subtrees. Tab bar, Feed, Messages, DM threads, connection status card, verification badges, encryption indicators, and system banners never share pixels with member content. Extend the theme-leakage test family with `canvas-chrome-leakage.test.ts` on both surfaces.
4. **Anti-spoofing floor.** No node type may render host iconography (checkmarks-in-shields, lock glyphs, status pills); the sticker/emoji pipeline excludes glyphs from the reserved set at pack-validation time; text nodes render in content typography, never chrome typography. Trust indicators are always host-drawn outside the canvas layer.
5. **Fail-closed everywhere.** Unverified signature: node dropped alone. Failed or type-inexact parse: dropped. Unknown type or future schemaVersion: honest placeholder. Rule-less table: device_local. Unknown kind: read-only banner. Nothing ever guesses.
6. **Honest numbers only.** Counters, hit counts, redemptions, pet growth, weather, contribution walls: all derive from verified signed events or real store stats. No extrapolation, no seed-faked liveliness, no fabricated presence. Live cursors appear only for peers in a real connected session.
7. **Contrast and motion floors are host-enforced.** The scrim under wallpapers, minimum contrast on text nodes, reduced-motion and high-contrast overrides: enforced in the renderer, not requested of authors.
8. **No member fonts, no Lottie in member content** (F9). Curated host catalogs only.
9. **Receiver sovereignty.** Every animated, audible, external, or non-curator decoration class is locally dimmable or bappable per member. Nothing renders that the receiving user cannot turn off, except static curator/owner content within the community they chose to join.
10. **WebView surfaces** (rich page nodes, P5): reuse `library-reader-core.ts` verbatim (strip active content, inline resources, `default-src 'none'`, JS off, navigation pinned), with `font-src 'none'` on this surface. A test asserts `setSupportMultipleWindows` must be true on any WebView that ever enables JavaScript (CVE-2020-6506 class).
11. **Caps before launch** (section 10), enforced at apply time by validators where possible (node counts, pixel rate limits, pack sizes), locally otherwise.
12. **Parity is a security property.** Every new `*-core.ts` lands with its CORE_TWINS lock entry in the same commit (composition Phase 0 meta-guard makes forgetting impossible). Node type registry and token vocabularies are parity-locked like connection-card strings.
13. **Copy honesty.** A widget is never "live" (it updates when a sync connects); no content is ever "verified safe" (there is no scanner); staged is never sent; the existing register ("Available from members who have it, when a sync connects") is the template.

## 8. Editor UX

- **One editor, every surface.** The canvas editor edits the Commons, toppers, profile canvases, and canvas posts with the same interaction model: tap-to-add from a node palette (the straw.page sticker-library lesson: a non-designer gets a good result in 10 seconds), drag to place, pinch/rotate, long-press for the node sheet (props form generated from the node's Zod schema, the layout-editor pattern), layer picker gated by role.
- **Live preview is the product.** The editor renders through the real registry and real resolver, exactly like the theme editor; publish emits the signed node events. Draft state in `mk_canvas_drafts` survives app restarts.
- **Templates and remix.** Import a snapshot dream into drafts; the Tumblr live-preview-before-install consent model; attribution carried in the signature chain.
- **Editing honesty.** "Published" means locally recorded signed events; propagation copy follows the standard sync register. Presence cursors only in live sessions.
- **Accessibility panel in the editor:** a one-tap preview of your canvas under high contrast, reduced motion, and sounds-off, so authors see what receivers may see.

## 9. Web twin

Everything in this plan ships on both surfaces in the same phase, parity-locked. Web renders canvases in the existing community route tree (`CommunityThemeBoundary` scope); pixel board and editor use pointer events; cursor trails are web-only sugar behind the same receiver dial. Web ships no additional transports and no additional capabilities; the canvas data model is surface-agnostic by construction.

## 10. Caps and budgets (set now, while nobody has content to break)

- Nodes per canvas: 2,000 (Commons), 200 (topper), 500 (profile), 800 (page), 100 (post). Strokes: 10,000 per canvas with coalescing. Pages per member per community: 20; promoted tabs per community: 12 (tab bar legibility, owner-controlled).
- `props_json`: 8 KB per node. `policy_json`: 8 KB. Pack manifest: 16 KB.
- Asset packs: 64 items per pack; emoji 256 KB each (Discord parity), stickers 512 KB, sounds 256 KB / 5 s, wallpapers 2 MB; per-community decoration blob budget 256 MB riding the existing pin budget with pin class `policy`.
- Pixel board: 512 x 512 max, 1 placement / 30 s / member (validator-enforced), configurable stricter by owner.
- Event rate: 120 canvas events / member / hour at apply time.
- Rewards: 50 per community. Badges: supply cap in the signed mint.

## 11. Phases, dependencies, effort

Solo-founder-plus-agent-fleet calendar weeks, same basis as the composition plan. Every phase leaves the app releasable; every phase ships mobile + web + parity locks + tests together.

| Phase | Delivers | Depends on | Effort |
|---|---|---|---|
| C0 | Composition plan Phase 0 + 1 (parity meta-guard; block registry, `cm_layout`, layout editor) | none | (carried by that plan, ~4-5 wk) |
| C1 Canvas core | `packages/meerkat-canvas` codec, three protocol event kinds + validators, `cm_canvas`/`cm_canvas_nodes`/`cm_canvas_strokes` + entity rules, node registry + 11 core node types (text, image, sticker, shape, frame, link card, guestbook, poll, counter, divider, `block_embed`), free + flow layout renderers, merge resolver, layer permissions + member-build toggle, `canvas` + `page` channel kinds, Commons + topper + member pages + Pages directory + promote-to-tab, editor v1, receiver dials v1, chrome-leakage + anti-spoof guard tests | C0 | ~4-5 wk |
| C2 Packs + identity | Asset packs (emoji/sticker into the react pipeline), per-community designable profile pages + personas + top-8 + guestbook + copy-forward, badges + mints + 88x31, canvas posts + feed kind, polls/forms, page templates, milestone cards, honest counters, sticker-over-thread layer | C1 | ~3 wk |
| C3 Ambient + audio | Soundboard, profile songs, notification sounds + global override, voice-note stickers, playlists, effects catalog + generative nodes, seasonal windows, drawing + live co-decorating (session cursors), snapshot dreams, time machine, the Plaza, contribution wall, limited editions | C1 | ~3-4 wk |
| C4 Rules + rewards | Rule engine + cards, slash commands, rewards + redemptions, labelers + subscriptions, feed weight vectors, treasure hunts/advent, weather/mood, burrow pet | C1 | ~3 wk |
| C5 Pages + marketplace | WebView rich-page nodes (reader sandbox, font-src none), decoration packs + remix permissions + lineage, template gallery over snapshot dreams, webrings, community map rooms, tone sequencer, AI-assisted generation (token-emitting) | C1, C3 | ~3-4 wk |
| C6 Code track (gated) | Section 14; only on its explicit unlock criteria | C1, founder sign-off | ~4-6 wk when unlocked |

Total code effort C1 to C5: roughly 16 to 18 weeks, front-loaded so that after C1 members are already building freely on real communities.

## 12. Verification plan

- Unit: node schema type-exactness (fixture per type, malicious-props corpus), merge determinism (version/versionNonce property tests), validator forgery/tombstone/DELETE-rejection suites, rule-engine budget and one-hop fuse, hash-commitment puzzles, cap enforcement.
- Guard tests (the load-bearing ones): rule-less-table guard extension, `canvas-chrome-leakage.test.ts` both surfaces, anti-spoof glyph exclusion, reduced-motion/high-contrast always-win, WebView props assertion, registry-fallback (unknown type/version renders placeholder), no-URL structural test (grep-style over node schemas for url-shaped fields).
- Parity: CORE_TWINS entries for every new core in the same commit; node registry and copy strings parity-locked in `check-meerkat-parity.mjs`.
- Signature compatibility: fixture-locked canonical bytes for all three event kinds; a legacy fixture per schemaVersion migration.
- Live evidence (cannot be claimed from tests): two-device co-decorating session over relay, snapshot dream round-trip between devices, pixel-board rate limit under concurrent placement, receiver-dial behavior on a hostile decoration set, Expo Go vs dev build degradation pass.
- Gates: `pnpm gate:function:changed` per change; full battery + `check:parity` + transport NC gate per phase; `/browse` + `/qa` on web surfaces per gstack rules.

## 13. Open design questions, answered

1. **Should members edit rich text collaboratively at character level?** Not in C1-C5. Per-node LWW is the correct trust boundary (F5); concurrent text merging inside one node is deferred until a signed-op CRDT payload can be scoped per-block without becoming the document model. The Commons is about placing and composing, not co-typing.
2. **Can the Commons replace the community home?** No. The composition plan's `cm_layout` owns the home surface; a Commons canvas is a block/channel within it. One owner-signed spine, one member-freeform layer, no ambiguity about which wins.
3. **What stops a member covering the whole Commons in noise?** Layers (owner background, curator structure, member open layer), per-type and per-member caps, curator tombstones (reversible), receiver dials, and the time machine making vandalism cheap to undo and expensive to repeat (rate limits at apply time).
4. **Why not ship the script sandbox now behind a flag?** Because no defensible runtime exists on Hermes today (F1) and a flag does not change the VM landscape. The declarative catalog is not a compromise position; it is 90+ percent of the surveyed value. The unlock criteria in section 14 are objective, not vibes.
5. **Does decoration data leak anything to the relay?** No new channel: canvas events are ordinary encrypted synced rows inside the pairwise frame envelope; assets are sealed blobs. The relay continues to see sizes and timing only.
6. **Why can members not add tabs directly?** Because the tab bar is descriptor state and the descriptor is owner-signed; a member-signed descriptor would break the trust model that makes community structure unforgeable. Propose-then-promote preserves total member creative freedom at the page level (build anything, listed instantly in the Pages directory) while the one-tap promotion keeps the tab bar an owner-curated, signed surface. This is also the anti-abuse answer: a hostile member cannot spawn twelve tabs.
7. **Do per-community profiles link across communities?** Never automatically. Copy-forward duplicates a design as a draft; each community's profile is independently signed and sealed under that community's keys. Correlating a person across communities remains exactly as hard as it is today (the Plan 52 person-identity rules are untouched).

## 14. Deferred track: user code (C6, explicitly gated)

The end state everyone asks for (user-authored mini-apps) has exactly two defensible shapes, and both are gated:

- **Track A, the Meerkat widget DSL (preferred).** The LiveJournal S2 lesson: invent the language. A tiny pure expression language (no I/O, no clock, no network, no recursion, gas-metered) evaluated to a declarative scene graph by an interpreter WE own, identical on both surfaces. Strictly safer than embedding any JS runtime, portable, and testable. Unlock criterion: C4 rule engine proven in production (its vocabulary is the seed of the DSL), plus a written interpreter spec reviewed under `/plan-eng-review`.
- **Track B, post-scoped iframe mini-apps.** The Discord Activities / Farcaster shape, only ever scoped to a single post card, never the shell: nested `<iframe sandbox="allow-scripts">` (never allow-same-origin) inside the network-blocked WebView, postMessage-only, Roblox-style enumerable capability list shown to the user before first run, per-community opt-in, dev-build first, host-side watchdog unmount. Unlock criteria: Hermes WASM (or an equivalently isolatable runtime) verified in OFFICIAL RN release notes at the SDK 56 checkpoint for anything beyond the WebView shape, plus founder sign-off on the consent design.

Until a track unlocks, the honest copy is: Meerkat runs no one's code on your device, and that is a feature.

## 15. Bookkeeping

On execution: session log per phase under `docs/sessions/`, memory.md row per phase, errors_log.md on real triggers, Open Brain capture per phase with context "personal, mylife", and this plan moves queue -> active -> done with the standard lifecycle. Plan HTML twin ships beside this file and regenerates on every material edit.

---

Prepared 2026-08-28. Grounded in three research tracks cross-checked against source by the author. This is a planning artifact: statuses reflect the repo at the time of writing and must be re-verified against code before each phase begins.
