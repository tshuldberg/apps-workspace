# 2026-07-02: The People's Refund, Adversarial Concept Review

## What was done

Founder asked for an adversarial evaluation of the "People's Refund" concept (daily short videos about enshittified products; $5/$2 one-time chip-in buys a public vote on which software fix gets built; shipped tools free to everyone; public ledger). Concept files on Desktop: `peoples-refund-launch-kit.html`, `peoples-refund-account-setup.html`, plus the prior `chuck-a-buck-viability.html` (13-agent review, 2026-06-29).

Ran the /office-hours skill in startup mode (fully-formed-plan path: skipped Phase 2 questioning, ran premise challenge + alternatives). Dispatched 4 independent web-grounded adversarial agents, one per failure surface:

1. Attention economics: funnel math grounds out at ~$100 per 1M views; $3k floor needs 30-60M views/yr; rage content correlates negatively with monetization (arXiv 2408.00534); one-time no-reward gifts do not repeat (7-18% retention). Verdict 15% medium case, 2% $100k/yr.
2. Competition/willingness-to-pay: Rossmann (~2.56M subs) + FUTO already own audience AND build-the-fix angle; 4 of 5 example builds exist free (justtherecipe.com, Obsidian/Joplin, JustWatch, fee extensions); FTC junk-fees rule (2025-05-12) killed the ticket-fee demo; Bountysource insolvency disproves pay-to-direct-software. Verdict 20% / 3%.
3. Legal/platform/payments (residual, post-June-29 fixes): Stripe policy bars personal crowdfunding regardless of tip label, fresh account + viral spike = near-certain freeze (fix: merchant-of-record rails like Ko-fi/GitHub Sponsors); US TikTok comment-to-DM does not exist (kit's DM-first workaround stands but costs conversion); ticketing extension is a DMCA 1201 magnet (Ticketmaster v. Prestige); charitable-solicitation letters key off pitch look; 200-txn sales-tax nexus. Lottery attack on pay-to-vote FAILS (no chance prong). Verdict ~20% survives 12mo unscathed as designed.
4. Execution/opportunity cost: designed cadence = 35-55 hrs/wk (second full-time job); creator burnout 62-90% at that cadence; 5-6 MyLife products at 90-95% blocked on founder-ops make the opportunity cost damning; concept as designed captures none of its funnel value (free tools, no bridge to suite). Verdict ~10% cadence survival. Proposed the downside-capped start sequence.

## Synthesis

As designed: fails (medium case 15-20%, business 2-3%). What survives all four attacks: the cultural thesis, the "developer who ships the fix on camera" wedge, IG comment-to-DM, the public ledger, the 90-day gate instinct, and the MyLife-factory unfair advantage. Unanimous reframe: it is a distribution engine for the existing app suite, not a fundraiser. Money moves to optional merchant-of-record membership later (the niche's only proven model is membership, the anti-subscription irony is resolved by keeping tools pay-once/free while membership funds the studio).

Recommended Approach A: ship recipe de-shittifier FIRST (BestChef substrate, ~2 wks), then 2-3 batch-filmed posts/week, free voting, email capture + suite cross-links on every tool page, Ko-fi/GitHub Sponsors instead of Stripe, day-30 gate (10k-view video or 100 emails) and corrected day-90 gate (dollars per 100k views, suite funnel attribution).

## Artifacts

- Report/design doc: `/Users/trey/Desktop/peoples-refund-adversarial-review.html` (converted from md to styled HTML on 2026-07-03 at founder request, sits next to the other three concept docs; the md in docs/reports was removed)
- Spec review pass run on the doc (results in report's Reviewer Concerns section)

## Notes / corrections to launch kit implied

- Swap Stripe-first checkout for Ko-fi or GitHub Sponsors at launch.
- Drop reel 06 (junk fees at checkout) or reframe: FTC all-in pricing rule already in effect.
- Reposition reel 04 (recipe tool): justtherecipe.com exists free; the value is proof-of-shipping + BestChef lead-gen, not novelty.
- Remove paid votes; voting free; keep ledger.

## Founder decision

Trey chose the simple lane: "just need the path so that people can send me $2 if they want and a path to creating stuff." Locked: pure tip jar (Ko-fi, $2 preset, merchant of record, nothing promised in exchange), free name-your-thing input, he picks what to build (no binding vote), recipe tool ships before any filming, 2-3 posts/week. No paid votes, no custom ledger/leaderboard software at launch, no Stripe.

No code changed; no function gate applicable. No errors_log entries (no failures).
