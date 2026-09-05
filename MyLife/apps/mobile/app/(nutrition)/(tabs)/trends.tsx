import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  generateNutritionInsights,
  getCalorieGoal,
  getCalorieHistory,
  getFastingDays,
  getMoodDays,
  getNutritionDays,
  getWorkoutDays,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_LIGHT,
  NU_MACROS,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  SectionHeader,
  type DayTotal,
  type NutritionInsight,
} from '@mylife/nutrition';
import { getBodyMeasurements } from '@mylife/workouts';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

type PeriodKey = '7d' | '30d' | '90d' | '1y';

type MacroDay = {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

const PERIODS: Array<{ key: PeriodKey; label: string; days: number }> = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
  { key: '1y', label: '1 Year', days: 365 },
];

function buildLinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return '';
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function labelForDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
  });
}

function startDateForDays(days: number): string {
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  return start.toISOString().slice(0, 10);
}

export default function NutritionTrendsScreen() {
  const db = useDatabase();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const days = PERIODS.find((item) => item.key === period)?.days ?? 30;
  const startDate = startDateForDays(days);
  const endDate = new Date().toISOString().slice(0, 10);

  const state = useMemo(() => {
    try {
      const calorieHistory = getCalorieHistory(db, days);
      const calorieGoal = getCalorieGoal(db) ?? 2200;
      const nutritionDays = getNutritionDays(db, days);
      const insights = generateNutritionInsights({
        nutritionDays,
        fastingDays: getFastingDays(db, days),
        workoutDays: getWorkoutDays(db, days),
        moodDays: getMoodDays(db, days),
        calorieGoal,
      });

      const macroDays = db.query<MacroDay>(
        `SELECT
           l.date as date,
           COALESCE(SUM(i.protein_g), 0) as protein,
           COALESCE(SUM(i.carbs_g), 0) as carbs,
           COALESCE(SUM(i.fat_g), 0) as fat,
           COALESCE(SUM(
             CASE
               WHEN COALESCE(f.calories, 0) <= 0 THEN 0
               ELSE f.fiber_g * i.serving_count * (i.calories / f.calories)
             END
           ), 0) as fiber
         FROM nu_food_log l
         JOIN nu_food_log_items i ON i.log_id = l.id
         JOIN nu_foods f ON f.id = i.food_id
         WHERE l.date >= ? AND l.date <= ?
         GROUP BY l.date
         ORDER BY l.date ASC`,
        [startDate, endDate],
      );

      const weightHistory = getBodyMeasurements(db, { type: 'weight', limit: days * 2 })
        .filter((item) => item.measuredAt.slice(0, 10) >= startDate)
        .reverse();

      return {
        error: null as string | null,
        calorieGoal,
        calorieHistory,
        insights,
        macroDays,
        weightHistory,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load trends.',
        calorieGoal: 2200,
        calorieHistory: [] as DayTotal[],
        insights: [] as NutritionInsight[],
        macroDays: [] as MacroDay[],
        weightHistory: [] as ReturnType<typeof getBodyMeasurements>,
      };
    }
  }, [db, days, endDate, startDate, tick]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 120);
  }, []);

  if (state.error) {
    return (
      <View style={styles.errorWrap}>
        <ErrorState message={state.error} onRetry={handleRefresh} />
      </View>
    );
  }

  const averageCalories =
    state.calorieHistory.length > 0
      ? Math.round(
          state.calorieHistory.reduce((sum, item) => sum + item.calories, 0) /
            state.calorieHistory.length,
        )
      : 0;

  const compliance = computeCompliance(state.macroDays, {
    protein: 160,
    carbs: 220,
    fat: 70,
    fiber: 30,
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={NU_ACCENT} />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Analytics</Text>
        <Text style={styles.heroTitle}>Trends</Text>
        <Text style={styles.heroBody}>
          See intake patterns, cross-module signals, and long-range momentum.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.periodRow}>
          {PERIODS.map((item) => {
            const active = item.key === period;
            return (
              <Pressable
                key={item.key}
                style={[styles.periodChip, active ? styles.periodChipActive : null]}
                onPress={() => setPeriod(item.key)}
              >
                <Text style={[styles.periodChipText, active ? styles.periodChipTextActive : null]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.panel}>
        <SectionHeader
          title="Calorie trend"
          action={<Text style={styles.linkText}>Avg {averageCalories} kcal</Text>}
        />
        <CalorieLineChart data={state.calorieHistory} goal={state.calorieGoal} />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Macro distribution" />
        <MacroDistributionChart data={state.macroDays} />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Smart insights" />
        {state.insights.length === 0 ? (
          <Text style={styles.emptyText}>Log more days to unlock the correlation engine.</Text>
        ) : (
          <View style={styles.insightStack}>
            {state.insights.map((insight) => (
              <View key={insight.id} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View
                    style={[
                      styles.insightBadge,
                      {
                        backgroundColor:
                          insight.severity === 'actionable'
                            ? 'rgba(255,184,119,0.18)'
                            : insight.severity === 'notable'
                              ? 'rgba(48,209,88,0.16)'
                              : 'rgba(139,207,240,0.16)',
                      },
                    ]}
                  >
                    <MaterialSymbol
                      name={insight.severity === 'actionable' ? 'lightbulb' : 'insights'}
                      size={16}
                      color={NU_ACCENT_LIGHT}
                    />
                  </View>
                  <View style={styles.insightCopy}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightMetric}>{insight.metric}</Text>
                  </View>
                </View>
                <Text style={styles.insightBody}>{insight.body}</Text>
                <Text style={styles.insightRecommendation}>{insight.recommendation}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Weight trend" />
        {state.weightHistory.length === 0 ? (
          <Text style={styles.emptyText}>Connect weight measurements in MyWorkouts to surface this trend.</Text>
        ) : (
          <WeightTrendChart
            dates={state.weightHistory.map((item) => item.measuredAt.slice(0, 10))}
            values={state.weightHistory.map((item) => item.value)}
            unit={state.weightHistory[0].unit}
          />
        )}
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Macro goal compliance" />
        <View style={styles.complianceRow}>
          <ComplianceBar label="Protein" percent={compliance.protein} color={NU_MACROS.protein} />
          <ComplianceBar label="Carbs" percent={compliance.carbs} color={NU_MACROS.carbs} />
          <ComplianceBar label="Fat" percent={compliance.fat} color={NU_MACROS.fat} />
          <ComplianceBar label="Fiber" percent={compliance.fiber} color={NU_MACROS.fiber} />
        </View>
      </View>
    </ScrollView>
  );
}

function CalorieLineChart({ data, goal }: { data: DayTotal[]; goal: number }) {
  if (data.length === 0) {
    return <Text style={styles.emptyText}>Log a few meals to populate the chart.</Text>;
  }

  const width = 300;
  const height = 160;
  const values = data.map((item) => item.calories);
  const linePath = buildLinePath(values, width, height);
  const goalPath = buildLinePath(new Array(values.length).fill(goal), width, height);
  const average = values.reduce((sum, item) => sum + item, 0) / values.length;
  const averagePath = buildLinePath(new Array(values.length).fill(average), width, height);

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={goalPath} stroke="rgba(255,184,119,0.32)" strokeDasharray="6 6" strokeWidth={2} fill="none" />
        <Path d={averagePath} stroke="rgba(228,225,233,0.22)" strokeDasharray="4 4" strokeWidth={2} fill="none" />
        <Path d={linePath} stroke={NU_ACCENT} strokeWidth={4} strokeLinecap="round" fill="none" />
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>{labelForDate(data[0].date)}</Text>
        <Text style={styles.chartLabel}>{labelForDate(data[data.length - 1].date)}</Text>
      </View>
    </View>
  );
}

function MacroDistributionChart({ data }: { data: MacroDay[] }) {
  if (data.length === 0) {
    return <Text style={styles.emptyText}>Macro bars appear after enough logged meals accumulate.</Text>;
  }

  const visibleBars = data.slice(-Math.min(data.length, 30));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.stackChart}>
        {visibleBars.map((day) => {
          const protein = day.protein * 4;
          const carbs = day.carbs * 4;
          const fat = day.fat * 9;
          const total = Math.max(protein + carbs + fat, 1);
          return (
            <View key={day.date} style={styles.stackBarCol}>
              <View style={styles.stackBarTrack}>
                <View style={[styles.stackSegment, { height: `${(fat / total) * 100}%`, backgroundColor: NU_MACROS.fat }]} />
                <View style={[styles.stackSegment, { height: `${(carbs / total) * 100}%`, backgroundColor: NU_MACROS.carbs }]} />
                <View style={[styles.stackSegment, { height: `${(protein / total) * 100}%`, backgroundColor: NU_MACROS.protein }]} />
              </View>
              <Text style={styles.stackBarLabel}>{labelForDate(day.date)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function WeightTrendChart({
  dates,
  values,
  unit,
}: {
  dates: string[];
  values: number[];
  unit: string;
}) {
  const width = 300;
  const height = 140;
  const path = buildLinePath(values, width, height);
  const delta = values.length >= 2 ? values[values.length - 1] - values[0] : 0;

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={path} stroke="#8BCFF0" strokeWidth={4} strokeLinecap="round" fill="none" />
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>{labelForDate(dates[0])}</Text>
        <Text style={styles.chartLabel}>
          {delta > 0 ? '+' : ''}
          {Math.round(delta * 10) / 10}
          {unit}
        </Text>
      </View>
    </View>
  );
}

function ComplianceBar({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  return (
    <View style={styles.complianceItem}>
      <View style={styles.complianceTrack}>
        <View style={[styles.complianceFill, { height: `${percent}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.compliancePercent}>{percent}%</Text>
      <Text style={styles.complianceLabel}>{label}</Text>
    </View>
  );
}

function computeCompliance(
  data: MacroDay[],
  goals: { protein: number; carbs: number; fat: number; fiber: number },
) {
  if (data.length === 0) {
    return { protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }

  const countHit = (selector: (row: MacroDay) => number, goal: number) =>
    Math.round((data.filter((row) => selector(row) >= goal).length / data.length) * 100);

  return {
    protein: countHit((row) => row.protein, goals.protein),
    carbs: countHit((row) => row.carbs, goals.carbs),
    fat: countHit((row) => row.fat, goals.fat),
    fiber: countHit((row) => row.fiber, goals.fiber),
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 20,
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  heroTitle: {
    ...NU_TYPOGRAPHY.displayLg,
    color: NU_TEXT,
    fontSize: 44,
    lineHeight: 46,
  },
  heroBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: NU_SURFACES.low,
  },
  periodChipActive: {
    backgroundColor: 'rgba(255,184,119,0.18)',
  },
  periodChipText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
  },
  periodChipTextActive: {
    color: NU_ACCENT_LIGHT,
  },
  panel: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    backgroundColor: NU_SURFACES.low,
  },
  chartWrap: {
    gap: 10,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
  },
  linkText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_ACCENT_LIGHT,
  },
  stackChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  stackBarCol: {
    width: 24,
    gap: 8,
  },
  stackBarTrack: {
    height: 120,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: NU_SURFACES.high,
  },
  stackSegment: {
    width: '100%',
  },
  stackBarLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
    transform: [{ rotate: '-45deg' }],
    marginTop: 6,
  },
  insightStack: {
    gap: 12,
  },
  insightCard: {
    borderRadius: 22,
    padding: 16,
    gap: 10,
    backgroundColor: NU_SURFACES.mid,
  },
  insightHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  insightBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  insightMetric: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_ACCENT_LIGHT,
  },
  insightBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  insightRecommendation: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
  },
  complianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  complianceItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  complianceTrack: {
    width: '100%',
    height: 120,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: NU_SURFACES.high,
  },
  complianceFill: {
    width: '100%',
  },
  compliancePercent: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  complianceLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
  },
  emptyText: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_TERTIARY,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: NU_SURFACES.base,
  },
});
