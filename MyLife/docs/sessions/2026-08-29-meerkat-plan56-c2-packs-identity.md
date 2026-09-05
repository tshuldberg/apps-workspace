# 2026-08-29 - Meerkat Plan 56 C2: packs + identity (in progress)

## What

Phase C2 of Plan 56 (Canvas, the freeform community creation layer) on branch
`feature/meerkat-plan56-c2-packs-identity`, five commits, both surfaces in the
same commits, every signed table landing with DDL + entity rule + validator +
tombstone discipline in one commit.

1. **Badges + persona identity + member profiles** (`1c6ef166`)
   - `cm_badges` (features 37-38): owner-signed mints with verifiable supply
     caps, owner/admin awards, protocol-side anti-spoof glyph gate
     (`SYNC_RESERVED_SPOOF_GLYPHS`), apply-time validator, `badges-core` twin
     (CORE_TWINS), `badge_case` + `button_88x31` node types, mint/award UI in
     both community settings.
   - Community profile v3 (feature 53): bio / pronouns / closed nameColor
     tokens via conditional canonical append (`meerkat-community-profile-v3`
     domain); persona rides the Plan 52 presentation rail (single-writer
     alignment) with the pseudonym privacy rule (override communities never
     receive the global persona); persona editors in both profile editors;
     verified nameColor on chat author lines through the props-only chat kit.
   - Member profile surfaces (feature 54): mobile route
     `community/[communityId]/member/[deviceId]` + web `member-profile` pane;
     standard verified card (persona + badges) + the member's designed
     kind-'profile' canvas + Design-my-profile + copy-forward across
     communities (new signed events, re-sealed assets via
     `resealCanvasAssetForCommunity`, honest skip counts); `top_friends` node
     (1-8 members, render-checked membership) with editor picker. Registered
     the C1 canvas routes with `href:null` (latent tab-bar leak fixed).
2. **Asset packs** (`c6bdef0b`, feature 5): `cm_asset_packs` uploader-signed
   emoji/sticker packs; per-identity lww (entryVersion), original-uploader
   binding (no slug hijack), curator moderation tombstones that cannot be
   outrun, 64-slot cap at resolution AND apply time; sealed item images ride
   `asset_manifest_json` -> collectBlobRefs. Custom reactions ride the v2
   react intent as `mkpack:<packId>:<slug>` (bounded regex beside the emoji
   grammar; old builds drop fail-closed). Chips render verified glyph /
   decrypted image / honest `:slug:` fallback; pickers gain community emoji;
   pack management in both settings. `asset-packs-core` + `canvas-assets`
   CORE_TWINS-locked.
3. **Sticker layer over threads** (`4ce952b9`, feature 12): new
   `thread_overlay` canvas kind value (subjectId = channelId, member-signed,
   400-node cap); stickers are signed canvas nodes anchored to a message via
   parentId (glyph 'sticker' nodes or sealed pack-image 'image' nodes).
   Stick-a-sticker rows on both surfaces; receiver dials (mute,
   member_decorations) via the same applyRenderPrefs path; author/curator
   tombstone removal. `createCanvasNodeEvent` now rejects a non-hex parentId
   at create (verify-side gate mirrored).
4. **Canvas posts + feed kind** (`6a3ef193`, 4.5): canvas exists first
   (author-signed kind 'post', subject = own id, 100-node cap); post root
   carries only `mkcanvaspost:<id>`; composers gain a Canvas post action;
   threads render the verified canvas via CanvasHost or the honest
   not-arrived line; new 'canvas' feed kind mapped in feed-core /
   feed-view-core.
5. **Milestone cards + page templates** (features 30/46, 52): `milestone`
   node (signed date is the only authored fact; countdown/countup/anniversary
   lines are pure render math over the viewer's clock); five host starter
   layouts applied as the member's own signed nodes; shared snapshot
   templates over the meerkat-canvas codec (export skips sealed assets with
   honest counts; import strict-decodes then registry-revalidates under the
   importer's signature). Editor Templates / Copy code / Import rows both
   surfaces.

## Verification

Per commit: `pnpm gate:function:changed` (also enforced by the pre-commit
hook), `check-meerkat-parity.mjs`, mobile suite (155 files / 1594 tests), web
suite (142 / 1117), sync suite (206 / 2605), meerkat-canvas (7); full
`pnpm check:parity` before the final commit. New sync suites:
community-badges (6), community-asset-packs (9), profile v3 persona (5 added,
13 total), person-group persona (3 added, 38 total). App suites:
canvas-core.test.ts grew to 30 (profiles, copy-forward, top_friends,
stickers, canvas posts, milestones, templates), asset-packs-core (3), all
mirrored to the web twins.

## Completion (same day, branch `feature/meerkat-plan56-c2-theming`)

After the five verticals merged to main, the final two C2 features landed on a
follow-up branch:

- **Feature 3** (per-channel theme overrides): optional `themeExtras` on
  `MkCanvasPolicy` (closed enums mirroring the meerkat-theme axes, pinned by
  a drift-guard test), read via `channelThemeExtras` from the OWNER-SIGNED
  channel_topper policy, merged per axis over the community theme by both
  theme boundaries (mobile `CommunityThemeProvider` `channelExtras`, web
  `CommunityThemeBoundary` `channelId`); owner-only Channel style section in
  the topper editor on both surfaces. Never a descriptor field.
- **Feature 4** (role bubble skins): `MkThemeStyleExtras.bubbleShapesByRole`
  (strict schema, closed shape catalog; older builds reject the blob and
  fall back per the existing fail-safe); per-role pickers in both theme
  editors; the chat kit renders a host-resolved `authorBubbleShape` token
  through `bubbleRadiusForShape` (props-only).

With this, C2 is feature-complete: full batteries green (mobile 1596, web
1119, theme 116, canvas 7, sync 2605) + parity + gate.

## Notes

- Open Brain MCP tools unavailable in this session; captures skipped (not
  faked), same as C0/C1.
- IDE diagnostics repeatedly reported stale module-export errors; `tsc
  --noEmit` exit 0 on both surfaces was treated as authoritative throughout.
