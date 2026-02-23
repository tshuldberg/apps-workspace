# CLAUDE.md — MyBooks

## Overview

Privacy-first book tracking app for iOS, Android, and web. Manage your personal library, reading lists (TBR/reading/finished), private ratings and reviews, reading stats and goals, and year-in-review — all stored locally in SQLite. Book metadata powered by Open Library API (Internet Archive). No accounts, no cloud, no telemetry. Your reading habits stay on your device.

## Stack

- **Language:** TypeScript everywhere
- **Mobile:** Expo (React Native) — iOS + Android from single codebase
- **Web:** Next.js 15 (App Router, Turbopack)
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web/desktop)
- **Book Metadata:** Open Library API (Internet Archive) — free, no API key
- **Barcode Scanning:** `expo-camera` + `expo-barcode-scanner` (mobile), `html5-qrcode` (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm 9.x
- **Validation:** Zod 3.24
- **Testing:** Vitest
- **License:** FSL-1.1-Apache-2.0

## Key Commands

```bash
pnpm install             # Install all dependencies
pnpm build               # Build all packages and apps
pnpm dev                 # Dev mode for all (Turborepo)
pnpm dev:mobile          # Expo mobile only
pnpm dev:web             # Next.js web only
pnpm test                # Run all tests (Vitest)
pnpm typecheck           # Type check all
pnpm lint                # Lint all
pnpm clean               # Clean build artifacts
```

## Architecture

Turborepo monorepo with the following structure:

```
MyBooks/
├── apps/
│   ├── mobile/              # Expo (React Native) — iOS + Android
│   │   ├── app/             # Expo Router file-based routing
│   │   │   ├── (tabs)/      # 5-tab navigator (Home, Library, Search, Stats, Settings)
│   │   │   ├── book/        # Book detail and add screens
│   │   │   ├── shelf/       # Shelf view
│   │   │   └── scan.tsx     # Barcode scanner
│   │   ├── components/      # Mobile-specific components
│   │   └── assets/
│   └── web/                 # Next.js 15 — Web + Desktop
│       ├── app/             # App Router pages
│       ├── components/      # Web-specific components
│       └── public/
├── packages/
│   ├── shared/              # Business logic (shared across platforms)
│   │   └── src/
│   │       ├── types/       # Zod schemas: Book, Shelf, ReadingSession, Review, Goal, Tag
│   │       ├── db/          # SQLite schema, migrations, queries (11 tables + FTS5)
│   │       ├── models/      # Model layer (CRUD operations per entity)
│   │       ├── api/         # Open Library API client (search, ISBN lookup, covers)
│   │       ├── import/      # Goodreads/StoryGraph CSV parser
│   │       ├── export/      # CSV/JSON/Markdown export
│   │       ├── search/      # FTS5 query builder for local search
│   │       ├── stats/       # Reading stats computation, goal tracking
│   │       └── year-review/ # Year-in-review data aggregation
│   ├── ui/                  # Shared UI components + theme
│   │   └── src/
│   │       ├── theme/       # Design tokens (literary dark theme)
│   │       ├── book/        # BookCard, BookCover, BookGrid, BookList
│   │       ├── rating/      # StarRating (half-star), RatingDistribution
│   │       ├── shelves/     # ShelfPicker, ShelfGrid, ShelfBadge
│   │       ├── stats/       # ReadingGoalRing, MonthlyChart, YearHeatmap
│   │       └── search/      # SearchBar, SearchResults, ISBNInput
│   ├── eslint-config/       # Shared ESLint configuration
│   └── typescript-config/   # Shared TypeScript configuration
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Key Patterns

- **Local-first:** All user data in SQLite. The only network traffic is to `openlibrary.org` and `covers.openlibrary.org`.
- **Shared business logic:** `packages/shared` contains all models, DB operations, API client, import/export, stats, and search logic — shared by both mobile and web apps.
- **Cross-platform UI:** `packages/ui` provides theme tokens and reusable components used by both apps.
- **FTS5 search:** Full-text search on book title, subtitle, authors, and subjects for fast local library search.
- **Open Library API:** Free, no-auth API from Internet Archive. Responses cached in `ol_cache` table to minimize network calls.

## Git Workflow

- **Commit format:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`)
- **Branch naming:** `feature/`, `fix/`, `refactor/`, `docs/` prefixes
- **Merge strategy:** Squash merge to `main`
- **Change tracking:** Update `timeline.md` after every development session

## Testing

- **Framework:** Vitest for all packages
- **Test location:** Co-located `__tests__/` directories within each package
- **File convention:** `*.test.ts` for unit tests
- **Coverage target:** Business logic in `packages/shared` must have tests for all model CRUD operations, import parsing, export formatting, stats computation, and API client response handling
- **Run tests:** `pnpm test` (all) or `pnpm test --filter=@mybooks/shared` (shared only)

## Code Style

- TypeScript strict mode everywhere
- Zod schemas as the source of truth for all data types (infer TS types from Zod)
- Prefer named exports over default exports
- Use `Inter` for UI text, `Literata` for book-related display text (titles, reviews)
- CSS: Use design tokens from `packages/ui/src/theme/` — never hardcode hex colors

## Environment Setup

```bash
# Prerequisites
node >= 20
pnpm >= 9.15.0

# Install
pnpm install

# Development
pnpm dev           # All apps
pnpm dev:mobile    # Mobile only (requires Expo Go or simulator)
pnpm dev:web       # Web only (localhost:3000)
```

## File Ownership Zones (Parallel Agent Work)

| Zone | Owner | Files |
|------|-------|-------|
| Root configs | lead | `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |
| DB + Models | data-dev | `packages/shared/src/db/`, `packages/shared/src/models/` |
| API + Engines | engine-dev | `packages/shared/src/api/`, `packages/shared/src/import/`, `packages/shared/src/export/`, `packages/shared/src/search/`, `packages/shared/src/stats/`, `packages/shared/src/year-review/` |
| UI Package | ui-dev | `packages/ui/` |
| Mobile App | mobile-dev | `apps/mobile/` |
| Web App | web-dev | `apps/web/` |
| Tests | tester | `**/__tests__/` |
| Docs | docs-dev | `CLAUDE.md`, `README.md`, `timeline.md`, `DESIGN.md` |

## Important Notes

- **Privacy is non-negotiable.** Zero analytics, zero telemetry, zero crash reporting SDKs, zero ad SDKs. The only network calls are to Open Library API (`openlibrary.org`).
- **Dark theme only** for MVP. The literary dark theme (warm near-black `#0E0C09` background, cream `#F4EDE2` text, amber-gold `#C9894D` accent) is the brand identity.
- **$4.99 one-time purchase.** No subscriptions, no ads, no IAP upsells.
- **FSL-1.1-Apache-2.0 license.** Source-available so users can audit the privacy claims.
- **No Amazon dependency.** All book metadata from Open Library (Internet Archive). No Amazon product IDs, affiliate links, or tracking pixels.
- **Offline-first.** All metadata cached locally after first fetch. The entire library is browsable offline.
- **Half-star ratings.** 0.5 to 5.0 in 0.5 increments — the most requested Goodreads feature.
