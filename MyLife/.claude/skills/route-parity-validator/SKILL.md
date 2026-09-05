---
name: route-parity-validator
description: >-
  Validates that mobile and web route structures match for each MyLife hub
  module. Extracts route names from Expo (mobile) and Next.js (web), diffs
  them, and reports mismatches including orphaned routes, missing routes,
  and naming inconsistencies. Use when asked to validate routes, check route
  parity, compare mobile and web navigation, or verify module routing is
  consistent. Do NOT use for standalone/hub parity (use parity-check or
  parity-remediation).
allowed-tools: Read, Glob, Grep, LSP, Bash(git:*)
---

# Route Parity Validator

You verify that mobile and web route structures match for each module in the
MyLife hub.

## Step 1: Extract Mobile Routes

Read `apps/mobile/app/_layout.tsx` to find module route groups.
For each registered module, extract:
- Tab routes (from `ModuleDefinition.navigation.tabs`)
- Screen routes (from `ModuleDefinition.navigation.screens`)
- Route paths and labels

Also glob for route files:
```
apps/mobile/app/(modules)/<module>/**/*.tsx
```

## Step 2: Extract Web Routes

Glob for web route files per module:
```
apps/web/app/<module>/**/*.tsx
apps/web/app/<module>/**/page.tsx
apps/web/app/<module>/**/layout.tsx
```

For passthrough modules (books, habits, words, workouts), also check the
standalone alias imports.

## Step 3: Compare Structures

For each module, build a comparison table:

```markdown
| Route | Mobile | Web | Status |
|-------|--------|-----|--------|
| /home | Tab (Home) | page.tsx | MATCH |
| /detail/[id] | Screen (Detail) | [id]/page.tsx | MATCH |
| /settings | Screen (Settings) | -- | MOBILE ONLY |
| /analytics | -- | analytics/page.tsx | WEB ONLY |
```

Classify mismatches:
- `MOBILE_ONLY`: route in mobile but not web
- `WEB_ONLY`: route in web but not mobile
- `NAME_MISMATCH`: same route, different labels
- `PATH_MISMATCH`: same screen, different URL structure
- `MATCH`: both sides aligned

## Step 4: Report

Output a per-module parity report:

```markdown
## Route Parity Report -- YYYY-MM-DD

### Summary
- X modules analyzed
- Y routes total
- Z mismatches found

### Module: [name]
[comparison table]
[mismatch details with file paths]
```

## Step 5: Suggest Fixes

For each mismatch, suggest:
- Which side to add the missing route to
- Whether it should be a passthrough wrapper (web) or a full screen (mobile)
- The file path and content template

## Example

**User says:** "Do the books routes match between mobile and web?"

**Skill does:**
1. Reads books ModuleDefinition: 5 tabs (Home, Library, Search, Stats, Settings)
2. Globs web routes: finds /books, /books/library, /books/search, /books/stats -- missing /books/settings
3. Reports: 1 mismatch (settings is MOBILE_ONLY)
4. Suggests: create `apps/web/app/books/settings/page.tsx` passthrough wrapper

**Result:** Route parity report showing 4/5 routes match, 1 gap identified with fix.
