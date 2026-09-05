import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('payments schema', () => {
  it('defines the authoritative ledger, money movement RPCs, and provider-event dedupe', () => {
    const schema = readFileSync(
      new URL('../schema.sql', import.meta.url),
      'utf8',
    );

    expect(schema).toContain('create table if not exists pay_wallets');
    expect(schema).toContain('create table if not exists pay_wallet_balances');
    expect(schema).toContain('create table if not exists pay_ledger_entries');
    expect(schema).toContain('create table if not exists pay_transfers');
    expect(schema).toContain('create table if not exists pay_provider_events');
    expect(schema).toContain('create table if not exists pay_compliance_cases');
    expect(schema).toContain('create or replace function pay_create_wallet');
    expect(schema).toContain('create or replace function pay_post_transfer');
    expect(schema).toContain('create or replace function pay_reverse_transfer');
    expect(schema).toContain('create or replace function pay_record_provider_event');
    expect(schema).toContain('before update or delete on pay_ledger_entries');
    expect(schema).toContain('pay_provider_events_provider_unique');
    expect(schema).toContain('create policy "pay_ledger_entries_owner_read"');
  });
});
