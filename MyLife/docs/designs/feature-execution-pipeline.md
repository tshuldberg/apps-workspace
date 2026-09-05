# Feature Execution Pipeline

## Purpose

This document defines the systematic process for building all 217 remaining features across 29 modules. It connects the Feature Scoring Framework to the Agent Spec Template to actual implementation and QA. Every feature follows this pipeline. No exceptions.

## Pipeline Stages

```
SCORE --> SPEC --> [PLAN?] --> BUILD --> GATE --> REVIEW --> QA --> SHIP --> RETRO
  |         |        |          |         |        |         |       |       |
  v         v        v          v         v        v         v       v       v
scoring   agent    /plan-    code +    /func-   /review   /browse  /ship   /retro
framework  spec    eng-      tests    gate-     + /qa     human     PR     weekly
           tmpl    review             runner    -only     verify    merge
                  (L/XL only)
```

## gstack Integration Map

gstack skills are wired into specific pipeline stages. This is not optional -- the skills ARE the quality gates.

| Pipeline Stage | gstack Skill | When to Use | What It Produces |
|----------------|-------------|-------------|-----------------|
| **SPEC** (complex features) | `/office-hours` | Feature is strategic, ambiguous, or touches multiple modules. Use BUILDER mode. | Design doc with constraints and chosen approach |
| **PLAN** (L/XL features) | `/plan-eng-review` | Feature scored Complexity 0-1 (Large/Complex). Run on the spec before building. | Architecture validation, test plan, failure modes |
| **BUILD** (all features) | `/function-gate-runner` | After every code change. Run before moving to REVIEW. | Lint + typecheck + test results per function |
| **REVIEW** (all features) | `/review` | After build is complete, before merge. Detects SQL safety, race conditions, scope drift. | PR review with AUTO-FIX and ASK classifications |
| **QA** (UI features) | `/browse` | After building any user-visible screen. Navigate the URL, click every button, verify states. | Screenshots, element snapshots, interaction verification |
| **QA** (UI features) | `/qa` or `/qa-only` | After building 3-5 features in a module, batch QA the module. `/qa` fixes issues; `/qa-only` reports only. | Health score, issue list, before/after evidence |
| **QA** (design) | `/design-review` | After building Launch-tier UI, verify Cool Obsidian compliance, spacing, hierarchy. | Design audit with iterative fix loop |
| **SHIP** (per sprint) | `/ship` | When sprint features are ready to merge. Handles PR, changelog, version bump. | PR created, changelog updated, version bumped |
| **SHIP** (post-merge) | `/document-release` | After /ship completes. Updates README, CLAUDE.md, CONTRIBUTING to reflect what shipped. | Documentation synced with code |
| **RETRO** (weekly) | `/retro` | End of each sprint week. Tracks velocity, focus, shipping patterns. | Metrics snapshot, narrative, trends |
| **DEBUG** (when blocked) | `/debug` | When a feature build causes test failures or runtime errors. Four-phase investigation. | Root cause report, regression test, fix |
| **PARITY** (module changes) | `/parity-check` | After changing a module that has a standalone counterpart (MyCar). | Drift report |
| **ENGINE TEST** (business logic) | `/domain-engine-benchmarker` | When building or modifying a calculation engine (budget math, cycle prediction, workout state machine). | Eval suite + test coverage report |

### Feature Complexity Routing

Not every feature needs every skill. Route based on the Complexity Inverse score from the scoring framework:

```
Complexity 5 (Trivial, <15m):
  BUILD --> /function-gate-runner --> /review --> merge
  Skip: /plan-eng-review, /office-hours, /design-review

Complexity 4 (Small, 15-30m):
  BUILD --> /function-gate-runner --> /review --> /browse (if UI) --> merge
  Skip: /plan-eng-review, /office-hours

Complexity 3 (Medium, 30-60m):
  BUILD --> /function-gate-runner --> /review --> /browse (if UI) --> merge
  Consider: /design-review (if new screen)

Complexity 2 (Large, 1-2h):
  /plan-eng-review on spec --> BUILD --> /function-gate-runner --> /review --> /qa --> merge
  Consider: /office-hours (if strategic), /design-review (if new UI)

Complexity 1 (Complex, 2-4h):
  /office-hours (if ambiguous) --> /plan-eng-review on spec --> BUILD --> /function-gate-runner --> /review --> /qa --> /design-review --> merge

Complexity 0 (Massive, 4h+):
  /office-hours --> /plan-eng-review --> /plan-design-review --> BUILD (phased) --> /function-gate-runner --> /review --> /qa --> /design-review --> merge
```

### Sprint-Level gstack Loops

These run on a cadence, not per-feature:

```
WEEKLY SPRINT LOOP:
  Monday:    Dispatch features from scored backlog
  Daily:     BUILD + /function-gate-runner + /review (per terminal)
  Thursday:  /qa (batch module QA on web)
  Friday:    /retro (weekly retrospective)
  Friday:    /ship (if sprint features are ready)
  Friday:    /document-release (sync docs)

QA BATCH LOOP (every 5 features per module):
  /qa-only on module URL --> review report --> fix critical/high --> /qa (fix loop) --> all clear

DESIGN BATCH LOOP (every 10 UI features):
  /design-review on affected module URLs --> fix visual issues --> re-verify

PARITY LOOP (after any module change):
  /parity-check --> if drift: /parity-remediation --> re-check
```

## Stage 1: Score (input: COMPETITIVE-MATRIX.md)

**Who:** Lead/Claude (one-time task, ~2 hours CC)
**Input:** All 217 features from `docs/business-plan/COMPETITIVE-MATRIX.md`
**Process:** Apply 5-factor scoring formula from `docs/designs/feature-scoring-framework.md`
**Output:** `docs/designs/scored-feature-backlog.md` -- every feature with:
- Score (0-50)
- Tier (S/A/B/C/D)
- Module it belongs to
- Scoring breakdown (5 factors)
- Sprint assignment

**Sorting rules:**
1. Primary sort: Tier (S first, then A, B, C, D)
2. Secondary sort: Score within tier (highest first)
3. Tertiary sort: Module launch tier (Launch modules first, then Beta, then Hidden)
4. Tie-breaker: Lower complexity gets priority (ship faster)

## Stage 2: Spec (input: scored-feature-backlog.md)

**Who:** Lead/Claude writes specs using the agent template
**Input:** Each feature from the scored backlog
**Process:** Write a complete agent feature spec using `docs/plans/templates/agent-feature-spec-template.md`
**Output:** One spec file per feature at `docs/plans/features/[module]-[feature-name].md`

**Spec directory structure:**
```
docs/plans/features/
  sprint-1/                    # S-Tier features (pre-launch)
    workouts-rest-timer.md
    health-healthkit-integration.md
    rsvp-calendar-sync.md
    ...
  sprint-2/                    # A-Tier features (launch month)
    budget-reports-dashboard.md
    nutrition-restaurant-menus.md
    ...
  sprint-3/                    # B-Tier features (post-launch)
    ...
  backlog/                     # C-Tier and D-Tier
    ...
```

**Spec quality gate:** Every spec MUST have:
- [ ] Business context (WHY this feature, WHO it targets)
- [ ] Competitive landscape (which competitors have it, what they charge)
- [ ] Wireframe position (where in the app this lives)
- [ ] Data model (tables, columns, migrations)
- [ ] Functional requirements (user stories, behavior spec)
- [ ] Edge cases (nil, empty, large, offline, force-quit)
- [ ] Acceptance criteria (minimum 3-5, no cap, UX + technical)
- [ ] UI spec (mobile + web, all 5 states: loading/empty/error/success/partial)
- [ ] Test requirements (unit + integration + QA script)
- [ ] Handoff state (before/after, files changed, context for next agent)

## Stage 3: Build (input: feature spec)

**Who:** AI coding agent (Claude Code / Codex)
**Input:** One feature spec file
**Process:**
1. Agent reads the spec completely before starting
2. Agent reads the module's CLAUDE.md and definition.ts
3. Agent reads DESIGN.md for design system alignment
4. Agent implements: business logic, migrations, mobile UI, web UI, tests
5. Agent runs `pnpm gate:function:changed` to verify
6. Agent writes handoff state in the spec file

**Build constraints:**
- Agent touches ONLY files listed in the spec's scope
- Every button/interaction the agent creates MUST be functional
- No placeholder UI. No "coming soon." No dead routes.
- All UI follows Cool Obsidian (DESIGN.md)
- Module accent color applied correctly
- Empty states use the warm pattern (icon + headline + CTA)

**Parallelization:** Features in different modules can be built simultaneously by different agents. Features within the same module must be sequenced to avoid conflicts. The spec directory structure (sprint folders) enables batch dispatch.

## Stage 4: QA (input: built feature + acceptance criteria)

**Who:** Human QA tester + automated tests
**Input:** The feature's acceptance criteria from the spec
**Process:**
1. Run automated tests: `pnpm test` must pass
2. Run function gate: `pnpm gate:function:changed` must pass
3. Human QA follows the "QA Verification Script" from the spec
4. Each acceptance criterion is checked independently
5. QA tester records: PASS / FAIL / PARTIAL for each criterion
6. Any FAIL blocks merge -- agent must fix

**QA rules:**
- Every button must do what the user expects when clicked
- Every screen must handle all 5 states (loading/empty/error/success/partial)
- No developer-facing text visible to users
- Cool Obsidian theme applied (no light theme leaks)
- Touch targets minimum 44px
- Works on mobile AND web (unless spec says mobile-only)

**QA output:** Updated acceptance criteria with PASS/FAIL status. If any new acceptance criteria are discovered during QA, add them to the spec for future regression.

## Stage 5: Ship (input: QA-passed feature)

**Who:** Lead reviews + merges
**Process:**
1. Code review (automated via parity checks + manual spot check)
2. Merge to main
3. Update module completeness percentage in COMPETITIVE-MATRIX.md
4. Update launch tier if module crosses a threshold (e.g., 60% -> Beta)
5. Mark feature as DONE in scored-feature-backlog.md

## Sprint Execution Model

### Sprint Cadence

| Sprint | Features | Duration | Focus |
|--------|----------|----------|-------|
| Sprint 1 | S-Tier (est. 15-20 features) | 2 weeks | Pre-launch blockers. Features that make users switch. |
| Sprint 2 | A-Tier (est. 30-40 features) | 4 weeks | Launch month. Core experience improvements. |
| Sprint 3 | B-Tier (est. 30-40 features) | 4 weeks | Post-launch. Enhanced experience. |
| Sprint 4+ | C/D-Tier | Ongoing | Quarter 2+. Nice-to-have and niche. |

### Per-Sprint Process

1. **Sprint Planning (1 hour):** Review scored backlog. Select features for sprint. Write/review specs.
2. **Daily Build (agents):** Dispatch specs to agents. Each agent builds one feature per session.
3. **Daily QA (human):** QA testers verify completed features against acceptance criteria.
4. **Sprint Review (1 hour):** Count features shipped. Update completeness. Adjust next sprint.

### Agent Dispatch Model

For maximum throughput, dispatch agents in parallel across modules:

```
Agent 1: workouts-rest-timer.md          (Sprint 1, S-Tier)
Agent 2: health-healthkit-integration.md (Sprint 1, S-Tier)
Agent 3: rsvp-calendar-sync.md          (Sprint 1, S-Tier)
Agent 4: budget-reports-dashboard.md     (Sprint 1, S-Tier)
Agent 5: meds-bp-logging.md             (Sprint 1, S-Tier)
```

Each agent is independent. No coordination needed between agents working on different modules. Use the plan queue system (`docs/plans/queue/`) for dispatch.

### CC+gstack Time Estimates

| Task | Human Team | CC+gstack | Compression |
|------|-----------|-----------|-------------|
| Score all 217 features | 1 week | 2 hours | ~20x |
| Write 1 feature spec | 2 hours | 15 min | ~8x |
| Build 1 feature (code + tests) | 3-5 days | 30-60 min | ~30x |
| QA 1 feature | 2-4 hours | 2-4 hours (human) | 1x (human task) |
| Full Sprint 1 (20 features) | 10 weeks | ~15 hours CC + QA | ~30x |

### Completeness Tracking

After each sprint, update these trackers:
1. `docs/business-plan/COMPETITIVE-MATRIX.md` -- move features from "needed" to "built"
2. `docs/designs/scored-feature-backlog.md` -- mark features DONE
3. `docs/designs/launch-module-tiers.md` -- promote modules that cross tier thresholds
4. Module definition.ts version numbers
5. `memory.md` -- session log

## Module-Level Feature Reconciliation

For each of the 29 modules, this is the path to 100% competitive parity:

### Launch Tier Modules (17) -- Close gaps by Sprint 2

| Module | Built | Needed | Gap Features to Close |
|--------|-------|--------|----------------------|
| Budget | 20 | 11 | Reports dashboard, investment tracking, expense splitting, receipt OCR, ML categorization, loan planner, age of money, subscription cancel assist, family sharing, multi-currency improvements, net worth improvements |
| Fast | 9 | 6 | Smart water reminders, multi-beverage, Apple Watch, HealthKit sync, caffeine tracking, custom containers |
| Books | 17 | 6 | Recommendation engine, social feed, reading stats sharing, badges, book clubs, community challenges |
| Journal | 12 | 10 | Voice-to-text, auto metadata, AI prompts, grid layout, vision board, affirmations, stoic prompts, CBT records, therapy templates, printed books |
| Workouts | 12 | 12 | Rest timer, previous performance, video demos, AI generation, progressive overload, muscle recovery, GPS routes, Apple Watch, plate calculator, progress photos, sharing, social feed |
| Meds | 14 | 10 | BP logging improvements, blood glucose, insulin tracking, BP trends, caregiver alerts, CGM, HbA1c, pain map, weather correlation, FODMAP |
| Voice | 12 | 3 | Custom voice commands, speaker ID, multi-language simultaneous |
| Recipes | 14 | 6 | Video import, paper OCR, nutritional info, print, sharing, voice control |
| Nutrition | 12 | 5 | Restaurant menus, wearable sync, water tracking, community, food diary notes |
| Mood | 11 | 9 | Custom experiments, photo/voice, PIN lock, virtual pet, self-care, meditation, focus music, SOS panic, AI insights |
| Notes | 10 | 13 | Templates UI, checklists, daily notes, code blocks, attachments, tables, AI writing, graph view, web clipper, OCR, plugins, databases, canvas |
| Habits | 11 | 12 | Sobriety clock, craving log, milestones, RPG gamification, focus timer, HealthKit, challenges, badges, pet collection, location reminders, Siri, time tracking |
| Cycle | 11 | 4 | Temperature tracking, partner sync, pregnancy mode, community forums |
| Flash | 10 | 11 | Rich media, daily reminders, streak celebration, image occlusion, custom templates, AI card gen, match game, multiple choice, AI tests, leagues, conversation |
| Surf | 10 | 4 | Multi-region, cam feeds, social, advanced forecasts |
| RSVP | 12 | 11 | Calendar sync, templates, custom invitations, expense splitting, recurring events, map/directions, dietary collection, guest messaging, gift registry, event recap, seating |
| Words | 11 | 4 | Saved words, offline fallback, advanced search, Flash integration |

### Beta Tier Modules (7) -- Close P0 gaps by Sprint 3, full gaps by Sprint 5

| Module | Built | Needed | P0 Gaps |
|--------|-------|--------|---------|
| Health | 6 | 18 | HealthKit, breathing exercises, wellness timeline |
| Pets | 6 | 13 | None (all P1+) |
| Car | 4 | 11 | Maintenance reminders |
| Stars | 5 | 8 | None (all P1+) |
| Homes | 3 | 8 | Maintenance reminders |
| Trails | 3 | 11 | Offline maps |
| Forums | 5 | 6 | None (all P1+) |

### Hidden Tier Modules (5) -- Build core functionality by Sprint 5+

| Module | Built | Needed | Critical Path |
|--------|-------|--------|--------------|
| Closet | 3 | 9 | Laundry, seasonal, cost-per-wear first |
| Garden | 4 | 11 | Fix migration bug, then AI plant ID, disease diagnosis |
| Market | 8 | 8 | Cloud functions + full UI first (P0), then encryption, payments |
| Mail | 3 | 10 | Full IMAP + search + threading first (P0) |
| Subs | 2 | 8 | Being absorbed into Budget -- build as Budget sub-features |

## Total Effort Estimate (CC+gstack)

| Sprint | Features | CC Time | Calendar Time |
|--------|----------|---------|---------------|
| Scoring all features | 217 | 2 hours | 1 day |
| Writing all specs | 217 | ~55 hours | 2 weeks (parallel) |
| Sprint 1 (S-Tier build) | ~20 | ~10 hours | 1 week |
| Sprint 2 (A-Tier build) | ~40 | ~20 hours | 2 weeks |
| Sprint 3 (B-Tier build) | ~40 | ~20 hours | 2 weeks |
| Sprint 4+ (C/D-Tier) | ~117 | ~60 hours | 4 weeks |
| **Total build** | **217** | **~167 hours CC** | **~10 weeks calendar** |

Human QA adds ~2-4 hours per feature = ~500-900 hours total QA across all 217 features. This is the bottleneck and why human QA testers are in the hiring plan.
