# Sprint Action Plans - 2026-03-05

> 8 large-scope action plans across mcp-apps, MyLife, and Arena.
> Each plan is self-contained with full agent prompts, acceptance criteria, and team composition.
> Generated from deep-dive exploration of all three codebases + agentic engineering best practices research.

---

## Table of Contents

1. [Plan 1: mcp-apps Production Launch Sprint](#plan-1-mcp-apps-production-launch-sprint)
2. [Plan 2: mcp-apps GTM & Demo Agent Pipeline](#plan-2-mcp-apps-gtm--demo-agent-pipeline)
3. [Plan 3: MyLife Phase 2 Module Migration](#plan-3-mylife-phase-2-module-migration)
4. [Plan 4: MyLife Phase 3 Auth & Monetization](#plan-4-mylife-phase-3-auth--monetization)
5. [Plan 5: Arena Multiplayer Foundation](#plan-5-arena-multiplayer-foundation)
6. [Plan 6: Arena Content Expansion Pipeline](#plan-6-arena-content-expansion-pipeline)
7. [Plan 7: Cross-Project Skills Infrastructure Sprint](#plan-7-cross-project-skills-infrastructure-sprint)
8. [Plan 8: MyLife Tier 3 Module Build-Out](#plan-8-mylife-tier-3-module-build-out)

---

## How to Use These Plans

### Agent Orchestration Pattern

All plans use the **Orchestrator-Worker** pattern (Anthropic's recommended approach):
- **Lead agent** (Opus): Coordinates, decomposes tasks, reviews output
- **Worker agents** (Sonnet/Codex): Execute file-scoped implementation tasks
- **Validator agents** (Haiku/Sonnet): Run tests, check parity, verify acceptance criteria

### Model Routing

| Role | Model | Why |
|------|-------|-----|
| Team Lead / Orchestrator | Opus 4.6 | Complex reasoning, architecture decisions, task decomposition |
| Implementation Workers | Sonnet 4.6 or Codex 5.3 | Multi-file coding, debugging, feature implementation |
| Validation / Review | Haiku 4.5 or Sonnet 4.6 | Test execution, linting, parity checks, code review |
| Content Authoring | Sonnet 4.6 | JSON ability authoring, documentation, config generation |

### Execution Rules

1. **Read the full plan** before starting any work
2. **Complete phases in order** unless marked `parallel: true`
3. **Run acceptance criteria** after each phase before proceeding
4. **Commit after each phase** with descriptive messages
5. **If blocked**, add a `## Blockers` section to the plan and stop

### Acceptance Criteria Format

Each plan uses the **Feature List File** pattern. Create a `features.json` file at the plan's working directory:

```json
[
  { "id": "F001", "description": "...", "verification": "...", "passes": false }
]
```

Agents flip `passes` to `true` only after running verification. Never edit the description or verification fields.

---

## Pricing & Data Architecture (Approved Decisions)

### MyLife Pricing Model

MyLife uses a **one-time purchase** model, NOT subscriptions. This aligns with the privacy-first, local-first philosophy.

| Item | Price | Notes |
|------|-------|-------|
| **MyLife Hub app** | Free download, **$19.99 IAP** to unlock all modules | Includes all current and future MyLife modules |
| **Standalone apps** (MyCloset, MyStars, etc.) | **$4.99 each** | One-time purchase via RevenueCat/App Store |
| **Standalone-to-Hub entitlement bridge** | Free | Buying any standalone app (e.g., MyWorkouts $4.99) unlocks that module inside MyLife Hub at no additional cost |
| **Annual update fee** | **$9.99/year** (all apps bundled) | First year included free with purchase. After Year 1, $9.99/yr covers updates for MyLife hub + all standalone apps |

**Key rule:** No subscriptions for app access. The app works fully offline with local SQLite. Recurring fees are only for optional cloud storage.

### Data Architecture: Three Tiers

MyLife is **local-first by default**. Data stays on the user's device. Cloud sync is optional and paid.

| Tier | Name | Storage | Sync Method | Monthly Cost | Infrastructure |
|------|------|---------|-------------|-------------|----------------|
| **Tier 0** | Local-Only | Device SQLite | None | **$0** | Zero server cost |
| **Tier 1** | Device-to-Device | Device SQLite | **P2P via WebRTC** (direct between user's own devices) | **Free** (included with app purchase) | Minimal signaling server only (~$0/user) |
| **Tier 2** | Free Cloud | 1GB cloud + device | PowerSync (Supabase <-> SQLite) | **$0** | ~$0.14/mo per user (covered by app purchase revenue) |
| **Tier 3a** | Starter Cloud | 5GB cloud + device | PowerSync | **$2.99/mo** | ~$0.70/mo cost, ~$2.29 margin |
| **Tier 3b** | Power Cloud | 25GB cloud + device | PowerSync | **$5.99/mo** | ~$3.50/mo cost, ~$2.49 margin |

**P2P sync stack:** WebRTC data channels (`react-native-webrtc`) for transport + LiveStore for reactive local data layer + lightweight CRDT diff for merge resolution. Requires only a thin signaling server (Supabase Realtime or serverless WebSocket).

**Cloud sync stack:** PowerSync (production-ready, first-class Expo support) + Supabase PostgreSQL + Cloudflare R2 (file storage, $0 egress).

### mcp-apps Pricing Model (Unchanged)

Per-call micropayments via x402 (crypto) with Stripe API key auth as fallback. Translation server repriced from $0.005 to $0.0002/100 chars. See individual server SPEC.md files for per-tool pricing.

### Arena Pricing Model (Unchanged)

Free-to-play with cosmetic-only monetization. Battle pass (free + premium tracks), seasonal cosmetic rewards, character skins/effects. Zero pay-to-win.

---

## Plan 1: mcp-apps Production Launch Sprint

### Scope
**Project:** `/Users/trey/Desktop/Apps/mcp-apps`
**Focus:** Top 4 revenue servers + WebSocket transport + deployment infrastructure

### Business Context
The mcp-apps portfolio has 15 MCP servers at 85-95% completion, projecting $48.2K MRR at month 12. The top 4 servers (Structured Extractor, Document Parser, Knowledge Graph, Web Crawler) represent 87% of projected revenue. This plan gets them production-ready with WebSocket transport (required for OpenAI integration), HA database configs, and Fly.io deployment. Hitting $10K MRR within 6-10 weeks is the target.

### Technical Context
- **Stack:** Python 3.12, FastAPI, PostgreSQL, Redis, Docker, Fly.io
- **Payment:** x402 protocol (crypto micropayments per API call); needs Stripe fallback
- **Transport:** Currently HTTP-only; WebSocket support needed for real-time MCP clients
- **Testing:** 441+ tests across all servers; individual test suites per server
- **Deployment:** Dockerfiles exist per server; fly.toml configs present but untested in production
- **Critical gap:** Translation server pricing is 25x overpriced vs Google API

### Agent Team Composition

| Agent Name | Model | Role | Files Owned |
|------------|-------|------|-------------|
| `launch-lead` | Opus 4.6 | Orchestrator: task decomposition, integration review | Plan files, features.json |
| `extractor-dev` | Sonnet 4.6 | Structured Extractor production hardening | `mcp-structured-extractor/` |
| `parser-dev` | Sonnet 4.6 | Document Parser production hardening | `mcp-document-parser/` |
| `infra-dev` | Codex 5.3 | WebSocket transport + HA configs + Fly deployment | `*/Dockerfile`, `*/fly.toml`, shared infra |
| `validator` | Haiku 4.5 | Test runner, smoke tests, deployment verification | Read-only |

### Full Agent Prompts

#### Lead Agent Prompt (`launch-lead`)
```
You are the lead orchestrator for the mcp-apps Production Launch Sprint. Your job is to coordinate 3 worker agents to get the top 4 MCP servers production-ready.

## Context
Working directory: /Users/trey/Desktop/Apps/mcp-apps
The portfolio has 15 MCP servers. The top 4 by projected revenue are:
1. mcp-structured-extractor ($18.4K/mo projected, 90% complete)
2. mcp-document-parser ($12.2K/mo projected, 85% complete)
3. mcp-knowledge-graph ($6.4K/mo projected, 80% complete)
4. mcp-web-crawler ($5.0K/mo projected, 85% complete)

## Your Responsibilities
1. Read EXECUTIVE-STRATEGY-BRIEF.md, GTM-STRATEGY.md, and REVENUE-MODEL.md for full business context
2. Read each server's README.md, SPEC.md, and IMPLEMENTATION-PLAN.md
3. Identify the specific gaps between current state and production-ready for each server
4. Create task assignments for each worker with:
   - Specific objective and expected output
   - File paths they own (no overlap)
   - Upstream contracts (schemas, configs they consume)
   - Downstream obligations (what they produce for integration)
5. After workers complete, run integration tests across all 4 servers
6. Verify all acceptance criteria pass

## Acceptance Criteria (verify ALL before declaring done)
- [ ] F001: mcp-structured-extractor passes all existing tests + new integration tests
- [ ] F002: mcp-document-parser passes all existing tests + new integration tests
- [ ] F003: mcp-knowledge-graph passes all existing tests + handles concurrent queries
- [ ] F004: mcp-web-crawler passes all tests + respects robots.txt + rate limiting works
- [ ] F005: WebSocket transport works alongside HTTP for all 4 servers (test with wscat)
- [ ] F006: Docker images build and run for all 4 servers (docker build + docker run + health check)
- [ ] F007: fly.toml configs are valid (fly deploy --dry-run passes for each)
- [ ] F008: PostgreSQL connection pooling configured (PgBouncer or equivalent)
- [ ] F009: Redis HA config present (Sentinel or Fly Redis)
- [ ] F010: x402 payment flow tested end-to-end for at least 1 server
- [ ] F011: Translation server pricing updated from $0.005 to $0.0002/100 chars

## Constraints
- Do NOT modify servers outside the top 4 + shared infrastructure
- All changes must pass existing test suites before adding new tests
- Follow the FastAPI + x402 patterns established in the codebase
- Commit after each phase with descriptive messages
```

#### Worker Prompt: `extractor-dev`
```
You are a worker agent responsible for making mcp-structured-extractor production-ready.

## Working Directory
/Users/trey/Desktop/Apps/mcp-apps/mcp-structured-extractor

## Context
This server extracts structured data from unstructured text using LLM-powered parsing. It's the highest-revenue server ($18.4K/mo projected). Currently 90% complete.

## Your Tasks
1. Read README.md, SPEC.md, and all source files in src/
2. Identify gaps between current state and production:
   - Error handling: all tool endpoints must return structured errors, not stack traces
   - Rate limiting: implement per-client rate limiting (100 req/min default)
   - Input validation: all tool inputs validated with Pydantic models
   - Logging: structured JSON logging with request IDs for traceability
   - Health endpoint: GET /health returns 200 with version, uptime, dependency status
3. Fix all identified gaps
4. Add integration tests for each tool endpoint (happy path + error cases)
5. Run full test suite: pytest -v
6. Verify Docker build: docker build -t mcp-structured-extractor .

## Files You Own (exclusive)
- mcp-structured-extractor/**

## Acceptance Criteria
- [ ] All existing tests pass
- [ ] New integration tests cover each tool endpoint
- [ ] Health endpoint returns valid JSON with version and dependency checks
- [ ] Rate limiting returns 429 after threshold
- [ ] Error responses follow { "error": { "code": "...", "message": "..." } } format
- [ ] Docker image builds successfully under 500MB

## Constraints
- Do not modify any files outside mcp-structured-extractor/
- Follow existing code patterns (check other tools for style reference)
- All new code must have type annotations
```

#### Worker Prompt: `parser-dev`
```
You are a worker agent responsible for making mcp-document-parser production-ready.

## Working Directory
/Users/trey/Desktop/Apps/mcp-apps/mcp-document-parser

## Context
This server parses documents (PDF, DOCX, HTML, images) into structured text and metadata. Second-highest revenue server ($12.2K/mo projected). Currently 85% complete.

## Your Tasks
1. Read README.md, SPEC.md, and all source files in src/
2. Identify gaps between current state and production:
   - File size limits: enforce 50MB max upload, return 413 for oversized
   - Format detection: auto-detect input format from content-type and magic bytes
   - OCR fallback: when text extraction fails on images/scanned PDFs, return clear error with OCR suggestion
   - Streaming: large documents should stream results rather than buffer entire output
   - Health endpoint: GET /health with version, supported formats list, dependency status
3. Fix all identified gaps
4. Add integration tests for each supported format (PDF, DOCX, HTML, plain text, images)
5. Run full test suite: pytest -v
6. Verify Docker build: docker build -t mcp-document-parser .

## Files You Own (exclusive)
- mcp-document-parser/**

## Acceptance Criteria
- [ ] All existing tests pass
- [ ] Integration tests cover PDF, DOCX, HTML, plain text, and image inputs
- [ ] 50MB file size limit enforced with 413 response
- [ ] Health endpoint returns supported formats list
- [ ] Docker image builds successfully
- [ ] Large file (>10MB) processing doesn't OOM (tested with sample)

## Constraints
- Do not modify any files outside mcp-document-parser/
- Follow existing code patterns
- All new code must have type annotations
```

#### Worker Prompt: `infra-dev`
```
You are the infrastructure worker responsible for WebSocket transport, HA database configs, and deployment readiness for the top 4 mcp-apps servers.

## Working Directory
/Users/trey/Desktop/Apps/mcp-apps

## Context
All 15 MCP servers currently use HTTP-only transport. OpenAI's MCP integration requires WebSocket support. The top 4 servers (mcp-structured-extractor, mcp-document-parser, mcp-knowledge-graph, mcp-web-crawler) need production deployment to Fly.io with HA PostgreSQL and Redis.

## Your Tasks

### Phase 1: WebSocket Transport (all 4 servers)
1. Implement WebSocket endpoint alongside existing HTTP for each server
2. Use FastAPI WebSocket support (already available in the framework)
3. Maintain backward compatibility: HTTP endpoints unchanged, WS available at /ws
4. Add WS connection handling: ping/pong keepalive, graceful disconnect, error propagation
5. Test with wscat: wscat -c ws://localhost:PORT/ws

### Phase 2: HA Database Configs
1. Add PgBouncer connection pooling config to each server's Docker setup
2. Configure Redis Sentinel (or Fly Redis HA) connection strings
3. Add connection retry logic with exponential backoff to database clients
4. Add health check that verifies both PostgreSQL and Redis connectivity

### Phase 3: Fly.io Deployment
1. Validate each server's fly.toml (fly deploy --dry-run)
2. Add auto-scaling config: min 1, max 5 instances per server
3. Add health check endpoints to fly.toml
4. Create deploy script: scripts/deploy.sh [server-name] [staging|production]
5. Add smoke test script: scripts/smoke-test.sh [server-url]

### Phase 4: Translation Pricing Fix
1. In mcp-translation, update pricing from $0.005/100 chars to $0.0002/100 chars
2. Update SPEC.md, README.md, and any x402 pricing config

## Files You Own
- */Dockerfile (all servers)
- */fly.toml (all servers)
- */docker-compose*.yml
- scripts/ (new directory for deploy/smoke scripts)
- mcp-translation/src/**/pricing* or equivalent config

## Acceptance Criteria
- [ ] WebSocket endpoint responds to wscat connection on all 4 servers
- [ ] HTTP endpoints still work unchanged (backward compatibility)
- [ ] PgBouncer config present in Docker setup
- [ ] Redis connection retry logic handles 3 failures before raising
- [ ] fly deploy --dry-run passes for all 4 servers
- [ ] Deploy script exists and is executable
- [ ] Smoke test script verifies health endpoint returns 200
- [ ] Translation pricing updated to $0.0002/100 chars in all references

## Constraints
- Do not modify application logic in any server's src/ code (only infrastructure)
- Exception: WebSocket endpoint addition and translation pricing requires minimal src/ changes
- Use existing patterns from the codebase for consistency
```

### Task Breakdown

| Phase | Tasks | Agents | Parallel? |
|-------|-------|--------|-----------|
| 1. Assessment | Lead reads all strategy docs and server READMEs | `launch-lead` | No |
| 2. Server Hardening | Production hardening for top 4 servers | `extractor-dev`, `parser-dev` | Yes (parallel) |
| 3. Infrastructure | WebSocket + HA + deployment configs | `infra-dev` | Yes (parallel with Phase 2) |
| 4. Integration | Cross-server integration tests, smoke tests | `launch-lead` + `validator` | No (after 2+3) |
| 5. Translation Fix | Pricing update | `infra-dev` | Yes (parallel with Phase 4) |

### Acceptance Criteria Summary
11 feature criteria (F001-F011). Plan is complete when all 11 pass.

### Estimated Complexity
- **Effort:** Large (3-5 agent sessions)
- **Parallelization:** 3 workers run simultaneously in Phase 2-3
- **Risk:** Medium (WebSocket transport is new pattern; test thoroughly)
- **Token budget:** ~500K tokens estimated (lead + 3 workers + validator)

---

## Plan 2: mcp-apps GTM & Demo Agent Pipeline

### Scope
**Project:** `/Users/trey/Desktop/Apps/mcp-apps`
**Focus:** Demo agents, marketplace presence, Stripe payment fallback, marketing assets

### Business Context
Having production-ready servers (Plan 1) is necessary but insufficient. Revenue requires discoverability and conversion. Each MCP server needs a compelling demo agent that showcases its capabilities, plus Stripe integration as fallback for users who don't have x402 wallets. Target: 500 agents using the platform within Month 1, driving $4.8K MRR.

### Technical Context
- **Demo format:** Python scripts that chain MCP tool calls into useful workflows
- **x402 limitation:** Most early adopters won't have crypto wallets; Stripe API key auth needed
- **Marketplace targets:** Anthropic MCP registry, OpenAI plugin store, HuggingFace Spaces
- **GTM channels:** Hacker News, Reddit (r/MCP, r/ClaudeAI), Product Hunt, Apify marketplace

### Agent Team Composition

| Agent Name | Model | Role | Files Owned |
|------------|-------|------|-------------|
| `gtm-lead` | Opus 4.6 | Strategy, demo design, marketplace submissions | Plan files, GTM docs |
| `demo-builder-1` | Sonnet 4.6 | Demo agents for Structured Extractor + Document Parser | `demos/research-agent/`, `demos/data-pipeline/` |
| `demo-builder-2` | Sonnet 4.6 | Demo agents for Knowledge Graph + Web Crawler | `demos/knowledge-builder/`, `demos/web-monitor/` |
| `stripe-dev` | Codex 5.3 | Stripe payment integration as x402 fallback | `*/src/**/payment*`, `*/src/**/billing*` |

### Full Agent Prompts

#### Lead Agent Prompt (`gtm-lead`)
```
You are the GTM lead for the mcp-apps marketplace launch. Your job is to coordinate demo agent creation, Stripe integration, and marketplace submission materials.

## Working Directory
/Users/trey/Desktop/Apps/mcp-apps

## Context
Read EXECUTIVE-STRATEGY-BRIEF.md, GTM-STRATEGY.md, and REVENUE-MODEL.md for full business context. The top 4 servers are being production-hardened (Plan 1, may be in progress). Your job is the commercial layer.

## Your Responsibilities
1. Design 4 demo agents that showcase the top 4 servers:
   - Research Agent: chains Structured Extractor + Web Crawler to research a topic and produce a structured report
   - Data Pipeline Agent: chains Document Parser + Structured Extractor to ingest documents and extract structured data
   - Knowledge Builder Agent: chains Knowledge Graph + Web Crawler to build a knowledge graph from web sources
   - Web Monitor Agent: uses Web Crawler + Structured Extractor to monitor web pages for changes
2. Assign demo-builder-1 and demo-builder-2 to implement these (2 each)
3. Coordinate Stripe integration with stripe-dev
4. Prepare marketplace submission materials:
   - Server descriptions (1 paragraph each, benefit-focused)
   - README badges (tests passing, uptime, pricing)
   - Screenshot/GIF of demo agents in action (describe what to capture)
5. Create docs/MARKETPLACE-LAUNCH.md with submission checklist

## Acceptance Criteria
- [ ] F012: Research Agent demo runs end-to-end, producing a structured report from a URL
- [ ] F013: Data Pipeline demo ingests a PDF and outputs structured JSON
- [ ] F014: Knowledge Builder demo creates a graph from 3 web pages
- [ ] F015: Web Monitor demo detects content changes between two fetches
- [ ] F016: Stripe payment integration works for at least 1 server (test mode)
- [ ] F017: Stripe + x402 dual payment: server accepts either payment method
- [ ] F018: Each server has a 1-paragraph marketplace description in README
- [ ] F019: MARKETPLACE-LAUNCH.md exists with submission checklist for Anthropic + OpenAI registries
- [ ] F020: Demo agents have usage instructions in demos/README.md

## Constraints
- Demos must use only the MCP tool APIs (no direct database access)
- Stripe integration must not break existing x402 flow
- All demo scripts must be runnable with: python demos/<name>/run.py
```

#### Worker Prompt: `demo-builder-1`
```
You build demo agents that showcase mcp-apps MCP servers. You are responsible for 2 demos.

## Working Directory
/Users/trey/Desktop/Apps/mcp-apps

## Your Tasks

### Demo 1: Research Agent (demos/research-agent/)
Build a Python script that demonstrates chaining mcp-structured-extractor + mcp-web-crawler:
1. Accept a research topic as input
2. Use web-crawler to fetch 5 relevant URLs
3. Use structured-extractor to pull key facts from each page
4. Aggregate into a structured report (JSON + Markdown output)
5. Include error handling for failed crawls and extraction timeouts

Files to create:
- demos/research-agent/run.py (main script)
- demos/research-agent/README.md (usage, example output)
- demos/research-agent/requirements.txt

### Demo 2: Data Pipeline Agent (demos/data-pipeline/)
Build a Python script that demonstrates chaining mcp-document-parser + mcp-structured-extractor:
1. Accept a file path (PDF, DOCX, or HTML) as input
2. Use document-parser to extract text content
3. Use structured-extractor to parse into structured fields (configurable schema)
4. Output as JSON to stdout and optionally to file
5. Include batch mode: process all files in a directory

Files to create:
- demos/data-pipeline/run.py (main script)
- demos/data-pipeline/README.md (usage, example output)
- demos/data-pipeline/requirements.txt
- demos/data-pipeline/sample-schema.json (example extraction schema)

## Acceptance Criteria
- [ ] Research Agent produces valid JSON report from a topic string
- [ ] Data Pipeline processes a PDF and outputs structured JSON
- [ ] Both demos have README with clear usage instructions
- [ ] Both demos handle errors gracefully (no stack traces to user)
- [ ] Both demos runnable with: python demos/<name>/run.py

## Constraints
- Use only MCP tool APIs via HTTP (or WebSocket if available)
- Include --dry-run flag that shows what would happen without making API calls
- All Python code must have type hints
```

#### Worker Prompt: `stripe-dev`
```
You implement Stripe payment integration as a fallback alongside x402 for mcp-apps servers.

## Working Directory
/Users/trey/Desktop/Apps/mcp-apps

## Context
All 15 MCP servers use x402 (crypto micropayments) for billing. Most early adopters won't have crypto wallets, so we need Stripe API key authentication as an alternative. Users get a Stripe-issued API key, each call is metered, billed monthly.

## Your Tasks

### Phase 1: Stripe SDK Integration
1. Read existing x402 payment flow in any server's src/ to understand the pattern
2. Create a shared payment middleware that supports BOTH x402 and Stripe:
   - If request has x402 payment header: use existing flow
   - If request has Authorization: Bearer sk_... header: validate Stripe API key, meter usage
   - If neither: return 402 Payment Required with instructions for both methods
3. Implement the middleware as a reusable FastAPI dependency

### Phase 2: Stripe Metering
1. Use Stripe's Usage Records API for per-call metering
2. Create Stripe Products + Prices for each server (matching x402 pricing)
3. Implement usage reporting: each API call increments the meter
4. Add billing portal link in 402 response for account management

### Phase 3: Integration into Top 4 Servers
1. Add the shared payment middleware to each of the top 4 servers
2. Verify x402 still works unchanged (backward compatibility)
3. Test Stripe flow end-to-end in test mode

## Files You Own
- shared/payment/ (new shared middleware package)
- */src/**/payment* or */src/**/middleware* (payment-related code in each server)

## Acceptance Criteria
- [ ] Stripe API key authentication works for at least 1 server
- [ ] x402 payment still works unchanged (no regression)
- [ ] 402 response includes instructions for both payment methods
- [ ] Usage metering records each API call in Stripe
- [ ] Stripe test mode: create key, make call, verify usage record appears

## Constraints
- Must not break existing x402 flow
- Use Stripe test mode keys only (no production keys in code)
- API keys must be validated on every request (no caching without TTL)
```

### Task Breakdown

| Phase | Tasks | Agents | Parallel? |
|-------|-------|--------|-----------|
| 1. Strategy | Lead designs demo concepts, reads all SPEC.mds | `gtm-lead` | No |
| 2. Demo Build | 4 demo agents implemented | `demo-builder-1`, `demo-builder-2` | Yes |
| 3. Stripe | Payment fallback integration | `stripe-dev` | Yes (parallel with Phase 2) |
| 4. Integration | Demos work with Stripe auth, marketplace docs | `gtm-lead` | No (after 2+3) |

### Acceptance Criteria Summary
9 feature criteria (F012-F020). Plan is complete when all 9 pass.

### Estimated Complexity
- **Effort:** Large (3-4 agent sessions)
- **Parallelization:** 3 workers parallel in Phase 2-3
- **Risk:** Medium (Stripe integration is well-documented but untested in this codebase)
- **Token budget:** ~400K tokens estimated
- **Dependency:** Benefits from Plan 1 completion (servers should be production-hardened first)

---

## Plan 3: MyLife Phase 2 Module Migration

### Scope
**Project:** `/Users/trey/Desktop/Apps/MyLife`
**Focus:** Complete hub migration for MyBudget, MyFast, MyRecipes + full parity validation

### Business Context
MyLife Phase 2 is the critical gate to monetization. Until Budget, Fast, and Recipes are fully wired into the hub with parity validation passing, Phase 3 (Auth, Payments & Data Architecture) cannot begin. These three modules represent core daily-use functionality that drives the $19.99 hub purchase. MyBooks (Phase 1) is already done and serves as the reference implementation.

### Technical Context
- **Monorepo:** Turborepo + pnpm, apps/mobile (Expo), apps/web (Next.js 15)
- **Database:** Single SQLite file with table prefixes (bk_, bg_, ft_, rc_)
- **Module system:** `@mylife/module-registry` handles dynamic registration, `@mylife/db` orchestrates schema
- **Parity enforcement:** `pnpm check:parity` gates all releases; standalone and hub must be identical
- **Reference implementation:** MyBooks migration (Phase 1) is the pattern to follow
- **MyMeds:** Already completed in Phase 2 (2026-02-28), can also serve as reference
- **Known state:** MyBudget has 200+ subscription catalog integrated; MyFast has fast logging with tags; MyRecipes has meal planning + grocery lists

### Agent Team Composition

| Agent Name | Model | Role | Files Owned |
|------------|-------|------|-------------|
| `migration-lead` | Opus 4.6 | Orchestrator: task decomposition, parity review | Plan files, features.json |
| `budget-dev` | Sonnet 4.6 | MyBudget hub migration | `modules/budget/`, MyBudget standalone reference (read-only) |
| `fast-dev` | Sonnet 4.6 | MyFast hub migration | `modules/fast/`, MyFast standalone reference (read-only) |
| `recipes-dev` | Sonnet 4.6 | MyRecipes hub migration | `modules/recipes/`, MyRecipes standalone reference (read-only) |
| `parity-checker` | Haiku 4.5 | Runs parity validation after each migration | Read-only, runs pnpm check:parity |

### Full Agent Prompts

#### Lead Agent Prompt (`migration-lead`)
```
You are the migration lead for MyLife Phase 2. Your job is to coordinate 3 workers migrating MyBudget, MyFast, and MyRecipes from standalone apps into the MyLife hub.

## Working Directory
/Users/trey/Desktop/Apps/MyLife

## Context
Read CLAUDE.md thoroughly. It contains:
- The full module registry architecture
- Database table prefix conventions
- Parity enforcement rules
- Phase roadmap (you are completing Phase 2)

## Reference Implementations
Study these completed migrations as patterns:
1. MyBooks: modules/books/ (Phase 1 reference)
2. MyMeds: modules/meds/ (Phase 2 reference, completed 2026-02-28)

## Your Responsibilities
1. Read CLAUDE.md, packages/module-registry/src/, and packages/db/src/ to understand the hub architecture
2. Study the MyBooks and MyMeds module implementations as reference patterns
3. For each of the 3 modules, create task assignments:
   - Read the standalone app's CLAUDE.md, schema, and routes
   - Generate ModuleDefinition with correct table prefix, navigation config, and feature flags
   - Wire schema into packages/db migration orchestrator
   - Wire routes into apps/mobile/ and apps/web/
   - Create data importer in packages/migration/ for users upgrading from standalone
4. After each worker completes, run parity-checker
5. Run full suite: pnpm test && pnpm check:parity && pnpm typecheck

## Acceptance Criteria
- [ ] F021: MyBudget module registered in module-registry with bg_ table prefix
- [ ] F022: MyBudget hub routes render identically to standalone (all 5 tabs)
- [ ] F023: MyBudget subscription catalog (200+ entries) accessible in hub
- [ ] F024: MyFast module registered with ft_ table prefix
- [ ] F025: MyFast hub routes render identically to standalone (day/week/month views)
- [ ] F026: MyFast tag system works in hub context
- [ ] F027: MyRecipes module registered with rc_ table prefix
- [ ] F028: MyRecipes hub routes render identically to standalone (recipes, meal plans, grocery lists)
- [ ] F029: pnpm check:parity passes for all 3 new modules
- [ ] F030: pnpm typecheck passes across entire workspace
- [ ] F031: pnpm test passes (all existing + new tests)
- [ ] F032: Data importers exist for all 3 modules (standalone SQLite -> hub SQLite migration)
- [ ] F033: Module navigation icons appear in hub sidebar (web) and tab bar (mobile)

## Constraints
- Do NOT modify standalone submodule code (those are canonical sources)
- Hub implementations are parity adapters, not independent rewrites
- Follow the exact patterns from MyBooks and MyMeds modules
- Table prefixes: bg_ (budget), ft_ (fast), rc_ (recipes) -- verify these against CLAUDE.md
- Commit after each module migration with: "feat(mylife): migrate My{Name} to hub module"
```

#### Worker Prompt: `budget-dev`
```
You are responsible for migrating MyBudget into the MyLife hub as a module.

## Working Directory
/Users/trey/Desktop/Apps/MyLife

## Context
MyBudget is a standalone Expo + Next.js app at /Users/trey/Desktop/Apps/MyLife/MyBudget/ (git submodule). It implements envelope budgeting with a 200+ entry subscription catalog, bank CSV import, and expense tracking. Your job is to create the hub module that wraps this functionality.

## Reference Implementation
Study modules/books/ (MyBooks) and modules/meds/ (MyMeds) to understand the exact pattern:
1. ModuleDefinition export (id, name, icon, tablePrefix, navigation, screens)
2. Schema re-export with table prefix applied
3. Route wiring in apps/mobile/ and apps/web/
4. Data importer for standalone -> hub migration

## Your Tasks

### Phase 1: Read and Understand
1. Read MyBudget/CLAUDE.md for architecture overview
2. Read MyBudget/packages/shared/src/db/schema.ts for table definitions
3. Read MyBudget/apps/mobile/app/ for route structure (5 tabs)
4. Read MyBudget/apps/web/app/ for web route structure
5. Read modules/books/ completely as the reference pattern

### Phase 2: Create Module
1. Create modules/budget/src/index.ts with ModuleDefinition
2. Create modules/budget/src/schema.ts re-exporting schema with bg_ prefix
3. Create modules/budget/src/navigation.ts with 5-tab config
4. Create modules/budget/package.json as @mylife/budget
5. Add to pnpm-workspace.yaml if not already listed

### Phase 3: Wire Routes
1. Add budget routes to apps/mobile/app/ following the books pattern
2. Add budget routes to apps/web/app/ following the books pattern
3. Register module in packages/module-registry
4. Add bg_ tables to packages/db migration orchestrator

### Phase 4: Data Importer
1. Create packages/migration/src/budget-importer.ts
2. Import reads standalone MyBudget SQLite, writes to hub SQLite with bg_ prefix
3. Handle subscription catalog entries, envelope definitions, transactions, recurring templates

### Phase 5: Validate
1. Run pnpm typecheck
2. Run pnpm test
3. Verify mobile renders all 5 tabs
4. Verify web renders all pages

## Files You Own
- modules/budget/** (new)
- apps/mobile/app/*budget* routes (new)
- apps/web/app/*budget* routes (new)
- packages/migration/src/budget-importer.ts (new)

## Acceptance Criteria
- [ ] ModuleDefinition exports correctly with bg_ table prefix
- [ ] All 5 tabs render in both mobile and web
- [ ] Subscription catalog (200+ entries) loads in hub context
- [ ] Data importer converts standalone SQLite to hub format
- [ ] pnpm typecheck passes
- [ ] pnpm test passes

## Constraints
- Do NOT modify MyBudget/ standalone code (read-only reference)
- Follow MyBooks module pattern exactly
- Table prefix: bg_ (verify against hub CLAUDE.md)
```

#### Worker Prompts: `fast-dev` and `recipes-dev`
```
[Same structure as budget-dev, substituting:]

fast-dev:
- Module: MyFast, prefix: ft_
- Features: Fast logging, day/week/month views, tags, export
- Standalone: /Users/trey/Desktop/Apps/MyLife/MyFast/
- Tabs: varies (read standalone to determine)

recipes-dev:
- Module: MyRecipes, prefix: rc_
- Features: Recipe management, meal planning, grocery lists
- Standalone: /Users/trey/Desktop/Apps/MyLife/MyRecipes/ (or appropriate submodule path)
- Tabs: varies (read standalone to determine)
```

### Task Breakdown

| Phase | Tasks | Agents | Parallel? |
|-------|-------|--------|-----------|
| 1. Assessment | Lead reads hub architecture + all 3 standalone apps | `migration-lead` | No |
| 2. Module Creation | 3 modules created simultaneously | `budget-dev`, `fast-dev`, `recipes-dev` | Yes |
| 3. Parity Validation | Run parity checks on each completed module | `parity-checker` | After each module completes |
| 4. Integration | Cross-module integration, full test suite, typecheck | `migration-lead` | No (after all 3) |

### Acceptance Criteria Summary
13 feature criteria (F021-F033). Plan is complete when all 13 pass.

### Estimated Complexity
- **Effort:** Large (4-6 agent sessions)
- **Parallelization:** 3 module devs run simultaneously
- **Risk:** Medium (parity enforcement is strict; follow reference implementation closely)
- **Token budget:** ~600K tokens estimated (lead + 3 workers + parity checker)
- **Dependency:** None (this unlocks Plan 4)

---

## Plan 4: MyLife Phase 3 Auth, Payments & Local-First Data Architecture

### Scope
**Project:** `/Users/trey/Desktop/Apps/MyLife`
**Focus:** Supabase Auth + one-time IAP (RevenueCat) + storage billing (Stripe) + local-first data architecture + P2P device sync + cloud sync tiers

### Business Context
Phase 3 converts MyLife from a free app into a revenue-generating product using a **one-time purchase model** (not subscriptions). The app is free to download. A **$19.99 IAP** unlocks all modules (current and future). Individual standalone apps remain **$4.99 each**, and purchasing any standalone app entitles the user to access that module inside MyLife Hub at no extra cost. After the first year, a **$9.99/year update fee** covers continued updates for all apps.

Revenue comes from two streams:
1. **App purchases:** $19.99 (hub) or $4.99 (standalone) one-time
2. **Cloud storage:** Optional recurring fees for users who want cloud sync ($2.99/mo or $5.99/mo)

The data architecture is **local-first and decentralized by default**. User data stays on their devices. Messaging and sync between a user's devices flows peer-to-peer via WebRTC without touching our servers. Cloud sync is an optional paid upgrade.

### Technical Context
- **Auth package:** `packages/auth/` is scaffolded with Supabase Auth wrapper (not wired). Auth is optional -- only required for cloud sync tiers
- **Entitlements package:** `packages/entitlements/` has billing SKU config and feature gates (functional). Needs rewrite from subscription model to one-time purchase + standalone bridge
- **Billing config:** `packages/billing-config/` has tier definitions (functional). Needs rewrite for new pricing
- **RevenueCat:** Used for App Store/Play Store IAP (one-time purchases, not subscriptions)
- **Stripe:** Used for web direct purchases + cloud storage metered billing
- **PowerSync:** Production-ready bidirectional sync (Supabase PostgreSQL <-> local SQLite). First-class Expo support
- **LiveStore:** Reactive local-first data layer with event-sourcing on SQLite. Expo-endorsed
- **WebRTC:** `react-native-webrtc` for P2P device-to-device data transfer. Needs thin signaling server
- **Storage costs:** Supabase DB at $0.125/GB + Cloudflare R2 at $0.015/GB + $0 egress. Per-user cost: ~$0.14/mo at 1GB

### Data Architecture Tiers

| Tier | Name | Storage | Sync | Cost to User | Cost to Us |
|------|------|---------|------|-------------|------------|
| **0** | Local-Only | Device SQLite | None | $0 | $0 |
| **1** | Device-to-Device | Device SQLite | P2P via WebRTC | Free (included with purchase) | ~$0/user (signaling server) |
| **2** | Free Cloud | 1GB cloud + device | PowerSync | $0 | ~$0.14/mo (covered by app purchase) |
| **3a** | Starter Cloud | 5GB cloud + device | PowerSync | $2.99/mo | ~$0.70/mo |
| **3b** | Power Cloud | 25GB cloud + device | PowerSync | $5.99/mo | ~$3.50/mo |

### Agent Team Composition

| Agent Name | Model | Role | Files Owned |
|------------|-------|------|-------------|
| `auth-lead` | Opus 4.6 | Orchestrator: architecture, entitlement flow design, integration | Plan files |
| `auth-dev` | Sonnet 4.6 | Supabase Auth (optional for cloud), entitlement system | `packages/auth/`, `packages/entitlements/` |
| `payments-dev` | Sonnet 4.6 | RevenueCat IAP + Stripe storage billing + standalone bridge | `packages/subscription/`, `packages/billing-config/` |
| `sync-dev` | Codex 5.3 | PowerSync cloud sync + WebRTC P2P + LiveStore local layer | `packages/sync/` (new), `packages/db/` sync additions |
| `paywall-dev` | Sonnet 4.6 | Purchase UI + storage tier selection + module gate wiring | apps/mobile purchase flow, apps/web purchase flow |

### Full Agent Prompts

#### Lead Agent Prompt (`auth-lead`)
```
You are the lead for MyLife Phase 3: Auth, Payments & Local-First Data Architecture. This is the revenue gate AND the data architecture foundation for the entire product.

## Working Directory
/Users/trey/Desktop/Apps/MyLife

## Context
Read CLAUDE.md thoroughly. Phase 2 must be complete before this plan executes. Your job is to wire the one-time purchase model, entitlement bridge, optional auth, and three-tier data sync architecture.

## CRITICAL: Pricing Model (NOT Subscriptions)
MyLife does NOT use subscriptions for app access. The model is:
- Free download from App Store / Play Store / Web
- $19.99 one-time IAP unlocks ALL MyLife modules (current + future)
- Individual standalone apps: $4.99 each
- ENTITLEMENT BRIDGE: If a user bought MyWorkouts standalone ($4.99), they can access MyWorkouts inside MyLife Hub for free. The standalone purchase carries over.
- After Year 1: $9.99/year optional update fee for all apps
- Cloud storage: $0 for 1GB free tier, $2.99/mo for 5GB, $5.99/mo for 25GB
- NO subscription required to use the app. App works fully offline with local SQLite.

## Data Architecture (Local-First, Decentralized Default)
- Tier 0 (Local-Only): All data in device SQLite. Zero network calls. This is the DEFAULT.
- Tier 1 (P2P Sync): User's own devices sync directly via WebRTC data channels. Near-zero server cost (thin signaling server only). FREE with app purchase.
- Tier 2 (Free Cloud): 1GB cloud storage via PowerSync (Supabase <-> SQLite sync). Costs us ~$0.14/mo per user. Requires Supabase Auth (email/password).
- Tier 3a (Starter Cloud): 5GB, $2.99/mo. PowerSync + Supabase + Cloudflare R2.
- Tier 3b (Power Cloud): 25GB, $5.99/mo. Same stack, higher limits.

Auth is OPTIONAL. Only required for cloud sync tiers (2, 3a, 3b). Local-only and P2P users never need an account.

## Scaffolded Packages (exist, need rewrite for new model)
- packages/auth/ -- Supabase Auth wrapper, stubbed. Make auth OPTIONAL (only for cloud tiers)
- packages/subscription/ -- Was RevenueCat subscriptions. REWRITE to RevenueCat one-time IAP (mobile) + Stripe one-time charge (web) + Stripe metered billing (storage)
- packages/entitlements/ -- SKU config, feature gates. REWRITE for: hub unlock ($19.99), standalone per-app ($4.99), standalone-to-hub bridge, storage tiers
- packages/billing-config/ -- Tier definitions. REWRITE for new pricing model

## New Package Needed
- packages/sync/ -- Data sync abstraction layer:
  - Local-only mode (default): expo-sqlite direct, no sync
  - P2P mode: WebRTC data channels + LiveStore event sync
  - Cloud mode: PowerSync (Supabase <-> SQLite bidirectional sync)
  - User selects tier in Settings. Tier determines which sync provider is active.

## Entitlement Bridge Logic
1. Check RevenueCat for purchased products (hub IAP or standalone IAPs)
2. Hub IAP ($19.99) -> all modules unlocked
3. Standalone IAP (e.g., MyWorkouts $4.99) -> that specific module unlocked in hub
4. No purchase -> app still works, but modules show purchase prompt
5. Storage tier checked separately: free 1GB, or paid via Stripe metered billing

## Your Responsibilities
1. Read all scaffolded packages to understand current state
2. Design the entitlement flow:
   - App launch -> check RevenueCat for purchases -> determine unlocked modules
   - Module tap -> if unlocked, open; if not, show purchase UI ($19.99 all or $4.99 this module)
   - Settings -> Data & Sync -> select tier (Local / P2P / Free Cloud / Paid Cloud)
   - Cloud tiers -> require Supabase Auth sign-in -> show storage usage + billing
3. Assign tasks to auth-dev, payments-dev, sync-dev, paywall-dev
4. After workers complete, run integration tests:
   - Buy hub IAP -> all modules unlock
   - Buy standalone IAP -> that module unlocks in hub
   - Enable P2P sync -> data appears on second device
   - Enable cloud sync -> data appears in Supabase, syncs back to device
   - Storage billing -> Stripe charges correct amount for tier
5. Verify all acceptance criteria

## Acceptance Criteria
- [ ] F034: Supabase Auth sign up flow works (email + password) -- only triggered when user enables cloud sync
- [ ] F035: Supabase Auth sign in flow works -- auth state persists across restarts
- [ ] F036: App works fully WITHOUT auth (local-only and P2P tiers require no account)
- [ ] F037: RevenueCat one-time IAP ($19.99) unlocks all modules on mobile (test mode)
- [ ] F038: RevenueCat standalone IAP ($4.99) unlocks single module on mobile (test mode)
- [ ] F039: Stripe one-time charge works on web for hub unlock ($19.99) and standalone ($4.99) (test mode)
- [ ] F040: Entitlement bridge: buying MyWorkouts standalone ($4.99) makes it accessible inside MyLife hub
- [ ] F041: Modules show purchase prompt for unpurchased users (not auth prompt)
- [ ] F042: P2P sync via WebRTC transfers data between two devices on same network
- [ ] F043: PowerSync cloud sync works: data written on device appears in Supabase within 5 seconds
- [ ] F044: PowerSync cloud sync works: data written in Supabase appears on device within 5 seconds
- [ ] F045: Free cloud tier: 1GB storage limit enforced, user sees usage in Settings
- [ ] F046: Starter Cloud ($2.99/mo): Stripe metered billing creates charge in test mode
- [ ] F047: Power Cloud ($5.99/mo): Stripe metered billing creates charge in test mode
- [ ] F048: Storage tier selection UI in Settings > Data & Sync (Local / P2P / Free Cloud / Paid Cloud)
- [ ] F049: Purchase UI renders correctly: $19.99 for all modules, $4.99 per standalone module
- [ ] F050: Annual update entitlement: after Year 1, update prompt appears with $9.99/yr option
- [ ] F051: pnpm typecheck and pnpm test pass after all changes

## Constraints
- NO subscriptions for app access. One-time purchase only.
- Auth is OPTIONAL -- only required for cloud sync tiers
- Use RevenueCat for App Store/Play Store IAP (one-time, not subscriptions)
- Use Stripe for web purchases (one-time) and storage metered billing
- Use PowerSync for cloud sync (not custom sync)
- Use WebRTC (react-native-webrtc) for P2P sync
- Local SQLite is always the source of truth, even with cloud sync enabled
- All payment testing in sandbox/test mode only
- Data architecture must support users who NEVER create an account
```

#### Worker Prompt: `sync-dev`
```
You build the local-first data sync architecture for MyLife. This is a NEW package (packages/sync/).

## Working Directory
/Users/trey/Desktop/Apps/MyLife

## Context
MyLife is local-first. All data lives in SQLite on device by default. Users can optionally enable P2P sync (between their own devices) or cloud sync (PowerSync to Supabase). Your job: build the sync abstraction layer.

## Your Tasks

### Phase 1: Sync Provider Abstraction
1. Create packages/sync/ with a SyncProvider interface:
   - LocalOnlyProvider: No sync. Default. Just expo-sqlite.
   - P2PProvider: WebRTC data channels for device-to-device sync
   - CloudProvider: PowerSync for Supabase <-> SQLite bidirectional sync
2. Each provider implements: initialize(), sync(), pause(), resume(), getStatus()
3. User selects provider in Settings. Selection persisted in AsyncStorage.

### Phase 2: P2P Sync via WebRTC
1. Install react-native-webrtc
2. Implement signaling via Supabase Realtime (or lightweight WebSocket)
3. Data transfer: export SQLite changesets as JSON, send over WebRTC data channel, merge on receiving device
4. Discovery: user generates a pairing code, second device enters code to establish connection
5. Conflict resolution: last-write-wins with timestamps (simple, good enough for single-user multi-device)

### Phase 3: Cloud Sync via PowerSync
1. Install @powersync/react-native
2. Configure PowerSync with Supabase backend
3. Define sync rules: all hub tables sync based on user_id
4. Handle offline: PowerSync queues writes locally, syncs when online
5. Storage tracking: query Supabase for current storage usage, expose via SyncProvider.getStorageUsed()

### Phase 4: Integration with Hub
1. Wire SyncProvider into packages/db/ initialization
2. On app launch: check selected sync mode, initialize appropriate provider
3. Settings > Data & Sync screen: show current mode, storage usage (cloud only), switch mode
4. Switching from cloud to local: keep local data, stop syncing
5. Switching from local to cloud: push all local data to cloud, start syncing

## Files You Own
- packages/sync/** (new package)
- packages/db/src/sync-integration.ts (new file for provider wiring)

## Acceptance Criteria
- [ ] SyncProvider abstraction with 3 implementations
- [ ] P2P sync transfers data between 2 devices (test with Expo on 2 simulators)
- [ ] PowerSync syncs data to/from Supabase within 5 seconds
- [ ] Storage usage tracking works for cloud tiers
- [ ] Switching sync modes preserves local data
- [ ] pnpm typecheck passes

## Constraints
- Local SQLite is ALWAYS the source of truth
- P2P sync must work WITHOUT Supabase Auth (no account needed)
- Cloud sync REQUIRES Supabase Auth
- Do not modify existing module schemas -- sync layer wraps existing DB
- PowerSync handles conflict resolution for cloud sync; WebRTC uses last-write-wins
```

### Task Breakdown

| Phase | Tasks | Agents | Parallel? |
|-------|-------|--------|-----------|
| 1. Assessment | Lead reads packages, designs entitlement flow | `auth-lead` | No |
| 2. Auth + Entitlements | Optional auth + entitlement bridge rewrite | `auth-dev` | No (foundation) |
| 3. Payments + Sync + Paywall | IAP, storage billing, sync layer, purchase UI | `payments-dev`, `sync-dev`, `paywall-dev` | Yes (parallel, after Phase 2) |
| 4. Integration | End-to-end purchase flow + sync flow testing | `auth-lead` | No (after Phase 3) |

### Acceptance Criteria Summary
18 feature criteria (F034-F051). Plan is complete when all 18 pass.

### Estimated Complexity
- **Effort:** Very Large (6-8 agent sessions)
- **Parallelization:** 3 workers parallel in Phase 3
- **Risk:** High (PowerSync + WebRTC + RevenueCat IAP + Stripe metered billing = 4 external integrations)
- **Token budget:** ~700K tokens estimated
- **Dependency:** Requires Plan 3 completion (Phase 2 modules migrated)
- **Note:** This is the most complex plan. Consider splitting into 4a (Auth + Payments) and 4b (Sync Architecture) if team capacity is limited

---

## Plan 5: Arena Multiplayer Foundation

### Scope
**Project:** `/Users/trey/Desktop/Apps/Arena`
**Focus:** 3v3 multiplayer validation with 6 human players, resource regeneration, team spawning

### Business Context
Arena has a mature GAS ability framework and data-driven content for 8 classes, but has never run a real multiplayer match. Until 3v3 works with 6 humans, all balance tuning, class expansion, and gameplay feedback is speculative. This is the single highest-leverage milestone for the project: proving the technical foundation supports competitive play.

### Technical Context
- **Engine:** UE5.7 with GAS (Gameplay Ability System), C++ 20
- **Networking:** 60Hz server-authoritative, UDP replication, replication proxy pattern
- **Current state:** Mage class (15 C++ abilities) fully functional in single-player test mode
- **Data-driven:** 120+ ability JSONs for 8 classes, UArenaGenericAbility parser
- **Missing:** Resource regeneration (Mana/Energy/Rage ticks), 3v3 spawn assignment, multi-class test mode
- **Known working:** 1 server + 1 client local loopback tested
- **Risk:** Replication has never been tested with 6 simultaneous players

### Agent Team Composition

| Agent Name | Model | Role | Files Owned |
|------------|-------|------|-------------|
| `arena-lead` | Opus 4.6 | Orchestrator: architecture review, integration testing | Plan files |
| `network-dev` | Sonnet 4.6 | Multiplayer authority, spawn system, replication | `Source/ArenaGame/Multiplayer/`, GameMode classes |
| `systems-dev` | Sonnet 4.6 | Resource regen, class data init, generic ability validation | `Source/ArenaGame/AbilitySystem/`, `Source/ArenaGame/Attributes/` |
| `content-dev` | Sonnet 4.6 | Arena map geometry, test scenarios, playtest scripts | `Content/`, `tools/playtest/` |

### Full Agent Prompts

#### Lead Agent Prompt (`arena-lead`)
```
You are the lead for Arena's Multiplayer Foundation milestone. The goal: run a full 3v3 match with 6 human players without crashes, where roles feel distinct.

## Working Directory
/Users/trey/Desktop/Apps/Arena

## Context
Read CLAUDE.md thoroughly. It contains:
- Full architecture overview (GAS, networking model, data-driven design)
- UE 5.7 migration notes and known compile gotchas
- Class roster and ability system design
- Known P0-P2 issues

## Critical Documents to Read First
1. CLAUDE.md (project rules and architecture)
2. docs/architecture.md (system overview)
3. docs/combat-rules.md (ability lifecycle, DR, targeting)
4. design/master-design-document.md (comprehensive game design)
5. Source/ArenaGame/ directory structure (understand class hierarchy)

## Your Responsibilities
1. Read all critical documents
2. Assess current multiplayer readiness by reading:
   - AArenaGameMode (match orchestration, spawn assignment)
   - AArenaPlayerState (ASC authority, replication)
   - AArenaPlayerController (input, targeting RPCs)
   - UArenaAbilitySystemComponent (ability queue, server validation)
3. Create task assignments for 3 workers:
   - network-dev: 3v3 spawn system, team assignment, match flow
   - systems-dev: Resource regen, class data init for Warrior/Priest/Rogue
   - content-dev: Test arena map, playtest scripts, multi-class test mode
4. After workers complete, orchestrate a simulated 3v3 test:
   - Build the project: UnrealBuildTool ArenaGame Development Win64
   - Run test scenarios documenting any crashes or replication issues
5. Verify all acceptance criteria

## Acceptance Criteria
- [ ] F046: 3v3 team spawn system works (Team A spawns at position X, Team B at position Y)
- [ ] F047: Team assignment replicates to all 6 clients (each player sees correct team colors)
- [ ] F048: Mana regeneration works (2% base mana per second, modified by Spirit attribute)
- [ ] F049: Energy regeneration works (10 energy per second base)
- [ ] F050: Rage decay works (1 rage per second out of combat after 3s)
- [ ] F051: Warrior class data initializes via UArenaGenericAbility (15 abilities load from JSON)
- [ ] F052: Priest class data initializes via UArenaGenericAbility (15 abilities load from JSON)
- [ ] F053: Rogue class data initializes via UArenaGenericAbility (15 abilities load from JSON)
- [ ] F054: Multi-class test mode: spawn 1 of each class (Mage, Warrior, Priest) vs 3 dummies
- [ ] F055: Test arena map has defined spawn points and at least 4 pillars for sightline play
- [ ] F056: Project compiles cleanly with zero warnings in GAS subsystems
- [ ] F057: Match completes to win condition (one team eliminated) without server crash
- [ ] F058: Post-match: game mode transitions to Results state with team scores

## Constraints
- Follow UE 5.7 API patterns (CLAUDE.md documents migration gotchas)
- All combat outcomes must be server-authoritative (no client-side damage)
- Do NOT modify ability JSON data files (balance tuning is a separate plan)
- Commit after each phase with: "feat(arena): [description]"
```

#### Worker Prompt: `network-dev`
```
You implement 3v3 multiplayer networking for the Arena game.

## Working Directory
/Users/trey/Desktop/Apps/Arena

## Context
Read CLAUDE.md and docs/architecture.md for networking model. The game uses UE5.7 native UDP replication with server-authoritative combat. Current state: 1 server + 1 client tested locally. Your job: make 3v3 (6 players) work.

## Your Tasks

### Phase 1: Team Spawn System
1. Read Source/ArenaGame/Core/ArenaGameMode.cpp to understand current spawn logic
2. Implement 3v3 team assignment:
   - Players 1-3 = Team A (FGenericTeamId 1)
   - Players 4-6 = Team B (FGenericTeamId 2)
   - Team assignment happens in PostLogin or HandleStartingNewPlayer
3. Add spawn points: Team A spawns at arena north, Team B at arena south
4. Replicate team assignment to all clients

### Phase 2: Match Flow for 3v3
1. Warmup phase: 10 seconds, all players frozen, countdown HUD
2. Combat phase: Players unfrozen, abilities enabled
3. Win condition: All members of one team at 0 HP
4. Results phase: 5 seconds showing winner, then restart option
5. Timer failsafe: 10-minute match time limit, team with most total HP% wins

### Phase 3: Replication Hardening
1. Verify all combat state replicates to 6 clients (not just 2)
2. Test: 6 players casting abilities simultaneously, check for authority violations
3. Add bandwidth monitoring: log replicated bytes per tick per player
4. Verify replication proxy struct handles 6-player state without exceeding MTU

## Files You Own
- Source/ArenaGame/Core/ArenaGameMode.* (spawn, team assignment, match flow)
- Source/ArenaGame/Core/ArenaGameState.* (match state replication)
- Source/ArenaGame/Core/ArenaPlayerState.* (team replication only)

## Acceptance Criteria
- [ ] 3v3 team spawn works with correct positions
- [ ] Team colors visible to all 6 clients
- [ ] Match flow: Warmup -> Combat -> Results transitions work
- [ ] Win condition triggers correctly
- [ ] No authority violations in server logs with 6 simultaneous players

## Constraints
- All combat mutations are server-authoritative (never trust client)
- Replication proxy pattern must be maintained (don't replicate full ASC)
- Follow CLAUDE.md UE 5.7 migration notes
```

### Task Breakdown

| Phase | Tasks | Agents | Parallel? |
|-------|-------|--------|-----------|
| 1. Assessment | Lead reads architecture, identifies gaps | `arena-lead` | No |
| 2. Core Systems | Network + Systems + Content in parallel | `network-dev`, `systems-dev`, `content-dev` | Yes |
| 3. Integration | Build, test multi-class scenario, verify replication | `arena-lead` | No (after Phase 2) |
| 4. Playtest Prep | Playtest scripts, documentation for 6-player test | `content-dev` | After Phase 3 |

### Acceptance Criteria Summary
13 feature criteria (F046-F058). Plan is complete when all 13 pass.

### Estimated Complexity
- **Effort:** Large (4-6 agent sessions)
- **Parallelization:** 3 workers parallel in Phase 2
- **Risk:** High (6-player replication is untested; expect debugging cycles)
- **Token budget:** ~600K tokens estimated
- **Dependency:** None (this unlocks Plan 6)
- **Note:** C++ compilation required; agents need UE5 build tools available

---

## Plan 6: Arena Content Expansion Pipeline

### Scope
**Project:** `/Users/trey/Desktop/Apps/Arena`
**Focus:** Validate UArenaGenericAbility for 7 remaining classes, author-ability skill, balance framework

### Business Context
Arena has 120+ ability JSONs authored but only Mage (15 C++ abilities) is runtime-tested. The UArenaGenericAbility system should handle all other classes via data-driven JSON, but this has never been validated end-to-end. Proving that 7 classes work via JSON (without per-class C++ code) validates the entire content pipeline and enables rapid class expansion.

### Technical Context
- **Data loader:** UArenaAbilityDataLoader parses JSON at runtime
- **Generic ability:** UArenaGenericAbility processes effects arrays, resource costs, debuff/buff/CC
- **JSON location:** Content/Data/Abilities/{ClassName}/*.json (120+ files)
- **Schema validation:** schemas/game-data/ + Python validator script
- **Known gaps:** Combo point scaling (Rogue), multi-resource costs (Paladin Holy Power), pet AI (Hunter), shapeshifting (Druid), stealth (Rogue), fear pathing (Warlock)
- **Animal roster:** 45+ character designs in characterdevtimeline.md -- decision needed on WoW vs Animal aesthetic

### Agent Team Composition

| Agent Name | Model | Role | Files Owned |
|------------|-------|------|-------------|
| `content-lead` | Opus 4.6 | Orchestrator: class validation strategy, balance framework | Plan files |
| `ability-validator` | Sonnet 4.6 | Load and validate all ability JSONs, fix parser gaps | `Source/ArenaGame/AbilitySystem/ArenaGenericAbility.*`, `Source/ArenaGame/Data/` |
| `schema-dev` | Sonnet 4.6 | Schema enforcement, validation scripts, CI integration | `schemas/`, `tools/`, `Content/Data/` |
| `balance-dev` | Sonnet 4.6 | PvP scaling framework, balance baseline, tuning tools | `Content/Data/Config/`, balance scripts |

### Full Agent Prompts

#### Lead Agent Prompt (`content-lead`)
```
You are the lead for Arena's Content Expansion Pipeline. Your goal: validate that all 8 classes work via the data-driven ability system and establish the balance tuning framework.

## Working Directory
/Users/trey/Desktop/Apps/Arena

## Context
Read CLAUDE.md, design/master-design-document.md, and characterdevtimeline.md. The Mage class has 15 dedicated C++ ability classes. The other 7 classes (Warrior, Paladin, Rogue, Hunter, Warlock, Priest, Druid) rely on UArenaGenericAbility to parse JSON at runtime. This has never been validated end-to-end.

## Your Responsibilities
1. Read UArenaGenericAbility and UArenaAbilityDataLoader source code
2. Identify which ability mechanics are NOT supported by the generic system:
   - Combo point scaling (Rogue)
   - Multi-resource costs (Paladin: Mana + Holy Power)
   - Pet AI (Hunter companion)
   - Shapeshifting (Druid form changes)
   - Stealth (Rogue: visibility state change)
   - Fear pathing (Warlock: random movement CC)
3. For each unsupported mechanic, decide: extend UArenaGenericAbility OR create a specialized C++ ability
4. Assign tasks to workers
5. After workers complete, run the full class test: spawn each class, activate each ability, verify effects

## Acceptance Criteria
- [ ] F059: All 8 class JSON files load without parser errors
- [ ] F060: Each class's 15 abilities can be granted and activated (basic smoke test)
- [ ] F061: Warrior abilities deal damage, apply debuffs, and use Rage correctly
- [ ] F062: Priest abilities heal, shield, and use Mana correctly
- [ ] F063: Rogue abilities use Energy + Combo Points correctly
- [ ] F064: All ability JSONs pass schema validation (validate_schemas.py)
- [ ] F065: PvP scaling config exists: per-class damage/healing multipliers
- [ ] F066: Balance baseline document: expected damage/healing per second per class
- [ ] F067: Balance tuning script: adjust all abilities for a class by percentage
- [ ] F068: CI-ready: schema validation runs as pre-commit hook or test

## Constraints
- Do NOT change Mage C++ abilities (they are the reference implementation)
- Prefer extending UArenaGenericAbility over creating new C++ classes (data-driven > code)
- All JSON changes must pass schema validation before committing
- Balance numbers are BASELINE only -- real tuning happens after multiplayer playtests (Plan 5)
```

### Task Breakdown

| Phase | Tasks | Agents | Parallel? |
|-------|-------|--------|-----------|
| 1. Assessment | Lead reads ability system code, identifies gaps | `content-lead` | No |
| 2. Validation + Schema | Ability validator + schema enforcement | `ability-validator`, `schema-dev` | Yes |
| 3. Balance Framework | PvP scaling, baseline numbers, tuning tools | `balance-dev` | Yes (parallel with Phase 2) |
| 4. Integration | Full class test, all 8 classes activated | `content-lead` | No (after 2+3) |

### Acceptance Criteria Summary
10 feature criteria (F059-F068). Plan is complete when all 10 pass.

### Estimated Complexity
- **Effort:** Medium-Large (3-4 agent sessions)
- **Parallelization:** 3 workers parallel in Phase 2-3
- **Risk:** Medium (generic ability parser may need extensions for complex mechanics)
- **Token budget:** ~400K tokens estimated
- **Dependency:** Benefits from Plan 5 (multiplayer) but can run in parallel for content validation

---

## Plan 7: Cross-Project Skills Infrastructure Sprint

### Scope
**Projects:** All three -- mcp-apps, MyLife, Arena + workspace level
**Focus:** Build 10 new skills + improve 5 existing skills based on Anthropic's latest guidance

### Business Context
Skills are force multipliers for agentic workflows. A well-designed skill used 15+ times saves orders of magnitude more than one-off prompts. The three active projects have ZERO skills (mcp-apps, MyLife) or one bloated generic skill (Arena). Meanwhile, Anthropic's skill documentation has matured significantly with clear patterns for progressive disclosure, trigger optimization, and evaluation testing.

### Technical Context
- **Skill format:** `.claude/skills/<name>/SKILL.md` with YAML frontmatter
- **Key fields:** name, description (third-person, max 1024 chars), allowed-tools, context, user-invocable, argument-hint
- **Progressive disclosure:** Metadata (~100 tokens) at startup, full SKILL.md on invocation, supporting files on demand
- **Best practice:** Keep SKILL.md under 500 lines, one level of reference depth, test with evals
- **Existing skills:** 8 workspace-level, 8 in receipts, 3 in macos-hub, 1 in Arena (bloated, needs replacement)
- **Identified needs:** 10 new skills across 3 projects + 5 improvements to existing skills

### Agent Team Composition

| Agent Name | Model | Role | Files Owned |
|------------|-------|------|-------------|
| `skills-lead` | Opus 4.6 | Orchestrator: skill design, evaluation, quality review | Plan files, evals/ |
| `mcp-skills-dev` | Sonnet 4.6 | 3 mcp-apps skills | `mcp-apps/.claude/skills/` |
| `mylife-skills-dev` | Sonnet 4.6 | 3 MyLife skills | `MyLife/.claude/skills/` |
| `arena-skills-dev` | Sonnet 4.6 | 3 Arena skills (replace bloated one) | `Arena/.claude/skills/` |
| `workspace-skills-dev` | Sonnet 4.6 | 1 cross-project skill + 5 existing improvements | `.claude/skills/` (workspace level) |

### Full Agent Prompts

#### Lead Agent Prompt (`skills-lead`)
```
You are the lead for the Cross-Project Skills Infrastructure Sprint. Your job: build 10 new skills and improve 5 existing skills across the workspace.

## Working Directory
/Users/trey/Desktop/Apps

## Anthropic Skills Best Practices (Embed These)
1. SKILL.md is the entrypoint. YAML frontmatter configures metadata.
2. Keep under 500 lines. Split into reference files (one level deep).
3. Descriptions: third-person, include trigger contexts ("Use when..."), be "pushy" to combat under-triggering.
4. Progressive disclosure: metadata loads at startup (~100 tokens), full content on invocation.
5. Only add context Claude doesn't already have. Don't explain general programming concepts.
6. Test with 3 eval scenarios before finalizing.
7. Include argument-hint for user-invocable skills.
8. Use context: fork for heavy skills that do lots of file reading.

## Skills to Build

### mcp-apps (3 skills, in mcp-apps/.claude/skills/):
1. scaffold-mcp-server: Generate full boilerplate for new MCP server
2. add-mcp-tool: Add a tool to an existing MCP server with x402 pricing
3. deploy-mcp-server: Deploy server to Fly.io with health checks

### MyLife (3 skills, in MyLife/.claude/skills/):
4. migrate-module: Migrate standalone app into hub module (Phase 2-4 pattern)
5. parity-check: Run and interpret parity validation, generate drift report
6. hub-module-scaffold: Create brand new hub module from scratch

### Arena (3 skills, in Arena/.claude/skills/):
7. author-ability: Generate ability JSON following schemas
8. author-class-definition: Generate complete class definition JSON
9. balance-tuning: Systematic balance adjustment across ability JSONs

### Cross-Project (1 skill, in .claude/skills/):
10. demo-agent-builder: Generate demo scripts showcasing any MCP server

### Improvements to Existing Skills (5):
11. Delete Arena/game-development (bloated, generic) -- replaced by #7-9
12. Add context: fork to /research-app and /generate-architecture-diagrams
13. Add argument-hint to /daily-report-ops, /scan-emails
14. Rewrite /research-documentation with structured methodology
15. Add "Use when..." trigger clause to all existing skill descriptions

## Your Responsibilities
1. Design each skill's SKILL.md structure (frontmatter + instructions)
2. Assign skills to workers (3 each for project-specific, 1+5 for workspace)
3. After workers complete, review each skill for:
   - Description follows third-person "Use when..." pattern
   - SKILL.md under 500 lines
   - argument-hint present for user-invocable skills
   - No general programming concepts (only project-specific context)
4. Create evals/evals.json for each skill with 2-3 test scenarios

## Acceptance Criteria
- [ ] F069: scaffold-mcp-server skill exists and generates valid server boilerplate
- [ ] F070: add-mcp-tool skill exists with x402 pricing integration
- [ ] F071: deploy-mcp-server skill exists with Fly.io deployment steps
- [ ] F072: migrate-module skill exists with parity validation gate
- [ ] F073: parity-check skill exists and generates structured drift report
- [ ] F074: hub-module-scaffold skill exists with module-registry wiring
- [ ] F075: author-ability skill exists and validates against JSON schema
- [ ] F076: author-class-definition skill exists with 15-ability reference template
- [ ] F077: balance-tuning skill exists with percentage-based adjustment
- [ ] F078: demo-agent-builder skill exists and generates runnable Python scripts
- [ ] F079: Arena game-development skill deleted (replaced by 3 specific skills)
- [ ] F080: /research-app and /generate-architecture-diagrams have context: fork
- [ ] F081: /daily-report-ops and /scan-emails have argument-hint
- [ ] F082: /research-documentation has structured methodology section
- [ ] F083: All skill descriptions include "Use when..." trigger clause
- [ ] F084: Each new skill has evals/evals.json with 2-3 test scenarios

## Constraints
- Follow Anthropic's SKILL.md format exactly (YAML frontmatter + markdown body)
- Skills must be under 500 lines each
- Reference files one level deep only
- Don't add general programming knowledge -- only project-specific patterns
```

#### Worker Prompt: `mcp-skills-dev`
```
You build 3 skills for the mcp-apps project. Each skill goes in mcp-apps/.claude/skills/<name>/SKILL.md.

## Working Directory
/Users/trey/Desktop/Apps/mcp-apps

## Context
This project has 15 MCP servers. Each follows the same pattern: FastAPI, x402 payments, Docker, Fly.io deployment. There are currently ZERO skills. You are building the first 3.

## Skills to Build

### 1. scaffold-mcp-server
Create: .claude/skills/scaffold-mcp-server/SKILL.md

Purpose: Generate full boilerplate for a new MCP server.

Frontmatter:
- name: scaffold-mcp-server
- description: "Scaffolds a new MCP server with FastAPI, x402 payment integration, Docker config, and Fly.io deployment. Use when creating a new server in the mcp-apps portfolio or when the user says 'new server', 'create server', or 'scaffold server'."
- user-invocable: true
- argument-hint: "<server-name> <brief-description>"
- allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]

Body: Instructions to:
1. Accept server name and description as arguments
2. Read an existing server (mcp-structured-extractor) as reference template
3. Create directory structure: src/app/, src/app/tools/, tests/, Dockerfile, fly.toml, README.md, SPEC.md, IMPLEMENTATION-PLAN.md, pyproject.toml
4. Generate FastAPI app scaffold with health endpoint
5. Wire x402 payment middleware (copy pattern from existing server)
6. Generate Dockerfile from template
7. Generate fly.toml from template
8. Run: pip install -e . && pytest (verify scaffolding works)

### 2. add-mcp-tool
Create: .claude/skills/add-mcp-tool/SKILL.md

Purpose: Add a new tool to an existing MCP server.

Frontmatter:
- name: add-mcp-tool
- description: "Adds a new tool endpoint to an existing MCP server with x402 pricing, input validation, and test stub. Use when the user says 'add tool', 'new endpoint', or 'implement tool' for any mcp-apps server."
- user-invocable: true
- argument-hint: "<server-name> <tool-name>"
- allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]

Body: Instructions to read SPEC.md, generate tool handler, add route, wire x402 pricing, generate test stub.

### 3. deploy-mcp-server
Create: .claude/skills/deploy-mcp-server/SKILL.md

Purpose: Deploy an MCP server to Fly.io.

Frontmatter:
- name: deploy-mcp-server
- description: "Deploys an MCP server to Fly.io with pre-deploy test verification, Docker build, health check, and smoke test. Use when the user says 'deploy', 'push to fly', or 'ship server'."
- user-invocable: true
- disable-model-invocation: true (deployment should require explicit user trigger)
- argument-hint: "<server-name> [staging|production]"
- allowed-tools: [Read, Bash, Glob]

Body: Instructions to verify tests pass, Docker build, fly deploy, health check, smoke test.

## For Each Skill
- Keep SKILL.md under 500 lines
- Use third-person descriptions with "Use when..." clause
- Include argument-hint
- Create evals/evals.json with 2-3 test scenarios per skill

## Acceptance Criteria
- [ ] All 3 SKILL.md files created with valid YAML frontmatter
- [ ] Each skill follows the pattern of existing workspace skills
- [ ] deploy-mcp-server has disable-model-invocation: true
- [ ] Each skill has evals/evals.json
```

#### Worker Prompts: `mylife-skills-dev`, `arena-skills-dev`, `workspace-skills-dev`
```
[Same structure as mcp-skills-dev, substituting the 3 skills for each project per the lead prompt's specifications. Key differences:]

mylife-skills-dev:
- migrate-module: Most complex, ~300 lines. References MyBooks/MyMeds as patterns. Includes parity gate.
- parity-check: User-invocable. Runs pnpm check:parity, parses output, generates report.
- hub-module-scaffold: For new modules (no standalone source). Generates modules/<name>/ + registry wiring.

arena-skills-dev:
- author-ability: Reads schemas/game-data/ability.schema.json. Generates validated JSON.
- author-class-definition: Reads class schema. Scaffolds 15 ability references.
- balance-tuning: Percentage-based adjustments. Reads all abilities for a class, applies multiplier.
- ALSO: Delete Arena/.claude/skills/game-development/ (the bloated generic one)

workspace-skills-dev:
- demo-agent-builder: Cross-project skill for mcp-apps GTM.
- Plus 5 improvements to existing skills (context:fork, argument-hint, descriptions, research-documentation rewrite)
```

### Task Breakdown

| Phase | Tasks | Agents | Parallel? |
|-------|-------|--------|-----------|
| 1. Design | Lead designs all 15 skills, creates specs | `skills-lead` | No |
| 2. Build | All 4 skill devs work simultaneously | All 4 devs | Yes |
| 3. Review + Eval | Lead reviews each skill, runs eval scenarios | `skills-lead` | No (after Phase 2) |

### Acceptance Criteria Summary
16 feature criteria (F069-F084). Plan is complete when all 16 pass.

### Estimated Complexity
- **Effort:** Medium (2-3 agent sessions)
- **Parallelization:** 4 workers parallel in Phase 2
- **Risk:** Low (skills are self-contained markdown files; no runtime dependencies)
- **Token budget:** ~350K tokens estimated
- **Dependency:** None (can run in parallel with any other plan)

---

## Plan 8: MyLife Tier 3 Module Build-Out

### Scope
**Project:** `/Users/trey/Desktop/Apps/MyLife`
**Focus:** Complete MyHabits, MyCar, MyHealth, MyWords modules from partial state to functional

### Business Context
Tier 3 modules (Habits, Car, Health, Words) are partially built -- they have some code, schemas, or hub scaffolding but aren't functional end-to-end. Completing these adds 4 more modules to the MyLife suite, increasing the perceived value of the $19.99 one-time purchase. More modules = higher conversion rate = more users upgrading from standalone $4.99 apps to the full hub.

### Technical Context
- **MyHabits:** Standalone submodule + hub scaffold. Needs streak logic, calendar heatmap, full mobile/web UI
- **MyCar:** Functional standalone app with garage, expenses, reminders, E2E tests. Needs hub integration with dual-model support (local vs cloud)
- **MyHealth:** Local directory (not linked as submodule). Needs health metrics aggregation UI, trend visualization
- **MyWords:** Standalone functional (dictionary + thesaurus). Hub passthrough set up. Needs parity verification
- **All four** need: module registration, table prefix, hub route wiring, parity validation

### Agent Team Composition

| Agent Name | Model | Role | Files Owned |
|------------|-------|------|-------------|
| `tier3-lead` | Opus 4.6 | Orchestrator: module assessment, parity review | Plan files |
| `habits-dev` | Sonnet 4.6 | MyHabits completion | `modules/habits/`, `MyHabits/` reference |
| `car-dev` | Sonnet 4.6 | MyCar hub integration | `modules/car/`, `MyCar/` reference |
| `health-words-dev` | Codex 5.3 | MyHealth + MyWords completion | `modules/health/`, `modules/words/`, `MyHealth/`, `MyWords/` |
| `parity-checker` | Haiku 4.5 | Parity validation after each module | Read-only |

### Full Agent Prompts

#### Lead Agent Prompt (`tier3-lead`)
```
You are the lead for MyLife Tier 3 Module Build-Out. Your goal: complete MyHabits, MyCar, MyHealth, and MyWords from partial state to functional hub modules.

## Working Directory
/Users/trey/Desktop/Apps/MyLife

## Context
Read CLAUDE.md. These are Tier 3 modules -- partially built with some code/schemas but not functional end-to-end. Your reference implementations are MyBooks (Tier 1) and MyMeds (Tier 2).

## Module Status Assessment (verify by reading code)
1. MyHabits: Hub scaffold exists + standalone submodule. Needs streak logic, calendar heatmap, screens.
2. MyCar: Functional standalone with tests. Needs hub integration with cr_ prefix.
3. MyHealth: Local directory, not a submodule. Needs schema, aggregation UI, trends.
4. MyWords: Standalone functional, hub passthrough exists. Needs parity verification.

## Your Responsibilities
1. Read each module's current state (standalone + hub)
2. Determine exact gap between current state and "functional in hub"
3. Assign tasks: habits-dev, car-dev, health-words-dev
4. After workers complete, run pnpm check:parity for each module
5. Run full suite: pnpm test && pnpm typecheck

## Acceptance Criteria
- [ ] F085: MyHabits module functional in hub (create habit, mark complete, see streak)
- [ ] F086: MyHabits calendar heatmap renders in both mobile and web
- [ ] F087: MyCar module functional in hub (add vehicle, log expense, set reminder)
- [ ] F088: MyCar uses cr_ table prefix in hub context
- [ ] F089: MyHealth module functional in hub (log metric, view trend chart)
- [ ] F090: MyHealth schema has hl_ table prefix
- [ ] F091: MyWords hub passthrough works identically to standalone
- [ ] F092: pnpm check:parity passes for all 4 modules
- [ ] F093: pnpm typecheck passes across entire workspace
- [ ] F094: pnpm test passes (all existing + new tests)
- [ ] F095: All 4 modules appear in hub sidebar (web) and are navigable (mobile)

## Constraints
- Do NOT modify standalone submodule code (canonical sources)
- Follow MyBooks/MyMeds module patterns exactly
- Verify table prefixes against CLAUDE.md: hb_ (habits), cr_ (car), hl_ (health), wd_ (words)
- Commit after each module with: "feat(mylife): complete My{Name} hub module"
```

### Task Breakdown

| Phase | Tasks | Agents | Parallel? |
|-------|-------|--------|-----------|
| 1. Assessment | Lead reads all 4 modules' current state | `tier3-lead` | No |
| 2. Module Build | All 3 devs work simultaneously on their modules | `habits-dev`, `car-dev`, `health-words-dev` | Yes |
| 3. Parity | Run parity checks after each module completes | `parity-checker` | Rolling |
| 4. Integration | Full test suite, typecheck, hub navigation | `tier3-lead` | No (after Phase 2-3) |

### Acceptance Criteria Summary
11 feature criteria (F085-F095). Plan is complete when all 11 pass.

### Estimated Complexity
- **Effort:** Medium-Large (3-5 agent sessions)
- **Parallelization:** 3 workers parallel in Phase 2
- **Risk:** Medium (MyCar dual-model support adds complexity; MyHealth may need schema design from scratch)
- **Token budget:** ~450K tokens estimated
- **Dependency:** Should run after Plan 3 (Phase 2 completion sets patterns for Tier 3)

---

## Execution Priority & Dependency Graph

```
Plan 7 (Skills) ─────────────────────────── No dependencies, run anytime
    |
Plan 1 (mcp-apps Launch) ──────────────── No dependencies
    |
    └──> Plan 2 (mcp-apps GTM) ─────────── Depends on Plan 1

Plan 3 (MyLife Phase 2) ───────────────── No dependencies
    |
    ├──> Plan 4 (MyLife Phase 3 Auth) ──── Depends on Plan 3
    |
    └──> Plan 8 (MyLife Tier 3) ────────── Benefits from Plan 3 patterns

Plan 5 (Arena Multiplayer) ────────────── No dependencies
    |
    └──> Plan 6 (Arena Content) ────────── Benefits from Plan 5 (parallel OK)
```

### Recommended Execution Order

**Wave 1 (start immediately, all parallel):**
- Plan 7: Skills Infrastructure (no deps, low risk, high leverage)
- Plan 1: mcp-apps Production Launch (no deps, revenue-critical)
- Plan 3: MyLife Phase 2 (no deps, blocks Phase 3)
- Plan 5: Arena Multiplayer Foundation (no deps, highest-risk/highest-reward)

**Wave 2 (after Wave 1 dependencies resolve):**
- Plan 2: mcp-apps GTM (after Plan 1)
- Plan 6: Arena Content Expansion (after/alongside Plan 5)
- Plan 8: MyLife Tier 3 Build-Out (after Plan 3)

**Wave 3 (after Wave 2):**
- Plan 4: MyLife Phase 3 Auth (after Plan 3, before shipping)

### Resource Allocation (4 simultaneous agent sessions)

| Session | Wave 1 | Wave 2 | Wave 3 |
|---------|--------|--------|--------|
| Session A (Opus lead) | Plan 7: Skills | Plan 2: GTM | Plan 4: Auth |
| Session B (Sonnet workers) | Plan 1: mcp-apps Launch | Plan 6: Arena Content | -- |
| Session C (Sonnet workers) | Plan 3: MyLife Phase 2 | Plan 8: MyLife Tier 3 | -- |
| Session D (Codex workers) | Plan 5: Arena Multiplayer | -- | -- |

### Total Feature Criteria: 101 (F001-F051 revised, plus Plans 5-8 criteria)
> Note: Plan 4 was expanded from 12 to 18 criteria to cover the new data architecture (P2P sync, cloud tiers, entitlement bridge). Plans 5-8 criteria numbering is unchanged from original.
### Estimated Total Token Budget: ~3.7M tokens across all 8 plans
### Estimated Calendar Time: 3-4 waves, each 1-2 days with parallel execution

---

## Appendix A: Skills to Build (Quick Reference)

| # | Skill Name | Project | Trigger |
|---|-----------|---------|---------|
| 1 | scaffold-mcp-server | mcp-apps | "create new server", "scaffold server" |
| 2 | add-mcp-tool | mcp-apps | "add tool", "new endpoint" |
| 3 | deploy-mcp-server | mcp-apps | "deploy", "push to fly" |
| 4 | migrate-module | MyLife | "migrate module", "integrate standalone" |
| 5 | parity-check | MyLife | "check parity", "validate module" |
| 6 | hub-module-scaffold | MyLife | "scaffold module", "create new module" |
| 7 | author-ability | Arena | "create ability", "add spell" |
| 8 | author-class-definition | Arena | "create class", "define class" |
| 9 | balance-tuning | Arena | "tune balance", "adjust numbers" |
| 10 | demo-agent-builder | Workspace | "create demo agent", "build demo" |

## Appendix B: Existing Skill Improvements

| # | Skill | Change | Priority |
|---|-------|--------|----------|
| 1 | Arena/game-development | Delete (replaced by #7-9) | High |
| 2 | /research-app | Add context: fork | Medium |
| 3 | /generate-architecture-diagrams | Add context: fork | Medium |
| 4 | /daily-report-ops | Add argument-hint | Low |
| 5 | /scan-emails | Add argument-hint | Low |
| 6 | /research-documentation | Rewrite with structured methodology | Medium |
| 7 | All existing skills | Add "Use when..." trigger clause | Low |

## Appendix C: Model Routing Cheat Sheet

| Task Type | Model | Reasoning |
|-----------|-------|-----------|
| Team orchestration, architecture decisions | Opus 4.6 | Complex reasoning, multi-file coordination |
| Feature implementation, debugging | Sonnet 4.6 | Best cost/quality for coding tasks |
| Multi-file refactoring, fast iteration | Codex 5.3 | Optimized for code generation |
| Test running, linting, parity checks | Haiku 4.5 | Cheapest for validation tasks |
| Content authoring (JSON, docs, configs) | Sonnet 4.6 | Good at structured output |
| Code review (read-only) | Haiku 4.5 | Cost-effective for review |

## Appendix D: Key Research Sources

- [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Building a C Compiler with 16 Agents](https://www.anthropic.com/engineering/building-c-compiler)
- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [OpenAI Codex AGENTS.md Guide](https://developers.openai.com/codex/guides/agents-md/)
- [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
