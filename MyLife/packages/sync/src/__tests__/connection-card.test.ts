/**
 * Connection card codec (Plan 20, Phase 3). TC-7.
 *
 * A connection card is a tiny, NON-secret, NON-authenticating transport address
 * a host shares with members: { v:1, relay:'wss://...', communityNode?, name? }.
 * It is only a meeting-point address: pairing, SAS, and the signed handshake
 * still happen out of band, so a malicious card can cause a denial of service
 * (you connect to a useless/hostile relay) but cannot read messages, learn who
 * you talk to, or impersonate. The codec is pure + Zod-validated, rejecting any
 * non-ws(s) relay scheme. The adopt UI also accepts a bare wss:// URL.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeConnectionCard,
  parseConnectionCard,
  type ConnectionCard,
} from '../transport/connection-card';

describe('parseConnectionCard', () => {
  it('accepts a full card object encoded by encodeConnectionCard (round-trip)', () => {
    const card: ConnectionCard = {
      v: 1,
      relay: 'wss://relay.example/ws',
      communityNode: 'https://node.example',
      name: "Ada's burrow",
    };
    const encoded = encodeConnectionCard(card);
    expect(parseConnectionCard(encoded)).toEqual(card);
  });

  it('accepts a bare wss:// URL as a minimal card', () => {
    expect(parseConnectionCard('wss://relay.example')).toEqual({ v: 1, relay: 'wss://relay.example' });
  });

  it('accepts a bare ws:// URL (LAN/testing) and trims whitespace', () => {
    expect(parseConnectionCard('  ws://192.168.1.20:8787  ')).toEqual({ v: 1, relay: 'ws://192.168.1.20:8787' });
  });

  it('accepts raw JSON without the prefix (lenient paste)', () => {
    expect(parseConnectionCard('{"v":1,"relay":"wss://r.example"}')).toEqual({ v: 1, relay: 'wss://r.example' });
  });

  it('rejects a non-ws(s) relay scheme', () => {
    expect(parseConnectionCard('{"v":1,"relay":"http://evil.example"}')).toBeNull();
    expect(parseConnectionCard('javascript:alert(1)')).toBeNull();
    expect(parseConnectionCard('https://relay.example')).toBeNull();
  });

  it('rejects a card missing the relay field', () => {
    expect(parseConnectionCard('{"v":1,"name":"x"}')).toBeNull();
  });

  it('rejects a wrong version', () => {
    expect(parseConnectionCard('{"v":2,"relay":"wss://r.example"}')).toBeNull();
  });

  it('rejects a non-https communityNode', () => {
    expect(parseConnectionCard('{"v":1,"relay":"wss://r.example","communityNode":"ftp://x"}')).toBeNull();
  });

  it('rejects empty / malformed / oversized input', () => {
    expect(parseConnectionCard('')).toBeNull();
    expect(parseConnectionCard('   ')).toBeNull();
    expect(parseConnectionCard('not a card at all')).toBeNull();
    expect(parseConnectionCard('{bad json')).toBeNull();
    expect(parseConnectionCard('MKSERVER1:' + 'x'.repeat(9000))).toBeNull();
  });
});

describe('encodeConnectionCard', () => {
  it('produces a recognizable, re-parseable MKSERVER1 string', () => {
    const encoded = encodeConnectionCard({ v: 1, relay: 'wss://r.example' });
    expect(encoded.startsWith('MKSERVER1:')).toBe(true);
    expect(parseConnectionCard(encoded)).toEqual({ v: 1, relay: 'wss://r.example' });
  });

  it('throws when asked to encode an invalid relay (a card is never built from a bad address)', () => {
    expect(() => encodeConnectionCard({ v: 1, relay: 'http://nope' } as ConnectionCard)).toThrow();
  });
});
