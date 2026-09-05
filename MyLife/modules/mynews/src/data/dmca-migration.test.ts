import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
} from '../models';

// Source-structural proof for the DMCA + repeat-infringer migration (Plan 39 T9).
// The notice table is service-role-only (RLS on, zero client policies), the
// strike counter is client-write-guarded, and both new RPCs are security definer
// and revoked from public/anon/authenticated.
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260705000008_mynews_dmca.sql'),
  'utf8',
);
const counterMigration = readFileSync(
  join(
    __dirname,
    '../../../../supabase/migrations/20260712000002_mynews_dmca_counter_notice.sql',
  ),
  'utf8',
);
const edgeFunction = readFileSync(
  join(__dirname, '../../../../supabase/functions/mynews-dmca/index.ts'),
  'utf8',
);

describe('20260705000008 dmca + repeat-infringer', () => {
  it('adds the copyright_strikes counter to nw_profiles', () => {
    expect(migration).toContain('add column if not exists copyright_strikes integer not null default 0');
  });

  it('guards client writes to copyright_strikes (service-role only)', () => {
    expect(migration).toContain('nw_profiles_guard_suspension_write');
    expect(migration).toContain('new.copyright_strikes is distinct from old.copyright_strikes');
    // The suspension guard from 000007 is preserved in the same trigger body.
    expect(migration).toContain('new.suspended_until is distinct from old.suspended_until');
  });

  it('creates the notice table with RLS enabled and zero client policies', () => {
    expect(migration).toContain('create table if not exists public.nw_dmca_notices');
    expect(migration).toContain('alter table public.nw_dmca_notices enable row level security');
    expect(migration).not.toContain('create policy nw_dmca_notices');
  });

  it('captures every DMCA-required element as a not-null column or attestation', () => {
    for (const col of [
      'complainant_name text not null',
      'complainant_email text not null',
      'copyrighted_work text not null',
      'infringing_url text not null',
      'good_faith boolean not null',
      'accuracy_under_penalty boolean not null',
      'signature text not null',
    ]) {
      expect(migration).toContain(col);
    }
    // Both attestations are enforced by a table constraint, not just app code.
    expect(migration).toContain('constraint nw_dmca_attested check (good_faith and accuracy_under_penalty)');
  });

  it('routes a takedown notice into the moderation queue via a copyright report', () => {
    expect(migration).toContain('insert into public.nw_reports (reporter_id, target_kind, target_id, reason, detail)');
    expect(migration).toContain("'copyright',");
    expect(migration).toContain("if p_kind = 'takedown' and p_target_kind is not null and p_target_id is not null then");
  });

  it('locks the notice-insert RPC to the service role', () => {
    expect(migration).toContain('create or replace function public.nw_submit_dmca_notice');
    expect(migration).toContain('revoke all on function public.nw_submit_dmca_notice');
    expect(migration).toContain('grant execute on function public.nw_submit_dmca_notice');
  });

  it('defines the strike-and-maybe-suspend teeth, service-role only', () => {
    expect(migration).toContain('create or replace function public.nw_moderate_strike_and_maybe_suspend');
    expect(migration).toContain('set copyright_strikes = copyright_strikes + 1');
    expect(migration).toContain('if v_strikes >= v_threshold then');
    expect(migration).toContain('set suspended_until = v_until');
    expect(migration).toContain('insert into public.nw_moderation_actions');
    expect(migration).toContain("return 'suspended'");
    expect(migration).toContain("return 'struck'");
    expect(migration).toContain('revoke all on function public.nw_moderate_strike_and_maybe_suspend');
    expect(migration).toContain('grant execute on function public.nw_moderate_strike_and_maybe_suspend');
  });

  it('defaults the strike threshold to 3', () => {
    expect(migration).toContain('p_threshold integer default 3');
    expect(migration).toContain('then 3 else p_threshold end');
  });

  it('revokes both new RPCs from anon and authenticated and keeps security definer', () => {
    expect(migration).toContain('from anon, authenticated');
    expect(migration).toContain('security definer');
    expect(migration).toContain('to service_role');
  });

  it('is append-only against the bootstrap tables it references', () => {
    expect(migration).not.toContain('create table if not exists public.nw_reports');
    expect(migration).not.toContain('create table if not exists public.nw_articles');
    expect(migration).not.toContain('create table if not exists public.nw_profiles');
  });
});

describe('20260712000002 transactional DMCA + counter-notice workflow', () => {
  it('creates a distinct service-role-only counter-notice table', () => {
    expect(counterMigration).toContain(
      'create table if not exists public.nw_dmca_counter_notices',
    );
    expect(counterMigration).toContain(
      'alter table public.nw_dmca_counter_notices enable row level security',
    );
    expect(counterMigration).toContain(
      'revoke all on table public.nw_dmca_counter_notices from public, anon, authenticated',
    );
    expect(counterMigration).not.toContain('create policy nw_dmca_counter');
  });

  it('persists every distinct 512(g)(3) counter-notice element and attestation version', () => {
    for (const column of [
      'counter_notifier_name text not null',
      'counter_notifier_address text not null',
      'counter_notifier_phone text not null',
      'counter_notifier_email text not null',
      'removed_material text not null',
      'material_location_before_removal text not null',
      'good_faith_mistake_or_misidentification boolean not null',
      'statement_under_penalty_of_perjury boolean not null',
      'mistake_attestation_text text not null',
      'mistake_attestation_version text not null',
      'consent_to_federal_jurisdiction boolean not null',
      'jurisdiction_attestation_text text not null',
      'jurisdiction_attestation_version text not null',
      'acceptance_of_service_of_process boolean not null',
      'service_attestation_text text not null',
      'service_attestation_version text not null',
      'signature text not null',
    ]) {
      expect(counterMigration).toContain(column);
    }
    expect(counterMigration).toContain('constraint nw_dmca_counter_attested check');
    expect(counterMigration).toContain(
      'original_notice_id uuid references public.nw_dmca_notices (id) on delete set null',
    );
  });

  it('pins every exact attestation across the module, edge twin, and SQL intake', () => {
    for (const text of [
      DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
      DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
      DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
      DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
      DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
    ]) {
      expect(edgeFunction).toContain(text);
      // SQL escapes apostrophes by doubling them.
      expect(counterMigration).toContain(text.replaceAll("'", "''"));
    }
  });

  it('defines the complete counter-notice state machine and transition timestamps', () => {
    for (const status of [
      'needs_resolution',
      'received',
      'forwarded_to_claimant',
      'waiting_period',
      'restored',
      'litigation_hold',
      'closed',
    ]) {
      expect(counterMigration).toContain(`'${status}'`);
    }
    for (const timestamp of [
      'received_at timestamptz not null',
      'forwarded_to_claimant_at timestamptz',
      'waiting_period_started_at timestamptz',
      'restoration_eligible_at timestamptz',
      'restoration_deadline_at timestamptz',
      'restored_at timestamptz',
      'litigation_hold_at timestamptz',
      'closed_at timestamptz',
    ]) {
      expect(counterMigration).toContain(timestamp);
    }
    expect(counterMigration).toContain('public.nw_add_business_days(v_now, 10)');
    expect(counterMigration).toContain('public.nw_add_business_days(v_now, 14)');
    expect(counterMigration).toContain("return 'waiting-period-active'");
  });

  it('resolves only canonical public URL shapes against authoritative rows', () => {
    expect(counterMigration).toContain(
      'create or replace function public.nw_resolve_public_url(p_url text)',
    );
    expect(counterMigration).toContain("'^/(article|a)/([a-z0-9-]{3,120})/?$'");
    expect(counterMigration).toContain("'^/(journalist|profile)/([a-z0-9_]{3,30})/?$'");
    expect(counterMigration).toContain("'^/suggestion/([a-f0-9-]{36})/?$'");
    expect(counterMigration).toContain("where a.status <> 'draft'");
    expect(counterMigration).toContain('join public.nw_articles a on a.id = s.article_id');
    expect(counterMigration).toContain(
      'grant execute on function public.nw_resolve_public_url(text) to service_role',
    );
  });

  it('uses a durable fixed-window counter with only salted hashes and service-role access', () => {
    expect(counterMigration).toContain('create table if not exists public.nw_dmca_rate_counters');
    expect(counterMigration).toContain('rate_key text primary key');
    expect(counterMigration).toContain('ip_hash text not null');
    expect(counterMigration).toContain('email_hash text not null');
    expect(counterMigration).not.toMatch(/\bip_address\b|\braw_email\b/);
    expect(counterMigration).toContain("v_now - interval '10 minutes'");
    expect(counterMigration).toContain('if v_count >= 5 then');
    expect(counterMigration).toContain(
      'grant execute on function public.nw_consume_dmca_rate_limit(text, text, text)',
    );
  });

  it('commits notice, resolution, report, event, and queue visibility in one takedown RPC', () => {
    expect(counterMigration).toContain(
      'create or replace function public.nw_submit_dmca_takedown',
    );
    expect(counterMigration).toContain('from public.nw_resolve_public_url(p_infringing_url)');
    expect(counterMigration).toContain("v_status := case when v_target_kind is null then 'needs_resolution'");
    expect(counterMigration).toContain('insert into public.nw_dmca_notices');
    expect(counterMigration).toContain('insert into public.nw_reports');
    expect(counterMigration).toContain("'dmca',");
    expect(counterMigration).toContain('insert into public.nw_dmca_events');
    expect(counterMigration).toContain('queue visibility invariant failed');
    expect(counterMigration).toContain("'queueVisible', true");
  });

  it('keeps unmatched counter-notices queue-visible without violating the original notice FK', () => {
    expect(counterMigration).toContain('v_candidate_original_id := v_original_reference::uuid');
    expect(counterMigration).toContain('v_original_notice_id is not null');
    expect(counterMigration).toContain(
      'select 1 from public.nw_dmca_counter_notices where id = v_counter_id',
    );
    expect(counterMigration).toContain(
      "'originalNoticeMatched', v_original_notice_id is not null",
    );
  });

  it('keeps ordinary reports attributable while allowing only linked DMCA anonymous reports', () => {
    expect(counterMigration).toContain("intake_source text not null default 'user'");
    expect(counterMigration).toContain(
      "new.intake_source <> 'dmca' or new.dmca_notice_id is null",
    );
    expect(counterMigration).toContain(
      "if new.intake_source = 'dmca' and new.dmca_notice_id is null then",
    );
    expect(counterMigration).toContain('where dmca_notice_id is not null');
  });

  it('makes the communication log append-only and every workflow action transactional', () => {
    expect(counterMigration).toContain('create table if not exists public.nw_dmca_events');
    expect(counterMigration).toContain("raise exception 'nw_dmca_events is append-only'");
    expect(counterMigration).toContain('before update or delete on public.nw_dmca_events');
    expect(counterMigration).toContain('create or replace function public.nw_dmca_apply_action');
    for (const action of [
      'assign',
      'add_note',
      'acknowledge',
      'forward_to_claimant',
      'start_waiting_period',
      'restore_content',
      'litigation_hold',
      'close',
      'link_original',
      'unlink_original',
      'link_strike',
    ]) {
      expect(counterMigration).toContain(`p_action = '${action}'`);
    }
  });

  it('keeps submission-status reads JWT-account scoped by matching auth email and notice id', () => {
    expect(counterMigration).toContain(
      'create or replace function public.nw_get_my_dmca_submission_status',
    );
    expect(counterMigration).toContain('select 1 from auth.users u');
    expect(counterMigration).toContain(
      'u.id = p_user_id and lower(u.email) = lower(trim(p_email))',
    );
    expect(counterMigration).toContain('n.id = p_notice_id');
    expect(counterMigration).toContain('c.id = p_notice_id');
    expect(counterMigration).toContain(
      'grant execute on function public.nw_get_my_dmca_submission_status',
    );
  });
});

// Wave 2 hardening migration: resolver vocabulary matches the live web routes,
// the rate limiter is a token bucket with GC, and the workflow RPC gains
// profile restoration, broadened strike linkage, and honest forwarding events.
const hardeningMigration = readFileSync(
  join(
    __dirname,
    '../../../../supabase/migrations/20260730000002_mynews_dmca_hardening.sql',
  ),
  'utf8',
);

describe('20260730000002 dmca hardening', () => {
  it('resolver vocabulary covers /a, /a/*/suggestions, /j, /e plus legacy forms', () => {
    expect(hardeningMigration).toContain(
      String.raw`'^/(article|a)/([a-z0-9-]{3,120})(/suggestions)?/?$'`,
    );
    expect(hardeningMigration).toContain(
      String.raw`'^/(journalist|profile|j|e)/([a-z0-9_]{3,30})/?$'`,
    );
    expect(hardeningMigration).toContain(String.raw`'^/suggestion/([a-f0-9-]{36})/?$'`);
  });

  it('replaces the fixed window with a capacity-5, 120-second token bucket', () => {
    expect(hardeningMigration).toContain('c_capacity constant double precision := 5');
    expect(hardeningMigration).toContain('c_refill_seconds constant double precision := 120');
    expect(hardeningMigration).toContain('add column if not exists tokens double precision');
    expect(hardeningMigration).toContain('add column if not exists last_refill_at timestamptz');
  });

  it('garbage-collects counters idle for 30 days inside the consume RPC', () => {
    expect(hardeningMigration).toContain("updated_at < v_now - interval '30 days'");
  });

  it('keeps the rate RPC service-role-only', () => {
    expect(hardeningMigration).toContain(
      'revoke all on function public.nw_consume_dmca_rate_limit(text, text, text)',
    );
    expect(hardeningMigration).toContain(
      'grant execute on function public.nw_consume_dmca_rate_limit(text, text, text)',
    );
  });

  it('restore_content lifts profile suspension for profile targets', () => {
    expect(hardeningMigration).toContain("elsif v_target_kind = 'profile' then");
    expect(hardeningMigration).toContain(
      'update public.nw_profiles set suspended_until = null where id = v_restore_uuid',
    );
  });

  it('link_strike accepts every enforcement action kind', () => {
    expect(hardeningMigration).toContain(
      "action in ('suspend_profile', 'hide_article', 'hide_suggestion')",
    );
  });

  it('forwarding events carry the manual-attested delivery marker (both kinds)', () => {
    const matches = hardeningMigration.match(/'delivery', 'manual-attested'/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('keeps the workflow RPC service-role-only', () => {
    expect(hardeningMigration).toContain(
      'revoke all on function public.nw_dmca_apply_action(uuid, text, text, text, text, text)',
    );
  });

  it('the edge function never reads spoofable transport IP headers', () => {
    expect(edgeFunction).not.toContain('x-forwarded-for');
    expect(edgeFunction).not.toContain('cf-connecting-ip');
    expect(edgeFunction).not.toContain('x-real-ip');
    expect(edgeFunction).toContain('x-mynews-proxy-signature');
  });
});
