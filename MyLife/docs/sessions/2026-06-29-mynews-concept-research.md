# MyNews Concept Research (2026-06-29)

## What this was

Founder floated a new app idea for the MyLife suite: a decentralized news platform "not controlled by whoever owns the news organization," with anyone able to publish, very advanced user-controllable filters, a learning feed where you can SEE and SAVE multiple named algorithmic feeds (positive-news feed, bad-news feed, event-cluster feeds), a dedicated open-access scientific-journals + peer-review section with credential gating, Community-Notes-style crowd moderation, extremely clear bias labeling (even coloring the whole page red/blue/green by leaning), maximum free access at low cost, and some monetization (floated: $4.99 one-time + tips). The ask: research the idea + competitors + monetization, then produce a detailed HTML report and open it in the browser.

This session produced the **research report only**. No product code was written. Nothing is building yet.

## Decisions taken before research (AskUserQuestion)

- Report scope: full concept -> tech -> roadmap.
- Decentralization: hybrid, research and recommend.
- Meerkat tie-in: research and recommend.
- Monetization: research all, then recommend.

## How it was produced

A single dynamic Workflow (`mynews-concept-research`, run `wf_7f01b941-480`), 37 agents, ~2.9M subagent tokens, ~19 min:

1. **Ground (parallel):** 1 local-context agent (read mesh-sync design, module-registry, ModuleDefinition contract, the Meerkat Posts spec) + 9 live-web research streams (competitors, bias-rating, crowd moderation, open-access science, monetization, controllable feeds, decentralization tech, legal/regulatory, demand). Jina + WebSearch.
2. **Verify:** 16 load-bearing claims adversarially fact-checked (try-to-refute).
3. **Synthesize (parallel):** skeptical YC-style pre-mortem critique + grounded product/technical/monetization/roadmap recommendations.
4. **Write (parallel):** 9 section writers produced 16 HTML fragments against a fixed CSS class contract.

Main loop then assembled the fragments into a self-contained Obsidian-Noir HTML report (sticky scrollspy nav, stat grids, comparison tables, the red/blue/center/science bias-color demo, roadmap timeline, 179 deduped cited sources), wrote it to disk, opened it, and Playwright-verified rendering (hero + product-design sections; only console error was a favicon 404 from the local server).

## Output

- Report: `docs/reports/mynews-news-platform-research-2026-06-29.html` (201 KB, 16 sections, 179 sources). **Intentionally not committed** (avoids the `check:generated-artifacts` oversized-tracked-file gate; it is a deliverable artifact, not source). Offer to commit if the founder wants it tracked.

## Key findings / recommendations

- **Verdict:** worth building, but ONLY as a bundled trust-and-stickiness feature of MyLife, never a standalone paid news app, with scope narrowed to the two validated differentiators: (a) transparent user-controlled composable saved feeds, (b) a green-open-access science layer on a server-backed canonical record.
- **Demand is painkiller-grade, willingness-to-pay is vitamin-grade.** US media trust ~28% (Gallup 2025, all-time low); ~39% news avoidance driven mostly by negativity (Reuters 2024); only ~18% pay for online news and 71% of non-payers are immovable (Reuters 2025); Blendle killed per-article pay in 2023. Bluesky (~40M, 50k+ custom feeds, no token) and Substack (5M+ paid subs, ~$450M writer revenue) validate "people pay for trusted humans + composable tooling, not platforms or tokens."
- **Monetization:** bundle into MyLife Pro (no separate MyNews paywall) + web-routed reader->creator tips + off-app creator pool via Stripe Connect + a 501(c)(3) arm for the open-science half (foundation grants, diamond open access). Reject per-article micropayments, reject any crypto token, reject one-time unlock as the core model. On $4.99 one-time: keep the tips, drop the one-time (perpetual-cost product vs single front-loaded payment).
- **Decentralization (hybrid):** server-backed canonical record (durable archive + DOI via Crossref/DataCite + harm moderation) + portable open-protocol identity + AT-Protocol-style composable feeds and composable labelers; federation deferred to a later phase. NO token. Mesh/P2P used only for drafts, cache, optimistic sync (IPFS/mesh do not guarantee permanence, cannot anchor a citable record). Build on MyLife's existing `packages/sync` substrate, not a wholesale AT Protocol adoption. Matches the BestChef public-launch exception + transport-honesty rule.
- **Meerkat integration:** build MyNews ON the Meerkat Posts primitive + Plan 19 public-archive substrate as a specialized Meerkat surface (new `article`/`preprint` post_type + open-science metadata sidecar + existing signed publish path). Do NOT stand up a new SQLite module re-implementing signing/content-addressing/published_blob escalation/federation/moderation. Optionally a thin `news` (prefix `nw_`) reader/discovery card wrapping the same substrate if a hub dashboard presence is wanted.
- **Moderation:** bridging-based Community Notes (matrix factorization, shown only when rated helpful across diverse viewpoints) is a layer, not the launch trust layer (cold-start + structurally low yield). Pair with composable third-party labelers + clear source/article bias context.
- **Bias UX:** coloring the whole page by leaning fails accessibility, internationalization, and neutrality optics simultaneously. Prefer badges / spectrum bars / source-and-article context over whole-page tinting.
- **Legal (launch-blocking, not phase 2):** UGC opinion (defamation) + paper redistribution (copyright) + ranked/AI surfaces (Section 230 erosion, Anderson v. TikTok) put this in the most exposed app category. Need the UGC moderation minimum (Apple Guideline 1.2 / Play), a registered DMCA designated agent, and a 48-hour NCII/TAKE-IT-DOWN-Act pipeline built once in the MyLife shell. Default to chronological, label every AI/ranked surface, never let the platform author headlines.
- **Roadmap:** P0 article+preprint posts on Meerkat (workspace-private) -> P1 composable named feeds -> P2 trust+moderation+legal infra -> P3 public reach (Plan 19/20 + agent fact-checking + DOIs) -> P4 monetization + nonprofit arm -> P5 federation/bridges (later).
- **Naming:** MyNews, Meerkat News/Meerkat Wire, MyWire, Clarion, Prism.

## Top failure modes (pre-mortem)

1. Betting on standalone willingness-to-pay (kill: bundle into Pro, measure suite retention lift).
2. Treating moderation/DMCA/NCII/Section-230 as later work (kill: ship as shared-shell launch infra).
3. Letting "decentralized"/a token become the product (kill: no token, server-backed canonical record). Every token-funded journalism play (Civil ~$1.4M vs $8M floor, refunded, shut 2020; Steemit -70% staff) died on the token.

## Follow-ups / open questions for founder

- Confirm name (MyNews vs Meerkat Wire etc.).
- Confirm "build on Meerkat Posts" vs thin hub `news` module presence.
- Confirm monetization shape (bundle-in-Pro + tips + nonprofit science arm).
- Decide whether to commit the HTML report into the repo (currently left untracked).
- If green-lit, the next artifact is a queue plan + spec, not code.

## Update: founder refinement -> standalone direction (same session)

Founder reviewed the report and refined the direction: "We should make this as a standalone too. That blends into MyLife the same as the others. We will build trust in individual journalists and the honest way we moderate the content for clear bias like Ground News." Four follow-up decisions locked via AskUserQuestion:

1. **Monetization:** separate $4.99 one-time unlock like Manhattan (overrides the research's bundle-only recommendation). Reconciled by clarifying standalone is a packaging decision, not a pricing one.
2. **Architecture:** reuse the Meerkat / @mylife/sync substrate (recommended).
3. **Journalist trust:** verified profiles + reputation, two tiers (verified + open pseudonymous) (recommended).
4. **Bias model:** Ground-News-style + bridging community notes (recommended), not whole-page color-tinting.

The report was regenerated to match via a second focused workflow (`mynews-rewrite-standalone`, run `wf_b71b9a61-a24`, 10 agents, ~800K tokens): 1 recalibration agent rewrote the recommendations to the locked direction, then 9 writers rewrote all 16 sections, reusing the prior research (no re-research). Re-assembled to 226 KB at the same path, kept the full 179-source bibliography, browser-verified the monetization section.

**Locked product shape now in the report:**
- Standalone `apps/mynews` + `modules/mynews` (prefix `nw_`), parity like Meerkat/BestChef/DoWork/Manhattan.
- $4.99 one-time unlock (`mylife_mynews_unlock`), but **reading is free** on both surfaces; $4.99 unlocks only the power layer (saveable algorithm-web of named feeds, advanced filters, full open-science section, offline, Blindspot). Tips always on (web-routed Stripe Connect, ~97% to journalist). MyLife Pro auto-grants the unlock. The recurring Pro subscription + a 501(c)(3) science arm carry the perpetual cost curve; the $4.99 is an impulse growth signal, not the cost-recovery engine. Free reading also lowers store-rejection risk (not classified as primarily-paid news).
- Reuse the Meerkat substrate via an `article`/`preprint` post type + open-science sidecar over the Plan 19 archive; `nw_` tables for journalist profiles, bias ratings, saved feeds, tips ledger; NO token.
- Trust spine = individual journalists, verified + pseudonymous tiers (ORCID / domain email / manual verify + reputation/corrections, follow-a-journalist feeds).
- Ground-News-style bias (source/factuality ratings + Blindspot) + bridging community notes; the founder's whole-page red/blue/green idea was reshaped to badges/spectrum/source-context (tinting fails accessibility/i18n/neutrality).
- Launch-blocking legal infra unchanged (UGC moderation minimum, registered DMCA agent, 48h NCII pipeline).

The "open questions" that were resolved (architecture, monetization shape, trust model, bias model) are now decided. Remaining: final name and whether to commit the HTML report.
