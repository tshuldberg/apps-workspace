import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Sparkles,
} from 'lucide-react-native';
import {
  GlassCard,
  PhaseBadge,
  analyzeSymptomsByPhase,
  calculateAverageCycleLength,
  getCurrentPhase,
  getCycles,
  getSymptomFrequencies,
  isLateByDays,
  predictNextPeriod,
  CYCLE_ACCENT,
  CYCLE_ACCENT_LIGHT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type Cycle,
  type CyclePhase,
} from '@mylife/cycle';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  addIsoDays,
  buildSymptomPhaseEntries,
  clampPercent,
  daysBetweenIso,
  formatLongDate,
  formatMonthDay,
  formatMonthDayYear,
  formatPhaseLabel,
  formatSymptomLabel,
} from './phase2-utils';

interface ForecastSymptomRow {
  symptom: string;
  percentage: number;
  phase: CyclePhase;
}

interface FertileBar {
  date: string;
  intensity: number;
  isPeak: boolean;
}

interface ForecastData {
  cycleCount: number;
  predictionAvailable: boolean;
  heroLabel: string;
  confidencePct: number;
  symptomRows: ForecastSymptomRow[];
  fertileBars: FertileBar[];
  fertileRange: string;
  peakLabel: string;
}

function getUpcomingPhase(
  today: string,
  prediction: ReturnType<typeof predictNextPeriod>,
  currentPhase: CyclePhase | null,
): CyclePhase {
  if (!prediction) return currentPhase ?? 'menstrual';

  const daysToPeriod = prediction.daysUntilNextPeriod;
  const daysToFertile = prediction.fertileWindowStart
    ? daysBetweenIso(today, prediction.fertileWindowStart)
    : Number.POSITIVE_INFINITY;

  if (daysToFertile >= 0 && daysToFertile < daysToPeriod) {
    return 'ovulation';
  }
  if (daysToPeriod <= 5) {
    return 'menstrual';
  }
  return currentPhase ?? 'luteal';
}

function buildFertileBars(prediction: NonNullable<ReturnType<typeof predictNextPeriod>>): FertileBar[] {
  if (!prediction.fertileWindowStart) return [];
  return [0, 1, 2, 3, 4].map((offset) => ({
    date: addIsoDays(prediction.fertileWindowStart!, offset),
    intensity: [0.35, 0.62, 0.9, 1, 0.55][offset] ?? 0.4,
    isPeak: offset === 3,
  }));
}

function buildHeroLabel(
  prediction: NonNullable<ReturnType<typeof predictNextPeriod>>,
  lateByDays: number,
): string {
  if (lateByDays > 0) {
    return `Estimated ${formatMonthDayYear(prediction.predictedStartDate)} • ${lateByDays} day${lateByDays === 1 ? '' : 's'} late`;
  }
  if (prediction.daysUntilNextPeriod <= 0) {
    return `Estimated ${formatMonthDayYear(prediction.predictedStartDate)} • expected now`;
  }
  return `Estimated ${formatMonthDayYear(prediction.predictedStartDate)} • in ${prediction.daysUntilNextPeriod} day${prediction.daysUntilNextPeriod === 1 ? '' : 's'}`;
}

function loadForecastData(
  db: ReturnType<typeof useDatabase>,
  today: string,
): ForecastData {
  const cycles = getCycles(db, 24);
  const completed: Cycle[] = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const periodLengths = completed
    .map((cycle) => cycle.periodLength)
    .filter((length): length is number => length !== null);

  const averageCycleLength = calculateAverageCycleLength(cycleLengths) ?? 28;
  const latestCycle = cycles[0] ?? null;
  const prediction = latestCycle
    ? predictNextPeriod(latestCycle.startDate, cycleLengths, periodLengths, today)
    : null;

  if (!latestCycle || !prediction) {
    return {
      cycleCount: cycles.length,
      predictionAvailable: false,
      heroLabel: 'Log at least 2 complete cycles to unlock your next-period forecast.',
      confidencePct: 0,
      symptomRows: [],
      fertileBars: [],
      fertileRange: '--',
      peakLabel: '--',
    };
  }

  const lateByDays = isLateByDays(latestCycle.startDate, averageCycleLength, today);
  const currentPhase = getCurrentPhase(
    latestCycle.startDate,
    today,
    Math.round(averageCycleLength),
  );
  const symptomEntries = buildSymptomPhaseEntries(
    db,
    cycles,
    Math.round(averageCycleLength),
  );
  const patterns = analyzeSymptomsByPhase(symptomEntries, 2);
  const patternMap = new Map(patterns.map((pattern) => [pattern.symptom, pattern]));
  const upcomingPhase = getUpcomingPhase(today, prediction, currentPhase);
  const frequencies = getSymptomFrequencies(db, 16);
  const maxCount = frequencies[0]?.count ?? 1;

  const dominantRows = patterns
    .filter((pattern) => pattern.dominantPhase === upcomingPhase)
    .map((pattern) => ({
      symptom: pattern.symptom,
      percentage: clampPercent(Math.round(pattern.phaseConcentration * 100)),
      phase: pattern.dominantPhase,
    }));

  const fallbackRows = frequencies.map((item) => ({
    symptom: item.symptom,
    percentage: clampPercent(Math.round((item.count / maxCount) * 100)),
    phase: patternMap.get(item.symptom)?.dominantPhase ?? upcomingPhase,
  }));

  const symptomRows = [...dominantRows, ...fallbackRows]
    .filter(
      (row, index, rows) =>
        rows.findIndex((candidate) => candidate.symptom === row.symptom) === index,
    )
    .slice(0, 4);

  const fertileBars = buildFertileBars(prediction);
  const peakDate = fertileBars.find((bar) => bar.isPeak)?.date ?? null;

  return {
    cycleCount: cycles.length,
    predictionAvailable: true,
    heroLabel: buildHeroLabel(prediction, lateByDays),
    confidencePct: Math.round(prediction.confidence * 100),
    symptomRows,
    fertileBars,
    fertileRange: `${formatMonthDay(prediction.fertileWindowStart)} – ${formatMonthDay(prediction.fertileWindowEnd)}`,
    peakLabel: peakDate ? `Peak ovulation · ${formatMonthDay(peakDate)}` : '--',
  };
}

export default function PredictionsDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const result = useMemo(() => {
    try {
      return { ok: true as const, data: loadForecastData(db, today) };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error ? error.message : 'Failed to load predictions.',
      };
    }
  }, [db, today]);

  if (!result.ok) {
    return (
      <View style={styles.errorWrap}>
        <RNText style={styles.errorTitle}>Something went wrong</RNText>
        <RNText style={styles.errorBody}>{result.message}</RNText>
      </View>
    );
  }

  const {
    cycleCount,
    predictionAvailable,
    heroLabel,
    confidencePct,
    symptomRows,
    fertileBars,
    fertileRange,
    peakLabel,
  } = result.data;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <ChevronLeft size={22} color="#E4E1E9" strokeWidth={2.2} />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <RNText style={styles.eyebrow}>FORECAST DETAIL</RNText>
            <RNText style={styles.headerTitle}>Predictions</RNText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {!predictionAvailable ? (
          <GlassCard style={styles.emptyCard}>
            <Sparkles size={36} color={CYCLE_ACCENT} strokeWidth={1.8} />
            <RNText style={styles.emptyTitle}>More data sharpens your forecast</RNText>
            <RNText style={styles.emptyBody}>{heroLabel}</RNText>
          </GlassCard>
        ) : (
          <>
            <GlassCard style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <RNText style={styles.heroEyebrow}>COMING UP</RNText>
                  <RNText style={styles.heroTitle}>Next Period</RNText>
                  <RNText style={styles.heroSub}>{heroLabel}</RNText>
                </View>
                <View style={styles.heroBadge}>
                  <View style={styles.heroBadgeDot} />
                  <RNText style={styles.heroBadgeText}>
                    {confidencePct >= 75 ? 'HIGH' : confidencePct >= 55 ? 'MEDIUM' : 'BUILDING'} · {cycleCount} cycles
                  </RNText>
                </View>
              </View>

              <View style={styles.heroBody}>
                <ConfidenceRing confidencePct={confidencePct} />
                <View style={styles.heroCalendarWrap}>
                  <CalendarDays size={76} color="rgba(255,255,255,0.08)" strokeWidth={1.2} />
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.sectionCard}>
              <RNText style={styles.sectionLabel}>FERTILE WINDOW</RNText>
              <RNText style={styles.sectionTitle}>{fertileRange}</RNText>
              <RNText style={styles.sectionSub}>{peakLabel}</RNText>
              <View style={styles.fertileBarRow}>
                {fertileBars.map((bar) => (
                  <View key={bar.date} style={styles.fertileBarItem}>
                    <View style={styles.fertileTrack}>
                      <View
                        style={[
                          styles.fertileFill,
                          {
                            height: `${Math.round(bar.intensity * 100)}%`,
                            backgroundColor: bar.isPeak
                              ? CYCLE_ACCENT
                              : CYCLE_PHASE_COLORS.ovulation,
                          },
                        ]}
                      />
                    </View>
                    <RNText
                      style={[
                        styles.fertileDayLabel,
                        bar.isPeak && styles.fertileDayLabelPeak,
                      ]}
                    >
                      {formatMonthDay(bar.date)}
                    </RNText>
                  </View>
                ))}
              </View>
            </GlassCard>

            <GlassCard style={styles.sectionCard}>
              <RNText style={styles.sectionLabel}>LIKELY TO EXPERIENCE</RNText>
              {symptomRows.length > 0 ? (
                <View style={styles.symptomList}>
                  {symptomRows.map((row) => (
                    <View key={row.symptom} style={styles.symptomRow}>
                      <View style={styles.symptomTextWrap}>
                        <RNText style={styles.symptomName}>
                          {formatSymptomLabel(row.symptom)}
                        </RNText>
                        <RNText style={styles.symptomSub}>
                          Based on similar {formatPhaseLabel(row.phase).toLowerCase()} patterns
                        </RNText>
                      </View>
                      <View style={styles.symptomMeta}>
                        <RNText style={styles.symptomPct}>{row.percentage}%</RNText>
                        <PhaseBadge phase={row.phase} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <RNText style={styles.sectionSub}>
                  Log more symptoms to personalize this forecast.
                </RNText>
              )}
            </GlassCard>

            <Pressable
              onPress={() => setExpanded((value) => !value)}
              style={({ pressed }) => [
                styles.methodCardPressable,
                pressed && { opacity: 0.85 },
              ]}
            >
              <GlassCard style={styles.sectionCard}>
                <View style={styles.methodHeader}>
                  <View>
                    <RNText style={styles.sectionLabel}>HOW WE PREDICT</RNText>
                    <RNText style={styles.methodTitle}>
                      Weighted moving average over your last 6 cycles
                    </RNText>
                  </View>
                  {expanded ? (
                    <ChevronUp size={18} color={CYCLE_ACCENT_LIGHT} strokeWidth={2.2} />
                  ) : (
                    <ChevronDown size={18} color={CYCLE_ACCENT_LIGHT} strokeWidth={2.2} />
                  )}
                </View>
                {expanded ? (
                  <>
                    <RNText style={styles.methodBody}>
                      We weight your most recent completed cycles more heavily,
                      then layer in period length consistency and fertile-window timing.
                      The more complete cycles you log, the stronger the confidence ring becomes.
                    </RNText>
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          'Methodology notes',
                          'Detailed methodology docs are being written. The current forecast uses a recency-weighted moving average over up to 6 completed cycles.',
                        )
                      }
                    >
                      <RNText style={styles.methodLink}>View methodology notes</RNText>
                    </Pressable>
                  </>
                ) : null}
              </GlassCard>
            </Pressable>

            <RNText style={styles.generatedAt}>Updated {formatLongDate(today)}</RNText>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ConfidenceRing({ confidencePct }: { confidencePct: number }) {
  const size = 168;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = clampPercent(confidencePct);
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="forecastRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={CYCLE_ACCENT_LIGHT} />
            <Stop offset="100%" stopColor={CYCLE_ACCENT} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={CYCLE_SURFACES.high}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="url(#forecastRing)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringContent}>
        <RNText style={styles.ringValue}>{confidencePct}%</RNText>
        <RNText style={styles.ringLabel}>confidence</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYCLE_SURFACES.low,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  eyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: CYCLE_ACCENT_LIGHT,
  },
  headerTitle: {
    ...CYCLE_TYPOGRAPHY.headlineLg,
    color: '#E4E1E9',
  },
  heroCard: {
    padding: 20,
    gap: 20,
    backgroundColor: CYCLE_SURFACES.low,
  },
  heroTopRow: {
    gap: 12,
  },
  heroEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: CYCLE_PHASE_COLORS.ovulation,
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 38,
    lineHeight: 42,
    color: '#E4E1E9',
    letterSpacing: -0.9,
  },
  heroSub: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.88)',
    marginTop: 6,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.high,
  },
  heroBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#34D399',
  },
  heroBadgeText: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: 'rgba(228, 225, 233, 0.82)',
  },
  heroBody: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  heroCalendarWrap: {
    position: 'absolute',
    right: 8,
    bottom: -6,
  },
  ringWrap: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 34,
    color: '#E4E1E9',
    letterSpacing: -0.8,
  },
  ringLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.74)',
    marginTop: 6,
  },
  sectionCard: {
    gap: 12,
    backgroundColor: CYCLE_SURFACES.low,
  },
  sectionLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  sectionTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  sectionSub: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  fertileBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  fertileBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  fertileTrack: {
    width: '100%',
    height: 96,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.highest,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fertileFill: {
    width: '100%',
    borderRadius: 999,
    minHeight: 18,
  },
  fertileDayLabel: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  fertileDayLabelPeak: {
    color: CYCLE_ACCENT_LIGHT,
  },
  symptomList: {
    gap: 12,
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CYCLE_SURFACES.high,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  symptomTextWrap: {
    flex: 1,
    gap: 4,
  },
  symptomName: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  symptomSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.65)',
  },
  symptomMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  symptomPct: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 14,
    color: CYCLE_ACCENT_LIGHT,
  },
  methodCardPressable: {
    borderRadius: 16,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  methodTitle: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
    letterSpacing: -0.2,
  },
  methodBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.86)',
  },
  methodLink: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 13,
    color: CYCLE_ACCENT_LIGHT,
  },
  generatedAt: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.55)',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyCard: {
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 28,
  },
  emptyTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  emptyBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  errorWrap: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.lowest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  errorBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
    textAlign: 'center',
  },
});
