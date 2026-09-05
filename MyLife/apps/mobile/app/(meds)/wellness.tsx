import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getOverallWellnessTimeline, getWellnessScore } from '@mylife/meds';
import {
  GlassCard,
  HeartbeatLine,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  SectionHeader,
  WellnessRing,
  withAlpha,
} from '@mylife/meds/ui';
import {
  EmptyGlassState,
  ProgressBar,
  ScreenTitleBlock,
  SectionStack,
  daysAgoIso,
} from '../../components/meds/phase1';
import { useDatabase } from '../../components/DatabaseProvider';

function buildWellnessTimeline(db: ReturnType<typeof useDatabase>) {
  const to = new Date().toISOString().slice(0, 10);
  const from = daysAgoIso(6).slice(0, 10);
  const timeline = getOverallWellnessTimeline(db, from, to);

  return timeline.map((entry) => {
    const moodScore = entry.moodScore == null ? 55 : ((entry.moodScore + 1) / 2) * 100;
    const symptomScore = Math.max(20, 100 - entry.symptomCount * 8);
    const value = Math.round(entry.adherenceRate * 0.5 + moodScore * 0.25 + symptomScore * 0.25);

    return {
      date: entry.date,
      value,
    };
  });
}

export default function WellnessScreen() {
  const db = useDatabase();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const screenState = useMemo(() => {
    try {
      const wellness = getWellnessScore(db);
      const timeline = buildWellnessTimeline(db);
      return {
        error: null,
        timeline,
        wellness,
      };
    } catch (error) {
      console.error('WellnessScreen load failed', error);
      return {
        error: 'Unable to load the wellness score.',
        timeline: [] as Array<{ date: string; value: number }>,
        wellness: null,
      };
    }
  }, [db, refreshKey]);

  if (screenState.error || !screenState.wellness) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          actionLabel="Retry"
          message={screenState.error ?? 'Not enough data to calculate wellness yet.'}
          onPress={onRefresh}
          title="Wellness score unavailable"
        />
      </View>
    );
  }

  const recommendations = screenState.wellness.components
    .filter((component) => component.score < 80)
    .slice(0, 4);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[MD_ACCENT_LIGHT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={MD_ACCENT_LIGHT}
        />
      }
      style={styles.screen}
    >
      <SectionStack>
        <ScreenTitleBlock
          subtitle="A blended view of adherence, vitals, mood stability, and symptom burden."
          title="Wellness Score"
        />

        <GlassCard padding={22} style={styles.heroCard}>
          <View style={styles.heroRingWrap}>
            <WellnessRing
              breakdown={screenState.wellness.components.map((component, index) => ({
                color: index % 2 === 0 ? MD_ACCENT_LIGHT : MD_CHROME_GOLD,
                value: component.score,
              }))}
              score={screenState.wellness.composite}
              size={230}
            />
          </View>
          <Text style={styles.heroValue}>{screenState.wellness.composite}/100</Text>
          <Text style={styles.heroTrend}>
            Trend: {screenState.wellness.trend.replace('_', ' ')}
          </Text>
          <Text style={styles.heroBody}>
            {screenState.wellness.isConfident
              ? 'Confidence is high because enough recent meds, mood, and vitals data is present.'
              : 'Confidence is still building. More logged data will sharpen this score.'}
          </Text>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Contributing factors" />
          <View style={styles.factorStack}>
            {screenState.wellness.components.map((component) => (
              <View key={component.name} style={styles.factorRow}>
                <View style={styles.factorCopy}>
                  <Text style={styles.factorTitle}>{component.name}</Text>
                  <Text style={styles.factorBody}>{component.explanation}</Text>
                </View>
                <Text style={styles.factorValue}>{component.score}</Text>
                <ProgressBar
                  tone={component.score >= 80 ? MD_ACCENT_LIGHT : MD_CHROME_GOLD}
                  value={component.score}
                />
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="7-day trend" />
          {screenState.timeline.length > 1 ? (
            <HeartbeatLine chartHeight={92} chartWidth={320} data={screenState.timeline} />
          ) : (
            <Text style={styles.emptyBody}>Need at least two tracked days to draw the trend line.</Text>
          )}
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Factor history cards" />
          <View style={styles.historyCardStack}>
            {screenState.wellness.components.map((component) => (
              <View key={component.name} style={styles.historyCard}>
                <Text style={styles.historyCardTitle}>{component.name}</Text>
                <Text style={styles.historyCardBody}>{component.explanation}</Text>
                <Text style={styles.historyCardMeta}>
                  {component.dataPoints} data points · weight {Math.round(component.weight * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="How to improve" />
          <View style={styles.recommendationStack}>
            {recommendations.length > 0 ? (
              recommendations.map((component) => (
                <View key={component.name} style={styles.recommendationRow}>
                  <Text style={styles.recommendationTitle}>{component.name}</Text>
                  <Text style={styles.recommendationBody}>
                    Focus on the next few days of {component.name.toLowerCase()} consistency to lift the composite score fastest.
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyBody}>
                Every tracked factor is performing well. Stay consistent and keep logging for long-range trends.
              </Text>
            )}
          </View>
        </GlassCard>
      </SectionStack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_SURFACES.low, 0.92),
    gap: 12,
  },
  heroRingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 36,
    lineHeight: 40,
  },
  heroTrend: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.semiBold,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  panel: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  factorStack: {
    gap: 14,
  },
  factorRow: {
    gap: 8,
  },
  factorCopy: {
    gap: 4,
  },
  factorTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  factorBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  factorValue: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
  historyCardStack: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    borderRadius: 18,
    gap: 6,
    padding: 14,
  },
  historyCardTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  historyCardBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  historyCardMeta: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  recommendationStack: {
    gap: 12,
  },
  recommendationRow: {
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    borderRadius: 18,
    gap: 4,
    padding: 14,
  },
  recommendationTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.bold,
  },
  recommendationBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
});
