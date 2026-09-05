# 2026-08-24: Meerkat composition-platform engineering build plan

## What was done

Authored the full-ambition, engineering-grade build plan that turns Meerkat communities into a composition platform (assemblable interface blocks reaching functional parity with YouTube, Twitch, TikTok, Reddit, X, Discord, Patreon, Plex, and storefronts). Deliverables:

- `apps/meerkat/docs/reports/REPORT-meerkat-composition-platform-build-plan-2026-08-24.md` (canonical)
- Same-basename `.html` twin (opened in browser)

Method: read both 2026-08-24 baseline reports + `capability-status.ts`, then ran 6 parallel Explore agents to verify the five code seams (descriptor canonical append, channel kinds, theme/parity mechanics, media/library, torrent/swarm, rooms/live, feed/monetization/identity wall). All agent claims cross-checked against source (community.ts 160-260/500-615, types.ts, KNOWN_CHANNEL_KINDS).

## Key findings that shaped the plan (verified in source)

1. New descriptor FIELDS break signature verification on old clients; new signed EVENT TABLES and new channel-kind VALUES degrade gracefully. So the layout document + capability manifest + tier defs ride ONE new owner-signed event table `cm_layout` (cm_community_identity pattern), not descriptor fields.
2. Exactly one trailing conditional descriptor slot exists (`organization`); future verifier-visible fields must nest inside it (inner-length disambiguation) or signatures break.
3. The parity script does not self-extend; `feed-view-core`, `join-flow` (~106 lines drift), `public-directory-client`, `discover-core`, `public-reader-core`, `public-join-client` are unlocked today. Phase 0 adds a CORE_TWINS registry + meta-guard.
4. Video posters/transcode: nothing exists; no ffmpeg dep; `cm_library_items` lacks `thumb_wrapped_key` (schema is the blocker). Resolution: 3 transcode lanes (device thumbnails, WebCodecs author-side ladder, consent-gated hosted), identical sealed output.
5. Torrent stack: swarm half dead (no wire protocol, excluded from native barrel); catalog/web-seed half live; deployable seeder `meerkat-node.mjs` exists but not in production compose; blob-transfer already has have-list resume; two content models (catalog pieces vs sealed chunks) must reconcile on the sealed-chunk model.
6. Rooms: subscribe-only `viewer` role real; LiveKit group-rooms only; STUN-only 1:1; zero RTMP/egress/recording; room E2EE declared-but-unwired.
7. Feed: no ranking abstraction, toggles unpersisted; monetization rails real server-side with no client purchase surface; unlock boot-revalidation re-locks paid users on network errors; follow graph would be the first replicated social edge.

## Plan shape

10+1 phases, each independently shippable, ~26-34 engineering weeks total code effort: 0 parity hardening -> 1 platform spine (block registry, cm_layout, meerkat-layout package, layout editor, capability manifest) -> 2 video VOD -> 3 offline -> 4 short-form + ranking strategies (weight-vector rankers, chronological hard-wired) -> 5 swarm + seeder -> 6 transcode/ABR -> 7 live broadcast -> 8 timeline/follows/discovery -> 9 monetization (tier = per-tier child workspace key lane; six identity-wall constraints binding) -> 10 embeds (consent gate + import-promoted). Founder-ops register per phase (SFU/TURN/Ingress deploy, seeder soak, Stripe Connect/IAP, counsel).

## Verification

- Seam claims cross-checked against source directly (community.ts, types.ts).
- No em dashes in either deliverable (grep-verified).
- No function logic changed; gate:function skipped on that basis. No parity-relevant code touched.

## Remaining items

- Plan execution starts at Phase 0 (parity hardening) when the founder green-lights.
- memory.md is over its 80-line budget (~93 lines); next housekeeping session should archive older Sessions rows.
