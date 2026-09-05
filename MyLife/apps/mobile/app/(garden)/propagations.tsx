import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import {
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GardenTimelineEntry,
  GlassCard,
  GradientButton,
  advancePropagationStage,
  createPropagation,
  getNextStages,
  getPlants,
  getPropagationStats,
  type Plant,
  type Propagation,
  type PropagationMethod,
  type PropagationMedium,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  createLocalId,
  daysSince,
  formatRelativeDate,
  getAllPropagations,
  propagationStageProgress,
} from './phase3-utils';

const METHODS: PropagationMethod[] = [
  'stem_cutting',
  'division',
  'seed',
  'air_layering',
  'water_propagation',
];
const MEDIA: PropagationMedium[] = ['water', 'soil', 'perlite', 'sphagnum_moss', 'leca'];

function humanize(value: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ');
}

export default function PropagationsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [parentPlantId, setParentPlantId] = useState<string | null>(null);
  const [method, setMethod] = useState<PropagationMethod>('stem_cutting');
  const [medium, setMedium] = useState<PropagationMedium>('water');
  const [notes, setNotes] = useState('');

  const propagations: Propagation[] = useMemo(() => getAllPropagations(db), [db, tick]);
  const plants: Plant[] = useMemo(() => getPlants(db), [db]);
  const plantById = useMemo(() => new Map(plants.map((plant) => [plant.id, plant])), [plants]);
  const stats = useMemo(() => getPropagationStats(db), [db, tick]);

  const activePropagations = propagations.filter(
    (entry) => !['potted', 'failed'].includes(entry.currentStage),
  );
  const historicalPropagations = propagations.filter((entry) =>
    ['potted', 'failed'].includes(entry.currentStage),
  );
  const rootedCount = propagations.filter((entry) =>
    ['rooting', 'growing', 'ready', 'potted'].includes(entry.currentStage),
  ).length;

  const handleCreate = () => {
    createPropagation(db, createLocalId(), {
      parentPlantId,
      method,
      medium,
      notes: notes.trim() || null,
    });
    setTick((value) => value + 1);
    setShowComposer(false);
    setParentPlantId(null);
    setMethod('stem_cutting');
    setMedium('water');
    setNotes('');
  };

  const advanceStage = (entry: Propagation) => {
    const next = getNextStages(entry.currentStage)[0];
    if (!next) return;
    advancePropagationStage(db, entry.id, next);
    setTick((value) => value + 1);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <RNText style={styles.headerLabel}>GROWTH LAB</RNText>
            <RNText style={styles.headerTitle}>Propagation Tracker</RNText>
            <RNText style={styles.headerSubtitle}>
              {activePropagations.length} active · {rootedCount} rooted
            </RNText>
          </View>
          <Pressable onPress={() => setShowComposer((value) => !value)}>
            <RNText style={styles.headerAction}>{showComposer ? 'Close' : '+ Add'}</RNText>
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <GlassCard level={1} style={styles.inlineStat}>
            <RNText style={styles.statLabel}>Success Rate</RNText>
            <RNText style={styles.statValue}>{stats.successRate}%</RNText>
          </GlassCard>
          <GlassCard level={1} style={styles.inlineStat}>
            <RNText style={styles.statLabel}>Total Trials</RNText>
            <RNText style={styles.statValue}>{stats.total}</RNText>
          </GlassCard>
        </View>

        {showComposer && (
          <GlassCard level={2} style={styles.composerCard}>
            <RNText style={styles.composerTitle}>Start propagation</RNText>

            <View style={styles.selectorWrap}>
              {plants.map((plant) => (
                <Pressable
                  key={plant.id}
                  onPress={() => setParentPlantId(plant.id)}
                  style={[
                    styles.selectorChip,
                    parentPlantId === plant.id && styles.selectorChipActive,
                  ]}
                >
                  <RNText
                    style={[
                      styles.selectorChipText,
                      parentPlantId === plant.id && styles.selectorChipTextActive,
                    ]}
                  >
                    {plant.name}
                  </RNText>
                </Pressable>
              ))}
            </View>

            <View style={styles.selectorWrap}>
              {METHODS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setMethod(option)}
                  style={[
                    styles.selectorChip,
                    method === option && styles.selectorChipActive,
                  ]}
                >
                  <RNText
                    style={[
                      styles.selectorChipText,
                      method === option && styles.selectorChipTextActive,
                    ]}
                  >
                    {humanize(option)}
                  </RNText>
                </Pressable>
              ))}
            </View>

            <View style={styles.selectorWrap}>
              {MEDIA.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setMedium(option)}
                  style={[
                    styles.selectorChip,
                    medium === option && styles.selectorChipActive,
                  ]}
                >
                  <RNText
                    style={[
                      styles.selectorChipText,
                      medium === option && styles.selectorChipTextActive,
                    ]}
                  >
                    {humanize(option)}
                  </RNText>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Warm shelf near bright east-facing window"
              placeholderTextColor="rgba(214, 195, 181, 0.45)"
              style={[styles.input, styles.notesInput]}
              multiline
            />
            <GradientButton title="Save propagation" onPress={handleCreate} />
          </GlassCard>
        )}

        <View style={styles.cardGrid}>
          {activePropagations.map((entry) => {
            const parent = entry.parentPlantId ? plantById.get(entry.parentPlantId) : null;
            const nextStages = getNextStages(entry.currentStage);
            const tone =
              entry.currentStage === 'ready'
                ? GARDEN_GOLD
                : entry.currentStage === 'rooting'
                  ? GARDEN_ACCENT_LIGHT
                  : GARDEN_ACCENT;
            return (
              <Pressable
                key={entry.id}
                onPress={() => router.push(`/(garden)/propagation/${entry.id}`)}
                style={styles.cardGridItem}
              >
                <GlassCard level={1} style={styles.propagationCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardCopy}>
                      <RNText style={styles.cardTitle}>
                        {parent?.name ?? 'Unnamed cutting'}
                      </RNText>
                      <RNText style={styles.cardSubtitle}>
                        {humanize(entry.method)}
                      </RNText>
                    </View>
                    <ProgressRing
                      progress={propagationStageProgress(entry.currentStage)}
                      color={tone}
                      label={entry.currentStage}
                    />
                  </View>

                  <RNText style={styles.cardBody}>
                    {daysSince(entry.stageUpdatedAt)} days in stage · {humanize(entry.medium ?? 'water')}
                  </RNText>

                  <Pressable
                    onPress={() => advanceStage(entry)}
                    disabled={nextStages.length === 0}
                    style={[
                      styles.nextStageButton,
                      nextStages.length === 0 && styles.nextStageButtonDisabled,
                    ]}
                  >
                    <RNText style={styles.nextStageText}>
                      {nextStages.length > 0 ? `Next: ${humanize(nextStages[0])}` : 'Stage complete'}
                    </RNText>
                  </Pressable>
                </GlassCard>
              </Pressable>
            );
          })}
        </View>

        <GlassCard level={1} style={styles.historyCard}>
          <RNText style={styles.historyTitle}>Timeline / History</RNText>
          {historicalPropagations.length === 0 ? (
            <RNText style={styles.historyBody}>
              Completed and failed propagations will collect here with timing and
              notes.
            </RNText>
          ) : (
            historicalPropagations.slice(0, 8).map((entry, index) => {
              const parent = entry.parentPlantId ? plantById.get(entry.parentPlantId) : null;
              return (
                <GardenTimelineEntry
                  key={entry.id}
                  icon={entry.currentStage === 'potted' ? '✓' : '!'}
                  iconColor={entry.currentStage === 'potted' ? GARDEN_ACCENT : GARDEN_DANGER}
                  title={`${parent?.name ?? 'Propagation'} ${entry.currentStage === 'potted' ? 'rooted successfully' : 'did not make it'}`}
                  subtitle={entry.notes ?? humanize(entry.method)}
                  time={formatRelativeDate(entry.updatedAt)}
                  isLast={index === historicalPropagations.slice(0, 8).length - 1}
                />
              );
            })
          )}
        </GlassCard>
      </ScrollView>

      <Pressable onPress={() => setShowComposer((value) => !value)} style={styles.fab}>
        <View style={styles.fabInner}>
          <RNText style={styles.fabText}>{showComposer ? '×' : '+'}</RNText>
        </View>
      </Pressable>
    </View>
  );
}

function ProgressRing({
  progress,
  color,
  label,
}: {
  progress: number;
  color: string;
  label: string;
}) {
  const size = 76;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const amount = Math.max(0, Math.min(1, progress)) * circumference;

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${amount} ${circumference}`}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringLabelWrap}>
        <RNText style={[styles.ringValue, { color }]}>{Math.round(progress * 100)}%</RNText>
        <RNText style={styles.ringLabel}>{label.slice(0, 6)}</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 1.1,
    color: GARDEN_ACCENT,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  headerAction: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineStat: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  statValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  composerCard: {
    gap: spacing.md,
  },
  composerTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  selectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  selectorChipActive: {
    backgroundColor: `${GARDEN_ACCENT}24`,
  },
  selectorChipText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  selectorChipTextActive: {
    color: GARDEN_ACCENT_LIGHT,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: GARDEN_SURFACES.lift,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardGridItem: {
    width: '47%',
  },
  propagationCard: {
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  cardSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  nextStageButton: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  nextStageButtonDisabled: {
    backgroundColor: GARDEN_SURFACES.lift,
  },
  nextStageText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: GARDEN_ACCENT_LIGHT,
  },
  ringWrap: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
  },
  ringLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.textTertiary,
  },
  historyCard: {
    gap: spacing.md,
  },
  historyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  historyBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xl,
  },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_ACCENT,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.background,
  },
});
