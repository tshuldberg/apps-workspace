import crypto from 'node:crypto';
import {
  type FriendMessage,
  type FriendMessageContentType,
  type FriendMessageOutboxStatus,
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
import { getAdapter } from './db';
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

function resolveMessageEndpoint(): { ok: boolean; url: string | null; reason?: string } {
  const mode = getModeConfig();
  const resolved = resolveApiBaseUrl(mode.mode, mode.serverUrl);
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

export function queueOutgoingFriendMessage(input: QueueFriendMessageInput): FriendMessage {
  const adapter = getAdapter();
  const clientMessageId = input.clientMessageId ?? crypto.randomUUID();

  return queueFriendMessageOutbox(adapter, {
    id: crypto.randomUUID(),
    client_message_id: clientMessageId,
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    content_type: input.contentType ?? 'text/plain',
    content: input.content,
    created_at: toIsoOrNow(input.createdAt),
  });
}

export function listLocalFriendConversation(
  viewerUserId: string,
  friendUserId: string,
  options?: {
    since?: string;
    limit?: number;
  },
): FriendMessage[] {
  const adapter = getAdapter();
  return listFriendConversationMessages(adapter, viewerUserId, friendUserId, options);
}

export function listLocalFriendInbox(viewerUserId: string, limit = 50) {
  return listFriendMessageInbox(getAdapter(), viewerUserId, limit);
}

export async function markFriendMessageReadWithSync(
  viewerUserId: string,
  messageId: string,
): Promise<{
  ok: boolean;
  message: FriendMessage | null;
  remoteSynced: boolean;
  reason?: string;
}> {
  const adapter = getAdapter();
  const updated = markFriendMessageRead(adapter, messageId, viewerUserId);
  if (!updated) {
    return { ok: false, message: null, remoteSynced: false, reason: 'message_not_found' };
  }

  const endpoint = resolveMessageEndpoint();
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
        },
        body: JSON.stringify({ viewerUserId }),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { ok: true, message: updated, remoteSynced: false, reason: `http_${response.status}` };
    }

    const raw = await response.json().catch(() => null);
    const remote = parseRemoteMessage((raw as { message?: unknown })?.message ?? raw);
    if (remote) {
      upsertFriendMessageFromServer(adapter, {
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
      message: getFriendMessageById(adapter, messageId) ?? updated,
      remoteSynced: true,
    };
  } catch {
    return { ok: true, message: updated, remoteSynced: false, reason: 'network_error' };
  }
}

export async function runFriendMessageSyncCycle(
  userId: string,
  options?: {
    outboxLimit?: number;
    inboxFriendLimit?: number;
    perConversationLimit?: number;
    maxAttemptsBeforeFail?: number;
  },
): Promise<FriendMessageSyncSummary> {
  const adapter = getAdapter();
  const endpoint = resolveMessageEndpoint();

  const summary: FriendMessageSyncSummary = {
    ok: false,
    endpoint: endpoint.url,
    reason: endpoint.ok ? undefined : endpoint.reason,
    sent: 0,
    received: 0,
    failed: 0,
    retried: 0,
    fetchErrors: 0,
    outbox: countFriendMessageOutboxByStatus(adapter, userId),
  };

  if (!endpoint.ok || !endpoint.url) {
    return summary;
  }

  const maxAttemptsBeforeFail = options?.maxAttemptsBeforeFail ?? 6;

  const due = listFriendMessageOutboxDue(adapter, userId, {
    limit: options?.outboxLimit ?? 50,
  });

  for (const item of due) {
    try {
      const response = await fetch(`${endpoint.url}/api/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fromUserId: item.from_user_id,
          toUserId: item.to_user_id,
          contentType: item.content_type,
          content: item.content,
          clientMessageId: item.client_message_id,
        }),
        cache: 'no-store',
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const terminal = response.status >= 400 && response.status < 500 && response.status !== 429;

        if (terminal || item.attempts + 1 >= maxAttemptsBeforeFail) {
          markFriendMessageOutboxFailed(
            adapter,
            item.client_message_id,
            detail || `HTTP ${response.status}`,
          );
          summary.failed += 1;
        } else {
          markFriendMessageOutboxRetry(
            adapter,
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
        upsertFriendMessageFromServer(adapter, {
          id: remote.id,
          client_message_id: remote.clientMessageId,
          sender_user_id: remote.fromUserId,
          recipient_user_id: remote.toUserId,
          content_type: remote.contentType,
          content: remote.content,
          created_at: remote.createdAt,
          read_at: remote.readAt,
        });
        markFriendMessageOutboxSent(adapter, item.client_message_id, {
          server_message_id: remote.id,
          created_at: remote.createdAt,
          read_at: remote.readAt,
        });
      } else {
        markFriendMessageOutboxSent(adapter, item.client_message_id);
      }

      summary.sent += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (item.attempts + 1 >= maxAttemptsBeforeFail) {
        markFriendMessageOutboxFailed(adapter, item.client_message_id, detail);
        summary.failed += 1;
      } else {
        markFriendMessageOutboxRetry(
          adapter,
          item.client_message_id,
          computeRetryAt(item.attempts + 1),
          detail,
        );
        summary.retried += 1;
      }
    }
  }

  const friends = listFriendsForUser(adapter, userId).slice(0, options?.inboxFriendLimit ?? 50);

  for (const friend of friends) {
    try {
      const url = new URL('/api/messages', `${endpoint.url}/`);
      url.searchParams.set('viewerUserId', userId);
      url.searchParams.set('friendUserId', friend.friend_user_id);
      url.searchParams.set('limit', String(options?.perConversationLimit ?? 200));

      const since = getLatestFriendMessageCreatedAt(adapter, userId, friend.friend_user_id);
      if (since) {
        url.searchParams.set('since', since);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
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

        upsertFriendMessageFromServer(adapter, {
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

  summary.outbox = countFriendMessageOutboxByStatus(adapter, userId);
  summary.ok = summary.failed === 0 && summary.fetchErrors === 0;
  return summary;
}
