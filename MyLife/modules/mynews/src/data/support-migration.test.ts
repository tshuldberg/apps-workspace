import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260712000007_mynews_support_rails.sql'),
  'utf8',
);
const functionConfig = readFileSync(
  join(__dirname, '../../../../supabase/config.toml'),
  'utf8',
);

describe('20260712000007 MyNews support rails', () => {
  it('creates all four finance tables with RLS enabled', () => {
    for (const table of [
      'nw_support_ledger',
      'nw_payment_events',
      'nw_payout_accounts',
      'nw_support_receipts',
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('pins the complete ledger kind vocabulary and unique idempotency key', () => {
    for (const kind of [
      'charge',
      'platform_fee',
      'refund',
      'dispute_hold',
      'dispute_release',
      'payout',
      'payout_reversal',
    ]) {
      expect(migration).toContain(`'${kind}'`);
    }
    expect(migration).toContain('idempotency_key text not null unique');
    expect(migration).toContain('nw_support_ledger is append-only');
  });

  it('allows each party to read its rows while exposing no client write policy', () => {
    expect(migration).toContain('create policy nw_support_ledger_supporter_select');
    expect(migration).toContain('create policy nw_support_ledger_journalist_select');
    expect(migration).toContain('create policy nw_support_receipts_supporter_select');
    expect(migration).not.toContain('create policy nw_support_receipts_journalist_select');
    expect(migration).not.toMatch(/create policy nw_(support|payment|payout).*\n\s+for (insert|update|delete|all)/i);
  });

  it('keeps raw events and provider account refs service-role-only', () => {
    expect(migration).toContain(
      'revoke all on table public.nw_payment_events from public, anon, authenticated',
    );
    const payoutGrant = migration.slice(
      migration.indexOf('grant select (\n  journalist_profile_id'),
      migration.indexOf(') on public.nw_payout_accounts to authenticated'),
    );
    expect(payoutGrant).not.toContain('provider_account_ref');
    const ledgerGrant = migration.slice(
      migration.indexOf('grant select (\n  id,\n  journalist_profile_id'),
      migration.indexOf(') on public.nw_support_ledger to authenticated'),
    );
    expect(ledgerGrant).not.toContain('supporter_profile_id');
    expect(migration).toContain('grant select, insert, update on public.nw_payment_events to service_role');
  });

  it('applies each verified provider event through one locked transactional RPC', () => {
    expect(migration).toContain('create or replace function public.nw_apply_payment_event');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public');
    expect(migration).toContain('on conflict (provider, provider_event_id) do nothing');
    expect(migration).toContain("return 'duplicate'");
    expect(migration).toContain(
      'revoke all on function public.nw_apply_payment_event(text, text, text, jsonb, timestamptz)',
    );
    expect(migration).toContain('to service_role');
  });

  it('maps charges, refunds, disputes, payouts, and payout accounts', () => {
    for (const event of [
      'payment_succeeded',
      'payment_refunded',
      'dispute_created',
      'dispute_resolved',
      'payout_paid',
      'payout_failed',
      'payout_account_updated',
    ]) {
      expect(migration).toContain(`'${event}'`);
    }
    expect(migration).toContain('gross_cents = platform_fee_cents + journalist_net_cents');
    expect(migration).toContain('refund-exceeds-charge');
  });

  it('lets signed provider webhooks reach HMAC verification but keeps support JWT-gated', () => {
    expect(functionConfig).toMatch(
      /\[functions\.mynews-payments-webhook\]\s+verify_jwt = false/,
    );
    expect(functionConfig).toMatch(/\[functions\.mynews-support\]\s+verify_jwt = true/);
  });
});
