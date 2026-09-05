// Plan 30 Phase 4 (web twin of the mobile MessageList): the grouped chat stream.
// Builds render rows (day dividers, a "New messages" divider at the first unread,
// per-message group flags) with the SHARED buildMessageRows, renders bubbles, and
// tracks whether the viewport is at the bottom so the caller can gate the
// read-cursor advance. A scroll-to-bottom pill appears when detached. Data is
// local + synchronous (no network fetch) so the honest states are empty/populated.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildMessageRows,
  type KitSticker, type ChatKitMessage, type KitReactionGroup } from '../../lib/chat-kit-core';
import { EmptyState } from '../shell/EmptyState';
import { ChatMessageBubble } from './ChatMessageBubble';

const AT_BOTTOM_THRESHOLD_PX = 60;
const DETACH_PILL_THRESHOLD_PX = 300;

export interface ChatMessageListProps {
  items: ChatKitMessage[];
  firstUnreadId: string | null;
  selfDeviceId: string;
  getAuthorName: (deviceId: string) => string;
  getAvatarInitial: (deviceId: string) => string;
  getReactions: (id: string) => readonly KitReactionGroup[];
  getMentionNames: (id: string) => readonly string[];
  renderAttachments: (item: ChatKitMessage) => ReactNode;
  onReact: (id: string, emoji: string) => void;
  /**
   * Plan 56 feature 5: this community's custom emoji (verified pack items).
   * Selecting one reacts with its pack token; an unresolved sealed image
   * shows its :slug: label.
   */
  packReactions?: ReadonlyArray<{ token: string; label: string; glyph?: string | null; imageUri?: string | null }>;
  getStickers?: (id: string) => readonly KitSticker[];
  onPressSticker?: (nodeId: string) => void;
  stickerChoices?: ReadonlyArray<{ key: string; label: string; glyph?: string | null; imageUri?: string | null }>;
  onStick?: (id: string, key: string) => void;

  onToggleReaction: (id: string, emoji: string) => void;
  onReply: (id: string) => void;
  onCopy: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onScrollToTarget: (targetId: string) => void;
  onAtBottomChange: (atBottom: boolean) => void;
  header?: ReactNode;
  empty?: ReactNode;
  /**
   * True for an archived (read-only) channel: existing content and reactions
   * stay visible, but no react/reply/edit/delete affordance renders (Copy and
   * Report stay; they are device-local, not channel writes).
   */
  readOnly?: boolean;
}

export function ChatMessageList({
  items,
  firstUnreadId,
  selfDeviceId,
  getAuthorName,
  getAvatarInitial,
  getReactions,
  getMentionNames,
  renderAttachments,
  onReact,
  packReactions,
  getStickers,
  onPressSticker,
  stickerChoices,
  onStick,
  onToggleReaction,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onReport,
  onScrollToTarget,
  onAtBottomChange,
  header,
  empty,
  readOnly = false,
}: ChatMessageListProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [detached, setDetached] = useState(false);
  const prevCountRef = useRef(items.length);

  // Forward firstUnreadId so the "New messages" divider row is actually emitted
  // (M1 fix), and memoize so the rows are not rebuilt on every unrelated render.
  const rows = useMemo(() => buildMessageRows(items, { firstUnreadId }), [items, firstUnreadId]);

  const isAtBottom = useCallback((): boolean => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_THRESHOLD_PX;
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    onAtBottomChange(distance <= AT_BOTTOM_THRESHOLD_PX);
    setDetached(distance > DETACH_PILL_THRESHOLD_PX);
  }, [onAtBottomChange]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // On first mount land at the newest message (AC-1). Only-run-once by design.
  useLayoutEffect(() => {
    scrollToBottom('auto');
    onAtBottomChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new arrival while already at the bottom keeps the viewport pinned; while
  // detached it does NOT yank (the pill count reflects new arrivals).
  useEffect(() => {
    const grew = items.length > prevCountRef.current;
    prevCountRef.current = items.length;
    if (grew && isAtBottom()) scrollToBottom('smooth');
  }, [items.length, isAtBottom, scrollToBottom]);

  const scrollToTarget = useCallback((targetId: string) => {
    const el = scrollRef.current?.querySelector(`[data-msg-id="${CSS.escape(targetId)}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('is-flash');
      window.setTimeout(() => el.classList.remove('is-flash'), 1200);
    }
    onScrollToTarget(targetId);
  }, [onScrollToTarget]);

  if (items.length === 0) {
    return (
      <div className="mk-chat-list" ref={scrollRef}>
        {header}
        {empty ?? (
          <EmptyState icon="💬" title="No messages yet">
            Send the first message, or start a post from the Posts tab.
          </EmptyState>
        )}
      </div>
    );
  }

  return (
    <div className="mk-chat-list-wrap">
      <div className="mk-chat-list" ref={scrollRef} onScroll={onScroll}>
        {header}
        {rows.map((row) => {
          if (row.type === 'day') {
            return <div key={row.key} className="mk-chat-day-divider"><span>{row.label}</span></div>;
          }
          if (row.type === 'unread') {
            return <div key={row.key} className="mk-chat-unread-divider"><span>New messages</span></div>;
          }
          const item = row.item;
          const isMine = item.authorId === selfDeviceId;
          return (
            <div key={row.key} data-msg-id={item.id}>
              <ChatMessageBubble
                item={item}
                isMine={isMine}
                isGroupStart={row.isGroupStart}
                isGroupEnd={row.isGroupEnd}
                authorName={getAuthorName(item.authorId)}
                avatarInitial={getAvatarInitial(item.authorId)}
                reactions={getReactions(item.id)}
                mentionNames={getMentionNames(item.id)}
                attachmentSlot={renderAttachments(item)}
                canReact={!readOnly}
                canReply={item.status === 'sent' && !readOnly}
                canCopy={item.body.length > 0}
                canEdit={isMine && item.status === 'sent' && !readOnly}
                canDelete={isMine && item.status === 'sent' && !readOnly}
                canReport={!isMine && item.status === 'sent'}
                onReact={onReact}
                packReactions={packReactions}
                stickers={getStickers?.(item.id)}
                onPressSticker={onPressSticker}
                stickerChoices={stickerChoices}
                onStick={onStick}
                onToggleReaction={onToggleReaction}
                onReply={onReply}
                onCopy={onCopy}
                onEdit={onEdit}
                onDelete={onDelete}
                onReport={onReport}
                onPressReply={scrollToTarget}
              />
            </div>
          );
        })}
      </div>
      {detached ? (
        <button
          type="button"
          className="mk-chat-jump"
          aria-label="Jump to the newest message"
          onClick={() => scrollToBottom('smooth')}
        >
          ↓ Newest
        </button>
      ) : null}
    </div>
  );
}
