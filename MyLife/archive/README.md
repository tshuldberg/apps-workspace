# Archive

Standalone app repositories that have been consolidated into MyLife hub modules.

## Status

| App | Hub Module | Archived Date | Notes |
|-----|-----------|---------------|-------|
| MyBudget | modules/budget/ | 2026-03-07 | 176 tests, 15 test files, V4 schema, full engine + subscription + bank-sync |
| MyRecipes | modules/recipes/ | 2026-03-08 | 189 tests, 16 test files, V4 schema, collections + nutrition + URL parser + pantry externals |
| MyBooks | modules/books/ | 2026-03-08 | 264 tests, 18 test files, V4 schema, 28 tables, 5 engines + FTS5 + journal encryption |
| MyWorkouts | modules/workouts/ | 2026-03-08 | 284 tests, 16 test files, V3 schema, 11 tables, 8 engines + voice + body map + progress |

## Workflow

1. Complete feature consolidation into `modules/<name>/`
2. Verify all tests pass: `pnpm test`
3. Move standalone directory: `mv <name>/ archive/<name>/`
4. Remove git submodule reference
5. Update this table
