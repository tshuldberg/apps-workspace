import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import {
  GlassCard,
  LogTodayFAB,
  StatPill,
  detectCycleTrend,
  getCycleStats,
  getCycles,
  getSymptomsForDay,
  getCycleDaysByCycle,
  CYCLE_ACCENT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type Cycle,
  type CycleStats,
} from '@mylife/cycle';
import { useDatabase } from '../../../components/DatabaseProvider';

const INITIAL_LIMIT = 6;

const MONTHS_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface CycleRow {
  cycle: Cycle;
  index: number;
  dateRange: string;
  lengthLabel: string;
  flowLabel: string;
  symptomCount: number;
  monthLabel: string;
  dayLabel: string;
  regularityLabel: string;
}

interface HistoryData {
  stats: CycleStats;
  regularity: number; // 0..1
  rows: CycleRow[];
  totalCycles: number;
}

function parseIso(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}

function formatRange(start: string, end: string | null): string {
  const s = parseIso(start);
  if (!end) {
    return `${MONTHS_LONG[s.getUTCMonth()]} ${s.getUTCDate()} – ongoing`;
  }
  const e = parseIso(end);
  return `${MONTHS_LONG[s.getUTCMonth()]} ${s.getUTCDate()} – ${MONTHS_LONG[e.getUTCMonth()]} ${e.getUTCDate()}`;
}

function loadHistoryData(
  db: ReturnType<typeof useDatabase>,
): HistoryData {
  const stats = getCycleStats(db);
  const cycles = getCycles(db, 50);

  const completed = cycles.filter((c) => c.endDate !== null);
  const cycleLengths = completed
    .map((c) => c.lengthDays)
    .filter((l): l is number => l !== null)
    .reverse(); // chronological order for detectCycleTrend

  const trend = detectCycleTrend(cycleLengths);
  const regularity = trend.regularity;

  const rows: CycleRow[] = cycles.map((cycle, i) => {
    const s = parseIso(cycle.startDate);
    const monthLabel = MONTHS_SHORT[s.getUTCMonth()];
    const dayLabel = String(s.getUTCDate());
    const dateRange = formatRange(cycle.startDate, cycle.endDate);
    const lengthLabel = cycle.lengthDays
      ? `${cycle.lengthDays} DAYS`
      : 'ONGOING';
    const flowLabel = cycle.periodLength
      ? `${cycle.periodLength} days period`
      : 'Period open';

    // Tally symptoms logged across the cycle
    let symptomCount = 0;
    const days = getCycleDaysByCycle(db, cycle.id, 60);
    for (const day of days) {
      symptomCount += getSymptomsForDay(db, day.id).length;
    }

    const regularityLabel =
      cycle.lengthDays != null && stats.averageCycleLength != null
        ? Math.abs(cycle.lengthDays - stats.averageCycleLength) <= 2
          ? 'Regular'
          : cycle.lengthDays > stats.averageCycleLength
            ? 'Long'
            : 'Short'
        : 'New';

    return {
      cycle,
      index: cycles.length - i,
      dateRange,
      lengthLabel,
      flowLabel,
      symptomCount,
      monthLabel,
      dayLabel,
      regularityLabel,
    };
  });

  return {
    stats,
    regularity,
    rows,
    totalCycles: cycles.length,
  };
}

export default function CycleHistoryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => {
    try {
      return { ok: true as const, data: loadHistoryData(db) };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : 'Failed to load history.',
      };
    }
  }, [db, refreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const handleLog = useCallback(() => {
    router.push('/(cycle)/log-day');
  }, [router]);

  const handleOpen = useCallback(
    (cycleId: string) => {
      router.push(`/(cycle)/compare?cycleId=${cycleId}`);
    },
    [router],
  );

  if (!result.ok) {
    return (
      <View style={styles.errorWrap}>
        <RNText style={styles.errorTitle}>Something went wrong</RNText>
        <RNText style={styles.errorBody}>{result.message}</RNText>
      </View>
    );
  }

  const { stats, regularity, rows, totalCycles } = result.data;
  const visibleRows = expanded ? rows : rows.slice(0, INITIAL_LIMIT);

  const avgLabel =
    stats.averageCycleLength != null
      ? `${Math.round(stats.averageCycleLength)} days`
      : '--';
  const regularityPct =
    regularity > 0 ? `${Math.round(regularity * 100)}%` : '--';
  const lastPeriodLabel =
    rows.length > 0 ? formatShortDate(rows[0].cycle.startDate) : '--';

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
        <View style={styles.heroWrap}>
          <RNText style={styles.heroTitle}>Cycle History</RNText>
          <RNText style={styles.heroSubtitle}>
            A comprehensive look at your physical narrative.
          </RNText>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statFlex}>
            <StatPill label="AVG LENGTH" value={avgLabel} />
          </View>
          <View style={styles.statFlex}>
            <StatPill
              label="REGULARITY"
              value={regularityPct}
              accent={regularity >= 0.85 ? CYCLE_ACCENT : undefined}
            />
          </View>
          <View style={styles.statFlex}>
            <StatPill label="LAST PERIOD" value={lastPeriodLabel} />
          </View>
        </View>

        {totalCycles === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <RNText style={styles.emptyEmoji}>📜</RNText>
            <RNText style={styles.emptyTitle}>
              Start tracking to build your history
            </RNText>
            <RNText style={styles.emptyBody}>
              Your past cycles will appear here as you log them. Every entry
              sharpens your predictions.
            </RNText>
            <Pressable
              onPress={handleLog}
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && { opacity: 0.85 },
              ]}
            >
              <RNText style={styles.ctaButtonText}>Log first period</RNText>
            </Pressable>
          </GlassCard>
        ) : (
          <>
            <RNText style={styles.sectionLabel}>PAST CYCLES</RNText>
            <View style={styles.timeline}>
              {visibleRows.map((row) => (
                <HistoryRow
                  key={row.cycle.id}
                  row={row}
                  onPress={() => handleOpen(row.cycle.id)}
                />
              ))}
            </View>

            {rows.length > INITIAL_LIMIT && !expanded ? (
              <Pressable
                onPress={() => setExpanded(true)}
                style={({ pressed }) => [
                  styles.moreButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <RNText style={styles.moreButtonText}>
                  Show all {rows.length} cycles
                </RNText>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      {totalCycles > 0 ? <LogTodayFAB onPress={handleLog} /> : null}
    </View>
  );
}

function HistoryRow({
  row,
  onPress,
}: {
  row: CycleRow;
  onPress: () => void;
}) {
  const isOngoing = row.cycle.endDate === null;
  return (
    <GlassCard onPress={onPress} style={styles.rowCard}>
      <View style={styles.rowWrap}>
        <View
          style={[
            styles.datePill,
            {
              backgroundColor: isOngoing
                ? `${CYCLE_PHASE_COLORS.menstrual}22`
                : CYCLE_SURFACES.high,
            },
          ]}
        >
          <RNText
            style={[
              styles.datePillMonth,
              { color: isOngoing ? CYCLE_PHASE_COLORS.menstrual : 'rgba(214, 195, 181, 0.85)' },
            ]}
          >
            {row.monthLabel}
          </RNText>
          <RNText style={styles.datePillDay}>{row.dayLabel}</RNText>
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTitleRow}>
            <RNText style={styles.rowTitle}>Cycle {row.index}</RNText>
            <View style={styles.lengthBadge}>
              <RNText style={styles.lengthBadgeText}>{row.lengthLabel}</RNText>
            </View>
          </View>
          <RNText style={styles.rowDate}>{row.dateRange}</RNText>
          <View style={styles.chipRow}>
            <View
              style={[
                styles.chip,
                { backgroundColor: `${CYCLE_PHASE_COLORS.menstrual}22` },
              ]}
            >
              <RNText
                style={[
                  styles.chipText,
                  { color: CYCLE_PHASE_COLORS.menstrual },
                ]}
              >
                {row.flowLabel}
              </RNText>
            </View>
            <View style={styles.chip}>
              <RNText style={styles.chipText}>{row.regularityLabel}</RNText>
            </View>
            {row.symptomCount > 0 ? (
              <View style={styles.chip}>
                <RNText style={styles.chipText}>
                  {row.symptomCount} symptom
                  {row.symptomCount === 1 ? '' : 's'}
                </RNText>
              </View>
            ) : null}
          </View>
        </View>

        <ChevronRight size={18} color="rgba(214, 195, 181, 0.5)" strokeWidth={2} />
      </View>
    </GlassCard>
  );
}

function formatShortDate(iso: string): string {
  const d = parseIso(iso);
  return `${MONTHS_SHORT[d.getUTCMonth()].charAt(0) + MONTHS_SHORT[d.getUTCMonth()].slice(1).toLowerCase()} ${d.getUTCDate()}`;
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
    gap: 24,
  },
  heroWrap: {
    gap: 6,
  },
  heroTitle: {
    ...CYCLE_TYPOGRAPHY.displayMd,
    color: '#E4E1E9',
  },
  heroSubtitle: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.85)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statFlex: {
    flex: 1,
  },
  sectionLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.7)',
    marginBottom: -10,
  },
  timeline: {
    gap: 12,
  },
  rowCard: {
    padding: 18,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  datePill: {
    width: 64,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  datePillMonth: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1,
  },
  datePillDay: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 20,
    color: '#E4E1E9',
    lineHeight: 24,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  lengthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.highest,
  },
  lengthBadgeText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: 'rgba(214, 195, 181, 0.9)',
  },
  rowDate: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.85)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  chipText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 9,
    letterSpacing: 0.3,
    color: 'rgba(214, 195, 181, 0.85)',
    textTransform: 'uppercase',
  },
  moreButton: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: `${CYCLE_ACCENT}22`,
  },
  moreButtonText: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 12,
    color: CYCLE_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    gap: 14,
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
  ctaButton: {
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: CYCLE_ACCENT,
  },
  ctaButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    color: '#4B2700',
    letterSpacing: 0.3,
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
