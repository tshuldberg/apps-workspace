# 2026-08-01 - Meerkat Pitch Decks (Investor + User Acquisition)

## What was done

Built two animated, self-contained HTML pitch decks for Meerkat and opened them in Chrome:

- `docs/reports/meerkat-pitchdeck-investor-2026-08-01.html` - full investor narrative: problem (per-seat rent, surveillance ARPU, platform mortality), why-now event timeline (2024-2026), product, crypto/moat, market ranges, demand-spike adoption curves, competitive tripod table, business model, TAM/SAM/SOM, 3-year scenarios, engineering traction, honest launch status, close.
- `docs/reports/meerkat-pitchdeck-users-2026-08-01.html` - consumer landing-style deck: "Your community. Actually yours.", what-free-costs section, feature cards, sealed-envelope privacy explainer with animated transport-ladder diagram, 25-person cost math, Workplace cautionary tale, straight-answers FAQ, launch-notify CTA (no fake download links; app is pre-launch).

## Process

1. Three parallel agents: Explore agent reviewed Meerkat git history + codebase (594 meerkat commits, 357 code-touching, ~469K LOC, ~6,500-6,615 tests, 736 test files, 16 evidence-bound rcs, RFC 9474 RSABSSA + Noise NK verified in source); two general-purpose research agents gathered sourced competitor and market numbers via web search.
2. Loaded the dataviz skill; validated a Meerkat-brand categorical palette (#0A8A6A, #B3413E, #3566B0, #8F660D on white) with the palette validator - passes with the green/red adjacent pair in the 6-8 CVD warn band, mitigated everywhere by direct labels + surface gaps; most charts use emphasis form (Meerkat green vs gray).
3. Decks use the Open Burrow brand (warm paper #F6F4EF, sea green #0E7C66) from `apps/meerkat/app/(root)/theme/tokens.ts`, light mode, IntersectionObserver reveals, animated counters, SVG line-draw and bar-grow animations, hover tooltips, prefers-reduced-motion respected.
4. Verified rendering in the gstack headless browser (no console errors on either page); fixed two chart defects (market-range chart label collisions + right-edge clipping; corrected fabricated Mar-May commit-chart values to the derived 2/5/6 remainder).
5. Opened both in Google Chrome.

## Data integrity decisions

- Founder-locked pricing only: $4.99 one-time app, $4.99/mo hosted (storage included). No invented prices.
- Deliberately EXCLUDED unverifiable figures: Slack DAU (undisclosed since 2019), Discord revenue (three contradicting estimates), WhatsApp revenue. Stated in the deck footer.
- Workplace data deletion (2026-06-01) framed in past tense (research agent had it wrong as future).
- Meerkat framed as "complete, evidence-gated, pre-launch" per rc16 NO-GO ledger, never as launched; mesh transports on physical devices called out as unverified.
- Growth projections labeled illustrative scenarios anchored to named historical curves (Signal Jan-2021, Bluesky, Mastodon retention caveat), not forecasts.
- Estimates carry [EST]-style footnotes; sources + dates in the footers of both decks.

## Key sourced numbers used

- Slack Pro $7.25/user/mo annual, Business+ $15 (slack.com 2026-08-01); 25-person 3yr: $6,525 / $13,500 vs Meerkat $304.39.
- Meta FY2025 $200.97B / 3.58B daily people => ~$56-57/user/yr; NA ~$233 (FY2024 filings-derived).
- Workplace: 7M paying, deleted 2026-06-01. Discord: 70K IDs leaked Oct 2025, S-1 Jan 2026, no text E2EE. Telegram: 1B+ MAU, 15M Premium, founder charged in FR + RU. Signal: 70-100M MAU, $29.4M 2024 revenue vs ~$50M/yr cost. Matrix Foundation $639K deficit 2025.
- Markets: team collab $20-40B 2025 -> $37-57B 2030; encrypted messaging apps ~$357M/yr (the "empty column"); creator economy $253B -> $549-821B 2030.

## Verification

- No function logic changed; function gate not applicable (docs/HTML artifacts only).
- Both pages load with zero console errors; all charts screenshot-verified after animation.

## Remaining items

- None for this task. Decks are dated snapshots; re-verify Microsoft Teams pricing (changed 2026-07-01) and any competitor figures before external distribution.
