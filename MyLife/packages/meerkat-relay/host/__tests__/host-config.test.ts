/**
 * Meerkat Host config + preset mapping + off-host reachability (Plan 20, Phase 4/5).
 * TC-9 (preset -> clamped env, never a forced paid gate), TC-10 / AC-9 (reachable
 * only from an OFF-HOST vantage, never a self-fetch).
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HOST_CONFIG,
  buildHostConnectionCard,
  loadHostConfig,
  presetToRelayEnv,
} from '../host-config';
import { resolveRelayLimits } from '../../src/protocol';
import { gateReachability } from '../reachability';

describe('loadHostConfig', () => {
  it('accepts a valid config and rejects a malformed one', () => {
    const ok = loadHostConfig(
      JSON.stringify({ services: { relay: true, communityNode: true, seeder: false }, exposure: 'tunnel', securityPreset: 'private' }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.config.exposure).toBe('tunnel');

    expect(loadHostConfig('{bad').ok).toBe(false);
    expect(loadHostConfig(JSON.stringify({ exposure: 'nope' })).ok).toBe(false);
  });

  it('the default config runs a community server over a tunnel with the private preset', () => {
    expect(DEFAULT_HOST_CONFIG.services.relay).toBe(true);
    expect(DEFAULT_HOST_CONFIG.exposure).toBe('tunnel');
    expect(DEFAULT_HOST_CONFIG.securityPreset).toBe('private');
  });
});

describe('presetToRelayEnv (TC-9)', () => {
  it('the private preset yields tighter caps that survive the relay clamp', () => {
    const env = presetToRelayEnv('private');
    const limits = resolveRelayLimits(env);
    const defaults = resolveRelayLimits({});
    expect(limits.maxConnections).toBeLessThan(defaults.maxConnections);
    expect(limits.maxConnectionsPerClient).toBeLessThanOrEqual(defaults.maxConnectionsPerClient);
    // still within the safe clamp window (never amplifier/self-DoS)
    expect(limits.maxConnections).toBeGreaterThanOrEqual(8);
  });

  it('the open preset stays at or above defaults', () => {
    const limits = resolveRelayLimits(presetToRelayEnv('open'));
    const defaults = resolveRelayLimits({});
    expect(limits.maxConnections).toBeGreaterThanOrEqual(defaults.maxConnections);
  });

  it('never sets a paid hosted-entitlement gate (the host relay ships open, default-off)', () => {
    const env = presetToRelayEnv('private');
    expect(env.RELAY_HOSTED_ENTITLEMENT_REQUIRED).toBeUndefined();
    expect(Object.keys(env).every((k) => k.startsWith('RELAY_'))).toBe(true);
  });
});

describe('buildHostConnectionCard', () => {
  it('builds a parseable card from the running relay (+ community node) URL', () => {
    const card = buildHostConnectionCard({
      relayUrl: 'wss://abc.trycloudflare.com',
      communityNodeUrl: 'https://abc.trycloudflare.com',
      name: "Ada's burrow",
    });
    expect(card.startsWith('MKSERVER1:')).toBe(true);
  });

  it('refuses to build a card from a non-wss relay (never a bad address)', () => {
    expect(() => buildHostConnectionCard({ relayUrl: 'http://nope' })).toThrow();
  });
});

describe('gateReachability (TC-10 / AC-9: off-host vantage only)', () => {
  it('reports reachable ONLY from a successful OFF-HOST round-trip', async () => {
    const r = await gateReachability({
      publicUrl: 'wss://abc.trycloudflare.com',
      offHostProbe: async () => ({ reachedFromOutside: true }),
    });
    expect(r.state).toBe('reachable');
  });

  it('falls back to the LAN/checking state when the off-host probe fails', async () => {
    const r = await gateReachability({
      publicUrl: 'wss://abc.trycloudflare.com',
      offHostProbe: async () => ({ reachedFromOutside: false }),
    });
    expect(r.state).toBe('unverified');
  });

  it('REJECTS a self-probe (the probe target must not be the host itself)', async () => {
    const r = await gateReachability({
      publicUrl: 'wss://abc.trycloudflare.com',
      // a probe that just fetched its own public URL is not an off-host vantage
      offHostProbe: async () => ({ reachedFromOutside: true, vantage: 'self' }),
    });
    expect(r.state).toBe('unverified');
  });
});
