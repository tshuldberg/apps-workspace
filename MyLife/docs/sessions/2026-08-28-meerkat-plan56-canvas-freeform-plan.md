# 2026-08-28: Meerkat Plan 56, Canvas freeform community creation layer

## What

Researched and authored Plan 56 (`docs/plans/queue/56-meerkat-canvas-freeform-creation-layer.md` + HTML twin): the member-side freeform creative layer for Meerkat communities. Members decorate, draw on, and build onto communities like free-editing a webpage: a signed-node canvas system (Commons, channel toppers, canvas posts, pixel Plaza), per-community designable profile pages, member-built pages in free or flow layout promotable to community tabs by owner descriptor revision, sticker/emoji/sound packs, badges and collectibles, guestbooks, rule cards, seasonal/ambient systems, and snapshot-dream sharing. 55-feature catalog; over 90 percent pure declarative signed data, zero user code execution in phases C1-C5; deferred gated code track (widget DSL or post-scoped iframe sandbox).

## Why

Founder request: large-scale freeform "add on to communities" feature maximizing creative control across all online expression formats. Complements the owner-side composition platform plan (REPORT-meerkat-composition-platform-build-plan-2026-08-24), which this plan depends on (C0) and never duplicates.

## Method

Four parallel research tracks, Fable-authored synthesis:
1. In-repo architecture map (verified cm_ schema, SIGNED_ROW_VALIDATORS, entity-rule guard tests, conditional canonical append constraints, blob pipeline `collectBlobRefs` conventions, theme choke points, parity gate mechanics, plan numbering).
2. Precedent survey (MySpace/Samy, Neopets, LiveJournal S2, Tumblr, Reddit CSS removal, SpaceHey, Notion, Figma plugin-sandbox history, Roblox, VRChat trust system, Second Life permissions, Minecraft datapack ladder, Habbo, Gather, ACNH dreams, Discord Activities, Twitch channel points, Farcaster, Bluesky labelers, Matrix, Obsidian) with a 7-rung safety ladder and 50 feature ideas.
3. Safe-UGC rendering research on Expo SDK 54 / RN 0.81 / Hermes: no WASM in Hermes (kills every script-sandbox option today), same-VM sandboxes refuted (Figma Realms, Screeps), per-object signed LWW (Excalidraw version/versionNonce) beats CRDT libraries under apply-time signature validation, WebView reader sandbox is the one mature isolation boundary, `font-src data:` risk flagged (FreeType CVE-2025-27363), CVE-2020-6506 `setSupportMultipleWindows` invariant.
4. An independent Codex (gpt-5.6-sol) critique memo was attempted twice (wrapper agent + direct run); the wrapper never delivered its output and the founder cancelled the track, so no Codex input shaped the plan. The three delivered tracks converged strongly on every binding decision.

## Key decisions

- Declarative-first is binding (F1): no member code execution in C1-C5; closed action verbs, params+seed generativity, rule cards.
- New signed event tables on the `cm_community_identity` pattern; descriptor untouched except new channel kind VALUES (`canvas`, `page`); member tabs via propose-then-promote (owner-signed descriptor stays the trust root).
- Assets are content-addressed sealed blobs; no URL can exist anywhere in node schemas (structural no-URL test).
- Receiver-side render dials (`mk_render_prefs`) are the moderation model; curator tombstones are reversible.
- Anti-spoofing (reserved chrome unreachable, no host iconography in packs) is a first-class invariant with its own guard tests.
- Per-community profiles never link across communities; copy-forward is draft duplication only.

## Files

- `docs/plans/queue/56-meerkat-canvas-freeform-creation-layer.md` (canonical)
- `docs/plans/queue/56-meerkat-canvas-freeform-creation-layer.html` (pandoc + plan-artifact.css, opened in browser)

## Verification

Docs-only session; no function logic changed, so the function gate was skipped (stated per AGENTS.md). Plan claims are grounded in the architecture track's source-verified seam map plus the composition plan's six-agent verification; the plan itself mandates re-verification against code before each phase begins.

## Remaining

- Jina MCP `UnauthorizedError` on every search call (API key issue) logged in errors_log.md.
- Open Brain MCP was not connected this session; no capture was possible (flagged to founder at session start).
