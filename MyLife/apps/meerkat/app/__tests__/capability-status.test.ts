// Capability-status honesty (Plan 31 Phase 4, T4.1). No entry may claim "live"
// for a capability whose flag/substrate is absent; the DM + default-server
// statuses are derived from the real flags.

import { describe, expect, it } from 'vitest';
import { DM_MESSAGES_SURFACE_AVAILABLE } from '../(root)/data/share-route';
import { DEFAULT_RELAY_URL } from '../(root)/data/sync-core';
import { getCapabilityStatus } from '../(root)/data/capability-status';

describe('getCapabilityStatus honesty', () => {
  const entries = getCapabilityStatus();

  it('DM status tracks DM_MESSAGES_SURFACE_AVAILABLE and never overclaims', () => {
    const dm = entries.find((e) => e.id === 'dms');
    expect(dm).toBeDefined();
    expect(dm!.status).toBe(DM_MESSAGES_SURFACE_AVAILABLE ? 'live' : 'pending');
    if (!DM_MESSAGES_SURFACE_AVAILABLE) expect(dm!.status).not.toBe('live');
  });

  it('the free default server is never "live" while none is configured', () => {
    const ds = entries.find((e) => e.id === 'default_server');
    expect(ds).toBeDefined();
    if (DEFAULT_RELAY_URL.length === 0) expect(ds!.status).toBe('pending');
    expect(ds!.status).not.toBe('live');
  });

  it('calls are pending (not built)', () => {
    expect(entries.find((e) => e.id === 'calls')!.status).toBe('pending');
  });

  it('every entry has a non-empty honest line and a known status', () => {
    for (const e of entries) {
      expect(e.line.trim().length).toBeGreaterThan(0);
      expect(['live', 'partial', 'pending']).toContain(e.status);
    }
  });
});
