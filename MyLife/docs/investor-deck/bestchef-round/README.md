# BestChef Seed Round — Package Contents

> April 2026 snapshot. This package contains historical pricing, readiness, creator, traction, and fundraising assumptions. Reconcile every external claim with current code, the latest BestChef audit, and founder-approved terms before sending it.

This directory contains the BestChef-only investor package. Scope is the **standalone BestChef product**: social leaderboard recipe app + private kitchen suite, raising **$500K on YC Post-Money SAFE (Cap Only) at a $10M post-money cap (~5% target dilution)**, marketing-heavy use of funds.

The package is intentionally separate from the broader Meerkat hub pitch in `../angel-round/` and `../html/`. Investors who participate in this round are funding BestChef the wedge product, not the 39-module Meerkat platform. Platform upside is mentioned briefly as an option, never as the primary thesis.

## Why a BestChef-Only Round

BestChef is the most fundable surface inside the Meerkat portfolio:

- **Built and tested**: 590 automated tests, 8 shipped phases, 15 cloud engines, App Store ready.
- **Wedge clarity**: "Find the best recipe for every dish" is a single-sentence value prop. Leaderboards by cuisine and dish are objective and shareable, which makes them inherently viral.
- **Marketing-ready**: 15 free-committed creators (~9.75M reach), with budget for 3 paid top-tier creators (~3M reach) totaling ~12.75M launch surface.
- **Two-layer product**: a public social/competitive layer drives acquisition; a private kitchen layer (saved recipes, grocery, pantry, OCR, macros) drives retention. Most recipe apps own one layer or the other; BestChef owns both.
- **Pricing**: free to download, $4.99 one-time unlock for the full private kitchen. Single-purchase model that aligns with the anti-enshittification stance (no recurring billing, no subscription churn) and gives a cleaner single-product story than the Meerkat $12/yr suite.

A BestChef-only round preserves founder optionality. If BestChef hits the 6-month milestones (50K Pro subs, D30 above 35%, CAC under $10), the founder can either bootstrap forward profitably or raise a Series A. Either path is consistent with this SAFE's economics.

## Package Contents

| File | Purpose | Audience |
|------|---------|----------|
| `BestChef-Two-Pager.html` | Visual pitch, two-page print layout. Public/private layer split, marketing strategy, milestones, SAFE terms inline. | First meeting with an investor; emailed as PDF export. |
| `BestChef-Term-Sheet.html` | Full term sheet HTML. Round economics, ownership math, use of funds, milestones, investor fit criteria, disclaimers. | Second meeting; sent after investor expresses interest. |
| `BestChef-SAFE-Cover.html` | SAFE cover sheet. Captures the variable terms (parties, amounts, dates) that pair with the YC template. Includes signature blocks. | Third step; produced per-investor when an investor commits to a Purchase Amount. |
| `README.md` | This file. Strategy context and package orientation. | Founder reference. |

The executable SAFE itself is the **unmodified YC Post-Money SAFE (Cap Only)** at `../SAFE-C.pdf` (already in the broader investor deck). The cover sheet in this package supplies the BestChef-specific values that fill the YC template's variable fields.

## How to Use These Files

**For a cold introduction:**
1. Open `BestChef-Two-Pager.html` in a browser, print to PDF, attach to email.
2. One-paragraph cover note explaining the wedge thesis. Reference the recipient's background (e.g., consumer software at scale, food/creator economy operator).
3. On positive response, schedule 30-minute call.

**For a second meeting (interested investor):**
1. Send `BestChef-Term-Sheet.html` (printed to PDF) plus a TestFlight invite to BestChef.
2. Be explicit about commitment timing: "rolling close, targeting final close by end of Q2 2026."
3. Offer to provide architectural overview, competitive deep-dives, or advisor introductions on request.

**At commitment:**
1. Send `BestChef-SAFE-Cover.html` plus the YC `SAFE-C.pdf` template.
2. Investor confirms accredited status, agrees on Purchase Amount.
3. Counsel (or Clerky / Carta) generates the executable SAFE using the YC template plus the cover sheet's variables.
4. Both parties sign; wire is sent; cap table updates.

## What Not to Send (Yet)

The following exist in the broader investor deck but should **not** accompany the BestChef package on first contact:

- `../html/Meerkat.html` (Meerkat-wide pitch — confuses the BestChef-only narrative)
- `../html/two-pager-condensed.html` (Meerkat institutional $1.5M version)
- `../angel-round/` (Meerkat angel pitch — different ask, different product surface)
- `../REPORT.md` (Meerkat 117-competitor synthesis — too long, off-topic for BestChef)

If an investor specifically asks about platform upside (Meerkat suite), share `../REPORT.md` and `../html/Meerkat.html` as **supplementary** material with explicit framing: "BestChef is the round we are raising. Meerkat is the platform that BestChef is part of. Funding BestChef gives you exposure to the wedge; the Meerkat suite is upside that does not depend on this round to be valuable."

## Known Gaps to Close Before First Send

1. **Form BestChef, Inc.** as a Delaware C-Corp if pursuing a BestChef-only entity. The SAFE cover sheet uses "BestChef, Inc. (Delaware C-Corporation, formation in progress)" as a placeholder. Alternatively, raise this round into the Meerkat parent entity and adjust the cover sheet to name the parent. Discuss with counsel before first send.
2. **Named advisors.** The two-pager references "senior engineers from large U.S. tech companies." Either name them on the founder's deck or keep generic; do not reference specific company names without consent.
3. **TestFlight build link.** Second-meeting material requires a working TestFlight build. Confirm the link is live and the build is current before sending the term sheet.
4. **Creator name list.** The "15 committed creators" figure is credible only if a private list can be shared under NDA. Prepare that list in advance.
5. **Beta retention numbers.** Any UAT or beta cohort retention data, NPS, or qualitative quotes belong in an appendix or as a supplementary slide. "We have beta users" is weaker than "N beta users, X% D30, verbatim quotes attached."
6. **Wire instructions and counsel name.** The SAFE cover sheet leaves these blank. Fill them in before transmitting to a committed investor.

## Investor Targeting

This round targets **strategic operator angels** and **small consumer-focused funds**. Specifically:

**Best fits:**
- Operators who shipped consumer mobile apps to 100K+ paid users
- Food, fitness, or creator-economy operators with relevant network access
- Former founders who have raised seed and exited or are post-seed
- Small consumer funds whose check size (~$25K-$250K) matches the round structure

**Not fits:**
- Institutional venture funds whose math requires >5% ownership at $500K
- Investors who want board seats at this check size
- Investors who want revenue-share, profit-share, or any non-standard SAFE terms
- Investors who expect a forced exit path (acquisition pressure)

## Change Log

- 2026-04-24: Initial BestChef seed round package created. Three documents: pitch (two-pager), term sheet, SAFE cover sheet. Strategy reasoning captured in this README.
