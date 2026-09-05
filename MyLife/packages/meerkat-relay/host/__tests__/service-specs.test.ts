/**
 * Host service-spec builder (Plan 20, Phase 4.3 + 5.4 + 6.1).
 *
 * Proves the pure mapping from HostConfig -> ServiceSpec[]: relay-only yields one
 * relay spec; a full community yields relay + community node + seeder with a
 * writable DATA_DIR and (for the community node) NOTIFY_RELAY_URL pointed at the
 * host's own local relay; the private preset stays tighter than open and BOTH
 * survive the relay's resolveRelayLimits clamp; and a non-writable DATA_DIR fails
 * closed. All fs is injected so this stays deterministic (no real disk).
 */

import { describe, it, expect } from 'vitest';
import {
  buildServiceSpecs,
  type BuildServiceSpecsDeps,
} from '../service-specs';
import { resolveRelayLimits } from '../../src/protocol';
import type { HostConfig } from '../host-config';

const RUNNER = { bin: '/usr/bin/node', argsPrefix: [] as string[] };
const BIN_DIR = '/pkg/bin';

function deps(over: Partial<BuildServiceSpecsDeps> = {}): BuildServiceSpecsDeps {
  return {
    binDir: BIN_DIR,
    dataDir: '/data',
    runner: RUNNER,
    ensureWritableDir: () => true,
    ...over,
  };
}

function config(over: Partial<HostConfig> = {}): HostConfig {
  return {
    services: { relay: true, communityNode: false, seeder: false },
    exposure: 'tunnel',
    securityPreset: 'private',
    ...over,
  };
}

const binOf = (spec: { args?: string[] }): string | undefined => spec.args?.at(-1);

describe('buildServiceSpecs', () => {
  it('relay-only -> exactly one relay spec pointed at the real bin', () => {
    const r = buildServiceSpecs(config(), deps());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.specs).toHaveLength(1);
    const [relay] = r.specs;
    expect(relay.name).toBe('relay');
    expect(binOf(relay)).toBe('/pkg/bin/meerkat-relay-server.mjs');
    expect(relay.bin).toBe('/usr/bin/node');
    // A tunnel edge reaches the relay on loopback (only the tunnel is public).
    expect(relay.env?.HOST).toBe('127.0.0.1');
    expect(relay.env?.PORT).toBeDefined();
    // Never a paid entitlement gate; only RELAY_* caps.
    expect(
      Object.keys(relay.env ?? {}).some((k) => k.startsWith('RELAY_HOSTED_ENTITLEMENT')),
    ).toBe(false);
  });

  it('full community -> relay + community node + seeder with DATA_DIR + NOTIFY_RELAY_URL', () => {
    const r = buildServiceSpecs(
      config({ services: { relay: true, communityNode: true, seeder: true } }),
      deps(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.specs.map((s) => s.name)).toEqual(['relay', 'communityNode', 'seeder']);

    const community = r.specs.find((s) => s.name === 'communityNode')!;
    const seeder = r.specs.find((s) => s.name === 'seeder')!;
    expect(binOf(community)).toBe('/pkg/bin/meerkat-community-node.mjs');
    expect(binOf(seeder)).toBe('/pkg/bin/meerkat-node.mjs');

    // Distinct writable DATA_DIR subdirs so their on-disk shapes never collide.
    expect(community.env?.DATA_DIR).toBe('/data/community');
    expect(seeder.env?.DATA_DIR).toBe('/data/seed');
    expect(community.env?.DATA_DIR).not.toBe(seeder.env?.DATA_DIR);

    // The community node parks notify pings on THIS host's own local relay.
    expect(community.env?.NOTIFY_RELAY_URL).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);
  });

  it('omits NOTIFY_RELAY_URL when the community node runs without a co-located relay', () => {
    const r = buildServiceSpecs(
      config({ services: { relay: false, communityNode: true, seeder: false } }),
      deps(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.specs.map((s) => s.name)).toEqual(['communityNode']);
    expect(r.specs[0].env?.NOTIFY_RELAY_URL).toBeUndefined();
  });

  it('a LAN exposure binds services to 0.0.0.0 (dialable by same-network peers)', () => {
    const r = buildServiceSpecs(config({ exposure: 'lan' }), deps());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.specs[0].env?.HOST).toBe('0.0.0.0');
  });

  it('the private preset stays tighter than open, and BOTH survive the relay clamp', () => {
    const priv = buildServiceSpecs(config({ securityPreset: 'private' }), deps());
    const open = buildServiceSpecs(config({ securityPreset: 'open' }), deps());
    expect(priv.ok && open.ok).toBe(true);
    if (!priv.ok || !open.ok) return;

    const privLimits = resolveRelayLimits(priv.specs[0].env);
    const openLimits = resolveRelayLimits(open.specs[0].env);
    const defaults = resolveRelayLimits({});

    expect(privLimits.maxConnections).toBeLessThan(openLimits.maxConnections);
    expect(privLimits.maxConnections).toBeLessThan(defaults.maxConnections);
    expect(openLimits.maxConnections).toBeGreaterThanOrEqual(defaults.maxConnections);
    // Still inside the safe clamp window (never an amplifier / self-DoS).
    expect(privLimits.maxConnections).toBeGreaterThanOrEqual(8);
    expect(openLimits.maxConnections).toBeLessThanOrEqual(200_000);
  });

  it('fails CLOSED when a required DATA_DIR is not writable', () => {
    const r = buildServiceSpecs(
      config({ services: { relay: true, communityNode: true, seeder: false } }),
      deps({ ensureWritableDir: () => false }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/not writable/i);
  });
});
