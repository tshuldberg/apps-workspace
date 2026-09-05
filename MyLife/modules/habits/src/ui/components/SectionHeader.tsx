import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HB_ACCENT_LIGHT, HB_TEXT, HB_TYPOGRAPHY } from '../tokens';

export interface SectionHeaderProps {
  title: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  accent?: string;
}

export function SectionHeader({
  title,
  action,
  accent = HB_ACCENT_LIGHT,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: HB_TEXT }]}>
        {title}
      </Text>
      {action ? (
        <Pressable hitSlop={8} onPress={action.onPress}>
          <Text style={[styles.action, { color: accent }]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    ...HB_TYPOGRAPHY.headlineMd,
    flex: 1,
  },
  action: {
    ...HB_TYPOGRAPHY.labelUpper,
  },
});
