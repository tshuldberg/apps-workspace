import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getWaypointsByRecording,
  getRecording,
  haversineDistance,
} from '@mylife/trails';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.trails;

export default function WaypointDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Find the waypoint across all recordings
  // id is waypoint id -- we need to search
  // For now, show waypoint data if we can find it
  // TODO: Add getWaypointById to CRUD when available

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Waypoint Detail</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Waypoint ID: {id ?? 'unknown'}
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Information</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Waypoint details including coordinates, elevation, category, and photos will display here
          when a direct waypoint lookup is available.
        </Text>
        <View style={styles.list}>
          <View style={styles.detailRow}>
            <Text variant="caption" color={colors.textSecondary}>Category</Text>
            <Text variant="body">--</Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" color={colors.textSecondary}>Elevation</Text>
            <Text variant="body">--</Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" color={colors.textSecondary}>Coordinates</Text>
            <Text variant="body">--</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Categories</Text>
        <View style={styles.chipRow}>
          {['summit', 'junction', 'water source', 'campsite', 'viewpoint', 'hazard'].map((cat) => (
            <View key={cat} style={styles.chip}>
              <Text variant="caption" color={colors.textSecondary}>{cat}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  list: { marginTop: spacing.sm },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
});
