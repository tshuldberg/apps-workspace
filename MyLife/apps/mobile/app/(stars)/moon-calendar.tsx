import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  GlassCard,
  MaterialSymbol,
  MoonPhaseGlyph,
  SectionHeader,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_MOON_PHASES,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  computeMoonCalendarMonth,
  getEventsForRange,
  getMoonCalendarMonth as getCachedMoonCalendarMonth,
  getNextFullMoon,
  getNextNewMoon,
  withAlpha,
  type MoonCalendarDay,
  type MoonPhase,
} from '@mylife/stars';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const MONTH_NAMES = [
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
] as const;

type DayMarker = 'eclipse' | 'supermoon' | 'transition' | 'key';

interface UpcomingMoment {
  id: string;
  title: string;
  date: string;
  accent: string;
  description: string;
  ritual: string;
  kind: 'new_moon' | 'full_moon' | 'eclipse';
}

const MARKER_COLORS: Record<DayMarker, string> = {
  eclipse: ST_ACCENT_LIGHT,
  supermoon: '#FFB877',
  transition: '#8BCFF0',
  key: '#D6C3B5',
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function getMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatLongDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${MONTH_NAMES[Number.parseInt(month, 10) - 1]} ${Number.parseInt(day, 10)}, ${year}`;
}

function formatCompactDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${MONTH_NAMES[Number.parseInt(month, 10) - 1].slice(0, 3)} ${Number.parseInt(day, 10)}`;
}

function getMonthStartAndEnd(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  return { start, end };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
  };
}

function getFirstWeekdayOffset(year: number, month: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (weekday + 6) % 7;
}

function buildCalendarRows(
  year: number,
  month: number,
  days: MoonCalendarDay[],
): Array<Array<MoonCalendarDay | null>> {
  const cells: Array<MoonCalendarDay | null> = [];
  const offset = getFirstWeekdayOffset(year, month);

  for (let index = 0; index < offset; index += 1) {
    cells.push(null);
  }

  cells.push(...days);

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const rows: Array<Array<MoonCalendarDay | null>> = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}

function getDayMarkers(
  day: MoonCalendarDay,
  nextDay: MoonCalendarDay | undefined,
  eclipseDates: Set<string>,
): DayMarker[] {
  const markers: DayMarker[] = [];

  if (day.isKeyPhase) {
    markers.push('key');
  }

  if (eclipseDates.has(day.date)) {
    markers.push('eclipse');
  }

  if (day.moonPhase === 'full_moon' && day.illuminationPct >= 99) {
    markers.push('supermoon');
  }

  if (nextDay && nextDay.moonSign !== day.moonSign) {
    markers.push('transition');
  }

  return markers;
}

function getRitualPrompt(event: UpcomingMoment): string {
  if (event.kind === 'eclipse') {
    return 'Where do you need more surrender while the sky rearranges the story?';
  }

  if (event.kind === 'new_moon') {
    return 'What intention wants a first sentence, not a perfect plan?';
  }

  return 'What are you ready to release now that the truth is fully lit?';
}

export default function MoonCalendarScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [refreshKey]);
  const [currentYear, setCurrentYear] = useState(Number.parseInt(today.slice(0, 4), 10));
  const [currentMonth, setCurrentMonth] = useState(Number.parseInt(today.slice(5, 7), 10));
  const [selectedDate, setSelectedDate] = useState(today);
  const [detailVisible, setDetailVisible] = useState(false);

  const currentMonthDays = useMemo(() => {
    try {
      const cached = getCachedMoonCalendarMonth(db, currentYear, currentMonth);
      if (cached.length > 0) {
        return cached;
      }
    } catch {
      // Ignore cache failures and fall back to the deterministic engine.
    }

    return computeMoonCalendarMonth(currentYear, currentMonth);
  }, [currentMonth, currentYear, db, refreshKey]);

  useEffect(() => {
    if (!currentMonthDays.some((day) => day.date === selectedDate)) {
      setSelectedDate(currentMonthDays[0]?.date ?? today);
    }
  }, [currentMonthDays, selectedDate, today]);

  const todaySnapshot = useMemo(() => {
    const todayYear = Number.parseInt(today.slice(0, 4), 10);
    const todayMonth = Number.parseInt(today.slice(5, 7), 10);
    const currentMonthSnapshot = computeMoonCalendarMonth(todayYear, todayMonth);
    return currentMonthSnapshot.find((day) => day.date === today) ?? currentMonthSnapshot[0] ?? null;
  }, [today]);

  const selectedDay = useMemo(
    () => currentMonthDays.find((day) => day.date === selectedDate) ?? currentMonthDays[0] ?? null,
    [currentMonthDays, selectedDate],
  );

  const currentRange = useMemo(
    () => getMonthStartAndEnd(currentYear, currentMonth),
    [currentMonth, currentYear],
  );

  const monthEvents = useMemo(
    () => getEventsForRange(currentRange.start, currentRange.end).filter((event) => event.eventType === 'eclipse'),
    [currentRange.end, currentRange.start],
  );

  const eclipseDates = useMemo(
    () => new Set(monthEvents.map((event) => event.eventDate)),
    [monthEvents],
  );

  const markerMap = useMemo(() => {
    const map = new Map<string, DayMarker[]>();

    currentMonthDays.forEach((day, index) => {
      map.set(day.date, getDayMarkers(day, currentMonthDays[index + 1], eclipseDates));
    });

    return map;
  }, [currentMonthDays, eclipseDates]);

  const rows = useMemo(
    () => buildCalendarRows(currentYear, currentMonth, currentMonthDays),
    [currentMonth, currentMonthDays, currentYear],
  );

  const nextNewMoon = useMemo(() => getNextNewMoon(today), [today]);
  const nextFullMoon = useMemo(() => getNextFullMoon(today), [today]);
  const upcomingEclipses = useMemo(
    () => getEventsForRange(today, addDays(today, 120)).filter((event) => event.eventType === 'eclipse').slice(0, 2),
    [today],
  );

  const upcomingMoments = useMemo(() => {
    const moments: UpcomingMoment[] = [];

    if (nextNewMoon) {
      moments.push({
        id: `new-${nextNewMoon.date}`,
        title: `New Moon in ${capitalize(nextNewMoon.moonSign)}`,
        date: nextNewMoon.date,
        accent: ST_MOON_PHASES.new_moon,
        description: 'Fresh starts, quiet intentions, and a clean emotional slate.',
        ritual: 'Write one intention that feels alive, then one habit that makes space for it.',
        kind: 'new_moon',
      });
    }

    if (nextFullMoon) {
      moments.push({
        id: `full-${nextFullMoon.date}`,
        title: `Full Moon in ${capitalize(nextFullMoon.moonSign)}`,
        date: nextFullMoon.date,
        accent: ST_MOON_PHASES.full_moon,
        description: 'Revelation, culmination, and an invitation to release with clarity.',
        ritual: 'List what is complete, what is heavy, and what you want to thank before letting go.',
        kind: 'full_moon',
      });
    }

    upcomingEclipses.forEach((event) => {
      moments.push({
        id: event.id,
        title: event.title,
        date: event.eventDate,
        accent: ST_ACCENT_LIGHT,
        description: event.descriptionBrief,
        ritual: 'Reduce noise, observe the change, and capture what feels uncertain before reacting.',
        kind: 'eclipse',
      });
    });

    return moments.sort((left, right) => left.date.localeCompare(right.date)).slice(0, 4);
  }, [nextFullMoon, nextNewMoon, upcomingEclipses]);

  const featuredRitual = upcomingMoments[0] ?? null;

  const changeMonth = useCallback((delta: number) => {
    const next = shiftMonth(currentYear, currentMonth, delta);
    setCurrentYear(next.year);
    setCurrentMonth(next.month);
  }, [currentMonth, currentYear]);

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -36) {
            changeMonth(1);
          } else if (gesture.dx >= 36) {
            changeMonth(-1);
          }
        },
      }),
    [changeMonth],
  );

  const selectedMarkers = selectedDay ? markerMap.get(selectedDay.date) ?? [] : [];
  const selectedEvents = selectedDay
    ? monthEvents.filter((event) => event.eventDate === selectedDay.date)
    : [];

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={ST_ACCENT_LIGHT} />}
      >
        <GlassCard variant="high" style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroContent}>
            <SectionHeader
              eyebrow="Lunar Cycle"
              title={todaySnapshot ? `${capitalize(todaySnapshot.moonPhase.replace('_', ' '))} energy` : 'Lunar Cycle'}
              action={
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{getMonthLabel(currentYear, currentMonth)}</Text>
                </View>
              }
            />

            {todaySnapshot ? (
              <View style={styles.heroRow}>
                <MoonPhaseGlyph
                  phase={todaySnapshot.moonPhase}
                  illumination={todaySnapshot.illuminationPct}
                  size={88}
                />
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>
                    Moon in {capitalize(todaySnapshot.moonSign)}
                  </Text>
                  <Text style={styles.heroMeta}>
                    {todaySnapshot.illuminationPct}% illuminated today
                  </Text>
                  <Text style={styles.heroBody}>
                    {todaySnapshot.phaseInterpretation}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </GlassCard>

        <GlassCard style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <Pressable onPress={() => changeMonth(-1)} style={styles.navButton}>
              <MaterialSymbol name="chevron_left" size={20} color={ST_TEXT} />
            </Pressable>
            <View style={styles.monthTitleWrap}>
              <Text style={styles.monthEyebrow}>Phase 4</Text>
              <Text style={styles.monthTitle}>{getMonthLabel(currentYear, currentMonth)}</Text>
            </View>
            <Pressable onPress={() => changeMonth(1)} style={styles.navButton}>
              <MaterialSymbol name="chevron_right" size={20} color={ST_TEXT} />
            </Pressable>
          </View>

          <View {...swipeResponder.panHandlers}>
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label) => (
                <View key={label} style={styles.weekdayCell}>
                  <Text style={styles.weekdayLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {rows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.gridRow}>
                  {row.map((day, columnIndex) => {
                    if (!day) {
                      return <View key={`empty-${rowIndex}-${columnIndex}`} style={styles.dayCellSpacer} />;
                    }

                    const isToday = day.date === today;
                    const isSelected = day.date === selectedDate;
                    const markers = markerMap.get(day.date) ?? [];

                    return (
                      <Pressable
                        key={day.date}
                        onPress={() => {
                          setSelectedDate(day.date);
                          setDetailVisible(true);
                        }}
                        style={[
                          styles.dayCell,
                          markers.includes('transition') ? styles.dayCellTransition : undefined,
                          isToday ? styles.dayCellToday : undefined,
                          isSelected ? styles.dayCellSelected : undefined,
                        ]}
                      >
                        <Text style={[styles.dayNumber, isSelected ? styles.dayNumberSelected : undefined]}>
                          {Number.parseInt(day.date.slice(8, 10), 10)}
                        </Text>
                        <MoonPhaseGlyph phase={day.moonPhase} illumination={day.illuminationPct} size={24} />
                        <View style={styles.markerRow}>
                          {markers.slice(0, 3).map((marker) => (
                            <View
                              key={`${day.date}-${marker}`}
                              style={[styles.markerDot, { backgroundColor: MARKER_COLORS[marker] }]}
                            />
                          ))}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.legendCard}>
          <SectionHeader eyebrow="Legend" title="Phase language" />
          <View style={styles.legendGrid}>
            {([
              ['new_moon', 'New Moon'],
              ['first_quarter', 'First Quarter'],
              ['full_moon', 'Full Moon'],
              ['last_quarter', 'Last Quarter'],
            ] as Array<[MoonPhase, string]>).map(([phase, label]) => (
              <View key={phase} style={styles.legendItem}>
                <MoonPhaseGlyph phase={phase} size={28} />
                <Text style={styles.legendLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendMarkers}>
            {([
              ['eclipse', 'Eclipse window'],
              ['supermoon', 'Supermoon glow'],
              ['transition', 'Moon sign shift'],
            ] as Array<[DayMarker, string]>).map(([marker, label]) => (
              <View key={marker} style={styles.legendMarkerRow}>
                <View style={[styles.markerDot, styles.markerDotLarge, { backgroundColor: MARKER_COLORS[marker] }]} />
                <Text style={styles.legendMarkerText}>{label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={styles.upcomingCard}>
          <SectionHeader eyebrow="Upcoming Events" title="Next lunar moments" />
          <View style={styles.upcomingList}>
            {upcomingMoments.map((moment) => (
              <View key={moment.id} style={styles.upcomingRow}>
                <View style={[styles.upcomingAccent, { backgroundColor: withAlpha(moment.accent, 0.2) }]}>
                  <View style={[styles.markerDot, { backgroundColor: moment.accent }]} />
                </View>
                <View style={styles.upcomingCopy}>
                  <Text style={styles.upcomingTitle}>{moment.title}</Text>
                  <Text style={styles.upcomingMeta}>{formatCompactDate(moment.date)}</Text>
                  <Text style={styles.upcomingBody}>{moment.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        {featuredRitual ? (
          <GlassCard variant="high" style={styles.ritualCard}>
            <SectionHeader eyebrow="Ritual Prompt" title={featuredRitual.title} />
            <Text style={styles.ritualQuestion}>{getRitualPrompt(featuredRitual)}</Text>
            <Text style={styles.ritualBody}>{featuredRitual.ritual}</Text>
            <Pressable
              style={styles.ritualButton}
              onPress={() => router.push('/(stars)/journal-compose')}
            >
              <Text style={styles.ritualButtonText}>Open Journal Composer</Text>
            </Pressable>
          </GlassCard>
        ) : null}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={detailVisible && selectedDay != null}
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalScrim}>
          <GlassCard variant="high" style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalEyebrow}>Day Detail</Text>
                <Text style={styles.modalTitle}>
                  {selectedDay ? formatLongDate(selectedDay.date) : ''}
                </Text>
              </View>
              <Pressable onPress={() => setDetailVisible(false)} style={styles.modalClose}>
                <MaterialSymbol name="close" size={18} color={ST_TEXT} />
              </Pressable>
            </View>

            {selectedDay ? (
              <>
                <View style={styles.modalPhaseRow}>
                  <MoonPhaseGlyph
                    phase={selectedDay.moonPhase}
                    illumination={selectedDay.illuminationPct}
                    size={72}
                  />
                  <View style={styles.modalPhaseCopy}>
                    <Text style={styles.modalPhaseTitle}>
                      {capitalize(selectedDay.moonPhase.replace('_', ' '))}
                    </Text>
                    <Text style={styles.modalPhaseMeta}>
                      Moon in {capitalize(selectedDay.moonSign)}{'\n'}
                      {selectedDay.illuminationPct}% illuminated
                    </Text>
                  </View>
                </View>

                {selectedMarkers.length > 0 ? (
                  <View style={styles.modalTagRow}>
                    {selectedMarkers.map((marker) => (
                      <View
                        key={`marker-${marker}`}
                        style={[styles.modalTag, { backgroundColor: withAlpha(MARKER_COLORS[marker], 0.16) }]}
                      >
                        <Text style={[styles.modalTagText, { color: MARKER_COLORS[marker] }]}>
                          {marker === 'key'
                            ? 'Key phase'
                            : marker === 'transition'
                              ? 'Sign shift'
                              : capitalize(marker)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.modalSectionLabel}>Phase reading</Text>
                <Text style={styles.modalBody}>{selectedDay.phaseInterpretation}</Text>

                <Text style={styles.modalSectionLabel}>Moon sign reading</Text>
                <Text style={styles.modalBody}>{selectedDay.signInterpretation}</Text>

                {selectedEvents.length > 0 ? (
                  <>
                    <Text style={styles.modalSectionLabel}>Special events</Text>
                    {selectedEvents.map((event) => (
                      <View key={event.id} style={styles.eventTag}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventBody}>{event.descriptionBrief}</Text>
                      </View>
                    ))}
                  </>
                ) : null}

                <Pressable
                  style={styles.modalJournalButton}
                  onPress={() => {
                    setDetailVisible(false);
                    router.push('/(stars)/journal-compose');
                  }}
                >
                  <Text style={styles.modalJournalText}>Reflect in journal</Text>
                </Pressable>
              </>
            ) : null}
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
  heroCard: {
    overflow: 'hidden',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
  },
  heroContent: {
    gap: 18,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT_LIGHT, 0.14),
  },
  heroBadgeText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    color: ST_TEXT,
  },
  heroMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_ACCENT_LIGHT,
  },
  heroBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  calendarCard: {
    gap: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monthTitleWrap: {
    alignItems: 'center',
    gap: 4,
  },
  monthEyebrow: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: ST_ACCENT_LIGHT,
  },
  monthTitle: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 28,
    color: ST_TEXT,
    letterSpacing: -0.6,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.72),
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  grid: {
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCellSpacer: {
    flex: 1,
  },
  dayCell: {
    flex: 1,
    minHeight: 82,
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: withAlpha(ST_SURFACES.low, 0.82),
  },
  dayCellTransition: {
    backgroundColor: withAlpha('#8BCFF0', 0.08),
  },
  dayCellToday: {
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
    shadowColor: ST_ACCENT,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  dayCellSelected: {
    backgroundColor: withAlpha(ST_ACCENT_LIGHT, 0.2),
    transform: [{ scale: 1.01 }],
  },
  dayNumber: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
  dayNumberSelected: {
    color: ST_TEXT,
  },
  markerRow: {
    minHeight: 8,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  markerDotLarge: {
    width: 8,
    height: 8,
  },
  legendCard: {
    gap: 16,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    width: '47%',
    minWidth: 132,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(ST_SURFACES.high, 0.55),
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  legendLabel: {
    flex: 1,
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  legendMarkers: {
    gap: 12,
  },
  legendMarkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendMarkerText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  upcomingCard: {
    gap: 16,
  },
  upcomingList: {
    gap: 12,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  upcomingAccent: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  upcomingCopy: {
    flex: 1,
    gap: 4,
  },
  upcomingTitle: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 15,
    color: ST_TEXT,
  },
  upcomingMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
    letterSpacing: 0.4,
  },
  upcomingBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  ritualCard: {
    gap: 14,
  },
  ritualQuestion: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    lineHeight: 28,
    color: ST_TEXT,
  },
  ritualBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  ritualButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: ST_ACCENT,
  },
  ritualButtonText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 13,
    color: '#140C27',
    letterSpacing: 0.3,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: withAlpha(ST_SURFACES.lowest, 0.82),
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  modalEyebrow: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: ST_ACCENT_LIGHT,
  },
  modalTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: ST_TEXT,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.72),
  },
  modalPhaseRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  modalPhaseCopy: {
    flex: 1,
    gap: 6,
  },
  modalPhaseTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: ST_TEXT,
  },
  modalPhaseMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: ST_TEXT_SECONDARY,
  },
  modalTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTag: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  modalTagText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  modalSectionLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: ST_TEXT_TERTIARY,
  },
  modalBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  eventTag: {
    gap: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: withAlpha(ST_ACCENT_LIGHT, 0.08),
  },
  eventTitle: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 14,
    color: ST_TEXT,
  },
  eventBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  modalJournalButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.18),
  },
  modalJournalText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
    letterSpacing: 0.3,
  },
});
