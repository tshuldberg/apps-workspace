// Plan 30 T1.4: the long-press actions sheet.
//
// Row 1 is the six quick reactions plus a "+" that opens the full emoji picker.
// Below that: Reply and Copy, then role-aware Edit / Delete (mine) or Report
// (others). Every row carries an accessibility label. The emoji picker is hosted
// INSIDE this component's single Modal (a mode toggle), never a second Modal, so
// the long-press -> + -> picker flow can never hit the iOS dismiss/present race.
// Props-only: capability flags (canReact / canEdit / canDelete / canReport /
// canReply) and callbacks come from the caller, which owns toggle + confirm.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image as RNImage, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Copy, CornerUpLeft, Flag, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from './chat-theme';
import { QUICK_REACTIONS } from './emoji-data';
import { EmojiPickerPanel } from './EmojiPickerSheet';

export interface MessageActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  canReact: boolean;
  canReply: boolean;
  canCopy: boolean;
  canEdit: boolean;
  /** Whether Delete is offered; defaults to canEdit so Delete can exist without Edit. */
  canDelete?: boolean;
  canReport: boolean;
  onReact: (emoji: string) => void;
  /**
   * Plan 56 feature 5: this community's custom emoji (verified pack items).
   * Selecting one reacts with its pack token. Props-only: the host resolves
   * glyphs/images; an unresolved sealed image shows its :slug: label.
   */
  packReactions?: ReadonlyArray<{ token: string; label: string; glyph?: string | null; imageUri?: string | null }>;
  /**
   * Feature 12: sticker choices (quick glyphs + this community's sticker
   * packs). Selecting one STICKS it on the message (a signed canvas node),
   * distinct from a reaction.
   */
  stickerChoices?: ReadonlyArray<{ key: string; label: string; glyph?: string | null; imageUri?: string | null }>;
  onStick?: (key: string) => void;
  onReply?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}

export function MessageActionsSheet({
  visible,
  onClose,
  canReact,
  canReply,
  canCopy,
  canEdit,
  canDelete,
  canReport,
  onReact,
  packReactions,
  stickerChoices,
  onStick,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onReport,
}: MessageActionsSheetProps) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const [mode, setMode] = useState<'actions' | 'emoji'>('actions');
  const showDelete = canDelete ?? canEdit;

  // Always reopen on the actions view.
  useEffect(() => {
    if (visible) setMode('actions');
  }, [visible]);

  // A tapped action is QUEUED and runs only after the Modal has fully dismissed:
  // several callbacks present an Alert or another Modal (delete/report confirms),
  // and presenting while this Modal is mid-dismissal is the iOS freeze class.
  // The queue lives in this component (it stays mounted; only `visible` flips),
  // flushed from onDismiss on iOS and from the visibility effect on Android,
  // where Modal children unmount the instant `visible` goes false and onDismiss
  // never fires.
  const pendingActionRef = useRef<(() => void) | null>(null);
  const flushPendingAction = useCallback(() => {
    const fn = pendingActionRef.current;
    pendingActionRef.current = null;
    fn?.();
  }, []);
  useEffect(() => {
    if (!visible && Platform.OS !== 'ios') flushPendingAction();
  }, [visible, flushPendingAction]);

  const run = (fn?: () => void) => () => {
    pendingActionRef.current = fn ?? null;
    onClose();
  };

  const pickEmoji = (emoji: string) => {
    pendingActionRef.current = () => onReact(emoji);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={flushPendingAction}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close actions"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[styles.sheet, mode === 'emoji' && styles.sheetTall]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.grabber} />

          {mode === 'emoji' ? (
            <EmojiPickerPanel
              onSelect={pickEmoji}
              onBack={() => setMode('actions')}
              backKind="back"
            />
          ) : (
            <>
              {canReact ? (
                <View style={styles.reactionRow}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      accessibilityRole="button"
                      accessibilityLabel={`React with ${emoji}`}
                      onPress={run(() => onReact(emoji))}
                      style={({ pressed }) => [styles.reactionButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More reactions"
                    onPress={() => setMode('emoji')}
                    style={({ pressed }) => [styles.reactionButton, styles.morePlus, pressed && styles.pressed]}
                  >
                    <Plus size={18} color={c.textSecondary} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ) : null}
              {canReact && packReactions && packReactions.length > 0 ? (
                <View style={styles.reactionRow}>
                  {packReactions.map((pack) => (
                    <Pressable
                      key={pack.token}
                      accessibilityRole="button"
                      accessibilityLabel={`React with ${pack.label}`}
                      onPress={run(() => onReact(pack.token))}
                      style={({ pressed }) => [styles.reactionButton, pressed && styles.pressed]}
                    >
                      {pack.imageUri ? (
                        <RNImage source={{ uri: pack.imageUri }} style={styles.packImage} />
                      ) : (
                        <Text style={pack.glyph ? styles.reactionEmoji : styles.packLabel} numberOfLines={1}>
                          {pack.glyph ?? pack.label}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {canReact && onStick && stickerChoices && stickerChoices.length > 0 ? (
                <>
                  <Text style={styles.stickerRowLabel}>Stick a sticker</Text>
                  <View style={styles.reactionRow}>
                    {stickerChoices.map((choice) => (
                      <Pressable
                        key={choice.key}
                        accessibilityRole="button"
                        accessibilityLabel={`Stick ${choice.label}`}
                        onPress={run(() => onStick(choice.key))}
                        style={({ pressed }) => [styles.reactionButton, pressed && styles.pressed]}
                      >
                        {choice.imageUri ? (
                          <RNImage source={{ uri: choice.imageUri }} style={styles.packImage} />
                        ) : (
                          <Text style={choice.glyph ? styles.reactionEmoji : styles.packLabel} numberOfLines={1}>
                            {choice.glyph ?? choice.label}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {canReply ? (
                <ActionRow
                  icon={<CornerUpLeft size={18} color={c.text} strokeWidth={2} />}
                  label="Reply"
                  onPress={run(onReply)}
                />
              ) : null}
              {canCopy ? (
                <ActionRow
                  icon={<Copy size={18} color={c.text} strokeWidth={2} />}
                  label="Copy text"
                  onPress={run(onCopy)}
                />
              ) : null}
              {canEdit ? (
                <ActionRow
                  icon={<Pencil size={18} color={c.text} strokeWidth={2} />}
                  label="Edit"
                  onPress={run(onEdit)}
                />
              ) : null}
              {showDelete ? (
                <ActionRow
                  icon={<Trash2 size={18} color={c.danger} strokeWidth={2} />}
                  label="Delete"
                  tone="danger"
                  onPress={run(onDelete)}
                />
              ) : null}
              {canReport ? (
                <ActionRow
                  icon={<Flag size={18} color={c.danger} strokeWidth={2} />}
                  label="Report"
                  tone="danger"
                  onPress={run(onReport)}
                />
              ) : null}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  tone = 'default',
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={[styles.actionLabel, tone === 'danger' && styles.actionLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 4,
  },
  sheetTall: { height: '72%' },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.borderStrong,
    marginBottom: 8,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePlus: { backgroundColor: c.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  reactionEmoji: { fontSize: 22 },
  packImage: { width: 22, height: 22, borderRadius: 4 },
  packLabel: { fontSize: 11, fontWeight: '700', color: c.textSecondary, maxWidth: 64 },
  stickerRowLabel: { color: c.textTertiary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: MK_RADIUS.md,
  },
  actionIcon: { width: 24, alignItems: 'center' },
  actionLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  actionLabelDanger: { color: c.danger },
  pressed: { opacity: 0.6, backgroundColor: c.surfaceHigh },
});
