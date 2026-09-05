import { StyleSheet, Text, View } from 'react-native';
import {
  NU_MACROS,
  NU_SURFACES,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
} from '../tokens';

export type MacroLabel = 'protein' | 'carbs' | 'fat' | 'fiber';

export interface MacroBarProps {
  label: MacroLabel;
  grams: number;
  goalGrams: number;
  color?: string;
}

export function getMacroGoalPercent(grams: number, goalGrams: number): number {
  if (goalGrams <= 0) {
    return 0;
  }

  return Math.max(0, Math.min((grams / goalGrams) * 100, 100));
}

export function MacroBar({
  label,
  grams,
  goalGrams,
  color,
}: MacroBarProps) {
  const resolvedColor = color ?? NU_MACROS[label];
  const percent = getMacroGoalPercent(grams, goalGrams);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: resolvedColor }]}>
          {Math.round(grams)}g
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${percent}%`,
              backgroundColor: resolvedColor,
            },
          ]}
        />
      </View>
      <Text style={styles.meta}>{Math.round(percent)}% of goal</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NU_SURFACES.low,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  label: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
  },
  value: {
    ...NU_TYPOGRAPHY.bodyMd,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: NU_SURFACES.highest,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  meta: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
});
