import { describe, expect, it } from 'vitest';

import {
  CONSOLE_RESULT_COPY,
  describeResult,
  describeSuccess,
  mapConsoleResult,
  resultCode,
} from '../console-result';

/**
 * Envelope mapping (plan 48 WP9). The rule under test is fail-closed: nothing
 * except `{ok: true, code: '...'}` may read as a success, because a moderator
 * being told an enforcement landed when it did not is worse than an error.
 */

describe('mapConsoleResult: successes', () => {
  it('maps a plain success', () => {
    const result = mapConsoleResult({ ok: true, code: 'article-hidden' });
    expect(result.ok).toBe(true);
    expect(result.code).toBe('article-hidden');
  });

  it('carries the pending id through a dual-control interception', () => {
    const result = mapConsoleResult({
      ok: true,
      code: 'pending-approval',
      pendingId: 'aaaaaaaa-0000-0000-0000-000000000001',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pendingId).toBe('aaaaaaaa-0000-0000-0000-000000000001');
  });

  it('carries the execution outcome and the reversal note', () => {
    const approved = mapConsoleResult({
      ok: true,
      code: 'pending-approved',
      outcome: 'account-terminated',
    });
    if (approved.ok) expect(approved.outcome).toBe('account-terminated');
    const granted = mapConsoleResult({
      ok: true,
      code: 'appeal-granted',
      reversal: 'article-republished',
    });
    if (granted.ok) expect(granted.reversal).toBe('article-republished');
  });
});

describe('mapConsoleResult: failures', () => {
  it('carries the current version on a stale action, so the page can say what changed', () => {
    const result = mapConsoleResult({ ok: false, code: 'stale-action', currentVersion: 9 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('stale-action');
      expect(result.currentVersion).toBe(9);
    }
  });

  it('carries the original outcome on a replay', () => {
    const result = mapConsoleResult({
      ok: false,
      code: 'replayed',
      original: { ok: true, code: 'article-hidden' },
    });
    if (!result.ok) expect(result.original).toEqual({ ok: true, code: 'article-hidden' });
  });

  it('flags a rolled-back multi-step action', () => {
    const result = mapConsoleResult({ ok: false, code: 'not-found', rolledBack: true });
    if (!result.ok) expect(result.rolledBack).toBe(true);
  });

  it('ignores a non-numeric currentVersion instead of coercing it', () => {
    const result = mapConsoleResult({ ok: false, code: 'stale-action', currentVersion: '9' });
    if (!result.ok) expect(result.currentVersion).toBeNull();
  });
});

describe('mapConsoleResult: fails closed', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'ok'],
    ['a number', 1],
    ['an array', [{ ok: true, code: 'article-hidden' }]],
    ['an empty object', {}],
    ['ok:true with no code', { ok: true }],
    ['ok:true with an empty code', { ok: true, code: '' }],
    ['a truthy non-boolean ok', { ok: 1, code: 'article-hidden' }],
    ['the string "true"', { ok: 'true', code: 'article-hidden' }],
    ['a missing ok field', { code: 'article-hidden' }],
  ])('treats %s as a failure', (_label, value) => {
    const result = mapConsoleResult(value);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('rpc_failed');
  });

  it('keeps a named code on an explicit ok:false even with no other fields', () => {
    const result = mapConsoleResult({ ok: false, code: 'insufficient-role' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('insufficient-role');
  });

  it('falls back to rpc_failed on ok:false with no code', () => {
    expect(mapConsoleResult({ ok: false }).code).toBe('rpc_failed');
  });
});

describe('resultCode', () => {
  it('converts hyphens to underscores for a redirect query string', () => {
    expect(resultCode(mapConsoleResult({ ok: false, code: 'stale-action' }))).toBe('stale_action');
    expect(resultCode(mapConsoleResult({ ok: true, code: 'appeal-granted-stale' }))).toBe(
      'appeal_granted_stale',
    );
  });
});

describe('operator copy', () => {
  it('explains every code the RPCs can return', () => {
    // The list mirrors the codes in migration 20260730000010. A code with no copy
    // would surface to a moderator as a bare machine string.
    const codes = [
      'article_hidden',
      'suggestion_hidden',
      'profile_suspended',
      'report_dismissed',
      'author_struck',
      'author_suspended_repeat',
      'pending_approval',
      'removed',
      'escalated',
      'cleared',
      'screening_approved',
      'screening_approved_stale',
      'screening_rejected',
      'appeal_granted',
      'appeal_granted_stale',
      'appeal_denied',
      'verification_approved',
      'verification_denied',
      'verification_revoked',
      'pending_approved',
      'pending_rejected',
      'cancelled',
      'assigned',
      'granted',
      'revoked',
      'bootstrapped',
      'no_role',
      'insufficient_role',
      'bad_reason',
      'bad_token',
      'bad_action',
      'confirm_required',
      'expiry_required',
      'bad_suspension',
      'same_moderator',
      'self_approval',
      'not_proposer',
      'stale_action',
      'replayed',
      'already_decided',
      'already_cleared',
      'not_open',
      'expired',
      'not_found',
      'wrong_target_kind',
      'no_payout_account',
      'not_blocked',
      'nothing_to_block',
      'reversal_failed',
      'rpc_failed',
      'admin_exists',
      'last_admin',
      'not_admin',
      'bad_role',
      'bad_ref',
      'bad_level',
      'assigned_elsewhere',
      'assignee_no_role',
    ];
    const missing = codes.filter((code) => !CONSOLE_RESULT_COPY[code]);
    expect(missing).toEqual([]);
  });

  it('says plainly that nothing completed for an unnamed failure', () => {
    expect(describeResult('some_new_code')).toBe('The action did not complete (some_new_code).');
  });

  it('does not dress up an unnamed failure as a success', () => {
    expect(describeResult('some_new_code')).not.toContain('Done');
  });

  it('describes counted successes from their shape', () => {
    expect(describeSuccess('expired_1')).toContain('1 lapsed record');
    expect(describeSuccess('expired_4')).toContain('4 lapsed records');
    expect(describeSuccess('rings_2')).toContain('2 profiles flagged');
    expect(describeSuccess('rings_1')).toContain('1 profile flagged');
  });

  it('falls back to a plain done for an unnamed success', () => {
    expect(describeSuccess('brand_new_outcome')).toBe('Done (brand_new_outcome).');
  });

  it('explains a replay as already-applied rather than as an error', () => {
    expect(describeResult('replayed')).toContain('already applied');
  });

  it('explains a pending approval as not-yet-in-effect', () => {
    expect(describeSuccess('pending_approval')).toContain('second moderator');
  });
});
