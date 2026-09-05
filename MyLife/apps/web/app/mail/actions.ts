'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  // Account CRUD
  createAccount,
  getAccount,
  getAccounts,
  updateAccount,
  deleteAccount,
  // Message CRUD
  createMessage,
  getMessage,
  getMessages,
  getMessagesByAccount,
  markAsRead,
  toggleStar,
  moveToFolder,
  deleteMessage,
  // Draft CRUD
  createDraft,
  getDrafts,
  updateDraft,
  deleteDraft,
  // Folder CRUD
  createFolder,
  getFolders,
  // Stats
  getMailStats,
  // Search engine
  searchMessages,
  groupByThread,
  getUnreadCount,
  filterByDateRange,
  // Attachment CRUD
  createAttachment,
  getAttachmentsByMessage,
  getAttachmentsByDraft,
  deleteAttachment,
  // Filter CRUD
  createFilter,
  getFilters,
  toggleFilter,
  deleteFilter,
  // Contact CRUD
  createContact,
  getContactByEmail,
  getContacts,
  searchContacts,
  updateContact,
  incrementContactFrequency,
  toggleContactVip,
  deleteContact,
  // Thread CRUD
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
  // Engine: Contacts
  autoComplete,
  // Engine: Filters
  applyFilters,
  countMatches,
  // Engine: IMAP
  autoDiscoverConfig,
  // Types
  type CreateMailAccountInput,
  type UpdateMailAccountInput,
  type CreateMailMessageInput,
  type CreateMailDraftInput,
  type UpdateMailDraftInput,
  type CreateMailFolderInput,
  type MessageFilterInput,
  type CreateAttachmentInput,
  type CreateMailContactInput,
  type UpdateMailContactInput,
  type CreateMailThreadInput,
  type CreateCalendarEventInput,
  type RSVPStatus,
  type UpdateNotificationPreferencesInput,
  type CreateEncryptionKeyInput,
} from '@mylife/mail';

/** Ensure mail module tables exist before any query. */
function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('mail');
  return adapter;
}

// ── Account CRUD ─────────────────────────────────────────────────────

export async function createAccountAction(input: CreateMailAccountInput) {
  return createAccount(db(), crypto.randomUUID(), input);
}

export async function fetchAccountAction(id: string) {
  return getAccount(db(), id);
}

export async function fetchAccountsAction() {
  return getAccounts(db());
}

export async function updateAccountAction(id: string, input: UpdateMailAccountInput) {
  return updateAccount(db(), id, input);
}

export async function deleteAccountAction(id: string) {
  return deleteAccount(db(), id);
}

// ── Message CRUD ─────────────────────────────────────────────────────

export async function createMessageAction(input: CreateMailMessageInput) {
  return createMessage(db(), crypto.randomUUID(), input);
}

export async function fetchMessageAction(id: string) {
  return getMessage(db(), id);
}

export async function fetchMessagesAction(filter?: MessageFilterInput) {
  return getMessages(db(), filter);
}

export async function fetchMessagesByAccountAction(accountId: string) {
  return getMessagesByAccount(db(), accountId);
}

export async function markAsReadAction(id: string) {
  return markAsRead(db(), id);
}

export async function toggleStarAction(id: string) {
  return toggleStar(db(), id);
}

export async function moveToFolderAction(id: string, folder: string) {
  return moveToFolder(db(), id, folder);
}

export async function deleteMessageAction(id: string) {
  return deleteMessage(db(), id);
}

// ── Draft CRUD ───────────────────────────────────────────────────────

export async function createDraftAction(input: CreateMailDraftInput) {
  return createDraft(db(), crypto.randomUUID(), input);
}

export async function fetchDraftsAction(accountId?: string) {
  return getDrafts(db(), accountId);
}

export async function updateDraftAction(id: string, input: UpdateMailDraftInput) {
  return updateDraft(db(), id, input);
}

export async function deleteDraftAction(id: string) {
  return deleteDraft(db(), id);
}

// ── Folder CRUD ──────────────────────────────────────────────────────

export async function createFolderAction(input: CreateMailFolderInput) {
  return createFolder(db(), crypto.randomUUID(), input);
}

export async function fetchFoldersAction(accountId?: string) {
  return getFolders(db(), accountId);
}

// ── Stats ────────────────────────────────────────────────────────────

export async function fetchMailStatsAction(accountId?: string) {
  return getMailStats(db(), accountId);
}

// ── Search Engine ────────────────────────────────────────────────────

export async function searchMessagesAction(query: string, accountId?: string) {
  const messages = getMessages(db(), accountId ? { accountId, limit: 500 } : { limit: 500 });
  return searchMessages(messages, query);
}

export async function groupByThreadAction() {
  const messages = getMessages(db(), { limit: 500 });
  return groupByThread(messages);
}

export async function fetchUnreadCountAction(accountId?: string) {
  const messages = getMessages(db(), accountId ? { accountId, limit: 500 } : { limit: 500 });
  return getUnreadCount(messages);
}

export async function filterByDateRangeAction(start: string, end: string, accountId?: string) {
  const messages = getMessages(db(), accountId ? { accountId, limit: 500 } : { limit: 500 });
  return filterByDateRange(messages, start, end);
}

// ── Attachment CRUD ──────────────────────────────────────────────────

export async function createAttachmentAction(input: CreateAttachmentInput) {
  return createAttachment(db(), crypto.randomUUID(), input);
}

export async function fetchAttachmentsByMessageAction(messageId: string) {
  return getAttachmentsByMessage(db(), messageId);
}

export async function fetchAttachmentsByDraftAction(draftId: string) {
  return getAttachmentsByDraft(db(), draftId);
}

export async function deleteAttachmentAction(id: string) {
  return deleteAttachment(db(), id);
}

// ── Filter CRUD ──────────────────────────────────────────────────────

export async function createFilterAction(input: {
  accountId: string;
  name: string;
  field: string;
  pattern: string;
  action: string;
  actionValue?: string;
  priority?: number;
}) {
  return createFilter(db(), crypto.randomUUID(), input);
}

export async function fetchFiltersAction(accountId: string) {
  return getFilters(db(), accountId);
}

export async function toggleFilterAction(id: string) {
  return toggleFilter(db(), id);
}

export async function deleteFilterAction(id: string) {
  return deleteFilter(db(), id);
}

export async function countFilterMatchesAction(accountId: string, filterId: string) {
  const adapter = db();
  const messages = getMessages(adapter, { accountId, limit: 500 });
  const filters = getFilters(adapter, accountId);
  const filter = filters.find((f) => f.id === filterId);
  if (!filter) return 0;
  return countMatches(messages, filter);
}

export async function applyFiltersToExistingAction(accountId: string) {
  const adapter = db();
  const messages = getMessages(adapter, { accountId, limit: 500 });
  const filters = getFilters(adapter, accountId);
  const active = filters.filter((f) => f.isActive);
  return messages.map((msg) => applyFilters(msg, active));
}

// ── Contact CRUD ─────────────────────────────────────────────────────

export async function createContactAction(input: CreateMailContactInput) {
  return createContact(db(), crypto.randomUUID(), input);
}

export async function fetchContactByEmailAction(accountId: string, email: string) {
  return getContactByEmail(db(), accountId, email);
}

export async function fetchContactsAction(accountId: string) {
  return getContacts(db(), accountId);
}

export async function searchContactsAction(accountId: string, query: string) {
  return searchContacts(db(), accountId, query);
}

export async function updateContactAction(id: string, input: UpdateMailContactInput) {
  return updateContact(db(), id, input);
}

export async function incrementContactFrequencyAction(accountId: string, email: string) {
  return incrementContactFrequency(db(), accountId, email);
}

export async function toggleContactVipAction(id: string) {
  return toggleContactVip(db(), id);
}

export async function deleteContactAction(id: string) {
  return deleteContact(db(), id);
}

export async function autoCompleteContactsAction(accountId: string, query: string) {
  const contacts = getContacts(db(), accountId);
  return autoComplete(query, contacts, 8);
}

// ── Thread CRUD ──────────────────────────────────────────────────────

export async function createThreadAction(input: CreateMailThreadInput) {
  return createThread(db(), crypto.randomUUID(), input);
}

export async function fetchThreadAction(id: string) {
  return getThread(db(), id);
}

export async function fetchThreadsAction(accountId: string, limit?: number, offset?: number) {
  return getThreads(db(), accountId, limit, offset);
}

export async function fetchAllThreadsAction(limit = 50) {
  const adapter = db();
  const accounts = getAccounts(adapter);
  const allThreads = [];
  for (const a of accounts) {
    allThreads.push(...getThreads(adapter, a.id, 100, 0));
  }
  allThreads.sort((a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime());
  return allThreads.slice(0, limit);
}

export async function fetchMessagesByThreadAction(threadId: string) {
  return getMessagesByThread(db(), threadId);
}

export async function updateThreadMetadataAction(
  threadId: string,
  data: { messageCount: number; unreadCount: number; latestMessageAt: string; participantEmails: string[] },
) {
  return updateThreadMetadata(db(), threadId, data);
}

export async function muteThreadAction(id: string, muted: boolean) {
  return muteThread(db(), id, muted);
}

export async function deleteThreadAction(id: string) {
  return deleteThread(db(), id);
}

// ── Calendar Events ──────────────────────────────────────────────────

export async function createCalendarEventAction(input: CreateCalendarEventInput) {
  return createCalendarEvent(db(), crypto.randomUUID(), input);
}

export async function fetchCalendarEventsByMessageAction(messageId: string) {
  return getCalendarEventsByMessage(db(), messageId);
}

export async function fetchCalendarEventsByAccountAction(accountId: string) {
  return getCalendarEventsByAccount(db(), accountId);
}

export async function updateRsvpStatusAction(eventId: string, status: RSVPStatus) {
  return updateRsvpStatus(db(), eventId, status);
}

// ── Notification Preferences ─────────────────────────────────────────

export async function fetchNotificationPreferencesAction(accountId: string) {
  return getNotificationPreferences(db(), accountId);
}

export async function upsertNotificationPreferencesAction(
  accountId: string,
  input: UpdateNotificationPreferencesInput,
) {
  return upsertNotificationPreferences(db(), crypto.randomUUID(), accountId, input);
}

// ── Encryption Keys ──────────────────────────────────────────────────

export async function createEncryptionKeyAction(input: CreateEncryptionKeyInput) {
  return createEncryptionKey(db(), crypto.randomUUID(), input);
}

export async function fetchEncryptionKeysAction(accountId: string) {
  return getEncryptionKeys(db(), accountId);
}

export async function fetchKeyByFingerprintAction(fingerprint: string) {
  return getKeyByFingerprint(db(), fingerprint);
}

export async function revokeKeyAction(id: string) {
  return revokeKey(db(), id);
}

export async function deleteEncryptionKeyAction(id: string) {
  return deleteEncryptionKey(db(), id);
}

// ── Sync State ───────────────────────────────────────────────────────

export async function upsertSyncStateAction(
  accountId: string,
  folder: string,
  data: { lastUid?: string; uidvalidity?: string; status?: string; errorMessage?: string },
) {
  return upsertSyncState(db(), crypto.randomUUID(), accountId, folder, data);
}

export async function fetchSyncStateAction(accountId: string, folder: string) {
  return getSyncState(db(), accountId, folder);
}

export async function fetchSyncStatesAction(accountId: string) {
  return getSyncStates(db(), accountId);
}

// ── Thread-Level Operations ──────────────────────────────────────────

export async function starLatestInThreadAction(threadId: string) {
  const adapter = db();
  const messages = getMessagesByThread(adapter, threadId);
  if (messages.length === 0) return null;
  const latest = messages[messages.length - 1];
  return toggleStar(adapter, latest.id);
}

export async function trashThreadAction(threadId: string) {
  const adapter = db();
  const messages = getMessagesByThread(adapter, threadId);
  for (const msg of messages) {
    moveToFolder(adapter, msg.id, 'Trash');
  }
  return true;
}

// ── IMAP Config ──────────────────────────────────────────────────────

export async function autoDiscoverConfigAction(email: string) {
  return autoDiscoverConfig(email);
}
