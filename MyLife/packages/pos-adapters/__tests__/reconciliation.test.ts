import { describe, it, expect } from 'vitest';
import { diffRecords, buildReconciliationResult } from '../src/reconciliation';

describe('reconciliation', () => {
  describe('diffRecords', () => {
    it('detects missing local records', () => {
      const local = [{ externalId: 'a', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' }];
      const remote = [
        { externalId: 'a', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' },
        { externalId: 'b', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' },
      ];

      const mismatches = diffRecords(local, remote);
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0].externalId).toBe('b');
      expect(mismatches[0].localStatus).toBeNull();
      expect(mismatches[0].action).toBe('create_local');
    });

    it('detects status mismatch with newer remote winning', () => {
      const local = [{ externalId: 'a', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' }];
      const remote = [{ externalId: 'a', status: 'cancelled', updatedAt: '2024-01-02T00:00:00Z' }];

      const mismatches = diffRecords(local, remote);
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0].action).toBe('update_local');
      expect(mismatches[0].localStatus).toBe('confirmed');
      expect(mismatches[0].remoteStatus).toBe('cancelled');
    });

    it('detects status mismatch with newer local winning', () => {
      const local = [{ externalId: 'a', status: 'seated', updatedAt: '2024-01-03T00:00:00Z' }];
      const remote = [{ externalId: 'a', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' }];

      const mismatches = diffRecords(local, remote);
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0].action).toBe('update_remote');
    });

    it('returns empty array when records match', () => {
      const records = [{ externalId: 'a', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' }];
      const mismatches = diffRecords(records, records);
      expect(mismatches).toHaveLength(0);
    });
  });

  describe('buildReconciliationResult', () => {
    it('builds a complete result object', () => {
      const local = [{ externalId: 'a', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' }];
      const remote = [
        { externalId: 'a', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' },
        { externalId: 'b', status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' },
      ];

      const result = buildReconciliationResult('conn-1', local, remote, 0);
      expect(result.connectionId).toBe('conn-1');
      expect(result.localCount).toBe(1);
      expect(result.remoteCount).toBe(2);
      expect(result.mismatches).toHaveLength(1);
      expect(result.repaired).toBe(0);
      expect(result.checkedAt).toBeTruthy();
    });
  });
});
