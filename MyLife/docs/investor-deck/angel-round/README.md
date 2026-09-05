# Meerkat Angel Round — Package Contents

> April 2026 snapshot. This package contains historical pricing, round, readiness, and market assumptions. Reconcile every external claim with current code, current reports, and founder-approved terms before sending it.

This directory contains the angel-round investor package for Meerkat. Everything in here is scoped to a **$400K raise on the YC Post-Money SAFE (Cap Only) at a $10M post-money valuation cap**, targeting strategic operator angels rather than institutional venture funds.

## Why a Separate Angel Package

The earlier `two-pager-condensed.html` (in `../html/`) targets a $1.5M institutional seed at a $15M cap. Founder review in April 2026 concluded that path is a mismatch for two reasons:

1. **Institutional fund math does not work at Meerkat's current price point.** A $12/year subscription against the 10% ownership institutional investors require at seed cannot return a $500M fund at the 10x minimum they underwrite against. Pitching that deck to seed partners produces polite passes, not term sheets.
2. **Founder conviction does not match the institutional path.** Founder stated explicitly that raising is optional, that 20%+ dilution is a hard ceiling, and that bootstrap via BestChef revenue is an equally valid path. That conviction leaks through in institutional meetings as "does not need us," which institutional partners interpret as founder-investor misalignment.

The angel package exists to fund a **specific acceleration window** (the BestChef launch blitz) with **strategic operator capital** whose return math works at $25K-$100K check sizes and whose ownership expectations are compatible with founder control.

The institutional deck at `../html/two-pager-condensed.html` is preserved unchanged and remains usable if:
- BestChef hits Month 6 milestones (50K paid, D30 > 35%)
- Founder decides to pursue Series A for acceleration
- A fund offers terms that respect the pledge and the control preference

In that scenario, the angel round becomes the "priced round setup" that lets institutional money enter on more founder-friendly terms.

## Package Contents

| File | Purpose | Audience |
|------|---------|----------|
| `two-pager.html` | Visual pitch deck, two-page print layout. Lead with BestChef wedge, platform expansion, SAFE terms embedded. | First meeting with angel, emailed as PDF export. |
| `term-sheet.md` | Full term sheet: raise, cap, use of funds, milestones, investor requirements, disclaimers. | Second meeting. Sent after angel expresses interest. |
| `README.md` | This file. Strategy context and package orientation. | Founder's reference, shared only with close advisors. |

The executable SAFE itself is the **unmodified YC Post-Money SAFE (Cap Only)** at `../SAFE-C.pdf`, with the specific cap ($10M) and purchase amount filled in per individual investor.

## How to Use These Files

**For a cold introduction:**
1. Send `two-pager.html` (exported as PDF) plus one-paragraph email explaining the wedge-first thesis.
2. On positive response, schedule 30-minute call.

**For a warm introduction:**
1. Send the two-pager plus the term sheet.
2. Reference the specific angel's background in the cover note (e.g., "given your time at [X consumer company], the wedge-then-platform story may resonate").

**For a second meeting:**
1. Offer TestFlight invite to BestChef.
2. Send architectural overview (`../REPORT.md`) or 117-competitor analysis as deeper context.
3. Be explicit about commitment timing: "we are closing rolling, targeting final close by end of Q2 2026."

## What Not to Send

The following exist in the broader investor deck but should **not** accompany the angel package:

- `../html/Meerkat.html` (main pitch, sized for institutional meeting, longer than angels need)
- `../html/two-pager-condensed.html` (institutional $1.5M version — sending both creates confusion about ask size)
- `../REPORT.md` (117-competitor deep synthesis, too long for first meeting, good for second)
- `../competitors/` (research artifacts, not pitch material)

Keep the first touch tight: two-pager plus email. Offer the deeper material on request.

## Known Limitations

Items the founder still needs to complete before this package is ready to send:

1. **Named advisor list.** The two-pager references "senior engineers from Google and Amazon" generically. Before sending, either name them explicitly or remove the specific company references and keep "senior engineers from large tech companies."
2. **Founder bio extension.** The one-paragraph founder bio is current as of April 2026 but should include specific dates, company names, and demonstrated outcomes if the angel targets are ex-founders themselves.
3. **BestChef TestFlight invite.** Second-meeting material requires a working TestFlight build. Ensure the link is warm before sending the term sheet.
4. **Creator name list.** The "15 committed creators" number is credible only if a private list can be shared under NDA when asked. Prepare that list before the first meeting.
5. **Beta user evidence.** If any UAT or beta testing has produced retention numbers, NPS, or qualitative quotes, add one more slide or appendix with specifics. "Beta tested, users would pay on the spot" is stronger as "N beta users, X% said they would pay today, verbatim quotes below."

## Contact

Trey Shuldberg — trey.shuldberg@gmail.com

## Change Log

- 2026-04-24: Initial angel-round package created. Separates wedge-first angel pitch from institutional seed deck. Documents strategic reasoning for parallel tracks.
