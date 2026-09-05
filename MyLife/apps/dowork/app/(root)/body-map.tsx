import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import {
  BODY_MAP_MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  buildRecoveryMap,
  getBestToTrain,
  getWorkoutSessions,
  getSetWeightsForSession,
} from '@mylife/workouts';
import type { RecoveryMap, RecoveryScore, MuscleGroup, TrainingSuggestion } from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { DW_ACCENT, DW_ON_ACCENT } from './theme/tokens';

type FatigueState = 'Fresh' | 'Moderate' | 'Fatigued' | 'Overtrained';

const STATE_COLORS: Record<FatigueState, string> = {
  Fresh: '#30D158',
  Moderate: '#EAB308',
  Fatigued: '#EF4444',
  Overtrained: '#FF453A',
};

function classify(score: number, frequency: number): FatigueState {
  if (frequency >= 5) return 'Overtrained';
  if (score >= 80) return 'Fresh';
  if (score >= 50) return 'Moderate';
  return 'Fatigued';
}

function muscleLabel(mg: MuscleGroup): string {
  return (MUSCLE_GROUP_LABELS as Record<string, string>)[mg] ?? mg;
}

export default function BodyMapScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [map, setMap] = useState<RecoveryMap>(new Map());
  const [suggestion, setSuggestion] = useState<TrainingSuggestion | null>(null);
  const [selected, setSelected] = useState<MuscleGroup | null>(null);

  const load = useCallback(() => {
    try {
      const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 50 });
      const sessionData = sessions.map((s) => {
        let sets: ReturnType<typeof getSetWeightsForSession>;
        try {
          sets = getSetWeightsForSession(db, s.id);
        } catch {
          sets = [];
        }
        const volumeMap = new Map<string, { totalSets: number; totalReps: number }>();
        for (const sw of sets) {
          const key = sw.exerciseId;
          const existing = volumeMap.get(key) ?? { totalSets: 0, totalReps: 0 };
          existing.totalSets += 1;
          existing.totalReps += sw.reps ?? 0;
          volumeMap.set(key, existing);
        }
        return {
          sessionId: s.id,
          completedAt: s.completedAt ?? s.startedAt,
          muscleVolume: Array.from(volumeMap.entries()).map(([muscleGroup, vol]) => ({
            muscleGroup: muscleGroup as MuscleGroup,
            totalSets: vol.totalSets,
            totalReps: vol.totalReps,
            isPrimary: true,
            avgIntensityPct: null,
          })),
        };
      });
      const recoveryMap = buildRecoveryMap(sessionData);
      setMap(recoveryMap);
      setSuggestion(getBestToTrain(recoveryMap));
    } catch {
      setMap(new Map());
      setSuggestion(null);
    }
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const groups = BODY_MAP_MUSCLE_GROUPS.filter((g) => g.id !== 'full_body');
    return groups.map((g) => {
      const score: RecoveryScore | undefined = map.get(g.id);
      const frequency = score?.frequencyLast7Days ?? 0;
      const fatigue = score ? classify(score.score, frequency) : 'Fresh';
      return { def: g, score, fatigue };
    });
  }, [map]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">Recovery Map</Text>

      <View style={styles.card}>
        <View style={styles.legendRow}>
          {(Object.keys(STATE_COLORS) as FatigueState[]).map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: STATE_COLORS[s] }]} />
              <Text variant="caption" color={colors.textSecondary}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      {suggestion ? (
        <View style={styles.card}>
          <Text variant="caption" color={colors.textSecondary}>What to train today</Text>
          <Text variant="subheading" style={styles.suggestionText}>{suggestion.label}</Text>
        </View>
      ) : null}

      {rows.map(({ def, score, fatigue }) => {
        const isOpen = selected === def.id;
        const lastTrained = score?.hoursSinceLastTrained;
        const lastLabel = lastTrained == null
          ? 'Not tracked'
          : lastTrained < 24
            ? `${Math.round(lastTrained)}h ago`
            : `${Math.round(lastTrained / 24)} days ago`;
        const recoveryLabel = !score || score.hoursUntilRecovered === 0
          ? 'Recovered'
          : score.hoursUntilRecovered < 24
            ? `Rest ${Math.round(score.hoursUntilRecovered)}h more`
            : `Rest ${Math.round(score.hoursUntilRecovered / 24)} more days`;

        return (
          <Pressable
            key={def.id}
            onPress={() => setSelected(isOpen ? null : def.id)}
            style={styles.card}
          >
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={styles.muscleName}>{muscleLabel(def.id)}</Text>
                <Text variant="caption" color={colors.textSecondary}>{lastLabel}</Text>
              </View>
              <View style={styles.stateRow}>
                <View style={[styles.dot, { backgroundColor: STATE_COLORS[fatigue] }]} />
                <Text variant="caption" color={STATE_COLORS[fatigue]}>{fatigue}</Text>
              </View>
            </View>
            {isOpen ? (
              <View style={styles.detailBox}>
                <Text variant="caption" color={colors.textSecondary}>Recovery: {recoveryLabel}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Frequency: {score?.frequencyLast7Days ?? 0}x this week
                </Text>
                {score ? (
                  <Text variant="caption" color={colors.textSecondary}>
                    Score: {Math.round(score.score)}/100
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => {
          const type = suggestion?.type ?? 'full_body';
          router.push(`/(root)/builder?focus=${type}` as never);
        }}
        style={[styles.btn, styles.btnPrimary]}
      >
        <Text variant="label" color={DW_ON_ACCENT}>Suggest Workout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.xs,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  suggestionText: { fontSize: 18, lineHeight: 24, color: DW_ACCENT, marginTop: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  muscleName: { fontSize: 15, lineHeight: 19, fontWeight: '600' },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    gap: 4,
  },
  btn: { borderRadius: 999, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  btnPrimary: { backgroundColor: DW_ACCENT },
});
