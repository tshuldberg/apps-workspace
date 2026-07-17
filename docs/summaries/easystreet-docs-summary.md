# EasyStreet Documentation Summary

> **Generated:** 2026-02-08
> **Scope:** All markdown docs in `Parks/EasyStreet/docs/` and `Parks/easystreet-monorepo/docs/`
> **Purpose:** Comprehensive inventory with per-file summaries, duplicate analysis, and cross-references

---

## Duplicate Analysis

**Critical finding:** 13 of the 14 documentation files in the monorepo are exact duplicates of the native project's docs. The two projects share the same `docs/` tree with only two exceptions:

| File | Native | Monorepo | Notes |
|------|--------|----------|-------|
| `docs/getting-started.md` | Yes | Yes (identical) | Mac dev environment setup guide |
| `docs/privacy-policy.md` | Yes | Yes (identical) | App Store privacy policy |
| `docs/plans/` (11 plan files) | Yes | Yes (identical) | All 11 plans duplicated verbatim |
| `docs/plans/2026-02-07-email-to-task-cli.md` | **Yes** | **No** | Unique to native project |
| `docs/easystreet-app-comparison.md` | **No** | **Yes** | Unique to monorepo |

Both projects also share an identical `.claude/CLAUDE.md` (~700+ lines).

**Recommendation:** Consolidate shared docs into a single location (e.g., `Parks/shared-docs/`) and symlink or reference from each project to avoid drift.

---

## Guides

### Getting Started
**File:** `docs/getting-started.md` (397 lines) -- present in both projects (identical)

Step-by-step Mac development environment setup covering Homebrew, Git, SSH keys, Xcode, Android Studio, Node.js, and Claude Code installation. Includes project directory structure overview, Xcode/Android Studio first-run instructions, and best practices for working with Claude Code (reading CLAUDE.md first, using @ mentions, running tests before committing).

---

## Policies

### Privacy Policy
**File:** `docs/privacy-policy.md` (64 lines) -- present in both projects (identical)

App Store privacy policy for EasyStreet. States that location data stays on-device only, no analytics or tracking are collected, and no data is shared with third parties. Street sweeping data sourced from SF Open Data under the Public Domain Dedication and License (PDDL). Effective date: February 2026.

---

## Plans

### Android Feature Parity Design
**File:** `docs/plans/2026-02-04-android-feature-parity-design.md` (303 lines) -- present in both projects (identical)

Architecture design document for the Android port using Jetpack Compose and MVVM. Specifies the SQLite schema, SweepingRuleEngine behavior, UI flow (MapScreen with bottom sheet), notification system via WorkManager, and a complete project structure of approximately 18 Kotlin files. Serves as the high-level blueprint that the implementation plan (below) turns into code.

### Android Implementation Plan
**File:** `docs/plans/2026-02-04-android-implementation-plan.md` (2289 lines) -- present in both projects (identical)

The largest document in the repository: a 14-task implementation plan with full inline code for each task. Covers project scaffolding, a Python CSV-to-SQLite converter, domain models (SweepingRule, StreetSegment, ParkedCar), HolidayCalculator, SweepingRuleEngine, SQLite data layer, repositories, notifications via WorkManager, MapScreen Compose UI, marker drag interaction, and runtime permissions. Each task includes file paths, complete source code, and dependencies on prior tasks.

### Android Tasks 2-5 Foundation
**File:** `docs/plans/2026-02-05-android-tasks-2-5-foundation.md` (222 lines) -- present in both projects (identical)

A focused sub-plan extracted from the larger Android implementation plan, covering Tasks 2 through 5: build configuration prerequisites, domain model data classes, HolidayCalculator with 8 unit tests, SweepingRuleEngine with 7 unit tests, and the CSV-to-SQLite converter script. Written to be self-contained so an agent can execute it without needing the full 2289-line parent plan.

### iOS MVP Sprint
**File:** `docs/plans/2026-02-05-ios-mvp-sprint.md` (1336 lines) -- present in both projects (identical)

An 11-task iOS MVP completion plan. Includes xcodegen project file creation, CSV-to-JSON data converter, HolidayCalculator in Swift, SweepingRuleEngine test suite, map performance optimization (diff-based updates + debounce), 4-color street coding (red/orange/yellow/green), configurable notification timing, error handling improvements, UI polish, and documentation updates. Each task has file paths, code snippets, and verification steps.

### Agent Plan Gap Analysis
**File:** `docs/plans/2026-02-06-agent-plan-gap-analysis.md` (234 lines) -- present in both projects (identical)

Compares the agent team structure plan against a tier-1 human engineering org and identifies 10 gaps: no product manager, no design/UX capability, no analytics/observability, no TPM coordination, no platform/infrastructure team, no performance engineering, no model tier mapping (Opus vs Sonnet vs Haiku), no scaling model, QA model mismatch, and no cross-platform shared logic strategy. Each gap includes a recommended fix.

### Agent Team Structure
**File:** `docs/plans/2026-02-06-agent-team-structure.md` (687 lines) -- present in both projects (identical)

Defines a full agent-powered engineering organization with 12 teams and 17-28 agents. Maps each team to Claude model tiers (Opus for architecture, Sonnet for implementation, Haiku for triage). Includes SOPs for each team, a feature development pipeline flow diagram, a parallel execution map showing which teams can work simultaneously, and a scaling model from pre-launch through 100K+ users.

### App Store Launch
**File:** `docs/plans/2026-02-06-app-store-launch.md` (583 lines) -- present in both projects (identical)

A 15-task App Store submission plan covering: debug logging cleanup, notification UX improvements, location error handling, app icon asset catalog generation, build configuration, Apple Developer Program enrollment, App Store Connect setup, metadata and screenshots, privacy policy hosting (GitHub Pages), privacy nutrition label declarations, archive and upload process, and post-launch monitoring checklist. Estimated at approximately 12-16 hours of work.

### Multi-City Expansion
**File:** `docs/plans/2026-02-06-multi-city-expansion.md` (891 lines) -- present in both projects (identical)

Comprehensive strategy for expanding beyond San Francisco to 10+ US cities. Analyzes LA, NYC, Chicago, Boston, DC, Philadelphia, Denver, San Diego, Minneapolis, and Pittsburgh for data availability and sweeping rule complexity. Proposes a new multi-city SQLite schema, Swift model changes, a backend server architecture for city data distribution, download-on-demand strategy, holiday system overhaul (NYC alone has 33+ holidays), per-city data ingestor adapters, phased rollout (CA expansion then major markets then national), and a freemium + subscription monetization model.

### Non-Technical Launch Tasks
**File:** `docs/plans/2026-02-06-non-technical-launch-tasks.md` (334 lines) -- present in both projects (identical)

Approximately 25 non-technical tasks across 7 categories required for App Store launch: Apple Developer account setup, legal and compliance (Terms of Service, SFMTA data attribution), visual assets (app icon, screenshots for 3 device sizes), beta testing via TestFlight, support and content (FAQ, support email), marketing and launch (Product Hunt, Reddit r/sanfrancisco), and a launch day checklist with go/no-go criteria.

### Production Readiness
**File:** `docs/plans/2026-02-06-production-readiness.md` (1121 lines) -- present in both projects (identical)

The primary active plan: 21 tasks across 5 phases covering data accuracy (holiday calculation fixes, fractional hours bug, metadata table, CSV data refresh), legal protection (in-app disclaimer, privacy policy, SF Open Data attribution), critical code fixes (thread safety, memory optimization, Info.plist configuration, debug logging removal, notification fixes, code quality), missing tests (63 new tests across 6 test files), and App Store assets. Includes a complete source file inventory, 12 cross-review findings (R1-R12), and a task dependency graph.

### Email-to-Task CLI (Native Only)
**File:** `docs/plans/2026-02-07-email-to-task-cli.md` (355 lines) -- **unique to native project**

Design for a standalone CLI tool (separate from EasyStreet) that scans a Gmail inbox, uses a two-stage LLM pipeline (Haiku for triage at ~$0.001/email, Sonnet for extraction at ~$0.008/email) to identify actionable emails, and creates Linear issues automatically. Architecture: local-first with PII redaction, SQLite dedup, macOS Keychain for credentials, TypeScript/Node.js stack. Three build phases: MVP scan pipeline, review queue + polish, watch mode + npm packaging. Estimated cost: $3-7/month for typical personal use.

---

## Comparisons

### EasyStreet App Comparison (Monorepo Only)
**File:** `docs/easystreet-app-comparison.md` (95 lines) -- **unique to monorepo**

Side-by-side comparison of the legacy Swift native app versus the TypeScript monorepo rewrite across 7 dimensions: architecture (MVC vs shared engine + platform adapters), data strategy (bundled SQLite vs Convex cloud-synced), parking flow (tap-to-park in both), notifications (local-only vs cross-platform with push), iOS UX (UIKit vs React Native/Expo), city scalability (hardcoded SF vs multi-tenant from day one), and testability (XCTest vs Vitest shared). Recommends the TypeScript monorepo as the product baseline going forward.

---

## Project Configuration

### CLAUDE.md
**File:** `.claude/CLAUDE.md` (~700+ lines) -- present in both projects (identical)

Comprehensive Claude Code project instructions covering: project structure, iOS development (Swift/UIKit build and test commands, code style), Android development (Kotlin/Compose build commands), shared data models (SweepingRule, StreetSegment, ParkedCar, SweepingStatus), street data handling, holiday calculation, testing standards, git workflow (feature/bugfix/refactor branches), agent usage standards (when to use teams vs subagents, file ownership boundaries, quality gates), development timeline documentation requirements (mandatory for every session), plugins and skills inventory (14 project-scoped plugins, MCP servers, slash commands), and current development status (production readiness phase).

---

## Cross-References to /Apps/docs

### Reports

| Workspace Report | Related EasyStreet Doc | Connection |
|-----------------|----------------------|------------|
| `docs/reports/easystreet-native-research-2026-02-08.md` | All native docs | Research report analyzing the native EasyStreet codebase; draws from the same plans and CLAUDE.md |
| `docs/reports/easystreet-monorepo-research-2026-02-08.md` | All monorepo docs | Research report analyzing the monorepo rewrite; references app-comparison.md findings |
| `docs/reports/implementation-plan-2026-02-08.md` | Production readiness plan, App Store launch plan | Workspace-level implementation planning that may reference EasyStreet's active plans |
| `docs/reports/2026-02-08-across-app-72-hour-summary.md` | All EasyStreet plans | Cross-project summary that includes EasyStreet development activity |

### Guides

| Workspace Guide | Related EasyStreet Doc | Connection |
|----------------|----------------------|------------|
| `docs/guides/plugins/superpowers.md` | `.claude/CLAUDE.md` (Plugins & Skills section) | EasyStreet's CLAUDE.md references superpowers skills; the guide documents their usage |
| `docs/guides/plugins/commit-commands.md` | `.claude/CLAUDE.md` (Slash Commands section) | EasyStreet uses commit-commands plugin; the guide covers `/commit` and `/commit-push-pr` |
| `docs/guides/skills/writing-skills.md` | `.claude/CLAUDE.md` (Agent Usage Standards) | Skill authoring guide relevant to EasyStreet's agent team structure plan |
| `docs/guides/mcp-servers/macos-hub.md` | `.claude/CLAUDE.md` (MCP Servers section) | EasyStreet sessions can use macos-hub MCP tools documented in this guide |

### Templates

| Workspace Template | Related EasyStreet Doc | Connection |
|-------------------|----------------------|------------|
| `docs/templates/claude-md-minimum.md` | `.claude/CLAUDE.md` | EasyStreet's CLAUDE.md is Tier 3 (mature); workspace templates define the tier standards |
| `docs/templates/` (other templates) | `docs/getting-started.md` | Getting-started guide follows patterns that could be templated for other projects |

### Workspace Root

| Workspace File | Related EasyStreet Doc | Connection |
|---------------|----------------------|------------|
| `CLAUDE.md` (root) | `.claude/CLAUDE.md` | Root CLAUDE.md has an EasyStreet section summarizing stack, commands, and architecture |
| `timeline.md` (root) | `timeline.md` (per-project) | EasyStreet maintains its own timeline; workspace timeline tracks cross-project activity |
