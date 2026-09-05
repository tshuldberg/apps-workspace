# 2026-04-20 Top 20 Competitor Logo Pack

## Summary

Reviewed the MyLife codebase, live module definitions, future module mission-control HTML docs, existing competitor notes, and compiled business-plan research to build a first-pass marketing asset pack of 20 competitor logos.

## What I Did

1. Reviewed repo instructions and startup docs:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `.claude/settings.local.json`
   - `.claude/skills-available.md`
2. Inventoried current and planned module surfaces via:
   - `modules/*/src/definition.ts`
   - `docs/plans/*mission-control*.html`
   - `docs/competitor-analysis/*.md`
   - `docs/business-plan/BUSINESS-PLAN-MyLife-2026.md`
   - `docs/business-plan/competitor-financials-2024-2026.md`
3. Spot-checked current official/public sources for scale and relevance across the short list.
4. Downloaded and stored 20 brand assets in:
   - `apps/web/public/marketing/replace-ring/logos/`
5. Added a machine-readable manifest:
   - `apps/web/public/marketing/replace-ring/manifest.json`
6. Wrote a human-readable research note:
   - `docs/competitor-analysis/mylife-top-20-competitor-ring-2026-04-20.md`

## Final Top 20

- Goodreads
- YNAB
- Notion
- Obsidian
- MyFitnessPal
- Strava
- Flo
- Quizlet
- Day One
- Daylio
- Medisafe
- AllTrails
- Surfline
- Otter.ai
- Spotify
- Letterboxd
- Venmo
- Zillow
- Reddit
- Eventbrite

## Why This Set

- It balances shipped modules with future modules that already have mission-control scope.
- It favors brands that will read clearly on a homepage marketing surface.
- It keeps alternates open for later swaps without forcing a redesign of the asset folder structure.

## Files Changed

- `apps/web/public/marketing/replace-ring/logos/*`
- `apps/web/public/marketing/replace-ring/manifest.json`
- `docs/competitor-analysis/mylife-top-20-competitor-ring-2026-04-20.md`
- `docs/sessions/2026-04-20-top-20-competitor-logo-pack.md`
- `memory.md`

## Verification

- Verified 20 logo files were downloaded into the public asset folder.
- Verified file formats with `file apps/web/public/marketing/replace-ring/logos/*`.
- No function logic changed.
- No automated tests were run.
- `pnpm gate:function:changed` was intentionally skipped because this session only added assets and documentation.

## Notes

- `apps/web/public/` did not exist before this session, so the marketing asset pack now has a stable public home.
- `.claude/plugins.md` is referenced by repo instructions but is currently missing.
- Surfline only exposed a small favicon cleanly from the public site during this session; it is usable, but likely the first logo to upgrade if a better official asset is found later.
