import { describe, expect, it } from 'vitest';
import {
  TRANSPORT_POLICY_LABELS,
  TRANSPORT_POLICY_MEANINGS,
  formatPolicyChangeNotice,
  type PolicyHistoryRow,
} from '../policy-history';

describe('web policy-history copy twin', () => {
  it('carries the Plan 27 policy labels and honest meanings', () => {
    expect(TRANSPORT_POLICY_LABELS).toEqual({
      local_only: 'In person only',
      local_preferred: 'Local preferred',
      any: 'Any connection',
    });
    expect(TRANSPORT_POLICY_MEANINGS.local_only).toBe(
      'This community only updates in person or on a shared network.',
    );
  });

  it('formats the same one-line member notice as mobile', () => {
    const change: PolicyHistoryRow = {
      id: 'community:2',
      communityId: 'community',
      policy: 'any',
      previousPolicy: 'local_only',
      revision: 2,
      recordedAt: '2026-07-05T00:00:00.000Z',
    };
    expect(formatPolicyChangeNotice(change)).toBe(
      'The owner changed the sync policy from In person only to Any connection.',
    );
  });
});
