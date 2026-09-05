// Plan 30 Phase 4 (web twin of the mobile MessageBubble + MessageActionsSheet):
// one grouped chat bubble. Own messages right-aligned in accent; others left in a
// surface bubble. The mobile long-press becomes a HOVER toolbar (quick reactions +
// a "+" full picker, Reply) plus a RIGHT-CLICK context menu (Reply, Copy, and
// role-aware Edit/Delete for mine or Report for others). Reaction chips sit under
// the bubble and toggle via the same react/removeReaction path. A reply quote and
// @mention highlight are display sugar; no delivery/read/online claim is rendered.

import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { bubbleRadiusForShape } from '@mylife/meerkat-theme';
import {
  formatClockTime,
  type KitSticker,
  segmentBodyMentions,
  type ChatKitMessage,
  type KitReactionGroup,
} from '../../lib/chat-kit-core';
import { QUICK_REACTIONS } from './emoji-data';
import { EmojiPicker } from './EmojiPicker';

export interface ChatMessageBubbleProps {
  item: ChatKitMessage;
  isMine: boolean;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  authorName: string;
  avatarInitial: string;
  reactions: readonly KitReactionGroup[];
  /** Display names to highlight as @mentions (display sugar only). */
  mentionNames?: readonly string[];
  /** Attachment cards, rendered by the caller (they need the provider). */
  attachmentSlot?: React.ReactNode;
  /** False for an archived (read-only) channel: no react/stick affordances render. */
  canReact: boolean;
  canReply: boolean;
  canCopy: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
  onReact: (id: string, emoji: string) => void;
  /**
   * Plan 56 feature 5: this community's custom emoji (verified pack items).
   * Selecting one reacts with its pack token; an unresolved sealed image
   * shows its :slug: label.
   */
  packReactions?: ReadonlyArray<{ token: string; label: string; glyph?: string | null; imageUri?: string | null }>;
  /** Feature 12: verified, receiver-dialed stickers stuck over this message. */
  stickers?: readonly KitSticker[];
  onPressSticker?: (nodeId: string) => void;
  /** Feature 12: sticker choices; selecting one STICKS it (a signed canvas node). */
  stickerChoices?: ReadonlyArray<{ key: string; label: string; glyph?: string | null; imageUri?: string | null }>;
  onStick?: (id: string, key: string) => void;

  onToggleReaction: (id: string, emoji: string) => void;
  onReply: (id: string) => void;
  onCopy: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onPressReply?: (targetId: string) => void;
}

function ChatMessageBubbleImpl({
  item,
  isMine,
  isGroupStart,
  isGroupEnd,
  authorName,
  avatarInitial,
  reactions,
  mentionNames,
  attachmentSlot,
  canReact,
  canReply,
  canCopy,
  canEdit,
  canDelete,
  canReport,
  onReact,
  packReactions,
  stickers,
  onPressSticker,
  stickerChoices,
  onStick,
  onToggleReaction,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onReport,
  onPressReply,
}: ChatMessageBubbleProps) {
  const pending = item.status === 'sending';
  const failed = item.status === 'failed';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const bodyMentions = mentionNames && mentionNames.length > 0;

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: globalThis.MouseEvent): void => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, closeMenu]);

  const onContextMenu = useCallback((e: MouseEvent): void => {
    // Only override the native menu when at least one action is available.
    if (!(canReply || canCopy || canEdit || canDelete || canReport)) return;
    e.preventDefault();
    setMenuOpen(true);
  }, [canReply, canCopy, canEdit, canDelete, canReport]);

  const run = (fn: (id: string) => void) => (): void => {
    closeMenu();
    fn(item.id);
  };

  const meta = (
    failed
      ? (item.errorText ?? 'Not sent')
      : pending
        ? 'Sending'
        : isGroupEnd
          ? `${formatClockTime(item.wall)}${item.edited ? ' · Edited' : ''}`
          : item.edited ? 'Edited' : ''
  );

  return (
    <div
      ref={rowRef}
      className={`mk-chat-row ${isMine ? 'is-mine' : 'is-other'}`}
      onContextMenu={onContextMenu}
    >
      {!isMine ? (
        <div className="mk-chat-avatar-col">
          {isGroupStart ? <div className="mk-chat-avatar" aria-hidden>{avatarInitial}</div> : null}
        </div>
      ) : null}

      <div className={`mk-chat-col ${isMine ? 'is-mine' : 'is-other'}`}>
        {!isMine && isGroupStart ? (
          <div className={`mk-chat-author${nameColorClass(item.authorNameColorToken)}`}>{authorName}</div>
        ) : null}

        <div
          className="mk-chat-bubble-wrap"
          style={bubbleRadiusForShape(item.authorBubbleShape) !== null
            ? ({ '--mk-bubble-radius': `${bubbleRadiusForShape(item.authorBubbleShape)}px` } as React.CSSProperties)
            : undefined}
        >
          <div
            className={
              `mk-chat-bubble ${isMine ? 'is-mine' : 'is-other'}`
              + `${pending ? ' is-pending' : ''}${failed ? ' is-failed' : ''}`
              + `${isGroupStart ? ' is-group-start' : ''}${isGroupEnd ? ' is-group-end' : ''}`
            }
          >
            {item.replyTo ? (
              <button
                type="button"
                className="mk-chat-reply-quote"
                onClick={() => onPressReply?.(item.replyTo!.targetId)}
                aria-label={`Replying to ${item.replyTo.authorName}. Go to the message.`}
              >
                <span className="mk-chat-reply-author">{item.replyTo.authorName}</span>
                <span className="mk-chat-reply-snippet">{item.replyTo.snippet}</span>
              </button>
            ) : null}

            {item.body ? (
              <div className="mk-chat-body">
                {bodyMentions
                  ? segmentBodyMentions(item.body, mentionNames!).map((segment, index) => (
                      segment.mention
                        ? <span key={index} className="mk-chat-mention">{segment.text}</span>
                        : <span key={index}>{segment.text}</span>
                    ))
                  : item.body}
              </div>
            ) : null}
            {attachmentSlot}
            {meta ? <div className="mk-chat-meta">{meta}</div> : null}
          </div>

          {/* Hover toolbar: quick reactions + "+" full picker + Reply. Mirrors the
              mobile long-press quick-set; the picker replaces the "+" sheet. */}
          {!pending && !failed && (canReact || canReply) ? (
            <div className="mk-chat-hover-toolbar" role="toolbar" aria-label="Message actions">
              {canReact ? QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="mk-chat-hover-btn"
                  aria-label={`React with ${emoji}`}
                  onClick={() => onReact(item.id, emoji)}
                >
                  {emoji}
                </button>
              )) : null}
              {canReact ? packReactions?.map((pack) => (
                <button
                  key={pack.token}
                  type="button"
                  className="mk-chat-hover-btn"
                  aria-label={`React with ${pack.label}`}
                  onClick={() => onReact(item.id, pack.token)}
                >
                  {pack.imageUri ? (
                    <img className="mk-chat-reaction-image" src={pack.imageUri} alt={pack.label} />
                  ) : (pack.glyph ?? pack.label)}
                </button>
              )) : null}
              {canReact ? (
              <div className="mk-chat-hover-pickerhost">
                <button
                  type="button"
                  className="mk-chat-hover-btn"
                  aria-label="More reactions"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen((v) => !v)}
                >
                  +
                </button>
                {pickerOpen ? (
                  <div className="mk-chat-picker-pop">
                    <EmojiPicker
                      onSelect={(emoji) => { setPickerOpen(false); onReact(item.id, emoji); }}
                      onClose={() => setPickerOpen(false)}
                    />
                  </div>
                ) : null}
              </div>
              ) : null}
              {canReact && stickerChoices && stickerChoices.length > 0 && onStick ? (
                <div className="mk-chat-hover-pickerhost">
                  <button
                    type="button"
                    className="mk-chat-hover-btn"
                    aria-label="Stick a sticker"
                    aria-expanded={stickerOpen}
                    onClick={() => setStickerOpen((v) => !v)}
                  >
                    ✦
                  </button>
                  {stickerOpen ? (
                    <div className="mk-chat-picker-pop mk-chat-sticker-pop" role="menu" aria-label="Stickers">
                      {stickerChoices.map((choice) => (
                        <button
                          key={choice.key}
                          type="button"
                          className="mk-chat-hover-btn"
                          aria-label={`Stick ${choice.label}`}
                          onClick={() => { setStickerOpen(false); onStick(item.id, choice.key); }}
                        >
                          {choice.imageUri ? (
                            <img className="mk-chat-reaction-image" src={choice.imageUri} alt={choice.label} />
                          ) : (choice.glyph ?? choice.label)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {canReply ? (
                <button
                  type="button"
                  className="mk-chat-hover-btn mk-chat-hover-text"
                  aria-label="Reply"
                  onClick={() => onReply(item.id)}
                >
                  ↩
                </button>
              ) : null}
            </div>
          ) : null}

          {menuOpen ? (
            <div className="mk-chat-context-menu" role="menu">
              {canReply ? (
                <button type="button" role="menuitem" className="mk-chat-menu-item" onClick={run(onReply)}>Reply</button>
              ) : null}
              {canCopy ? (
                <button type="button" role="menuitem" className="mk-chat-menu-item" onClick={run(onCopy)}>Copy text</button>
              ) : null}
              {canEdit ? (
                <button type="button" role="menuitem" className="mk-chat-menu-item" onClick={run(onEdit)}>Edit</button>
              ) : null}
              {canDelete ? (
                <button type="button" role="menuitem" className="mk-chat-menu-item is-danger" onClick={run(onDelete)}>Delete</button>
              ) : null}
              {canReport ? (
                <button type="button" role="menuitem" className="mk-chat-menu-item is-danger" onClick={run(onReport)}>Report</button>
              ) : null}
            </div>
          ) : null}
        </div>

        {stickers && stickers.length > 0 ? (
          <div className="mk-chat-sticker-layer" aria-hidden={false}>
            {stickers.map((sticker) => (
              <button
                key={sticker.nodeId}
                type="button"
                className="mk-chat-sticker"
                aria-label={sticker.removable ? 'Sticker. Click to remove.' : 'Sticker'}
                disabled={!sticker.removable || !onPressSticker}
                onClick={() => onPressSticker?.(sticker.nodeId)}
                style={{ left: sticker.x, top: sticker.y, transform: `rotate(${sticker.rotation}deg)` }}
              >
                {sticker.imageUri ? (
                  <img className="mk-chat-sticker-image" src={sticker.imageUri} alt="Sticker" />
                ) : (
                  <span className="mk-chat-sticker-glyph">{sticker.emoji ?? '…'}</span>
                )}
              </button>
            ))}
          </div>
        ) : null}
        {reactions.length > 0 ? (
          <div className={`mk-chat-reactions ${isMine ? 'is-mine' : 'is-other'}`}>
            {reactions.map((group) => (
              <button
                key={group.emoji}
                type="button"
                className={`mk-chat-reaction-chip ${group.mine ? 'is-mine' : ''}`}
                aria-pressed={group.mine}
                aria-label={`${group.displayLabel ?? group.displayGlyph ?? group.emoji} ${group.count}${group.mine ? ', including you. Click to remove.' : '. Click to add.'}`}
                onClick={() => onToggleReaction(item.id, group.emoji)}
              >
                {group.displayImageUri ? (
                  <img className="mk-chat-reaction-image" src={group.displayImageUri} alt={group.displayLabel ?? group.emoji} />
                ) : (
                  <span className="mk-chat-reaction-emoji">{group.displayGlyph ?? group.displayLabel ?? group.emoji}</span>
                )}
                <span className="mk-chat-reaction-count">{group.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}


// Feature 6 display sugar: a verified v3 name-color token maps to a palette
// CSS class (contrast-valid by construction); an unknown token renders default.
const NAME_COLOR_CLASSES: Record<string, string> = {
  accent: ' mk-name-accent',
  success: ' mk-name-success',
  warning: ' mk-name-warning',
  danger: ' mk-name-danger',
  info: ' mk-name-info',
};
function nameColorClass(token: string | null | undefined): string {
  return (token && NAME_COLOR_CLASSES[token]) || '';
}

export const ChatMessageBubble = memo(ChatMessageBubbleImpl);
