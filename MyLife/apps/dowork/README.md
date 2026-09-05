# DoWork

Standalone Expo app for workout tracking, mirroring the BestChef extraction pattern around the `@mylife/workouts` module.

## Quick start

```bash
pnpm install                          # from repo root
pnpm --filter @mylife/dowork-app dev  # boot Expo dev server
```

## Commands

```bash
pnpm typecheck                        # tsc --noEmit
pnpm test                             # vitest
pnpm check:dowork-parity              # from repo root
```

## Layout

See `CLAUDE.md` for full architecture, design tokens, and the relationship to the hub `workouts` module.
