/**
 * FF3 public-join redeem -- the SECURITY-CRITICAL honesty invariant: redeeming an
 * owner-signed OPEN-join grant records a roster membership ONLY and confers ZERO read
 * access (no epoch key). The epoch key is mintable only by the owner-gated wrap rail.
 */

import { describe, it, expect } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { getCurrentEpochKey } from '../protocol/group-keys';
import { createPublication, createPublicJoinGrant, type CreatePublicationOptions, type PublicJoinGrant } from '../protocol/publication';
import {
  redeemPublicJoinGrant,
  queuePublicJoinRequest,
  openPublicJoinRequest,
  derivePublicJoinToken,
  PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
} from '../protocol/public-join';
import { serializeHumanityToken } from '../protocol/humanity-credential';

/** A SHAPE-valid wire humanity token (openPublicJoinRequest checks shape only). */
const WIRE_TOKEN = serializeHumanityToken({
  version: 1, tokenId: 'a'.repeat(64),
  issuedAt: '2026-07-06T00:00:00.000Z', expiresAt: '2026-10-06T00:00:00.000Z',
  signature: '00'.repeat(64),
});

const COMMUNITY = 'comm-ff3';
const GRANT: PublicJoinGrant = { version: 1, ownerDhPublicKey: 'a'.repeat(64), grantId: 'g1' };
const baseOpts: CreatePublicationOptions = {
  kind: 'community', communityId: COMMUNITY, channelId: null, postId: null,
  title: 'NYC Cyclists', description: 'd', category: 'local', contentId: 'cid',
  publicKeyHex: 'aabbcc', hostUrls: ['https://host.example'], now: '2026-06-28T00:00:00.000Z',
};

describe('redeemPublicJoinGrant (Plan 19 FF3: roster only, ZERO epoch key)', () => {
  it('writes a roster member row but confers NO read access (getCurrentEpochKey null, no key-wrap)', () => {
    const db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const pub = createPublication(owner, { ...baseOpts, joinPolicy: 'open', publicJoin: GRANT });

    const r = redeemPublicJoinGrant(db.adapter, joiner, pub, '2026-06-28T01:00:00.000Z');
    expect(r).toEqual({ ok: true, communityId: COMMUNITY });

    // The roster row exists...
    const members = db.adapter.query<{ device_id: string; role: string }>(
      'SELECT device_id, role FROM sync_workspace_members WHERE workspace_id = ?', [COMMUNITY],
    );
    expect(members).toHaveLength(1);
    expect(members[0]!.device_id).toBe(joiner.publicKey);
    expect(members[0]!.role).toBe('member');

    // ...but the joiner has ZERO read access: no epoch key was minted/stored.
    expect(getCurrentEpochKey(db.adapter, COMMUNITY, joiner)).toBeNull();
    // And NO key-wrap row was written for this community.
    const wraps = db.adapter.query('SELECT * FROM sync_workspace_keys WHERE workspace_id = ?', [COMMUNITY]);
    expect(wraps).toHaveLength(0);
  });

  it('is idempotent: a re-redeem does not duplicate the roster row', () => {
    const db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const pub = createPublication(owner, { ...baseOpts, joinPolicy: 'open', publicJoin: GRANT });
    redeemPublicJoinGrant(db.adapter, joiner, pub);
    redeemPublicJoinGrant(db.adapter, joiner, pub);
    expect(db.adapter.query('SELECT device_id FROM sync_workspace_members WHERE workspace_id = ?', [COMMUNITY])).toHaveLength(1);
  });

  it('refuses fail-closed (request policy, grant absent, revoked open->request) and writes nothing', () => {
    const db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');

    const request = createPublication(owner, { ...baseOpts, joinPolicy: 'request', publicJoin: GRANT });
    expect(redeemPublicJoinGrant(db.adapter, joiner, request)).toEqual({ ok: false, reason: 'grant_invalid' });

    const noGrant = createPublication(owner, { ...baseOpts, joinPolicy: 'open' });
    expect(redeemPublicJoinGrant(db.adapter, joiner, noGrant)).toEqual({ ok: false, reason: 'grant_invalid' });

    // A refused redeem wrote no roster row.
    expect(db.adapter.query('SELECT device_id FROM sync_workspace_members WHERE workspace_id = ?', [COMMUNITY])).toHaveLength(0);
  });
});

describe('queuePublicJoinRequest / openPublicJoinRequest (Plan 19 FF3: request-policy public join)', () => {
  const randomBytes = (n: number) => new Uint8Array(n).fill(0x7c);

  it('seals a request the OWNER can open (recovers the joiner-signed payload)', () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    // Grant carries the owner's REAL DH public key so the owner can decrypt.
    const grant = createPublicJoinGrant(owner, randomBytes);
    const pub = createPublication(owner, { ...baseOpts, joinPolicy: 'request', publicJoin: grant });

    const q = queuePublicJoinRequest(joiner, pub, WIRE_TOKEN, '2026-06-28T02:00:00.000Z');
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    expect(q.payload.kind).toBe(PUBLIC_JOIN_REQUEST_MAILBOX_KIND);
    expect(q.payload.communityId).toBe(COMMUNITY);
    expect(q.payload.grantId).toBe(grant.grantId);
    expect(q.payload.humanityToken).toBe(WIRE_TOKEN);

    const opened = openPublicJoinRequest(owner, q.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.senderDeviceId).toBe(joiner.publicKey);
    expect(opened.payload.publicationId).toBe(pub.descriptor.publicationId);
    expect(opened.payload.communityId).toBe(COMMUNITY);
    expect(opened.payload.grantId).toBe(grant.grantId);
    // The humanity token rides sealed and is exposed for service-side verification.
    expect(opened.payload.humanityToken).toBe(WIRE_TOKEN);
    // The joiner's DH key is bound to its device id inside the signed bundle.
    expect(opened.payload.bundle.bundle.deviceId).toBe(joiner.publicKey);
    expect(opened.payload.bundle.bundle.dhPublicKey).toBe(joiner.dhPublicKey);
  });

  it('AM1: an owner NEVER opens a request that carries no humanity token (fail-closed)', () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const grant = createPublicJoinGrant(owner, randomBytes);
    const pub = createPublication(owner, { ...baseOpts, joinPolicy: 'request', publicJoin: grant });

    // The pure-engine escape hatch: omit the token (only unit tests do this).
    const q = queuePublicJoinRequest(joiner, pub);
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    expect(q.payload.humanityToken).toBe(''); // sealed empty

    // The owner-drain boundary rejects it: a token-less request never becomes a
    // queueable payload, so it can never reach the owner queue.
    const opened = openPublicJoinRequest(owner, q.envelope);
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.reason).toBe('invalid_payload');
  });

  it('a WRONG-recipient identity cannot open the request (sealed to the owner DH key)', () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const stranger = generateDeviceIdentity('Stranger');
    const grant = createPublicJoinGrant(owner, randomBytes);
    const pub = createPublication(owner, { ...baseOpts, joinPolicy: 'request', publicJoin: grant });
    const q = queuePublicJoinRequest(joiner, pub);
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    const opened = openPublicJoinRequest(stranger, q.envelope);
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    // Sealed to the owner's DH key: a stranger cannot derive the shared secret to decrypt.
    expect(opened.reason).toBe('decrypt_failed');
  });

  it('fail-closed (never throws) on a descriptor with no grant / no ownerDhPublicKey', () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    // No grant at all.
    const noGrant = createPublication(owner, { ...baseOpts, joinPolicy: 'request' });
    expect(queuePublicJoinRequest(joiner, noGrant)).toEqual({ ok: false, reason: 'grant_invalid' });

    // A tampered descriptor (verifyPublication !== 'ok') also fails closed, never throws.
    const withGrant = createPublication(owner, { ...baseOpts, joinPolicy: 'request', publicJoin: createPublicJoinGrant(owner, randomBytes) });
    const tampered = { ...withGrant, descriptor: { ...withGrant.descriptor, title: 'Hijacked' } };
    expect(queuePublicJoinRequest(joiner, tampered)).toEqual({ ok: false, reason: 'grant_invalid' });
  });

  it('token symmetry: joiner-derived === owner-derived from PUBLIC fields, and differs per field', () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const grant = createPublicJoinGrant(owner, randomBytes);
    const pub = createPublication(owner, { ...baseOpts, joinPolicy: 'request', publicJoin: grant });
    const q = queuePublicJoinRequest(joiner, pub);
    expect(q.ok).toBe(true);
    if (!q.ok) return;

    // The owner re-derives the SAME token from its own descriptor's public fields
    // (no shared secret, no epoch input).
    const ownerToken = derivePublicJoinToken(pub.descriptor.publicationId, grant.grantId, owner.publicKey);
    expect(q.token).toBe(ownerToken);
    expect(q.token).toMatch(/^[0-9a-f]{64}$/);

    // Any one of the three public fields changing changes the token.
    expect(derivePublicJoinToken('other-pub', grant.grantId, owner.publicKey)).not.toBe(q.token);
    expect(derivePublicJoinToken(pub.descriptor.publicationId, 'other-grant', owner.publicKey)).not.toBe(q.token);
    expect(derivePublicJoinToken(pub.descriptor.publicationId, grant.grantId, 'other-owner')).not.toBe(q.token);
  });
});
