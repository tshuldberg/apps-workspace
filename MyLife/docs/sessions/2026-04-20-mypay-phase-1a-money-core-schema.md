# MyPay Phase 1A: authoritative money core schema

Date: 2026-04-20

## Summary

Built Phase 1A for MyPay by adding the first authoritative Supabase money core:

- module-local payments cloud schema with immutable ledger rules
- privileged write RPC surface for wallet creation, transfer posting, reversal, and provider-event ingest
- matching Supabase migration for deployable schema rollout
- typed RPC name and input surface in the payments package

## Why this shape

Phase 0 established `payments` as a hidden server-authoritative module. Phase 1A needed to make that real at the data layer:

- Supabase/Postgres is now the authoritative ledger boundary.
- Client access is read-only through RLS owner policies.
- Money-moving writes are defined as privileged server functions instead of client table writes.
- Provider events are normalized into `pay_provider_events` before later orchestration phases mutate business state.

I kept both a module-local `schema.sql` and a migration mirror. I considered using an include-style migration that referenced the module schema directly, but I did not have a verified local guarantee that this repo's Supabase migration execution path supports that safely, so I used plain SQL in the migration to keep deployment assumptions explicit.

## Files changed

- `modules/payments/src/cloud/schema.sql`
- `modules/payments/src/cloud/rpc.ts`
- `modules/payments/src/cloud/index.ts`
- `modules/payments/src/cloud/__tests__/schema.test.ts`
- `supabase/migrations/20260420000003_add_payments_core.sql`

## Schema contents

Tables added in the payments schema:

- `pay_wallets`
- `pay_wallet_balances`
- `pay_ledger_entries`
- `pay_transfers`
- `pay_transfer_events`
- `pay_payment_requests`
- `pay_identities`
- `pay_contacts`
- `pay_linked_accounts`
- `pay_funding_intents`
- `pay_payout_intents`
- `pay_cards`
- `pay_card_transactions`
- `pay_disputes`
- `pay_remittance_quotes`
- `pay_remittances`
- `pay_provider_events`
- `pay_compliance_cases`

Core enforcement added:

- append-only trigger protection on `pay_ledger_entries`
- append-only trigger protection on `pay_transfer_events`
- cached wallet-balance updates derived from ledger inserts
- provider-event dedupe with unique `(provider_name, provider_event_id)`
- owner-read RLS across wallet, transfer, request, dispute, remittance, compliance, and ledger surfaces

## RPC surface

Privileged write functions added:

- `pay_create_wallet`
- `pay_post_transfer`
- `pay_reverse_transfer`
- `pay_record_provider_event`

TypeScript exports for those names and payload shapes live in `modules/payments/src/cloud/rpc.ts`.

## Verification

Passed:

- `pnpm --filter @mylife/payments test`
- `pnpm --filter @mylife/payments exec tsc --noEmit`
- schema and migration mirror diff after stripping the migration header comment

Blocked outside Payments:

- `pnpm gate:function:changed`

The required repo-wide gate still fails in unrelated mobile lint due to:

- `apps/mobile/app/(notes)/discovery 2.tsx`
- `react-hooks/rules-of-hooks`
- `React Hook "useMemo" is called conditionally`

That blocker predates this Phase 1A work and still prevents the shared gate from going green.

## Remaining next step

Phase 1B should now build on this schema with:

- ledger/domain engine
- explicit transfer FSM
- stable domain error codes
- idempotent command handling over the new write surface
