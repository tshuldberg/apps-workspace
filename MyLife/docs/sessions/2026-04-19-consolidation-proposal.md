# 2026-04-19 — Consolidation Proposal

## What was done

Authored a strategic consolidation proposal under `docs/plans/consolidation/` consisting of a README and six phase plans. Work was research-driven via four parallel subagents: (1) codebase audit for consolidation-layer readiness, (2) life-OS onboarding and consolidation pattern research, (3) on-device AI feasibility on React Native + Next.js, (4) cross-module workflow cluster mapping across all 30 modules.

## User decisions captured

- **AI layer:** local-first with smart routing (Apple Foundation Models on iOS 26+, ExecuTorch + Llama 3.2 1B on Android/older iOS, WebLLM on web; Vercel AI SDK v6 for BYOK cloud fallback).
- **Onboarding:** goal-based + starter kits (Pledge → Goal question → Kit preview → First action, cap 4 screens before first real action).
- **Module expansion:** paused. The APPROVED `DESIGN-module-expansion-29-to-44.md` plan is frozen until the consolidation spine ships.

## Files created

- `docs/plans/consolidation/README.md` — executive strategy, seven workflow clusters, phased sequence, success metrics.
- `docs/plans/consolidation/01-shared-data-layer.md` — 11 hub tables with SQL, migration waves (A–D), rollback plan.
- `docs/plans/consolidation/02-cross-module-contracts.md` — finish `CrossModuleInterface` for 26 missing modules; per-module stat + correlation hints.
- `docs/plans/consolidation/03-unified-today-surface.md` — ranked Today view replacing the module grid; card taxonomy; ranking algorithm; per-cluster quick actions.
- `docs/plans/consolidation/04-onboarding-goal-based.md` — Pledge + Goal + Kit + First-action flow; starter kits per cluster; post-first-value banners.
- `docs/plans/consolidation/05-ai-agent-layer.md` — `packages/intelligence` expansion; provider adapters; tool registry with prefix-gated SQL; sqlite-vec RAG; audit log.
- `docs/plans/consolidation/06-automation-shortcuts.md` — manual-reversible cross-module triggers, Apple Shortcuts, Share Sheet, conflict detection.
- `docs/plans/consolidation/07-sequence-and-gates.md` — 6 phases, gates per phase, kill switches, rollback plan, success metrics.

## Key findings from the audit agents

- `packages/intelligence` (60%), `packages/search` (70%), `packages/onboarding` (70%), `packages/engagement` (30%) all exist but are not wired into app UI. The consolidation is primarily a finishing job, not greenfield.
- Only 4 of 30 modules export `CrossModuleInterface` (workouts, habits, meds, books partial). The other 26 leave blank slots in search, digest, and correlation.
- Hub schema has 26 tables but misses the cross-cutting entities (tags, attachments, reminders, goals, people, body metrics, costs, places, events, foods, books, timeline).
- Highest-risk migration: Budget / Subs / Pets / Car / Homes cost ownership reconciliation. Meds and habits are silent super-modules that duplicate mood, cycle, contacts, reminders.
- Top competitive pattern: single ranked Today surface (Apple Health, Oura, WHOOP) beats the grid. Sunsama daily ritual + Duolingo goal-based onboarding + Readwise import-first are the proven levers.
- On-device AI: Apple Foundation Models is production-ready on iOS 26+; ExecuTorch with Llama 3.2 1B is the cross-platform fallback; sqlite-vec via op-sqlite is the vector store.

## Decisions deferred

Three open questions called out in the proposal README:
1. Weekly digest delivery format (push vs in-app tab vs opt-in email).
2. Biometric gate scope for AI writes (all writes vs only money/reminders/external shares).
3. Starter-kit customizability timing (during onboarding vs post-first-run).

## What didn't ship today

No code changed. This was research + proposal only. Implementation is phased under `07-sequence-and-gates.md`.

## Verification

- No code edits; `pnpm gate:function:changed` not applicable.
- Memory.md Sessions table updated with a one-liner row pointing here.
- Open Brain MCP offline, so cross-device capture was skipped this session.

## Remaining items (next session)

- User review of `docs/plans/consolidation/README.md` and approval to start Phase 0.
- Decide on the three deferred questions before Phase 3 onboarding work begins.
- If approved, move `01-shared-data-layer.md` (plus numbered siblings) to `docs/plans/queue/` with plan-template format so agents can execute.
- Kick off Phase 0 (fix habits + garden migrations, wire backup UI, flip hooks lint back to error).

## References

- Full research reports are captured in the agent transcripts (tool-use IDs in this session).
- CEO review `docs/designs/full-product-strategic-review.md` is the upstream scope document; this proposal implements its accepted items.
- Strategic review `docs/designs/DESIGN-module-expansion-29-to-44.md` is explicitly paused, not cancelled.
