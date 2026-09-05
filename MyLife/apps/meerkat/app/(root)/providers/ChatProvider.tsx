import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import {
  createChannelMessage,
  createChannelMessageV2,
  bytesToHex,
  generateSyncRandomBytes,
  nextHlc,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
  type Hlc,
} from '@mylife/sync';
import { useMeerkatDatabase } from './DatabaseProvider';
import { useIdentity } from './IdentityProvider';
import { useSync } from './SyncProvider';
import {
  CM_MESSAGE_ATTACHMENTS_TABLE,
  CM_MESSAGES_TABLE,
  CM_POSTS_TABLE,
  CM_READ_STATE_TABLE,
  channelMessageRowFromEvent,
  countUnreadChannelMessages,
  createChannelPostEvent,
  createChannelPostReplyEvent,
  destroyChannelMessageKeys,
  getChannelMessageEventById,
  highestHlc,
  insertMessageAttachmentRows,
  insertMessageRow,
  insertPostHeaderRow,
  listActiveOwnReactionEventIds,
  listChannelMessages,
  markChannelRead,
  isChannelPostEvent,
} from '../data/community-core';
import {
  fetchAndImportChannelHistory,
  replicateImportedHistoryEvents,
  type ChannelHistoryImportResult,
} from '../data/channel-history-import';
import {
  INITIAL_CHAT_STATE,
  chatReducer,
  selectFailedMessages,
  selectPendingMessages,
  type ChatState,
  type MessageStatus,
  type PendingChatMessage,
} from '../data/chat-state';
import {
  buildEditedChannelMessage,
  buildOutgoingChannelMessage,
  buildReactionEvent,
  buildUnreactionEvent,
  type SendMessageOpts,
} from '../data/chat-compose';

export type ChannelChatItem =
  | { kind: 'event'; status: 'sent'; event: ChannelMessageEvent }
  | { kind: 'local'; status: Exclude<MessageStatus, 'sent'>; message: PendingChatMessage };

export type SendChannelMessageResult =
  | { ok: true; event: ChannelMessageEvent }
  | { ok: false; error: string };

export type MutateChannelMessageResult =
  | { ok: true; event: ChannelMessageEvent; redactedIds: string[] }
  | { ok: false; error: string };

export interface ReactionTarget {
  eventId: string;
  postId?: string;
}

interface ChatContextValue {
  state: ChatState;
  sendMessage: (
    communityId: string,
    channelId: string,
    body: string,
    attachments?: ChannelMessageAttachment[],
    opts?: SendMessageOpts,
  ) => SendChannelMessageResult;
  sendReaction: (
    communityId: string,
    channelId: string,
    target: ReactionTarget,
    emoji: string,
  ) => SendChannelMessageResult;
  removeReaction: (
    communityId: string,
    channelId: string,
    myEventId: string,
  ) => SendChannelMessageResult;
  sendPost: (communityId: string, channelId: string, body: string) => SendChannelMessageResult;
  replyToPost: (parent: ChannelMessageEvent, body: string) => SendChannelMessageResult;
  editMessage: (event: ChannelMessageEvent, body: string) => MutateChannelMessageResult;
  deleteMessage: (event: ChannelMessageEvent) => MutateChannelMessageResult;
  importHistory: (
    communityId: string,
    channelId: string,
    manifestJson: string,
    hosts?: readonly string[],
    expectedCatalogCid?: string | null,
  ) => Promise<ChannelHistoryImportResult>;
  markRead: (communityId: string, channelId: string, lastRead: Hlc, lastReadAuthor: string) => void;
  refresh: () => void;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function makeClientId(): string {
  return `cm_${Date.now().toString(36)}_${bytesToHex(generateSyncRandomBytes(6))}`;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { recordLocalChange, queueChannelMessageMailbox } = useSync();
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);

  const recordMessageEvent = useCallback(
    (event: ChannelMessageEvent, options: { postHeader?: boolean } = {}): void => {
      const row = insertMessageRow(db, event);
      const attachmentRows = insertMessageAttachmentRows(db, event);
      recordLocalChange(CM_MESSAGES_TABLE, 'INSERT', event.id, {
        ...channelMessageRowFromEvent(event),
        ...row,
      });
      for (const attachmentRow of attachmentRows) {
        recordLocalChange(CM_MESSAGE_ATTACHMENTS_TABLE, 'INSERT', attachmentRow.id, {
          ...attachmentRow,
        });
      }
      if (options.postHeader) {
        const postHeader = insertPostHeaderRow(db, event);
        recordLocalChange(CM_POSTS_TABLE, 'INSERT', postHeader.id, {
          ...postHeader,
        });
      }
    },
    [db, recordLocalChange],
  );

  const sendMessage = useCallback(
    (
      communityId: string,
      channelId: string,
      body: string,
      attachments: ChannelMessageAttachment[] = [],
      opts?: SendMessageOpts,
    ): SendChannelMessageResult => {
      const trimmed = body.trim();
      if (!trimmed && attachments.length === 0) {
        return { ok: false, error: 'Write a message or attach a file first.' };
      }

      const clientId = makeClientId();
      const createdAt = new Date().toISOString();
      dispatch({
        type: 'compose',
        message: { clientId, communityId, channelId, body: trimmed, attachments, createdAt },
      });

      try {
        const event = buildOutgoingChannelMessage(identity, {
          communityId,
          channelId,
          body: trimmed,
          attachments,
          hlc: nextHlc(highestHlc(db, communityId, channelId), createdAt),
          opts,
        });
        recordMessageEvent(event);
        void queueChannelMessageMailbox(event).catch(() => undefined);
        dispatch({ type: 'reconcile', clientId });
        return { ok: true, event };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'fail', clientId, error: message });
        return { ok: false, error: message };
      }
    },
    [db, identity, recordMessageEvent, queueChannelMessageMailbox],
  );

  const sendReaction = useCallback(
    (
      communityId: string,
      channelId: string,
      target: ReactionTarget,
      emoji: string,
    ): SendChannelMessageResult => {
      // Idempotent (Finding 3): if this device already holds this emoji on the
      // target, do not author a duplicate. A rapid double-tap thus never stacks
      // two active reacts (which would leave a sticky chip after one un-tap).
      const existing = listActiveOwnReactionEventIds(
        db, communityId, channelId, identity.publicKey, target.eventId, emoji,
      );
      if (existing.length > 0) {
        const existingEvent = getChannelMessageEventById(db, existing[0]!);
        if (existingEvent) return { ok: true, event: existingEvent };
      }

      try {
        const now = new Date().toISOString();
        const event = buildReactionEvent(identity, {
          communityId,
          channelId,
          targetEventId: target.eventId,
          targetPostId: target.postId,
          emoji,
          hlc: nextHlc(highestHlc(db, communityId, channelId), now),
        });
        // A reaction is NOT a chat bubble: it rides a revision bump (like sendPost)
        // so the open channel re-reads listChannelReactions, never a fake pending
        // bubble. The local echo is the real recorded cm_messages row.
        recordMessageEvent(event);
        void queueChannelMessageMailbox(event).catch(() => undefined);
        dispatch({ type: 'refresh' });
        return { ok: true, event };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'setError', error: message });
        return { ok: false, error: message };
      }
    },
    [db, identity, recordMessageEvent, queueChannelMessageMailbox],
  );

  const removeReaction = useCallback(
    (
      communityId: string,
      channelId: string,
      myEventId: string,
    ): SendChannelMessageResult => {
      const original = getChannelMessageEventById(db, myEventId);
      if (!original || original.intent !== 'react' || !original.parentId) {
        const error = 'That reaction is no longer available.';
        dispatch({ type: 'setError', error });
        return { ok: false, error };
      }
      if (original.authorDeviceId !== identity.publicKey) {
        const error = 'Only your own reaction can be removed.';
        dispatch({ type: 'setError', error });
        return { ok: false, error };
      }

      // Un-react is TOTAL (Finding 3): tombstone EVERY active react this device
      // holds for the (target, emoji) pair, so an un-tap always leaves zero active
      // reacts even if a duplicate ever slipped through. Already-removed = no-op.
      const targets = listActiveOwnReactionEventIds(
        db, communityId, channelId, identity.publicKey, original.parentId, original.body,
      );
      if (targets.length === 0) return { ok: true, event: original };

      try {
        let last = original;
        for (const reactionEventId of targets) {
          const event = buildUnreactionEvent(identity, {
            communityId,
            channelId,
            parentId: original.parentId,
            postId: original.postId,
            reactionEventId,
            hlc: nextHlc(highestHlc(db, communityId, channelId), new Date().toISOString()),
          });
          recordMessageEvent(event);
          void queueChannelMessageMailbox(event).catch(() => undefined);
          last = event;
        }
        dispatch({ type: 'refresh' });
        return { ok: true, event: last };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'setError', error: message });
        return { ok: false, error: message };
      }
    },
    [db, identity, recordMessageEvent, queueChannelMessageMailbox],
  );

  const sendPost = useCallback(
    (
      communityId: string,
      channelId: string,
      body: string,
    ): SendChannelMessageResult => {
      const trimmed = body.trim();
      if (!trimmed) return { ok: false, error: 'Write a post first.' };

      try {
        const now = new Date().toISOString();
        const event = createChannelPostEvent(identity, {
          communityId,
          channelId,
          body: trimmed,
          hlc: nextHlc(highestHlc(db, communityId, channelId), now),
        });
        recordMessageEvent(event, { postHeader: true });
        void queueChannelMessageMailbox(event).catch(() => undefined);
        dispatch({ type: 'refresh' });
        return { ok: true, event };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'setError', error: message });
        return { ok: false, error: message };
      }
    },
    [db, identity, recordMessageEvent, queueChannelMessageMailbox],
  );

  const replyToPost = useCallback(
    (parent: ChannelMessageEvent, body: string): SendChannelMessageResult => {
      const trimmed = body.trim();
      if (!trimmed) return { ok: false, error: 'Write a reply first.' };

      try {
        const now = new Date().toISOString();
        const event = createChannelPostReplyEvent(identity, {
          parent,
          body: trimmed,
          hlc: nextHlc(highestHlc(db, parent.communityId, parent.channelId), now),
        });
        recordMessageEvent(event);
        void queueChannelMessageMailbox(event).catch(() => undefined);
        dispatch({ type: 'refresh' });
        return { ok: true, event };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'setError', error: message });
        return { ok: false, error: message };
      }
    },
    [db, identity, recordMessageEvent, queueChannelMessageMailbox],
  );

  const editMessage = useCallback(
    (event: ChannelMessageEvent, body: string): MutateChannelMessageResult => {
      const trimmed = body.trim();
      if (!trimmed) return { ok: false, error: 'Write a message first.' };
      if (event.authorDeviceId !== identity.publicKey) {
        const error = 'Only the author device can edit this message.';
        dispatch({ type: 'setError', error });
        return { ok: false, error };
      }

      try {
        const now = new Date().toISOString();
        // Rebuild through the pure builder so an edit preserves the original
        // event's version and ALL v2 fields (parentId/mentions/etc). Gating on
        // version, not postId, keeps a chat reply linked + its mentions signed.
        const edited = buildEditedChannelMessage(identity, {
          event,
          body: trimmed,
          hlc: nextHlc(highestHlc(db, event.communityId, event.channelId), now),
        });
        recordMessageEvent(edited);
        void queueChannelMessageMailbox(edited).catch(() => undefined);
        dispatch({ type: 'refresh' });
        return { ok: true, event: edited, redactedIds: [] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'setError', error: message });
        return { ok: false, error: message };
      }
    },
    [db, identity, recordMessageEvent, queueChannelMessageMailbox],
  );

  const deleteMessage = useCallback(
    (event: ChannelMessageEvent): MutateChannelMessageResult => {
      if (event.authorDeviceId !== identity.publicKey) {
        const error = 'Only the author device can delete this message.';
        dispatch({ type: 'setError', error });
        return { ok: false, error };
      }

      try {
        const now = new Date().toISOString();
        const base = {
          communityId: event.communityId,
          channelId: event.channelId,
          body: '',
          hlc: nextHlc(highestHlc(db, event.communityId, event.channelId), now),
          supersedes: { id: event.id, deleted: true },
        };
        const deleted = isChannelPostEvent(event)
          ? createChannelMessageV2(identity, {
            ...base,
            postId: event.postId,
            parentId: event.parentId,
            branchId: event.branchId,
            authorKind: event.authorKind ?? 'human',
            mentions: event.mentions,
            intent: event.intent ?? 'message',
          })
          : createChannelMessage(identity, base);
        recordMessageEvent(deleted);
        void queueChannelMessageMailbox(deleted).catch(() => undefined);
        const redactedIds = destroyChannelMessageKeys(db, event.communityId, event.channelId, event.id);
        dispatch({ type: 'refresh' });
        return { ok: true, event: deleted, redactedIds };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'setError', error: message });
        return { ok: false, error: message };
      }
    },
    [db, identity, recordMessageEvent, queueChannelMessageMailbox],
  );

  const importHistory = useCallback(
    async (
      communityId: string,
      channelId: string,
      manifestJson: string,
      hosts?: readonly string[],
      expectedCatalogCid?: string | null,
    ): Promise<ChannelHistoryImportResult> => {
      const result = await fetchAndImportChannelHistory({
        db,
        identity,
        communityId,
        channelId,
        manifestJson,
        hosts,
        expectedCatalogCid,
      });
      if (!result.ok) return result;

      // Replicate ONLY merge-inserted events (importedEvents excludes
      // dropped-removed events, Plan 28 membership cut).
      replicateImportedHistoryEvents(recordLocalChange, result.importedEvents);
      if (result.inserted > 0) dispatch({ type: 'refresh' });
      return result;
    },
    [db, identity, recordLocalChange],
  );

  const markRead = useCallback(
    (communityId: string, channelId: string, lastRead: Hlc, lastReadAuthor: string): void => {
      const result = markChannelRead(db, communityId, channelId, lastRead, lastReadAuthor);
      if (!result.changed || !result.row || !result.operation) return;
      recordLocalChange(CM_READ_STATE_TABLE, result.operation, result.row.id, { ...result.row });
      dispatch({ type: 'refresh' });
    },
    [db, recordLocalChange],
  );

  const refresh = useCallback(() => dispatch({ type: 'refresh' }), []);
  const clearError = useCallback(() => dispatch({ type: 'clearError' }), []);

  const value = useMemo<ChatContextValue>(
    () => ({
      state,
      sendMessage,
      sendReaction,
      removeReaction,
      sendPost,
      replyToPost,
      editMessage,
      deleteMessage,
      importHistory,
      markRead,
      refresh,
      clearError,
    }),
    [
      state,
      sendMessage,
      sendReaction,
      removeReaction,
      sendPost,
      replyToPost,
      editMessage,
      deleteMessage,
      importHistory,
      markRead,
      refresh,
      clearError,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChannel must be used within ChatProvider');
  return ctx;
}

export function useChatActions(): ChatContextValue {
  return useChatContext();
}

export function useChannel(communityId: string, channelId: string) {
  const db = useMeerkatDatabase();
  const {
    state,
    sendMessage,
    sendReaction,
    removeReaction,
    sendPost,
    replyToPost,
    editMessage,
    deleteMessage,
    importHistory,
    markRead,
    refresh,
    clearError,
  } = useChatContext();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ChannelMessageEvent[]>([]);

  // Plan 30 Phase 3 (read-cursor policy): reload NO LONGER eager-marks-read. The
  // channel screen owns mark-read (on focus + when at the bottom + when the live
  // loop applies while at the bottom), so messages arriving while the reader is
  // scrolled up stay unread and the "New messages" divider can anchor at the last
  // visit. `markReadLatest` is the screen's explicit advance.
  const reload = useCallback(() => {
    const nextEvents = listChannelMessages(db, communityId, channelId);
    setEvents(nextEvents);
    setLoading(false);
  }, [db, communityId, channelId]);

  useEffect(() => {
    reload();
  }, [reload, state.revision]);

  const pending = selectPendingMessages(state, communityId, channelId);
  const failed = selectFailedMessages(state, communityId, channelId);
  const messages = useMemo<ChannelChatItem[]>(
    () => [
      ...events.map((event) => ({ kind: 'event' as const, status: 'sent' as const, event })),
      ...pending.map((message) => ({ kind: 'local' as const, status: 'sending' as const, message })),
      ...failed.map((message) => ({ kind: 'local' as const, status: 'failed' as const, message })),
    ],
    [events, pending, failed],
  );

  return {
    loading,
    messages,
    busy: pending.length > 0,
    error: state.lastError,
    partialHistory: true,
    unreadCount: countUnreadChannelMessages(db, communityId, channelId),
    send: (
      body: string,
      attachments?: ChannelMessageAttachment[],
      opts?: SendMessageOpts,
    ) => sendMessage(communityId, channelId, body, attachments, opts),
    react: (target: ReactionTarget, emoji: string) => (
      sendReaction(communityId, channelId, target, emoji)
    ),
    removeReaction: (myEventId: string) => (
      removeReaction(communityId, channelId, myEventId)
    ),
    post: (body: string) => sendPost(communityId, channelId, body),
    replyToPost,
    edit: editMessage,
    delete: deleteMessage,
    /** Advance the read cursor to the newest recorded event (screen-owned policy). */
    markReadLatest: () => {
      const lastEvent = events[events.length - 1];
      if (lastEvent) markRead(communityId, channelId, lastEvent.hlc, lastEvent.authorDeviceId);
    },
    importHistory: (
      manifestJson: string,
      hosts?: readonly string[],
      expectedCatalogCid?: string | null,
    ) => importHistory(communityId, channelId, manifestJson, hosts, expectedCatalogCid),
    refresh,
    clearError,
  };
}
