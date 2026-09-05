/**
 * Phase 4a Insights — Correlations panel.
 *
 * Renders a picker for module A × module B (from modules that expose
 * `crossModule.getCorrelationData`) and shows every overlapping metric pair
 * via `queryCorrelation` from @mylife/intelligence.
 *
 * Scatterplot is an inline SVG. No new chart deps; no LLM.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import type { ModuleDefinition } from '@mylife/module-registry';
import { queryCorrelation, type CorrelationResult } from '@mylife/intelligence';
import type { DatabaseAdapter } from '@mylife/db';

interface Props {
  db: DatabaseAdapter;
  modules: ModuleDefinition[];
}

type CorrelatableModule = ModuleDefinition;

function directionLabel(coefficient: number): 'positive' | 'negative' | 'none' {
  if (Math.abs(coefficient) < 0.1) return 'none';
  return coefficient > 0 ? 'positive' : 'negative';
}

/** Simple scatter — pulls the first two series from the correlation result's
 * modules by re-querying via the engine's public helpers would require access
 * to raw series, which the public API does not expose. Instead we render the
 * coefficient visually with a normalized unit-circle-like diagonal. */
function Scatter({ coefficient }: { coefficient: number }) {
  const size = 120;
  const mid = size / 2;
  const r = Math.max(-1, Math.min(1, coefficient));
  // Build 24 sampled points along a noisy diagonal scaled by |r|.
  const points = Array.from({ length: 24 }).map((_, i) => {
    const t = (i - 12) / 12; // -1..1
    const noise = (((i * 9301 + 49297) % 233280) / 233280) * 0.6 - 0.3;
    const x = mid + t * (mid - 10);
    const y = mid - (t * r + noise * (1 - Math.abs(r))) * (mid - 10);
    return { x, y };
  });
  return (
    <Svg width={size} height={size} style={styles.scatter}>
      <Rect x={0} y={0} width={size} height={size} fill={surfaceTiers.lowest} rx={8} />
      <Line x1={0} y1={mid} x2={size} y2={mid} stroke={colors.border} strokeWidth={1} />
      <Line x1={mid} y1={0} x2={mid} y2={size} stroke={colors.border} strokeWidth={1} />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.hubAccent} />
      ))}
    </Svg>
  );
}

export function CorrelationPanel({ db, modules }: Props) {
  const correlatable = useMemo<CorrelatableModule[]>(
    () => modules.filter((m) => m.crossModule?.getCorrelationData),
    [modules],
  );

  const [aId, setAId] = useState<string | null>(correlatable[0]?.id ?? null);
  const [bId, setBId] = useState<string | null>(correlatable[1]?.id ?? null);

  const results = useMemo<CorrelationResult[]>(() => {
    if (!aId || !bId || aId === bId) return [];
    return queryCorrelation(db, modules, aId, bId);
  }, [db, modules, aId, bId]);

  if (correlatable.length < 2) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Not enough data yet</Text>
        <Text style={styles.emptyBody}>
          Correlations need at least two modules with tracked metrics. Enable a
          second tracking module and log data for a week or two.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.pickerRow}>
        <ModulePicker
          label="Metric A"
          modules={correlatable}
          value={aId}
          onChange={setAId}
        />
        <ModulePicker
          label="Metric B"
          modules={correlatable}
          value={bId}
          onChange={setBId}
        />
      </View>

      {aId === bId ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyBody}>Pick two different modules.</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No overlap</Text>
          <Text style={styles.emptyBody}>
            Not enough overlapping days of data between these two modules yet.
          </Text>
        </View>
      ) : (
        results.map((r, i) => <CorrelationCard key={i} result={r} />)
      )}
    </View>
  );
}

function ModulePicker({
  label,
  modules,
  value,
  onChange,
}: {
  label: string;
  modules: CorrelatableModule[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.pickerColumn}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.pickerChips}>
          {modules.map((m) => {
            const active = m.id === value;
            return (
              <Pressable
                key={m.id}
                onPress={() => onChange(m.id)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={`${label}-${m.id}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    active ? styles.chipTextActive : undefined,
                  ]}
                >
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function CorrelationCard({ result }: { result: CorrelationResult }) {
  const dir = directionLabel(result.coefficient);
  return (
    <View style={styles.resultCard}>
      <View style={styles.resultBody}>
        <Text style={styles.resultTitle}>
          {result.labelA} × {result.labelB}
        </Text>
        <Text style={styles.resultCoefficient}>
          r = {result.coefficient.toFixed(2)}
        </Text>
        <View style={styles.pillRow}>
          <Pill label={dir} tone={dir} />
          <Pill label={result.strength} tone="neutral" />
          <Pill label={`${result.dataPoints}d`} tone="neutral" />
        </View>
      </View>
      <Scatter coefficient={result.coefficient} />
    </View>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'positive' | 'negative' | 'none' | 'neutral';
}) {
  const bg =
    tone === 'positive'
      ? 'rgba(48, 209, 88, 0.14)'
      : tone === 'negative'
        ? 'rgba(255, 180, 171, 0.14)'
        : surfaceTiers.high;
  const fg =
    tone === 'positive' ? '#30D158' : tone === 'negative' ? '#FFB4AB' : colors.text;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerRow: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  pickerColumn: {
    gap: spacing.xs,
  },
  pickerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pickerChips: {
    flexDirection: 'row',
    gap: spacing.xs,
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
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resultBody: {
    flex: 1,
    gap: spacing.xs,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  resultCoefficient: {
    color: colors.hubAccent,
    fontSize: 24,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scatter: {
    alignSelf: 'center',
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
