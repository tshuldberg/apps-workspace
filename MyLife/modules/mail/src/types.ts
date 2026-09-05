import { z } from 'zod';

// ── Mail Account ──────────────────────────────────────────────────────

export const MailAccountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  serverHost: z.string(),
  serverPort: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MailAccount = z.infer<typeof MailAccountSchema>;

export const CreateMailAccountInputSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  serverHost: z.string().min(1),
  serverPort: z.number().int().min(1).max(65535),
  isActive: z.boolean().optional(),
});
export type CreateMailAccountInput = z.infer<typeof CreateMailAccountInputSchema>;

export const UpdateMailAccountInputSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(1).optional(),
  serverHost: z.string().min(1).optional(),
  serverPort: z.number().int().min(1).max(65535).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMailAccountInput = z.infer<typeof UpdateMailAccountInputSchema>;

// ── Mail Message ──────────────────────────────────────────────────────

export const MailMessageSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  body: z.string(),
  isRead: z.boolean(),
  isStarred: z.boolean(),
  folder: z.string(),
  receivedAt: z.string(),
  createdAt: z.string(),
});
export type MailMessage = z.infer<typeof MailMessageSchema>;

export const CreateMailMessageInputSchema = z.object({
  accountId: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.array(z.string()).min(1),
  body: z.string(),
  folder: z.string().optional(),
  receivedAt: z.string().optional(),
});
export type CreateMailMessageInput = z.infer<typeof CreateMailMessageInputSchema>;

// ── Mail Folder ───────────────────────────────────────────────────────

export const MailFolderSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  sortOrder: z.number(),
  isSystem: z.boolean(),
  createdAt: z.string(),
});
export type MailFolder = z.infer<typeof MailFolderSchema>;

export const CreateMailFolderInputSchema = z.object({
  accountId: z.string(),
  name: z.string().min(1),
  icon: z.string().optional(),
  sortOrder: z.number().optional(),
});
export type CreateMailFolderInput = z.infer<typeof CreateMailFolderInputSchema>;

// ── Mail Draft ────────────────────────────────────────────────────────

export const MailDraftSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  subject: z.string(),
  to: z.array(z.string()),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MailDraft = z.infer<typeof MailDraftSchema>;

export const CreateMailDraftInputSchema = z.object({
  accountId: z.string(),
  subject: z.string().optional(),
  to: z.array(z.string()).optional(),
  body: z.string().optional(),
});
export type CreateMailDraftInput = z.infer<typeof CreateMailDraftInputSchema>;

export const UpdateMailDraftInputSchema = z.object({
  subject: z.string().optional(),
  to: z.array(z.string()).optional(),
  body: z.string().optional(),
});
export type UpdateMailDraftInput = z.infer<typeof UpdateMailDraftInputSchema>;

// ── Mail Filter/Rule ──────────────────────────────────────────────────

export const MailFilterFieldSchema = z.enum(['from', 'to', 'subject', 'body']);
export type MailFilterField = z.infer<typeof MailFilterFieldSchema>;

export const MailFilterActionSchema = z.enum(['move', 'star', 'mark_read', 'delete']);
export type MailFilterAction = z.infer<typeof MailFilterActionSchema>;

export const MailFilterSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  field: MailFilterFieldSchema,
  pattern: z.string(),
  action: MailFilterActionSchema,
  actionValue: z.string().nullable(),
  isActive: z.boolean(),
  priority: z.number().int(),
  createdAt: z.string(),
});
export type MailFilter = z.infer<typeof MailFilterSchema>;

// ── Mail Stats ────────────────────────────────────────────────────────

export const MailStatsSchema = z.object({
  totalMessages: z.number(),
  unreadCount: z.number(),
  starredCount: z.number(),
  draftCount: z.number(),
  byFolder: z.array(z.object({
    folder: z.string(),
    total: z.number(),
    unread: z.number(),
  })),
});
export type MailStats = z.infer<typeof MailStatsSchema>;

// ── Message Filter ────────────────────────────────────────────────────

export const MessageFilterSchema = z.object({
  folder: z.string().optional(),
  accountId: z.string().optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
});
export type MessageFilter = z.infer<typeof MessageFilterSchema>;
export type MessageFilterInput = z.input<typeof MessageFilterSchema>;

// ── Default System Folders ────────────────────────────────────────────

export const SYSTEM_FOLDERS = [
  { name: 'Inbox', icon: 'inbox', sortOrder: 0 },
  { name: 'Sent', icon: 'send', sortOrder: 1 },
  { name: 'Drafts', icon: 'file-text', sortOrder: 2 },
  { name: 'Starred', icon: 'star', sortOrder: 3 },
  { name: 'Trash', icon: 'trash', sortOrder: 4 },
  { name: 'Spam', icon: 'alert-triangle', sortOrder: 5 },
] as const;

// ── V2: Attachments ──────────────────────────────────────────────────

export const MailAttachmentSchema = z.object({
  id: z.string(),
  messageId: z.string().nullable(),
  draftId: z.string().nullable(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  localPath: z.string().nullable(),
  isInline: z.boolean(),
  contentId: z.string().nullable(),
  createdAt: z.string(),
});
export type MailAttachment = z.infer<typeof MailAttachmentSchema>;

export const CreateAttachmentInputSchema = z.object({
  messageId: z.string().optional(),
  draftId: z.string().optional(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  localPath: z.string().optional(),
  isInline: z.boolean().optional(),
  contentId: z.string().optional(),
});
export type CreateAttachmentInput = z.infer<typeof CreateAttachmentInputSchema>;

// ── V2: Contacts ─────────────────────────────────────────────────────

export const ContactSourceSchema = z.enum(['manual', 'device', 'auto_created', 'imported']);
export type ContactSource = z.infer<typeof ContactSourceSchema>;

export const MailContactSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  company: z.string().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  isVip: z.boolean(),
  source: ContactSourceSchema,
  frequency: z.number().int(),
  lastContactedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MailContact = z.infer<typeof MailContactSchema>;

export const CreateMailContactInputSchema = z.object({
  accountId: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
  source: ContactSourceSchema.optional(),
});
export type CreateMailContactInput = z.infer<typeof CreateMailContactInputSchema>;

export const UpdateMailContactInputSchema = z.object({
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
});
export type UpdateMailContactInput = z.infer<typeof UpdateMailContactInputSchema>;

// ── V2: Threads ──────────────────────────────────────────────────────

export const MailThreadSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  subject: z.string(),
  participantEmails: z.array(z.string()),
  messageCount: z.number().int(),
  unreadCount: z.number().int(),
  latestMessageAt: z.string(),
  isMuted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MailThread = z.infer<typeof MailThreadSchema>;

export const CreateMailThreadInputSchema = z.object({
  accountId: z.string(),
  subject: z.string(),
  participantEmails: z.array(z.string()).optional(),
  latestMessageAt: z.string(),
});
export type CreateMailThreadInput = z.infer<typeof CreateMailThreadInputSchema>;

// ── V2: Calendar Events ─────────────────────────────────────────────

export const RSVPStatusSchema = z.enum(['pending', 'accepted', 'declined', 'tentative']);
export type RSVPStatus = z.infer<typeof RSVPStatusSchema>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  accountId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  organizer: z.string().nullable(),
  attendees: z.array(z.string()),
  icsUid: z.string().nullable(),
  rsvpStatus: RSVPStatusSchema,
  isAllDay: z.boolean(),
  createdAt: z.string(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CreateCalendarEventInputSchema = z.object({
  messageId: z.string(),
  accountId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  organizer: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  icsUid: z.string().optional(),
  isAllDay: z.boolean().optional(),
});
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventInputSchema>;

// ── V2: Notification Preferences ────────────────────────────────────

export const NotificationPreferencesSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  enabled: z.boolean(),
  quietStart: z.string().nullable(),
  quietEnd: z.string().nullable(),
  vipOnly: z.boolean(),
  showPreview: z.boolean(),
  sound: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdateNotificationPreferencesInputSchema = z.object({
  enabled: z.boolean().optional(),
  quietStart: z.string().nullable().optional(),
  quietEnd: z.string().nullable().optional(),
  vipOnly: z.boolean().optional(),
  showPreview: z.boolean().optional(),
  sound: z.string().optional(),
});
export type UpdateNotificationPreferencesInput = z.infer<typeof UpdateNotificationPreferencesInputSchema>;

// ── V2: Encryption Keys ──────────────────────────────────────────────

export const KeyTypeSchema = z.enum(['rsa', 'x25519', 'pgp']);
export type KeyType = z.infer<typeof KeyTypeSchema>;

export const EncryptionKeySchema = z.object({
  id: z.string(),
  accountId: z.string(),
  keyType: KeyTypeSchema,
  publicKey: z.string(),
  privateKeyEncrypted: z.string().nullable(),
  fingerprint: z.string(),
  contactEmail: z.string().nullable(),
  isOwnKey: z.boolean(),
  isRevoked: z.boolean(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});
export type EncryptionKey = z.infer<typeof EncryptionKeySchema>;

export const CreateEncryptionKeyInputSchema = z.object({
  accountId: z.string(),
  keyType: KeyTypeSchema,
  publicKey: z.string(),
  privateKeyEncrypted: z.string().optional(),
  fingerprint: z.string(),
  contactEmail: z.string().optional(),
  isOwnKey: z.boolean().optional(),
  expiresAt: z.string().optional(),
});
export type CreateEncryptionKeyInput = z.infer<typeof CreateEncryptionKeyInputSchema>;

// ── V2: IMAP Sync State ─────────────────────────────────────────────

export const SyncStatusSchema = z.enum(['idle', 'syncing', 'error']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const SyncStateSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  folder: z.string(),
  lastUid: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  uidvalidity: z.string().nullable(),
  status: SyncStatusSchema,
  errorMessage: z.string().nullable(),
});
export type SyncState = z.infer<typeof SyncStateSchema>;

export const ImapConfigSchema = z.object({
  imapHost: z.string(),
  imapPort: z.number().int().default(993),
  imapSecurity: z.enum(['ssl', 'starttls', 'none']).default('ssl'),
  smtpHost: z.string(),
  smtpPort: z.number().int().default(587),
  smtpSecurity: z.enum(['ssl', 'starttls', 'none']).default('starttls'),
  authMethod: z.enum(['password', 'oauth2']).default('password'),
});
export type ImapConfig = z.infer<typeof ImapConfigSchema>;

// ── V2: Multiple Accounts Extended ──────────────────────────────────

export const ACCOUNT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
] as const;

// ── V2: Search (FTS5) ───────────────────────────────────────────────

export const MailSearchResultSchema = z.object({
  message: MailMessageSchema,
  snippet: z.string(),
  rank: z.number(),
});
export type MailSearchResult = z.infer<typeof MailSearchResultSchema>;

// ── Blocked file extensions for attachments ─────────────────────────

export const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.msi', '.com', '.pif'] as const;
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_TOTAL_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB
