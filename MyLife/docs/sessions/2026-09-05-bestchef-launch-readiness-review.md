# 2026-09-05 BestChef launch readiness review and complete global plan

## What

Fresh, full-scope production readiness review of BestChef (Fable 5.1, independent of the July audit team) plus a complete plan to an all-features, 24-language launch on iOS, Android and web. Deliverable is an animated HTML report with recreations of every major workflow (onboarding, vote deck and Reviewed Vote, submit, Top 100 filters, kitchen receipt-to-grocery, profile and creator, moderator console) and the three new surfaces the plan adds (bestchef.app web, Android, cross-language recipe reading).

## Why

The founder asked for a fresh perspective on purpose, history and what is left for a production launch with no phased or deferred features and global multilanguage coverage.

## Files

- `docs/reports/REPORT-bestchef-launch-readiness-plan-2026-09-05.html` (canonical, animated)
- `docs/reports/REPORT-bestchef-launch-readiness-plan-2026-09-05.md` (twin)
- `docs/reports/README.md`, `docs/README.md` (indexes updated; July status row marked superseded)
- `memory.md` (project state + session row)

## Verification run

- `pnpm --filter @mylife/bestchef-app typecheck` PASS
- `pnpm --filter @mylife/bestchef-app test` 429/429
- `pnpm --filter @mylife/bestchef test` 1304 passed, 1 skipped
- `pnpm --filter @mylife/bestchef-console test` 73/73
- `node apps/bestchef/scripts/check-i18n-parity.mjs` 24 catalogs at 100 percent
- `node apps/bestchef/scripts/check-i18n-values.mjs` PASS

No function logic changed; the function gate was not needed.

## Findings (new, N1-N13)

iOS-only scope vs global claim; no bestchef.app (share links, legal URLs, App Review privacy URL dead); recipes unreadable across languages; fail-closed moderation in 24 languages with English-only console and no staff; Apple age-rating tiers changed (12+ removed, questionnaire mandatory since 2026-01-31); UK OSA, DSA contact/transparency, India grievance officer not planned; 20 seed recipes only; raw MP4 from origin; iPad declared without layouts; no build contains the remediation; bn/ta/te absent from iOS supportedLocales and store metadata; production never ran the current schema; cadence risk (38 idle days).

## Plan shape

Ten workstreams WS-A..WS-J with owner (agent, founder, vendor), effort and done-when; 12-week critical path (child-safety vendor and legal entity set the floor); launch gates; run-cost estimate.

## Remaining

Everything in the plan is unexecuted. Founder week 1: vendor contracts, counsel, apply migrations. Agents can start WS-A, WS-B, WS-D, WS-G, WS-I immediately.

## Decisions surfaced for the founder

- Include Android before launch (plan treats it as required for "global").
- New isolated app `apps/bestchef-web` rather than widening the hub web adapter.
- Cross-language recipe translation is a launch feature, not a later wave.
- Ship iPad layouts rather than disabling tablet support.

## Note

The working tree also carries another session's instruction-file reset (CLAUDE.md to AGENTS.md across bestchef, bestchef-console, modules/bestchef); those files were not touched or staged here.
