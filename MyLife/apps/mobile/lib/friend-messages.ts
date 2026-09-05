import type {
  DatabaseAdapter,
  FriendMessage,
  FriendMessageContentType,
  FriendMessageOutboxStatus,
} from '@mylife/db';
import {
  countFriendMessageOutboxByStatus,
  getFriendMessageById,
  getLatestFriendMessageCreatedAt,
  listFriendConversationMessages,
  listFriendMessageInbox,
  listFriendMessageOutboxDue,
  listFriendsForUser,
  markFriendMessageOutboxFailed,
  markFriendMessageOutboxRetry,
  markFriendMessageOutboxSent,
  markFriendMessageRead,
  queueFriendMessageOutbox,
  upsertFriendMessageFromServer,
} from '@mylife/db';
import { getModeConfig } from './entitlements';
import { resolveApiBaseUrl } from './server-endpoint';

export interface QueueFriendMessageInput {
  fromUserId: string;
  toUserId: string;
  content: string;
  contentType?: FriendMessageContentType;
  clientMessageId?: string;
  createdAt?: string;
}

export interface FriendMessageSyncSummary {
  ok: boolean;
  endpoint: string | null;
  reason?: string;
  sent: number;
  received: number;
  failed: number;
  retried: number;
  fetchErrors: number;
  outbox: Record<FriendMessageOutboxStatus, number>;
}

interface ParsedRemoteMessage {
  id: string;
  clientMessageId: string;
  fromUserId: string;
  toUserId: string;
  contentType: FriendMessageContentType;
  content: string;
  createdAt: string;
  readAt: string | null;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function createLocalId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 12)}`;
}

function toIsoOrNow(value?: string): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function computeRetryAt(attempts: number): string {
  const boundedAttempts = Math.max(0, Math.min(attempts, 8));
  const delayMs = Math.min(60 * 60 * 1000, 15_000 * (2 ** boundedAttempts));
  return new Date(Date.now() + delayMs).toISOString();
}

function parseRemoteMessage(raw: unknown): ParsedRemoteMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const id = parseOptionalString(row.id);
  const clientMessageId = parseOptionalString(row.clientMessageId)
    ?? parseOptionalString(row.client_message_id)
    ?? id;
  const fromUserId = parseOptionalString(row.fromUserId)
    ?? parseOptionalString(row.sender_user_id);
  const toUserId = parseOptionalString(row.toUserId)
    ?? parseOptionalString(row.recipient_user_id);
  const content = parseOptionalString(row.content);

  const contentTypeRaw = parseOptionalString(row.contentType)
    ?? parseOptionalString(row.content_type)
    ?? 'text/plain';
  const contentType: FriendMessageContentType = contentTypeRaw === 'application/e2ee+ciphertext'
    ? 'application/e2ee+ciphertext'
    : 'text/plain';

  const createdAtRaw = parseOptionalString(row.createdAt)
    ?? parseOptionalString(row.created_at)
    ?? new Date().toISOString();
  const createdAt = toIsoOrNow(createdAtRaw);

  const readAtRaw = parseOptionalString(row.readAt) ?? parseOptionalString(row.read_at);
  const readAt = readAtRaw ? toIsoOrNow(readAtRaw) : null;

  if (!id || !clientMessageId || !fromUserId || !toUserId || !content) {
    return null;
  }

  return {
    id,
    clientMessageId,
    fromUserId,
    toUserId,
    contentType,
    content,
    createdAt,
    readAt,
  };
}

function resolveMessageEndpoint(db: DatabaseAdapter): { ok: boolean; url: string | null; reason?: string } {
  const modeConfig = getModeConfig(db);
  const resolved = resolveApiBaseUrl(modeConfig.mode, modeConfig.serverUrl);
  if (!resolved.ok || !resolved.url) {
    return {
      ok: false,
      url: null,
      reason: resolved.reason,
    };
  }

  return {
    ok: true,
    url: resolved.url,
  };
}

export function queueOutgoingFriendMessage(
  db: DatabaseAdapter,
  input: QueueFriendMessageInput,
): FriendMessage {
  const clientMessageId = input.clientMessageId ?? createLocalId();

  return queueFriendMessageOutbox(db, {
    id: createLocalId(),
    client_message_id: clientMessageId,
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    content_type: input.contentType ?? 'text/plain',
    content: input.content,
    created_at: toIsoOrNow(input.createdAt),
  });
}

export function listLocalFriendConversation(
  db: DatabaseAdapter,
  viewerUserId: string,
  friendUserId: string,
  options?: {
    since?: string;
    limit?: number;
  },
): FriendMessage[] {
  return listFriendConversationMessages(db, viewerUserId, friendUserId, options);
}

export function listLocalFriendInbox(
  db: DatabaseAdapter,
  viewerUserId: string,
  limit = 50,
) {
  return listFriendMessageInbox(db, viewerUserId, limit);
}

export async function markFriendMessageReadWithSync(
  db: DatabaseAdapter,
  viewerUserId: string,
  messageId: string,
  actorToken?: string,
): Promise<{
  ok: boolean;
  message: FriendMessage | null;
  remoteSynced: boolean;
  reason?: string;
}> {
  const updated = markFriendMessageRead(db, messageId, viewerUserId);
  if (!updated) {
    return { ok: false, message: null, remoteSynced: false, reason: 'message_not_found' };
  }

  const endpoint = resolveMessageEndpoint(db);
  if (!endpoint.ok || !endpoint.url || !updated.server_message_id) {
    return {
      ok: true,
      message: updated,
      remoteSynced: false,
      reason: !updated.server_message_id ? 'missing_server_message_id' : endpoint.reason,
    };
  }

  try {
    const response = await fetch(
      `${endpoint.url}/api/messages/${encodeURIComponent(updated.server_message_id)}/read`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(actorToken ? { 'x-actor-identity-token': actorToken } : {}),
        },
        body: JSON.stringify({
          viewerUserId,
          ...(actorToken ? { actorToken } : {}),
        }),
      },
    );

    if (!response.ok) {
      return { ok: true, message: updated, remoteSynced: false, reason: `http_${response.status}` };
    }

    const raw = await response.json().catch(() => null);
    const remote = parseRemoteMessage((raw as { message?: unknown })?.message ?? raw);
    if (remote) {
      upsertFriendMessageFromServer(db, {
        id: remote.id,
        client_message_id: remote.clientMessageId,
        sender_user_id: remote.fromUserId,
        recipient_user_id: remote.toUserId,
        content_type: remote.contentType,
        content: remote.content,
        created_at: remote.createdAt,
        read_at: remote.readAt,
      });
    }

    return {
      ok: true,
      message: getFriendMessageById(db, messageId) ?? updated,
      remoteSynced: true,
    };
  } catch {
    return { ok: true, message: updated, remoteSynced: false, reason: 'network_error' };
  }
}

export async function runFriendMessageSyncCycle(
  db: DatabaseAdapter,
  userId: string,
  options?: {
    actorToken?: string;
    outboxLimit?: number;
    inboxFriendLimit?: number;
    perConversationLimit?: number;
    maxAttemptsBeforeFail?: number;
  },
): Promise<FriendMessageSyncSummary> {
  const endpoint = resolveMessageEndpoint(db);

  const summary: FriendMessageSyncSummary = {
    ok: false,
    endpoint: endpoint.url,
    reason: endpoint.ok ? undefined : endpoint.reason,
    sent: 0,
    received: 0,
    failed: 0,
    retried: 0,
    fetchErrors: 0,
    outbox: countFriendMessageOutboxByStatus(db, userId),
  };

  if (!endpoint.ok || !endpoint.url) {
    return summary;
  }

  const maxAttemptsBeforeFail = options?.maxAttemptsBeforeFail ?? 6;

  const due = listFriendMessageOutboxDue(db, userId, {
    limit: options?.outboxLimit ?? 50,
  });

  for (const item of due) {
    try {
      const response = await fetch(`${endpoint.url}/api/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(options?.actorToken ? { 'x-actor-identity-token': options.actorToken } : {}),
        },
        body: JSON.stringify({
          fromUserId: item.from_user_id,
          toUserId: item.to_user_id,
          contentType: item.content_type,
          content: item.content,
          clientMessageId: item.client_message_id,
          ...(options?.actorToken ? { actorToken: options.actorToken } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const terminal = response.status >= 400 && response.status < 500 && response.status !== 429;

        if (terminal || item.attempts + 1 >= maxAttemptsBeforeFail) {
          markFriendMessageOutboxFailed(
            db,
            item.client_message_id,
            detail || `HTTP ${response.status}`,
          );
          summary.failed += 1;
        } else {
          markFriendMessageOutboxRetry(
            db,
            item.client_message_id,
            computeRetryAt(item.attempts + 1),
            detail || `HTTP ${response.status}`,
          );
          summary.retried += 1;
        }
        continue;
      }

      const body = await response.json().catch(() => null);
      const remote = parseRemoteMessage(body);

      if (remote) {
        upsertFriendMessageFromServer(db, {
          id: remote.id,
          client_message_id: remote.clientMessageId,
          sender_user_id: remote.fromUserId,
          recipient_user_id: remote.toUserId,
          content_type: remote.contentType,
          content: remote.content,
          created_at: remote.createdAt,
          read_at: remote.readAt,
        });
        markFriendMessageOutboxSent(db, item.client_message_id, {
          server_message_id: remote.id,
          created_at: remote.createdAt,
          read_at: remote.readAt,
        });
      } else {
        markFriendMessageOutboxSent(db, item.client_message_id);
      }

      summary.sent += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (item.attempts + 1 >= maxAttemptsBeforeFail) {
        markFriendMessageOutboxFailed(db, item.client_message_id, detail);
        summary.failed += 1;
      } else {
        markFriendMessageOutboxRetry(
          db,
          item.client_message_id,
          computeRetryAt(item.attempts + 1),
          detail,
        );
        summary.retried += 1;
      }
    }
  }

  const friends = listFriendsForUser(db, userId).slice(0, options?.inboxFriendLimit ?? 50);

  for (const friend of friends) {
    try {
      const url = new URL('/api/messages', `${endpoint.url}/`);
      url.searchParams.set('viewerUserId', userId);
      url.searchParams.set('friendUserId', friend.friend_user_id);
      url.searchParams.set('limit', String(options?.perConversationLimit ?? 200));
      if (options?.actorToken) {
        url.searchParams.set('actorToken', options.actorToken);
      }

      const since = getLatestFriendMessageCreatedAt(db, userId, friend.friend_user_id);
      if (since) {
        url.searchParams.set('since', since);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: options?.actorToken
          ? {
              'x-actor-identity-token': options.actorToken,
            }
          : undefined,
      });

      if (!response.ok) {
        summary.fetchErrors += 1;
        continue;
      }

      const body = await response.json().catch(() => null);
      const items = Array.isArray((body as { items?: unknown[] })?.items)
        ? (body as { items: unknown[] }).items
        : [];

      for (const item of items) {
        const remote = parseRemoteMessage(item);
        if (!remote) continue;

        upsertFriendMessageFromServer(db, {
          id: remote.id,
          client_message_id: remote.clientMessageId,
          sender_user_id: remote.fromUserId,
          recipient_user_id: remote.toUserId,
          content_type: remote.contentType,
          content: remote.content,
          created_at: remote.createdAt,
          read_at: remote.readAt,
        });
        summary.received += 1;
      }
    } catch {
      summary.fetchErrors += 1;
    }
  }

  summary.outbox = countFriendMessageOutboxByStatus(db, userId);
  summary.ok = summary.failed === 0 && summary.fetchErrors === 0;
  return summary;
}
