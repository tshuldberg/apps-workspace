import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BG_ACCENT, BG_TEXT, BG_TYPOGRAPHY } from '../tokens';

export interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

export function SectionHeader({
  title,
  action,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action != null ? <View style={styles.action}>{action}</View> : null}
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
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
    flex: 1,
  },
  action: {
    minWidth: 0,
  },
});
