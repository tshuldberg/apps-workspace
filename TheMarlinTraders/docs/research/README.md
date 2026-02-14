# Research Index

> 10 research documents covering market mechanics, technical analysis, competitive landscape, infrastructure, social features, trading workflows, advanced instruments, institutional needs, algorithmic trading, and frontend design patterns.

---

## Methodology

Each research document was produced by a domain specialist examining primary sources (platform documentation, API specs, regulatory filings), industry data (market share, pricing, user counts), and practitioner workflows (day trading, swing trading, options, institutional). Research was conducted in February 2026.

The research covers the full spectrum of what a trading platform must understand: from how markets work (01) to how users interact with trading tools (06, 10), what competitors offer (03), and what infrastructure is needed to deliver it (04, 09).

---

## Documents

### 01 — Market Mechanics and Fundamentals
**File:** [01-market-mechanics.md](01-market-mechanics.md)

Covers order types (market, limit, stop, stop-limit, trailing stop, OCO, bracket), the 16 US equity exchanges and dark pools, market hours (including 2026 extended-hours evolution), market microstructure (order books, NBBO, Level 1/2/3 data), asset classes (equities, ETFs, options, futures, forex, crypto, bonds), the SIP data pipeline, regulatory landscape (SEC, FINRA, PDT rule changes, T+1 settlement), and margin accounts.

**Key finding:** The platform must handle 7 distinct asset classes, each with unique data formats, trading hours, and regulatory constraints. The order type system must support at least 8 order types at MVP.

---

### 02 — Technical Analysis and Charting
**File:** [02-technical-analysis-charting.md](02-technical-analysis-charting.md)

Catalogs 16 chart types (8 standard + 8 synthetic/non-standard), 50+ technical indicators across 5 categories (trend, momentum, volume, volatility, custom), 35+ drawing tools, and 30+ recognizable chart patterns. Analyzes multi-timeframe analysis requirements, comparison/overlay features, and TradingView's Pine Script ecosystem.

**Key finding:** MVP needs 6 chart types, 50+ indicators, and 15 core drawing tools. The indicator computation engine must run in a Web Worker to avoid blocking the rendering thread. Pine Script compatibility (even partial) would be a powerful migration incentive for TradingView's power users.

---

### 03 — Competitive Analysis
**File:** [03-competitive-analysis.md](03-competitive-analysis.md)

Deep analysis of TradingView (100M+ users, $172.9M revenue, 1.9/5 Trustpilot rating) plus 14 secondary competitors: Bloomberg, ThinkOrSwim, IBKR, Webull, Robinhood, MetaTrader 4/5, QuantConnect, TrendSpider, StockCharts, Finviz, Trading 212, Koyfin, and Sierra Chart. Includes a feature comparison matrix and identifies 8 market gaps.

**Key finding:** TradingView dominates charting and social but has no execution, weak options, and no algo trading. Bloomberg dominates institutional but costs $32K/year. The gap between $60/month (TradingView Premium) and $32K/year (Bloomberg) is enormous and underserved. TheMarlinTraders targets this gap.

---

### 04 — Market Data Infrastructure
**File:** [04-market-data-infrastructure.md](04-market-data-infrastructure.md)

Evaluates 11 data providers (Polygon.io recommended as primary), delivery protocols (REST, WebSocket, SSE, FIX), 7 charting libraries, and real-time architecture patterns. Includes system architecture diagrams, WebSocket server design, data normalization, tick-to-bar aggregation, multi-level caching strategy (L1: in-memory, L2: Redis, L3: TimescaleDB), and Web Worker architecture.

**Key finding:** The three-thread client architecture (WS Worker for connection, Data Worker for parsing/indicators, Main Thread for rendering only) is essential for maintaining 60fps during heavy market data flow. Polygon.io provides the best price/coverage ratio for Phase 1.

---

### 05 — Social Trading and Community
**File:** [05-social-trading-community.md](05-social-trading-community.md)

Analyzes TradingView's social layer (Ideas, Pine Script marketplace, Streams, reputation/badges), copy trading platforms (eToro CopyTrader, ZuluTrade, NAGA, Darwinex), monetization models, gamification approaches (education-focused vs. gimmicky), content creation tools, and viral growth mechanics (shareable links, embeddable widgets, referral programs, SEO).

**Key finding:** TradingView's social layer rewards engagement (likes) not accuracy. Verified performance tracking (linking published ideas to actual trades) is the single biggest differentiator for building trust in a social trading community.

---

### 06 — Retail Trading Workflows
**File:** [06-retail-trading-workflows.md](06-retail-trading-workflows.md)

Documents minute-by-minute day trader workflows (pre-market through post-market), multi-monitor screen layouts, scanner/screener requirements (pre-market gap, intraday momentum, end-of-day, custom formulas), the alert system (types, delivery, management), order entry (hotkeys, DOM, position sizing, bracket orders), risk management tools (R-multiple, daily P&L auto-lock), paper trading, trade journaling/analytics, and mobile trading.

**Key finding:** Day traders juggle 3-5 separate tools. The integration of scanner results into watchlists, watchlists into charts, charts into orders, and orders into journals — all within a single app — is the core value proposition. Hotkey-driven order entry with sub-second execution is non-negotiable for day trader adoption.

---

### 07 — Advanced Instruments and Trading
**File:** [07-advanced-instruments-trading.md](07-advanced-instruments-trading.md)

Covers options trading features (chain display, Greeks, IV analytics, strategy builder with 20+ strategies, probability analysis, options flow/unusual activity, max pain, historical earnings moves), futures (contract specs, continuous contracts, rollover, spread trading, COT data), forex (pip/lot calculators, session overlap, currency strength, correlation matrix), crypto (24/7 handling, on-chain metrics, DeFi, funding rates, liquidation levels), multi-leg order entry, and volatility analysis.

**Key finding:** Options traders are the highest-value segment (willing to pay $79-$99/month). A full options chain with Greeks, P&L diagrams, and flow data — features TradingView lacks entirely — would capture this underserved market.

---

### 08 — Institutional Requirements
**File:** [08-institutional-requirements.md](08-institutional-requirements.md)

Covers portfolio risk management (VaR parametric/historical/Monte Carlo, CVaR, stress testing, correlation analysis, factor analysis with Fama-French/Barra/PCA), portfolio construction (MPT, Black-Litterman, risk parity, rebalancing), performance attribution (Brinson-Fachler), institutional order types (TWAP, VWAP, iceberg, dark pool, SOR), compliance (position limits, restricted lists, pre-trade checks, audit trail, SEC reporting), and prime brokerage integration.

**Key finding:** Institutional features are Phase 6 (months 30-42) but the architectural decisions made in Phase 1 (multi-tenant data isolation, audit logging, role-based access) must anticipate them. Building institutional-grade infrastructure retroactively is prohibitively expensive.

---

### 09 — Algorithmic and Quantitative Trading
**File:** [09-algorithmic-quantitative-trading.md](09-algorithmic-quantitative-trading.md)

Covers the Strategy IDE requirements, language comparison (Pine Script vs. Python vs. TypeScript vs. Custom DSL vs. Visual Builder), backtesting engine design (vectorized + event-driven hybrid), strategy types (mean reversion, momentum, stat arb, market making, factor-based, ML), execution and live trading (paper trading, broker API, OMS, risk controls), strategy marketplace (selling models, performance verification, 70/30 revenue split), and ML integration (feature engineering, model training, drift detection).

**Key finding:** TypeScript as the primary strategy language (with Python interop for ML/data science) is the right choice. It shares the platform's core language, eliminates serialization overhead, and enables visual debugging on charts. The visual builder captures non-coders; Python interop captures quants.

---

### 10 — Frontend UX and Design Patterns
**File:** [10-frontend-ux-design-patterns.md](10-frontend-ux-design-patterns.md)

Covers the design system (dark mode first, CSS variable theming, Inter + JetBrains Mono typography, spacing/density modes), layout system (Dockview for docking/tiling/floating), chart interactions (crosshair, zoom/pan, drawing tools, animations), real-time data UX (price flashing, streaming at scale with rAF batching), component library (shadcn/ui + Radix UI), styling (Tailwind CSS v4), mobile (React Native Skia, gesture handling, bottom sheet order entry), accessibility (WCAG 2.1 AA), and performance optimization (virtual scrolling, memoization, Web Workers, Canvas vs. DOM).

**Key finding:** Financial UIs demand high information density without clutter. Dockview's docking system (used by VS Code) with configurable density modes (comfortable/compact/ultra-dense) lets each persona — from Sarah's clean beginner view to Marcus's 4-monitor day trading setup — use the same platform. Design inspiration: TradingView (feature density), Bloomberg (data density), Linear (polish), Stripe (documentation quality).

---

## Cross-Cutting Themes

These themes emerged across multiple research documents and directly shaped the product requirements and architecture:

1. **Integration is the product.** Every research document identified tool fragmentation as the primary pain point. Traders use 3-5 apps. Collapsing that into one integrated experience is the value proposition (01, 03, 06).

2. **Real-time performance is non-negotiable.** Sub-100ms quote-to-screen, 60fps chart rendering, and sub-second order execution are baseline requirements, not aspirational targets (04, 06, 10).

3. **The $60-to-$32K gap is the market opportunity.** TradingView tops out at ~$240/year for retail. Bloomberg starts at $32K/year for institutional. The prosumer segment ($29-$79/month) is underserved (03, 08).

4. **Verified performance is the social differentiator.** Every social trading platform suffers from the same problem: unverified claims. Linking published analysis to actual trade results creates trust (05, 06).

5. **Options traders are the highest-value early adopters.** They pay more, churn less, and TradingView serves them poorly. Prioritizing options chain + Greeks + P&L diagrams captures this segment (07, 03).

6. **Architecture must anticipate scale from day one.** Provider abstraction, multi-tenant isolation, audit logging, and horizontal scaling patterns cannot be retrofitted cheaply (04, 08, 09).

---

## How Research Informed Decisions

| Research Area | Key Decision It Drove |
|---------------|----------------------|
| Market Mechanics (01) | Order type system design; asset class prioritization (US equities first, then options, crypto, forex, futures) |
| Technical Analysis (02) | Indicator engine in Web Workers; 50+ indicators at MVP; phased drawing tool rollout |
| Competitive Analysis (03) | Pricing strategy ($29/$79 tiers); free tier alert limits (100 vs TradingView's 5); verified social differentiation |
| Market Data (04) | Polygon.io as primary provider; three-thread client architecture; multi-level caching strategy |
| Social Trading (05) | Verified performance tracking; idea publishing with interactive snapshots; creator monetization model |
| Retail Workflows (06) | Scanner-to-chart-to-order integration; hotkey-driven order entry; automatic trade journaling |
| Advanced Instruments (07) | Options chain in Phase 2 (not Phase 4); multi-leg strategy builder; IV analytics suite |
| Institutional (08) | Phase 6 timeline with Phase 1 architectural foundations; compliance engine design; SOC 2 preparation timeline |
| Algo Trading (09) | TypeScript primary + Python interop; hybrid backtesting engine; strategy marketplace revenue model |
| Frontend UX (10) | Dockview layout system; shadcn/ui + Radix UI; dark-mode-first design system; React Native Skia for mobile charts |
