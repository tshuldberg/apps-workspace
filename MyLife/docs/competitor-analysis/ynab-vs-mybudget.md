# YNAB vs MyBudget Competitor Analysis

**Date:** 2026-03-29
**Source:** Screen recording analysis of YNAB iOS app (current version)
**Scope:** Feature-by-feature comparison against MyBudget module (`modules/budget/`) and mobile app (`apps/mobile/app/(budget)/`)

## Summary

YNAB is the gold standard for envelope budgeting apps with 10+ years of refinement. Its strengths are a polished onboarding wizard that personalizes the experience, a "Plan" tab that shows grouped categories with per-category targets and progress bars, a "Reflect" tab with spending breakdown and net worth charts, and a streamlined transaction review flow. MyBudget already has a surprisingly deep feature set -- envelope CRUD, category groups, budget allocations, transaction rules, net worth tracking, Age of Money, spending heatmap, weekly digest, debt payoff, loan planner, investments, family sharing, and expense splitting -- many of which YNAB does not offer. However, MyBudget is missing several high-visibility YNAB features: an interactive onboarding wizard (current one is basic), a plan tab with month selector and category progress bars, per-category targets (weekly/monthly/yearly), a spending review badge, and a consolidated "Reflect" dashboard. Closing these gaps will make MyBudget feel like a credible YNAB alternative while retaining its privacy-first and feature-rich advantages.

---

## Feature-by-Feature Comparison

| # | YNAB Feature | MyBudget Has It? | Notes |
|---|---|---|---|
| 1 | Marketing splash with financial worry bubbles | NO | Onboarding exists but starts with a plain welcome screen |
| 2 | "Give Every Dollar a Job" interactive tutorial | NO | No interactive balance assignment tutorial |
| 3 | Attribution survey ("how did you hear about us") | NO | Not needed for privacy-first app |
| 4 | Testimonial/social proof screen ("92% less stress") | NO | Not applicable |
| 5 | Home situation selection (rent/own/other) | NO | Onboarding does not personalize by housing |
| 6 | Debt type selection (credit card, auto, student, BNPL) | NO | Onboarding does not ask about debt |
| 7 | Transportation mode selection | NO | Onboarding does not ask about transport |
| 8 | Regular spending category picker | PARTIAL | Onboarding has 10 suggested categories but not personalized by prior answers |
| 9 | Less-frequent expense planning (annual fees, medical, taxes) | NO | No "true expenses" concept in onboarding |
| 10 | Savings goal selection (vacation, car, home, wedding, etc.) | NO | Goals exist but not prompted in onboarding |
| 11 | Lifestyle categories with "no shame" framing | NO | No emotional framing in onboarding |
| 12 | Auto-generated category list from onboarding answers | NO | Categories are a flat selection, not derived from answers |
| 13 | Per-category targets: weekly/monthly/yearly/custom | NO | Envelopes have `monthly_budget` only -- no target frequency or due date |
| 14 | Target amount with due date and rollover config | PARTIAL | Envelopes have `monthly_budget` and `rollover_enabled` but no due dates or flexible frequency |
| 15 | Monthly Targets vs Monthly Income progress bars | NO | No income-vs-targets progress visualization |
| 16 | Category icons (emoji) per category | YES | Envelopes support `icon` field with emoji |
| 17 | Onboarding checklist (free trial, personalize, add accounts) | NO | No post-setup checklist |
| 18 | Pinned categories for quick access on Home | NO | Home shows flat envelope list, no pinning |
| 19 | "Current Goal" progress widget on Home | NO | Goals screen exists but no home widget |
| 20 | Monthly Summary (Total Targets, Underfunded, Assigned, Spent) | PARTIAL | Home shows Total Monthly budget and Spending Pulse, but not Underfunded/Assigned breakdown |
| 21 | "Assigned in Future Months" (month-ahead budgeting) | NO | No forward-month allocation view |
| 22 | "For You" educational content (podcasts, blog, videos) | NO | Not planned (privacy-first approach) |
| 23 | Month selector with left/right navigation on Plan tab | NO | No plan tab; envelopes shown in flat list |
| 24 | Category groups (Bills, Needs, Wants, Goals) with collapse/expand | PARTIAL | CategoryGroup schema and CRUD exist in engine but no grouped UI on home/plan |
| 25 | "Available to Spend" column per category | NO | No per-envelope remaining balance display |
| 26 | "$X more needed by Yth" progress per category with colored bars | NO | No per-category target progress bars |
| 27 | "Add Target" button per category | NO | No per-envelope target configuration UI |
| 28 | Transaction review badge ("Review 2 Transactions") | NO | No unreviewed transaction concept or badge |
| 29 | Categorized transaction list with merchant + amount | YES | Transactions screen shows direction, amount, payee, envelope |
| 30 | Spending Breakdown (horizontal stacked bar + category list) | YES | Reports screen has envelope spending breakdown with progress bars |
| 31 | Income vs Spending chart | PARTIAL | Reports screen shows Income vs Spending numbers but no chart visualization |
| 32 | Net Worth chart | YES | Net Worth screen with SVG timeline chart |
| 33 | Age of Money metric | YES | Dedicated Age of Money screen with trend + bar chart |
| 34 | Bank connection with popular bank logos | PARTIAL | Bank sync module exists (Plaid integration) but no dedicated accounts connection screen with bank logos |
| 35 | "Add an Unlinked Account" for manual tracking | YES | Account creation supports manual accounts (checking, savings, credit, cash) |
| 36 | In-app Knowledge Base with searchable help articles | NO | No in-app help system |

---

## Where MyBudget EXCEEDS YNAB

MyBudget has significant features that YNAB does not offer:

| Feature | MyBudget | YNAB |
|---|---|---|
| Subscription Catalog (215 entries) | YES | NO |
| Subscription ROI Scoring | YES | NO |
| Renewal Calendar | YES | NO |
| Spending Heatmap (calendar view) | YES | NO |
| Weekly Digest | YES | NO |
| No-Spend Day Streaks | YES | NO |
| Debt Payoff Planner (snowball/avalanche) | YES | NO (basic) |
| Loan Amortization Planner | YES | NO |
| Investment Tracker (holdings, allocation) | YES | NO |
| Family Sharing | YES | NO |
| Expense Splitting | YES | NO |
| Transaction Rules (auto-categorize) | YES | Basic |
| Receipt OCR Scanning | YES | NO |
| CSV Import Profiles | YES | NO |
| Budget Alerts (threshold-based) | YES | NO |
| Cash Flow Analysis | YES | NO |
| Multi-Currency Support | YES | NO |
| Cross-Module Insights (budget x habits) | YES | NO |
| Spending Pulse (hero metric) | YES | NO |
| Payday Detection | YES | NO |
| Privacy-First (no telemetry) | YES | NO |
| Offline-First (all local SQLite) | YES | NO |

---

## Gap Analysis: Priority Tiers

### P0 -- Must Have (YNAB core differentiators users expect)

| # | Gap | Effort | Screen/File |
|---|---|---|---|
| G1 | Plan Tab: month selector with grouped categories, assigned/available columns, progress bars | Large | `plan-tab.tsx` |
| G2 | Per-Category Targets: weekly/monthly/yearly frequency, target amount, due date | Medium | `category-target.tsx` + schema |
| G3 | Home Monthly Summary: Total Targets, Underfunded, Assigned, Spent widget | Small | Update `index.tsx` |
| G4 | Onboarding Enhancement: debt type, savings goals, housing, auto-generate categories | Medium | Update `onboarding.tsx` |

### P1 -- Should Have (polishes user experience)

| # | Gap | Effort | Screen/File |
|---|---|---|---|
| G5 | Pinned Categories on Home | Small | Update `index.tsx` |
| G6 | Current Goal progress widget on Home | Small | Update `index.tsx` |
| G7 | Onboarding Checklist (post-setup guidance) | Small | `checklist.tsx` |
| G8 | Transaction Review Badge + unreviewed concept | Medium | `review-transactions.tsx` |
| G9 | Income vs Spending chart (visual, not just numbers) | Small | Update `reports.tsx` |
| G10 | "Assigned in Future Months" view | Medium | `future-months.tsx` |

### P2 -- Nice to Have (lower impact)

| # | Gap | Effort | Screen/File |
|---|---|---|---|
| G11 | Bank connection screen with popular bank logos | Medium | Deferred (needs Plaid keys) |
| G12 | Emotional onboarding copy ("no shame, no guilt") | Small | Copy change |
| G13 | "For You" educational content feed | Large | Out of scope (privacy) |
| G14 | In-app Knowledge Base | Large | Deferred |

### Out of Scope

- **G3 (Attribution survey):** Not relevant for privacy-first app
- **G4 (Testimonial screen):** Marketing, not product
- **G13 (Educational content feed):** Conflicts with no-telemetry philosophy
- **G14 (Knowledge Base):** Large effort, low differentiator

---

## Screenshot Reference

Labeled YNAB screenshots organized by section:

```
docs/competitor-analysis/ynab-screens/labeled/
  01-onboarding/    -- frames 001-011 (wizard steps)
  02-plan-setup/    -- frames 012-015 (auto-generated categories, targets)
  03-home/          -- frames 016-021 (checklist, pinned, goals, summary)
  04-plan-tab/      -- frames 022-026 (month selector, groups, progress)
  05-spending/      -- frames 027-028 (review badge, transaction list)
  06-reflect/       -- frames 029-033 (breakdown, income/spending, net worth, AoM)
  07-accounts/      -- frames 033-034 (bank connection, manual accounts)
```

---

## Implementation Notes

- Per-category targets (G2) require a schema change: adding `target_frequency`, `target_amount`, `target_due_day` to the envelopes table or a separate targets table. The existing `BudgetAllocation` schema already supports monthly allocation tracking, so the plan tab (G1) can build on `getAllocationsForMonth` and `getActivityByEnvelope`.
- The CategoryGroup system is already built (`createCategoryGroup`, `getCategoryGroups`, `getEnvelopesByGroup`) but has no grouped UI. G1 surfaces this.
- For G8 (transaction review), we can add a `reviewed` boolean to the transactions schema or use an in-memory filter on recent bank-synced transactions.
- G10 (future months) leverages the existing `allocateToEnvelope` function with future month strings.
