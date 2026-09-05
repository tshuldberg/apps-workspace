import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import {
  BODY_MAP_MUSCLE_GROUPS,
  Chip,
  GlassPanel,
  MaterialSymbol,
  SectionLabel,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
  EXERCISE_MUSCLE_MAPPINGS,
  buildHighlightData,
  getLatest1RM,
  getSetWeightsForExercise,
  getWorkoutExerciseById,
  getWorkouts,
  seedWorkoutExerciseLibrary,
  type BodyHighlightDatum,
  type SetWeightRow,
  type WorkoutDefinition,
} from '@mylife/workouts';
import { useDatabase } from '../providers/DatabaseProvider';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import { listBlockedUserIds } from '../data/cloud-blocks';
import {
  listExerciseTrainerRail,
  type TrainerRailVideo,
} from '../data/cloud-trainer-videos';
import {
  getFavoriteWorkoutExercises,
  pushWorkoutRecentView,
  toggleFavoriteWorkoutExercise,
} from '../../../lib/workouts/settings';
import {
  formatCategoryLabel,
  formatDifficultyLabel,
  getExerciseAccent,
  getPrimaryEquipmentLabel,
  getSecondaryMuscleLabels,
  withAlpha,
} from '../../../lib/workouts/phase3';
import {
  DifficultyStars,
  ExerciseArtwork,
  StickyActionBar,
  WorkoutRouteHeader,
} from '../phase3-kit';
import { DW_ACCENT } from '../theme/tokens';

type DetailState = {
  error: string | null;
  exercise: ReturnType<typeof getWorkoutExerciseById>;
  history: SetWeightRow[];
  latestOneRM: ReturnType<typeof getLatest1RM>;
  workouts: WorkoutDefinition[];
  favorite: boolean;
};

const FRONT_HIGHLIGHT_SHAPES = [
  { slug: 'chest', type: 'ellipse', cx: 42, cy: 62, rx: 16, ry: 12 },
  { slug: 'deltoids', type: 'ellipse', cx: 20, cy: 56, rx: 10, ry: 8 },
  { slug: 'biceps', type: 'rect', x: 10, y: 72, width: 12, height: 28, rx: 6 },
  { slug: 'abs', type: 'rect', x: 30, y: 78, width: 24, height: 34, rx: 8 },
  { slug: 'obliques', type: 'rect', x: 22, y: 84, width: 40, height: 18, rx: 8 },
  { slug: 'quadriceps', type: 'rect', x: 24, y: 124, width: 14, height: 40, rx: 8 },
  { slug: 'adductors', type: 'rect', x: 38, y: 124, width: 10, height: 40, rx: 6 },
  { slug: 'forearm', type: 'rect', x: 8, y: 102, width: 10, height: 30, rx: 5 },
  { slug: 'neck', type: 'rect', x: 36, y: 34, width: 12, height: 14, rx: 6 },
] as const;

const BACK_HIGHLIGHT_SHAPES = [
  { slug: 'upper-back', type: 'rect', x: 28, y: 56, width: 28, height: 26, rx: 10 },
  { slug: 'lower-back', type: 'rect', x: 32, y: 86, width: 20, height: 24, rx: 8 },
  { slug: 'triceps', type: 'rect', x: 10, y: 72, width: 12, height: 28, rx: 6 },
  { slug: 'gluteal', type: 'rect', x: 28, y: 116, width: 28, height: 22, rx: 10 },
  { slug: 'hamstring', type: 'rect', x: 24, y: 138, width: 14, height: 34, rx: 8 },
  { slug: 'calves', type: 'rect', x: 24, y: 176, width: 12, height: 24, rx: 6 },
  { slug: 'forearm', type: 'rect', x: 8, y: 102, width: 10, height: 30, rx: 5 },
  { slug: 'neck', type: 'rect', x: 36, y: 34, width: 12, height: 14, rx: 6 },
] as const;

function bodyMapLookup(highlights: BodyHighlightDatum[]): Map<string, BodyHighlightDatum> {
  return new Map(highlights.map((item) => [item.slug, item]));
}

function BodyMapPreview({
  highlights,
}: {
  highlights: BodyHighlightDatum[];
}) {
  const lookup = bodyMapLookup(highlights);
  const frontCount = BODY_MAP_MUSCLE_GROUPS.filter((group) => group.side !== 'back').length;
  const backCount = BODY_MAP_MUSCLE_GROUPS.filter((group) => group.side !== 'front').length;

  return (
    <View style={styles.bodyMapRow}>
      <View style={styles.bodyMapColumn}>
        <RNText style={styles.bodyMapLabel}>Front</RNText>
        <Svg width={84} height={212} viewBox="0 0 84 212">
          <Circle cx={42} cy={20} r={14} fill={withAlpha(WK_ACCENT_LIGHT, '12')} />
          <Rect x={30} y={36} width={24} height={84} rx={12} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          <Rect x={20} y={48} width={10} height={70} rx={5} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          <Rect x={54} y={48} width={10} height={70} rx={5} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          <Rect x={30} y={118} width={12} height={86} rx={6} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          <Rect x={42} y={118} width={12} height={86} rx={6} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          {FRONT_HIGHLIGHT_SHAPES.map((shape) => {
            const active = lookup.get(shape.slug);
            const fill = active?.color ?? withAlpha(WK_ACCENT_LIGHT, '08');
            if (shape.type === 'ellipse') {
              return (
                <Ellipse
                  key={shape.slug}
                  cx={shape.cx}
                  cy={shape.cy}
                  rx={shape.rx}
                  ry={shape.ry}
                  fill={fill}
                />
              );
            }

            return (
              <Rect
                key={shape.slug}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx={shape.rx}
                fill={fill}
              />
            );
          })}
        </Svg>
        <RNText style={styles.bodyMapMeta}>{frontCount} highlight zones</RNText>
      </View>

      <View style={styles.bodyMapColumn}>
        <RNText style={styles.bodyMapLabel}>Back</RNText>
        <Svg width={84} height={212} viewBox="0 0 84 212">
          <Circle cx={42} cy={20} r={14} fill={withAlpha(WK_ACCENT_LIGHT, '12')} />
          <Rect x={30} y={36} width={24} height={84} rx={12} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          <Rect x={20} y={48} width={10} height={70} rx={5} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          <Rect x={54} y={48} width={10} height={70} rx={5} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          <Rect x={30} y={118} width={12} height={86} rx={6} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          <Rect x={42} y={118} width={12} height={86} rx={6} fill={withAlpha(WK_ACCENT_LIGHT, '10')} />
          {BACK_HIGHLIGHT_SHAPES.map((shape) => (
            <Rect
              key={shape.slug}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              rx={shape.rx}
              fill={lookup.get(shape.slug)?.color ?? withAlpha(WK_ACCENT_LIGHT, '08')}
            />
          ))}
        </Svg>
        <RNText style={styles.bodyMapMeta}>{backCount} highlight zones</RNText>
      </View>
    </View>
  );
}

function buildHistorySeries(history: SetWeightRow[]) {
  const byDay = new Map<string, { date: string; weight: number }>();
  const ordered = [...history].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const row of ordered) {
    const key = row.createdAt.slice(0, 10);
    const existing = byDay.get(key);
    if (!existing || row.weight > existing.weight) {
      byDay.set(key, { date: key, weight: row.weight });
    }
  }

  return Array.from(byDay.values()).slice(-6);
}

function HistoryChart({
  accent,
  history,
}: {
  accent: string;
  history: SetWeightRow[];
}) {
  const series = buildHistorySeries(history);

  if (series.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <RNText style={styles.emptyChartTitle}>No load history yet</RNText>
        <RNText style={styles.emptyChartBody}>Log a few weighted sets to watch the trend line form.</RNText>
      </View>
    );
  }

  const maxWeight = Math.max(...series.map((item) => item.weight), 1);
  const minWeight = Math.min(...series.map((item) => item.weight), maxWeight);
  const range = Math.max(maxWeight - minWeight, 1);
  const points = series.map((item, index) => {
    const x = 16 + (index * 248) / Math.max(series.length - 1, 1);
    const y = 132 - ((item.weight - minWeight) / range) * 92;
    return { x, y, item };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={156} viewBox="0 0 280 156">
        <Line x1="16" y1="132" x2="264" y2="132" stroke={withAlpha(accent, '22')} strokeWidth={1} />
        <Line x1="16" y1="40" x2="264" y2="40" stroke={withAlpha(accent, '12')} strokeWidth={1} />
        <Path
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <Circle key={point.item.date} cx={point.x} cy={point.y} r={4} fill={accent} />
        ))}
      </Svg>
      <View style={styles.chartLabels}>
        {series.map((item) => (
          <RNText key={item.date} style={styles.chartLabel}>
            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </RNText>
        ))}
      </View>
    </View>
  );
}

function buildInstructionSteps(description: string): string[] {
  return description
    .split('. ')
    .map((item) => item.trim().replace(/\.$/, ''))
    .filter(Boolean);
}

export default function WorkoutExerciseDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { supabase, userId } = useDoWorkCloud();
  const params = useLocalSearchParams<{ id: string }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showWorkoutPicker, setShowWorkoutPicker] = useState(false);
  const [trainerRail, setTrainerRail] = useState<TrainerRailVideo[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  // Cloud trainer demos for this exercise (the real signed-playback path). This
  // replaces the local wk_trainers mirror as the primary trainer surface; the
  // rail below routes into the voice-controlled player.
  useEffect(() => {
    let mounted = true;
    if (!supabase || !params.id) {
      setTrainerRail([]);
      return;
    }
    void (async () => {
      const result = await listExerciseTrainerRail(supabase, params.id);
      if (!mounted || !result.ok) return;
      // Blocked trainers never appear in discovery surfaces; a failed block
      // read fails open to the unfiltered rail.
      let blocked = new Set<string>();
      if (userId) {
        const blocksResult = await listBlockedUserIds(supabase, userId);
        if (blocksResult.ok) blocked = blocksResult.blockedUserIds;
      }
      if (!mounted) return;
      setTrainerRail(
        result.videos.filter(
          (video) => video.trainerUserId === null || !blocked.has(video.trainerUserId),
        ),
      );
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, params.id, userId]);

  const state = useMemo<DetailState>(() => {
    try {
      if (!params.id) {
        return {
          error: 'Exercise not found.',
          exercise: null,
          history: [],
          latestOneRM: null,
          workouts: [],
          favorite: false,
        };
      }

      seedWorkoutExerciseLibrary(db);
      const exercise = getWorkoutExerciseById(db, params.id);
      const favorite = getFavoriteWorkoutExercises(db).includes(params.id);

      const history = params.id ? getSetWeightsForExercise(db, params.id, { limit: 36 }) : [];
      const latestOneRM = params.id ? getLatest1RM(db, params.id) : null;
      const workouts = getWorkouts(db);

      if (exercise) {
        pushWorkoutRecentView(db, {
          id: exercise.id,
          type: 'exercise',
          title: exercise.name,
          subtitle: `${formatCategoryLabel(exercise.category)} • ${formatDifficultyLabel(exercise.difficulty)}`,
          route: `/(root)/exercise/${exercise.id}`,
          category: exercise.category,
        });
      }

      return {
        error: null,
        exercise,
        history,
        latestOneRM,
        workouts,
        favorite,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unable to load exercise detail.',
        exercise: null,
        history: [],
        latestOneRM: null,
        workouts: [],
        favorite: false,
      };
    }
  }, [db, params.id, refreshKey]);

  const exercise = state.exercise;
  const accent = exercise ? getExerciseAccent(exercise) : WK_ACCENT;
  const mapping = useMemo(() => {
    if (!exercise) return null;
    const name = exercise.name.toLowerCase();
    return EXERCISE_MUSCLE_MAPPINGS.find((item) => {
      const candidate = item.exerciseName.toLowerCase();
      return name.includes(candidate) || candidate.includes(name);
    }) ?? null;
  }, [exercise]);
  const primaryMuscles = mapping?.primary ?? (exercise ? exercise.muscleGroups.slice(0, 1) : []);
  const secondaryMuscles = mapping?.secondary ?? (exercise ? exercise.muscleGroups.slice(1) : []);
  const highlights = buildHighlightData(
    Array.from(new Set([...primaryMuscles, ...secondaryMuscles])),
    accent,
  );
  const instructionSteps = buildInstructionSteps(exercise?.description ?? '');

  const toggleFavorite = useCallback(() => {
    if (!exercise) return;
    toggleFavoriteWorkoutExercise(db, exercise.id);
    setRefreshKey((value) => value + 1);
  }, [db, exercise]);

  const handleShare = useCallback(async () => {
    if (!exercise) return;
    const deepLink = `dowork://exercise/${exercise.id}`;
    await Clipboard.setStringAsync(deepLink);
    Alert.alert('Link copied', `${exercise.name} is ready to share.`);
  }, [exercise]);

  if (!exercise || state.error) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Exercise" overline="Detail" onBack={() => router.back()} />
        <View style={styles.body}>
          <GlassPanel style={styles.errorCard}>
            <RNText style={styles.errorTitle}>Exercise detail unavailable</RNText>
            <RNText style={styles.errorBody}>{state.error ?? 'This exercise could not be found.'}</RNText>
          </GlassPanel>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <WorkoutRouteHeader
          title={exercise.name}
          overline="Exercise"
          onBack={() => router.back()}
          right={(
            <View style={styles.headerActions}>
              <Pressable onPress={toggleFavorite} style={styles.headerIcon}>
                <MaterialSymbol
                  name={state.favorite ? 'favorite_filled' : 'favorite'}
                  size={18}
                  color={state.favorite ? WK_ACCENT_LIGHT : 'rgba(228, 225, 233, 0.72)'}
                />
              </Pressable>
              <Pressable onPress={() => void handleShare()} style={styles.headerIcon}>
                <MaterialSymbol name="share" size={18} color="rgba(228, 225, 233, 0.72)" />
              </Pressable>
            </View>
          )}
        />

        <View style={styles.body}>
          <View style={styles.heroWrap}>
            <ExerciseArtwork
              title={exercise.name}
              accent={accent}
              uri={trainerRail[0]?.thumbnailUrl ?? exercise.thumbnailUrl}
              height={260}
            />
            <View style={styles.heroOverlay}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>
                {formatCategoryLabel(exercise.category)} • Compound
              </SectionLabel>
              <RNText style={styles.heroTitle}>{exercise.name}</RNText>
            </View>
          </View>

          <GlassPanel style={styles.statsPanel}>
            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <SectionLabel accent={WK_ACCENT_LIGHT}>Difficulty</SectionLabel>
                <DifficultyStars difficulty={exercise.difficulty} tint={accent} />
              </View>
              <View style={styles.statBlock}>
                <SectionLabel accent={WK_ACCENT_LIGHT}>Primary</SectionLabel>
                <Chip label={primaryMuscles[0] ? BODY_MAP_MUSCLE_GROUPS.find((item) => item.id === primaryMuscles[0])?.label ?? primaryMuscles[0] : 'Full Body'} selected />
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <SectionLabel accent={WK_ACCENT_LIGHT}>Equipment</SectionLabel>
                <RNText style={styles.statValue}>{getPrimaryEquipmentLabel(exercise)}</RNText>
              </View>
              <View style={styles.statBlock}>
                <SectionLabel accent={WK_ACCENT_LIGHT}>Best 1RM</SectionLabel>
                <RNText style={styles.statValue}>
                  {state.latestOneRM ? `${Math.round(state.latestOneRM.estimated1rm)} ${state.latestOneRM.unit}` : 'No data'}
                </RNText>
              </View>
            </View>
          </GlassPanel>

          {trainerRail.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <SectionLabel accent={WK_ACCENT_LIGHT}>Trainer Demos</SectionLabel>
                <RNText style={styles.sectionMeta}>{trainerRail.length} from coaches</RNText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoRail}>
                {trainerRail.map((video) => (
                  <GlassPanel
                    key={video.id}
                    padding={0}
                    onPress={() => router.push(`/(root)/player?videoId=${video.id}` as never)}
                    style={styles.videoCard}
                  >
                    <ExerciseArtwork
                      title={video.title ?? 'Trainer demo'}
                      accent={accent}
                      uri={video.thumbnailUrl}
                      height={118}
                    />
                    <View style={styles.videoCopy}>
                      <RNText style={styles.videoTitle} numberOfLines={1}>
                        {video.title ?? 'Trainer demo'}
                      </RNText>
                      {video.trainerHandle ? (
                        <Pressable
                          onPress={() => router.push(`/(root)/trainer/${video.trainerHandle}` as never)}
                          accessibilityRole="link"
                          accessibilityLabel={`View ${video.trainerName ?? 'trainer'}`}
                        >
                          <RNText style={styles.trainerLink}>{video.trainerName ?? 'View trainer'}</RNText>
                        </Pressable>
                      ) : (
                        <RNText style={styles.videoBody}>{video.trainerName ?? 'Trainer demo'}</RNText>
                      )}
                    </View>
                  </GlassPanel>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <GlassPanel style={styles.section}>
            <SectionLabel accent={WK_ACCENT_LIGHT}>Execution Guide</SectionLabel>
            <View style={styles.instructions}>
              {instructionSteps.map((step, index) => (
                <View key={`${exercise.id}-step-${index}`} style={styles.instructionRow}>
                  <View style={styles.instructionBadge}>
                    <RNText style={styles.instructionBadgeText}>{index + 1}</RNText>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <RNText style={styles.instructionTitle}>Step {index + 1}</RNText>
                    <RNText style={styles.instructionBody}>{step}.</RNText>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.tipCard}>
              <MaterialSymbol name="bolt" size={16} color={WK_ACCENT_LIGHT} />
              <RNText style={styles.tipCopy}>
                Tip: keep your brace before the first rep and control the lowering phase.
              </RNText>
            </View>
          </GlassPanel>

          <GlassPanel style={styles.section}>
            <View style={styles.sectionHeader}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>Muscle Map</SectionLabel>
              <RNText style={styles.sectionMeta}>
                {primaryMuscles.length + secondaryMuscles.length} tracked zones
              </RNText>
            </View>
            <BodyMapPreview highlights={highlights} />
            <View style={styles.chipWrap}>
              {primaryMuscles.map((muscle) => (
                <Chip
                  key={`primary-${muscle}`}
                  label={BODY_MAP_MUSCLE_GROUPS.find((item) => item.id === muscle)?.label ?? muscle}
                  selected
                  accent={accent}
                />
              ))}
              {secondaryMuscles.map((muscle) => (
                <Chip
                  key={`secondary-${muscle}`}
                  label={BODY_MAP_MUSCLE_GROUPS.find((item) => item.id === muscle)?.label ?? muscle}
                />
              ))}
            </View>
            {getSecondaryMuscleLabels(exercise).length > 0 ? (
              <RNText style={styles.bodyMapFootnote}>
                Secondary emphasis: {getSecondaryMuscleLabels(exercise).join(', ')}
              </RNText>
            ) : null}
          </GlassPanel>

          <GlassPanel style={styles.section}>
            <View style={styles.sectionHeader}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>History Chart</SectionLabel>
              <RNText style={styles.sectionMeta}>{state.history.length} weighted sets</RNText>
            </View>
            <HistoryChart accent={accent} history={state.history} />
          </GlassPanel>
        </View>
      </ScrollView>

      <StickyActionBar
        primaryLabel="Add To Workout"
        primaryIcon="add_circle"
        onPrimary={() => setShowWorkoutPicker(true)}
      />

      <Modal
        visible={showWorkoutPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWorkoutPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowWorkoutPicker(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <SectionLabel accent={WK_ACCENT_LIGHT}>Workout Picker</SectionLabel>
            <RNText style={styles.sheetTitle}>Where should this land?</RNText>

            <Pressable
              onPress={() => {
                setShowWorkoutPicker(false);
                router.push(`/(root)/builder?exerciseId=${exercise.id}` as never);
              }}
              style={styles.sheetRow}
            >
              <View>
                <RNText style={styles.sheetRowTitle}>Create new workout</RNText>
                <RNText style={styles.sheetRowBody}>Start a fresh builder draft with this exercise preloaded.</RNText>
              </View>
              <MaterialSymbol name="chevron_right" size={18} color="rgba(228, 225, 233, 0.42)" />
            </Pressable>

            {state.workouts.slice(0, 3).map((workout) => (
              <Pressable
                key={workout.id}
                onPress={() => {
                  setShowWorkoutPicker(false);
                  router.push(`/(root)/builder?edit=${workout.id}&exerciseId=${exercise.id}` as never);
                }}
                style={styles.sheetRow}
              >
                <View style={{ flex: 1 }}>
                  <RNText style={styles.sheetRowTitle}>{workout.title}</RNText>
                  <RNText style={styles.sheetRowBody}>{workout.exercises.length} exercises ready to edit</RNText>
                </View>
                <MaterialSymbol name="chevron_right" size={18} color="rgba(228, 225, 233, 0.42)" />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.base,
  },
  content: {
    paddingBottom: 108,
  },
  body: {
    paddingHorizontal: 24,
    gap: 22,
  },
  errorCard: {
    padding: 20,
  },
  errorTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#E4E1E9',
  },
  errorBody: {
    marginTop: 8,
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  heroWrap: {
    position: 'relative',
  },
  heroOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    gap: 6,
  },
  heroTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1,
    color: '#E4E1E9',
  },
  statsPanel: {
    gap: 14,
    padding: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBlock: {
    flex: 1,
    gap: 8,
  },
  statValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: '#E4E1E9',
  },
  section: {
    gap: 12,
    padding: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(214, 195, 181, 0.46)',
  },
  videoRail: {
    gap: 12,
    paddingRight: 24,
  },
  videoCard: {
    width: 190,
    overflow: 'hidden',
  },
  videoCopy: {
    padding: 14,
    gap: 4,
  },
  videoTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    textTransform: 'capitalize',
    color: '#E4E1E9',
  },
  videoBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  trainerLink: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 18,
    color: DW_ACCENT,
  },
  instructions: {
    gap: 14,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  instructionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(WK_ACCENT_LIGHT, '1F'),
  },
  instructionBadgeText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    lineHeight: 12,
    color: WK_ACCENT_LIGHT,
  },
  instructionTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  instructionBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  tipCard: {
    marginTop: 4,
    padding: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: withAlpha(WK_ACCENT_LIGHT, '14'),
  },
  tipCopy: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(228, 225, 233, 0.88)',
  },
  bodyMapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  bodyMapColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: WK_SURFACES.low,
  },
  bodyMapLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: '#E4E1E9',
  },
  bodyMapMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    color: 'rgba(214, 195, 181, 0.52)',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bodyMapFootnote: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  chartWrap: {
    gap: 6,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: WK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    color: 'rgba(214, 195, 181, 0.52)',
  },
  emptyChart: {
    minHeight: 112,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 6,
    backgroundColor: WK_SURFACES.low,
  },
  emptyChartTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  emptyChartBody: {
    textAlign: 'center',
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 16,
    backgroundColor: WK_SURFACES.low,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(214, 195, 181, 0.22)',
  },
  sheetTitle: {
    marginTop: -4,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: '#E4E1E9',
  },
  sheetRow: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: WK_SURFACES.high,
  },
  sheetRowTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  sheetRowBody: {
    marginTop: 4,
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
});
