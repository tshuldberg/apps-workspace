/**
 * Settings > Sync Activity.
 *
 * Shows recent sync sessions with transport badges, durations, and
 * byte totals. Each session is expandable to show per-module byte
 * breakdown. A workspace filter dropdown sits at the top.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import {
  getRecentSyncSessions,
  getModuleStatsBySession,
  getWorkspaces,
  getPairedDevice,
} from '@mylife/sync';
import type {
  SyncSession,
  SyncSessionModuleStats,
  SyncWorkspace,
} from '@mylife/sync';
import { useDatabase } from '../../../components/DatabaseProvider';

const TRANSPORT_LABELS: Record<string, string> = {
  lan: 'LAN',
  nearby: 'Nearby',
  ble: 'BLE',
  wan_webrtc: 'WebRTC',
  wan_relay: 'Relay',
};

const TRANSPORT_COLORS: Record<string, string> = {
  lan: colors.success,
  nearby: colors.tertiary,
  ble: '#A78BFA',
  wan_webrtc: colors.primary,
  wan_relay: colors.warning,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export default function SyncActivityScreen() {
  const db = useDatabase();
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [workspaces, setWorkspaces] = useState<SyncWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [moduleStats, setModuleStats] = useState<Record<string, SyncSessionModuleStats[]>>({});

  const refresh = useCallback(() => {
    setSessions(getRecentSyncSessions(db, 50));
    setWorkspaces(getWorkspaces(db));
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleExpand = useCallback(
    (sessionId: string) => {
      if (expandedId === sessionId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(sessionId);
      if (!moduleStats[sessionId]) {
        const stats = getModuleStatsBySession(db, sessionId);
        setModuleStats((prev) => ({ ...prev, [sessionId]: stats }));
      }
    },
    [db, expandedId, moduleStats],
  );

  const filteredSessions = selectedWorkspaceId
    ? sessions.filter((s) => s.workspaceId === selectedWorkspaceId)
    : sessions;

  const getPeerName = useCallback(
    (deviceId: string): string => {
      const device = getPairedDevice(db, deviceId);
      return device?.displayName ?? deviceId.slice(0, 12) + '...';
    },
    [db],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Activity</Text>
        <Text style={styles.subtitle}>
          Recent sync sessions across your devices.
        </Text>
      </View>

      {/* Workspace filter */}
      {workspaces.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            style={[styles.filterChip, !selectedWorkspaceId && styles.filterChipActive]}
            onPress={() => setSelectedWorkspaceId(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                !selectedWorkspaceId && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {workspaces.map((ws) => (
            <Pressable
              key={ws.id}
              style={[
                styles.filterChip,
                selectedWorkspaceId === ws.id && styles.filterChipActive,
              ]}
              onPress={() => setSelectedWorkspaceId(ws.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedWorkspaceId === ws.id && styles.filterChipTextActive,
                ]}
              >
                {ws.displayName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Sessions */}
      {filteredSessions.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyBody}>No sync sessions yet.</Text>
        </View>
      ) : null}

      {filteredSessions.map((session) => {
        const expanded = expandedId === session.id;
        const stats = moduleStats[session.id];
        return (
          <Pressable
            key={session.id}
            style={styles.card}
            onPress={() => toggleExpand(session.id)}
            accessibilityLabel={`session-${session.id}`}
          >
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.peerName}>{getPeerName(session.peerDeviceId)}</Text>
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.transportBadge,
                      {
                        backgroundColor:
                          TRANSPORT_COLORS[session.transport] ?? colors.outline,
                      },
                    ]}
                  >
                    <Text style={styles.transportBadgeText}>
                      {TRANSPORT_LABELS[session.transport] ?? session.transport}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>
                    {formatDuration(session.durationMs)} ·{' '}
                    {formatBytes(session.bytesSent + session.bytesReceived)}
                  </Text>
                </View>
              </View>
              <Text style={styles.statusDot}>
                {session.status === 'completed'
                  ? '✓'
                  : session.status === 'partial'
                    ? '◐'
                    : '✗'}
              </Text>
            </View>

            {/* Expanded module breakdown */}
            {expanded && stats ? (
              <View style={styles.breakdown}>
                {stats.map((ms) => (
                  <View key={ms.moduleId} style={styles.breakdownRow}>
                    <Text style={styles.breakdownModule}>{ms.moduleId}</Text>
                    <Text style={styles.breakdownBytes}>
                      ↑{formatBytes(ms.bytesSent)} ↓{formatBytes(ms.bytesReceived)}
                    </Text>
                  </View>
                ))}
                {stats.length === 0 ? (
                  <Text style={styles.metaText}>No per-module data recorded.</Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  filterRow: { gap: spacing.sm, paddingBottom: spacing.xs },
  filterChip: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipActive: { backgroundColor: colors.primaryContainer },
  filterChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: colors.text },
  card: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: 4 },
  peerName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  transportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  transportBadgeText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaText: { color: colors.textSecondary, fontSize: 12 },
  statusDot: { fontSize: 16, color: colors.textSecondary },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  breakdown: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownModule: { color: colors.text, fontSize: 13, fontWeight: '500' },
  breakdownBytes: { color: colors.textSecondary, fontSize: 12 },
});
