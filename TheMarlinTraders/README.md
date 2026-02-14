# TheMarlinTraders

**The all-in-one trading platform where charting, strategy development, execution, journaling, and community exist in a single experience — powered by AI, priced for humans.**

---

## The Problem

Active traders juggle 3-5 separate tools: TradingView for charts, ThinkOrSwim for options, QuantConnect for backtesting, Tradervue for journaling, and Unusual Whales for flow. Scanner results don't feed into watchlists. Watchlists don't feed into charts. Charts don't feed into orders. Orders don't feed into journals. Every context switch is lost time and lost edge.

Meanwhile, the gap between consumer tools ($60/month) and institutional terminals ($32K/year) is enormous and underserved.

## The Solution

TheMarlinTraders collapses the fragmented trading workflow into one integrated platform:

- **More powerful than TradingView** — Real algo trading, not sandboxed Pine Script
- **More accessible than Bloomberg** — Starting at $29/month, not $32K/year
- **More analytical than Robinhood** — Institutional-grade risk metrics, not confetti
- **More social than ThinkOrSwim** — Verified performance tracking, not zero community
- **More integrated than QuantConnect** — Visual charting alongside code, not code-only

## Features

### Phase 1 (MVP)
- Interactive charting with 6 chart types at 60fps (Canvas 2D)
- 50+ technical indicators computed in Web Workers
- Real-time US equity data via Polygon.io WebSocket (<100ms latency)
- 15 core drawing tools with magnetic snap
- Multi-chart layouts with Dockview docking (drag, split, float, popout)
- Stock screener with 100+ filters and pre-built scans
- Server-side alerts with push, email, and webhook delivery
- Paper trading with realistic bid/ask fills
- iOS mobile app with GPU-rendered charts (React Native Skia)
- Dark mode, light mode, and colorblind-accessible mode
- Command palette (Cmd+K) and fully customizable keyboard shortcuts

### Phase 2+
- Trade journal with auto-logging and chart snapshots
- Social features: idea publishing, profiles, leaderboards, discussion rooms
- Full options chain with Greeks, strategy builder, P&L diagrams
- Broker integration (Alpaca, Interactive Brokers)
- Strategy IDE (TypeScript + Python + visual builder)
- Backtesting engine (vectorized + event-driven hybrid)
- Marketplace for indicators, strategies, and signals
- Copy trading with verified performance
- Institutional risk analytics (VaR, attribution, compliance)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm |
| Language | TypeScript (strict mode everywhere) |
| Web | Next.js 15 (App Router) |
| Mobile | React Native + Expo |
| State | Zustand |
| API | tRPC (end-to-end type safety) |
| Runtime | Bun |
| Database | PostgreSQL 16 + TimescaleDB + Redis 7 |
| Search | Meilisearch |
| Auth | Clerk |
| Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v4 |
| Charts (Web) | TradingView Lightweight Charts v5.1 |
| Charts (Mobile) | React Native Skia |
| Testing | Vitest + Playwright |
| Hosting | Vercel + Railway + Fly.io + Cloudflare |

## Subscription Tiers

| Tier | Price | Highlights |
|------|-------|------------|
| **Free** | $0 | 10 indicators/chart, 100 alerts, paper trading, 15-min delayed data |
| **Pro** | $29/mo | Real-time data, 25 indicators, 500 alerts, auto journal, basic AI |
| **Premium** | $79/mo | Options + crypto + forex, strategy IDE, backtesting, full AI |
| **Enterprise** | Custom | Compliance tools, team workspaces, all brokers, dedicated support |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/TheMarlinTraders/TheMarlinTraders.git
cd TheMarlinTraders

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Start development
pnpm dev
```

## Project Structure

```
TheMarlinTraders/
├── apps/
│   ├── web/          # Next.js 15 web application
│   ├── mobile/       # React Native + Expo mobile app
│   └── api/          # Backend API (Bun + tRPC)
├── packages/
│   ├── shared/       # Shared types, indicators, utils
│   ├── ui/           # Component library (shadcn/ui)
│   ├── charts/       # Charting engine
│   ├── data/         # Data layer (stores, API client, WebSocket)
│   └── config/       # Shared ESLint, TypeScript, Tailwind configs
├── services/
│   ├── market-data/  # Real-time data pipeline
│   ├── backtesting/  # Strategy execution engine
│   └── notifications/# Alert delivery system
└── docs/             # Project documentation
```

## Documentation

- [Documentation Hub](docs/README.md) — Start here
- [Research](docs/research/README.md) — 10 domain research documents
- [Product Requirements](docs/requirements/README.md) — Personas, features, tiers
- [Technical Architecture](docs/architecture/README.md) — System design and stack
- [Implementation Plan](docs/plans/implementation-plan.md) — 6-phase build plan

## Development Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| 1 | Months 0-6 | Core charting platform (MVP) |
| 2 | Months 6-12 | Social + journal + options |
| 3 | Months 12-18 | Broker integration + advanced analysis |
| 4 | Months 18-24 | Algo trading + strategy IDE |
| 5 | Months 24-30 | Marketplace + copy trading |
| 6 | Months 30-42 | Institutional features |

## License

All rights reserved. This is proprietary software.

## Contributing

TheMarlinTraders is currently in private development. Contributing guidelines will be published when the project opens for external contributions.
