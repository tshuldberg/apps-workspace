import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, Heart, Sparkles, Zap } from 'lucide-react-native';
import {
  GlassCard,
  LogTodayFAB,
  PhaseLegend,
  PhaseRing,
  calculateAverageCycleLength,
  getCurrentPhase,
  getCycleStats,
  getCycles,
  predictNextPeriod,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type Cycle,
  type CyclePhase,
  type CyclePrediction,
  type CycleStats,
} from '@mylife/cycle';
import { useDatabase } from '../../../components/DatabaseProvider';

const DEFAULT_CYCLE_LENGTH = 28;

interface HomeData {
  stats: CycleStats;
  currentCycle: Cycle | null;
  prediction: CyclePrediction | null;
  cycleLength: number;
  dayOfCycle: number;
  phase: CyclePhase;
}

function loadHomeData(db: ReturnType<typeof useDatabase>, today: string): HomeData {
  const stats = getCycleStats(db);
  const cycles = getCycles(db, 12);

  const current = cycles[0] ?? null;
  const completed = cycles.slice(1);

  const cycleLengths = completed
    .map((c) => c.lengthDays)
    .filter((l): l is number => l !== null);
  const periodLengths = completed
    .map((c) => c.periodLength)
    .filter((l): l is number => l !== null);

  const avgCycleLength =
    calculateAverageCycleLength(cycleLengths) ??
    stats.averageCycleLength ??
    DEFAULT_CYCLE_LENGTH;

  const prediction = current
    ? predictNextPeriod(current.startDate, cycleLengths, periodLengths, today)
    : null;

  const dayOfCycle = current
    ? Math.max(
        1,
        Math.round(
          (new Date(today + 'T00:00:00Z').getTime() -
            new Date(current.startDate + 'T00:00:00Z').getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1,
      )
    : 1;

  const phase: CyclePhase = current
    ? getCurrentPhase(current.startDate, today, avgCycleLength)
    : 'menstrual';

  return {
    stats,
    currentCycle: current,
    prediction,
    cycleLength: Math.round(avgCycleLength),
    dayOfCycle,
    phase,
  };
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso + 'T00:00:00Z');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

interface PhaseTip {
  icon: 'bolt' | 'heart' | 'sparkles';
  title: string;
  body: string;
  accent: string;
}

const PHASE_TIPS: Record<CyclePhase, PhaseTip[]> = {
  menstrual: [
    {
      icon: 'sparkles',
      title: 'Rest & Restore',
      body: 'Lower impact movement and extra hydration support your body now.',
      accent: CYCLE_PHASE_COLORS.menstrual,
    },
    {
      icon: 'heart',
      title: 'Be Gentle',
      body: 'Introspective energy. Journaling and warm meals land well.',
      accent: CYCLE_PHASE_COLORS.follicular,
    },
  ],
  follicular: [
    {
      icon: 'bolt',
      title: 'Rising Energy',
      body: 'Great window for strength training and new creative work.',
      accent: '#FFB877',
    },
    {
      icon: 'heart',
      title: 'Open & Curious',
      body: 'Social plans and learning sessions feel fresh and engaging.',
      accent: CYCLE_PHASE_COLORS.follicular,
    },
  ],
  ovulation: [
    {
      icon: 'bolt',
      title: 'High Energy',
      body: 'Peak time for intense workouts or important launches.',
      accent: '#FFB877',
    },
    {
      icon: 'heart',
      title: 'Social Peak',
      body: 'You may feel more communicative, expressive, and magnetic.',
      accent: CYCLE_PHASE_COLORS.ovulation,
    },
  ],
  luteal: [
    {
      icon: 'sparkles',
      title: 'Focus & Finish',
      body: 'Great window for detail work, planning, and closing loops.',
      accent: CYCLE_PHASE_COLORS.luteal,
    },
    {
      icon: 'heart',
      title: 'Grounded',
      body: 'Steady meals, earlier sleep, and gentler cardio feel best.',
      accent: CYCLE_PHASE_COLORS.follicular,
    },
  ],
};

function FertilityDots({ confidence }: { confidence: number }) {
  const fill = Math.max(0, Math.min(3, Math.round(confidence * 3)));
  return (
    <View style={styles.dotRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.fertilityDot,
            {
              backgroundColor:
                i < fill ? '#34D399' : 'rgba(52, 211, 153, 0.25)',
            },
          ]}
        />
      ))}
    </View>
  );
}

function TipIcon({ icon, color }: { icon: PhaseTip['icon']; color: string }) {
  const size = 22;
  const stroke = 2.2;
  if (icon === 'bolt') return <Zap size={size} color={color} strokeWidth={stroke} />;
  if (icon === 'heart') return <Heart size={size} color={color} strokeWidth={stroke} />;
  return <Sparkles size={size} color={color} strokeWidth={stroke} />;
}

export default function CycleHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const result = useMemo(() => {
    try {
      return { ok: true as const, data: loadHomeData(db, today) };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : 'Failed to load cycle data.',
      };
    }
  }, [db, today, refreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const handleLog = useCallback(() => {
    router.push('/(cycle)/log-day');
  }, [router]);

  if (!result.ok) {
    return (
      <View style={styles.errorWrap}>
        <RNText style={styles.errorTitle}>Something went wrong</RNText>
        <RNText style={styles.errorBody}>{result.message}</RNText>
      </View>
    );
  }

  const { currentCycle, prediction, cycleLength, dayOfCycle, phase, stats } =
    result.data;

  const menstrualLength = Math.max(
    1,
    Math.round(stats.averagePeriodLength ?? 5),
  );
  const follicularLength = Math.max(
    1,
    Math.round(cycleLength * 0.28),
  );
  const ovulationLength = Math.max(
    1,
    Math.round(cycleLength * 0.11),
  );

  const daysUntilPeriod = prediction?.daysUntilNextPeriod ?? null;
  const daysUntilLabel =
    daysUntilPeriod == null
      ? 'Next period pending'
      : daysUntilPeriod <= 0
        ? 'Your period is expected'
        : `Next period in ${daysUntilPeriod} day${daysUntilPeriod === 1 ? '' : 's'}`;
  const estimatedLabel = prediction
    ? `Estimated: ${formatShortDate(prediction.predictedStartDate)}`
    : 'Log at least two cycles to forecast';

  const fertileLabel = prediction
    ? `Fertile window: ${formatShortDate(prediction.fertileWindowStart)} – ${formatShortDate(prediction.fertileWindowEnd)}`
    : 'Fertility window pending';
  const fertileSub =
    phase === 'ovulation'
      ? 'You are in your peak fertile window.'
      : phase === 'follicular'
        ? 'Fertility rising toward ovulation.'
        : phase === 'menstrual'
          ? 'Fertility low. Rest and restore.'
          : 'Luteal phase. Fertility winding down.';

  const tips = PHASE_TIPS[phase];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E4E1E9"
          />
        }
      >
        {currentCycle ? (
          <>
            <View style={styles.ringWrap}>
              <PhaseRing
                currentDay={dayOfCycle}
                totalDays={cycleLength}
                phase={phase}
                menstrualLength={menstrualLength}
                follicularLength={follicularLength}
                ovulationLength={ovulationLength}
              />
              <View style={styles.legendWrap}>
                <PhaseLegend />
              </View>
            </View>

            <GlassCard>
              <View style={styles.cardRow}>
                <View style={styles.cardBody}>
                  <RNText style={styles.cardLabel}>FORECAST</RNText>
                  <RNText style={styles.cardTitle}>{daysUntilLabel}</RNText>
                  <RNText style={styles.cardSub}>{estimatedLabel}</RNText>
                </View>
                <View
                  style={[
                    styles.cardIconCircle,
                    { backgroundColor: `${CYCLE_PHASE_COLORS.menstrual}1A` },
                  ]}
                >
                  <CalendarDays
                    size={22}
                    color={CYCLE_PHASE_COLORS.menstrual}
                    strokeWidth={2.2}
                  />
                </View>
              </View>
            </GlassCard>

            <GlassCard>
              <View style={styles.fertilityHeader}>
                <RNText style={styles.cardLabel}>FERTILITY</RNText>
                <FertilityDots confidence={prediction?.confidence ?? 0} />
              </View>
              <RNText style={styles.cardTitle}>{fertileLabel}</RNText>
              <RNText style={styles.cardSub}>{fertileSub}</RNText>
            </GlassCard>

            <View style={styles.tipGrid}>
              {tips.map((tip) => (
                <GlassCard key={tip.title} style={styles.tipCard}>
                  <TipIcon icon={tip.icon} color={tip.accent} />
                  <View style={styles.tipTextWrap}>
                    <RNText style={styles.tipTitle}>{tip.title}</RNText>
                    <RNText style={styles.tipBody}>{tip.body}</RNText>
                  </View>
                </GlassCard>
              ))}
            </View>
          </>
        ) : (
          <GlassCard style={styles.emptyCard}>
            <RNText style={styles.emptyEmoji}>🌙</RNText>
            <RNText style={styles.emptyTitle}>
              Your cycle journey starts here
            </RNText>
            <RNText style={styles.emptyBody}>
              Log your first period to unlock predictions, fertile windows, and
              phase-aware insights.
            </RNText>
          </GlassCard>
        )}
      </ScrollView>

      <LogTodayFAB onPress={handleLog} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 160,
    gap: 20,
  },
  ringWrap: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  legendWrap: {
    marginTop: 24,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.7)',
  },
  cardTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  cardSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.85)',
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fertilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  fertilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tipGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  tipCard: {
    flex: 1,
    gap: 12,
    padding: 20,
  },
  tipTextWrap: {
    gap: 6,
  },
  tipTitle: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  tipBody: {
    fontFamily: CYCLE_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.75)',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    textAlign: 'center',
  },
  emptyBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.85)',
    textAlign: 'center',
  },
  errorWrap: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  errorBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(255, 180, 171, 0.9)',
    textAlign: 'center',
  },
});
