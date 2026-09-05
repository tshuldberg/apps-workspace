/**
 * Connection card codec (Plan 20, Phase 3). Pure, RN-safe, Zod-validated.
 *
 * A connection card is a tiny, NON-secret, NON-authenticating payload a host
 * shares so members can reach its server: { v:1, relay, communityNode?, name? }.
 * It is ONLY a transport address. Security analysis: a relay URL is not a
 * credential -- pairing, the 5-emoji SAS, and the signed-nonce handshake still
 * happen out of band, so a malicious card can cause a DENIAL OF SERVICE (you dial
 * a useless/hostile relay) but cannot read messages (ciphertext only), learn who
 * you talk to (per-session ephemeral tokens), or impersonate (handshake is
 * fail-closed). The relay/communityNode schemes are validated; only ws(s) relays
 * and https community nodes are accepted. The adopt UI also accepts a bare wss://
 * URL as a minimal card.
 */

import { z } from 'zod';

export interface ConnectionCard {
  v: 1;
  /** ws:// or wss:// -- the meeting-point relay. */
  relay: string;
  /** Optional always-on community node (https). */
  communityNode?: string;
  /** Optional human label for the server (display only). */
  name?: string;
}

const MAX_CARD_CHARS = 8 * 1024;
const PREFIX = 'MKSERVER1:';
const WS_RE = /^wss?:\/\//i;
const HTTPS_RE = /^https?:\/\//i;

const ConnectionCardSchema = z.object({
  v: z.literal(1),
  relay: z.string().min(1).max(2048).refine((s) => WS_RE.test(s), {
    message: 'relay must be a ws:// or wss:// URL',
  }),
  communityNode: z
    .string()
    .max(2048)
    .refine((s) => HTTPS_RE.test(s), { message: 'communityNode must be an http(s) URL' })
    .optional(),
  name: z.string().max(120).optional(),
});

/**
 * Parse a pasted/scanned connection card. Accepts, in order: a bare ws(s):// URL
 * (minimal card), the MKSERVER1: encoded form, or raw JSON. Returns null on any
 * malformed, oversized, or scheme-invalid input (never throws).
 */
export function parseConnectionCard(input: string): ConnectionCard | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_CARD_CHARS) return null;

  // Bare relay URL shorthand.
  if (WS_RE.test(trimmed)) {
    const r = ConnectionCardSchema.safeParse({ v: 1, relay: trimmed });
    return r.success ? r.data : null;
  }

  const body = trimmed.startsWith(PREFIX) ? trimmed.slice(PREFIX.length) : trimmed;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = ConnectionCardSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * Encode a card to the recognizable, copyable, QR-friendly MKSERVER1 string.
 * Throws if the card is invalid (a card is never built from a bad address).
 */
export function encodeConnectionCard(card: ConnectionCard): string {
  const valid = ConnectionCardSchema.parse(card);
  return PREFIX + JSON.stringify(valid);
}
