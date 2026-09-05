/**
 * @mylife/db native entrypoint.
 *
 * Mirrors runtime exports from index.ts while excluding test helpers
 * that depend on better-sqlite3 (Node-only).
 */

// Adapter interface and migration types
export type { DatabaseAdapter, Migration } from './adapter';
export type {
  ModuleMigrationTarget,
  ModuleMigrationExecutionResult,
  RunIsolatedModuleMigrationsOptions,
  RunIsolatedModuleMigrationsResult,
} from './migration-runner';

// Hub schema DDL
export {
  CREATE_HUB_ENABLED_MODULES,
  CREATE_HUB_PREFERENCES,
  CREATE_HUB_AGGREGATE_EVENT_COUNTERS,
  CREATE_HUB_SUBSCRIPTION,
  CREATE_HUB_MODE,
  CREATE_HUB_ENTITLEMENTS,
  CREATE_HUB_FRIEND_PROFILES,
  CREATE_HUB_FRIEND_INVITES,
  CREATE_HUB_FRIENDSHIPS,
  CREATE_HUB_FRIEND_MESSAGES,
  CREATE_HUB_FRIEND_MESSAGE_OUTBOX,
  CREATE_HUB_FRIEND_INDEXES,
  CREATE_HUB_REVOKED_ENTITLEMENTS,
  CREATE_HUB_MODULE_LOCKS,
  CREATE_HUB_SCHEDULED_NOTIFICATIONS,
  CREATE_HUB_SCHEDULED_NOTIFICATIONS_INDEXES,
  CREATE_HUB_NOTIFICATION_PREFERENCES,
  CREATE_HUB_SCHEMA_VERSIONS,
  CREATE_HUB_AUTOMATION_RULES,
  CREATE_HUB_AUTOMATION_LOG,
  CREATE_HUB_AUTOMATION_LOG_INDEX,
  HUB_TABLES,
  createHubTables,
} from './hub-schema';

// Migration runner
export {
  runModuleMigrations,
  runIsolatedModuleMigrations,
  initializeHubDatabase,
} from './migration-runner';

// Hub CRUD queries
export {
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
  getFriendMessageById,
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
  getHealthConsent,
  hasActiveHealthConsent,
  listAllHealthConsents,
  recordHealthConsent,
  withdrawHealthConsent,
  getDashboardLayout,
  getVisibleDashboardCards,
  upsertDashboardCard,
  updateCardPosition,
  toggleCardVisibility,
  updateCardSize,
  resetDashboardLayout,
  deleteAllData,
  getModuleTableStats,
  getDatabaseSize,
  deleteModuleData,
  resetModuleSchemaVersion,
  CLOUD_STORAGE_MODULES,
} from './hub-queries';

// Backup system
export type {
  BackupType,
  BackupMetadata,
  BackupConfig,
  BackupResult,
  RestoreResult,
  BackupValidationResult,
  BackupPlatformOps,
} from './backup';
export { DEFAULT_BACKUP_CONFIG } from './backup';
export {
  CREATE_HUB_BACKUPS,
  CREATE_HUB_BACKUP_CONFIG,
  CREATE_HUB_BACKUP_INDEXES,
  BACKUP_TABLES,
} from './backup';
export {
  createBackup,
  restoreFromBackup,
  listBackups,
  listBackupsByType,
  getBackup,
  deleteBackup,
  getBackupConfig,
  setBackupConfig,
  validateBackupCompatibility,
} from './backup';

// Data export
export type {
  ExportedTable,
  ModuleExport,
  HubExportData,
  ExportableModule,
} from './export';
export { exportAllModules } from './export';

// Re-export query types
export type {
  EnabledModule,
  AggregateEventCounter,
  HubMode,
  HubEntitlement,
  FriendProfile,
  FriendInvite,
  FriendInviteStatus,
  Friendship,
  FriendshipStatus,
  FriendConnection,
  FriendMessage,
  FriendMessageContentType,
  FriendMessageSource,
  FriendMessageSyncState,
  FriendInboxItem,
  FriendMessageOutboxEntry,
  FriendMessageOutboxStatus,
  RevokedEntitlement,
  HubPlanMode,
  Subscription,
  SchemaVersion,
  VerificationMethod,
  HumanVerification,
  SharingPreferenceView,
  SharingConsent,
  HealthConsent,
  DashboardCard,
  DashboardCardSize,
  ModuleDeletionResult,
} from './hub-queries';
