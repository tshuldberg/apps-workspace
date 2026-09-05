import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  getDreamPatternDashboard,
  listAllDreams,
} from '@mylife/sleep';
import type { DreamPatternDashboard } from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  SLEEP_ACCENT,
  SleepPlaceholderScreen,
} from '../_ui';

export default function SleepDreamPatternsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DreamPatternDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(() => {
    setIsLoading(true);
    try {
      const dreams = listAllDreams(db);
      setDashboard(getDreamPatternDashboard(dreams));
      setError(null);
    } catch (reason) {
      setDashboard(null);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not load dream patterns.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  if (!isLoading && !error && (!dashboard || dashboard.totalDreams === 0)) {
    return (
      <SleepPlaceholderScreen
        eyebrow="Dream Patterns"
        title="Log a few dreams before patterns appear"
        subtitle="Once the archive has entries, this dashboard will surface themes, dream types, recurring loops, and weekly lucid or nightmare trends."
        cards={[
          {
            emoji: '📊',
            title: 'Theme frequency',
            body: 'Track which symbols, places, and loops show up most often in your own archive.',
          },
          {
            emoji: '🧭',
            title: 'Rate tracking',
            body: 'See lucid and nightmare rates by week without turning sleep into a black-box score.',
          },
          {
            emoji: '🔁',
            title: 'Recurring groups',
            body: 'Recurring threads stay grouped so repeat scenes are easy to spot later.',
          },
        ]}
        footer={(
          <Pressable
            onPress={() => router.push('/(sleep)/dream/log' as never)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Log Dream</Text>
          </Pressable>
        )}
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Dream Patterns</Text>
        <Text style={styles.heroTitle}>
          See what your dream archive repeats.
        </Text>
        <Text style={styles.heroSubtitle}>
          Everything here is derived locally from the dream archive you already saved.
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.push('/(sleep)/dream/dictionary' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Dream Dictionary</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(sleep)/dream/log' as never)}
            style={styles.primaryButtonInline}
          >
            <Text style={styles.primaryButtonText}>Log Dream</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={SLEEP_ACCENT} />
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : dashboard ? (
        <>
          <View style={styles.metricGrid}>
            <MetricCard
              label="Dreams Logged"
              value={String(dashboard.totalDreams)}
              detail="Total archive size"
            />
            <MetricCard
              label="Dreams / Week"
              value={dashboard.dreamsPerWeekAverage.toFixed(1)}
              detail="Average across recorded weeks"
            />
            <MetricCard
              label="Lucid Rate"
              value={`${dashboard.lucidRate.percentage}%`}
              detail={`${dashboard.lucidRate.count} lucid dreams`}
            />
            <MetricCard
              label="Nightmare Rate"
              value={`${dashboard.nightmareRate.percentage}%`}
              detail={`${dashboard.nightmareRate.count} nightmares`}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dream type distribution</Text>
            <Text style={styles.cardBody}>
              A simple bar view keeps the archive readable without adding a chart dependency.
            </Text>
            <View style={styles.barList}>
              {dashboard.typeDistribution
                .filter((item) => item.count > 0)
                .map((item) => (
                  <BarRow
                    key={item.type}
                    label={item.type}
                    value={`${item.count} · ${item.percentage}%`}
                    percentage={item.percentage}
                  />
                ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top themes</Text>
            <View style={styles.themeGrid}>
              {dashboard.topThemes.map((item) => (
                <View key={item.theme} style={styles.themeCard}>
                  <Text style={styles.themeTitle}>{item.theme}</Text>
                  <Text style={styles.themeDetail}>{item.count} mentions</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Most common emotions</Text>
            <View style={styles.barList}>
              {dashboard.mostCommonEmotions.map((item) => (
                <BarRow
                  key={item.emotion}
                  label={item.emotion}
                  value={`${item.count} · ${item.percentage}%`}
                  percentage={item.percentage}
                  tone="warm"
                />
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weekly lucid and nightmare trends</Text>
            <View style={styles.trendList}>
              {dashboard.lucidTrend.map((point) => (
                <View key={point.weekStart} style={styles.trendCard}>
                  <View style={styles.trendHeader}>
                    <Text style={styles.trendTitle}>{point.label}</Text>
                    <Text style={styles.trendMeta}>{point.totalDreams} dreams</Text>
                  </View>
                  <BarRow
                    label="Lucid"
                    value={`${point.lucidRate}%`}
                    percentage={point.lucidRate}
                  />
                  <BarRow
                    label="Nightmare"
                    value={`${point.nightmareRate}%`}
                    percentage={point.nightmareRate}
                    tone="danger"
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recurring dream groups</Text>
            {dashboard.recurringGroups.length > 0 ? (
              <View style={styles.recurringList}>
                {dashboard.recurringGroups.map((group) => (
                  <View key={group.groupId} style={styles.recurringCard}>
                    <View style={styles.recurringHeader}>
                      <Text style={styles.recurringTitle}>
                        {group.themes.join(' · ') || 'Recurring thread'}
                      </Text>
                      <View style={styles.countPill}>
                        <Text style={styles.countPillText}>
                          {group.frequency} dreams
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.recurringBody}>
                      Last seen {group.lastOccurrence}
                    </Text>
                    {group.emotions.length > 0 && (
                      <Text style={styles.recurringBody}>
                        Typical emotions: {group.emotions.join(', ')}
                      </Text>
                    )}
                    {group.exampleExcerpts.map((excerpt) => (
                      <Text
                        key={`${group.groupId}-${excerpt}`}
                        style={styles.excerptCard}
                      >
                        {excerpt}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.cardBody}>
                Recurring groups will appear once multiple dreams share the same recurring thread.
              </Text>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function BarRow({
  label,
  value,
  percentage,
  tone = 'cool',
}: {
  label: string;
  value: string;
  percentage: number;
  tone?: 'cool' | 'warm' | 'danger';
}) {
  const fillStyle =
    tone === 'warm'
      ? styles.barFillWarm
      : tone === 'danger'
        ? styles.barFillDanger
        : styles.barFillCool;

  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFillBase,
            fillStyle,
            { width: `${Math.max(percentage, 4)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 140,
    gap: 16,
  },
  hero: {
    gap: 12,
    padding: 22,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.24)',
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonInline: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  loadingCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.28)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: SLEEP_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '800',
  },
  metricDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    gap: 12,
    padding: 20,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  barList: {
    gap: 12,
  },
  barRow: {
    gap: 8,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  barLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  barValue: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFillBase: {
    height: '100%',
    borderRadius: 999,
  },
  barFillCool: {
    backgroundColor: '#7C9CF9',
  },
  barFillWarm: {
    backgroundColor: '#F59E0B',
  },
  barFillDanger: {
    backgroundColor: '#F87171',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeCard: {
    minWidth: '47%',
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  themeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  themeDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  trendList: {
    gap: 12,
  },
  trendCard: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  trendTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  trendMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  recurringList: {
    gap: 12,
  },
  recurringCard: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recurringHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  recurringTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  countPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  recurringBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  excerptCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.1)',
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
});
