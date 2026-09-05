import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_ACCENT, GARDEN_DANGER, GARDEN_SURFACES, GARDEN_TYPOGRAPHY } from './tokens';

interface FrostTimelineTrackProps {
  lastFrost: Date;
  firstFrost: Date;
  currentDate: Date;
  frostFreeDays?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff =
    d.getTime() -
    start.getTime() +
    (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function FrostTimelineTrack({
  lastFrost,
  firstFrost,
  currentDate,
  frostFreeDays,
}: FrostTimelineTrackProps) {
  const daysInYear = 365;
  const lastFrostDay = dayOfYear(lastFrost);
  const firstFrostDay = dayOfYear(firstFrost);
  const currentDay = dayOfYear(currentDate);

  const leftDanger = (lastFrostDay / daysInYear) * 100;
  const rightDangerStart = (firstFrostDay / daysInYear) * 100;
  const rightDangerWidth = 100 - rightDangerStart;
  const currentLeft = (currentDay / daysInYear) * 100;

  return (
    <View style={styles.card}>
      {frostFreeDays != null && (
        <Text style={styles.label}>{frostFreeDays} FROST-FREE DAYS</Text>
      )}
      <View style={styles.track}>
        <View
          style={[
            styles.dangerZone,
            { left: 0, width: `${leftDanger}%` as const },
          ]}
        />
        <View
          style={[
            styles.safeZone,
            {
              left: `${leftDanger}%` as const,
              width: `${Math.max(0, rightDangerStart - leftDanger)}%` as const,
            },
          ]}
        />
        <View
          style={[
            styles.dangerZone,
            {
              left: `${rightDangerStart}%` as const,
              width: `${rightDangerWidth}%` as const,
            },
          ]}
        />
        <View
          style={[styles.marker, { left: `${currentLeft}%` as const }]}
        />
      </View>
      <View style={styles.months}>
        {MONTHS.map((m) => (
          <Text key={m} style={styles.monthLabel}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  label: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: GARDEN_ACCENT,
  },
  track: {
    height: 14,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.depth,
    overflow: 'visible',
    position: 'relative',
  },
  dangerZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: GARDEN_DANGER,
    opacity: 0.35,
    borderRadius: 999,
  },
  safeZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: GARDEN_ACCENT,
    opacity: 0.3,
  },
  marker: {
    position: 'absolute',
    top: -4,
    width: 3,
    height: 22,
    backgroundColor: colors.text,
    borderRadius: 2,
    marginLeft: -1.5,
  },
  months: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.05 * 9,
    color: colors.textTertiary,
  },
});
