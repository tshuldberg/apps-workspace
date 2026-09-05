// Plan 30 Phase 4 (web twin of the mobile ChatComposer): one textarea, a send
// button, an attach button (hidden when attachments are not allowed), a reply
// banner and an edit banner, and an @mention autocomplete overlay driven by a
// trusted-local candidate list. Enter sends; Shift+Enter inserts a newline. All
// the mention logic (detect / filter / insert) is the SHARED pure chat-kit-core;
// this wires it to the input and reports the selected deviceIds up through onSend
// so they land in the signed mentions array. The value is controlled by the caller.

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  applyMentionSelection,
  createSendLatch,
  detectMentionQuery,
  filterMentionCandidates,
  resolveSignedMentions,
  type MentionCandidate,
} from '../../lib/chat-kit-core';

const MAX_MENTION_ROWS = 6;

export interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Emits the trimmed body plus the deviceIds of mentions still present in it.
   *  The CALLER clears `value` on a successful send; that release the latch. */
  onSend: (body: string, mentions: string[]) => void | Promise<unknown>;
  mentionCandidates: readonly MentionCandidate[];
  placeholder?: string;
  sendDisabled?: boolean;
  allowAttachments?: boolean;
  onPickAttachment?: () => void;
  attachmentBusy?: boolean;
  attachmentsPresent?: boolean;
  attachmentSlot?: React.ReactNode;
  reply?: { authorName: string; snippet: string } | null;
  onCancelReply?: () => void;
  editing?: boolean;
  onCancelEdit?: () => void;
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  mentionCandidates,
  placeholder,
  sendDisabled = false,
  allowAttachments = false,
  onPickAttachment,
  attachmentBusy = false,
  attachmentsPresent = false,
  attachmentSlot,
  reply,
  onCancelReply,
  editing = false,
  onCancelEdit,
}: ChatComposerProps): React.ReactElement {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [accrued, setAccrued] = useState<MentionCandidate[]>([]);
  const latchRef = useRef(createSendLatch());
  const prevValueRef = useRef(value);

  // A fresh (cleared) field drops any accrued mentions.
  useEffect(() => {
    if (value.length === 0 && accrued.length > 0) setAccrued([]);
  }, [value.length, accrued.length]);

  // Any change to the controlled value releases the send latch for the next message.
  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      latchRef.current.release();
    }
  }, [value]);

  const mentionQuery = useMemo(() => detectMentionQuery(value, caret), [value, caret]);
  const mentionMatches = useMemo(
    () => (mentionQuery ? filterMentionCandidates(mentionCandidates, mentionQuery.query).slice(0, MAX_MENTION_ROWS) : []),
    [mentionQuery, mentionCandidates],
  );
  const showMentions = mentionQuery != null && mentionMatches.length > 0;

  const syncCaret = useCallback(() => {
    const el = inputRef.current;
    if (el && el.selectionStart === el.selectionEnd) setCaret(el.selectionStart);
  }, []);

  const onInput = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    onChangeText(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
  }, [onChangeText]);

  const selectMention = useCallback((candidate: MentionCandidate) => {
    if (!mentionQuery) return;
    const applied = applyMentionSelection(value, { start: mentionQuery.start, end: mentionQuery.end }, candidate);
    onChangeText(applied.text);
    setAccrued((prev) => [...prev, candidate]);
    // Move the caret past the inserted name on the next frame (after the value
    // prop applies), so the mention popup closes.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(applied.cursor, applied.cursor);
        setCaret(applied.cursor);
      }
    });
  }, [mentionQuery, onChangeText, value]);

  const trimmed = value.trim();
  const canSend = !sendDisabled && (trimmed.length > 0 || (attachmentsPresent && !editing));

  const handleSend = useCallback(() => {
    if (!canSend) return;
    if (!latchRef.current.tryAcquire()) return;
    const result = onSend(trimmed, resolveSignedMentions(trimmed, accrued));
    setAccrued([]);
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      // The catch keeps an unexpected caller rejection from surfacing as an
      // unhandled rejection; the caller owns error honesty (result unions), and
      // the released latch + unchanged `value` keep the send retryable.
      void Promise.resolve(result)
        .finally(() => latchRef.current.release())
        .catch(() => undefined);
    }
  }, [accrued, canSend, onSend, trimmed]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // With the mention popup open, Enter picks the first match instead of sending.
      if (showMentions && mentionMatches[0]) {
        e.preventDefault();
        selectMention(mentionMatches[0]);
        return;
      }
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && editing) {
      e.preventDefault();
      onCancelEdit?.();
    }
  }, [showMentions, mentionMatches, selectMention, handleSend, editing, onCancelEdit]);

  return (
    <div className="mk-chat-composer">
      {showMentions ? (
        <div className="mk-chat-mention-pop" role="listbox" aria-label="Mention a member">
          {mentionMatches.map((candidate) => (
            <button
              key={candidate.deviceId}
              type="button"
              role="option"
              aria-selected={false}
              className="mk-chat-mention-row"
              onMouseDown={(e) => { e.preventDefault(); selectMention(candidate); }}
            >
              <span className="mk-chat-mention-avatar" aria-hidden>
                {candidate.name.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <span className="mk-chat-mention-name">{candidate.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {reply && !editing ? (
        <div className="mk-chat-banner">
          <span className="mk-chat-banner-accent" aria-hidden />
          <span className="mk-chat-banner-text">
            <span className="mk-chat-banner-title">Replying to {reply.authorName}</span>
            <span className="mk-chat-banner-snippet">{reply.snippet}</span>
          </span>
          <button type="button" className="mk-chat-banner-close" aria-label="Cancel reply" onClick={onCancelReply}>×</button>
        </div>
      ) : null}

      {editing ? (
        <div className="mk-chat-banner is-edit">
          <span className="mk-chat-banner-text">Editing recorded message</span>
          <button type="button" className="mk-chat-banner-close" aria-label="Cancel editing" onClick={onCancelEdit}>×</button>
        </div>
      ) : null}

      {attachmentSlot}

      <div className="mk-chat-composer-row">
        {allowAttachments && !editing ? (
          <button
            type="button"
            className="mk-chat-attach-btn"
            aria-label="Attach a file"
            disabled={attachmentBusy}
            onClick={onPickAttachment}
          >
            📎
          </button>
        ) : null}
        <textarea
          ref={inputRef}
          className="mk-textarea mk-chat-composer-input"
          value={value}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onSelect={syncCaret}
          placeholder={placeholder ?? (editing ? 'Edit message' : 'Message this channel')}
          aria-label={editing ? 'Edit message' : 'Message this channel'}
        />
        <button
          type="button"
          className="mk-chat-send-btn"
          aria-label={editing ? 'Save edited message' : 'Send message'}
          disabled={!canSend}
          onClick={handleSend}
        >
          {editing ? '✓' : '➤'}
        </button>
      </div>
    </div>
  );
}
