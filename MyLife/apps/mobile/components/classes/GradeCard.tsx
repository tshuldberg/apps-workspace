import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import type {
  AssignmentRow,
  CategoryWeights,
  ClassGradeResult,
  ClassRow,
  FinalPrediction,
  TrendResult,
} from '@mylife/classes';
import { predictFinalGrade } from '@mylife/classes';
import { CategoryBreakdownBar } from './CategoryBreakdownBar';

export interface GradeCardProps {
  cls: ClassRow;
  assignments: AssignmentRow[];
  weights: CategoryWeights | null;
  grade: ClassGradeResult;
  trend: TrendResult;
  initialPrediction: FinalPrediction | null;
}

/**
 * Per-class grade card. Big percent + letter, color bar, category breakdown,
 * what-if slider that re-runs predictFinalGrade on tick.
 */
export function GradeCard({
  cls,
  assignments,
  weights,
  grade,
  trend,
  initialPrediction,
}: GradeCardProps) {
  const accent = cls.color || '#3B82F6';
  const defaultTarget =
    typeof cls.target_grade === 'number' && Number.isFinite(cls.target_grade)
      ? cls.target_grade
      : 90;

  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState<number>(defaultTarget);

  const livePrediction = useMemo<FinalPrediction>(
    () => predictFinalGrade(assignments, weights, target),
    [assignments, weights, target],
  );

  const percent = grade.percent;
  const letter = grade.letter ?? '—';
  const percentLabel = percent === null ? '—' : `${percent.toFixed(1)}%`;

  const trendLabel = trendToLabel(trend);
  const trendColor =
    trend.direction === 'up'
      ? colors.success ?? '#30D158'
      : trend.direction === 'down'
        ? colors.danger ?? '#FFB4AB'
        : colors.textTertiary;

  return (
    <Card elevated style={styles.card}>
      <View style={[styles.colorBar, { backgroundColor: accent }]} />

      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.className} numberOfLines={1}>
            {cls.name}
          </Text>
          {cls.code ? (
            <Text variant="caption" color={colors.textSecondary}>
              {cls.code}
              {cls.section ? ` · ${cls.section}` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerScore}>
          <Text style={[styles.bigPercent, { color: accent }]}>{percentLabel}</Text>
          <Text style={styles.bigLetter}>{letter}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text variant="caption" color={colors.textSecondary}>
          {grade.graded_count} graded · {cls.credits} credit{cls.credits === 1 ? '' : 's'}
        </Text>
        <View
          style={[styles.trendPill, { borderColor: trendColor }]}
        >
          <Text style={[styles.trendText, { color: trendColor }]}>{trendLabel}</Text>
        </View>
      </View>

      {Object.keys(grade.by_category).length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>By category</Text>
          <CategoryBreakdownBar categories={grade.by_category} accent={accent} />
        </View>
      ) : null}

      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [
          styles.expandRow,
          pressed && { opacity: 0.65 },
        ]}
      >
        <Text style={[styles.expandText, { color: accent }]}>
          {expanded ? 'Hide what-if' : `What if I get X% on remaining?`}
        </Text>
        <Text style={[styles.expandChevron, { color: accent }]}>
          {expanded ? '▾' : '▸'}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.section}>
          <View style={styles.targetRow}>
            <Text variant="caption" color={colors.textSecondary}>
              Target overall
            </Text>
            <Text style={[styles.targetValue, { color: accent }]}>
              {target.toFixed(0)}%
            </Text>
          </View>
          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTarget((t) => Math.max(50, t - 5))}
              style={({ pressed }) => [
                styles.stepperBtn,
                { borderColor: accent },
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={[styles.stepperGlyph, { color: accent }]}>-5</Text>
            </Pressable>
            <View style={styles.stepperTrack}>
              <View
                style={[
                  styles.stepperFill,
                  {
                    backgroundColor: accent,
                    width: `${Math.max(0, Math.min(100, ((target - 50) / 50) * 100))}%`,
                  },
                ]}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTarget((t) => Math.min(100, t + 5))}
              style={({ pressed }) => [
                styles.stepperBtn,
                { borderColor: accent },
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={[styles.stepperGlyph, { color: accent }]}>+5</Text>
            </Pressable>
          </View>
          <PredictionResult prediction={livePrediction} initial={initialPrediction} />
          {initialPrediction ? (
            <Text variant="caption" color={colors.textTertiary} style={styles.targetSub}>
              Class default target: {defaultTarget.toFixed(0)}%
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function PredictionResult({
  prediction,
  initial,
}: {
  prediction: FinalPrediction;
  initial: FinalPrediction | null;
}) {
  if (initial === null && prediction.required_remaining_percent === null) {
    return (
      <Text variant="body" color={colors.textSecondary}>
        No remaining work to grade. Current percent already determines outcome.
      </Text>
    );
  }
  const required = prediction.required_remaining_percent;
  if (required === null) {
    return (
      <Text variant="body" color={colors.textSecondary}>
        {prediction.achievable
          ? `Already meets target. Gap ${formatGap(prediction.gap_points)}.`
          : `Out of remaining work. Gap ${formatGap(prediction.gap_points)}.`}
      </Text>
    );
  }
  const tone = prediction.achievable
    ? colors.success ?? '#30D158'
    : colors.danger ?? '#FFB4AB';
  const verdict = prediction.achievable ? 'Achievable' : 'Out of reach';
  return (
    <View style={{ gap: 4 }}>
      <Text variant="body" color={colors.text}>
        Need <Text style={{ color: tone, fontWeight: '700' }}>{required.toFixed(1)}%</Text> avg
        on remaining work.
      </Text>
      <Text variant="caption" color={colors.textSecondary}>
        {verdict} · gap {formatGap(prediction.gap_points)}
      </Text>
    </View>
  );
}

function formatGap(gap: number): string {
  const sign = gap > 0 ? '+' : '';
  return `${sign}${gap.toFixed(1)} pts`;
}

function trendToLabel(t: TrendResult): string {
  if (t.confidence === 'low') return 'Not enough data';
  const arrow = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→';
  const slope = Math.abs(t.slope_per_week);
  return `${arrow} ${slope.toFixed(1)}/wk · ${t.confidence}`;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, overflow: 'hidden' },
  colorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerCopy: { flex: 1, gap: 2 },
  className: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerScore: { alignItems: 'flex-end' },
  bigPercent: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  bigLetter: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  trendText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  section: { gap: spacing.xs },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  expandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expandText: { fontSize: 13, fontWeight: '700' },
  expandChevron: { fontSize: 13, fontWeight: '700' },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  targetValue: { fontSize: 18, fontWeight: '800' },
  targetSub: { marginTop: 2 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    minWidth: 44,
    alignItems: 'center',
  },
  stepperGlyph: { fontSize: 13, fontWeight: '700' },
  stepperTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  stepperFill: { height: '100%', borderRadius: 3 },
});
