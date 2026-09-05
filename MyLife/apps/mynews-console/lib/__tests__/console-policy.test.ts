import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ACTION_MIN_ROLE,
  PENDING_APPROVAL_MIN_ROLE,
  PENDING_KINDS,
  ROLE_RANK,
  type ModeratorRole,
} from '../roles';
import { PERMANENT_SUSPENSION_ISO } from '../moderation';

/**
 * Drift pins between the console's TypeScript policy and migration
 * 20260730000010 (plan 48 WP9).
 *
 * The SQL is authoritative: every RPC re-checks the role, the reason, the version,
 * and the replay token, so a policy that existed only in TypeScript would be
 * bypassable by any other caller of those RPCs. These tests exist so the two
 * cannot drift apart silently, and so the guards that make the SQL safe cannot be
 * deleted without a red test.
 */

const MIGRATION = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260730000010_mynews_console_integrity.sql'),
  'utf8',
);

/** Pull `when '<key>' then <n>` pairs out of one SQL case expression. */
function sqlCaseLevels(functionName: string): Record<string, number> {
  const start = MIGRATION.indexOf(`create or replace function public.${functionName}(`);
  expect(start, `${functionName} must exist in the migration`).toBeGreaterThan(-1);
  const end = MIGRATION.indexOf('$$;', start);
  const body = MIGRATION.slice(start, end);
  const out: Record<string, number> = {};
  for (const match of body.matchAll(/when '([a-z_]+)' then (\d+)/g)) {
    out[match[1]!] = Number(match[2]);
  }
  return out;
}

describe('role ladder', () => {
  it('matches nw_moderator_role_rank', () => {
    expect(sqlCaseLevels('nw_moderator_role_rank')).toEqual(ROLE_RANK);
  });
});

describe('per-action role floors', () => {
  const sqlLevels = sqlCaseLevels('nw_console_action_min_level');

  it('covers exactly the same actions in SQL and TypeScript', () => {
    expect(Object.keys(sqlLevels).sort()).toEqual(Object.keys(ACTION_MIN_ROLE).sort());
  });

  it('assigns the same level to every action', () => {
    const mismatches: string[] = [];
    for (const [action, role] of Object.entries(ACTION_MIN_ROLE)) {
      const expected = ROLE_RANK[role as ModeratorRole];
      if (sqlLevels[action] !== expected) {
        mismatches.push(`${action}: ts=${expected} sql=${String(sqlLevels[action])}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('defaults an unlisted action to admin in SQL too', () => {
    const start = MIGRATION.indexOf(
      'create or replace function public.nw_console_action_min_level(',
    );
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toMatch(/else 3\s*\n\s*end/);
  });
});

describe('dual-control approval floors', () => {
  const sqlLevels = sqlCaseLevels('nw_pending_action_min_level');

  it('matches the TypeScript floors for the admin-only kinds', () => {
    for (const [kind, level] of Object.entries(sqlLevels)) {
      expect(ROLE_RANK[PENDING_APPROVAL_MIN_ROLE[kind as never]]).toBe(level);
    }
  });

  it('defaults the rest to senior in SQL, matching TypeScript', () => {
    const start = MIGRATION.indexOf('create or replace function public.nw_pending_action_min_level(');
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toMatch(/else 2\s*\n\s*end/);
    for (const kind of PENDING_KINDS) {
      if (!(kind in sqlLevels)) expect(PENDING_APPROVAL_MIN_ROLE[kind]).toBe('senior');
    }
  });

  it('constrains nw_pending_actions.kind to exactly the five known kinds', () => {
    for (const kind of PENDING_KINDS) {
      expect(MIGRATION).toContain(`'${kind}'`);
    }
    const start = MIGRATION.indexOf('create table if not exists public.nw_pending_actions (');
    const body = MIGRATION.slice(start, MIGRATION.indexOf(');', start));
    const check = /kind in \(([^)]+)\)/.exec(body);
    expect(check).not.toBeNull();
    const sqlKinds = [...check![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!).sort();
    expect(sqlKinds).toEqual([...PENDING_KINDS].sort());
  });
});

describe('second-moderator rule lives in SQL', () => {
  it('has a CHECK constraint refusing a decider who is the proposer', () => {
    expect(MIGRATION).toContain('constraint nw_pending_actions_second_moderator check (');
    expect(MIGRATION).toMatch(
      /decided_by is null or lower\(btrim\(decided_by\)\) <> lower\(btrim\(proposed_by\)\)/,
    );
  });

  it('also returns a typed self-approval code from the decide RPC', () => {
    const start = MIGRATION.indexOf(
      'create or replace function public.nw_console_decide_pending_action(',
    );
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain("'code', 'self-approval'");
    expect(body).toContain('if lower(btrim(v_row.proposed_by)) = v_actor then');
  });

  it('refuses an appeal reviewer who took the action being appealed', () => {
    for (const fn of [
      'nw_console_dispose_moderation_appeal',
      'nw_console_enforce_screening',
    ]) {
      const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
      const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
      expect(body, `${fn} must refuse same-moderator`).toContain("'same-moderator'");
    }
  });
});

describe('every enforcement RPC has the four integrity guards', () => {
  const enforcers = [
    'nw_console_enforce_report',
    'nw_console_enforce_ncii',
    'nw_console_enforce_dmca',
    'nw_console_enforce_screening',
    'nw_console_enforce_verification',
    'nw_console_dispose_moderation_appeal',
  ];

  it.each(enforcers)('%s claims a replay token', (fn) => {
    const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain('public.nw_console_claim_token(');
    expect(body).toContain("'code', 'replayed'");
  });

  it.each(enforcers)('%s checks the caller version and reports the current one', (fn) => {
    const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain('p_expected_version is null or p_expected_version <> v_version');
    expect(body).toContain("'code', 'stale-action', 'currentVersion'");
  });

  it.each(enforcers)('%s requires a reason', (fn) => {
    const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain('public.nw_console_reason_ok(p_reason)');
  });

  it.each(enforcers)('%s checks a role floor and refuses with no role', (fn) => {
    const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain("'code', 'no-role'");
    expect(body).toContain("'code', 'insufficient-role'");
  });

  it.each(enforcers)('%s locks its target row FOR UPDATE before deciding', (fn) => {
    const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toMatch(/for update/);
  });

  it.each(enforcers)('%s rolls back a partial multi-step failure', (fn) => {
    const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    // The inner exception block is what makes the rollback real: without it a
    // mid-way `return` would COMMIT the steps that already ran.
    expect(body).toMatch(/exception when (sqlstate 'NW001'|others) then/);
    expect(body).toContain("'rolledBack', true");
  });

  it.each(enforcers)('%s writes an audit row', (fn) => {
    const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain('public.nw_console_audit_append(');
  });
});

describe('least privilege on every new function and table', () => {
  it('grants each new function to service_role only', () => {
    const created = [
      ...MIGRATION.matchAll(/create or replace function public\.([a-z_]+)\(/g),
    ].map((match) => match[1]!);
    expect(created.length).toBeGreaterThan(15);
    const missing = created.filter((name) => {
      // Trigger functions are not callable by grantees; they need no grant.
      if (
        name === 'nw_console_bump_version' ||
        name === 'nw_console_audit_seal' ||
        name === 'nw_console_audit_immutable'
      ) {
        return false;
      }
      const revoked = MIGRATION.includes(`revoke all on function public.${name}(`);
      const granted = MIGRATION.includes(`grant execute on function public.${name}(`);
      return !revoked || !granted;
    });
    expect(missing).toEqual([]);
  });

  it('revokes every new table from public, anon, and authenticated', () => {
    const tables = [
      'nw_moderator_roles',
      'nw_console_audit',
      'nw_console_action_tokens',
      'nw_pending_actions',
      'nw_queue_assignments',
      'nw_moderation_appeals',
    ];
    for (const table of tables) {
      expect(MIGRATION).toContain(`alter table public.${table} enable row level security`);
      expect(MIGRATION).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
      // Zero client policies: a CREATE POLICY on any of these would be a hole.
      expect(MIGRATION).not.toContain(`create policy nw_${table}`);
      expect(MIGRATION).not.toContain(`on public.${table}\n  for select using`);
    }
  });

  it('keeps the appeals view off client roles', () => {
    expect(MIGRATION).toContain(
      'revoke all on public.nw_console_appeals from public, anon, authenticated',
    );
  });
});

describe('audit chain', () => {
  it('hashes the same fields, in the same order, as the TypeScript verifier', () => {
    const start = MIGRATION.indexOf('create or replace function public.nw_console_audit_row_hash(');
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    const order = [...body.matchAll(/nw_console_audit_segment\((p_[a-z_]+)(?:::text)?\)/g)].map(
      (match) => match[1]!,
    );
    expect(order).toEqual([
      'p_prev_hash',
      'p_seq',
      'p_created_at_canonical',
      'p_actor_ref',
      'p_actor_role',
      'p_action',
      'p_target_kind',
      'p_target_id',
      'p_outcome',
      'p_reason',
      'p_payload_hash',
    ]);
  });

  it('length-prefixes each field with its OCTET count, matching Buffer.byteLength', () => {
    const start = MIGRATION.indexOf('create or replace function public.nw_console_audit_segment(');
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain("octet_length(coalesce(p_value, '')) || ':' || coalesce(p_value, '')");
  });

  it('is append-only by trigger, including truncate', () => {
    expect(MIGRATION).toContain('before update or delete on public.nw_console_audit');
    expect(MIGRATION).toContain('before truncate on public.nw_console_audit');
    expect(MIGRATION).toContain('nw_console_audit is append-only');
  });

  it('serializes appends so two writers cannot fork the chain', () => {
    const start = MIGRATION.indexOf('create or replace function public.nw_console_audit_seal(');
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain('pg_advisory_xact_lock(');
  });

  it('starts from a 64-zero genesis hash, matching the verifier', () => {
    expect(MIGRATION).toContain("repeat('0', 64)");
  });

  it('exports the exact payload text a verifier needs', () => {
    const start = MIGRATION.indexOf('create or replace function public.nw_console_audit_export(');
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain("'payloadText', payload::text");
    expect(body).toContain("'anchorPrevHash'");
    expect(body).toContain("'sqlVerification', public.nw_console_audit_verify(");
  });
});

describe('permanent suspension sentinel', () => {
  it('uses the same far-future timestamp as the console helper', () => {
    const start = MIGRATION.indexOf('create or replace function public.nw_console_permanent_until(');
    expect(start).toBeGreaterThan(-1);
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain(`'${PERMANENT_SUSPENSION_ISO}'::timestamptz`);
  });

  it('never passes a null `until` for a permanent suspension, which would LIFT the ban', () => {
    const start = MIGRATION.indexOf(
      'create or replace function public.nw_console_decide_pending_action(',
    );
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain('v_until := public.nw_console_permanent_until()');
    expect(body).toContain("message = 'bad-suspension'");
  });
});

describe('version columns', () => {
  it('adds console_version and a bump trigger to every console-facing queue table', () => {
    for (const table of [
      'nw_reports',
      'nw_ncii_cases',
      'nw_dmca_notices',
      'nw_dmca_counter_notices',
      'nw_screening_decisions',
      'nw_journalist_verifications',
      'nw_payout_accounts',
    ]) {
      expect(MIGRATION).toContain(`'${table}'`);
    }
    expect(MIGRATION).toContain('add column if not exists console_version integer not null default 1');
    expect(MIGRATION).toContain('before update on public.%I for each row execute function');
  });
});

describe('admin bootstrap', () => {
  it('works only while no active admin exists', () => {
    const start = MIGRATION.indexOf(
      'create or replace function public.nw_moderator_bootstrap_admin(',
    );
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain("where role = 'admin' and is_active");
    expect(body).toContain("'code', 'admin-exists'");
  });

  it('protects the last active admin from demotion and revocation', () => {
    for (const fn of ['nw_moderator_role_grant', 'nw_moderator_role_revoke']) {
      const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
      const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
      expect(body).toContain("'code', 'last-admin'");
    }
  });

  it('lets only an active admin change roles', () => {
    for (const fn of ['nw_moderator_role_grant', 'nw_moderator_role_revoke']) {
      const start = MIGRATION.indexOf(`create or replace function public.${fn}(`);
      const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
      expect(body).toContain("public.nw_moderator_role(v_actor) is distinct from 'admin'");
    }
  });
});

describe('appeals stay one record with two sources', () => {
  it('unions the moderation appeals with the WP8 screening appeal state', () => {
    const start = MIGRATION.indexOf('create or replace view public.nw_console_appeals as');
    const body = MIGRATION.slice(start, MIGRATION.indexOf(';\ngrant select on public.nw_console_appeals', start));
    expect(body).toContain('from public.nw_moderation_appeals a');
    expect(body).toContain('union all');
    expect(body).toContain('from public.nw_screening_decisions d');
    expect(body).toContain("where d.appeal_state <> 'none'");
    // No second appeal_state column anywhere: screening appeals are not copied.
    expect(MIGRATION).not.toContain('screening_appeal_state');
  });

  it('routes a screening appeal disposition through the WP8 RPC', () => {
    const start = MIGRATION.indexOf('create or replace function public.nw_console_enforce_screening(');
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain('public.nw_screening_appeal_disposition(');
  });

  it('reuses the same ownership branches as the v1 statement-of-reasons RPC', () => {
    const start = MIGRATION.indexOf(
      'create or replace function public.nw_moderation_action_is_owned(',
    );
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain("p_target_kind in ('article', 'revision')");
    expect(body).toContain("p_target_kind = 'suggestion'");
    expect(body).toContain("p_target_kind = 'profile'");
    expect(body).toContain('else false');
  });

  it('refuses to appeal a non-adverse action', () => {
    const start = MIGRATION.indexOf(
      'create or replace function public.nw_moderation_appeal_request(',
    );
    const body = MIGRATION.slice(start, MIGRATION.indexOf('$$;', start));
    expect(body).toContain("v_action in ('dismiss', 'restore')");
    expect(body).toContain("return 'not-appealable'");
    // A missing action and someone else's action answer identically.
    expect(body.match(/return 'not-found'/g)?.length).toBe(2);
  });
});
