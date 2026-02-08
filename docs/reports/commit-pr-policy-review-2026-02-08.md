# Commit, PR & README Policy Review

**Date:** 2026-02-08
**Scope:** Full /Apps workspace — ShipHawk (primary reference), Receipts, EasyStreet (native + monorepo), macOS Hub, tron-castle-fight, shiphawk-templates
**Purpose:** Document existing commit/PR/README conventions across all projects and establish reproducible universal policies

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Review Process & Agent Team](#review-process--agent-team)
3. [Project-by-Project Findings](#project-by-project-findings)
   - [ShipHawk](#shiphawk)
   - [Receipts](#receipts)
   - [EasyStreet Monorepo](#easystreet-monorepo)
   - [EasyStreet Native](#easystreet-native)
   - [macOS Hub](#macos-hub)
   - [tron-castle-fight](#tron-castle-fight)
   - [shiphawk-templates](#shiphawk-templates)
4. [Cross-Project Comparison Matrix](#cross-project-comparison-matrix)
5. [Universal Standards](#universal-standards)
   - [Commit Message Format](#1-commit-message-format)
   - [Branch Naming Convention](#2-branch-naming-convention)
   - [PR/MR Workflow](#3-prmr-workflow)
   - [PR Template](#4-pr-template)
   - [Code Review Standards](#5-code-review-standards)
   - [CI/CD Baseline](#6-cicd-baseline)
   - [Change Tracking](#7-change-tracking)
   - [README Requirements](#8-readme-requirements)
   - [Linting & Formatting](#9-linting--formatting)
   - [Release & Deployment](#10-release--deployment)
6. [Per-Project Compliance Checklist](#per-project-compliance-checklist)
7. [Implementation Recommendations](#implementation-recommendations)
8. [Appendix: ShipHawk Deep Dive](#appendix-shiphawk-deep-dive)

---

## Executive Summary

This review analyzed commit conventions, PR workflows, branch strategies, README structure, CI/CD pipelines, and code review standards across all 7 active projects in `/Apps/`.

**Key Findings:**
- **ShipHawk** has the most mature workflow (GitLab CI with 30 Danger rules, 10 parallel test slices, 4-tier branch promotion, enforced naming via regex)
- **Receipts** has the cleanest reproducible model (Conventional Commits, squash merge, GitHub Actions CI/CD, structured PR template, 8-point review checklist)
- **Commit formats diverge significantly** — ShipHawk uses `[DEV-12345]`, Receipts uses `feat:/fix:`, EasyStreet uses `Category:`, others undocumented
- **Only 2 of 7 projects have CI/CD pipelines** (ShipHawk on GitLab, Receipts on GitHub Actions)
- **No project has CODEOWNERS** or automated reviewer assignment
- **README quality varies** from minimal (macos-hub) to comprehensive (ShipHawk with linked doc suite)
- **Change tracking is universal** — all projects except macos-hub maintain timeline.md or PROJECT_LOG.md

**Recommendation:** Adopt Conventional Commits as the workspace standard, use Receipts' PR model as the baseline template, and require CI/CD for all code projects.

---

## Review Process & Agent Team

### Agent Team Structure

| Agent Role | Scope | Key Files Examined |
|-----------|-------|-------------------|
| **ShipHawk Policy Reviewer** | `/Apps/SH/shiphawk-dev/` | `doc/shiphawk_development_guideline.md`, `.gitlab-ci.yml`, `Dangerfile`, `lib/danger/validate_git_naming.rb`, `.rubocop.yml`, MR templates, `README.md`, `RELEASE_OPS.md` |
| **Cross-Project Reviewer** | All other `/Apps/` projects | CLAUDE.md, README.md, timeline.md, PROJECT_LOG.md, git log history for each project |
| **GitHub/CI Config Reviewer** | All `.github/`, CI configs, linter configs | `.github/workflows/*.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `pyproject.toml`, `turbo.json`, `tsconfig.json`, `.rubocop.yml`, `.prettierrc.json` |

### Methodology
1. **Phase 1:** Three parallel agents explored the codebase simultaneously
2. **Phase 2:** Each agent documented conventions per category (commits, branches, PRs, CI, README, change tracking)
3. **Phase 3:** Findings synthesized into universal standards with per-project compliance checklists

---

## Project-by-Project Findings

### ShipHawk

**Platform:** GitLab (self-hosted at `git.shiphawk.com`)
**Default Branch:** `qa`

#### Branch Strategy (4-Tier Promotion)
```
qa (dev/test) → rc (release candidate) → master (staging) → stable (production)
```

- **qa:** Default branch, deployed to `qa.shiphawk.com`
- **rc:** Release candidate after code cut-off, deployed to `rc.shiphawk.com`
- **master:** Pre-release, deployed to `stage.shiphawk.com`
- **stable:** Production, deployed to `shiphawk.com`

#### Branch Naming
**Format:** `vs-DEV-12345-short-description`
- `vs` = developer initials (2-3 chars)
- `DEV-12345` = Jira ticket number
- Enforced via Danger: regex `^[a-z]{2,3}-dev-[0-9]{4,5}-.+`

#### Commit Messages
**Format:** `[DEV-12345] a short description of what it does`
- Enforced via Danger: regex `^\[DEV-[0-9]{4,5}\]\s.+`
- Special: `[MASTER][DEV-12345] Ticket subject` for rc/master/stable merges
- Rules: Squash "fix rspec" commits, keep review changes separate, isolate refactoring

#### MR Templates
Two templates in `.gitlab/merge_request_templates/`:

**default.md:**
```markdown
## Depend on:
MVP: https://git.shiphawk.com/shiphawk/dashboard-mvp/merge_requests/xxx

## Story:
https://shiphawk.atlassian.net/browse/DEV-xxxx

## Description:
Short description for the reviewer...

## Migrations:
Yes/No

## Video / Screenshots:
Video of how it works...
```

**cherry_pick.md** — For cherry-picks across branches (Story + Cherry-pick refs + Based on refs)

#### MR Requirements
1. Jira ticket in `Code Review` status
2. Pipeline green (all tests pass)
3. MR approved by reviewer
4. Team label added
5. Not in `[DRAFT]` status

#### Code Review Standards
**What blocks an MR (Critical):**
- Breaking changes affecting expected workflow
- Unsafe migrations that could break system/deployment
- Critical architectural/structural issues

**What does NOT block an MR:**
- Variable naming nit-picks
- Formatting preferences
- Approach nit-picks

**Review Focus Areas:**
- Production safety, backward compatibility
- Customer/product communication needs
- Migration safety (reversibility, speed, locks)
- Elasticsearch reindex plans
- Rake task execution plans

#### CI/CD Pipeline (GitLab CI)
**Stages:** test → check → postcheck → build → deploy

| Stage | Jobs | Details |
|-------|------|---------|
| test | 10 parallel RSpec slices + 2 special | `bundle exec rake spec:slice[N,10]`, active_admin_ui, active_shipping |
| check | Danger, RuboCop, migration checker, VCR checker, coverage | 30 automated Danger rules |
| postcheck | Coverage report to GitLab Pages | Only on qa branch |
| build | AWS AMI/Launch templates | Only on git tags |
| deploy | Per-customer deployments | Capistrano + AWS ASG |

**Danger Rules (30 checks):**
- Git naming validation (branch, commit, MR title)
- Database schema validation
- Migration handler tests required
- Migration guide compliance
- No integer column types (use explicit size)
- No model callbacks
- No `touch: true` on associations
- No `.reload`, `.touch`, `OpenStruct` usage
- Tmp flags require ticket references
- LGTM automation

#### README Structure
- Documentation links (dev guideline, decision log, testing, ES, migrations)
- Install and Run (OSX + Ubuntu guides, dashboard, PMS, seed DB)
- **Gaps:** No Contributing section, no Architecture overview, no Tech Stack summary

#### Change Tracking
- No CHANGELOG.md
- Release notes in Jira tickets (written by developer, reviewed in MR)
- `RELEASE_OPS.md` references decision log for heavy DB operations

---

### Receipts

**Platform:** GitHub
**Default Branch:** `main`

#### Branch Strategy
Single protected branch (`main`), feature branches merged via squash merge.

#### Branch Naming
**Format:** `feature/description`, `fix/description`, `refactor/description`, `docs/description`

#### Commit Messages
**Format:** Conventional Commits
```
feat: add user profile page
fix: resolve login redirect loop
refactor: extract validation logic to shared util
docs: update API endpoint documentation
```
- Enforced via CLAUDE.md rules and code review
- Squash merge to `main` ensures clean history

#### PR Template
**File:** `.github/PULL_REQUEST_TEMPLATE.md`
```markdown
## Summary
[what changed and why]

## Test Plan
- [ ] Backend tests: `python manage.py test`
- [ ] Frontend tests: `npm run test:run` from `frontend/`
- [ ] Frontend build: `npm run build` from `frontend/`

## Screenshots
[for UI changes]
```

#### PR Requirements
- Protected `main` branch (no direct pushes)
- Single concern (avoid 200+ file PRs)
- All CI checks passing
- Review approved

#### Code Review Standards (8-Point Checklist)
1. No committed secrets
2. Cache invalidation after mutations
3. N+1 query prevention (select_related/prefetch_related)
4. CSS variables only (no hex hardcoding)
5. Use dayjs (not date-fns)
6. Use shared serializers (UserBriefSerializer from accounts)
7. Correct content-type handling
8. Tests present and passing

**Severity Levels:**
- **Critical:** Must fix before merge
- **Important:** Should fix, may defer with ticket
- **Suggestion:** Optional improvement

**Post-Merge Responsibility:** Author pulls, verifies, updates timeline, creates follow-up tickets

#### CI/CD Pipeline (GitHub Actions)

**ci.yml** (on PR + push to main):
| Job | Environment | Steps |
|-----|------------|-------|
| backend-tests | Ubuntu, Python 3.11, PostgreSQL 15 | poetry install → migrate → `python manage.py test` |
| frontend-tests | Ubuntu, Node 22 | npm ci → `npm run test:run` → `npm run build` |

**deploy.yml** (on CI success or manual dispatch):
- Builds Docker image → pushes to AWS ECR → updates ECS service → waits for stability
- Concurrency: single active deploy (cancel in-progress)
- Production environment protection

#### Linting
- **Python:** Black (line 88), isort (profile: black)
- **JavaScript:** Prettier (no semi, double quotes, tab 2)
- Run locally: `black . && isort .` / `npm run lint`

#### README Structure
- Basic project description
- Setup instructions (backend + frontend)
- **Gaps:** Could be more detailed

#### Change Tracking
- `timeline.md` — Planning-oriented with phases and implementation tracking

---

### EasyStreet Monorepo

**Platform:** GitHub (within /Apps workspace)
**Branch Naming:** `feature/`, `bugfix/`, `refactor/`
**Commit Format:** `Category: Brief description` (e.g., "Feature: Add manual parking pin adjustment")
**PR Workflow:** Not explicitly documented
**CI/CD:** None (uses Bun scripts: `bun run test`, `bun run build`, `bun run lint`)
**Change Tracking:** `timeline.md` with master commit table + session groupings (44 commits tracked)
**README:** Basic intro, features, structure, setup, next steps
**CLAUDE.md Tier:** 2 (Standard)

---

### EasyStreet Native

**Platform:** GitHub (within /Apps workspace)
**Branch Naming:** `feature/`, `bugfix/`, `refactor/`
**Commit Format:** `Category: Brief description`
**PR Workflow:** Not explicitly documented
**CI/CD:** None (Xcode schemes for manual builds)
**Change Tracking:** `timeline.md` identical format to monorepo
**README:** Features, structure, setup, permissions, testing notes, transfer instructions
**CLAUDE.md Tier:** 3 (Mature) — comprehensive agent usage standards, file ownership model

---

### macOS Hub

**Platform:** GitHub (within /Apps workspace)
**Branch Naming:** Not documented
**Commit Format:** Not documented
**PR Workflow:** Not applicable (single-purpose tool)
**CI/CD:** None
**Change Tracking:** None (no timeline.md)
**README:** Prerequisites, setup, verify, tools list, configuration, development commands
**CLAUDE.md Tier:** 1 (Minimum) — Stack, Commands, Architecture only

---

### tron-castle-fight

**Platform:** GitHub (within /Apps workspace)
**Branch Naming:** Not documented
**Commit Format:** Governed via PROJECT_LOG.md entries (not git commit messages)
**PR Workflow:** Not applicable (game project)
**CI/CD:** None
**Change Tracking:** `PROJECT_LOG.md` with structured entries (Timestamp, Title, Request Summary, Why, Actions, Files Changed, Validation, Commit, Next Steps)
**README:** Rules, setup (local + multiplayer), test checklist, governance references
**CLAUDE.md Tier:** 2 (Standard)

---

### shiphawk-templates

**Platform:** GitHub (within /Apps workspace)
**Branch Naming:** Not documented
**Commit Format:** Not documented
**PR Workflow:** Not applicable (template project)
**CI/CD:** None
**Change Tracking:** `timeline.md` with phase-based timeline
**README:** Components, variable reference, layout standard, directory structure, development workflow, governance
**CLAUDE.md Tier:** 2 (Standard)

---

## Cross-Project Comparison Matrix

### Commit & Branch Conventions

| Project | Commit Format | Branch Naming | Enforcement | Merge Strategy |
|---------|--------------|---------------|-------------|----------------|
| **ShipHawk** | `[DEV-12345] description` | `vs-DEV-12345-desc` | Danger regex (CI) | Merge commit |
| **Receipts** | Conventional Commits (`feat:`, `fix:`) | `feature/`, `fix/`, `refactor/`, `docs/` | CLAUDE.md + review | Squash merge |
| **EasyStreet Mono** | `Category: Description` | `feature/`, `bugfix/`, `refactor/` | CLAUDE.md | Not specified |
| **EasyStreet Native** | `Category: Description` | `feature/`, `bugfix/`, `refactor/` | CLAUDE.md | Not specified |
| **macOS Hub** | Undocumented | Undocumented | None | N/A |
| **tron-castle-fight** | PROJECT_LOG entries | Undocumented | Python governance tool | N/A |
| **shiphawk-templates** | Undocumented | Undocumented | None | N/A |

### PR/MR Workflow

| Project | Platform | PR Template | Review Required | CI Gate | Protected Branch |
|---------|----------|-------------|-----------------|---------|-----------------|
| **ShipHawk** | GitLab | Yes (2 templates) | Yes + Jira status | Yes (30 Danger checks) | qa, rc, master, stable |
| **Receipts** | GitHub | Yes | Yes | Yes (tests + build) | main |
| **EasyStreet Mono** | GitHub | No | Not enforced | No | No |
| **EasyStreet Native** | GitHub | No | Not enforced | No | No |
| **macOS Hub** | GitHub | No | N/A | No | No |
| **tron-castle-fight** | GitHub | No | N/A | No | No |
| **shiphawk-templates** | GitHub | No | N/A | No | No |

### CI/CD & Automation

| Project | CI Platform | Test Parallelism | Linter in CI | Deploy Pipeline | Automated Checks |
|---------|------------|-----------------|--------------|-----------------|-----------------|
| **ShipHawk** | GitLab CI | 10 slices | RuboCop (Danger) | AWS AMI + Capistrano | 30 Danger rules |
| **Receipts** | GitHub Actions | 2 jobs (be/fe) | Black/isort/Prettier | Docker → ECR → ECS | CI test gate |
| **EasyStreet Mono** | None | N/A | N/A | N/A | N/A |
| **EasyStreet Native** | None | N/A | N/A | N/A | N/A |
| **macOS Hub** | None | N/A | N/A | N/A | N/A |
| **tron-castle-fight** | None | N/A | N/A | N/A | N/A |
| **shiphawk-templates** | None | N/A | N/A | N/A | N/A |

### README & Documentation

| Project | README Sections | CLAUDE.md Tier | Change Tracking | CONTRIBUTING.md | CODEOWNERS |
|---------|----------------|---------------|-----------------|-----------------|------------|
| **ShipHawk** | Docs links, Install | N/A (in root CLAUDE.md) | Jira release notes | No | No |
| **Receipts** | Basic setup | 3 (Mature) | timeline.md | In CLAUDE.md | No |
| **EasyStreet Mono** | Features, setup | 2 (Standard) | timeline.md (44 commits) | In CLAUDE.md | No |
| **EasyStreet Native** | Features, setup, testing | 3 (Mature) | timeline.md (44 commits) | In CLAUDE.md | No |
| **macOS Hub** | Setup, tools, config | 1 (Minimum) | None | No | No |
| **tron-castle-fight** | Rules, setup, test checklist | 2 (Standard) | PROJECT_LOG.md | No | No |
| **shiphawk-templates** | Components, workflow, vars | 2 (Standard) | timeline.md (phases) | No | No |

---

## Universal Standards

These standards apply across all projects in `/Apps/`. ShipHawk's Jira-linked conventions (`[DEV-12345]`) remain valid for that project as an additive layer on top of these baseline standards.

### 1. Commit Message Format

**Standard:** Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types (Required)

| Type | When to Use |
|------|------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Build, CI, dependency updates |
| `style` | Formatting, whitespace (no logic change) |
| `perf` | Performance improvement |

#### Scope (Optional)
Lowercase, identifies the affected area: `feat(auth):`, `fix(api):`, `refactor(db):`

#### Rules
1. **Subject line:** Imperative mood, lowercase start, no period, max 72 chars
2. **Body:** Wrap at 72 chars, explain *what* and *why* (not how)
3. **Breaking changes:** Add `BREAKING CHANGE:` footer or `!` after type: `feat!: remove legacy endpoint`
4. **Issue references:** Add footer `Refs: DEV-12345` or `Closes: #123`

#### Examples
```
feat(orders): add bulk CSV import endpoint

Supports async processing via Sidekiq workers with progress tracking.
CSV headers must match JSON field names per API standards.

Refs: DEV-28500
```

```
fix: resolve race condition in shipment label generation

Two concurrent requests could generate labels for the same shipment,
causing duplicate tracking numbers. Added database-level locking.
```

#### Project-Specific Extensions
- **ShipHawk:** Prepend Jira ticket: `[DEV-12345] feat: description` (Danger validates the `[DEV-*]` prefix)
- **tron-castle-fight:** Commit messages reference PROJECT_LOG entry numbers

#### Migration Path
- **Receipts:** Already compliant
- **EasyStreet projects:** Map `Feature:` → `feat:`, `Fix:` → `fix:`, `Refactor:` → `refactor:`
- **macOS Hub, shiphawk-templates:** Adopt immediately (no existing convention to migrate)
- **ShipHawk:** Add Conventional Commit type after Jira prefix: `[DEV-12345] feat: description`

---

### 2. Branch Naming Convention

**Standard:** `<type>/<description>`

```
feature/add-csv-import
fix/login-redirect-loop
refactor/extract-validation-util
docs/update-api-standards
chore/upgrade-dependencies
hotfix/critical-auth-bypass
```

#### Rules
1. **Type prefix:** Must be one of: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`, `hotfix/`
2. **Description:** lowercase-with-hyphens, concise, descriptive
3. **No ticket numbers in branch name** (put in commit messages and PR description instead)
4. **Stale branches:** Delete after merge; clean up branches older than 30 days

#### Project-Specific Extensions
- **ShipHawk:** Retains `vs-DEV-12345-description` format (required by Danger validation). The universal standard applies to all *other* projects.
- **Receipts:** Already compliant (uses `feature/`, `fix/`, `refactor/`, `docs/`)

---

### 3. PR/MR Workflow

**Standard:** Every code change goes through a PR/MR before merging to the main/default branch.

#### Workflow Steps
1. Create feature branch from default branch
2. Develop, commit (Conventional Commits)
3. Push branch, open PR/MR
4. Fill out PR template (Summary, Test Plan, Screenshots)
5. CI runs automatically (tests, lint, build)
6. Request review from team
7. Address review feedback (new commits, not amends)
8. All checks pass + approval received → merge
9. Delete branch after merge
10. Update change tracking file (timeline.md or PROJECT_LOG.md)

#### Merge Strategy
- **Default:** Squash merge to keep clean history
- **Exception:** Merge commit when preserving individual commits matters (large features with meaningful sub-commits)

#### Draft PRs
- Use `Draft` status while work is in progress
- Remove draft status only when:
  - Self-review completed
  - Tests pass locally
  - No extraneous commits
  - Ready for team review

#### Rules
1. **One concern per PR** — avoid 200+ file changes
2. **No direct pushes** to default branch (protected)
3. **CI must pass** before merge
4. **At least 1 approval** required for code projects
5. **PR description is mandatory** (not just the title)

#### Project Applicability

| Project | PR Required? | Rationale |
|---------|-------------|-----------|
| ShipHawk | Yes (existing) | Production platform, team workflow |
| Receipts | Yes (existing) | Production platform, team workflow |
| EasyStreet Monorepo | Yes (new) | Active development, shared codebase |
| EasyStreet Native | Yes (new) | Active development, shared codebase |
| macOS Hub | Optional | Single-developer tool, low risk |
| tron-castle-fight | Optional | Game project, low risk |
| shiphawk-templates | Optional | Template project, changes are visual/customer-specific |

---

### 4. PR Template

**Standard:** Every project with PRs MUST have a PR template.

#### Universal Template

**File:** `.github/PULL_REQUEST_TEMPLATE.md` (GitHub) or `.gitlab/merge_request_templates/default.md` (GitLab)

```markdown
## Summary
<!-- What changed and why. Link to issue/ticket if applicable. -->

## Type of Change
- [ ] Feature (new functionality)
- [ ] Fix (bug fix)
- [ ] Refactor (no behavior change)
- [ ] Docs (documentation only)
- [ ] Chore (build, CI, dependencies)

## Test Plan
- [ ] Tests added/updated
- [ ] All existing tests pass
- [ ] Manual testing completed

## Screenshots / Video
<!-- For UI changes. Delete this section if not applicable. -->

## Breaking Changes
<!-- List any breaking changes. Delete this section if none. -->

## Checklist
- [ ] Commit messages follow Conventional Commits
- [ ] No secrets or credentials committed
- [ ] Change tracking file updated (timeline.md / PROJECT_LOG.md)
```

#### Project-Specific Additions
- **ShipHawk:** Add `## Story:` (Jira link), `## Migrations:` (Yes/No), `## Depend on:` (linked MRs)
- **Receipts:** Add backend/frontend test commands as checkboxes
- **EasyStreet:** Add platform checkboxes (iOS tested / Android tested)

---

### 5. Code Review Standards

**Standard:** Structured review with severity levels and a minimum checklist.

#### Severity Levels

| Level | Action Required | Example |
|-------|----------------|---------|
| **Critical** | Must fix before merge | Security vulnerability, data loss risk, breaking change |
| **Important** | Should fix; may defer with ticket | Missing error handling, performance concern, missing test |
| **Suggestion** | Optional improvement | Naming preference, alternative approach, style nit |

#### Universal Review Checklist

Every reviewer should check:

1. **Correctness** — Does the code do what the PR claims?
2. **Tests** — Are there tests? Do they cover edge cases?
3. **Security** — No secrets, no injection vulnerabilities, no exposed internals
4. **Performance** — No N+1 queries, no unbounded loops, no missing indexes
5. **Backward compatibility** — Does this break existing behavior?
6. **Documentation** — Are changes reflected in docs/CLAUDE.md/README?

#### Project-Specific Review Items

**ShipHawk (additional):**
- Migration safety (reversible? speed on large tables? locks?)
- Elasticsearch reindex plan
- Ops Chore ticket for post-deploy actions
- Customer communication needs

**Receipts (additional):**
- Cache invalidation after mutations
- CSS variables only (no hex)
- Use Axios wrapper (not fetch)
- Use dayjs (not date-fns)
- Use UserBriefSerializer from accounts

#### What Does NOT Block a PR
- Variable naming preferences (unless truly misleading)
- Formatting that passes the linter
- Approach disagreements without functional impact

---

### 6. CI/CD Baseline

**Standard:** Every code project MUST have CI that runs on every PR.

#### Minimum CI Requirements

| Check | Required For | Purpose |
|-------|-------------|---------|
| **Tests** | All code projects | Catch regressions |
| **Lint** | All code projects | Enforce style consistency |
| **Build** | All compiled projects | Verify compilation |
| **Type check** | All TypeScript projects | Catch type errors |

#### Reference Implementations

**Python (Django/DRF):**
```yaml
# .github/workflows/ci.yml
on: [pull_request, push: { branches: [main] }]
jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:15, env: { POSTGRES_PASSWORD: test } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install poetry && poetry install
      - run: python manage.py migrate && python manage.py test
      - run: black --check . && isort --check .
```

**TypeScript (Node/Bun):**
```yaml
on: [pull_request, push: { branches: [main] }]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test
      - run: bun run build
```

**Ruby (Rails/Grape):**
```yaml
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:15 }
      redis: { image: redis:7 }
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with: { bundler-cache: true }
      - run: bundle exec rake db:create db:schema:load
      - run: bundle exec rspec
      - run: bundle exec rubocop
```

#### Project CI Requirements

| Project | Required? | Status | Action Needed |
|---------|-----------|--------|---------------|
| ShipHawk | Yes | Compliant (GitLab CI) | None |
| Receipts | Yes | Compliant (GitHub Actions) | None |
| EasyStreet Monorepo | Yes | Missing | Add GitHub Actions (Bun test + build + typecheck) |
| EasyStreet Native | Recommended | Missing | Add Xcode build + test workflow |
| macOS Hub | Recommended | Missing | Add TypeScript build + type check |
| tron-castle-fight | Optional | N/A | No build step needed |
| shiphawk-templates | Optional | N/A | No code to test |

---

### 7. Change Tracking

**Standard:** Every project MUST maintain a change tracking file updated after every development session.

#### File Names
- **Code projects:** `timeline.md`
- **Game/creative projects:** `PROJECT_LOG.md`
- Both formats are acceptable; choose one per project and stick with it.

#### Minimum Required Fields

Every entry MUST include:

| Field | Description |
|-------|------------|
| **Date** | ISO 8601 date (YYYY-MM-DD) |
| **What** | Brief description of changes made |
| **Why** | Motivation or context |
| **Commits** | SHA(s) or "pending" |
| **Next Steps** | Follow-up work needed (optional) |

#### timeline.md Format (Recommended)
```markdown
## 2026-02-08 — Add CSV import for orders

**What:** Added bulk CSV import endpoint with async Sidekiq processing.
**Why:** Customers need to import orders from external systems.
**Commits:** abc1234, def5678
**Next Steps:** Add progress tracking UI, document CSV field mappings.
```

#### PROJECT_LOG.md Format (Structured Alternative)
```markdown
### Entry 0005
- Timestamp: 2026-02-08T14:30-08:00
- Title: Add CSV import for orders
- Request Summary: Implement bulk order import via CSV upload
- Why: Customers need batch import from external systems
- Actions:
  - Added POST /api/v4/orders/import endpoint
  - Created CsvImportWorker for async processing
  - Added FileType validator for .csv extension
- Files Changed: app/api/v4/orders_imports.rb, app/workers/csv_import_worker.rb
- Validation: RSpec tests pass, manual CSV upload verified
- Commit: abc1234
- Next Steps: Add progress tracking, document CSV headers
```

#### Current Compliance

| Project | File | Format | Status |
|---------|------|--------|--------|
| ShipHawk | Jira tickets | Release notes in Jira | Compliant (different system) |
| Receipts | timeline.md | Phase-based planning | Compliant |
| EasyStreet Mono | timeline.md | Master commit table + sessions | Compliant |
| EasyStreet Native | timeline.md | Master commit table + sessions | Compliant |
| macOS Hub | None | N/A | Non-compliant — add timeline.md |
| tron-castle-fight | PROJECT_LOG.md | Structured entries | Compliant |
| shiphawk-templates | timeline.md | Phase-based | Compliant |

---

### 8. README Requirements

**Standard:** Every project MUST have a README.md with minimum required sections.

#### Required Sections

| Section | Content | Example |
|---------|---------|---------|
| **Title + Description** | What the project does (1-3 sentences) | "Receipt verification platform with Django REST API and React SPA" |
| **Tech Stack** | Languages, frameworks, key dependencies | "Python 3.11, Django 4.x, React 18, PostgreSQL" |
| **Setup** | Prerequisites + step-by-step instructions to run locally | "1. Install Poetry 2. Run `poetry install` 3. Run `python manage.py migrate`" |
| **Key Commands** | Build, test, lint, dev server | Table or code block with commands |
| **Project Structure** | Directory tree of key directories | Tree diagram or description |

#### Recommended Sections (Add as Needed)

| Section | When to Include |
|---------|----------------|
| **Contributing** | When multiple developers work on the project |
| **Architecture** | When system design is non-obvious |
| **Deployment** | When project has a deployment pipeline |
| **Testing** | When test setup is non-trivial |
| **License** | For open-source projects |

#### Current Compliance

| Project | Title | Stack | Setup | Commands | Structure | Score |
|---------|-------|-------|-------|----------|-----------|-------|
| ShipHawk | Partial | No | Yes (linked) | Yes (linked) | No | 2/5 |
| Receipts | Yes | Partial | Yes | Yes | Partial | 4/5 |
| EasyStreet Mono | Yes | Partial | Yes | Partial | Yes | 4/5 |
| EasyStreet Native | Yes | Partial | Yes | Partial | Yes | 4/5 |
| macOS Hub | Yes | Yes | Yes | Yes | Partial | 4/5 |
| tron-castle-fight | Yes | Yes | Yes | Yes | No | 4/5 |
| shiphawk-templates | Yes | Yes | Yes | Yes | Yes | 5/5 |

---

### 9. Linting & Formatting

**Standard:** Every code project MUST have a linter/formatter configured and documented.

#### Per-Language Standards

| Language | Formatter | Linter | Config File |
|----------|-----------|--------|-------------|
| **Python** | Black (line 88) + isort (profile: black) | flake8 | `pyproject.toml` |
| **Ruby** | RuboCop | RuboCop | `.rubocop.yml` |
| **TypeScript** | Prettier | ESLint or Biome | `.prettierrc`, `.eslintrc` or `biome.json` |
| **Swift** | SwiftFormat | SwiftLint | `.swiftlint.yml` |
| **Kotlin** | ktlint | ktlint | `.editorconfig` |
| **HTML/Liquid** | N/A | N/A | N/A (template project) |
| **JavaScript** | Prettier | ESLint | `.prettierrc`, `.eslintrc` |

#### Rules
1. Linter/formatter config MUST be checked into the repo
2. CI MUST run the linter (fail on violations)
3. Format-on-save recommended for local development
4. Linter rules should be consistent within a project (no per-file overrides except migrations/generated code)

---

### 10. Release & Deployment

**Standard:** Document the release process in the project README or a dedicated `RELEASE.md`.

#### Minimum Documentation
1. **How to deploy** — step-by-step or automated pipeline description
2. **Environment list** — dev, staging, production URLs
3. **Rollback procedure** — how to revert a bad deploy
4. **Who can deploy** — permissions/access requirements

#### Current Maturity

| Project | Deploy Process | Documented? | Automated? |
|---------|---------------|-------------|------------|
| ShipHawk | GitLab CI → AWS AMI → ASG | Partial (RELEASE_OPS.md) | Yes (on tags) |
| Receipts | GitHub Actions → Docker → ECR → ECS | Yes (deploy.yml) | Yes (on CI success) |
| EasyStreet Mono | Manual | No | No |
| EasyStreet Native | Manual (App Store) | No | No |
| macOS Hub | N/A (local tool) | N/A | N/A |
| tron-castle-fight | Manual (open HTML) | Partial (README) | No |
| shiphawk-templates | Manual (copy to ShipHawk) | No | No |

---

## Per-Project Compliance Checklist

### ShipHawk

| Standard | Status | Notes |
|----------|--------|-------|
| Conventional Commits | Partial | Uses `[DEV-*]` prefix; add type after prefix |
| Branch naming | Compliant | Own format enforced by Danger |
| PR template | Compliant | 2 templates (default + cherry-pick) |
| Code review | Compliant | Detailed standards in dev guideline |
| CI/CD | Compliant | GitLab CI with 30 Danger checks |
| Change tracking | Compliant | Jira-based release notes |
| README | Partial | Missing Architecture, Stack, Contributing sections |
| Linting | Compliant | RuboCop in CI |
| Deploy docs | Partial | RELEASE_OPS.md is minimal |

### Receipts

| Standard | Status | Notes |
|----------|--------|-------|
| Conventional Commits | Compliant | Already uses this format |
| Branch naming | Compliant | `feature/`, `fix/`, `refactor/`, `docs/` |
| PR template | Compliant | Summary, Test Plan, Screenshots |
| Code review | Compliant | 8-point checklist with severity levels |
| CI/CD | Compliant | GitHub Actions (tests + deploy) |
| Change tracking | Compliant | timeline.md |
| README | Mostly compliant | Could add more detail |
| Linting | Compliant | Black, isort, Prettier |
| Deploy docs | Compliant | deploy.yml is self-documenting |

### EasyStreet Monorepo

| Standard | Status | Notes |
|----------|--------|-------|
| Conventional Commits | Non-compliant | Uses `Category:` format; migrate to `type:` |
| Branch naming | Compliant | Already uses `feature/`, `bugfix/` |
| PR template | Missing | Add `.github/PULL_REQUEST_TEMPLATE.md` |
| Code review | Partial | Agent quality gates exist, no formal checklist |
| CI/CD | Missing | Add GitHub Actions for Bun test + build |
| Change tracking | Compliant | Detailed timeline.md |
| README | Mostly compliant | Basic but covers essentials |
| Linting | Partial | ESLint configured but not enforced in CI |
| Deploy docs | Missing | No deployment pipeline documented |

### EasyStreet Native

| Standard | Status | Notes |
|----------|--------|-------|
| Conventional Commits | Non-compliant | Uses `Category:` format; migrate to `type:` |
| Branch naming | Compliant | Already uses `feature/`, `bugfix/` |
| PR template | Missing | Add template |
| Code review | Partial | Agent quality gates exist |
| CI/CD | Missing | Add Xcode build + test workflow |
| Change tracking | Compliant | Detailed timeline.md |
| README | Compliant | Good coverage |
| Linting | Missing | No SwiftLint/ktlint configured |
| Deploy docs | Missing | No App Store deployment docs |

### macOS Hub

| Standard | Status | Notes |
|----------|--------|-------|
| Conventional Commits | Non-compliant | No convention documented |
| Branch naming | Non-compliant | No convention documented |
| PR template | N/A | Single-developer tool |
| Code review | N/A | Single-developer tool |
| CI/CD | Missing | Add TypeScript build check |
| Change tracking | Non-compliant | No timeline.md |
| README | Compliant | Good setup and tools documentation |
| Linting | Partial | TypeScript strict mode only |
| Deploy docs | N/A | Local tool |

### tron-castle-fight

| Standard | Status | Notes |
|----------|--------|-------|
| Conventional Commits | Non-compliant | Uses PROJECT_LOG governance instead |
| Branch naming | Non-compliant | Not documented |
| PR template | N/A | Game project |
| Code review | N/A | Game project |
| CI/CD | N/A | No build step |
| Change tracking | Compliant | Excellent PROJECT_LOG.md |
| README | Compliant | Rules, setup, test checklist |
| Linting | N/A | Vanilla JS, no build |
| Deploy docs | N/A | Open in browser |

### shiphawk-templates

| Standard | Status | Notes |
|----------|--------|-------|
| Conventional Commits | Non-compliant | No convention documented |
| Branch naming | Non-compliant | Not documented |
| PR template | N/A | Template project |
| Code review | N/A | Visual review only |
| CI/CD | N/A | No code to test |
| Change tracking | Compliant | Phase-based timeline.md |
| README | Compliant | Comprehensive |
| Linting | N/A | HTML/Liquid templates |
| Deploy docs | Missing | No deployment process documented |

---

## Implementation Recommendations

### Priority 1: Immediate (This Week)

1. **Adopt Conventional Commits workspace-wide**
   - Update CLAUDE.md git workflow sections for: EasyStreet projects, macOS Hub, shiphawk-templates
   - ShipHawk: Add type after Jira prefix (`[DEV-12345] feat: description`)
   - Document in `/Apps/docs/guides/commit-message-guide.md`

2. **Add PR templates**
   - EasyStreet Monorepo: `.github/PULL_REQUEST_TEMPLATE.md`
   - EasyStreet Native: `.github/PULL_REQUEST_TEMPLATE.md`
   - Use the universal template from [Section 4](#4-pr-template)

3. **Add timeline.md to macOS Hub**
   - Brings all projects to change-tracking compliance

### Priority 2: Next Sprint

4. **Add CI/CD to EasyStreet Monorepo**
   - GitHub Actions: `bun install` → `bun run typecheck` → `bun run lint` → `bun run test` → `bun run build`
   - Template provided in [Section 6](#6-cicd-baseline)

5. **Add CI/CD to macOS Hub**
   - GitHub Actions: `npm install` → `npm run build` (TypeScript compilation check)

6. **Document branch naming in all CLAUDE.md files**
   - Projects currently missing: macOS Hub, tron-castle-fight, shiphawk-templates

### Priority 3: Incremental

7. **Add CODEOWNERS files** to Receipts and EasyStreet projects
   - Enables automatic reviewer assignment on GitHub

8. **Standardize README sections** across all projects
   - Ensure all 5 required sections are present
   - ShipHawk README needs Architecture and Stack sections

9. **Add linter configs** to projects missing them
   - EasyStreet Native: SwiftLint + ktlint
   - macOS Hub: ESLint or Biome

10. **Document deployment processes**
    - EasyStreet: App Store submission process
    - shiphawk-templates: How templates are deployed to ShipHawk

---

## Appendix: ShipHawk Deep Dive

### Danger Rule Inventory (30 Automated Checks)

| Rule | File | What It Checks |
|------|------|---------------|
| `DatabaseSchema` | `database_schema.rb` | Schema change patterns, unsafe migrations |
| `ShiphawkDanger` | `shiphawk_danger.rb` | General code review automation |
| `ValidateMigrationHandlerInMigrationHasTest` | — | Every migration handler has a test |
| `ForceFollowingMigrationsGuide` | — | Migrations follow documented guide |
| `ValidateMigrationHandlerIsInCorrectFolder` | — | Handlers in `year20XX/` folder |
| `ValidateMigrationToNotUseIntegerColumnType` | — | No raw integer columns |
| `ValidateMigrationToAddResetColumn` | — | Reset columns added when required |
| `ValidateModelsToNotUseCallbacks` | — | No model callbacks |
| `ValidateModelsToNotHaveTouchTrue` | — | No `touch: true` on associations |
| `ValidateFilesToNotHaveMethodReload` | — | No `.reload` usage |
| `ValidateFilesToNotHaveMethodTouch` | — | No `.touch` usage |
| `ValidateFilesToNotHaveOpenStruct` | — | No `OpenStruct` usage |
| `ValidateDescriptionHasTicketsForTmpFlag` | — | Tmp flags link to cleanup tickets |
| `ValidateGitNaming` | `validate_git_naming.rb` | Branch, commit, MR title format |
| `lgtm.check_lgtm` | — | LGTM image automation |

### Jira Workflow Integration

```
Ready For Dev → In Development → Code Review → [Failed QA ↩ In Development]
                                             → Passed QA → Ready For Prod → Done
```

- Developer moves ticket through statuses manually
- MR title links to Jira ticket
- Release notes added as Jira comments
- Ops Chore tickets created for post-deploy actions

### ShipHawk Documentation Suite

| Document | Path | Content |
|----------|------|---------|
| Development Guideline | `doc/shiphawk_development_guideline.md` | Full developer workflow, Jira process, review standards |
| Testing | `doc/testing.md` | RSpec metatags, VCR, Sidekiq, ES testing |
| Migrations | `doc/migrations.md` | Migration safety, handler pattern, sync/async |
| Migrations Guide | `doc/decision-log/db/migrations/migrations-guide.md` | Detailed conventions and examples |
| Install OSX | `doc/install-osx.md` | Step-by-step macOS dev setup |
| Install Ubuntu | `doc/install-ubuntu.md` | Linux dev setup |
| Elasticsearch | `doc/elasticsearch.md` | ES integration and usage |
| Decision Log | `doc/decision-log/` | Architectural decisions (patterns, DB, general) |

---

*Generated by Commit/PR Policy Review Team — 2026-02-08*
*Companion document: [API Standards Review](api-standards-review-2026-02-08.md)*
