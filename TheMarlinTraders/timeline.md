# TheMarlinTraders — Development Timeline

## Project Overview
All-in-one trading platform: charting, strategy development, execution, journaling, and community.
Competing between TradingView ($60/mo) and Bloomberg ($32K/year).

---

## 2026-02-13 — Session 1: Research & Planning

### Research Phase (13-agent research team)
- **01-market-mechanics.md** — Market microstructure, order types, settlement, trading sessions
- **02-technical-analysis-charting.md** — 200+ indicators, chart types, drawing tools taxonomy
- **03-competitive-analysis.md** — TradingView, Thinkorswim, TradeStation, Bloomberg feature matrix
- **04-market-data-infrastructure.md** — Polygon.io, WebSocket architecture, TimescaleDB for OHLCV
- **05-social-trading-community.md** — Ideas, copy trading, gamification, moderation patterns
- **06-retail-trading-workflows.md** — Personas (Day Trader Dan, Swing Sarah, Options Oliver, Passive Pat)
- **07-advanced-instruments-trading.md** — Options (Greeks, chains, strategies), crypto, forex, futures
- **08-institutional-requirements.md** — VaR, compliance, FIX protocol, team workspaces
- **09-algorithmic-quantitative-trading.md** — Strategy IDE, backtesting, walk-forward, Monte Carlo
- **10-frontend-ux-design-patterns.md** — Three-thread architecture, Dockview, Web Workers

### Documentation Produced
- `docs/requirements/product-requirements.md` — 6 user personas, 4 pricing tiers, 6-phase feature set
- `docs/architecture/technical-architecture.md` — Full system design, data pipeline, deployment
- `docs/stack-evaluation/stack-recommendation.md` — Technology choices with rationale
- `docs/plans/implementation-plan.md` — 6-phase build plan
- `docs/plans/2026-02-13-full-project-sprint-plan.md` — 80-sprint detailed plan across 6 phases

---

## 2026-02-13 — Session 2: Phase 1 Build (Sprints 1-12)

### Sprint 1: Monorepo Scaffold & CI/CD
- Turborepo 2.x + pnpm 9.x workspace configuration
- Root `package.json`, `turbo.json`, `pnpm-workspace.yaml`
- `packages/config/` — shared ESLint (flat config), TypeScript, Tailwind presets
- `packages/shared/` — types, constants, utils, formatters
- `packages/ui/` — shadcn/ui primitives (Button, Card, Dialog, Dropdown, Input, Select, Tabs, Tooltip)
- `packages/data/` — tRPC client, Zustand stores, Web Worker data processor
- `packages/charts/` — TradingView Lightweight Charts wrapper
- `apps/web/` — Next.js 15 App Router skeleton with Clerk middleware
- `apps/api/` — Bun server with tRPC fetch adapter
- `apps/mobile/` — Expo SDK 52 skeleton
- `.github/workflows/ci.yml` — TypeScript check, ESLint, Vitest, build across all packages
- Vitest config, initial test structure

### Sprint 2: Database, Auth & Design System
- PostgreSQL 16 + Drizzle ORM schema: `users`, `symbols` tables
- Redis connection module (`apps/api/src/lib/redis.ts`)
- Clerk 5.x auth: middleware, `protectedProcedure`, `ctx.userId`
- Tier guard middleware (free/pro/premium)
- Design system: CSS custom properties (`--navy-black`, `--trading-green`, `--trading-red`, `--accent`)
- 7 core UI components: Button, Card, Dialog, DropdownMenu, Input, Select, Tooltip
- Typography: Inter + JetBrains Mono, font variable setup
- Seed script (`tools/scripts/seed-symbols.ts`)
- Tests: schema, auth middleware, tier guard

### Sprint 3: Charting Engine v1
- `packages/charts/src/lightweight/chart.tsx` — React wrapper for TradingView Lightweight Charts
- 6 series types: Candlestick, OHLC Bar, Line, Area, Baseline, Heikin-Ashi
- Chart configuration, price scale, crosshair
- Real-time data adapter
- Interaction handlers (click, hover, crosshair)
- Chart skeleton + error boundary components
- Chart page: `apps/web/app/(app)/chart/[symbol]/page.tsx`
- Tests: config, series rendering

### Sprint 4: Real-Time WebSocket Data Pipeline
- `services/market-data/` — Polygon.io WebSocket adapter + normalization
- Bar aggregation engine (tick-to-bar conversion)
- Redis publisher for fan-out
- `apps/api/src/ws/` — WebSocket gateway with auth, heartbeat, connection registry, subscriptions
- Client Web Workers: `ws-worker.ts` (WebSocket connection), `data-worker.ts` (parsing/compute)
- `packages/data/src/workers/data-processor.ts`
- Real-time chart integration, `price-cell.tsx` (flashing green/red on tick)
- Tests: normalization, bar-builder, WS gateway
- `apps/api/fly.toml` — Fly.io deployment config (shared-cpu-1x, 512MB, auto-scale 1-3)

### Sprint 5: Technical Indicators (25 Core)
- Indicator computation framework: types, `compute()`, registry
- 7 Trend/MA: SMA, EMA, WMA, DEMA, TEMA, VWMA, Hull MA
- 3 Trend Advanced: MACD (histogram + signal), Parabolic SAR, Supertrend
- 5 Momentum: RSI, Stochastic (%K/%D), CCI, Williams %R, MFI
- 3 Volume: OBV, VWAP, A/D Line
- 4 Volatility: Bollinger Bands, ATR, Keltner Channels, Donchian Channels
- 3 Complex: Ichimoku Cloud (5 lines), ADX (+DI/-DI), Aroon Up/Down
- Indicator overlay renderer (on-chart indicators)
- Indicator subchart renderer (below-chart panels)
- Indicator picker + settings UI components
- Unit tests for all 25 indicators

### Sprint 6: Indicators 26-50 + Drawing Tools Core
- 10 Additional indicators: ROC, Ultimate Oscillator, Awesome Oscillator, TRIX, CMF, Klinger, Choppiness, StdDev, HV, Volume Profile
- 15 Extended indicators: Aroon Osc, BOP, DPO, EOM, Elder Ray, Force Index, KST, Mass Index, PPO, RVOL, TSI, WAD, ZigZag, VWAP Bands, %B
- Drawing tools framework: `framework.ts`, `interactions.ts`, `snap.ts`, `undo-redo.ts`, `tool-manager.ts`
- Lines: Trendline, Horizontal, Vertical, Extended Line, Ray
- Shapes: Rectangle, Circle, Triangle
- Fibonacci: Retracement, Extension
- Channels: Parallel Channel, Regression Channel
- Annotations: Text Label, Price Label, Callout
- Drawing persistence: DB schema + tRPC router
- Drawing toolbar UI component
- Tests for drawing framework + indicators

### Sprint 7: Watchlists & Symbol Search
- `apps/api/src/db/schema/watchlists.ts` — watchlists, watchlist_items tables
- `apps/api/src/routers/watchlists.ts` — CRUD + reorder + real-time data
- Meilisearch integration for fuzzy symbol search
- Command palette (`Cmd+K`) for instant symbol search
- Virtual watchlist (react-virtual for 1000+ symbols)
- Watchlist panel with real-time prices, sparklines
- Watchlist tabs, sorting, drag-to-reorder
- Symbol linking store (color-coded groups: red, green, blue, yellow)
- Tests: watchlist operations, search

### Sprint 8: Multi-Chart Layouts (Dockview)
- Dockview 4.13+ integration in main app layout
- Panel types: Chart, Watchlist, OrderEntry, NewsFeed, Screener, Options, HeatMap
- Layout presets: Single Chart, 2x1, 2x2, 3x2
- Layout persistence: serialize/deserialize Dockview state to server
- Layout manager UI (create/rename/delete named layouts)
- Workspace hotkeys (Cmd+1 through Cmd+9)
- Panel context menu: close, maximize, float, split
- Responsive workspace (tabs on mobile/tablet)
- Tests: layout save/load, preset switching

### Sprint 9: Alert System
- `apps/api/src/db/schema/alerts.ts` — alerts, alert_triggers tables
- `apps/api/src/routers/alerts.ts` — CRUD + pause/resume + trigger history
- Alert evaluator service (BullMQ worker on Redis market data)
- Price conditions: above, below, crossing
- Volume conditions: exceeds threshold, RVOL
- Indicator conditions: RSI overbought/oversold, MACD crossover
- Notification channels: in-app (WebSocket), email (Resend), push (Expo), webhook
- Alert creator UI (right-click chart → set alert)
- Alert manager panel (list/filter/bulk edit)
- Alert line overlay on chart (horizontal line + bell icon)
- Tests: alert evaluation, condition matching

### Sprint 10: Stock Screener
- `apps/api/src/db/schema/screeners.ts` — saved screener definitions
- `apps/api/src/routers/screener.ts` — scan, save, list endpoints
- Screener engine: filter criteria → PostgreSQL/TimescaleDB queries
- Fundamental filters (20+): market cap, P/E, EPS, revenue, dividend yield
- Technical filters (30+): price vs MA, RSI range, MACD signal, volume surge
- Price action filters (20+): 52-week high/low, % change, new highs/lows
- Pre-built scan templates: Gap Scanner, Momentum, Breakout, Oversold Bounce, Volume Spike
- Filter builder UI (add/remove conditions, AND/OR logic)
- Screener results table (virtual scrolling, sortable columns)
- Screener Dockview panel integration

### Sprint 11: Paper Trading + Account/Billing
- `apps/api/src/db/schema/paper-trading.ts` — portfolios, orders, positions, fills
- `apps/api/src/routers/paper-trading.ts` — submitOrder, getPositions, getOrders, getPortfolio
- Simulated execution engine: market orders at bid/ask, limit order queue
- Position tracker: real-time P&L, average cost, quantity
- Billing service: Stripe integration stub (free/pro/premium tiers)
- Order entry component (market, limit, stop, stop-limit)
- Order history panel, portfolio summary, positions panel
- Tests: order execution, position tracking

### Sprint 12: iOS Mobile App + Shortcuts + MVP Polish
- **Mobile components:**
  - Skia candlestick chart (`react-native-skia`)
  - Chart header with symbol, price, change%
  - Watchlist screen (FlatList + search)
  - Alert management screen (create/edit/delete)
  - Paper trading: order sheet + portfolio view
  - 5-tab navigation: Watchlist, Chart, Portfolio, Alerts, More
  - Chart screen with indicator picker
  - Push notifications (expo-notifications)
  - API client module
- **Web polish:**
  - Keyboard shortcut system: `hotkey-manager.tsx`, `use-hotkeys.ts` hook
  - Default keybindings constant set
  - Keyboard shortcut settings page
  - Performance audit: `next.config.ts` optimizations, Lighthouse config
  - Code splitting: lazy-loaded charts + drawings
  - Playwright E2E tests
  - Staging deployment configs (Vercel, Railway, Docker Compose)
  - App Store metadata + EAS config

---

## 2026-02-14 — Session 3: Phase 2 Build (Sprints 13-22)

### Sprint 13: Trade Journal — Auto-Log & Snapshots
- `apps/api/src/db/schema/journal.ts` — journalEntries (with setup type, emotion, market condition, grade, side enums), journalTags
- `apps/api/src/services/journal-auto-log.ts` — Auto-log service creates journal entries from paper trade fills
- `apps/api/src/routers/journal.ts` — 8 procedures: create, getById, list, update, delete, getTags, addTag, removeTag
- `packages/ui/src/trading/journal-entry-card.tsx` — Card with P&L, grade badge, tags, emotion
- `packages/ui/src/trading/trade-grade-badge.tsx` — Color-coded A+ through F grade badges
- `packages/ui/src/trading/calendar-heatmap.tsx` — GitHub-style heatmap for daily P&L
- `apps/web/app/(app)/journal/page.tsx` — List view with filters
- `apps/web/app/(app)/journal/[id]/page.tsx` — Detail view

### Sprint 14: Performance Dashboard
- `apps/api/src/services/performance-analytics.ts` — Pure functions: calculateMetrics, timeOfDayAnalysis, setupTypeBreakdown, rollingSharpe, holdingTimeAnalysis, equityCurve
- `apps/api/src/routers/performance.ts` — 6 protectedProcedure endpoints with DateRangeSchema
- `packages/ui/src/trading/performance-metrics.tsx` — 7 stat cards grid (Win Rate, Sharpe, Profit Factor, etc.)
- `packages/ui/src/trading/time-of-day-chart.tsx` — Canvas bar chart by entry hour
- `packages/ui/src/trading/setup-breakdown.tsx` — Sortable table with progress bars
- `packages/ui/src/trading/holding-time-chart.tsx` — Canvas scatter plot (duration vs P&L)
- `packages/ui/src/trading/equity-curve.tsx` — Canvas line chart (green/red cumulative P&L)
- `packages/ui/src/trading/equity-drawdown-chart.tsx` — Two-panel canvas chart (65/35 split)
- `packages/ui/src/trading/export-button.tsx` — CSV/PDF export
- `apps/web/app/(app)/performance/page.tsx` — Dashboard composing all components

### Sprint 15: Social — Idea Publishing
- `apps/api/src/db/schema/social.ts` — ideas, ideaComments, ideaVotes tables with sentiment enum
- `apps/api/src/routers/ideas.ts` — 9 procedures: create, publish, list, getById, vote, comment, listComments, delete, listByUser
- `packages/ui/src/trading/idea-editor.tsx` — Markdown editor with sentiment/tags
- `packages/ui/src/trading/idea-card.tsx` — Card with vote column, sentiment badge
- `packages/ui/src/trading/idea-feed.tsx` — Infinite scroll with IntersectionObserver
- `packages/ui/src/trading/idea-detail.tsx` — Full idea view
- `packages/ui/src/trading/comment-thread.tsx` — Threaded comments with buildTree()
- `apps/web/app/(app)/ideas/page.tsx` — Feed page
- `apps/web/app/(app)/ideas/[id]/page.tsx` — Detail page (server component)
- `apps/web/app/(app)/ideas/[id]/client.tsx` — Detail client component
- `apps/web/app/(app)/ideas/new/page.tsx` — New idea editor

### Sprint 16: Social — Profiles & Leaderboards
- `apps/api/src/db/schema/profiles.ts` — profiles, verificationBadges, follows, privacySettings tables
- `apps/api/src/routers/profiles.ts` — 7 procedures: getProfile, updateProfile, updatePrivacy, follow, unfollow, getFollowers, getFollowing
- `apps/api/src/routers/leaderboards.ts` — getRankings (calculates Sharpe, win rate, profit factor from journal entries, respects privacy settings, paginated)
- `packages/ui/src/trading/profile-header.tsx` — Avatar, badges (identity_verified, broker_connected, performance_audited), follow button, bio, links
- `packages/ui/src/trading/profile-stats.tsx` — 6 stat cards (Win Rate, Sharpe, Max DD, Profit Factor, Total Trades, Best Month)
- `packages/ui/src/trading/leaderboard-table.tsx` — Sortable rankings with timeframe/asset class/style filters
- `packages/ui/src/trading/follow-list.tsx` — Followers/following list
- `apps/web/app/(app)/profile/[userId]/page.tsx` — Profile page
- `apps/web/app/(app)/leaderboards/page.tsx` — Leaderboard page
- `apps/web/app/(app)/settings/privacy/page.tsx` — Privacy toggle settings
- Updated settings layout with Privacy nav link

### Sprint 18: Options Chain v1
- `apps/api/src/adapters/options-data.ts` — Options data feed adapter interface + mock
- `packages/shared/src/options/types.ts` — OptionType, GreeksResult, OptionQuote, OptionChainData
- `packages/shared/src/options/greeks.ts` — Black-Scholes: delta, gamma, theta, vega, rho + implied volatility (Newton-Raphson)
- `apps/api/src/routers/options.ts` — 4 procedures: getChain, getExpirations, getStrikes, getQuote
- `packages/ui/src/trading/options-chain.tsx` — Dual-pane layout (calls left, puts right), ITM highlighting
- `packages/ui/src/trading/expiration-tabs.tsx` — Date navigation tabs
- `packages/ui/src/trading/options-header.tsx` — IV Rank + IV Percentile display
- `apps/web/app/(app)/options/[symbol]/page.tsx` — Options chain page
- `apps/web/app/(app)/options/strategy/page.tsx` — Strategy builder page
- Options Dockview panel integration

### Sprint 19: Options Strategy Builder
- `packages/shared/src/options/strategy-types.ts` — StrategyLeg, Strategy, StrategyTemplate, PnLPoint, 6 categories
- `packages/shared/src/options/pnl-calculator.ts` — 10 functions: Black-Scholes P&L, breakevens, probability of profit (log-normal CDF), max profit/loss
- `packages/shared/src/options/strategy-templates.ts` — 22 strategy templates (Long Call, Put Spread, Iron Condor, Butterfly, etc.) + buildStrategyFromTemplate()
- `packages/ui/src/trading/strategy-builder.tsx` — Multi-leg builder with template selector dropdown
- `packages/ui/src/trading/pnl-diagram.tsx` — Interactive canvas P&L chart at expiration
- `packages/ui/src/trading/strategy-leg-editor.tsx` — Drag-to-reorder leg editor with buy/sell, call/put, strike, quantity

### Sprint 20: Embeddable Widgets & SEO
- `packages/ui/src/widgets/chart-embed.tsx` — Embeddable canvas chart component (dark/light theme, indicator overlays)
- `packages/ui/src/widgets/embed-code-generator.tsx` — iframe + JavaScript snippet generator with live preview
- `packages/ui/src/widgets/ticker-tape.tsx` — Scrolling horizontal price ticker (marquee animation)
- `packages/ui/src/seo/json-ld.tsx` — OrganizationJsonLd, WebSiteJsonLd, IdeaJsonLd components
- `apps/web/app/embed/chart/page.tsx` + `client.tsx` — Chart embed page (outside app layout, no chrome)
- `apps/web/app/embed/ticker-tape/page.tsx` + `client.tsx` — Ticker tape embed page
- `apps/web/app/api/og/route.tsx` — Dynamic Open Graph image generation (ImageResponse)
- `apps/web/app/sitemap.ts` — Dynamic sitemap for ideas pages
- `apps/web/app/robots.ts` — Robots.txt (allow all except /settings, /api, /embed)
- Updated `apps/web/app/layout.tsx` — Full OpenGraph metadata, Twitter card, JSON-LD injection
- Updated `apps/web/app/(app)/ideas/[id]/page.tsx` — ISR (revalidate=3600), OG metadata per idea
- Updated `apps/web/next.config.ts` — iframe CORS headers for /embed/*, OG image caching
- Updated `packages/ui/package.json` — Added `widgets/*` and `seo/*` export paths

### Sprint 21: Android App
- Expo EAS Build configuration for Android (`eas.json` android profile)
- `apps/mobile/components/android-nav.tsx` — Material Design bottom navigation patterns
- `apps/mobile/services/push-android.ts` — FCM push notifications
- `apps/mobile/constants/android-styles.ts` — Android-specific spacing/elevation
- `apps/mobile/play-store/metadata.json` — Google Play Store listing metadata
- `apps/mobile/utils/platform.ts` — Platform detection utilities
- `apps/mobile/tests/android-smoke.ts` — Android E2E test configuration

### Sprint 22: Heat Maps + Advanced Drawing Tools
- `packages/ui/src/trading/heat-map.tsx` — S&P 500 treemap heat map (sized by market cap, colored by performance)
- `packages/ui/src/trading/sector-drill-down.tsx` — Click sector → constituent stocks
- `packages/ui/src/trading/heat-map-controls.tsx` — Metric/timeframe selector
- `apps/api/src/services/heatmap-data.ts` — 53 mock stocks with sector/market cap data
- `apps/api/src/routers/heatmap.ts` — getHeatmap, getSectorDetail endpoints
- Advanced drawings:
  - `packages/charts/src/drawings/fibonacci/fan.ts` — Fibonacci Fan
  - `packages/charts/src/drawings/fibonacci/arcs.ts` — Fibonacci Arcs
  - `packages/charts/src/drawings/fibonacci/time-zones.ts` — Fibonacci Time Zones
  - `packages/charts/src/drawings/gann/gann-fan.ts` — Gann Fan
  - `packages/charts/src/drawings/gann/gann-box.ts` — Gann Box
  - `packages/charts/src/drawings/patterns/elliott-wave.ts` — Elliott Wave labels
  - `packages/charts/src/drawings/patterns/xabcd-harmonic.ts` — XABCD Harmonic patterns
  - `packages/charts/src/drawings/measurement/risk-reward.ts` — Risk:Reward tool
  - `packages/charts/src/drawings/measurement/price-range.ts` — Price Range measurement
  - `packages/charts/src/drawings/measurement/bar-count.ts` — Bar Count measurement
- Heat Map page + Dockview panel

### Sprint 17: Discussion Rooms & News Feed
- `apps/api/src/db/schema/chat.ts` — chatRooms, chatMessages, chatReactions tables (type enum: ticker/strategy/general)
- `apps/api/src/db/schema/news.ts` — newsArticles, economicEvents, earningsEvents tables
- `apps/api/src/routers/chat.ts` — listRooms, getRoom, getMessages, sendMessage (with reputation gate), deleteMessage, addReaction, removeReaction (7 procedures)
- `apps/api/src/routers/news.ts` — getArticles (symbol filter + cursor pagination), getEconomicCalendar (date range), getEarningsCalendar
- `packages/ui/src/trading/chat-room.tsx` — Message list, threading, $SYMBOL auto-linking, reaction picker (8 trading emojis), soft-delete
- `packages/ui/src/trading/chat-room-list.tsx` — Room cards with type badges (green=ticker, blue=strategy, gray=general), activity preview
- `packages/ui/src/trading/news-feed.tsx` — Article cards with symbol pills, image thumbnails, IntersectionObserver infinite scroll
- `packages/ui/src/trading/economic-calendar.tsx` — Impact dots (red/yellow/green), countdown timers, actual vs forecast vs previous
- `packages/ui/src/trading/earnings-calendar.tsx` — EPS/revenue beat/miss coloring, BMO/AMC badges, human-readable revenue ($B/$M)
- `apps/web/app/(app)/chat/page.tsx` — Chat room list with 6 mock rooms
- `apps/web/app/(app)/chat/[roomId]/page.tsx` — Room view with 7 mock messages, threading, reactions
- `apps/web/app/(app)/news/page.tsx` — Tabbed: News Feed, Economic Calendar, Earnings Calendar
- Updated `appRouter` with `chat: chatRouter` and `news: newsRouter` (now 19 domain routers)
- Updated schema barrel with chat and news exports (now 15 schema files)

---

## Architecture Summary (at Phase 2 completion)

### API Router Tree (19 domain routers)
```
appRouter
├── health (public)
├── ping (public)
├── market
├── watchlist
├── search
├── alerts
├── paperTrading
├── layout
├── screener
├── drawings
├── options
├── journal
├── heatmap
├── performance
├── ideas
├── profiles
├── leaderboards
├── chat
└── news
```

### Database Schema (15 schema files, 35+ tables)
```
users, symbols, watchlists, watchlist_items,
ohlcv_bars, alerts, alert_triggers,
paper_portfolios, paper_orders, paper_positions, paper_fills,
layouts, saved_screeners, drawings,
journal_entries, journal_tags,
ideas, idea_comments, idea_votes,
profiles, verification_badges, follows, privacy_settings,
chat_rooms, chat_messages, chat_reactions,
news_articles, economic_events, earnings_events
```

### Indicators (50 total)
- 7 Trend MAs + MACD + SAR + Supertrend
- 5 Momentum + 3 Volume + 4 Volatility + 3 Complex
- 10 Additional + 15 Extended

### Drawing Tools (20+ types)
Lines (5), Shapes (3), Fibonacci (5), Channels (2), Annotations (3), Gann (2), Patterns (2), Measurement (3)

### UI Components (40+ trading components)
Charts, watchlists, alerts, screener, paper trading, journal, performance, options, ideas, profiles, leaderboards, heat maps, widgets, SEO

### Pages (25+ routes)
Chart, Watchlist, Screener, Alerts, Paper Trading, Settings (6 sub-pages), Performance, Journal (list + detail), Ideas (feed + detail + new), Options (chain + strategy), Heat Map, Leaderboards, Profile, Embed (chart + ticker tape), Chat (list + room), News (feed + economic calendar + earnings calendar)
