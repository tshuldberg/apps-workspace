/**
 * Plan 29 Phase 1 (T1.1): the PURE planner. Skip rules, the backoff ladder, the
 * lower-deviceId-initiates rule, LAN-preferred-when-discovered ordering, and the
 * Plan 27 transport-policy seam, all without touching a db or the network.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUTO_CONNECT_POLICY,
  LAN_LAYER_ID,
  RELAY_LAYER_ID,
  nextBackoffMs,
  planAutoConnectRound,
  type AutoConnectPeerInput,
  type PlanAutoConnectRoundInput,
} from '../engine/auto-connect';
import type { AutoConnectState } from '../db/queries';

const NOW = 1_800_000_000_000;
const SELF = 'aaaa'; // lexicographically low, so SELF initiates to 'bbbb'/'cccc'

function peer(deviceId: string, overrides: Partial<AutoConnectPeerInput> = {}): AutoConnectPeerInput {
  return {
    deviceId,
    discoveredOnLan: false,
    state: null,
    lastCompletedSessionAt: null,
    pendingChanges: 0,
    ...overrides,
  };
}

function plan(overrides: Partial<PlanAutoConnectRoundInput> = {}) {
  return planAutoConnectRound({
    selfDeviceId: SELF,
    peers: [],
    relayAvailable: true,
    policy: DEFAULT_AUTO_CONNECT_POLICY,
    now: NOW,
    ...overrides,
  });
}

describe('nextBackoffMs (Plan 29 backoff ladder)', () => {
  it('walks 30s, 2m, 10m, 30m then caps at 2h', () => {
    expect(nextBackoffMs(1)).toBe(30_000);
    expect(nextBackoffMs(2)).toBe(120_000);
    expect(nextBackoffMs(3)).toBe(600_000);
    expect(nextBackoffMs(4)).toBe(1_800_000);
    expect(nextBackoffMs(5)).toBe(7_200_000);
    expect(nextBackoffMs(99)).toBe(7_200_000);
  });

  it('is 0 for a non-positive failure count', () => {
    expect(nextBackoffMs(0)).toBe(0);
  });
});

describe('planAutoConnectRound', () => {
  it('dials an eligible peer over relay and assigns initiate to the lower deviceId', () => {
    const result = plan({ peers: [peer('bbbb')] });
    expect(result.dials).toEqual([{ peerDeviceId: 'bbbb', role: 'initiate', transport: 'wan_relay' }]);
    expect(result.skipped).toEqual([]);
  });

  it('assigns listen when self has the higher deviceId', () => {
    const result = planAutoConnectRound({
      selfDeviceId: 'zzzz',
      peers: [peer('bbbb')],
      relayAvailable: true,
      policy: DEFAULT_AUTO_CONNECT_POLICY,
      now: NOW,
    });
    expect(result.dials[0]).toEqual({ peerDeviceId: 'bbbb', role: 'listen', transport: 'wan_relay' });
  });

  it('prefers LAN when the peer was discovered locally', () => {
    const result = plan({ peers: [peer('bbbb', { discoveredOnLan: true })] });
    expect(result.dials[0]!.transport).toBe('lan');
  });

  it('skips a peer inside its backoff window and reports the earliest retry', () => {
    const backedOff: AutoConnectState = {
      peerDeviceId: 'bbbb',
      failureCount: 2,
      nextAttemptAt: NOW + 60_000,
      lastAttemptAt: NOW - 60_000,
      lastResult: 'failed',
    };
    const result = plan({ peers: [peer('bbbb', { state: backedOff })] });
    expect(result.dials).toEqual([]);
    expect(result.skipped).toEqual([{ peerDeviceId: 'bbbb', reason: 'backoff' }]);
    expect(result.nextEarliestRetryAt).toBe(NOW + 60_000);
  });

  it('dials again once the backoff window has elapsed', () => {
    const elapsed: AutoConnectState = {
      peerDeviceId: 'bbbb',
      failureCount: 1,
      nextAttemptAt: NOW - 1,
      lastAttemptAt: NOW - 30_001,
      lastResult: 'failed',
    };
    const result = plan({ peers: [peer('bbbb', { state: elapsed })] });
    expect(result.dials).toHaveLength(1);
  });

  it('skips a peer with a fresh completed session and nothing pending (min interval)', () => {
    const result = plan({ peers: [peer('bbbb', { lastCompletedSessionAt: NOW - 10_000 })] });
    expect(result.skipped).toEqual([{ peerDeviceId: 'bbbb', reason: 'min_interval' }]);
    expect(result.dials).toEqual([]);
  });

  it('still listens inside the min interval because the lower peer may have pending changes', () => {
    const result = planAutoConnectRound({
      selfDeviceId: 'zzzz',
      peers: [peer('bbbb', { lastCompletedSessionAt: NOW - 10_000 })],
      relayAvailable: true,
      policy: DEFAULT_AUTO_CONNECT_POLICY,
      now: NOW,
    });
    expect(result.skipped).toEqual([]);
    expect(result.dials).toEqual([{ peerDeviceId: 'bbbb', role: 'listen', transport: 'wan_relay' }]);
  });

  it('dials a recently-synced peer anyway when changes are pending', () => {
    const result = plan({ peers: [peer('bbbb', { lastCompletedSessionAt: NOW - 10_000, pendingChanges: 3 })] });
    expect(result.dials).toHaveLength(1);
  });

  it('dials a peer whose last session is older than the min interval', () => {
    const result = plan({
      peers: [peer('bbbb', { lastCompletedSessionAt: NOW - (DEFAULT_AUTO_CONNECT_POLICY.minSessionIntervalMs + 1) })],
    });
    expect(result.dials).toHaveLength(1);
  });

  it('skips with no_transport when relay is unavailable and the peer is not on LAN', () => {
    const result = plan({ relayAvailable: false, peers: [peer('bbbb')] });
    expect(result.skipped).toEqual([{ peerDeviceId: 'bbbb', reason: 'no_transport' }]);
  });

  it('still dials LAN when relay is unavailable but the peer is discovered locally', () => {
    const result = plan({ relayAvailable: false, peers: [peer('bbbb', { discoveredOnLan: true })] });
    expect(result.dials[0]!.transport).toBe('lan');
  });

  it('consults the Plan 27 seam for every dial and falls back to relay when LAN is forbidden (NC-3)', () => {
    const calls: number[] = [];
    const result = plan({
      peers: [peer('bbbb', { discoveredOnLan: true })],
      transportPolicyAllows: (layerId) => {
        calls.push(layerId);
        return layerId !== LAN_LAYER_ID; // forbid LAN, allow relay
      },
    });
    expect(calls).toContain(LAN_LAYER_ID);
    expect(result.dials[0]!.transport).toBe('wan_relay');
  });

  it('skips no_transport when the seam forbids both LAN and relay for a local-only community (NC-3)', () => {
    const result = plan({
      peers: [peer('bbbb', { discoveredOnLan: true })],
      transportPolicyAllows: (layerId) => layerId !== LAN_LAYER_ID && layerId !== RELAY_LAYER_ID,
    });
    expect(result.skipped).toEqual([{ peerDeviceId: 'bbbb', reason: 'no_transport' }]);
  });
});
