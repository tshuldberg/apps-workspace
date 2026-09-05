import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getTopEmotions,
  GlassCard,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

// Plutchik axis groupings with colors
const PLUTCHIK_AXES: Record<string, { color: string; emoji: string; role: string }> = {
  ecstasy: { color: '#FDE047', emoji: '\uD83E\uDD29', role: 'Joy' },
  joy: { color: '#FDE047', emoji: '\uD83D\uDE04', role: 'Joy' },
  serenity: { color: '#FDE047', emoji: '\uD83D\uDE0C', role: 'Joy' },
  admiration: { color: '#4ADE80', emoji: '\uD83E\uDD70', role: 'Trust' },
  trust: { color: '#4ADE80', emoji: '\uD83E\uDD1D', role: 'Trust' },
  acceptance: { color: '#4ADE80', emoji: '\uD83D\uDE42', role: 'Trust' },
  terror: { color: '#34D399', emoji: '\uD83D\uDE31', role: 'Fear' },
  fear: { color: '#34D399', emoji: '\uD83D\uDE28', role: 'Fear' },
  apprehension: { color: '#34D399', emoji: '\uD83D\uDE1F', role: 'Fear' },
  amazement: { color: '#22D3EE', emoji: '\uD83E\uDD2F', role: 'Surprise' },
  surprise: { color: '#22D3EE', emoji: '\uD83D\uDE2E', role: 'Surprise' },
  distraction: { color: '#22D3EE', emoji: '\uD83D\uDE11', role: 'Surprise' },
  grief: { color: '#60A5FA', emoji: '\uD83D\uDE2D', role: 'Sadness' },
  sadness: { color: '#60A5FA', emoji: '\uD83D\uDE22', role: 'Sadness' },
  pensiveness: { color: '#60A5FA', emoji: '\uD83D\uDE14', role: 'Sadness' },
  loathing: { color: '#A78BFA', emoji: '\uD83E\uDD22', role: 'Disgust' },
  disgust: { color: '#A78BFA', emoji: '\uD83D\uDE12', role: 'Disgust' },
  boredom: { color: '#A78BFA', emoji: '\uD83D\uDE34', role: 'Disgust' },
  rage: { color: '#F87171', emoji: '\uD83E\uDD2C', role: 'Anger' },
  anger: { color: '#F87171', emoji: '\uD83D\uDE21', role: 'Anger' },
  annoyance: { color: '#F87171', emoji: '\uD83D\uDE24', role: 'Anger' },
  vigilance: { color: '#FB923C', emoji: '\uD83D\uDC40', role: 'Anticipation' },
  anticipation: { color: '#FB923C', emoji: '\uD83D\uDD2E', role: 'Anticipation' },
  interest: { color: '#FB923C', emoji: '\uD83E\uDD14', role: 'Anticipation' },
};

const ROLE_LABELS = [
  'PRIMARY DRIVER',
  'STABILIZING FORCE',
  'EMERGING PATTERN',
  'QUIET PRESENCE',
  'UNDERCURRENT',
];

type DateRange = 'week' | 'month' | 'year' | 'all';

const RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'All Time', value: 'all' },
];

function getDateBounds(range: DateRange): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  switch (range) {
    case 'week':
      return { start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), end };
    case 'month':
      return { start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), end };
    case 'year':
      return { start: new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10), end };
    case 'all':
      return { start: '2000-01-01', end };
  }
}

export default function MoodTopEmotionsScreen() {
  const db = useDatabase();
  const [range, setRange] = useState<DateRange>('month');
  const [showPicker, setShowPicker] = useState(false);

  const { start, end } = useMemo(() => getDateBounds(range), [range]);
  const emotions = useMemo(() => getTopEmotions(db, start, end, 20), [db, start, end]);
  const totalCount = useMemo(() => emotions.reduce((s, e) => s + e.count, 0), [emotions]);

  // Top 2 are featured cards, rest are smaller
  const featured = emotions.slice(0, 2);
  const secondary = emotions.slice(2, 4);
  const remaining = emotions.slice(4);

  // Wheel segments for pie chart
  const segments = useMemo(() => {
    if (totalCount === 0) return [];
    return emotions.slice(0, 8).map((e) => ({
      emotion: e.emotion,
      pct: (e.count / totalCount) * 100,
      color: PLUTCHIK_AXES[e.emotion]?.color ?? MOOD_ACCENT,
    }));
  }, [emotions, totalCount]);

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? 'This Month';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>EMOTION ANALYTICS</Text>
        <Text style={styles.headerTitle}>Top Emotions</Text>
      </View>

      {/* Date Range Picker */}
      <View style={styles.pickerContainer}>
        <Pressable
          style={styles.pickerButton}
          onPress={() => setShowPicker(!showPicker)}
        >
          <Text style={styles.pickerIcon}>{'\uD83D\uDCC5'}</Text>
          <Text style={styles.pickerText}>{rangeLabel}</Text>
          <Text style={styles.pickerChevron}>{showPicker ? '\u25B2' : '\u25BC'}</Text>
        </Pressable>
        {showPicker && (
          <View style={styles.pickerDropdown}>
            {RANGE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.pickerOption, range === opt.value && styles.pickerOptionActive]}
                onPress={() => { setRange(opt.value); setShowPicker(false); }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  range === opt.value && styles.pickerOptionTextActive,
                ]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {emotions.length === 0 ? (
        <GlassCard level={2} style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>{'\uD83D\uDC8E'}</Text>
          <Text style={styles.emptyTitle}>No Emotion Data Yet</Text>
          <Text style={styles.emptyBody}>
            Add emotion tags to your mood entries to see your emotional spectrum.
          </Text>
        </GlassCard>
      ) : (
        <>
          {/* Spectrum Map (simplified donut visualization) */}
          <GlassCard level={2} style={styles.spectrumCard}>
            <Text style={styles.sectionLabel}>EMOTIONAL SPECTRUM MAP</Text>
            <View style={styles.donutContainer}>
              <View style={styles.donutRing}>
                {segments.map((seg, i) => {
                  const angle = segments.slice(0, i).reduce((s, sg) => s + sg.pct * 3.6, 0);
                  const size = Math.max(seg.pct * 1.2, 8);
                  return (
                    <View
                      key={seg.emotion}
                      style={[
                        styles.donutSegment,
                        {
                          backgroundColor: seg.color,
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          transform: [
                            { rotate: `${angle}deg` },
                            { translateX: 50 },
                          ],
                        },
                      ]}
                    />
                  );
                })}
                <View style={styles.donutCenter}>
                  <Text style={styles.donutCenterIcon}>{'\uD83D\uDCC8'}</Text>
                </View>
              </View>
              {/* Segment bars below donut */}
              <View style={styles.spectrumBars}>
                {segments.map((seg) => (
                  <View
                    key={seg.emotion}
                    style={[
                      styles.spectrumBar,
                      { flex: seg.pct, backgroundColor: seg.color },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.spectrumSummary}>
              Your <Text style={{ color: MOOD_ACCENT }}>
                {emotions[0]?.emotion.charAt(0).toUpperCase()}{emotions[0]?.emotion.slice(1)}
              </Text> states make up {totalCount > 0 ? Math.round((emotions[0]?.count / totalCount) * 100) : 0}% of your
              emotional landscape this period.
            </Text>
          </GlassCard>

          {/* Featured Emotion Cards */}
          {featured.map((item, idx) => {
            const meta = PLUTCHIK_AXES[item.emotion];
            const barColor = meta?.color ?? MOOD_ACCENT;
            const emoji = meta?.emoji ?? '\uD83D\uDE36';
            const roleLabel = ROLE_LABELS[idx] ?? 'NOTABLE';
            return (
              <GlassCard key={item.emotion} level={2} style={styles.featuredCard}>
                <View style={styles.featuredRow}>
                  <View style={styles.featuredInfo}>
                    <Text style={styles.featuredEmoji}>{emoji}</Text>
                    <Text style={styles.featuredName}>
                      {item.emotion.charAt(0).toUpperCase() + item.emotion.slice(1)}
                    </Text>
                    <Text style={styles.featuredRole}>{roleLabel}</Text>
                  </View>
                  <Text style={[styles.featuredCount, { color: barColor }]}>{item.count}</Text>
                </View>
                <View style={styles.featuredBarTrack}>
                  <View
                    style={[
                      styles.featuredBarFill,
                      {
                        width: `${totalCount > 0 ? (item.count / totalCount) * 100 : 0}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
              </GlassCard>
            );
          })}

          {/* Secondary Stat Cards */}
          {secondary.length > 0 && (
            <View style={styles.secondaryRow}>
              {secondary.map((item) => {
                const meta = PLUTCHIK_AXES[item.emotion];
                const emoji = meta?.emoji ?? '\uD83D\uDE36';
                return (
                  <GlassCard key={item.emotion} level={2} style={styles.secondaryCard}>
                    <Text style={styles.secondaryEmoji}>{emoji}</Text>
                    <Text style={styles.secondaryCount}>{item.count}</Text>
                    <Text style={styles.secondaryLabel}>
                      {item.emotion.charAt(0).toUpperCase() + item.emotion.slice(1)}
                    </Text>
                  </GlassCard>
                );
              })}
            </View>
          )}

          {/* Remaining Emotions List */}
          {remaining.length > 0 && (
            <GlassCard level={2} style={styles.remainingCard}>
              <Text style={styles.sectionLabel}>ALL EMOTIONS</Text>
              {remaining.map((item) => {
                const meta = PLUTCHIK_AXES[item.emotion];
                const barColor = meta?.color ?? MOOD_ACCENT;
                const emoji = meta?.emoji ?? '\uD83D\uDE36';
                const pct = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
                return (
                  <View key={item.emotion} style={styles.remainingRow}>
                    <Text style={styles.remainingEmoji}>{emoji}</Text>
                    <Text style={styles.remainingName}>
                      {item.emotion.charAt(0).toUpperCase() + item.emotion.slice(1)}
                    </Text>
                    <View style={styles.remainingBarTrack}>
                      <View
                        style={[
                          styles.remainingBarFill,
                          {
                            width: `${Math.max(pct, 3)}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.remainingCount}>{item.count}</Text>
                  </View>
                );
              })}
            </GlassCard>
          )}

          {/* Curator's Insight */}
          <GlassCard level={3} style={styles.curatorCard}>
            <Text style={styles.curatorTitle}>Curator's Insight</Text>
            <Text style={styles.curatorBody}>
              Your <Text style={{ fontStyle: 'italic', color: MOOD_ACCENT_LIGHT }}>
                {emotions[0]?.emotion ?? 'primary'}
              </Text> levels peak consistently during your most active logging periods.
              Consider scheduling reflective check-ins when this emotion is at its strongest.
            </Text>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.depth },
  content: { paddingBottom: 100 },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  headerLabel: { ...MOOD_TYPOGRAPHY.labelUpper, color: MOOD_ACCENT, marginBottom: 8 },
  headerTitle: { ...MOOD_TYPOGRAPHY.displayLg, color: colors.text },

  // Date picker
  pickerContainer: { paddingHorizontal: 20, marginTop: 12, zIndex: 10 },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  pickerIcon: { fontSize: 14 },
  pickerText: { ...MOOD_TYPOGRAPHY.bodyMd, fontSize: 14, color: colors.text },
  pickerChevron: { fontSize: 8, color: colors.textSecondary },
  pickerDropdown: {
    position: 'absolute',
    top: 48,
    left: 20,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 160,
    zIndex: 20,
  },
  pickerOption: { paddingVertical: 10, paddingHorizontal: 16 },
  pickerOptionActive: { backgroundColor: MOOD_SURFACES.highest },
  pickerOptionText: { ...MOOD_TYPOGRAPHY.bodyMd, fontSize: 14, color: colors.textSecondary },
  pickerOptionTextActive: { color: MOOD_ACCENT },

  // Empty
  emptyCard: { marginHorizontal: 20, marginTop: 24, alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { ...MOOD_TYPOGRAPHY.headlineMd, color: colors.text, marginBottom: 8 },
  emptyBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Spectrum
  spectrumCard: { marginHorizontal: 20, marginTop: 20, paddingVertical: 20 },
  sectionLabel: { ...MOOD_TYPOGRAPHY.labelUpper, color: colors.textSecondary, marginBottom: 16 },
  donutContainer: { alignItems: 'center', paddingVertical: 16 },
  donutRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 20,
    borderColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutSegment: { position: 'absolute' },
  donutCenter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MOOD_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterIcon: { fontSize: 20 },
  spectrumBars: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 20,
    width: '100%',
    gap: 2,
  },
  spectrumBar: { height: 4, borderRadius: 2 },
  spectrumSummary: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 16,
    paddingHorizontal: 8,
  },

  // Featured cards
  featuredCard: { marginHorizontal: 20, marginTop: 12, paddingVertical: 16 },
  featuredRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredInfo: { gap: 2 },
  featuredEmoji: { fontSize: 20, marginBottom: 4 },
  featuredName: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  featuredRole: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },
  featuredCount: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 36,
    fontWeight: '700',
  },
  featuredBarTrack: {
    height: 4,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  featuredBarFill: { height: 4, borderRadius: 2 },

  // Secondary
  secondaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 12,
  },
  secondaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  secondaryEmoji: { fontSize: 24, marginBottom: 8 },
  secondaryCount: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  secondaryLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Remaining list
  remainingCard: { marginHorizontal: 20, marginTop: 12, paddingVertical: 16 },
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  remainingEmoji: { fontSize: 16 },
  remainingName: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.text,
    width: 90,
  },
  remainingBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: MOOD_SURFACES.focus,
    borderRadius: 3,
    overflow: 'hidden',
  },
  remainingBarFill: { height: 6, borderRadius: 3 },
  remainingCount: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.textSecondary,
    minWidth: 24,
    textAlign: 'right',
  },

  // Curator
  curatorCard: { marginHorizontal: 20, marginTop: 12, paddingVertical: 24 },
  curatorTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: 12,
  },
  curatorBody: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
