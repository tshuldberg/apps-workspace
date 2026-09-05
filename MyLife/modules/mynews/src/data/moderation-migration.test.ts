import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source-structural proof for the moderation + enforcement migration (Plan 39
// T8). The suspension column is service-role-only writable, the audit table is
// service-role-only (RLS on, zero client policies), and every enforcement RPC is
// security definer and revoked from public/anon/authenticated.
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260705000007_mynews_moderation.sql'),
  'utf8',
);

const RPCS = [
  'nw_moderate_hide_article',
  'nw_moderate_hide_suggestion',
  'nw_moderate_suspend_profile',
  'nw_moderate_resolve_report',
];

describe('20260705000007 moderation + enforcement', () => {
  it('adds the suspension signal to nw_profiles', () => {
    expect(migration).toContain('add column if not exists suspended_until timestamptz');
  });

  it('guards client writes to suspended_until (service-role only)', () => {
    expect(migration).toContain('nw_profiles_guard_suspension_write');
    expect(migration).toContain("current_user in ('authenticated', 'anon')");
    expect(migration).toContain('new.suspended_until is distinct from old.suspended_until');
  });

  it('creates the audit table with RLS enabled and zero client policies', () => {
    expect(migration).toContain('create table if not exists public.nw_moderation_actions');
    expect(migration).toContain('alter table public.nw_moderation_actions enable row level security');
    // No client-facing policy is ever created on the audit table.
    expect(migration).not.toContain('create policy nw_moderation_actions');
  });

  it('constrains audit actions to the enforcement set', () => {
    expect(migration).toContain(
      "action in ('hide_article', 'hide_suggestion', 'suspend_profile', 'dismiss', 'restore')",
    );
  });

  it('locks every enforcement RPC to the service role', () => {
    for (const rpc of RPCS) {
      expect(migration).toContain(`create or replace function public.${rpc}`);
      expect(migration).toContain(`revoke all on function public.${rpc}`);
      expect(migration).toContain(`grant execute on function public.${rpc}`);
    }
    expect(migration).toContain('security definer');
    expect(migration).toContain('from anon, authenticated');
    expect(migration).toContain('to service_role');
  });

  it('hide_article retracts and audits; suspend sets suspended_until', () => {
    expect(migration).toContain("set status = 'retracted'");
    expect(migration).toContain('set suspended_until = p_until');
    expect(migration).toContain('insert into public.nw_moderation_actions');
  });

  it('resolve_report only transitions open reports', () => {
    expect(migration).toContain("where id = p_report_id and status = 'open'");
    expect(migration).toContain("p_status not in ('actioned', 'no_action')");
  });

  it('is append-only against the bootstrap tables it references', () => {
    expect(migration).not.toContain('create table if not exists public.nw_reports');
    expect(migration).not.toContain('create table if not exists public.nw_articles');
  });
});
