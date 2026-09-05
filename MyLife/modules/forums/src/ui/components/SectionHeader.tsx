import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  FR_ACCENT_LIGHT,
  FR_TEXT,
  FR_TYPOGRAPHY,
} from '../tokens';

export interface SectionHeaderProps {
  title: string;
  accent?: string;
  action?: ReactNode;
}

export function SectionHeader({
  title,
  accent = FR_TEXT,
  action,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: accent }]}>{title}</Text>
      {action ?? <Text style={styles.action}>See All</Text>}
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
    ...FR_TYPOGRAPHY.headlineMd,
    flex: 1,
  },
  action: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
});
