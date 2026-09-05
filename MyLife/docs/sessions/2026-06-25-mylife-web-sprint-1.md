# MyLife improvement Sprint 1 (web)

Date: 2026-06-25
Branch: feature/mylife-improvements-sprints (off main 4c8018cb)
Orchestration: ultracode orchestrator + plain-Opus implement -> adversarial-review pipelines (Workflow + Agent), orchestrator verifies/commits.

## Tickets (from PLAN-mylife-web-nyc-daily-driver-sprint-2026-06-24.html)

### WEB-FIX-2 (P1) - commit 86b93f44
Repointed apps/web/app/settings/data-sync/page.tsx off the @mylife/sync barrel
(which re-exports blob-store -> fs) to fs/blob-free subpaths: useSyncStatus/
useSetSyncTier from @mylife/sync/src/hooks, tierRequiresAuth/isCloudTier/
SyncTier from @mylife/sync/src/types. Dropped the unused STORAGE_LIMITS import.
Verified: /settings/data-sync 200 live, no route cascade, web typecheck + full
web test suite pass.

### CLS-SEMESTER (P1) - commit ffbdc3de
Added createTermAction server action (wrapping existing createSemester CRUD via
SemesterInputSchema), a Terms control in Classes Settings, and an empty-state
"Create a term" CTA on the schedule page. Default is a hobby-friendly evergreen
term (today -> +10y, is_current) with real start/end dates so ICS export
(DTSTART + RRULE UNTIL) works. Verified: /classes 200 + CTA present (SSR);
@mylife/classes tests 378; create-term -> activeSemester -> AddClassDialog ->
WeeklySchedule chain covered by tests + source trace.

### MOD-UNHIDE (P1) - commit 7d6c99fc
Added 'health' to WEB_SUPPORTED_MODULE_IDS; added a web-only visibility override
(WEB_VISIBILITY_OVERRIDE_IDS=['dining','rsvp','sleep','sports'] + isWebVisible
ModuleId) so those surface on web WITHOUT mutating shared HIDDEN_MODULE_IDS
(mobile unchanged, release-states.ts untouched). Applied the predicate across
getEnabledModuleIds, enableModuleAction, completeOnboardingAction, Sidebar
(added missing sleep route), and Discover (web-aware release labels). Sports
unhidden in FULL (all tabs: scores/standings/schedule/betting/fantasy/play) per
founder decision; truth check confirmed sports scores/stats is a real
ESPN-backed feature, not empty tabs.

Onboarding reconciled for honesty: every cluster + goal description names only
web-deliverable modules (the deliverable set = 19 modules: GA/beta that are
web-supported, plus the 4 overrides). Dropped journal/notes/voice/flash/words/
forums/presence/market/etc. (hidden or unsupported on web) from clusters; added
sleep + sports to the body cluster; added isWebDeliverable runtime guards so a
future drift cannot promise an un-enableable module. Updated the stale
actions-enabled-modules and onboarding tests (kept the payments-hidden guard).
A fresh adversarial reviewer independently recomputed the deliverable set and
PASSed. Verified: all 5 modules + 6 sports tabs 200 live; Discover shows them
enableable (0 "Not yet available"); web tests 376.

### UI-HARDEN - commit 11a19721
Added "sideEffects": false to @mylife/ui (no real side effects) and a guard
scripts/check-web-ui-barrel-imports.mjs that fails on bare @mylife/ui value
imports in apps/web, wired as check:web-barrel into husky pre-commit (after the
function gate) + CI lint. Hardens the apps/web -> @mylife/ui edge.

## Gates (orchestrator-run, combined tree)
- pnpm --filter web typecheck: clean
- pnpm --filter web test: 54 files, 376 passed / 4 skipped
- pnpm check:parity: green (incl. 52 module layouts)
- pnpm gate:function:changed: 0 errors (96 pre-existing lint warnings)
- pnpm check:web-barrel: green
- All 17 touched routes 200 live (dev :3100), no runtime errors in dev log

## Verification gap (honest)
Interactive Playwright click-through (create-term, enable-module) could not run:
the Playwright MCP browser profile was locked by a concurrent :3000 session.
Covered instead by HTTP 200 + server-rendered content greps + full test suites +
adversarial source traces. Recommend a later live click-through when the browser
is free.

## MAJOR discovered blocker (pre-existing, not Sprint 1)
`pnpm --filter web build` (production webpack) FAILS: `Expected 'from', got
'typeOf'` from React Native Flow. webpack pulls RN into the web bundle via
MODULE barrels, e.g. app/mood/page.tsx -> @mylife/mood -> SectionHeader ->
@mylife/ui -> Text -> react-native. Turbopack dev tolerates it (every route
200'd), webpack prod does not. Confirmed pre-existing: every file in the import
trace is byte-identical to main; the only Sprint 1 change near packages/ui is
the one-line sideEffects:false, which cannot create the import. Scope: ~373 web
files import bare @mylife/<module> barrels; >=7 module barrels (mood, books,
budget, meds, workouts, nutrition, fast) re-export ./ui RN components.

This means the web app does not build for production today. It is a dedicated
epic, not a Sprint 1 quick win. Two candidate approaches:
1. Configure next.config.ts: alias react-native -> react-native-web +
   transpilePackages (the standard RN-in-Next path; smallest churn, adds the
   react-native-web dep, renders RN components via RNW on web).
2. Split RN UI out of every module barrel behind a subpath and repoint web
   pages to pure subpaths (cleaner architecture, large: ~373 files + barrels).

Surfaced to the founder for a prioritization + approach decision before opening
Sprint 2.

### RESOLVED 2026-06-25 (founder chose: fix now via react-native-web)
Delegated to an Opus agent (iterate build->fix->build), then orchestrator-verified
+ adversarial review. Changes: alias `react-native$`->`react-native-web` in
apps/web/next.config.ts (webpack resolve.alias + turbopack resolveAlias), web-first
resolve extensions, `__DEV__` DefinePlugin, react-native-web@^0.21 added to apps/web,
completed transpilePackages. Reaching typecheck/prerender for the first time exposed
latent non-RN blockers, all fixed honestly: 10 RN+hook @mylife/ui components marked
"use client" (inert on Metro, mobile-safe), a useEffectEvent polyfill (React 19 lacks
it), Next 15 async params/searchParams migrations, and Suspense boundaries around
useSearchParams pages. The 3 /fast pages were dead passthroughs to the deleted
@myfast-web standalone, so they were rebuilt self-contained on apps/web/app/fast/
actions.ts + @mylife/fast (history/stats/settings; no mocks). Commits: 63d27fb7
(fast pages), fb16c306 (RNW config + collateral). Verified: pnpm --filter web build
exit 0 (478/478 pages), full typecheck 122/122, full test 121/121, web tests 376,
@mylife/ui 29, check:parity green, /mood + /fast + Sprint 1 routes 200. Adversarial
review PASS. Follow-up: reconcile the .skip'd @myfast-web passthrough parity
expectations + dead tsconfig @myfast-web mapping when MyFast is restored or retired.

## Logged
- errors_log.md: data-sync row -> Resolved; added the production-build blocker
  (Unresolved) and the MOD-UNHIDE stale-test row (Resolved); removed 16
  hook-stub false-positive rows.
- memory.md: Sessions row + tech-debt blocker; removed stop-hook auto-rows.
- Open Brain: captured (context personal, mylife).
