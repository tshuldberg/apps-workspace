import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MK_ACCENT, MK_TEXT, MK_TYPOGRAPHY } from '../tokens';

export interface SectionHeaderProps {
  title: string;
  action?: {
    label?: string;
    onPress: () => void;
  };
  accent?: string;
}

export function SectionHeader({
  title,
  action,
  accent = MK_ACCENT,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.action, { color: accent }]}>
            {action.label ?? 'See All'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
    flex: 1,
  },
  action: {
    ...MK_TYPOGRAPHY.labelUpper,
  },
});
