import { describe, expect, it } from 'vitest';

import {
  ACTION_MIN_ROLE,
  DUAL_CONTROL_SUSPENSION_DAYS,
  PENDING_APPROVAL_MIN_ROLE,
  PENDING_KINDS,
  ROLE_RANK,
  actionMinRole,
  canApproveOwnProposal,
  canApprovePending,
  canRunAction,
  hasLevel,
  isModeratorRole,
  isPendingActionKind,
  readRoleLookup,
  roleRank,
  suspensionNeedsDualControl,
} from '../roles';

/**
 * Console RBAC policy (plan 48 WP9). These tests cover the containment cases:
 * what a compromised reviewer account cannot do, and what an unknown role cannot
 * do. The SQL enforces the same levels; console-policy.test.ts pins the two.
 */

describe('role ranks', () => {
  it('orders admin above senior above reviewer', () => {
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.senior);
    expect(ROLE_RANK.senior).toBeGreaterThan(ROLE_RANK.reviewer);
    expect(ROLE_RANK.reviewer).toBeGreaterThan(0);
  });

  it.each([null, undefined, '', 'ADMIN', 'owner', 'superuser', 'none'])(
    'ranks %p as zero, so it clears nothing',
    (value) => {
      expect(roleRank(value as string | null)).toBe(0);
      expect(hasLevel(value as string | null, 'reviewer')).toBe(false);
    },
  );

  it('recognises only the three real roles', () => {
    expect(isModeratorRole('admin')).toBe(true);
    expect(isModeratorRole('senior')).toBe(true);
    expect(isModeratorRole('reviewer')).toBe(true);
    expect(isModeratorRole('Admin')).toBe(false);
    expect(isModeratorRole(3)).toBe(false);
    expect(isModeratorRole(null)).toBe(false);
  });

  it('lets a higher role do everything a lower one can', () => {
    for (const action of Object.keys(ACTION_MIN_ROLE)) {
      if (canRunAction('reviewer', action)) {
        expect(canRunAction('senior', action)).toBe(true);
        expect(canRunAction('admin', action)).toBe(true);
      }
      if (canRunAction('senior', action)) expect(canRunAction('admin', action)).toBe(true);
    }
  });
});

describe('compromised reviewer containment', () => {
  const forbidden = [
    'suspend_profile',
    'strike_author',
    'ncii_clear',
    'verification_revoke',
    'appeal_grant',
    'appeal_deny',
    'dmca_close',
    'dmca_litigation_hold',
    'dmca_restore_content',
    'propose_pending',
    'role_grant',
    'role_revoke',
    'payout_block',
    'payout_unblock',
    'audit_export',
  ];

  it.each(forbidden)('a reviewer cannot run %s', (action) => {
    expect(canRunAction('reviewer', action)).toBe(false);
  });

  it('a reviewer can still do the per-item content work', () => {
    for (const action of ['hide_article', 'hide_suggestion', 'dismiss', 'screening_approve']) {
      expect(canRunAction('reviewer', action)).toBe(true);
    }
  });

  it('a reviewer cannot approve any dual-control action', () => {
    for (const kind of PENDING_KINDS) {
      expect(canApprovePending('reviewer', kind)).toBe(false);
    }
  });

  it('a senior cannot approve the admin-only kinds', () => {
    expect(canApprovePending('senior', 'terminate_account')).toBe(false);
    expect(canApprovePending('senior', 'payout_block')).toBe(false);
    expect(canApprovePending('senior', 'payout_unblock')).toBe(false);
    expect(canApprovePending('senior', 'suspend_long')).toBe(true);
    expect(canApprovePending('senior', 'restore_content')).toBe(true);
  });

  it('nobody approves their own proposal, whatever their role', () => {
    expect(canApproveOwnProposal()).toBe(false);
  });
});

describe('unknown actions and kinds', () => {
  it('treats an unregistered action as admin-only, so a new action is harder not easier', () => {
    expect(actionMinRole('some_action_nobody_registered')).toBe('admin');
    expect(canRunAction('reviewer', 'some_action_nobody_registered')).toBe(false);
    expect(canRunAction('senior', 'some_action_nobody_registered')).toBe(false);
    expect(canRunAction('admin', 'some_action_nobody_registered')).toBe(true);
  });

  it('recognises only the five real pending kinds', () => {
    for (const kind of PENDING_KINDS) expect(isPendingActionKind(kind)).toBe(true);
    expect(isPendingActionKind('delete_everything')).toBe(false);
    expect(isPendingActionKind(null)).toBe(false);
  });

  it('assigns an approval floor to every pending kind', () => {
    for (const kind of PENDING_KINDS) {
      expect(PENDING_APPROVAL_MIN_ROLE[kind]).toBeDefined();
    }
  });
});

describe('suspensionNeedsDualControl', () => {
  const now = Date.parse('2026-07-30T12:00:00.000Z');
  const inDays = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

  it('always needs a second moderator for a permanent suspension', () => {
    expect(suspensionNeedsDualControl({ permanent: true, untilIso: null, nowMs: now })).toBe(true);
  });

  it('does not for exactly the 7-day preset', () => {
    expect(
      suspensionNeedsDualControl({ permanent: false, untilIso: inDays(7), nowMs: now }),
    ).toBe(false);
  });

  it('does for anything past 7 days', () => {
    expect(
      suspensionNeedsDualControl({ permanent: false, untilIso: inDays(7.5), nowMs: now }),
    ).toBe(true);
    expect(suspensionNeedsDualControl({ permanent: false, untilIso: inDays(30), nowMs: now })).toBe(
      true,
    );
    expect(suspensionNeedsDualControl({ permanent: false, untilIso: inDays(90), nowMs: now })).toBe(
      true,
    );
  });

  it('reads a missing or unparseable end date as single-moderator, because the RPC refuses it outright', () => {
    // The console never routes such a value to enforcement: readCommon rejects a
    // malformed form and the RPC returns 'bad-suspension'. This function is only
    // asked whether a VALID length needs escalation, so the honest answer for
    // garbage is "not a long suspension", not "a long suspension".
    expect(suspensionNeedsDualControl({ permanent: false, untilIso: null, nowMs: now })).toBe(false);
    expect(
      suspensionNeedsDualControl({ permanent: false, untilIso: 'not a date', nowMs: now }),
    ).toBe(false);
  });

  it('uses 7 days as the documented threshold', () => {
    expect(DUAL_CONTROL_SUSPENSION_DAYS).toBe(7);
  });
});

describe('readRoleLookup', () => {
  it('reads a known role', () => {
    expect(readRoleLookup('senior', false)).toEqual({ status: 'ok', role: 'senior' });
  });

  it('reads an unknown value as NO role, so a corrupted value grants nothing', () => {
    for (const value of [null, undefined, '', 'owner', 'ADMIN', 3, {}, ['admin']]) {
      expect(readRoleLookup(value, false)).toEqual({ status: 'ok', role: null });
    }
  });

  it('distinguishes a FAILED read from "no role"', () => {
    // Both refuse every action, but they are different facts. Telling a moderator
    // during a database outage that their access was revoked would be false.
    expect(readRoleLookup(null, true)).toEqual({ status: 'unavailable' });
    expect(readRoleLookup('admin', true)).toEqual({ status: 'unavailable' });
    expect(readRoleLookup(null, false)).toEqual({ status: 'ok', role: null });
  });

  it('never returns a role from a failed read, whatever the payload said', () => {
    const lookup = readRoleLookup('admin', true);
    expect(lookup.status).toBe('unavailable');
    expect('role' in lookup).toBe(false);
  });
});
