import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  generateWorkoutInsights,
  getWorkoutDaysForInsights,
  getMoodDaysForInsights,
  getNutritionDaysForInsights,
  getFastingDaysForInsights,
} from '@mylife/workouts';
import type { WorkoutInsight } from '@mylife/workouts';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.workouts;

const SEVERITY_ICON: Record<string, { icon: string; color: string }> = {
  positive: { icon: '\u2713', color: colors.success },
  neutral: { icon: '\u2139', color: colors.warning },
  negative: { icon: '\u26A0', color: colors.danger },
};

export default function InsightsScreen() {
  const db = useDatabase();
  const [insights, setInsights] = useState<WorkoutInsight[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    try {
      const workoutDays = getWorkoutDaysForInsights(db, 14);
      const moodDays = getMoodDaysForInsights(db, 14);
      const nutritionDays = getNutritionDaysForInsights(db, 14);
      const fastingDays = getFastingDaysForInsights(db, 14);
      const result = generateWorkoutInsights({ workoutDays, moodDays, nutritionDays, fastingDays });
      setInsights(result);
    } catch {
      setInsights([]);
    }
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const visible = insights
    .filter((i) => !dismissed.has(i.id))
    .slice(0, showAll ? undefined : 4);

  const crossModuleTypes = new Set(['mood_lift_correlation', 'fasting_performance', 'protein_recovery', 'volume_mood_feedback']);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Workout Insights</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {insights.length} insight{insights.length !== 1 ? 's' : ''} from the last 14 days
        </Text>
      </Card>

      {visible.map((insight) => {
        const sev = SEVERITY_ICON[insight.severity] ?? SEVERITY_ICON.neutral;
        const isCross = crossModuleTypes.has(insight.type);
        return (
          <Card key={insight.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Text style={{ color: sev.color, fontSize: 16 }}>{sev.icon}</Text>
                  <Text variant="body" style={{ fontWeight: '600', flex: 1 }}>{insight.title}</Text>
                </View>
                <Text variant="caption" color={colors.textSecondary}>{insight.body}</Text>
                {insight.recommendation ? (
                  <Text variant="caption" color={ACCENT} style={{ marginTop: spacing.xs }}>
                    {insight.recommendation}
                  </Text>
                ) : null}
                <View style={styles.badgeRow}>
                  <View style={styles.metricBadge}>
                    <Text variant="caption" color={colors.text}>{insight.metric}</Text>
                  </View>
                  {isCross ? (
                    <View style={[styles.metricBadge, { backgroundColor: colors.glass }]}>
                      <Text variant="caption" color={colors.textSecondary}>Cross-module</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={() => setDismissed((prev) => new Set([...prev, insight.id]))}>
                <Text variant="caption" color={colors.textTertiary}>Dismiss</Text>
              </Pressable>
            </View>
          </Card>
        );
      })}

      {insights.length > 4 && !showAll ? (
        <Pressable style={styles.showAllButton} onPress={() => setShowAll(true)}>
          <Text variant="label" color={ACCENT}>See all {insights.length} insights</Text>
        </Pressable>
      ) : null}

      {insights.length === 0 ? (
        <Text variant="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          Work out for a few days to generate insights.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  metricBadge: { backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  showAllButton: { alignItems: 'center', paddingVertical: spacing.sm },
});
