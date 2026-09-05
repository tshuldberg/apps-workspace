import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  ChangeTracker,
  createChannelMessage,
  createChannelMessageV2,
  createCommunity,
  createCommunityAudienceRule,
  createCommunityProfileEvent,
  createSyncTables,
  createReplyAudienceRule,
  evaluateInboundChange,
  generateDeviceIdentity,
  getEntityKey,
  getOrCreateEntityKey,
  verifyChannelMessage,
  verifyCommunityProfileEvent,
} from '@mylife/sync';
import {
  CM_MESSAGE_ATTACHMENTS_TABLE,
  CM_MESSAGES_TABLE,
  CM_PROFILES_TABLE,
  CM_PUBLIC_JOIN_REQUESTS_TABLE,
  CM_READ_STATE_TABLE,
  COMMUNITY_DDL,
  COMMUNITY_MODULE_ID,
  COMMUNITY_PREFIX,
  COMMUNITY_SYNC_POLICY,
  type ChannelMessageRow,
  buildCommunityPeerNameMap,
  channelPostHeaderRowFromRootEvent,
  countUnreadChannelMessages,
  channelMessageEventFromRow,
  channelMessageRowFromEvent,
  communityProfileEventFromRow,
  communityProfileRowFromEvent,
  type CommunityProfileRow,
  createChannelPostEvent,
  createChannelPostReplyEvent,
  destroyChannelMessageKeys,
  ensureCommunityTables,
  getChannelReadState,
  getCommunityProfile,
  highestHlc,
  isEventAfterReadBoundary,
  readBoundaryFromReadState,
  insertMessageAttachmentRows,
  insertMessageRow,
  insertCommunityProfileRow,
  listCommunityChannelUnreadCounts,
  listChannelPostCards,
  listChannelPostThread,
  listMessageAttachmentRows,
  listChannelMessageThreadIds,
  listChannelMessageEvents,
  listChannelMessages,
  markChannelRead,
  mergeChannelMessageEvents,
  resolveCommunityAvatarImage,
  resolveCommunityAvatarInitial,
  resolveCommunityDisplayName,
  storeOwnedCommunity,
} from '../(root)/data/community-core';
import {
  INITIAL_CHAT_STATE,
  chatReducer,
  selectFailedMessages,
  selectPendingMessages,
} from '../(root)/data/chat-state';

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
});

afterEach(() => {
  db.close();
});

describe('community-core schema and policy (MK-051)', () => {
  it('creates the cm_ tables idempotently', () => {
    ensureCommunityTables(db.adapter);
    ensureCommunityTables(db.adapter);

    const tables = db.adapter
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).toContain('cm_messages');
    expect(tables).toContain('cm_message_attachments');
    expect(tables).toContain('cm_reactions');
    expect(tables).toContain('cm_profiles');
    expect(tables).toContain('cm_read_state');
    expect(COMMUNITY_DDL.length).toBeGreaterThanOrEqual(7);
  });

  it('declares shared message scope and personal read-state scope', () => {
    expect(COMMUNITY_MODULE_ID).toBe('community');
    expect(COMMUNITY_PREFIX).toBe('cm_');
    // Wave-1 audit fix: the module default is device_local so a cm_ table OMITTED from
    // entityRules fails CLOSED instead of leaking at shared_workspace. Tables that must
    // sync carry explicit shared_workspace rules (asserted below).
    expect(COMMUNITY_SYNC_POLICY.defaultScope).toBe('device_local');
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: CM_MESSAGES_TABLE,
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    });
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: CM_MESSAGE_ATTACHMENTS_TABLE,
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    });
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: CM_PROFILES_TABLE,
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    });
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: 'cm_read_state',
      defaultScope: 'personal_replica',
      maxScope: 'personal_replica',
      conflictStrategy: 'lww',
    });
    // Plan 19 P0 (TC-1 / NC-1) permanent guard against the REAL shipped policy:
    // cm_publications is the ONLY community-family entity allowed to reach
    // published_blob, and cm_messages must stay capped at shared_workspace.
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: 'cm_publications',
      defaultScope: 'shared_workspace',
      maxScope: 'published_blob',
      conflictStrategy: 'lww',
    });
    const messagesRule = COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === CM_MESSAGES_TABLE);
    expect(messagesRule?.maxScope).toBe('shared_workspace');
    const publishedBlobTables = COMMUNITY_SYNC_POLICY.entityRules
      .filter((r) => r.maxScope === 'published_blob')
      .map((r) => r.tableName);
    expect(publishedBlobTables).toEqual(['cm_publications']);

    // Plan 19 P9 (TC-9): the cm_archive_* tables stay at or below personal_replica,
    // so the signed PublicationDescriptor remains the SINGLE published_blob escalation.
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: 'cm_archive_jobs',
      defaultScope: 'device_local',
      maxScope: 'personal_replica',
      conflictStrategy: 'lww',
    });
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: 'cm_archive_moderation',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    });
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: 'cm_publication_rights',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    });
    // Plan 19 FF3: the owner's local public-join review queue never escalates.
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: CM_PUBLIC_JOIN_REQUESTS_TABLE,
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    });
  });

  it('Wave-1 audit guard: every created cm_ table has an explicit sync rule (omission must not leak)', () => {
    const created = COMMUNITY_DDL
      .map((ddl) => ddl.match(/CREATE TABLE IF NOT EXISTS (cm_[a-z_]+)/)?.[1])
      .filter((t): t is string => Boolean(t));
    expect(created.length).toBeGreaterThanOrEqual(20);
    const ruled = new Set(COMMUNITY_SYNC_POLICY.entityRules.map((r) => r.tableName));
    // The previously-leaking LOCAL-ONLY tables now carry explicit device_local rules.
    for (const t of ['cm_file_requests', 'cm_feed_cursor', 'cm_snapshots', 'cm_post_activity', 'cm_safety_actions', CM_PUBLIC_JOIN_REQUESTS_TABLE]) {
      expect(ruled.has(t)).toBe(true);
    }
    // No created cm_ table may be left rule-less (it would fall back to the default).
    const omitted = created.filter((t) => !ruled.has(t));
    expect(omitted).toEqual([]);
    // No LOCAL-ONLY table is allowed to reach shared_workspace or published_blob.
    const localOnly = ['cm_file_requests', 'cm_feed_cursor', 'cm_snapshots', 'cm_post_activity', 'cm_safety_actions', 'cm_public_directory_cache', 'cm_public_feed_cursor', 'cm_publication_snapshots', 'cm_public_report_reviews', 'cm_archive_moderation', 'cm_publication_rights', CM_PUBLIC_JOIN_REQUESTS_TABLE];
    for (const r of COMMUNITY_SYNC_POLICY.entityRules) {
      if (localOnly.includes(r.tableName)) expect(r.maxScope).toBe('device_local');
    }
  });

  it('Plan 19 P0: drives the REAL config through resolveModule + scope cap (TC-1 / NC-1)', () => {
    createSyncTables(db.adapter);
    const tracker = new ChangeTracker({
      db: db.adapter,
      deviceId: 'device-a',
      modulePrefixes: new Map([[COMMUNITY_MODULE_ID, COMMUNITY_PREFIX]]),
      modulePolicies: new Map([[COMMUNITY_MODULE_ID, COMMUNITY_SYNC_POLICY]]),
    });

    // cm_publications resolves to the community module and is capped at published_blob.
    expect(tracker.resolveModule('cm_publications')).toBe(COMMUNITY_MODULE_ID);
    const pubRule = tracker.resolveEntityRule(COMMUNITY_MODULE_ID, 'cm_publications', COMMUNITY_SYNC_POLICY);
    expect(pubRule?.maxScope).toBe('published_blob');

    const publishedSession = {
      peerRevoked: false, peerAuthorized: true, sessionScope: 'published_blob' as const, sasVerified: true,
    };
    const factsFor = (table: string) => {
      const resolvedModuleId = tracker.resolveModule(table);
      const rule = resolvedModuleId
        ? tracker.resolveEntityRule(resolvedModuleId, table, COMMUNITY_SYNC_POLICY)
        : null;
      const cap = rule?.maxScope ?? rule?.defaultScope ?? COMMUNITY_SYNC_POLICY.defaultScope;
      return {
        operation: 'INSERT', claimedModuleId: COMMUNITY_MODULE_ID, resolvedModuleId,
        moduleEnabled: true, moduleScopeCap: resolvedModuleId ? cap : null,
        moduleIsSensitive: false,
        moduleRequiresSasForShare: COMMUNITY_SYNC_POLICY.requiresSasForShare ?? false,
        incomingUpdatedAt: '2026-06-28T00:00:00.000Z', tombstoneDeletedAt: null,
      };
    };

    // cm_publications at published_blob is ACCEPTED; this fails if its cap is lowered.
    expect(evaluateInboundChange(publishedSession, factsFor('cm_publications')))
      .toEqual({ allowed: true });
    // cm_messages claiming published_blob is REJECTED; this fails if cm_messages is
    // ever raised to published_blob (NC-1 regression guard against the real config).
    expect(evaluateInboundChange(publishedSession, factsFor(CM_MESSAGES_TABLE)))
      .toEqual({ allowed: false, reason: 'scope_exceeds_cap' });
  });
});

describe('community-core profile identity (Prompt 09)', () => {
  beforeEach(() => {
    createSyncTables(db.adapter);
    ensureCommunityTables(db.adapter);
  });

  it('resolves the latest signed member profile and ignores forged or non-member rows', () => {
    const owner = generateDeviceIdentity('Owner Name');
    const member = generateDeviceIdentity('Main Member Name');
    const outsider = generateDeviceIdentity('Outsider Name');
    const signed = createCommunity(owner, {
      name: 'Book Club',
      channels: [{ id: 'general', name: 'general' }],
      members: [{
        deviceId: member.publicKey,
        role: 'member',
        displayName: 'Descriptor Member',
        dhPublicKey: member.dhPublicKey,
      }],
      now: '2026-06-24T10:00:00.000Z',
    });
    storeOwnedCommunity(db.adapter, owner, signed, '2026-06-24T10:00:00.000Z');

    const older = createCommunityProfileEvent(member, {
      communityId: signed.descriptor.communityId,
      displayName: 'River',
      avatarInitial: 'r',
      updatedAt: '2026-06-24T10:01:00.000Z',
    });
    const latest = createCommunityProfileEvent(member, {
      communityId: signed.descriptor.communityId,
      displayName: 'Community Member',
      avatarInitial: 'c',
      updatedAt: '2026-06-24T10:02:00.000Z',
    });
    const outsiderProfile = createCommunityProfileEvent(outsider, {
      communityId: signed.descriptor.communityId,
      displayName: 'Not A Member',
      updatedAt: '2026-06-24T10:03:00.000Z',
    });

    insertCommunityProfileRow(db.adapter, older);
    insertCommunityProfileRow(db.adapter, latest);
    insertCommunityProfileRow(db.adapter, outsiderProfile);
    const tampered = {
      ...communityProfileRowFromEvent(latest),
      id: 'tampered-profile',
      display_name: 'Forged Moderator',
    };
    db.adapter.execute(
      `INSERT INTO cm_profiles (
        id, community_id, member_device_id, display_name, avatar_initial, updated_at, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tampered.id,
        tampered.community_id,
        tampered.member_device_id,
        tampered.display_name,
        tampered.avatar_initial,
        tampered.updated_at,
        tampered.signature,
      ],
    );

    expect(getCommunityProfile(db.adapter, signed.descriptor.communityId, member.publicKey)?.displayName)
      .toBe('Community Member');
    expect(resolveCommunityDisplayName(db.adapter, signed.descriptor.communityId, member.publicKey, 'Fallback'))
      .toBe('Community Member');
    expect(resolveCommunityAvatarInitial(db.adapter, signed.descriptor.communityId, member.publicKey, 'Fallback'))
      .toBe('C');
    expect(buildCommunityPeerNameMap(db.adapter, signed.descriptor.communityId).get(member.publicKey))
      .toBe('Community Member');
    expect(getCommunityProfile(db.adapter, signed.descriptor.communityId, outsider.publicKey))
      .toBeNull();
  });

  it('round-trips a v2 avatar image through insert + reconstruct (Plan 32 T2.2)', () => {
    const owner = generateDeviceIdentity('Owner Name');
    const member = generateDeviceIdentity('Photo Member');
    const signed = createCommunity(owner, {
      name: 'Photo Club',
      channels: [{ id: 'general', name: 'general' }],
      members: [{
        deviceId: member.publicKey,
        role: 'member',
        displayName: 'Photo Member',
        dhPublicKey: member.dhPublicKey,
      }],
      now: '2026-07-01T10:00:00.000Z',
    });
    storeOwnedCommunity(db.adapter, owner, signed, '2026-07-01T10:00:00.000Z');

    const jpeg = '/9j/4AAQSkZJRgAA'; // valid base64 JPEG magic prefix, well under the cap
    const selectRow = (id: string) => db.adapter.query<CommunityProfileRow>(
      `SELECT id, community_id, member_device_id, display_name, avatar_initial, avatar_image, version, updated_at, signature
       FROM cm_profiles WHERE id = ?`,
      [id],
    );

    const v2 = createCommunityProfileEvent(member, {
      communityId: signed.descriptor.communityId,
      displayName: 'Photo Member',
      avatarImage: jpeg,
      updatedAt: '2026-07-01T10:05:00.000Z',
    });
    expect(v2.version).toBe(2);
    insertCommunityProfileRow(db.adapter, v2);

    // The KEY BUG fix: a persisted version + avatar_image let a stored v2 event
    // rebuild with matching canonical bytes, so verify PASSES on read (not dropped).
    const v2Rows = selectRow(v2.id);
    expect(v2Rows).toHaveLength(1);
    expect(v2Rows[0]!.version).toBe(2);
    const reconstructed = communityProfileEventFromRow(v2Rows[0]!);
    expect(reconstructed.version).toBe(2);
    expect(reconstructed.avatarImage).toBe(jpeg);
    expect(verifyCommunityProfileEvent(reconstructed)).toBe(true);
    expect(getCommunityProfile(db.adapter, signed.descriptor.communityId, member.publicKey)?.avatarImage).toBe(jpeg);
    expect(resolveCommunityAvatarImage(db.adapter, signed.descriptor.communityId, member.publicKey)).toBe(jpeg);

    // A v1 profile row still round-trips unchanged: version 1, no image, verifies.
    const v1 = createCommunityProfileEvent(member, {
      communityId: signed.descriptor.communityId,
      displayName: 'Photo Member',
      updatedAt: '2026-07-01T10:06:00.000Z',
    });
    expect(v1.version).toBe(1);
    insertCommunityProfileRow(db.adapter, v1);
    const v1Reconstructed = communityProfileEventFromRow(selectRow(v1.id)[0]!);
    expect(v1Reconstructed.version).toBe(1);
    expect(v1Reconstructed.avatarImage).toBeUndefined();
    expect(verifyCommunityProfileEvent(v1Reconstructed)).toBe(true);
  });

  it('surfaces an avatar image only from a signature-verified v2 profile', () => {
    const owner = generateDeviceIdentity('Owner Name');
    const member = generateDeviceIdentity('Forge Target');
    const outsider = generateDeviceIdentity('Outsider');
    const signed = createCommunity(owner, {
      name: 'Verify Club',
      channels: [{ id: 'general', name: 'general' }],
      members: [{
        deviceId: member.publicKey,
        role: 'member',
        displayName: 'Forge Target',
        dhPublicKey: member.dhPublicKey,
      }],
      now: '2026-07-01T10:00:00.000Z',
    });
    storeOwnedCommunity(db.adapter, owner, signed, '2026-07-01T10:00:00.000Z');

    const jpeg = '/9j/4AAQSkZJRgAA';
    // A forged v2 row: newer timestamp, an avatar image, but a signature that does
    // not cover it. It must NEVER surface an image (fail-closed on the read path).
    db.adapter.execute(
      `INSERT INTO cm_profiles (
        id, community_id, member_device_id, display_name, avatar_initial, avatar_image, version, updated_at, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'forged-avatar-row',
        signed.descriptor.communityId,
        member.publicKey,
        'Forge Target',
        'F',
        jpeg,
        2,
        '2026-07-01T11:00:00.000Z',
        'deadbeef',
      ],
    );
    expect(resolveCommunityAvatarImage(db.adapter, signed.descriptor.communityId, member.publicKey)).toBeNull();

    // A non-member (no verified profile at all) also yields no image.
    expect(resolveCommunityAvatarImage(db.adapter, signed.descriptor.communityId, outsider.publicKey)).toBeNull();

    // The real signed v2 profile is what surfaces the image.
    const v2 = createCommunityProfileEvent(member, {
      communityId: signed.descriptor.communityId,
      displayName: 'Forge Target',
      avatarImage: jpeg,
      updatedAt: '2026-07-01T12:00:00.000Z',
    });
    insertCommunityProfileRow(db.adapter, v2);
    expect(resolveCommunityAvatarImage(db.adapter, signed.descriptor.communityId, member.publicKey)).toBe(jpeg);
  });
});

describe('community-core message rows (MK-051)', () => {
  beforeEach(() => {
    // The P5 membership cut reads sync_workspace_members, which production boot
    // always creates before any merge runs.
    createSyncTables(db.adapter);
    ensureCommunityTables(db.adapter);
  });

  it('round-trips signed message events and returns them in channel order', () => {
    const author = generateDeviceIdentity('Author');
    const later = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'second',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const earlier = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'first',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });

    insertMessageRow(db.adapter, later);
    insertMessageRow(db.adapter, earlier);

    expect(listChannelMessageEvents(db.adapter, 'c1', 'general').map((message) => message.body))
      .toEqual(['first', 'second']);
    expect(highestHlc(db.adapter, 'c1', 'general'))
      .toEqual({ wall: '2026-06-13T00:00:01.000Z', counter: 0 });
  });

  it('stores attachment metadata rows with blob_hash references for blob transfer', () => {
    const author = generateDeviceIdentity('Author');
    const message = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'with attachment',
      attachments: [{
        id: 'local-attachment',
        blobHash: 'a'.repeat(128),
        name: 'notes.txt',
        mimeType: 'text/plain',
        size: 12,
      }],
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });

    insertMessageRow(db.adapter, message);
    const attachmentRows = insertMessageAttachmentRows(db.adapter, message);

    expect(listChannelMessageEvents(db.adapter, 'c1', 'general')[0]?.attachments)
      .toEqual(message.attachments);
    expect(attachmentRows).toHaveLength(1);
    expect(listMessageAttachmentRows(db.adapter, message.id)).toEqual([{
      id: `${message.id}:local-attachment`,
      message_id: message.id,
      community_id: 'c1',
      channel_id: 'general',
      attachment_id: 'local-attachment',
      blob_hash: 'a'.repeat(128),
      name: 'notes.txt',
      mime_type: 'text/plain',
      size: 12,
      updated_at: '2026-06-13T00:00:00.000Z',
    }]);
  });

  it('merges fetched signed history events without duplicating live rows', () => {
    const author = generateDeviceIdentity('Author');
    const live = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'already live',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const fetched = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'from host history',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const invalid = { ...fetched, id: 'invalid-host-event' };

    insertMessageRow(db.adapter, live);

    expect(mergeChannelMessageEvents(db.adapter, [fetched, live, invalid])).toEqual({
      inserted: 1,
      skipped: 1,
      invalid: 1,
      droppedRemoved: 0,
      insertedEvents: [fetched],
    });
    expect(listChannelMessageEvents(db.adapter, 'c1', 'general').map((message) => message.body))
      .toEqual(['from host history', 'already live']);
  });

  it('filters tampered rows and resolves edit/delete supersedes', () => {
    const author = generateDeviceIdentity('Author');
    const original = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'draft',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const edited = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'final',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
      supersedes: { id: original.id, deleted: false },
    });
    const deleted = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: '',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
      supersedes: { id: edited.id, deleted: true },
    });
    const tampered = { ...channelMessageRowFromEvent(original), id: 'tampered', body: 'evil' };

    insertMessageRow(db.adapter, original);
    insertMessageRow(db.adapter, edited);
    db.adapter.execute(
      `INSERT INTO cm_messages (
        id, community_id, channel_id, author_device_id, body,
        hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
        signature, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tampered.id,
        tampered.community_id,
        tampered.channel_id,
        tampered.author_device_id,
        tampered.body,
        tampered.hlc_wall,
        tampered.hlc_counter,
        tampered.supersedes_id,
        tampered.supersedes_deleted,
        tampered.signature,
        tampered.updated_at,
      ],
    );

    expect(listChannelMessageEvents(db.adapter, 'c1', 'general').map((message) => message.body))
      .toEqual(['draft', 'final']);
    expect(listChannelMessages(db.adapter, 'c1', 'general').map((message) => message.body))
      .toEqual(['final']);

    insertMessageRow(db.adapter, deleted);
    expect(listChannelMessages(db.adapter, 'c1', 'general')).toEqual([]);
    expect(highestHlc(db.adapter, 'c1', 'general'))
      .toEqual({ wall: '2026-06-13T00:00:02.000Z', counter: 0 });
  });

  it('finds a supersede thread and shreds local entity keys for delete redaction', () => {
    createSyncTables(db.adapter);
    const author = generateDeviceIdentity('Author');
    const original = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'draft',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const edited = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'final',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
      supersedes: { id: original.id, deleted: false },
    });
    const separate = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'another thread',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
    });

    insertMessageRow(db.adapter, original);
    insertMessageRow(db.adapter, edited);
    insertMessageRow(db.adapter, separate);

    const originalRef = { moduleId: COMMUNITY_MODULE_ID, tableName: CM_MESSAGES_TABLE, rowId: original.id };
    const editedRef = { moduleId: COMMUNITY_MODULE_ID, tableName: CM_MESSAGES_TABLE, rowId: edited.id };
    const separateRef = { moduleId: COMMUNITY_MODULE_ID, tableName: CM_MESSAGES_TABLE, rowId: separate.id };
    getOrCreateEntityKey(db.adapter, originalRef);
    getOrCreateEntityKey(db.adapter, editedRef);
    getOrCreateEntityKey(db.adapter, separateRef);

    expect(listChannelMessageThreadIds(db.adapter, 'c1', 'general', edited.id))
      .toEqual([original.id, edited.id]);
    expect(destroyChannelMessageKeys(db.adapter, 'c1', 'general', edited.id))
      .toEqual([original.id, edited.id]);
    expect(getEntityKey(db.adapter, originalRef)).toBeNull();
    expect(getEntityKey(db.adapter, editedRef)).toBeNull();
    expect(getEntityKey(db.adapter, separateRef)).not.toBeNull();
  });
});

describe('community-core read state (MK-058)', () => {
  beforeEach(() => {
    ensureCommunityTables(db.adapter);
  });

  it('advances last-read HLC monotonically and derives unread counts', () => {
    const author = generateDeviceIdentity('Author');
    const first = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'first',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const second = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'second',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const otherChannel = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'announcements',
      body: 'announcement',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, second);
    insertMessageRow(db.adapter, first);
    insertMessageRow(db.adapter, otherChannel);

    expect(countUnreadChannelMessages(db.adapter, 'c1', 'general')).toBe(2);
    expect(listCommunityChannelUnreadCounts(db.adapter, 'c1')).toEqual({
      general: 2,
      announcements: 1,
    });

    const firstRead = markChannelRead(db.adapter, 'c1', 'general', first.hlc, first.authorDeviceId, '2026-06-13T00:01:00.000Z');
    expect(firstRead.changed).toBe(true);
    expect(firstRead.operation).toBe('INSERT');
    expect(firstRead.row).toEqual({
      id: 'c1:general',
      community_id: 'c1',
      channel_id: 'general',
      last_read_wall: '2026-06-13T00:00:00.000Z',
      last_read_counter: 0,
      last_read_author: first.authorDeviceId,
      updated_at: '2026-06-13T00:01:00.000Z',
    });
    expect(countUnreadChannelMessages(db.adapter, 'c1', 'general')).toBe(1);

    const staleRead = markChannelRead(db.adapter, 'c1', 'general', first.hlc, first.authorDeviceId, '2026-06-13T00:02:00.000Z');
    expect(staleRead.changed).toBe(false);
    expect(getChannelReadState(db.adapter, 'c1', 'general')?.updated_at)
      .toBe('2026-06-13T00:01:00.000Z');

    const latestRead = markChannelRead(db.adapter, 'c1', 'general', second.hlc, second.authorDeviceId, '2026-06-13T00:03:00.000Z');
    expect(latestRead.changed).toBe(true);
    expect(latestRead.operation).toBe('UPDATE');
    expect(countUnreadChannelMessages(db.adapter, 'c1', 'general')).toBe(0);
    expect(listCommunityChannelUnreadCounts(db.adapter, 'c1')).toEqual({
      general: 0,
      announcements: 1,
    });
  });

  it('keeps read state personal_replica and rejects shared-workspace pushes by scope cap', () => {
    createSyncTables(db.adapter);
    const read = markChannelRead(
      db.adapter,
      'c1',
      'general',
      { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
      'device-a',
      '2026-06-13T00:01:00.000Z',
    );
    expect(read.changed).toBe(true);
    expect(read.row).not.toBeNull();

    const tracker = new ChangeTracker({
      db: db.adapter,
      deviceId: 'device-a',
      modulePrefixes: new Map([[COMMUNITY_MODULE_ID, COMMUNITY_PREFIX]]),
      modulePolicies: new Map([[COMMUNITY_MODULE_ID, COMMUNITY_SYNC_POLICY]]),
    });
    const outbound = tracker.filterForSync(CM_READ_STATE_TABLE, 'INSERT', { ...read.row! });
    expect(outbound.moduleId).toBe(COMMUNITY_MODULE_ID);
    expect(outbound.include).toBe(true);

    expect(evaluateInboundChange(
      { peerRevoked: false, peerAuthorized: true, sessionScope: 'shared_workspace', sasVerified: true },
      {
        operation: 'INSERT',
        claimedModuleId: COMMUNITY_MODULE_ID,
        resolvedModuleId: COMMUNITY_MODULE_ID,
        moduleEnabled: true,
        moduleScopeCap: 'personal_replica',
        moduleIsSensitive: false,
        moduleRequiresSasForShare: false,
        incomingUpdatedAt: read.row!.updated_at,
        tombstoneDeletedAt: null,
      },
    )).toEqual({ allowed: false, reason: 'scope_exceeds_cap' });
  });
});

const author = generateDeviceIdentity('TestAuthor');

describe('community-core v2 message columns (MK-P01)', () => {
  it('persists and round-trips v2 post/threading columns', () => {
    createSyncTables(db.adapter);
    ensureCommunityTables(db.adapter);
    const event = createChannelMessageV2(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'first post',
      hlc: { wall: '2026-06-18T00:00:00.000Z', counter: 0 },
      postId: 'post-1',
      parentId: 'post-1',
      branchId: 'post-1',
      authorKind: 'human',
      mentions: ['device-abc'],
      intent: 'message',
    });

    insertMessageRow(db.adapter, event);

    const rows = db.adapter.query<{
      version: number;
      post_id: string | null;
      parent_id: string | null;
      branch_id: string | null;
      author_kind: string | null;
      mentions_json: string;
      intent: string | null;
    }>('SELECT version, post_id, parent_id, branch_id, author_kind, mentions_json, intent FROM cm_messages WHERE id = ?', [event.id]);

    expect(rows[0]).toEqual({
      version: 2,
      post_id: 'post-1',
      parent_id: 'post-1',
      branch_id: 'post-1',
      author_kind: 'human',
      mentions_json: JSON.stringify(['device-abc']),
      intent: 'message',
    });

    const merged = mergeChannelMessageEvents(db.adapter, [event]);
    expect(merged.skipped).toBe(1);
    const listed = listChannelMessages(db.adapter, 'c1', 'general');
    expect(listed).toHaveLength(1);
    expect(verifyChannelMessage(listed[0]!)).toBe(true);
    expect(listed[0]!.postId).toBe('post-1');
  });

  it('persists a v1 message with null v2 columns and version 1', () => {
    ensureCommunityTables(db.adapter);
    const event = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'legacy',
      hlc: { wall: '2026-06-18T00:00:01.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, event);
    const rows = db.adapter.query<{ version: number; post_id: string | null }>(
      'SELECT version, post_id FROM cm_messages WHERE id = ?', [event.id],
    );
    expect(rows[0]).toEqual({ version: 1, post_id: null });
    const listed = listChannelMessages(db.adapter, 'c1', 'general');
    expect(verifyChannelMessage(listed[0]!)).toBe(true);
    expect(listed[0]!.version).toBe(1);
    expect(listed[0]!.postId).toBeUndefined();
    expect(listed[0]!.mentions).toBeUndefined();
    expect(listed[0]!.intent).toBeUndefined();
  });

  it('drops unsupported row versions instead of coercing them to v1', () => {
    ensureCommunityTables(db.adapter);
    const event = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'future version',
      hlc: { wall: '2026-06-18T00:00:02.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, event);
    db.adapter.execute('UPDATE cm_messages SET version = ? WHERE id = ?', [3, event.id]);

    expect(listChannelMessageEvents(db.adapter, 'c1', 'general')).toHaveLength(0);

    const row = db.adapter.query<ChannelMessageRow>('SELECT * FROM cm_messages WHERE id = ?', [event.id])[0]!;
    expect(() => channelMessageEventFromRow(row)).toThrow('Unsupported channel message version: 3');
  });

  it('adds the v2 columns idempotently to a legacy cm_messages table', () => {
    db.adapter.execute(`CREATE TABLE cm_messages (
      id TEXT PRIMARY KEY, community_id TEXT NOT NULL, channel_id TEXT NOT NULL,
      author_device_id TEXT NOT NULL, body TEXT NOT NULL,
      attachments_json TEXT NOT NULL DEFAULT '[]', hlc_wall TEXT NOT NULL,
      hlc_counter INTEGER NOT NULL, supersedes_id TEXT, supersedes_deleted INTEGER,
      signature TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);

    ensureCommunityTables(db.adapter);
    ensureCommunityTables(db.adapter);

    const cols = db.adapter
      .query<{ name: string }>('PRAGMA table_info(cm_messages)')
      .map((c) => c.name);
    for (const col of ['attachments_json', 'version', 'post_id', 'parent_id', 'branch_id', 'author_kind', 'mentions_json', 'intent']) {
      expect(cols).toContain(col);
    }
  });
});

describe('community-core post tables + policy (MK-P01)', () => {
  it('creates the post tables idempotently', () => {
    ensureCommunityTables(db.adapter);
    ensureCommunityTables(db.adapter);
    const tables = db.adapter
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((r) => r.name);
    expect(tables).toContain('cm_posts');
    expect(tables).toContain('cm_post_tags');
    expect(tables).toContain('cm_post_lifecycle');
    expect(tables).toContain('cm_post_activity');

    const colsOf = (t: string) =>
      db.adapter.query<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name);
    expect(colsOf('cm_posts')).toEqual(expect.arrayContaining(['id', 'author_kind', 'post_type', 'title', 'created_wall', 'created_counter', 'signature']));
    expect(colsOf('cm_post_tags')).toEqual(expect.arrayContaining(['post_id', 'tag', 'added_by_device_id']));
    expect(colsOf('cm_post_lifecycle')).toEqual(expect.arrayContaining(['post_id', 'state', 'set_by_device_id', 'signature']));
    expect(colsOf('cm_post_activity')).toEqual(expect.arrayContaining(['post_id', 'channel_id', 'bumped_at_wall', 'bumped_at_counter', 'reply_count', 'last_author_device_id', 'unread_count']));
  });

  it('replicates posts/tags/lifecycle but keeps activity local-only', () => {
    const ruleFor = (t: string) =>
      COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === t);
    expect(ruleFor('cm_posts')).toEqual({
      tableName: 'cm_posts', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww',
    });
    expect(ruleFor('cm_post_tags')).toEqual({
      tableName: 'cm_post_tags', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set',
    });
    expect(ruleFor('cm_post_lifecycle')).toEqual({
      tableName: 'cm_post_lifecycle', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww',
    });
    // Wave-1 audit fix: cm_post_activity (the LOCAL-derived bump/attention state) was
    // previously "local by OMISSION", which actually LEAKED at the shared_workspace
    // default and broke the bump-honesty invariant. It now carries an EXPLICIT
    // device_local rule, so the bump stays local-derived only.
    expect(ruleFor('cm_post_activity')).toEqual({
      tableName: 'cm_post_activity', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww',
    });
  });
});

describe('community-core post product helpers (Prompt 04)', () => {
  beforeEach(() => {
    ensureCommunityTables(db.adapter);
  });

  it('creates a root post and derives a post card from verified v2 messages', () => {
    const post = createChannelPostEvent(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'A real post\nwith detail',
      hlc: { wall: '2026-06-24T00:00:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, post);

    const header = channelPostHeaderRowFromRootEvent(post);
    expect(header.id).toBe(post.postId);
    expect(header.title).toBe('A real post');

    const cards = listChannelPostCards(db.adapter, 'c1', 'general');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      postId: post.postId,
      replyCount: 0,
      title: 'A real post',
      postType: 'discussion',
      lastAuthorDeviceId: post.authorDeviceId,
    });
    expect(cards[0]!.root.id).toBe(post.id);
  });

  it('builds a thread with replies that inherit the parent post audience', () => {
    const post = createChannelPostEvent(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'Post with replies',
      hlc: { wall: '2026-06-24T00:00:00.000Z', counter: 0 },
    });
    const reply = createChannelPostReplyEvent(author, {
      parent: post,
      body: 'First reply',
      hlc: { wall: '2026-06-24T00:00:01.000Z', counter: 0 },
    });
    const nested = createChannelPostReplyEvent(author, {
      parent: reply,
      body: 'Nested reply',
      hlc: { wall: '2026-06-24T00:00:02.000Z', counter: 0 },
    });

    insertMessageRow(db.adapter, post);
    insertMessageRow(db.adapter, reply);
    insertMessageRow(db.adapter, nested);

    const audience = createCommunityAudienceRule('c1');
    const replyAudience = createReplyAudienceRule(audience);
    expect(replyAudience).toEqual(audience);
    expect(reply.postId).toBe(post.postId);
    expect(reply.parentId).toBe(post.id);
    expect(nested.postId).toBe(post.postId);
    expect(nested.parentId).toBe(reply.id);

    const thread = listChannelPostThread(db.adapter, 'c1', 'general', post.postId!);
    expect(thread?.root.id).toBe(post.id);
    expect(thread?.replyCount).toBe(2);
    expect(thread?.replies.map((node) => node.event.id)).toEqual([reply.id]);
    expect(thread?.replies[0]?.replies.map((node) => node.event.id)).toEqual([nested.id]);

    const cards = listChannelPostCards(db.adapter, 'c1', 'general');
    expect(cards[0]?.replyCount).toBe(2);
    expect(cards[0]?.lastActivity).toEqual(nested.hlc);
  });

  it('keeps edited post replies attached to the visible edited parent', () => {
    const post = createChannelPostEvent(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'Original title',
      hlc: { wall: '2026-06-24T00:00:00.000Z', counter: 0 },
    });
    const reply = createChannelPostReplyEvent(author, {
      parent: post,
      body: 'Reply to original id',
      hlc: { wall: '2026-06-24T00:00:01.000Z', counter: 0 },
    });
    const editedPost = createChannelMessageV2(author, {
      communityId: post.communityId,
      channelId: post.channelId,
      body: 'Edited title',
      hlc: { wall: '2026-06-24T00:00:02.000Z', counter: 0 },
      postId: post.postId,
      parentId: post.parentId,
      branchId: post.branchId,
      authorKind: post.authorKind,
      intent: post.intent,
      supersedes: { id: post.id, deleted: false },
    });

    insertMessageRow(db.adapter, post);
    insertMessageRow(db.adapter, reply);
    insertMessageRow(db.adapter, editedPost);

    const thread = listChannelPostThread(db.adapter, 'c1', 'general', post.postId!);
    expect(thread?.root.id).toBe(editedPost.id);
    expect(thread?.root.body).toBe('Edited title');
    expect(thread?.replies.map((node) => node.event.id)).toEqual([reply.id]);
  });
});

describe('community-core read-state attention columns (MK-P01)', () => {
  it('adds attention columns to cm_read_state idempotently', () => {
    ensureCommunityTables(db.adapter);
    ensureCommunityTables(db.adapter);
    const cols = db.adapter
      .query<{ name: string }>('PRAGMA table_info(cm_read_state)')
      .map((c) => c.name);
    for (const col of ['post_id', 'branch_id', 'follow', 'mute', 'snooze_until', 'importance']) {
      expect(cols).toContain(col);
    }
  });
});

describe('chat reducer (MK-052)', () => {
  it('tracks optimistic compose, reconcile, and failed send state', () => {
    const pending = {
      clientId: 'client-1',
      communityId: 'c1',
      channelId: 'general',
      body: 'hello',
      createdAt: '2026-06-13T00:00:00.000Z',
    };

    const composing = chatReducer(INITIAL_CHAT_STATE, { type: 'compose', message: pending });
    expect(selectPendingMessages(composing, 'c1', 'general')).toEqual([pending]);

    const reconciled = chatReducer(composing, { type: 'reconcile', clientId: pending.clientId });
    expect(selectPendingMessages(reconciled, 'c1', 'general')).toEqual([]);

    const failedDraft = chatReducer(INITIAL_CHAT_STATE, { type: 'compose', message: pending });
    const failed = chatReducer(failedDraft, { type: 'fail', clientId: pending.clientId, error: 'disk full' });
    expect(selectPendingMessages(failed, 'c1', 'general')).toEqual([]);
    expect(selectFailedMessages(failed, 'c1', 'general')).toEqual([{ ...pending, error: 'disk full' }]);
    expect(failed.lastError).toBe('disk full');
  });

  it('records mutation errors without inventing a failed local message', () => {
    const failed = chatReducer(INITIAL_CHAT_STATE, {
      type: 'setError',
      error: 'Only the author device can edit this message.',
    });

    expect(failed.failed).toEqual([]);
    expect(failed.lastError).toBe('Only the author device can edit this message.');
    expect(failed.revision).toBe(1);
  });
});

describe('read-cursor: posts-only channels (M1) + (wall,counter) device tiebreak (m3)', () => {
  let db: InMemoryTestDatabase;
  const author = generateDeviceIdentity('Poster');
  const communityId = 'c1';
  const channelId = 'announcements';

  afterEach(() => db?.close());

  it('a posts-only channel clears its unread cursor when read to the post HLC (M1)', () => {
    db = createInMemoryTestDatabase();
    ensureCommunityTables(db.adapter);
    const post = createChannelPostEvent(author, {
      communityId,
      channelId,
      body: 'the only announcement',
      hlc: { wall: '2026-07-03T12:00:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, post);

    expect(countUnreadChannelMessages(db.adapter, communityId, channelId)).toBe(1);
    markChannelRead(db.adapter, communityId, channelId, post.hlc, post.authorDeviceId);
    expect(countUnreadChannelMessages(db.adapter, communityId, channelId)).toBe(0);
  });

  it('treats a distinct remote event at the boundary (wall,counter) as unread via the device tiebreak (m3)', () => {
    db = createInMemoryTestDatabase();
    ensureCommunityTables(db.adapter);
    const wall = '2026-07-03T12:00:00.000Z';
    const boundaryEvent = createChannelMessage(author, {
      communityId, channelId, body: 'boundary', hlc: { wall, counter: 0 },
    });
    insertMessageRow(db.adapter, boundaryEvent);
    markChannelRead(db.adapter, communityId, channelId, boundaryEvent.hlc, boundaryEvent.authorDeviceId);

    // The persisted boundary reconstructs with its author device id, so the
    // canonical (wall, counter, authorDeviceId) tiebreak is available.
    const boundary = readBoundaryFromReadState(getChannelReadState(db.adapter, communityId, channelId));
    expect(boundary).not.toBeNull();
    // A distinct device at the EXACT boundary (wall, counter) sorting AFTER the
    // boundary author is unread (not silently dropped); sorting before is read.
    expect(isEventAfterReadBoundary(wall, 0, 'zzzz', boundary!)).toBe(true);
    expect(isEventAfterReadBoundary(wall, 0, ' ', boundary!)).toBe(false);
    expect(isEventAfterReadBoundary(wall, 0, boundaryEvent.authorDeviceId, boundary!)).toBe(false);
  });
});
