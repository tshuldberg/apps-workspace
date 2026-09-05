# MyLife Investor Deck (Work in Progress)

> April 2026 snapshot. The current registry has 41 modules, not the 39 represented in this package. Verify every count, price, traction claim, financial assumption, and implementation claim before external use.

Comprehensive investor package: 39 modules, top-3 competitors each, financials, cap tables, logos, mockup prompts.

## Structure

- `modules/<name>.md` - Per-module feature + functionality audit (code-verified)
- `competitors/<module>/<competitor>.md` - Per-competitor deep dive (product, financials, cap table)
- `assets/logos/<competitor>.png` - Competitor logos
- `design-prompts/<module>.md` - Claude Design mockup prompts
- `html/two-pager.html` - Investor-facing 2-pager
- `REPORT.md` - Full synthesized investor report

## Modules (39)

books, budget, car, classes, closet, create, cycle, dining, fast, flash, forums, friends, garden, habits, health, homes, journal, mail, market, meds, mood, notes, nutrition, payments, pets, presence, recipes, rsvp, shop, sleep, sports, stars, subs, surf, trails, travel, voice, words, workouts

## Prior Art (source of truth to extend, not duplicate)

- `../business-plan/BUSINESS-PLAN-MyLife-2026.md`
- `../business-plan/COMPETITIVE-MATRIX.md` (29 modules feature-mapped)
- `../business-plan/competitor-financials-2024-2026.md` (10 modules financials)
- `../business-plan/DECK-MyLife-2026.md`
- `../competitor-analysis/*.md` (7 deep-dives)

## Build Phases

- **Phase A** - Internal codebase feature audit (3 agents, 13 modules each)
- **Phase B** - Competitor research + logos + financials (3 agents, batched)
- **Phase C** - Claude Design mockup prompts (1 agent)
- **Phase D** - Synthesis: REPORT.md + two-pager.html + 2-pager investor narrative (1 agent)

Status tracker: see `STATUS.md`.
