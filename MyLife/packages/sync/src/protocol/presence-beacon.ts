/**
 * Opt-in peer-validated presence beacons (Plan 29 Phase 6, 2026-07-01 amendment).
 *
 * Presence in Meerkat is NOT a server-side who-is-online registry and never will
 * be. It is an OPT-IN, peer-validated, end-to-end feature (default OFF): a member
 * who chooses to appear online SIGNS a short-lived beacon and SEALS it to each
 * co-member over the same transport the community's Plan 27 policy allows. The
 * relay reads only a token and a ciphertext size -- it learns no device id, no
 * membership fact, and no "online" bit. A viewer counts presence only from real
 * verified signed rows with an honest TTL: never a fabricated dot, never a
 * "last seen" the recipient did not actually sign, never a server figure.
 *
 * A beacon asserts exactly one thing: "this signed device is currently sharing
 * presence in this community, valid until issuedAt + ttl". No content, no
 * location, no free-text last-seen. Its signing domain (`meerkat-presence-v1`)
 * is DISTINCT from the session, DM, channel, and humanity domains, so a presence
 * beacon can never be confused with -- or replayed as -- any of them.
 *
 * Two-layer authority (mirrors dm-shred's author guard):
 *  1. verifyPresenceBeacon checks the Ed25519 signature under the beacon's
 *     claimed `deviceId`, so only that device can mint a beacon naming itself.
 *  2. openPresenceBeaconMailbox binds the sealing envelope's signer to that same
 *     `deviceId`, so a member cannot relay or replay another member's beacon as
 *     if it were its own park -- presence is strictly self-asserted.
 *  3. presenceCounts additionally drops any beacon whose signer is not in the
 *     community's SIGNED roster (a removed or non-member beacon never counts),
 *     re-verifying the signature and freshness from the stored row at count time
 *     (fail-closed: the stored row is never trusted, only re-verified bytes are).
 *
 * Storage: received beacons land in the app-side `cm_presence_beacons` table
 * (device_local scope; see PRESENCE_BEACON_SYNC_RULE) so they never replicate
 * through the CRDT document onto any wider transport. This engine provides the
 * schema + record/prune/count helpers; the app owns the migration and the
 * COMMUNITY_SYNC_POLICY entity rule.
 *
 * No new cryptography (NC-5): reuses the shipped identity + mailbox seal.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import {
  deriveMailboxToken,
  resolveMailboxSealClock,
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';
import { communityRole, getCommunity, verifyDescriptorOwnerSignature } from './community';

export const PRESENCE_BEACON_MAILBOX_KIND = 'meerkat.presence-beacon-v1';
const PRESENCE_DOMAIN = 'meerkat-presence-v1';

/** Received beacons live here, TTL-pruned, device_local scope (never replicated). */
export const PRESENCE_BEACONS_TABLE = 'cm_presence_beacons';

/**
 * Sanity ceiling on a beacon's declared TTL. Presence is ephemeral; a beacon
 * claiming a multi-day "online" window is dishonest and is rejected as invalid.
 */
export const PRESENCE_MAX_TTL_SECONDS = 24 * 60 * 60;

/**
 * Tolerated forward clock skew (ms). A beacon issued further in the future than
 * this is treated as a forged/dishonest timestamp (invalid), not merely fresh.
 */
export const PRESENCE_CLOCK_SKEW_MS = 5 * 60 * 1000;

const encoder = new TextEncoder();

/**
 * A signed presence beacon. Carries no content, no location, no last-seen text:
 * only the community, the signing device, when it was issued, and how long it is
 * honest for.
 */
export interface PresenceBeacon {
  version: 1;
  communityId: string;
  /** The device asserting presence (its own Ed25519 key). */
  deviceId: string;
  /** Epoch ms the beacon was signed. */
  issuedAt: number;
  /** Freshness window in seconds; the beacon is honest until issuedAt + ttl. */
  ttlSeconds: number;
  /** Hex Ed25519 signature over the canonical beacon form. */
  signature: string;
}

export type PresenceBeaconInput = Pick<PresenceBeacon, 'communityId' | 'issuedAt' | 'ttlSeconds'>;

/** fresh: signed, in-window, sane clock. expired: signed but past TTL. invalid: anything else. */
export type PresenceVerdict = 'fresh' | 'expired' | 'invalid';

function canonicalPresenceBeacon(beacon: Omit<PresenceBeacon, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    PRESENCE_DOMAIN,
    beacon.version,
    beacon.communityId,
    beacon.deviceId,
    beacon.issuedAt,
    beacon.ttlSeconds,
  ]));
}

/** Sign a presence beacon for one community; the signer's key is the beacon device id. */
export function signPresenceBeacon(signer: DeviceIdentity, input: PresenceBeaconInput): PresenceBeacon {
  const unsigned: Omit<PresenceBeacon, 'signature'> = {
    version: 1,
    communityId: input.communityId,
    deviceId: signer.publicKey,
    issuedAt: input.issuedAt,
    ttlSeconds: input.ttlSeconds,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(signer.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalPresenceBeacon(unsigned)));
  return { ...unsigned, signature };
}

/**
 * Verify a beacon against its claimed signer and the current clock. When
 * `expectedSignerDeviceId` is provided the beacon's own deviceId must equal it
 * (binds a stored row's key to the signed bytes). Fail-closed: a bad shape,
 * mismatched signer, bad signature, or a future-dated timestamp all return
 * 'invalid'; a well-signed but past-TTL beacon returns 'expired'.
 */
export function verifyPresenceBeacon(
  beacon: unknown,
  expectedSignerDeviceId: string | null,
  nowMs: number,
): PresenceVerdict {
  if (!isPresenceBeacon(beacon)) return 'invalid';
  if (expectedSignerDeviceId !== null && beacon.deviceId !== expectedSignerDeviceId) return 'invalid';

  let signatureOk = false;
  try {
    const { signature, ...unsigned } = beacon;
    signatureOk = verifySignature(
      beacon.deviceId,
      canonicalPresenceBeacon(unsigned),
      hexToBytes(signature),
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return 'invalid';

  // A beacon dated meaningfully in the future is dishonest, not fresh.
  if (beacon.issuedAt - nowMs > PRESENCE_CLOCK_SKEW_MS) return 'invalid';

  const expiresAt = beacon.issuedAt + beacon.ttlSeconds * 1000;
  return nowMs >= expiresAt ? 'expired' : 'fresh';
}

export interface PresenceBeaconMailboxPayload {
  kind: typeof PRESENCE_BEACON_MAILBOX_KIND;
  version: 1;
  beacon: PresenceBeacon;
}

export interface SealPresenceBeaconInput {
  /** The device parking its OWN beacon (must equal beacon.deviceId). */
  sender: DeviceIdentity;
  /** One co-member the beacon is addressed to. */
  recipient: { deviceId: string; dhPublicKey: string };
  pairSharedSecretHex: string;
  beacon: PresenceBeacon;
  now?: string;
}

export interface SealPresenceBeaconResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: PresenceBeaconMailboxPayload;
}

/** Seal a beacon to one co-member's pair-private mailbox (relay sees token + size only). */
export function sealPresenceBeacon(input: SealPresenceBeaconInput): SealPresenceBeaconResult {
  const payload: PresenceBeaconMailboxPayload = {
    kind: PRESENCE_BEACON_MAILBOX_KIND,
    version: 1,
    beacon: input.beacon,
  };
  const clock = resolveMailboxSealClock(input.now);
  const token = deriveMailboxToken(
    input.pairSharedSecretHex,
    input.recipient.deviceId,
    clock.nowMs,
  );
  const envelope = sealMailboxDelta(input.sender, input.recipient, payload, clock.nowIso);
  return { token, envelope, payload };
}

export type PresenceBeaconMailboxRejectReason =
  | 'invalid_payload'
  | 'invalid_beacon'
  | 'wrong_sender'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'invalid_signature'
  | 'malformed';

export type OpenPresenceBeaconMailboxResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      beacon: PresenceBeacon;
      /** Freshness at open time; a caller may skip persisting an already-expired beacon. */
      verdict: Exclude<PresenceVerdict, 'invalid'>;
    }
  | { ok: false; reason: PresenceBeaconMailboxRejectReason };

/**
 * Open + verify a sealed presence beacon. Fail-closed on decrypt / wrong kind /
 * bad shape, on a beacon whose own signature does not verify (invalid_beacon),
 * and when the envelope signer is not the beacon's device (wrong_sender) -- a
 * member cannot relay or replay another member's presence. Freshness is not a
 * rejection here (it is decided at count time), but the verdict is returned so
 * the caller can drop an already-expired beacon before storing it.
 */
export function openPresenceBeaconMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  nowMs: number = Date.now(),
): OpenPresenceBeaconMailboxResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== PRESENCE_BEACON_MAILBOX_KIND
    || payload.version !== 1
    || !isPresenceBeacon(payload.beacon)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const beacon = payload.beacon;
  // Bind the sealing signer to the beacon's device: presence is self-asserted,
  // so a member can never park a beacon naming another device.
  if (beacon.deviceId !== opened.senderDeviceId) return { ok: false, reason: 'wrong_sender' };

  const verdict = verifyPresenceBeacon(beacon, opened.senderDeviceId, nowMs);
  if (verdict === 'invalid') return { ok: false, reason: 'invalid_beacon' };

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    beacon,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Device-local store: received beacons (schema + record/prune/count helpers)
// ---------------------------------------------------------------------------

/**
 * DDL for the received-beacon store. One row per (community, signer); a newer
 * beacon from the same device replaces an older one. The app owns the migration
 * and MUST declare this table device_local (see PRESENCE_BEACON_SYNC_RULE) so a
 * beacon never rides the CRDT document onto a wider transport.
 */
export const CREATE_PRESENCE_BEACONS_TABLE = `
CREATE TABLE IF NOT EXISTS ${PRESENCE_BEACONS_TABLE} (
  community_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  beacon_json TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (community_id, device_id)
);`;

/**
 * The COMMUNITY_SYNC_POLICY entity rule the apps MUST add for the beacon store.
 * Presence beacons travel only as sealed mailbox parks, never through the CRDT
 * document, so the table is capped device_local end to end (mirrors
 * cm_public_directory_cache). Drop this into COMMUNITY_SYNC_POLICY.entityRules
 * in community-core.ts / meerkat-data.ts (and the multi-node harness).
 */
export const PRESENCE_BEACON_SYNC_RULE = {
  tableName: PRESENCE_BEACONS_TABLE,
  defaultScope: 'device_local',
  maxScope: 'device_local',
  conflictStrategy: 'lww',
} as const;

/** Create the beacon store if absent (idempotent). */
export function ensurePresenceBeaconTable(db: DatabaseAdapter): void {
  db.execute(CREATE_PRESENCE_BEACONS_TABLE);
}

/**
 * Persist a received beacon, keeping only the newest per (community, device).
 * Store the full signed beacon so presenceCounts can re-verify from bytes.
 */
export function recordPresenceBeacon(
  db: DatabaseAdapter,
  beacon: PresenceBeacon,
  receivedAtMs: number = Date.now(),
): void {
  db.execute(
    `INSERT INTO ${PRESENCE_BEACONS_TABLE}
       (community_id, device_id, issued_at, ttl_seconds, beacon_json, received_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(community_id, device_id) DO UPDATE SET
       issued_at = excluded.issued_at,
       ttl_seconds = excluded.ttl_seconds,
       beacon_json = excluded.beacon_json,
       received_at = excluded.received_at
     WHERE excluded.issued_at > ${PRESENCE_BEACONS_TABLE}.issued_at`,
    [
      beacon.communityId,
      beacon.deviceId,
      beacon.issuedAt,
      beacon.ttlSeconds,
      JSON.stringify(beacon),
      receivedAtMs,
    ],
  );
}

/** Delete beacons whose TTL has elapsed as of nowMs. Returns nothing (best-effort). */
export function prunePresenceBeacons(db: DatabaseAdapter, nowMs: number = Date.now()): void {
  db.execute(
    `DELETE FROM ${PRESENCE_BEACONS_TABLE} WHERE issued_at + ttl_seconds * 1000 <= ?`,
    [nowMs],
  );
}

export interface PresenceMember {
  deviceId: string;
  issuedAt: number;
  /** Epoch ms the beacon stops being honest; the UI shows freshness relative to this. */
  expiresAt: number;
}

export interface PresenceCountResult {
  /** Number of DISTINCT validated members with a fresh signed beacon right now. */
  count: number;
  members: PresenceMember[];
}

/**
 * Count members currently sharing presence in a community, from real signed rows
 * only. A signer counts iff (a) its stored beacon re-verifies as FRESH against
 * its own key and the current clock AND (b) it is in the community's SIGNED
 * roster (communityRole !== null). A forged, replayed-into-a-wrong-row, expired,
 * or non-member/removed-member beacon is dropped fail-closed. Returns 0 when the
 * community is unknown (no roster to validate against), the stored descriptor's
 * OWNER signature does not verify (a locally-tampered roster is never trusted),
 * or the store is absent.
 */
export function presenceCounts(
  db: DatabaseAdapter,
  communityId: string,
  nowMs: number = Date.now(),
): PresenceCountResult {
  const community = getCommunity(db, communityId);
  if (!community) return { count: 0, members: [] };
  // The roster is authoritative only if the stored descriptor is owner-signed.
  // Re-verify from bytes so a tampered sync_communities row cannot inflate the
  // count with a forged membership. Fail-closed to zero.
  if (!verifyDescriptorOwnerSignature({ descriptor: community.descriptor, signature: community.signature })) {
    return { count: 0, members: [] };
  }

  let rows: Array<{ device_id: string; beacon_json: string }>;
  try {
    rows = db.query<{ device_id: string; beacon_json: string }>(
      `SELECT device_id, beacon_json FROM ${PRESENCE_BEACONS_TABLE} WHERE community_id = ?`,
      [communityId],
    );
  } catch {
    // Store not migrated yet: no presence, fail-closed to zero.
    return { count: 0, members: [] };
  }

  const members: PresenceMember[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    let beacon: unknown;
    try {
      beacon = JSON.parse(row.beacon_json);
    } catch {
      continue;
    }
    // Re-verify from bytes, bound to the stored row key; never trust the row.
    if (verifyPresenceBeacon(beacon, row.device_id, nowMs) !== 'fresh') continue;
    if (!isPresenceBeacon(beacon)) continue;
    if (beacon.communityId !== communityId) continue;
    if (communityRole(community.descriptor, beacon.deviceId) === null) continue;
    if (seen.has(beacon.deviceId)) continue;
    seen.add(beacon.deviceId);
    members.push({
      deviceId: beacon.deviceId,
      issuedAt: beacon.issuedAt,
      expiresAt: beacon.issuedAt + beacon.ttlSeconds * 1000,
    });
  }

  return { count: members.length, members };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPresenceBeacon(value: unknown): value is PresenceBeacon {
  return isRecord(value)
    && value.version === 1
    && typeof value.communityId === 'string'
    && value.communityId.length > 0
    && typeof value.deviceId === 'string'
    && value.deviceId.length > 0
    && typeof value.issuedAt === 'number'
    && Number.isFinite(value.issuedAt)
    && typeof value.ttlSeconds === 'number'
    && Number.isInteger(value.ttlSeconds)
    && value.ttlSeconds > 0
    && value.ttlSeconds <= PRESENCE_MAX_TTL_SECONDS
    && typeof value.signature === 'string';
}
