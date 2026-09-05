# MySubs Module Audit

**ID:** subs | **Prefix:** sb_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Subscription cost tracker

## User Value
- Track every recurring subscription with category + price history
- Renewal calendar with upcoming costs
- Cost report across monthly, yearly, and per-category spend
- Detect subscriptions from bank payees (opt-in)
- Compare prices and flag cheaper alternatives

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Subscriptions CRUD | src/db/schema.ts | shipped V1 |
| Categories with seed data | SEED_CATEGORIES | shipped |
| Price history | sb_price_history | shipped |
| Renewal events log | sb_renewal_events | shipped |
| Cancellation actions | sb_cancellation_actions | shipped |
| Price alternatives | sb_price_alternatives | shipped |
| Catalog | sb_catalog | shipped |
| Detected subscriptions (bank sync) | sb_detected_subscriptions V2 | shipped schema |
| Dismissed payees list | sb_dismissed_payees V2 | shipped |
| bank_detected column on subscriptions | V2_ALTER | shipped |
| Dashboard tab | app/(subs)/index.tsx | shipped |
| Subscriptions list | app/(subs)/subscriptions.tsx | shipped |
| Calendar tab | app/(subs)/calendar.tsx | shipped |
| Add / detail / cost-report / detect / compare screens | app/(subs)/* | shipped |

## Data Model
Prefix `sb_`, schema v2. V1 tables: sb_subscriptions, sb_categories (seeded), sb_price_history, sb_renewal_events, sb_cancellation_actions, sb_price_alternatives, sb_catalog. V2 adds sb_detected_subscriptions, sb_dismissed_payees, and bank_detected column.

## Screens / User Flows
Mobile tabs: Dashboard, Subs, Calendar, Settings. Screens: sub-detail, add-sub, cost-report, detect, cancel-detail, compare. Web has matching routes.

## Distinctive / Moat-worthy
- Local-first subscription registry (Rocket Money requires bank linking and sells data)
- 215-entry subscription catalog seeded
- Price alternatives engine flags cheaper swaps without monetized referrals
- V2 schema ready for opt-in Plaid bank sync (infrastructure phase)

## Gaps vs competitors
- No live bank sync yet (Plaid integration pending, schema is ready)
- No automated cancellation concierge (Rocket Money's premium moat)
- No bill negotiation service

## Investor-facing hook
Rocket Money without the 40 percent savings cut, the bank credential harvesting, or the upsell treadmill, just a clean local ledger of what you pay every month.
