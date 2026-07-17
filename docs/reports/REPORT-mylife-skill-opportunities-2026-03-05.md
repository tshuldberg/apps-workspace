# Skill Opportunity Report -- MyLife -- 2026-03-05

## Executive Summary

MyLife has 20+ standalone submodule apps, 14 hub modules, 13 packages, and only **3 existing skills** (hub-module-scaffold, migrate-module, parity-check). Analysis across 7 dimensions identified **8 high-value opportunities**, with the top 6 scoring above 3.4/5.0. The highest-leverage gap is domain engine benchmarking: MyHabits cycle prediction, MyWorkouts state machine, and MyBooks challenge/progress engines have zero test coverage despite being complex, safety-critical algorithms. The second major gap is parity remediation -- the existing parity-check skill runs checks but does not parse failures or suggest fixes.

## Existing Coverage

| Skill | Tier | Domain | Status |
|-------|------|--------|--------|
| `hub-module-scaffold` | 2 | Module creation from scratch | Active |
| `migrate-module` | 3 | Standalone-to-hub migration | Active |
| `parity-check` | 2 | Run parity gates, report drift | Active |
| Marketing skills (25) | 3-4 | CRO, SEO, content (via MyHomes submodule) | Active (inherited) |

**Coverage gaps:** No skills for domain engine testing, parity fix remediation, function quality gates, submodule sync, route validation, or module-level documentation generation.

## Ranked Opportunities

### 1. domain-engine-benchmarker -- Score: 4.50/5.0

| Factor | Score | Justification |
|--------|-------|---------------|
| Impact | 5/5 | Prevents critical bugs in health/fitness/financial algorithms with zero current test coverage |
| Frequency | 3/5 | Per new engine feature or refactor of existing domain logic |
| Complexity | 5/5 | Requires deep understanding of each engine's domain rules to generate meaningful evals |
| Testability | 5/5 | Deterministic: engines are pure functions with clear I/O contracts |
| Gap | 5/5 | Nothing in the workspace covers eval generation for domain-specific business logic |
| **Weighted Total** | **4.50/5.0** | |

**Dimension:** Domain Expertise (3) + Testable Functions (4)
**Evidence:**
- `modules/habits/src/cycle/prediction.ts` -- cycle prediction with zero tests (CRITICAL)
- `MyWorkouts/packages/shared/src/workout/engine.ts` -- state machine with zero tests (CRITICAL)
- `modules/books/src/challenges/challenge-engine.ts` -- challenge progress with zero tests (HIGH)
- `modules/books/src/progress/progress-engine.ts` -- reading speed calculator with zero tests (HIGH)
- `modules/books/src/journal/journal-engine.ts` -- streak calculation with zero tests (MEDIUM)
- `modules/meds/src/analytics/correlation.ts` -- mood-medication correlation (partial tests)
**Proposed triggers:** "benchmark engine", "test domain logic", "generate evals for module", "write engine tests"
**Eval sketch:** Verify cycle prediction with known inputs (3 cycles: 30, 29, 31 days) produces correct next period date and fertility window. Verify workout state machine transitions (idle->playing->paused->rest->completed).
**Stub generated:** `MyLife/.claude/skills/domain-engine-benchmarker/SKILL.md`

---

### 2. parity-remediation -- Score: 4.35/5.0

| Factor | Score | Justification |
|--------|-------|---------------|
| Impact | 5/5 | Parity failures are release blockers per CLAUDE.md line 50 |
| Frequency | 4/5 | Per commit affecting any module or standalone app |
| Complexity | 4/5 | 7-step validation with branching, nested per-module checks |
| Testability | 5/5 | Each module passes or fails; drift is precisely measurable |
| Gap | 3/5 | parity-check skill exists but only reports -- does not categorize or suggest fixes |
| **Weighted Total** | **4.35/5.0** | |

**Dimension:** Repetitive Workflows (1) + Complex Processes (2)
**Evidence:**
- `scripts/check-module-parity.mjs` (104 lines, 13 module specs)
- `scripts/check-passthrough-parity.mjs` (117 lines, complex passthrough logic)
- `scripts/check-workouts-parity.mjs` (strict UI/data parity)
- `scripts/check-standalone-repos.mjs` (route coverage validation)
- 4 sequential gates run via `pnpm check:parity`
**Proposed triggers:** "fix parity", "remediate drift", "parity failed what do I fix", "resolve parity failures"
**Eval sketch:** Given a known parity failure output, verify the skill categorizes it (route/data/UI/API), identifies the exact file pair, and suggests a concrete fix.
**Stub generated:** `MyLife/.claude/skills/parity-remediation/SKILL.md`

---

### 3. function-gate-runner -- Score: 4.05/5.0

| Factor | Score | Justification |
|--------|-------|---------------|
| Impact | 4/5 | Automates mandatory pre-merge check (CLAUDE.md line 87) |
| Frequency | 5/5 | Per function-logic change -- the most frequently triggered gate |
| Complexity | 3/5 | 3 parallel checks (lint + typecheck + test) with package detection |
| Testability | 4/5 | Pass/fail per gate; verifiable output |
| Gap | 4/5 | Gate scripts exist but require manual invocation with correct args |
| **Weighted Total** | **4.05/5.0** | |

**Dimension:** Repetitive Workflows (1) + Code Quality Gates (5)
**Evidence:**
- `scripts/perf-audit/run-function-quality-gate.mjs` (10.5KB)
- `scripts/perf-audit/run-changed-function-quality-gate.mjs` (6.5KB)
- CLAUDE.md line 87: mandatory before finalizing any function-logic change
- Currently 0% automated as a pre-commit hook
**Proposed triggers:** "run gate", "check my changes", "function gate", "quality check before commit"
**Eval sketch:** After modifying a TypeScript function, verify the skill runs lint + typecheck + test and reports per-function results with file paths.
**Stub generated:** `MyLife/.claude/skills/function-gate-runner/SKILL.md`

---

### 4. submodule-sync -- Score: 3.90/5.0

| Factor | Score | Justification |
|--------|-------|---------------|
| Impact | 4/5 | Prevents stale submodule refs across 12+ standalone apps |
| Frequency | 4/5 | Per standalone release (observed in git log: multiple "update submodule refs" commits) |
| Complexity | 3/5 | Git submodule operations + validation |
| Testability | 4/5 | Verifiable: submodule pointer matches latest commit on main |
| Gap | 5/5 | Currently 0% automated -- manual git submodule update |
| **Weighted Total** | **3.90/5.0** | |

**Dimension:** Repetitive Workflows (1)
**Evidence:**
- Git log: commits 3ed69f9, 81cd49f, 1f72579, 277b728, cfe7afa all update submodule refs manually
- 12+ submodules: MyBooks, MyBudget, MyFast, MyRecipes, MyCar, MyHabits, MyHomes, MySurf, MyWorkouts, MyWords, MyRSVP, MyVoice
- `.gitmodules` lists all submodule paths and URLs
**Proposed triggers:** "sync submodules", "update submodule pointers", "check for submodule drift"
**Eval sketch:** Given a submodule with a newer commit than the parent pointer, verify the skill detects drift, updates the pointer, and validates the update.
**Stub generated:** `MyLife/.claude/skills/submodule-sync/SKILL.md`

---

### 5. route-parity-validator -- Score: 3.80/5.0

| Factor | Score | Justification |
|--------|-------|---------------|
| Impact | 4/5 | Catches silent bugs where mobile and web routes diverge |
| Frequency | 3/5 | Per route change in any module |
| Complexity | 3/5 | Parse route files, compare structures, report diff |
| Testability | 5/5 | Route names either match or don't -- deterministic |
| Gap | 5/5 | No existing validation that mobile and web route structures match |
| **Weighted Total** | **3.80/5.0** | |

**Dimension:** Cross-Project Patterns (7)
**Evidence:**
- `apps/mobile/app/_layout.tsx` dynamically injects module routes via ModuleRegistry
- `apps/web/app/` uses mixed passthrough/custom pattern per module
- No test validates that mobile tab names match web sidebar names
- Passthrough modules (books, habits, words, workouts) use alias imports from standalone
**Proposed triggers:** "validate routes", "check route parity", "do mobile and web routes match"
**Eval sketch:** Verify the skill extracts route names from both mobile and web for a module, diffs them, and reports mismatches.
**Stub generated:** `MyLife/.claude/skills/route-parity-validator/SKILL.md`

---

### 6. module-claude-md-generator -- Score: 3.40/5.0

| Factor | Score | Justification |
|--------|-------|---------------|
| Impact | 4/5 | 14 modules + 13 packages currently lack documentation |
| Frequency | 2/5 | Per new module creation |
| Complexity | 3/5 | Read module source, extract contract, generate standardized doc |
| Testability | 4/5 | Verify required sections exist, exports match reality |
| Gap | 5/5 | No module-level CLAUDE.md files exist anywhere |
| **Weighted Total** | **3.40/5.0** | |

**Dimension:** Cross-Project Patterns (7) + Code Quality Gates (5)
**Evidence:**
- 14 modules in `modules/` -- zero have CLAUDE.md
- 13 packages in `packages/` -- zero have CLAUDE.md
- Hub CLAUDE.md is Tier 3 quality; modules are Tier 0
- Understanding a module requires reading index.ts, package.json, and test files manually
**Proposed triggers:** "generate module docs", "add CLAUDE.md to modules", "document module contracts"
**Eval sketch:** Given a module path, verify the generated CLAUDE.md contains Overview, Exports, Storage Type, Migration Pattern, Test Coverage, and Parity Status sections.
**Stub generated:** `MyLife/.claude/skills/module-claude-md-generator/SKILL.md`

---

### Below Threshold (Not Stubbed)

#### 7. mcp-workflow-templates -- Score: 3.40/5.0
MCP servers are configured but under-utilized. Opportunity to create workflow skills for macos-hub (task capture), Context7 (doc lookup), and Playwright (E2E testing). Deferred because MCP usage patterns are not yet established in MyLife.

#### 8. module-readiness-matrix -- Score: 3.10/5.0
Generate a readiness report for all 20+ modules: code completeness, hub integration, sync strategy, parity status. Deferred because this is a planning tool, not a development accelerator.

## Cross-Cutting Observations

1. **Test coverage is bimodal**: MyBudget, MyRecipes, and MyCar have excellent coverage (90%+), while MyBooks, MyHabits, and MyWorkouts have critical gaps (0-20% on core engines). Skills should target the uncovered modules first.

2. **Parity is the dominant workflow**: 4 of 6 top opportunities involve parity enforcement. MyLife's defining technical challenge is keeping 12+ standalone apps synchronized with their hub module counterparts. Skills that automate parity validation and remediation have outsized value.

3. **The function quality gate is the most frequently triggered workflow** (per every function-logic change) but is currently manual. Converting this to a skill would eliminate the most common "forgotten step."

4. **MCP capabilities are configured but invisible**: 7 MCP servers and 22 plugins are installed, but no module-level workflows leverage them. This is a future opportunity once core development skills are in place.

## Recommended Build Order

| Order | Skill | Rationale |
|-------|-------|-----------|
| 1 | `domain-engine-benchmarker` | Highest score (4.50); addresses critical safety gaps in health/fitness algorithms |
| 2 | `parity-remediation` | Second highest (4.35); release-blocker workflow that compounds value with every commit |
| 3 | `function-gate-runner` | Most frequently triggered (4.05); eliminates the most common manual step |
| 4 | `submodule-sync` | Currently 0% automated (3.90); prevents a recurring manual git task |
| 5 | `route-parity-validator` | Catches silent bugs (3.80); complements parity-remediation |
| 6 | `module-claude-md-generator` | Scales documentation (3.40); enables faster onboarding for new modules |
