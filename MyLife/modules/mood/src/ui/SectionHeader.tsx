import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MOOD_TYPOGRAPHY, MOOD_ACCENT } from './tokens';
import { colors } from '@mylife/ui';

interface SectionHeaderProps {
  label?: string;
  title: string;
  action?: { text: string; onPress: () => void };
}

export function SectionHeader({ label, title, action }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {label != null && (
          <Text style={styles.label}>{label}</Text>
        )}
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
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
  },
  title: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  action: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: MOOD_ACCENT,
  },
});
