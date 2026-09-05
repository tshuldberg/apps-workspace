import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  getSpots,
  getSpotAlerts,
  createSpotAlert,
  deleteSpotAlert,
  setSpotAlertActive,
} from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.surf;

export default function AlertsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [minHeight, setMinHeight] = useState('4');
  const [maxWind, setMaxWind] = useState('15');
  const refresh = () => setTick((v) => v + 1);

  const spots = useMemo(() => getSpots(db), [db, tick]);
  const selectedSpot = spots.find((s) => s.id === selectedSpotId) ?? spots[0] ?? null;

  const alerts = useMemo(
    () => (selectedSpot ? getSpotAlerts(db, selectedSpot.id) : []),
    [db, selectedSpot, tick],
  );

  const handleCreateAlert = () => {
    if (!selectedSpot) return;
    const id = `alert_${Date.now()}`;
    createSpotAlert(db, id, {
      userId: 'local',
      spotId: selectedSpot.id,
      name: `Alert for ${selectedSpot.name}`,
      rules: [],
    });
    refresh();
  };

  const handleDelete = (alertId: string) => {
    Alert.alert('Delete Alert', 'Remove this alert?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteSpotAlert(db, alertId); refresh(); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Surf Alerts</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Get notified when conditions match your preferences.
        </Text>
      </Card>

      {/* Spot selector */}
      <View style={styles.chipRow}>
        {spots.slice(0, 10).map((spot) => {
          const selected = spot.id === selectedSpot?.id;
          return (
            <Pressable
              key={spot.id}
              onPress={() => setSelectedSpotId(spot.id)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                {spot.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Active alerts */}
      <Card>
        <Text variant="subheading">Active Alerts</Text>
        <View style={styles.list}>
          {alerts.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No alerts set up. Create one below.
            </Text>
          ) : (
            alerts.map((alert) => (
              <View key={alert.id} style={styles.alertRow}>
                <View style={styles.mainCopy}>
                  <Text variant="body">{alert.name}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {alert.isActive ? 'Active' : 'Paused'} -- {alert.rules.length} rule{alert.rules.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Pressable onPress={() => { setSpotAlertActive(db, alert.id, !alert.isActive); refresh(); }}>
                  <Text variant="caption" color={ACCENT}>
                    {alert.isActive ? 'Pause' : 'Enable'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(alert.id)}>
                  <Text variant="caption" color={colors.danger}>Delete</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </Card>

      {/* Quick create */}
      {selectedSpot && (
        <Card>
          <Text variant="subheading">Quick Create Alert</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Creates a basic alert for {selectedSpot.name}. Customize rules after creation.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleCreateAlert}>
            <Text variant="label" color={colors.background}>Create Alert</Text>
          </Pressable>
        </Card>
      )}

      {/* Template alerts */}
      <Card>
        <Text variant="subheading">Alert Templates</Text>
        <View style={styles.list}>
          <View style={styles.templateRow}>
            <Text variant="body">Epic Day</Text>
            <Text variant="caption" color={colors.textSecondary}>6ft+, offshore, good tide</Text>
          </View>
          <View style={styles.templateRow}>
            <Text variant="body">Beginner Friendly</Text>
            <Text variant="caption" color={colors.textSecondary}>Under 3ft, light wind</Text>
          </View>
          <View style={styles.templateRow}>
            <Text variant="body">Dawn Patrol</Text>
            <Text variant="caption" color={colors.textSecondary}>Morning alerts only, 4ft+</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  templateRow: {
    gap: 2, padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm,
  },
});
