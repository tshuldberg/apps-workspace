# 2026-05-26 - Yearn Dating App Research Design

## Summary

Created a standalone HTML research and product-design brief for Yearn at `docs/research/yearn/yearn.html`, then duplicated the same artifact to `docs/research/yearn/yearngpt.html` for a distinct GPT-authored filename.

## What Changed

- Built a sourced competitor survey covering Tinder, Bumble, Hinge, Match, OkCupid, Coffee Meets Bagel, HER, Feeld, and Grindr.
- Cataloged free features, paid features, settings, privacy controls, safety tools, and monetization patterns.
- Added a feature matrix showing which common dating-app features are free, paid, missing, or included in Yearn.
- Designed Yearn's product scope for iOS, Android, and Web, including onboarding, discovery, profile, likes, chat, settings, safety, Boost, and success offboarding flows.
- Added a detailed privacy and safety technology scope: verification, explicit-image blur, conversation safety, block contacts, E2EE messaging, scam detection, date sharing, screenshot controls, and deletion policy.
- Added a simple financial model: $4.99/year core membership plus optional $1 one-week Boost.
- Added a sources appendix with official help-center and app-store policy links.
- Replaced one Bumble paid-features link with the official Bumble pricing information source for a more stable citation.
- Duplicated `yearn.html` to `yearngpt.html` without content changes.
- Added a focused preference-filter research section to `yearngpt.html`, covering who users can choose to see across Tinder, Bumble, Hinge, Match, OkCupid, Coffee Meets Bagel, HER, Feeld, and Grindr.
- Extended the feature matrix, settings inventory, and settings mockup with height, body/weight, politics, religion, smoking, drinking, cannabis, kids, relationship goals, verified-only, hard/soft strictness, include-unknowns, and pool-impact controls.
- Restored `yearngpt.html` from the intact `yearn.html` after an accidental search-output overwrite during local editing, then logged the resolved workflow error in `errors_log.md`.
- Updated `yearngpt.html` pricing from $14.99 once to $4.99/year across product copy, mockups, and unit economics.
- Added a top-10 dating-app scale scenario table modeling gross ARR, net ARR after a 30% platform fee, and illustrative valuation ranges at the $4.99/year membership rate.
- Added system and server cost scenarios across launch, breakout, and top-10 dating-app user thresholds, including MAU assumptions, annual infra cost ranges, base systems cost, and post-infra net revenue.
- Added current cloud-pricing reference links for Supabase, Cloudflare R2, Fly.io, and LiveKit.
- Added one premium paid feature: a $1 Boost that lasts 7 days and promotes the profile more frequently while respecting filters, blocks, and incognito.
- Changed the core model from a $4.99 one-time purchase to a $4.99/year membership and removed the tipping function from the product, mockups, unit economics, and payments copy.
- Added Yearn's focused matching rule: users can have no more than 10 active matches at a time, with accepted matches beyond the cap visible in a Pending queue that loads when a current match is archived, paused, or removed.
- Added Hinge-style intro messages attached to likes, with the intro becoming the first message if the like is accepted.

## Verification

- Ran external link status checks. Many official dating-app help centers return `403` to command-line `curl` while still being indexable and available through browser/search results.
- Ran `xmllint --html --noout`; remaining warnings are expected HTML4 parser complaints for HTML5 semantic tags (`nav`, `header`, `section`, `footer`), not document structure issues.
- Confirmed no function logic changed, so `pnpm gate:function:changed` was skipped.
- Re-checked the updated `yearngpt.html` after the preference-filter patch.

## Notes

- No application code was changed.
- `errors_log.md` now includes the resolved `yearngpt.html` accidental overwrite because it temporarily affected a user-facing artifact.
- Open Brain MCP tools were not exposed in the active Codex tool list; `claude mcp list` hung and was terminated.
