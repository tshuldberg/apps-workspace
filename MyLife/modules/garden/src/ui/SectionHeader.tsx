import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_ACCENT, GARDEN_TYPOGRAPHY } from './tokens';

interface SectionHeaderProps {
  label?: string;
  title: string;
  action?: { text: string; onPress: () => void };
}

export function SectionHeader({ label, title, action }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {label != null && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action != null && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={styles.action}>{action.text}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  left: {
    flex: 1,
    gap: 4,
  },
  label: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
  },
  title: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  action: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: GARDEN_ACCENT,
  },
});
