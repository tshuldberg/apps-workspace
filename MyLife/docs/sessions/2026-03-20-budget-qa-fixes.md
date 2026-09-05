# Session: Budget QA Fixes

**Date:** 2026-03-20
**Scope:** MyBudget web module, responsive sidebar, recipes naming
**Commits:** `2174e15`, `77423c0`

## What Was Done

### P0: Deleted 19 broken budget re-export routes
The archived MyBudget standalone left behind 19 route files under `apps/web/app/budget/` that re-exported from `@mybudget-web/...`. Since the standalone was archived, these imports crash with "not a React Component" errors. Deleted all 19 and the old `[[...slug]]` optional catch-all. Budget sub-routes now fall through to the `[...slug]/page.tsx` catch-all with `ModuleWebFallback`.

**Files deleted:** `budget/transactions/page.tsx`, `budget/subscriptions/page.tsx`, `budget/reports/page.tsx`, `budget/goals/page.tsx`, `budget/settings/page.tsx`, `budget/accounts/page.tsx`, `budget/budget/page.tsx`, `budget/debt-payoff/page.tsx`, `budget/upcoming/page.tsx`, and 10 more nested routes.

### P0: Responsive sidebar for mobile viewports
Desktop sidebar was 240px fixed, blocking 64% of a 375px mobile screen. Added:
- `@media (max-width: 768px)` rules in `globals.css` hiding the sidebar and showing a mobile header
- Hamburger menu + slide-out drawer in `Sidebar.tsx` with overlay dismiss
- `data-sidebar`, `data-mobile-header`, `data-main` attributes for CSS targeting
- `layout.tsx` updated with `data-main` on the main element

**Files changed:** `apps/web/app/globals.css`, `apps/web/components/Sidebar.tsx`, `apps/web/app/layout.tsx`

### P1: ModuleWebFallback theme fix
`module-web-fallback.tsx` used hardcoded light colors (`#FFFFFF`, `#4B5563`, `#F9FAFB`). Updated to Cool Obsidian CSS variables: `var(--surface)`, `var(--text)`, `var(--text-secondary)`, `var(--glass)`, `var(--glass-border)`, `var(--border)`.

**File changed:** `apps/web/components/module-web-fallback.tsx`

### P1: Budget accent color mismatch
Catch-all route used `#0F8A5F` instead of the correct budget accent `#22C55E`. Fixed in `apps/web/app/budget/[...slug]/page.tsx`.

### P1: Duplicate "MyGarden" sidebar entries
Both `modules/recipes/src/definition.ts` and `modules/garden/src/definition.ts` had `name: 'MyGarden'`. Changed recipes to `name: 'MyRecipes'`.

**File changed:** `modules/recipes/src/definition.ts`

## Why

QA design review of the MyBudget web module revealed a health score of 4/10 with 14 issues. The P0 issues (broken routes causing 500 errors, sidebar blocking mobile content) made the web app unusable on phones. The P1 issues (wrong theme, wrong accent, duplicate names) degraded visual consistency with the Cool Obsidian design system.

## Verification

- `/budget/transactions` renders fallback correctly, zero console errors
- Mobile viewport: hamburger menu opens/closes drawer, modules listed correctly
- Desktop viewport: sidebar renders correctly, no regressions
- 229 recipes tests passing, 41 module-registry tests passing
- Budget sub-routes all resolve via catch-all

## Remaining (P2/P3, not fixed)

- Home screen button grid density
- No tab bar navigation in mobile budget module
- Duplicated `formatCurrency` across screens
- Hardcoded iconPill background colors
- Reports screen silent error swallowing
- No loading spinners/skeletons
- Settings screen placeholder alerts
