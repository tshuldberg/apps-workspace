import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getDailyReport,
  type DailyReport,
} from '@mylife/nutrition';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.nutrition;
const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function prevDay(date: string): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextDay(date: string): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function scoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return '#EAB308';
  if (score >= 40) return ACCENT;
  return colors.danger;
}

export default function ReportScreen() {
  const db = useDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const report: DailyReport = useMemo(
    () => getDailyReport(db, selectedDate),
    [db, selectedDate],
  );

  const ts = report.targetScore;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Date nav */}
      <View style={styles.dateRow}>
        <Pressable onPress={() => setSelectedDate(prevDay(selectedDate))}>
          <Text variant="body" color={ACCENT}>{'\u2039'}</Text>
        </Pressable>
        <Text variant="body">{formatDate(selectedDate)}</Text>
        <Pressable onPress={() => setSelectedDate(nextDay(selectedDate))}>
          <Text variant="body" color={ACCENT}>{'\u203a'}</Text>
        </Pressable>
      </View>

      {/* Aggregate score */}
      <Card style={styles.scoreCard}>
        <Text variant="label" color={colors.textTertiary}>ALL TARGETS</Text>
        <View style={styles.scoreCenter}>
          <Text style={[styles.bigScore, { color: scoreColor(ts.score) }]}>
            {ts.score}%
          </Text>
          <Text variant="caption" color={colors.textSecondary}>Overall Score</Text>
        </View>
        <View style={styles.macroScoreRow}>
          <ScorePill label="Cal" value={ts.macros.calories} />
          <ScorePill label="Prot" value={ts.macros.protein} />
          <ScorePill label="Carbs" value={ts.macros.carbs} />
          <ScorePill label="Fat" value={ts.macros.fat} />
        </View>
        {ts.microsTotal > 0 && (
          <Text variant="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            Micronutrients: {ts.microsMet}/{ts.microsTotal} targets met
          </Text>
        )}
      </Card>

      {/* Meal breakdown */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>MEAL BREAKDOWN</Text>
        {report.mealBreakdown.length === 0 ? (
          <Text variant="caption" color={colors.textTertiary}>No meals logged</Text>
        ) : (
          report.mealBreakdown.map((meal) => (
            <View key={meal.mealType} style={styles.mealRow}>
              <Text variant="body">{MEAL_LABELS[meal.mealType] ?? meal.mealType}</Text>
              <View style={styles.mealRight}>
                <Text variant="caption" color={colors.textSecondary}>{meal.itemCount} items</Text>
                <Text variant="body" color={ACCENT}>{meal.calories} cal</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Top calorie sources */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>TOP CALORIE SOURCES</Text>
        {report.topCalorieSources.length === 0 ? (
          <Text variant="caption" color={colors.textTertiary}>No data</Text>
        ) : (
          report.topCalorieSources.map((item, i) => (
            <View key={i} style={styles.sourceRow}>
              <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{item.name}</Text>
              <Text variant="caption" color={ACCENT}>{item.calories} cal</Text>
            </View>
          ))
        )}
      </Card>

      {/* Top protein sources */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>TOP PROTEIN SOURCES</Text>
        {report.topProteinSources.length === 0 ? (
          <Text variant="caption" color={colors.textTertiary}>No data</Text>
        ) : (
          report.topProteinSources.map((item, i) => (
            <View key={i} style={styles.sourceRow}>
              <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{item.name}</Text>
              <Text variant="caption" color="#3B82F6">{item.proteinG}g</Text>
            </View>
          ))
        )}
      </Card>

      {/* Water */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>HYDRATION</Text>
        <View style={styles.waterRow}>
          <Text variant="body">{'\ud83d\udca7'} {Math.round(report.waterMl)} ml</Text>
          <Text variant="caption" color={colors.textSecondary}>
            / {report.waterGoalMl} ml goal
          </Text>
        </View>
        <View style={styles.waterBarOuter}>
          <View
            style={[
              styles.waterBarInner,
              { width: `${Math.min(100, (report.waterMl / report.waterGoalMl) * 100)}%` },
            ]}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scorePill}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="caption" color={scoreColor(value)} style={{ fontWeight: '600' }}>
        {value}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  scoreCard: { alignItems: 'center', gap: spacing.sm },
  scoreCenter: { alignItems: 'center', gap: 4 },
  bigScore: { fontSize: 48, fontWeight: '800', fontFamily: 'Inter' },
  macroScoreRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  scorePill: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 60,
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  waterBarOuter: {
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  waterBarInner: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
});
