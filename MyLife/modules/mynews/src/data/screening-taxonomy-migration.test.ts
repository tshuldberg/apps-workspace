import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPORT_REASONS } from '../models';
import {
  REPORT_SEVERITY_RANK,
  REPORT_SLA_HOURS,
  REPORT_URGENT_REASONS,
} from './report';
import { CLASS_POLICY, SCREENING_CLASSES } from '../screening';

/**
 * Source-structural proof for plan 48 WP8 (migration 20260730000009). Three
 * things are pinned here that no runtime test can pin without a live database:
 *
 *   the SQL twins of the TS taxonomy tables (rank, SLA, urgent lane)
 *   the non-public representation of held content, including the three existing
 *     public policies that had to be tightened
 *   the transactional shape of the console actions
 */
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260730000009_mynews_screening_taxonomy.sql'),
  'utf8',
);

/** Body of one `create ... function public.<name>(` statement, up to its `$$;`. */
function functionBody(name: string): string {
  const start = migration.indexOf(`function public.${name}(`);
  expect(start, `expected function public.${name} in the migration`).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf('$$;', start);
  expect(end, `expected a terminator for public.${name}`).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe('20260730000009 taxonomy expansion', () => {
  it('widens the nw_reports reason CHECK to the full taxonomy', () => {
    expect(migration).toContain(
      'alter table public.nw_reports drop constraint if exists nw_reports_reason_check',
    );
    expect(migration).toContain('add constraint nw_reports_reason_taxonomy_v2');
    for (const reason of REPORT_REASONS) {
      expect(migration, `reason ${reason} missing from the SQL CHECK`).toContain(`'${reason}'`);
    }
  });

  it('uses the guarded-DO pattern so a re-run is safe', () => {
    expect(migration).toContain('from pg_constraint');
    expect(migration).toContain("conrelid = 'public.nw_reports'::regclass");
  });

  it('mirrors REPORT_SEVERITY_RANK exactly', () => {
    const body = functionBody('nw_report_severity_rank');
    for (const [reason, rank] of Object.entries(REPORT_SEVERITY_RANK)) {
      expect(body, `rank for ${reason} missing or wrong`).toContain(
        `when '${reason}' then ${rank}`,
      );
    }
    // Unknown reasons must score 0 so an unrouted reason can never outrank a
    // routed one during escalation.
    expect(body).toContain('else 0');
  });

  it('seeds nw_report_sla to match REPORT_SLA_HOURS and the urgent lane', () => {
    for (const [reason, hours] of Object.entries(REPORT_SLA_HOURS)) {
      const lane = (REPORT_URGENT_REASONS as readonly string[]).includes(reason)
        ? 'urgent'
        : 'standard';
      expect(migration, `SLA row for ${reason} missing or wrong`).toContain(
        `('${reason}', ${hours}, '${lane}')`,
      );
    }
  });

  it('routes every accepted reason, so intake and SLA cannot drift', () => {
    const body = functionBody('nw_submit_report');
    expect(body).toContain('select 1 from public.nw_report_sla where reason = p_reason');
    expect(body).toContain("raise exception 'nw_submit_report: unsupported reason'");
  });

  it('falls back to the tightest deadline for an unrouted reason', () => {
    const body = functionBody('nw_report_sla_hours');
    expect(body).toContain('select min(deadline_hours) from public.nw_report_sla');
  });

  it('generalizes the urgent case lane instead of forking it', () => {
    const urgent = functionBody('nw_reconcile_urgent_case');
    expect(urgent).toContain('public.nw_report_reason_is_urgent(reason)');
    expect(urgent).toContain('public.nw_report_sla_hours(v_reason)');
    expect(urgent).toContain('make_interval(hours => v_deadline_hours)');
    // The deadline stays anchored to the report, never restarted.
    expect(urgent).toContain('v_report_created_at + make_interval');
    // Same advisory lock key as WP1 so an in-flight intake still serializes.
    expect(urgent).toContain("'nw-ncii:'");
  });

  it('keeps nw_reconcile_ncii_case as a delegating shim with its old vocabulary', () => {
    const shim = functionBody('nw_reconcile_ncii_case');
    expect(shim).toContain('public.nw_reconcile_urgent_case(p_report_id)');
    expect(shim).toContain("return 'not-ncii'");
  });

  it('opens a child-safety case in the urgent lane at 24 hours', () => {
    expect(migration).toContain("('child-safety', 24, 'urgent')");
    expect(migration).toContain("('ncii', 48, 'urgent')");
    expect(functionBody('nw_reconcile_urgent_case')).toContain(
      "case when v_reason = 'child-safety' then 'child-safety' else 'ncii' end",
    );
    expect(migration).toContain("check (case_class in ('ncii', 'child-safety'))");
  });

  it('rolls the whole submission back when the urgent case cannot open', () => {
    const body = functionBody('nw_submit_report');
    expect(body).toContain("raise exception 'nw_submit_report: urgent case creation failed");
    expect(body).toContain("not in ('ok', 'exists')");
  });

  it('extends the orphan scan and the cron trigger to every urgent reason', () => {
    expect(functionBody('nw_find_orphaned_ncii_reports')).toContain(
      'public.nw_report_reason_is_urgent(r.reason)',
    );
    expect(functionBody('nw_run_ncii_worker')).toContain(
      'public.nw_report_reason_is_urgent(r.reason)',
    );
  });

  it('preserves the WP1 severity ordering in SQL', () => {
    const body = functionBody('nw_report_severity_rank');
    expect(body).toContain("when 'ncii' then 100");
    expect(body).toContain("when 'violence' then 80");
    expect(body).toContain("when 'harassment' then 60");
    expect(body).toContain("when 'impersonation' then 60");
    expect(body).toContain("when 'copyright' then 40");
    expect(body).toContain("when 'spam' then 20");
    expect(body).toContain("when 'other' then 20");
  });
});

describe('20260730000009 quarantine representation', () => {
  it('does NOT add a new nw_articles status value', () => {
    // A held article stays a draft on purpose: every existing public read path
    // filters on "status <> 'draft'", so a new status value would have silently
    // satisfied a dozen predicates at once.
    expect(migration).not.toContain('nw_articles_status_check');
    expect(migration).not.toMatch(/nw_articles\s+add constraint[\s\S]{0,80}check \(status in/);
    expect(migration).toContain(
      "alter table public.nw_articles\n  add column if not exists screening_status text not null default 'cleared'",
    );
  });

  it('adds screening_status to revisions and comment events with a bounded CHECK', () => {
    for (const table of ['nw_articles', 'nw_article_revisions', 'nw_suggestion_events']) {
      expect(migration).toContain(`add constraint ${table}_screening_status_check`);
    }
    expect(migration).toContain("check (screening_status in ('cleared', 'quarantined', 'rejected'))");
  });

  it('widens the suggestion status CHECK to carry the hold', () => {
    expect(migration).toContain(
      "check (status in ('open', 'accepted', 'partial', 'rejected', 'stale', 'quarantined'))",
    );
  });

  it('excludes held revisions from the public revision policy', () => {
    expect(migration).toContain(
      'drop policy if exists nw_article_revisions_public_select on public.nw_article_revisions',
    );
    const policy = migration.slice(
      migration.indexOf('create policy nw_article_revisions_public_select'),
    );
    expect(policy.slice(0, 300)).toContain("screening_status = 'cleared'");
  });

  it('excludes held suggestions from the public suggestion policy', () => {
    const policy = migration.slice(
      migration.indexOf('create policy nw_edit_suggestions_public_select'),
    );
    expect(policy.slice(0, 300)).toContain("status <> 'quarantined'");
  });

  it('excludes held comments from BOTH comment-visibility policies', () => {
    for (const name of [
      'nw_suggestion_events_public_select',
      'nw_suggestion_events_newsroom_member_select',
    ]) {
      expect(migration).toContain(`drop policy if exists ${name} on public.nw_suggestion_events`);
      const policy = migration.slice(migration.indexOf(`create policy ${name}`));
      expect(policy.slice(0, 400), `${name} must filter held comments`).toContain(
        "screening_status = 'cleared'",
      );
    }
  });

  it('lets an author read their own held suggestion and comment', () => {
    expect(migration).toContain('create policy nw_edit_suggestions_editor_select');
    expect(migration).toContain('create policy nw_suggestion_events_actor_select');
  });

  it('never advances current_rev when holding a revision', () => {
    const body = functionBody('nw_screening_quarantine_article');
    expect(body).toContain('current_rev deliberately unchanged');
    expect(body).not.toMatch(/set current_rev = v_rev/);
  });

  it('stores a held article as a draft with a screening hold', () => {
    const body = functionBody('nw_screening_quarantine_article');
    expect(body).toContain("'draft'");
    expect(body).toContain("'quarantined'");
  });

  it('mirrors the suggestion insert column list, including signer_pubkey', () => {
    const body = functionBody('nw_screening_quarantine_suggestion');
    expect(body).toContain('signature, signer_pubkey, status, created_at');
    expect(body).toContain("'quarantined'");
  });
});

describe('20260730000009 decision audit and measurement', () => {
  it('creates the decision table with the class scores and threshold recorded', () => {
    expect(migration).toContain('create table if not exists public.nw_screening_decisions');
    for (const column of [
      'content_kind',
      'content_id',
      'author_profile_id',
      'content_sha256',
      'engine_version',
      'provider',
      'provider_state',
      'risk_score',
      'top_class',
      'class_scores',
      'threshold_hit',
      'requires_human_review',
      'signals',
      'explanations',
      'auto_action',
      'decision',
      'reviewer_ref',
      'review_reason',
      'appeal_state',
      'held_payload',
      'content_signature',
    ]) {
      expect(migration, `decision column ${column} missing`).toContain(column);
    }
  });

  it('derives false-positive and false-negative measurement from the row itself', () => {
    expect(migration).toContain('is_false_positive boolean generated always as (');
    expect(migration).toContain("auto_action <> 'allowed' and decision = 'approved'");
    expect(migration).toContain('is_true_positive boolean generated always as (');
    expect(migration).toContain("auto_action <> 'allowed' and decision = 'rejected'");
    expect(migration).toContain('is_false_negative boolean generated always as (');
    expect(migration).toContain("auto_action = 'allowed' and decision = 'rejected'");
  });

  it('counts pending holds separately instead of scoring them as correct', () => {
    expect(migration).toContain('holds_pending');
    expect(migration).toContain('false_positive_rate');
    expect(migration).toContain(
      'when count(*) filter (where is_false_positive or is_true_positive) = 0 then null',
    );
  });

  it('keeps the decision table service-role only and the author view least-privilege', () => {
    expect(migration).toContain('alter table public.nw_screening_decisions enable row level security');
    expect(migration).toContain(
      'revoke all on table public.nw_screening_decisions from public, anon, authenticated',
    );
    expect(migration).toContain('create or replace view public.nw_my_screening_decisions');
    expect(migration).toContain('with (security_barrier = true)');
    expect(migration).toContain('grant select on public.nw_my_screening_decisions to authenticated');
  });

  it('keeps detector internals out of the author-facing view and RPC', () => {
    const view = migration.slice(
      migration.indexOf('create or replace view public.nw_my_screening_decisions'),
      migration.indexOf('grant select on public.nw_my_screening_decisions'),
    );
    expect(view).not.toContain('class_scores');
    expect(view).not.toContain('signals');
    expect(view).not.toContain('threshold_hit');
    const rpc = functionBody('nw_get_my_screening_decisions');
    expect(rpc).not.toContain('class_scores');
    expect(rpc).not.toContain('d.signals');
  });

  it('writes a statement of reasons at hold time, not at review time', () => {
    const body = functionBody('nw_screening_insert_decision');
    expect(body).toContain("'screening_hold'");
    expect(body).toContain("'screening-auto'");
    expect(body).toContain("if p_auto_action <> 'allowed' then");
  });

  it('extends the moderation action vocabulary for holds', () => {
    expect(migration).toContain('add constraint nw_moderation_actions_action_check_v2');
    expect(migration).toContain("'screening_hold'");
  });

  it('audits a comment against its suggestion, not its event id', () => {
    const body = functionBody('nw_screening_audit_target');
    expect(body).toContain("when 'comment' then 'suggestion'");
    expect(body).toContain('e.suggestion_id::text');
  });
});

describe('20260730000009 console actions', () => {
  it('requires a reviewer and a reason on every disposition', () => {
    for (const name of ['nw_screening_approve', 'nw_screening_reject']) {
      const body = functionBody(name);
      expect(body).toContain("return 'bad-reviewer'");
      expect(body).toContain("return 'bad-reason'");
      expect(body).toContain("if v_decision <> 'pending' then");
    }
  });

  it('locks the decision row before dispositioning it', () => {
    expect(functionBody('nw_screening_approve')).toContain('for update');
    expect(functionBody('nw_screening_reject')).toContain('for update');
  });

  it('reports stale-rev rather than rewriting a moved article head', () => {
    const body = functionBody('nw_screening_approve');
    expect(body).toContain("v_outcome := 'stale-rev'");
    expect(body).toContain('elsif v_current = v_rev - 1 then');
  });

  it('issues a content allowance on approval so a resubmission is not re-held', () => {
    const body = functionBody('nw_screening_approve');
    expect(body).toContain('insert into public.nw_screening_allowances');
    expect(body).toContain('on conflict (author_profile_id, content_sha256) do update');
    expect(body).toContain('public.nw_screening_allowance_days()');
    // The guard matters as much as the insert: the allowance is issued whenever a
    // hash was recorded, and the ONLY thing that may skip it is a missing hash.
    // Without this assertion the insert could be gated on anything at all and the
    // approval loop would never terminate for the author.
    expect(body).toMatch(
      /if coalesce\(v_sha, ''\) <> '' then\s*\n\s*insert into public\.nw_screening_allowances/,
    );
  });

  it('never deletes rejected content, so the audit trail survives an appeal', () => {
    const body = functionBody('nw_screening_reject');
    expect(body).not.toContain('delete from');
    expect(body).toContain("set screening_status = 'rejected'");
  });

  it('restricts an appeal to the author and to one attempt', () => {
    const body = functionBody('nw_screening_appeal_request');
    expect(body).toContain("return 'not-author'");
    expect(body).toContain("return 'already-appealed'");
    expect(body).toContain("return 'not-appealable'");
  });

  it('routes a granted appeal through the same release path as an approval', () => {
    const body = functionBody('nw_screening_appeal_disposition');
    expect(body).toContain('public.nw_screening_approve(p_decision_id, p_reviewer_ref, p_reason)');
    expect(body).toContain("set appeal_state = 'granted'");
    expect(body).toContain("set appeal_state = 'denied'");
  });

  it('locks every screening function to the service role', () => {
    for (const name of [
      'nw_screening_allowance_exists',
      'nw_screening_insert_decision',
      'nw_screening_record_allow',
      'nw_screening_quarantine_article',
      'nw_screening_quarantine_suggestion',
      'nw_screening_quarantine_comment',
      'nw_screening_hold_revision_proposal',
      'nw_screening_approve',
      'nw_screening_reject',
      'nw_screening_appeal_request',
      'nw_screening_appeal_disposition',
      'nw_get_my_screening_decisions',
      'nw_screening_record_signature',
      'nw_screening_recent_signatures',
    ]) {
      expect(migration, `${name} must be granted to service_role`).toContain(
        `grant execute on function public.${name}`,
      );
      expect(migration, `${name} must be revoked from client roles`).toMatch(
        new RegExp(`revoke all on function public\\.${name}[\\s\\S]{0,200}from public, anon, authenticated`),
      );
    }
  });

  it('bounds the signature history it keeps per author', () => {
    expect(functionBody('nw_content_signature_history')).toContain('select 50');
    expect(functionBody('nw_screening_record_signature')).toContain(
      'public.nw_content_signature_history()',
    );
  });
});

describe('20260730000009 verification center', () => {
  it('extends the verification lifecycle states', () => {
    expect(migration).toContain('add constraint nw_journalist_verifications_status_check_v2');
    expect(migration).toContain(
      "check (status in ('pending', 'approved', 'rejected', 'revoked', 'expired'))",
    );
  });

  it('allows at most one pending request per journalist', () => {
    expect(migration).toContain('create unique index if not exists uq_nw_journalist_verifications_open');
    expect(migration).toContain("where status = 'pending'");
  });

  it('defines one verification state used by SQL, the engine, and the UI', () => {
    const body = functionBody('nw_verification_state');
    expect(body).toContain("status = 'approved'");
    expect(body).toContain('expires_at is null or expires_at > now()');
    expect(body).toContain("'none'");
  });

  it('keeps the journalist tier following the verification state', () => {
    expect(functionBody('nw_verification_decide')).toContain(
      "update public.nw_journalists set tier = 'verified' where profile_id = v_journalist",
    );
    expect(functionBody('nw_verification_revoke')).toContain(
      "update public.nw_journalists set tier = 'open' where profile_id = v_journalist",
    );
    expect(functionBody('nw_verification_expire_due')).toContain("set tier = 'open'");
  });

  it('requires a reason and a future expiry to approve', () => {
    const body = functionBody('nw_verification_decide');
    expect(body).toContain("return 'bad-reason'");
    expect(body).toContain("return 'bad-expiry'");
    expect(body).toContain('p_expires_at <= now()');
  });

  it('expires lapsed approvals in bounded, idempotent batches', () => {
    const body = functionBody('nw_verification_expire_due');
    expect(body).toContain('for update skip locked');
    expect(body).toContain('limit greatest(1, coalesce(p_limit, 200))');
  });

  it('exposes verification state publicly without exposing evidence', () => {
    const view = migration.slice(
      migration.indexOf('create or replace view public.nw_public_journalists'),
      migration.indexOf('grant select on public.nw_public_journalists to anon, authenticated'),
    );
    expect(view).toContain('verification_state');
    expect(view).toContain('verification_expires_at');
    expect(view).not.toContain('evidence');
    expect(view).not.toContain('reviewed_by');
    expect(view).not.toContain('stripe_account_id');
    // The WP3 column order must be preserved: create or replace view can only
    // append, and every existing reader depends on the first five columns.
    expect(view).toContain('profile_id,\n  tier,\n  bio,\n  beats,\n  region,\n  created_at');
  });

  it('feeds age, verification, and ring suspicion into the aggregates', () => {
    const body = functionBody('nw_editor_aggregates');
    expect(body).toContain("'accountAgeMs'");
    expect(body).toContain("'verification', v_verification");
    expect(body).toContain("'ringSuspicion', coalesce(v_ring, 0)");
    // Every pre-existing key must survive: the edge cap check reads them.
    for (const key of [
      'openCount',
      'decidedSampleSize',
      'acceptanceRate',
      'acceptedTotal',
      'acceptedCopyedits',
      'distinctAuthors',
      'endorsementsReceived',
      'maxPairShare',
      'sanctionsInLast90d',
      'authorStanding',
    ]) {
      expect(body, `aggregates key ${key} was dropped`).toContain(`'${key}'`);
    }
  });

  it('stores ring detector output rather than reimplementing it in SQL', () => {
    expect(migration).toContain('create table if not exists public.nw_ring_flags');
    expect(migration).toContain('detector_version');
    expect(functionBody('nw_ring_flags_upsert')).toContain('on conflict (profile_id) do update');
  });
});

describe('20260730000009 append-only discipline', () => {
  it('does not redefine functions owned by other work packages', () => {
    for (const owned of [
      'function public.nw_publish_article(',
      'function public.nw_insert_suggestion(',
      'function public.nw_insert_suggestion_comment(',
      'function public.nw_account_deletion_dispose(',
      'function public.nw_key_rotate(',
      'function public.nw_ncii_enforce(',
    ]) {
      expect(migration, `must not redefine ${owned}`).not.toContain(owned);
    }
  });

  it('does not recreate tables it only extends', () => {
    for (const table of [
      'nw_articles',
      'nw_article_revisions',
      'nw_edit_suggestions',
      'nw_suggestion_events',
      'nw_reports',
      'nw_journalist_verifications',
      'nw_ncii_cases',
    ]) {
      expect(migration).not.toContain(`create table if not exists public.${table} (`);
    }
  });

  it('names every screening class the engine knows about in the policy table', () => {
    // The SQL does not enumerate classes, but top_class values come from the
    // engine, so the two vocabularies must stay aligned. This pins the engine
    // side so a new class cannot be added without revisiting this migration.
    expect(SCREENING_CLASSES).toEqual([
      'child-safety',
      'self-harm',
      'threats',
      'hate',
      'doxxing-privacy',
      'fraud-scam',
      'spam',
    ]);
    for (const cls of SCREENING_CLASSES) {
      expect(CLASS_POLICY[cls].quarantineAt).toBeGreaterThan(0);
    }
  });
});

describe('20260730000014 screening publish unfreeze (finding A4)', () => {
  const unfreeze = readFileSync(
    join(__dirname, '../../../../supabase/migrations/20260730000014_mynews_screening_publish_unfreeze.sql'),
    'utf8',
  );

  it('both write paths delete a held revision at the target slot before inserting', () => {
    const deletes = unfreeze.match(
      /delete from public\.nw_article_revisions\s+where article_id = v_article_id and rev = v_rev and screening_status = 'quarantined'/g,
    );
    // One in nw_publish_article, one in nw_screening_quarantine_article.
    expect(deletes?.length).toBe(2);
  });

  it('a clean publish clears the article screening status', () => {
    expect(unfreeze).toContain("set current_rev = v_rev, screening_status = 'cleared'");
  });

  it('both RPCs stay service-role only', () => {
    expect(unfreeze).toContain(
      'revoke all on function public.nw_publish_article(jsonb, jsonb, timestamptz) from public, anon, authenticated',
    );
    expect(unfreeze).toContain(
      'grant execute on function public.nw_screening_quarantine_article(jsonb, jsonb, jsonb, text)',
    );
  });
});
