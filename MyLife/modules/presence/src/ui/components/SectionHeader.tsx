import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PR_TEXT, PR_TYPOGRAPHY } from '../tokens';

export interface SectionHeaderProps {
  title: string;
  accent?: string;
  action?: ReactNode;
}

export function SectionHeader({
  title,
  accent = PR_TEXT,
  action,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: accent }]}>{title}</Text>
      {action != null && <View>{action}</View>}
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
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
    flex: 1,
  },
});
