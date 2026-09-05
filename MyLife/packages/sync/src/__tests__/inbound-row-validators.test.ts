/**
 * Plan 38 Phase 0 -- apply-time validators for owner-signed rows (Codex
 * amendment 3). A forged cm_community_identity row must be rejected AT APPLY
 * (never lands in the table), not merely hidden at read time.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { SyncSessionOptions } from '../protocol/sync-session';
import { applyReceivedDocumentChanges } from '../protocol/sync-session';
import { ChangeTracker } from '../crdt/change-tracker';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createCommunity, createCommunityInvite, joinCommunityFromLink } from '../protocol/community';
import {
  COMMUNITY_IDENTITY_TABLE,
  communityIdentityEventToRow,
  createCommunityIdentityEvent,
} from '../protocol/community-identity';
import {
  createChannelMessage,
  type ChannelMessageEvent,
} from '../protocol/channel-message';
import { getInboundAudit } from '../db/queries';
import type { PairedDevice, WorkspaceMemberRole } from '../types';

type Identity = ReturnType<typeof generateDeviceIdentity>;

const IDENTITY_DDL = `CREATE TABLE IF NOT EXISTS ${COMMUNITY_IDENTITY_TABLE} (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  description TEXT,
  accent_color TEXT,
  icon_image TEXT,
  banner_cid TEXT,
  banner_key_epoch INTEGER,
  banner_wrapped_key TEXT,
  banner_manifest_json TEXT,
  theme_blob TEXT,
  tombstone INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  signed_by TEXT NOT NULL,
  signature TEXT NOT NULL
)`;

describe('apply-time owner-signed row validation', () => {
  let db: InMemoryTestDatabase;
  let owner: Identity;
  let member: Identity;
  let local: Identity;
  let communityId: string;
  let options: SyncSessionOptions;

  beforeEach(() => {
    db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    db.adapter.execute(IDENTITY_DDL);

    owner = generateDeviceIdentity('Owner');
    member = generateDeviceIdentity('Member');
    local = generateDeviceIdentity('Local');
    const signed = createCommunity(owner, {
      name: 'Identity Club',
      channels: [{ id: 'general', name: 'General' }],
      members: [
        { deviceId: member.publicKey, role: 'member' },
        { deviceId: local.publicKey, role: 'member' },
      ],
    });
    communityId = signed.descriptor.communityId;
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-07-05T00:00:00.000Z'));
    expect(joinCommunityFromLink(db.adapter, local, link, new Date('2026-07-05T00:00:30.000Z')).ok).toBe(true);

    const POLICY: ModuleSyncPolicy = {
      defaultScope: 'device_local',
      shareable: true,
      entityRules: [{
        tableName: COMMUNITY_IDENTITY_TABLE,
        defaultScope: 'shared_workspace',
        maxScope: 'shared_workspace',
        conflictStrategy: 'lww',
      }],
    };
    const POLICIES = new Map([['community', POLICY]]);
    const changeTracker = new ChangeTracker({
      db: db.adapter,
      deviceId: local.publicKey,
      modulePrefixes: new Map([['community', 'cm_']]),
      modulePolicies: POLICIES,
    });
    options = {
      db: db.adapter,
      identity: { publicKey: local.publicKey },
      pairedDevices: [],
      changeTracker,
      enabledModules: ['community'],
      modulePolicies: POLICIES,
      transport: 'wan_relay',
      workspaceId: communityId,
      documentManager: undefined,
    } as unknown as SyncSessionOptions;
  });
  afterEach(() => { db.close(); });

  const changeFor = (row: Record<string, unknown>, operation = 'INSERT') => ({
    table: COMMUNITY_IDENTITY_TABLE,
    rowId: String(row.id ?? 'row-x'),
    operation,
    data: row,
  });

  const apply = (row: Record<string, unknown>, from: Identity, operation = 'INSERT') =>
    applyReceivedDocumentChanges(options, 'community', [changeFor(row, operation)], {
      remoteDeviceId: from.publicKey,
      sessionId: `s_${Math.random().toString(36).slice(2, 8)}`,
    });

  it('accepts a genuine owner-signed identity row, even relayed by a plain member', () => {
    const event = createCommunityIdentityEvent(owner, {
      communityId, revision: 1, description: 'Our shared space', accentColor: '#0e7c66',
      updatedAt: '2026-07-05T01:00:00.000Z',
    });
    const applied = apply(communityIdentityEventToRow(event), member);
    expect(applied).toBe(1);
    expect(db.adapter.query(`SELECT * FROM ${COMMUNITY_IDENTITY_TABLE}`)).toHaveLength(1);
  });

  it('rejects a member-forged identity row AT APPLY with an audit record', () => {
    const forged = createCommunityIdentityEvent(member, {
      communityId, revision: 5, description: 'defaced', updatedAt: '2026-07-05T01:00:00.000Z',
    });
    const applied = apply(communityIdentityEventToRow(forged), member);
    expect(applied).toBe(0);
    expect(db.adapter.query(`SELECT * FROM ${COMMUNITY_IDENTITY_TABLE}`)).toHaveLength(0);
    const audit = getInboundAudit(db.adapter, { outcome: 'rejected' });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.reason).toBe('identity_signature_invalid');
  });

  it('rejects an owner-signed row whose payload was tampered in flight', () => {
    const event = createCommunityIdentityEvent(owner, {
      communityId, revision: 1, description: 'original', updatedAt: '2026-07-05T01:00:00.000Z',
    });
    const row = { ...communityIdentityEventToRow(event), description: 'tampered' };
    expect(apply(row, member)).toBe(0);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' })[0]!.reason).toBe('identity_signature_invalid');
  });

  it('rejects a malformed identity row (missing signature)', () => {
    const event = createCommunityIdentityEvent(owner, {
      communityId, revision: 1, updatedAt: '2026-07-05T01:00:00.000Z',
    });
    const row = communityIdentityEventToRow(event);
    delete (row as Record<string, unknown>).signature;
    expect(apply(row, member)).toBe(0);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' })[0]!.reason).toBe('identity_row_malformed');
  });

  it('fails CLOSED for an identity row of a community this device does not hold', () => {
    const foreignOwner = generateDeviceIdentity('Foreign Owner');
    const event = createCommunityIdentityEvent(foreignOwner, {
      communityId: 'f00d'.repeat(8), revision: 1, description: 'mystery',
      updatedAt: '2026-07-05T01:00:00.000Z',
    });
    expect(apply(communityIdentityEventToRow(event), member)).toBe(0);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' })[0]!.reason).toBe('identity_community_unknown');
  });

  it('rejects raw DELETEs on the signed table (tombstoning is the signed path)', () => {
    const event = createCommunityIdentityEvent(owner, {
      communityId, revision: 1, description: 'keep me', updatedAt: '2026-07-05T01:00:00.000Z',
    });
    expect(apply(communityIdentityEventToRow(event), member)).toBe(1);
    const applied = applyReceivedDocumentChanges(options, 'community', [{
      table: COMMUNITY_IDENTITY_TABLE, rowId: event.id, operation: 'DELETE', data: null,
    }], { remoteDeviceId: member.publicKey, sessionId: 's_del' });
    expect(applied).toBe(0);
    expect(db.adapter.query(`SELECT * FROM ${COMMUNITY_IDENTITY_TABLE}`)).toHaveLength(1);
    const reasons = getInboundAudit(db.adapter, { outcome: 'rejected' }).map((a) => a.reason);
    expect(reasons).toContain('signed_row_delete_rejected');
  });

  it('accepts an owner-signed TOMBSTONE event row (the sanctioned delete)', () => {
    const event = createCommunityIdentityEvent(owner, {
      communityId, revision: 2, tombstone: true, updatedAt: '2026-07-05T02:00:00.000Z',
    });
    expect(apply(communityIdentityEventToRow(event), member)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Item 8 / AM3: cm_messages channel-post gate on a DEVICE-SCOPED session.
// A Meerkat community session carries every community's rows with
// options.workspaceId UNSET, so the old workspace-scoped channel gate is
// skipped. The signed-row validator must still enforce the channel's posting
// rules against the row's OWN signed author (never the transport peer).
// ---------------------------------------------------------------------------

const CM_MESSAGES_DDL = `CREATE TABLE IF NOT EXISTS cm_messages (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_device_id TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  hlc_wall TEXT NOT NULL,
  hlc_counter INTEGER NOT NULL,
  supersedes_id TEXT,
  supersedes_deleted INTEGER,
  signature TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  post_id TEXT,
  parent_id TEXT,
  branch_id TEXT,
  author_kind TEXT,
  mentions_json TEXT NOT NULL DEFAULT '[]',
  intent TEXT
)`;

function cmRow(e: ChannelMessageEvent): Record<string, unknown> {
  return {
    id: e.id,
    community_id: e.communityId,
    channel_id: e.channelId,
    author_device_id: e.authorDeviceId,
    body: e.body,
    attachments_json: JSON.stringify(e.attachments ?? []),
    hlc_wall: e.hlc.wall,
    hlc_counter: e.hlc.counter,
    supersedes_id: e.supersedes?.id ?? null,
    supersedes_deleted: e.supersedes ? (e.supersedes.deleted ? 1 : 0) : null,
    signature: e.signature,
    updated_at: e.hlc.wall,
    version: e.version,
    post_id: e.postId ?? null,
    parent_id: e.parentId ?? null,
    branch_id: e.branchId ?? null,
    author_kind: e.authorKind ?? null,
    mentions_json: JSON.stringify(e.mentions ?? []),
    intent: e.intent ?? null,
  };
}

describe('cm_messages channel gate on a device-scoped session (Item 8 / AM3)', () => {
  let db: InMemoryTestDatabase;
  let owner: Identity;
  let member: Identity;
  let local: Identity;
  let communityId: string;
  let options: SyncSessionOptions;

  beforeEach(() => {
    db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    db.adapter.execute(CM_MESSAGES_DDL);

    owner = generateDeviceIdentity('Owner');
    member = generateDeviceIdentity('Member');
    local = generateDeviceIdentity('Local');
    const signed = createCommunity(owner, {
      name: 'Chat Club',
      channels: [
        { id: 'general', name: 'General' },
        { id: 'announce', name: 'Announcements', postRoles: ['owner', 'admin'] as WorkspaceMemberRole[] },
      ],
      members: [
        { deviceId: member.publicKey, role: 'member' },
        { deviceId: local.publicKey, role: 'member' },
      ],
    });
    communityId = signed.descriptor.communityId;
    const { link } = createCommunityInvite(owner, signed, 60_000, new Date('2026-07-05T00:00:00.000Z'));
    expect(joinCommunityFromLink(db.adapter, local, link, new Date('2026-07-05T00:00:30.000Z')).ok).toBe(true);

    const POLICY: ModuleSyncPolicy = {
      defaultScope: 'device_local',
      shareable: true,
      entityRules: [{
        tableName: 'cm_messages',
        defaultScope: 'shared_workspace',
        maxScope: 'shared_workspace',
        conflictStrategy: 'or_set',
      }],
    };
    const POLICIES = new Map([['community', POLICY]]);
    const changeTracker = new ChangeTracker({
      db: db.adapter,
      deviceId: local.publicKey,
      modulePrefixes: new Map([['community', 'cm_']]),
      modulePolicies: POLICIES,
    });
    // Device-scoped: NO workspaceId. The transport peer (member) is a paired
    // device, so the session authorizes, but the peer is NOT necessarily the
    // author of every row it carries.
    const pairedDevices: PairedDevice[] = [{
      deviceId: member.publicKey,
      displayName: 'peer',
      dhPublicKey: member.dhPublicKey,
      sharedSecretRef: 'local:shared:test',
      isActive: true,
    } as unknown as PairedDevice];
    options = {
      db: db.adapter,
      identity: { publicKey: local.publicKey },
      pairedDevices,
      changeTracker,
      enabledModules: ['community'],
      modulePolicies: POLICIES,
      transport: 'wan_relay',
      workspaceId: undefined,
      documentManager: undefined,
    } as unknown as SyncSessionOptions;
  });
  afterEach(() => { db.close(); });

  const applyRow = (row: Record<string, unknown>, from: Identity, operation = 'INSERT') =>
    applyReceivedDocumentChanges(options, 'community', [{
      table: 'cm_messages', rowId: String(row.id ?? 'row-x'), operation, data: row,
    }], { remoteDeviceId: from.publicKey, sessionId: `s_${Math.random().toString(36).slice(2, 8)}` });

  it('rejects a restricted-channel post at apply on a device-scoped session', () => {
    // member (role 'member') is NOT allowed to post to the owner/admin-only channel.
    const event = createChannelMessage(member, {
      communityId, channelId: 'announce', body: 'members cannot post here',
      hlc: { wall: '2026-07-05T01:00:00.000Z', counter: 0 },
    });
    expect(applyRow(cmRow(event), member)).toBe(0);
    expect(db.adapter.query('SELECT * FROM cm_messages')).toHaveLength(0);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' })[0]!.reason).toBe('channel_role_denied');
  });

  it('accepts a legit member post to an open channel on a device-scoped session', () => {
    const event = createChannelMessage(member, {
      communityId, channelId: 'general', body: 'hello',
      hlc: { wall: '2026-07-05T01:00:00.000Z', counter: 0 },
    });
    expect(applyRow(cmRow(event), member)).toBe(1);
    expect(db.adapter.query('SELECT * FROM cm_messages')).toHaveLength(1);
  });

  it('rejects a forged author (signed author does not match the tampered row)', () => {
    // member signs, then claims the OWNER authored it to sneak into the
    // restricted channel. The gate runs against the signed author, not the
    // transport peer, and the tamper breaks the id/signature.
    const event = createChannelMessage(member, {
      communityId, channelId: 'announce', body: 'pretending to be the owner',
      hlc: { wall: '2026-07-05T01:00:00.000Z', counter: 0 },
    });
    const forged = { ...cmRow(event), author_device_id: owner.publicKey };
    expect(applyRow(forged, member)).toBe(0);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' })[0]!.reason)
      .toBe('channel_message_signature_invalid');
  });

  it('fails CLOSED for a cm_messages row of a community this device does not hold', () => {
    const foreignOwner = generateDeviceIdentity('Foreign');
    const event = createChannelMessage(foreignOwner, {
      communityId: 'f00d'.repeat(8), channelId: 'general', body: 'mystery',
      hlc: { wall: '2026-07-05T01:00:00.000Z', counter: 0 },
    });
    expect(applyRow(cmRow(event), member)).toBe(0);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' })[0]!.reason)
      .toBe('channel_message_community_unknown');
  });

  it('rejects a v1 message row that smuggles unsigned v2 columns (post_id injection)', () => {
    // A genuine v1 message, then a post_id injected into the ROW. The v1
    // signature does not cover post_id, so accepting it would poison the
    // post-threading index with a message that never signed into that post.
    const event = createChannelMessage(member, {
      communityId, channelId: 'general', body: 'legit v1',
      hlc: { wall: '2026-07-05T01:00:00.000Z', counter: 0 },
    });
    const smuggled = { ...cmRow(event), version: 1, post_id: 'attacker-post' };
    expect(applyRow(smuggled, member)).toBe(0);
    expect(db.adapter.query('SELECT * FROM cm_messages')).toHaveLength(0);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' })[0]!.reason)
      .toBe('channel_message_malformed');
  });

  it('rejects a raw DELETE on cm_messages (deletes are signed supersede events)', () => {
    const applied = applyReceivedDocumentChanges(options, 'community', [{
      table: 'cm_messages', rowId: 'any', operation: 'DELETE', data: null,
    }], { remoteDeviceId: member.publicKey, sessionId: 's_del' });
    expect(applied).toBe(0);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' }).map((a) => a.reason))
      .toContain('signed_row_delete_rejected');
  });
});
