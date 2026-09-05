import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source-structural proof for the report-intake lockdown migration. A direct
// client insert into nw_reports must be blocked (policy dropped + guard trigger),
// a null reporter must be refused (reports are attributable), and the reporter's
// own-rows SELECT policy must survive. The service-role RPC is the only writer.
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260705000005_mynews_report_intake.sql'),
  'utf8',
);
const atomicMigration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260712000001_mynews_report_atomicity.sql'),
  'utf8',
);

describe('20260705000005 report intake lockdown', () => {
  it('drops the client insert policy', () => {
    expect(migration).toContain('drop policy if exists nw_reports_reporter_insert on public.nw_reports');
  });

  it('adds a client-write guard trigger that blocks authenticated/anon inserts', () => {
    expect(migration).toContain('nw_reports_guard_client_insert');
    expect(migration).toContain("current_user in ('authenticated', 'anon')");
    expect(migration).toContain('before insert on public.nw_reports');
  });

  it('refuses a null reporter (reports are attributable)', () => {
    expect(migration).toContain('new.reporter_id is null');
  });

  it('keeps a single open report per target with a partial unique index', () => {
    expect(migration).toContain('idx_nw_reports_one_open_per_target');
    expect(migration).toContain("where status = 'open'");
  });

  it('exposes the service-role insert RPC and locks it to service_role', () => {
    expect(migration).toContain('nw_insert_report');
    expect(migration).toContain('security definer');
    expect(migration).toContain('grant execute on function public.nw_insert_report');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('from anon, authenticated');
  });

  it('does not drop the reporter-own-rows select policy', () => {
    expect(migration).not.toContain('drop policy if exists nw_reports_reporter_select');
  });

  it('is append-only (does not edit the bootstrap file)', () => {
    // A sentinel: the migration references but never redefines the base table.
    expect(migration).not.toContain('create table');
  });
});

describe('20260712000001 atomic report intake', () => {
  it('pins the severity rank in immutable SQL', () => {
    expect(atomicMigration).toContain('nw_report_severity_rank');
    expect(atomicMigration).toContain('immutable');
    expect(atomicMigration).toContain("when 'ncii' then 100");
    expect(atomicMigration).toContain("when 'violence' then 80");
    expect(atomicMigration).toContain("when 'harassment' then 60");
    expect(atomicMigration).toContain("when 'impersonation' then 60");
    expect(atomicMigration).toContain("when 'copyright' then 40");
    expect(atomicMigration).toContain("when 'spam' then 20");
    expect(atomicMigration).toContain("when 'other' then 20");
  });

  it('adds authoritative service-role-only media assets', () => {
    expect(atomicMigration).toContain('create table if not exists public.nw_media_assets');
    expect(atomicMigration).toContain('owner_profile_id uuid not null references public.nw_profiles');
    expect(atomicMigration).toContain('storage_path text not null');
    expect(atomicMigration).toContain('sha256 text not null');
    expect(atomicMigration).toContain('alter table public.nw_media_assets enable row level security');
    expect(atomicMigration).toContain(
      'revoke all on table public.nw_media_assets from public, anon, authenticated',
    );
  });

  it('locks the atomic intake RPC to the service role', () => {
    expect(atomicMigration).toContain('create or replace function public.nw_submit_report');
    expect(atomicMigration).toContain('security definer');
    expect(atomicMigration).toContain('set search_path = public');
    expect(atomicMigration).toContain(
      'revoke all on function public.nw_submit_report(uuid, text, text, text, text)',
    );
    expect(atomicMigration).toContain(
      'grant execute on function public.nw_submit_report(uuid, text, text, text, text)',
    );
    expect(atomicMigration).toContain('to service_role');
  });

  it('validates targets and performs severity-aware escalation', () => {
    expect(atomicMigration).toContain('from public.nw_media_assets');
    expect(atomicMigration).toContain("return 'bad-target'");
    expect(atomicMigration).toContain('>= public.nw_report_severity_rank(p_reason)');
    expect(atomicMigration).toContain("E'\\n---escalated---\\n'");
    expect(atomicMigration).toContain('public.nw_report_escalations');
    expect(atomicMigration).toContain("v_outcome := 'escalated'");
  });

  it('creates the NCII takedown and case inside the transactional call graph', () => {
    expect(atomicMigration).toContain('public.nw_reconcile_ncii_case(v_report_id)');
    expect(atomicMigration).toContain("set status = 'retracted'");
    expect(atomicMigration).toContain("set status = 'rejected'");
    expect(atomicMigration).toContain("'TAKE IT DOWN: automatic NCII takedown pending human review'");
    expect(atomicMigration).toContain('insert into public.nw_ncii_cases');
    expect(atomicMigration).toContain('make_interval(hours => 48)');
    expect(atomicMigration).toContain("raise exception 'nw_submit_report: NCII case creation failed (%)'");
  });

  it('adds service-role-only orphan discovery and reconciliation', () => {
    expect(atomicMigration).toContain('public.nw_find_orphaned_ncii_reports()');
    expect(atomicMigration).toContain("r.reason = 'ncii'");
    expect(atomicMigration).toContain("c.status <> 'cleared'");
    expect(atomicMigration).toContain('public.nw_reconcile_ncii_case(p_report_id uuid)');
    expect(atomicMigration).toContain(
      'grant execute on function public.nw_find_orphaned_ncii_reports()',
    );
    expect(atomicMigration).toContain(
      'grant execute on function public.nw_reconcile_ncii_case(uuid) to service_role',
    );
  });
});
