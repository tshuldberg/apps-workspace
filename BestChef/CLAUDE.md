# BestChef

Standalone Expo app for the BestChef competitive recipe platform. "Find the best recipe for every dish."

## Overview

BestChef is the standalone surface for the `recipes` MyLife hub module. It focuses on the social/competitive layer: dish browsing, recipe submissions, community voting, leaderboards, chef profiles, and the creator program. Local recipe management (CRUD, pantry, meal planning) lives in the hub module.

## Stack

- **Runtime:** Expo (React Native), Expo Router v4
- **Language:** TypeScript (strict, no `any`)
- **UI:** Obsidian Noir dark theme, #22C55E green accent, Plus Jakarta Sans
- **Packages:** `@mylife/bestchef` (business logic), `@mylife/social`, `@mylife/ui`, `@mylife/db`

## Architecture

```
BestChef/
  app/
    _layout.tsx          # Root Stack navigator + StatusBar
    (tabs)/
      _layout.tsx        # Bottom tab bar (5 tabs)
      index.tsx          # Home - feed, stats, trending, submit CTA
      dishes.tsx         # Dish browser - search, category/cuisine filters
      leaderboard.tsx    # Global leaderboard - top, trending, by category
      profile.tsx        # Chef profile - stats, badges, signature dishes
      settings.tsx       # Delivery zip, chef defaults, creator link, about
  assets/
  app.json
  package.json
  tsconfig.json
```

## Key Commands

```bash
pnpm dev        # Start Expo dev server
pnpm build      # Export for production
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest run
```

## Design Tokens

- Background: `#131318`
- Tab bar: `#0E0E13`
- Accent: `#22C55E`
- Secondary: `#C9894D` (warm gold)
- Surface tiers: `#0E0E13`, `#131318`, `#1B1B20`, `#2A292F`, `#35343A`
- Glass cards: `rgba(255, 255, 255, 0.03)` fill, `rgba(255, 255, 255, 0.06)` border
- Text: `#E4E1E9` primary, `rgba(214, 195, 181, 0.6)` secondary

## Relationship to Hub Module

- Module ID: `recipes` (in `@mylife/bestchef`)
- The standalone app imports business logic from `@mylife/bestchef`
- Hub module owns local recipe CRUD, pantry, meal planning, shopping lists
- Standalone app focuses on cloud-powered social features
- Both share design tokens from `@mylife/bestchef/ui/tokens`

## Git Conventions

- Branch naming: `feature/`, `fix/`, `refactor/`, `docs/`
- Commit format: Conventional Commits

## Writing Style

- Do not use em dashes in documents or writing
