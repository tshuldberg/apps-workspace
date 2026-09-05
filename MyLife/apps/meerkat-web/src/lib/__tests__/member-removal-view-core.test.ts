// Plan 28 P4 (web half): pure copy + count-to-phrase logic for the owner-only
// Remove control, byte-lockstep with the mobile source. Every phrase is derived
// ONLY from the real RemoveCommunityMemberResult counts; these tests lock the
// epoch-boundary honesty (NC-1) and the "never claim a park or republish that
// returned false" rule.

import { describe, expect, it } from 'vitest';
import type { RemoveCommunityMemberResult } from '@mylife/sync';
import {
  MEMBER_REMOVAL_CONFIRM_BODY,
  describeMemberRemovalFailure,
  describeMemberRemovalSuccess,
  memberRemovalConfirmTitle,
} from '../member-removal-view-core';

type Ok = Extract<RemoveCommunityMemberResult, { ok: true }>;
type Fail = Extract<RemoveCommunityMemberResult, { ok: false }>;

function ok(overrides: Partial<Ok> = {}): Ok {
  return {
    ok: true,
    revision: 2,
    epoch: 1,
    survivorsToNotify: 0,
    envelopesParked: 0,
    nodesAttempted: 0,
    nodesRepublished: 0,
    ...overrides,
  };
}

describe('web confirm copy', () => {
  it('titles the dialog with the person label', () => {
    expect(memberRemovalConfirmTitle('Ada')).toBe('Remove Ada?');
  });

  it('is epoch-boundary honest and never claims instant network-wide removal', () => {
    expect(MEMBER_REMOVAL_CONFIRM_BODY).toContain('as they receive the update');
    expect(MEMBER_REMOVAL_CONFIRM_BODY).toContain('content shared before removal stays on their device');
    expect(MEMBER_REMOVAL_CONFIRM_BODY.toLowerCase()).not.toContain('instantly');
    expect(MEMBER_REMOVAL_CONFIRM_BODY.toLowerCase()).not.toContain('everywhere');
  });
});

describe('web describeMemberRemovalSuccess', () => {
  it('reports no other members when there are no keyed survivors', () => {
    expect(describeMemberRemovalSuccess(ok({ survivorsToNotify: 0, envelopesParked: 0 }), 'Bo')).toBe(
      'Removed Bo. No other members needed the update.',
    );
  });

  it('reports all queued when every envelope parked', () => {
    const msg = describeMemberRemovalSuccess(ok({ survivorsToNotify: 3, envelopesParked: 3 }), 'Bo');
    expect(msg).toContain('Removed Bo.');
    expect(msg).toContain('Update queued for 3 remaining members');
  });

  it('uses the singular member noun when exactly one survivor was queued', () => {
    expect(describeMemberRemovalSuccess(ok({ survivorsToNotify: 1, envelopesParked: 1 }), 'Bo')).toContain(
      '1 remaining member;',
    );
  });

  it('reports a partial queue honestly (never claims the unparked envelopes landed)', () => {
    const msg = describeMemberRemovalSuccess(ok({ survivorsToNotify: 3, envelopesParked: 1 }), 'Bo');
    expect(msg).toContain('Update queued for 1 of 3 remaining members');
    expect(msg).toContain('the other 2 converge as their devices reconnect');
  });

  it('reports zero parked as not-yet-queued, never as delivered', () => {
    const msg = describeMemberRemovalSuccess(ok({ survivorsToNotify: 2, envelopesParked: 0 }), 'Bo');
    expect(msg).toContain('Could not queue the update for the 2 remaining members yet');
    expect(msg).not.toContain('queued for 0');
  });

  it('claims a hosted server update ONLY when a republish really succeeded', () => {
    const updated = describeMemberRemovalSuccess(
      ok({ survivorsToNotify: 1, envelopesParked: 1, nodesAttempted: 1, nodesRepublished: 1 }),
      'Bo',
    );
    expect(updated).toContain('1 hosted community server updated.');

    const failed = describeMemberRemovalSuccess(
      ok({ survivorsToNotify: 1, envelopesParked: 1, nodesAttempted: 2, nodesRepublished: 0 }),
      'Bo',
    );
    expect(failed).toContain('Could not reach the hosted community servers');
    expect(failed).not.toContain('updated.');
  });

  it('omits the hosted line entirely when no node republish was attempted', () => {
    const msg = describeMemberRemovalSuccess(
      ok({ survivorsToNotify: 1, envelopesParked: 1, nodesAttempted: 0, nodesRepublished: 0 }),
      'Bo',
    );
    expect(msg.toLowerCase()).not.toContain('hosted community');
  });

  it('clamps nonsense counts to a safe count-free phrasing (parked > survivors)', () => {
    const msg = describeMemberRemovalSuccess(ok({ survivorsToNotify: 2, envelopesParked: 3 }), 'Bo');
    expect(msg).toBe('Removed Bo. The update reaches the other members as their devices connect.');
    expect(msg).not.toContain('of 2');
    expect(msg).not.toContain('-1');
  });

  it('clamps negative and non-integer counts to the safe fallback', () => {
    expect(describeMemberRemovalSuccess(ok({ survivorsToNotify: -1 }), 'Bo')).toContain('as their devices connect.');
    expect(describeMemberRemovalSuccess(ok({ survivorsToNotify: 2, envelopesParked: 1.5 }), 'Bo')).toContain('as their devices connect.');
    expect(describeMemberRemovalSuccess(ok({ survivorsToNotify: 2, envelopesParked: Number.NaN }), 'Bo')).toContain('as their devices connect.');
  });

  it('clamps a nonsense node count (republished > attempted) to the safe fallback', () => {
    const msg = describeMemberRemovalSuccess(
      ok({ survivorsToNotify: 1, envelopesParked: 1, nodesAttempted: 1, nodesRepublished: 2 }),
      'Bo',
    );
    expect(msg).toBe('Removed Bo. The update reaches the other members as their devices connect.');
  });
});

describe('web describeMemberRemovalFailure', () => {
  it('maps every reason code to an honest error (never a success)', () => {
    const reasons: Fail['reason'][] = ['not_owner', 'cannot_remove_owner', 'not_a_member', 'unknown_community'];
    for (const reason of reasons) {
      const msg = describeMemberRemovalFailure({ ok: false, reason }, 'Bo');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg.toLowerCase()).not.toContain('removed bo');
    }
  });

  it('names the person for a stale-roster failure', () => {
    expect(describeMemberRemovalFailure({ ok: false, reason: 'not_a_member' }, 'Bo')).toContain('Bo');
  });

  it('refuses non-owners honestly', () => {
    expect(describeMemberRemovalFailure({ ok: false, reason: 'not_owner' }, 'Bo')).toContain('owner');
  });

  it('surfaces an out-of-union reason honestly instead of a silent no-op', () => {
    expect(describeMemberRemovalFailure({ ok: false, reason: 'bogus' as never }, 'Bo')).toBe('Could not remove this member.');
  });
});
