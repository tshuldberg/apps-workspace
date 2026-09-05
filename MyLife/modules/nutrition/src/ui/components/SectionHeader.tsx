import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NU_TEXT, NU_TYPOGRAPHY } from '../tokens';

export interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  accent?: string;
}

export function SectionHeader({
  title,
  action,
  accent = NU_TEXT,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: accent }]}>{title}</Text>
      {action ? <View>{action}</View> : null}
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
    ...NU_TYPOGRAPHY.headlineMd,
  },
});
