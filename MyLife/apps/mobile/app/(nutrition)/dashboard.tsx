import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import {
  getCalorieHistory,
  getDailyNutrientTotals,
  getDailySummary,
  getEnergyBalance,
  MaterialSymbol,
  NutrientGauge,
  NU_ACCENT,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_MACROS,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  SectionHeader,
  type DailyNutrientTotal,
  type DayTotal,
} from '@mylife/nutrition';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function donutArcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export default function NutritionDashboardScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const date = todayKey();

  const state = useMemo(() => {
    try {
      const summary = getDailySummary(db, date);
      const nutrients = getDailyNutrientTotals(db, date);
      const energyBalance = getEnergyBalance(db, date);
      const trend = getCalorieHistory(db, 7);

      return {
        error: null as string | null,
        summary,
        nutrients,
        energyBalance,
        trend,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load the dashboard.',
        summary: null,
        nutrients: [] as DailyNutrientTotal[],
        energyBalance: { caloriesIn: 0, caloriesOut: 0, net: 0 },
        trend: [] as DayTotal[],
      };
    }
  }, [db, date, tick]);

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

  const summary = state.summary;
  const nutrients = state.nutrients;
  const vitamins = nutrients.filter((item) => item.category === 'vitamin').slice(0, 13);
  const minerals = nutrients.filter((item) => item.category === 'mineral').slice(0, 10);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={NU_ACCENT} />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Today</Text>
        <Text style={styles.heroTitle}>Nutrient Dashboard</Text>
        <Text style={styles.heroBody}>
          {nutrients.length} tracked nutrients surfaced from today&apos;s food log.
        </Text>
      </View>

      <View style={styles.energyCard}>
        <SectionHeader title="Energy balance" />
        <View style={styles.energyStats}>
          <EnergyPill label="Consumed" value={Math.round(state.energyBalance.caloriesIn)} accent={NU_CALORIE} />
          <EnergyPill label="Burned" value={Math.round(state.energyBalance.caloriesOut)} accent={NU_ACCENT_LIGHT} />
        </View>
        <Text style={styles.netLabel}>Net calories</Text>
        <Text
          style={[
            styles.netValue,
            {
              color:
                state.energyBalance.net > 0
                  ? NU_CALORIE
                  : state.energyBalance.net < 0
                    ? '#30D158'
                    : NU_TEXT,
            },
          ]}
        >
          {state.energyBalance.net > 0 ? '+' : ''}
          {Math.round(state.energyBalance.net)}
        </Text>
        {state.energyBalance.caloriesOut === 0 ? (
          <Text style={styles.energyHint}>Connect MyWorkouts or enable energy sync to populate calorie burn.</Text>
        ) : (
          <Text style={styles.energyHint}>Based on intake minus recorded expenditure for today.</Text>
        )}
      </View>

      <View style={styles.dualColumn}>
        <View style={styles.panel}>
          <SectionHeader title="Macro distribution" />
          <MacroDonut
            protein={summary?.proteinG ?? 0}
            carbs={summary?.carbsG ?? 0}
            fat={summary?.fatG ?? 0}
            fiber={summary?.fiberG ?? 0}
            calories={summary?.calories ?? 0}
          />
        </View>

        <Pressable style={styles.panel} onPress={() => router.push('/(nutrition)/(tabs)/trends' as never)}>
          <SectionHeader
            title="7-day trend"
            action={<Text style={styles.linkText}>View detail</Text>}
          />
          <TrendMiniChart data={state.trend} />
        </Pressable>
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Vitamins" />
        {vitamins.length === 0 || vitamins.every((item) => item.total === 0) ? (
          <Text style={styles.emptyText}>Log foods with micronutrient data to reveal your vitamin coverage.</Text>
        ) : (
          <View style={styles.gaugeGrid}>
            {vitamins.map((item) => (
              <View key={item.nutrientId} style={styles.gaugeCell}>
                <NutrientGauge
                  name={item.nutrientName.replace('Vitamin ', 'Vit ')}
                  value={item.total}
                  goal={item.rdaValue ?? 0}
                  unit={item.unit}
                  category="vitamin"
                />
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Minerals" />
        {minerals.length === 0 || minerals.every((item) => item.total === 0) ? (
          <Text style={styles.emptyText}>Mineral coverage appears here after foods with nutrient panels are logged.</Text>
        ) : (
          <View style={styles.gaugeGrid}>
            {minerals.map((item) => (
              <View key={item.nutrientId} style={styles.gaugeCell}>
                <NutrientGauge
                  name={item.nutrientName}
                  value={item.total}
                  goal={item.rdaValue ?? 0}
                  unit={item.unit}
                  category="mineral"
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function EnergyPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={styles.energyPill}>
      <Text style={styles.energyPillLabel}>{label}</Text>
      <Text style={[styles.energyPillValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function MacroDonut({
  protein,
  carbs,
  fat,
  fiber,
  calories,
}: {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  calories: number;
}) {
  const data = [
    { label: 'Protein', value: protein * 4, grams: protein, color: NU_MACROS.protein },
    { label: 'Carbs', value: carbs * 4, grams: carbs, color: NU_MACROS.carbs },
    { label: 'Fat', value: fat * 9, grams: fat, color: NU_MACROS.fat },
    { label: 'Fiber', value: fiber * 2, grams: fiber, color: NU_MACROS.fiber },
  ].filter((item) => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const size = 148;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  let cursor = 0;

  return (
    <View style={styles.donutWrap}>
      <View style={styles.donutHost}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={NU_SURFACES.high}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {data.map((item) => {
            const startAngle = (cursor / total) * 360;
            cursor += item.value;
            const endAngle = (cursor / total) * 360;
            return (
              <Path
                key={item.label}
                d={donutArcPath(center, center, radius, startAngle, endAngle)}
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="transparent"
              />
            );
          })}
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutCalories}>{Math.round(calories)}</Text>
          <Text style={styles.donutCaloriesLabel}>kcal</Text>
        </View>
      </View>

      <View style={styles.legendStack}>
        {data.map((item) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={styles.legendValue}>
                {Math.round(item.grams * 10) / 10}g • {percentage}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TrendMiniChart({ data }: { data: DayTotal[] }) {
  if (data.length === 0) {
    return <Text style={styles.emptyText}>Log a few days to see the seven-day trend.</Text>;
  }

  const maxCalories = Math.max(...data.map((item) => item.calories), 1);

  return (
    <View style={styles.trendWrap}>
      <View style={styles.trendBars}>
        {data.map((item) => (
          <View key={item.date} style={styles.trendBarSlot}>
            <View
              style={[
                styles.trendBar,
                { height: `${Math.max((item.calories / maxCalories) * 100, 4)}%` },
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={styles.trendBody}>Tap into Trends for longer periods, insights, and macro compliance.</Text>
    </View>
  );
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
  energyCard: {
    borderRadius: 28,
    padding: 20,
    gap: 14,
    backgroundColor: NU_SURFACES.low,
  },
  energyStats: {
    flexDirection: 'row',
    gap: 12,
  },
  energyPill: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    gap: 4,
    backgroundColor: NU_SURFACES.mid,
  },
  energyPillLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  energyPillValue: {
    ...NU_TYPOGRAPHY.headlineMd,
  },
  netLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  netValue: {
    ...NU_TYPOGRAPHY.displayLg,
    fontSize: 42,
    lineHeight: 44,
  },
  energyHint: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  dualColumn: {
    gap: 16,
  },
  panel: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    backgroundColor: NU_SURFACES.low,
  },
  donutWrap: {
    gap: 18,
  },
  donutHost: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCalories: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_CALORIE,
    fontSize: 28,
  },
  donutCaloriesLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  legendStack: {
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT,
    minWidth: 62,
  },
  legendValue: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  trendWrap: {
    gap: 12,
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 120,
  },
  trendBarSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: NU_ACCENT,
  },
  trendBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  linkText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_ACCENT_LIGHT,
  },
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gaugeCell: {
    width: '30.5%',
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
