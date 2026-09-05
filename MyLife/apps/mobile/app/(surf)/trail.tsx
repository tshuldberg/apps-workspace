import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  getTrailHikeSummaries,
} from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.surf;

export default function SurfTrailScreen() {
  const db = useDatabase();
  const summaries = useMemo(() => getTrailHikeSummaries(db, 'local'), [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Coastal Trails</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Track hikes to remote surf breaks. Combine trail and surf session data for a complete adventure log.
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Trail Logs</Text>
        <View style={styles.list}>
          {summaries.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No trail hikes recorded yet. Record a hike to a surf spot to see it here.
            </Text>
          ) : (
            summaries.map((summary) => (
              <View key={summary.id} style={styles.trailRow}>
                <View style={styles.mainCopy}>
                  <Text variant="body">{summary.name}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {summary.distanceMeters ? `${(summary.distanceMeters / 1000).toFixed(1)}km` : 'Distance N/A'}
                    {summary.durationSeconds ? ` -- ${Math.round(summary.durationSeconds / 60)}min` : ''}
                    {summary.elevationGainMeters ? ` -- ${Math.round(summary.elevationGainMeters)}m gain` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </Card>

      {/* Features placeholder */}
      <Card>
        <Text variant="subheading">Features</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Navigate to Spot: Link a hiking trail to a surf break{'\n'}
          Offline Maps: Download maps for remote breaks{'\n'}
          Trip Log: Combine hike + surf session data
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  trailRow: {
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { gap: 2 },
});
