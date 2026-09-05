/**
 * Connection-card QR encoder (Plan 20, Phase 6.2). Round-trip TDD.
 *
 * The QR carries a TRANSPORT ADDRESS ONLY -- the same non-secret,
 * non-authenticating connection card `@mylife/sync` already defines. These tests
 * prove the QR reproduces the EXACT MKSERVER1 string it was handed: encode ->
 * decode -> `parseConnectionCard` yields the identical card. The codec never
 * claims a card it cannot reproduce, and it refuses to build a QR from anything
 * that is not a real connection card.
 */

import { describe, it, expect } from 'vitest';
import { parseConnectionCard } from '@mylife/sync';
import { buildHostConnectionCard } from '../host-config';
import { encodeConnectionCardQr, decodeConnectionCardQr, qrModulesToSvg } from '../qr';

describe('encodeConnectionCardQr (Plan 20 Phase 6.2)', () => {
  it('encodes a host connection card and parseConnectionCard round-trips the SAME string', () => {
    const original = buildHostConnectionCard({
      relayUrl: 'wss://abc.trycloudflare.com',
      communityNodeUrl: 'https://abc.trycloudflare.com',
      name: "Ada's burrow",
    });

    const qr = encodeConnectionCardQr(original);
    // The result carries exactly the string it was handed (a transport address only).
    expect(qr.text).toBe(original);
    expect(qr.size).toBe(qr.version * 4 + 17);
    expect(qr.modules.length).toBe(qr.size);

    // The grid itself decodes back to the identical string...
    const decoded = decodeConnectionCardQr(qr.modules);
    expect(decoded).toBe(original);
    // ...which parseConnectionCard accepts as the same card (structural round-trip).
    expect(parseConnectionCard(decoded ?? '')).toEqual(parseConnectionCard(original));
  });

  it('round-trips a bare wss:// minimal card', () => {
    const bare = buildHostConnectionCard({ relayUrl: 'wss://relay.example.org:8787' });
    const qr = encodeConnectionCardQr(bare);
    expect(decodeConnectionCardQr(qr.modules)).toBe(bare);
    expect(parseConnectionCard(decodeConnectionCardQr(qr.modules) ?? '')?.relay).toBe(
      'wss://relay.example.org:8787',
    );
  });

  it('round-trips a unicode server name through the UTF-8 byte path', () => {
    const card = buildHostConnectionCard({
      relayUrl: 'wss://burrow.example.net',
      name: 'Åda ⛺ の巣',
    });
    const qr = encodeConnectionCardQr(card);
    expect(decodeConnectionCardQr(qr.modules)).toBe(card);
  });

  it('scales to a higher QR version for a larger card and still round-trips', () => {
    const small = encodeConnectionCardQr(
      buildHostConnectionCard({ relayUrl: 'wss://a.example.com' }),
    );
    // A long (but schema-valid, <= 2048 char) relay URL pushes past a v1/v2 grid.
    const longRelay = 'wss://relay.example.com/tunnel/' + 'x'.repeat(300);
    const large = encodeConnectionCardQr(buildHostConnectionCard({ relayUrl: longRelay }));
    expect(large.version).toBeGreaterThan(small.version);
    const decoded = decodeConnectionCardQr(large.modules);
    expect(decoded).not.toBeNull();
    expect(parseConnectionCard(decoded ?? '')?.relay).toBe(longRelay);
  });

  it('round-trips at every error-correction level', () => {
    const card = buildHostConnectionCard({
      relayUrl: 'wss://abc.trycloudflare.com',
      communityNodeUrl: 'https://abc.trycloudflare.com',
      name: 'level check',
    });
    for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
      const qr = encodeConnectionCardQr(card, { ecc });
      expect(qr.ecc).toBe(ecc);
      expect(decodeConnectionCardQr(qr.modules)).toBe(card);
    }
  });

  it('refuses to build a QR from a non-card string (never a fabricated address)', () => {
    expect(() => encodeConnectionCardQr('not a connection card')).toThrow();
    expect(() => encodeConnectionCardQr('http://nope')).toThrow();
  });

  it('lays down the three finder patterns (a structurally real QR, not a placeholder)', () => {
    const qr = encodeConnectionCardQr(buildHostConnectionCard({ relayUrl: 'wss://a.example.com' }));
    const isFinder = (ox: number, oy: number): boolean => {
      // A finder is a 7x7 with a dark border, light ring, 3x3 dark core.
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const onBorder = dx === 0 || dx === 6 || dy === 0 || dy === 6;
          const inCore = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          const expected = onBorder || inCore;
          if (qr.modules[oy + dy][ox + dx] !== expected) return false;
        }
      }
      return true;
    };
    expect(isFinder(0, 0)).toBe(true);
    expect(isFinder(qr.size - 7, 0)).toBe(true);
    expect(isFinder(0, qr.size - 7)).toBe(true);
  });

  it('emits a standalone SVG with a quiet-zone border', () => {
    const qr = encodeConnectionCardQr(buildHostConnectionCard({ relayUrl: 'wss://a.example.com' }), {
      border: 4,
      scale: 8,
    });
    expect(qr.svg.startsWith('<svg')).toBe(true);
    expect(qr.svg).toContain('<path');
    // border 4 both sides -> viewBox is size + 8.
    expect(qr.svg).toContain(`viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"`);
    // qrModulesToSvg is the same renderer the result used.
    expect(qrModulesToSvg(qr.modules, { border: 4, scale: 8 })).toBe(qr.svg);
  });
});

describe('decodeConnectionCardQr guards', () => {
  it('returns null on a malformed (non-QR-sized) grid', () => {
    expect(decodeConnectionCardQr([[true, false]])).toBeNull();
    expect(decodeConnectionCardQr([])).toBeNull();
  });
});
