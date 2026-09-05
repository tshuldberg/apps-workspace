# Fiscal Comparison Research

**Date:** 2026-08-30
**Branch:** `docs/fiscal-comparison-research-2026-08-30`

## What and why

Created a graduate-level, primary-source comparison of U.S. immigration fiscal effects, medical expenditure, corporate and bank rescues, corporate tax preferences, and tax returns with adjusted gross income above $5 million. The report covers annual anchors, the overlapping 2012-2020 and 2020-present windows, source-era or program-lifetime totals, and international comparisons.

The analysis keeps gross spending, credit exposure, net fiscal cost, tax expenditures, and net fiscal effects separate. It does not fabricate a legal-versus-unauthorized immigration total when official ledgers cannot support one.

## Files

- `docs/reports/RESEARCH-fiscal-comparison-immigration-health-bailouts-wealth-2026-08-30.md`
- `docs/reports/RESEARCH-fiscal-comparison-immigration-health-bailouts-wealth-2026-08-30.html`
- `docs/reports/README.md`
- `docs/README.md`
- `docs/archives/memory-sessions-2026-08.md`
- `memory.md`

## Verification

- Checked all report JavaScript with the Node parser.
- Parsed the HTML with Python's standard HTML parser.
- Opened the self-contained HTML report in the system browser.
- Rendered the report at 1440px and 390px with Playwright: seven chart SVGs, no JavaScript or console errors, and no page-level horizontal overflow.
- Visually inspected the report cover, immigration chart, rescue chart, and high-income chart.
- Rendered the conversation visualization at 1024px, 736px, and 360px in light and dark themes: five plot frames, ten axis titles, functional tooltips and series controls, no console errors, no page overflow, and no more than four x-axis ticks at 360px.
- Confirmed both report files contain no em dash characters, placeholders, or external assets in the self-contained report.
- Ran `pnpm check:generated-artifacts`.

## Decisions

- Preserved the user's requested 2020 overlap and labeled it everywhere.
- Defined "all time" as the full source series or named-program lifetime.
- Used a transparent author counterfactual for realized capital-income preferences above $5 million and labeled it as nonofficial.
- Reported health tax exclusions separately because adding them to national health expenditure would double count the financed care.
- Reported bailout gross amounts and net outcomes separately because credit exposure is not taxpayer cost.

## Remaining items

None for this research snapshot. Later source revisions should produce a new dated report rather than silently changing this one.
