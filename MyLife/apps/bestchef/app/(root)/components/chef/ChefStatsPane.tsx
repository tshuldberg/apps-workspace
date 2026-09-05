import { useEffect, useMemo, useState } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import { Text } from '@mylife/ui';
import { Card } from '@mylife/bestchef/ui';
import {
  JAKARTA_FONTS,
  getChefSubmissions,
  getRankHistory,
  getCuisineGradient,
} from '@mylife/bestchef';
import type { Submission } from '@mylife/bestchef';
import type { RankHistoryEntry } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { RankSparkline, type SparklineEntry } from '../profile/RankSparkline';

interface Props {
  chefId: string;
}

interface CuisineBar {
  cuisine: string;
  count: number;
  ratio: number;
  gradientFrom: string;
  gradientTo: string;
}

export function ChefStatsPane({ chefId }: Props) {
  const tc = useThemeColors();
  const { t } = useI18n();

  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [history, setHistory] = useState<RankHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getChefSubmissions(chefId, { limit: 100, sortBy: 'vote_score' }),
      getRankHistory({ chefId, weeks: 12 }),
    ]).then(([subResult, histResult]) => {
      if (cancelled) return;
      setSubmissions(subResult.ok ? subResult.data : []);
      setHistory(histResult.ok ? histResult.data : []);
    }).catch(() => {
      if (!cancelled) setSubmissions([]);
    });
    return () => { cancelled = true; };
  }, [chefId]);

  const sparkEntries: SparklineEntry[] = useMemo(
    () => history.map((e) => ({
      week: e.week instanceof Date ? e.week.toISOString() : String(e.week),
      rank: e.rank,
    })),
    [history],
  );

  const cuisineBars: CuisineBar[] = useMemo(() => {
    if (!submissions || submissions.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const sub of submissions) {
      const key = sub.region ?? 'Unknown';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const entries = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
    const max = entries[0]?.[1] ?? 1;
    return entries.map(([cuisine, count]) => {
      const g = getCuisineGradient(cuisine);
      return { cuisine, count, ratio: count / max, gradientFrom: g.from, gradientTo: g.to };
    });
  }, [submissions]);

  const voteSums = useMemo(() => {
    if (!submissions || submissions.length === 0) return { up: 0, down: 0, reviewed: 0 };
    return submissions.reduce(
      (acc, s) => ({
        up: acc.up + s.upvoteCount,
        down: acc.down + s.downvoteCount,
        reviewed: acc.reviewed + s.reviewedCount,
      }),
      { up: 0, down: 0, reviewed: 0 },
    );
  }, [submissions]);

  const voteTotal = voteSums.up + voteSums.down + voteSums.reviewed || 1;

  if (submissions === null) {
    return (
      <Card>
        <Text style={[styles.loadingText, { color: tc.textSecondary }]}>{t('Loading rank history')}</Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* Rank sparkline */}
      {sparkEntries.length >= 2 && (
        <Card>
          <Text style={[styles.sectionLabel, { color: tc.text }]}>{t('Best Rank')}</Text>
          <View style={styles.sparkWrap}>
            <RankSparkline entries={sparkEntries} height={60} horizontalPadding={52} />
          </View>
        </Card>
      )}

      {/* Cuisine breakdown */}
      {cuisineBars.length > 0 && (
        <Card>
          <Text style={[styles.sectionLabel, { color: tc.text }]}>{t('Cuisine Specialties')}</Text>
          <View style={styles.barsContainer}>
            {cuisineBars.map((bar) => (
              <View key={bar.cuisine} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: tc.textSecondary }]} numberOfLines={1}>
                  {bar.cuisine}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: tc.surfaceElevated ?? 'rgba(255,255,255,0.06)' }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${bar.ratio * 100}%` as unknown as number, backgroundColor: bar.gradientFrom },
                    ]}
                  />
                </View>
                <Text style={[styles.barCount, { color: tc.textSecondary }]}>{bar.count}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Vote distribution */}
      <Card>
        <Text style={[styles.sectionLabel, { color: tc.text }]}>{t('Votes')}</Text>
        <View style={styles.voteRows}>
          {[
            { label: t('Total Upvotes'), value: voteSums.up, color: '#22C55E' },
            { label: t('Total Reviewed'), value: voteSums.reviewed, color: '#8BCFF0' },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.voteRow}>
              <Text style={[styles.voteLabel, { color: tc.textSecondary }]}>{label}</Text>
              <View style={[styles.voteTrack, { backgroundColor: tc.surfaceElevated ?? 'rgba(255,255,255,0.06)' }]}>
                <View
                  style={[
                    styles.voteFill,
                    { width: `${(value / voteTotal) * 100}%` as unknown as number, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={[styles.voteCount, { color: tc.text }]}>{value}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  loadingText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  sectionLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    marginBottom: 10,
  },
  sparkWrap: { marginTop: 4 },
  barsContainer: { gap: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, width: 80 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barCount: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11, width: 20, textAlign: I18nManager.isRTL ? 'left' : 'right' },
  voteRows: { gap: 10 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voteLabel: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, width: 100 },
  voteTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  voteFill: { height: 6, borderRadius: 3 },
  voteCount: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11, width: 32, textAlign: I18nManager.isRTL ? 'left' : 'right' },
});
