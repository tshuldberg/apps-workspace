import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  getSnapshotsByVehicle,
  getCodesBySnapshot,
  getVehicles,
  lookupDtc,
  getDtcSystem,
  getDtcSeverity,
  getRecentLiveData,
  type DiagnosticCode,
  type DiagnosticSnapshot,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

const SEVERITY_COLORS: Record<string, string> = {
  info: colors.textSecondary,
  warning: '#FF9F0A',
  critical: colors.danger,
};

const SYSTEM_LABELS: Record<string, string> = {
  powertrain: 'Powertrain',
  body: 'Body',
  chassis: 'Chassis',
  network: 'Network',
};

export default function SnapshotDetailScreen() {
  const db = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();

  const snapshot: DiagnosticSnapshot | null = useMemo(() => {
    if (!id) return null;
    try {
      const vehicles = getVehicles(db);
      for (const v of vehicles) {
        const snaps = getSnapshotsByVehicle(db, v.id);
        const found = snaps.find((s) => s.id === id);
        if (found) return found;
      }
      return null;
    } catch { return null; }
  }, [db, id]);

  const vehicle = useMemo(() => {
    if (!snapshot) return null;
    try {
      return getVehicles(db).find((v) => v.id === snapshot.vehicleId) ?? null;
    } catch { return null; }
  }, [db, snapshot]);

  const codes: DiagnosticCode[] = useMemo(() => {
    if (!id) return [];
    try { return getCodesBySnapshot(db, id); } catch { return []; }
  }, [db, id]);

  const liveData = useMemo(() => {
    if (!snapshot) return [];
    try { return getRecentLiveData(db, snapshot.vehicleId, 10); } catch { return []; }
  }, [db, snapshot]);

  // Group codes by system
  const grouped = useMemo(() => {
    const map = new Map<string, DiagnosticCode[]>();
    for (const code of codes) {
      const sys = code.system;
      if (!map.has(sys)) map.set(sys, []);
      map.get(sys)!.push(code);
    }
    return map;
  }, [codes]);

  if (!snapshot) {
    return (
      <View style={styles.emptyScreen}>
        <Text variant="subheading" color={colors.textSecondary}>Snapshot not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Snapshot Detail</Text>

      <Card>
        <Text variant="label" color={colors.textTertiary}>SCAN INFO</Text>
        <Text variant="body">Date: {new Date(snapshot.snapshotAt).toLocaleString()}</Text>
        {vehicle && <Text variant="body">Vehicle: {vehicle.name}</Text>}
        {snapshot.protocol && (
          <Text variant="caption" color={colors.textSecondary}>
            Protocol: {snapshot.protocol}
          </Text>
        )}
        <Text variant="caption" color={colors.textSecondary}>
          MIL Status: {snapshot.milStatus ? 'ON' : 'OFF'}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {snapshot.dtcCount} code{snapshot.dtcCount !== 1 ? 's' : ''} found
        </Text>
      </Card>

      {codes.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.success}>No trouble codes detected.</Text>
          </View>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([system, systemCodes]) => (
          <View key={system}>
            <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
              {(SYSTEM_LABELS[system] ?? system).toUpperCase()}
            </Text>
            {systemCodes.map((code) => {
              const dtcInfo = lookupDtc(code.code);
              const sColor = SEVERITY_COLORS[code.severity] ?? colors.textSecondary;
              return (
                <Card key={code.id} style={styles.codeCard}>
                  <View style={styles.codeHeader}>
                    <Text variant="subheading" style={{ color: sColor }}>{code.code}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: sColor }]}>
                      <Text variant="iconCaption" color={colors.background}>
                        {code.severity}
                      </Text>
                    </View>
                  </View>
                  <Text variant="body" color={colors.textSecondary}>
                    {code.description ?? dtcInfo?.description ?? 'Unknown code'}
                  </Text>
                  {code.isPending && (
                    <Text variant="caption" color="#FF9F0A">Pending</Text>
                  )}
                </Card>
              );
            })}
          </View>
        ))
      )}

      {liveData.length > 0 && (
        <>
          <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
            LIVE DATA AT SCAN TIME
          </Text>
          {liveData.map((ld) => (
            <View key={ld.id} style={styles.liveRow}>
              <Text variant="body">{ld.pidName ?? ld.pid}</Text>
              <Text variant="body" style={{ color: ACCENT }}>
                {ld.value}{ld.unit ? ` ${ld.unit}` : ''}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1, backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center' },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },
  codeCard: { backgroundColor: colors.surfaceElevated, marginBottom: spacing.sm },
  codeHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  severityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  liveRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
});
