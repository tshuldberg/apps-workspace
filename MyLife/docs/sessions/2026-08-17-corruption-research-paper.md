# 2026-08-17: Political corruption research paper (personal, non-MyLife)

## What was done

Trey asked for a graduate-level research paper on corruption in US politics since 1960, covering both prosecutable and subtle/legalized power abuse, with specific attention to congressional stock trading (Pelosi and Congress generally), McConnell's incapacity and Senate leave rules, congressional pay/schedule, COVID-era wealth transfer, and Trump-era crypto/tariff self-dealing. Mid-task, the deliverable was redirected to an animated HTML final output with many charts of the collected data.

## Deliverables

- `~/Desktop/Research/political-corruption-1960-2026/political-corruption-1960-2026.md`: full ~11k-word paper (abstract, theory framework, chronological sections 1960-2026, thematic sections on doctrine, congressional self-dealing, crisis wealth transfer, monetized presidency, reform; full reference list).
- `~/Desktop/Research/political-corruption-1960-2026/political-corruption-1960-2026.html`: animated single-file edition (97 KB, no external assets). Hero with animated stat counters, 12 chart cards (scroll-triggered bars, share bars, SVG line chart, 3 timelines, counter grids), tooltips, light/dark via prefers-color-scheme, reduced-motion support. Built with the dataviz skill's validated reference palette. Late addition per Trey: section 7.4 + ranked wealth-before/after-office chart (Gore ~176x, Obama ~54x, Biden ~12x, McConnell ~11x, Pelosi ~3x disclosed, Trump ~2x with largest absolute gain, Truman ~1x control, LBJ and Clintons as callouts).
- Build script: session scratchpad `build_paper_html.py` (pandoc md-to-fragment + chart injection).

## Key framing decisions

- Contested claims about living people (e.g., Pelosi insider trading) argued from the statistical/circumstantial record (Ziobrowski studies, Unusual Whales 2024/2025 data, STOCK Act enforcement failure) with an explicit epistemic-posture note, rather than asserted as adjudicated fact. Trey asked to treat insider trading as true; the paper adopts it as the argued working thesis.
- McConnell section built on the documented 2023-2026 health timeline plus the structural point (no incapacity mechanism, contrast with private-sector leave norms).

## Research collected (web, Aug 2026)

Congress trading 2024 (Dems +31%, Reps +26%, S&P +24.9%, Pelosi household +71%, Rouzer +149%) and 2025; Trump 2025 disclosure $1.4B crypto income ($635M memecoin, $550M WLF, $236M tokens, $65M equity), family $7.7B; tariffs ~90% US-borne, ~13% avg rate, $1,000+/household, $12B farm bailout (~40% to mega farms), secret exclusion process (Wyden/Van Hollen); COVID $4.6T relief, fraud $200B-$1T, <1% recovered, PPP 23-34% to workers, billionaires +$1.7T; McConnell timeline incl. Jun 2026 emergency + 6-week absence.

## Verification

Rendered in headless Chrome, screenshots of hero, congress charts, COVID/Fed, tariff sections; fixed one dataviz defect (negative household return drawn as positive bar; replaced with market-baseline row). Opened in default browser.

## Remaining

None. Jina MCP search returned UnauthorizedError (API key) this session; fell back to built-in WebSearch.
