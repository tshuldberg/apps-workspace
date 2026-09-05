import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  ChevronLeft,
  HeartPulse,
  Sparkles,
} from 'lucide-react-native';
import {
  GlassCard,
  analyzeSymptomsByPhase,
  calculateAverageCycleLength,
  detectCycleTrend,
  generateCycleInsights,
  getCycleStats,
  getCycles,
  getSymptomFrequencies,
  predictNextPeriod,
  CYCLE_ACCENT,
  CYCLE_ACCENT_LIGHT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type SymptomPhasePattern,
} from '@mylife/cycle';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  PHASE_ORDER,
  PHASE_LABELS,
  buildSymptomPhaseEntries,
  formatPhaseLabel,
  formatSymptomLabel,
} from './phase2-utils';

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  sad: '😔',
  anxious: '😬',
  irritable: '😤',
  calm: '😌',
  emotional: '🥹',
};

interface SymptomTileRow {
  symptom: string;
  count: number;
  intensityPct: number;
  phase: keyof typeof CYCLE_PHASE_COLORS;
}

interface SymptomAnalysisData {
  hasSymptoms: boolean;
  topPhysical: SymptomPhasePattern | null;
  topMoodPatterns: SymptomPhasePattern[];
  topMood: SymptomPhasePattern | null;
  physicalTiles: SymptomTileRow[];
  insightRows: string[];
}

function patternHeadline(pattern: SymptomPhasePattern): string {
  if (pattern.dominantPhase === 'luteal') return 'Predictable luteal shift';
  if (pattern.dominantPhase === 'ovulation') return 'Peaks during ovulation';
  if (pattern.dominantPhase === 'follicular') return 'Rises in follicular days';
  return 'Most common during your period';
}

function loadSymptomAnalysisData(
  db: ReturnType<typeof useDatabase>,
  today: string,
): SymptomAnalysisData {
  const cycles = getCycles(db, 24);
  const completed = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const periodLengths = completed
    .map((cycle) => cycle.periodLength)
    .filter((length): length is number => length !== null);
  const averageCycleLength = calculateAverageCycleLength(cycleLengths) ?? 28;
  const entries = buildSymptomPhaseEntries(
    db,
    cycles,
    Math.round(averageCycleLength),
  );
  const patterns = analyzeSymptomsByPhase(entries, 2);
  const physicalPatterns = patterns.filter((pattern) => pattern.category === 'physical');
  const moodPatterns = patterns.filter((pattern) => pattern.category === 'mood');
  const topPhysical = physicalPatterns[0] ?? null;
  const topMood = moodPatterns[0] ?? null;

  const frequencies = getSymptomFrequencies(db, 20);
  const physicalFrequencies = frequencies.filter((item) => item.category === 'physical');
  const maxCount = physicalFrequencies[0]?.count ?? 1;
  const patternMap = new Map(patterns.map((pattern) => [pattern.symptom, pattern]));

  const physicalTiles = physicalFrequencies.slice(0, 6).map((item) => ({
    symptom: item.symptom,
    count: item.count,
    intensityPct: Math.round((item.count / maxCount) * 100),
    phase: patternMap.get(item.symptom)?.dominantPhase ?? 'luteal',
  }));

  const stats = getCycleStats(db);
  const prediction =
    cycles[0] != null
      ? predictNextPeriod(cycles[0].startDate, cycleLengths, periodLengths, today)
      : null;
  const trend =
    cycleLengths.length >= 4 ? detectCycleTrend([...cycleLengths].reverse()) : null;

  const insightRows = generateCycleInsights(
    stats,
    prediction,
    trend,
    patterns,
    today,
  )
    .filter((insight) => insight.key.startsWith('symptom_pattern_'))
    .map((insight) => insight.text);

  const fallbackInsightRows =
    insightRows.length > 0
      ? insightRows
      : patterns.slice(0, 3).map((pattern) => {
          const pct = Math.round(pattern.phaseConcentration * 100);
          return `${formatSymptomLabel(pattern.symptom)} shows up in your ${formatPhaseLabel(pattern.dominantPhase).toLowerCase()} phase ${pct}% of the time.`;
        });

  return {
    hasSymptoms: entries.length > 0,
    topPhysical,
    topMoodPatterns: moodPatterns.slice(0, 3),
    topMood,
    physicalTiles,
    insightRows: fallbackInsightRows,
  };
}

export default function SymptomAnalysisScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const result = useMemo(() => {
    try {
      return { ok: true as const, data: loadSymptomAnalysisData(db, today) };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error ? error.message : 'Failed to load symptom analysis.',
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

  const { hasSymptoms, topPhysical, topMoodPatterns, topMood, physicalTiles, insightRows } =
    result.data;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 },
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
            <RNText style={styles.eyebrow}>PATTERN DETAIL</RNText>
            <RNText style={styles.headerTitle}>Symptom Insights</RNText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {!hasSymptoms ? (
          <GlassCard style={styles.emptyCard}>
            <Sparkles size={36} color={CYCLE_ACCENT} strokeWidth={1.8} />
            <RNText style={styles.emptyTitle}>No symptom patterns yet</RNText>
            <RNText style={styles.emptyBody}>
              Log cramps, mood, bloating, or fatigue from the daily log to unlock
              physical and emotional phase analysis.
            </RNText>
          </GlassCard>
        ) : (
          <>
            {topPhysical ? (
              <GlassCard style={styles.primaryCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <RNText style={styles.sectionLabel}>PHYSICAL TRACKING</RNText>
                    <RNText style={styles.cardTitle}>
                      {formatSymptomLabel(topPhysical.symptom)}
                    </RNText>
                    <RNText style={styles.cardSub}>
                      Logged {topPhysical.totalCount} times • {patternHeadline(topPhysical)}
                    </RNText>
                  </View>
                  <HeartPulse size={24} color={CYCLE_PHASE_COLORS[topPhysical.dominantPhase]} strokeWidth={2} />
                </View>
                <PhasePatternBars pattern={topPhysical} />
                <View style={styles.patternPill}>
                  <View
                    style={[
                      styles.patternPillDot,
                      { backgroundColor: CYCLE_PHASE_COLORS[topPhysical.dominantPhase] },
                    ]}
                  />
                  <RNText style={styles.patternPillText}>
                    Most common in {PHASE_LABELS[topPhysical.dominantPhase].toLowerCase()} phase
                  </RNText>
                </View>
              </GlassCard>
            ) : null}

            <GlassCard style={styles.primaryCard}>
              <View style={styles.cardHeader}>
                <View>
                  <RNText style={styles.sectionLabel}>EMOTIONAL STATE</RNText>
                  <RNText style={styles.cardTitle}>
                    {topMood ? formatSymptomLabel(topMood.symptom) : 'Mood patterns'}
                  </RNText>
                  <RNText style={styles.cardSub}>
                    {topMood ? patternHeadline(topMood) : 'Keep logging mood to reveal emotional arcs.'}
                  </RNText>
                </View>
                <Activity size={24} color={CYCLE_ACCENT_LIGHT} strokeWidth={2} />
              </View>
              <View style={styles.emotionList}>
                {topMoodPatterns.length > 0 ? (
                  topMoodPatterns.map((pattern) => (
                    <View key={pattern.symptom} style={styles.emotionRow}>
                      <RNText style={styles.emotionName}>
                        {MOOD_EMOJI[pattern.symptom] ?? '•'} {formatSymptomLabel(pattern.symptom)}
                      </RNText>
                      <RNText
                        style={[
                          styles.emotionValue,
                          { color: CYCLE_PHASE_COLORS[pattern.dominantPhase] },
                        ]}
                      >
                        {Math.round(pattern.phaseConcentration * 100)}%
                      </RNText>
                    </View>
                  ))
                ) : (
                  <RNText style={styles.cardSub}>
                    Keep logging mood to personalize this section.
                  </RNText>
                )}
              </View>
              <View style={styles.tagRow}>
                {topMoodPatterns.slice(0, 2).map((pattern) => (
                  <View
                    key={pattern.symptom}
                    style={[
                      styles.phaseTag,
                      { backgroundColor: `${CYCLE_PHASE_COLORS[pattern.dominantPhase]}22` },
                    ]}
                  >
                    <RNText
                      style={[
                        styles.phaseTagText,
                        { color: CYCLE_PHASE_COLORS[pattern.dominantPhase] },
                      ]}
                    >
                      {patternHeadline(pattern)}
                    </RNText>
                  </View>
                ))}
              </View>
              {topMood ? <PhasePatternBars pattern={topMood} compact /> : null}
            </GlassCard>

            <View style={styles.sectionWrap}>
              <RNText style={styles.sectionLabel}>SYMPTOM FREQUENCY</RNText>
              <View style={styles.tileGrid}>
                {physicalTiles.map((tile) => (
                  <GlassCard key={tile.symptom} style={styles.tileCard}>
                    <RNText style={styles.tileTitle}>
                      {formatSymptomLabel(tile.symptom)}
                    </RNText>
                    <RNText style={styles.tileMeta}>Logged {tile.count} times</RNText>
                    <View style={styles.tileTrack}>
                      <View
                        style={[
                          styles.tileFill,
                          {
                            width: `${tile.intensityPct}%`,
                            backgroundColor: CYCLE_PHASE_COLORS[tile.phase],
                          },
                        ]}
                      />
                    </View>
                    <RNText style={styles.tileFoot}>
                      {PHASE_LABELS[tile.phase]}
                    </RNText>
                  </GlassCard>
                ))}
              </View>
            </View>

            <View style={styles.sectionWrap}>
              <RNText style={styles.sectionLabel}>CORRELATION INSIGHTS</RNText>
              <View style={styles.insightList}>
                {insightRows.map((row) => (
                  <GlassCard key={row} style={styles.insightCard}>
                    <Sparkles size={18} color={CYCLE_ACCENT} strokeWidth={1.8} />
                    <RNText style={styles.insightText}>{row}</RNText>
                  </GlassCard>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          onPress={() => router.push('/(cycle)/log-day')}
          style={({ pressed }) => [
            styles.footerButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <RNText style={styles.footerButtonText}>Log Current Symptoms</RNText>
        </Pressable>
      </View>
    </View>
  );
}

function PhasePatternBars({
  pattern,
  compact = false,
}: {
  pattern: SymptomPhasePattern;
  compact?: boolean;
}) {
  const maxValue = Math.max(...PHASE_ORDER.map((phase) => pattern.byPhase[phase]), 1);
  return (
    <View style={[styles.barRow, compact && styles.barRowCompact]}>
      {PHASE_ORDER.map((phase) => (
        <View key={phase} style={styles.barItem}>
          <View style={[styles.barTrack, compact && styles.barTrackCompact]}>
            <View
              style={[
                styles.barFill,
                compact && styles.barFillCompact,
                {
                  height: `${Math.max(18, Math.round((pattern.byPhase[phase] / maxValue) * 100))}%`,
                  backgroundColor: CYCLE_PHASE_COLORS[phase],
                },
              ]}
            />
          </View>
          <RNText style={styles.barLabel}>{PHASE_LABELS[phase].slice(0, 3)}</RNText>
        </View>
      ))}
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
  sectionLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  primaryCard: {
    gap: 14,
    backgroundColor: CYCLE_SURFACES.low,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    color: '#E4E1E9',
    letterSpacing: -0.4,
    marginTop: 6,
  },
  cardSub: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.76)',
    marginTop: 6,
  },
  patternPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.high,
  },
  patternPillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  patternPillText: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 12,
    color: '#E4E1E9',
  },
  emotionList: {
    gap: 10,
  },
  emotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: CYCLE_SURFACES.high,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emotionName: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  emotionValue: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 14,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phaseTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  phaseTagText: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  sectionWrap: {
    gap: 12,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tileCard: {
    width: '48%',
    gap: 10,
    backgroundColor: CYCLE_SURFACES.low,
  },
  tileTitle: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  tileMeta: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  tileTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.highest,
    overflow: 'hidden',
  },
  tileFill: {
    height: '100%',
    borderRadius: 999,
  },
  tileFoot: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  insightList: {
    gap: 10,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: CYCLE_SURFACES.low,
  },
  insightText: {
    flex: 1,
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: '#E4E1E9',
  },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
  },
  footerButton: {
    borderRadius: 999,
    backgroundColor: CYCLE_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  footerButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 14,
    color: '#4B2700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    minHeight: 110,
  },
  barRowCompact: {
    minHeight: 88,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    width: '100%',
    height: 84,
    borderRadius: 16,
    backgroundColor: CYCLE_SURFACES.high,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barTrackCompact: {
    height: 68,
  },
  barFill: {
    width: '100%',
    borderRadius: 16,
    minHeight: 16,
  },
  barFillCompact: {
    minHeight: 12,
  },
  barLabel: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.6)',
    textTransform: 'uppercase',
  },
  emptyCard: {
    gap: 12,
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
