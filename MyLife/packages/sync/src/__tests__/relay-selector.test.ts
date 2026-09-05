/**
 * MK-036 -- latency-based relay selection. The client picks the nearest healthy
 * relay from a candidate pool; unhealthy relays are skipped; with none healthy
 * it returns null. Probing is injected so the algorithm is deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  selectRelay,
  rankRelays,
  relayHealthUrl,
  type RelayHealth,
  type RelayProbe,
} from '../transport/relay-selector';

/** A probe driven by a fixed latency/health table keyed by URL. */
function fakeProbe(table: Record<string, { healthy: boolean; latencyMs: number; connections?: number }>): RelayProbe {
  return async (url): Promise<RelayHealth> => {
    const r = table[url];
    if (!r) return { url, healthy: false, latencyMs: Number.POSITIVE_INFINITY };
    return { url, healthy: r.healthy, latencyMs: r.latencyMs, connections: r.connections };
  };
}

const US = 'wss://relay-us.meerkat.app';
const EU = 'wss://relay-eu.meerkat.app';
const AP = 'wss://relay-ap.meerkat.app';

describe('relayHealthUrl', () => {
  it('maps the WS relay URL to its HTTP healthz endpoint', () => {
    expect(relayHealthUrl('ws://127.0.0.1:8787')).toBe('http://127.0.0.1:8787/healthz');
    expect(relayHealthUrl('wss://relay.example/')).toBe('https://relay.example/healthz');
  });
});

describe('selectRelay (MK-036)', () => {
  it('picks the lowest-latency healthy relay (the nearest)', async () => {
    const probe = fakeProbe({
      [US]: { healthy: true, latencyMs: 40 },
      [EU]: { healthy: true, latencyMs: 12 },
      [AP]: { healthy: true, latencyMs: 180 },
    });
    const chosen = await selectRelay({ candidates: [US, EU, AP], probe });
    expect(chosen?.url).toBe(EU);
  });

  it('skips unhealthy relays even when they would be nearest', async () => {
    const probe = fakeProbe({
      [US]: { healthy: false, latencyMs: 5 }, // nearest but down
      [EU]: { healthy: true, latencyMs: 30 },
      [AP]: { healthy: true, latencyMs: 90 },
    });
    const chosen = await selectRelay({ candidates: [US, EU, AP], probe });
    expect(chosen?.url).toBe(EU);
  });

  it('breaks latency ties toward the less-loaded relay, then candidate order', async () => {
    const probe = fakeProbe({
      [US]: { healthy: true, latencyMs: 20, connections: 500 },
      [EU]: { healthy: true, latencyMs: 20, connections: 50 },
    });
    const chosen = await selectRelay({ candidates: [US, EU], probe });
    expect(chosen?.url).toBe(EU); // same latency, fewer connections
  });

  it('returns null when no candidate is healthy', async () => {
    const probe = fakeProbe({
      [US]: { healthy: false, latencyMs: 5 },
      [EU]: { healthy: false, latencyMs: 5 },
    });
    expect(await selectRelay({ candidates: [US, EU], probe })).toBeNull();
  });

  it('an unprobed candidate is treated as unhealthy', async () => {
    const probe = fakeProbe({ [US]: { healthy: true, latencyMs: 50 } });
    const chosen = await selectRelay({ candidates: [US, EU], probe });
    expect(chosen?.url).toBe(US);
  });
});

describe('rankRelays (MK-036 dial order)', () => {
  it('orders healthy relays nearest-first, then unhealthy as last-ditch fallbacks', async () => {
    const probe = fakeProbe({
      [US]: { healthy: true, latencyMs: 40 },
      [EU]: { healthy: false, latencyMs: 10 },
      [AP]: { healthy: true, latencyMs: 15 },
    });
    const order = await rankRelays({ candidates: [US, EU, AP], probe });
    // AP (15ms healthy), US (40ms healthy), then EU (unhealthy fallback).
    expect(order).toEqual([AP, US, EU]);
  });
});
