import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertCircle, Award, Target, Zap } from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  getChallenges,
  type ChallengeListItem,
  type ChallengeListStatus,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { useI18n } from './i18n/I18nProvider';
import { BackArrow } from './components/DirectionalIcons';

type SegmentedFilter = 'available' | 'joined' | 'completed';

export default function ChallengesScreen() {
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const { supabase } = useBestChefCloud();

  const [items, setItems] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SegmentedFilter>('available');

  const CHALLENGE_ICONS = useMemo(
    () => [
      <Zap key="0" size={24} color={tc.accent} strokeWidth={2} />,
      <Target key="1" size={24} color={tc.accent} strokeWidth={2} />,
      <Award key="2" size={24} color={tc.primaryContainer} strokeWidth={2} />,
    ],
    [tc.accent, tc.primaryContainer],
  );

  const loadChallenges = useCallback(async () => {
    if (!supabase) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const status: ChallengeListStatus =
        filter === 'available' ? 'active' : filter === 'joined' ? 'joined' : 'completed';
      const result = await getChallenges(supabase, { status });
      if (result.ok) {
        setItems(result.data);
        setError(null);
      } else {
        // A real query failure must NOT masquerade as "no challenges"
        // (audit C12 UI half): surface a distinct error state.
        setItems([]);
        setError(result.error);
      }
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, filter]);

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [loadChallenges]),
  );

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const segments: Array<{ key: SegmentedFilter; label: string }> = [
    { key: 'available', label: t('challenges_available') },
    { key: 'joined', label: t('challenges_joined') },
    { key: 'completed', label: t('challenges_completed') },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Challenges')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.seasonTitle, { color: tc.text }]}>{t('Spring 2026')}</Text>
        <Text style={[styles.seasonDesc, { color: tc.textSecondary }]}>
          {t('Complete challenges to earn badges and boost your ranking')}
        </Text>

        <View style={[styles.segmented, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          {segments.map((seg) => {
            const active = seg.key === filter;
            return (
              <Pressable
                key={seg.key}
                onPress={() => setFilter(seg.key)}
                style={[
                  styles.segmentItem,
                  active && { backgroundColor: `${tc.accent}26` },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? tc.accent : tc.textSecondary },
                  ]}
                >
                  {seg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={[styles.challengeCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <ActivityIndicator color={tc.accent} />
          </View>
        ) : error ? (
          <Pressable
            style={[styles.challengeCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
            onPress={() => loadChallenges()}
            accessibilityRole="button"
            accessibilityLabel={t('Tap to retry')}
          >
            <AlertCircle size={28} color={tc.textSecondary} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('Could not load challenges')}</Text>
            <Text style={[styles.errorMessage, { color: tc.textSecondary }]}>{t('Tap to retry')}</Text>
          </Pressable>
        ) : items.length === 0 ? (
          <View style={[styles.challengeCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Award size={28} color={tc.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No active challenges yet')}</Text>
          </View>
        ) : null}

        {!loading && !error &&
          items.map((item, idx) => {
            const { challenge, enrollment, currentCount } = item;
            const isJoined = enrollment !== null;
            const target = challenge.targetCount;
            const ratio = target > 0 ? Math.min(1, currentCount / target) : 0;
            const widthPct = `${Math.round(ratio * 100)}%` as const;
            const isCompleted = enrollment?.completedAt != null;
            return (
              <Pressable
                key={challenge.id}
                onPress={() => router.push(`/challenge/${challenge.id}`)}
                style={[styles.challengeCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
              >
                <View style={styles.challengeHeader}>
                  <View style={[styles.challengeIconBox, { backgroundColor: `${tc.accent}1A` }]}>
                    {CHALLENGE_ICONS[idx % CHALLENGE_ICONS.length]}
                  </View>
                  <View style={styles.challengeInfo}>
                    <Text style={[styles.challengeName, { color: tc.text }]}>{challenge.title}</Text>
                    <Text style={[styles.challengeReward, { color: tc.accent }]}>{challenge.reward}</Text>
                  </View>
                </View>
                <Text style={[styles.challengeDesc, { color: tc.textSecondary }]}>{challenge.description}</Text>
                {isJoined ? (
                  <>
                    <View style={[styles.progressBar, { backgroundColor: theme.glass.cardBorder }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: widthPct,
                            backgroundColor: isCompleted ? tc.primaryContainer : tc.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressText, { color: tc.textTertiary }]}>
                      {t('challenges_progress', { x: currentCount, y: target })}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.progressText, { color: tc.textTertiary }]}>
                    {t('challenges_not_joined')}
                  </Text>
                )}
              </Pressable>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 12, gap: 12,
  },
  topBarTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 17, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },

  seasonTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 24 },
  seasonDesc: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },

  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },

  challengeCard: {
    borderRadius: 20, padding: 20, gap: 12, borderWidth: 1,
  },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  challengeIconBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  challengeInfo: { flex: 1, gap: 2 },
  challengeName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  challengeReward: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  challengeDesc: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, lineHeight: 19 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16, textAlign: 'center' },
  errorMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },

  progressBar: {
    height: 6, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
});
