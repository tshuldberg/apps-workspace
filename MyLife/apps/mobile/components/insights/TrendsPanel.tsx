/**
 * Phase 4a Insights — Trends panel.
 *
 * Single-metric picker that calls `queryTrends` from @mylife/intelligence and
 * renders the 30-day values as an inline-SVG sparkline.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import type { ModuleDefinition } from '@mylife/module-registry';
import { queryTrends, type TrendResult } from '@mylife/intelligence';
import type { DatabaseAdapter } from '@mylife/db';

interface Props {
  db: DatabaseAdapter;
  modules: ModuleDefinition[];
}

interface MetricOption {
  moduleId: string;
  moduleName: string;
  metric: string;
  label: string;
  unit: string;
}

function collectMetrics(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
): MetricOption[] {
  const out: MetricOption[] = [];
  for (const mod of modules) {
    const get = mod.crossModule?.getCorrelationData;
    if (!get) continue;
    try {
      const dataset = get(db);
      for (const s of dataset.series) {
        out.push({
          moduleId: mod.id,
          moduleName: mod.name,
          metric: s.metric,
          label: s.label,
          unit: s.unit,
        });
      }
    } catch {
      continue;
    }
  }
  return out;
}

function Sparkline({ points }: { points: { date: string; value: number }[] }) {
  const width = 280;
  const height = 80;
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.value - min) / range) * (height - 8) - 4;
    return { x, y };
  });
  const d = coords.reduce(
    (acc, c, i) => acc + (i === 0 ? `M ${c.x} ${c.y}` : ` L ${c.x} ${c.y}`),
    '',
  );
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={colors.hubAccent} strokeWidth={2} fill="none" />
      {coords.map((c, i) => (
        <Circle key={i} cx={c.x} cy={c.y} r={2} fill={colors.hubAccent} />
      ))}
    </Svg>
  );
}

export function TrendsPanel({ db, modules }: Props) {
  const metrics = useMemo(() => collectMetrics(db, modules), [db, modules]);
  const [active, setActive] = useState<MetricOption | null>(metrics[0] ?? null);

  const trend = useMemo<TrendResult | null>(() => {
    if (!active) return null;
    return queryTrends(db, modules, active.moduleId, active.metric, 30);
  }, [db, modules, active]);

  if (metrics.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No trackable metrics</Text>
        <Text style={styles.emptyBody}>
          Enable tracking modules like Budget, Habits, Meds, or Workouts to see
          trends here.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.pickerLabel}>Metric</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.pickerChips}>
          {metrics.map((m) => {
            const activeChip = active?.metric === m.metric && active?.moduleId === m.moduleId;
            return (
              <Pressable
                key={`${m.moduleId}-${m.metric}`}
                onPress={() => setActive(m)}
                style={[styles.chip, activeChip && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={`metric-${m.moduleId}-${m.metric}`}
              >
                <Text
                  style={[styles.chipText, activeChip ? styles.chipTextActive : undefined]}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.resultCard}>
        {trend && trend.points.length > 0 ? (
          <>
            <Text style={styles.resultTitle}>{trend.label}</Text>
            <Text style={styles.resultMeta}>
              {trend.points.length} days · {trend.unit}
            </Text>
            <Sparkline points={trend.points} />
          </>
        ) : (
          <Text style={styles.emptyBody}>
            No data in the last 30 days for {active?.label ?? 'this metric'}.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  pickerChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: surfaceTiers.high,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.hubAccent,
    borderColor: colors.hubAccent,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#131318',
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  resultMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  emptyCard: {
    padding: spacing.md,
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
