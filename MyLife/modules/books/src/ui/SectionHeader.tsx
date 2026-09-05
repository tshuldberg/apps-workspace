import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BOOKS_TYPOGRAPHY } from './tokens';
import { JAKARTA_FONTS } from './typography';

export interface SectionHeaderProps {
  label?: string;
  title: string;
  action?: { text: string; onPress: () => void };
  style?: ViewStyle;
}

export function SectionHeader({ label, title, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textGroup}>
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
    marginBottom: 12,
  },
  textGroup: {
    flex: 1,
  },
  label: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#C9894D',
    marginBottom: 4,
  },
  title: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  action: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#C9894D',
  },
});
