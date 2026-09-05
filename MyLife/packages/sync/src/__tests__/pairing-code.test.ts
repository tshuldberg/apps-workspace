import { describe, expect, it } from 'vitest';
import {
  decodeMeerkatPairingCode,
  encodeMeerkatPairingCode,
  formatMeerkatPairingCode,
  isMeerkatPairingCode,
  normalizeMeerkatPairingInput,
} from '../protocol/pairing-code';

describe('Meerkat pairing code wrapper', () => {
  it('round-trips signed pairing JSON through a printable code', () => {
    const json = JSON.stringify({
      v: 2,
      bundle: {
        bundle: {
          deviceId: 'device-public-key',
          dhPublicKey: 'device-dh-key',
          displayName: 'Trey Phone',
          relayHints: [],
          createdAt: '2026-06-24T00:00:00.000Z',
        },
        signature: 'aa'.repeat(64),
      },
      pairingNonce: 'bb'.repeat(16),
    });

    const code = encodeMeerkatPairingCode(json);

    expect(code).toMatch(/^MKPAIR1-[A-Za-z0-9_-]+$/u);
    expect(isMeerkatPairingCode(code)).toBe(true);
    expect(decodeMeerkatPairingCode(code)).toBe(json);
    expect(normalizeMeerkatPairingInput(formatMeerkatPairingCode(code))).toBe(json);
  });

  it('leaves legacy JSON input untouched for backwards compatibility', () => {
    const json = '{"v":2}';

    expect(isMeerkatPairingCode(json)).toBe(false);
    expect(normalizeMeerkatPairingInput(` ${json} `)).toBe(json);
  });

  it('fails closed by returning the original code when decoding is malformed', () => {
    const bad = 'MKPAIR1-not-valid-%%%';

    expect(decodeMeerkatPairingCode(bad)).toBe(bad);
  });
});
