# TheMarlinTraders — Full Project Sprint Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break the entire TheMarlinTraders platform into 2-week sprints across all 6 phases (42 months), with actionable tasks, deliverables, and acceptance criteria per sprint.

**Architecture:** Turborepo monorepo with Next.js 15 (web), React Native + Expo (mobile), tRPC + Bun (API), PostgreSQL + TimescaleDB + Redis (data), deployed on Vercel / Railway / Fly.io.

**Tech Stack:** TypeScript 5.7+, pnpm 9.x, Turborepo 2.x, Next.js 15, React Native, Expo SDK 52+, Zustand, tRPC 11, Bun, Drizzle ORM, PostgreSQL 16, TimescaleDB, Redis 7, Meilisearch, shadcn/ui, Tailwind CSS 4, Dockview, TradingView Lightweight Charts 5.1, React Native Skia, Vitest, Playwright

---

## Phase 1: Core Charting Platform (MVP) — Months 0-6

**Objective:** Ship a production-quality charting platform with real-time US equity data, 50+ indicators, drawing tools, watchlists, alerts, screener, paper trading, and iOS app.

**Team:** 2 full-stack, 2 frontend, 1 mobile, 1 DevOps, 1 designer (7 total)

---

### Sprint 1 (Weeks 1-2): Monorepo Scaffold & CI/CD

**Goal:** Establish the monorepo structure, all packages, CI/CD pipeline, and development environment so every engineer can clone and run.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 1.1 | Initialize Turborepo monorepo with pnpm workspace | DevOps | `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `tsconfig.json` |
| 1.2 | Create `apps/web` — Next.js 15 App Router skeleton | Frontend 1 | `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/next.config.ts`, `apps/web/package.json` |
| 1.3 | Create `apps/api` — Bun server with tRPC skeleton | Full-stack 1 | `apps/api/src/index.ts`, `apps/api/src/routers/index.ts`, `apps/api/package.json` |
| 1.4 | Create `apps/mobile` — Expo SDK 52 skeleton | Mobile | `apps/mobile/app/`, `apps/mobile/package.json`, `apps/mobile/app.json` |
| 1.5 | Create `packages/shared` — types, constants, utils | Full-stack 2 | `packages/shared/src/types/`, `packages/shared/src/utils/`, `packages/shared/package.json` |
| 1.6 | Create `packages/config` — shared ESLint flat config, TypeScript bases, Tailwind preset | DevOps | `packages/config/eslint/`, `packages/config/typescript/`, `packages/config/tailwind/` |
| 1.7 | Create `packages/ui` — shadcn/ui init with Tailwind v4 + Radix UI primitives | Frontend 2 | `packages/ui/src/primitives/button.tsx`, `packages/ui/package.json`, `packages/ui/tailwind.config.ts` |
| 1.8 | Create `packages/data` — tRPC client config, Zustand store skeletons | Full-stack 2 | `packages/data/src/api/`, `packages/data/src/stores/`, `packages/data/package.json` |
| 1.9 | Create `packages/charts` — empty chart engine package | Frontend 1 | `packages/charts/package.json`, `packages/charts/src/index.ts` |
| 1.10 | GitHub Actions CI — lint, typecheck, test, build matrix for web/api/mobile | DevOps | `.github/workflows/ci.yml` |
| 1.11 | Prettier config, .gitignore, .nvmrc, README updates | DevOps | `.prettierrc`, `.gitignore`, `.nvmrc` |
| 1.12 | Write Vitest config for all packages | DevOps | `vitest.config.ts` (root), `packages/shared/vitest.config.ts` |

**Acceptance Criteria:**
- `pnpm install` succeeds from clean clone
- `pnpm dev` starts web (localhost:3000), api (localhost:4000), mobile (Expo)
- `pnpm build` compiles all packages and apps with zero errors
- `pnpm lint` and `pnpm typecheck` pass
- CI pipeline runs on push to any branch
- All packages resolve internal dependencies via `workspace:*`

**Commit checkpoint:** `feat: initialize turborepo monorepo with all packages and CI`

---

### Sprint 2 (Weeks 3-4): Database, Auth & Design System

**Goal:** Set up PostgreSQL + TimescaleDB + Redis, integrate Clerk auth, and build the design system foundation (dark mode, theme tokens, core components).

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 2.1 | Set up PostgreSQL 16 on Railway + TimescaleDB extension | DevOps | `apps/api/src/db/connection.ts`, Railway config |
| 2.2 | Create Drizzle ORM schema — users, symbols, watchlists, watchlist_items | Full-stack 1 | `apps/api/src/db/schema/users.ts`, `schema/symbols.ts`, `schema/watchlists.ts` |
| 2.3 | Create Drizzle migration system + seed script for symbols (10,000+ US equities) | Full-stack 1 | `apps/api/src/db/migrations/`, `tools/scripts/seed-symbols.ts` |
| 2.4 | Set up Redis 7 on Railway — connection, basic pub/sub test | Full-stack 2 | `apps/api/src/lib/redis.ts` |
| 2.5 | Integrate Clerk auth — sign-in, sign-up, user profile pages | Full-stack 2 | `apps/web/app/(auth)/sign-in/`, `apps/web/app/(auth)/sign-up/`, `apps/web/middleware.ts` |
| 2.6 | tRPC auth middleware — validate Clerk JWT, inject user context | Full-stack 1 | `apps/api/src/middleware/auth.ts`, `apps/api/src/context.ts` |
| 2.7 | Design system: CSS custom property theme tokens (dark/light/colorblind) | Designer + Frontend 1 | `packages/config/tailwind/theme.ts`, `packages/ui/src/styles/tokens.css` |
| 2.8 | Design system: dark mode as default (navy-black #0a0a0f base) | Designer | `packages/ui/src/styles/dark.css` |
| 2.9 | Core UI components: Button, Input, Select, Dialog, DropdownMenu, Tooltip, Tabs, Card | Frontend 2 | `packages/ui/src/primitives/*.tsx` (8 components) |
| 2.10 | Typography setup: Inter (UI text) + JetBrains Mono (numerical data) | Designer | `apps/web/app/fonts.ts`, `packages/config/tailwind/fonts.ts` |
| 2.11 | Sonner toast integration for notifications | Frontend 2 | `packages/ui/src/primitives/toaster.tsx` |
| 2.12 | Write tests for Drizzle schema + auth middleware | Full-stack 1 | `apps/api/tests/db/`, `apps/api/tests/middleware/` |

**Acceptance Criteria:**
- `pnpm db:migrate` creates all tables in PostgreSQL
- `pnpm db:seed` loads 10,000+ US equity symbols
- Clerk sign-in/sign-up flow works end-to-end
- tRPC procedures reject unauthenticated requests with 401
- Dark mode renders correctly; theme toggle switches light/dark/colorblind
- All 8 core UI components render and pass accessibility checks

**Commit checkpoint:** `feat: database schema, clerk auth, and design system foundation`

---

### Sprint 3 (Weeks 5-6): Charting Engine v1

**Goal:** Integrate TradingView Lightweight Charts v5.1 with historical OHLCV data from Polygon.io REST API. Single candlestick chart with 6 chart types, zoom, pan, crosshair.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 3.1 | Integrate TradingView Lightweight Charts v5.1 in `packages/charts` | Frontend 1 | `packages/charts/src/lightweight/chart.tsx`, `packages/charts/src/lightweight/config.ts` |
| 3.2 | Implement 6 chart types: Candlestick, OHLC Bar, Line, Area, Baseline, Heikin-Ashi | Frontend 1 | `packages/charts/src/lightweight/series/*.ts` |
| 3.3 | Create Polygon.io REST adapter for historical OHLCV bars | Full-stack 1 | `apps/api/src/adapters/polygon-rest.ts`, `packages/shared/src/types/market-data.ts` |
| 3.4 | tRPC router: `market.getBars(symbol, timeframe, from, to)` | Full-stack 1 | `apps/api/src/routers/market.ts` |
| 3.5 | TimescaleDB hypertable for OHLCV storage + continuous aggregates (1m→5m→15m→1h→1D) | Full-stack 2 | `apps/api/src/db/schema/ohlcv.ts`, migration file |
| 3.6 | Data caching layer: check TimescaleDB first, fallback to Polygon API, cache result | Full-stack 2 | `apps/api/src/services/market-data.ts` |
| 3.7 | Chart page component with timeframe selector (1m, 5m, 15m, 1h, 4h, 1D, 1W, 1M) | Frontend 2 | `apps/web/app/(app)/chart/[symbol]/page.tsx`, `packages/charts/src/components/timeframe-selector.tsx` |
| 3.8 | Crosshair with OHLCV tooltip display | Frontend 1 | `packages/charts/src/lightweight/crosshair.ts` |
| 3.9 | Zoom (mouse wheel + pinch) and pan (click-drag) interactions | Frontend 1 | `packages/charts/src/lightweight/interactions.ts` |
| 3.10 | Price scale: auto-scale, log scale toggle, percentage mode | Frontend 1 | `packages/charts/src/lightweight/price-scale.ts` |
| 3.11 | Volume histogram below chart (sub-chart series) | Frontend 2 | `packages/charts/src/lightweight/volume.ts` |
| 3.12 | Chart loading skeleton + error states | Frontend 2 | `packages/charts/src/components/chart-skeleton.tsx` |
| 3.13 | Tests: chart rendering, data fetching, timeframe switching | Frontend 1 | `packages/charts/tests/` |

**Acceptance Criteria:**
- Navigate to `/chart/AAPL` and see candlestick chart with 1 year daily data
- Switch between all 6 chart types smoothly
- Timeframe selector loads correct bar data
- Mouse wheel zooms, click-drag pans, crosshair shows OHLCV values
- Volume bars render below price chart
- Chart renders at 60fps during zoom/pan (measure with DevTools)
- Data loads in <500ms for 1 year daily bars

**Commit checkpoint:** `feat: charting engine with 6 chart types, historical data, and interactions`

---

### Sprint 4 (Weeks 7-8): Real-Time WebSocket Data Pipeline

**Goal:** Establish the full real-time data pipeline: Polygon.io WebSocket → server normalization → Redis pub/sub → WebSocket gateway → client Web Workers → chart update.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 4.1 | Create `services/market-data` service — Polygon.io WebSocket adapter | Full-stack 1 | `services/market-data/src/providers/polygon-ws.ts` |
| 4.2 | Normalization layer: transform Polygon messages to canonical `NormalizedTrade` / `NormalizedBar` | Full-stack 1 | `services/market-data/src/normalization/normalize.ts`, `packages/shared/src/types/market-data.ts` |
| 4.3 | Bar aggregation engine: tick → 1-minute bar builder with period boundary emission | Full-stack 2 | `services/market-data/src/aggregation/bar-builder.ts` |
| 4.4 | Redis pub/sub publisher: completed bars + live quotes to Redis channels | Full-stack 2 | `services/market-data/src/publisher/redis-publisher.ts` |
| 4.5 | WebSocket gateway on Fly.io: `ws` server, connection registry, subscription model | Full-stack 1 | `apps/api/src/ws/gateway.ts`, `apps/api/src/ws/connection-registry.ts`, `apps/api/src/ws/subscriptions.ts` |
| 4.6 | WebSocket auth: validate Clerk JWT on upgrade, reject unauthorized | Full-stack 1 | `apps/api/src/ws/auth.ts` |
| 4.7 | Heartbeat (25s ping/pong) + dead connection timeout (35s) | Full-stack 2 | `apps/api/src/ws/heartbeat.ts` |
| 4.8 | Client WS Worker: manages connection, heartbeat, reconnection with exp backoff + jitter | Frontend 1 | `apps/web/workers/ws-worker.ts` |
| 4.9 | Client Data Worker (Comlink): receive messages, update in-memory typed arrays, format for chart | Frontend 1 | `apps/web/workers/data-worker.ts`, `packages/data/src/workers/data-processor.ts` |
| 4.10 | Connect real-time data to Lightweight Charts: streaming bar updates, live candle formation | Frontend 2 | `packages/charts/src/lightweight/real-time.ts` |
| 4.11 | Price flash animation on quote update (green uptick, red downtick, CSS-only) | Frontend 2 | `packages/ui/src/trading/price-cell.tsx`, CSS animations |
| 4.12 | Deploy market-data service and WS gateway to Railway/Fly.io | DevOps | Dockerfile, fly.toml, Railway config |
| 4.13 | Tests: bar aggregation, normalization, WS reconnection, price updates | Full-stack 1+2 | `services/market-data/tests/`, `apps/api/tests/ws/` |

**Acceptance Criteria:**
- Open `/chart/AAPL` during market hours → live candle forms and updates in real-time
- Quote-to-screen latency <100ms (measured end-to-end)
- WS disconnection auto-reconnects within <500ms (first attempt)
- Price cells flash green/red on uptick/downtick
- No computation runs on main thread (verify via Performance tab)
- Bar aggregation correctly builds 1-min bars from ticks

**Commit checkpoint:** `feat: real-time data pipeline from Polygon.io to chart rendering`

---

### Sprint 5 (Weeks 9-10): Technical Indicators (25 Core)

**Goal:** Implement the first 25 technical indicators computed in Web Workers, rendered as overlays/sub-charts.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 5.1 | Indicator computation framework in `packages/shared/src/indicators/` | Frontend 1 | `packages/shared/src/indicators/types.ts`, `packages/shared/src/indicators/compute.ts` |
| 5.2 | Trend indicators: SMA, EMA, WMA, DEMA, TEMA, VWMA, Hull MA (7) | Frontend 1 | `packages/shared/src/indicators/trend/*.ts` |
| 5.3 | Trend indicators: MACD (histogram + signal + MACD line), Parabolic SAR, Supertrend (3) | Frontend 2 | `packages/shared/src/indicators/trend/macd.ts`, `sar.ts`, `supertrend.ts` |
| 5.4 | Momentum indicators: RSI, Stochastic (K + D), CCI, Williams %R, MFI (5) | Frontend 1 | `packages/shared/src/indicators/momentum/*.ts` |
| 5.5 | Volume indicators: OBV, VWAP (session-anchored), A/D Line (3) | Frontend 2 | `packages/shared/src/indicators/volume/*.ts` |
| 5.6 | Volatility indicators: Bollinger Bands (upper/middle/lower), ATR, Keltner Channels, Donchian Channels (4) | Frontend 1 | `packages/shared/src/indicators/volatility/*.ts` |
| 5.7 | Complex indicators: Ichimoku Cloud (5 lines + cloud fill), ADX/DI+/DI-, Aroon Up/Down (3) | Frontend 2 | `packages/shared/src/indicators/complex/*.ts` |
| 5.8 | Indicator overlay renderer: draw computed indicator values on chart canvas | Frontend 1 | `packages/charts/src/lightweight/indicator-overlay.ts` |
| 5.9 | Indicator sub-chart renderer: RSI, MACD, Stochastic rendered below main chart | Frontend 2 | `packages/charts/src/lightweight/indicator-subchart.ts` |
| 5.10 | Indicator picker UI: categorized list (Trend/Momentum/Volume/Volatility), search, add/remove | Frontend 2 | `packages/ui/src/trading/indicator-picker.tsx` |
| 5.11 | Indicator settings dialog: per-indicator parameter editing (periods, colors, styles) | Frontend 2 | `packages/ui/src/trading/indicator-settings.tsx` |
| 5.12 | Web Worker integration: compute indicators in Data Worker via Comlink, send render data to main thread | Frontend 1 | `apps/web/workers/data-worker.ts` (extend) |
| 5.13 | Unit tests for all 25 indicator calculations (known-value verification) | Frontend 1+2 | `packages/shared/tests/indicators/` |

**Acceptance Criteria:**
- Add any of the 25 indicators via picker → renders correctly on chart
- Indicator parameters editable (e.g., SMA period 20 → 50)
- MACD, RSI, Stochastic render as separate sub-charts below price
- Bollinger Bands, Ichimoku Cloud render as overlays on price chart
- Adding 5 indicators simultaneously keeps chart at 60fps
- All 25 indicator calculations pass unit tests against known values

**Commit checkpoint:** `feat: 25 technical indicators with web worker computation`

---

### Sprint 6 (Weeks 11-12): Indicators 26-50 + Drawing Tools Core

**Goal:** Complete the remaining 25+ indicators and implement the core 15 drawing tools with persistence.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 6.1 | Additional indicators: ROC, Ultimate Oscillator, Awesome Oscillator, TRIX, CMF, Klinger, Choppiness Index, StdDev, HV, Volume Profile (fixed range) (10) | Frontend 1 | `packages/shared/src/indicators/` (multiple files) |
| 6.2 | Additional indicators: Aroon Oscillator, Balance of Power, Detrended Price Oscillator, Ease of Movement, Elder-Ray, Force Index, Know Sure Thing, Mass Index, PPO, RVOL, TSI, Williams Accumulation/Distribution, Zigzag, VWAP Bands, Percent B (15+) | Frontend 2 | `packages/shared/src/indicators/` (multiple files) |
| 6.3 | Drawing tool framework: tool selection, canvas overlay, mouse/touch event handling | Frontend 1 | `packages/charts/src/drawings/framework.ts`, `packages/charts/src/drawings/tool-manager.ts` |
| 6.4 | Line drawings: Trendline, Ray, Extended Line, Horizontal Line, Vertical Line (5) | Frontend 1 | `packages/charts/src/drawings/lines/*.ts` |
| 6.5 | Channel drawings: Parallel Channel, Regression Channel (2) | Frontend 1 | `packages/charts/src/drawings/channels/*.ts` |
| 6.6 | Fibonacci drawings: Retracement, Extension (2) | Frontend 2 | `packages/charts/src/drawings/fibonacci/*.ts` |
| 6.7 | Shape drawings: Rectangle, Circle, Triangle (3) | Frontend 2 | `packages/charts/src/drawings/shapes/*.ts` |
| 6.8 | Annotation drawings: Text Label, Price Label, Callout (3) | Frontend 2 | `packages/charts/src/drawings/annotations/*.ts` |
| 6.9 | Drawing interactions: select, move, resize (drag handles), delete, undo/redo | Frontend 1 | `packages/charts/src/drawings/interactions.ts`, `packages/charts/src/drawings/undo-redo.ts` |
| 6.10 | Magnetic snap to OHLC values when drawing | Frontend 1 | `packages/charts/src/drawings/snap.ts` |
| 6.11 | Drawing persistence: save/load per symbol+timeframe to server | Full-stack 1 | `apps/api/src/routers/drawings.ts`, `apps/api/src/db/schema/drawings.ts` |
| 6.12 | Drawing toolbar UI: tool selection, color picker, line style, right-click context menu | Frontend 2 | `packages/ui/src/trading/drawing-toolbar.tsx` |
| 6.13 | Tests for new indicators + drawing tool operations | Frontend 1+2 | `packages/shared/tests/indicators/`, `packages/charts/tests/drawings/` |

**Acceptance Criteria:**
- 50+ indicators available in indicator picker
- All 15 drawing tools function: create, select, move, resize, delete
- Drawings snap to OHLC values magnetically
- Undo/redo works for drawing operations (Ctrl+Z / Ctrl+Shift+Z)
- Drawings persist per symbol+timeframe — navigate away and back, drawings remain
- Right-click context menu on drawings offers edit/delete/clone

**Commit checkpoint:** `feat: 50+ indicators and 15 drawing tools with persistence`

---

### Sprint 7 (Weeks 13-14): Watchlists & Symbol Search

**Goal:** Build multiple named watchlists with real-time price updates, Meilisearch-powered symbol search, and the Cmd+K command palette.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 7.1 | Watchlist Zustand store: create/rename/delete lists, add/remove/reorder symbols | Full-stack 2 | `packages/data/src/stores/watchlist-store.ts` |
| 7.2 | tRPC router: watchlist CRUD, watchlist item operations | Full-stack 1 | `apps/api/src/routers/watchlists.ts` |
| 7.3 | Watchlist panel UI: table with columns (symbol, price, %chg, vol, RVOL, mkt cap, float) | Frontend 2 | `packages/ui/src/trading/watchlist-panel.tsx` |
| 7.4 | Virtual scrolling for watchlist rows (500+ symbols) via @tanstack/react-virtual | Frontend 2 | `packages/ui/src/trading/virtual-watchlist.tsx` |
| 7.5 | Real-time price updates in watchlist cells (price flash + rAF batching via refs) | Frontend 1 | `packages/ui/src/trading/price-cell.tsx` (extend) |
| 7.6 | Meilisearch setup: index 10,000+ symbols with name, ticker, sector, market cap | DevOps + Full-stack 2 | `apps/api/src/services/search.ts`, `tools/scripts/index-symbols.ts` |
| 7.7 | Symbol search tRPC endpoint: fuzzy search via Meilisearch | Full-stack 2 | `apps/api/src/routers/search.ts` |
| 7.8 | Command palette (Cmd+K) via cmdk: symbol search, recent symbols, navigation actions | Frontend 1 | `packages/ui/src/trading/command-palette.tsx` |
| 7.9 | Symbol linking: click symbol in watchlist → all linked chart panels update | Frontend 1 | `packages/data/src/stores/linking-store.ts` |
| 7.10 | Watchlist header: tabs for multiple lists, create/rename/delete list, drag to reorder | Frontend 2 | `packages/ui/src/trading/watchlist-tabs.tsx` |
| 7.11 | Column sorting (click header to sort by any column) | Frontend 2 | `packages/ui/src/trading/watchlist-sort.ts` |
| 7.12 | Tests: watchlist CRUD, search, symbol linking, virtual scrolling | Full-stack + Frontend | tests across packages |

**Acceptance Criteria:**
- Create, rename, delete named watchlists
- Add symbols via search or Cmd+K
- Prices update in real-time with green/red flash
- 500-symbol watchlist scrolls smoothly (virtual scrolling)
- Cmd+K opens instantly, fuzzy search finds "AAPL" from "apl", <200ms results
- Click symbol in watchlist → linked chart panels navigate to that symbol
- Column headers sort ascending/descending

**Commit checkpoint:** `feat: watchlists with real-time updates, meilisearch, and command palette`

---

### Sprint 8 (Weeks 15-16): Multi-Chart Layouts (Dockview)

**Goal:** Integrate Dockview for docking/tiling panel layouts. Multiple chart panels, layout saving/loading, workspace presets.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 8.1 | Integrate Dockview React in main app layout | Frontend 1 | `apps/web/app/(app)/layout.tsx`, `apps/web/components/workspace.tsx` |
| 8.2 | Panel types: Chart, Watchlist, OrderEntry (placeholder), NewsFeed (placeholder) | Frontend 1 | `apps/web/components/panels/*.tsx` |
| 8.3 | Layout presets: Single Chart, 2x1, 2x2, 3x2, Custom | Frontend 1 | `apps/web/components/layout-presets.ts` |
| 8.4 | Layout persistence: serialize Dockview JSON → save to server (per user) | Full-stack 2 | `apps/api/src/routers/layouts.ts`, `apps/api/src/db/schema/layouts.ts` |
| 8.5 | Saved layout templates: create/rename/delete named layouts | Frontend 2 | `packages/ui/src/trading/layout-manager.tsx` |
| 8.6 | Workspace presets (Cmd+1 through Cmd+9) | Frontend 1 | `apps/web/components/workspace-hotkeys.ts` |
| 8.7 | Symbol linking groups: color-coded link groups (red, green, blue, yellow) across panels | Frontend 1 | `packages/data/src/stores/linking-store.ts` (extend) |
| 8.8 | Responsive behavior: full docking on desktop, tab-based navigation on tablet/small screen | Frontend 2 | `apps/web/components/responsive-workspace.tsx` |
| 8.9 | Panel drag-and-drop: move panels between dock positions, split horizontal/vertical | Frontend 1 | (Dockview built-in, configure) |
| 8.10 | Panel context menu: close, maximize, float, split, move to new tab group | Frontend 2 | `apps/web/components/panel-context-menu.tsx` |
| 8.11 | Tests: layout save/load, preset switching, symbol linking | Frontend 1+2 | `apps/web/tests/workspace/` |

**Acceptance Criteria:**
- Dockview renders with draggable, resizable panels
- Switch between layout presets (2x1, 2x2, 3x2) via menu or Cmd+1-9
- Save custom layouts, reload page → layout restores exactly
- Symbol linking: click in linked watchlist → all linked chart panels update
- Panels can be dragged to new positions, split, closed
- Responsive: tablet width shows tab-based layout instead of full docking

**Commit checkpoint:** `feat: dockview multi-chart layouts with persistence and linking`

---

### Sprint 9 (Weeks 17-18): Alert System

**Goal:** Server-side alert engine that evaluates price/volume/indicator conditions and delivers notifications via push, email, and webhook — even when the browser is closed.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 9.1 | Alert schema: alerts table with condition type, symbol, threshold, delivery method, status | Full-stack 1 | `apps/api/src/db/schema/alerts.ts` |
| 9.2 | tRPC router: alert CRUD (create, list, update, delete, pause/resume) | Full-stack 1 | `apps/api/src/routers/alerts.ts` |
| 9.3 | Alert evaluator: BullMQ worker subscribes to Redis market data, checks alert conditions | Full-stack 2 | `services/notifications/src/evaluator/alert-evaluator.ts` |
| 9.4 | Price alerts: above, below, crossing (up-through, down-through) | Full-stack 2 | `services/notifications/src/evaluator/conditions/price.ts` |
| 9.5 | Volume alerts: volume exceeds threshold, RVOL threshold | Full-stack 2 | `services/notifications/src/evaluator/conditions/volume.ts` |
| 9.6 | Indicator alerts: RSI overbought/oversold, MACD crossover, MA crossover | Full-stack 2 | `services/notifications/src/evaluator/conditions/indicator.ts` |
| 9.7 | Notification delivery: in-app (WebSocket push), email (Resend), webhook (HTTP POST) | Full-stack 1 | `services/notifications/src/channels/in-app.ts`, `email.ts`, `webhook.ts` |
| 9.8 | Push notification setup (Expo push for mobile) | Mobile | `services/notifications/src/channels/push.ts` |
| 9.9 | Alert creation UI: from chart (right-click price → set alert), from alert manager panel | Frontend 2 | `packages/ui/src/trading/alert-creator.tsx`, `packages/ui/src/trading/alert-manager.tsx` |
| 9.10 | Alert manager panel: list all alerts, filter by symbol/type/status, bulk edit, delete | Frontend 2 | `packages/ui/src/trading/alert-manager.tsx` |
| 9.11 | Alert visual on chart: horizontal line at alert price level with bell icon | Frontend 1 | `packages/charts/src/overlays/alert-line.ts` |
| 9.12 | Alert trigger history: log of fired alerts with timestamp, price at trigger | Full-stack 1 | `apps/api/src/db/schema/alert_triggers.ts`, tRPC endpoint |
| 9.13 | Tests: alert evaluation logic, condition matching, delivery | Full-stack 1+2 | `services/notifications/tests/` |

**Acceptance Criteria:**
- Create price alert on AAPL at $185 → when price crosses $185, receive notification
- Alert fires even when browser is closed (server-side evaluation)
- In-app notification appears in real-time via WebSocket
- Email delivery works via Resend
- Webhook fires to configured URL with JSON payload
- Alert manager shows all alerts, allows bulk edit/delete
- Alert line visible on chart at alert price level
- Free tier: 100 alerts maximum, Pro: 500, Premium: unlimited

**Commit checkpoint:** `feat: server-side alert system with multi-channel delivery`

---

### Sprint 10 (Weeks 19-20): Stock Screener

**Goal:** Build a stock screener with 100+ filters, pre-built scans, real-time results for paid tiers, and custom formula support.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 10.1 | Screener schema: saved screens, filter definitions | Full-stack 1 | `apps/api/src/db/schema/screeners.ts` |
| 10.2 | tRPC router: screener.scan(filters), screener.save, screener.list | Full-stack 1 | `apps/api/src/routers/screener.ts` |
| 10.3 | Screener engine: query builder that translates filter criteria to PostgreSQL/TimescaleDB queries | Full-stack 2 | `apps/api/src/services/screener-engine.ts` |
| 10.4 | Fundamental filters (20+): market cap, P/E, EPS, revenue, dividend yield, sector, industry | Full-stack 2 | `apps/api/src/services/screener-filters/fundamental.ts` |
| 10.5 | Technical filters (30+): price above/below MA, RSI range, MACD signal, volume surge, gap %, ATR range | Full-stack 2 | `apps/api/src/services/screener-filters/technical.ts` |
| 10.6 | Price action filters (20+): 52-week high/low proximity, % change (1D/1W/1M/3M/YTD/1Y), new highs/lows | Full-stack 1 | `apps/api/src/services/screener-filters/price-action.ts` |
| 10.7 | Pre-built scan templates: Gap Scanner, Momentum Scanner, Breakout Scanner, Oversold Bounce, Volume Spike | Full-stack 1 | `apps/api/src/services/screener-templates.ts` |
| 10.8 | Screener UI: filter sidebar (category accordion), results table with sortable columns | Frontend 2 | `apps/web/components/panels/screener-panel.tsx` |
| 10.9 | Filter builder: add/remove/edit filters, AND/OR logic, save as named screen | Frontend 2 | `packages/ui/src/trading/filter-builder.tsx` |
| 10.10 | Results table: virtual scrolling, click row → navigate to chart, add to watchlist button | Frontend 2 | `packages/ui/src/trading/screener-results.tsx` |
| 10.11 | Real-time vs delayed: paid tiers get real-time scan results, free gets 15-min delayed | Full-stack 1 | `apps/api/src/services/screener-engine.ts` (tier check) |
| 10.12 | Tests: screener engine, filter logic, template scans | Full-stack 1+2 | `apps/api/tests/services/screener/` |

**Acceptance Criteria:**
- Run "Gap Scanner" → returns stocks gapping >5% on above-average volume
- Add custom filters: market cap >$1B AND RSI <30 AND volume >2x avg → results match
- Results table is sortable by any column
- Click a result row → linked chart panel navigates to that symbol
- Free tier returns delayed results; Pro+ returns real-time
- Save custom screens by name, reload page → screens persist

**Commit checkpoint:** `feat: stock screener with 100+ filters and pre-built scans`

---

### Sprint 11 (Weeks 21-22): Paper Trading + Account/Billing

**Goal:** Paper trading with simulated order execution (bid/ask fills), position tracking, P&L display, and Stripe subscription billing.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 11.1 | Paper trading schema: paper_portfolios, paper_orders, paper_positions, paper_fills | Full-stack 1 | `apps/api/src/db/schema/paper-trading.ts` |
| 11.2 | tRPC router: paper.submitOrder, paper.getPositions, paper.getOrders, paper.getPortfolio | Full-stack 1 | `apps/api/src/routers/paper-trading.ts` |
| 11.3 | Simulated order execution engine: market orders fill at bid/ask (not mid), limit orders queue | Full-stack 2 | `apps/api/src/services/paper-execution.ts` |
| 11.4 | Position tracker: calculate average cost, unrealized P&L, realized P&L per position | Full-stack 2 | `apps/api/src/services/position-tracker.ts` |
| 11.5 | Order entry panel: symbol, side (buy/sell), type (market/limit/stop), quantity, price | Frontend 2 | `packages/ui/src/trading/order-entry.tsx` |
| 11.6 | Position panel: open positions with unrealized P&L, close button | Frontend 2 | `packages/ui/src/trading/positions-panel.tsx` |
| 11.7 | Order history panel: filled, pending, cancelled orders with timestamps | Frontend 2 | `packages/ui/src/trading/order-history.tsx` |
| 11.8 | Portfolio summary: total value, daily P&L, buying power, margin | Frontend 2 | `packages/ui/src/trading/portfolio-summary.tsx` |
| 11.9 | Paper trading visual indicator: prominent "PAPER" badge on all paper trading screens | Frontend 2 | UI element |
| 11.10 | Stripe integration: subscription checkout, plan management, billing portal | Full-stack 1 | `apps/api/src/services/billing.ts`, `apps/web/app/(app)/settings/billing/` |
| 11.11 | Subscription tier enforcement: gate features by Free/Pro/Premium tier | Full-stack 1 | `apps/api/src/middleware/tier-guard.ts` |
| 11.12 | Settings pages: profile, notifications, billing, appearance (theme), keyboard shortcuts | Frontend 2 | `apps/web/app/(app)/settings/` |
| 11.13 | Tests: order execution simulation, position math, tier enforcement | Full-stack 1+2 | `apps/api/tests/services/paper/`, `apps/api/tests/middleware/` |

**Acceptance Criteria:**
- Submit market buy 100 shares AAPL → fills at current ask price
- Position appears with correct average cost and real-time unrealized P&L
- Submit market sell to close → realized P&L calculated correctly
- Limit orders queue and fill when price reaches limit
- "PAPER" badge clearly visible — impossible to confuse with live trading
- Stripe checkout works: select Pro plan → payment → features unlock immediately
- Free tier users cannot access Pro+ features (graceful upgrade prompt)

**Commit checkpoint:** `feat: paper trading engine and stripe subscription billing`

---

### Sprint 12 (Weeks 23-24): iOS Mobile App + Keyboard Shortcuts + Polish

**Goal:** Launch-ready iOS app with charts, watchlists, alerts, paper trading. Complete keyboard shortcuts system. MVP polish, performance optimization, and deployment.

**Tasks:**

| # | Task | Owner | Files |
|---|------|-------|-------|
| 12.1 | Mobile chart component: React Native Skia candlestick rendering, pinch zoom, pan | Mobile | `apps/mobile/components/chart/skia-chart.tsx` |
| 12.2 | Mobile watchlist screen: same data store, optimized for touch | Mobile | `apps/mobile/app/(tabs)/watchlist.tsx` |
| 12.3 | Mobile alert management: create/edit/delete alerts, push notification handling | Mobile | `apps/mobile/app/(tabs)/alerts.tsx` |
| 12.4 | Mobile paper trading: order entry via bottom sheet, positions, portfolio | Mobile | `apps/mobile/components/order-sheet.tsx` |
| 12.5 | Mobile navigation: bottom tabs (Chart, Watchlist, Trade, Portfolio, More) | Mobile | `apps/mobile/app/(tabs)/layout.tsx` |
| 12.6 | Push notifications: APNs via expo-notifications for alerts and order fills | Mobile | `apps/mobile/services/push.ts` |
| 12.7 | Keyboard shortcut system: configurable keybindings, default set | Frontend 1 | `packages/ui/src/trading/hotkey-manager.tsx`, `apps/web/hooks/use-hotkeys.ts` |
| 12.8 | Default shortcuts: timeframe (1-9), panel nav (Ctrl+1-6), drawing tools (D+T, D+H, D+F), command palette (Cmd+K) | Frontend 1 | `packages/shared/src/constants/default-keybindings.ts` |
| 12.9 | Keyboard shortcut settings page: view, edit, reset to defaults | Frontend 2 | `apps/web/app/(app)/settings/shortcuts/page.tsx` |
| 12.10 | Performance audit: Lighthouse CI, bundle analysis, lazy loading review | DevOps | CI config, `next.config.ts` optimization |
| 12.11 | Initial JS bundle <200KB gzipped: code splitting, lazy loading chart module, drawing tools | Frontend 1 | `apps/web/app/` (dynamic imports) |
| 12.12 | Playwright E2E tests: sign up → search symbol → view chart → add indicator → create alert → paper trade | DevOps + Frontend | `apps/web/tests/e2e/` |
| 12.13 | Staging deployment: full stack on Railway/Fly.io/Vercel staging environment | DevOps | Deployment configs |
| 12.14 | App Store submission preparation: screenshots, metadata, TestFlight build | Mobile | App Store Connect |

**Acceptance Criteria:**
- iOS app renders charts via Skia at 60fps with pinch zoom and pan
- Mobile watchlist shows real-time prices with push notification delivery
- Mobile paper trading: submit order via bottom sheet → position appears
- All keyboard shortcuts work: timeframe switching, panel navigation, drawing tools
- Web bundle <200KB gzipped (main chunk)
- Lighthouse performance score >90
- E2E tests pass: complete user journey from signup to paper trade
- Staging environment mirrors production: all features functional

**Commit checkpoint:** `feat: iOS app, keyboard shortcuts, performance optimization — MVP ready`

---

## Phase 2: Social Layer + Journal + Options — Months 6-12

**Team additions:** +1 backend (social), +1 frontend (options), +1 moderator (10 total)

---

### Sprint 13 (Weeks 25-26): Trade Journal — Auto-Log & Snapshots

**Tasks:**
- Schema: journal_entries, tags, chart_snapshots
- Auto-log service: detect paper trade fills → create journal entry with chart snapshot (Cloudflare R2)
- Manual entry support for trades on external brokers
- Tagging system: setup type (breakout, pullback, reversal), emotional state, market conditions, grade (A/B/C)
- Journal list view: calendar heatmap of daily P&L, equity curve, filterable by tags
- R-multiple tracking: auto-calculate R per trade based on stop distance

**Deliverable:** Working trade journal with auto-logging from paper trades

---

### Sprint 14 (Weeks 27-28): Performance Dashboard

**Tasks:**
- Equity curve visualization (line chart with drawdown shading)
- Win rate, average win/loss, profit factor, expectancy calculations
- Time-of-day analysis (when does the user trade best?)
- Setup type breakdown (which setups are most profitable?)
- Rolling Sharpe ratio chart
- Holding time analysis
- CSV/PDF export

**Deliverable:** Analytics dashboard showing comprehensive trade statistics

---

### Sprint 15 (Weeks 29-30): Social — Idea Publishing

**Tasks:**
- Idea schema: ideas, comments, votes, chart_snapshots
- Publishing flow: annotate chart → write markdown analysis → add tags → publish
- Interactive chart snapshot: viewers can zoom/pan/toggle indicators on the embedded chart
- Voting system (upvote/downvote) with anti-gaming measures
- Commenting with threading and markdown support
- Idea feed: global, by ticker, by strategy tag, chronological + ranked

**Deliverable:** Users can publish, browse, vote, and comment on trading ideas

---

### Sprint 16 (Weeks 31-32): Social — Profiles & Leaderboards

**Tasks:**
- User profile pages: bio, trading stats (win rate, Sharpe, max DD), strategy description
- Verification badges: identity verified, broker-connected, performance-audited
- Following/followers system
- Leaderboards: risk-adjusted ranking (Sharpe, max DD), customizable timeframes (7d/30d/90d/1y/all)
- Separate boards by asset class (equities, options, crypto) and style (day, swing)
- Profile privacy settings

**Deliverable:** Public profiles with verified trading stats and performance leaderboards

---

### Sprint 17 (Weeks 33-34): Discussion Rooms & News Feed

**Tasks:**
- Real-time chat rooms by ticker ($AAPL room), strategy type, market conditions
- Threading support for chat messages
- Reputation gate: minimum account age/karma to post
- Inline chart embed in chat messages
- Benzinga news integration: real-time feed, per-ticker filtering
- Economic calendar with countdown timers
- Earnings calendar

**Deliverable:** Live discussion rooms and integrated news/calendar feed

---

### Sprint 18 (Weeks 35-36): Options Chain v1

**Tasks:**
- Options data feed integration (Polygon.io OPRA or Intrinio)
- Options chain panel: dual-pane layout (calls left, puts right)
- Strike display: bid/ask/last/volume/OI/IV per strike
- Expiration tabs with date navigation
- ITM/OTM highlighting, strike filtering
- Greeks display: Delta, Gamma, Theta, Vega per strike (real-time computation)
- IV rank and IV percentile display in chain header

**Deliverable:** Full options chain with real-time Greeks

---

### Sprint 19 (Weeks 37-38): Options Strategy Builder

**Tasks:**
- Multi-leg strategy construction: click strikes to add legs
- Template strategies: vertical spread, iron condor, butterfly, straddle, strangle, calendar, diagonal (20+ templates)
- P&L diagram: interactive chart showing profit/loss at expiration + at different dates (date slider)
- Max profit, max loss, breakeven points, probability of profit (POP) calculation
- Strategy leg editing: adjust quantities, strikes, expirations
- Order preview before submission (paper trading integration)

**Deliverable:** Visual options strategy builder with P&L diagrams and probability analysis

---

### Sprint 20 (Weeks 39-40): Embeddable Widgets & SEO

**Tasks:**
- Chart embed widget: configurable, responsive, one-click embed code
- Ticker tape widget (horizontal scrolling prices)
- Open Graph metadata for published ideas (rich preview on Twitter/LinkedIn)
- Structured data (JSON-LD) for ideas pages (Article schema)
- SEO: sitemap generation for published ideas, meta tags, canonical URLs
- ISR configuration for idea pages (1-hour revalidation)

**Deliverable:** Embeddable chart widgets and SEO-optimized social content pages

---

### Sprint 21 (Weeks 41-42): Android App

**Tasks:**
- Expo EAS Build configuration for Android
- Android-specific UI adjustments (Material Design navigation patterns where appropriate)
- Google Play store submission preparation
- Android push notifications (FCM via expo-notifications)
- Testing across Android device sizes and OS versions

**Deliverable:** Android app with feature parity to iOS, submitted to Google Play

---

### Sprint 22 (Weeks 43-44): Heat Maps + Advanced Drawing Tools

**Tasks:**
- S&P 500 treemap heat map: sized by market cap, colored by performance (1D/1W/1M/YTD)
- Sector drill-down: click sector → see constituent stocks
- Custom metric coloring (P/E, RSI, IV rank)
- Advanced drawing tools: Fibonacci fan/arcs/time zones, Gann fan/box, Elliott Wave labels, XABCD harmonic patterns, regression channel, measurement tools (risk:reward)

**Deliverable:** Market heat maps and advanced drawing tools

---

### Sprint 23-24 (Weeks 45-48): Phase 2 Polish, Performance & Stabilization

**Tasks:**
- Performance optimization across all new features
- Bug fixes from user feedback
- Moderation tooling for community content
- Load testing social features (ideas feed, chat rooms)
- Security audit of social features (XSS, injection)
- Documentation updates

**Deliverable:** Phase 2 stable release

---

## Phase 3: Advanced Analysis + Broker Integration — Months 12-18

**Team additions:** +1 backend (broker), +1 ML engineer (12 total)

---

### Sprint 25-26 (Weeks 49-52): Broker Integration — Alpaca

**Tasks:**
- Broker adapter interface: abstract order submission, position sync, account data
- Alpaca adapter: OAuth authentication, REST API for orders, WebSocket for updates
- Unified order entry: same UI for paper and live trading, toggle between accounts
- Position synchronization: fetch Alpaca positions on connect, real-time updates
- Order lifecycle tracking: submitted → accepted → filled → cancelled states
- Risk confirmation dialog for live orders

**Deliverable:** Live trading through Alpaca broker from TheMarlinTraders

---

### Sprint 27-28 (Weeks 53-56): Broker Integration — Interactive Brokers

**Tasks:**
- IBKR Client Portal API adapter
- IBKR-specific order types (bracket, OCA, conditional)
- Multi-account support (IBKR users often have multiple accounts)
- IBKR position and P&L sync
- Options order support through IBKR

**Deliverable:** Live trading through IBKR from TheMarlinTraders

---

### Sprint 29-30 (Weeks 57-60): Advanced Order Types + DOM

**Tasks:**
- Bracket orders (entry + stop + target)
- Trailing stop orders
- Chart-based order modification: drag stop/target lines on chart
- DOM/Price Ladder: Level 2 visualization with click-to-trade
- Conditional orders (if X then Y)
- Order confirmation toggle (skip for speed)

**Deliverable:** Professional-grade order entry with DOM and chart-based modification

---

### Sprint 31-32 (Weeks 61-64): AI Chart Analysis

**Tasks:**
- Pattern recognition ML model: train on labeled chart patterns (H&S, flags, triangles, cup & handle)
- NLP query engine: "show me oversold large-caps breaking out" → screener + chart results
- AI trade review: analyze journal entries for behavioral patterns
- Confidence scoring for detected patterns
- Real-time pattern scanning on active charts
- "Beta" label and feedback mechanism

**Deliverable:** AI-powered chart analysis with pattern recognition and NLP queries

---

### Sprint 33-34 (Weeks 65-68): Crypto + Forex Data

**Tasks:**
- Crypto WebSocket connections: Coinbase, Binance, Kraken direct feeds
- 24/7 market handling: no market-hours assumptions in data pipeline
- Custom session definitions for crypto VWAP
- Forex data integration: additional provider adapter
- Pip calculator, lot size calculator, currency strength meter
- Correlation matrix (cross-asset and forex pair correlations)
- Forex session overlap visualization (London/NY/Tokyo/Sydney)

**Deliverable:** Crypto and forex data with specialized analysis tools

---

### Sprint 35-36 (Weeks 69-72): Options Flow + IV Analytics

**Tasks:**
- Options flow detection: unusual volume (>2x avg AND >2x OI), block trades, sweeps
- Flow table: time, ticker, strike, expiry, sentiment, premium, type
- Put/call ratio charts (equity and index)
- IV analytics: IV rank, IV percentile, IV surface 3D visualization
- Skew charts, IV term structure
- HV vs IV overlay on price chart
- Volatility cones, expected move projections on chart

**Deliverable:** Options flow feed and comprehensive IV analytics suite

---

### Sprint 37-38 (Weeks 73-76): Futures + Auto Pattern Recognition + Phase 3 Polish

**Tasks:**
- Futures data: contract specs, continuous contracts (back-adjusted + unadjusted), rollover calendar
- Spread trading tools, margin display, COT data visualization
- Auto pattern recognition: algorithmic detection of patterns with confidence scoring
- Real-time pattern scanning integration with alert system
- Phase 3 stabilization, performance optimization, security audit

**Deliverable:** Futures support, auto pattern recognition, Phase 3 stable

---

## Phase 4: Algo Trading + Strategy IDE — Months 18-24

**Team additions:** +2 backend (strategy engine), +1 frontend (IDE) (15 total)

---

### Sprint 39-40 (Weeks 77-80): Strategy IDE — Code Editor

**Tasks:**
- Monaco editor integration in IDE panel (packages/charts or dedicated panel)
- TypeScript strategy API: `onBar`, `onTick`, `buy`, `sell`, `position`, `indicators`
- Syntax highlighting + IntelliSense for strategy API
- Strategy file management: create, save, rename, delete
- Example strategy templates (MA crossover, RSI mean reversion, breakout)

**Deliverable:** Code editor with TypeScript strategy API and templates

---

### Sprint 41-42 (Weeks 81-84): Backtesting Engine — Vectorized Mode

**Tasks:**
- Vectorized backtesting engine in `services/backtesting/src/vectorized/`
- Historical data loader: fetch from TimescaleDB with survivorship-bias awareness
- Fill simulation: market orders at next bar open, limit orders with slippage model
- Commission modeling: per-share and per-trade configurable
- Performance analytics: equity curve, Sharpe, Sortino, max drawdown, win rate, profit factor
- Results visualization: equity curve overlay on price chart, trade markers

**Deliverable:** Fast vectorized backtesting with results visualization

---

### Sprint 43-44 (Weeks 85-88): Backtesting Engine — Event-Driven Mode

**Tasks:**
- Event-driven engine: tick-by-tick simulation with realistic fill modeling
- Partial fill simulation, queue position modeling for limit orders
- Walk-forward optimization: in-sample/out-of-sample splits, rolling windows
- Monte Carlo simulation: randomize trade order, bootstrap returns, confidence intervals
- Parameter optimization with overfitting guardrails

**Deliverable:** Production-grade event-driven backtesting with walk-forward and Monte Carlo

---

### Sprint 45-46 (Weeks 89-92): Sandboxed Execution + Live Deployment

**Tasks:**
- Strategy sandbox: isolated-vm for TypeScript, containerized for Python
- Resource limits: 10ms/bar max, 256MB memory, no network/filesystem
- Paper trading integration: run strategy against live data with simulated fills
- Live trading deployment: strategy → broker API with risk circuit breakers
- Risk controls: max position size, daily loss limit, drawdown kill switch
- Monitoring dashboard: active strategies, P&L, alerts, error logs

**Deliverable:** Strategy pipeline from backtest → paper → live with risk controls

---

### Sprint 47-48 (Weeks 93-96): Visual Builder + Python Interop + Pine Import

**Tasks:**
- Visual/no-code strategy builder: drag-and-drop blocks for conditions and actions
- Visual builder generates TypeScript under the hood
- Python interop: sandboxed Python runtime (Pyodide or containerized)
- Python strategy API mirroring TypeScript API
- Pine Script import: transpiler for basic Pine Script v5 strategies (target 60-70% compatibility)
- Migration guide for Pine Script users

**Deliverable:** Visual builder, Python support, and Pine Script import

---

### Sprint 49-50 (Weeks 97-100): ML Integration + Phase 4 Polish

**Tasks:**
- Feature engineering pipeline: technical indicators as ML features
- Model training interface: classification/regression with pre-built templates
- Prediction integration: model outputs as strategy signals
- Drift detection: monitor model performance degradation
- Model versioning and rollback
- Phase 4 stabilization, compute cost optimization, documentation

**Deliverable:** ML model integration, Phase 4 stable

---

## Phase 5: Marketplace + Copy Trading — Months 24-30

**Team additions:** +1 backend (marketplace), +1 frontend (streaming) (17 total)

---

### Sprint 51-52 (Weeks 101-104): Marketplace Platform

**Tasks:**
- Marketplace schema: products (indicators, strategies, signals, education), purchases, reviews, creator profiles
- Creator dashboard: upload product, set pricing (one-time or subscription), view sales
- Product listing pages: description, reviews, performance data, pricing
- Stripe Connect integration for creator payouts (15-20% platform commission)
- Review/rating system with purchase verification
- Category browsing, search, and filtering

**Deliverable:** Marketplace for buying and selling indicators/strategies

---

### Sprint 53-54 (Weeks 105-108): Copy Trading Engine

**Tasks:**
- Copy trading schema: copy_relationships, copy_orders, leader_stats
- Leader registration: opt-in, strategy description, risk disclosure
- Follower interface: browse leaders, view performance, set allocation + risk limits
- Order replication engine: <100ms from leader fill to follower order submission
- Proportional position sizing: follower allocation / leader equity × leader position size
- Copy stop-loss: automatic unfollow if drawdown exceeds threshold
- Performance verification: audited track records linked to actual broker fills

**Deliverable:** Copy trading with verified performance and risk controls

---

### Sprint 55-56 (Weeks 109-112): Live Streaming

**Tasks:**
- WebRTC integration (LiveKit or custom): screen sharing + webcam
- Real-time chart annotation during stream
- Chat with moderation (auto + manual)
- Tipping via platform coins
- VOD recording: auto-record streams, save to R2, playback page
- Stream discovery: live streams page, recommended streamers

**Deliverable:** Live streaming with chat, chart annotation, and tipping

---

### Sprint 57-58 (Weeks 113-116): Creator Economy + On-Chain Metrics

**Tasks:**
- Creator tiers: Emerging (0-50 followers), Established (50-500), Elite (500+)
- Creator analytics: subscribers, revenue, engagement metrics
- Subscription management for followers
- Crypto on-chain metrics: exchange inflows/outflows, whale transactions, NVT, MVRV
- Funding rates, liquidation heatmap, DeFi TVL integration
- Glassnode/CryptoQuant adapter

**Deliverable:** Creator program with tier system + crypto on-chain analytics

---

### Sprint 59-60 (Weeks 117-120): Phase 5 Stabilization

**Tasks:**
- Copy trading load testing and latency optimization
- Marketplace content moderation tooling
- Creator payment reconciliation
- Security audit of payment flows
- Performance optimization across all Phase 5 features
- Documentation updates

**Deliverable:** Phase 5 stable release

---

## Phase 6: Institutional Features — Months 30-42

**Team additions:** +2 backend (institutional), +1 sales, +1 security (21 total)

---

### Sprint 61-62 (Weeks 121-124): Portfolio Risk Dashboard — VaR & Stress Testing

**Tasks:**
- Portfolio schema extensions: benchmarks, factor exposures, risk snapshots
- Parametric VaR calculation engine
- Historical VaR simulation (rolling window)
- Monte Carlo VaR (10,000 simulations)
- CVaR / Expected Shortfall
- Stress testing: historical scenarios (2008, COVID, Flash Crash) + custom scenarios
- Risk dashboard UI: VaR dial, stress test results table, distribution charts

**Deliverable:** Portfolio-level VaR and stress testing

---

### Sprint 63-64 (Weeks 125-128): Factor Analysis & Performance Attribution

**Tasks:**
- Fama-French factor model implementation (3-factor and 5-factor)
- PCA-based factor decomposition
- Brinson-Fachler attribution: allocation, selection, interaction effects
- Performance metrics dashboard: alpha, beta, Sharpe, Sortino, Information ratio, Treynor
- Benchmark comparison: custom benchmark selection, tracking error
- Drawdown analysis: underwater chart, max DD, average DD, recovery time

**Deliverable:** Factor analysis and Brinson-Fachler performance attribution

---

### Sprint 65-66 (Weeks 129-132): Compliance Engine

**Tasks:**
- Restricted/watch list management
- Pre-trade compliance checks: position limits, concentration limits, restricted symbol blocking
- Post-trade surveillance: unusual activity detection
- Audit trail: every action logged with user, timestamp, IP, action details
- Compliance reporting: daily/weekly/monthly reports
- SEC reporting helpers: 13F template, Form 4 preparation

**Deliverable:** Compliance engine with pre-trade checks and audit trails

---

### Sprint 67-68 (Weeks 133-136): Institutional Order Types

**Tasks:**
- TWAP (Time-Weighted Average Price) execution algorithm
- VWAP (Volume-Weighted Average Price) execution algorithm
- Iceberg orders: display quantity vs actual quantity
- Smart order routing: venue selection logic
- Execution analytics: actual vs expected fills, market impact measurement

**Deliverable:** Institutional execution algorithms

---

### Sprint 69-70 (Weeks 137-140): Team Workspaces + Multi-User

**Tasks:**
- Organization model: teams, members, roles (admin, PM, analyst, trader)
- Role-based access control (RBAC)
- Shared workspaces: team-level watchlists, saved screens, layout templates
- Shared journal entries and performance analytics (team-level)
- Activity feed: team member actions
- Invitation and onboarding flow

**Deliverable:** Multi-user team workspaces with RBAC

---

### Sprint 71-72 (Weeks 141-144): API-First Programmatic Access

**Tasks:**
- REST API for external consumption (separate from internal tRPC)
- API key management: generate, revoke, scope (read-only vs trade)
- Per-key rate limiting
- API documentation (auto-generated from OpenAPI spec)
- WebSocket API for real-time data access
- SDK generation (TypeScript, Python)

**Deliverable:** Public REST + WebSocket API with documentation

---

### Sprint 73-74 (Weeks 145-148): Prime Brokerage Integration + FIX Protocol

**Tasks:**
- FIX protocol gateway (QuickFIX/N or custom)
- Prime broker connectivity (start with one: Goldman, JPM, or Morgan Stanley)
- Margin management and monitoring
- Securities lending/borrowing tools
- Short selling tools: locate, borrow availability, cost of borrow

**Deliverable:** FIX protocol connectivity to prime brokerage

---

### Sprint 75-76 (Weeks 149-152): SOC 2 + Fund-Level Features

**Tasks:**
- SOC 2 Type II preparation: controls documentation, evidence collection
- Third-party security audit coordination
- NAV calculation engine
- Investor-level reporting templates
- Fee management: management fee, performance fee, hurdle rates, high-water marks
- AUM tracking dashboard

**Deliverable:** SOC 2 readiness + fund-level reporting

---

### Sprint 77-80 (Weeks 153-160): Enterprise Sales, Bug Bounty & Phase 6 Polish

**Tasks:**
- Enterprise onboarding flow: custom contracts, dedicated support setup
- Bug bounty program launch
- Penetration testing coordination
- Phase 6 stabilization across all institutional features
- Performance optimization for institutional data volumes
- Full documentation update
- SOC 2 Type II audit completion

**Deliverable:** Phase 6 stable release, SOC 2 certified, enterprise-ready

---

## Sprint Summary

| Phase | Sprints | Weeks | Key Deliverables |
|-------|---------|-------|-----------------|
| **Phase 1** | 1-12 | 1-24 | Monorepo, charting, real-time data, 50+ indicators, drawings, watchlists, alerts, screener, paper trading, iOS app, billing |
| **Phase 2** | 13-24 | 25-48 | Trade journal, social (ideas, profiles, leaderboards, chat), options chain + strategy builder, Android, heat maps, widgets |
| **Phase 3** | 25-38 | 49-76 | Broker integration (Alpaca + IBKR), advanced orders, AI analysis, crypto + forex, options flow + IV analytics, futures, auto pattern recognition |
| **Phase 4** | 39-50 | 77-100 | Strategy IDE (code + visual + Python), backtesting (vectorized + event-driven), live deployment, Pine Script import, ML integration |
| **Phase 5** | 51-60 | 101-120 | Marketplace, copy trading, live streaming, creator economy, on-chain metrics |
| **Phase 6** | 61-80 | 121-160 | Portfolio risk (VaR, factors, attribution), compliance, institutional orders (TWAP/VWAP), team workspaces, API, FIX protocol, SOC 2 |

**Total: 80 sprints across 160 weeks (approximately 37 months of development)**

---

## Execution Notes

1. **Sprints 1-12 (Phase 1)** are detailed at the task level with exact file paths and acceptance criteria — ready for immediate execution.
2. **Sprints 13-80 (Phases 2-6)** are at feature-task level — detailed enough for sprint planning but will need task-level breakdown as each sprint approaches.
3. **Each sprint should end with a commit** — deployable increment, all tests passing.
4. **TDD discipline:** Write failing tests first for all business logic (indicator calculations, order execution, alert evaluation, risk calculations).
5. **Code review checkpoint** at the end of each sprint before merging to main.
6. **Phase gates:** Each phase has success criteria defined in the implementation plan. Do not proceed to the next phase until the current phase's criteria are met.
