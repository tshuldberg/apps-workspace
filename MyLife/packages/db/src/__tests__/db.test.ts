import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter, Migration } from '../adapter';
import { createHubTables } from '../hub-schema';
import {
  runModuleMigrations,
  runIsolatedModuleMigrations,
  initializeHubDatabase,
} from '../migration-runner';
import { createHubTestDatabase } from '../test-utils';
import {
  getEnabledModules,
  isModuleEnabled,
  enableModule,
  disableModule,
  incrementAggregateEventCounter,
  getAggregateEventCounter,
  listAggregateEventCounters,
  getPreference,
  setPreference,
  deletePreference,
  getAllPreferences,
  getHubMode,
  setHubMode,
  getHubEntitlement,
  setHubEntitlement,
  clearHubEntitlement,
  upsertFriendProfile,
  getFriendProfile,
  listFriendProfiles,
  createFriendInvite,
  getFriendInvite,
  listIncomingFriendInvites,
  listOutgoingFriendInvites,
  acceptFriendInvite,
  declineFriendInvite,
  revokeFriendInvite,
  listFriendsForUser,
  areUsersFriends,
  removeFriendship,
  createFriendMessage,
  upsertFriendMessageFromServer,
  getFriendMessageByClientMessageId,
  listFriendConversationMessages,
  listFriendMessageInbox,
  markFriendMessageRead,
  queueFriendMessageOutbox,
  listFriendMessageOutboxDue,
  markFriendMessageOutboxSent,
  markFriendMessageOutboxRetry,
  markFriendMessageOutboxFailed,
  getLatestFriendMessageCreatedAt,
  countFriendMessageOutboxByStatus,
  revokeHubEntitlement,
  unrevokeHubEntitlement,
  isHubEntitlementRevoked,
  listRevokedHubEntitlements,
  getSubscription,
  setSubscription,
  isHumanVerified,
  getHumanVerification,
  recordHumanVerification,
  revokeHumanVerification,
  getSharingPreferences,
  getAllSharingPreferences,
  getActiveSharingPreferences,
  updateSharingPreference,
  revokeAllSharing,
  deleteAllSharingPreferences,
  getSharingConsent,
  recordSharingConsent,
  revokeSharingConsent,
  getModuleSchemaVersion,
  getModuleMigrationHistory,
  getAllSchemaVersions,
  getDashboardLayout,
  getVisibleDashboardCards,
  upsertDashboardCard,
  updateCardPosition,
  toggleCardVisibility,
  updateCardSize,
  resetDashboardLayout,
} from '../hub-queries';

describe('@mylife/db', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Hub schema
  // ─────────────────────────────────────────────────────────────────────────

  describe('createHubTables', () => {
    it('creates all hub tables', () => {
      const tables = adapter.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hub_%' ORDER BY name",
      );
      const actualTableNames = new Set(tables.map((t) => t.name));

      // Superset check: every name below must be present. Adding new hub
      // tables should extend this list; it should not break when new ones
      // land. Keep grouped by domain for readability.
      const expected = [
        // Core hub tables (pre-Phase 1a, 26 tables).
        'hub_aggregate_event_counters',
        'hub_backup_config',
        'hub_backups',
        'hub_dashboard_layout',
        'hub_enabled_modules',
        'hub_entitlement_cache',
        'hub_entitlements',
        'hub_friend_invites',
        'hub_friend_message_outbox',
        'hub_friend_messages',
        'hub_friend_profiles',
        'hub_friendships',
        'hub_health_consent',
        'hub_human_verification',
        'hub_mode',
        'hub_module_locks',
        'hub_notification_preferences',
        'hub_onboarding',
        'hub_preferences',
        'hub_revoked_entitlements',
        'hub_scheduled_notifications',
        'hub_schema_versions',
        'hub_settings',
        'hub_sharing_consent',
        'hub_sharing_preferences',
        'hub_subscription',
        // Phase 1a: shared data layer (17 tables).
        'hub_attachments',
        'hub_attachment_links',
        'hub_tags',
        'hub_tag_bindings',
        'hub_reminders',
        'hub_goals',
        'hub_goal_progress',
        'hub_people',
        'hub_person_module_roles',
        'hub_body_metrics',
        'hub_places',
        'hub_gps_tracks',
        'hub_events',
        'hub_foods',
        'hub_books',
        'hub_cost_events',
        'hub_timeline',
        // Phase 1a: AI permissions scaffolding (3 tables).
        'hub_ai_permissions',
        'hub_ai_table_permissions',
        'hub_ai_audit_log',
        // Theme Profiles (Phase 0).
        'hub_theme_profiles',
      ];

      for (const name of expected) {
        expect(actualTableNames, `missing hub table: ${name}`).toContain(name);
      }
    });

    it('is idempotent — calling twice does not throw', () => {
      expect(() => createHubTables(adapter)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Migration runner
  // ─────────────────────────────────────────────────────────────────────────

  describe('initializeHubDatabase', () => {
    it('records hub v1 on first call', () => {
      const result = initializeHubDatabase(adapter);
      expect(result).toEqual({ version: 1, migrationsApplied: 1 });
    });

    it('is idempotent on second call', () => {
      initializeHubDatabase(adapter);
      const result = initializeHubDatabase(adapter);
      expect(result).toEqual({ version: 1, migrationsApplied: 0 });
    });
  });

  describe('runModuleMigrations', () => {
    const MIGRATIONS: Migration[] = [
      {
        version: 1,
        description: 'Create test table',
        up: ['CREATE TABLE IF NOT EXISTS test_items (id TEXT PRIMARY KEY, name TEXT NOT NULL)'],
        down: ['DROP TABLE IF EXISTS test_items'],
      },
      {
        version: 2,
        description: 'Add description column',
        up: ['ALTER TABLE test_items ADD COLUMN description TEXT'],
        down: [],
      },
    ];

    it('applies all pending migrations', () => {
      const applied = runModuleMigrations(adapter, 'test', MIGRATIONS);
      expect(applied).toBe(2);
    });

    it('skips already-applied migrations', () => {
      runModuleMigrations(adapter, 'test', MIGRATIONS);
      const applied = runModuleMigrations(adapter, 'test', MIGRATIONS);
      expect(applied).toBe(0);
    });

    it('applies only new migrations', () => {
      runModuleMigrations(adapter, 'test', [MIGRATIONS[0]]);
      const applied = runModuleMigrations(adapter, 'test', MIGRATIONS);
      expect(applied).toBe(1);
    });

    it('records versions in hub_schema_versions', () => {
      runModuleMigrations(adapter, 'test', MIGRATIONS);
      const version = getModuleSchemaVersion(adapter, 'test');
      expect(version).toBe(2);
    });

    it('creates the table defined in migration', () => {
      runModuleMigrations(adapter, 'test', MIGRATIONS);
      adapter.execute("INSERT INTO test_items (id, name, description) VALUES ('1', 'foo', 'bar')");
      const rows = adapter.query<{ id: string; name: string }>('SELECT * FROM test_items');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('foo');
    });

    it('rolls back the full module batch when a later migration fails', () => {
      const failingBatch: Migration[] = [
        {
          version: 1,
          description: 'Create rollback table',
          up: ['CREATE TABLE rollback_test (id INTEGER PRIMARY KEY)'],
          down: ['DROP TABLE IF EXISTS rollback_test'],
        },
        {
          version: 2,
          description: 'Fail after writing',
          up: [
            'INSERT INTO rollback_test (id) VALUES (1)',
            'INSERT INTO missing_table (id) VALUES (1)',
          ],
          down: [],
        },
      ];

      expect(() => runModuleMigrations(adapter, 'rollback', failingBatch)).toThrow();

      const tables = adapter.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rollback_test'",
      );
      expect(tables).toEqual([]);
      expect(getModuleSchemaVersion(adapter, 'rollback')).toBe(0);
    });
  });

  describe('runIsolatedModuleMigrations', () => {
    it('disables only the failed module and continues running the rest', async () => {
      enableModule(adapter, 'bad');
      enableModule(adapter, 'good');

      const summary = await runIsolatedModuleMigrations(adapter, [
        {
          moduleId: 'bad',
          migrations: [
            {
              version: 1,
              description: 'Create then fail',
              up: [
                'CREATE TABLE bad_items (id TEXT PRIMARY KEY)',
                'INSERT INTO nonexistent_bad_table (id) VALUES (1)',
              ],
              down: [],
            },
          ],
        },
        {
          moduleId: 'good',
          migrations: [
            {
              version: 1,
              description: 'Create good table',
              up: ['CREATE TABLE good_items (id TEXT PRIMARY KEY)'],
              down: ['DROP TABLE IF EXISTS good_items'],
            },
          ],
        },
      ]);

      expect(summary.failedModuleIds).toEqual(['bad']);
      expect(summary.totalAppliedMigrations).toBe(1);
      expect(summary.results).toEqual([
        expect.objectContaining({ moduleId: 'bad', status: 'failed' }),
        expect.objectContaining({
          moduleId: 'good',
          status: 'applied',
          appliedMigrations: 1,
        }),
      ]);

      expect(isModuleEnabled(adapter, 'bad')).toBe(false);
      expect(isModuleEnabled(adapter, 'good')).toBe(true);
      expect(getEnabledModules(adapter).map((row) => row.module_id)).toEqual(['good']);

      const badTables = adapter.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bad_items'",
      );
      const goodTables = adapter.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'good_items'",
      );
      expect(badTables).toEqual([]);
      expect(goodTables).toEqual([{ name: 'good_items' }]);
      expect(getModuleSchemaVersion(adapter, 'bad')).toBe(0);
      expect(getModuleSchemaVersion(adapter, 'good')).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Enabled modules
  // ─────────────────────────────────────────────────────────────────────────

  describe('enabled modules', () => {
    it('starts with no enabled modules', () => {
      expect(getEnabledModules(adapter)).toEqual([]);
    });

    it('enables a module', () => {
      enableModule(adapter, 'books');
      expect(isModuleEnabled(adapter, 'books')).toBe(true);
      expect(getEnabledModules(adapter)).toHaveLength(1);
    });

    it('enable is idempotent', () => {
      enableModule(adapter, 'books');
      enableModule(adapter, 'books');
      expect(getEnabledModules(adapter)).toHaveLength(1);
    });

    it('disables a module', () => {
      enableModule(adapter, 'books');
      disableModule(adapter, 'books');
      expect(isModuleEnabled(adapter, 'books')).toBe(false);
      expect(getEnabledModules(adapter)).toHaveLength(0);
    });

    it('disable is a no-op for non-enabled module', () => {
      expect(() => disableModule(adapter, 'books')).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Aggregate event counters
  // ─────────────────────────────────────────────────────────────────────────

  describe('aggregate event counters', () => {
    it('increments and reads event counter buckets', () => {
      incrementAggregateEventCounter(adapter, 'mode_selected:hosted', '2026-02-25');
      incrementAggregateEventCounter(adapter, 'mode_selected:hosted', '2026-02-25');

      const row = getAggregateEventCounter(adapter, 'mode_selected:hosted', '2026-02-25');
      expect(row).toBeDefined();
      expect(row!.count).toBe(2);
    });

    it('lists counters with prefix filter', () => {
      incrementAggregateEventCounter(adapter, 'mode_selected:hosted', '2026-02-25');
      incrementAggregateEventCounter(adapter, 'mode_selected:self_host', '2026-02-25');
      incrementAggregateEventCounter(adapter, 'setup_completed:self_host', '2026-02-25');

      const rows = listAggregateEventCounters(adapter, {
        eventKeyPrefix: 'mode_selected:',
      });

      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.event_key.startsWith('mode_selected:'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Preferences
  // ─────────────────────────────────────────────────────────────────────────

  describe('preferences', () => {
    it('returns undefined for unset key', () => {
      expect(getPreference(adapter, 'theme')).toBeUndefined();
    });

    it('sets and gets a preference', () => {
      setPreference(adapter, 'theme', 'dark');
      expect(getPreference(adapter, 'theme')).toBe('dark');
    });

    it('updates an existing preference', () => {
      setPreference(adapter, 'theme', 'dark');
      setPreference(adapter, 'theme', 'light');
      expect(getPreference(adapter, 'theme')).toBe('light');
    });

    it('deletes a preference', () => {
      setPreference(adapter, 'theme', 'dark');
      deletePreference(adapter, 'theme');
      expect(getPreference(adapter, 'theme')).toBeUndefined();
    });

    it('getAllPreferences returns all entries', () => {
      setPreference(adapter, 'a', '1');
      setPreference(adapter, 'b', '2');
      expect(getAllPreferences(adapter)).toEqual({ a: '1', b: '2' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Hub mode
  // ─────────────────────────────────────────────────────────────────────────

  describe('hub mode', () => {
    it('returns undefined when mode is unset', () => {
      expect(getHubMode(adapter)).toBeUndefined();
    });

    it('sets and retrieves mode values', () => {
      setHubMode(adapter, 'self_host', 'https://home.example.com');
      const mode = getHubMode(adapter);
      expect(mode).toBeDefined();
      expect(mode!.mode).toBe('self_host');
      expect(mode!.server_url).toBe('https://home.example.com');
    });

    it('upserts mode value on repeated writes', () => {
      setHubMode(adapter, 'local_only');
      setHubMode(adapter, 'hosted', 'https://api.example.com');
      const mode = getHubMode(adapter);
      expect(mode!.mode).toBe('hosted');
      expect(mode!.server_url).toBe('https://api.example.com');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Hub entitlements
  // ─────────────────────────────────────────────────────────────────────────

  describe('hub entitlements', () => {
    it('returns undefined when entitlement is unset', () => {
      expect(getHubEntitlement(adapter)).toBeUndefined();
    });

    it('sets and retrieves entitlement payload', () => {
      setHubEntitlement(adapter, {
        raw_token: 'raw.jwt.value',
        app_id: 'books',
        mode: 'hosted',
        hosted_active: true,
        self_host_license: false,
        update_pack_year: 2026,
        features: ['sharing', 'sync'],
        issued_at: '2026-02-24T00:00:00.000Z',
        expires_at: '2026-12-31T23:59:59.000Z',
        signature: 'abcdef1234567890',
      });

      const entitlement = getHubEntitlement(adapter);
      expect(entitlement).toBeDefined();
      expect(entitlement!.app_id).toBe('books');
      expect(entitlement!.hosted_active).toBe(true);
      expect(entitlement!.self_host_license).toBe(false);
      expect(entitlement!.features).toEqual(['sharing', 'sync']);
    });

    it('clears entitlement payload', () => {
      setHubEntitlement(adapter, {
        raw_token: 'raw.jwt.value',
        app_id: 'books',
        mode: 'hosted',
        hosted_active: true,
        self_host_license: false,
        features: [],
        issued_at: '2026-02-24T00:00:00.000Z',
        signature: 'abcdef1234567890',
      });
      clearHubEntitlement(adapter);
      expect(getHubEntitlement(adapter)).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Friends and invites
  // ─────────────────────────────────────────────────────────────────────────

  describe('friends and invites', () => {
    it('upserts and loads friend profiles', () => {
      upsertFriendProfile(adapter, {
        user_id: 'alice',
        display_name: 'Alice',
        handle: '@alice',
      });

      const profile = getFriendProfile(adapter, 'alice');
      expect(profile).toBeDefined();
      expect(profile!.display_name).toBe('Alice');

      upsertFriendProfile(adapter, {
        user_id: 'alice',
        display_name: 'Alice Updated',
      });
      expect(getFriendProfile(adapter, 'alice')!.display_name).toBe('Alice Updated');

      expect(listFriendProfiles(adapter)).toHaveLength(1);
    });

    it('creates and lists incoming/outgoing invites', () => {
      createFriendInvite(adapter, {
        id: 'invite-1',
        from_user_id: 'alice',
        to_user_id: 'bob',
        message: 'Let us share books',
      });

      expect(getFriendInvite(adapter, 'invite-1')?.status).toBe('pending');
      expect(listOutgoingFriendInvites(adapter, 'alice')).toHaveLength(1);
      expect(listIncomingFriendInvites(adapter, 'bob')).toHaveLength(1);
    });

    it('accepts invite and creates reciprocal friendships', () => {
      upsertFriendProfile(adapter, { user_id: 'alice', display_name: 'Alice' });
      upsertFriendProfile(adapter, { user_id: 'bob', display_name: 'Bob' });
      createFriendInvite(adapter, {
        id: 'invite-1',
        from_user_id: 'alice',
        to_user_id: 'bob',
      });

      expect(acceptFriendInvite(adapter, 'invite-1', 'bob')).toBe(true);
      expect(getFriendInvite(adapter, 'invite-1')?.status).toBe('accepted');
      expect(areUsersFriends(adapter, 'alice', 'bob')).toBe(true);

      const aliceFriends = listFriendsForUser(adapter, 'alice');
      expect(aliceFriends).toHaveLength(1);
      expect(aliceFriends[0].friend_user_id).toBe('bob');
      expect(aliceFriends[0].display_name).toBe('Bob');
    });

    it('declines and revokes pending invites', () => {
      createFriendInvite(adapter, {
        id: 'invite-decline',
        from_user_id: 'alice',
        to_user_id: 'bob',
      });
      createFriendInvite(adapter, {
        id: 'invite-revoke',
        from_user_id: 'alice',
        to_user_id: 'charlie',
      });

      expect(declineFriendInvite(adapter, 'invite-decline', 'bob')).toBe(true);
      expect(getFriendInvite(adapter, 'invite-decline')?.status).toBe('declined');

      expect(revokeFriendInvite(adapter, 'invite-revoke', 'alice')).toBe(true);
      expect(getFriendInvite(adapter, 'invite-revoke')?.status).toBe('revoked');
    });

    it('removes reciprocal friendship links', () => {
      createFriendInvite(adapter, {
        id: 'invite-1',
        from_user_id: 'alice',
        to_user_id: 'bob',
      });
      acceptFriendInvite(adapter, 'invite-1', 'bob');
      expect(areUsersFriends(adapter, 'alice', 'bob')).toBe(true);

      removeFriendship(adapter, 'alice', 'bob');
      expect(areUsersFriends(adapter, 'alice', 'bob')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Friend messages + outbox
  // ─────────────────────────────────────────────────────────────────────────

  describe('friend messages and outbox', () => {
    it('queues outbound message and lists due outbox entries', () => {
      const queued = queueFriendMessageOutbox(adapter, {
        id: 'msg-local-1',
        client_message_id: 'client-1',
        from_user_id: 'alice',
        to_user_id: 'bob',
        content: 'hello bob',
        created_at: '2026-02-25T12:00:00.000Z',
      });

      expect(queued.client_message_id).toBe('client-1');
      expect(queued.sync_state).toBe('pending');

      // Use a far-future timestamp so entries queued at real current time are always "due"
      const due = listFriendMessageOutboxDue(adapter, 'alice', {
        now: '2099-01-01T00:00:00.000Z',
      });
      expect(due).toHaveLength(1);
      expect(due[0].client_message_id).toBe('client-1');

      const conversation = listFriendConversationMessages(adapter, 'alice', 'bob');
      expect(conversation).toHaveLength(1);
      expect(conversation[0].content).toBe('hello bob');
    });

    it('marks outbox retry and failed states', () => {
      queueFriendMessageOutbox(adapter, {
        id: 'msg-local-2',
        client_message_id: 'client-2',
        from_user_id: 'alice',
        to_user_id: 'bob',
        content: 'retry me',
      });

      markFriendMessageOutboxRetry(
        adapter,
        'client-2',
        '2026-02-25T12:10:00.000Z',
        'network timeout',
      );

      const dueNow = listFriendMessageOutboxDue(adapter, 'alice', {
        now: '2026-02-25T12:00:00.000Z',
      });
      expect(dueNow).toHaveLength(0);

      const countersAfterRetry = countFriendMessageOutboxByStatus(adapter, 'alice');
      expect(countersAfterRetry.retry).toBe(1);

      markFriendMessageOutboxFailed(adapter, 'client-2', 'permanent auth error');
      const countersAfterFailed = countFriendMessageOutboxByStatus(adapter, 'alice');
      expect(countersAfterFailed.failed).toBe(1);
    });

    it('marks outbox sent and syncs cached message metadata', () => {
      queueFriendMessageOutbox(adapter, {
        id: 'msg-local-3',
        client_message_id: 'client-3',
        from_user_id: 'alice',
        to_user_id: 'bob',
        content: 'sent message',
      });

      markFriendMessageOutboxSent(adapter, 'client-3', {
        server_message_id: 'server-3',
        created_at: '2026-02-25T13:00:00.000Z',
      });

      const due = listFriendMessageOutboxDue(adapter, 'alice');
      expect(due).toHaveLength(0);

      const cached = getFriendMessageByClientMessageId(adapter, 'client-3');
      expect(cached).toBeDefined();
      expect(cached!.sync_state).toBe('synced');
      expect(cached!.server_message_id).toBe('server-3');
      expect(cached!.created_at).toBe('2026-02-25T13:00:00.000Z');
    });

    it('upserts server messages and preserves local source for local-origin rows', () => {
      queueFriendMessageOutbox(adapter, {
        id: 'msg-local-4',
        client_message_id: 'client-4',
        from_user_id: 'alice',
        to_user_id: 'bob',
        content: 'local draft',
      });

      const merged = upsertFriendMessageFromServer(adapter, {
        id: 'server-msg-4',
        client_message_id: 'client-4',
        sender_user_id: 'alice',
        recipient_user_id: 'bob',
        content_type: 'text/plain',
        content: 'local draft delivered',
        created_at: '2026-02-25T14:00:00.000Z',
      });
      expect(merged.source).toBe('local');
      expect(merged.sync_state).toBe('synced');
      expect(merged.content).toBe('local draft delivered');

      const remoteOnly = upsertFriendMessageFromServer(adapter, {
        id: 'server-msg-5',
        client_message_id: 'client-5',
        sender_user_id: 'bob',
        recipient_user_id: 'alice',
        content_type: 'text/plain',
        content: 'hello from remote',
        created_at: '2026-02-25T14:05:00.000Z',
      });
      expect(remoteOnly.source).toBe('remote');
      expect(remoteOnly.sync_state).toBe('synced');
    });

    it('lists inbox summaries and supports read receipts', () => {
      createFriendMessage(adapter, {
        id: 'msg-a',
        client_message_id: 'client-a',
        sender_user_id: 'bob',
        recipient_user_id: 'alice',
        content: 'one',
        source: 'remote',
        sync_state: 'synced',
        created_at: '2026-02-25T15:00:00.000Z',
      });

      createFriendMessage(adapter, {
        id: 'msg-b',
        client_message_id: 'client-b',
        sender_user_id: 'alice',
        recipient_user_id: 'bob',
        content: 'two',
        source: 'local',
        sync_state: 'synced',
        created_at: '2026-02-25T15:05:00.000Z',
      });

      const inboxBefore = listFriendMessageInbox(adapter, 'alice');
      expect(inboxBefore).toHaveLength(1);
      expect(inboxBefore[0].friend_user_id).toBe('bob');
      expect(inboxBefore[0].last_message_content).toBe('two');
      expect(inboxBefore[0].unread_count).toBe(1);

      const marked = markFriendMessageRead(adapter, 'msg-a', 'alice');
      expect(marked).toBeDefined();
      expect(marked!.read_at).toBeTruthy();

      const inboxAfter = listFriendMessageInbox(adapter, 'alice');
      expect(inboxAfter[0].unread_count).toBe(0);
    });

    it('returns latest conversation timestamp and supports since filtering', () => {
      createFriendMessage(adapter, {
        id: 'msg-c',
        client_message_id: 'client-c',
        sender_user_id: 'alice',
        recipient_user_id: 'bob',
        content: 'older',
        source: 'local',
        sync_state: 'synced',
        created_at: '2026-02-25T16:00:00.000Z',
      });

      createFriendMessage(adapter, {
        id: 'msg-d',
        client_message_id: 'client-d',
        sender_user_id: 'bob',
        recipient_user_id: 'alice',
        content: 'newer',
        source: 'remote',
        sync_state: 'synced',
        created_at: '2026-02-25T16:30:00.000Z',
      });

      const latest = getLatestFriendMessageCreatedAt(adapter, 'alice', 'bob');
      expect(latest).toBe('2026-02-25T16:30:00.000Z');

      const incremental = listFriendConversationMessages(adapter, 'alice', 'bob', {
        since: '2026-02-25T16:05:00.000Z',
      });
      expect(incremental).toHaveLength(1);
      expect(incremental[0].id).toBe('msg-d');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Revoked entitlements
  // ─────────────────────────────────────────────────────────────────────────

  describe('revoked entitlements', () => {
    it('returns false when signature is not revoked', () => {
      expect(isHubEntitlementRevoked(adapter, 'sig-1')).toBe(false);
    });

    it('records and checks revoked signature', () => {
      revokeHubEntitlement(adapter, 'sig-1', 'refund', 'evt-1');
      expect(isHubEntitlementRevoked(adapter, 'sig-1')).toBe(true);
    });

    it('lists revoked signatures', () => {
      revokeHubEntitlement(adapter, 'sig-1', 'refund', 'evt-1');
      const revoked = listRevokedHubEntitlements(adapter);
      expect(revoked).toHaveLength(1);
      expect(revoked[0].signature).toBe('sig-1');
      expect(revoked[0].reason).toBe('refund');
      expect(revoked[0].source_event_id).toBe('evt-1');
    });

    it('can unrevoke a signature', () => {
      revokeHubEntitlement(adapter, 'sig-1', 'refund');
      unrevokeHubEntitlement(adapter, 'sig-1');
      expect(isHubEntitlementRevoked(adapter, 'sig-1')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Subscription
  // ─────────────────────────────────────────────────────────────────────────

  describe('subscription', () => {
    it('returns undefined when no subscription exists', () => {
      expect(getSubscription(adapter)).toBeUndefined();
    });

    it('creates and retrieves a subscription', () => {
      setSubscription(adapter, { id: 'sub-1', tier: 'free' });
      const sub = getSubscription(adapter);
      expect(sub).toBeDefined();
      expect(sub!.tier).toBe('free');
    });

    it('upserts subscription on second call', () => {
      setSubscription(adapter, { id: 'sub-1', tier: 'free' });
      setSubscription(adapter, { id: 'sub-1', tier: 'premium', provider: 'stripe' });
      const sub = getSubscription(adapter);
      expect(sub!.tier).toBe('premium');
      expect(sub!.provider).toBe('stripe');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Schema versions
  // ─────────────────────────────────────────────────────────────────────────

  describe('schema versions', () => {
    it('returns 0 for module with no migrations', () => {
      expect(getModuleSchemaVersion(adapter, 'unknown')).toBe(0);
    });

    it('tracks migration history', () => {
      const migrations: Migration[] = [
        { version: 1, description: 'v1', up: [], down: [] },
        { version: 2, description: 'v2', up: [], down: [] },
      ];
      runModuleMigrations(adapter, 'test', migrations);
      const history = getModuleMigrationHistory(adapter, 'test');
      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
    });

    it('getAllSchemaVersions groups by module', () => {
      runModuleMigrations(adapter, 'a', [{ version: 1, description: '', up: [], down: [] }]);
      runModuleMigrations(adapter, 'b', [{ version: 1, description: '', up: [], down: [] }]);
      const all = getAllSchemaVersions(adapter);
      expect(all).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Human verification
  // ─────────────────────────────────────────────────────────────────────────

  describe('human verification', () => {
    it('returns false when user has no verification', () => {
      expect(isHumanVerified(adapter, 'user-1')).toBe(false);
    });

    it('returns undefined when no verification exists', () => {
      expect(getHumanVerification(adapter, 'user-1')).toBeUndefined();
    });

    it('records a verification and marks user as verified', () => {
      const result = recordHumanVerification(adapter, {
        id: 'v-1',
        userId: 'user-1',
        method: 'faceid',
      });

      expect(result.id).toBe('v-1');
      expect(result.user_id).toBe('user-1');
      expect(result.method).toBe('faceid');
      expect(result.device_attestation).toBeNull();
      expect(result.revoked_at).toBeNull();
      expect(result.verified_at).toBeTruthy();

      expect(isHumanVerified(adapter, 'user-1')).toBe(true);
    });

    it('records verification with device attestation', () => {
      const result = recordHumanVerification(adapter, {
        id: 'v-2',
        userId: 'user-2',
        method: 'touchid',
        deviceAttestation: 'attestation-token-abc',
      });

      expect(result.device_attestation).toBe('attestation-token-abc');
      expect(result.method).toBe('touchid');
    });

    it('retrieves the most recent active verification', () => {
      recordHumanVerification(adapter, {
        id: 'v-3a',
        userId: 'user-3',
        method: 'biometric',
      });
      recordHumanVerification(adapter, {
        id: 'v-3b',
        userId: 'user-3',
        method: 'passkey',
      });

      const latest = getHumanVerification(adapter, 'user-3');
      expect(latest).toBeDefined();
      expect(latest!.id).toBe('v-3b');
      expect(latest!.method).toBe('passkey');
    });

    it('revokes verification and marks user as unverified', () => {
      recordHumanVerification(adapter, {
        id: 'v-4',
        userId: 'user-4',
        method: 'faceid',
      });

      expect(isHumanVerified(adapter, 'user-4')).toBe(true);

      revokeHumanVerification(adapter, 'user-4');

      expect(isHumanVerified(adapter, 'user-4')).toBe(false);
      expect(getHumanVerification(adapter, 'user-4')).toBeUndefined();
    });

    it('revocation is a no-op for unverified users', () => {
      expect(() => revokeHumanVerification(adapter, 'nobody')).not.toThrow();
    });

    it('allows re-verification after revocation', () => {
      recordHumanVerification(adapter, {
        id: 'v-5a',
        userId: 'user-5',
        method: 'faceid',
      });
      revokeHumanVerification(adapter, 'user-5');
      expect(isHumanVerified(adapter, 'user-5')).toBe(false);

      recordHumanVerification(adapter, {
        id: 'v-5b',
        userId: 'user-5',
        method: 'touchid',
      });
      expect(isHumanVerified(adapter, 'user-5')).toBe(true);

      const latest = getHumanVerification(adapter, 'user-5');
      expect(latest!.method).toBe('touchid');
    });

    it('does not cross-contaminate between users', () => {
      recordHumanVerification(adapter, {
        id: 'v-6',
        userId: 'user-6',
        method: 'faceid',
      });

      expect(isHumanVerified(adapter, 'user-6')).toBe(true);
      expect(isHumanVerified(adapter, 'user-7')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sharing preferences
  // ─────────────────────────────────────────────────────────────────────────

  describe('sharing preferences', () => {
    it('returns empty array when no preferences exist', () => {
      expect(getSharingPreferences(adapter, 'books')).toEqual([]);
      expect(getAllSharingPreferences(adapter)).toEqual([]);
    });

    it('creates a sharing preference via upsert', () => {
      const pref = updateSharingPreference(adapter, {
        moduleId: 'books',
        dataType: 'reading_activity',
        shared: true,
      });

      expect(pref.moduleId).toBe('books');
      expect(pref.dataType).toBe('reading_activity');
      expect(pref.shared).toBe(true);
      expect(pref.anonymized).toBe(true);
    });

    it('updates an existing preference', () => {
      updateSharingPreference(adapter, {
        moduleId: 'books',
        dataType: 'reviews',
        shared: true,
      });

      const updated = updateSharingPreference(adapter, {
        moduleId: 'books',
        dataType: 'reviews',
        shared: false,
      });

      expect(updated.shared).toBe(false);
    });

    it('respects anonymized flag', () => {
      const pref = updateSharingPreference(adapter, {
        moduleId: 'workouts',
        dataType: 'sessions',
        shared: true,
        anonymized: false,
      });

      expect(pref.anonymized).toBe(false);
    });

    it('lists preferences by module', () => {
      updateSharingPreference(adapter, { moduleId: 'books', dataType: 'reviews', shared: true });
      updateSharingPreference(adapter, { moduleId: 'books', dataType: 'activity', shared: false });
      updateSharingPreference(adapter, { moduleId: 'meds', dataType: 'adherence', shared: true });

      const booksPrefs = getSharingPreferences(adapter, 'books');
      expect(booksPrefs).toHaveLength(2);
      expect(booksPrefs.every((p) => p.moduleId === 'books')).toBe(true);
    });

    it('lists all preferences across modules', () => {
      updateSharingPreference(adapter, { moduleId: 'books', dataType: 'reviews', shared: true });
      updateSharingPreference(adapter, { moduleId: 'meds', dataType: 'adherence', shared: true });

      const all = getAllSharingPreferences(adapter);
      expect(all).toHaveLength(2);
    });

    it('lists only active (shared=true) preferences', () => {
      updateSharingPreference(adapter, { moduleId: 'books', dataType: 'reviews', shared: true });
      updateSharingPreference(adapter, { moduleId: 'books', dataType: 'activity', shared: false });
      updateSharingPreference(adapter, { moduleId: 'meds', dataType: 'adherence', shared: true });

      const active = getActiveSharingPreferences(adapter);
      expect(active).toHaveLength(2);
      expect(active.every((p) => p.shared)).toBe(true);
    });

    it('revokeAllSharing disables all sharing', () => {
      updateSharingPreference(adapter, { moduleId: 'books', dataType: 'reviews', shared: true });
      updateSharingPreference(adapter, { moduleId: 'meds', dataType: 'adherence', shared: true });
      updateSharingPreference(adapter, { moduleId: 'workouts', dataType: 'sessions', shared: true });

      const count = revokeAllSharing(adapter);
      expect(count).toBe(3);

      const active = getActiveSharingPreferences(adapter);
      expect(active).toHaveLength(0);

      // Records still exist, just shared=false
      expect(getAllSharingPreferences(adapter)).toHaveLength(3);
    });

    it('deleteAllSharingPreferences removes all records', () => {
      updateSharingPreference(adapter, { moduleId: 'books', dataType: 'reviews', shared: true });
      updateSharingPreference(adapter, { moduleId: 'meds', dataType: 'adherence', shared: true });

      const count = deleteAllSharingPreferences(adapter);
      expect(count).toBe(2);
      expect(getAllSharingPreferences(adapter)).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sharing consent
  // ─────────────────────────────────────────────────────────────────────────

  describe('sharing consent', () => {
    it('returns not consented by default', () => {
      const consent = getSharingConsent(adapter);
      expect(consent.consented).toBe(false);
      expect(consent.consentedAt).toBeNull();
    });

    it('records consent with timestamp', () => {
      recordSharingConsent(adapter);
      const consent = getSharingConsent(adapter);
      expect(consent.consented).toBe(true);
      expect(consent.consentedAt).toBeTruthy();
    });

    it('revokes consent and disables all sharing', () => {
      recordSharingConsent(adapter);
      updateSharingPreference(adapter, { moduleId: 'books', dataType: 'reviews', shared: true });

      revokeSharingConsent(adapter);

      expect(getSharingConsent(adapter).consented).toBe(false);
      expect(getActiveSharingPreferences(adapter)).toHaveLength(0);
    });

    it('allows re-consenting after revocation', () => {
      recordSharingConsent(adapter);
      revokeSharingConsent(adapter);
      recordSharingConsent(adapter);

      expect(getSharingConsent(adapter).consented).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // hub_dashboard_layout
  // ─────────────────────────────────────────────────────────────────────────

  describe('dashboard layout', () => {
    it('returns empty layout by default', () => {
      expect(getDashboardLayout(adapter)).toEqual([]);
    });

    it('upserts a dashboard card', () => {
      upsertDashboardCard(adapter, 'books', { position: 0 });
      upsertDashboardCard(adapter, 'budget', { position: 1, card_size: 'compact' });

      const layout = getDashboardLayout(adapter);
      expect(layout).toHaveLength(2);
      expect(layout[0].module_id).toBe('books');
      expect(layout[0].position).toBe(0);
      expect(layout[0].visible).toBe(1);
      expect(layout[0].card_size).toBe('standard');
      expect(layout[1].module_id).toBe('budget');
      expect(layout[1].card_size).toBe('compact');
    });

    it('upsert updates existing card position', () => {
      upsertDashboardCard(adapter, 'books', { position: 0 });
      upsertDashboardCard(adapter, 'books', { position: 5 });

      const layout = getDashboardLayout(adapter);
      expect(layout).toHaveLength(1);
      expect(layout[0].position).toBe(5);
    });

    it('updateCardPosition changes position', () => {
      upsertDashboardCard(adapter, 'books', { position: 0 });
      updateCardPosition(adapter, 'books', 3);

      const layout = getDashboardLayout(adapter);
      expect(layout[0].position).toBe(3);
    });

    it('toggleCardVisibility hides and shows cards', () => {
      upsertDashboardCard(adapter, 'books', { position: 0 });
      upsertDashboardCard(adapter, 'budget', { position: 1 });

      toggleCardVisibility(adapter, 'books', false);
      expect(getVisibleDashboardCards(adapter)).toHaveLength(1);
      expect(getVisibleDashboardCards(adapter)[0].module_id).toBe('budget');

      toggleCardVisibility(adapter, 'books', true);
      expect(getVisibleDashboardCards(adapter)).toHaveLength(2);
    });

    it('updateCardSize changes between standard and compact', () => {
      upsertDashboardCard(adapter, 'books', { position: 0 });
      expect(getDashboardLayout(adapter)[0].card_size).toBe('standard');

      updateCardSize(adapter, 'books', 'compact');
      expect(getDashboardLayout(adapter)[0].card_size).toBe('compact');
    });

    it('resetDashboardLayout clears and rebuilds from enabled modules', () => {
      upsertDashboardCard(adapter, 'books', { position: 0, card_size: 'compact' });
      upsertDashboardCard(adapter, 'budget', { position: 1 });

      const result = resetDashboardLayout(adapter, ['meds', 'budget', 'books']);
      expect(result).toHaveLength(3);
      // Alphabetical: books=0, budget=1, meds=2
      expect(result[0].module_id).toBe('books');
      expect(result[0].position).toBe(0);
      expect(result[0].card_size).toBe('standard'); // reset to default
      expect(result[1].module_id).toBe('budget');
      expect(result[1].position).toBe(1);
      expect(result[2].module_id).toBe('meds');
      expect(result[2].position).toBe(2);
    });

    it('getVisibleDashboardCards returns only visible cards in position order', () => {
      upsertDashboardCard(adapter, 'books', { position: 2 });
      upsertDashboardCard(adapter, 'budget', { position: 0 });
      upsertDashboardCard(adapter, 'meds', { position: 1, visible: 0 });

      const visible = getVisibleDashboardCards(adapter);
      expect(visible).toHaveLength(2);
      expect(visible[0].module_id).toBe('budget');
      expect(visible[1].module_id).toBe('books');
    });
  });
});
