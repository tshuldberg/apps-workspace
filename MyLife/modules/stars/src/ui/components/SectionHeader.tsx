import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ST_ACCENT_LIGHT, ST_FONTS, ST_TEXT, ST_TEXT_TERTIARY } from '../tokens';

export interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  accent?: string;
  eyebrow?: string;
}

export function SectionHeader({
  title,
  action,
  accent = ST_ACCENT_LIGHT,
  eyebrow,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: ST_TEXT }]}>{title}</Text>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
  },
});
