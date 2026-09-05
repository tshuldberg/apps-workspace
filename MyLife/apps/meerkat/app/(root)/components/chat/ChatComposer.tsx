// Plan 30 T1.6: the message composer.
//
// One multiline field, a send button, an attach button (hidden when
// allowAttachments is false), a reply banner and an edit banner, and an
// @mention autocomplete overlay driven by a trusted-local candidate list. All
// the mention logic (detect / filter / insert) is pure and unit-tested in
// chat-kit-core; this component wires it to the input and reports the selected
// deviceIds up through onSend so they land in the signed mentions array. The
// value is controlled by the caller; attachments are caller-owned (the blob
// store is a provider), so they arrive as an attachmentSlot + an attach button
// callback. Props-only; no provider imports beyond the theme seam.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputSelectionChangeEvent,
  View,
} from 'react-native';
import { Check, Paperclip, Send, X } from 'lucide-react-native';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from './chat-theme';
import {
  applyMentionSelection,
  createSendLatch,
  detectMentionQuery,
  filterMentionCandidates,
  resolveSignedMentions,
  type MentionCandidate,
} from './chat-kit-core';

const MAX_MENTION_ROWS = 6;

export interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Emits the trimmed body plus the deviceIds of mentions still present in it.
   * The CALLER must clear `value` (via onChangeText('')) on a successful send;
   * that empty transition releases the internal single-send latch for the next
   * message. If the caller's submit is async, RETURN the promise: the latch also
   * releases when it settles, so a failed submit that leaves `value` unchanged
   * (e.g. a failed edit) can still be retried. Editing takes precedence over
   * reply: when `editing` is true the reply banner is suppressed.
   */
  onSend: (body: string, mentions: string[]) => void | Promise<unknown>;
  mentionCandidates: readonly MentionCandidate[];
  placeholder?: string;
  /** External gate (e.g. a send in flight); the empty-body gate is internal. */
  sendDisabled?: boolean;
  allowAttachments?: boolean;
  onPickAttachment?: () => void;
  attachmentBusy?: boolean;
  /** True when the caller holds draft attachments (enables an empty-body send). */
  attachmentsPresent?: boolean;
  /** Draft attachment chips, rendered by the caller. */
  attachmentSlot?: React.ReactNode;
  /** Reply target; suppressed while `editing` is true (mutually exclusive). */
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
}: ChatComposerProps) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  // Only set right after a mention insert, so the input's caret is controlled
  // for exactly one render (moving it past the inserted name) and uncontrolled
  // otherwise, which avoids Android IME cursor jumps.
  const [forcedCursor, setForcedCursor] = useState<number | null>(null);
  const [accrued, setAccrued] = useState<MentionCandidate[]>([]);
  // A one-shot latch so a same-frame double-tap on Send fires onSend once.
  const latchRef = useRef(createSendLatch());
  const prevValueRef = useRef(value);

  // A fresh (cleared) field drops any accrued mentions and cursor override.
  useEffect(() => {
    if (value.length === 0) {
      if (accrued.length > 0) setAccrued([]);
      if (forcedCursor !== null) setForcedCursor(null);
    }
  }, [value.length, accrued.length, forcedCursor]);

  // Any change to the controlled value (cleared on a successful send, or edited
  // to retry after a failure) releases the send latch for the next message.
  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      latchRef.current.release();
    }
  }, [value]);

  const caret = selection.start === selection.end ? selection.end : null;
  const mentionQuery = caret != null ? detectMentionQuery(value, caret) : null;
  const mentionMatches = mentionQuery
    ? filterMentionCandidates(mentionCandidates, mentionQuery.query).slice(0, MAX_MENTION_ROWS)
    : [];
  const showMentions = mentionQuery != null && mentionMatches.length > 0;

  const onSelectionChange = useCallback(
    (event: TextInputSelectionChangeEvent) => {
      setSelection(event.nativeEvent.selection);
      setForcedCursor(null);
    },
    [],
  );

  const selectMention = useCallback(
    (candidate: MentionCandidate) => {
      if (!mentionQuery) return;
      const applied = applyMentionSelection(
        value,
        { start: mentionQuery.start, end: mentionQuery.end },
        candidate,
      );
      onChangeText(applied.text);
      setSelection({ start: applied.cursor, end: applied.cursor });
      setForcedCursor(applied.cursor);
      setAccrued((prev) => [...prev, candidate]);
    },
    [mentionQuery, onChangeText, value],
  );

  const trimmed = value.trim();
  const canSend = !sendDisabled && (trimmed.length > 0 || (attachmentsPresent && !editing));

  const handleSend = useCallback(() => {
    if (!canSend) return;
    // Same-frame double-tap fires once; the latch releases when value clears.
    if (!latchRef.current.tryAcquire()) return;
    // Sign only mentions that survive as a bounded @token in the exact sent body.
    const result = onSend(trimmed, resolveSignedMentions(trimmed, accrued));
    setAccrued([]);
    // An async submit that fails leaves `value` unchanged, so the value-change
    // release never fires and the latch would stick locked. Release it when the
    // returned promise settles so the send can be retried (the success path also
    // clears `value`, which releases the latch too — a double release is a no-op).
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      // The catch keeps an unexpected caller rejection from surfacing as an
      // unhandled rejection; the caller owns error honesty (result unions), and
      // the released latch + unchanged `value` keep the send retryable.
      void Promise.resolve(result)
        .finally(() => latchRef.current.release())
        .catch(() => undefined);
    }
  }, [accrued, canSend, onSend, trimmed]);

  return (
    <View style={styles.wrap}>
      {showMentions ? (
        <View style={styles.mentionOverlay}>
          {mentionMatches.map((candidate) => (
            <Pressable
              key={candidate.deviceId}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${candidate.name}`}
              onPress={() => selectMention(candidate)}
              style={({ pressed }) => [styles.mentionRow, pressed && styles.mentionRowPressed]}
            >
              <View style={styles.mentionAvatar}>
                <Text style={styles.mentionAvatarText}>
                  {candidate.name.trim().charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.mentionName} numberOfLines={1}>{candidate.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {reply && !editing ? (
        <View style={styles.banner}>
          <View style={styles.bannerAccent} />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle} numberOfLines={1}>Replying to {reply.authorName}</Text>
            <Text style={styles.bannerSnippet} numberOfLines={1}>{reply.snippet}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            onPress={onCancelReply}
            style={({ pressed }) => [styles.bannerClose, pressed && styles.pressed]}
          >
            <X size={16} color={c.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      {editing ? (
        <View style={[styles.banner, styles.editBanner]}>
          <Text style={styles.editBannerText}>Editing recorded message</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
            onPress={onCancelEdit}
            style={({ pressed }) => [styles.bannerClose, pressed && styles.pressed]}
          >
            <X size={16} color={c.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      {attachmentSlot}

      <View style={styles.row}>
        {allowAttachments && !editing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach file"
            accessibilityState={{ disabled: attachmentBusy }}
            disabled={attachmentBusy}
            onPress={onPickAttachment}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, attachmentBusy && styles.disabled]}
          >
            <Paperclip size={18} color={c.textSecondary} strokeWidth={2} />
          </Pressable>
        ) : null}

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          selection={forcedCursor !== null ? { start: forcedCursor, end: forcedCursor } : undefined}
          onSelectionChange={onSelectionChange}
          placeholder={placeholder ?? (editing ? 'Edit message' : 'Message this channel')}
          placeholderTextColor={c.textTertiary}
          multiline
          accessibilityLabel={editing ? 'Edit message' : 'Message this channel'}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Save edited message' : 'Send message'}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={handleSend}
          style={({ pressed }) => [styles.sendButton, pressed && styles.pressed, !canSend && styles.disabled]}
        >
          {editing
            ? <Check size={18} color={c.onAccent} strokeWidth={2} />
            : <Send size={18} color={c.onAccent} strokeWidth={2} />}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  wrap: { gap: 8 },
  mentionOverlay: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: MK_RADIUS.md,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  mentionRowPressed: { backgroundColor: c.surfaceHigh },
  mentionAvatar: {
    width: 26,
    height: 26,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionAvatarText: { color: c.accentDim, fontSize: 12, fontWeight: '800' },
  mentionName: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bannerAccent: { width: 3, alignSelf: 'stretch', borderRadius: MK_RADIUS.pill, backgroundColor: c.accent },
  bannerText: { flex: 1, minWidth: 0, gap: 1 },
  bannerTitle: { color: c.accentDim, fontSize: 12, fontWeight: '800' },
  bannerSnippet: { color: c.textSecondary, fontSize: 12, lineHeight: 16 },
  bannerClose: {
    width: 44,
    height: 44,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBanner: {
    backgroundColor: c.infoSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.info,
  },
  editBannerText: { flex: 1, color: c.info, fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: MK_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: c.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: MK_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.42 },
});
