# Analysis Dimensions -- Detailed Detection Methods

## Dimension 1: Repetitive Workflows

**Goal:** Find multi-step patterns developers perform manually and repeatedly.

### Detection methods

1. **Git history pattern mining**
   ```bash
   git log --oneline -200 | grep -iE '(fix|update|add|remove|refactor|migrate)'
   ```
   Look for repeated commit message patterns -- they reveal recurring tasks.

2. **Script analysis**
   Glob for `scripts/**`, `Makefile`, `justfile`, `package.json` scripts section.
   Each script encodes a manual workflow. Look for scripts with 10+ lines or
   scripts that chain 3+ commands.

3. **Documentation-embedded workflows**
   Search CLAUDE.md, README.md, and `docs/` for numbered step lists (1. 2. 3.).
   These are explicit manual processes waiting to be automated.

4. **Common patterns to look for:**
   - Release/deploy sequences (tag, build, push, deploy)
   - Database migration + seed + test cycles
   - Branch creation + PR + review + merge workflows
   - Dependency update + test + commit sequences
   - Environment setup/teardown procedures
   - File scaffolding (new component, new route, new test)

### Evidence to collect
- File paths of scripts/docs describing the workflow
- Frequency: how often does git history show this pattern?
- Step count: how many manual steps are involved?
- Error-proneness: are there comments/docs about common mistakes?

---

## Dimension 2: Complex Multi-Step Processes

**Goal:** Find processes with 5+ steps, branching logic, or error-prone sequences.

### Detection methods

1. **Long function analysis**
   Use LSP `documentSymbol` on key files. Functions with 50+ lines often encode
   complex processes that could benefit from skill-guided execution.

2. **Conditional chains**
   ```
   Grep: if.*else|switch.*case|\.then\(|\.catch\(
   ```
   High density of conditionals suggests branching logic that needs guidance.

3. **Error handling density**
   ```
   Grep: try\s*\{|\.catch\(|on_error|rescue|except
   ```
   Files with many error handlers encode complex, failure-prone processes.

4. **CI/CD configs**
   Read `.github/workflows/*.yml`, `Dockerfile`, `docker-compose*.yml`.
   Multi-stage builds and deployment configs reveal complex processes.

5. **Common patterns:**
   - Data import pipelines (parse, validate, transform, store, index)
   - API integration sequences (auth, request, retry, transform, cache)
   - Test orchestration (setup, seed, run, collect, report)
   - Migration workflows (backup, migrate, validate, rollback-plan)

### Evidence to collect
- Process step count and branching factor
- Files involved in the process
- Error modes documented or observable
- Current documentation quality (well-documented = easier to skill-ify)

---

## Dimension 3: Domain Expertise Areas

**Goal:** Find areas where specialized knowledge is encoded in the codebase.

### Detection methods

1. **Engine/calculator/algorithm modules**
   ```
   Grep: engine|calculator|algorithm|compute|evaluate|score|rank|forecast|predict
   ```
   These are the highest-value skill targets -- domain logic that needs expertise
   to modify correctly.

2. **Constants and configuration files**
   Look for files with extensive domain constants: `UNIT_DEFS`, `GAME` config,
   `HOLIDAY_LIST`, subscription catalogs, fee schedules, rating scales.
   Each constant file encodes domain knowledge.

3. **Business rule modules**
   ```
   Grep: rule|policy|constraint|validation|eligibility|threshold
   ```
   Business rules are prime skill material because they require domain context
   to modify safely.

4. **Mathematical or scientific computations**
   ```
   Grep: Math\.|sin\(|cos\(|sqrt|formula|interpolat|regression|median|percentile
   ```

5. **Workspace-specific expertise areas:**

   | Project | Domain Modules |
   |---------|---------------|
   | TheMarlinTraders | `indicators/`, `options/`, strategy engine |
   | MySurf | Rating algorithm, swell calculations, buoy data processing |
   | MyBudget | Budget engine, subscription engine, renewal calculator |
   | MyBooks | Stats engine, year-review aggregation, reading pace calculator |
   | receipts | Verification logic, vote tallying, evidence scoring |
   | EasyStreet | SweepingRuleEngine, HolidayCalculator (11 SF holidays) |
   | tron-castle-fight | UNIT_DEFS balance, BUILDING_DEFS, POWERUPS tuning |
   | fed-memes | Content pipeline, trending algorithm, moderation rules |
   | system-monitor | AlertEvaluator, pressure levels, cooldown state machine |

### Evidence to collect
- Module path and exported functions
- Complexity (lines of code, cyclomatic complexity estimate)
- Test coverage (existing tests vs gaps)
- Domain documentation (comments, docs, external references)

---

## Dimension 4: Testable Feature Functions

**Goal:** Find concrete functions that could be benchmarked with skill-driven evals.

### Detection methods

1. **Pure functions with clear I/O**
   Use LSP to scan exports. Look for functions that:
   - Take typed inputs and return typed outputs
   - Have no side effects (or isolated side effects)
   - Are deterministic (same input = same output)

2. **Existing test files**
   Glob for `**/*.test.*`, `**/*.spec.*`, `**/tests/**`.
   What's already tested reveals what's considered important.
   What's NOT tested reveals gaps that evals could fill.

3. **Parser and transformer modules**
   ```
   Grep: parse|transform|convert|format|serialize|deserialize|import|export
   ```
   Parsers have well-defined inputs and outputs -- ideal for eval assertions.

4. **API endpoint handlers**
   ```
   Grep: router\.|app\.(get|post|put|delete|patch)|@api_view|def (get|post|list|create)
   ```
   Each endpoint is a testable unit with expected request/response contracts.

5. **Zod schemas and type definitions**
   ```
   Grep: z\.(object|string|number|array|enum)|interface\s+\w+|type\s+\w+\s*=
   ```
   Schemas define the contract -- perfect for generating eval assertions.

### Evidence to collect
- Function signature (name, params, return type)
- Input/output examples (from tests or documentation)
- Current test coverage percentage
- Assertion opportunities (what properties can be verified?)

---

## Dimension 5: Code Quality Gates

**Goal:** Find areas where consistent quality enforcement via skills would prevent regressions.

### Detection methods

1. **Linting and formatting configs**
   Read `.eslintrc*`, `.prettierrc*`, `biome.json`, `.rubocop.yml`, `pyproject.toml`.
   Complex lint rules suggest quality patterns worth encoding.

2. **Type strictness gaps**
   Check `tsconfig.json` for `strict: true` vs false. Projects without strict mode
   have more room for type safety skills.

3. **Security patterns**
   ```
   Grep: sanitize|escape|validate|auth|permission|role|csrf|xss|injection
   ```
   Security-critical code benefits from skill-driven review gates.

4. **Error handling patterns**
   Compare error handling consistency across a project. Inconsistent patterns
   (some functions throw, others return null, others log-and-continue) indicate
   a need for standardization via skills.

5. **Dependency health**
   Check `package.json` or `requirements.txt` for outdated dependencies.
   A dependency-update skill with safety checks could be valuable.

### Evidence to collect
- Current quality tooling in place
- Gaps in coverage (no linting, no type checking, no security scanning)
- Inconsistency patterns (different error handling styles across files)
- Project CLAUDE.md quality tier (Tier 1 = most gaps)

---

## Dimension 6: MCP Integrations

**Goal:** Find opportunities to layer workflow skills on MCP tool access.

### Detection methods

1. **macos-hub tool usage**
   ```
   Grep: mcp__macos-hub|list_reminders|create_reminder|list_events|send_email|list_messages
   ```
   Look for places where multiple MCP tools are used in sequence.

2. **Context7 usage patterns**
   ```
   Grep: resolve-library-id|query-docs|context7
   ```
   Repetitive documentation lookups suggest a skill that pre-loads the right docs.

3. **Playwright automation**
   ```
   Grep: browser_navigate|browser_click|browser_snapshot|playwright
   ```
   Browser automation sequences are prime skill material.

4. **Tool combination patterns**
   The real value is in COMBINATIONS of tools. Look for:
   - Calendar + Reminders + Mail (scheduling workflows)
   - Read + Grep + LSP (code investigation workflows)
   - Bash + Write + Edit (scaffolding workflows)

5. **Under-utilized MCP servers**
   Compare installed MCP servers (from settings) against actual usage.
   Under-utilized servers suggest a need for workflow skills.

### Evidence to collect
- MCP tools currently in use and frequency
- Tool sequences that appear together
- Under-utilized tools with high potential
- Existing MCP-related skills and their coverage

---

## Dimension 7: Cross-Project Patterns

**Goal:** Find patterns that span multiple projects and need standardized skills.

### Detection methods

1. **CLAUDE.md comparison**
   Read CLAUDE.md files across projects. Look for:
   - Common sections that could be standardized
   - Inconsistent conventions that need alignment
   - Shared patterns described differently

2. **Timeline/changelog patterns**
   Compare `timeline.md` and `PROJECT_LOG.md` formats.
   Inconsistent tracking suggests a standardization skill.

3. **Shared dependency patterns**
   Multiple projects using the same stack (Expo, Next.js, Zod, Vitest)
   benefit from shared configuration skills.

4. **Cross-project business logic**
   EasyStreet native + easystreet-monorepo share sweeping logic.
   MyBudget + MyBooks share SQLite patterns.
   Shared logic needs synchronized update skills.

5. **Documentation patterns**
   - Architecture diagram generation
   - API documentation
   - Test coverage reporting
   - Dependency auditing

### Evidence to collect
- Which projects share the pattern
- Current consistency level across projects
- Effort to standardize vs maintain divergence
- Whether a workspace-level skill or project-specific skill is better
