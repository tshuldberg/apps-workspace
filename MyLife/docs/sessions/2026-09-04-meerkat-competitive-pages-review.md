# 2026-09-04 - Meerkat competitive claims and custom pages review

## What

Adversarial review of the 2026-09-01/02 Meerkat launch materials (investor pitch, launch marketing guide, complete user guide) against the code on `7a40639d` plus the working tree, the git history, and fresh competitor research. Deliverable: `docs/reports/REPORT-meerkat-competitive-and-pages-review-2026-09-04.md` with HTML twin; indexed in `docs/reports/README.md`.

## Method

- Code: read the block registry, layout core, canvas node registry, canvas core, both CanvasHost/CanvasSurface editors, block renderer registries, Pages routes, layout editors, caps package, parity locks. Ran `canvas-core` (33 mobile + 33 web), `canvas-chrome-leakage` (14), `block-data-scope` (5), `@mylife/meerkat-canvas` (7): all green.
- Git: creation-layer timeline (all of Plan 56 C0-C3 data landed 2026-08-29), doc commits after code.
- Competitors: four Opus research agents (messengers, community platforms, creator/page builders, page-builder state of the art), each instructed to fetch primary sources. Reviewer re-fetched the highest-impact pages (Briar maintenance mode, SpaceHey, WhatsApp Channels, Circle pricing, Element pricing, Patreon pricing) and confirmed Discord Server Guide/Shop, Session Communities, Signal limits and Delta Chat webxdc via search extracts of official pages.

## Findings

1. Creation layer: 16 block types in the registry but 7 renderers on both surfaces; 15 canvas node types (pitch says 16); Plaza pixel board is data-only (no screen); collaborative drawing has no input UI; the member editor is tap-to-add plus 16 px stepper buttons with no drag, pinch, undo, snapping, multi-select or zoom on either surface. Plan 56 C1/C2 shipped, C3 data only, C4/C5 unbuilt.
2. Launch materials list "the nine channel kinds", "a video channel, an events board, a shop front" and "the pixel board" as demonstrable; six of nine kinds and the pixel board render pending or unavailable cards.
3. Competitor sentences that fail: Discord/Slack "accent colors"; "Signal, SimpleX, Session, Briar offer no presentation layer"; "no encrypted messenger has shipped this" (Delta Chat webxdc); "products with privacy have nothing to decorate" (SpaceHey advertises no tracking); SpaceHey "1.9 million" (now 2M+, invite-only since 2026-03-15); Briar in maintenance mode since 2026-07-09; Session Communities not E2EE; Element per-user prices not published; Hotglue is GPL open source not commercial; mmm.page last number 17k in 2021; "0% platform fee" already offered by Ghost, Ko-fi Gold, Fourthwall, Whop.
4. What survives: no mainstream community platform lets members build freeform pages inside a community; nobody combines that with device-held keys, E2EE community content and signed authorship.
5. Marketing plan: operating discipline is excellent; the competitive frame, "safe to demonstrate" list and creation-layer proof language need correction before external use; the 2026-09-04 readiness headline order should replace "the second thing you say".

## Production-level pages spec (report section 8)

Author freeform, publish responsive; draft-then-publish (the 120 events/member/hour cap would be exhausted by a per-action drag editor); append-only plus revert; Level A accessibility (reading order, alt text, reduced motion, contrast); ship only drawn blocks. Build order: direct manipulation, fit-to-width artboard + zoom + snapping, draft/undo, layers/multi-select, accessibility prompts, schema-driven inspector, revert/time machine, template gallery and remix, drawing + Plaza UI, performance virtualization, UI tests. Owner side: nine missing renderers, Plan 58 audiences/tiers/preview-as, discoverable Commons, open-web renderer.

## Remaining

- Apply the file-by-file corrections in report section 9 (pitch, marketing guide, Plan 58 count, Plan 56 status block).
- Re-read Signal support, Discord creator-support and Patreon help-center pages in a browser before quoting them on a slide (blocked automated reads).
- Verify Circle's asterisk (annual billing?) and whether custom CSS sits on Professional or Business.

## Decisions

None taken; review only. No code changed. Open Brain not used.
