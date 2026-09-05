import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { WK_TYPOGRAPHY } from '../tokens';

export interface SectionLabelProps {
  children: ReactNode;
  accent?: string;
}

export function SectionLabel({
  children,
  accent = 'rgba(214, 195, 181, 0.72)',
}: SectionLabelProps) {
  return <Text style={[styles.label, { color: accent }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...WK_TYPOGRAPHY.labelUpper,
  },
});
