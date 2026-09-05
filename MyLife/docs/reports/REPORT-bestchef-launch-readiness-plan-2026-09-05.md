# BestChef Launch Readiness

**Date:** 2026-09-05
**Reviewer:** Claude Fable 5.1, fresh perspective, independent of the July audit team
**Repo state:** `main`, BestChef last touched 2026-07-29 (`d1d802eb`)
**HTML twin (canonical, with animated workflow recreations):** `REPORT-bestchef-launch-readiness-plan-2026-09-05.html`

## Verdict

- **Public launch today: NO-GO.** Same as 2026-07-11. Founder-ops F1 to F9 are all still open; nothing has been deployed since.
- **Engineering substrate: 8.5/10, confirmed.** Typecheck clean; 429 app, 1,304 module, 73 console tests pass; i18n keys and values at 100 percent across 24 catalogs.
- **Global completeness: 3/10.** iOS only, no web presence, recipes unreadable across languages, machine-grade translations, three locales missing from the iOS bundle.
- **Launch operations: 2/10.** 11 migrations unapplied, no vendors, no legal entity, stale TestFlight build 24, no APNs, no CDN.
- **Path to an all-features global GA: ~12 weeks** with parallel lanes; the child-safety vendor and the legal entity set the floor.

## What BestChef is

For any dish there is a best recipe, and a community that has cooked it can find that recipe together. Ranking is by reviewed votes: a vote with a CookProof photo counts 3x a swipe vote. Three loops: Compete (submit), Judge (vote deck, Reviewed Vote), Cook (private kitchen on local SQLite). Two halves: Supabase cloud social layer and offline kitchen. Surfaces: iOS app (43 screens, 24 locales), moderator console (9 pages), hub adapter (scoped, not a public surface), 38 migrations, 12 edge functions, 60+ `bc_` tables.

## History

136 commits since 2026-04-22 in three bursts (April build, June hardening, July plan 33 and plan 45) with long gaps. Last commit 2026-07-29; 38 idle days.

## Fresh findings (not covered by July)

| # | Finding | Severity |
|---|---------|----------|
| N1 | "Global launch" is iOS only; no Android project. The Indic, Indonesian, Vietnamese and Brazilian catalogs target Android-majority markets. | Scope, critical |
| N2 | No bestchef.app web presence; share links, legal links and App Review privacy URL all dead. | Scope, critical |
| N3 | Recipes cannot be read across languages; deck defaults to "My language". | Global, critical |
| N4 | Fail-closed moderation in 24 languages with an English-only console and no moderators. | Safety, critical |
| N5 | Runbook targets the removed 12+ age tier; Apple's 13+/16+/18+ questionnaire is mandatory since 2026-01-31. | Store |
| N6 | UK Online Safety Act assessments, DSA point of contact and transparency report, India grievance officer not in plan. | Legal |
| N7 | 20 seed recipes; Vote deck and Top 100 are empty on day one. | Content |
| N8 | Video still streams raw MP4 from origin (audit H7). | Scale |
| N9 | iPad declared supported without layouts or screenshots. | Store |
| N10 | No build contains the remediation; no device or E2E evidence. | Release |
| N11 | bn, ta, te have catalogs but are missing from iOS supportedLocales and store metadata. | Config |
| N12 | Production has never run the current schema; no PITR or restore drill. | Ops |
| N13 | Cadence risk: nine weeks since plan 45 with no execution. | Risk |

## The complete plan (all before launch)

- **WS-A Android app** from the same Expo codebase: prebuild, FCM, fonts, RTL, EAS profiles, Play Console, device QA in 24 locales.
- **WS-B bestchef.app web** (`apps/bestchef-web`): legal pages, share landings, public read-only dish/recipe/chef pages, Universal Links and App Links.
- **WS-C Trust and safety live**: classification and hash-match vendors, NCMEC registration, adapters behind existing seams, console machine translation and language routing, moderator rota and SLA, load test.
- **WS-D Localization finished**: professional review of 24 catalogs and metadata, locale list parity gate, cross-language recipe translation (`bc_submission_translations`), localized dish catalog, per-locale screenshot automation.
- **WS-E Legal and store**: entity and operator tokens, age ratings under the 2025 tiers, UK OSA assessments, DSA and India contacts, privacy labels and data safety, 24-locale listings.
- **WS-F Content cold start**: 240 labeled editorial seed recipes, founding chefs per language, first challenge season.
- **WS-G Media at scale**: Mux or Cloudflare Stream, image CDN, upload caps, iOS audio session.
- **WS-H Release engineering**: fresh iOS and Android builds, iPad layouts, Maestro E2E, accessibility, performance budget, release governance.
- **WS-I Production ops**: migrations, job config, PITR, restore drill, alerting, support macros, security re-check.
- **WS-J Launch and growth**: ASO per market, communications, launch-day room.

Full item tables with owner, effort and done-when criteria, the 12-week critical path, the launch gate checklist and run-cost estimates are in the HTML twin.

## Evidence run this session

`pnpm --filter @mylife/bestchef-app typecheck` PASS; app tests 429/429; module tests 1304 passed, 1 skipped; console tests 73/73; `check-i18n-parity.mjs` 24 catalogs at 100 percent; `check-i18n-values.mjs` PASS.
