import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  getRecordings,
  getTrails,
  estimateCalories,
  calculateElevationGain,
  formatDuration,
} from '@mylife/trails';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.trails;

export default function CaloriesScreen() {
  const db = useDatabase();
  const [weightKg, setWeightKg] = useState('75');
  const [packWeightKg, setPackWeightKg] = useState('5');

  const recordings = useMemo(() => getRecordings(db), [db]);
  const trails = useMemo(() => getTrails(db), [db]);
  const weight = parseFloat(weightKg) || 75;
  const packWeight = parseFloat(packWeightKg) || 0;

  // Calculate calories per recording
  const recordingsWithCalories = useMemo(() => {
    return recordings.slice(0, 30).map((rec) => {
      const trail = trails.find((t) => t.id === rec.trailId);
      const distanceKm = (trail?.distanceMeters ?? rec.distanceMeters ?? 0) / 1000;
      const elevationGain = trail?.elevationGainMeters ?? 0;
      const cal = estimateCalories(distanceKm, elevationGain, weight);
      return { rec, trail, calories: cal, distanceKm, elevationGain };
    });
  }, [recordings, trails, weight]);

  const totalCalories = recordingsWithCalories.reduce((sum, r) => sum + r.calories, 0);
  const totalDistanceKm = recordingsWithCalories.reduce((sum, r) => sum + r.distanceKm, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Profile */}
      <Card>
        <Text variant="subheading">Your Profile</Text>
        <View style={styles.formRow}>
          <View style={styles.inputGroup}>
            <Text variant="caption" color={colors.textSecondary}>Body Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text variant="caption" color={colors.textSecondary}>Pack Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={packWeightKg}
              onChangeText={setPackWeightKg}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>
      </Card>

      {/* Totals */}
      <Card>
        <Text variant="subheading">All-Time Totals</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>{Math.round(totalCalories)}</Text>
            <Text variant="caption" color={colors.textSecondary}>Calories</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>{totalDistanceKm.toFixed(1)}</Text>
            <Text variant="caption" color={colors.textSecondary}>km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>{recordings.length}</Text>
            <Text variant="caption" color={colors.textSecondary}>Hikes</Text>
          </View>
        </View>
      </Card>

      {/* Per-recording breakdown */}
      <Card>
        <Text variant="subheading">Per Hike</Text>
        <View style={styles.list}>
          {recordingsWithCalories.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No recordings yet. Complete a hike to see calorie estimates.
            </Text>
          ) : (
            recordingsWithCalories.map(({ rec, trail, calories, distanceKm, elevationGain }) => (
              <View key={rec.id} style={styles.hikeRow}>
                <View style={styles.mainCopy}>
                  <Text variant="body">{trail?.name ?? 'Unknown Trail'}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {rec.startedAt.slice(0, 10)} -- {distanceKm.toFixed(1)}km -- {Math.round(elevationGain)}m gain
                  </Text>
                </View>
                <Text variant="body" color={ACCENT}>{Math.round(calories)} cal</Text>
              </View>
            ))
          )}
        </View>
      </Card>

      {/* Estimation method */}
      <Card>
        <Text variant="subheading">How Calories Are Estimated</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Base calories: distance and body weight{'\n'}
          + Elevation bonus: extra energy for uphill{'\n'}
          + Pack weight factor: heavier loads burn more{'\n'}
          Formula accounts for terrain difficulty and grade.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  formRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  inputGroup: { flex: 1, gap: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  hikeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
});
