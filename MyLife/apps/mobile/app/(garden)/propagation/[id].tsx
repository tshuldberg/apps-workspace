import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import {
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  advancePropagationStage,
  getNextStages,
  getPlants,
  getPropagationStats,
  type Plant,
  type Propagation,
  type PropagationStage,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  daysSince,
  getAllPropagations,
  propagationStageProgress,
} from '../phase3-utils';

function methodLabel(value: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ');
}

export default function PropagationDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);

  const propagation: Propagation | null = useMemo(() => {
    if (!id) return null;
    return getAllPropagations(db).find((entry) => entry.id === id) ?? null;
  }, [db, id, tick]);

  const plants: Plant[] = useMemo(() => getPlants(db), [db]);
  const plantById = useMemo(() => new Map(plants.map((plant) => [plant.id, plant])), [plants]);
  const stats = useMemo(() => getPropagationStats(db), [db, tick]);

  if (!propagation) {
    return (
      <View style={styles.emptyState}>
        <RNText style={styles.emptyTitle}>Propagation not found</RNText>
      </View>
    );
  }

  const parent = propagation.parentPlantId
    ? plantById.get(propagation.parentPlantId) ?? null
    : null;
  const nextStages = getNextStages(propagation.currentStage);
  const progress = propagationStageProgress(propagation.currentStage);
  const stageTone =
    propagation.currentStage === 'failed'
      ? GARDEN_DANGER
      : propagation.currentStage === 'ready' || propagation.currentStage === 'potted'
        ? GARDEN_GOLD
        : GARDEN_ACCENT;

  const handleAdvance = (stage: PropagationStage) => {
    advancePropagationStage(db, propagation.id, stage);
    setTick((value) => value + 1);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <GlassCard level={2} style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <RNText style={styles.heroLabel}>PROPAGATION DETAIL</RNText>
            <RNText style={styles.heroTitle}>
              {parent?.name ?? propagation.notes ?? 'Propagation'}
            </RNText>
            <RNText style={styles.heroSubtitle}>
              {methodLabel(propagation.method)} · {methodLabel(propagation.medium)}
            </RNText>
          </View>
          <ProgressRing progress={progress} color={stageTone} label={propagation.currentStage} />
        </View>

        <View style={styles.heroStats}>
          <MiniStat label="Current stage" value={methodLabel(propagation.currentStage)} />
          <MiniStat label="Days active" value={`${daysSince(propagation.startDate)}`} />
          <MiniStat label="Last update" value={`${daysSince(propagation.stageUpdatedAt)}d`} />
        </View>
      </GlassCard>

      {parent != null && (
        <GlassCard level={1} style={styles.parentCard}>
          <RNText style={styles.sectionTitle}>Parent plant</RNText>
          <RNText style={styles.bodyText}>
            {parent.name} · {parent.species ?? 'Garden specimen'}
          </RNText>
          <Pressable onPress={() => router.push(`/(garden)/plant/${parent.id}`)}>
            <RNText style={styles.inlineLink}>View full profile</RNText>
          </Pressable>
        </GlassCard>
      )}

      <GlassCard level={1} style={styles.stagesCard}>
        <RNText style={styles.sectionTitle}>Advance stage</RNText>
        <View style={styles.stageButtonWrap}>
          {nextStages.length === 0 ? (
            <RNText style={styles.bodyText}>
              This propagation is already in a terminal stage.
            </RNText>
          ) : (
            nextStages.map((stage) => (
              <Pressable
                key={stage}
                onPress={() => handleAdvance(stage)}
                style={styles.stageButton}
              >
                <RNText style={styles.stageButtonText}>
                  {methodLabel(stage)}
                </RNText>
              </Pressable>
            ))
          )}
          {propagation.currentStage !== 'failed' && propagation.currentStage !== 'potted' && (
            <GradientButton
              title="Mark Failed"
              onPress={() => handleAdvance('failed')}
              variant="danger"
            />
          )}
        </View>
      </GlassCard>

      <GlassCard level={1} style={styles.careCard}>
        <RNText style={styles.sectionTitle}>Care notes</RNText>
        <RNText style={styles.bodyText}>
          {propagation.notes || 'No notes logged yet for this propagation.'}
        </RNText>
        <RNText style={styles.tipLabel}>Recommended care</RNText>
        <RNText style={styles.tipText}>
          {propagation.currentStage === 'started' &&
            'Keep the cutting warm and humid, with bright indirect light.'}
          {propagation.currentStage === 'callusing' &&
            'Let the cut surface dry before adding excess moisture.'}
          {propagation.currentStage === 'rooting' &&
            'Maintain consistent moisture and check for white root growth.'}
          {propagation.currentStage === 'growing' &&
            'Increase airflow and begin a light feeding schedule.'}
          {propagation.currentStage === 'ready' &&
            'Harden off and prepare a small nursery pot for transplanting.'}
          {propagation.currentStage === 'potted' &&
            'Watch for transplant stress and taper watering slowly.'}
          {propagation.currentStage === 'failed' &&
            'Log what changed so the next propagation run can improve.'}
        </RNText>
      </GlassCard>

      <View style={styles.summaryRow}>
        <MiniStat label="Total trials" value={`${stats.total}`} />
        <MiniStat label="Active" value={`${stats.activeCount}`} />
        <MiniStat label="Success" value={`${stats.successCount}`} />
        <MiniStat label="Failed" value={`${stats.failedCount}`} />
      </View>
    </ScrollView>
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
  const size = 96;
  const strokeWidth = 8;
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
      <View style={styles.ringCenter}>
        <RNText style={[styles.ringValue, { color }]}>{Math.round(progress * 100)}%</RNText>
        <RNText style={styles.ringLabel}>{label.slice(0, 6)}</RNText>
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard level={1} style={styles.miniStat}>
      <RNText style={styles.miniStatLabel}>{label}</RNText>
      <RNText style={styles.miniStatValue}>{value}</RNText>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  emptyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  heroCard: {
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: GARDEN_ACCENT,
  },
  heroTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 28,
    color: colors.text,
  },
  heroSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ringWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
  },
  ringLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.textTertiary,
  },
  parentCard: {
    gap: 8,
  },
  sectionTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  bodyText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  inlineLink: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  stagesCard: {
    gap: spacing.md,
  },
  stageButtonWrap: {
    gap: spacing.sm,
  },
  stageButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  stageButtonText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  careCard: {
    gap: spacing.sm,
  },
  tipLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: GARDEN_GOLD,
  },
  tipText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  miniStat: {
    minWidth: '22%',
    gap: 4,
  },
  miniStatLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  miniStatValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
});
