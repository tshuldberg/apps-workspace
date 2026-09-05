import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  getSpotById,
  getSpotForecast,
  computeSpotRating,
  computeEnergy,
  classifyWind,
  windScore,
  scoreTide,
  starsToColor,
} from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.surf;

export default function RatingDetailScreen() {
  const db = useDatabase();
  const { spotId } = useLocalSearchParams<{ spotId: string }>();

  const spot = useMemo(() => (spotId ? getSpotById(db, spotId) : null), [db, spotId]);
  const forecasts = useMemo(() => (spotId ? getSpotForecast(db, spotId) : []), [db, spotId]);
  const latestForecast = forecasts[0] ?? null;

  if (!spot) {
    return (
      <View style={styles.center}>
        <Text variant="body" color={colors.textSecondary}>Spot not found.</Text>
      </View>
    );
  }

  // Compute sub-ratings from latest forecast
  const spotOrientation = spot.swellDirection === 'N' ? 0 : spot.swellDirection === 'S' ? 180 : spot.swellDirection === 'E' ? 90 : 270;
  const windScoreVal = latestForecast
    ? windScore(latestForecast.windSpeedKts, latestForecast.windDirectionDegrees, spotOrientation)
    : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.heroCard}>
        <Text variant="subheading">{spot.name}</Text>
        <Text style={[styles.heroValue, { color: ACCENT }]}>
          {latestForecast ? `${latestForecast.rating}/5` : 'N/A'}
        </Text>
        {latestForecast && (
          <Text variant="caption" color={starsToColor(latestForecast.rating)}>
            {latestForecast.conditionColor.toUpperCase()}
          </Text>
        )}
      </Card>

      {/* Sub-ratings */}
      {latestForecast && (
        <Card>
          <Text variant="subheading">Rating Breakdown</Text>
          <View style={styles.list}>
            <RatingBar label="Swell Quality" value={latestForecast.energyKj > 0 ? Math.min(5, latestForecast.energyKj / 20) : 0} max={5} />
            <RatingBar label="Wind Score" value={windScoreVal} max={5} />
            <RatingBar label="Consistency" value={latestForecast.consistencyScore / 20} max={5} />
          </View>
        </Card>
      )}

      {/* Detailed conditions */}
      {latestForecast && (
        <Card>
          <Text variant="subheading">Current Conditions</Text>
          <View style={styles.detailList}>
            <DetailRow label="Wave Height" value={`${latestForecast.waveHeightMinFt}-${latestForecast.waveHeightMaxFt} ft`} />
            <DetailRow label="Wind" value={`${latestForecast.windSpeedKts} kts (${latestForecast.windLabel})`} />
            <DetailRow label="Gusts" value={`${latestForecast.windGustKts} kts`} />
            <DetailRow label="Energy" value={`${latestForecast.energyKj.toFixed(1)} kJ`} />
            <DetailRow label="Consistency" value={`${latestForecast.consistencyScore}%`} />
            {latestForecast.waterTempF != null && (
              <DetailRow label="Water Temp" value={`${latestForecast.waterTempF}F`} />
            )}
          </View>
        </Card>
      )}

      {/* Ideal conditions reference */}
      <Card>
        <Text variant="subheading">Ideal Conditions for {spot.name}</Text>
        <View style={styles.detailList}>
          <DetailRow label="Break Type" value={spot.breakType} />
          <DetailRow label="Best Tide" value={spot.tide} />
          <DetailRow label="Best Swell" value={spot.swellDirection} />
          <DetailRow label="Skill Level" value={spot.skillLevel ?? 'All levels'} />
        </View>
      </Card>
    </ScrollView>
  );
}

function RatingBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={ratingStyles.row}>
      <Text variant="body" style={ratingStyles.label}>{label}</Text>
      <View style={ratingStyles.track}>
        <View style={[ratingStyles.fill, { width: `${pct}%` }]} />
      </View>
      <Text variant="caption" color={colors.textSecondary} style={ratingStyles.pct}>{pct}%</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const ratingStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 100 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceElevated, overflow: 'hidden' as const },
  fill: { height: 6, borderRadius: 3, backgroundColor: ACCENT },
  pct: { width: 36, textAlign: 'right' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  heroCard: { alignItems: 'center', gap: spacing.xs },
  heroValue: { fontSize: 42, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  detailList: { marginTop: spacing.sm },
});
