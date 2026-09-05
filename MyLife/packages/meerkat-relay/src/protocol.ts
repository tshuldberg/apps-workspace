/**
 * Meerkat relay wire protocol.
 *
 * JSON frames over WebSocket. The relay pairs clients by an opaque ephemeral
 * token and forwards ciphertext envelopes between them. The relay never sees
 * device identity or plaintext: `env` is an opaque base64 string it copies
 * verbatim. This matches the RelayBackend contract in
 * @mylife/sync transport/relay-transport.ts.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Limits (the relay's only opinions)
// ---------------------------------------------------------------------------

export const RELAY_LIMITS = {
  /** Max raw WebSocket frame size (envelope base64 + JSON overhead). */
  maxFrameBytes: 96 * 1024,
  /** Max envelope (base64) length. ~64 KB ciphertext. */
  maxEnvelopeChars: 90 * 1024,
  /** Max hosted entitlement token length. Signed JSON bearer tokens are small. */
  maxEntitlementChars: 16 * 1024,
  /** Minimum token length; real tokens are 64 hex chars. */
  minTokenLength: 16,
  /** Max token length accepted. */
  maxTokenLength: 256,
  /** Max simultaneous peers sharing one token. */
  maxPeersPerToken: 8,
  /** Max envelopes buffered for an absent peer, per token. */
  mailboxMax: 64,
  /** How long an undelivered envelope waits in the mailbox. */
  mailboxTtlMs: 5 * 60 * 1000,
  /** Rate-limit window. */
  rateWindowMs: 10_000,
  /** Max envelopes a single connection may relay per window. */
  rateMaxPerWindow: 200,
  /** Max rendezvous record (base64) length. A signed identity bundle is small. */
  maxRendezvousChars: 8 * 1024,
  /** How long a published rendezvous record waits to be resolved. */
  rendezvousTtlMs: 10 * 60 * 1000,
  /** Max rendezvous records held at once (bounds memory; a friend-code DoS cap). */
  maxRendezvousRecords: 10_000,
  /** Max pub/res operations a single connection may issue per window. */
  rendezvousMaxPerWindow: 30,
  /** Global cap on simultaneous connections (a memory-exhaustion backstop). */
  maxConnections: 10_000,
  /** Max simultaneous connections from one client (IP). Defeats reconnect floods. */
  maxConnectionsPerClient: 64,
  /** Global cap on distinct token groups held at once. */
  maxTokens: 8_192,
  /** Global cap on distinct mailbox queues (each token's store) held at once. */
  maxMailboxTokens: 4_096,
  /**
   * Content-host registry (share-link host discovery). A seeder announces an
   * OPAQUE record under a derived rid; resolvers read the whole live set without
   * consuming it. These caps bound the registry's memory the way the rendezvous
   * caps bound the single-record store; existing values above are untouched.
   */
  /** Global cap on distinct registry rids held at once. */
  maxRegistryRids: 10_000,
  /** Max distinct announcers (host slots) under one rid. */
  maxAnnouncersPerRid: 64,
  /** How long an announce record lives before sweep prunes it. */
  registryTtlMs: 30 * 60 * 1000,
} as const;

/** Overridable copy of the limits (defaults above; mailbox-mode relays raise TTL). */
export type RelayLimits = { [K in keyof typeof RELAY_LIMITS]: number };

// ---------------------------------------------------------------------------
// Env-configurable fair-use caps (Plan 20, Phase 2)
// ---------------------------------------------------------------------------

/**
 * The fair-use caps a deployment may tune from env, each with a SAFE [min,max].
 * Only these 8 operational caps are env-tunable; the schema/size bounds above
 * stay fixed. Clamping is the security property: a value above `max` would let
 * an operator (or a tricked non-technical host) turn the relay into a high-rate
 * ciphertext amplifier; a value below `min` would DoS the host's own members.
 */
interface RelayLimitEnvSpec {
  env: string;
  key: keyof RelayLimits;
  min: number;
  max: number;
}

const RELAY_LIMIT_ENV: readonly RelayLimitEnvSpec[] = [
  { env: 'RELAY_MAX_CONNECTIONS', key: 'maxConnections', min: 8, max: 200_000 },
  { env: 'RELAY_MAX_PER_CLIENT', key: 'maxConnectionsPerClient', min: 1, max: 4_096 },
  { env: 'RELAY_MAX_PEERS_PER_TOKEN', key: 'maxPeersPerToken', min: 2, max: 64 },
  { env: 'RELAY_ENV_RATE', key: 'rateMaxPerWindow', min: 10, max: 5_000 },
  { env: 'RELAY_RENDEZVOUS_RATE', key: 'rendezvousMaxPerWindow', min: 5, max: 1_000 },
  { env: 'RELAY_WINDOW_MS', key: 'rateWindowMs', min: 1_000, max: 60_000 },
  { env: 'RELAY_MAILBOX_MAX', key: 'mailboxMax', min: 8, max: 4_096 },
  { env: 'RELAY_MAILBOX_TTL_MS', key: 'mailboxTtlMs', min: 10_000, max: 86_400_000 },
];

/**
 * Resolve the effective relay limits from env (Plan 20, Phase 2). Returns a full
 * RelayLimits: defaults for everything, with each of the 8 tunable caps
 * overridden from its env var and CLAMPED to a safe [min,max]. An unset, empty,
 * or non-integer env value falls back to the default (never throws). Pure: it
 * never mutates RELAY_LIMITS. Unset env reproduces today's RELAY_LIMITS exactly.
 */
export function resolveRelayLimits(env: Record<string, string | undefined> = {}): RelayLimits {
  const limits: { -readonly [K in keyof RelayLimits]: number } = { ...RELAY_LIMITS };
  for (const spec of RELAY_LIMIT_ENV) {
    const raw = env[spec.env];
    if (raw == null || raw.trim() === '') continue; // unset -> default
    const n = Number(raw);
    if (!Number.isInteger(n)) continue; // garbage / float -> default
    limits[spec.key] = Math.min(spec.max, Math.max(spec.min, n)); // clamp
  }
  return limits;
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/** Client announces the token it wants to join. */
const HostedEntitlementSchema = z.string().min(1).max(RELAY_LIMITS.maxEntitlementChars).optional();

export const HelloFrameSchema = z.object({
  t: z.literal('hello'),
  token: z.string().min(RELAY_LIMITS.minTokenLength).max(RELAY_LIMITS.maxTokenLength),
  ttlMs: z.number().int().positive().optional(),
  entitlement: HostedEntitlementSchema,
});

/** Either direction: an opaque ciphertext envelope. */
export const EnvFrameSchema = z.object({
  t: z.literal('env'),
  env: z.string().min(1).max(RELAY_LIMITS.maxEnvelopeChars),
  ts: z.number().optional(),
});

/** Client leaves cleanly. */
export const ByeFrameSchema = z.object({ t: z.literal('bye') });

/** A hex rendezvous id (a friend code's 8-byte id, hex-encoded; salts allowed). */
const RendezvousIdSchema = z.string().regex(/^[0-9a-f]{16,64}$/);

/**
 * Publish an OPAQUE rendezvous record under a short id (MK-016). The relay
 * stores `rec` verbatim and never parses it -- it is base64(ciphertext-or-bundle)
 * to the relay, exactly as `env` is. A resolver who knows the id fetches it once.
 */
export const PubFrameSchema = z.object({
  t: z.literal('pub'),
  rid: RendezvousIdSchema,
  rec: z.string().min(1).max(RELAY_LIMITS.maxRendezvousChars),
  ttlMs: z.number().int().positive().optional(),
  entitlement: HostedEntitlementSchema,
});

/** Resolve (and consume) a published rendezvous record by its short id. */
export const ResFrameSchema = z.object({
  t: z.literal('res'),
  rid: RendezvousIdSchema,
  entitlement: HostedEntitlementSchema,
});

/** A 64-hex content-registry id (HKDF-derived; the relay never sees the contentId). */
const RegistryIdSchema = z.string().regex(/^[0-9a-f]{16,64}$/);

/**
 * Announce that this node SERVES some content at a web-seed URL, under an
 * OPAQUE rid (share-link host discovery). Unlike `pub`/`res` (single-record,
 * consume-on-first-resolve), the registry is MULTI-announcer and NON-consuming:
 * many seeders announce under one rid and resolvers read the whole live set
 * repeatedly. `rec` is base64(secretbox(host url)) keyed by a secret only
 * share-link holders can derive, so the relay copies it verbatim and learns
 * nothing -- exactly like `env`/rendezvous. A fresh nonce per announce; the
 * announcer's slot is keyed by its connection's client key so a re-announce
 * refreshes one slot rather than minting duplicates.
 */
export const AnnounceFrameSchema = z.object({
  t: z.literal('ann'),
  rid: RegistryIdSchema,
  rec: z.string().min(1).max(RELAY_LIMITS.maxRendezvousChars),
  ttlMs: z.number().int().positive().optional(),
  entitlement: HostedEntitlementSchema,
});

/** Look up ALL live announce records for a rid (non-consuming, idempotent). */
export const LookupFrameSchema = z.object({
  t: z.literal('lk'),
  rid: RegistryIdSchema,
  entitlement: HostedEntitlementSchema,
});

/** Any client->server frame. */
export const ClientFrameSchema = z.discriminatedUnion('t', [
  HelloFrameSchema,
  EnvFrameSchema,
  ByeFrameSchema,
  PubFrameSchema,
  ResFrameSchema,
  AnnounceFrameSchema,
  LookupFrameSchema,
]);

export type HelloFrame = z.infer<typeof HelloFrameSchema>;
export type EnvFrame = z.infer<typeof EnvFrameSchema>;
export type ByeFrame = z.infer<typeof ByeFrameSchema>;
export type PubFrame = z.infer<typeof PubFrameSchema>;
export type ResFrame = z.infer<typeof ResFrameSchema>;
export type AnnounceFrame = z.infer<typeof AnnounceFrameSchema>;
export type LookupFrame = z.infer<typeof LookupFrameSchema>;
export type ClientFrame = z.infer<typeof ClientFrameSchema>;

/** Server->client frames. */
export type ReadyFrame = { t: 'ready'; peers: number; queued: number };
export type ServerEnvFrame = { t: 'env'; env: string; ts: number };
export type PubOkFrame = { t: 'pubok'; rid: string; expiresAt?: number };
export type RecFrame = { t: 'rec'; rid: string; rec: string };
export type AnnOkFrame = { t: 'annok'; rid: string };
export type HostsFrame = { t: 'hosts'; rid: string; recs: string[] };
export type ErrFrame = { t: 'err'; code: RelayErrorCode; msg: string };
export type ServerFrame =
  | ReadyFrame
  | ServerEnvFrame
  | PubOkFrame
  | RecFrame
  | AnnOkFrame
  | HostsFrame
  | ErrFrame;

export type RelayErrorCode =
  | 'bad_frame'
  | 'not_joined'
  | 'already_joined'
  | 'token_full'
  | 'rate_limited'
  | 'too_large'
  | 'not_found'
  | 'store_full'
  | 'server_full'
  | 'too_many_connections'
  | 'registry_full'
  | 'rid_full'
  | 'entitlement_required'
  | 'entitlement_invalid';

/**
 * Parse and validate a raw client frame. Returns null on any malformed input
 * so the server can reject without throwing.
 */
export function parseClientFrame(raw: string): ClientFrame | null {
  if (raw.length > RELAY_LIMITS.maxFrameBytes) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = ClientFrameSchema.safeParse(json);
  return result.success ? result.data : null;
}
