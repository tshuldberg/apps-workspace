import { describe, expect, it } from 'vitest';
import {
  buildAlphaDiagnostics,
  buildAlphaReadinessItems,
} from '../(root)/data/alpha-readiness';

describe('alpha readiness helper', () => {
  it('marks missing relay, pair, and SAS work as action items', () => {
    const items = buildAlphaReadinessItems({
      relayUrl: null,
      pairedDeviceCount: 0,
      verifiedPeerCount: 0,
      completedSessionCount: 0,
      pendingChanges: 2,
      fileSaveDestinationConfigured: false,
      platformOS: 'android',
    });

    expect(items.map((item) => [item.id, item.state])).toEqual([
      ['relay', 'needs_action'],
      ['pairing', 'needs_action'],
      ['sas', 'blocked'],
      ['session', 'manual'],
      ['pending', 'manual'],
      ['files', 'needs_action'],
    ]);
  });

  it('marks configured and verified local state as ready without hiding manual checks', () => {
    const items = buildAlphaReadinessItems({
      relayUrl: 'wss://relay.example.test',
      pairedDeviceCount: 2,
      verifiedPeerCount: 1,
      completedSessionCount: 3,
      pendingChanges: 0,
      fileSaveDestinationConfigured: true,
      platformOS: 'android',
    });

    expect(items.map((item) => [item.id, item.state])).toEqual([
      ['relay', 'ready'],
      ['pairing', 'ready'],
      ['sas', 'ready'],
      ['session', 'ready'],
      ['pending', 'ready'],
      ['files', 'ready'],
    ]);
  });

  it('drives the files item from the configured save destination on Android', () => {
    const base = {
      relayUrl: null,
      pairedDeviceCount: 0,
      verifiedPeerCount: 0,
      completedSessionCount: 0,
      pendingChanges: 0,
      platformOS: 'android' as const,
    };
    const notConfigured = buildAlphaReadinessItems({ ...base, fileSaveDestinationConfigured: false });
    const configured = buildAlphaReadinessItems({ ...base, fileSaveDestinationConfigured: true });
    expect(notConfigured.find((item) => item.id === 'files')?.state).toBe('needs_action');
    expect(configured.find((item) => item.id === 'files')?.state).toBe('ready');
  });

  it('keeps the files item ready on iOS via the always-available share sheet', () => {
    const items = buildAlphaReadinessItems({
      relayUrl: null,
      pairedDeviceCount: 0,
      verifiedPeerCount: 0,
      completedSessionCount: 0,
      pendingChanges: 0,
      fileSaveDestinationConfigured: false,
      platformOS: 'ios',
    });
    const files = items.find((item) => item.id === 'files');
    expect(files?.state).toBe('ready');
    expect(files?.detail).toContain('share sheet');
  });

  it('builds copyable diagnostics without full device ids or secrets', () => {
    const diagnostics = buildAlphaDiagnostics({
      generatedAt: '2026-06-14T12:00:00.000Z',
      deviceName: 'Phone',
      deviceShortId: 'abcd1234',
      engineState: 'idle',
      relayUrl: 'ws://127.0.0.1:8787',
      pairedDeviceCount: 1,
      verifiedPeerCount: 1,
      recentSessionCount: 2,
      completedSessionCount: 1,
      pendingChanges: 0,
      fileSaveDestinationConfigured: true,
      rungSummaries: ['relay 1/2', 'lan 0/1'],
      pinnedCount: 3,
      blockCount: 8,
      storedBytes: '12 KB',
    });

    expect(diagnostics).toContain('Device: Phone (abcd1234)');
    expect(diagnostics).toContain('Relay configured: yes');
    expect(diagnostics).toContain('Transport rungs: relay 1/2; lan 0/1');
    expect(diagnostics).not.toContain('ws://127.0.0.1:8787');
  });
});
