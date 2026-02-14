# TheMarlinTraders — Product Requirements Document

> **Version:** 1.0
> **Date:** 2026-02-13
> **Author:** CPO Office, TheMarlinTraders
> **Status:** Approved for Engineering Handoff

---

## 1. Product Vision & Positioning

TheMarlinTraders is the all-in-one trading platform where charting, strategy development, execution, journaling, and community exist in a single experience — powered by AI, priced for humans. We are building the platform that active traders have been assembling from 3-5 separate tools: TradingView for charts, ThinkOrSwim for options, QuantConnect for backtesting, Tradervue for journaling, and Unusual Whales for flow. TheMarlinTraders collapses that fragmented workflow into one unified environment where scanner results feed into watchlists, watchlists feed into charts, charts feed into orders, orders feed into journals, and journals feed into AI-powered performance insights.

**Competitive Positioning:** More powerful than TradingView (real algo trading, not sandboxed Pine Script), more accessible than Bloomberg ($49/mo, not $32K/year), more analytical than Robinhood (institutional-grade risk metrics, not confetti), more social than ThinkOrSwim (verified performance tracking, not zero community), and more integrated than QuantConnect (visual charting alongside code, not code-only). No single platform today occupies this center position. TradingView leads in charting + social, ThinkOrSwim leads in options, QuantConnect leads in algo, Koyfin leads in fundamentals, and TrendSpider leads in AI — but nobody does all five well (ref: 03-competitive-analysis, Section 3).

**Target Market:** The global retail trading platform market is fragmented across 100M+ TradingView users, millions of active brokerage account holders (Schwab, IBKR, Webull, Robinhood), and a growing "prosumer" segment of serious retail traders, RIAs, and small funds spending $100-$500/month on tools. Our initial TAM is the ~15M active U.S. retail traders who trade equities and options at least monthly, with expansion into crypto, forex, futures, and international markets in later phases.

---

## 2. User Personas

### 2.1 Sarah — The Beginner Investor

**Background:** 28, marketing manager, started investing during COVID. Has $15K in a Robinhood account, mostly buys individual stocks and ETFs.

**Goals:** Learn technical analysis, stop relying on Reddit for stock picks, build a disciplined investment process.

**Frustrations with current tools:** Robinhood's charts are too basic to learn TA. TradingView's free tier shows ads and limits her to 2 indicators per chart. She doesn't know which indicators matter or how to read them.

**Key features needed:** Educational onboarding, paper trading with guided tutorials, clean mobile app for monitoring, generous free tier with enough indicators (10+) to actually learn, AI-assisted chart interpretation ("What is this pattern telling me?").

### 2.2 Marcus — The Active Day Trader

**Background:** 35, full-time day trader for 3 years. Trades momentum setups on small-cap stocks with a $75K account. Uses a 4-monitor setup.

**Goals:** Reduce the number of tools he juggles (currently uses DAS Trader for execution, TradingView for charting, Trade Ideas for scanning, Tradervue for journaling). Increase consistency by reviewing his trade data more rigorously.

**Frustrations with current tools:** Copying tickers between DAS and TradingView wastes time. Manual trade journaling in Tradervue takes 30 minutes/day. No platform gives him real-time gap scanners AND good charting AND a journal in one place.

**Key features needed:** Real-time gap scanner and intraday momentum scanner, multi-chart grid layouts with symbol linking, hotkey-driven order entry with sub-second execution, automatic trade journaling with chart snapshots, daily P&L dashboard with auto-lock loss limit, Level 2 and Time & Sales (ref: 06-retail-trading-workflows, Sections 1-5).

### 2.3 Diana — The Swing/Position Trader

**Background:** 42, part-time trader with a $200K account. Holds positions for 1-4 weeks. Uses TradingView Premium ($59.95/mo) and Finviz for screening.

**Goals:** Find high-probability setups on daily/weekly charts, manage a watchlist of 50-200 candidates, trail stops on winning positions without watching screens all day.

**Frustrations with current tools:** TradingView's screener lacks the visual heat maps and speed of Finviz. Alert limits force her to pay for Premium. No integrated journal means she tracks trades in Excel.

**Key features needed:** End-of-day and weekly pattern scanners, Finviz-quality heat maps, generous alert limits (200+ on standard plan), server-side alerts with webhook/push delivery, swing trade watchlist management with multiple named lists, chart drawing persistence across devices (ref: 06-retail-trading-workflows, Section 10).

### 2.4 Raj — The Options Trader

**Background:** 38, software engineer who trades options as a side income. $150K account at Schwab. Runs credit spreads and iron condors, occasionally buys directional.

**Goals:** Find high-probability options setups, analyze risk/reward before entering, track his Greeks exposure across positions, and access options flow data without a separate $99/mo subscription.

**Frustrations with current tools:** TradingView has no options chain, no Greeks, no P&L diagrams. ThinkOrSwim has great options tools but zero social features and a dated UI. Unusual Whales costs $99/mo just for flow data.

**Key features needed:** Full options chain with Greeks, IV rank/percentile, strategy builder with P&L diagrams, probability analysis (POP, expected move cones), options flow/unusual activity feed, IV surface visualization, historical earnings move analysis (ref: 07-advanced-instruments, Sections 1, 5-7).

### 2.5 Alex — The Algo/Quant Trader

**Background:** 30, data scientist at a tech company, builds trading algorithms in Python on evenings and weekends. Uses QuantConnect for backtesting and Alpaca for execution.

**Goals:** Develop, backtest, and deploy quantitative strategies without switching between Jupyter notebooks, QuantConnect's web IDE, and a charting platform.

**Frustrations with current tools:** QuantConnect has no visual charting — he cannot see his strategy's entries/exits on a real chart. TradingView's Pine Script is too limited for ML-based strategies (no external data, no real Python libraries). No platform lets him visually analyze a strategy AND code it AND deploy it in one place.

**Key features needed:** Strategy IDE with Python + TypeScript support, event-driven backtesting engine with realistic fill simulation, walk-forward optimization, Monte Carlo analysis, ML model training pipeline (feature engineering, model training, drift detection), broker API integration (IBKR, Alpaca), live strategy monitoring dashboard (ref: 09-algorithmic-quant-trading, Sections 1-5, 7).

### 2.6 Victoria — The Institutional/Hedge Fund Trader

**Background:** 45, portfolio manager at a $200M long/short equity fund. Currently uses Bloomberg Terminal, FactSet, and a custom OMS.

**Goals:** Reduce Bloomberg seat costs ($32K/year/seat x 8 seats = $256K/year), get modern UX for her analysts, and consolidate portfolio risk analytics into a single platform.

**Frustrations with current tools:** Bloomberg's UI is from the 1980s and new analysts take months to learn it. No modern platform provides portfolio-level VaR, stress testing, factor analysis, and Brinson-Fachler attribution. The gap between Bloomberg ($32K) and TradingView ($60) is enormous — there's nothing in between.

**Key features needed:** Portfolio risk dashboard (VaR, CVaR, stress testing), factor analysis (Fama-French, PCA), performance attribution (Brinson-Fachler), compliance engine (restricted lists, pre-trade checks, audit trail), multi-user team workspaces, institutional order types (TWAP, VWAP, iceberg), API-first architecture for custom integrations (ref: 08-institutional-requirements, Sections 1-7).

### 2.7 Tyler — The Social Trader/Content Creator

**Background:** 26, has 45K followers on Twitter/X posting chart analysis. Monetizes through a Discord community ($49/mo subscription, 800 members). Uses TradingView for charting and idea publishing.

**Goals:** Build a verified track record that proves his calls are profitable (not just cherry-picked screenshots), monetize directly on the platform instead of through Discord, and grow his audience with discoverability.

**Frustrations with current tools:** TradingView's reputation system rewards engagement (likes), not accuracy. Anyone can post a chart calling AAPL to $300 and get likes — there's no verification of whether they actually traded it. His Discord community is separate from his analysis tools, creating friction.

**Key features needed:** Verified performance tracking (win rate, Sharpe, drawdown) linked to actual trades, idea publishing with interactive chart snapshots, marketplace for selling indicators/signals/education, live streaming with chart annotation, tipping/subscription monetization on-platform, embeddable chart widgets for his blog (ref: 05-social-trading-community, Sections 1-4, 6-7).

---

## 3. Feature Requirements (MoSCoW Prioritized)

### Must Have (MVP) — Launch Features

| # | Feature | Description | Personas | Size |
|---|---------|-------------|----------|------|
| M1 | Interactive charting | Candlestick, OHLC, line, area, baseline, Heikin-Ashi charts. Zoom, pan, crosshair sync. Canvas 2D rendering at 60fps. | All | XL |
| M2 | 50+ technical indicators | SMA, EMA, MACD, RSI, Bollinger Bands, VWAP, Volume Profile, Ichimoku, Stochastic, ATR, ADX, Supertrend, OBV, and 37+ more (ref: 02-technical-analysis, Section 2). | All | XL |
| M3 | Real-time US equity data | WebSocket streaming from Polygon.io (SIP-level). Quote-to-screen latency <100ms. Historical data: 20+ years daily, 5+ years 1-min bars. | All | L |
| M4 | Drawing tools (core set) | Trendlines, horizontal/vertical lines, Fibonacci retracement/extension, parallel channels, rectangles, text labels. Magnetic snap to OHLC. Persist per symbol+timeframe. | All | L |
| M5 | Watchlists | Multiple named watchlists. Columns: symbol, price, % change, volume, RVOL, market cap, float. Symbol linking to charts. Desktop + mobile sync. | All | M |
| M6 | Alert system | Price, volume, and indicator alerts. Server-side execution (fire when browser is closed). Delivery: in-app, push notification, email, webhook. Minimum 100 alerts on free tier. | Diana, Marcus | L |
| M7 | Stock screener | 100+ filters (fundamental + technical). Real-time for paid plans, 15-min delayed for free. Pre-built scans (gap scanner, momentum, breakouts). Custom formula support. | Marcus, Diana | L |
| M8 | Account management | Registration, authentication (email + OAuth), user profiles, subscription billing (Stripe), settings. | All | M |
| M9 | Multi-chart layouts | 2x1, 2x2, 3x2, custom grid. Dockview-based docking with drag-and-drop panel rearrangement. Saved layout templates. Symbol linking groups. | Marcus, Diana | L |
| M10 | Mobile app (iOS) | Chart viewing, watchlists, alerts, portfolio monitoring, quick order entry. React Native with Skia for chart rendering. Bottom sheet order entry. Push notifications. | All | XL |
| M11 | Dark mode + light mode | Dark mode primary (navy-black base, ref: 10-frontend-ux, Section 1). Light mode opt-in. Colorblind-accessible mode (blue/orange). | All | S |
| M12 | Paper trading | Simulated trading with realistic fills (bid/ask, not mid). Same UI as live trading. Separate account with clear visual indicator. Full P&L tracking. | Sarah, Marcus | L |
| M13 | Command palette | Cmd+K search for symbols, navigation, actions. Fuzzy matching. Recent symbols. Categorized results (stocks, crypto, forex, actions). | All | M |
| M14 | Keyboard shortcuts | Fully customizable hotkeys for all major actions. Quick timeframe switching (1-9 keys). Panel navigation (Ctrl+1-6). Drawing tool shortcuts. | Marcus, Alex | M |

### Should Have (v1.1 - v1.5) — First Year Post-Launch

| # | Feature | Description | Personas | Size |
|---|---------|-------------|----------|------|
| S1 | Trade journal (auto) | Automatic logging of every trade with chart snapshot at entry/exit. Tagging system (setup type, emotional state, grade). Calendar P&L heatmap. R-multiple tracking. | Marcus, Diana | L |
| S2 | Social: idea publishing | Permanent, public chart analysis posts with interactive snapshots. Markdown body. Voting, comments, author updates. Tagged by ticker, strategy, timeframe. | Tyler, Sarah | L |
| S3 | Social: user profiles | Trading stats dashboard (win rate, avg R:R, Sharpe). Strategy description. Verification badges (identity, broker-connected, performance-audited). Follower/following. | Tyler | M |
| S4 | Leaderboards | Performance-based ranking with customizable timeframes (7d-all time). Risk-adjusted metrics (Sharpe, max DD). Separate boards by asset class and style. | Tyler, Sarah | M |
| S5 | Options chain | Full chain with bid/ask/last/volume/OI/IV/Greeks per strike. Dual-pane (calls left, puts right). Expiration tabs. ITM highlighting. Strike filtering. | Raj | L |
| S6 | Strategy builder (options) | Multi-leg construction (verticals, iron condors, butterflies, straddles, calendars). P&L diagram with date slider. Max profit/loss/POP display. Template-based and click-to-add entry. | Raj | XL |
| S7 | Advanced drawing tools | Fibonacci fan/arcs/time zones, Gann fan/box, Elliott Wave labels, XABCD harmonic patterns, regression channel. Measurement tools (price range, date range, risk:reward). | Diana, Marcus | L |
| S8 | Heat maps | S&P 500 treemap by sector, sized by market cap, colored by performance. Toggleable periods (1D, 1W, 1M, YTD). Custom metric coloring (P/E, RSI, IV rank). Clickable to drill into stocks. | Diana | M |
| S9 | AI chart analysis | Natural language queries ("show me oversold large-caps breaking out of a base near 52-week highs"). AI pattern recognition. AI-powered trade review analyzing journal patterns. | Sarah, Diana | XL |
| S10 | Broker integration (phase 1) | Paper trading first, then Alpaca (commission-free, modern API) and Interactive Brokers. Unified order entry from charts. Position sync. | Marcus, Alex | XL |
| S11 | Android mobile app | Feature parity with iOS. React Native shared codebase with platform-specific optimizations. | All | L |
| S12 | Crypto data + 24/7 | Real-time crypto from major exchanges (Coinbase, Binance, Kraken). No market-hours assumptions. Custom session definitions for VWAP/VP. | Sarah, Tyler | M |
| S13 | News feed | Real-time news with sentiment analysis (Benzinga integration). Per-ticker and watchlist-level filtering. Economic calendar with countdown timers. Earnings calendar. | All | M |
| S14 | Performance dashboard | Equity curve, drawdown analysis, win rate by setup type, time-of-day analysis, holding time analysis, rolling Sharpe. Export to CSV/PDF. | Marcus, Diana | L |
| S15 | Discussion rooms | Real-time chat by ticker, strategy type, market. Threading. Reputation gate for posting. Rich media (inline chart embeds). | Tyler, Sarah | M |
| S16 | Embeddable widgets | Chart widget, ticker tape, market overview. One-click embed code. Open Graph metadata for social sharing. SEO-optimized published ideas. | Tyler | M |

### Could Have (v2.0+) — Growth & Power Features

| # | Feature | Description | Personas | Size |
|---|---------|-------------|----------|------|
| C1 | Strategy IDE | Code editor with syntax highlighting, IntelliSense, breakpoint debugging. TypeScript primary, Python via sandboxed runtime. Visual builder for non-coders. | Alex | XL |
| C2 | Backtesting engine | Event-driven + vectorized hybrid. Realistic fill simulation (slippage, partial fills, commissions). Walk-forward optimization. Monte Carlo analysis. Survivorship-bias-free data. | Alex | XL |
| C3 | Live strategy deployment | Broker API abstraction layer. OMS with order lifecycle tracking. Risk circuit breakers (max position, daily loss, drawdown kill switch). Monitoring dashboard. | Alex | XL |
| C4 | Options flow & unusual activity | Detect unusual volume (>2x avg volume AND >2x OI), block trades, sweeps, aggressive trades. Table with time/ticker/strike/sentiment/premium/type. Put/call ratio charts. | Raj | L |
| C5 | IV analytics suite | IV rank/percentile, IV surface 3D, skew charts, IV term structure, HV vs IV overlay, volatility cones, expected move projections on chart. | Raj | L |
| C6 | Futures support | Contract specs display, continuous contract construction (back-adjusted/unadjusted), rollover calendar with alerts, one-click roll, spread trading, margin display, COT data visualization. | Marcus, Diana | L |
| C7 | Forex tools | Pip calculator, lot size calculator, swap rates, currency strength meter, correlation matrix, session overlap visualization. | Diana | M |
| C8 | Copy trading | Follow leaders' trades with proportional sizing. Copy stop-loss. Performance verification. Risk filters per follower. Sub-100ms replication latency target. | Sarah, Tyler | XL |
| C9 | Marketplace | Sell custom indicators, strategies, signals, education. Subscription model. Creator tiers (Emerging/Established/Elite). Platform takes 15-20%. | Tyler, Alex | XL |
| C10 | ML model integration | Feature engineering pipeline, model training (classification/regression/RL), prediction integration into strategies, drift detection, model versioning. Pre-built templates. | Alex | XL |
| C11 | Live streaming | WebRTC-based. Screen sharing + webcam. Real-time chart annotation. Chat with moderation. Tipping. VOD recording. | Tyler | L |
| C12 | Pine Script import | Transpiler or compatibility layer for migrating TradingView Pine Script strategies. Even partial compatibility is a growth hack. | Alex, Diana | L |
| C13 | Crypto on-chain metrics | Exchange inflows/outflows, whale transactions, NVT/MVRV ratios, active addresses, funding rates, liquidation heatmap, DeFi TVL. | Sarah | L |
| C14 | Pattern recognition (auto) | Algorithmic detection of H&S, double top/bottom, flags, pennants, triangles, cup & handle, candlestick patterns. Confidence scoring. Real-time scanning. | Diana, Sarah | L |
| C15 | Advanced order types | Bracket (OCO), trailing stop, iceberg, conditional orders. Chart-based order modification (drag stop/target lines). DOM/price ladder with click-to-trade. | Marcus | L |

### Won't Have (Out of Scope)

| Feature | Reason |
|---------|--------|
| **Own brokerage/clearing** | We are a platform, not a broker-dealer. Execution through partner brokers (Alpaca, IBKR). Avoids regulatory complexity (SEC/FINRA registration, SIPC insurance, capital requirements). |
| **High-frequency trading infrastructure** | Co-location, sub-microsecond latency, FIX protocol direct exchange connectivity. Our latency tier (1-50ms vendor feeds) serves retail and prosumer but not HFT. The economics don't work — HFT firms build custom infrastructure. |
| **Full Bloomberg Terminal replacement** | Bloomberg's 35,000+ functions, fixed income analytics (yield curve construction, OAS, swap pricing), and institutional chat network are not replicable. We target 80% of functionality at 0.5% of the price for the prosumer segment. |
| **Prediction/tips service** | We do not make market predictions or provide investment advice. The platform provides tools; users make their own decisions. This avoids RIA registration requirements. |
| **Physical commodity delivery** | Futures support covers financially-settled contracts only. No warehouse receipts, no physical delivery logistics. |
| **Proprietary trading/market making** | We do not trade against our users or take principal risk. Revenue comes from subscriptions, marketplace commissions, and data fees. |

---

## 4. Phased Rollout Plan

### Phase 1: Core Charting Platform (MVP) — Months 0-6

**Features:** M1-M14 (interactive charting, 50+ indicators, real-time data, drawing tools, watchlists, alerts, screener, multi-chart layouts, paper trading, mobile iOS, dark mode, command palette, keyboard shortcuts, account management).

**Target Users:** Sarah (beginner), Diana (swing trader), Marcus (day trader — charting and scanning, not yet execution).

**Success Metrics:**
- 50,000 registered users within 90 days of public launch
- 5,000 daily active users (DAU)
- 15% free-to-paid conversion rate within 30 days
- Chart load time <500ms (1 year daily bars), quote-to-screen <100ms
- 4.5+ App Store rating (iOS)

**Dependencies:** Polygon.io data contract signed, Dockview docking library integrated, TradingView Lightweight Charts v5 customized, Stripe billing configured.

### Phase 2: Social Layer + Paper Trading + Journal — Months 6-12

**Features:** S1-S6, S11, S13-S16 (trade journal, idea publishing, user profiles, leaderboards, options chain, strategy builder, Android app, news feed, performance dashboard, discussion rooms, embeddable widgets).

**Target Users:** Tyler (content creator), Raj (options trader), expanded Sarah and Diana engagement.

**Success Metrics:**
- 200,000 registered users
- 20,000 DAU
- 5,000 published ideas per month
- 500 active discussion room participants daily
- Options chain usage by 30% of active paid users
- 8% conversion from free to paid (cumulative)

**Dependencies:** Options data feed (Polygon.io or Intrinio OPRA), Benzinga news API, social infrastructure (moderation tools, reputation system).

### Phase 3: Advanced Analysis + Broker Integration — Months 12-18

**Features:** S7-S10, S12, C4-C7, C14-C15 (advanced drawing tools, heat maps, AI chart analysis, broker integration Phase 1, crypto data, options flow, IV analytics, futures, forex tools, pattern recognition, advanced order types).

**Target Users:** Marcus (full execution workflow), Raj (options flow + vol analytics), broader crypto and forex traders.

**Success Metrics:**
- 500,000 registered users
- 50,000 DAU
- 10,000 funded broker accounts connected
- $500K monthly revenue (subscriptions + data fees)
- AI feature usage by 40% of paid users
- Options flow feature reduces churn by 15% for Pro+ subscribers

**Dependencies:** Alpaca and IBKR broker API partnerships signed, Glassnode/CryptoQuant on-chain data agreements, GPU compute for AI features.

### Phase 4: Algo Trading + Strategy IDE — Months 18-24

**Features:** C1-C3, C10, C12 (strategy IDE, backtesting engine, live deployment, ML integration, Pine Script import).

**Target Users:** Alex (algo/quant trader), advanced Marcus and Raj using automated strategies.

**Success Metrics:**
- 1,000,000 registered users
- 100,000 DAU
- 5,000 strategies backtested per day
- 500 live strategies deployed
- 10% of Premium subscribers using the IDE
- Pine Script import converts 2,000 TradingView power users in first 6 months

**Dependencies:** Backtesting data infrastructure (survivorship-bias-free historical data), sandboxed Python runtime, compute scaling for concurrent backtests.

### Phase 5: Marketplace + Copy Trading — Months 24-30

**Features:** C8-C9, C11 (copy trading, marketplace, live streaming).

**Target Users:** Tyler (creator monetization), Sarah (follower/learner), ecosystem participants.

**Success Metrics:**
- 500 active marketplace sellers
- $2M gross marketplace volume per month
- 10,000 active copy trading relationships
- 50 live streamers with 100+ concurrent viewers
- Platform marketplace commission: $300K/month

**Dependencies:** Payment processing for creators, verified performance tracking infrastructure, copy trading order replication engine (<100ms latency), content moderation team.

### Phase 6: Institutional Features — Months 30-42

**Features:** Institutional tier with VaR/CVaR/stress testing, factor analysis, Brinson-Fachler attribution, compliance engine, TWAP/VWAP execution algos, multi-user team workspaces, API-first programmatic access, prime brokerage integration.

**Target Users:** Victoria (hedge fund PM), RIAs, small funds, prop trading desks.

**Success Metrics:**
- 50 institutional accounts ($500+/month each)
- $500K/month institutional subscription revenue
- NPS >50 among institutional users
- Pass SOC 2 Type II audit
- 99.95% uptime SLA maintained

**Dependencies:** FIX protocol connectivity, prime brokerage partnerships, SOC 2 certification, dedicated institutional sales team.

---

## 5. Subscription Tiers

| Feature | Free | Pro ($29/mo) | Premium ($79/mo) | Enterprise (Custom) |
|---------|------|-------------|-------------------|---------------------|
| **Charts per tab** | 2 | 8 | 16 | Unlimited |
| **Indicators per chart** | 10 | 25 | 50 | Unlimited |
| **Price alerts** | 100 | 500 | Unlimited | Unlimited |
| **Drawing tools** | Core (15 tools) | Full (35+ tools) | Full + templates | Full + templates |
| **Watchlists** | 3 | 10 | Unlimited | Unlimited + shared |
| **Saved layouts** | 2 | 10 | Unlimited | Unlimited + team |
| **Real-time data** | US equities (15-min delayed) | US equities (real-time) | US + options + crypto + forex | All + Level 2 + options flow |
| **Historical data** | 5 years daily | 20 years daily, 1 year 1-min | 20 years daily, 5 years 1-min, tick data | Full tick data archive |
| **Screener** | Basic (20 filters, delayed) | Full (100+ filters, real-time) | Full + custom formulas | Full + API access |
| **Paper trading** | Yes | Yes | Yes | Yes |
| **Trade journal** | Manual only | Auto-log (50 trades/mo) | Auto-log (unlimited) | Unlimited + team journals |
| **Social features** | View ideas | Publish ideas, join rooms | Priority placement, live stream | Private team rooms |
| **AI features** | None | Basic (5 queries/day) | Full (unlimited queries) | Full + custom models |
| **Options chain** | None | View-only | Full (chain + Greeks + P&L diagrams) | Full + flow + vol surface |
| **Strategy IDE** | None | None | TypeScript + visual builder | TS + Python + ML pipeline |
| **Backtesting** | None | None | 100 backtests/month | Unlimited + priority compute |
| **Live trading** | None | Alpaca | Alpaca + IBKR | All brokers + TWAP/VWAP |
| **Marketplace** | Browse only | Buy | Buy + sell | Buy + sell + white-label |
| **Compliance tools** | None | None | None | Full suite (restricted lists, audit, reporting) |
| **Team features** | None | None | None | Multi-user, roles, shared workspaces |
| **Support** | Community forum | Email (24h response) | Priority email (4h response) | Dedicated account manager |
| **Ads** | Minimal, non-intrusive | None | None | None |
| **API access** | None | None | REST API (1000 req/min) | Full API (unlimited) |

**Pricing Rationale:**

- **Free tier is genuinely useful**, not a crippled demo. 10 indicators per chart (vs TradingView's 2), 100 alerts (vs TradingView's 5), and 2 charts per tab give beginners everything they need to learn. This drives organic growth and word-of-mouth.
- **Pro at $29/mo** undercuts TradingView Plus ($29.95/mo) while offering more: real-time data, 25 indicators, 500 alerts, auto journal, and AI features. This is the sweet spot for active retail traders.
- **Premium at $79/mo** targets the prosumer: Raj (options), Alex (algo), Diana (power user). Comparable to TrendSpider's Standard ($54/mo) but with far more features. The strategy IDE and backtesting engine justify the premium.
- **Enterprise at custom pricing** ($500-$2,000/mo per seat) targets Victoria's fund. At 1/16th of Bloomberg's price, even partial feature parity is compelling.

---

## 6. Monetization Strategy

| Revenue Stream | Phase | Projected Mix (Year 3) | Description |
|----------------|-------|----------------------|-------------|
| **Subscriptions** | 1+ | 55% | Pro/Premium/Enterprise tiers. Primary revenue driver. Predictable MRR. |
| **Marketplace commissions** | 5+ | 15% | 15-20% commission on indicator, strategy, signal, and education sales. Creator-platform revenue sharing. |
| **Data fees** | 3+ | 10% | Premium real-time data (Level 2, options flow, on-chain metrics) as add-ons or included in higher tiers. Pass-through from data providers with margin. |
| **Broker referral fees** | 3+ | 10% | Revenue share from Alpaca, IBKR, and future broker partners for referred accounts and trading volume. Industry standard: $50-150 per funded account + ongoing activity share. |
| **Enterprise/API licensing** | 6+ | 8% | Custom enterprise contracts, white-label charting widgets, API access for fintech partners embedding our charts. |
| **Creator program revenue** | 5+ | 2% | Platform takes 15% of creator subscription revenue, 20-30% of tipping/coins. Small but growing as the creator ecosystem scales. |

**Year 3 Revenue Target:** $25M ARR
- 300,000 paid subscribers (avg $6.50/mo blended across tiers) = $23.4M
- Marketplace, data, referrals = $1.6M (ramping)

**Key Pricing Decisions:**
1. No alert-count-based upselling. Alerts are generous at every tier. TradingView's alert gating is their most-complained-about monetization tactic (ref: 03-competitive-analysis, Section 1) — we weaponize this pain point.
2. AI features included in Pro+, not gated behind a separate AI add-on. AI is a core differentiator, not a luxury upsell.
3. Usage-based pricing only for compute-heavy features (backtesting runs beyond tier limits, GPU compute for ML). This aligns cost with value delivered.

---

## 7. Key Performance Indicators (KPIs)

### User Acquisition
| Metric | Phase 1 Target | Phase 3 Target | Phase 5 Target |
|--------|---------------|---------------|---------------|
| Registered users | 50,000 | 500,000 | 2,000,000 |
| Monthly new signups | 10,000 | 40,000 | 80,000 |
| Cost per acquisition (CPA) | <$15 | <$10 | <$8 |
| Organic signup rate | >40% | >50% | >60% |

### Engagement
| Metric | Target |
|--------|--------|
| DAU/MAU ratio | >25% (high engagement for a trading platform) |
| Average session duration | >15 minutes (desktop), >5 minutes (mobile) |
| Charts viewed per session | >10 |
| Alerts set per active user | >20 |
| Ideas published per month | >5,000 (Phase 2+) |
| Return rate (7-day) | >60% |

### Conversion
| Metric | Target |
|--------|--------|
| Free to paid conversion (30-day) | >8% |
| Pro to Premium upgrade rate (annual) | >15% |
| Trial-to-paid conversion | >25% |
| Churn rate (monthly, paid) | <5% |
| Churn rate (annual, paid) | <15% |
| Net Revenue Retention (NRR) | >110% |

### Revenue
| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| MRR | $200K | $1M | $2.1M |
| ARR | $2.4M | $12M | $25M |
| ARPU (paid) | $35/mo | $40/mo | $45/mo |
| LTV | $350 | $480 | $600 |
| LTV:CAC ratio | >3:1 | >4:1 | >5:1 |

### Platform Health
| Metric | Target |
|--------|--------|
| Uptime | 99.9% (Phase 1-3), 99.95% (Phase 4+) |
| P50 chart load time | <300ms |
| P99 chart load time | <1000ms |
| Quote-to-screen latency | <100ms |
| WebSocket reconnection time | <3 seconds |
| App crash rate (mobile) | <0.5% |
| NPS | >40 (Phase 1), >50 (Phase 3+) |
| Trustpilot rating | >4.0 (TradingView is 1.9 — we beat this by actually providing support) |

---

## 8. Non-Functional Requirements

### Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Chart initial load (1 year daily) | <500ms | Human tolerance for "instant" feels like <1s; 500ms keeps us in the responsive zone. |
| Chart initial load (1 year 1-min) | <1500ms | ~98,000 bars; progressive loading shows first 200 candles in <300ms, lazy-loads history. |
| Indicator calculation (add new) | <50ms | Must feel instant when toggling an indicator on/off (ref: 04-market-data-infrastructure, Section 6). |
| Quote-to-screen latency | <100ms | Human perception threshold for "real-time." Vendor feeds (Polygon) deliver in 1-50ms; rendering adds overhead (ref: 04-market-data-infrastructure, Section 6). |
| Chart panning/zooming frame rate | 60fps (16ms budget) | Jank is unacceptable. Use Canvas 2D with dirty-region tracking. Offload indicator computation to Web Workers (ref: 10-frontend-ux, Section 9). |
| Order entry to broker submission | <200ms | Day traders need sub-second execution. Hotkey press to order-on-wire must be <200ms. |
| Search/symbol lookup (Cmd+K) | <200ms | Autocomplete must feel instant (ref: 04-market-data-infrastructure, Section 6). |
| Mobile chart frame rate | 60fps (120fps on ProMotion) | React Native Skia achieves this with GPU-direct rendering (ref: 10-frontend-ux, Section 7). |
| Initial JavaScript bundle | <200KB (gzipped) | First meaningful paint must be fast. Code-split aggressively. Lazy-load chart module, drawing tools, advanced features (ref: 10-frontend-ux, Section 9). |

### Scalability

| Requirement | Target |
|-------------|--------|
| Concurrent WebSocket connections | 100,000 (Phase 1), 1,000,000 (Phase 3) |
| Symbols tracked (backend) | 10,000+ (US equities + options + crypto) |
| Peak upstream message rate | 1,000,000 updates/second at market open |
| Per-client subscription limit | 200 symbols simultaneous |
| Historical data storage | 20+ years daily, 5+ years 1-min for US equities |
| Backtesting concurrent jobs | 100 (Phase 4), 1,000 (Phase 5) |
| Database: time-series writes | 500,000 bars/second (TimescaleDB with continuous aggregates) |

### Reliability

| Requirement | Target |
|-------------|--------|
| Uptime SLA | 99.9% (Phase 1-3), 99.95% (Phase 4+, Enterprise) |
| Planned maintenance window | Weekends only, outside of crypto market hours (announce 72h ahead) |
| Data durability | 99.999% (user settings, layouts, drawings, journal entries) |
| Alert delivery guarantee | At-least-once delivery within 5 seconds of trigger condition |
| Disaster recovery | RPO <1 hour, RTO <4 hours |
| WebSocket reconnection | Automatic with exponential backoff (1s-30s), message buffering during reconnection |

### Security

| Requirement | Details |
|-------------|---------|
| Authentication | Email + password (bcrypt, min 12 chars), OAuth 2.0 (Google, Apple, GitHub), 2FA (TOTP) mandatory for accounts with linked brokers |
| API key management | Encrypted storage, scoped permissions (read-only vs trade), per-key rate limits, rotation support |
| Data encryption | TLS 1.3 in transit, AES-256 at rest for PII, broker credentials, and API keys |
| Broker credential handling | Never store broker passwords. Use OAuth token delegation where brokers support it (Alpaca, IBKR). Tokens encrypted at rest with HSM-backed keys. |
| Session management | JWT with 15-min access token, 30-day refresh token. Concurrent session limit: 5 devices. |
| Input validation | Server-side validation on all inputs. Rate limiting on all endpoints. OWASP Top 10 mitigation. |
| SOC 2 Type II | Required before Phase 6 (institutional launch). Begin preparation in Phase 4. |
| Penetration testing | Annual third-party pentest. Bug bounty program from Phase 2. |
| Strategy code sandboxing | User-submitted strategy code runs in isolated containers/WASM with no network access, no filesystem access, CPU/memory limits, and execution time caps. |

### Accessibility (WCAG 2.1 AA)

| Requirement | Details |
|-------------|---------|
| Color contrast | 4.5:1 for text, 3:1 for graphical elements. Colorblind mode (blue/orange) available. |
| Keyboard navigation | Every feature fully operable via keyboard. Focus indicators visible. Tab order logical. |
| Screen reader support | ARIA labels on all interactive elements. Data table alternative for charts. Live regions for price updates. |
| Reduced motion | Respect `prefers-reduced-motion`. Replace animations with instant state changes. |
| Chart accessibility | Hidden data table with OHLCV data. Keyboard navigation between candles. Audio readout of current candle values on Enter. |
| Text scaling | UI functional at up to 200% browser zoom without horizontal scrolling. |

### Mobile Parity

**Must match web:**
- Chart viewing with full indicator support
- Watchlist management
- Alert creation and management
- Portfolio/position monitoring
- Paper trading order entry
- Idea browsing and publishing
- Push notifications for alerts and order fills

**Can differ from web:**
- Multi-chart layouts: single chart on mobile (no grid), web has full docking
- Drawing tools: simplified set on mobile (trendline, horizontal, Fib retracement only; complex drawings via desktop)
- Strategy IDE: not available on mobile (desktop/tablet only)
- Backtesting: not available on mobile
- Options strategy builder: simplified P&L view only, full builder on desktop
- Discussion rooms: read-only chat on mobile, full participation on desktop
- Admin/settings: basic profile and notification settings on mobile, full settings on desktop

---

*This document synthesizes findings from 10 research reports covering market mechanics, technical analysis, competitive landscape, data infrastructure, social trading, retail workflows, advanced instruments, institutional requirements, algorithmic trading, and frontend UX design patterns. It is intended as an executable specification for the engineering team.*

*Cross-references: [01-market-mechanics], [02-technical-analysis-charting], [03-competitive-analysis], [04-market-data-infrastructure], [05-social-trading-community], [06-retail-trading-workflows], [07-advanced-instruments-trading], [08-institutional-requirements], [09-algorithmic-quantitative-trading], [10-frontend-ux-design-patterns]*
