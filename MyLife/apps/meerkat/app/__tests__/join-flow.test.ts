/**
 * The one join pipeline (Plan 31 Phase 1, T1.1). previewInvite is pure and never
 * mutates state (TC-1); executeJoin wraps the onJoin semantics and reports the
 * honest approval-queue notice for every queue outcome. Real invite links are
 * built with the sync package; the verdict logic itself is proven in the sync
 * suite, so here we prove the app-layer mapping + orchestration.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  bytesToHex,
  communityDescriptorHash,
  createCommunity,
  createCommunityInvite,
  createSyncTables,
  extractSigningPrivateKeyHex,
  generateDeviceIdentity,
  getCommunity,
  joinCommunityFromLink,
  parseCommunityInviteLink,
  signMessage,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  executeJoin,
  formatInviteExpiry,
  inviterRoleLine,
  joinReasonText,
  previewInvite,
  type JoinFailureReason,
} from '../(root)/data/join-flow';

const INVITE_PREFIX = 'meerkat://community/join#';

function makeCommunityInvite(ttlMs?: number) {
  const owner = generateDeviceIdentity('Owner');
  const signed = createCommunity(owner, {
    name: 'Weekend Hikers',
    channels: [
      { id: 'general', name: 'general' },
      { id: 'trips', name: 'trips' },
    ],
  });
  const { link } = ttlMs === undefined
    ? createCommunityInvite(owner, signed)
    : createCommunityInvite(owner, signed, ttlMs);
  return { owner, signed, link };
}

/** Re-encode a parsed link after tampering (standard base64, sync-compatible). */
function encodeLink(parsed: unknown): string {
  return INVITE_PREFIX + Buffer.from(JSON.stringify(parsed), 'utf8').toString('base64');
}

/**
 * Hand-build an invite validly signed by a device that is NOT in the descriptor,
 * so verifyCommunityInvite reaches the role check with communityRole === null and
 * returns not_authorized. createCommunityInvite refuses a non-admin signer, so a
 * REAL not_authorized fixture must sign the canonical invite directly.
 */
function makeUnauthorizedInviteLink(): string {
  const owner = generateDeviceIdentity('Owner');
  const signed = createCommunity(owner, {
    name: 'Weekend Hikers',
    channels: [{ id: 'general', name: 'general' }],
  });
  const stranger = generateDeviceIdentity('Stranger'); // not a member of the descriptor
  const invite = {
    version: 1 as const,
    communityId: signed.descriptor.communityId,
    descriptorHash: communityDescriptorHash(signed),
    invitedByDeviceId: stranger.publicKey,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    nonce: 'a'.repeat(24),
  };
  const canonical = new TextEncoder().encode(JSON.stringify([
    'meerkat-community-invite-v1',
    invite.version,
    invite.communityId,
    invite.descriptorHash,
    invite.invitedByDeviceId,
    invite.expiresAt,
    invite.nonce,
  ]));
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(stranger.privateKeyRef), canonical));
  return encodeLink({ invite: { invite, signature }, descriptor: signed });
}

let testDb: InMemoryTestDatabase | null = null;
let db: InMemoryTestDatabase['adapter'];

beforeEach(() => {
  testDb = createInMemoryTestDatabase();
  db = testDb.adapter;
  createSyncTables(db);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe('joinReasonText covers every reason code', () => {
  const cases: Array<[JoinFailureReason, string]> = [
    ['malformed_link', 'That does not look like a Meerkat community invite link.'],
    ['expired', 'That invite link has expired. Ask for a fresh one.'],
    ['invalid', 'That invite failed verification. Do not trust it.'],
    ['not_authorized', 'That invite was not created by a community owner or admin.'],
  ];
  it.each(cases)('%s maps to its verbatim text', (reason, text) => {
    expect(joinReasonText(reason)).toBe(text);
  });
  it('killed maps to the honest blocked-community copy (twin of the web reason)', () => {
    expect(joinReasonText('killed')).toBe('That community has been blocked and refuses new joins.');
  });
});

describe('previewInvite (pure, never joins)', () => {
  it('returns the display model for a valid invite and stores nothing', () => {
    const { link } = makeCommunityInvite();
    const preview = previewInvite(link);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error('expected ok');
    expect(preview.name).toBe('Weekend Hikers');
    expect(preview.memberCount).toBe(1);
    expect(preview.channelCount).toBe(2);
    expect(preview.inviterRole).toBe('owner');
    expect(new Date(preview.expiresAt).getTime()).toBeGreaterThan(Date.now());
    // TC-1: preview did not write the community.
    const parsed = parseCommunityInviteLink(link);
    expect(getCommunity(db, parsed!.descriptor.descriptor.communityId)).toBeNull();
  });

  it('rejects a malformed link', () => {
    const preview = previewInvite('not a meerkat link');
    expect(preview).toMatchObject({
      ok: false,
      reason: 'malformed_link',
      message: 'That does not look like a Meerkat community invite link.',
    });
  });

  it('rejects an expired invite', () => {
    const { link } = makeCommunityInvite(-1000);
    expect(previewInvite(link)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('rejects an invite whose signature was tampered', () => {
    const { link } = makeCommunityInvite();
    const parsed = parseCommunityInviteLink(link)!;
    parsed.invite.signature = '00'.repeat(64);
    expect(previewInvite(encodeLink(parsed))).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('rejects a real not_authorized invite (validly signed by a non-member)', () => {
    expect(previewInvite(makeUnauthorizedInviteLink())).toMatchObject({ ok: false, reason: 'not_authorized' });
  });

  it('rejects an oversized link before parsing (DoS guard)', () => {
    const huge = INVITE_PREFIX + 'A'.repeat(300 * 1024);
    expect(previewInvite(huge)).toMatchObject({ ok: false, reason: 'malformed_link' });
  });
});

describe('formatInviteExpiry + inviterRoleLine', () => {
  const base = new Date('2026-07-03T00:00:00.000Z');
  it('formats days, hours, sub-hour, and expired', () => {
    expect(formatInviteExpiry('2026-07-05T00:00:00.000Z', base)).toBe('Expires in 2 days');
    expect(formatInviteExpiry('2026-07-03T05:00:00.000Z', base)).toBe('Expires in 5 hours');
    expect(formatInviteExpiry('2026-07-03T00:30:00.000Z', base)).toBe('Expires in under an hour');
    expect(formatInviteExpiry('2026-07-02T00:00:00.000Z', base)).toBe('Expired');
  });
  it('attributes the inviter role', () => {
    expect(inviterRoleLine('owner')).toBe('Invited by an owner');
    expect(inviterRoleLine('admin')).toBe('Invited by an admin');
    expect(inviterRoleLine(null)).toBe('Invited by a member');
  });
});

describe('executeJoin approval-queue notice matrix', () => {
  let joiner: DeviceIdentity;
  let link: string;

  beforeEach(() => {
    ({ link } = makeCommunityInvite());
    joiner = generateDeviceIdentity('Joiner');
  });

  it('requested: parks a request and drains, honest pending notice', async () => {
    let drained = false;
    const result = await executeJoin({
      link,
      joinFromLink: (l) => joinCommunityFromLink(db, joiner, l),
      queueJoinRequest: async () => ({ ok: true, communityId: 'x', ownerDeviceId: 'o' }),
      runPostJoinDrain: async () => { drained = true; return {} as never; },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.approval).toBe('requested');
    expect(result.notice).toBe('Added "Weekend Hikers" locally. Approval request queued. Full history becomes available after the owner approves and access arrives.');
    expect(result.firstChannelId).toBe('general');
    expect(drained).toBe(true);
  });

  it('requested: a drain rejection does NOT mask the successful join (M2)', async () => {
    const result = await executeJoin({
      link,
      joinFromLink: (l) => joinCommunityFromLink(db, joiner, l),
      queueJoinRequest: async () => ({ ok: true, communityId: 'x', ownerDeviceId: 'o' }),
      runPostJoinDrain: async () => { throw new Error('drain failed'); },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.approval).toBe('requested');
    expect(result.notice).toBe('Added "Weekend Hikers" locally. Approval request queued. Full history becomes available after the owner approves and access arrives.');
  });

  it('no_owner_dh: honest permanent-failure copy, no "will retry" claim', async () => {
    const result = await executeJoin({
      link,
      joinFromLink: (l) => joinCommunityFromLink(db, joiner, l),
      queueJoinRequest: async () => ({ ok: false, reason: 'no_owner_dh' }),
      runPostJoinDrain: async () => { throw new Error('must not drain'); },
    });
    expect(result.ok && result.approval).toBe('no_owner_dh');
    expect(result.ok && result.notice).toContain('ask the owner for a new invite');
    expect(result.ok && result.notice).not.toMatch(/will retry/);
  });

  it('already_member: no drain, plain joined notice', async () => {
    const result = await executeJoin({
      link,
      joinFromLink: (l) => joinCommunityFromLink(db, joiner, l),
      queueJoinRequest: async () => ({ ok: false, reason: 'already_member' }),
      runPostJoinDrain: async () => { throw new Error('must not drain'); },
    });
    expect(result.ok && result.approval).toBe('already_member');
    expect(result.ok && result.notice).toBe('Joined "Weekend Hikers".');
  });

  it('needs_local: honest in-person approval copy, no drain', async () => {
    const result = await executeJoin({
      link,
      joinFromLink: (l) => joinCommunityFromLink(db, joiner, l),
      queueJoinRequest: async () => ({ ok: false, reason: 'needs_local' }),
      runPostJoinDrain: async () => { throw new Error('must not drain'); },
    });
    expect(result.ok && result.approval).toBe('needs_local');
    expect(result.ok && result.notice).toContain('while you are together on the same Wi-Fi or nearby');
    expect(result.ok && result.notice).not.toContain('connection server');
  });

  it('no_relay: points the user at Settings', async () => {
    const result = await executeJoin({
      link,
      joinFromLink: (l) => joinCommunityFromLink(db, joiner, l),
      queueJoinRequest: async () => ({ ok: false, reason: 'no_relay' }),
      runPostJoinDrain: async () => { throw new Error('must not drain'); },
    });
    expect(result.ok && result.approval).toBe('no_relay');
    expect(result.ok && result.notice).toContain('set a connection server');
  });

  it('park_failed: honest retry notice', async () => {
    const result = await executeJoin({
      link,
      joinFromLink: (l) => joinCommunityFromLink(db, joiner, l),
      queueJoinRequest: async () => ({ ok: false, reason: 'park_failed' }),
      runPostJoinDrain: async () => { throw new Error('must not drain'); },
    });
    expect(result.ok && result.approval).toBe('park_failed');
    expect(result.ok && result.notice).toContain('it will retry when you open the app');
  });

  it('surfaces a join failure reason (malformed) without joining', async () => {
    const result = await executeJoin({
      link: 'garbage',
      joinFromLink: (l) => joinCommunityFromLink(db, joiner, l),
      queueJoinRequest: async () => { throw new Error('must not queue'); },
      runPostJoinDrain: async () => { throw new Error('must not drain'); },
    });
    expect(result).toMatchObject({ ok: false, reason: 'malformed_link' });
  });
});
