# MyPay — Module Audit

**ID:** payments | **Prefix:** pay_ | **Tier:** premium | **Storage:** supabase
**Mobile wired:** yes (7 routes) | **Web wired:** partial (1 route) | **Version:** 0.1.0
**One-line promise:** Wallet, transfers, and money controls

## User Value
- Wallet dashboard with activity, cards, and protection controls
- Send + request money + cash out flows
- Add funding source + transaction detail + disputes
- Remittance quote + confirm flow with compliance review step
- FSM-backed payment lifecycle with idempotency + reconciliation + audit

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Module definition (tabs + screens + auth + network) | src/definition.ts | shipped |
| Payment types (amount, direction, status, rail, verification) | src/types.ts | shipped |
| Payment timeline + disclosure schemas | src/types.ts | shipped |
| Engine: availability + fees + FSM + idempotency + ledger + errors | src/engine | shipped |
| Ops: audit + breaks + reconciliation + replay | src/ops | shipped |
| Providers: factory + fake + sandbox + live + helpers | src/providers | shipped |
| Cloud: config + RPC + runtime + fake provider + schema.sql | src/cloud | shipped |
| UI barrel | src/ui | shipped |
| Test fixtures | src/test | shipped |
| No CLAUDE.md, no src/db/ or src/engine/crud.ts — storage is cloud-only via Supabase RPC | — | by design |

## Data Model
Prefix `pay_`, cloud-only (`storageType: 'supabase'`). No local SQLite migrations in the module (the module exposes no `migrations` array in its `ModuleDefinition`). Canonical state lives in Supabase via `src/cloud/schema.sql` + RPC; client interacts through the provider abstraction (fake/sandbox/live).

## Screens / User Flows
Mobile tabs: Wallet, Activity, Cards, Protect, Settings. Stack screens: send-money, request-money, cash-out, add-funding-source, transaction-detail, dispute-center, dispute-detail, remittance-quote, remittance-confirm, compliance-review. 7 mobile route files. Web has a single route (placeholder). `requiresAuth: true`, `requiresNetwork: true`.

## Distinctive / Moat-worthy
- Finite-state-machine + idempotency + ledger + reconciliation + replay architecture — bank-grade operational controls rarely found in consumer wallet code
- Explicit disclosure schema (PaymentDisclosureTone/PaymentDisclosureSchema) suggests a regulated-UX approach
- Provider factory supports fake/sandbox/live cleanly — critical for Unit BaaS-style rail swaps (see mypay_design_mission_control)

## Gaps vs competitors
- Web surface is one route; mobile flows are not yet fully wired to a real provider (fake/sandbox exist)
- No P2P network effects — cold start risk is highest in this module
- No verified KYC/AML UI completeness despite compliance-review screen existing
- No card issuance, no stablecoin rail verified shipped despite mission-control design spec

## Investor-facing hook
The payments rail for the MyLife suite: FSM-backed, reconciliation-ready, and built to swap between Unit BaaS and stablecoin rails without touching the UI.
