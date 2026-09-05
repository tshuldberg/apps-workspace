import { StyleSheet, Text, View } from 'react-native';
import {
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TYPOGRAPHY,
  resolveVitalStatusColor,
} from '../tokens';

type VitalStatSize = 'sm' | 'md' | 'lg';

const VALUE_SIZE_MAP = {
  sm: 28,
  md: 36,
  lg: 44,
} as const;

export interface VitalStatProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: string;
  size?: VitalStatSize;
}

export function VitalStat({
  label,
  value,
  unit,
  status,
  size = 'md',
}: VitalStatProps) {
  const color = resolveVitalStatusColor(status);
  const valueSize = VALUE_SIZE_MAP[size];

  return (
    <View style={styles.container}>
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            {
              color,
              fontSize: valueSize,
              lineHeight: valueSize + 4,
            },
          ]}
        >
          {value}
        </Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  valueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  value: {
    ...MD_TYPOGRAPHY.vitalDisplay,
    color: MD_TEXT,
  },
  unit: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
    marginBottom: 7,
  },
  label: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
});
