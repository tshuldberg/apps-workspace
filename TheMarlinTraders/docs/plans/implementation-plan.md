# TheMarlinTraders — Implementation Plan

> 6-phase actionable build plan synthesizing the CPO's phased rollout with the CTO's system architecture.
> Last updated: 2026-02-13

---

## Phase 1: Core Charting Platform (MVP) — Months 0-6

### Objective

Ship a production-quality charting platform with real-time US equity data, 50+ indicators, drawing tools, watchlists, alerts, a stock screener, paper trading, and an iOS mobile app. This phase establishes the technical foundation that all future phases build on.

### Features

| ID | Feature | Size | Notes |
|----|---------|------|-------|
| M1 | Interactive charting (6 chart types, Canvas 2D, 60fps) | XL | TradingView Lightweight Charts v5.1 wrapper |
| M2 | 50+ technical indicators | XL | Computed in Web Workers via Comlink |
| M3 | Real-time US equity data (Polygon.io WebSocket) | L | SIP-level, <100ms quote-to-screen |
| M4 | Drawing tools (core 15: trendlines, Fibonacci, channels, shapes) | L | Magnetic snap to OHLC; persist per symbol+timeframe |
| M5 | Watchlists (multiple named, linked to charts) | M | Columns: price, % change, volume, RVOL, market cap |
| M6 | Alert system (price, volume, indicator; server-side) | L | 100 alerts free tier; push, email, webhook delivery |
| M7 | Stock screener (100+ filters, pre-built scans) | L | Real-time for paid, 15-min delayed for free |
| M8 | Account management (Clerk auth, Stripe billing) | M | Email + OAuth, subscription tiers |
| M9 | Multi-chart layouts (Dockview docking) | L | 2x1 through custom grid; saved templates; symbol linking |
| M10 | Mobile app — iOS (React Native + Expo + Skia) | XL | Charts, watchlists, alerts, paper trading, push notifications |
| M11 | Dark mode + light mode + colorblind mode | S | Dark mode primary (navy-black base) |
| M12 | Paper trading (simulated fills, separate account) | L | Bid/ask fills (not mid); same UI as live trading |
| M13 | Command palette (Cmd+K) | M | Symbol search, navigation, actions; fuzzy matching |
| M14 | Keyboard shortcuts (fully customizable) | M | Timeframe switching, panel nav, drawing tool shortcuts |

### Infrastructure to Build

- **Monorepo scaffold:** Turborepo + pnpm workspace with `apps/web`, `apps/mobile`, `apps/api`, and core packages (`shared`, `ui`, `charts`, `data`, `config`)
- **Database:** PostgreSQL 16 (Drizzle ORM) + TimescaleDB for OHLCV + Redis 7 for cache/pub/sub
- **Real-time pipeline:** Polygon.io WebSocket -> Provider Adapter -> Aggregation Engine -> Redis Pub/Sub -> WebSocket Gateway (ws on Fly.io) -> Client Web Workers
- **API:** tRPC routers (market, portfolio, alert, screener, auth) on Bun runtime, deployed to Railway
- **Web:** Next.js 15 App Router on Vercel; Dockview layout; shadcn/ui + Tailwind v4
- **Mobile:** Expo managed workflow; React Native Skia for charts; React Navigation
- **Auth + billing:** Clerk integration, Stripe subscription management
- **Search:** Meilisearch for symbol lookup (Cmd+K)
- **CI/CD:** GitHub Actions with matrix builds (web, mobile, api); Vitest + Playwright

### Team Requirements

| Role | Count | Focus |
|------|-------|-------|
| Senior full-stack (TypeScript) | 2 | API, tRPC routers, WebSocket gateway, database |
| Senior frontend (React) | 2 | Charting engine, Dockview layout, indicators, drawing tools |
| Mobile (React Native) | 1 | iOS app, Skia chart rendering, push notifications |
| DevOps/Platform | 1 | Monorepo, CI/CD, deployment, monitoring |
| Designer | 1 | Design system, component library, mobile UX |
| **Total** | **7** | |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Lightweight Charts v5.1 customization limits hit early | Medium | High | Build custom Canvas 2D renderer as fallback; scope custom features to Phase 2 |
| Polygon.io rate limits under load | Low | High | Multi-level caching (L1 in-memory, L2 Redis, L3 TimescaleDB); aggregate tick data server-side |
| Dockview layout complexity on mobile | Medium | Medium | Mobile uses a simplified tab-based layout, not full docking |
| 60fps rendering with 50+ indicators | Medium | High | Indicator computation in Web Workers; dirty-region canvas redrawing; limit visible indicators to 5 at 60fps |

### Success Criteria

- 50,000 registered users within 90 days of public launch
- 5,000 daily active users
- 15% free-to-paid conversion rate within 30 days
- Chart load time <500ms (1 year daily bars)
- Quote-to-screen latency <100ms
- 4.5+ App Store rating (iOS)
- Zero critical security vulnerabilities in third-party pentest

---

## Phase 2: Social Layer + Journal + Options — Months 6-12

### Objective

Add the social features that drive organic growth (idea publishing, profiles, leaderboards, discussion rooms), the trade journal that increases retention, options chain and strategy builder for Raj's segment, and the Android app.

### Features

| ID | Feature | Size | Notes |
|----|---------|------|-------|
| S1 | Trade journal (auto-log with chart snapshots) | L | R-multiple tracking, calendar P&L heatmap |
| S2 | Idea publishing (interactive chart snapshots) | L | Markdown body, voting, comments, ticker tags |
| S3 | User profiles (trading stats, verification badges) | M | Win rate, Sharpe, drawdowns; broker-connected badge |
| S4 | Leaderboards (risk-adjusted, by asset class/style) | M | Sharpe, max DD; customizable timeframes |
| S5 | Options chain (full chain with Greeks) | L | Bid/ask/volume/OI/IV per strike; expiration tabs |
| S6 | Strategy builder (multi-leg options) | XL | P&L diagram with date slider; 20+ template strategies |
| S11 | Android mobile app | L | Feature parity via shared React Native codebase |
| S13 | News feed (Benzinga, sentiment analysis) | M | Per-ticker filtering, economic calendar, earnings calendar |
| S14 | Performance dashboard | L | Equity curve, drawdown, win rate by setup, rolling Sharpe |
| S15 | Discussion rooms (real-time chat by ticker/strategy) | M | Threading, reputation gate, inline chart embeds |
| S16 | Embeddable widgets (chart, ticker tape) | M | One-click embed code, Open Graph for social sharing |

### Infrastructure Additions

- **Social service:** Idea storage, feed ranking, reputation system, moderation queue
- **Options data feed:** OPRA data via Polygon.io or Intrinio
- **News integration:** Benzinga API for real-time news + sentiment
- **Journal service:** Auto-log trades with chart snapshot capture (Cloudflare R2)
- **WebRTC evaluation:** Begin technical evaluation for Phase 5 live streaming
- **Android build pipeline:** Expo EAS Build for Android; Google Play deployment

### Team Additions

| Role | Count | Focus |
|------|-------|-------|
| Backend (social/community) | 1 | Social service, feeds, moderation, discussion rooms |
| Frontend (options) | 1 | Options chain, strategy builder, P&L diagrams |
| Content moderator | 1 | Community moderation, abuse prevention |
| **Phase 2 total** | **10** | 7 existing + 3 new |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Options data costs higher than projected | Medium | Medium | Negotiate volume pricing; start with delayed options data on lower tiers |
| Low social adoption (cold start) | High | High | Seed with power users from beta; import TradingView idea format; partner with trading educators |
| Journal auto-log accuracy (matching fills to charts) | Medium | Medium | Start with manual confirmation; iterate on auto-matching heuristics |

### Success Criteria

- 200,000 registered users
- 20,000 DAU
- 5,000 published ideas per month
- 500 active discussion room participants daily
- Options chain used by 30% of active paid users
- 8% cumulative free-to-paid conversion

---

## Phase 3: Advanced Analysis + Broker Integration — Months 12-18

### Objective

Enable real trading through broker integration (Alpaca, IBKR). Add advanced analysis features (AI chart analysis, heat maps, options flow, IV analytics) and expand to crypto and forex data. This phase transforms the platform from a charting tool into a trading tool.

### Features

| ID | Feature | Size | Notes |
|----|---------|------|-------|
| S7 | Advanced drawing tools (Fibonacci fan/arcs, Gann, Elliott Wave, harmonics) | L | Measurement tools (risk:reward) |
| S8 | Heat maps (S&P 500 treemap, custom metrics) | M | Sector drill-down, toggleable periods |
| S9 | AI chart analysis (NLP queries, pattern recognition) | XL | "Show me oversold large-caps breaking out near 52-week highs" |
| S10 | Broker integration Phase 1 (Alpaca + IBKR) | XL | Unified order entry from charts, position sync |
| S12 | Crypto data + 24/7 trading | M | Coinbase, Binance, Kraken; custom session definitions |
| C4 | Options flow / unusual activity | L | Block trades, sweeps, put/call ratio charts |
| C5 | IV analytics suite (rank, surface, skew, term structure) | L | HV vs IV overlay, volatility cones, expected move |
| C6 | Futures support (contract specs, continuous contracts, COT) | L | Rollover calendar, spread trading |
| C7 | Forex tools (pip calculator, session overlap, correlation matrix) | M | Currency strength meter |
| C14 | Auto pattern recognition (H&S, flags, triangles, cup & handle) | L | Confidence scoring, real-time scanning |
| C15 | Advanced order types (bracket, trailing stop, DOM, chart-based modification) | L | Click-to-trade price ladder |

### Infrastructure Additions

- **Broker adapter layer:** Abstract broker API behind unified interface; Alpaca and IBKR adapters
- **Order management system (OMS):** Order lifecycle tracking, fill processing, position reconciliation
- **AI/ML service:** GPU compute for pattern recognition and NLP chart queries
- **Crypto WebSocket connections:** Direct exchange feeds (Coinbase, Binance, Kraken)
- **Forex/futures data feeds:** Additional Polygon.io or dedicated forex/futures provider

### Team Additions

| Role | Count | Focus |
|------|-------|-------|
| Backend (broker integration) | 1 | Broker adapters, OMS, order routing |
| ML engineer | 1 | AI chart analysis, pattern recognition models |
| **Phase 3 total** | **12** | 10 existing + 2 new |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Broker API partnership delays | Medium | High | Start with Alpaca (simpler API, faster onboarding); IBKR integration as fast-follow |
| AI feature accuracy below user expectations | High | Medium | Launch with "beta" label; focus on high-confidence patterns first; user feedback loop |
| Regulatory complexity for broker-connected features | Medium | High | Legal review of each broker integration; ensure we are a "technology provider" not a broker |

### Success Criteria

- 500,000 registered users
- 50,000 DAU
- 10,000 funded broker accounts connected
- $500K monthly revenue
- AI feature usage by 40% of paid users
- Options flow reduces churn by 15% for Pro+ subscribers

---

## Phase 4: Algo Trading + Strategy IDE — Months 18-24

### Objective

Launch the strategy IDE (TypeScript primary + Python interop + visual builder), backtesting engine (vectorized + event-driven hybrid), and live strategy deployment. This phase captures Alex's segment and differentiates from both TradingView (Pine Script limitations) and QuantConnect (no visual charting).

### Features

| ID | Feature | Size | Notes |
|----|---------|------|-------|
| C1 | Strategy IDE (code editor, IntelliSense, debugging) | XL | TypeScript primary, Python via sandboxed runtime, visual builder for non-coders |
| C2 | Backtesting engine (vectorized + event-driven hybrid) | XL | Realistic fills (slippage, partial fills, commissions), walk-forward optimization, Monte Carlo |
| C3 | Live strategy deployment (broker API, OMS, risk controls) | XL | Max position, daily loss, drawdown kill switch; monitoring dashboard |
| C10 | ML model integration (feature engineering, training, drift detection) | XL | Pre-built templates, model versioning |
| C12 | Pine Script import (transpiler/compatibility layer) | L | Even partial compatibility is a growth hack |

### Infrastructure Additions

- **Strategy sandbox:** Isolated-vm or container-based execution for user code; no network/filesystem access, CPU/memory/time caps
- **Python runtime:** Sandboxed Python interop for ML workloads (pyodide or containerized)
- **Compute scaling:** Auto-scaling worker pool for concurrent backtests (100 concurrent target)
- **Historical data:** Survivorship-bias-free data for backtesting integrity
- **SOC 2 preparation:** Begin controls implementation and documentation

### Team Additions

| Role | Count | Focus |
|------|-------|-------|
| Backend (strategy engine) | 2 | Backtesting engine, sandbox, execution, strategy marketplace |
| Frontend (IDE) | 1 | Code editor (Monaco), visual builder, debugger |
| **Phase 4 total** | **15** | 12 existing + 3 new |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Strategy sandbox escape | Low | Critical | Defense in depth: isolated-vm + container + network isolation; third-party security audit |
| Backtesting accuracy disputes | Medium | High | Document fill model assumptions; provide "ideal" vs "realistic" modes; show slippage/commission impact |
| Pine Script transpiler complexity | High | Medium | Target 60-70% compatibility; document unsupported features; provide migration guide |
| Compute costs for backtesting | Medium | Medium | Usage-based pricing for compute-heavy features; cap free/Pro usage; priority compute for Premium |

### Success Criteria

- 1,000,000 registered users
- 100,000 DAU
- 5,000 strategies backtested per day
- 500 live strategies deployed
- 10% of Premium subscribers using the IDE
- Pine Script import converts 2,000 TradingView power users in first 6 months

---

## Phase 5: Marketplace + Copy Trading — Months 24-30

### Objective

Launch the creator economy: a marketplace for selling indicators, strategies, signals, and education; copy trading for followers; and live streaming. This phase creates network effects and a self-sustaining ecosystem.

### Features

| ID | Feature | Size | Notes |
|----|---------|------|-------|
| C8 | Copy trading (follow leaders, proportional sizing, risk filters) | XL | Sub-100ms replication latency; performance verification |
| C9 | Marketplace (sell indicators, strategies, signals, education) | XL | Creator tiers (Emerging/Established/Elite); platform takes 15-20% |
| C11 | Live streaming (WebRTC, screen share, chart annotation, tipping) | L | Chat with moderation; VOD recording |
| C13 | Crypto on-chain metrics (exchange flows, whale tracking, NVT/MVRV) | L | Funding rates, liquidation heatmap, DeFi TVL |

### Infrastructure Additions

- **Copy trading engine:** Sub-100ms order replication with proportional position sizing
- **Marketplace platform:** Payment processing for creators, review/rating system, performance verification
- **Streaming infrastructure:** WebRTC server (LiveKit or custom), CDN for VOD
- **On-chain data pipeline:** Glassnode/CryptoQuant integration

### Team Additions

| Role | Count | Focus |
|------|-------|-------|
| Backend (marketplace/payments) | 1 | Creator payments, revenue split, marketplace moderation |
| Frontend (streaming) | 1 | WebRTC integration, chat, VOD player |
| **Phase 5 total** | **17** | 15 existing + 2 new |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Copy trading regulatory scrutiny | Medium | High | Legal review; classify as "technology service" not investment advice; disclaimers and risk warnings |
| Marketplace quality control (scam strategies) | High | High | Performance verification, mandatory backtest results, review period, user ratings |
| Creator cold start (not enough sellers) | Medium | Medium | Seed marketplace with internal strategies; partner with established trading educators; creator incentive program |

### Success Criteria

- 500 active marketplace sellers
- $2M gross marketplace volume per month
- 10,000 active copy trading relationships
- 50 live streamers with 100+ concurrent viewers
- Platform marketplace commission: $300K/month

---

## Phase 6: Institutional Features — Months 30-42

### Objective

Launch the Enterprise tier targeting hedge funds, RIAs, prop desks, and small funds. Institutional-grade risk analytics, compliance, team workspaces, and advanced execution algos. This phase opens the highest-value segment and justifies $500-$2,000/month/seat pricing.

### Features

| Feature | Size | Notes |
|---------|------|-------|
| Portfolio risk dashboard (VaR, CVaR, stress testing) | XL | Parametric, historical, Monte Carlo VaR |
| Factor analysis (Fama-French, Barra, PCA) | XL | Custom factor model support |
| Performance attribution (Brinson-Fachler) | L | Return and risk attribution |
| Compliance engine (restricted lists, pre-trade checks, audit trail) | XL | Automated SEC/FINRA reporting |
| Institutional order types (TWAP, VWAP, iceberg, dark pool) | L | Smart order routing |
| Multi-user team workspaces (roles, shared views) | L | Admin, PM, analyst, trader roles |
| API-first programmatic access (REST + WebSocket) | L | Unlimited rate limits for Enterprise |
| Prime brokerage integration | XL | FIX protocol connectivity |

### Infrastructure Additions

- **FIX protocol gateway:** Connectivity to prime brokers and execution venues
- **Compliance engine:** Rule-based pre-trade checks, restricted list management, audit logging
- **Multi-tenant isolation:** Team-level data separation with role-based access
- **SOC 2 Type II certification:** Complete audit process
- **Dedicated infrastructure:** Option for on-premise or dedicated cloud deployment

### Team Additions

| Role | Count | Focus |
|------|-------|-------|
| Backend (institutional) | 2 | FIX protocol, compliance engine, risk analytics |
| Institutional sales | 1 | Enterprise accounts, onboarding, custom contracts |
| Security/compliance | 1 | SOC 2, penetration testing, audit coordination |
| **Phase 6 total** | **21** | 17 existing + 4 new |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Enterprise sales cycle length (6-12 months) | High | Medium | Start sales conversations in Phase 4; offer free pilot to 3-5 target accounts |
| SOC 2 certification delays | Medium | High | Begin preparation in Phase 4; engage auditor early |
| FIX protocol complexity | Medium | Medium | Use established FIX library (QuickFIX/N); start with one prime broker |
| Institutional feature scope creep | High | High | Define minimum viable institutional (MVI) feature set; iterate based on pilot feedback |

### Success Criteria

- 50 institutional accounts ($500+/month each)
- $500K/month institutional subscription revenue
- NPS >50 among institutional users
- SOC 2 Type II audit passed
- 99.95% uptime SLA maintained

---

## Cumulative Team Growth

| Phase | Timeline | Team Size | Key Hires |
|-------|----------|-----------|-----------|
| 1 | Months 0-6 | 7 | 2 full-stack, 2 frontend, 1 mobile, 1 DevOps, 1 designer |
| 2 | Months 6-12 | 10 | +1 backend (social), +1 frontend (options), +1 moderator |
| 3 | Months 12-18 | 12 | +1 backend (broker), +1 ML engineer |
| 4 | Months 18-24 | 15 | +2 backend (strategy), +1 frontend (IDE) |
| 5 | Months 24-30 | 17 | +1 backend (marketplace), +1 frontend (streaming) |
| 6 | Months 30-42 | 21 | +2 backend (institutional), +1 sales, +1 security |

---

## Infrastructure Cost Projections

| Phase | Monthly Cost | Key Drivers |
|-------|-------------|------------|
| 1 (10K MAU) | ~$771 | Polygon.io ($199), Railway ($50), Vercel ($20), Fly.io ($30), Cloudflare ($0-25), Redis ($30), Meilisearch ($30), Clerk ($25), Sentry ($29), monitoring ($50), Stripe fees (~2.9%+30c per transaction) |
| 2 (50K MAU) | ~$2,500 | +Options data feed, +Benzinga news, scaled compute |
| 3 (100K MAU) | ~$8,000 | +Broker API costs, +GPU compute for AI, +crypto/forex feeds |
| 4 (200K MAU) | ~$15,000 | +Backtesting compute, +sandboxed execution, +historical data |
| 5 (500K MAU) | ~$30,000 | +Streaming infrastructure, +marketplace payments |
| 6 (1M MAU) | ~$60,000 | +FIX gateway, +dedicated institutional infra, +compliance tooling |

---

## Architectural Foundations in Phase 1

These Phase 1 decisions ensure later phases do not require expensive rewrites:

1. **Provider abstraction.** Every external dependency (Polygon.io, Clerk, Stripe) sits behind an adapter interface. Adding Alpaca (Phase 3), IBKR (Phase 3), or a FIX gateway (Phase 6) means writing a new adapter, not refactoring the codebase.

2. **Multi-tenant data model.** User data isolation and role-based access are baked into the schema from day one. Team workspaces (Phase 6) extend this model rather than retrofitting it.

3. **Audit logging.** Every write operation records an audit entry. Compliance (Phase 6) requires complete audit trails; adding them retroactively is prohibitively expensive.

4. **Horizontal scaling patterns.** Stateless API servers, Redis-backed WebSocket fan-out, and BullMQ job queues scale horizontally from Phase 1. The architecture does not need to be re-plumbed for 1M concurrent connections.

5. **Sandboxed execution model.** The alert engine (Phase 1) already evaluates user-defined conditions in a controlled environment. The strategy IDE (Phase 4) extends this same sandboxing infrastructure.
