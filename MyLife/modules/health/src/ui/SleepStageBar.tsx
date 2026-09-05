import { StyleSheet, Text, View } from 'react-native';
import { HEALTH_TYPOGRAPHY, HEALTH_SURFACES } from './tokens';
import { colors } from '@mylife/ui';

interface Stage {
  name: string;
  duration: number;
  color: string;
}

interface SleepStageBarProps {
  stages: Stage[];
}

export function SleepStageBar({ stages }: SleepStageBarProps) {
  const total = stages.reduce((sum, s) => sum + s.duration, 0);

  if (total === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyBar} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {stages.map((stage, i) => {
          const pct = (stage.duration / total) * 100;
          return (
            <View
              key={i}
              style={[
                styles.segment,
                {
                  width: `${pct}%`,
                  backgroundColor: stage.color,
                  borderTopLeftRadius: i === 0 ? 4 : 0,
                  borderBottomLeftRadius: i === 0 ? 4 : 0,
                  borderTopRightRadius: i === stages.length - 1 ? 4 : 0,
                  borderBottomRightRadius: i === stages.length - 1 ? 4 : 0,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        {stages.map((stage, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: stage.color }]} />
            <Text style={styles.legendText}>{stage.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: HEALTH_SURFACES.focus,
    overflow: 'hidden',
  },
  emptyBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: HEALTH_SURFACES.focus,
  },
  segment: {
    height: 8,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
});
