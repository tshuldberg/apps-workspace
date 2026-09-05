# YNAB vs MyBudget: Competitor Review Plan

**Module:** MyBudget (`modules/budget/`, `apps/mobile/app/(budget)/`)
**Competitor:** YNAB iOS app
**Recording:** /tmp/budget-review.mp4 (7.4min, 221 frames at 0.5fps)
**Date:** 2026-03-29
**Current state:** 38 mobile screens, 48 DB tables, 50 engines

## 4-Phase Pipeline

### Phase 1: Analyze (no code)
- View all 221 frames in batches of 10
- Catalog every YNAB feature by category
- Create labeled screenshots under docs/competitor-analysis/ynab-screens/labeled/

### Phase 2: Plan (no code)
- Write docs/competitor-analysis/ynab-vs-mybudget.md (40+ feature points)
- Cross-reference against DESIGN-mybudget-feature-gaps.md
- Check modules/budget/src/index.ts for types/exports
- Check apps/mobile/package.json for deps
- Create task list with effort estimates

### Phase 3: Build (P0 then P1)
- Read target files BEFORE editing
- Use camelCase matching module types
- Typecheck after EACH file
- Add new screens to hamburger menu in apps/mobile/app/(budget)/index.tsx
- ACCENT = colors.modules.budget, Card, spacing tokens

### Phase 4: Ship
- Full typecheck, commit, push
- Update comparison doc with resolution status

## Key YNAB Features to Watch For
- "Give Every Dollar a Job" envelope assignment UX
- Targets (monthly goals per category)
- Age of Money metric
- Net worth tracking
- Reports (spending trends, net worth, income vs expense)
- Bank connection (Plaid)
- Credit card payment handling
- Reconciliation flow
- Multi-month budget view
- Category group organization
- Overspending indicators (red/yellow)
- "Ready to Assign" balance concept
- Loan tracking with interest
- Partner sharing
