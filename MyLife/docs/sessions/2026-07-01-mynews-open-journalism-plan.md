# 2026-07-01: MyNews Open Journalism Platform, Full Build Plan

## What was done

Produced the comprehensive production build plan for MyNews as an interactive HTML document and opened it in the browser. This is the implementation-plan successor to the 2026-06-29 concept research (which had a locked founder direction but no build plan). No code was written.

Artifact: `docs/reports/REPORT-mynews-open-journalism-plan-2026-07-01.html` (~104 KB, 16 sections, left untracked per the generated-artifact gate precedent set by the research report).

## New founder direction captured this session

1. Journalists post on the platform; volunteers help edit and earn credibility ("open sourcing journalism").
2. Payment structure: low or no ads (plan locks it to zero ads); users spend only to support the journalists they choose; platform takes 2% of support flow to sustain servers.

## Grounding work

- 4 parallel Explore agents mapped: (a) hub wiring contract (40 ModuleIds today, MyNews is 41; billing-config `mylife_mynews_unlock` pattern; entitlements gates; check:module-parity mechanics; Supabase migration/function conventions), (b) Meerkat substrate reuse (v2 signed ChannelMessageEvent, cm_posts.post_type union widenable to article/preprint, Plan 19 PublicationDescriptor/takedown/directory, abuse rails, device-key identity, relay, browser storage adapters), (c) BestChef public-launch pattern (RLS conventions, fail-closed broker, anon-first auth, fail-safe reporting, media pipeline, 21-locale i18n), (d) full extract of the 2026-06-29 research report + confirmation no mynews plan file exists in the queue.
- Web verification (July 2026): US App Store link-outs need no entitlement; Ninth Circuit Dec 2025 lets Apple seek a "reasonable commission" later (fee model kept server-side in `nw_fee_config`); Patreon web-checkout precedent; Stripe Connect pricing (2.9%+30c, Express $2/mo active + 0.25%+$0.25 payout).

## Key plan decisions (recommendations, honoring the 2026-06-29 locked direction)

- Two new core systems designed for the first time: the Open Editing System (git-style typed suggestions, diff review, author-only acceptance, public changelog credits, newsrooms) and the Credibility Engine (weighted points with acceptance-diversity/author-standing multipliers, 12-mo decay, Reader to Section Editor ladder, anti-gaming set).
- Author-controlled acceptance is also the legal architecture: platform never authors or selects content (Section 230/Anderson posture; platform never writes headlines).
- 2% support engine: aggregated monthly charges (one Stripe charge per supporter across all pledges), separate-charges-and-transfers via Connect Express, $10 payout threshold, payout costs absorbed inside the 2%, fee math rendered on the payment sheet as a product feature. Zero ads, no token, no micropayments, no platform paywalls.
- Sustainability math: 2% covers pure infra from ~1,500 active supporters; moderation labor honestly assigned to Pro/$4.99/501(c)(3) rails.
- Architecture: apps/mynews (Expo) + apps/mynews-web (Next.js SSR/ISR SEO surface) + modules/mynews + hub wiring as 41st module; dedicated Supabase project; ~28 nw_ tables in 7 groups; 9 edge functions; signatures ride the server (server canonical, cannot forge); Plan 19 public snapshot tier honestly gated.
- Build: 8 phases, 32-42 wk, plan files 30-mynews-*; parallel founder-ops track (Stripe Connect approval, DMCA agent, bias-data licensing, 501c3, trademark, seed journalist cohort).

## Open founder decisions

Name (MyNews rec), confirm 2% all-in, supporter-only extras (rec: allow, reporting always free), regional launch wedge (rec), green-light Phase 0 (next artifact: docs/plans/queue/30-mynews-p0-scaffold.md), whether to commit a markdown twin of the plan.

## Verification

- No em dashes in the document (grep clean), single closing html tag, fee calculator + TOC highlighting JS included.
- Opened in browser via `open`.

## Remaining items

- On green-light: author 30-mynews-p0-scaffold.md plan file.
- memory.md is over its 80-line budget (pre-existing); next housekeeping session should archive older Sessions rows.
