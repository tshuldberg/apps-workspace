import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Ellipse, Rect } from 'react-native-svg';
import {
  BODY_MAP_MUSCLE_GROUPS,
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  buildRecoveryMap,
  getBestToTrain,
  getWorkoutExercises,
  getWorkoutSessions,
  seedWorkoutExerciseLibrary,
  type MuscleGroup,
  type SessionMuscleData,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { WorkoutHero, WorkoutPrimaryButton } from './(tabs)/_screen-kit';

type RecoveryView = 'front' | 'back';

type BodyShape = {
  key: string;
  muscleGroup: MuscleGroup;
  side: RecoveryView;
  kind: 'rect' | 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
};

const BODY_SHAPES: BodyShape[] = [
  { key: 'front-chest', muscleGroup: 'chest', side: 'front', kind: 'rect', x: 108, y: 60, width: 104, height: 40 },
  { key: 'front-shoulders-left', muscleGroup: 'shoulders', side: 'front', kind: 'ellipse', x: 82, y: 72, width: 30, height: 36 },
  { key: 'front-shoulders-right', muscleGroup: 'shoulders', side: 'front', kind: 'ellipse', x: 208, y: 72, width: 30, height: 36 },
  { key: 'front-biceps-left', muscleGroup: 'biceps', side: 'front', kind: 'ellipse', x: 74, y: 120, width: 26, height: 46 },
  { key: 'front-biceps-right', muscleGroup: 'biceps', side: 'front', kind: 'ellipse', x: 220, y: 120, width: 26, height: 46 },
  { key: 'front-forearms-left', muscleGroup: 'forearms', side: 'front', kind: 'rect', x: 70, y: 160, width: 24, height: 54 },
  { key: 'front-forearms-right', muscleGroup: 'forearms', side: 'front', kind: 'rect', x: 226, y: 160, width: 24, height: 54 },
  { key: 'front-core', muscleGroup: 'core', side: 'front', kind: 'rect', x: 126, y: 108, width: 68, height: 76 },
  { key: 'front-hip-flexors', muscleGroup: 'hip_flexors', side: 'front', kind: 'rect', x: 128, y: 186, width: 64, height: 28 },
  { key: 'front-quads-left', muscleGroup: 'quads', side: 'front', kind: 'rect', x: 120, y: 218, width: 26, height: 82 },
  { key: 'front-quads-right', muscleGroup: 'quads', side: 'front', kind: 'rect', x: 174, y: 218, width: 26, height: 82 },
  { key: 'back-back', muscleGroup: 'back', side: 'back', kind: 'rect', x: 104, y: 60, width: 112, height: 84 },
  { key: 'back-shoulders-left', muscleGroup: 'shoulders', side: 'back', kind: 'ellipse', x: 82, y: 70, width: 30, height: 36 },
  { key: 'back-shoulders-right', muscleGroup: 'shoulders', side: 'back', kind: 'ellipse', x: 208, y: 70, width: 30, height: 36 },
  { key: 'back-triceps-left', muscleGroup: 'triceps', side: 'back', kind: 'ellipse', x: 74, y: 122, width: 26, height: 46 },
  { key: 'back-triceps-right', muscleGroup: 'triceps', side: 'back', kind: 'ellipse', x: 220, y: 122, width: 26, height: 46 },
  { key: 'back-forearms-left', muscleGroup: 'forearms', side: 'back', kind: 'rect', x: 70, y: 162, width: 24, height: 52 },
  { key: 'back-forearms-right', muscleGroup: 'forearms', side: 'back', kind: 'rect', x: 226, y: 162, width: 24, height: 52 },
  { key: 'back-glutes-left', muscleGroup: 'glutes', side: 'back', kind: 'ellipse', x: 126, y: 192, width: 34, height: 38 },
  { key: 'back-glutes-right', muscleGroup: 'glutes', side: 'back', kind: 'ellipse', x: 160, y: 192, width: 34, height: 38 },
  { key: 'back-hamstrings-left', muscleGroup: 'hamstrings', side: 'back', kind: 'rect', x: 122, y: 228, width: 28, height: 84 },
  { key: 'back-hamstrings-right', muscleGroup: 'hamstrings', side: 'back', kind: 'rect', x: 172, y: 228, width: 28, height: 84 },
  { key: 'back-calves-left', muscleGroup: 'calves', side: 'back', kind: 'rect', x: 124, y: 316, width: 24, height: 58 },
  { key: 'back-calves-right', muscleGroup: 'calves', side: 'back', kind: 'rect', x: 174, y: 316, width: 24, height: 58 },
];

function getRecoveryColor(score: number): string {
  if (score <= 30) return WK_CATEGORY_COLORS.hypertrophy;
  if (score <= 70) return WK_ACCENT_LIGHT;
  return WK_CATEGORY_COLORS.recovery;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'No recent session';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  });
}

function buildSessionMuscleData(
  sessions: ReturnType<typeof getWorkoutSessions>,
  exerciseLookup: Map<string, ReturnType<typeof getWorkoutExercises>[number]>,
): SessionMuscleData[] {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

  return sessions
    .filter((session) => session.completedAt && new Date(session.completedAt).getTime() >= cutoff)
    .map((session) => {
      const muscleVolume = new Map<MuscleGroup, { totalSets: number; totalReps: number; isPrimary: boolean }>();

      session.exercisesCompleted.forEach((completed) => {
        if (completed.skipped) return;
        const exercise = exerciseLookup.get(completed.exerciseId);
        if (!exercise) return;

        exercise.muscleGroups.forEach((muscleGroup, index) => {
          if (muscleGroup === 'full_body') return;

          const current = muscleVolume.get(muscleGroup) ?? {
            totalSets: 0,
            totalReps: 0,
            isPrimary: false,
          };
          current.totalSets += Math.max(completed.setsCompleted, 1);
          current.totalReps += completed.repsCompleted ?? 0;
          current.isPrimary = current.isPrimary || index === 0;
          muscleVolume.set(muscleGroup, current);
        });
      });

      return {
        sessionId: session.id,
        completedAt: session.completedAt ?? session.startedAt,
        muscleVolume: Array.from(muscleVolume.entries()).map(([muscleGroup, value]) => ({
          muscleGroup,
          totalSets: value.totalSets,
          totalReps: value.totalReps,
          isPrimary: value.isPrimary,
          avgIntensityPct: null,
        })),
      };
    })
    .filter((entry) => entry.muscleVolume.length > 0);
}

function BodyMap({
  view,
  selectedMuscle,
  onSelect,
  scores,
}: {
  view: RecoveryView;
  selectedMuscle: MuscleGroup | null;
  onSelect: (muscleGroup: MuscleGroup) => void;
  scores: Map<MuscleGroup, { score: number }>;
}) {
  const visibleShapes = BODY_SHAPES.filter((shape) => shape.side === view);

  return (
    <Svg width="100%" height={420} viewBox="0 0 320 420">
      <Ellipse cx={160} cy={30} rx={26} ry={24} fill="rgba(255,255,255,0.06)" />
      <Rect x={140} y={46} width={40} height={30} rx={10} fill="rgba(255,255,255,0.05)" />
      <Rect x={124} y={76} width={72} height={110} rx={18} fill="rgba(255,255,255,0.03)" />
      <Rect x={100} y={88} width={24} height={128} rx={12} fill="rgba(255,255,255,0.03)" />
      <Rect x={196} y={88} width={24} height={128} rx={12} fill="rgba(255,255,255,0.03)" />
      <Rect x={132} y={184} width={56} height={56} rx={18} fill="rgba(255,255,255,0.03)" />
      <Rect x={128} y={236} width={26} height={142} rx={14} fill="rgba(255,255,255,0.03)" />
      <Rect x={166} y={236} width={26} height={142} rx={14} fill="rgba(255,255,255,0.03)" />

      {visibleShapes.map((shape) => {
        const score = scores.get(shape.muscleGroup)?.score ?? 100;
        const fill = getRecoveryColor(score);
        const selected = selectedMuscle === shape.muscleGroup;

        if (shape.kind === 'ellipse') {
          return (
            <Ellipse
              key={shape.key}
              cx={shape.x + shape.width / 2}
              cy={shape.y + shape.height / 2}
              rx={shape.width / 2}
              ry={shape.height / 2}
              fill={fill}
              fillOpacity={selected ? 0.92 : 0.72}
              onPress={() => onSelect(shape.muscleGroup)}
            />
          );
        }

        return (
          <Rect
            key={shape.key}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={10}
            fill={fill}
            fillOpacity={selected ? 0.92 : 0.72}
            onPress={() => onSelect(shape.muscleGroup)}
          />
        );
      })}
    </Svg>
  );
}

export default function RecoveryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [view, setView] = useState<RecoveryView>('front');
  const exercises = useMemo(() => {
    seedWorkoutExerciseLibrary(db);
    return getWorkoutExercises(db, { limit: 500 });
  }, [db]);
  const sessions = useMemo(() => {
    return getWorkoutSessions(db, { onlyCompleted: true, limit: 120 });
  }, [db]);
  const exerciseLookup = useMemo(() => {
    return new Map(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);

  const recoveryMap = useMemo(() => {
    const sessionData = buildSessionMuscleData(sessions, exerciseLookup);
    return buildRecoveryMap(sessionData);
  }, [exerciseLookup, sessions]);

  const entries = useMemo(() => {
    return Array.from(recoveryMap.values())
      .filter((entry) => entry.muscleGroup !== 'full_body')
      .sort((left, right) => left.score - right.score);
  }, [recoveryMap]);

  const suggestion = useMemo(() => getBestToTrain(recoveryMap), [recoveryMap]);
  const topThree = useMemo(() => {
    return suggestion.freshMuscles
      .map((muscleGroup) => recoveryMap.get(muscleGroup))
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
  }, [recoveryMap, suggestion.freshMuscles]);

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(
    entries[0]?.muscleGroup ?? null,
  );

  useEffect(() => {
    if (!entries.length) {
      setSelectedMuscle(null);
      return;
    }

    setSelectedMuscle((current) => {
      if (current && recoveryMap.has(current)) return current;
      return entries[0]?.muscleGroup ?? null;
    });
  }, [entries, recoveryMap]);

  const selectedEntry = selectedMuscle
    ? recoveryMap.get(selectedMuscle) ?? null
    : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <WorkoutHero
        eyebrow="Recovery Surface"
        title="Recovery Status"
        subtitle="Tap individual muscle groups to inspect freshness, last training time, and where to push next."
        accent={WK_ACCENT_LIGHT}
        action={
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: WK_CATEGORY_COLORS.hypertrophy }]} />
            <View style={[styles.legendDot, { backgroundColor: WK_ACCENT_LIGHT }]} />
            <View style={[styles.legendDot, { backgroundColor: WK_CATEGORY_COLORS.recovery }]} />
          </View>
        }
      />

      {entries.length === 0 ? (
        <GlassPanel style={styles.emptyPanel}>
          <MaterialSymbol name="monitor_heart" size={24} color={WK_ACCENT_LIGHT} />
          <Text style={styles.emptyTitle}>No recovery history yet</Text>
          <Text style={styles.emptyCopy}>
            Finish a few logged workouts and the body map will start showing readiness by muscle group.
          </Text>
        </GlassPanel>
      ) : (
        <>
          <GlassPanel style={styles.bodyPanel} intensity={54}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>Body Heatmap</Text>
              <View style={styles.chipRow}>
                <Chip label="Front" selected={view === 'front'} onPress={() => setView('front')} />
                <Chip label="Back" selected={view === 'back'} onPress={() => setView('back')} />
              </View>
            </View>
            <BodyMap
              view={view}
              selectedMuscle={selectedMuscle}
              onSelect={setSelectedMuscle}
              scores={new Map(entries.map((entry) => [entry.muscleGroup, entry]))}
            />
          </GlassPanel>

          <GlassPanel style={styles.panel}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.sectionLabel}>Best To Train</Text>
                <Text style={styles.bestTitle}>{suggestion.label}</Text>
              </View>
              <WorkoutPrimaryButton
                label="Build Workout"
                icon="fitness_center"
                onPress={() => router.push('/(workouts)/builder' as never)}
              />
            </View>

            {topThree.map((entry) => (
              <View key={entry.muscleGroup} style={styles.bestRow}>
                <Text style={styles.bestMuscle}>{BODY_MAP_MUSCLE_GROUPS.find((item) => item.id === entry.muscleGroup)?.label ?? entry.muscleGroup}</Text>
                <View style={styles.bestScorePill}>
                  <Text style={styles.bestScoreText}>{entry.score}</Text>
                </View>
              </View>
            ))}
          </GlassPanel>

          {selectedEntry ? (
            <GlassPanel style={styles.panel}>
              <Text style={styles.sectionLabel}>Selected Muscle</Text>
              <Text style={styles.detailTitle}>
                {BODY_MAP_MUSCLE_GROUPS.find((item) => item.id === selectedEntry.muscleGroup)?.label ?? selectedEntry.muscleGroup}
              </Text>
              <Text style={styles.detailMeta}>
                Score {selectedEntry.score} • {selectedEntry.status}
              </Text>
              <Text style={styles.helperCopy}>
                Last trained: {formatTimestamp(selectedEntry.lastTrainedAt)}
              </Text>
              <Text style={styles.helperCopy}>
                Volume last session: {selectedEntry.volumeLastSession} sets • {selectedEntry.frequencyLast7Days} sessions in 7 days
              </Text>
              <Text style={styles.helperCopy}>
                Hours until fully recovered: {selectedEntry.hoursUntilRecovered}
              </Text>
            </GlassPanel>
          ) : null}

          <View style={styles.grid}>
            {entries.map((entry) => (
              <Pressable
                key={entry.muscleGroup}
                onPress={() => setSelectedMuscle(entry.muscleGroup)}
                style={styles.gridCard}
              >
                <View style={[styles.gridScore, { backgroundColor: getRecoveryColor(entry.score) }]} />
                <Text style={styles.gridTitle}>
                  {BODY_MAP_MUSCLE_GROUPS.find((item) => item.id === entry.muscleGroup)?.label ?? entry.muscleGroup}
                </Text>
                <Text style={styles.gridMeta}>{entry.score} / 100</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  panel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  bodyPanel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.high,
  },
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bestTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: '#FFF3E7',
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  bestMuscle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: '#F4EEE8',
  },
  bestScorePill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  bestScoreText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    color: WK_ACCENT_LIGHT,
  },
  detailTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: '#FFF3E7',
  },
  detailMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: WK_ACCENT_LIGHT,
  },
  helperCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCard: {
    width: '48%',
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: WK_SURFACES.low,
  },
  gridScore: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  gridTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: '#F4EEE8',
  },
  gridMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  emptyPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: WK_SURFACES.low,
  },
  emptyTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 18,
    color: '#FFF3E7',
  },
  emptyCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.62)',
    textAlign: 'center',
  },
});
