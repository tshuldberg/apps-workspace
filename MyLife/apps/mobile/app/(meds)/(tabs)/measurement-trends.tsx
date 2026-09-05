import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  getBPReadings,
  getGlucoseReadings,
  getInsulinEntries,
  getMeasurementTrend,
  getMedicationInsights,
  getWellnessScore,
} from '@mylife/meds';
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
  VitalStat,
  WellnessRing,
  withAlpha,
} from '@mylife/meds/ui';
import {
  EmptyGlassState,
  FilterChip,
  ScreenTitleBlock,
  SectionStack,
  daysAgoIso,
} from '../../../components/meds/phase1';
import { useDatabase } from '../../../components/DatabaseProvider';

type PeriodKey = '7d' | '30d' | '90d' | '1y';

type VitalOverviewCard = {
  chart: Array<{ date: string; value: number }>;
  id: string;
  label: string;
  route?: Href;
  status: string;
  subtitle: string;
  unit: string;
  value: string;
};

const PERIOD_TO_DAYS: Record<PeriodKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

function buildHeartRateStatus(value: number) {
  if (value >= 110) {
    return 'stage2';
  }
  if (value >= 95) {
    return 'stage1';
  }
  return 'normal';
}

function buildTemperatureStatus(value: number) {
  if (value >= 101.5) {
    return 'high';
  }
  if (value >= 100.4) {
    return 'stage1';
  }
  return 'normal';
}

function buildGlucoseStatus(status: string) {
  switch (status) {
    case 'in_range':
      return 'normal';
    case 'very_high':
      return 'high';
    case 'very_low':
      return 'low';
    default:
      return status;
  }
}

function buildBPStatus(status: string) {
  switch (status) {
    case 'hypertension_1':
      return 'stage1';
    case 'hypertension_2':
      return 'stage2';
    default:
      return status;
  }
}

function toNumericSeries(points: Array<{ date: string; value: string | number }>) {
  return points
    .map((point) => ({
      date: point.date,
      value: Number(point.value),
    }))
    .filter((point) => Number.isFinite(point.value));
}

function VitalCard({
  card,
  onPress,
}: {
  card: VitalOverviewCard;
  onPress?: () => void;
}) {
  const content = (
    <GlassCard padding={16} style={styles.vitalCard}>
      <View style={styles.vitalCardCopy}>
        <VitalStat
          label={card.label}
          size="sm"
          status={card.status}
          unit={card.unit}
          value={card.value}
        />
        <Text style={styles.vitalCardSubtitle}>{card.subtitle}</Text>
      </View>
      {card.chart.length > 1 ? (
        <HeartbeatLine chartHeight={64} chartWidth={130} data={card.chart} />
      ) : (
        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartPlaceholderText}>Need more readings</Text>
        </View>
      )}
    </GlassCard>
  );

  if (!onPress) {
    return <View style={styles.vitalCardWrap}>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={styles.vitalCardWrap}>
      {content}
    </Pressable>
  );
}

export default function MeasurementTrendsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const screenState = useMemo(() => {
    try {
      const from = daysAgoIso(PERIOD_TO_DAYS[period]);
      const bpReadings = getBPReadings(db, { from, limit: 120 });
      const glucoseReadings = getGlucoseReadings(db, { from, limit: 120 });
      const insulinEntries = getInsulinEntries(db, { from, limit: 240 });
      const heartRateTrend = toNumericSeries(getMeasurementTrend(db, 'heart_rate', from, new Date().toISOString()));
      const weightTrend = toNumericSeries(getMeasurementTrend(db, 'weight', from, new Date().toISOString()));
      const temperatureTrend = toNumericSeries(getMeasurementTrend(db, 'temperature', from, new Date().toISOString()));
      const insights = getMedicationInsights(db).slice(0, 2);
      const wellness = getWellnessScore(db);

      const insulinSeriesMap = new Map<string, number>();
      for (const entry of insulinEntries) {
        const key = entry.administeredAt.slice(0, 10);
        insulinSeriesMap.set(key, (insulinSeriesMap.get(key) ?? 0) + entry.units);
      }
      const insulinSeries = Array.from(insulinSeriesMap.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((left, right) => left.date.localeCompare(right.date));

      const cards: VitalOverviewCard[] = [];

      if (bpReadings[0]) {
        cards.push({
          chart: bpReadings
            .slice()
            .reverse()
            .map((reading) => ({ date: reading.measuredAt, value: reading.systolic })),
          id: 'bp',
          label: 'Blood Pressure',
          route: '/(meds)/bp-history',
          status: buildBPStatus(bpReadings[0].category),
          subtitle: `${bpReadings[0].diastolic} diastolic · ${bpReadings.length} readings`,
          unit: 'mmHg',
          value: `${bpReadings[0].systolic}/${bpReadings[0].diastolic}`,
        });
      }

      if (glucoseReadings[0]) {
        cards.push({
          chart: glucoseReadings
            .slice()
            .reverse()
            .map((reading) => ({ date: reading.measuredAt, value: reading.value })),
          id: 'glucose',
          label: 'Glucose',
          route: '/(meds)/glucose-history',
          status: buildGlucoseStatus(glucoseReadings[0].rangeStatus),
          subtitle: `${glucoseReadings[0].mealContext?.replace(/_/g, ' ') ?? 'recent'} · ${glucoseReadings.length} readings`,
          unit: glucoseReadings[0].unit,
          value: `${Math.round(glucoseReadings[0].value)}`,
        });
      }

      if (heartRateTrend[0]) {
        const latest = heartRateTrend[heartRateTrend.length - 1];
        cards.push({
          chart: heartRateTrend,
          id: 'heart-rate',
          label: 'Heart Rate',
          route: '/(meds)/(tabs)/measurement-trends',
          status: buildHeartRateStatus(latest.value),
          subtitle: `${heartRateTrend.length} logs in range`,
          unit: 'bpm',
          value: `${Math.round(latest.value)}`,
        });
      }

      if (weightTrend[0]) {
        const latest = weightTrend[weightTrend.length - 1];
        cards.push({
          chart: weightTrend,
          id: 'weight',
          label: 'Weight',
          route: '/(meds)/(tabs)/measurement-trends',
          status: 'normal',
          subtitle: `${weightTrend.length} measurements tracked`,
          unit: 'lbs',
          value: `${Math.round(latest.value)}`,
        });
      }

      if (temperatureTrend[0]) {
        const latest = temperatureTrend[temperatureTrend.length - 1];
        cards.push({
          chart: temperatureTrend,
          id: 'temperature',
          label: 'Temperature',
          route: '/(meds)/(tabs)/measurement-trends',
          status: buildTemperatureStatus(latest.value),
          subtitle: `${temperatureTrend.length} checks`,
          unit: '°F',
          value: `${latest.value.toFixed(1)}`,
        });
      }

      if (insulinSeries.length > 0) {
        const latest = insulinSeries[insulinSeries.length - 1];
        cards.push({
          chart: insulinSeries,
          id: 'insulin',
          label: 'Insulin total',
          route: '/(meds)/insulin-history',
          status: 'normal',
          subtitle: `${insulinEntries.length} entries this period`,
          unit: 'u',
          value: `${Math.round(latest.value)}`,
        });
      }

      return {
        cards,
        error: null,
        insights,
        wellness,
      };
    } catch (error) {
      console.error('MeasurementTrendsScreen load failed', error);
      return {
        cards: [] as VitalOverviewCard[],
        error: 'Unable to load vitals right now.',
        insights: [],
        wellness: null,
      };
    }
  }, [db, period, refreshKey]);

  if (screenState.error) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          actionLabel="Retry"
          message={screenState.error}
          onPress={onRefresh}
          title="Vitals unavailable"
        />
      </View>
    );
  }

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
          subtitle="Vitals, insulin totals, and score previews across the selected period."
          title="Vitals"
        />

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Period" />
          <View style={styles.chipRail}>
            {(['7d', '30d', '90d', '1y'] as PeriodKey[]).map((item) => (
              <FilterChip
                key={item}
                label={item}
                onPress={() => setPeriod(item)}
                selected={period === item}
              />
            ))}
          </View>
        </GlassCard>

        {screenState.cards.length === 0 ? (
          <EmptyGlassState
            actionLabel="Log vitals"
            message="Start logging BP, glucose, heart rate, or weight to unlock this hub."
            onPress={() => router.push('/(meds)/log-bp')}
            title="No vitals in this period"
          />
        ) : (
          <View style={styles.grid}>
            {screenState.cards.map((card) => {
              const route = card.route;
              const handlePress = route
                ? () => {
                    router.push(route);
                  }
                : undefined;
              return <VitalCard key={card.id} card={card} onPress={handlePress} />;
            })}
          </View>
        )}

        {screenState.wellness ? (
          <Pressable onPress={() => router.push('/(meds)/wellness')}>
            <GlassCard padding={18} style={styles.panel}>
              <SectionHeader
                action={<Text style={styles.linkText}>Details</Text>}
                title="Wellness score"
              />
              <View style={styles.wellnessRow}>
                <WellnessRing score={screenState.wellness.composite} size={110} />
                <View style={styles.wellnessCopy}>
                  <Text style={styles.wellnessValue}>{screenState.wellness.composite}/100</Text>
                  <Text style={styles.wellnessMeta}>
                    Trend: {screenState.wellness.trend.replace('_', ' ')}
                  </Text>
                  <Text style={styles.wellnessBody}>
                    {screenState.wellness.components[0]?.explanation ?? 'Track more data to sharpen the score.'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/(meds)/(tabs)/correlation')}>
          <GlassCard padding={18} style={styles.panel}>
            <SectionHeader
              action={<Text style={styles.linkText}>Insights</Text>}
              title="Correlation preview"
            />
            <View style={styles.insightStack}>
              {screenState.insights.length > 0 ? (
                screenState.insights.map((insight) => (
                  <View key={insight.id} style={styles.insightRow}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightBody}>{insight.description}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.insightBody}>
                  Keep logging meds, symptoms, and vitals to unlock higher-confidence insight cards.
                </Text>
              )}
            </View>
          </GlassCard>
        </Pressable>
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
  panel: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  chipRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalCardWrap: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 150,
  },
  vitalCard: {
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    gap: 16,
    minHeight: 190,
  },
  vitalCardCopy: {
    gap: 8,
  },
  vitalCardSubtitle: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  chartPlaceholder: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 64,
  },
  chartPlaceholderText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  linkText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
  wellnessRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  wellnessCopy: {
    flex: 1,
    gap: 6,
  },
  wellnessValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
  },
  wellnessMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.semiBold,
  },
  wellnessBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  insightStack: {
    gap: 12,
  },
  insightRow: {
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    borderRadius: 18,
    gap: 6,
    padding: 14,
  },
  insightTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  insightBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
});
