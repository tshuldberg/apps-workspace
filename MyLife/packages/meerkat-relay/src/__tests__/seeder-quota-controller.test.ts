/**
 * WP-43B seeder quota + retention controller tests (pure core).
 *
 * Proves: node/tenant cap admission is honest (exact over-quota state, never a silent drop);
 * eviction reclaims only UNPINNED, UNREFERENCED, past-retention objects, oldest first, down to the
 * reclaim target; a pinned or referenced object is NEVER evicted; over-quota is surfaced honestly
 * when nothing safe is left to evict.
 */

import { describe, expect, it } from 'vitest';
import {
  admitPin,
  planEviction,
  type SeederInventoryObject,
  type SeederQuotaPolicy,
} from '../seeder-quota-controller';

const NOW = Date.parse('2026-07-11T12:00:00.000Z');

const policy: SeederQuotaPolicy = {
  nodeCapBytes: 1_000,
  tenantCapBytes: 400,
  retentionMs: 60_000,
  targetUtilization: 0.8,
};

function object(over: Partial<SeederInventoryObject> = {}): SeederInventoryObject {
  return {
    objectKey: 'key-1',
    tenantId: 'tenant-a',
    sizeBytes: 100,
    pinned: false,
    referenced: false,
    lastActiveAt: new Date(NOW - 120_000).toISOString(),
    ...over,
  };
}

describe('admitPin quota admission', () => {
  it('admits a pin within both caps', () => {
    const result = admitPin({
      inventory: [object({ objectKey: 'a', sizeBytes: 100 })], policy, tenantId: 'tenant-a', addBytes: 100,
    });
    expect(result.status).toBe('admitted');
    if (result.status !== 'admitted') throw new Error('unreachable');
    expect(result.tenantBytesAfter).toBe(200);
    expect(result.nodeBytesAfter).toBe(200);
  });

  it('refuses honestly when the tenant cap would be exceeded', () => {
    const result = admitPin({
      inventory: [object({ objectKey: 'a', sizeBytes: 350 })], policy, tenantId: 'tenant-a', addBytes: 100,
    });
    expect(result).toEqual({ status: 'over_tenant_quota', tenantBytes: 350, tenantCapBytes: 400 });
  });

  it('refuses honestly when the node cap would be exceeded', () => {
    const inventory = [
      object({ objectKey: 'a', tenantId: 'tenant-a', sizeBytes: 300 }),
      object({ objectKey: 'b', tenantId: 'tenant-b', sizeBytes: 650 }),
    ];
    const result = admitPin({ inventory, policy, tenantId: 'tenant-a', addBytes: 100 });
    expect(result).toEqual({ status: 'over_node_quota', nodeBytes: 950, nodeCapBytes: 1_000 });
  });
});

describe('planEviction retention', () => {
  it('evicts unpinned, unreferenced, past-retention objects oldest first down to the target', () => {
    const inventory = [
      object({ objectKey: 'oldest', sizeBytes: 300, lastActiveAt: new Date(NOW - 300_000).toISOString() }),
      object({ objectKey: 'mid', sizeBytes: 300, lastActiveAt: new Date(NOW - 200_000).toISOString() }),
      object({ objectKey: 'newish', sizeBytes: 300, lastActiveAt: new Date(NOW - 100_000).toISOString() }),
      object({ objectKey: 'in-retention', sizeBytes: 300, lastActiveAt: new Date(NOW - 10_000).toISOString() }),
    ];
    // node holds 1200 > cap 1000; reclaim target = 0.8 * 1000 = 800. Evict oldest until <= 800.
    const plan = planEviction({ inventory, policy, nowMs: NOW, maxEvictions: 10 });
    // 1200 -> evict oldest(300)=900 -> evict mid(300)=600 <= 800, stop.
    expect(plan.evict.map((e) => e.objectKey)).toEqual(['oldest', 'mid']);
    expect(plan.nodeBytesAfter).toBe(600);
    expect(plan.stillOverQuota).toBe(false);
    // The in-retention object was never eligible.
    expect(plan.evict.some((e) => e.objectKey === 'in-retention')).toBe(false);
  });

  it('never evicts a pinned or referenced object, surfacing still-over-quota honestly', () => {
    const inventory = [
      object({ objectKey: 'pinned', sizeBytes: 600, pinned: true, lastActiveAt: new Date(NOW - 300_000).toISOString() }),
      object({ objectKey: 'referenced', sizeBytes: 600, referenced: true, lastActiveAt: new Date(NOW - 300_000).toISOString() }),
    ];
    // 1200 > cap 1000, but BOTH objects are protected: nothing evictable.
    const plan = planEviction({ inventory, policy, nowMs: NOW, maxEvictions: 10 });
    expect(plan.evict).toHaveLength(0);
    expect(plan.bytesReclaimed).toBe(0);
    expect(plan.stillOverQuota).toBe(true);
  });

  it('bounds the eviction batch to maxEvictions', () => {
    const inventory = Array.from({ length: 5 }, (_, i) =>
      object({ objectKey: `k-${i}`, sizeBytes: 300, lastActiveAt: new Date(NOW - (300_000 + i)).toISOString() }));
    const plan = planEviction({ inventory, policy, nowMs: NOW, maxEvictions: 2 });
    expect(plan.evict).toHaveLength(2);
  });

  it('evicts nothing when already at or below the reclaim target', () => {
    const inventory = [object({ objectKey: 'a', sizeBytes: 500, lastActiveAt: new Date(NOW - 300_000).toISOString() })];
    const plan = planEviction({ inventory, policy, nowMs: NOW, maxEvictions: 10 });
    expect(plan.evict).toHaveLength(0);
    expect(plan.stillOverQuota).toBe(false);
  });
});
