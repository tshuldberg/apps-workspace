/**
 * Public-join redeem (Plan 19 FF3). The joiner-side counterpart to the owner-signed
 * publicJoin grant on a PublicationDescriptor (publication.ts).
 *
 * SECURITY INVARIANT (the whole point): redeeming an OPEN-join grant records an
 * owner-authorized ROSTER membership ONLY. It writes NO key material -- no epoch key,
 * no key-wrap row -- so getCurrentEpochKey stays null and the redeemer gets ZERO read
 * access. Read/post access (the epoch key) is mintable ONLY by the owner-gated
 * commitMemberAdd -> wrapSecret(secret, joiner.dhPublicKey) path delivered via
 * applyJoinGrant -> storeReceivedKeyWrap. If this ever handed an arbitrary unvetted
 * joiner the epoch key, community confidentiality would break for every existing
 * member. The grant changes owner POLICY (auto-approve a grant-bearing request), never
 * the key MECHANISM.
 *
 * The caller MUST pass a FRESHLY FETCHED + verified descriptor: a stale cached one
 * cannot self-detect a later revoke/kill, so the live host descriptor is the trust
 * anchor (mirrors the public reader's fetchPublicSnapshot binding).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import {
  verifyPublication,
  verifyPublicJoinGrant,
  type SignedPublicationDescriptor,
} from './publication';
import { createWorkspace, getWorkspace } from '../db/queries';
import { hkdf, sha512Hex } from '../node/hkdf';
import {
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';
import {
  createSignedIdentityBundle,
  verifySignedIdentityBundle,
  type SignedIdentityBundle,
} from './identity-bundle';
import { parseHumanityToken } from './humanity-credential';

export type RedeemPublicJoinResult =
  | { ok: true; communityId: string }
  | { ok: false; reason: 'grant_invalid' };

/**
 * Redeem an owner-signed OPEN-join grant into a local roster membership. Returns
 * grant_invalid (fail-closed) unless verifyPublicJoinGrant passes on the supplied
 * (freshly fetched) descriptor. On success it bridges the workspace if absent and
 * inserts EXACTLY one sync_workspace_members row (role 'member'); it writes no key.
 */
export function redeemPublicJoinGrant(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  signed: SignedPublicationDescriptor,
  now: string = new Date().toISOString(),
): RedeemPublicJoinResult {
  if (!verifyPublicJoinGrant(signed)) return { ok: false, reason: 'grant_invalid' };
  const d = signed.descriptor;

  // Bridge the workspace so the roster row has a parent (mirrors applyJoinGrant's
  // minimal bridge). currentKeyVersion 0 = no epoch key held; NEVER ingest a community
  // descriptor or mint/store an epoch key here.
  if (!getWorkspace(db, d.communityId)) {
    createWorkspace(db, {
      id: d.communityId,
      displayName: d.title,
      workspaceType: 'community',
      createdByDeviceId: d.ownerDeviceId,
      createdAt: d.createdAt,
      rotatedAt: null,
      currentKeyVersion: 0,
      archivedAt: null,
    });
  }
  // INSERT OR IGNORE: a re-redeem is idempotent and never duplicates the roster row.
  db.execute(
    `INSERT OR IGNORE INTO sync_workspace_members
       (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
     VALUES (?, ?, 'member', ?, ?, NULL)`,
    [d.communityId, identity.publicKey, d.ownerDeviceId, now],
  );
  return { ok: true, communityId: d.communityId };
}

// ---------------------------------------------------------------------------
// REQUEST-policy public join (Plan 19 FF3): a DISTINCT sealed mailbox kind.
//
// An OPEN-policy join redeems locally (redeemPublicJoinGrant, above): no owner
// round-trip, roster row only. A REQUEST-policy join has no local shortcut -- the
// owner must approve it -- and a public community has NO SignedCommunityInvite, so
// the invite-based buildJoinRequest / JOIN_REQUEST_MAILBOX_KIND path does NOT apply.
// This is its own payload kind, sealed to the owner's PUBLIC DH key from the grant.
//
// The park token derives from PUBLIC descriptor fields ONLY (publicationId, grantId,
// ownerDeviceId) under a distinct HKDF domain, so the joiner and owner compute the same
// mailbox address with NO shared secret and NO epoch leak -- anyone holding the public
// descriptor can address the box, but only the owner (holder of the grant's DH private
// key) can OPEN it. Sealing/opening reuse the exact mailbox primitives (sealMailboxDelta /
// openMailboxDelta): the relay sees a 64-hex token and a ciphertext size, nothing else.
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Distinct sealed-payload kind for a request-policy public join (never reuses JOIN_REQUEST_MAILBOX_KIND). */
export const PUBLIC_JOIN_REQUEST_MAILBOX_KIND = 'meerkat.public-join-v1';

/** Distinct HKDF domain for the public-join park token (never collides with the pair/community token domains). */
const PUBLIC_JOIN_TOKEN_DOMAIN = 'meerkat-public-join-v1';

/**
 * Derive the public-join park token from PUBLIC descriptor fields ONLY. HKDF over
 * `publicationId \0 grantId \0 ownerDeviceId` under domain 'meerkat-public-join-v1',
 * SHA-512'd and sliced to 64 hex chars (the deriveMailboxToken shape). There is NO
 * shared secret and NO epoch input, so both parties derive it identically from the
 * public descriptor and it changes if ANY of the three fields changes. Rotating the
 * grantId (revisePublication) therefore moves the mailbox, which is the revoke lever.
 */
export function derivePublicJoinToken(
  publicationId: string,
  grantId: string,
  ownerDeviceId: string,
): string {
  const ikm = encoder.encode(`${publicationId}\0${grantId}\0${ownerDeviceId}`);
  return sha512Hex(hkdf(ikm, PUBLIC_JOIN_TOKEN_DOMAIN)).slice(0, 64);
}

/** The joiner-signed, owner-sealed request body (self-signed via the mailbox envelope). */
export interface PublicJoinRequestPayload {
  kind: typeof PUBLIC_JOIN_REQUEST_MAILBOX_KIND;
  version: 1;
  publicationId: string;
  communityId: string;
  /** The grantId the joiner redeemed against (binds the request to THIS grant revision). */
  grantId: string;
  /** The joiner's signed identity bundle: binds the joiner's x25519 DH key to its device id
   * so the owner can later wrap the epoch key to the joiner (the key still flows solely
   * through the owner-gated wrap rail; this request confers NO read access on its own). */
  bundle: SignedIdentityBundle;
  /**
   * REQUIRED anti-sybil humanity proof (Plan 24 P3, AM1). The wire-serialized
   * HumanityToken (serializeHumanityToken) the joiner obtained from the humanity
   * service; it rides sealed + signed inside this envelope. openPublicJoinRequest
   * FAILS CLOSED unless it parses to a well-formed token (parseHumanityToken), so
   * a request with no/malformed proof can never be opened into an owner-queue
   * row. The engine only guarantees a shape-valid token is bound to the request;
   * the owner-drain recording site runs verifyHumanityToken (service signature +
   * expiry, against the pinned service key) and the humanity SERVICE does the
   * single-spend redeem before the queue row is recorded (the engine never fakes
   * that verification).
   */
  humanityToken: string;
}

export type QueuePublicJoinResult =
  | { ok: true; token: string; envelope: MailboxEnvelope; payload: PublicJoinRequestPayload }
  | { ok: false; reason: 'grant_invalid' };

/**
 * Build + seal a request-policy public-join request to the publication owner. Fail-closed
 * (returns { ok:false, reason:'grant_invalid' }, NEVER throws) unless the supplied
 * descriptor is owner-signed + valid (verifyPublication === 'ok') AND carries a well-formed
 * publicJoin.ownerDhPublicKey. On success it returns the park token (public-field-derived),
 * the sealed envelope (to the owner's DH public key), and the joiner-signed payload.
 *
 * HONESTY: returning ok:true means the request was SEALED, not SENT. The caller must only
 * claim "sent" if it actually parks the envelope on a relay (parkEnvelope === true); with
 * no relay it stays on the device ("Saved on this device. It will be sent when a connection
 * server is available."). NEVER serialize any private/epoch key into the payload.
 *
 * `humanityToken` is the joiner's anti-sybil proof (Plan 24 P3, AM1). Production
 * callers MUST pass the token obtained from the humanity service; it is sealed
 * into the payload and enforced non-empty on the owner-drain side. The param is
 * optional ONLY as a pure-engine escape hatch for unit tests; when omitted the
 * payload carries an empty token that openPublicJoinRequest rejects fail-closed,
 * so a token-less request can never reach an owner queue.
 */
export function queuePublicJoinRequest(
  identity: DeviceIdentity,
  signed: SignedPublicationDescriptor,
  humanityToken: string = '',
  now: string = new Date().toISOString(),
): QueuePublicJoinResult {
  // Only a verifiably owner-signed, valid descriptor carrying the owner DH key yields a
  // request. verifyPublication already fail-closes on kill/unpublish/tamper/shape.
  if (verifyPublication(signed) !== 'ok') return { ok: false, reason: 'grant_invalid' };
  const grant = signed.descriptor.publicJoin;
  if (
    !grant
    || typeof grant.ownerDhPublicKey !== 'string'
    || !/^[0-9a-f]{64}$/i.test(grant.ownerDhPublicKey)
    || typeof grant.grantId !== 'string'
  ) {
    return { ok: false, reason: 'grant_invalid' };
  }

  const d = signed.descriptor;
  const payload: PublicJoinRequestPayload = {
    kind: PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
    version: 1,
    publicationId: d.publicationId,
    communityId: d.communityId,
    grantId: grant.grantId,
    bundle: createSignedIdentityBundle(identity, [], now),
    humanityToken,
  };
  const token = derivePublicJoinToken(d.publicationId, grant.grantId, d.ownerDeviceId);
  const envelope = sealMailboxDelta(
    identity,
    { deviceId: d.ownerDeviceId, dhPublicKey: grant.ownerDhPublicKey },
    payload,
    now,
  );
  return { ok: true, token, envelope, payload };
}

export type OpenPublicJoinRequestResult =
  | { ok: true; senderDeviceId: string; createdAt: string; payload: PublicJoinRequestPayload }
  | { ok: false; reason: 'invalid_payload' | 'invalid_signature' | 'wrong_recipient' | 'decrypt_failed' | 'malformed' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Owner-side counterpart to queuePublicJoinRequest: decrypt + verify a parked public-join
 * request. Mirrors openJoinRequestMailbox. openMailboxDelta enforces the envelope signature
 * (the joiner self-signed) + recipient match + decrypt; then the inner payload is structurally
 * validated, the joiner's identity bundle re-verified, and the bundle bound to the envelope
 * signer (bundle.deviceId === senderDeviceId), all fail-closed. The recovered payload is the
 * joiner's owner-authorizable request; it confers NO read access on its own -- the epoch key
 * is still minted only by the owner-gated wrap rail.
 */
export function openPublicJoinRequest(
  owner: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenPublicJoinRequestResult {
  const opened = openMailboxDelta<unknown>(owner, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== PUBLIC_JOIN_REQUEST_MAILBOX_KIND
    || payload.version !== 1
    || typeof payload.publicationId !== 'string'
    || payload.publicationId.length === 0
    || typeof payload.communityId !== 'string'
    || payload.communityId.length === 0
    || typeof payload.grantId !== 'string'
    || payload.grantId.length === 0
    // AM1 enforcement boundary: a request MUST carry a well-formed humanity
    // token or it is never opened into an owner-queueable payload (fail-closed).
    // parseHumanityToken validates SHAPE only; the token's cryptographic
    // VALIDITY (service signature + expiry via verifyHumanityToken) and its
    // single-spend are checked by the owner-drain recording site / the humanity
    // service, not here.
    || typeof payload.humanityToken !== 'string'
    || parseHumanityToken(payload.humanityToken) === null
    || !verifySignedIdentityBundle(payload.bundle as SignedIdentityBundle)
    || (payload.bundle as SignedIdentityBundle).bundle.deviceId !== opened.senderDeviceId
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: {
      kind: PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
      version: 1,
      publicationId: payload.publicationId,
      communityId: payload.communityId,
      grantId: payload.grantId,
      bundle: payload.bundle as SignedIdentityBundle,
      humanityToken: payload.humanityToken,
    },
  };
}
