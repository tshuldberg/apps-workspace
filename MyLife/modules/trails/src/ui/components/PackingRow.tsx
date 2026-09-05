import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  TR_ACCENT,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TYPOGRAPHY,
  withAlpha,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface PackingRowItem {
  name: string;
  category?: string | null;
}

export interface PackingRowProps {
  item: PackingRowItem;
  checked: boolean;
  weight?: string | number | null;
  onToggle?: () => void;
}

function formatWeight(weight?: string | number | null): string | null {
  if (weight == null) {
    return null;
  }
  return typeof weight === 'number' ? `${weight} g` : weight;
}

export function PackingRow({
  item,
  checked,
  weight,
  onToggle,
}: PackingRowProps) {
  const weightCopy = formatWeight(weight);

  return (
    <Pressable onPress={onToggle} style={styles.row}>
      <View style={styles.leftRail}>
        <MaterialSymbol
          name={checked ? 'check_box' : 'check_box_outline_blank'}
          size={20}
          color={checked ? TR_ACCENT : TR_TEXT_SECONDARY}
        />
        <View style={styles.copy}>
          <Text style={[styles.name, checked ? styles.checkedText : null]}>
            {item.name}
          </Text>
          <Text style={styles.meta}>
            {item.category ?? 'Packing'}{weightCopy ? ` · ${weightCopy}` : ''}
          </Text>
        </View>
      </View>
      <View style={[styles.badge, checked ? styles.badgeChecked : null]}>
        <Text style={[styles.badgeCopy, checked ? styles.badgeCopyChecked : null]}>
          {checked ? 'Packed' : 'Todo'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    color: TR_TEXT_SECONDARY,
  },
  meta: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  badgeChecked: {
    backgroundColor: withAlpha(TR_ACCENT, 0.14),
  },
  badgeCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_SECONDARY,
  },
  badgeCopyChecked: {
    color: TR_ACCENT,
  },
});
