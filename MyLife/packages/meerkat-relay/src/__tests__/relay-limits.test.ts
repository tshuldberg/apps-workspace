/**
 * Env-configurable, clamped fair-use caps (Plan 20, Phase 2).
 *
 * resolveRelayLimits(env) lets the first-party free relay (and self-hosts) tune
 * per-IP budgets from env WITHOUT a code edit, while CLAMPING every override to a
 * safe [min,max] so an operator -- or a tricked non-technical host -- cannot set
 * caps that (a) turn the relay into a high-rate ciphertext amplifier (too high)
 * or (b) DoS the host's own members (too low). Unset env == today's RELAY_LIMITS.
 */

import { describe, it, expect } from 'vitest';
import { RELAY_LIMITS, resolveRelayLimits } from '../protocol';

describe('resolveRelayLimits', () => {
  it('TC-4: unset env yields exactly today\'s RELAY_LIMITS', () => {
    expect(resolveRelayLimits({})).toEqual({ ...RELAY_LIMITS });
  });

  it('overrides each mapped field from a valid in-range env value', () => {
    const r = resolveRelayLimits({
      RELAY_MAX_CONNECTIONS: '5000',
      RELAY_MAX_PER_CLIENT: '32',
      RELAY_MAX_PEERS_PER_TOKEN: '4',
      RELAY_ENV_RATE: '100',
      RELAY_RENDEZVOUS_RATE: '20',
      RELAY_WINDOW_MS: '5000',
      RELAY_MAILBOX_MAX: '128',
      RELAY_MAILBOX_TTL_MS: '600000',
    });
    expect(r.maxConnections).toBe(5000);
    expect(r.maxConnectionsPerClient).toBe(32);
    expect(r.maxPeersPerToken).toBe(4);
    expect(r.rateMaxPerWindow).toBe(100);
    expect(r.rendezvousMaxPerWindow).toBe(20);
    expect(r.rateWindowMs).toBe(5000);
    expect(r.mailboxMax).toBe(128);
    expect(r.mailboxTtlMs).toBe(600000);
    // Unmapped fields keep their defaults (only the 8 fair-use caps are tunable).
    expect(r.maxFrameBytes).toBe(RELAY_LIMITS.maxFrameBytes);
    expect(r.maxEnvelopeChars).toBe(RELAY_LIMITS.maxEnvelopeChars);
  });

  // Full [min,max] clamp matrix for all 8 tunable fields (NC-7). Each row is
  // (env var, resolved key, min, max); a way-too-high value clamps to max (no
  // amplifier) and a way-too-low value clamps to min (no self-DoS).
  const CLAMP_MATRIX: ReadonlyArray<[string, keyof ReturnType<typeof resolveRelayLimits>, number, number]> = [
    ['RELAY_MAX_CONNECTIONS', 'maxConnections', 8, 200_000],
    ['RELAY_MAX_PER_CLIENT', 'maxConnectionsPerClient', 1, 4_096],
    ['RELAY_MAX_PEERS_PER_TOKEN', 'maxPeersPerToken', 2, 64],
    ['RELAY_ENV_RATE', 'rateMaxPerWindow', 10, 5_000],
    ['RELAY_RENDEZVOUS_RATE', 'rendezvousMaxPerWindow', 5, 1_000],
    ['RELAY_WINDOW_MS', 'rateWindowMs', 1_000, 60_000],
    ['RELAY_MAILBOX_MAX', 'mailboxMax', 8, 4_096],
    ['RELAY_MAILBOX_TTL_MS', 'mailboxTtlMs', 10_000, 86_400_000],
  ];

  it.each(CLAMP_MATRIX)('NC-7: %s clamps out-of-range HIGH and LOW to [%s=>min, max]', (env, key, min, max) => {
    expect(resolveRelayLimits({ [env]: '99999999999' })[key]).toBe(max);
    expect(resolveRelayLimits({ [env]: '-9999999' })[key]).toBe(min);
    // an in-range value is preserved exactly
    const mid = Math.floor((min + max) / 2);
    expect(resolveRelayLimits({ [env]: String(mid) })[key]).toBe(mid);
  });

  it('ignores garbage / non-integer / empty env values (falls back to default)', () => {
    const d = RELAY_LIMITS.rateMaxPerWindow;
    expect(resolveRelayLimits({ RELAY_ENV_RATE: 'abc' }).rateMaxPerWindow).toBe(d);
    expect(resolveRelayLimits({ RELAY_ENV_RATE: '200.5' }).rateMaxPerWindow).toBe(d);
    expect(resolveRelayLimits({ RELAY_ENV_RATE: '' }).rateMaxPerWindow).toBe(d);
    expect(resolveRelayLimits({ RELAY_ENV_RATE: '   ' }).rateMaxPerWindow).toBe(d);
    expect(resolveRelayLimits({ RELAY_ENV_RATE: undefined }).rateMaxPerWindow).toBe(d);
  });

  it('does not mutate the frozen RELAY_LIMITS constant', () => {
    const before = RELAY_LIMITS.maxConnections;
    resolveRelayLimits({ RELAY_MAX_CONNECTIONS: '99' });
    expect(RELAY_LIMITS.maxConnections).toBe(before);
  });
});
