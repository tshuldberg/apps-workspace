import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { getCapabilityStatus, type CapabilityLevel } from '../data/capability-status';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { Button, HonestNotice } from '../components/kit';
import { acceptPublicTerms, hasAcceptedPublicTerms, publicLegalConfig } from '../data/public-safety';
import { useState } from 'react';

const STATUS_LABEL: Record<CapabilityLevel, string> = {
  live: 'Live',
  partial: 'Partial',
  pending: 'Not built yet',
};

export default function AboutStatusScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const legal = useMemo(() => publicLegalConfig(), []);
  const [accepted, setAccepted] = useState(() => hasAcceptedPublicTerms(db));
  const [linkError, setLinkError] = useState<string | null>(null);
  const entries = useMemo(() => getCapabilityStatus(), []);

  // Deep-linkable screen: back must not dead-end when this is the first route.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/me');
  };

  const openLegalUrl = (url: string): void => {
    void Linking.openURL(url)
      .then(() => setLinkError(null))
      .catch(() => setLinkError('That link could not be opened on this device.'));
  };

  const pillStyle = (status: CapabilityLevel) =>
    status === 'live' ? styles.pillLive : status === 'partial' ? styles.pillPartial : styles.pillPending;
  const pillTextStyle = (status: CapabilityLevel) =>
    status === 'live' ? styles.pillLiveText : status === 'partial' ? styles.pillPartialText : styles.pillPendingText;

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
        <Text style={styles.title}>What works today</Text>
      </View>
      <Text style={styles.subtitle}>An honest map of what Meerkat can and cannot do right now.</Text>

      <View style={styles.panel}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{entry.title}</Text>
              <Text style={styles.rowLine}>{entry.line}</Text>
            </View>
            <View style={pillStyle(entry.status)}>
              <Text style={pillTextStyle(entry.status)}>{STATUS_LABEL[entry.status]}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.legalTitle}>Legal and safety</Text>
        <Text style={styles.rowLine}>Public posting requires acceptance of the Terms of Use and Community Standards.</Text>
        {([
          ['Privacy Policy', legal.privacyUrl],
          ['Terms of Use', legal.termsUrl],
          ['Community Standards', legal.standardsUrl],
          ['Safety support and appeals', legal.supportUrl],
        ] as const).map(([label, url]) => (
          <Pressable key={label} accessibilityRole="link" disabled={!url} onPress={() => openLegalUrl(url)} style={styles.legalLink}>
            <Text style={styles.legalLinkText}>{label}</Text>
          </Pressable>
        ))}
        {linkError ? <Text style={styles.rowLine}>{linkError}</Text> : null}
        {!Object.values(legal).every((url) => url.startsWith('https://')) ? (
          <HonestNotice text="Policy links are not configured in this build. Public posting stays unavailable." />
        ) : accepted ? (
          <Text style={styles.rowLine}>Terms and Community Standards accepted on this device.</Text>
        ) : (
          <Button title="I agree to the Terms and Community Standards" onPress={() => { acceptPublicTerms(db); setAccepted(true); }} />
        )}
      </View>

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
  pillLive: { borderRadius: MK_RADIUS.pill, backgroundColor: c.successSoft, paddingHorizontal: 10, paddingVertical: 5 },
  pillLiveText: { color: c.success, fontSize: 11, fontWeight: '800' },
  pillPartial: { borderRadius: MK_RADIUS.pill, backgroundColor: c.surfaceHigh, paddingHorizontal: 10, paddingVertical: 5 },
  pillPartialText: { color: c.warning, fontSize: 11, fontWeight: '800' },
  pillPending: { borderRadius: MK_RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderStrong, paddingHorizontal: 10, paddingVertical: 5 },
  pillPendingText: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  legalTitle: { color: c.text, fontSize: 17, fontWeight: '800', padding: 8 },
  legalLink: { paddingHorizontal: 8, paddingVertical: 11 },
  legalLinkText: { color: c.accent, fontSize: 14, fontWeight: '700' },
});
