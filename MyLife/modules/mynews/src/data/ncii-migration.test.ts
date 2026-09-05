import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source-structural proof for the NCII / TAKE IT DOWN 48h SLA migration (Plan 39
// T10). The case table is service-role-only (RLS on, zero client policies), both
// RPCs are security definer and revoked from public/anon/authenticated, intake is
// take-down-first, and the pg_cron scheduling is guarded so it no-ops where
// pg_cron is absent.
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260705000009_mynews_ncii.sql'),
  'utf8',
);

const RPCS = ['nw_open_ncii_case', 'nw_ncii_enforce', 'nw_run_ncii_worker'];

describe('20260705000009 ncii / take-it-down SLA', () => {
  it('creates the ncii case table with the 48h deadline and status set', () => {
    expect(migration).toContain('create table if not exists public.nw_ncii_cases');
    expect(migration).toContain('deadline_at timestamptz not null');
    expect(migration).toContain("status in ('queued', 'removed', 'escalated', 'cleared')");
  });

  it('records the hash-match seam and NCMEC ref columns', () => {
    expect(migration).toContain(
      "hash_match_status in ('pending', 'match', 'no_match', 'error')",
    );
    expect(migration).toContain('ncmec_ref text');
    // Default hash status is pending: no auto-clear seam.
    expect(migration).toContain("hash_match_status text not null default 'pending'");
  });

  it('locks the case table to the service role (RLS on, zero client policies)', () => {
    expect(migration).toContain('alter table public.nw_ncii_cases enable row level security');
    expect(migration).not.toContain('create policy nw_ncii_cases');
  });

  it('opens the case take-down-first: intake retracts the article immediately', () => {
    expect(migration).toContain('create or replace function public.nw_open_ncii_case');
    expect(migration).toContain("update public.nw_articles set status = 'retracted'");
    expect(migration).toContain("update public.nw_edit_suggestions set status = 'rejected'");
    // The removal is audited as an automatic NCII takedown.
    expect(migration).toContain("'TAKE IT DOWN: automatic NCII takedown pending human review'");
  });

  it('starts a 48h clock via make_interval on the report time', () => {
    expect(migration).toContain('now() + make_interval(hours => v_hours)');
  });

  it('enforce is fail-closed: clear is human-only, ambiguity escalates', () => {
    expect(migration).toContain('create or replace function public.nw_ncii_enforce');
    // The automated worker ref can never clear a case.
    expect(migration).toContain("if p_moderator_ref = 'ncii-auto' then");
    expect(migration).toContain("return 'clear-not-allowed'");
    // Default new status before any removal is escalated (fail-closed).
    expect(migration).toContain("v_new_status := 'escalated'");
  });

  it('locks both enforcement RPCs to the service role', () => {
    for (const rpc of ['nw_open_ncii_case', 'nw_ncii_enforce']) {
      expect(migration).toContain(`create or replace function public.${rpc}`);
      expect(migration).toContain(`revoke all on function public.${rpc}`);
      expect(migration).toContain(`grant execute on function public.${rpc}`);
    }
    expect(migration).toContain('security definer');
    expect(migration).toContain('from anon, authenticated');
    expect(migration).toContain('to service_role');
  });

  it('schedules the worker via pg_cron, guarded to no-op where pg_cron is absent', () => {
    expect(migration).toContain('create or replace function public.nw_run_ncii_worker');
    expect(migration).toContain("perform cron.schedule(\n      'mynews-ncii-worker'");
    expect(migration).toContain("select 1 from pg_extension where extname = 'pg_cron'");
    // The worker invocation passes the shared secret header, never a JWT.
    expect(migration).toContain("'X-MyNews-Worker-Secret', v_secret");
    // Reads the worker URL + secret from nw_job_config (service-role only).
    expect(migration).toContain("from public.nw_job_config where key = 'ncii_worker_secret'");
  });

  it('has a definer for every declared RPC', () => {
    for (const rpc of RPCS) {
      expect(migration).toContain(`create or replace function public.${rpc}`);
    }
  });

  it('is append-only against the tables it references', () => {
    expect(migration).not.toContain('create table if not exists public.nw_reports');
    expect(migration).not.toContain('create table if not exists public.nw_articles');
    expect(migration).not.toContain('create table if not exists public.nw_moderation_actions');
  });
});
