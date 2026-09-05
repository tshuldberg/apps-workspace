# Session: Adversarial Review of the NYC Power-User Eval Session (aa6dd63d)

**Date:** 2026-07-03
**Reviewed session:** `aa6dd63d-f45c-485e-ace6-a92757361fb6` (2026-06-24, resumed 2026-07-01). Deliverables reviewed: `REPORT-mylife-web-nyc-poweruser-eval-2026-06-24.md` (52/100 eval), `PLAN-mylife-web-nyc-daily-driver-sprint-2026-06-24.html` (10 tickets), `PROMPT-mylife-web-sprint-orchestrator-2026-06-24.md`.
**Method:** Read the full transcript (478 lines) plus all three artifacts, then tested the session's claims against 9 days of subsequent repo history (next.config.ts RNW alias, WEB_VISIBILITY_OVERRIDE_IDS, apps/web/app/manhattan, memory.md rows 19/41/75).

## Findings (principal engineer frame)
1. Readiness was scored without ever running `pnpm --filter web build`. No Bash tool call in the transcript runs a build; the prod build was broken pre-existing and only discovered 2026-06-25. A "readiness" score awarded to an app whose production build did not compile.
2. The durable-fix recommendation bet on the wrong architecture: police the barrels (sideEffects:false, subpath repoints, lint guard). Reality: ~373 web files import bare module barrels; the founder-approved fix was aliasing react-native to react-native-web (next.config.ts:163-214). Transcript line 170 even noted "react-native-web isn't installed" and never evaluated the alias. Three of ten tickets (WEB-FIX-1/2, UI-HARDEN) were symptom patches of one root cause. Credit: the triage repoint was correct for an eval session, and UI-HARDEN's verify step ("prod build, not just dev") is what forced the discovery during execution.
3. Score laundering: 52/100 first appears inside the synthesis subagent's structured output (transcript line 248, "bottomLine") with no rubric; the main session adopted it verbatim, derived a ~85 target and "high 60s after Sprint 1", and told the orchestrator to "re-score against the eval" with no formula. Zero rubric/weight language in the whole transcript.
4. MOD-UNHIDE's primary-listed approach (edit shared HIDDEN_MODULE_IDS) had mobile blast radius; execution had to invent WEB_VISIBILITY_OVERRIDE_IDS for exactly the reason the shipped code comment states (would flip mobile + break release-state property tests). The plan's secondary option was the right one.
5. Orchestrator prompt: honesty machinery (mock-hunting, verified-vs-compiles, stop-and-ask on betting/fantasy + SeatGeek + device QA) is excellent; the per-ticket process weight (personal verify + adversarial reviewer + gstack gates + 4 logging systems) is disproportionate for hour-scale S tickets.

## Findings (product designer frame)
1. Reachability was graded, experience was not: "Full" = route 200 + CRUD works. No friction, data-volume, or quality lens anywhere; the day-in-the-life is a coverage walkthrough.
2. Stated needs dropped between matrix and plan: lesson attendance (marked Gap, no ticket), city walking (no ticket; REMIND-INTAB nudges a thing you cannot track on web), basketball drill library.
3. The session's own synthesis agent raised the sharpest design question (academic Classes module vs a recurring-event primitive for adult hobby lessons) and the final plan demoted it to a phantom "CLS-HOBBY" dep note that is not one of the 10 tickets.
4. REMIND-INTAB is honest about web limits but wrong-medium for adherence; calendar/ICS delivery (already proven in Classes) was never considered for meds.
5. The cost cliff (flip _testMode and 9 of 10 drivers lock behind Pro) is the report's best product finding and got buried at Medium with no ticket and no founder-decision escalation.

## What held up
Bug forensics (exact file:line, minimal reversible fix, honest fixed-vs-reported split); need-to-matrix traceability; "registration status is a poor proxy for reachability" insight; sports betting/fantasy escalated as a product decision; plan proved executable (MOD-UNHIDE, SYNC-REAL, MANH-WEB all shipped along its lines).

## Part 2 (same session): Function eval, phone + web first
User asked for HTML delivery plus an overall function evaluation against their real use case (phone-browser dashboard, Manhattan events, workouts + eating/recipes macro loop, self-reporting). Delivered `docs/reports/REPORT-mylife-function-eval-phone-web-2026-07-03.html` containing both the adversarial review and the new eval. Method: live boot on :3100 (15 routes probed, all 200; root redirects to /onboarding/pledge) + 3 parallel code-audit agents.

Key findings: (1) phone access BLOCKED architecturally: single server-side sqlite (`apps/web/lib/db.ts`), middleware has no auth gate, zero deploy config, no PWA manifest/icons/SW; responsive shell at 768px is good. (2) Dashboard homepage MISSING for this user: TODAY_MODULES still the 7 stale anchors, `today.primary_clusters` has no web writer, reminders tray meds-only. (3) Manhattan web feed real (live keyless NYC Open Data, Tonight/Upcoming) but no search/multi-axis filters, SeatGeek proxy undeployed (founder ops), nightlife sources are stubs, no Today card, no web tests. (4) Macro loop half-built: Dining→Nutrition SHIPPED; recipe-cooked bridge (`recipeToNutritionRule`) has zero web callers; web food search local-DB only (live API clients unwired); no surface anywhere combines workouts + nutrition (Insights lacks nutrition; health page lacks both). (5) Two bugs logged in errors_log.md: `wo_sessions` nonexistent-table read in nutrition data-bridge (silent empty), hardcoded workouts demo stats.

Build recs (phone+web first): dashboard v2 with today-card providers for the user's modules + web cluster writer; PWA polish (S) + authenticated single-tenant deploy decision (L, founder); wire recipe-cooked + live food search + fix both bugs; combined Training+Fuel report + workouts CSV export; SeatGeek proxy deploy + Manhattan web depth.

## Remaining items
- memory.md is over the 80-line budget (131+ lines, ~28 session rows); archive pass due.
- No code changed this session (analysis only; 2 errors_log rows + docs); function gate not applicable.
- Dev server on :3100 was started for probing and stopped at session end.
