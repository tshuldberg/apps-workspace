import { describe, expect, it } from 'vitest';
import { platformClientIp, signDmcaClientIp } from '../app/api/dmca/rate-security';

const TRUSTED = 'x-vercel-forwarded-for';

describe('DMCA web proxy rate security', () => {
  it('reads ONLY the deployment-declared trusted header, ignoring client-controllable ones', () => {
    // An attacker sets cf-connecting-ip and x-forwarded-for; only the header the
    // deployment declares as trusted (and its edge overwrites) is read.
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.9',
      'x-forwarded-for': '198.51.100.1, 198.51.100.2',
      [TRUSTED]: '192.0.2.7',
    });
    expect(platformClientIp(headers, TRUSTED)).toBe('192.0.2.7');
    // Without the trusted header present, a spoofed grab-bag yields nothing.
    const spoofed = new Headers({
      'cf-connecting-ip': '203.0.113.9',
      'x-forwarded-for': '198.51.100.1',
    });
    expect(platformClientIp(spoofed, TRUSTED)).toBeNull();
  });

  it('fails closed when no trusted header is configured', () => {
    const headers = new Headers({ [TRUSTED]: '192.0.2.7' });
    expect(platformClientIp(headers, undefined)).toBeNull();
    expect(platformClientIp(headers, '')).toBeNull();
    expect(platformClientIp(headers, '   ')).toBeNull();
  });

  it('takes the first address of the trusted header and rejects missing or malformed values', () => {
    expect(platformClientIp(new Headers({ [TRUSTED]: '198.51.100.1, 10.0.0.1' }), TRUSTED)).toBe(
      '198.51.100.1',
    );
    expect(platformClientIp(new Headers(), TRUSTED)).toBeNull();
    expect(platformClientIp(new Headers({ [TRUSTED]: 'bad ip' }), TRUSTED)).toBeNull();
  });

  it('signs IP and timestamp deterministically without exposing the salt', async () => {
    const salt = 'a-server-only-rate-salt-with-more-than-thirty-two-characters';
    const first = await signDmcaClientIp(salt, '203.0.113.9', 1234);
    const second = await signDmcaClientIp(salt, '203.0.113.9', 1234);
    const changed = await signDmcaClientIp(salt, '203.0.113.10', 1234);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(changed).not.toBe(first);
    expect(first).not.toContain(salt);
  });
});
