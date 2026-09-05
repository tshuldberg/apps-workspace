// Plan 30 T1.2: one chat bubble.
//
// Props-only (imports no provider except the theme seam). Own messages are
// right-aligned in accent with onAccent text; others are left-aligned surface
// bubbles with a hairline border. Grouped messages share a stack (16 outer / 5
// inner corner radii); the author name + avatar show only at the top of a
// non-mine group, the time only at the bottom. Pending and failed local sends
// keep the accent-border / danger treatments from the prior screen. Reaction
// chips sit under the bubble (mine = accent border) and tapping one toggles.
// No delivery/read/online claim is ever rendered (NC-1).

import React from 'react';
import { Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { bubbleRadiusForShape } from '@mylife/meerkat-theme';
import { useAppThemeColors, useCommunityChatStyle, useMkStyles } from './chat-theme';
import {
  formatClockTime,
  segmentBodyMentions,
  type ChatKitMessage,
  type KitReactionGroup,
  type KitSticker,
} from './chat-kit-core';

const INNER_RADIUS = 5;

export interface MessageBubbleProps {
  item: ChatKitMessage;
  /** Authoritative alignment/ownership flag; the caller decides, and it wins
   *  over item.isMine (which exists only so provider-free consumers can group). */
  isMine: boolean;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  /** Friendly author label from a trusted-local source; shown at group start. */
  authorName: string;
  /** First-letter fallback for the avatar when no image is available. */
  avatarInitial: string;
  /** Optional avatar image (Plan 32 feeds this); falls back to the initial. */
  avatarImageUri?: string | null;
  reactions: readonly KitReactionGroup[];
  /** Feature 12: verified, receiver-dialed stickers stuck over this message. */
  stickers?: readonly KitSticker[];
  /** Tap a sticker you may remove (author/curator); host confirms + tombstones. */
  onPressSticker?: (nodeId: string) => void;
  /** Carries the message id so ONE stable handler serves every row (memo-friendly). */
  onLongPress: (id: string) => void;
  /** Carries the message id + emoji so ONE stable handler serves every row. */
  onPressReaction: (id: string, emoji: string) => void;
  onPressReply?: (targetId: string) => void;
  /** Attachment cards, rendered by the caller (they need the blob provider). */
  attachmentSlot?: React.ReactNode;
  /** Display names to highlight as @mentions in the body (display sugar only). */
  mentionNames?: readonly string[];
}

function MessageBubbleImpl({
  item,
  isMine,
  isGroupStart,
  isGroupEnd,
  authorName,
  avatarInitial,
  avatarImageUri,
  reactions,
  stickers,
  onPressSticker,
  onLongPress,
  onPressReaction,
  onPressReply,
  attachmentSlot,
  mentionNames,
}: MessageBubbleProps) {
  const styles = useMkStyles(makeStyles);
  // Plan 56 feature 1: community bubble shape + typography scale (defaults
  // reproduce today's rendering outside a themed community).
  const chatStyle = useCommunityChatStyle();
  const palette = useAppThemeColors();
  // Feature 6 display sugar: a verified v3 name-color token maps to the ACTIVE
  // palette (contrast-valid by construction); an unknown token renders default.
  const authorNameColor = (() => {
    switch (item.authorNameColorToken) {
      case 'accent': return palette.accent;
      case 'success': return palette.success;
      case 'warning': return palette.warning;
      case 'danger': return palette.danger;
      case 'info': return palette.info;
      default: return null;
    }
  })();
  // Feature 4: a role bubble shape (host-resolved closed token) beats the
  // community-wide radius for this author; unknown/absent falls through.
  const outerRadius = bubbleRadiusForShape(item.authorBubbleShape) ?? chatStyle.bubbleRadius;
  const pending = item.status === 'sending';
  const failed = item.status === 'failed';
  const showAvatar = !isMine;
  const showHeader = !isMine && isGroupStart;
  const bodyMentions = mentionNames && mentionNames.length > 0;

  // Corner radii: the tight corners face the same-author neighbor in the stack.
  const ownedSide = isMine
    ? {
        borderTopRightRadius: isGroupStart ? outerRadius : INNER_RADIUS,
        borderBottomRightRadius: isGroupEnd ? outerRadius : INNER_RADIUS,
        borderTopLeftRadius: outerRadius,
        borderBottomLeftRadius: outerRadius,
      }
    : {
        borderTopLeftRadius: isGroupStart ? outerRadius : INNER_RADIUS,
        borderBottomLeftRadius: isGroupEnd ? outerRadius : INNER_RADIUS,
        borderTopRightRadius: outerRadius,
        borderBottomRightRadius: outerRadius,
      };

  const bubbleTone = failed
    ? styles.bubbleFailed
    : pending
      ? styles.bubblePending
      : isMine
        ? styles.bubbleMine
        : styles.bubbleOther;
  const bodyTone = !failed && !pending && isMine ? styles.bodyMine : styles.body;
  const bodyScale = chatStyle.fontScale !== 1
    ? { fontSize: 15 * chatStyle.fontScale, lineHeight: 21 * chatStyle.fontScale }
    : null;
  const metaTone = failed ? styles.metaFailed : (isMine && !pending ? styles.metaMine : styles.meta);

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      {showAvatar ? (
        <View style={styles.avatarColumn}>
          {isGroupStart ? (
            avatarImageUri ? (
              <RNImage source={{ uri: avatarImageUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              </View>
            )
          ) : null}
        </View>
      ) : null}

      <View style={[styles.column, isMine ? styles.columnMine : styles.columnOther]}>
        {showHeader ? (
          <Text
            style={[styles.author, authorNameColor ? { color: authorNameColor } : null]}
            numberOfLines={1}
          >
            {authorName}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Message from ${isMine ? 'you' : authorName}. Hold for actions.`}
          onLongPress={() => onLongPress(item.id)}
          delayLongPress={280}
          style={[styles.bubble, bubbleTone, ownedSide]}
        >
          {item.replyTo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Replying to ${item.replyTo.authorName}. Tap to see the message.`}
              onPress={() => onPressReply?.(item.replyTo!.targetId)}
              style={[styles.replyQuote, isMine && styles.replyQuoteMine]}
            >
              <Text style={[styles.replyAuthor, isMine && styles.replyOnAccent]} numberOfLines={1}>
                {item.replyTo.authorName}
              </Text>
              <Text style={[styles.replySnippet, isMine && styles.replyOnAccent]} numberOfLines={1}>
                {item.replyTo.snippet}
              </Text>
            </Pressable>
          ) : null}

          {item.body ? (
            <Text style={[bodyTone, bodyScale]}>
              {bodyMentions
                ? segmentBodyMentions(item.body, mentionNames!).map((segment, index) => (
                    segment.mention ? (
                      <Text key={index} style={isMine ? styles.mentionMine : styles.mention}>
                        {segment.text}
                      </Text>
                    ) : (
                      <Text key={index}>{segment.text}</Text>
                    )
                  ))
                : item.body}
            </Text>
          ) : null}
          {attachmentSlot}

          {isGroupEnd || pending || failed || item.edited ? (
            <Text style={metaTone}>
              {failed
                ? (item.errorText ?? 'Not sent')
                : pending
                  ? 'Sending'
                  : isGroupEnd
                    ? `${formatClockTime(item.wall)}${item.edited ? ' · Edited' : ''}`
                    : 'Edited'}
            </Text>
          ) : null}
        </Pressable>

        {stickers && stickers.length > 0 ? (
          <View pointerEvents="box-none" style={styles.stickerLayer}>
            {stickers.map((sticker) => (
              <Pressable
                key={sticker.nodeId}
                accessibilityRole={sticker.removable ? 'button' : 'image'}
                accessibilityLabel={sticker.removable ? 'Sticker. Tap to remove.' : 'Sticker'}
                disabled={!sticker.removable || !onPressSticker}
                onPress={() => onPressSticker?.(sticker.nodeId)}
                style={[styles.stickerWrap, {
                  left: sticker.x,
                  top: sticker.y,
                  transform: [{ rotate: `${sticker.rotation}deg` }],
                }]}
              >
                {sticker.imageUri ? (
                  <RNImage source={{ uri: sticker.imageUri }} style={styles.stickerImage} />
                ) : (
                  <Text style={styles.stickerGlyph}>{sticker.emoji ?? '…'}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ) : null}

        {reactions.length > 0 ? (
          <View style={[styles.reactions, isMine ? styles.reactionsMine : styles.reactionsOther]}>
            {reactions.map((group) => (
              <Pressable
                key={group.emoji}
                accessibilityRole="button"
                accessibilityLabel={`${group.displayLabel ?? group.displayGlyph ?? group.emoji} ${group.count}${group.mine ? ', including you. Tap to remove.' : '. Tap to add.'}`}
                accessibilityState={{ selected: group.mine }}
                onPress={() => onPressReaction(item.id, group.emoji)}
                style={[styles.reactionChip, group.mine && styles.reactionChipMine]}
              >
                {group.displayImageUri ? (
                  <RNImage source={{ uri: group.displayImageUri }} style={styles.reactionImage} />
                ) : (
                  <Text style={styles.reactionEmoji}>{group.displayGlyph ?? group.displayLabel ?? group.emoji}</Text>
                )}
                <Text style={[styles.reactionCount, group.mine && styles.reactionCountMine]}>
                  {group.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const MessageBubble = React.memo(MessageBubbleImpl);

const makeStyles = (c: MkColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '100%',
  },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarColumn: { width: 32 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
  },
  avatarText: { color: c.accentDim, fontSize: 13, fontWeight: '800' },
  column: { maxWidth: '84%', gap: 3 },
  columnMine: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start' },
  author: { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginLeft: 2 },
  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 4,
    minWidth: 44,
  },
  bubbleMine: { backgroundColor: c.accent },
  bubbleOther: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  bubblePending: {
    backgroundColor: c.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.accent,
  },
  bubbleFailed: {
    backgroundColor: c.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.danger,
  },
  body: { color: c.text, fontSize: 15, lineHeight: 21 },
  bodyMine: { color: c.onAccent, fontSize: 15, lineHeight: 21 },
  mention: { color: c.accentDim, fontWeight: '700' },
  mentionMine: { color: c.onAccent, fontWeight: '800' },
  meta: { color: c.textTertiary, fontSize: 11 },
  metaMine: { color: c.onAccent, fontSize: 11, opacity: 0.8 },
  metaFailed: { color: c.danger, fontSize: 11, fontWeight: '700' },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: c.accentDim,
    paddingLeft: 8,
    paddingVertical: 2,
    gap: 1,
  },
  replyQuoteMine: { borderLeftColor: c.onAccent },
  replyAuthor: { color: c.accentDim, fontSize: 11.5, fontWeight: '800' },
  replySnippet: { color: c.textSecondary, fontSize: 12, lineHeight: 16 },
  replyOnAccent: { color: c.onAccent, opacity: 0.9 },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 1,
  },
  reactionsMine: { justifyContent: 'flex-end' },
  reactionsOther: { justifyContent: 'flex-start' },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  reactionChipMine: {
    borderColor: c.accent,
    backgroundColor: c.glass,
  },
  reactionEmoji: { fontSize: 13 },
  stickerLayer: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  stickerWrap: { position: 'absolute' },
  stickerGlyph: { fontSize: 28 },
  stickerImage: { width: 34, height: 34, borderRadius: 6 },
  reactionImage: { width: 16, height: 16, borderRadius: 3 },
  reactionCount: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  reactionCountMine: { color: c.accentDim },
});
