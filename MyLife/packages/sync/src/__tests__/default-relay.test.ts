/**
 * Health-gated default-relay resolution (Plan 20, Phase 0).
 *
 * Pure decision core, no IO. Proves the three load-bearing rules that make the
 * free default honest AND opt-out-respecting:
 *  - source precedence: a user-set URL always wins (TC-1);
 *  - reachability comes only from a real probe (TC-2);
 *  - effectiveRelayUrl() is the single dial choke point -- a user URL is always
 *    dialed, but the free default is dialed ONLY when its last real /healthz
 *    probe passed and the user has not opted out (AC-4, honesty landmine L1).
 *
 * The async probe is injected (no network) so the selector is deterministic.
 */

import { describe, it, expect } from 'vitest';
import type { RelayHealth } from '../transport/relay-selector';
import {
  resolveDefaultRelay,
  resolveDefaultRelaySync,
  effectiveRelayUrl,
} from '../transport/default-relay';

function health(url: string, healthy: boolean): RelayHealth {
  return { url, healthy, latencyMs: 12 };
}

const USER = 'wss://my-server.example/relay';
const DEFAULT = 'wss://default.meerkat.example';

describe('resolveDefaultRelay (async, real probe)', () => {
  it('TC-1: a non-empty user URL wins regardless of the default', async () => {
    const probe = async (url: string) => health(url, true);
    const r = await resolveDefaultRelay({
      configuredUrl: USER,
      defaultUrl: DEFAULT,
      optedOut: false,
      probe,
    });
    expect(r.source).toBe('user');
    expect(r.url).toBe(USER);
    expect(r.reachable).toBe(true);
  });

  it('TC-2: reachable is false when the probe fails, true only on a real pass', async () => {
    const down = await resolveDefaultRelay({
      configuredUrl: USER,
      defaultUrl: '',
      optedOut: false,
      probe: async (url) => health(url, false),
    });
    expect(down.source).toBe('user');
    expect(down.reachable).toBe(false);
  });

  it("source 'default' only when no user URL, default set, and not opted out", async () => {
    const r = await resolveDefaultRelay({
      configuredUrl: '   ',
      defaultUrl: DEFAULT,
      optedOut: false,
      probe: async (url) => health(url, true),
    });
    expect(r.source).toBe('default');
    expect(r.url).toBe(DEFAULT);
    expect(r.reachable).toBe(true);
  });

  it("opted out with no user URL is source 'none' and never probes", async () => {
    let probed = false;
    const r = await resolveDefaultRelay({
      configuredUrl: '',
      defaultUrl: DEFAULT,
      optedOut: true,
      probe: async (url) => {
        probed = true;
        return health(url, true);
      },
    });
    expect(r.source).toBe('none');
    expect(r.url).toBe('');
    expect(r.reachable).toBe('unknown');
    expect(probed).toBe(false);
  });

  it("an unconfigured build (default '') is source 'none', no probe", async () => {
    let probed = false;
    const r = await resolveDefaultRelay({
      configuredUrl: '',
      defaultUrl: '',
      optedOut: false,
      probe: async (url) => {
        probed = true;
        return health(url, true);
      },
    });
    expect(r.source).toBe('none');
    expect(r.url).toBe('');
    expect(probed).toBe(false);
  });
});

describe('resolveDefaultRelaySync (display, cached probe)', () => {
  it('reports reachable:true only when the cached probe matches the resolved url', () => {
    const r = resolveDefaultRelaySync({
      configuredUrl: '',
      defaultUrl: DEFAULT,
      optedOut: false,
      lastProbe: health(DEFAULT, true),
    });
    expect(r.source).toBe('default');
    expect(r.reachable).toBe(true);
  });

  it("a cached probe for a DIFFERENT url is ignored (reachable:'unknown')", () => {
    const r = resolveDefaultRelaySync({
      configuredUrl: USER,
      defaultUrl: DEFAULT,
      optedOut: false,
      lastProbe: health('wss://stale.example', true),
    });
    expect(r.source).toBe('user');
    expect(r.reachable).toBe('unknown');
  });

  it("no cached probe yields reachable:'unknown'", () => {
    const r = resolveDefaultRelaySync({
      configuredUrl: USER,
      defaultUrl: '',
      optedOut: false,
      lastProbe: null,
    });
    expect(r.reachable).toBe('unknown');
  });
});

describe('effectiveRelayUrl (the single dial choke point)', () => {
  it('always dials a user-set URL, even with no probe', () => {
    expect(
      effectiveRelayUrl({ configuredUrl: USER, defaultUrl: DEFAULT, optedOut: false }),
    ).toBe(USER);
  });

  it('dials a user-set URL even when its cached probe is unhealthy (user URLs are not health-gated)', () => {
    expect(
      effectiveRelayUrl({
        configuredUrl: USER,
        defaultUrl: '',
        optedOut: false,
        lastProbe: health(USER, false),
      }),
    ).toBe(USER);
  });

  it('dials a user-set URL even when opted out of the free default', () => {
    expect(
      effectiveRelayUrl({ configuredUrl: USER, defaultUrl: DEFAULT, optedOut: true }),
    ).toBe(USER);
  });

  it('dials the free default ONLY when its last probe passed', () => {
    expect(
      effectiveRelayUrl({
        configuredUrl: '',
        defaultUrl: DEFAULT,
        optedOut: false,
        lastProbe: health(DEFAULT, true),
      }),
    ).toBe(DEFAULT);
  });

  it('does NOT dial the free default when its last probe is unhealthy (health gate, L1)', () => {
    expect(
      effectiveRelayUrl({
        configuredUrl: '',
        defaultUrl: DEFAULT,
        optedOut: false,
        lastProbe: health(DEFAULT, false),
      }),
    ).toBe('');
  });

  it('does NOT dial the free default before any probe has run (unknown is not reachable)', () => {
    expect(
      effectiveRelayUrl({ configuredUrl: '', defaultUrl: DEFAULT, optedOut: false }),
    ).toBe('');
  });

  it('AC-4: returns "" when the user opts out of the default and has no own URL', () => {
    expect(
      effectiveRelayUrl({
        configuredUrl: '',
        defaultUrl: DEFAULT,
        optedOut: true,
        lastProbe: health(DEFAULT, true),
      }),
    ).toBe('');
  });

  it('AC-2: returns "" on an unconfigured build with no user URL', () => {
    expect(
      effectiveRelayUrl({ configuredUrl: '', defaultUrl: '', optedOut: false }),
    ).toBe('');
  });
});
