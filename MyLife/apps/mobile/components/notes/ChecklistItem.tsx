import { Pressable, StyleSheet, View } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';

const ACCENT = colors.modules.notes;

interface ChecklistItemProps {
  text: string;
  checked: boolean;
  indent: number;
  onToggle: () => void;
}

export function ChecklistItem({ text, checked, indent, onToggle }: ChecklistItemProps) {
  return (
    <Pressable onPress={onToggle} style={[styles.row, { paddingLeft: indent * 24 }]}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
      </View>
      <Text
        variant="body"
        style={[styles.text, checked && styles.textChecked]}
        numberOfLines={2}
      >
        {text}
      </Text>
    </Pressable>
  );
}

interface ChecklistProgressBadgeProps {
  checked: number;
  total: number;
}

export function ChecklistProgressBadge({ checked, total }: ChecklistProgressBadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{checked}/{total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  text: {
    flex: 1,
    color: colors.text,
  },
  textChecked: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${colors.modules.notes}26`,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },
});
