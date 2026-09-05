// Plan 30 T1.5: the full emoji picker.
//
// A search field over the static EMOJI_CATALOG (searchEmojiCatalog is pure and
// unit-tested) plus a category-grouped grid. Split into a Modal-less
// EmojiPickerPanel (the content) and a thin EmojiPickerSheet (Modal wrapper), so
// the actions sheet can host the panel INSIDE its own single Modal and avoid the
// iOS race where dismissing one Modal while presenting another swallows the
// second. Props-only; no provider imports beyond the theme seam.

import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from './chat-theme';
import { EMOJI_CATALOG, searchEmojiCatalog } from './emoji-data';

export interface EmojiPickerPanelProps {
  onSelect: (emoji: string) => void;
  /** When set, a back/close affordance shows in the header and calls this. */
  onBack?: () => void;
  /** Whether the back affordance reads as "back" (in-sheet) or "close" (modal). */
  backKind?: 'back' | 'close';
  title?: string;
}

/** The picker content, Modal-free, for embedding in a host sheet or a Modal. */
export function EmojiPickerPanel({
  onSelect,
  onBack,
  backKind = 'close',
  title = 'Add a reaction',
}: EmojiPickerPanelProps) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const [query, setQuery] = useState('');
  const categories = useMemo(() => searchEmojiCatalog(EMOJI_CATALOG, query), [query]);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backKind === 'back' ? 'Back to actions' : 'Close emoji picker'}
            onPress={onBack}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            {backKind === 'back'
              ? <ArrowLeft size={18} color={c.textSecondary} strokeWidth={2} />
              : <X size={18} color={c.textSecondary} strokeWidth={2} />}
          </Pressable>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.searchRow}>
        <Search size={16} color={c.textTertiary} strokeWidth={2} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search emoji"
          placeholderTextColor={c.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search emoji"
        />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {categories.length === 0 ? (
          <Text style={styles.emptyText}>No emoji match "{query.trim()}".</Text>
        ) : (
          categories.map((category) => (
            <View key={category.id} style={styles.category}>
              <Text style={styles.categoryLabel}>{category.label}</Text>
              <View style={styles.grid}>
                {category.emoji.map((entry) => (
                  <Pressable
                    key={`${category.id}-${entry.char}`}
                    accessibilityRole="button"
                    accessibilityLabel={`React with ${entry.name}`}
                    onPress={() => onSelect(entry.char)}
                    style={({ pressed }) => [styles.emojiButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.emoji}>{entry.char}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export interface EmojiPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

/** Standalone Modal wrapper around the panel (for consumers not already in a sheet). */
export function EmojiPickerSheet({ visible, onClose, onSelect }: EmojiPickerSheetProps) {
  const styles = useMkStyles(makeStyles);
  const pick = (emoji: string) => {
    onClose();
    onSelect(emoji);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close emoji picker"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <EmojiPickerPanel onSelect={pick} onBack={onClose} backKind="close" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '70%',
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
  },
  panel: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  title: { color: c.text, fontSize: 16, fontWeight: '800' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 11,
  },
  search: {
    flex: 1,
    height: 42,
    color: c.text,
    fontSize: 15,
  },
  scroll: { flex: 1 },
  emptyText: { color: c.textSecondary, fontSize: 14, paddingVertical: 20 },
  category: { marginBottom: 14, gap: 8 },
  categoryLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: MK_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  pressed: { opacity: 0.6, backgroundColor: c.surfaceHigh },
});
