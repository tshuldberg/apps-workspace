---
status: PROPOSAL
parent: docs/plans/consolidation/README.md
---

# Sequence, Gates, and Rollback

## Phase order

Rescoped 2026-04-20 after the independent phase review (`phase-review-report.md`): Phase 2 splits into anchor-first (2a) + broad coverage (2b); a new Phase 1c Wave A polish step adds hub-table readers before 2b; Phase 1c Waves B/C/D move later; Phase 5 splits into core + an optional Phase 7.

| # | Phase | Duration | Dependencies |
|---|-------|----------|--------------|
| 0 | Unblock fresh installs | 3 days | none |
| 1a | Shared-entity hub tables | 1 week | 0 |
| 1b | Wave A adapters (attachments / tags / places) | 1 week | 1a |
| 1c-A | Wave A shadow-write modules (notes / books / trails) | 1 week | 1b |
| 1c-A polish | Wave A hub-table readers (notes / books / trails) | ~3 days | 1c-A |
| 2a | 7-anchor `getTodayCards` only (health, journal, homes, budget, rsvp, trails, books) | ~1 week | 1c-A |
| 2b | Broad coverage: remaining 23 modules + `getSearchableContent` + `getDataSummary` + `getActivityFeed` + `getCorrelationData` | ~2 weeks | 1c-A polish, 2a |
| 1c-B/C/D | Remaining shadow-write waves (reminders, goals, events, people, body_metrics, foods, etc.) | ~2 weeks | 1c-A polish |
| 3a | Today surface | 1.5 weeks | 2a (minimum), 2b for full coverage |
| 3b | Onboarding refresh | 1.5 weeks | 1c-A complete |
| 4 | AI agent layer | 3 weeks | 1 complete, 2b complete |
| 5-core | Automation: 4 highest-value rules (receipt → budget, recipe → nutrition, mail ICS → events, book highlight → flash) | 2 weeks | 1 complete |
| 6 | Measurement + expansion resume | 1 week | 3, 4, 5-core shipped |
| 7 | Secondary automations (subs detection, voice indexing, GPS surf prompt, mail people/subs/events) | ~2 weeks (optional) | 6 metrics meet targets |

Total: ~12 weeks for Phases 0-6 with 2-3 engineers; Phase 7 adds ~2 weeks if metrics gate it in.

## Gate criteria per phase

Every phase must meet all gates before the next phase starts.

### Phase 0 gate
- `pnpm test` green, no migration errors on fresh install
- Habits + garden V2 migrations passing
- Backup restore round-trip tested
- `react-hooks/rules-of-hooks` back to `error`

### Phase 1 gate
- All 11 hub tables created via migrations
- At least one module per adapter wave migrated (Wave A minimum)
- `pnpm check:module-parity` green
- `pnpm check:generated-artifacts` green
- Schema docs updated in `CLAUDE.md` Module Table Prefixes section
- Backup exports include all hub tables

### Phase 2 gate
- All 30 modules export `CrossModuleInterface` with 4 base methods
- Unified search returns results across all enabled modules
- Weekly digest iterates all 30 modules
- No module returns error from `getCorrelationData` (empty series OK)

### Phase 3 gate
- Today surface renders within 600ms cold launch
- Onboarding completes in ≤ 4 screens for 80% of test users
- Module grid accessible at `/all` with no behavior change
- `/qa` + `/design-review` pass

### Phase 4 gate
- `packages/intelligence` public API stable
- Local inference works iOS 17+, Android 10+, WebGPU browsers
- `hub_ai_permissions` enforced on every tool call
- BYOK keys biometric-gated
- Every AI screen has non-AI fallback
- `hub_ai_audit_log` records every call

### Phase 5 gate
- At least 8 automation rules shipped with preview + apply + audit
- Apple Shortcuts intents documented and tested
- Share Sheet handlers working on iOS + Android
- No rule spends money or sends message without explicit user action

### Phase 6 gate
- Day-7 retention measured and compared to baseline
- Activation rate measured (onboarding → first entry)
- Cross-module action rate measured
- Decision gate: resume expansion plan IFF retention ≥ baseline + 20%

## Rollback plan

Each phase ships behind a kill switch in `hub_preferences`:

```
hub_preferences['consolidation.shared_entities_enabled'] = 1
hub_preferences['consolidation.today_surface_enabled'] = 1
hub_preferences['consolidation.new_onboarding_enabled'] = 1
hub_preferences['consolidation.ai_enabled'] = 0
hub_preferences['consolidation.automations_enabled'] = 0
```

If a phase degrades production, flip the preference. Old UI paths stay in the codebase for one full phase cycle (≈ 2 weeks) before removal.

Per-module rollback: `hub_shared_entity_adoption(module_id, entity_name, state)` tracks which modules have migrated. If Wave A breaks pets, flip pets back without reverting the whole hub.

## Parity contracts

`pnpm check:parity` runs on every task completion (enforced by `.claude/settings.json` hook). The consolidation work must not cause parity regressions. If a standalone app exists for any module being touched, update both surfaces in the same session or postpone.

## Agent Team guidance

- Phase 1 is single-owner (`hub-shell-dev` + `db-dev`) — schema coordination
- Phase 2 is Agent Team heavy — one `module-dev` per module, parallel
- Phase 3 is two-owner (`hub-shell-dev` mobile + `hub-shell-dev` web)
- Phase 4 is single-owner (`hub-shell-dev`) + one `module-dev` for tool surface
- Phase 5 is single-owner
- Every phase: one `parity-checker` teammate watching drift

## Success metrics (revisited)

Track weekly during and after rollout:

| Metric | Baseline | Target |
|--------|----------|--------|
| Day-7 retention | current production value | +30% |
| Onboarding completion | current production value | ≥ 80% |
| Cross-module action rate | effectively 0% today | ≥ 25% weekly |
| AI opt-in (any module) | 0% today | 20-40% |
| Shared entity adoption | 0 modules today | 3+ writers per entity in 60 days |
| Hub search coverage | 4/30 | 30/30 |

## Out of scope

- Wearable or watch companion app
- Desktop / macOS native build
- Cloud-backed collaboration beyond `packages/social`
- New module additions beyond 30
- Redesign of any shipped module's internal UI (module-team decisions)

## Memory + docs update

At completion of each phase:

- Update `memory.md` Sessions table (one-liner + log link per CLAUDE.md)
- Write full session log in `docs/sessions/YYYY-MM-DD-consolidation-phaseN.md`
- Capture Open Brain memory: project context, decisions made, what shipped
- Update `CLAUDE.md` Module Table Prefixes if any consolidation affects prefix ownership
