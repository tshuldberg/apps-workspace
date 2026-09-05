/**
 * Binary message encoding/decoding for the sync protocol wire format.
 *
 * Messages are length-prefixed with a simple header:
 *   [4 bytes: total length] [1 byte: message type] [N bytes: payload]
 *
 * The type byte maps to SyncMessageType enum values.
 */

import type { SyncMessage, SyncMessageType } from '../types';

const MESSAGE_TYPE_MAP: Record<SyncMessageType, number> = {
  HELLO: 0x01,
  HELLO_ACK: 0x02,
  AUTH_CHALLENGE: 0x03,
  AUTH_RESPONSE: 0x04,
  SYNC_OFFER: 0x10,
  SYNC_ACCEPT: 0x11,
  SYNC_DATA: 0x12,
  SYNC_ACK: 0x13,
  BLOB_REQUEST: 0x20,
  BLOB_DATA: 0x21,
  BLOB_ACK: 0x22,
  GOSSIP: 0x30,
  BYE: 0xFF,
};

const REVERSE_TYPE_MAP = new Map<number, SyncMessageType>(
  Object.entries(MESSAGE_TYPE_MAP).map(([k, v]) => [v, k as SyncMessageType]),
);

/** Encode a SyncMessage into a binary frame. */
export function encodeMessage(message: SyncMessage): Uint8Array {
  const typeByte = MESSAGE_TYPE_MAP[message.type];
  if (typeByte === undefined) {
    throw new Error(`Unknown message type: ${message.type}`);
  }

  const deviceIdBytes = new TextEncoder().encode(message.deviceId.padEnd(64, '\0').slice(0, 64));
  const nonceBytes = new TextEncoder().encode(message.nonce.padEnd(32, '\0').slice(0, 32));
  const payloadLength = message.payload.length;
  const totalLength = 1 + 64 + 32 + 8 + payloadLength;

  const buffer = new Uint8Array(4 + totalLength);
  const view = new DataView(buffer.buffer);

  // Length prefix (4 bytes, big-endian)
  view.setUint32(0, totalLength, false);

  // Type byte
  buffer[4] = typeByte;

  // Device ID (64 bytes, hex string padded)
  buffer.set(deviceIdBytes, 5);

  // Nonce (32 bytes, padded)
  buffer.set(nonceBytes, 69);

  // Timestamp (8 bytes, big-endian double)
  view.setFloat64(101, message.timestamp, false);

  // Payload
  buffer.set(message.payload, 109);

  return buffer;
}

/** Decode a binary frame into a SyncMessage. Returns null if the frame is invalid. */
export function decodeMessage(data: Uint8Array): SyncMessage | null {
  if (data.length < 4 + 1 + 64 + 32 + 8) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const totalLength = view.getUint32(0, false);

  if (data.length < 4 + totalLength) return null;

  const typeByte = data[4]!;
  const type = REVERSE_TYPE_MAP.get(typeByte);
  if (!type) return null;

  const decoder = new TextDecoder();
  const deviceId = decoder.decode(data.slice(5, 69)).replace(/\0+$/, '');
  const nonce = decoder.decode(data.slice(69, 101)).replace(/\0+$/, '');
  const timestamp = view.getFloat64(101, false);
  const payload = data.slice(109, 4 + totalLength);

  return { type, deviceId, nonce, payload, timestamp };
}

/** Create a simple message (no payload). */
export function createSimpleMessage(
  type: SyncMessageType,
  deviceId: string,
  nonce: string,
): SyncMessage {
  return {
    type,
    deviceId,
    nonce,
    payload: new Uint8Array(0),
    timestamp: Date.now(),
  };
}

/** Create a message with a JSON payload. */
export function createJsonMessage(
  type: SyncMessageType,
  deviceId: string,
  nonce: string,
  payload: unknown,
): SyncMessage {
  const json = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(json);
  return {
    type,
    deviceId,
    nonce,
    payload: encoded,
    timestamp: Date.now(),
  };
}

/** Extract JSON payload from a message. Returns null if parsing fails. */
export function parseJsonPayload<T = unknown>(message: SyncMessage): T | null {
  if (message.payload.length === 0) return null;
  try {
    const text = new TextDecoder().decode(message.payload);
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
