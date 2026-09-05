// Web capability-status honesty (Plan 31 Phase 4 web twin). No entry may claim
// "live" for a capability whose flag/substrate is absent.

import { describe, expect, it } from 'vitest';
import { DEFAULT_RELAY_URL } from '../relay';
import { DM_MESSAGES_SURFACE_ENABLED } from '../dm-surface';
import { getCapabilityStatus } from '../capability-status';

describe('web getCapabilityStatus honesty', () => {
  const entries = getCapabilityStatus();

  it('DM status tracks DM_MESSAGES_SURFACE_ENABLED and never overclaims', () => {
    const dm = entries.find((e) => e.id === 'dms');
    expect(dm).toBeDefined();
    expect(dm!.status).toBe(DM_MESSAGES_SURFACE_ENABLED ? 'live' : 'pending');
    if (!DM_MESSAGES_SURFACE_ENABLED) expect(dm!.status).not.toBe('live');
  });

  it('the free default server is never "live" while none is configured', () => {
    const ds = entries.find((e) => e.id === 'default_server');
    expect(ds).toBeDefined();
    if (DEFAULT_RELAY_URL.length === 0) expect(ds!.status).toBe('pending');
    expect(ds!.status).not.toBe('live');
  });

  it('calls are pending, and every entry has a line + known status', () => {
    expect(entries.find((e) => e.id === 'calls')!.status).toBe('pending');
    for (const e of entries) {
      expect(e.line.trim().length).toBeGreaterThan(0);
      expect(['live', 'partial', 'pending']).toContain(e.status);
    }
  });
});
