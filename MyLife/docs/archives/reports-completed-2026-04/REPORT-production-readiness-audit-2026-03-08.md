# MyLife Production Readiness Audit

**Date:** 2026-03-08
**Benchmark:** [everything-claude-code](https://github.com/affaan-m/everything-claude-code) best practices
**Method:** 6-agent parallel audit team covering documentation, hooks, security, skills, testing, and context optimization
**Overall Score: 6.3 / 10**

---

## Executive Summary

MyLife has a strong architectural foundation -- a well-structured monorepo, mature module system, thoughtful design system, and advanced testing utilities (fuzz testing, complexity slope assertions, memory budget checks). The project excels at structural enforcement (parity hooks, function quality gates) and documentation (comprehensive CLAUDE.md, 24 spec files, 10 reports).

However, significant gaps exist in **automation enforcement** (no pre-commit hooks, no PostToolUse validation), **security hardening** (Stripe webhook stub, no tool sandboxing deny lists), **context efficiency** (127 MCP tools, duplicate registrations, 22 plugins), and **workflow coverage** (no TDD, no security review, no code review skills). These gaps collectively represent the difference between a well-architected hobby project and a production-ready application.

The good news: most gaps are **configuration and tooling issues**, not architectural problems. The codebase itself is solid. The path to production readiness is primarily about adding enforcement layers, closing security stubs, and pruning context overhead.

---

## Category Scores

| Category | Score | Key Issue |
|----------|-------|-----------|
| Documentation & CLAUDE.md | 6.5/10 | No modular rules files, no package-level docs, memory dir underused |
| Hooks & Automation | 4.0/10 | Only 1 hook exists; missing PreToolUse, PostToolUse, Stop, PreCompact |
| Security Posture | 5.5/10 | Stripe webhook unverified, no deny lists, overprivileged agents |
| Skills & Agent Definitions | 5.5/10 | 6 draft skills unpromoted, no TDD/security/code-review skills |
| Testing & Quality Gates | 6.4/10 | Strong infra but no pre-commit hooks, no coverage reporting, low thresholds |
| Context & Token Optimization | 5.5/10 | 127 tools (limit: 80), duplicate MCPs, 22 plugins, 16 oversized files |
| **Weighted Overall** | **6.3/10** | |

---

## Findings by Severity

### Critical (Must fix before production)

| # | Category | Finding | Recommendation |
|---|----------|---------|----------------|
| C1 | Security | **Stripe webhook signature not verified.** `handleStripeWebhook()` accepts `_signature` (unused param) and parses payload with `JSON.parse()` without HMAC verification. Any attacker can forge purchase fulfillment webhooks. | Implement `stripe.webhooks.constructEvent(payload, signature, webhookSecret)`. This is a blocking production issue. |
| C2 | Hooks | **No PreToolUse hooks.** Zero validation before Bash executes. No protection against agents touching archived submodules, `shiphawk-dev`, or sensitive configs. | Add PreToolUse Bash validation hook to block dangerous/out-of-scope commands. |
| C3 | Hooks | **No PostToolUse hooks for TypeScript validation.** After `.ts`/`.tsx` edits, no automatic `tsc --noEmit` check. Type errors can accumulate silently across a session. | Add PostToolUse hook running targeted typecheck on edited packages. |
| C4 | Context | **127 MCP tools exceeds 80-tool threshold.** Figma registered 3 times (36 redundant tool slots), Context7 registered twice. Degrades context window efficiency. | Remove duplicate Figma registrations (keep 1), remove duplicate Context7 (keep 1). Target under 90 tools. |
| C5 | Context | **settings.local.json is a 40KB junk drawer.** 242 historical allow-list rules, many single-use. Loaded every session. | Prune to under 80 reusable rules. Remove single-use git commit strings and node scripts. |
| C6 | Skills | **`migrate-module` (active skill) has zero evals.** Most complex skill (13 steps), no automated correctness verification. Regressions would be invisible. | Add 3+ eval cases covering simple migration, schema conflicts, and route wiring. |
| C7 | Testing | **No pre-commit or pre-push git hooks.** `.git/hooks/` contains only `.sample` files. Code can be committed with failing tests/lint despite the function gate existing. | Install husky: `pnpm add -D husky && npx husky init`. Wire `pnpm gate:function:changed` into `.husky/pre-commit`. |

### High (Fix within current sprint)

| # | Category | Finding | Recommendation |
|---|----------|---------|----------------|
| H1 | Security | **No tool sandboxing deny lists in project settings.json.** No `permissions.deny` section. Agents have unrestricted Bash access. | Add deny rules for `rm -rf`, `curl|bash`, `git push --force`, credential file reads. |
| H2 | Security | **MySurf `.env` files not protected at submodule level.** Root `.gitignore` covers root only, not submodule git history. Real keys could leak via submodule commits. | Audit MySurf git history: `git -C MySurf log --all -- .env .env.local`. Add `.gitignore` to submodule. |
| H3 | Security | **API error responses leak env var names.** MySurf returns `"ANTHROPIC_API_KEY not configured"` in API errors, confirming secret management details. | Replace with generic "Service temporarily unavailable" in production. |
| H4 | Security | **`module-dev` and `hub-shell-dev` agents have unrestricted Bash.** These agents list `Bash` with no command restrictions, giving full shell access. | Scope to `Bash(pnpm:*)`, `Bash(git:*)`, `Bash(tsc:*)`. |
| H5 | Hooks | **No Stop hook for session persistence.** No automatic memory write at session end. Long consolidation sessions lose all context. | Add Stop hook writing git diff summary to memory directory. |
| H6 | Hooks | **No PreCompact hook.** Long sessions compact without state preservation. Active plan state, current phase, pending parity notes all lost. | Add PreCompact hook logging active plans and git status. |
| H7 | Hooks | **No console.log / debug detection hook.** Privacy-first app with SQLite data has no PostToolUse hook to catch debug leakage after code edits. | Add PostToolUse pattern detection for `console.log`, `debugger`, hardcoded credentials. |
| H8 | Docs | **No `.claude/rules/` directory.** All rules embedded in monolithic CLAUDE.md. No modular rule files for security, coding style, testing, agents, performance. | Create `.claude/rules/` with 4-6 concern-specific `.md` files. Extract from CLAUDE.md. |
| H9 | Docs | **No CLAUDE.md for any of 12 packages.** `packages/auth/`, `packages/db/`, `packages/module-registry/`, `packages/ui/`, etc. are undocumented. auth and db are security-critical. | Generate CLAUDE.md for at least `auth`, `db`, `module-registry`, `ui`, `subscription`. |
| H10 | Skills | **5 of 7 agents missing `model:` field.** Implementation agents default to session model (Opus) when Sonnet would suffice for routine work. ~60-70% cost savings missed. | Add `model: claude-sonnet-4-6` to `module-dev`, `hub-shell-dev`, `plan-executor`, `test-writer`, `docs-agent`. |
| H11 | Skills | **No TDD skill.** No test-first workflow, no red-green-refactor cycle enforcement. Tests are written after code, not before. | Create `/tdd` skill driving test-first development with gate verification. |
| H12 | Skills | **No security review skill.** No systematic OWASP/credential/injection audit workflow. The codebase handles auth, billing (Stripe/RevenueCat), and SQLite. | Create `/security-review` skill targeting the MyLife stack specifically. |
| H13 | Testing | **No coverage upload or reporting in CI.** Coverage regressions are invisible across PRs. No Codecov/Coveralls integration, no trend tracking, no badge. | Add `codecov/codecov-action@v4` to CI coverage job. |
| H14 | Testing | **Coverage CI job doesn't gate merges.** Runs in parallel with other jobs but isn't required for PR merge. Threshold breaches don't block. | Add `merge-gate` job that `needs: [parity, lint, typecheck, test, coverage]`. |
| H15 | Testing | **Scaffolded modules nearly untested.** `subs` has 0 tests. `closet`, `cycle`, `flash`, `journal`, `mail`, `stars`, `trails`, `voice` have only 1-2 each. | Add at minimum CRUD lifecycle tests for each wired module. |
| H16 | Testing | **`pets`, `auth`, `migration` have no coverage thresholds.** No coverage config in their vitest configs. | Add `thresholds: { lines: 70, functions: 65, branches: 50 }` to each. |
| H17 | Context | **22 project-level plugins is excessive.** 6 are redundant or unused: `github` (gh CLI exists), `playground`, `swift-lsp` (future phase), `figma` (third registration), `slack` (MCP exists), `playwright` (MCP exists). | Disable 6 redundant plugins. Saves ~15-20KB system prompt overhead per session. |
| H18 | Context | **16 source files over 800 lines.** `hub-queries.ts` is 1,545 lines. 5 CRUD files exceed 1,000 lines each. Consumes 10-15% context per read. | Split `hub-queries.ts` by module domain. Split CRUD files by table group. |

### Medium (Address next sprint)

| # | Category | Finding | Recommendation |
|---|----------|---------|----------------|
| M1 | Security | **No dependency vulnerability audit script.** No `pnpm audit` in scripts or CI. 13,000+ lockfile lines, zero scanning. | Add `"audit:deps": "pnpm audit --audit-level=high"` and CI step. |
| M2 | Security | **21 plugins maximizes blast radius.** Web browsing, Slack, GitHub, screenshots all accessible. Goal hijacking or prompt injection has maximum reach. | Disable non-development plugins when not needed. |
| M3 | Security | **RevenueCat keys in `EXPO_PUBLIC_*` variables.** Bundled into app binary. Confirm these are public API keys only, not service keys. | Document which env vars are safe to embed vs. server-only in CLAUDE.md. |
| M4 | Docs | **Memory directory has only 2 files.** No `MEMORY.md` index, no topic organization. Session knowledge is not persisted. | Create `MEMORY.md` as primary index. Add topic files: `module-status.md`, `active-blockers.md`, `architecture-decisions.md`. |
| M5 | Docs | **6 modules missing CLAUDE.md.** `cycle`, `mail`, `nutrition`, `stars`, `subs`, `trails`, `voice` have no documentation. | Run `/module-claude-md-generator` skill (promote from draft first). |
| M6 | Docs | **Workspace `/Apps/CLAUDE.md` is 620 lines.** Loaded in every MyLife session. Contains ShipHawk, tron-castle-fight, and marketing sections irrelevant to MyLife. | Extract non-MyLife sections. Target under 300 lines for the workspace file. |
| M7 | Skills | **6 draft skills never promoted.** `parity-remediation`, `function-gate-runner`, `submodule-sync`, `route-parity-validator`, `module-claude-md-generator`, `domain-engine-benchmarker` -- all marked draft since 2026-03-05. | Promote 3 most-used (function-gate-runner, module-claude-md-generator, parity-remediation) with evals. Deprecate or backlog the rest. |
| M8 | Skills | **No code review skill.** `reviewer` agent exists but no user-invocable `/code-review` workflow with structured checklists. | Create `/code-review` skill wrapping reviewer agent. |
| M9 | Skills | **No E2E testing skill.** Playwright plugin enabled, 5 spec files exist, but no skill driving E2E authoring workflow. | Create `/e2e` skill for guided Playwright test creation. |
| M10 | Skills | **Skills registry inconsistently maintained.** MyLife SKILLS_REGISTRY.md doesn't track 25 marketing skills or 8 workspace skills. `skills-available.md` stale since 2026-02-24. | Consolidate registries. Update `skills-available.md`. |
| M11 | Testing | **TaskCompleted hook swallows stderr.** `2>/dev/null` hides parity failure diagnostics. Agents see "Parity check failed" with no detail. | Pipe stderr to output or write to temp file. |
| M12 | Testing | **Playwright config: `retries: 0`, `workers: 1`.** Single flaky test fails entire build. No parallelism. | Set `retries: 2` in CI, `fullyParallel: true`, `workers: 2`. |
| M13 | Testing | **Only 1 integration test file exists.** Budget has one; books, workouts, surf, recipes have none despite being feature-rich. | Add lifecycle integration tests for top 4 modules. |
| M14 | Testing | **Mobile app has zero E2E tests.** Playwright covers web only. No Detox, Maestro, or equivalent for Expo. | Evaluate Maestro for mobile E2E. Start with hub navigation flow. |
| M15 | Context | **Gmail + Google Calendar MCPs (17 tools) are personal, not development tools.** Inherited from user config, add overhead in dev sessions. | Scope to user-level only, exclude from MyLife project sessions. |
| M16 | Context | **No architecture codemap file.** 1,751 source files, agents must re-explore structure each session. | Create `.claude/docs/architecture-codemap.md` with file tree and key file annotations. |
| M17 | Context | **No model routing for heavy agents.** `module-dev` and `hub-shell-dev` default to Opus. Routine migration work would be fine on Sonnet. | Add `model: sonnet` to reduce cost per migration task by 60-70%. |
| M18 | Hooks | **TaskCompleted hook only checks parity.** Type errors pass if parity passes. Should also typecheck changed packages. | Extend hook to run `pnpm typecheck` on changed `.ts`/`.tsx` files. |

### Low (Backlog)

| # | Category | Finding | Recommendation |
|---|----------|---------|----------------|
| L1 | Security | **No secret scanning pre-commit hook.** No git-secrets, detect-secrets, or truffleHog. | Add `@secretlint/secretlint` as pre-commit step. |
| L2 | Security | **Bundle sanitization tests lack edge cases.** No tests for `%2F`, `%00`, unicode normalization variants. | Add 3-4 edge case assertions to bundle sanitization tests. |
| L3 | Docs | **Archive status table slightly stale.** MySurf shows "archival pending" but consolidation is complete. | Update both CLAUDE.md and AGENTS.md. |
| L4 | Docs | **`skills-available.md` stale (2026-02-24).** 6 new draft skills from 2026-03-05 session not reflected. | Re-run verification and update. |
| L5 | Skills | **No refactoring skill.** No guided extract-function, rename-module, split-file workflow. | Create `/refactor` skill with scope guardrails. |
| L6 | Skills | **Workspace skills missing "When to Use" sections.** `research-app`, `onboard-new-app`, `generate-architecture-diagrams` lack scannable summary blocks. | Add "When to Use / How It Works / Examples" headers. |
| L7 | Testing | **Coverage thresholds below 80% for most modules.** Workouts 60%, surf 60%, budget 69%. | Raise floor thresholds by 10% per sprint as tests are added. |
| L8 | Testing | **No mutation testing.** No Stryker or equivalent to verify test quality beyond coverage. | Evaluate Stryker for TypeScript. Start with `module-registry` (highest threshold). |
| L9 | Testing | **No scheduled CI test run.** Tests only run on push/PR. | Add weekly cron job in CI for full suite + coverage. |
| L10 | Context | **Zapier MCP (1 tool) unclear value.** Single tool, may not be used. | Audit usage. Remove if unused. |
| L11 | Context | **No auto-compact configuration.** Long sessions rely on system auto-compression. | Document compaction strategy. Add guidance for agents to compact at phase boundaries. |

---

## Prioritized Improvement Roadmap

### Phase 1: Security Hardening (Week 1)
1. Implement Stripe webhook signature verification (C1)
2. Add `permissions.deny` section to project settings.json (H1)
3. Audit MySurf submodule git history for leaked keys (H2)
4. Scope `module-dev` and `hub-shell-dev` Bash permissions (H4)
5. Replace env var names in API error responses (H3)
6. Add `pnpm audit` to CI pipeline (M1)

### Phase 2: Automation & Hooks (Week 1-2)
1. Add PreToolUse Bash validation hook (C2)
2. Add PostToolUse TypeScript validation hook (C3)
3. Add PostToolUse console.log/credential detection (H7)
4. Add Stop hook for session persistence (H5)
5. Add PreCompact hook for state preservation (H6)
6. Install husky with pre-commit gate (C7)
7. Extend TaskCompleted hook with typecheck (M18)

### Phase 3: Context Optimization (Week 2)
1. Remove duplicate Figma registrations (C4) -- saves 24 tool slots
2. Remove duplicate Context7 registration (C4) -- saves 2 tool slots
3. Prune settings.local.json (C5) -- saves ~30KB per session
4. Disable 6 redundant plugins (H17) -- saves ~15-20KB per session
5. Split hub-queries.ts (H18) -- saves ~25KB per single-file read
6. Trim workspace CLAUDE.md to 300 lines (M6) -- saves ~18KB per session

### Phase 4: Skills & Workflows (Week 2-3)
1. Add evals to `migrate-module` skill (C6)
2. Create `/tdd` skill (H11)
3. Create `/security-review` skill (H12)
4. Add `model:` field to 5 agents (H10)
5. Promote 3 draft skills with evals (M7)
6. Create `/code-review` skill (M8)

### Phase 5: Testing Infrastructure (Week 3-4)
1. Add Codecov integration to CI (H13)
2. Make coverage job gate merges (H14)
3. Add coverage thresholds to pets/auth/migration (H16)
4. Add integration tests for books, workouts, surf, recipes (M13)
5. Add CRUD lifecycle tests for scaffolded modules (H15)
6. Configure Playwright retries and parallelism (M12)

### Phase 6: Documentation Completeness (Week 4)
1. Create `.claude/rules/` with modular rule files (H8)
2. Generate CLAUDE.md for 5 critical packages (H9)
3. Generate CLAUDE.md for 6-7 undocumented modules (M5)
4. Create MEMORY.md index with topic files (M4)
5. Create architecture codemap (M16)
6. Update archive status, registries, and verification dates (L3, L4)

---

## Positive Findings (What's Already Strong)

The audit uncovered significant strengths that should be preserved and built upon:

- **Parameterized SQL everywhere** -- no injection vectors in module CRUD layers
- **Network guard in tests** -- outbound fetch blocked, forcing explicit mocking
- **Parity enforcement via hook** -- structural quality gate, not just documentation
- **Advanced test utilities** -- `assertComplexitySlope`, `assertMemoryBudget`, `runDeterministicFuzz` are production-grade
- **Module system design** -- clean `ModuleDefinition` contract, table prefixes, enable/disable lifecycle
- **File ownership zones** -- well-defined boundaries for parallel agent work
- **No hardcoded secrets found** -- all credential references use `process.env.*` or `Deno.env.get()`
- **Idempotent billing webhooks** -- replay protection on billing routes
- **Smart CI path filtering** -- E2E only runs when relevant paths change
- **Reproducible test seeds** -- `VITEST_SEED` from `github.run_id`
- **Design system tokens** -- consistent Cool Obsidian theme with documented values

---

## Methodology

Six specialized agents ran in parallel, each with a focused audit scope:

| Agent | Scope | Files Examined |
|-------|-------|---------------|
| docs-auditor | CLAUDE.md quality, rules, memory, docs structure | 40+ files across CLAUDE.md, AGENTS.md, .claude/, modules/*/CLAUDE.md, docs/ |
| hooks-auditor | Hook lifecycle, automation, CI/CD, settings | settings.json, settings.local.json, CI config, scripts/ |
| security-auditor | Secrets, sandboxing, injection, OWASP, MCP security | Source files, configs, .env files, agent definitions, supabase/ |
| skills-auditor | Skill structure, agent definitions, workflow coverage | .claude/skills/, .claude/agents/, registries |
| testing-auditor | Test infra, coverage, quality gates, E2E, CI pipeline | Test files, vitest configs, CI config, scripts/, playwright config |
| context-auditor | MCP count, plugin count, file sizes, token efficiency | Settings, MCP configs, source file sizes, CLAUDE.md sizes |

All findings were cross-referenced against the [everything-claude-code](https://github.com/affaan-m/everything-claude-code) best practices covering: shortform guide (setup/foundations), longform guide (token optimization/memory/evals), security guide (OWASP agentic top 10), and CLAUDE.md reference configuration.
