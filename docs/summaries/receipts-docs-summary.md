# Receipts (Receeps) Documentation Summary

**Generated:** 2026-02-08
**Source:** `/Users/trey/Desktop/Apps/receipts/docs/` (36 markdown files)
**Reviewer:** receipts-reviewer

---

## Overview

Receeps is a Django REST Framework + React evidence verification platform where users submit receipts (evidence items) attached to topics, and the community votes on relevance, reliability, and bias. The documentation corpus spans product design, implementation plans, engineering audits, launch execution, and forward-looking features like algorithm transparency and mobile apps.

The docs directory contains two major sections:
1. **Filter Overhaul Series** (7 files) -- A 5-sprint, 6-week redesign of navigation, ranking, and feed systems
2. **Plans** (29 files) -- Feature implementation plans, audit programs, launch execution checklists, and algorithm profile specs

---

## Filter Overhaul Series

### `docs/filter-overhaul/00-overview-and-index.md` (253 lines)
Entry point for the filter overhaul project. Defines 5 sprints over 6 weeks with design principles: verification-first ranking, Wilson score credibility, URL-driven filter state for shareability. Includes architecture diagram, tech stack summary (Django ORM annotations, Mantine v8.1.1, Redux Toolkit), API endpoint overview, cross-cutting concerns (cache invalidation after every mutation, Mantine-only components), risk/mitigation table, and success metrics.

### `docs/filter-overhaul/01-sidebar-restructure.md` (1,463 lines)
Sprint 1 specification. Implements a Reddit-style collapsible left sidebar with 6 sections: Global Feeds (Hot/New/Top/Rising), Create Actions, Categories (collapsible, with chip-style navigation), Recent Topics (localStorage-persisted), Favorites (placeholder for Sprint 4), and Followed Topics (placeholder for Sprint 4). Defines 9 user stories, 14 new files to create, detailed component specs with props interfaces, CSS Module classes, state management patterns, data flow diagrams, keyboard shortcut (`[` to toggle sidebar), hover-to-peek behavior on collapsed desktop, and definition-of-done checklists per story.

### `docs/filter-overhaul/02-sort-toolbar-and-algorithms.md` (1,983 lines)
Sprint 2 specification -- the most technically detailed doc. Introduces a FeedSortToolbar component with 6 pill-button sort options (Hot, New, Top, Rising, Most Debated, Most Verified) and a FeedTabs component (For You / Following / Trending). Contains complete Python implementations of 5 backend ranking algorithms using Django ORM annotations:
- **Hot:** Decaying popularity using `annotate_hot_score` (vote velocity over time)
- **Rising:** Velocity-based scoring of recent engagement
- **Debated:** Controversy score via `StdDev` on vote scores
- **Verified:** Status-weighted Wilson score lower bound for credibility
- **Needs Review:** Surfaces unverified content by engagement

Includes Wilson score credibility function, data migration for backfilling scores, Django signal handlers for vote change propagation, a custom `ReceiptOrderingFilter` class, and 40+ test specifications.

### `docs/filter-overhaul/03-explore-page.md` (1,217 lines)
Sprint 3 specification. Adds an `/explore` route with: horizontal-scroll category chip row, trending topics section, recently active section, and needs-verification section. Three backend enhancements: `recently_active` ordering option, `receipt_activity_after` filter, `verification_status__in` multi-value filter. Frontend uses `Promise.allSettled` for parallel API loading, detailed card designs for each section, and search with 300ms debounce.

### `docs/filter-overhaul/04-favorites-and-follow-system.md` (1,595 lines)
Sprint 4 specification. Introduces:
- **UserTopicFavorite model** with an `ordering` field for user-defined sort
- **Activation of existing `follows` app** (generic Follow model with `GenericForeignKey`)
- **7 API endpoints:** favorite/unfavorite/list favorites/reorder/follow/unfollow/list following
- Serializer changes using `Exists` subquery annotations for N+1 prevention on `is_favorited`/`is_followed` fields
- Frontend: `StarButton` and `FollowButton` components with optimistic UI, `SidebarFavorites` with edit/reorder mode (drag-and-drop), feed `following` filter
- Cache invalidation functions for follow/favorite mutations

### `docs/filter-overhaul/05-responsive-and-polish.md` (1,612 lines)
Sprint 5 specification. Covers:
- **Responsive breakpoints:** mobile (<768px), tablet (768-1199px), desktop (1200+)
- **Mobile bottom tab bar** with 5 tabs (Home/Explore/Create/Notifications/Profile)
- Mobile category/filter drawer
- **Hover-to-peek sidebar** on collapsed desktop
- **Keyboard navigation:** `[` toggle, Tab/Arrow/Enter/Escape for sidebar items
- Animation polish with `prefers-reduced-motion` support
- **Skeleton loaders** for all major components
- **6 empty state definitions** (no receipts, no topics, no results, etc.)
- Error states with retry buttons
- ARIA labels, live regions, focus management
- WCAG AA contrast audit
- Performance targets (FCP < 1.5s, TTI < 3s)
- Browser/device testing matrix

### `docs/receeps_filter_overhaul_design_plan.md` (590 lines)
Master design document synthesizing research from 5 platforms (Reddit, X/Twitter, Instagram, Facebook, TikTok) adapted for Receeps' verification-first mission. Contains: sidebar structure specification, sort algorithm pseudocode, Wilson score formula explanation, Explore page layout wireframe, feed composition pipeline (candidate generation -> filtering -> scoring -> diversity enforcement), CSS variable token definitions, 5-phase implementation roadmap, and a pattern verification table cross-referencing features to source platform inspirations.

---

## Plans

### Design & Architecture

#### `docs/plans/2026-02-04-code-review-standards-design.md` (54 lines)
Documents establishment of Git workflow and code review standards. Branch cleanup: closed `topics` PR #1, deleted `stylechanges`, merged `feature/receipt-api-implementation` PR #2 after fixing 4 critical issues (missing cache invalidation, unrestricted ContentType, wrong HTTP status, typo in variable name). Established protected branch rules for `main`.

#### `docs/plans/2026-02-05-analytics-sharing.md` (~2,100 lines)
Comprehensive task-by-task implementation plan for analytics dashboard and social sharing. 20 tasks covering:
- **View tracking:** `view_count` fields on Receipt and Topic models with atomic `F()` increments on retrieve
- **AnalyticsViewSet:** 5 staff-only endpoints (overview, trends, top_content, source_breakdown, vote_distribution) using `TruncDate`, `Avg`, `Count` annotations
- **Server-side OG meta tags:** Django template rendering for social crawler compatibility (receipt/topic detail pages get dynamic `og:title`, `og:description`, `og:image`)
- **Frontend StaffAnalytics page:** recharts-powered dashboard with `LineChart` (submission trends), `PieChart` (source type breakdown), `BarChart` (verification status, vote distribution), `SegmentedControl` for time period selection
- **ShareButtons component:** Copy link, Twitter/X, LinkedIn, Reddit share actions
- Each task includes full code listings, expected outputs, test specifications, and commit messages

#### `docs/plans/2026-02-05-android-sprint-plan.md` (581 lines)
Android development sprint plan for a React Native monorepo (`receeps-mobile/`). 6 sprints (plus conditional Sprint 6):
- **Sprint 0:** Project bootstrap -- Metro config, Gradle, 6 platform service stubs (secureStorage, notifications, sharing, media, deepLinking, biometrics), merge-and-compare checkpoint with iOS
- **Sprint 1:** Auth + Android Keystore -- `react-native-keychain`, JWT persistence, back button behavior, keyboard handling
- **Sprint 2:** Submission flow + media -- `react-native-image-picker`, camera/gallery permissions, scoped storage `content://` URIs, anonymous mode, file upload with compression
- **Sprint 3:** My Receeps + sharing -- `react-native-share`, `Intent.ACTION_SEND`, FlatList optimization, status badges
- **Sprint 4:** Push notifications + deep linking -- Firebase FCM, `POST_NOTIFICATIONS` permission (Android 13+), notification channels, App Links with `assetlinks.json`
- **Sprint 5:** Polish + release -- ProGuard/R8, signed AAB, Google Play Console setup, parity verification with iOS
- **Sprint 6 (conditional):** Browse feed + share-to-Receeps intent filter
- Includes dependency map, branching convention (`android/<developer-name>/<sprint>`), risk table, and 6 coordination sync points between iOS and Android developers

#### `docs/plans/2026-02-05-following-system.md` (~3,000+ lines)
Detailed task-by-task implementation plan for a generic following system. Creates a `follows/` Django app with:
- **Follow model:** GenericForeignKey supporting topics, categories, and users; `unique_together` constraint; `ALLOWED_FOLLOW_MODELS` validation
- **FollowViewSet:** create/delete/list/my-following/follower-count actions
- **FollowButton and FollowerCount components:** optimistic UI, integrated into TopicDetail and CategorySidebar
- **Activity Feed page:** aggregated feed of followed entities' recent activity
- **Following tab** in UserDashboard
- Notification integration via signals
- Cache invalidation for follow mutations

#### `docs/plans/2026-02-05-moderation-reporting.md` (~1,500 lines)
Full implementation plan for content moderation. Creates a `moderation/` Django app with:
- **Report model:** GenericForeignKey (same pattern as Vote/Comment/Notification), 8 report reasons (spam, harassment, misinformation, off-topic, duplicate, inappropriate, copyright, other), 6 status values, resolution fields
- **ReportViewSet:** create (any authenticated user), list/retrieve/resolve/stats (staff-only), mine (own reports)
- **Duplicate detection:** prevents user from submitting multiple pending reports on same content
- **Auto-flagging signal:** when `AUTO_FLAG_THRESHOLD` (3) pending reports exist for same content, auto-escalates to "reviewing" status
- **Resolution notification signal:** notifies reporter when their report is resolved
- **Content removal logic:** comments get `is_removed=True`, receipts get `verification_status="false"`
- **Frontend:** ReportButton + ReportModal components, ModerationQueue tab in StaffDashboard
- **9 tasks** with complete code, tests, URL registration, notification type additions

#### `docs/plans/2026-02-06-typescript-llm-leverage-guide.md` (566 lines)
Research-driven guide on why TypeScript improves LLM-assisted development. Cites academic evidence (50%+ compilation error reduction, 94% of LLM errors are type-check failures). Defines Receeps-specific TypeScript standards:
- Strict `tsconfig.json` with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
- Type organization: `src/types/models/`, `src/types/api/`, `src/types/state/`, `src/types/handlers/`
- Component patterns: function declarations over `React.FC`, Mantine wrapper extension via `Omit`
- Redux Toolkit patterns: pre-typed hooks, typed slices, typed async thunks
- LLM-specific patterns: `satisfies` operator, template literal types, exhaustive type checking, generic components
- Anti-patterns table (9 patterns to avoid: `any`, `@ts-ignore`, `as` assertions, `React.FC`, `enum`, etc.)
- API type generation from DRF via `drf-spectacular` + `@hey-api/openapi-ts`
- Zod runtime validation at API boundaries

#### `docs/plans/2026-02-06-typescript-migration-plan.md` (392 lines)
8-phase migration plan for converting the entire Receeps frontend from JavaScript to TypeScript:
- **174 files** to migrate (152 JSX + 22 JS)
- **Phase 1:** Foundation (tsconfig, deps, Vite config, ESLint) -- incremental mode with `allowJs: true`
- **Phase 2:** Type definitions (models, API, state, handlers) + `drf-spectacular` schema generation
- **Phase 3:** Infrastructure (Axios, Redux store, slices, services) -- ~15 files
- **Phase 4:** Core/shared components (wrappers, route guards) -- ~21 files
- **Phase 5:** Feature components (bottom-up per directory) -- ~65 files, **primary parallelization opportunity** with 2-3 agents
- **Phase 6:** Layout, routing, app shell -- ~33 files
- **Phase 7:** Strict mode + hardening (enable strict, remove `any`, add `tsc --noEmit` to CI)
- **Phase 8:** QA + documentation updates
- Parallel execution map showing max 5 concurrent agents
- Agent headcount: 5-8 peak, estimated 6-8 weeks
- Risk register with 7 items and mitigations
- Pre-requisites: fix 2 backend bugs (duplicate URL registration, duplicate router basenames) before `drf-spectacular` schema generation

#### `docs/plans/2026-02-06-launch-readiness-assessment.md` (312 lines)
Comprehensive launch readiness assessment covering:
- **Historical progress:** 8 development phases from Jan 2025 to Feb 2026, covering core backend, API, frontend, integration, category system/UI overhaul, code quality, security hardening, and mobile foundation
- **Key metrics:** 8 backend apps, ~50 component directories, ~45 API endpoints, ~30,000+ LOC
- **What's working (READY):** Full CRUD for receipts/topics, multi-dimensional voting, threaded comments, 13 notification types, staff verification, search, categories, user dashboard, JWT auth, password reset, dark theme, caching, security basics
- **What needs work:** Only 14 frontend tests across 2 files, `new Date()` usage in ~10 places, remaining hardcoded hex colors, N+1 query in `TopicInReceiptSerializer`
- **5 launch blockers identified:** content moderation system, legal pages, production deployment, email service, password reset validation in staging
- **4-phase launch plan:** Week 1 (critical blockers), Week 2 (production infrastructure), Week 3 (quality + polish), Post-launch (following, analytics, mobile)
- **5 decision points:** MVP scope (web-first), moderation approach (manual-only), hosting (ECS vs PaaS), following timing (post-launch), feature branch audit

---

### Audit Program (9 files)

#### `docs/plans/2026-02-07-audit-program/README.md` (53 lines)
Index for the 8-week certification-style audit program. Splits into 7 discipline-specific playbooks executed in parallel. Defines severity taxonomy: Critical (security/data loss), High (correctness/trust), Medium (standards), Low (cosmetic). Program exit criteria require all Critical findings triaged, High findings fixed or deferred with owner, and final certification signoff.

#### `00-context-and-program-charter.md` (100 lines)
Program charter establishing governance, quality bar, and decision process. Defines: program objectives (risk baseline, remediation roadmap, launch-scale validation, mission alignment), 7 workstreams, cadence (daily async + twice-weekly syncs + weekly gates at W2/W4/W6/W8), severity/priority model with 5 input factors (user trust impact, mission contradiction, security exploitability, blast radius, time-to-remediate). Deliverables: master findings register, cross-team blocker log, gate review notes, executive summary, remediation roadmap.

#### `01-backend-code-audit-playbook.md` (100 lines)
Backend audit playbook with 10-point checklist covering: serializer contracts, permission/ownership checks, N+1 prevention, cache invalidation, filtering/pagination edge cases, model constraints, error handling, import hygiene, test coverage, dead code identification. Module review matrix across 7 modules (accounts, app, receipt, comments, notifications, util, settings) with required output per module.

#### `02-frontend-audit-and-dark-theme-redesign-playbook.md` (100+ lines)
Frontend audit + dark-first refined minimalist redesign spec. Engineering audit (6 items: Axios wrapper, dayjs, CSS variables, wrapper components, route guards, loading/error/empty states). UX audit (5 items: hierarchy, spacing, interaction affordances, component consistency, mobile/desktop parity). Dark-first redesign token model with 3 layers: primitive tokens, semantic tokens, component tokens. New proposed color system (e.g., `--color-bg-canvas: #0E1113`, `--color-accent-primary: #5FA8FF`). WCAG 2.2 AA accessibility requirements.

#### `03-architecture-audit-playbook.md` (90 lines)
Architecture audit with 8-point checklist: C4-style maps, boundary violations, data ownership, API contract consistency, caching reliability, async pipeline behavior, observability, deployability/rollback. Required artifacts: current-state architecture map, coupling heatmap, data lifecycle/failure mode narrative, target-state architecture proposal.

#### `04-security-audit-playbook.md` (92 lines)
Security audit using STRIDE threat modeling and OWASP Top 10 + ASVS L2 control mapping. 8-point checklist: threat model for key workflows, role/permission boundaries, anti-abuse controls, secure defaults, secrets management, file upload controls, dependency monitoring, incident response readiness.

#### `05-product-mission-alignment-audit-playbook.md` (87 lines)
Product/mission alignment audit verifying feature set against mission claims. 6-point checklist: define mission pillars, map shipped features, identify contradictions, score gaps by trust impact, align with technical dependencies, validate UX changes. Mission Pillar Scorecard template with grade + evidence + gap summary per pillar.

#### `06-enhancement-and-new-feature-options-playbook.md` (100 lines)
Enhancement option analysis using weighted multi-factor scoring: Mission Fit (30%), User Value (25%), Security/Risk (20%), Engineering Effort inverse (15%), Time to Value (10%). 6 candidate option packs: trust/anti-bot, verification transparency, moderation maturity, engagement loops, analytics/explainability, growth/onboarding.

#### `07-qa-validation-and-certification-gates.md` (80+ lines)
QA validation with gate criteria for W2/W4/W6/W8. Validation matrix mapping each workstream to evidence type, QA method, and gate timing. 6 core QA scenarios: auth/authorization regression, abuse/throttling, performance/query-risk, accessibility, visual regression, mission-critical trust behavior.

#### `08-cross-team-interface-and-handoff-matrix.md` (80 lines)
Cross-team handoff contracts with SLAs (2-3 business days per handoff). 5 critical co-review rules ensuring secondary team review for every Critical finding. Escalation protocol: team-level unresolved > 24h escalates to Program Lead; > 48h escalates to Executive Sponsor; security blocker at gate deadline = automatic gate fail.

---

### Algorithm Profiles (6 files)

#### `consolidated/00-executive-summary.md` (100+ lines)
Executive summary for User-Controlled Algorithm Profiles -- a feature giving users transparent, granular control over feed ranking. 9 resolved cross-team decisions:
- **RD-1:** 10 weight dimensions for MVP (recency, popularity, controversy, verified_content, topic_affinity, source_diversity, engagement_depth, credibility, novelty, community_trust); 4 deferred to P2
- **RD-2:** No separate feed system -- scoring integrates into existing `ReceiptViewSet.get_queryset()`
- **RD-3:** `follows` app not activated; topic_affinity uses vote/submission history instead
- **RD-4:** 4 default profiles: Balanced, Breaking News, Deep Dive, Verified Only
- **RD-5:** 5 profiles max per user, 3 quick-switch slots
- **RD-6:** API under `/algorithm/api/`
- **RD-8:** `@mantine/charts` (wraps recharts) for radar chart visualization
- **RD-9:** Feature flag strategy with phased rollout (staff -> beta -> 10% -> 50% -> 100%)

#### `consolidated/01-product-specification.md` (100+ lines)
Detailed product spec with 5 personas (New User, Power User, Privacy-Conscious, Casual, Content Creator) and 28 user stories. Problem statement: opaque algorithms create distrust on a verification platform. Vision: first evidence-verification platform with fully user-controlled algorithms. Acceptance criteria per story.

#### `consolidated/02-backend-architecture.md` (100+ lines)
Backend architecture: 5 new models (`AlgorithmProfile`, `AlgorithmWeight`, `UserAlgorithmConfig`, `AlgorithmStats`, `UserDimensionStats`), scoring engine with 10 weight dimensions, 4-layer Redis caching, Celery tasks for batch stats computation. Existing system analysis documents current ranking (simple `-created_at`), available data signals from Vote model, and infrastructure (Redis cache, Celery eager mode in dev/test).

#### `consolidated/03-frontend-specification.md` (100+ lines)
Frontend spec with full component hierarchy (20+ components). Key components: `AlgorithmProfileManager` (grid of profile cards), `AlgorithmProfileEditor` (10 weight sliders + radar chart + live preview), `AlgorithmInsights` (topic affinities, engagement patterns, influence map), `ProfileQuickSwitch` (3-slot sidebar widget), `FeedAlgorithmIndicator` (header badge), `AlgorithmOnboarding` (4-step full-page flow). New Redux slice `algorithm_profiles`. New dependency: `@mantine/charts@8.1.1`.

#### `consolidated/04-test-plan.md` (100+ lines)
Comprehensive test plan: ~250 test specifications across unit (models, serializers, scoring, cache), API integration (CRUD, weights, switching, duplication, preview, permissions), frontend components (manager, editor, radar chart, quick-switch, onboarding), 7 E2E journeys, 25 edge cases, 5 performance benchmarks, 37 accessibility items. Follows project test conventions (Django TestCase + DRF APIClient for backend, Vitest + Testing Library for frontend).

#### `consolidated/05-reference-research.md` (100+ lines)
Competitive analysis of 5 platforms' algorithm transparency:
- **Reddit:** Named sorts (Hot/Top/New) are highest-clarity transparency
- **Bluesky:** Tab-based feed switching is gold-standard UX; community-created feeds multiply value
- **YouTube:** Contextual "why" labels measurably improve trust at low implementation cost
- **Twitter/X:** Open-sourcing code is insufficient without user-facing controls
- **TikTok:** Generic explanations are worse than silence; feed reset is unique safety valve
- EU Digital Services Act compliance analysis: Article 27 (plain-language descriptions), Article 38 (non-algorithmic feed requirement), Article 40 (researcher access)

---

### Launch Execution (5 files)

#### `docs/plans/2026-02-07-launch-execution-checklist.md` (204 lines)
Week-by-week execution checklist converting planning artifacts into actionable items. 5 roles defined (Dev 1/2/3, QA Lead, Program Lead). Week 0: documentation reconciliation. Week 1: critical launch blockers (moderation, legal pages, email, password reset staging validation). Week 2: production infrastructure (CI/CD, env hardening, domain/SSL, monitoring). Week 3: quality gate and launch decision (frontend test expansion, backend regression, quality debt, dry run). Go/no-go checklist with 7 binary conditions. Parallel post-launch tracks listed (following, analytics, TypeScript migration, mobile).

#### `docs/plans/2026-02-07-launch-tracker.md` (55 lines)
Live status tracker with tabular status per week:
- **Week 0:** All 4 items DONE (document reconciliation, path normalization, timeline sync, tracker creation)
- **Week 1:** W1-1 (moderation) DONE, W1-2 (legal pages) DONE, W1-3 (email backend) DONE, W1-4 (password reset staging) BLOCKED (DNS resolution failure for `staging.receeps.com`), W1-5 (gate review) BLOCKED by W1-4
- **Week 2:** W2-1 (CI) DONE, W2-2 (CD) DONE, W2-3 (env verification) BLOCKED (AWS access needed), W2-4 (domain/SSL) BLOCKED, W2-5 (monitoring) IN_PROGRESS (Sentry wired, runtime validation pending), W2-6 (gate review) NOT_STARTED
- **Week 3:** W3-1 (frontend tests) DONE (9 files, 33 tests), W3-2 (backend regression) BLOCKED (Python 3.11 not available locally), W3-3 (quality debt) IN_PROGRESS (N+1 fix + dayjs/color cleanup landed), W3-4/W3-5 (dry run/go-no-go) NOT_STARTED

#### `docs/plans/2026-02-08-w1-4-password-reset-staging-checklist.md` (170 lines)
Staging verification checklist for password reset flow. 7 test scenarios: request reset for existing user, non-existing user (no enumeration), email delivery, valid reset link + auto-login, credential correctness, token reuse/tamper protection, mobile viewport. Latest execution attempt on 2026-02-08 via Playwright resulted in `ERR_NAME_NOT_RESOLVED` for `staging.receeps.com` -- all 7 checks BLOCKED. Includes evidence capture paths and pass/fail summary table.

#### `docs/plans/2026-02-08-week1-launch-blocker-verification.md` (47 lines)
Verification snapshot for Week 1 blockers. W1-1 through W1-3 verified DONE with evidence: frontend report UI tests passed (8 tests), comment flow tests still pass (14 tests), frontend production build passed, Python compile pass for all backend modules. W1-4 remains BLOCKED due to missing staging environment. Known constraint: backend Django test execution blocked by missing Python 3.11 runtime.

#### `docs/plans/2026-02-08-week2-week3-easy-items-execution.md` (100 lines)
Execution log for all locally-feasible Week 2/3 items:
- **Completed:** CI workflow (`.github/workflows/ci.yml`), CD workflow (`.github/workflows/deploy.yml`), frontend test expansion (5 new test files, 33 total tests passing)
- **In progress:** Sentry default enablement (wired in settings, runtime validation pending), N+1 serializer fix (`receipt_topics_map` pattern), dayjs cleanup across 9 active-path components, color variable cleanup in 2 CSS modules
- **Blocked:** Backend regression suite (Python 3.11 not available), AWS-side env/secrets/domain checks

---

## Key Themes & Trajectory

### Verification-First Design Philosophy
Every major feature decision -- from Wilson score credibility calculation to the algorithm profiles transparency system -- prioritizes trust and verification over engagement metrics. The platform explicitly positions itself as the antithesis of opaque, corporate-controlled algorithms.

### Comprehensive Engineering Process
The project demonstrates disciplined engineering practices: CLAUDE.md-driven standards, serializer directory conventions, shared utility patterns (`cache_utils.py`, `BaseModel`), conventional commits, protected branch workflow, and a skills system for Claude Code agents. The audit program formalizes this into a multi-team certification process.

### Launch Readiness Gap
While ~80% of user-facing features are complete, several launch blockers remain. The moderation system, legal pages, and email backend have been implemented (W1-1 through W1-3 DONE), but staging environment validation and production infrastructure verification are blocked on AWS access and DNS configuration. Backend test execution is blocked on Python 3.11 availability.

### Ambitious Forward Roadmap
Post-launch plans include: following system (generic FK model), analytics dashboard (recharts), social sharing (OG meta tags), TypeScript migration (174 files, 8 phases), user-controlled algorithm profiles (10 weight dimensions, ~250 test specs), and mobile apps (6 Android sprints through Google Play). The algorithm profiles feature is the most ambitious -- it proposes transparent, per-user feed control with competitive research backing from 5 platforms and EU DSA compliance.

### Multi-Agent Development Model
The documentation frequently references multi-agent development workflows: parallel subagents for implementation, agent team assignments per migration phase, and the superpowers plugin skill system. The TypeScript migration plan specifies up to 5 concurrent agents. The audit program defines 7 parallel workstreams with cross-team handoff SLAs.

---

## Comprehensive Detail for High-Impact Documents

### Filter Overhaul Sprint 2 (Sort Toolbar & Algorithms)
This is the technical foundation for Receeps' ranking system. The 5 ranking algorithms are defined with complete Django ORM implementations. The Wilson score lower bound formula replaces simple averaging to prevent low-sample-size receipts from dominating. Each algorithm is annotated as a queryset operation to avoid N+1 queries. The `ReceiptOrderingFilter` class integrates with DRF's `OrderingFilter` to expose all sort options via URL query parameters (`?ordering=hot`, `?ordering=rising`, etc.), making feed state shareable via links.

### Launch Readiness Assessment
The most decision-dense document. Summarizes 13 months of development across 8 phases. The "What's NOT Implemented" table is the definitive scope reference -- it maps every planned feature to whether a spec exists and its launch priority. The 4-phase launch plan provides a concrete 3-week path to web launch. The 5 decision points (MVP scope, moderation approach, hosting, following timing, feature branches) represent unresolved architectural choices.

### Algorithm Profiles Package
The most forward-looking feature specification. The 6-document consolidated package represents a complete product-to-implementation spec with: resolved cross-team decisions, 28 user stories across 5 personas, 5-model data architecture, scoring engine with 10 weight dimensions, ~30-component frontend hierarchy, ~250 test specifications, and competitive research from 5 platforms plus EU regulatory analysis. The feature flag rollout strategy (staff -> beta -> 10% -> 50% -> 100%) demonstrates production deployment maturity.

### Audit Program
The most governance-heavy documentation. The 8-week certification program with 7 parallel workstreams establishes enterprise-grade quality processes: severity taxonomy, weekly gate criteria, cross-team handoff SLAs (2-3 business days), co-review requirements for Critical findings, and escalation protocols. The product/mission alignment playbook introduces a mission pillar scorecard -- a structured way to verify that implementation matches stated values.

---

## Cross-References to `/Apps/docs`

| Receeps Doc | Related Workspace Doc | Relationship |
|-------------|----------------------|--------------|
| `docs/plans/2026-02-06-launch-readiness-assessment.md` | `/Apps/docs/reports/` | Launch assessment could feed into a workspace-level status report |
| `CLAUDE.md` (Receeps) | `/Apps/CLAUDE.md` (root) | Root CLAUDE.md indexes Receeps and summarizes its stack/commands |
| `docs/plans/2026-02-05-android-sprint-plan.md` | EasyStreet docs (Parks/) | Both involve mobile app development; EasyStreet is native Swift/Kotlin while Receeps mobile is React Native |
| `docs/plans/2026-02-06-typescript-migration-plan.md` | `/Apps/docs/guides/` | TypeScript migration guide could be generalized as a workspace guide |
| `docs/plans/2026-02-07-audit-program/` | `/Apps/docs/templates/` | Audit playbook templates could be promoted to workspace-level reusable templates |

---

## File Inventory

| # | File | Lines | Category |
|---|------|-------|----------|
| 1 | `filter-overhaul/00-overview-and-index.md` | 253 | Filter Overhaul |
| 2 | `filter-overhaul/01-sidebar-restructure.md` | 1,463 | Filter Overhaul |
| 3 | `filter-overhaul/02-sort-toolbar-and-algorithms.md` | 1,983 | Filter Overhaul |
| 4 | `filter-overhaul/03-explore-page.md` | 1,217 | Filter Overhaul |
| 5 | `filter-overhaul/04-favorites-and-follow-system.md` | 1,595 | Filter Overhaul |
| 6 | `filter-overhaul/05-responsive-and-polish.md` | 1,612 | Filter Overhaul |
| 7 | `receeps_filter_overhaul_design_plan.md` | 590 | Filter Overhaul |
| 8 | `plans/2026-02-04-code-review-standards-design.md` | 54 | Design & Architecture |
| 9 | `plans/2026-02-05-analytics-sharing.md` | ~2,100 | Design & Architecture |
| 10 | `plans/2026-02-05-android-sprint-plan.md` | 581 | Design & Architecture |
| 11 | `plans/2026-02-05-following-system.md` | ~3,000+ | Design & Architecture |
| 12 | `plans/2026-02-05-moderation-reporting.md` | ~1,500 | Design & Architecture |
| 13 | `plans/2026-02-06-typescript-llm-leverage-guide.md` | 566 | Design & Architecture |
| 14 | `plans/2026-02-06-typescript-migration-plan.md` | 392 | Design & Architecture |
| 15 | `plans/2026-02-06-launch-readiness-assessment.md` | 312 | Design & Architecture |
| 16 | `plans/2026-02-07-audit-program/README.md` | 53 | Audit Program |
| 17 | `plans/2026-02-07-audit-program/00-context-and-program-charter.md` | 100 | Audit Program |
| 18 | `plans/2026-02-07-audit-program/01-backend-code-audit-playbook.md` | 100 | Audit Program |
| 19 | `plans/2026-02-07-audit-program/02-frontend-audit-and-dark-theme-redesign-playbook.md` | 100+ | Audit Program |
| 20 | `plans/2026-02-07-audit-program/03-architecture-audit-playbook.md` | 90 | Audit Program |
| 21 | `plans/2026-02-07-audit-program/04-security-audit-playbook.md` | 92 | Audit Program |
| 22 | `plans/2026-02-07-audit-program/05-product-mission-alignment-audit-playbook.md` | 87 | Audit Program |
| 23 | `plans/2026-02-07-audit-program/06-enhancement-and-new-feature-options-playbook.md` | 100 | Audit Program |
| 24 | `plans/2026-02-07-audit-program/07-qa-validation-and-certification-gates.md` | 80+ | Audit Program |
| 25 | `plans/2026-02-07-audit-program/08-cross-team-interface-and-handoff-matrix.md` | 80 | Audit Program |
| 26 | `plans/2026-02-08-algorithm-profiles/consolidated/00-executive-summary.md` | 100+ | Algorithm Profiles |
| 27 | `plans/2026-02-08-algorithm-profiles/consolidated/01-product-specification.md` | 100+ | Algorithm Profiles |
| 28 | `plans/2026-02-08-algorithm-profiles/consolidated/02-backend-architecture.md` | 100+ | Algorithm Profiles |
| 29 | `plans/2026-02-08-algorithm-profiles/consolidated/03-frontend-specification.md` | 100+ | Algorithm Profiles |
| 30 | `plans/2026-02-08-algorithm-profiles/consolidated/04-test-plan.md` | 100+ | Algorithm Profiles |
| 31 | `plans/2026-02-08-algorithm-profiles/consolidated/05-reference-research.md` | 100+ | Algorithm Profiles |
| 32 | `plans/2026-02-07-launch-execution-checklist.md` | 204 | Launch Execution |
| 33 | `plans/2026-02-07-launch-tracker.md` | 55 | Launch Execution |
| 34 | `plans/2026-02-08-w1-4-password-reset-staging-checklist.md` | 170 | Launch Execution |
| 35 | `plans/2026-02-08-week1-launch-blocker-verification.md` | 47 | Launch Execution |
| 36 | `plans/2026-02-08-week2-week3-easy-items-execution.md` | 100 | Launch Execution |
