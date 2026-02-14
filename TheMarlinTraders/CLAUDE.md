# TheMarlinTraders — CLAUDE.md

## Overview

TheMarlinTraders is an all-in-one trading platform where charting, strategy development, execution, journaling, and community exist in a single experience — powered by AI, priced for humans. It targets the gap between consumer tools (TradingView at $60/mo) and institutional terminals (Bloomberg at $32K/year).

## Stack

- **Monorepo:** Turborepo 2.x + pnpm 9.x
- **Language:** TypeScript 5.7+ (strict mode everywhere)
- **Web:** Next.js 15 (App Router)
- **Mobile:** React Native + Expo SDK 52+
- **State:** Zustand 5.x (per-domain stores, shared web + mobile)
- **API:** tRPC 11.x (end-to-end type safety)
- **Runtime:** Bun 1.2+
- **ORM:** Drizzle 0.40+
- **Database:** PostgreSQL 16 + TimescaleDB 2.x (time-series)
- **Cache/Pub/Sub:** Redis 7.x
- **Search:** Meilisearch 1.x
- **Storage:** Cloudflare R2
- **Auth:** Clerk 5.x
- **Jobs:** BullMQ 5.x
- **WebSocket:** ws 8.x
- **Components:** shadcn/ui + Radix UI
- **Styling:** Tailwind CSS 4.x
- **Layout:** Dockview 4.13+
- **Charts (Web):** TradingView Lightweight Charts 5.1
- **Charts (Mobile):** React Native Skia 1.x
- **Testing:** Vitest + Playwright + React Testing Library
- **CI/CD:** GitHub Actions
- **Hosting:** Vercel (web) / Railway (API, DB) / Fly.io (WebSocket) / Cloudflare (CDN, R2)

## Key Commands

```bash
# Development
pnpm install                    # Install all dependencies
pnpm dev                        # Start all apps (web, mobile, api)
pnpm dev --filter web           # Start web only
pnpm dev --filter mobile        # Start mobile only (Expo)
pnpm dev --filter api           # Start API only (Bun)

# Build
pnpm build                      # Build all packages and apps
pnpm build --filter web         # Build web only
turbo run build                 # Build with Turborepo caching

# Test
pnpm test                       # Run all tests (Vitest)
pnpm test --filter shared       # Test shared package only
pnpm test:e2e                   # End-to-end tests (Playwright)

# Lint / Format
pnpm lint                       # ESLint (flat config) across all packages
pnpm format                     # Prettier

# Database
pnpm db:migrate                 # Run Drizzle migrations
pnpm db:seed                    # Seed reference data (symbols, etc.)
pnpm db:studio                  # Open Drizzle Studio

# Type Check
pnpm typecheck                  # TypeScript check across all packages
```

## Architecture

### Monorepo Structure

```
TheMarlinTraders/
├── apps/
│   ├── web/                    # Next.js 15 (App Router)
│   ├── mobile/                 # React Native + Expo (iOS/Android)
│   └── api/                    # Backend services (Bun runtime)
│       └── src/
│           ├── routers/        # tRPC routers
│           ├── services/       # Business logic
│           ├── adapters/       # Provider adapters (Polygon, brokers)
│           ├── jobs/           # BullMQ job processors
│           ├── ws/             # WebSocket gateway
│           └── db/             # Drizzle schema, migrations
├── packages/
│   ├── shared/                 # Types, indicators, risk, validation, utils
│   ├── ui/                     # shadcn/ui + trading components
│   ├── charts/                 # Charting engine wrapper + custom renderers
│   ├── data/                   # tRPC client, WS client, Zustand stores
│   └── config/                 # ESLint, TypeScript, Tailwind shared configs
├── services/
│   ├── market-data/            # Real-time data pipeline
│   ├── backtesting/            # Strategy execution engine
│   └── notifications/          # Alert delivery (push, email, webhook)
├── docs/                       # Project documentation
│   ├── research/               # 10 research documents
│   ├── requirements/           # Product requirements
│   ├── architecture/           # Technical architecture
│   ├── stack-evaluation/       # Stack recommendation
│   └── plans/                  # Implementation plans
└── tools/scripts/              # Build, deploy, migration scripts
```

### Design Principles

1. **Real-time first.** WebSockets for live data; REST for historical. Never poll where push is possible.
2. **TypeScript everywhere.** Single language across web, mobile, API, workers, and strategy engine.
3. **Modular monorepo.** Independent packages that deploy, test, and version separately.
4. **Performance is a feature.** 60fps charts, <100ms quote-to-screen, <200KB initial bundle.
5. **Provider abstraction.** Every external dependency behind an adapter interface.

### Data Pipeline

```
Polygon.io WebSocket
    -> Provider Adapter (normalization)
    -> Aggregation Engine (tick-to-bar)
    -> Redis Pub/Sub (fan-out)
    -> WebSocket Gateway (ws on Fly.io)
    -> Client Web Workers (parse/compute)
    -> Main Thread (render only)
```

### Three-Thread Client Architecture

- **WS Worker:** Maintains WebSocket connection, buffers messages
- **Data Worker:** Parses market data, computes indicators (via Comlink)
- **Main Thread:** Renders charts and UI only (never blocks on computation)

## Git Workflow

- **Branch naming:** `feature/`, `fix/`, `refactor/`, `docs/` prefixes
- **Commit format:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`)
- **Merge strategy:** Squash merge to `main`
- **CI checks:** TypeScript, ESLint, Vitest, Playwright must pass before merge

## Development Phases

| Phase | Timeline | Focus |
|-------|----------|-------|
| 1 | Months 0-6 | Core charting platform (MVP) — charting, indicators, data, alerts, screener, mobile |
| 2 | Months 6-12 | Social layer + journal + options chain + strategy builder |
| 3 | Months 12-18 | Advanced analysis + broker integration (Alpaca, IBKR) + crypto/forex |
| 4 | Months 18-24 | Strategy IDE + backtesting engine + live deployment |
| 5 | Months 24-30 | Marketplace + copy trading + live streaming |
| 6 | Months 30-42 | Institutional features (VaR, compliance, TWAP/VWAP, team workspaces) |

## Documentation Index

- [Documentation Hub](docs/README.md) — Master index with reading order
- [Research Index](docs/research/README.md) — 10 research documents with key findings
- [Requirements Index](docs/requirements/README.md) — Personas, features, tiers, phases
- [Architecture Index](docs/architecture/README.md) — System design, tech stack, decisions
- [Implementation Plan](docs/plans/implementation-plan.md) — 6-phase build plan with team/infra/risks

## Parallel Agent Work

This project participates in the workspace plan queue system. See `/Users/trey/Desktop/Apps/CLAUDE.md` for the full Plan Queue Protocol.

### Worktree Setup
- Bootstrap: `.cmux/setup` handles env symlinks and dependency installation
- Branch naming: `plan/[plan-name]` for plan-driven work, `feature/[name]` for ad-hoc

### File Ownership Boundaries
When multiple agents work on this project simultaneously, use these boundaries to avoid conflicts:
- **Web agent:** `apps/web/` (Next.js 15 App Router — pages, layouts, client components)
- **Mobile agent:** `apps/mobile/` (React Native + Expo — screens, navigation, native modules)
- **API agent:** `apps/api/` (tRPC routers, services, adapters, jobs, WebSocket gateway, Drizzle schema/migrations)
- **Shared package agent:** `packages/shared/` (types, indicators, risk calc, validation, utils)
- **UI package agent:** `packages/ui/` (shadcn/ui + trading components)
- **Charts package agent:** `packages/charts/` (charting engine wrapper, custom renderers)
- **Data package agent:** `packages/data/` (tRPC client, WS client, Zustand stores)
- **Services agent:** `services/market-data/`, `services/backtesting/`, `services/notifications/`
- **Config agent:** `packages/config/` (ESLint, TypeScript, Tailwind shared configs), root `turbo.json`, `pnpm-workspace.yaml`
- **Tests agent:** Test files across all packages (`.test.ts`, `.spec.ts`, Playwright E2E)
- **Docs agent:** `docs/` (research, requirements, architecture, plans)

### Conflict Prevention
- Check which files other active plans target before starting (read `docs/plans/active/*.md`)
- If your scope overlaps with an active plan, coordinate or wait
- After completing work, run `pnpm build && pnpm test && pnpm typecheck` before marking the plan done

### Agent Teams Strategy
When `/dispatch` detects 2+ plans targeting this project with overlapping scope, it creates an Agent Team instead of parallel subagents. Custom agent definitions from `/Users/trey/Desktop/Apps/.claude/agents/` are available:
- `plan-executor` — Execute plan phases with testing and verification
- `test-writer` — Write tests without modifying source code
- `docs-agent` — Update documentation (CLAUDE.md, timeline, diagrams)
- `reviewer` — Read-only code review and quality gates (uses Sonnet)

## Important Notes

- **Performance targets:** Chart load <500ms, quote-to-screen <100ms, 60fps rendering, JS bundle <200KB gzipped
- **Free tier is generous:** 10 indicators/chart (vs TradingView's 2), 100 alerts (vs TradingView's 5), paper trading included
- **Provider abstraction is mandatory:** All external services (Polygon, Clerk, Stripe, brokers) must sit behind adapter interfaces
- **Web Workers for computation:** Indicator calculations, data parsing, and aggregation run in workers, never on the main thread
- **Dark mode first:** Navy-black base is the default; light mode is opt-in
