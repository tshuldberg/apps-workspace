import {
  type DimensionValue,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MD_GLUCOSE_STATUS,
  MD_PILL_RADIUS,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TYPOGRAPHY,
  resolveGlucoseStatus,
  withAlpha,
} from '../tokens';

export interface GlucoseRangeProps {
  value: number;
  unit?: string;
  context?: string;
}

export function getGlucoseRangeMeta(value: number) {
  return resolveGlucoseStatus(value);
}

function getProgressPosition(value: number): DimensionValue {
  const min = 40;
  const max = 260;
  const clamped = Math.max(min, Math.min(max, value));
  const percent = ((clamped - min) / (max - min)) * 100;
  return `${percent}%` as DimensionValue;
}

export function GlucoseRange({
  value,
  unit = 'mg/dL',
  context,
}: GlucoseRangeProps) {
  const meta = resolveGlucoseStatus(value);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.value}>
            {value}
            <Text style={styles.unit}> {unit}</Text>
          </Text>
          <Text style={styles.label}>{meta.label}</Text>
        </View>
        {context ? (
          <View style={styles.contextChip}>
            <Text style={styles.contextText}>{context}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.segment, { backgroundColor: withAlpha(MD_GLUCOSE_STATUS.low, 0.7) }]} />
        <View style={[styles.segment, { backgroundColor: withAlpha(MD_GLUCOSE_STATUS.normal, 0.8) }]} />
        <View style={[styles.segment, { backgroundColor: withAlpha(MD_GLUCOSE_STATUS.high, 0.7) }]} />
        <View
          style={[
            styles.marker,
            {
              backgroundColor: meta.color,
              left: getProgressPosition(value),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  value: {
    ...MD_TYPOGRAPHY.vitalDisplay,
    color: MD_TEXT,
    fontSize: 30,
    lineHeight: 34,
  },
  unit: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  label: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  contextChip: {
    backgroundColor: withAlpha(MD_TEXT_SECONDARY, 0.08),
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  contextText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  track: {
    borderRadius: 999,
    flexDirection: 'row',
    height: 8,
    overflow: 'visible',
    position: 'relative',
  },
  segment: {
    flex: 1,
  },
  marker: {
    borderRadius: 6,
    height: 12,
    marginLeft: -6,
    position: 'absolute',
    top: -2,
    width: 12,
  },
});
