/**
 * M5 communities -- MK-030 (descriptor lifecycle, invites, exit rights) and
 * MK-043 (channels + roles enforced AT APPLY, not just UI).
 *
 * MK-030 AC: community created, joined via link, descriptor verifies, host
 * change re-signs; a forked/moved community keeps member access.
 * MK-043 AC: 2-channel community with admin/member roles; a non-role member's
 * post to a restricted channel is rejected at apply; no server-side room state.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { SyncSessionOptions } from '../protocol/sync-session';
import { applyReceivedDocumentChanges } from '../protocol/sync-session';
import { ChangeTracker } from '../crdt/change-tracker';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  communityDescriptorHash,
  communityRole,
  createCommunity,
  createCommunityInvite,
  evaluateChannelPost,
  forkCommunity,
  getCommunity,
  joinCommunityFromLink,
  listCommunities,
  parseCommunityInviteLink,
  reviseCommunity,
  upsertCommunity,
  verifyCommunityDescriptor,
  verifyCommunityInvite,
  type CommunityChannel,
} from '../protocol/community';
import { getInboundAudit, getWorkspaceMembers } from '../db/queries';

type Identity = ReturnType<typeof generateDeviceIdentity>;

const CHANNELS: CommunityChannel[] = [
  { id: 'general', name: 'General' }, // any member may post
  { id: 'announcements', name: 'Announcements', postRoles: ['owner', 'admin'] },
];

function founded(owner: Identity, extra: Parameters<typeof createCommunity>[1] = { name: 'Surf Club' }) {
  return createCommunity(owner, { channels: CHANNELS, ...extra });
}

describe('community descriptor lifecycle (MK-030)', () => {
  it('creates a genesis that verifies, with the founder as owner-member', () => {
    const owner = generateDeviceIdentity('Founder');
    const signed = founded(owner);
    expect(verifyCommunityDescriptor(signed)).toBe(true);
    expect(signed.descriptor.revision).toBe(1);
    expect(signed.descriptor.communityId).toHaveLength(32);
    expect(communityRole(signed.descriptor, owner.publicKey)).toBe('owner');
    expect(signed.descriptor.joinPolicy).toBe('invite_only'); // no public directory
  });

  it('rejects a tampered genesis (name swap breaks both id and signature)', () => {
    const owner = generateDeviceIdentity('Founder');
    const signed = founded(owner);
    const tampered = { ...signed, descriptor: { ...signed.descriptor, name: 'Hijacked' } };
    expect(verifyCommunityDescriptor(tampered)).toBe(false);
  });

  it('host change re-signs as a chained revision (the AC)', () => {
    const owner = generateDeviceIdentity('Founder');
    const v1 = founded(owner, { name: 'Surf Club', hosts: ['ws://old-host:8787'] });
    const v2 = reviseCommunity(owner, v1, { hosts: ['ws://new-host:8787'] });

    expect(v2.descriptor.revision).toBe(2);
    expect(v2.descriptor.hosts).toEqual(['ws://new-host:8787']);
    expect(v2.descriptor.communityId).toBe(v1.descriptor.communityId); // stable id
    expect(v2.descriptor.previousHash).toBe(communityDescriptorHash(v1));
    expect(verifyCommunityDescriptor(v2, v1)).toBe(true);
  });

  it('a non-owner cannot sign a revision', () => {
    const owner = generateDeviceIdentity('Founder');
    const rando = generateDeviceIdentity('Rando');
    const v1 = founded(owner);
    expect(() => reviseCommunity(rando, v1, { name: 'Coup' })).toThrow();
  });

  it('rejects a revision whose chain does not match', () => {
    const owner = generateDeviceIdentity('Founder');
    const v1 = founded(owner);
    const v2 = reviseCommunity(owner, v1, { name: 'Renamed' });
    const v1b = founded(owner, { name: 'Other Community' });
    expect(verifyCommunityDescriptor(v2, v1)).toBe(true);
    expect(verifyCommunityDescriptor(v2, v1b)).toBe(false); // wrong predecessor
  });

  it('fork keeps the catalog and member access under a new id (exit rights AC)', () => {
    const owner = generateDeviceIdentity('Founder');
    const member = generateDeviceIdentity('Member');
    const v1 = createCommunity(owner, {
      name: 'Surf Club',
      catalogCid: 'cid-of-catalog',
      channels: CHANNELS,
      members: [{ deviceId: member.publicKey, role: 'member' }],
    });

    // The host/owner has gone hostile or vanished: a member forks.
    const fork = forkCommunity(member, v1);

    expect(verifyCommunityDescriptor(fork)).toBe(true); // a valid new genesis
    expect(fork.descriptor.communityId).not.toBe(v1.descriptor.communityId);
    expect(fork.descriptor.forkedFrom).toEqual({
      communityId: v1.descriptor.communityId,
      descriptorHash: communityDescriptorHash(v1),
    });
    // Access preserved: the content-addressed catalog and the member list survive.
    expect(fork.descriptor.catalogCid).toBe('cid-of-catalog');
    expect(communityRole(fork.descriptor, owner.publicKey)).toBe('admin'); // old owner demoted, still in
    expect(communityRole(fork.descriptor, member.publicKey)).toBe('owner');
    expect(fork.descriptor.channels).toEqual(CHANNELS);
  });
});

describe('community invites (MK-030)', () => {
  it('round-trips an invite link and verifies it', () => {
    const owner = generateDeviceIdentity('Founder');
    const signed = founded(owner);
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-06-11T00:00:00.000Z'));

    const parsed = parseCommunityInviteLink(link)!;
    expect(parsed).not.toBeNull();
    expect(verifyCommunityInvite(parsed, new Date('2026-06-11T00:00:30.000Z'))).toBe('ok');
  });

  it('expires: a stale link is rejected', () => {
    const owner = generateDeviceIdentity('Founder');
    const signed = founded(owner);
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-06-11T00:00:00.000Z'));
    const parsed = parseCommunityInviteLink(link)!;
    expect(verifyCommunityInvite(parsed, new Date('2026-06-11T00:01:01.000Z'))).toBe('expired');
  });

  it('only an owner/admin can mint invites; a forged inviter fails verification', () => {
    const owner = generateDeviceIdentity('Founder');
    const member = generateDeviceIdentity('Member');
    const signed = createCommunity(owner, {
      name: 'Club', channels: CHANNELS,
      members: [{ deviceId: member.publicKey, role: 'member' }],
    });
    expect(() => createCommunityInvite(member, signed)).toThrow();

    // A member who self-signs an invite anyway is caught at verify time.
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-06-11T00:00:00.000Z'));
    const parsed = parseCommunityInviteLink(link)!;
    parsed.invite.invite.invitedByDeviceId = member.publicKey; // claim a different inviter
    expect(verifyCommunityInvite(parsed, new Date('2026-06-11T00:00:30.000Z'))).toBe('invalid');
  });

  it('rejects an invite bound to a different descriptor revision', () => {
    const owner = generateDeviceIdentity('Founder');
    const v1 = founded(owner);
    const { link } = createCommunityInvite(owner, v1, 60_000, new Date('2026-06-11T00:00:00.000Z'));
    const parsed = parseCommunityInviteLink(link)!;
    // Swap in a revised descriptor: the binding hash no longer matches.
    parsed.descriptor = reviseCommunity(owner, v1, { name: 'Renamed' });
    expect(verifyCommunityInvite(parsed, new Date('2026-06-11T00:00:30.000Z'))).toBe('invalid');
  });
});

describe('join + storage (MK-030)', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => { db = createInMemoryTestDatabase(); createSyncTables(db.adapter); });
  afterEach(() => { db.close(); });

  it('joins via link: community stored, workspace bridged, members mirrored (the AC)', () => {
    const owner = generateDeviceIdentity('Founder');
    const joiner = generateDeviceIdentity('Joiner');
    const signed = createCommunity(owner, {
      name: 'Surf Club', channels: CHANNELS,
      members: [{ deviceId: joiner.publicKey, role: 'member' }],
    });
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-06-11T00:00:00.000Z'));

    const result = joinCommunityFromLink(db.adapter, joiner, link, new Date('2026-06-11T00:00:30.000Z'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.community.descriptor.name).toBe('Surf Club');
    expect(result.community.myRole).toBe('member');
    expect(listCommunities(db.adapter)).toHaveLength(1);

    // The workspace bridge: sessions/authorization ride existing machinery.
    const ws = db.adapter.query<{ workspace_type: string }>(
      'SELECT workspace_type FROM sync_workspaces WHERE id = ?', [signed.descriptor.communityId]);
    expect(ws[0]!.workspace_type).toBe('community');
    const memberIds = getWorkspaceMembers(db.adapter, signed.descriptor.communityId).map((m) => m.deviceId).sort();
    expect(memberIds).toEqual([owner.publicKey, joiner.publicKey].sort());
  });

  it('rejects an expired link at join time', () => {
    const owner = generateDeviceIdentity('Founder');
    const joiner = generateDeviceIdentity('Joiner');
    const signed = founded(owner);
    const { link } = createCommunityInvite(owner, signed, 1_000, new Date('2026-06-11T00:00:00.000Z'));
    expect(joinCommunityFromLink(db.adapter, joiner, link, new Date('2026-06-11T01:00:00.000Z')))
      .toEqual({ ok: false, reason: 'expired' });
    expect(listCommunities(db.adapter)).toHaveLength(0);
  });

  it('an older descriptor revision never overwrites a newer stored one', () => {
    const owner = generateDeviceIdentity('Founder');
    const v1 = founded(owner);
    const v2 = reviseCommunity(owner, v1, { name: 'Renamed' });
    upsertCommunity(db.adapter, v2, owner.publicKey);
    upsertCommunity(db.adapter, v1, owner.publicKey); // stale replay
    expect(getCommunity(db.adapter, v1.descriptor.communityId)!.descriptor.name).toBe('Renamed');
  });
});

describe('channels + roles (MK-043)', () => {
  it('pure verdict matrix: restricted channel admits only granted roles', () => {
    const owner = generateDeviceIdentity('Founder');
    const member = generateDeviceIdentity('Member');
    const outsider = generateDeviceIdentity('Outsider');
    const signed = createCommunity(owner, {
      name: 'Club', channels: CHANNELS,
      members: [{ deviceId: member.publicKey, role: 'member' }],
    });
    const d = signed.descriptor;

    expect(evaluateChannelPost(d, member.publicKey, 'general')).toEqual({ allowed: true });
    expect(evaluateChannelPost(d, owner.publicKey, 'announcements')).toEqual({ allowed: true });
    expect(evaluateChannelPost(d, member.publicKey, 'announcements'))
      .toEqual({ allowed: false, reason: 'channel_role_denied' });
    expect(evaluateChannelPost(d, outsider.publicKey, 'general'))
      .toEqual({ allowed: false, reason: 'not_community_member' });
    expect(evaluateChannelPost(d, member.publicKey, 'nope'))
      .toEqual({ allowed: false, reason: 'unknown_channel' });
  });

  it('ENGINE: a non-role member post to a restricted channel is rejected at apply + audited (the AC)', () => {
    const db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    db.adapter.execute('CREATE TABLE cm_posts (id TEXT PRIMARY KEY, channel_id TEXT, body TEXT, updated_at TEXT)');

    const owner = generateDeviceIdentity('Founder');
    const member = generateDeviceIdentity('Member');
    const joiner = generateDeviceIdentity('Local Device');
    const signed = createCommunity(owner, {
      name: 'Club', channels: CHANNELS,
      members: [
        { deviceId: member.publicKey, role: 'member' },
        { deviceId: joiner.publicKey, role: 'member' },
      ],
    });
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-06-11T00:00:00.000Z'));
    expect(joinCommunityFromLink(db.adapter, joiner, link, new Date('2026-06-11T00:00:30.000Z')).ok).toBe(true);

    const POLICY: ModuleSyncPolicy = {
      defaultScope: 'shared_workspace', shareable: true,
      entityRules: [{ tableName: 'cm_posts', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' }],
    };
    const POLICIES = new Map([['community', POLICY]]);
    const changeTracker = new ChangeTracker({
      db: db.adapter, deviceId: joiner.publicKey,
      modulePrefixes: new Map([['community', 'cm_']]), modulePolicies: POLICIES,
    });
    const options = {
      db: db.adapter, identity: { publicKey: joiner.publicKey }, pairedDevices: [],
      changeTracker, enabledModules: ['community'], modulePolicies: POLICIES,
      transport: 'wan_relay', workspaceId: signed.descriptor.communityId,
      documentManager: undefined,
    } as unknown as SyncSessionOptions;

    const post = (rowId: string, channelId: string) => ({
      table: 'cm_posts', rowId, operation: 'INSERT',
      data: { id: rowId, channel_id: channelId, body: 'hi', updated_at: '2026-06-11T01:00:00.000Z' },
    });

    // The plain member CAN post to #general...
    const ok = applyReceivedDocumentChanges(options, 'community',
      [post('p1', 'general')], { remoteDeviceId: member.publicKey, sessionId: 's1' });
    expect(ok).toBe(1);
    expect(db.adapter.query('SELECT * FROM cm_posts WHERE id = ?', ['p1'])).toHaveLength(1);

    // ...but their #announcements post is rejected AT APPLY and audited.
    const denied = applyReceivedDocumentChanges(options, 'community',
      [post('p2', 'announcements')], { remoteDeviceId: member.publicKey, sessionId: 's2' });
    expect(denied).toBe(0);
    expect(db.adapter.query('SELECT * FROM cm_posts WHERE id = ?', ['p2'])).toHaveLength(0);
    const audit = getInboundAudit(db.adapter, { outcome: 'rejected' });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.reason).toBe('channel_role_denied');

    // The owner CAN post to #announcements (role granted in the descriptor).
    const allowed = applyReceivedDocumentChanges(options, 'community',
      [post('p3', 'announcements')], { remoteDeviceId: owner.publicKey, sessionId: 's3' });
    expect(allowed).toBe(1);
    db.close();
  });
});
