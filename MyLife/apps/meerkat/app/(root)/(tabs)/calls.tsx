// Plan 25 WP-25G: the call history list.
//
// Renders ONLY real device-local call_log rows (written through foldCallLog,
// so a ring-only call never shows a duration and the outcome is the true
// terminal phase). call_ tables never replicate (NC-25.7): this history is
// this device's history, and the copy says so.

import { useCallback, useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react-native';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useCall } from '../providers/CallProvider';
import { useSync } from '../providers/SyncProvider';
import { listCallLog } from '../data/call-store';
import { callLogSummary, startCallFailureCopy, type CallLogRow } from '../data/call-log-core';
import { shortHex, type MkColors } from '../theme/tokens';

export default function CallsScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { historyRevision, canCallPeer, startCall, capability } = useCall();
  const { pairedDevices } = useSync();

  const rows = useMemo(() => {
    void historyRevision;
    return listCallLog(db);
  }, [db, historyRevision]);

  const nameFor = useCallback((deviceId: string): string => {
    const device = pairedDevices.find((d) => d.deviceId === deviceId);
    return device?.displayName || shortHex(deviceId);
  }, [pairedDevices]);

  // A failed start must surface: silently dropping the result union is a dead
  // tap. startCall itself rejects a second concurrent start with 'busy'.
  const callBack = useCallback((row: CallLogRow) => {
    if (!canCallPeer(row.peerDeviceId)) return;
    void (async () => {
      try {
        const result = await startCall(row.peerDeviceId, row.kind);
        if (!result.ok) {
          Alert.alert('Could not start the call', startCallFailureCopy(result.reason, 'app'));
        }
      } catch {
        Alert.alert('Could not start the call', startCallFailureCopy('unknown', 'app'));
      }
    })();
  }, [canCallPeer, startCall]);

  const renderRow = useCallback(({ item }: { item: CallLogRow }) => {
    const missed = item.outcome === 'missed' || item.outcome === 'failed';
    const DirectionIcon = missed
      ? PhoneMissed
      : item.direction === 'incoming'
        ? PhoneIncoming
        : PhoneOutgoing;
    const callable = canCallPeer(item.peerDeviceId);
    return (
      <View style={styles.row}>
        <DirectionIcon size={18} color={missed ? c.danger : c.textSecondary} strokeWidth={2} />
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>{nameFor(item.peerDeviceId)}</Text>
          <Text style={[styles.rowSummary, missed && styles.rowSummaryMissed]} numberOfLines={1}>
            {callLogSummary(item)}
          </Text>
        </View>
        {callable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${nameFor(item.peerDeviceId)} back`}
            onPress={() => callBack(item)}
            style={({ pressed }) => [styles.callBackBtn, pressed && styles.pressed]}
          >
            {item.kind === 'video'
              ? <Video size={17} color={c.accent} strokeWidth={2} />
              : <Phone size={17} color={c.accent} strokeWidth={2} />}
          </Pressable>
        ) : null}
      </View>
    );
  }, [styles, c, nameFor, canCallPeer, callBack]);

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/messages'); }}
          style={styles.iconBtn}
        >
          <ArrowLeft size={20} color={c.text} strokeWidth={1.9} />
        </Pressable>
        <Text style={styles.title}>Calls</Text>
      </View>
      {!capability.mediaAvailable ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            Calls need the full app build. This list still shows calls recorded on this device.
          </Text>
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        renderItem={renderRow}
        contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.list}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No calls yet</Text>
            <Text style={styles.noticeText}>
              Call history is stored only on this device and never syncs anywhere.
            </Text>
          </View>
        )}
      />
    </View>
  );
}

function makeStyles(c: MkColors) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
    iconBtn: { padding: 6 },
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    list: { paddingHorizontal: 14, paddingBottom: 24, gap: 8 },
    emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    rowName: { color: c.text, fontSize: 15, fontWeight: '700' },
    rowSummary: { color: c.textSecondary, fontSize: 12.5 },
    rowSummaryMissed: { color: c.danger },
    callBackBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceHigh,
    },
    noticeCard: {
      marginHorizontal: 14,
      marginBottom: 10,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      padding: 12,
    },
    noticeText: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
    emptyCard: { alignItems: 'center', gap: 6 },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
}
