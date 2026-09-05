# 2026-07-06 — Plan 39 P10/P11: Public tab + real Commons reader (increment 1)

Branch `feature/meerkat-public-base-feed`. Task 5 (P10-P11 feed consumer UI). First increment;
commit `dc3fc91a`.

## What shipped (both surfaces, parity-locked + tested)
- The Public tab replaces Discover's visible slot (mobile Tabs; web CommunityRail rail +
  MobilePrimaryNav). Discover stays reachable as a hidden route.
- The tab is driven by the REAL P9 verify-to-view state:
  - `not_configured` -> honest "public accounts off in this build".
  - `locked` -> the S1 locked feed (verbatim copy: "The public side of Meerkat is people-only"
    + the three "What verification means" bullets + the $4.99 price line) -> routes to
    persona/create.
  - `needs_session` -> reconnect; a failed renewal (empty humanity wallet) routes back to
    verification (codex fix).
  - `verified` -> the base-feed shell.
- The verified feed is REAL: `public-feed.ts` (both twins) `loadCommonsTopic` pulls a page of a
  topic channel from The Commons via @mylife/sync `fetchPublicPage`, attaching the
  verify-to-view session header and dual-verifying every post against the descriptor-pinned node
  key (fail-closed; the node is never trusted). Cards render only real, dual-signed posts
  (persona short-id + "human" badge + body + relative time); honest loading / empty / unreachable
  / not_wired states, never a fabricated post.
- Config: `commonsNodeUrl` + `commonsTopics` (per-topic {publicationId, nodeKeyHex}, a founder-ops
  export of the provisioned Commons). Empty => honest "not connected in this build".
- The topic chip rail (8 topics) is parity-locked against the relay's DEFAULT_COMMONS_TOPICS.

## Codex (folded)
- The configured feed now actually fetches + renders posts (was a static empty card).
- Desktop web nav exposes Public (the desktop rail + the mobile tabbar).
- A failed session renewal routes to verification instead of looping on Continue.

## Remaining P10-P11 (a large continuation, NOT in this increment)
- Post composer (S5/S6) + the $4.99 app-unlock gate sheet.
- Post thread + replies (S7).
- Public profile (S8, alias/persona/follow) + follows feed.
- Report sheet (S12) routing to the operator console.
- Discover re-skin (S10) folded into Public "Explore".
- Alias display on cards needs a registry pubkey->alias reverse-resolve endpoint (cards show the
  honest persona short-id today).

## Verification
mobile app 1035, web 695 -- all pass. `pnpm check:parity` green (new Public-tab + verify-to-view
+ public-feed sections). Everything OFF by default (no persona service, no commons node) so the
Public tab honestly shows the locked / not-connected states until founder-ops provisions +
deploys (P15).
