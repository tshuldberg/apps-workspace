# TheMarlinTraders — Stack Recommendation

> Complete technology stack recommendation with justifications, monorepo structure, and third-party service evaluation.
> Last updated: 2026-02-13

---

## 1. Recommended Stack Summary

| Category | Technology | Version | Why |
|----------|-----------|---------|-----|
| **Monorepo** | Turborepo | 2.x | Fastest monorepo build orchestration; smart caching skips unchanged packages; remote cache via Vercel |
| **Package Manager** | pnpm | 9.x | 3x faster installs than npm, strict dependency hoisting prevents phantom deps, workspace protocol for internal packages |
| **Language** | TypeScript | 5.7+ | Strict mode across all packages; single language for frontend, backend, mobile, and strategy engine eliminates type translation errors |
| **Web Framework** | Next.js | 15.x | Server Components reduce bundle; App Router for nested layouts; Vercel-optimized deployment; ISR for SEO-critical pages |
| **Mobile Framework** | React Native + Expo | SDK 52+ | Cross-platform iOS/Android from shared TypeScript; Expo managed workflow for OTA updates and native modules |
| **State Management** | Zustand | 5.x | Minimal boilerplate, subscription-granular re-renders, shared stores between web and mobile |
| **API Layer** | tRPC | 11.x | End-to-end type safety with zero codegen; batching; WebSocket subscriptions |
| **Server Runtime** | Bun | 1.2+ | 2-3x faster HTTP handling; native TypeScript execution; Node.js API compatible |
| **ORM** | Drizzle | 0.40+ | SQL-like query builder with zero runtime overhead; 50KB client vs Prisma's 2MB engine; schema-as-TypeScript |
| **Primary Database** | PostgreSQL | 16 | Industry standard relational database; rich extension ecosystem; strong tooling |
| **Time-Series** | TimescaleDB | 2.x | PostgreSQL extension for OHLCV data; hypertables, continuous aggregates, 90%+ compression |
| **Cache / Pub/Sub** | Redis | 7.x | Sub-millisecond reads; pub/sub for real-time fan-out; session storage; BullMQ backend |
| **Search** | Meilisearch | 1.x | Sub-50ms search; typo tolerance; zero config; self-hostable with no per-query fees |
| **File Storage** | Cloudflare R2 | — | S3-compatible; zero egress fees; global edge distribution |
| **Authentication** | Clerk | 5.x | Pre-built UI, MFA, JWT sessions, organization support; weeks of dev time saved |
| **Background Jobs** | BullMQ | 5.x | Redis-backed job queues; priorities, retries, progress tracking, cron scheduling |
| **WebSocket Server** | ws | 8.x | Fastest Node.js WebSocket library; low-level control for custom protocol |
| **Component Library** | shadcn/ui + Radix UI | latest | Full component ownership; Mira style for data density; WAI-ARIA accessible |
| **Styling** | Tailwind CSS | 4.x | Zero runtime cost; Oxide engine 10x faster builds; CSS variable theming |
| **Layout / Docking** | Dockview | 4.13+ | Zero-dep React docking; floating panels; multi-monitor popout; JSON serialization |
| **Charting (Web)** | TradingView Lightweight Charts | 5.1 | 35KB bundle; Canvas 2D; candlestick, line, area, baseline; production-quality MVP charting |
| **Charting (Mobile)** | React Native Skia | 1.x | GPU-direct rendering via Skia engine; 120fps on modern devices |
| **Virtual Scrolling** | @tanstack/react-virtual | 3.x | Headless; 12KB; variable row heights; only ~60 DOM nodes for 500+ item lists |
| **Tables** | @tanstack/react-table | 8.x | Headless table engine; sorting, filtering, grouping, virtual scroll integration |
| **Animation** | Motion (Framer Motion) | 12+ | Declarative API; layout animations; LazyMotion defers 30KB; exit animations |
| **Mobile Navigation** | React Navigation | 7.x | Bottom tabs, stack navigation, shared element transitions |
| **Mobile Gestures** | react-native-gesture-handler + reanimated | 2.x / 3.x | UI-thread gesture processing; pinch-zoom, pan, long-press for charts |
| **Mobile Bottom Sheet** | @gorhom/bottom-sheet | 5.x | Reanimated v3 powered; snap points for order entry flow |
| **Command Palette** | cmdk | latest | Cmd+K symbol search and navigation; used by Linear, Vercel |
| **Toasts** | Sonner | latest | Lightweight toast notifications for order fills, alerts, system messages |
| **Icons** | Lucide React + Phosphor | latest | 1500+ stroke icons (Lucide); 9000+ icons with duotone weight (Phosphor) |
| **Fonts** | Inter (UI) + JetBrains Mono (data) | variable | Inter: best data-dense sans-serif; JetBrains Mono: tabular figures for price columns |
| **Web Workers** | Comlink | 4.x | Promise-based worker API; wraps postMessage complexity |
| **Testing (Unit)** | Vitest | 2.x | Vite-powered; ESM-native; compatible with Jest API; 2-3x faster than Jest |
| **Testing (E2E)** | Playwright | 1.x | Cross-browser; auto-waiting; network interception for market data mocking |
| **Testing (Component)** | React Testing Library | 16.x | DOM-based component testing aligned with user behavior |
| **Linting** | ESLint (flat config) | 9.x | Flat config for monorepo consistency; shared config package |
| **Formatting** | Prettier | 3.x | Opinionated formatting eliminates style debates |
| **CI/CD** | GitHub Actions | — | Native GitHub integration; matrix builds for web/mobile/api |
| **Hosting (Web)** | Vercel | — | Zero-config Next.js; edge functions; ISR; preview deploys |
| **Hosting (API)** | Railway | — | Managed containers; auto-scaling; co-located Redis + PostgreSQL |
| **Hosting (WebSocket)** | Fly.io | — | Global edge deployment; persistent connections; low-latency routing |
| **CDN** | Cloudflare | — | 300+ global PoPs; DDoS protection; R2 integration; edge rules |
| **Error Tracking** | Sentry | — | Source-mapped error tracking; performance monitoring; session replay |
| **Monitoring** | Grafana + Prometheus | — | Custom dashboards for WebSocket metrics, latency, throughput |

---

## 2. Monorepo Structure

```
TheMarlinTraders/
├── apps/
│   ├── web/                    # Next.js 15 (App Router)
│   │   ├── app/                # App Router pages and layouts
│   │   ├── components/         # Web-specific components
│   │   ├── hooks/              # Web-specific hooks
│   │   └── workers/            # Web Workers (WS, data, indicators)
│   │
│   ├── mobile/                 # React Native + Expo (iOS)
│   │   ├── app/                # Expo Router screens
│   │   ├── components/         # Mobile-specific components
│   │   └── assets/             # App icons, splash screens
│   │
│   └── api/                    # Backend services (Bun runtime)
│       ├── src/
│       │   ├── routers/        # tRPC routers (market, portfolio, social, journal)
│       │   ├── services/       # Business logic services
│       │   ├── adapters/       # Provider adapters (Polygon, Finnhub, brokers)
│       │   ├── jobs/           # BullMQ job processors
│       │   ├── ws/             # WebSocket gateway
│       │   └── db/             # Drizzle schema, migrations, seed
│       └── tests/
│
├── packages/
│   ├── shared/                 # Shared types, utils, business logic
│   │   ├── src/
│   │   │   ├── types/          # Canonical types (NormalizedTrade, NormalizedBar, etc.)
│   │   │   ├── indicators/     # Technical indicator calculations (SMA, EMA, RSI, MACD)
│   │   │   ├── risk/           # Position sizing, R-multiple, exposure calculations
│   │   │   ├── validation/     # Zod schemas for orders, alerts, strategies
│   │   │   └── utils/          # Formatters (price, volume, date), constants
│   │   └── tests/
│   │
│   ├── ui/                     # Shared component library
│   │   ├── src/
│   │   │   ├── primitives/     # shadcn/ui components (Button, Dialog, Dropdown, etc.)
│   │   │   ├── trading/        # Trading-specific components (PriceCell, OrderTicket, etc.)
│   │   │   └── financial/      # Financial icons, chart type icons
│   │   └── stories/            # Storybook stories (optional)
│   │
│   ├── charts/                 # Charting engine
│   │   ├── src/
│   │   │   ├── lightweight/    # TradingView Lightweight Charts wrapper
│   │   │   ├── custom/         # Custom Canvas 2D renderers (volume profile, depth, etc.)
│   │   │   ├── indicators/     # Indicator overlay renderers
│   │   │   ├── drawings/       # Drawing tools (trendline, fib, shapes)
│   │   │   └── types/          # Chart configuration types
│   │   └── tests/
│   │
│   ├── data/                   # Data layer (API clients, WebSocket)
│   │   ├── src/
│   │   │   ├── api/            # tRPC client configuration
│   │   │   ├── ws/             # WebSocket client with reconnection
│   │   │   ├── stores/         # Zustand stores (market, portfolio, alerts, etc.)
│   │   │   └── cache/          # IndexedDB and in-memory cache managers
│   │   └── tests/
│   │
│   └── config/                 # Shared configurations
│       ├── eslint/             # ESLint flat config presets
│       ├── typescript/         # TSConfig bases (web, mobile, node, shared)
│       └── tailwind/           # Tailwind theme tokens and presets
│
├── services/
│   ├── market-data/            # Real-time data pipeline (can run as standalone)
│   │   ├── src/
│   │   │   ├── providers/      # Polygon, Finnhub, Alpaca adapters
│   │   │   ├── aggregation/    # Tick-to-bar engine
│   │   │   ├── normalization/  # Canonical format transforms
│   │   │   └── publisher/      # Redis Pub/Sub publishing
│   │   └── tests/
│   │
│   ├── backtesting/            # Strategy execution engine
│   │   ├── src/
│   │   │   ├── vectorized/     # Fast batch backtesting
│   │   │   ├── event-driven/   # Realistic tick-by-tick simulation
│   │   │   ├── sandbox/        # Strategy sandboxing (isolated-vm, containers)
│   │   │   ├── models/         # Fill simulation, slippage, commission models
│   │   │   └── analytics/      # Performance metric calculations
│   │   └── tests/
│   │
│   └── notifications/          # Alert delivery system
│       ├── src/
│       │   ├── channels/       # Push (APNs/FCM), email, SMS, webhook dispatchers
│       │   ├── evaluator/      # Alert condition matching engine
│       │   └── templates/      # Notification templates
│       └── tests/
│
├── tools/
│   └── scripts/                # Build, deploy, migration scripts
│       ├── seed-data.ts        # Database seeding (symbols, reference data)
│       ├── migrate.ts          # Drizzle migration runner
│       └── deploy.ts           # Multi-service deployment orchestration
│
├── turbo.json                  # Turborepo pipeline configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
├── package.json                # Root package.json (scripts, devDependencies)
└── tsconfig.json               # Root TypeScript config (references)
```

---

## 3. Key Technical Decisions

### Decision 1: Next.js 15 over Vite + React Router

**Chose:** Next.js 15 (App Router)
**Rejected:** Vite + React Router 7, Remix

**Trade-offs:**
- Next.js provides Server Components that reduce client bundle size for data-fetching panels (news, fundamentals, screener) — Vite has no equivalent without manual SSR setup.
- Published ideas (the SEO-critical social content that drives organic growth per research doc 05) require server rendering with proper meta tags and structured data. Next.js App Router delivers this with ISR. Vite would require bolting on an SSR framework.
- Next.js locks us to Vercel for optimal deployment. The trade-off is acceptable because Vercel's edge network, preview deploys, and ISR are difficult to replicate self-hosted.
- Remix was rejected because its ecosystem support for shadcn/ui and Dockview is less mature, and its deployment story for WebSocket-heavy applications is weaker.

### Decision 2: Zustand over Redux Toolkit

**Chose:** Zustand 5.x
**Rejected:** Redux Toolkit 2.x, Jotai 2.x

**Trade-offs:**
- Zustand's store-per-domain model (marketStore, portfolioStore, alertStore, socialStore, etc.) maps cleanly to the platform's feature areas with minimal boilerplate. RTK's slice pattern requires more ceremony (slice definition, action creators, selectors, middleware) for the same result.
- The platform has 10+ distinct state domains. RTK's single-store model would create a massive root state with complex selector chains. Zustand's independent stores are simpler to reason about and test.
- Jotai was a close contender for its fine-grained reactivity (useful for the watchlist where individual price cells update independently). However, the atom-based model becomes harder to reason about at scale, and Zustand's `useShallow` selector achieves comparable granularity.
- RTK Query was not needed because tRPC already handles server state caching, deduplication, and optimistic updates.

### Decision 3: tRPC over GraphQL

**Chose:** tRPC 11.x
**Rejected:** GraphQL (Apollo/urql), REST (OpenAPI)

**Trade-offs:**
- tRPC provides end-to-end type safety with zero code generation. GraphQL requires codegen (GraphQL Code Generator) to produce typed clients. In a monorepo where server and client share a TypeScript project, tRPC's approach is simpler and faster to iterate on.
- GraphQL's query flexibility (clients request exactly the fields they need) is less valuable when there is only one client team. tRPC procedures return exactly what the client needs by design.
- GraphQL's ecosystem (Apollo Client caching, normalized cache) would be overkill. tRPC's React Query integration provides caching, deduplication, and optimistic updates with far less complexity.
- REST was rejected because it offers no automatic type safety. OpenAPI spec generation and codegen would approximate tRPC's benefits but with more tooling overhead.
- **Trade-off accepted:** tRPC couples the client to a TypeScript server. If we ever need to expose a public API for third-party developers, we would add a REST or GraphQL layer alongside tRPC, not replace it.

### Decision 4: Drizzle ORM over Prisma

**Chose:** Drizzle 0.40+
**Rejected:** Prisma 6.x

**Trade-offs:**
- Drizzle generates SQL strings directly — zero runtime overhead. Prisma runs a Rust-based query engine as a sidecar process that adds ~2MB to the deployment bundle and cold start latency.
- Drizzle's SQL-like API (`db.select().from(users).where(eq(users.id, id))`) makes the generated SQL obvious. For a trading platform where query performance matters, this transparency prevents hidden N+1 problems.
- Prisma's schema language (`.prisma` files) is separate from TypeScript. Drizzle schemas are TypeScript, which means the same language, same tooling, same IDE support.
- **Trade-off accepted:** Prisma has a more polished migration workflow and a larger ecosystem of tools (Prisma Studio, Prisma Accelerate). Drizzle's migration tooling is functional but less mature. This is acceptable given the performance and transparency benefits.

### Decision 5: Bun over Node.js

**Chose:** Bun 1.2+
**Rejected:** Stock Node.js 22

**Trade-offs:**
- Bun's HTTP server handles 2-3x more requests per second than Node.js, reducing the number of WebSocket gateway instances needed.
- Native TypeScript execution eliminates the transpilation step in development, enabling sub-second server restarts.
- **Trade-off accepted:** Bun is less battle-tested than Node.js in production. Mitigated by the fact that Bun maintains full Node.js API compatibility — if any service encounters a Bun-specific issue, it can run on Node.js without code changes by switching the Dockerfile base image.

### Decision 6: Dockview over GoldenLayout

**Chose:** Dockview 4.13+
**Rejected:** GoldenLayout, FlexLayout, rc-dock, Mosaic (Palantir)

**Trade-offs:**
- Dockview is the only library with native React support, zero dependencies, floating groups, AND multi-window popout — all four are required for a professional trading platform layout system.
- GoldenLayout was the previous generation leader but requires a React wrapper, has no floating panels, and development has stalled.
- FlexLayout was a contender but lacks multi-window popout support, which is essential for multi-monitor setups.
- **Trade-off accepted:** Dockview is a smaller community than GoldenLayout was at its peak. Mitigated by the library's active maintenance (v4.13.1 released early 2026) and clean TypeScript codebase that can be forked if needed.

### Decision 7: TradingView Lightweight Charts for Phase 1

**Chose:** TradingView Lightweight Charts 5.1 (Phase 1), custom Canvas/WebGL (Phase 2-3)
**Rejected:** Highcharts Stock, Apache ECharts, custom from day one

**Trade-offs:**
- Lightweight Charts delivers production-quality candlestick charting in a 35KB bundle with zero license cost. This gets the MVP to market months faster than building a custom engine.
- Highcharts Stock has 40+ built-in indicators but costs $793.80+ per license and adds 200KB to the bundle. The indicators can be computed in Web Workers and fed to Lightweight Charts as overlay series.
- Building a custom engine from day one would deliver maximum control but delays the MVP by 3-6 months. The phased approach starts with Lightweight Charts and evolves to custom Canvas/WebGL as the product matures and specific visualization needs (order flow, footprint charts) emerge.
- **Trade-off accepted:** Lightweight Charts has limited annotation tools and maximum two price scales. Phase 2 custom Canvas overlays address these limitations without replacing the base chart.

### Decision 8: Clerk over Custom Auth

**Chose:** Clerk 5.x
**Rejected:** Auth.js, custom implementation

**Trade-offs:**
- Clerk saves 4-6 weeks of development on authentication, MFA, session management, and user profile UI. These are table-stakes features, not differentiators.
- Clerk costs ~$25/month for 1,000 MAU and $0.02/MAU beyond that. At 100K MAU, auth costs ~$2,000/month — a tiny fraction of infrastructure budget.
- **Trade-off accepted:** Vendor dependency on Clerk for authentication. Mitigated by using JWT-based sessions (not proprietary session tokens), which means we can migrate to Auth.js or custom auth by replacing the JWT issuer without changing downstream authorization logic.

---

## 4. Development Tooling

### Package Manager: pnpm 9.x

**Why pnpm over npm or yarn:**
- **3x faster installs** via content-addressable storage (packages stored once on disk, hard-linked to node_modules).
- **Strict dependency hoisting** prevents "phantom dependencies" where a package accidentally imports a dependency it doesn't declare.
- **Workspace protocol** (`workspace:*`) for internal package references, ensuring local packages are always used in development.
- **pnpm-lock.yaml** is deterministic and smaller than package-lock.json.

### Build System: Turborepo 2.x

Turborepo orchestrates the monorepo build pipeline:
- **Task caching:** Unchanged packages skip rebuild. Remote cache via Vercel enables CI cache sharing.
- **Parallel execution:** Independent tasks (linting web, testing shared, building api) run concurrently.
- **Topological ordering:** Dependent packages build in correct order (shared → ui → charts → web).

```json
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "test": { "dependsOn": ["build"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

### Linting: ESLint 9.x (Flat Config)

ESLint flat config lives in `packages/config/eslint/` as a shared preset:
- TypeScript-strict rules via `@typescript-eslint/eslint-plugin`
- React hooks rules via `eslint-plugin-react-hooks`
- Import ordering via `eslint-plugin-import-x`
- Tailwind class sorting via `eslint-plugin-tailwindcss`
- No `any` allowed (enforced by `@typescript-eslint/no-explicit-any`)

### Formatting: Prettier 3.x

Prettier handles all formatting with zero configuration debates:
- Single quotes, no semicolons, 2-space indent (personal preference — configurable)
- Tailwind plugin for class sorting
- Runs on save in VS Code, enforced in CI via `prettier --check`

### Testing

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest 2.x | Indicator calculations, risk math, validation schemas, utility functions |
| Component | React Testing Library 16.x | UI components with user-behavior-focused tests |
| Integration | Vitest + supertest | tRPC routers with mocked database |
| E2E | Playwright 1.x | Full user flows: login → search symbol → place order → verify journal entry |
| Visual | Playwright screenshots | Regression testing for chart rendering and layout consistency |

Vitest is chosen over Jest for ESM-native support, 2-3x faster test execution, and Vite-powered hot module replacement in watch mode.

### Type Checking: TypeScript 5.7+ Strict Mode

All packages use strict TypeScript with these compiler options enforced:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`noUncheckedIndexedAccess` is particularly important for financial data — accessing `candles[i]` returns `Candle | undefined`, forcing explicit null checks that prevent runtime errors on missing data points.

---

## 5. Third-Party Services

| Service | Provider | Tier | Monthly Cost Estimate (at 10K MAU) | Purpose |
|---------|----------|------|-----------------------------------|---------|
| Market Data (primary) | Polygon.io | Developer ($79/mo) | $79 | Real-time SIP data, historical OHLCV, WebSocket streaming |
| Market Data (alt data) | Finnhub | Paid ($49/mo) | $49 | Insider trades, 13F holdings, SEC filings, economic calendar |
| News & Sentiment | Benzinga | Pro ($37/mo) | $37 | Real-time news with sentiment analysis, analyst ratings |
| Authentication | Clerk | Pro | ~$200 | Auth, MFA, session management, user profiles |
| Web Hosting | Vercel | Pro ($20/mo) | $20 | Next.js deployment, edge functions, ISR, preview deploys |
| API Hosting | Railway | Team ($20/seat) | ~$200 | Managed containers for API, workers, databases |
| WebSocket Hosting | Fly.io | Pay-as-you-go | ~$100 | Global edge WebSocket gateway deployment |
| Database | PostgreSQL (Railway) | Included | Included in Railway | Primary relational database |
| Time-Series | TimescaleDB (Railway or self-hosted) | Community | Included in Railway | OHLCV bar storage with continuous aggregates |
| Cache / Pub/Sub | Redis (Railway) | Included | Included in Railway | Hot cache, pub/sub, sessions, BullMQ backend |
| Search | Meilisearch Cloud | Build ($30/mo) | $30 | Symbol search, user search, idea discovery |
| File Storage | Cloudflare R2 | Pay-as-you-go | ~$10 | Chart snapshots, user uploads, strategy bundles |
| CDN | Cloudflare | Free / Pro ($20/mo) | $20 | Static asset CDN, DDoS protection, edge rules |
| Error Tracking | Sentry | Team ($26/mo) | $26 | Error tracking, performance monitoring |
| Monitoring | Grafana Cloud | Free tier | $0 | Custom dashboards for WebSocket metrics, latency |
| Email (transactional) | Resend | Free tier / $20/mo | $0 | Alert emails, notification delivery |
| **Total** | | | **~$771/mo** | |

### Cost Scaling Notes

- **Polygon.io** is the largest variable cost. At 100K MAU, Business plan ($199-$500/mo) is needed for higher rate limits and WebSocket connections. At 1M MAU, Enterprise pricing ($2,000+/mo) applies.
- **Railway** costs scale linearly with compute. Each additional API instance is ~$20-50/month. Database costs depend on storage and compute tier.
- **Clerk** costs $0.02/MAU beyond the plan's included MAU. At 100K MAU: ~$2,000/month. Consider negotiating enterprise pricing above 50K MAU.
- **Fly.io** costs depend on WebSocket connection count. Each machine (~$5/month) handles ~10K connections. At 100K concurrent connections: ~$50/month for 10 machines.
- Revenue model targets: $29/month average for paying users, 8% conversion = $23,200/month revenue at 10K MAU. Infrastructure at $771/month represents 3.3% of revenue — excellent SaaS unit economics.

---

## Sources

Research documents referenced throughout this recommendation:
- `01-market-mechanics.md` — Order types, market structure, settlement
- `02-technical-analysis-charting.md` — Chart types, indicators, drawing tools
- `03-competitive-analysis.md` — TradingView, Bloomberg, ThinkOrSwim, QuantConnect gap analysis
- `04-market-data-infrastructure.md` — Provider evaluation, charting libraries, real-time architecture
- `05-social-trading-community.md` — Social features, copy trading, viral mechanics
- `06-retail-trading-workflows.md` — Day trader / swing trader workflows, screen layouts, scanners
- `07-advanced-instruments-trading.md` — Options, futures, forex, crypto feature requirements
- `08-institutional-requirements.md` — Portfolio risk, compliance, prime brokerage, fund-level features
- `09-algorithmic-quantitative-trading.md` — Strategy IDE, backtesting, ML integration, marketplace
- `10-frontend-ux-design-patterns.md` — Design system, layout, components, performance optimization
