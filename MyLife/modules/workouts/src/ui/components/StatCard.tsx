import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  WK_ACCENT,
  WK_SURFACES,
  WK_TYPOGRAPHY,
} from '../tokens';
import { WK_FONTS } from '../typography';

export interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  footer?: ReactNode;
  height?: number;
  backgroundImage?: string;
}

export function StatCard({
  label,
  value,
  suffix,
  footer,
  height = 160,
  backgroundImage,
}: StatCardProps) {
  return (
    <View style={[styles.card, { minHeight: height }]}>
      {backgroundImage ? <View style={styles.backgroundImageHint} /> : null}

      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{String(value)}</Text>
            {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
          </View>
        </View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 24,
    backgroundColor: WK_SURFACES.low,
    overflow: 'hidden',
  },
  backgroundImageHint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: WK_SURFACES.highest,
    opacity: 0.18,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 20,
  },
  top: {
    gap: 8,
  },
  label: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  value: {
    fontFamily: WK_FONTS.bold,
    fontSize: 30,
    lineHeight: 34,
    color: '#E4E1E9',
    letterSpacing: -0.8,
  },
  suffix: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: WK_ACCENT,
  },
  footer: {
    gap: 8,
  },
});
