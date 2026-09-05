import { describe, it, expect } from 'vitest';
import {
  encodeMessage,
  decodeMessage,
  createSimpleMessage,
  createJsonMessage,
  parseJsonPayload,
} from '../protocol/message-codec';
import { PushRelayClient } from '../protocol/push-relay-client';
import type { PushNotification, PushRelayOptions } from '../protocol/push-relay-client';
import type { SyncMessage, SyncMessageType } from '../types';

// ---------------------------------------------------------------------------
// All SyncMessageType values (must match the types.ts union)
// ---------------------------------------------------------------------------

const ALL_MESSAGE_TYPES: SyncMessageType[] = [
  'HELLO',
  'HELLO_ACK',
  'AUTH_CHALLENGE',
  'AUTH_RESPONSE',
  'SYNC_OFFER',
  'SYNC_ACCEPT',
  'SYNC_DATA',
  'SYNC_ACK',
  'BLOB_REQUEST',
  'BLOB_DATA',
  'BLOB_ACK',
  'BYE',
];

// ---------------------------------------------------------------------------
// encodeMessage / decodeMessage roundtrip
// ---------------------------------------------------------------------------

describe('message codec', () => {
  describe('encodeMessage/decodeMessage roundtrip', () => {
    it('roundtrips a simple message with empty payload', () => {
      const original: SyncMessage = {
        type: 'HELLO',
        deviceId: 'abc123',
        nonce: 'nonce456',
        payload: new Uint8Array(0),
        timestamp: 1710000000000,
      };

      const encoded = encodeMessage(original);
      const decoded = decodeMessage(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.type).toBe('HELLO');
      expect(decoded!.deviceId).toBe('abc123');
      expect(decoded!.nonce).toBe('nonce456');
      expect(decoded!.payload).toEqual(new Uint8Array(0));
      expect(decoded!.timestamp).toBeCloseTo(original.timestamp, -1);
    });

    it('roundtrips a message with binary payload', () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03, 0xFF, 0xFE]);
      const original: SyncMessage = {
        type: 'SYNC_DATA',
        deviceId: 'device-id-hex',
        nonce: 'random-nonce',
        payload,
        timestamp: Date.now(),
      };

      const encoded = encodeMessage(original);
      const decoded = decodeMessage(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.type).toBe('SYNC_DATA');
      expect(decoded!.deviceId).toBe('device-id-hex');
      expect(decoded!.nonce).toBe('random-nonce');
      expect(decoded!.payload).toEqual(payload);
    });

    it('roundtrips all message types', () => {
      for (const type of ALL_MESSAGE_TYPES) {
        const msg: SyncMessage = {
          type,
          deviceId: 'test-device',
          nonce: 'test-nonce',
          payload: new Uint8Array([42]),
          timestamp: 1700000000000,
        };

        const encoded = encodeMessage(msg);
        const decoded = decodeMessage(encoded);

        expect(decoded).not.toBeNull();
        expect(decoded!.type).toBe(type);
      }
    });

    it('roundtrips a message with a long device ID (truncated to 64 bytes)', () => {
      const longId = 'a'.repeat(128);
      const msg: SyncMessage = {
        type: 'BYE',
        deviceId: longId,
        nonce: 'n',
        payload: new Uint8Array(0),
        timestamp: 1000,
      };

      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);

      expect(decoded).not.toBeNull();
      // Device ID is padded/sliced to 64 bytes, so only first 64 chars survive
      expect(decoded!.deviceId).toBe('a'.repeat(64));
    });
  });

  describe('encodeMessage()', () => {
    it('returns a Uint8Array', () => {
      const msg = createSimpleMessage('HELLO', 'dev1', 'nonce1');
      const encoded = encodeMessage(msg);
      expect(encoded).toBeInstanceOf(Uint8Array);
    });

    it('throws on unknown message type', () => {
      const msg: SyncMessage = {
        type: 'UNKNOWN_TYPE' as SyncMessageType,
        deviceId: 'dev1',
        nonce: 'nonce1',
        payload: new Uint8Array(0),
        timestamp: 0,
      };
      expect(() => encodeMessage(msg)).toThrow('Unknown message type');
    });

    it('includes a 4-byte length prefix', () => {
      const msg = createSimpleMessage('HELLO', 'dev1', 'nonce1');
      const encoded = encodeMessage(msg);
      const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);
      const totalLength = view.getUint32(0, false);
      // Total frame = 4 (length prefix) + totalLength
      expect(encoded.length).toBe(4 + totalLength);
    });
  });

  describe('decodeMessage()', () => {
    it('returns null for empty data', () => {
      expect(decodeMessage(new Uint8Array(0))).toBeNull();
    });

    it('returns null for data too short (less than header)', () => {
      expect(decodeMessage(new Uint8Array(10))).toBeNull();
    });

    it('returns null for data with invalid type byte', () => {
      // Build a valid-length buffer but with an invalid type byte
      const msg = createSimpleMessage('HELLO', 'dev1', 'n');
      const encoded = encodeMessage(msg);
      // Corrupt the type byte (offset 4)
      encoded[4] = 0x00; // 0x00 is not in the type map
      expect(decodeMessage(encoded)).toBeNull();
    });

    it('returns null when declared length exceeds actual data', () => {
      const msg = createSimpleMessage('HELLO', 'dev1', 'n');
      const encoded = encodeMessage(msg);
      // Truncate the data so it's shorter than declared
      const truncated = encoded.slice(0, encoded.length - 10);
      // Only returns null if 4 + totalLength > data.length
      // The declared length is still large, but data is truncated
      const view = new DataView(truncated.buffer, truncated.byteOffset, truncated.byteLength);
      const declared = view.getUint32(0, false);
      if (truncated.length < 4 + declared) {
        expect(decodeMessage(truncated)).toBeNull();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// createSimpleMessage
// ---------------------------------------------------------------------------

describe('createSimpleMessage()', () => {
  it('creates a message with the specified type', () => {
    const msg = createSimpleMessage('BYE', 'dev1', 'nonce1');
    expect(msg.type).toBe('BYE');
  });

  it('sets the correct deviceId and nonce', () => {
    const msg = createSimpleMessage('HELLO', 'my-device', 'my-nonce');
    expect(msg.deviceId).toBe('my-device');
    expect(msg.nonce).toBe('my-nonce');
  });

  it('creates an empty payload', () => {
    const msg = createSimpleMessage('HELLO', 'dev1', 'n1');
    expect(msg.payload).toEqual(new Uint8Array(0));
    expect(msg.payload.length).toBe(0);
  });

  it('sets a numeric timestamp', () => {
    const before = Date.now();
    const msg = createSimpleMessage('HELLO_ACK', 'dev1', 'n1');
    const after = Date.now();
    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// createJsonMessage / parseJsonPayload
// ---------------------------------------------------------------------------

describe('createJsonMessage()', () => {
  it('encodes a JSON payload into bytes', () => {
    const payload = { key: 'value', count: 42 };
    const msg = createJsonMessage('SYNC_OFFER', 'dev1', 'n1', payload);

    expect(msg.type).toBe('SYNC_OFFER');
    expect(msg.payload.length).toBeGreaterThan(0);

    // Verify the payload is valid JSON when decoded
    const text = new TextDecoder().decode(msg.payload);
    const parsed = JSON.parse(text);
    expect(parsed).toEqual(payload);
  });

  it('encodes arrays correctly', () => {
    const payload = ['books', 'budget', 'recipes'];
    const msg = createJsonMessage('SYNC_ACCEPT', 'dev1', 'n1', payload);
    const parsed = parseJsonPayload<string[]>(msg);
    expect(parsed).toEqual(['books', 'budget', 'recipes']);
  });

  it('encodes nested objects', () => {
    const payload = {
      modules: [{ id: 'books', version: 3 }],
      metadata: { initiator: true },
    };
    const msg = createJsonMessage('SYNC_OFFER', 'dev1', 'n1', payload);
    const parsed = parseJsonPayload<typeof payload>(msg);
    expect(parsed).toEqual(payload);
  });
});

describe('parseJsonPayload()', () => {
  it('returns parsed JSON from a JSON message', () => {
    const data = { hello: 'world' };
    const msg = createJsonMessage('HELLO', 'dev1', 'n1', data);
    const result = parseJsonPayload<{ hello: string }>(msg);
    expect(result).toEqual({ hello: 'world' });
  });

  it('returns null for empty payload', () => {
    const msg = createSimpleMessage('BYE', 'dev1', 'n1');
    expect(parseJsonPayload(msg)).toBeNull();
  });

  it('returns null for invalid JSON payload', () => {
    const msg: SyncMessage = {
      type: 'SYNC_DATA',
      deviceId: 'dev1',
      nonce: 'n1',
      payload: new TextEncoder().encode('not valid json {{{'),
      timestamp: Date.now(),
    };
    expect(parseJsonPayload(msg)).toBeNull();
  });

  it('roundtrips complex data through createJsonMessage + parseJsonPayload', () => {
    const original = {
      deviceId: 'abc',
      nonce: '12345',
      displayName: 'Test Device',
      supportedModules: ['books', 'budget', 'fast'],
      nested: { deep: { value: true } },
    };
    const msg = createJsonMessage('HELLO', 'dev1', 'n1', original);
    const decoded = parseJsonPayload(msg);
    expect(decoded).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// MESSAGE_TYPE_MAP coverage
// ---------------------------------------------------------------------------

describe('MESSAGE_TYPE_MAP coverage', () => {
  it('every SyncMessageType can be encoded without error', () => {
    for (const type of ALL_MESSAGE_TYPES) {
      const msg: SyncMessage = {
        type,
        deviceId: 'dev',
        nonce: 'n',
        payload: new Uint8Array(0),
        timestamp: 0,
      };
      // Should not throw
      expect(() => encodeMessage(msg)).not.toThrow();
    }
  });

  it('every SyncMessageType roundtrips through encode/decode', () => {
    for (const type of ALL_MESSAGE_TYPES) {
      const msg: SyncMessage = {
        type,
        deviceId: 'test-dev',
        nonce: 'test-nonce',
        payload: new Uint8Array([1, 2, 3]),
        timestamp: 1700000000000,
      };
      const decoded = decodeMessage(encodeMessage(msg));
      expect(decoded).not.toBeNull();
      expect(decoded!.type).toBe(type);
    }
  });

  it('covers all 12 message types', () => {
    expect(ALL_MESSAGE_TYPES).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// PushRelayClient
// ---------------------------------------------------------------------------

describe('PushRelayClient (legacy facade over the real gateway client)', () => {
  interface RecordedCall {
    url: string;
    method: string;
    authorization: string;
    body: Record<string, unknown> | null;
  }

  function scriptedFetch(
    responder: (call: RecordedCall) => { status: number; body?: unknown },
  ): { fetchImpl: typeof fetch; calls: RecordedCall[] } {
    const calls: RecordedCall[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const rawBody = typeof init?.body === 'string' ? init.body : null;
      const call: RecordedCall = {
        url: String(url),
        method: init?.method ?? 'GET',
        authorization: headers.authorization ?? '',
        body: rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null,
      };
      calls.push(call);
      const { status, body } = responder(call);
      return new Response(body === undefined ? '' : JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { fetchImpl, calls };
  }

  const baseOptions = (fetchImpl: typeof fetch): PushRelayOptions => ({
    serverUrl: 'https://push.mylife.app',
    deviceToken: 'a'.repeat(64),
    provider: 'apns',
    fetchImpl,
    generateToken: () => 'A'.repeat(43),
  });

  it('starts unregistered and reports the configured server URL', () => {
    const { fetchImpl } = scriptedFetch(() => ({ status: 200, body: { status: 'ok' } }));
    const client = new PushRelayClient(baseOptions(fetchImpl));
    expect(client.isRegistered()).toBe(false);
    expect(client.getServerUrl()).toBe('https://push.mylife.app');
  });

  it('register() posts the provider token under a bearer secret and binds', async () => {
    const { fetchImpl, calls } = scriptedFetch(() => ({ status: 200, body: { status: 'ok' } }));
    const client = new PushRelayClient(baseOptions(fetchImpl));
    const result = await client.register();
    expect(result.ok).toBe(true);
    expect(client.isRegistered()).toBe(true);
    expect(calls[0]?.url).toBe('https://push.mylife.app/v1/push/registrations');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.authorization).toMatch(/^Bearer /u);
    // The device provider token rides in the body; the wake capability never does here.
    expect(calls[0]?.body?.providerToken).toBe('a'.repeat(64));
  });

  it('unregister() DELETEs the registration and clears the binding', async () => {
    const { fetchImpl, calls } = scriptedFetch(() => ({ status: 200, body: { status: 'ok' } }));
    const client = new PushRelayClient(baseOptions(fetchImpl));
    await client.register();
    const result = await client.unregister();
    expect(result.ok).toBe(true);
    expect(client.isRegistered()).toBe(false);
    expect(calls.at(-1)?.method).toBe('DELETE');
  });

  it('sendWakeNotification posts an opaque wake and returns the attempt id', async () => {
    const { fetchImpl, calls } = scriptedFetch((call) =>
      call.url.endsWith('/v1/push/wakes')
        ? { status: 202, body: { status: 'queued', attemptId: '00000000-0000-4000-8000-000000000001' } }
        : { status: 200, body: { status: 'ok' } });
    const client = new PushRelayClient(baseOptions(fetchImpl));
    const notification: PushNotification = {
      targetToken: 'B'.repeat(43),
      encryptedPayload: 'ZW5jcnlwdGVk',
      priority: 'high',
    };
    const result = await client.sendWakeNotification(notification);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.attemptId).toBe('00000000-0000-4000-8000-000000000001');
    const wakeCall = calls.find((call) => call.url.endsWith('/v1/push/wakes'));
    expect(wakeCall?.body?.payload).toBe('ZW5jcnlwdGVk');
    expect(wakeCall?.authorization).toBe(`Bearer ${'B'.repeat(43)}`);
  });

  it('returns a typed error instead of throwing on a network failure', async () => {
    const fetchImpl = (async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    const client = new PushRelayClient({ ...baseOptions(fetchImpl) });
    const result = await client.sendWakeNotification({
      targetToken: 'B'.repeat(43),
      encryptedPayload: new Uint8Array([1, 2, 3]),
      priority: 'normal',
    });
    expect(result).toEqual({ ok: false, error: 'network_error' });
  });

  it('exposes the typed gateway client for capability minting', () => {
    const { fetchImpl } = scriptedFetch(() => ({ status: 200, body: { status: 'ok' } }));
    const client = new PushRelayClient(baseOptions(fetchImpl));
    const capability = client.gateway().generateCapability();
    expect(capability).toBe('A'.repeat(43));
  });
});

// ---------------------------------------------------------------------------
// Handshake error cases (unit-level, no crypto mocking needed)
// ---------------------------------------------------------------------------

describe('handshake protocol', () => {
  // The handshake functions require crypto, identity module, and real connections.
  // We test the exported types and structure without fully mocking the crypto layer.
  // For unit-level coverage, we verify the module can be imported and has the
  // expected exports.

  it('handshake module exports initiatorHandshake and responderHandshake', async () => {
    const handshakeModule = await import('../protocol/handshake');
    expect(typeof handshakeModule.initiatorHandshake).toBe('function');
    expect(typeof handshakeModule.responderHandshake).toBe('function');
  });
});
