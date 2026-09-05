import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TYPOGRAPHY,
} from '../tokens';

export type StatDisplaySize = 'sm' | 'md' | 'lg';

export interface StatDisplayProps {
  value: string | number;
  unit?: string;
  label: string;
  size?: StatDisplaySize;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP = {
  sm: {
    valueSize: 20,
    unitSize: 11,
    labelSize: 10,
  },
  md: {
    valueSize: 28,
    unitSize: 12,
    labelSize: 10,
  },
  lg: {
    valueSize: 36,
    unitSize: 14,
    labelSize: 11,
  },
} as const;

export function formatStatDisplayValue(value: string | number): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }

  return value.toFixed(1).replace(/\.0$/, '');
}

export function StatDisplay({
  value,
  unit,
  label,
  size = 'md',
  color = TR_TEXT,
  style,
}: StatDisplayProps) {
  const metrics = SIZE_MAP[size];
  const displayValue = formatStatDisplayValue(value);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            {
              color,
              fontSize: metrics.valueSize,
              lineHeight: metrics.valueSize,
            },
          ]}
        >
          {displayValue}
        </Text>
        {unit ? (
          <Text
            style={[
              styles.unit,
              {
                fontSize: metrics.unitSize,
                lineHeight: metrics.unitSize * 1.2,
              },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.label,
          {
            fontSize: metrics.labelSize,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  value: {
    ...TR_TYPOGRAPHY.statDisplay,
    color: TR_TEXT,
  },
  unit: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_SECONDARY,
    marginBottom: 4,
  },
  label: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_SECONDARY,
  },
});
