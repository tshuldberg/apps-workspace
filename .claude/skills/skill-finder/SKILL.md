---
name: skill-finder
description: >-
  Deeply investigates a codebase to identify high-impact skill opportunities,
  testable features, and benchmarkable functions. Produces a prioritized report
  with draft SKILL.md stubs and evals.json files ready for skill-creator
  benchmarking. Use when asked to find skill opportunities, audit skills
  coverage, scan for testable areas, identify where skills are needed, or
  prepare skill candidates for evaluation. Do NOT use for general code review
  or architecture analysis (use /research-app or /generate-architecture-diagrams
  instead).
argument-hint: "[project-path-or-name]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(wc:*), Bash(ls:*), Bash(tree:*), Agent, LSP
---

# Skill Finder

You are an expert skill architect for the `/Apps` workspace. Your job is to deeply
investigate a codebase and surface where Claude Code skills would deliver the highest
value -- both as workflow automation AND as testable benchmarks for features and functions.

## Phase 1: Reconnaissance

### 1.1 Determine scope

- If `$ARGUMENTS` names a project (e.g., `receipts`, `MySurf`, `TheMarlinTraders`),
  scope to that project directory only.
- If no argument, analyze the full `/Apps` workspace. Always exclude `SH/shiphawk-dev`.
- Read the target's `CLAUDE.md` to understand stack, architecture, key commands,
  and conventions.

### 1.2 Inventory existing skills

Build a coverage map of what is already served:

```
Glob: **/.claude/skills/**/SKILL.md
Glob: .claude/skills/**/SKILL.md
Read: .claude/skills/SKILLS_REGISTRY.md (if it exists)
```

For each existing skill, note: name, description, quality tier (1-4), and what
domain/workflow it covers. This becomes the "already covered" baseline.

### 1.3 Gather codebase signals

Run these in parallel to build a picture of the codebase:

- `git log --oneline -100` -- recent activity patterns
- `git log --diff-filter=A --name-only --pretty=format: -50` -- recently added files
- Glob for test files (`**/*.test.*`, `**/*.spec.*`, `**/tests/**`)
- Glob for config files (`**/package.json`, `**/tsconfig.json`, `**/.eslintrc*`)
- Glob for scripts (`**/scripts/**`, `**/Makefile`, `**/justfile`)
- Read `timeline.md` or `PROJECT_LOG.md` for recent development patterns

## Phase 2: Deep Analysis

Run all 7 analysis dimensions. For each, collect **concrete evidence**: file paths,
line numbers, code patterns, and frequency counts. Avoid vague observations.

Read `references/analysis-dimensions.md` for detailed detection methods per dimension.

**Summary of dimensions:**

| # | Dimension | What to find |
|---|-----------|-------------|
| 1 | Repetitive Workflows | Multi-step patterns developers perform manually |
| 2 | Complex Processes | 5+ step sequences with branching or error-prone logic |
| 3 | Domain Expertise | Specialized knowledge encoded in engines/calculators/algorithms |
| 4 | Testable Functions | Pure functions, parsers, importers with clear I/O contracts |
| 5 | Code Quality Gates | Linting, type safety, error handling, security patterns |
| 6 | MCP Integrations | Tool combinations and workflow layers on MCP servers |
| 7 | Cross-Project Patterns | Patterns spanning multiple projects that need standardization |

For workspace-wide scans, use the Agent tool with `subagent_type: Explore` to
parallelize analysis across projects. Assign each agent 2-3 projects max.

## Phase 3: Scoring

Score each opportunity using the weighted rubric in `references/scoring-rubric.md`.

| Factor | Weight | Question |
|--------|--------|----------|
| Impact | 30% | How much time/effort saved or quality added? |
| Frequency | 25% | How often would this skill trigger? |
| Complexity | 20% | Complex enough to justify a skill? (too simple = skip) |
| Testability | 15% | Can we write concrete, verifiable eval assertions? |
| Gap | 10% | Is this area currently unserved by existing skills? |

Score each factor 1-5. Compute weighted total. Discard opportunities scoring below 2.5.
Rank the rest by total score descending.

## Phase 4: Output Generation

### 4.1 Opportunity report

Write to `docs/reports/REPORT-skill-opportunities-YYYY-MM-DD.md`:

```markdown
# Skill Opportunity Report -- [Scope] -- YYYY-MM-DD

## Executive Summary
[3-5 sentences: total opportunities, top candidates, coverage gaps, recommended priority]

## Existing Coverage
| Skill | Tier | Domain | Status |
[table of existing skills in scope]

## Ranked Opportunities

### 1. [proposed-skill-name] -- Score: X.X/5.0
- **Dimension:** [which analysis dimension(s)]
- **Impact:** [what it accomplishes]
- **Frequency:** [trigger estimate -- daily/weekly/per-session]
- **Evidence:** [file paths, patterns, frequency data]
- **Testability:** [what evals would verify]
- **Stub generated:** `.claude/skills/[name]/SKILL.md`

[repeat for each opportunity, ranked by score]

## Cross-Cutting Observations
[Patterns spanning multiple opportunities]

## Recommended Build Order
[Sequence based on dependencies, impact, and effort]
```

### 4.2 Skill stubs

For the **top 5-8** opportunities, generate draft skills:

**Directory:** `.claude/skills/[skill-name]/`
**Files to create:**
- `SKILL.md` -- Valid frontmatter + skeleton workflow (follow `references/skill-stub-template.md`)
- `evals/evals.json` -- 2-3 test cases (follow `references/eval-template.json`)

Stub requirements:
- YAML frontmatter: `name` (kebab-case), `description` (with trigger AND anti-trigger
  patterns), `allowed-tools` (minimal set)
- `description` must be "pushy" enough to activate but include anti-triggers to
  prevent false positives
- Core workflow steps (abbreviated but structurally complete)
- At least one worked example
- Output format specification

### 4.3 Eval files

Each `evals/evals.json` must have:
- 2-3 realistic prompts a real user would say
- `expected_output` describing what success looks like
- `expectations` with named, objectively verifiable assertions

Read `references/eval-template.json` for the exact schema.

Assertion quality rules:
- **Verifiable:** "Output contains a table with columns X, Y, Z" not "Output is good"
- **Specific:** Reference exact characteristics, patterns, or structures
- **Named:** Each assertion name explains what it tests (`has-budget-breakdown`, `uses-mantine-components`)

### 4.4 Update registry

If `.claude/skills/SKILLS_REGISTRY.md` exists, add entries for all generated stubs
with `[DRAFT]` status. Include the skill name, description, and a note that it was
generated by skill-finder and needs refinement via `/skill-creator`.

## Phase 5: Validation

Before presenting results, verify:

- [ ] Every opportunity cites concrete evidence (file paths, git history, patterns)
- [ ] Scores use all 5 rubric factors with brief justification
- [ ] No duplicate coverage with existing skills
- [ ] Stubs have valid YAML frontmatter (kebab-case name, <1024 char description)
- [ ] Eval prompts sound like real user requests (natural language, not robotic)
- [ ] Eval assertions are objectively verifiable (no subjective judgments)
- [ ] Report follows `REPORT-skill-opportunities-YYYY-MM-DD.md` naming
- [ ] Output respects the target project's CLAUDE.md conventions

## Skill-Creator Handoff

After generating stubs, tell the user:

> The following skill stubs are ready for benchmarking. Run `/skill-creator` in
> **eval mode** on each stub to validate trigger rates and functional correctness.
> Then use **improve mode** to refine descriptions and **benchmark mode** to track
> performance across iterations.

Provide the exact commands:
```
/skill-creator eval .claude/skills/[name]
/skill-creator improve .claude/skills/[name]
/skill-creator benchmark .claude/skills/[name]
```

## Workspace Context

### Project Stack Map

| Project | Key Patterns to Scan |
|---------|---------------------|
| TheMarlinTraders | Trading algorithms, indicator calculations, chart configs, tRPC routers |
| MySurf | Swell rating algorithm, geo queries, Supabase RLS, NOAA data pipeline |
| MyBudget | Budget engine, subscription engine, envelope math, CSV import |
| MyBooks | Reading stats, OL API client, Goodreads/StoryGraph import, FTS5 |
| receipts | DRF serializer patterns, cache invalidation, Mantine components |
| EasyStreet | SweepingRuleEngine, HolidayCalculator, geo segment queries |
| macos-hub | AppleScript bridges, MCP tool patterns, config-driven watchers |
| tron-castle-fight | UNIT_DEFS/BUILDING_DEFS balance, game state management |
| fed-memes | Content pipeline, Meilisearch config, FFmpeg transcoding |
| automation-hub | Adapter pattern, job runners, approval gates, channel routing |
| system-monitor | Collector parsers, alert evaluator, threshold state machine |

### Tier Priority

Tier 1 projects (minimum CLAUDE.md) have the largest skill gaps. Prioritize them.
Tier 3 projects (mature) likely need specialized, high-tier skills rather than basics.

### Integration Points

- `/dispatch` can orchestrate building multiple skills from this report's output
- `/generate-architecture-diagrams` provides architecture context for domain skills
- `/research-app` provides deep codebase analysis that complements this skill's scan
- Marketing skills (25 installed) cover CRO/content/SEO -- do not duplicate
