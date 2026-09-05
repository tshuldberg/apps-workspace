import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import {
  GARDEN_ACCENT,
  GARDEN_DANGER,
  GARDEN_SURFACES,
  GARDEN_TERTIARY,
  GARDEN_TYPOGRAPHY,
} from './tokens';
import { GradientButton } from './GradientButton';

interface WateringTimerProps {
  nextWaterAt: Date;
  lastWateredAt: Date;
  intervalDays: number;
  onWater?: () => void;
}

function msToDays(ms: number): number {
  return ms / (1000 * 60 * 60 * 24);
}

export function WateringTimer({
  nextWaterAt,
  lastWateredAt,
  intervalDays,
  onWater,
}: WateringTimerProps) {
  const now = Date.now();
  const msUntilNext = nextWaterAt.getTime() - now;
  const daysUntilNext = msToDays(msUntilNext);
  const overdue = daysUntilNext < 0;

  const elapsedDays = msToDays(now - lastWateredAt.getTime());
  const progress = Math.min(1, Math.max(0, elapsedDays / intervalDays));

  let statusText: string;
  let statusColor: string;
  if (overdue) {
    statusText = `${Math.ceil(Math.abs(daysUntilNext))} DAYS OVERDUE`;
    statusColor = GARDEN_DANGER;
  } else if (daysUntilNext < 1) {
    statusText = 'DUE TODAY';
    statusColor = GARDEN_ACCENT;
  } else {
    const whole = Math.floor(daysUntilNext);
    statusText = `${whole} DAY${whole === 1 ? '' : 'S'}`;
    statusColor = GARDEN_TERTIARY;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>💧</Text>
        <Text style={styles.label}>NEXT WATERING</Text>
      </View>

      <Text style={[styles.countdown, { color: statusColor }]}>
        {statusText}
      </Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: overdue ? GARDEN_DANGER : GARDEN_ACCENT,
            },
          ]}
        />
      </View>

      {onWater != null && (
        <View style={styles.actions}>
          <GradientButton title="Water Now" onPress={onWater} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 16,
    lineHeight: 22,
  },
  label: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  countdown: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.02 * 36,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  actions: {
    alignItems: 'flex-start',
  },
});
