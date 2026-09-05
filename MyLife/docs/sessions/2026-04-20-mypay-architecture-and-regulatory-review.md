# 2026-04-20 MyPay Architecture And Regulatory Review

## Summary

Reviewed `docs/plans/mypay-uiux-mission-control.html`, the current MyLife module architecture, and current official U.S. payments guidance relevant to P2P wallets, remittances, stablecoins, card issuance, and bank-fintech arrangements.

This was a review and readiness pass only. No product code changed.

## Files Reviewed

- `docs/plans/mypay-uiux-mission-control.html`
- `packages/module-registry/src/{types.ts,constants.ts,release-states.ts,index.ts}`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/components/{DatabaseProvider.tsx,EntitlementsProvider.tsx}`
- `apps/web/components/Providers.tsx`
- `apps/web/lib/modules.ts`
- `packages/db/src/{index.ts,hub-queries.ts}`
- `modules/{market,budget,subs,surf,forums,homes}/src/**`
- `apps/web/app/api/{bank/**,webhooks/billing/route.ts}`

## Architecture Findings

1. There is no existing `payments` module in the registry or host apps. Adding it will require updates beyond `types.ts` and `constants.ts`, including release-state arrays, web-supported module lists, cloud-storage deletion handling, host registration, and tests that assert module counts.

2. The mission control P0-A scaffold prompt does not match the live `ModuleDefinition` contract. The repo expects `navigation.tabs[].key` and `navigation.screens[]` objects with `{ name, title }`, while the prompt uses `id` keys and plain screen strings. Implementation must follow the repo contract, not the prompt shorthand.

3. The repo can host cloud-backed modules cleanly. `market`, `forums`, and `surf` already use `storageType: 'supabase'`, and `homes` uses `drizzle`. The best fit is a `modules/payments` package with shared domain code plus server-runtime entrypoints, following the existing `budget` bank-sync and `market` cloud patterns.

4. The mission control Budget integration prompt assumes server-side writes into the user's local SQLite budget store. That is not structurally valid in the current architecture. Budget projection has to happen through a sync or projection layer, not by treating device-local SQLite as a server-writable ledger.

5. Market payments and escrow already exist under `modules/market/src/payments/*`. MyPay should become the system of record for wallet funding, ledger posting, and payment rails, with Market calling into Payments. Duplicating fee, escrow, and dispute logic in both modules would create drift quickly.

6. The repo has examples for webhook verification and idempotency, but not yet for financial-grade reconciliation. Billing webhooks dedupe via a simple preference key, and budget bank-sync has a structured audit logger. MyPay will need stronger primitives: append-only ledger posting, provider event dedupe, reconciliation jobs, compensating actions, and operator-visible audit trails.

7. `supabase/` currently contains only migrations and no serverless function layout. If payments will use webhooks, provider callbacks, or privileged ledger writes, we need to decide early whether the authoritative server surface lives under Next.js API routes, Supabase functions, or both. That boundary is currently undefined.

## Industry And Regulatory Gaps To Cover Before Build

1. Money transmission and MSB scope:
   If MyPay accepts and transmits funds or stablecoin value, it likely triggers money-transmitter and MSB analysis. FinCEN still requires MSB registration within 180 days of establishment and renewal every two years, and stablecoin activity remains under active AML and sanctions scrutiny.

2. Reg E error resolution for P2P:
   P2P flows are not "just chat plus transfers." Unauthorized transfer disputes need a first-class Reg E workflow. Recent CFPB action against Cash App focused on weak fraud handling, poor customer support, and using chargebacks instead of proper EFTA or Regulation E investigations.

3. Remittance rule:
   The international rail is not just a pricing problem. If MyPay sends cross-border consumer transfers, Regulation E Subpart B likely applies, including pre-payment disclosures, receipts, exchange-rate and fee disclosure, cancellation rights, and error resolution. Recent CFPB actions against Sendwave and Wise show this remains an active enforcement area.

4. OFAC and sanctions screening:
   Real-time payments still need sanctions controls. OFAC guidance for instant payment systems explicitly expects risk-based sanctions controls, communication across participants, and exception processing even when the commercial product is fast.

5. Stablecoin-specific compliance:
   As of April 8, 2026, Treasury proposed a rule to implement the GENIUS Act's AML and sanctions requirements for permitted payment stablecoin issuers. Even if MyPay is not the issuer, a stablecoin settlement design now sits in a fast-moving regulatory environment and should be isolated behind provider and compliance abstractions.

6. Deposit insurance and FBO disclosure:
   If user balances sit in partner-bank omnibus accounts, pass-through insurance depends on specific fiduciary and recordkeeping conditions. FDIC guidance and recent bank-fintech statements make this a core architecture issue, not just a legal footnote.

7. Third-party bank partnership governance:
   FDIC, FRB, and OCC reminded banks on July 25, 2024 that deposit and payments partnerships with fintechs raise safety, soundness, compliance, and consumer risks. MyPay will need explicit ownership for partner-bank reporting, oversight, and incident response.

8. Travel rule and cross-border recordkeeping:
   International and multi-rail payments need originator and recipient data to move with the transaction where applicable. The architecture should reserve fields and event envelopes for this now.

9. Merchant and seller compliance:
   Merchant QR, Market checkout, and seller payouts introduce KYB, merchant underwriting, payout risk, reserves, and possible tax reporting obligations such as Form 1099-K workflows.

10. Card and payment data scope:
   Debit card issuance and wallet funding flows should avoid unnecessary PCI scope expansion. PAN, CVV, and sensitive auth data should stay with the issuer or processor whenever possible. PCI DSS current versions remain active through the PCI SSC document library, so card surfaces must be designed token-first.

11. Outage and custody risk:
   CFPB consumer guidance continues to warn that payment app balances may not be protected like bank deposits and that outages create access and fraud risk. The architecture needs an outage mode, payout hold strategy, and clear stored-balance disclosures from day one.

## Recommended Initial Build Shape

1. Keep `modules/payments` as the shared package consumed by mobile, web, and server routes.
2. Inside it, split code into:
   - `definition.ts`
   - `types.ts`
   - `engine/` for transfer FSM, fee policy, ledger posting rules
   - `providers/` for Unit, stablecoin, and future rail adapters
   - `risk/` for velocity, sanctions checkpoints, fraud flags
   - `compliance/` for disclosure payloads, remittance policy, audit/event schemas
   - `cloud/` for privileged data access and projections
   - `ui/` for module tokens and shared screens
3. Add server entrypoints similar to existing bank-sync runtime patterns, not provider logic directly in route handlers.
4. Start hidden in release-state arrays until the compliance surface and operator tooling exist.
5. Treat Budget, Market, RSVP, and Dining integrations as event-driven projections, not direct cross-module writes into each other's storage.

## External Sources Reviewed

- CFPB larger participant rule for digital consumer payment applications, November 21, 2024
- CFPB Electronic Fund Transfers FAQs
- CFPB Regulation E remittance definitions and Circular 2024-02
- CFPB enforcement actions and orders involving Block/Cash App, Sendwave, and Wise
- FinCEN MSB registration guidance
- FinCEN travel rule guidance
- FinCEN and OFAC proposed GENIUS Act AML/sanctions rule, April 8, 2026
- OFAC Sanctions Compliance Guidance for Instant Payment Systems
- FDIC pass-through insurance disclosure guidance
- FDIC, FRB, and OCC joint statement on bank-fintech deposit arrangements, July 25, 2024
- PCI SSC FAQ on the current version of PCI DSS

## Verification

- Opened `docs/plans/mypay-uiux-mission-control.html` in the browser.
- Reviewed code and docs locally.
- No function logic changed, so `pnpm gate:function:changed` was not run.
