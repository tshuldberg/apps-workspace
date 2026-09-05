// Definition
export { MAIL_MODULE } from './definition';

// Automations
export {
  mailIcsToEventsRule,
  parseFirstVEvent,
  type MailIcsInput,
  type MailIcsPreviewState,
  type MailIcsResult,
} from './automations/mail-ics-to-events';

// Types and schemas
export type {
  MailAccount,
  MailMessage,
  MailFolder,
  MailDraft,
  MailFilter,
  MailFilterField,
  MailFilterAction,
  MailStats,
  CreateMailAccountInput,
  UpdateMailAccountInput,
  CreateMailMessageInput,
  CreateMailDraftInput,
  UpdateMailDraftInput,
  CreateMailFolderInput,
  MessageFilter,
  MessageFilterInput,
  // V2 types
  MailAttachment,
  CreateAttachmentInput,
  MailContact,
  ContactSource,
  CreateMailContactInput,
  UpdateMailContactInput,
  MailThread,
  CreateMailThreadInput,
  CalendarEvent,
  CreateCalendarEventInput,
  RSVPStatus,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
  EncryptionKey,
  KeyType,
  CreateEncryptionKeyInput,
  SyncState,
  SyncStatus,
  ImapConfig,
  MailSearchResult,
} from './types';

export {
  MailAccountSchema,
  MailMessageSchema,
  MailFolderSchema,
  MailDraftSchema,
  MailFilterSchema,
  MailFilterFieldSchema,
  MailFilterActionSchema,
  MailStatsSchema,
  CreateMailAccountInputSchema,
  UpdateMailAccountInputSchema,
  CreateMailMessageInputSchema,
  CreateMailDraftInputSchema,
  UpdateMailDraftInputSchema,
  CreateMailFolderInputSchema,
  MessageFilterSchema,
  SYSTEM_FOLDERS,
  // V2 schemas
  MailAttachmentSchema,
  CreateAttachmentInputSchema,
  MailContactSchema,
  ContactSourceSchema,
  CreateMailContactInputSchema,
  UpdateMailContactInputSchema,
  MailThreadSchema,
  CreateMailThreadInputSchema,
  CalendarEventSchema,
  CreateCalendarEventInputSchema,
  RSVPStatusSchema,
  NotificationPreferencesSchema,
  UpdateNotificationPreferencesInputSchema,
  EncryptionKeySchema,
  KeyTypeSchema,
  CreateEncryptionKeyInputSchema,
  SyncStateSchema,
  SyncStatusSchema,
  ImapConfigSchema,
  MailSearchResultSchema,
  BLOCKED_EXTENSIONS,
  MAX_ATTACHMENT_SIZE,
  MAX_TOTAL_ATTACHMENT_SIZE,
  ACCOUNT_COLORS,
} from './types';

// V1 CRUD
export {
  createAccount,
  getAccount,
  getAccounts,
  updateAccount,
  deleteAccount,
  createMessage,
  getMessage,
  getMessages,
  getMessagesByAccount,
  markAsRead,
  toggleStar,
  moveToFolder,
  deleteMessage,
  createDraft,
  getDrafts,
  updateDraft,
  deleteDraft,
  createFolder,
  getFolders,
  getMailStats,
} from './db/crud';

// V2 CRUD
export {
  // Attachments
  createAttachment,
  getAttachmentsByMessage,
  getAttachmentsByDraft,
  deleteAttachment,
  // Filters
  createFilter,
  getFilters,
  toggleFilter,
  deleteFilter,
  // Contacts
  createContact,
  getContactByEmail,
  getContacts,
  searchContacts,
  updateContact,
  incrementContactFrequency,
  toggleContactVip,
  deleteContact,
  // Threads
  createThread,
  getThread,
  getThreads,
  getMessagesByThread,
  updateThreadMetadata,
  muteThread,
  deleteThread,
  // Calendar Events
  createCalendarEvent,
  getCalendarEventsByMessage,
  getCalendarEventsByAccount,
  getCalendarEventByIcsUid,
  updateRsvpStatus,
  // Notification Preferences
  getNotificationPreferences,
  upsertNotificationPreferences,
  // Encryption Keys
  createEncryptionKey,
  getEncryptionKeys,
  getKeyByFingerprint,
  revokeKey,
  deleteEncryptionKey,
  // Sync State
  upsertSyncState,
  getSyncState,
  getSyncStates,
} from './db/crud-v2';

// V1 Engine
export {
  searchMessages,
  groupByThread,
  getUnreadCount,
  filterByDateRange,
} from './engine/search';

// V2 Engines
export {
  getMimeType,
  getExtension,
  isBlockedExtension,
  validateFileSize,
  validateTotalSize,
  formatFileSize,
  isPreviewableImage,
  isPdf,
} from './engine/attachments';

export {
  applyFilters,
  matchesFilter,
  countMatches,
} from './engine/filters';

export {
  generateInitials,
  getAvatarColor,
  resolveContact,
  autoComplete,
  nameFromEmail,
  gravatarUrl,
} from './engine/contacts';

export {
  normalizeSubject,
  resolveThread,
  buildThreadMetadata,
  sortThreadMessages,
} from './engine/threading';

export {
  parseIcs,
  normalizeIcsDate,
  detectDatesInBody,
  eventToInput,
  generateRsvpReply,
} from './engine/calendar';

export {
  buildNotification,
  isQuietHours,
  shouldNotify,
  batchNotification,
} from './engine/notifications';

export {
  computeFingerprint,
  findKeyForContact,
  findOwnKey,
  canEncrypt,
  isPgpEncrypted,
  hasPgpSignature,
  isPgpPublicKey,
} from './engine/encryption';

export {
  autoDiscoverConfig,
  getSupportedProviders,
  guessConfig,
  parseHeader,
  parseReferences,
} from './engine/imap';
