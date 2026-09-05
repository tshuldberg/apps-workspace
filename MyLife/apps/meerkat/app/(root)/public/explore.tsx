// Explore (Plan 39 P10, screen S10). Discover, re-homed inside the Public tab: a
// browse surface for the Commons topics (each opens its topic channel) and the
// public communities directory. Every hosted-by-Meerkat surface is verified-members
// only; owner-hosted community feeds may be reachable outside Meerkat, and the
// honesty note says so (NC-P4). The existing Discover directory stays functional and
// is reached from here. Twin of the web PublicExploreView.

import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { HonestNotice, SectionHeader } from '../components/kit';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import { PUBLIC_FEED_TOPICS } from '../data/public-feed';
import { type MkColors, MK_RADIUS } from '../theme/tokens';

// Verbatim Explore copy (mockup S10), parity-locked against the web twin.
export const EXPLORE_TITLE = 'Explore';
export const EXPLORE_TOPICS_TITLE = 'Commons topics';
export const EXPLORE_COMMUNITIES_TITLE = 'Public communities';
export const EXPLORE_COMMUNITIES_CTA = 'Browse public communities';
export const EXPLORE_HONESTY_NOTE = 'Community feeds hosted by their owners may be reachable outside Meerkat. The Commons and everything marked "hosted by Meerkat" is verified-members only.';

export default function PublicExploreScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/public'); }} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <ChevronLeft size={24} color={c.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>{EXPLORE_TITLE}</Text>
      </View>

      <SectionHeader title={EXPLORE_TOPICS_TITLE} hint="" />
      <View style={styles.chipWrap}>
        {PUBLIC_FEED_TOPICS.map((t) => (
          <Text
            key={t.channelId}
            onPress={() => router.push({ pathname: '/public/topic/[channel]', params: { channel: t.channelId } })}
            style={styles.chip}
          >{t.emoji} {t.title}</Text>
        ))}
      </View>

      <SectionHeader title={EXPLORE_COMMUNITIES_TITLE} hint="" />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/discover')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={styles.rowText}>{EXPLORE_COMMUNITIES_CTA}</Text>
        <Text style={styles.rowChevron}>›</Text>
      </Pressable>

      <HonestNotice text={EXPLORE_HONESTY_NOTE} />
      <View style={{ height: insets.bottom + 48 }} />
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  title: { flex: 1, color: c.text, fontSize: 24, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    color: c.textSecondary,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowText: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
  rowChevron: { color: c.textSecondary, fontSize: 20 },
});
