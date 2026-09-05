import { describe, expect, it } from 'vitest';

import {
  flagKindToDecisionKind,
  planAppealReversal,
  requiresStatementOfReasons,
} from '../decisions';

describe('requiresStatementOfReasons', () => {
  it('requires a reason for negative decisions', () => {
    expect(requiresStatementOfReasons('rejected')).toBe(true);
    expect(requiresStatementOfReasons('hidden')).toBe(true);
    expect(requiresStatementOfReasons('removed')).toBe(true);
  });

  it('does not require a reason for positive or neutral decisions', () => {
    expect(requiresStatementOfReasons('approved')).toBe(false);
    expect(requiresStatementOfReasons('restored')).toBe(false);
    expect(requiresStatementOfReasons('dismissed')).toBe(false);
  });
});

describe('flagKindToDecisionKind', () => {
  it('maps content kinds straight through', () => {
    expect(flagKindToDecisionKind('submission')).toBe('submission');
    expect(flagKindToDecisionKind('comment')).toBe('comment');
    expect(flagKindToDecisionKind('profile')).toBe('profile');
    expect(flagKindToDecisionKind('media_asset')).toBe('media_asset');
    expect(flagKindToDecisionKind('vote_proof')).toBe('vote_proof');
  });

  it('aliases photo flags to media_asset, matching the server RPC contract', () => {
    expect(flagKindToDecisionKind('photo')).toBe('media_asset');
  });

  it('returns null for kinds without a decision path', () => {
    expect(flagKindToDecisionKind('dish_proposal')).toBeNull();
    expect(flagKindToDecisionKind('unknown_future_kind')).toBeNull();
  });
});

describe('planAppealReversal', () => {
  it('re-approves a rejected vote proof', () => {
    expect(planAppealReversal('vote_proof', 'p1', 'rejected')).toEqual({
      kind: 'vote_proof',
      targetId: 'p1',
      decision: 'approved',
    });
  });

  it('never plans a reversal for an approved vote proof', () => {
    expect(planAppealReversal('vote_proof', 'p1', 'approved')).toBeNull();
  });

  it('restores hidden/removed/rejected content', () => {
    expect(planAppealReversal('submission', 's1', 'hidden')).toEqual({
      kind: 'submission',
      targetId: 's1',
      decision: 'restored',
    });
    expect(planAppealReversal('comment', 'c1', 'removed')).toEqual({
      kind: 'comment',
      targetId: 'c1',
      decision: 'restored',
    });
    expect(planAppealReversal('media_asset', 'm1', 'rejected')).toEqual({
      kind: 'media_asset',
      targetId: 'm1',
      decision: 'restored',
    });
  });

  it('returns null when there is nothing to reverse', () => {
    expect(planAppealReversal('submission', 's1', 'approved')).toBeNull();
    expect(planAppealReversal('submission', 's1', 'dismissed')).toBeNull();
    expect(planAppealReversal('submission', 's1', 'restored')).toBeNull();
  });

  it('returns null for unknown kinds', () => {
    expect(planAppealReversal('dish_proposal', 'd1', 'hidden')).toBeNull();
  });
});
