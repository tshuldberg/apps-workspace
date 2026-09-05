import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, colors } from '@mylife/ui';
import {
  isHealthSyncEnabled,
  setHealthSyncToggle,
  getAllSyncLogs,
  type SyncLogEntry,
  HEALTH_ACCENT,
  HEALTH_SECONDARY,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  SectionHeader,
  GlassCard,
  GradientButton,
} from '@mylife/health';
import {
  getHealthSyncStatus,
  probeHealthSyncStatus,
  syncHealthData,
  HEALTH_DATA_TYPES,
  registerBackgroundSync,
  unregisterBackgroundSync,
  isBackgroundSyncRegistered,
} from '../../lib/health-sync';
import { useDatabase } from '../../components/DatabaseProvider';

function formatTimeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function HealthSyncSettingsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [platformReason, setPlatformReason] = useState<string>('');
  const [bgSyncActive, setBgSyncActive] = useState(false);

  const syncStatus = getHealthSyncStatus();

  // Probe platform availability on mount
  useEffect(() => {
    probeHealthSyncStatus()
      .then((status) => {
        setPlatformAvailable(status.available);
        setPlatformReason(status.reason);
      })
      .catch(() => {
        setPlatformAvailable(false);
        setPlatformReason('Unable to probe health sync status');
      });
    isBackgroundSyncRegistered()
      .then(setBgSyncActive)
      .catch(() => setBgSyncActive(false));
  }, []);

  // Check if we have any sync log entries (indicates connection)
  const syncLogs = useMemo(() => {
    try {
      return getAllSyncLogs(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const syncLogMap = useMemo(() => {
    const map: Record<string, SyncLogEntry> = {};
    for (const log of syncLogs) {
      map[log.data_type] = log;
    }
    return map;
  }, [syncLogs]);

  // Connected if we have at least one sync log entry
  useEffect(() => {
    setConnected(syncLogs.length > 0);
  }, [syncLogs]);

  const toggleStates = useMemo(() => {
    const states: Record<string, boolean> = {};
    for (const dt of HEALTH_DATA_TYPES) {
      try {
        states[dt.key] = isHealthSyncEnabled(db, dt.key);
      } catch {
        states[dt.key] = dt.defaultEnabled;
      }
    }
    return states;
  }, [db, tick]);

  const enabledCount = Object.values(toggleStates).filter(Boolean).length;

  const handleToggle = (key: string, value: boolean) => {
    try {
      setHealthSyncToggle(db, key, value);
      refresh();
    } catch {
      Alert.alert('Error', 'Failed to update setting.');
    }
  };

  const handleConnect = async () => {
    // Enable all default data types
    for (const dt of HEALTH_DATA_TYPES) {
      if (dt.defaultEnabled) {
        setHealthSyncToggle(db, dt.key, true);
      }
    }
    refresh();
    await handleSync();
    // Register background sync
    const registered = await registerBackgroundSync({
      syncFn: async () => {
        const result = await syncHealthData(db);
        return result.importedVitals + result.importedSleepSessions + result.importedWeightEntries;
      },
    });
    setBgSyncActive(registered);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Apple Health',
      'This will stop syncing health data. Your previously imported data will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            // Disable all sync toggles
            for (const dt of HEALTH_DATA_TYPES) {
              setHealthSyncToggle(db, dt.key, false);
            }
            // Clear sync cursors (but preserve data per NC-3)
            try {
              db.execute('DELETE FROM hl_sync_log');
            } catch {
              // sync log might not exist
            }
            // Unregister background sync
            await unregisterBackgroundSync();
            setBgSyncActive(false);
            setConnected(false);
            refresh();
            setLastResult('Disconnected. Your health data has been preserved.');
          },
        },
      ],
    );
  };

  const handleSync = async () => {
    setSyncing(true);
    setLastResult(null);
    setSyncProgress('Checking availability...');
    try {
      const status = await probeHealthSyncStatus();
      if (!status.available) {
        setLastResult(status.reason);
        setSyncing(false);
        setSyncProgress(null);
        return;
      }

      setSyncProgress('Syncing health data...');
      const result = await syncHealthData(db);
      setLastResult(result.message);
      setConnected(true);
      refresh();
    } catch (error) {
      setLastResult(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setSyncing(false);
    setSyncProgress(null);
  };

  const platformName = syncStatus.platform === 'ios' ? 'Apple Health' : 'Health Connect';

  // Platform not supported
  if (syncStatus.platform === 'unsupported') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Health Sync</Text>
        </View>
        <GlassCard level={2} style={styles.cardSpacing}>
          <View style={styles.unsupportedContainer}>
            <View style={styles.unsupportedIcon}>
              <Text style={styles.unsupportedIconText}>{'\u{1F4F1}'}</Text>
            </View>
            <Text style={styles.unsupportedTitle}>
              Not Available on This Platform
            </Text>
            <Text style={styles.unsupportedSubtitle}>
              Health sync is only available on iOS and Android. Open MyLife on your phone to connect to Apple Health or Health Connect.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Health Sync</Text>
        <Text style={styles.subtitle}>
          Import health data from {platformName}. All data stays on your device.
        </Text>
      </View>

      {/* Connection Status */}
      {!connected ? (
        <>
          <SectionHeader label="CONNECTION" title="Get Started" />
          <GlassCard level={2} style={styles.cardSpacing}>
            <View style={styles.connectContainer}>
              <View style={styles.connectIconContainer}>
                <Text style={styles.connectIconText}>
                  {syncStatus.platform === 'ios' ? '\u{2764}\u{FE0F}' : '\u{1F3CB}\u{FE0F}'}
                </Text>
              </View>
              <Text style={styles.connectTitle}>
                Connect {platformName}
              </Text>
              <Text style={styles.connectSubtitle}>
                Import your steps, heart rate, sleep, and more. MyLife reads your data but never writes to {platformName}.
              </Text>

              {platformAvailable === false && (
                <View style={styles.errorBadge}>
                  <Text style={styles.errorBadgeText}>{platformReason}</Text>
                </View>
              )}

              <View style={styles.connectButtonWrapper}>
                {syncing ? (
                  <View style={styles.syncingRow}>
                    <ActivityIndicator color={HEALTH_ACCENT} size="small" />
                    <Text style={styles.syncingText}>Connecting...</Text>
                  </View>
                ) : (
                  <GradientButton
                    title={`Connect ${platformName}`}
                    onPress={handleConnect}
                    variant={platformAvailable === false ? 'secondary' : 'primary'}
                  />
                )}
              </View>
            </View>
          </GlassCard>
        </>
      ) : (
        <>
          {/* Connected Status Card */}
          <SectionHeader label="STATUS" title="Connection" />
          <GlassCard level={2} style={styles.cardSpacing}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: HEALTH_SECONDARY }]} />
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>{platformName}</Text>
                <Text style={styles.statusMeta}>
                  {enabledCount} data type{enabledCount !== 1 ? 's' : ''} active
                  {bgSyncActive ? ' \u00B7 Background sync on' : ''}
                </Text>
              </View>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>CONNECTED</Text>
              </View>
            </View>
          </GlassCard>
        </>
      )}

      {/* Sync Progress */}
      {syncing && syncProgress && (
        <GlassCard level={2} style={styles.cardSpacing}>
          <View style={styles.progressRow}>
            <ActivityIndicator color={HEALTH_ACCENT} size="small" />
            <Text style={styles.progressText}>{syncProgress}</Text>
          </View>
        </GlassCard>
      )}

      {/* Data Type Toggles */}
      {connected && (
        <>
          <SectionHeader label="PERMISSIONS" title="Data Types" />
          <GlassCard level={2} style={styles.cardSpacing}>
            {HEALTH_DATA_TYPES.map((dt, i) => {
              const log = syncLogMap[dt.key];
              return (
                <View
                  key={dt.key}
                  style={[styles.toggleRow, i > 0 && styles.toggleDivider]}
                >
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>{dt.label}</Text>
                    <View style={styles.toggleMeta}>
                      {log && log.last_sync_at ? (
                        <Text style={styles.toggleMetaText}>
                          Synced {formatTimeSince(log.last_sync_at)}
                          {log.records_synced > 0 ? ` \u00B7 ${log.records_synced} records` : ''}
                        </Text>
                      ) : (
                        <Text style={styles.toggleMetaText}>Not yet synced</Text>
                      )}
                      {log?.error_message && (
                        <Text style={styles.toggleError}>{log.error_message}</Text>
                      )}
                    </View>
                  </View>
                  <Switch
                    value={toggleStates[dt.key] ?? false}
                    onValueChange={(val) => handleToggle(dt.key, val)}
                    trackColor={{ false: HEALTH_SURFACES.focus, true: HEALTH_ACCENT }}
                  />
                </View>
              );
            })}
          </GlassCard>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {syncing ? (
              <View style={styles.syncingCenterRow}>
                <ActivityIndicator color={HEALTH_ACCENT} size="small" />
                <Text style={styles.syncingText}>Syncing...</Text>
              </View>
            ) : (
              <GradientButton title="Sync Now" onPress={handleSync} variant="primary" />
            )}
            <Pressable style={styles.disconnectButton} onPress={handleDisconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Result message */}
      {lastResult && (
        <GlassCard level={3} style={styles.cardSpacing}>
          <Text style={styles.resultText}>{lastResult}</Text>
        </GlassCard>
      )}

      {/* Privacy Note */}
      <Text style={styles.privacyNote}>
        All health data stays on your device. MyLife never sends your health data to any server.
        {syncStatus.platform === 'ios'
          ? ' Background sync runs when iOS schedules it (typically every 15-30 minutes). It does not run after force-quitting the app.'
          : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Card spacing
  cardSpacing: {
    marginHorizontal: 16,
    marginTop: 8,
  },

  // Unsupported state
  unsupportedContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  unsupportedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: HEALTH_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsupportedIconText: {
    fontSize: 32,
  },
  unsupportedTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
    textAlign: 'center',
  },
  unsupportedSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Connect state
  connectContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  connectIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: HEALTH_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  connectIconText: {
    fontSize: 40,
  },
  connectTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  connectSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  errorBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  errorBadgeText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.danger,
  },
  connectButtonWrapper: {
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  syncingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncingText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Connected status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusInfo: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  statusMeta: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  connectedBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(52,211,153,0.12)',
  },
  connectedBadgeText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: HEALTH_SECONDARY,
  },

  // Sync progress
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  toggleDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
  },
  toggleMeta: {
    gap: 1,
  },
  toggleMetaText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  toggleError: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.danger,
  },

  // Action buttons
  actionButtons: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  syncingCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  disconnectButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  disconnectText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.danger,
  },

  // Result
  resultText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  // Privacy
  privacyNote: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
    lineHeight: 18,
  },
});
