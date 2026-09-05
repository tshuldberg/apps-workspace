# Specification Engineering Prompt Guide

A practical guide to writing advanced, long-session AI prompts based on Nate B Jones' "4 Disciplines of Prompting" framework. Includes 8 real-world example prompts for MyLife and Receipts.

**Source:** [Everyone Learned Prompting. Almost Nobody Learned the 4 Skills That Actually 10x Output](https://www.youtube.com/watch?v=BpibZSMGtdY) by Nate B Jones (Feb 2026)

---

## The Core Insight

Prompting is no longer one skill. It has diverged into four distinct disciplines operating at different altitudes and time horizons. Most people practice only the first one and wonder why their AI output plateaus at 80%.

The difference between a 2025 prompt and a 2026 prompt:
- **2025 person** types a request, gets 80% correct output, spends 40 minutes cleaning up. Saves maybe 50% of time.
- **2026 person** writes a structured specification in 11 minutes, hands it off, goes to make coffee. Returns to completed output that hits every quality bar. Does this 5 more times before lunch. A week's work in a morning.

Same model. Same subscription. 10x gap.

---

## The 4 Disciplines

### 1. Prompt Craft (Table Stakes)

The original skill. Synchronous, session-based, individual. You write an instruction, evaluate output, iterate.

- Clear instructions with examples and counterexamples
- Explicit output format and guardrails
- Ambiguity resolution rules

**Status in 2026:** Table stakes. Like knowing how to type was in 1998. If you can't do this, you can't send email. But it won't differentiate you.

**Limitation:** Assumes you're always there to catch mistakes, provide context, course-correct. Long-running agents break every one of those assumptions.

### 2. Context Engineering (The Information Environment)

The set of strategies for curating and maintaining the optimal set of tokens during an LLM task. Your 200-token prompt is 0.02% of what the model sees. The other 99.98% is context engineering.

Covers: system prompts, tool definitions, retrieved documents, message history, memory systems, MCP connections, CLAUDE.md files, RAG pipelines.

**Key insight:** People who are 10x more effective are not writing 10x better prompts. They're building 10x better context infrastructure. The prompt can be simple because the context does the heavy lifting.

### 3. Intent Engineering (What to Want)

Encoding organizational purpose, goals, values, trade-off hierarchies, and decision boundaries into infrastructure that agents can act against.

Context engineering tells agents what to know. Intent engineering tells agents what to want.

**Cautionary tale:** Claro deployed an AI agent that resolved 2.3 million customer conversations in its first month. It optimized for the wrong metric (resolution time instead of customer satisfaction). They had to rehire human agents. Perfect context + wrong intent = organizational damage.

**Failure at this level is organizational-scale**, not individual-scale. A misprompt wastes your morning. Misaligned intent destroys customer trust at millions of touchpoints.

### 4. Specification Engineering (The Full Stack)

Writing documents that autonomous agents can execute against over extended time horizons without human intervention. The shift from fixing it in real time to getting the spec right up front.

This is not just about individual prompts. It's about treating your entire document corpus as agent-readable specifications. Corporate strategy, product strategy, OKRs, SOPs -- all become specifications agents can use.

**Anthropic's own experience:** When building a web app with Opus 4.5, a high-level prompt like "build a clone of claude.ai" caused the agent to run out of context mid-implementation. The fix was not a better model. It was specification engineering: a planner sets up the environment, a progress log documents what's been done, a coding agent makes incremental progress against a structured plan.

**The smarter models get, the better you need to get at specification engineering.**

---

## The 5 Primitives of Specification Engineering

These are the foundational skills to practice if you want to write prompts that work for autonomous, long-running sessions.

### Primitive 1: Self-Contained Problem Statements

State a problem with enough context that the task is plausibly solvable without the agent fetching additional information.

**Training exercise:** Take a request you'd normally make conversationally ("update the dashboard to show the Q3 numbers") and rewrite it as if the person receiving it has never seen your dashboard, doesn't know what Q3 means in your org, doesn't know what database to query, and has access to no information other than what you include.

AI fills gaps with statistical plausibility, not knowledge. That's a polite way of saying it guesses in ways that are often subtly wrong.

### Primitive 2: Acceptance Criteria

If you can't describe what "done" looks like, the agent can't know when to stop. It will stop when its internal heuristics say the task is complete, which may have no relationship to what you needed.

**Training exercise:** For every task you delegate, write three sentences that an independent observer could use to verify the output without asking you any questions. If you can't write those sentences, you don't understand the task well enough to give it to an agent.

**Weak:** "Build a login page."
**Strong:** "Build a login page that handles email/password, social OAuth via Google and GitHub, progressive disclosure of 2FA, session persistence for 30 days, and rate limiting after five failed attempts."

### Primitive 3: Constraint Architecture

Four categories of boundaries:
1. **Musts** -- what the agent has to do
2. **Must-nots** -- what the agent cannot do
3. **Preferences** -- what to prefer when multiple valid approaches exist
4. **Escalation triggers** -- what the agent should escalate rather than decide autonomously

**Training exercise:** Before delegating, write down what a smart, well-intentioned person might do that would technically satisfy the request but produce the wrong outcome. Those failure modes become your constraints.

The best CLAUDE.md files are practical implementations of constraint architecture. Every line must earn its place.

### Primitive 4: Decomposition (and Break Patterns)

Break large tasks into components that can be executed independently, tested independently, and integrated predictably.

**Training exercise:** Take any project estimated at a few days. Decompose it into subtasks that each take less than 2 hours, have clear input/output boundaries, and can be verified independently. That is the granularity at which agents work best.

#### Break Patterns: The Level Above Decomposition

This is the most forward-looking concept in the video (~32:30-33:30). In 2026, you do not have to pre-specify all 50-60 subtasks when writing a prompt. But you do have to understand what all of those tasks are. Your job is to provide the **break patterns** that a planner agent can use to break up larger work in a reliable, executable fashion.

A break pattern is a reusable decomposition template. Instead of writing every subtask, you describe:
- What a "unit of work" looks like (e.g., under 2 hours, clear input/output boundaries, independently verifiable)
- The typical shape of work in a domain (e.g., for module migrations: audit, schema, migration, routing, validation)
- Completion criteria so the planner knows when to split further vs. when a chunk is atomic
- Examples of good decomposition so the planner can pattern-match for novel work

**Concrete example -- module migration break pattern:**

> "For any module migration, the work decomposes into: (1) an audit step comparing standalone and hub schemas, (2) a schema completion step for any missing tables, (3) a migration step that is always additive-only, (4) a route wiring step using the passthrough pattern, (5) a validation step running parity checks. Each step is independently verifiable. The audit step's output is the input to the schema step. No step modifies files outside the module's directory except the route wiring step (which touches apps/web/app/<module>/)."

That break pattern can be applied to *any* module (recipes, fast, habits, meds) without rewriting the decomposition from scratch. The planner agent reads the pattern and generates specific subtasks for the target module.

**How this maps to existing infrastructure:**
- Plan templates (like `docs/plans/templates/plan-template.md`) are break patterns for plan-driven work
- CLAUDE.md "File Ownership Zones" tables are break patterns for parallel agent coordination
- The passthrough parity convention is a break pattern for any new module's web integration

**The key shift:** Your job is increasingly not to manually write subtasks for the agent. Your job is to provide the break patterns that a planner agent can use to break up larger work reliably. That's a level of abstraction *above* decomposition, and it's where the most leverage comes from as agents scale.

### Primitive 5: Evaluation Design

How do you know the output is good? Not "does it look reasonable" but "can you prove, measurably and consistently, that this is good?"

**Training exercise:** For every recurring AI task, build three to five test cases with known good outputs. Run them periodically, especially after model updates. This catches regressions and creates institutional knowledge about what "good" looks like for your specific use cases.

---

## The Prompt Template

Use this structure for any specification-engineering prompt:

```
## Problem Statement
[Self-contained description. Include:
- What project this is and where it lives
- Current state of the codebase
- What you want accomplished
- All context the agent needs as if they've never seen the codebase]

## Acceptance Criteria
[Numbered list. Each item is verifiable by an independent observer.
Write 6-10 specific, measurable criteria.]

## Constraint Architecture

**Musts:**
- [Non-negotiable requirements]

**Must-nots:**
- [Forbidden actions, files not to touch, patterns to avoid]

**Preferences:**
- [Preferred approaches when multiple valid options exist]

**Escalation triggers:**
- [Conditions where the agent should stop and report instead of deciding]

## Subtask Decomposition
[5-7 subtasks, each under 2 hours, each independently verifiable.
Format: **Subtask N: Name (estimated time)** followed by description]

## Evaluation Design
[3-5 concrete verification steps. Include:
- Commands to run
- Expected outputs
- Integration checks
- Performance benchmarks where applicable]
```

---

## Example Prompts: MyLife Hub

### Prompt A: Migrate MyRecipes into the MyLife Hub (Phase 2)

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app that consolidates 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes to avoid collisions.

Phase 0 (hub foundation) and Phase 1 (MyBooks migration) are complete. You are executing Phase 2 work: migrating MyRecipes from its standalone app into a fully functional hub module with web passthrough parity.

#### Context You Need

**Completed reference implementation (MyBooks):**
- Module definition: `modules/books/src/definition.ts` exports `BOOKS_MODULE` with migrations array, `tablePrefix: 'bk_'`, and navigation config
- Schema: `modules/books/src/db/schema.ts` defines all CREATE TABLE statements with `bk_` prefix, indexes, and seed data
- Web passthrough: `apps/web/app/books/page.tsx` contains a single re-export line: `export { default } from '@mybooks-web/app/books/page';`

**Standalone MyRecipes source of truth:** `/Users/trey/Desktop/Apps/MyLife/MyRecipes/` is a Turborepo monorepo with `packages/shared/src/` containing db schema, models, parser, scaling, grocery engine, and utils. Its web app lives at `MyRecipes/apps/web/app/`.

**Existing hub-side scaffold:** `modules/recipes/` already exists with `src/definition.ts` (exports `RECIPES_MODULE` with `tablePrefix: 'rc_'`), `src/db/schema.ts` (4 tables: `rc_recipes`, `rc_ingredients`, `rc_recipe_tags`, `rc_settings`), and `src/types.ts`.

**Hub database system:** `packages/db/src/migration-runner.ts` provides `runModuleMigrations(db, moduleId, migrations)` which tracks per-module schema versions in `hub_schema_versions`.

#### Your Task

Complete the MyRecipes hub module so it achieves full standalone-to-hub parity for the web platform. The standalone MyRecipes app has 11 SQLite tables. The current hub module only has 4. Bring the hub schema to full parity, wire the web passthrough routes, and ensure the parity checker passes.

#### Acceptance Criteria

1. `modules/recipes/src/db/schema.ts` defines all 11 tables from the standalone schema, each with `rc_` prefix, plus all indexes and seed data
2. `modules/recipes/src/definition.ts` exports `RECIPES_MODULE` with a complete migrations array that brings the schema from v1 to v2 without data loss -- v2 migration adds only the 7 missing tables
3. `apps/web/app/recipes/page.tsx` is a single-line passthrough: `export { default } from '@myrecipes-web/app/recipes/page';`
4. All other recipe route files under `apps/web/app/recipes/` follow the same passthrough pattern
5. `pnpm typecheck` passes with zero errors
6. `pnpm check:passthrough-parity` passes for the recipes module
7. No files outside `modules/recipes/` and `apps/web/app/recipes/` are modified (except `apps/web/next.config.ts` if a new path alias is needed)

#### Constraint Architecture

**Musts:**
- All table names use the `rc_` prefix exactly as in the standalone schema
- Migration v2 must be additive only (CREATE TABLE IF NOT EXISTS) -- never ALTER or DROP existing v1 tables
- Web passthrough files must be single re-export lines, not copied component code
- Follow the exact pattern from `modules/books/src/definition.ts`

**Must-nots:**
- Do not modify the standalone MyRecipes submodule
- Do not modify `packages/module-registry/`
- Do not add React components to `modules/recipes/` -- UI lives in the standalone app
- Do not modify any other module's files

**Preferences:**
- Import shared types from `@mylife/module-registry`
- Match the code style of the books module

**Escalation triggers:**
- If the standalone schema has changed since the hub scaffold was created and the existing 4 tables are incompatible, stop and report the diff
- If `@myrecipes-web` alias does not exist in `apps/web/tsconfig.json`, add it following the `@mybooks-web` pattern

#### Subtask Decomposition

1. **Schema audit (30 min):** Read the standalone schema and compare against current hub schema. List the 7 missing tables. Document discrepancies.
2. **Complete hub schema (45 min):** Add the 7 missing table definitions with `rc_` prefix, indexes, and seed data.
3. **Write migration v2 (30 min):** Additive migration creating only the new tables. Update `RECIPES_MODULE.migrations` array.
4. **Wire web passthrough routes (45 min):** Create passthrough files for every standalone route file. Verify tsconfig alias.
5. **Validate (30 min):** Run `pnpm typecheck` and `pnpm check:passthrough-parity`.

#### Evaluation Design

1. Schema completeness: `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rc_%'` returns 11 tables
2. Migration idempotency: Running `runModuleMigrations` twice applies 0 migrations on second run
3. Passthrough structure: Every `.tsx` under `apps/web/app/recipes/` is a single re-export line
4. Type safety: `pnpm typecheck` exits 0
5. Parity gate: `pnpm check:passthrough-parity` exits 0

---

### Prompt B: Implement Web Subscription/Paywall System (Phase 3)

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a hub app with 12 modules. Currently all modules are available without payment. Phase 3 requires implementing a subscription system that gates premium modules behind a paywall while keeping MyFast free.

#### Context You Need

**Current state:** `packages/subscription/` and `packages/auth/` are placeholder packages. `packages/entitlements/` is already implemented with types, schema, gates, and verification. The web settings page already reads entitlement state.

**Module registry:** `packages/module-registry/src/types.ts` defines `ModuleTier = 'free' | 'premium'`. Only `fast` is `tier: 'free'`. All others are `tier: 'premium'`.

**Pricing:** MyLife Pro: $4.99/month, $29.99/year, $79.99 lifetime.

**Web actions:** `apps/web/app/actions.ts` has `enableModuleAction` which currently enables without subscription check.

#### Your Task

Implement web-side subscription using Stripe Checkout for purchase and `@mylife/entitlements` for access control. When a user tries to enable a premium module without a subscription, show a paywall. If subscribed, allow it.

#### Acceptance Criteria

1. `packages/subscription/src/` exports `SubscriptionService` with: `createCheckoutSession()`, `getSubscriptionStatus()`, `cancelSubscription()`, `handleWebhook()`
2. Stripe webhook route at `apps/web/app/api/stripe/webhook/route.ts` handles `checkout.session.completed`, `subscription.updated`, `subscription.deleted`
3. Checkout route at `apps/web/app/api/stripe/checkout/route.ts` creates Stripe Checkout sessions
4. Discover page shows lock icon on premium modules when unsubscribed; clicking "Enable" redirects to paywall
5. Paywall page at `apps/web/app/subscribe/page.tsx` shows 3 pricing tiers with Checkout buttons
6. `enableModuleAction` checks entitlement before enabling premium modules
7. Settings page shows "MyLife Pro" with billing details and "Manage Subscription" link when subscribed
8. `pnpm typecheck` passes

#### Constraint Architecture

**Musts:**
- Stripe Checkout (server-side session creation), not Stripe Elements
- All Stripe API calls server-side only
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs from env
- MyFast always enableable without subscription

**Must-nots:**
- No RevenueCat/mobile subscription logic
- No modification to module-registry tier definitions
- No PII/card storage locally
- No modification to existing entitlements verification logic

**Preferences:**
- Use `stripe` npm package (official SDK)
- Match dark theme with CSS variables
- Follow existing inline style pattern

**Escalation triggers:**
- If entitlements schema can't store Stripe customer IDs, extend it with a migration
- If webhook signature verification conflicts with Next.js App Router, document the workaround

#### Subtask Decomposition

1. **Stripe SDK + SubscriptionService (45 min)**
2. **Webhook API route (45 min)**
3. **Checkout API route (30 min)**
4. **Paywall page (45 min)**
5. **Gate the enable flow (30 min)**
6. **Settings page subscription display (30 min)**
7. **Type-check and manual test checklist (30 min)**

#### Evaluation Design

1. Enable MyFast without subscription -- must succeed
2. Click "Enable" on MyBooks without subscription -- must redirect to `/subscribe`
3. Click "Subscribe" on Monthly -- must redirect to valid Stripe Checkout URL
4. `stripe trigger checkout.session.completed` -- entitlement updates to active
5. After webhook, enabling premium module succeeds
6. `pnpm typecheck` exits 0

---

### Prompt C: Cross-Cutting Parity Enforcement for Passthrough Modules

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife enforces strict parity between standalone apps and hub modules. Several modules use a "web passthrough" pattern where hub route files are single-line re-exports from standalone app pages.

#### Context You Need

**Passthrough pattern:** Every `.tsx` file under `apps/web/app/books/` contains one line like `export { default } from '@mybooks-web/app/books/page';`. The alias maps to `../../MyBooks/apps/web`.

**Passthrough modules:** `books`, `habits`, `words`, `workouts`. Each has a standalone submodule (e.g., `MyBooks/`, `MyHabits/`).

**Parity commands:** `pnpm check:passthrough-parity`, `pnpm check:module-parity`, `pnpm check:parity` (full gate).

**Known state:** Books is fully wired. The other three may have gaps.

#### Your Task

Audit all four passthrough modules, fix every parity gap, and add a Vitest test for ongoing enforcement.

#### Acceptance Criteria

1. Every standalone `.tsx` route file has a corresponding passthrough in `apps/web/app/<module>/`
2. Every passthrough is a single re-export from the standalone alias
3. No passthrough contains JSX, component logic, or React imports
4. `apps/web/tsconfig.json` has all 4 aliases
5. `pnpm check:passthrough-parity` passes
6. `pnpm check:parity` passes
7. Vitest test at `apps/web/app/__tests__/passthrough-parity.test.ts` enforces the invariant

#### Constraint Architecture

**Musts:** Standalone is always source of truth. Include named exports where standalone has them.

**Must-nots:** Don't modify standalone files. Don't add UI code to passthrough files. Don't modify module definitions.

**Escalation triggers:** If a standalone has no `apps/web/app/`, skip it as "web-not-implemented". If the parity check script has a bug, fix the script.

#### Subtask Decomposition

1. **Audit standalone routes (30 min)**
2. **Audit hub passthrough files (30 min)**
3. **Verify/fix tsconfig aliases (15 min)**
4. **Create missing passthrough files (45 min)**
5. **Write Vitest parity test (30 min)**
6. **Run all parity checks (15 min)**

#### Evaluation Design

1. File count: standalone routes == hub routes per module
2. Content: every hub file is one re-export line
3. No stale references to nonexistent standalone paths
4. Vitest passes
5. `pnpm check:parity` exits 0

---

### Prompt D: Hub Dashboard Redesign with Activity Feed

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. The hub dashboard (`apps/web/app/page.tsx`) currently shows a simple grid of module cards. Replace it with an activity-driven home screen.

#### Context You Need

**Current dashboard:** `apps/web/app/page.tsx` is `'use client'`, calls `useEnabledModules()`, renders `ModuleCard` components in a CSS grid.

**Design system:** Inline `React.CSSProperties`. CSS variables in `globals.css`: `--bg`, `--surface`, `--surface-elevated`, `--text`, `--text-secondary`, `--border`, `--radius-lg`. Module accents: `--accent-books`, `--accent-budget`, etc.

**Data access:** Each module has server actions in `apps/web/app/<module>/actions.ts`.

#### Your Task

Replace the flat grid with three sections: (1) daily summary bar (aggregate stats from enabled modules), (2) activity feed (10 most recent items across modules), (3) quick-actions panel (shortcuts for common operations).

#### Acceptance Criteria

1. Three visual sections: summary bar (top), activity feed (center), quick-actions (right)
2. Summary shows 3-5 stats from enabled modules only
3. Activity feed shows 10 most recent items sorted by recency with module icons and accent colors
4. Quick-actions shows 4-6 action buttons for enabled modules
5. Responsive: side-by-side above 1200px, stacked below
6. All data via server actions
7. Uses existing CSS variable design system
8. `pnpm typecheck` passes
9. `ModuleCard` preserved for Discover page

#### Constraint Architecture

**Musts:** Server-side data fetching. Existing CSS variables. Handle empty activity gracefully. Link to real existing routes.

**Must-nots:** No new CSS frameworks. Don't modify Sidebar, module pages, or module actions. Don't add new database tables.

**Preferences:** Server component page with `'use client'` sub-components only for interactivity. `Intl.RelativeTimeFormat` for timestamps. Accent-colored left border on feed items.

**Escalation triggers:** If modules lack recent-activity queries, create `apps/web/app/dashboard-actions.ts` querying module tables directly. If >3 modules have empty tables, show card grid fallback for those.

#### Subtask Decomposition

1. **Dashboard type definitions (30 min)**
2. **Dashboard server actions (60 min)**
3. **Summary bar component (30 min)**
4. **Activity feed component (45 min)**
5. **Quick-actions panel (30 min)**
6. **Compose dashboard page (30 min)**
7. **Type-check and visual verify (15 min)**

#### Evaluation Design

1. Dashboard renders three sections without errors
2. With 2+ modules enabled, summary and feed show data
3. All modules disabled shows empty state directing to Discover
4. Responsive layout works at both breakpoints
5. Clicking feed items navigates to correct module pages
6. `pnpm typecheck` exits 0

---

## Example Prompts: Receipts (Receeps)

### Prompt E: Full-Stack Search System with PostgreSQL Full-Text Search

You are working on Receeps at `/Users/trey/Desktop/Apps/receipts`. A Django 5.x + DRF backend with a React (Vite) + Mantine v8.1.1 frontend. An evidence verification platform where users submit "receipts" (evidence documents), attach them to topics, vote on credibility, and discuss in threaded comments.

There is no unified full-text search. Users cannot search across receipts by content, find topics by name, or discover content by author. The receipt list endpoint supports filtering but has no text search.

Build a full-stack search system using PostgreSQL full-text search (`SearchVector`, `SearchQuery`, `SearchRank`) with a unified search bar, type-ahead, faceted results page, and keyboard navigation.

#### Acceptance Criteria

1. New `search/` Django app with `/search/api/search/` endpoint accepting `q`, `type`, `filters`, `ordering`
2. Paginated results with `snippet` field showing highlighted matches
3. Receipts searched across `title` (weight A), `evidence_text` (B), `source_url` (D)
4. Topics searched across `name` (A) and `ai_summary` (B)
5. Comments searched on `content` with author info
6. Visibility rules enforced (confidential excluded for non-staff, removed comments excluded)
7. `SearchBar` in header with debounced type-ahead (300ms), 5 results per type
8. `/search` route with faceted sidebar and result cards matching existing card patterns
9. Keyboard nav: arrow keys, Enter, Escape, Cmd+K opens search
10. Backend + frontend tests pass
11. `black . && isort .` clean

#### Constraint Architecture

**Musts:** Use `django.contrib.postgres.search`. Use `UserBriefSerializer`. Axios wrapper (never `fetch`). CSS vars `var(--reddit-*)`. `@tabler/icons-react` only. Mantine v8.1.1. `dayjs` (never date-fns). `invalidate_*_cache()` after mutations. Serializer directory convention. `select_related`/`prefetch_related`.

**Must-nots:** No new Python packages. Don't modify existing models. No `alert()`/`confirm()`/`prompt()`. No hardcoded colors.

**Escalation triggers:** If full-text search perf is inadequate, flag for Elasticsearch but don't implement it.

#### Subtask Decomposition

1. **Backend app scaffold (45 min)**
2. **Search query engine (60 min)**
3. **Search API endpoint (45 min)**
4. **Frontend SearchBar (60 min)**
5. **Frontend SearchResults page (60 min)**

#### Evaluation Design

1. `python3 manage.py test search` passes
2. `black . && isort .` clean
3. Manual: create receipt, search by title, it appears
4. Confidential receipt invisible to non-staff in search
5. Search responds in <200ms for 100+ receipts

---

### Prompt F: Staff Moderation Dashboard

You are working on Receeps at `/Users/trey/Desktop/Apps/receipts`. The platform has a `Report` model in `moderation/models.py` for flagging content, a confidential submission workflow, and unusual activity flagging. Staff currently manage all of this through Django Admin only.

Build a three-tab staff moderation dashboard: Reports queue, Confidential submissions queue, Unusual activity queue. With bulk actions, inline resolution modals, notification integration, and real-time count badges.

#### Acceptance Criteria

1. `ReportViewSet` with CRUD + resolve, bulk_resolve, assign actions
2. `ModeratorStatsView` returning counts for all queues
3. All endpoints require `is_staff`
4. Report resolution notifies reporter and content author
5. Three-tab frontend with table, bulk selection, expand/collapse, quick-action dropdown
6. Confidential tab with Publish/Escalate/Remove buttons
7. Unusual Activity tab with Clear/Review actions
8. Header badge with total actionable count
9. Route `/staff/moderation` protected by `StaffLoggedInRoute`
10. All tests pass, formatting clean

#### Constraint Architecture

**Musts:** Use existing `Report` model unchanged. Existing receipt workflow actions. `Notification.objects.create_notification()`. `UserBriefSerializer`. Mantine Table/Tabs/Badge/Menu/Modal. Axios wrapper. `var(--reddit-*)`. `@tabler/icons-react`. `dayjs`.

**Must-nots:** Don't modify Report model or receipt viewsets. No `fetch()`, `alert()`, `confirm()`. No new npm packages.

**Preferences:** Polling (30s) for count updates over WebSocket. Existing `ModalWrapper`.

#### Subtask Decomposition

1. **Backend Report API (60 min)**
2. **Backend Stats Endpoint (30 min)**
3. **Backend Notification Integration (30 min)**
4. **Frontend Dashboard Shell (45 min)**
5. **Frontend Reports Queue (60 min)**
6. **Frontend Confidential + Unusual Activity Queues (45 min)**

#### Evaluation Design

1. `python3 manage.py test moderation` passes
2. Frontend builds with no errors
3. Integration: create report, see it in queue, dismiss it, reporter gets notification
4. Non-staff gets redirected/403

---

### Prompt G: Backend API Test Coverage Expansion

You are working on Receeps at `/Users/trey/Desktop/Apps/receipts`. The backend has 10 Django apps. Test coverage is uneven -- several critical areas lack API tests: Receipt custom actions (verify, publish, escalate), Vote CRUD with credibility cascading, Comment threading with votes, and Notification endpoints.

Write comprehensive API tests for these 4 areas. Each test file follows the existing pattern in `receipt/tests/test_models.py` (using `TestCase`, `setUp` fixtures, descriptive names, explicit assertions).

#### Acceptance Criteria

1. `test_receipt_api.py`: 25+ methods covering CRUD, verify, attach/detach topic, publish, escalate, remove, set unusual activity, filtering, ordering, pagination
2. `test_vote_api.py`: 12+ methods covering create, update-via-create, delete, permissions, credibility cascade
3. `test_comments_api.py`: 15+ methods covering CRUD, threading, edit (is_edited flag), votes, moderation, depth calculation
4. `test_notifications_api.py`: 10+ methods covering list, mark_read, bulk mark_read, unread_count, filtering, permissions
5. All 4 files pass individually
6. Full suite `python3 manage.py test` still passes
7. `black . && isort .` clean

#### Constraint Architecture

**Musts:** Use `django.test.TestCase` or `rest_framework.test.APITestCase` matching existing patterns. `setUp` fixtures. Descriptive names: `test_<action>_<condition>_<result>`. Assert specific status codes and response data. Test happy path and error cases.

**Must-nots:** Don't modify source code. No factory libraries. No new test dependencies.

**Escalation triggers:** If endpoints return unexpected errors indicating source bugs, document in test comments but don't fix source.

#### Subtask Decomposition

1. **Receipt API tests (90 min)**
2. **Vote API tests (45 min)**
3. **Comment API tests (60 min)**
4. **Notification API tests (45 min)**
5. **Full suite validation (15 min)**

#### Evaluation Design

1. Each file passes individually with 0 failures
2. Full suite passes
3. Method count meets minimums per file
4. `black . && isort .` clean
5. Each test class uses proper setUp/tearDown

---

### Prompt H: Feed Algorithm Personalization Engine with A/B Testing

You are working on Receeps at `/Users/trey/Desktop/Apps/receipts`. The feed system has `FeedPreference` (per-user tuning: recency_bias, verification_bias, diversity_factor, mood_filter, weights, blocked categories) and `FeedProfileSnapshot` (saved profiles). But the actual scoring algorithm is minimal.

Build a complete feed scoring engine with exponential recency decay, verification boost, diversity enforcement, mood filtering, plus an A/B testing framework with deterministic cohort assignment and engagement tracking.

#### Acceptance Criteria

1. `FeedScorer` class with `score_receipt()`, `score_topic()`, `build_feed()` methods
2. Recency decay: `score *= exp(-recency_bias * days_old / 30)`
3. Verification boost: verified +50%, disputed -30%, false -80% (scaled by verification_bias)
4. Diversity: no category exceeds `(1 - diversity_factor) * 100%` of a page
5. Mood filter: positive=verified only, negative=disputed only, neutral=unverified only
6. `ABTestManager` with deterministic `assign_cohort()`, `get_scorer_for_user()`, `record_engagement()`
7. New models: `Experiment` and `EngagementLog`
8. `GET /feed/api/feed/` returns personalized mixed feed
9. Staff-only `/feed/api/feed/experiments/` endpoint with per-cohort metrics
10. Backend tests pass, frontend updated, formatting clean

#### Constraint Architecture

**Musts:** Use existing `FeedPreference`/`FeedProfileSnapshot` unchanged. `BaseModel` for new models. `select_related`/`prefetch_related`. Feed responds in <500ms. Deterministic cohort assignment. `black . && isort .` compliance.

**Must-nots:** Don't modify existing feed models. No external ML libraries. Don't store full feed in DB. No raw SQL.

**Preferences:** Strategy pattern for algorithm variants. `ScoredItem` dataclass for type safety.

**Escalation triggers:** If database-level scoring too complex, fall back to Python with 500-item hard limit. If diversity breaks pagination, apply as post-processing on final page only.

#### Subtask Decomposition

1. **FeedScorer core algorithm (60 min)**
2. **Feed builder with diversity and mood (60 min)**
3. **A/B testing infrastructure (45 min)**
4. **Feed API endpoint (45 min)**
5. **Frontend integration (30 min)**
6. **Validation and cleanup (15 min)**

#### Evaluation Design

1. Verified receipt scores higher than unverified (all else equal)
2. 1-day-old item scores higher than 30-day-old
3. Diversity factor 1.0: no category exceeds 50% of results
4. Same user gets same cohort across 100 calls
5. Feed endpoint <500ms with 1000 receipts + 200 topics
6. `python3 manage.py test feed` passes

---

## Learning Progression

Nate's recommended order (these are cumulative, not alternative):

1. **Close the prompt craft gap.** Re-read prompting documentation. Build a folder of tasks you do regularly, write your best prompt for each, save outputs as baselines, revisit over time.

2. **Build your personal context layer.** Write a CLAUDE.md equivalent for your work regardless of which tool you use. Document goals, constraints, preferences, quality standards, institutional context. Start sessions by loading this. Output quality improvement should be immediate.

3. **Practice specification engineering.** Take a real project. Write a spec before touching AI. Include acceptance criteria, constraint architecture, decomposition. Hand the spec to an agent and observe what comes back.

4. **Build intent infrastructure.** Encode the decision frameworks your team uses implicitly. Define what "good enough" looks like per category. Define what gets escalated vs what AI can decide. Write it down and make it available to agents.

5. **Scale specification engineering to your org.** Every document you touch is a spec an agent will need to read. Your org is a system of business processes. Make those processes agent-readable.

---

## Key Quotes

> "The prompt by itself is dead. The specification, the context, the organizational intent -- that is where the value in prompting is moving." -- Nate B Jones

> "A lot of what people in big companies call politics is actually bad context engineering for humans." -- Toby Lutke (Shopify CEO)

> "The ability to state a problem with enough context in a way that without any additional pieces of information, the task becomes plausibly solvable." -- Toby Lutke

> "The smarter models get, the better you need to get at specification engineering."

---

## Sources

- [Video: Everyone Learned Prompting. Almost Nobody Learned the 4 Skills That Actually 10x Output](https://www.youtube.com/watch?v=BpibZSMGtdY) -- Nate B Jones, AI News & Strategy Daily
- [Nate B Jones Personal Site](https://www.natebjones.com/)
- [Nate B Jones Substack](https://natesnewsletter.substack.com/)
- [Nate Jones Transcript Archive (GitHub)](https://github.com/kani3894/nate-jones-transcripts)
