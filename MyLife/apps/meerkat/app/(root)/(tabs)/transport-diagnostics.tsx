// Transport diagnostics debug view (Plan 42 P7 / WP-42E, hidden route).
//
// Renders the HONEST per-rung / per-push-channel diagnostics from the real
// availability seams (getTransportDiagnostics). Every row shows 'available' only
// when its underlying native module / config is truly present; an unavailable row
// shows the machine reason and an honest line. Nothing here fabricates an "on".
// Reached from Settings > Connection options > Transport diagnostics.

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { getTransportDiagnostics } from '../data/transport-diagnostics-runtime';
import type {
  DiagnosticState,
  TransportDiagnostics,
} from '../data/transport-diagnostics';

const RUNG_NAME: Record<string, string> = {
  relay: 'Relay (encrypted meeting point)',
  lan: 'LAN Wi-Fi',
  webrtc: 'Direct peer-to-peer (WebRTC)',
  nearby: 'Nearby (Wi-Fi Direct / Multipeer)',
  ble: 'Bluetooth wake (wake only)',
};

const PUSH_NAME: Record<string, string> = {
  apns: 'Apple Push (APNs)',
  fcm: 'Firebase Cloud Messaging (FCM)',
  webpush: 'Web Push',
};

export default function TransportDiagnosticsScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [diag, setDiag] = useState<TransportDiagnostics | null>(null);
  const [diagError, setDiagError] = useState(false);

  useEffect(() => {
    let alive = true;
    // Without the catch, a probe rejection strands "Reading availability…" forever.
    void getTransportDiagnostics()
      .then((d) => {
        if (alive) setDiag(d);
      })
      .catch(() => {
        if (alive) setDiagError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Deep-linkable screen: back must not dead-end when this is the first route.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const pill = (state: DiagnosticState) => (state === 'available' ? styles.pillOn : styles.pillOff);
  const pillText = (state: DiagnosticState) =>
    state === 'available' ? styles.pillOnText : styles.pillOffText;
  const label = (state: DiagnosticState) => (state === 'available' ? 'Available' : 'Unavailable');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <ChevronLeft size={24} color={c.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Transport diagnostics</Text>
      </View>
      <Text style={styles.subtitle}>
        The honest state of every transport rung and push channel on this build. An
        available rung means its native module is present, not that a session is live.
      </Text>

      <Text style={styles.groupTitle}>Transports</Text>
      <View style={styles.panel}>
        {(diag?.transports ?? []).map((rung) => (
          <View key={rung.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>
                {RUNG_NAME[rung.id] ?? rung.id}
                {rung.carriesData ? '' : ' · wake only'}
              </Text>
              <Text style={styles.rowLine}>{rung.detail}</Text>
              {rung.state === 'unavailable' ? (
                <Text style={styles.reason}>reason: {rung.reason}</Text>
              ) : null}
            </View>
            <View style={pill(rung.state)}>
              <Text style={pillText(rung.state)}>{label(rung.state)}</Text>
            </View>
          </View>
        ))}
        {diag === null ? (
          <Text style={styles.rowLine}>
            {diagError
              ? 'Availability could not be read on this build. Reopen this screen to try again.'
              : 'Reading availability…'}
          </Text>
        ) : null}
      </View>

      <Text style={styles.groupTitle}>Push channels</Text>
      <View style={styles.panel}>
        {(diag?.push ?? []).map((ch) => (
          <View key={ch.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{PUSH_NAME[ch.id] ?? ch.id}</Text>
              <Text style={styles.rowLine}>{ch.detail}</Text>
              {ch.state === 'unavailable' ? (
                <Text style={styles.reason}>reason: {ch.reason}</Text>
              ) : null}
            </View>
            <View style={pill(ch.state)}>
              <Text style={pillText(ch.state)}>{label(ch.state)}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footnote}>
        Push provider acceptance is recorded, never delivery. A rung shown unavailable
        needs a signed dev build (and, for push, a configured gateway) before it can move
        real bytes on hardware.
      </Text>

      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: c.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  groupTitle: { color: c.text, fontSize: 15, fontWeight: '800', marginTop: 4, marginLeft: 4 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  rowLine: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  reason: { color: c.textTertiary, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  pillOn: { borderRadius: MK_RADIUS.pill, backgroundColor: c.successSoft, paddingHorizontal: 10, paddingVertical: 5 },
  pillOnText: { color: c.success, fontSize: 11, fontWeight: '800' },
  pillOff: {
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillOffText: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  footnote: { color: c.textTertiary, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  pressed: { opacity: 0.7 },
});
