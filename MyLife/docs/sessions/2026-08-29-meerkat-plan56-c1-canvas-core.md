# 2026-08-29: Plan 56 C1, the Canvas core

## What

The first Canvas-visible phase, full function on both surfaces, branch
`feature/meerkat-plan56-c1-canvas-core` (4 commits, squash-merged to main).

### Protocol (@mylife/sync community-canvas.ts)

Four signed event kinds on the cm_community_identity spine: canvas registry
rows (per-kind signer authority: owner for commons/topper/pixel_board,
subject member for profile, members for post/page), author-signed nodes with
per-object LWW (nodeVersion/versionNonce, deterministic merge favoring the
LOWER nonce on ties, F5), append-only strokes with author-or-curator erase
events, and honest interaction marks (increment/vote/note, 3.3). Apply-time
validators in SIGNED_ROW_VALIDATORS enforce signatures, membership, the
three-layer role floors + the member-build toggle, per-kind node caps, the
20-pages-per-member cap, and the 120 events/member/hour rate, all BEFORE
INSERT; raw DELETE rejected on all four tables. Canonical bytes locked by
frozen fixtures (fixtures/legacy-community-canvas-events.json; never
regenerate). 21 protocol tests.

### Package (@mylife/meerkat-canvas)

Types, closed token vocabularies (colors/brushes/sizes, F2), the section-10
caps as constants, strict Zod schemas with exactly two fail-safe
forward-compat holes (unknown nodeType, future schemaVersion), and the
snapshot codec (drafts + future templates/dreams). A caps-parity test pins
the sync enforcement constants to these so they can never drift. 7 tests.

### Data layer (both surfaces, parity-locked)

cm_canvas / cm_canvas_nodes / cm_canvas_strokes / cm_canvas_counters DDL +
shared_workspace rules (auto-covered by the rule-less guards); device-local
mk_render_prefs + mk_canvas_drafts. canvas-node-registry-core: the 11 v1
node types (text, image, sticker, shape, frame, link_card, guestbook, poll,
counter, divider, block_embed) with strict F8 props schemas, the anti-spoof
reserved-glyph exclusion (locks/shields/checks, 7.4), in-community-only link
targets (no URL field exists, 7.2), and two-stage block_embed validation
against the composition block registry. canvas-core: verified-rows-only
reads with per-node fail-closed dropping (7.5), honest counters/polls
(last-vote-per-member)/guestbooks from verified marks only (7.6), receiver
dials with honest hidden counts + curator-content sovereignty (3.6), signed
write paths on the engine recordChange rail, sealed image assets via the
banner path generalized (canvas-assets), and codec-backed drafts. 19 tests
per surface + web mirrors.

### Surfaces (both)

The 'canvas' kind value joins KNOWN_CHANNEL_KINDS (a VALUE in the signed
slot; old clients render the read-only banner, correction 1.1). Canvas
channels render the Commons; any channel can carry an owner-created bounded
topper; the Pages directory (host surface: community home row on mobile,
sidebar entry on web) lists verified member pages with attribution, creates
pages, and promotes/demotes them to 'page'-kind tabs via one descriptor
revision (12-tab cap). Channel managers on both surfaces gain the
Chat|Canvas kind choice. The member editor: tap-to-add palette (role/layer
gated incl. member-build), node sheet (author-only edits, curator remove on
the open layer, move/size/turn/stack steppers), per-action signed publishing
("published" = locally recorded signed events), receiver preview, honest
not-local asset copy. Receiver dials sections in community settings.

### Guard tests

canvas-chrome-leakage on both surfaces (canvas mounts ONLY in community
subtrees; tab bar/Feed/Messages/DM/status card never import canvas
components; the renderer never references ConnectionStatusCard/VerifySheet/
AudienceBadge/MK_MONO or the network). Anti-spoof, no-URL, fail-closed
placeholder, strict-schema, and caps tests live in canvas-core.test.ts;
rule-less-table coverage is automatic via the existing guards.

## Deliberate scope notes (per the plan's own phase map)

- Stroke DRAWING UI is C3 (feature 19); the stroke substrate (table,
  protocol, erase authority, rendering) shipped now.
- Profile canvases are C2 (features 53-54); pixel boards, snapshot dreams,
  time machine are C3. The kinds and caps are already enforced.
- 'member' link-card targets no-op (no fabricated profile surface).

## Verification

Mobile 1580 / web 1103 / sync 2579 / canvas 7 tests; typechecks;
check-meerkat-parity (CORE_TWINS entries for canvas-node-registry-core,
canvas-core, canvas-assets in the same commits); full check:parity;
transport NC gate; gate:function:changed. Live evidence items (two-device
co-decorating over relay, dial behavior on a hostile set, Expo Go vs dev
build pass) remain for the plan's live-evidence ledger, as specified.
