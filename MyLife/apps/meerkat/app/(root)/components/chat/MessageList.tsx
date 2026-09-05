// Plan 30 T1.3: the inverted, virtualized message list.
//
// Opens at the newest message; scrolling up reveals history. buildMessageRows
// (pure, unit-tested) turns the flat item array into message rows + day / new-
// messages dividers; the list renders them inverted so index 0 sits at the
// bottom. maintainVisibleContentPosition stops an incoming message from yanking
// the viewport, and a scroll-to-bottom pill (with a newly-arrived count) appears
// once the user scrolls up past a threshold.
//
// Data-driven, not render-prop: the caller supplies per-item lookups (name,
// avatar, reactions, attachments) and ONE stable handler each for long-press /
// reaction / reply. Those single handlers are threaded to every MessageBubble
// (which carries its own id back), so React.memo on the bubble is actually
// effective (T5.1). Props-only; no provider imports beyond the theme seam.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowDown } from 'lucide-react-native';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from './chat-theme';
import { MessageBubble } from './MessageBubble';
import {
  buildMessageRows,
  type ChatKitMessage,
  type ChatListRow,
  type KitReactionGroup,
  type KitSticker,
} from './chat-kit-core';

// Scrolled-up distance (px) past which we treat the view as detached from the
// bottom and surface the jump-to-latest pill. On an inverted list the content
// offset grows as the user scrolls toward older messages.
const DETACH_THRESHOLD = 300;

// A shared stable empty array so rows without reactions keep a referentially
// stable prop and the memoized bubble does not re-render.
const EMPTY_REACTIONS: readonly KitReactionGroup[] = Object.freeze([]);

// A shared stable empty array so rows without mentions keep a referentially
// stable prop and the memoized bubble does not re-render.
const EMPTY_MENTIONS: readonly string[] = Object.freeze([]);

export interface MessageListProps {
  items: readonly ChatKitMessage[];
  firstUnreadId?: string | null;
  /** Reference time for the day dividers (defaults to Date.now()). */
  now?: number;
  /** Friendly author label from a trusted-local source. */
  getAuthorName: (authorId: string) => string;
  /** Avatar initial; defaults to the first letter of the resolved author name. */
  getAvatarInitial?: (authorId: string) => string;
  /** Optional avatar image (Plan 32 feeds this). */
  getAvatarImageUri?: (authorId: string) => string | null;
  /** Reaction groups for a message id; memoize per id to keep the bubble memoized. */
  getReactions?: (id: string) => readonly KitReactionGroup[];
  /** Feature 12: verified stickers stuck over a message (host-dialed). */
  getStickers?: (id: string) => readonly KitSticker[];
  onPressSticker?: (nodeId: string) => void;
  /** Display names to highlight as @mentions in a message; memoize per id. */
  getMentionNames?: (id: string) => readonly string[];
  /** Attachment cards for a message (they need the blob provider, so caller-owned). */
  renderAttachments?: (item: ChatKitMessage) => React.ReactNode;
  /** ONE stable handler for every row; the bubble passes its own id back. */
  onLongPressMessage: (id: string) => void;
  /** ONE stable handler for every row; the bubble passes its own id + emoji back. */
  onPressReaction: (id: string, emoji: string) => void;
  onPressReply?: (targetId: string) => void;
  /** Fires when the reader attaches to / detaches from the newest message, so the
   *  caller can advance a read cursor only while the latest is actually on screen. */
  onAtBottomChange?: (atBottom: boolean) => void;
  /** Rendered at the top of the scrollback, above the oldest message (e.g. a
   *  partial-history notice). For always-visible banners, the caller should
   *  render a sibling above the list instead. */
  header?: React.ReactNode;
  /** Rendered when there are no messages. */
  empty?: React.ReactNode;
  contentPaddingTop?: number;
}

export function MessageList({
  items,
  firstUnreadId,
  now,
  getAuthorName,
  getAvatarInitial,
  getAvatarImageUri,
  getReactions,
  getStickers,
  onPressSticker,
  getMentionNames,
  renderAttachments,
  onLongPressMessage,
  onPressReaction,
  onPressReply,
  onAtBottomChange,
  header,
  empty,
  contentPaddingTop,
}: MessageListProps) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const listRef = useRef<FlatList<ChatListRow<ChatKitMessage>>>(null);

  const rows = useMemo(
    () => buildMessageRows(items, { firstUnreadId, now }),
    [items, firstUnreadId, now],
  );
  // Inverted list wants newest-first; buildMessageRows is chronological.
  const data = useMemo(() => [...rows].reverse(), [rows]);

  const [detached, setDetached] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(items.length);

  // Count messages that arrived while the user is scrolled away from the bottom,
  // so the pill can say how many are waiting. Resets the moment we reattach.
  useEffect(() => {
    const grew = items.length - prevCountRef.current;
    if (grew > 0 && detached) setNewCount((n) => n + grew);
    prevCountRef.current = items.length;
  }, [items.length, detached]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isDetached = event.nativeEvent.contentOffset.y > DETACH_THRESHOLD;
    setDetached(isDetached);
    if (!isDetached) setNewCount(0);
  }, []);

  // Report attach/detach so the caller can advance a read cursor only when the
  // newest message is actually on screen. Fires once on mount (atBottom = true).
  const onAtBottomChangeRef = useRef(onAtBottomChange);
  onAtBottomChangeRef.current = onAtBottomChange;
  useEffect(() => {
    onAtBottomChangeRef.current?.(!detached);
  }, [detached]);

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setDetached(false);
    setNewCount(0);
  }, []);

  const renderItem = useCallback(
    ({ item: row }: { item: ChatListRow<ChatKitMessage> }) => {
      if (row.type === 'day') {
        return (
          <View style={styles.dayDivider} accessibilityRole="header">
            <View style={styles.dayLine} />
            <Text style={styles.dayLabel}>{row.label}</Text>
            <View style={styles.dayLine} />
          </View>
        );
      }
      if (row.type === 'unread') {
        return (
          <View style={styles.unreadDivider} accessibilityRole="header">
            <View style={styles.unreadLine} />
            <Text style={styles.unreadLabel}>New messages</Text>
            <View style={styles.unreadLine} />
          </View>
        );
      }
      const { item } = row;
      const authorName = getAuthorName(item.authorId);
      const avatarInitial = getAvatarInitial
        ? getAvatarInitial(item.authorId)
        : (authorName.trim().charAt(0).toUpperCase() || '?');
      return (
        <View style={styles.messageRow}>
          <MessageBubble
            item={item}
            isMine={item.isMine}
            isGroupStart={row.isGroupStart}
            isGroupEnd={row.isGroupEnd}
            authorName={authorName}
            avatarInitial={avatarInitial}
            avatarImageUri={getAvatarImageUri?.(item.authorId) ?? null}
            reactions={getReactions?.(item.id) ?? EMPTY_REACTIONS}
            stickers={getStickers?.(item.id)}
            onPressSticker={onPressSticker}
            mentionNames={getMentionNames?.(item.id) ?? EMPTY_MENTIONS}
            onLongPress={onLongPressMessage}
            onPressReaction={onPressReaction}
            onPressReply={onPressReply}
            attachmentSlot={renderAttachments?.(item)}
          />
        </View>
      );
    },
    [
      styles,
      getAuthorName,
      getAvatarInitial,
      getAvatarImageUri,
      getReactions,
      getStickers,
      onPressSticker,
      getMentionNames,
      renderAttachments,
      onLongPressMessage,
      onPressReaction,
      onPressReply,
    ],
  );

  if (data.length === 0 && empty) {
    return <View style={styles.emptyWrap}>{empty}</View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={data}
        inverted
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        initialNumToRender={25}
        windowSize={11}
        contentContainerStyle={[
          styles.content,
          contentPaddingTop != null ? { paddingTop: contentPaddingTop } : null,
        ]}
        // In an inverted list the footer renders at the visual top of the
        // scrollback, above the oldest message: exactly where a top-of-history
        // notice belongs.
        ListFooterComponent={header ? <View style={styles.header}>{header}</View> : null}
      />

      {detached ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            newCount > 0
              ? `Jump to latest. ${newCount} new message${newCount === 1 ? '' : 's'}.`
              : 'Jump to latest messages'
          }
          onPress={jumpToLatest}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          {newCount > 0 ? (
            <Text style={styles.pillCount}>{newCount > 99 ? '99+' : newCount}</Text>
          ) : null}
          <ArrowDown size={16} color={c.onAccent} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  emptyWrap: { flex: 1, padding: 16, justifyContent: 'center' },
  header: { paddingBottom: 8 },
  messageRow: { paddingVertical: 2 },
  dayDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  dayLabel: { color: c.textTertiary, fontSize: 11.5, fontWeight: '700' },
  unreadDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  unreadLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.accent },
  unreadLabel: { color: c.accent, fontSize: 11.5, fontWeight: '800' },
  pill: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 40,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.accent,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pillPressed: { opacity: 0.85 },
  pillCount: { color: c.onAccent, fontSize: 13, fontWeight: '800' },
});
