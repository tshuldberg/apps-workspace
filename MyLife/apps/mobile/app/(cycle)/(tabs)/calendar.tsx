import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import {
  GlassCard,
  LogTodayFAB,
  calculateAverageCycleLength,
  calculateAveragePeriodLength,
  getCycleDayByDate,
  getCycles,
  predictNextPeriod,
  CYCLE_ACCENT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type Cycle,
  type CyclePhase,
  type CycleDay,
} from '@mylife/cycle';
import { useDatabase } from '../../../components/DatabaseProvider';
import { decodeCycleLogNotes } from '../phase2-utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
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

type DayMark = 'menstrual' | 'fertile' | 'ovulation' | 'predicted' | null;

interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  mark: DayMark;
  hasLog: boolean;
  logged: CycleDay | null;
}

function isoDate(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseIso(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}

function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseIso(b).getTime() - parseIso(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

interface CalendarData {
  cells: DayCell[];
  cycleCount: number;
}

function classifyDate(
  iso: string,
  cycles: Cycle[],
  avgCycleLength: number,
  avgPeriodLength: number,
  lastCycle: Cycle | null,
  cycleLengths: number[],
  periodLengths: number[],
  today: string,
): { mark: DayMark } {
  const t = parseIso(iso).getTime();

  // Historical + current cycles: check menstrual + ovulation windows
  for (const cycle of cycles) {
    const startT = parseIso(cycle.startDate).getTime();
    const endT = cycle.endDate ? parseIso(cycle.endDate).getTime() : null;

    const periodLen = cycle.periodLength ?? Math.round(avgPeriodLength);
    const menstrualEnd = parseIso(cycle.startDate);
    menstrualEnd.setUTCDate(menstrualEnd.getUTCDate() + Math.max(0, periodLen - 1));

    if (t >= startT && t <= menstrualEnd.getTime()) {
      return { mark: 'menstrual' };
    }

    const cycleLen = cycle.lengthDays ?? Math.round(avgCycleLength);
    const ovulationDay = addDays(cycle.startDate, cycleLen - 14);
    const fertileStart = addDays(ovulationDay, -3);
    const fertileEnd = addDays(ovulationDay, 1);

    // Only show fertile markers for completed cycles or the current one
    if (endT !== null && t > endT) continue;

    const ovulT = parseIso(ovulationDay).getTime();
    const fStartT = parseIso(fertileStart).getTime();
    const fEndT = parseIso(fertileEnd).getTime();
    if (t === ovulT) return { mark: 'ovulation' };
    if (t >= fStartT && t <= fEndT) return { mark: 'fertile' };
  }

  // Forward prediction: only when we have enough data and cell is after last cycle
  if (lastCycle && cycleLengths.length >= 2) {
    const prediction = predictNextPeriod(
      lastCycle.startDate,
      cycleLengths,
      periodLengths,
      today,
    );
    if (prediction) {
      const predStart = parseIso(prediction.predictedStartDate).getTime();
      const predEnd = parseIso(prediction.predictedEndDate).getTime();
      if (t >= predStart && t <= predEnd) {
        return { mark: 'predicted' };
      }
      if (prediction.fertileWindowStart && prediction.fertileWindowEnd) {
        const fStart = parseIso(prediction.fertileWindowStart).getTime();
        const fEnd = parseIso(prediction.fertileWindowEnd).getTime();
        const ovul = addDays(
          lastCycle.startDate,
          Math.round(avgCycleLength) - 14,
        );
        const ovulT = parseIso(ovul).getTime();
        if (t === ovulT && t > parseIso(lastCycle.startDate).getTime()) {
          return { mark: 'ovulation' };
        }
        if (t >= fStart && t <= fEnd) {
          return { mark: 'fertile' };
        }
      }
    }
  }

  return { mark: null };
}

function loadCalendarData(
  db: ReturnType<typeof useDatabase>,
  year: number,
  month: number,
  today: string,
): CalendarData {
  const cycles = getCycles(db, 24);
  const completed = cycles.filter((c) => c.endDate !== null);
  const cycleLengths = completed
    .map((c) => c.lengthDays)
    .filter((l): l is number => l !== null);
  const periodLengths = completed
    .map((c) => c.periodLength)
    .filter((l): l is number => l !== null);

  const avgCycleLength =
    calculateAverageCycleLength(cycleLengths) ?? 28;
  const avgPeriodLength =
    calculateAveragePeriodLength(periodLengths) ?? 5;

  const lastCycle = cycles[0] ?? null;

  // Build leading days (prev month) to fill the grid (Mon-first weeks)
  const firstOfMonth = startOfMonth(year, month);
  const jsWeekday = firstOfMonth.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = (jsWeekday + 6) % 7; // 0 if Monday

  const cells: DayCell[] = [];

  const prevMonthDays = daysInMonth(
    month === 0 ? year - 1 : year,
    month === 0 ? 11 : month - 1,
  );

  for (let i = mondayOffset; i > 0; i--) {
    const dNum = prevMonthDays - i + 1;
    const iso = isoDate(
      month === 0 ? year - 1 : year,
      month === 0 ? 11 : month - 1,
      dNum,
    );
    const info = classifyDate(
      iso,
      cycles,
      avgCycleLength,
      avgPeriodLength,
      lastCycle,
      cycleLengths,
      periodLengths,
      today,
    );
    const logged = getCycleDayByDate(db, iso);
    cells.push({
      date: iso,
      day: dNum,
      inMonth: false,
      isToday: iso === today,
      mark: info.mark,
      hasLog: logged !== null,
      logged,
    });
  }

  const totalDays = daysInMonth(year, month);
  for (let d = 1; d <= totalDays; d++) {
    const iso = isoDate(year, month, d);
    const info = classifyDate(
      iso,
      cycles,
      avgCycleLength,
      avgPeriodLength,
      lastCycle,
      cycleLengths,
      periodLengths,
      today,
    );
    const logged = getCycleDayByDate(db, iso);
    cells.push({
      date: iso,
      day: d,
      inMonth: true,
      isToday: iso === today,
      mark: info.mark,
      hasLog: logged !== null,
      logged,
    });
  }

  // Trailing days to fill a 6-row grid (42 cells)
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    const nextIso = addDays(last.date, 1);
    const d = parseIso(nextIso);
    const info = classifyDate(
      nextIso,
      cycles,
      avgCycleLength,
      avgPeriodLength,
      lastCycle,
      cycleLengths,
      periodLengths,
      today,
    );
    const logged = getCycleDayByDate(db, nextIso);
    cells.push({
      date: nextIso,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month && d.getUTCFullYear() === year,
      isToday: nextIso === today,
      mark: info.mark,
      hasLog: logged !== null,
      logged,
    });
  }

  return { cells, cycleCount: cycles.length };
}

function phaseFromMark(mark: DayMark): CyclePhase | null {
  if (mark === 'menstrual') return 'menstrual';
  if (mark === 'fertile' || mark === 'ovulation') return 'ovulation';
  return null;
}

export default function CycleCalendarScreen() {
  const db = useDatabase();
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth());
  const [selected, setSelected] = useState<string | null>(today);

  const result = useMemo(() => {
    try {
      return { ok: true as const, data: loadCalendarData(db, year, month, today) };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : 'Failed to load calendar.',
      };
    }
  }, [db, year, month, today]);

  const goPrev = useCallback(() => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const goNext = useCallback(() => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const handleLog = useCallback((date?: string) => {
    if (date) {
      router.push({ pathname: '/(cycle)/log-day', params: { date } });
      return;
    }
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

  const { cells, cycleCount } = result.data;
  const selectedCell = cells.find((c) => c.date === selected) ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.monthRow}>
          <RNText style={styles.monthTitle}>
            {MONTHS[month]} {year}
          </RNText>
          <View style={styles.navRow}>
            <Pressable
              onPress={goPrev}
              style={({ pressed }) => [
                styles.navButton,
                pressed && { opacity: 0.6 },
              ]}
            >
              <ChevronLeft size={20} color="#E4E1E9" strokeWidth={2.2} />
            </Pressable>
            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.navButton,
                pressed && { opacity: 0.6 },
              ]}
            >
              <ChevronRight size={20} color="#E4E1E9" strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        {cycleCount === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <RNText style={styles.emptyTitle}>
              Start tracking to see your calendar
            </RNText>
            <RNText style={styles.emptyBody}>
              Log your first period to see phase-colored days, fertile windows,
              and ovulation markers across every month.
            </RNText>
          </GlassCard>
        ) : (
          <GlassCard style={styles.gridCard}>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((w) => (
                <RNText key={w} style={styles.weekdayLabel}>
                  {w}
                </RNText>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((cell) => (
                <CalendarDayCell
                  key={cell.date}
                  cell={cell}
                  selected={cell.date === selected}
                  onPress={() => setSelected(cell.date)}
                />
              ))}
            </View>
          </GlassCard>
        )}

        {cycleCount > 0 && (
          <View style={styles.legendRow}>
            <LegendChip color={CYCLE_PHASE_COLORS.menstrual} label="Menstrual" />
            <LegendChip color={CYCLE_PHASE_COLORS.ovulation} label="Fertile" />
            <LegendChip
              color={CYCLE_ACCENT}
              label="Ovulation"
              ring
            />
            <LegendChip
              color={CYCLE_PHASE_COLORS.menstrual}
              label="Forecast"
              dashed
            />
          </View>
        )}

        {cycleCount > 0 && selectedCell && (
          <GlassCard variant="high">
            <RNText style={styles.cardLabel}>
              {formatLongDate(selectedCell.date)}
            </RNText>
            {selectedCell.logged ? (
              <View style={{ gap: 4 }}>
                <RNText style={styles.cardTitle}>
                  {selectedCell.logged.phase
                    ? capitalize(selectedCell.logged.phase) + ' phase logged'
                    : 'Day logged'}
                </RNText>
                {selectedCell.logged.flowLevel ? (
                  <RNText style={styles.cardSub}>
                    Flow: {selectedCell.logged.flowLevel}
                  </RNText>
                ) : null}
                {decodeCycleLogNotes(selectedCell.logged.notes).journal ? (
                  <RNText style={styles.cardSub}>
                    {decodeCycleLogNotes(selectedCell.logged.notes).journal}
                  </RNText>
                ) : null}
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <RNText style={styles.cardTitle}>No data for this day</RNText>
                <RNText style={styles.cardSub}>
                  {phaseFromMark(selectedCell.mark)
                    ? `Predicted ${phaseFromMark(selectedCell.mark)} phase.`
                    : 'Log today or pick a different day.'}
                </RNText>
                <Pressable
                  onPress={() => handleLog(selectedCell.date)}
                  style={({ pressed }) => [
                    styles.logLink,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <RNText style={styles.logLinkText}>Log entry</RNText>
                </Pressable>
              </View>
            )}
          </GlassCard>
        )}
      </ScrollView>

      <LogTodayFAB onPress={() => handleLog()} />
    </View>
  );
}

function CalendarDayCell({
  cell,
  selected,
  onPress,
}: {
  cell: DayCell;
  selected: boolean;
  onPress: () => void;
}) {
  const color =
    cell.mark === 'menstrual'
      ? CYCLE_PHASE_COLORS.menstrual
      : cell.mark === 'fertile' || cell.mark === 'ovulation'
        ? CYCLE_PHASE_COLORS.ovulation
        : cell.mark === 'predicted'
          ? CYCLE_PHASE_COLORS.menstrual
          : null;

  const textColor = cell.inMonth
    ? '#E4E1E9'
    : 'rgba(228, 225, 233, 0.2)';

  const filled = cell.mark === 'menstrual';
  const outlined = cell.mark === 'fertile' || cell.mark === 'ovulation';
  const predicted = cell.mark === 'predicted';
  const isOvulation = cell.mark === 'ovulation';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cellWrap,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View
        style={[
          styles.cellInner,
          filled && color ? { backgroundColor: color } : null,
          outlined && color
            ? {
                backgroundColor: `${color}22`,
                borderWidth: 0,
              }
            : null,
          predicted && color
            ? {
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: `${color}66`,
              }
            : null,
          isOvulation
            ? {
                shadowColor: CYCLE_ACCENT,
                shadowOpacity: 0.6,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
                elevation: 4,
              }
            : null,
          cell.isToday
            ? {
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }
            : null,
          selected && !cell.isToday
            ? {
                borderWidth: 1,
                borderColor: CYCLE_ACCENT,
              }
            : null,
        ]}
      >
        <RNText
          style={[
            styles.cellText,
            {
              color: filled
                ? '#131318'
                : outlined && color
                  ? color
                  : textColor,
            },
          ]}
        >
          {cell.day}
        </RNText>
      </View>
      {cell.hasLog ? (
        <View style={styles.dotIndicator}>
          <View
            style={[
              styles.logDot,
              {
                backgroundColor:
                  color ?? 'rgba(228, 225, 233, 0.4)',
              },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function LegendChip({
  color,
  label,
  ring,
  dashed,
}: {
  color: string;
  label: string;
  ring?: boolean;
  dashed?: boolean;
}) {
  return (
    <View style={styles.legendChip}>
      <View
        style={[
          styles.legendSwatch,
          dashed
            ? {
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: `${color}99`,
                backgroundColor: 'transparent',
              }
            : { backgroundColor: color },
          ring
            ? {
                shadowColor: color,
                shadowOpacity: 0.9,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
              }
            : null,
        ]}
      />
      <RNText style={styles.legendLabel}>{label}</RNText>
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatLongDate(iso: string): string {
  const d = parseIso(iso);
  const months = [
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
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// Satisfy the linter: daysBetween is referenced in dev for sanity but unused.
void daysBetween;

const CELL_SIZE = 40;

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
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    ...CYCLE_TYPOGRAPHY.displayMd,
    color: '#E4E1E9',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CYCLE_SURFACES.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCard: {
    padding: 20,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(214, 195, 181, 0.5)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  cellWrap: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  cellInner: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 14,
  },
  dotIndicator: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 4,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: 'rgba(214, 195, 181, 0.85)',
    textTransform: 'uppercase',
  },
  cardLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.7)',
    marginBottom: 6,
  },
  cardTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  cardSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.85)',
  },
  logLink: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: `${CYCLE_ACCENT}22`,
    marginTop: 4,
  },
  logLinkText: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 12,
    color: CYCLE_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    gap: 10,
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
