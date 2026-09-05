import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260730000007_mynews_support_hardening.sql'),
  'utf8',
);
const functionConfig = readFileSync(join(__dirname, '../../../../supabase/config.toml'), 'utf8');

describe('20260730000007 MyNews support hardening', () => {
  it('creates every new table server-only with RLS enabled', () => {
    for (const table of [
      'nw_support_rate_counters',
      'nw_support_checkout_attempts',
      'nw_support_reconciliation_runs',
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
    }
    // No client-facing grant or policy: velocity counters, checkout attempts,
    // and reconciliation output are operator data.
    expect(migration).not.toMatch(/grant [^;]*on (table )?public\.nw_support_rate_counters to authenticated/);
    expect(migration).not.toMatch(/grant [^;]*on (table )?public\.nw_support_checkout_attempts to authenticated/);
    expect(migration).not.toMatch(/grant [^;]*on (table )?public\.nw_support_reconciliation_runs to authenticated/);
    expect(migration).not.toMatch(/create policy nw_support_(rate|checkout|reconciliation)/);
  });

  it('implements both velocity limits as a refilling token bucket with bounded GC', () => {
    expect(migration).toContain(
      'create or replace function public.nw_consume_support_rate_limit',
    );
    expect(migration).toContain("if p_scope = 'supporter' then");
    expect(migration).toContain("elsif p_scope = 'recipient' then");
    // supporter: 10 tokens, one per 360s = 10/hour. recipient: 60 per hour.
    expect(migration).toMatch(/v_capacity := 10;\s+v_refill_seconds := 360;/);
    expect(migration).toMatch(/v_capacity := 60;\s+v_refill_seconds := 60;/);
    expect(migration).toContain("return 'rate-limited'");
    expect(migration).toContain("return 'bad-scope'");
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('delete from public.nw_support_rate_counters');
    expect(migration).toContain('limit 50');
  });

  it('makes a repeated idempotency key replay the original checkout', () => {
    expect(migration).toContain('create or replace function public.nw_begin_support_checkout');
    expect(migration).toContain("status := 'replayed'");
    expect(migration).toContain('checkout_url := v_existing.checkout_url');
    expect(migration).toContain("status := 'conflict'");
    expect(migration).toContain("status := 'new'");
    expect(migration).toContain(
      'create or replace function public.nw_record_support_checkout_url',
    );
    expect(migration).toContain("return 'already-recorded'");
  });

  it('charges velocity only for a new attempt and never inserts a refused one', () => {
    const body = migration.slice(
      migration.indexOf('create or replace function public.nw_begin_support_checkout'),
      migration.indexOf('revoke all on function public.nw_begin_support_checkout'),
    );
    const replayReturn = body.indexOf("status := 'replayed'");
    const firstConsume = body.indexOf('nw_consume_support_rate_limit');
    const insert = body.indexOf('insert into public.nw_support_checkout_attempts');
    expect(replayReturn).toBeGreaterThan(-1);
    expect(firstConsume).toBeGreaterThan(replayReturn);
    expect(insert).toBeGreaterThan(firstConsume);
    expect(body).toContain("rate_scope := 'supporter'");
    expect(body).toContain("rate_scope := 'recipient'");
  });

  it('keeps every new function security definer, search-path pinned, and service-role only', () => {
    for (const signature of [
      'public.nw_consume_support_rate_limit(text, uuid)',
      'public.nw_begin_support_checkout(text, uuid, uuid, bigint)',
      'public.nw_record_support_checkout_url(text, text)',
      'public.nw_apply_payment_event(text, text, text, jsonb, timestamptz, text, uuid)',
    ]) {
      expect(migration).toContain(`revoke all on function ${signature}`);
      expect(migration).toContain(`grant execute on function ${signature}`);
    }
    const definers = migration.match(/security definer/g) ?? [];
    expect(definers.length).toBe(4);
    const searchPaths = migration.match(/set search_path = public/g) ?? [];
    expect(searchPaths.length).toBe(4);
  });

  it('resolves payout attribution from the server-supplied Connect account ref', () => {
    expect(migration).toContain(
      'drop function if exists public.nw_apply_payment_event(text, text, text, jsonb, timestamptz)',
    );
    expect(migration).toContain('p_provider_account_ref text default null');
    expect(migration).toContain('p_resolved_journalist_profile_id uuid default null');
    expect(migration).toContain('from public.nw_payout_accounts a');
    expect(migration).toContain('a.provider_account_ref = v_account_ref');
    expect(migration).toContain("failure_reason = 'payout-attribution-conflict'");
  });

  it('records an unattributable payout for operator review and writes no ledger row', () => {
    const payoutBranch = migration.slice(
      migration.indexOf("elsif p_event_type in ('payout_paid', 'payout_failed') then"),
      migration.indexOf("elsif p_event_type = 'payout_account_updated' then"),
    );
    expect(payoutBranch).toContain("failure_reason = 'unattributed-payout'");
    expect(payoutBranch).toContain("return 'unattributed'");
    // The unattributed return happens before any ledger insert in that branch.
    expect(payoutBranch.indexOf("return 'unattributed'")).toBeLessThan(
      payoutBranch.indexOf('insert into public.nw_support_ledger'),
    );
  });

  it('resolves an account.updated event without journalist metadata', () => {
    const accountBranch = migration.slice(
      migration.indexOf("elsif p_event_type = 'payout_account_updated' then"),
    );
    expect(accountBranch).toContain('a.provider_account_ref = v_provider_ref');
    expect(accountBranch).toContain(
      'v_journalist_id := coalesce(v_metadata_journalist_id, v_account_journalist_id)',
    );
  });

  it('bounds the reconciliation findings blob', () => {
    expect(migration).toContain('jsonb_array_length(findings) <= 100');
    expect(migration).toContain('mismatch_count integer not null check (mismatch_count >= 0)');
    expect(migration).toContain(
      'grant select, insert on public.nw_support_reconciliation_runs to service_role',
    );
  });

  it('deploys the reconciliation worker with the gateway JWT check off', () => {
    expect(functionConfig).toMatch(
      /\[functions\.mynews-support-worker\]\s+verify_jwt = false/,
    );
    // The user-facing support function keeps gateway verification on.
    expect(functionConfig).toMatch(/\[functions\.mynews-support\]\s+verify_jwt = true/);
  });
});

describe('20260730000015 refund receipt lock (WP12 Codex HIGH)', () => {
  const refundLock = readFileSync(
    join(__dirname, '../../../../supabase/migrations/20260730000015_mynews_refund_receipt_lock.sql'),
    'utf8',
  );

  it('locks the receipt row in the refund branch before computing the delta', () => {
    // The refund-branch receipt select must carry FOR UPDATE so two concurrent
    // refund events serialize on the receipt and cannot both refund from zero.
    expect(refundLock).toMatch(
      /select r\.\* into v_receipt[\s\S]*?order by r\.created_at desc\s+limit 1\s+for update;/,
    );
  });

  it('re-defines nw_apply_payment_event and keeps it service-role only', () => {
    expect(refundLock).toContain('create or replace function public.nw_apply_payment_event');
    expect(refundLock).toContain(
      'grant execute on function public.nw_apply_payment_event(text, text, text, jsonb, timestamptz, text, uuid)',
    );
    expect(refundLock).toContain('to service_role;');
  });
});
