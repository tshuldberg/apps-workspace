# 2026-07-05 - DoWork Full Product Walkthrough + UI/UX Review

## What was done
Built `docs/reports/REPORT-dowork-user-story-2026-07-05.html` (~185 KB, self-contained, opened in browser): every DoWork screen rebuilt as an annotated HTML phone mockup, all user workflows traced end to end, plus consolidated findings and recommendations. Sources: direct code reads of the working tree, 2 Claude Explore agents (history/docs, social/account), 6 codex (gpt-5.5) extraction runs (shell/tabs, workout flows, tools, trainer platform, social, history), git history, Plan 36, launch-plan.md, and both prior audits.

## Report contents
1. Overview + dated build timeline (Apr extraction -> June audit -> Plan 36 -> founder-ops -> dp-audit fix wave) + founder-ops F1-F8 status
2. Design system (DW tokens; two-visual-dialect finding)
3. Navigation map (incl. stranded social surfaces)
4. Three personas + 4-path entitlement model
5-9. Screen-by-screen mockups: 6 tabs, core training flow, 12 tools, trainer platform, social/account
10. Six end-to-end workflows
11. Findings ranked (2 critical, 11 high, ~18 med/low) + recommendations + cross-model comparison
12. Appendix: 18 dw_ tables, 6 edge functions, defensive patterns

## Top findings
- **C1 (CRITICAL, new):** live session boots dead - `createPlayerStatus()` starts `idle`, START is never dispatched, Mark Complete requires `playing`, Pause/Resume render null in idle. No set can ever be logged. On main AND the branch. Logged in errors_log.md.
- **C2 (CRITICAL, process):** the 11-commit dp-audit fix wave (PKCE auth, paid-through billing, real Save/Discard, identity-bound queues, 2 migrations ALREADY DEPLOYED to prod) is unmerged on `feature/dowork-trainer-launch` - main's client is behind its own prod DB. Merge first.
- Highs: generator ignores equipment; superset never sets setGroupId; plans day-shape + unsubscribe id mismatches; Home fake volume (reps x10 as "reps-kg") + recovery chips from empty muscleVolume; Progress current-streak math wrong with gaps; body-map feeds exerciseId as muscleGroup; social feed buried / profile production-orphaned; Studio 500MiB-vs-500MB upload cap gap.

## Verification protocol
Findings extracted independently by Claude and gpt-5.5, then all 17 key findings sent back to codex adversarially (instructed to refute): 16 CONFIRMED, 1 PARTIAL (feed-reachability wording), 0 refuted, 0 missed highs. One codex hallucination caught and dropped during the pass (claimed 4 duplicate `getWorkoutDaysForInsights` exports; file has exactly one).

## Notes
- Claude subagent spawning failed transiently at session start ("Not logged in"); recovered mid-session. Codex exec used per global model-routing rules for bulk extraction.
- Review tree = feature/meerkat-launch-completion checkout (main-equivalent for dowork); findings cross-checked against the unmerged branch and tagged FIXED ON BRANCH where applicable (8 findings).

## Remaining / next
- Merge `feature/dowork-trainer-launch` into main.
- Fix C1 before any EAS build; add idle->playing->COMPLETE_SET test.
- Then the solo-half honesty fixes (H1-H6), social front-door decision, token unification sweep.
