# 2026-08-30: MyLife Apps + Competitors HTML Overview

## What

Built a single self-contained HTML overview mapping every MyLife application to its major real-market competitors: `docs/reports/REPORT-mylife-apps-competitors-2026-08-30.html` (opened in browser, delivered to user).

## Coverage

- 41 registry modules (from `packages/module-registry/src/constants.ts`) grouped into 7 clusters: Health & Wellness, Fitness & Outdoors, Money & Assets, Knowledge/Learning/Creation, Social & Communication, Food/Home/Daily Life, Travel/Leisure/Interests.
- 6 standalone apps: Meerkat, BestChef, DoWork, MyNews, Manhattan, Yearn.
- Competitor sets sourced from the April 2026 investor-deck research (`docs/investor-deck/competitors/`, 117 deep dives, 3 per module for 39 modules).
- Yearn and Manhattan had no competitor files (post-date the research); their sets (Tinder/Hinge/Bumble/Feeld and Eventbrite/Fever/Meetup/Partiful) are editorial extensions, flagged as such in the report footer.
- Market anchors section: Rocket Money $1.275B, Headspace+Ginger $3B, AllTrails ~$1B, MyFitnessPal $475M->$345M, Evernote ~$200M, Mint shutdown, Flo FTC settlement, Finch ~$4M/mo, BeReal $500M, Goodreads ~$150M.

## Notes

- HTML-only deliverable (user asked for HTML directly); no markdown twin needed since md->html is the twin rule direction.
- All figures are point-in-time from the 2026-04-21 research; footer flags them for re-verification before external use.
- No function logic changed; gate skipped.

## Remaining

- None. If this gets reused externally, refresh valuations first (BeReal, Oura, Revolut move fast).
