import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  MD_ACCENT,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TYPOGRAPHY,
} from '../tokens';

export interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  accent?: string;
}

export function SectionHeader({
  title,
  action,
  accent = MD_ACCENT,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  accentBar: {
    borderRadius: 999,
    height: 12,
    width: 3,
  },
  title: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    flexShrink: 1,
  },
  action: {
    alignItems: 'flex-end',
  },
});
