'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getBooks,
  getBook,
  createBook,
  getShelves,
  getShelvesForBook,
  addBookToShelf,
  getSessionsForBook,
  getCurrentlyReading,
  getReviewForBook,
  getTagsForBook,
  getGoalProgress,
  getBookCount,
  searchBooks,
  parseGoodreadsCSV,
  parseStoryGraphCSV,
  calculateReadingStats,
  getSessions,
  getReviewsForBook,
  getTimedSessionsForBook,
  createShareEvent,
  getShareEvent,
  listShareEventsVisibleToUser,
  createReaderDocument,
  getReaderDocument,
  getReaderDocuments,
  updateReaderDocumentProgress,
  createReaderNote,
  getReaderNotes,
  deleteReaderNote,
  getReaderPreferences,
  upsertReaderPreferences,
  getSeriesForBook,
  type ShareObjectType,
  type ShareVisibility,
  type BookInsert,
  type ReaderDocumentInsert,
  type ReaderDocumentFilters,
  type ReaderDocumentNoteInsert,
  type ReaderDocumentPreferenceInsert,
  type Shelf,
  type BookFilters,
} from '@mylife/books';
import {
  createFriendInvite,
  getFriendInvite,
  listFriendsForUser,
  listIncomingFriendInvites,
  listOutgoingFriendInvites,
  acceptFriendInvite,
  declineFriendInvite,
  revokeFriendInvite,
  getPreference,
  setPreference,
} from '@mylife/db';
import {
  issueActorIdentityToken,
  verifyActorIdentityToken,
} from '@/lib/actor-identity';
import { callSyncEndpoint } from '@/lib/sync-adapter';
import {
  listLocalFriendConversation,
  listLocalFriendInbox,
  markFriendMessageReadWithSync,
  queueOutgoingFriendMessage,
  runFriendMessageSyncCycle,
} from '@/lib/friend-messages';
import type { FriendMessageContentType } from '@mylife/db';

/** Ensure books module tables exist before any query. */
function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('books');
  return adapter;
}

export async function fetchBooks(filters?: BookFilters) {
  return getBooks(db(), filters);
}

export async function fetchBook(id: string) {
  return getBook(db(), id);
}

export async function fetchShelves() {
  return getShelves(db());
}

export async function fetchShelvesForBook(bookId: string) {
  return getShelvesForBook(db(), bookId);
}

export async function fetchSessionsForBook(bookId: string) {
  return getSessionsForBook(db(), bookId);
}

export async function fetchCurrentlyReading() {
  return getCurrentlyReading(db());
}

export async function fetchReviewForBook(bookId: string) {
  return getReviewForBook(db(), bookId);
}

export async function fetchTagsForBook(bookId: string) {
  return getTagsForBook(db(), bookId);
}

export async function fetchSeriesForBookAction(bookId: string) {
  return getSeriesForBook(db(), bookId);
}

export async function fetchGoalProgress(year: number) {
  return getGoalProgress(db(), year);
}

export async function fetchBookCount() {
  return getBookCount(db());
}

export async function fetchTimedSessionsForBook(bookId: string) {
  return getTimedSessionsForBook(db(), bookId);
}

export async function fetchReadingStats() {
  const adapter = db();
  const sessions = getSessions(adapter);
  const books = getBooks(adapter);
  const reviews = [];
  for (const book of books) {
    reviews.push(...getReviewsForBook(adapter, book.id));
  }
  return calculateReadingStats(sessions, reviews, books);
}

export async function fetchBookStatusCounts() {
  const sessions = getSessions(db());
  const latestStatusByBook = new Map<string, string>();

  for (const session of sessions) {
    if (!latestStatusByBook.has(session.book_id)) {
      latestStatusByBook.set(session.book_id, session.status);
    }
  }

  const counts = {
    reading: 0,
    wantToRead: 0,
    finished: 0,
    dnf: 0,
  };

  for (const status of latestStatusByBook.values()) {
    if (status === 'reading') counts.reading += 1;
    else if (status === 'want_to_read') counts.wantToRead += 1;
    else if (status === 'finished') counts.finished += 1;
    else if (status === 'dnf') counts.dnf += 1;
  }

  return counts;
}

export async function addBookToLibrary(bookData: BookInsert) {
  const adapter = db();
  const id = crypto.randomUUID();
  const book = createBook(adapter, id, bookData);
  // Add to "Want to Read" shelf by default
  const shelves = getShelves(adapter);
  const tbrShelf = shelves.find((s: Shelf) => s.slug === 'want-to-read');
  if (tbrShelf) {
    addBookToShelf(adapter, book.id, tbrShelf.id);
  }
  return book.id;
}

export async function searchOpenLibrary(query: string) {
  return searchBooks(query);
}

export async function importFromCSV(source: 'goodreads' | 'storygraph', csvText: string) {
  const adapter = db();
  const parsed = source === 'goodreads'
    ? parseGoodreadsCSV(csvText)
    : parseStoryGraphCSV(csvText);

  let imported = 0;
  let skipped = parsed.skipped;
  const errors: string[] = [...parsed.errors];

  for (const entry of parsed.books) {
    try {
      createBook(adapter, crypto.randomUUID(), entry.book);
      imported++;
    } catch (err) {
      const title = entry.book.title ?? 'Unknown';
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        skipped++;
      } else {
        errors.push(`Failed to import "${title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { imported, skipped, errors };
}

export async function fetchReaderDocumentsAction(filters?: ReaderDocumentFilters) {
  return getReaderDocuments(db(), filters);
}

export async function fetchReaderDocumentAction(id: string) {
  return getReaderDocument(db(), id);
}

export async function createReaderDocumentAction(input: ReaderDocumentInsert) {
  return createReaderDocument(db(), crypto.randomUUID(), input);
}

export async function updateReaderDocumentProgressAction(input: {
  id: string;
  current_position: number;
  progress_percent: number;
}) {
  updateReaderDocumentProgress(db(), input.id, {
    current_position: input.current_position,
    progress_percent: input.progress_percent,
  });
  return { ok: true };
}

export async function fetchReaderNotesAction(documentId: string) {
  return getReaderNotes(db(), documentId);
}

export async function createReaderNoteAction(input: ReaderDocumentNoteInsert) {
  return createReaderNote(db(), crypto.randomUUID(), input);
}

export async function deleteReaderNoteAction(noteId: string) {
  deleteReaderNote(db(), noteId);
  return { ok: true };
}

export async function fetchReaderPreferencesAction(documentId: string) {
  return getReaderPreferences(db(), documentId);
}

export async function saveReaderPreferencesAction(input: ReaderDocumentPreferenceInsert) {
  return upsertReaderPreferences(db(), input);
}

const SOCIAL_ACTOR_ID_KEY = 'social.actor_user_id';
const SOCIAL_ACTOR_TOKEN_KEY = 'social.actor_token';

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeInvite(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  return {
    id: parseOptionalString(row.id) ?? '',
    from_user_id: parseOptionalString(row.from_user_id) ?? parseOptionalString(row.fromUserId) ?? '',
    to_user_id: parseOptionalString(row.to_user_id) ?? parseOptionalString(row.toUserId) ?? '',
    status: parseOptionalString(row.status) ?? 'pending',
    message: parseOptionalString(row.message) ?? null,
    created_at: parseOptionalString(row.created_at) ?? parseOptionalString(row.createdAt) ?? '',
    updated_at: parseOptionalString(row.updated_at) ?? parseOptionalString(row.updatedAt) ?? '',
    responded_at: parseOptionalString(row.responded_at) ?? parseOptionalString(row.respondedAt) ?? null,
  };
}

function normalizeFriend(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  return {
    user_id: parseOptionalString(row.user_id) ?? parseOptionalString(row.userId) ?? '',
    friend_user_id: parseOptionalString(row.friend_user_id) ?? parseOptionalString(row.friendUserId) ?? '',
    status: parseOptionalString(row.status) ?? 'accepted',
    source_invite_id: parseOptionalString(row.source_invite_id) ?? parseOptionalString(row.sourceInviteId) ?? null,
    created_at: parseOptionalString(row.created_at) ?? parseOptionalString(row.createdAt) ?? '',
    updated_at: parseOptionalString(row.updated_at) ?? parseOptionalString(row.updatedAt) ?? '',
    display_name: parseOptionalString(row.display_name) ?? parseOptionalString(row.displayName) ?? null,
    handle: parseOptionalString(row.handle) ?? null,
    avatar_url: parseOptionalString(row.avatar_url) ?? parseOptionalString(row.avatarUrl) ?? null,
  };
}

function normalizeShareEvent(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const payload = row.payload_json ?? row.payload;
  return {
    id: parseOptionalString(row.id) ?? '',
    actor_user_id: parseOptionalString(row.actor_user_id) ?? parseOptionalString(row.actorUserId) ?? '',
    object_type: parseOptionalString(row.object_type) ?? parseOptionalString(row.objectType) ?? 'generic',
    object_id: parseOptionalString(row.object_id) ?? parseOptionalString(row.objectId) ?? '',
    visibility: parseOptionalString(row.visibility) ?? 'private',
    payload_json: typeof payload === 'string' ? payload : JSON.stringify(parsePayload(payload)),
    created_at: parseOptionalString(row.created_at) ?? parseOptionalString(row.createdAt) ?? '',
    updated_at: parseOptionalString(row.updated_at) ?? parseOptionalString(row.updatedAt) ?? '',
  };
}

function normalizeFriendMessage(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;

  return {
    id: parseOptionalString(row.id) ?? '',
    client_message_id: parseOptionalString(row.client_message_id)
      ?? parseOptionalString(row.clientMessageId)
      ?? '',
    sender_user_id: parseOptionalString(row.sender_user_id)
      ?? parseOptionalString(row.fromUserId)
      ?? '',
    recipient_user_id: parseOptionalString(row.recipient_user_id)
      ?? parseOptionalString(row.toUserId)
      ?? '',
    content_type: (
      parseOptionalString(row.content_type)
      ?? parseOptionalString(row.contentType)
      ?? 'text/plain'
    ) as FriendMessageContentType,
    content: parseOptionalString(row.content) ?? '',
    source: parseOptionalString(row.source) ?? 'local',
    sync_state: parseOptionalString(row.sync_state) ?? parseOptionalString(row.syncState) ?? 'pending',
    server_message_id: parseOptionalString(row.server_message_id) ?? parseOptionalString(row.serverMessageId) ?? null,
    created_at: parseOptionalString(row.created_at) ?? parseOptionalString(row.createdAt) ?? '',
    read_at: parseOptionalString(row.read_at) ?? parseOptionalString(row.readAt) ?? null,
    last_error: parseOptionalString(row.last_error) ?? parseOptionalString(row.lastError) ?? null,
    updated_at: parseOptionalString(row.updated_at) ?? parseOptionalString(row.updatedAt) ?? '',
  };
}

function normalizeFriendInboxItem(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;

  return {
    friend_user_id: parseOptionalString(row.friend_user_id)
      ?? parseOptionalString(row.friendUserId)
      ?? '',
    last_message_at: parseOptionalString(row.last_message_at)
      ?? parseOptionalString(row.lastMessageAt)
      ?? '',
    last_message_content: parseOptionalString(row.last_message_content)
      ?? parseOptionalString(row.lastMessageContent)
      ?? '',
    last_message_content_type: (
      parseOptionalString(row.last_message_content_type)
      ?? parseOptionalString(row.lastMessageContentType)
      ?? 'text/plain'
    ) as FriendMessageContentType,
    unread_count: (() => {
      const rawCount = row.unread_count ?? row.unreadCount ?? 0;
      return typeof rawCount === 'number' ? rawCount : Number(rawCount) || 0;
    })(),
  };
}

function requireActorUserId(actorToken: string): string {
  const verified = verifyActorIdentityToken(actorToken);
  if (!verified.ok || !verified.userId) {
    throw new Error(`Invalid actor identity token (${verified.reason ?? 'unknown'}).`);
  }
  return verified.userId;
}

export async function ensureActorIdentityAction(input?: { userId?: string }) {
  const adapter = db();
  const requestedUserId = parseOptionalString(input?.userId)
    ?? parseOptionalString(getPreference(adapter, SOCIAL_ACTOR_ID_KEY));

  if (!requestedUserId) {
    throw new Error('A userId is required to establish actor identity.');
  }

  const storedToken = parseOptionalString(getPreference(adapter, SOCIAL_ACTOR_TOKEN_KEY));
  if (storedToken) {
    const verified = verifyActorIdentityToken(storedToken);
    if (verified.ok && verified.userId === requestedUserId) {
      return { userId: requestedUserId, actorToken: storedToken };
    }
  }

  const actorToken = issueActorIdentityToken(requestedUserId);
  if (!actorToken) {
    throw new Error('Actor identity secret is not configured.');
  }

  setPreference(adapter, SOCIAL_ACTOR_ID_KEY, requestedUserId);
  setPreference(adapter, SOCIAL_ACTOR_TOKEN_KEY, actorToken);

  return { userId: requestedUserId, actorToken };
}

export async function getStoredActorIdentityAction() {
  const adapter = db();
  const userId = parseOptionalString(getPreference(adapter, SOCIAL_ACTOR_ID_KEY));
  const actorToken = parseOptionalString(getPreference(adapter, SOCIAL_ACTOR_TOKEN_KEY));
  if (!userId || !actorToken) {
    return null;
  }

  const verified = verifyActorIdentityToken(actorToken);
  if (!verified.ok || verified.userId !== userId) {
    return null;
  }

  return { userId, actorToken };
}

export async function createBookShareEventAction(input: {
  actorToken: string;
  objectType: ShareObjectType;
  objectId: string;
  visibility: ShareVisibility;
  payload?: Record<string, unknown>;
}) {
  const adapter = db();
  const actorUserId = requireActorUserId(input.actorToken);
  const id = crypto.randomUUID();

  const raw = await callSyncEndpoint<unknown>({
    path: 'share/events',
    method: 'POST',
    body: {
      id,
      actorToken: input.actorToken,
      actorUserId,
      objectType: input.objectType,
      objectId: input.objectId,
      visibility: input.visibility,
      payload: input.payload ?? {},
    },
    fallback: () => {
      createShareEvent(adapter, id, {
        actor_user_id: actorUserId,
        object_type: input.objectType,
        object_id: input.objectId,
        visibility: input.visibility,
        payload_json: JSON.stringify(input.payload ?? {}),
      });
      return getShareEvent(adapter, id);
    },
  });

  const item = (
    typeof raw === 'object'
    && raw !== null
    && 'item' in (raw as Record<string, unknown>)
  )
    ? (raw as { item: unknown }).item
    : raw;

  return normalizeShareEvent(item);
}

export async function fetchVisibleBookShareEventsAction(input: {
  viewerToken: string;
  actorUserId?: string;
  objectType?: ShareObjectType;
  objectId?: string;
  limit?: number;
  offset?: number;
}) {
  const adapter = db();
  const viewerUserId = requireActorUserId(input.viewerToken);

  const raw = await callSyncEndpoint<unknown>({
    path: 'share/events',
    method: 'GET',
    query: {
      viewerToken: input.viewerToken,
      viewerUserId,
      actorUserId: input.actorUserId,
      objectType: input.objectType,
      objectId: input.objectId,
      limit: input.limit,
      offset: input.offset,
    },
    fallback: () => listShareEventsVisibleToUser(adapter, {
      viewer_user_id: viewerUserId,
      actor_user_id: input.actorUserId,
      object_type: input.objectType,
      object_id: input.objectId,
      limit: input.limit,
      offset: input.offset,
    }),
  });

  const items = Array.isArray(raw)
    ? raw
    : (
      typeof raw === 'object'
      && raw !== null
      && Array.isArray((raw as { items?: unknown[] }).items)
    )
      ? (raw as { items: unknown[] }).items
      : [];

  return items
    .map((item) => normalizeShareEvent(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function sendFriendInviteAction(input: {
  actorToken: string;
  toUserId: string;
  message?: string;
}) {
  const adapter = db();
  const fromUserId = requireActorUserId(input.actorToken);
  const inviteId = crypto.randomUUID();

  const raw = await callSyncEndpoint<unknown>({
    path: 'friends/invites',
    method: 'POST',
    body: {
      id: inviteId,
      actorToken: input.actorToken,
      fromUserId,
      toUserId: input.toUserId,
      message: input.message,
    },
    fallback: () => {
      createFriendInvite(adapter, {
        id: inviteId,
        from_user_id: fromUserId,
        to_user_id: input.toUserId,
        message: input.message,
      });
      return getFriendInvite(adapter, inviteId);
    },
  });

  const invite = (
    typeof raw === 'object'
    && raw !== null
    && 'invite' in (raw as Record<string, unknown>)
  )
    ? (raw as { invite: unknown }).invite
    : raw;

  return normalizeInvite(invite);
}

export async function fetchFriendInvitesAction(input: {
  actorToken: string;
}) {
  const adapter = db();
  const userId = requireActorUserId(input.actorToken);

  const raw = await callSyncEndpoint<unknown>({
    path: 'friends/invites',
    method: 'GET',
    query: {
      actorToken: input.actorToken,
      userId,
      direction: 'both',
      status: 'pending,accepted,declined,revoked',
    },
    fallback: () => ({
      incoming: listIncomingFriendInvites(adapter, userId, ['pending', 'accepted', 'declined', 'revoked']),
      outgoing: listOutgoingFriendInvites(adapter, userId, ['pending', 'accepted', 'declined', 'revoked']),
    }),
  });

  const incoming = (
    typeof raw === 'object'
    && raw !== null
    && Array.isArray((raw as { incoming?: unknown[] }).incoming)
  )
    ? (raw as { incoming: unknown[] }).incoming
    : [];

  const outgoing = (
    typeof raw === 'object'
    && raw !== null
    && Array.isArray((raw as { outgoing?: unknown[] }).outgoing)
  )
    ? (raw as { outgoing: unknown[] }).outgoing
    : [];

  return {
    incoming: incoming.map((item) => normalizeInvite(item)).filter((item): item is NonNullable<typeof item> => item !== null),
    outgoing: outgoing.map((item) => normalizeInvite(item)).filter((item): item is NonNullable<typeof item> => item !== null),
  };
}

export async function acceptFriendInviteAction(inviteId: string, actorToken: string) {
  const adapter = db();
  const actorUserId = requireActorUserId(actorToken);

  const raw = await callSyncEndpoint<unknown>({
    path: `friends/invites/${encodeURIComponent(inviteId)}/accept`,
    method: 'POST',
    body: {
      actorToken,
      actorUserId,
    },
    fallback: () => ({
      ok: acceptFriendInvite(adapter, inviteId, actorUserId),
      invite: getFriendInvite(adapter, inviteId),
    }),
  });

  const ok = Boolean(
    typeof raw === 'object'
    && raw !== null
    && (raw as Record<string, unknown>).ok,
  );
  const invite = (
    typeof raw === 'object'
    && raw !== null
    && 'invite' in (raw as Record<string, unknown>)
  )
    ? normalizeInvite((raw as { invite: unknown }).invite)
    : null;

  return { ok, invite };
}

export async function declineFriendInviteAction(inviteId: string, actorToken: string) {
  const adapter = db();
  const actorUserId = requireActorUserId(actorToken);

  const raw = await callSyncEndpoint<unknown>({
    path: `friends/invites/${encodeURIComponent(inviteId)}/decline`,
    method: 'POST',
    body: {
      actorToken,
      actorUserId,
    },
    fallback: () => ({
      ok: declineFriendInvite(adapter, inviteId, actorUserId),
      invite: getFriendInvite(adapter, inviteId),
    }),
  });

  const ok = Boolean(
    typeof raw === 'object'
    && raw !== null
    && (raw as Record<string, unknown>).ok,
  );
  const invite = (
    typeof raw === 'object'
    && raw !== null
    && 'invite' in (raw as Record<string, unknown>)
  )
    ? normalizeInvite((raw as { invite: unknown }).invite)
    : null;

  return { ok, invite };
}

export async function revokeFriendInviteAction(inviteId: string, actorToken: string) {
  const adapter = db();
  const actorUserId = requireActorUserId(actorToken);

  const raw = await callSyncEndpoint<unknown>({
    path: `friends/invites/${encodeURIComponent(inviteId)}/revoke`,
    method: 'POST',
    body: {
      actorToken,
      actorUserId,
    },
    fallback: () => ({
      ok: revokeFriendInvite(adapter, inviteId, actorUserId),
      invite: getFriendInvite(adapter, inviteId),
    }),
  });

  const ok = Boolean(
    typeof raw === 'object'
    && raw !== null
    && (raw as Record<string, unknown>).ok,
  );
  const invite = (
    typeof raw === 'object'
    && raw !== null
    && 'invite' in (raw as Record<string, unknown>)
  )
    ? normalizeInvite((raw as { invite: unknown }).invite)
    : null;

  return { ok, invite };
}

export async function fetchFriendsAction(actorToken: string) {
  const adapter = db();
  const userId = requireActorUserId(actorToken);

  const raw = await callSyncEndpoint<unknown>({
    path: 'friends',
    method: 'GET',
    query: {
      actorToken,
      userId,
    },
    fallback: () => ({
      userId,
      friends: listFriendsForUser(adapter, userId),
    }),
  });

  const friends = (
    typeof raw === 'object'
    && raw !== null
    && Array.isArray((raw as { friends?: unknown[] }).friends)
  )
    ? (raw as { friends: unknown[] }).friends
    : [];

  return friends
    .map((item) => normalizeFriend(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function queueFriendMessageAction(input: {
  actorToken: string;
  toUserId: string;
  content: string;
  contentType?: FriendMessageContentType;
}) {
  const actorUserId = requireActorUserId(input.actorToken);
  const queued = queueOutgoingFriendMessage({
    fromUserId: actorUserId,
    toUserId: input.toUserId,
    content: input.content,
    contentType: input.contentType,
  });

  return normalizeFriendMessage(queued);
}

export async function syncFriendMessagesAction(input: {
  actorToken: string;
}) {
  const actorUserId = requireActorUserId(input.actorToken);
  return runFriendMessageSyncCycle(actorUserId);
}

export async function fetchFriendMessageConversationAction(input: {
  actorToken: string;
  friendUserId: string;
  since?: string;
  limit?: number;
  syncFirst?: boolean;
}) {
  const actorUserId = requireActorUserId(input.actorToken);

  if (input.syncFirst) {
    await runFriendMessageSyncCycle(actorUserId);
  }

  return listLocalFriendConversation(actorUserId, input.friendUserId, {
    since: input.since,
    limit: input.limit,
  })
    .map((message) => normalizeFriendMessage(message))
    .filter((message): message is NonNullable<typeof message> => message !== null);
}

export async function fetchFriendMessageInboxAction(input: {
  actorToken: string;
  limit?: number;
  syncFirst?: boolean;
}) {
  const actorUserId = requireActorUserId(input.actorToken);

  if (input.syncFirst) {
    await runFriendMessageSyncCycle(actorUserId);
  }

  return listLocalFriendInbox(actorUserId, input.limit ?? 50)
    .map((item) => normalizeFriendInboxItem(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function markFriendMessageReadAction(input: {
  actorToken: string;
  messageId: string;
}) {
  const actorUserId = requireActorUserId(input.actorToken);
  const result = await markFriendMessageReadWithSync(actorUserId, input.messageId);

  return {
    ok: result.ok,
    remoteSynced: result.remoteSynced,
    reason: result.reason,
    message: result.message ? normalizeFriendMessage(result.message) : null,
  };
}
