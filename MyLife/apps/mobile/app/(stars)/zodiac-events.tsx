import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { ZodiacSign as ZodiacSignGlyph } from '@mylife/stars/ui';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  getBirthProfiles,
  getEventPersonalImpact,
  getEventsForRange,
  getZodiacEvents as getCachedZodiacEvents,
  withAlpha,
  type EventType,
  type ZodiacEvent,
} from '@mylife/stars';

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

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type PeriodKey = 'this-month' | 'next-3-months' | 'this-year' | 'next-year' | 'custom';
type ViewMode = 'timeline' | 'calendar';
type EventFilterKey = 'all' | 'new_moon' | 'full_moon' | 'eclipse' | 'sun_ingress' | 'direct_station' | 'retrograde_station';

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'this-month', label: 'This Month' },
  { key: 'next-3-months', label: 'Next 3 Months' },
  { key: 'this-year', label: 'This Year' },
  { key: 'next-year', label: 'Next Year' },
  { key: 'custom', label: 'Custom 45d' },
];

const FILTER_OPTIONS: Array<{ key: EventFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new_moon', label: 'New Moons' },
  { key: 'full_moon', label: 'Full Moons' },
  { key: 'eclipse', label: 'Eclipses' },
  { key: 'sun_ingress', label: 'Ingresses' },
  { key: 'direct_station', label: 'Stations' },
  { key: 'retrograde_station', label: 'Retrogrades' },
];

const TYPE_LABELS: Record<EventType, string> = {
  sun_ingress: 'Ingress',
  planet_ingress: 'Planet',
  new_moon: 'New Moon',
  full_moon: 'Full Moon',
  eclipse: 'Eclipse',
  retrograde_station: 'Retrograde',
  direct_station: 'Station',
};

const TYPE_ICONS: Record<EventType, { icon: string; accent: string }> = {
  sun_ingress: { icon: 'flare', accent: '#FFB877' },
  planet_ingress: { icon: 'auto_awesome', accent: ST_ACCENT_LIGHT },
  new_moon: { icon: 'dark_mode', accent: '#D6C3B5' },
  full_moon: { icon: 'circle', accent: '#FFB877' },
  eclipse: { icon: 'auto_awesome', accent: ST_ACCENT_LIGHT },
  retrograde_station: { icon: 'schedule', accent: '#FF8A80' },
  direct_station: { icon: 'north', accent: '#8BCFF0' },
};

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function getPeriodRange(today: string, period: PeriodKey): { start: string; end: string; label: string } {
  const year = Number.parseInt(today.slice(0, 4), 10);
  const month = Number.parseInt(today.slice(5, 7), 10);

  switch (period) {
    case 'this-month': {
      const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
      return {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end,
        label: `${MONTH_NAMES[month - 1]} focus`,
      };
    }
    case 'next-3-months': {
      const endDate = new Date(Date.UTC(year, month + 2, 0));
      return {
        start: today,
        end: endDate.toISOString().slice(0, 10),
        label: 'Next three months',
      };
    }
    case 'this-year':
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        label: `${year} overview`,
      };
    case 'next-year':
      return {
        start: `${year + 1}-01-01`,
        end: `${year + 1}-12-31`,
        label: `${year + 1} overview`,
      };
    case 'custom':
    default:
      return {
        start: today,
        end: addDays(today, 45),
        label: 'Custom 45 day sweep',
      };
  }
}

function matchesFilter(event: ZodiacEvent, filter: EventFilterKey): boolean {
  if (filter === 'all') {
    return true;
  }

  return event.eventType === filter;
}

function formatEventDate(date: string): { day: string; month: string; full: string } {
  const [year, month, day] = date.split('-');
  return {
    day: String(Number.parseInt(day, 10)),
    month: MONTH_NAMES[Number.parseInt(month, 10) - 1].slice(0, 3).toUpperCase(),
    full: `${MONTH_NAMES[Number.parseInt(month, 10) - 1]} ${Number.parseInt(day, 10)}, ${year}`,
  };
}

function groupEventsByMonth(events: ZodiacEvent[]): Array<{ key: string; label: string; events: ZodiacEvent[] }> {
  const groups = new Map<string, { key: string; label: string; events: ZodiacEvent[] }>();

  events.forEach((event) => {
    const monthKey = event.eventDate.slice(0, 7);
    if (!groups.has(monthKey)) {
      const [, month] = monthKey.split('-');
      groups.set(monthKey, {
        key: monthKey,
        label: `${MONTH_NAMES[Number.parseInt(month, 10) - 1]} ${monthKey.slice(0, 4)}`,
        events: [],
      });
    }
    groups.get(monthKey)!.events.push(event);
  });

  return Array.from(groups.values());
}

function getFirstWeekdayOffset(year: number, month: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (weekday + 6) % 7;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
  };
}

function buildCalendarRows(
  year: number,
  month: number,
  eventsByDate: Map<string, ZodiacEvent[]>,
): Array<Array<{ date: string; dayNumber: number; events: ZodiacEvent[] } | null>> {
  const totalDays = new Date(year, month, 0).getDate();
  const offset = getFirstWeekdayOffset(year, month);
  const cells: Array<{ date: string; dayNumber: number; events: ZodiacEvent[] } | null> = [];

  for (let index = 0; index < offset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      date,
      dayNumber: day,
      events: eventsByDate.get(date) ?? [],
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const rows: Array<Array<{ date: string; dayNumber: number; events: ZodiacEvent[] } | null>> = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}

function getJournalPrompt(event: ZodiacEvent): string {
  switch (event.eventType) {
    case 'new_moon':
      return 'What needs a first step while this cycle is quiet and open?';
    case 'full_moon':
      return 'What truth is fully visible now, and what does it ask you to release?';
    case 'eclipse':
      return 'What is changing faster than your plans, and where can you surrender control?';
    case 'retrograde_station':
      return 'What deserves revision before you move ahead again?';
    case 'direct_station':
      return 'What are you ready to reintroduce now that momentum returns?';
    case 'sun_ingress':
    default:
      return 'What season are you entering, and what rhythm does it ask from you?';
  }
}

export default function ZodiacEventsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [refreshKey]);
  const [period, setPeriod] = useState<PeriodKey>('next-3-months');
  const [filter, setFilter] = useState<EventFilterKey>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedEvent, setSelectedEvent] = useState<ZodiacEvent | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<EventFilterKey, boolean>>({
    all: true,
    new_moon: true,
    full_moon: true,
    eclipse: true,
    sun_ingress: false,
    direct_station: false,
    retrograde_station: true,
  });

  const range = useMemo(() => getPeriodRange(today, period), [period, today]);

  const [calendarCursor, setCalendarCursor] = useState({
    year: Number.parseInt(range.start.slice(0, 4), 10),
    month: Number.parseInt(range.start.slice(5, 7), 10),
  });

  useEffect(() => {
    setCalendarCursor({
      year: Number.parseInt(range.start.slice(0, 4), 10),
      month: Number.parseInt(range.start.slice(5, 7), 10),
    });
  }, [range.start]);

  const primaryProfile = useMemo(() => {
    try {
      return getBirthProfiles(db)[0] ?? null;
    } catch {
      return null;
    }
  }, [db, refreshKey]);

  const baseEvents = useMemo(() => {
    try {
      const cached = getCachedZodiacEvents(db, range.start, range.end);
      if (cached.length > 0) {
        return cached;
      }
    } catch {
      // Fall through to the engine helper if cache access is unavailable.
    }

    return getEventsForRange(range.start, range.end);
  }, [db, range.end, range.start, refreshKey]);

  const filteredEvents = useMemo(
    () => baseEvents.filter((event) => matchesFilter(event, filter)),
    [baseEvents, filter],
  );

  const heroEvent = filteredEvents[0] ?? baseEvents[0] ?? null;
  const groupedEvents = useMemo(() => groupEventsByMonth(filteredEvents), [filteredEvents]);

  const calendarEvents = useMemo(() => {
    const start = `${calendarCursor.year}-${String(calendarCursor.month).padStart(2, '0')}-01`;
    const end = `${calendarCursor.year}-${String(calendarCursor.month).padStart(2, '0')}-${String(new Date(calendarCursor.year, calendarCursor.month, 0).getDate()).padStart(2, '0')}`;

    return filteredEvents.filter((event) => event.eventDate >= start && event.eventDate <= end);
  }, [calendarCursor.month, calendarCursor.year, filteredEvents]);

  const calendarEventsByDate = useMemo(() => {
    const map = new Map<string, ZodiacEvent[]>();

    calendarEvents.forEach((event) => {
      const bucket = map.get(event.eventDate) ?? [];
      bucket.push(event);
      map.set(event.eventDate, bucket);
    });

    return map;
  }, [calendarEvents]);

  const calendarRows = useMemo(
    () => buildCalendarRows(calendarCursor.year, calendarCursor.month, calendarEventsByDate),
    [calendarCursor.month, calendarCursor.year, calendarEventsByDate],
  );

  const detailImpact = selectedEvent ? getEventPersonalImpact(selectedEvent, primaryProfile) : null;

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
            <SectionHeader eyebrow="Zodiac Events" title="Celestial Calendar" />
            <Text style={styles.heroSubtitle}>{range.label}</Text>
            {heroEvent ? (
              <View style={styles.heroEventRow}>
                <View style={[styles.heroIconShell, { backgroundColor: withAlpha(TYPE_ICONS[heroEvent.eventType].accent, 0.18) }]}>
                  <MaterialSymbol
                    name={TYPE_ICONS[heroEvent.eventType].icon}
                    size={20}
                    color={TYPE_ICONS[heroEvent.eventType].accent}
                    filled={heroEvent.eventType === 'eclipse' || heroEvent.eventType === 'full_moon'}
                  />
                </View>
                <View style={styles.heroEventCopy}>
                  <Text style={styles.heroTitle}>{heroEvent.title}</Text>
                  <Text style={styles.heroBody}>{heroEvent.descriptionBrief}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.heroBody}>No celestial events landed inside this filter window.</Text>
            )}
          </View>
        </GlassCard>

        <GlassCard style={styles.filterCard}>
          <SectionHeader
            eyebrow="Timeframe"
            title="Choose a window"
            action={
              <View style={styles.viewSwitchRow}>
                {(['timeline', 'calendar'] as ViewMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => setViewMode(mode)}
                    style={[styles.viewSwitch, viewMode === mode ? styles.viewSwitchActive : undefined]}
                  >
                    <Text style={[styles.viewSwitchText, viewMode === mode ? styles.viewSwitchTextActive : undefined]}>
                      {mode === 'timeline' ? 'Timeline' : 'Calendar'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            }
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {PERIOD_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setPeriod(option.key)}
                style={[styles.chip, period === option.key ? styles.chipActive : undefined]}
              >
                <Text style={[styles.chipText, period === option.key ? styles.chipTextActive : undefined]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Event type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setFilter(option.key)}
                style={[styles.chip, filter === option.key ? styles.chipActive : undefined]}
              >
                <Text style={[styles.chipText, filter === option.key ? styles.chipTextActive : undefined]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </GlassCard>

        <GlassCard style={styles.notificationsCard}>
          <SectionHeader eyebrow="Alerts" title="Notification toggles" />
          <View style={styles.notificationList}>
            {([
              'new_moon',
              'full_moon',
              'eclipse',
              'retrograde_station',
              'sun_ingress',
            ] as EventFilterKey[]).map((key) => (
              <View key={key} style={styles.notificationRow}>
                <Text style={styles.notificationLabel}>
                  {FILTER_OPTIONS.find((option) => option.key === key)?.label ?? key}
                </Text>
                <Switch
                  value={notificationPrefs[key]}
                  onValueChange={(value) => setNotificationPrefs((current) => ({ ...current, [key]: value }))}
                  trackColor={{ false: withAlpha(ST_SURFACES.highest, 0.86), true: withAlpha(ST_ACCENT, 0.42) }}
                  thumbColor={notificationPrefs[key] ? ST_ACCENT_LIGHT : '#ffffff'}
                />
              </View>
            ))}
          </View>
        </GlassCard>

        {viewMode === 'timeline' ? (
          groupedEvents.length > 0 ? (
            groupedEvents.map((group) => (
              <View key={group.key} style={styles.monthSection}>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthLabel}>{group.label}</Text>
                  <Text style={styles.monthCount}>{group.events.length} events</Text>
                </View>

                {group.events.map((event) => {
                  const eventDate = formatEventDate(event.eventDate);
                  const impact = getEventPersonalImpact(event, primaryProfile);
                  const eventIcon = TYPE_ICONS[event.eventType];

                  return (
                    <Pressable
                      key={event.id}
                      onPress={() => {
                        setSelectedEvent(event);
                        setDetailVisible(true);
                      }}
                    >
                      <GlassCard style={styles.eventCard}>
                        <View style={styles.eventDatePill}>
                          <Text style={styles.eventDateDay}>{eventDate.day}</Text>
                          <Text style={styles.eventDateMonth}>{eventDate.month}</Text>
                        </View>

                        <View style={styles.eventContent}>
                          <View style={styles.eventTopRow}>
                            <View style={styles.eventTitleRow}>
                              <View style={[styles.eventIconShell, { backgroundColor: withAlpha(eventIcon.accent, 0.16) }]}>
                                <MaterialSymbol
                                  name={eventIcon.icon}
                                  size={16}
                                  color={eventIcon.accent}
                                  filled={event.eventType === 'eclipse' || event.eventType === 'full_moon'}
                                />
                              </View>
                              <Text style={styles.eventTitle}>{event.title}</Text>
                            </View>
                            <View style={styles.typeChip}>
                              <Text style={styles.typeChipText}>{TYPE_LABELS[event.eventType]}</Text>
                            </View>
                          </View>

                          <View style={styles.eventMetaRow}>
                            {event.toSign ? <ZodiacSignGlyph sign={event.toSign} size={20} /> : null}
                            <Text style={styles.eventBody}>{event.descriptionBrief}</Text>
                          </View>

                          {impact.level !== 'none' ? (
                            <View style={styles.impactBadge}>
                              <Text style={styles.impactBadgeText}>{impact.badge}</Text>
                            </View>
                          ) : null}
                        </View>
                      </GlassCard>
                    </Pressable>
                  );
                })}
              </View>
            ))
          ) : (
            <GlassCard style={styles.emptyCard}>
              <MaterialSymbol name="auto_awesome" size={28} color={ST_ACCENT_LIGHT} />
              <Text style={styles.emptyTitle}>No events in this filter</Text>
              <Text style={styles.emptyBody}>Try widening the date range or switching the event type filter.</Text>
            </GlassCard>
          )
        ) : (
          <GlassCard style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={() => setCalendarCursor((cursor) => shiftMonth(cursor.year, cursor.month, -1))}
                style={styles.navButton}
              >
                <MaterialSymbol name="chevron_left" size={20} color={ST_TEXT} />
              </Pressable>
              <Text style={styles.calendarTitle}>
                {MONTH_NAMES[calendarCursor.month - 1]} {calendarCursor.year}
              </Text>
              <Pressable
                onPress={() => setCalendarCursor((cursor) => shiftMonth(cursor.year, cursor.month, 1))}
                style={styles.navButton}
              >
                <MaterialSymbol name="chevron_right" size={20} color={ST_TEXT} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label) => (
                <View key={label} style={styles.weekdayCell}>
                  <Text style={styles.weekdayLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarRows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.calendarRow}>
                  {row.map((cell, columnIndex) => {
                    if (!cell) {
                      return <View key={`empty-${rowIndex}-${columnIndex}`} style={styles.calendarSpacer} />;
                    }

                    return (
                      <Pressable
                        key={cell.date}
                        style={[
                          styles.calendarCell,
                          cell.events.length > 0 ? styles.calendarCellActive : undefined,
                        ]}
                        onPress={() => {
                          if (cell.events.length > 0) {
                            setSelectedEvent(cell.events[0]);
                            setDetailVisible(true);
                          }
                        }}
                      >
                        <Text style={styles.calendarCellDay}>{cell.dayNumber}</Text>
                        <View style={styles.calendarMarkers}>
                          {cell.events.slice(0, 3).map((event) => (
                            <View
                              key={event.id}
                              style={[
                                styles.calendarMarkerDot,
                                { backgroundColor: TYPE_ICONS[event.eventType].accent },
                              ]}
                            />
                          ))}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </GlassCard>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={detailVisible && selectedEvent != null}
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalScrim}>
          <GlassCard variant="high" style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalEyebrow}>Event Detail</Text>
                <Text style={styles.modalTitle}>{selectedEvent?.title ?? ''}</Text>
              </View>
              <Pressable onPress={() => setDetailVisible(false)} style={styles.modalClose}>
                <MaterialSymbol name="close" size={18} color={ST_TEXT} />
              </Pressable>
            </View>

            {selectedEvent ? (
              <>
                <View style={styles.modalDateRow}>
                  <View style={[styles.eventIconShell, { backgroundColor: withAlpha(TYPE_ICONS[selectedEvent.eventType].accent, 0.16) }]}>
                    <MaterialSymbol
                      name={TYPE_ICONS[selectedEvent.eventType].icon}
                      size={18}
                      color={TYPE_ICONS[selectedEvent.eventType].accent}
                      filled={selectedEvent.eventType === 'eclipse' || selectedEvent.eventType === 'full_moon'}
                    />
                  </View>
                  <Text style={styles.modalDateText}>{formatEventDate(selectedEvent.eventDate).full}</Text>
                </View>

                {selectedEvent.toSign ? (
                  <View style={styles.modalSignRow}>
                    <ZodiacSignGlyph sign={selectedEvent.toSign} size={24} showName />
                    <View style={styles.typeChip}>
                      <Text style={styles.typeChipText}>{TYPE_LABELS[selectedEvent.eventType]}</Text>
                    </View>
                  </View>
                ) : null}

                <Text style={styles.modalBody}>{selectedEvent.descriptionFull ?? selectedEvent.descriptionBrief}</Text>

                {detailImpact && detailImpact.level !== 'none' ? (
                  <>
                    <Text style={styles.modalSectionLabel}>Personal impact</Text>
                    <View style={styles.detailImpactCard}>
                      <Text style={styles.detailImpactTitle}>{detailImpact.badge}</Text>
                      <Text style={styles.detailImpactBody}>{detailImpact.summary}</Text>
                    </View>
                  </>
                ) : null}

                <Text style={styles.modalSectionLabel}>Journal prompt</Text>
                <Text style={styles.modalBody}>{getJournalPrompt(selectedEvent)}</Text>

                <Pressable
                  style={styles.modalJournalButton}
                  onPress={() => {
                    setDetailVisible(false);
                    router.push('/(stars)/journal-compose');
                  }}
                >
                  <Text style={styles.modalJournalText}>Write in journal</Text>
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
    backgroundColor: withAlpha(ST_ACCENT, 0.1),
  },
  heroContent: {
    gap: 12,
  },
  heroSubtitle: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_ACCENT_LIGHT,
  },
  heroEventRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  heroIconShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEventCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 26,
    lineHeight: 32,
    color: ST_TEXT,
    letterSpacing: -0.6,
  },
  heroBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  filterCard: {
    gap: 14,
  },
  chipRow: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.72),
  },
  chipActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.2),
  },
  chipText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
  chipTextActive: {
    color: ST_ACCENT_LIGHT,
  },
  filterLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: ST_TEXT_TERTIARY,
  },
  viewSwitchRow: {
    flexDirection: 'row',
    gap: 6,
  },
  viewSwitch: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.72),
  },
  viewSwitchActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.18),
  },
  viewSwitchText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_SECONDARY,
  },
  viewSwitchTextActive: {
    color: ST_ACCENT_LIGHT,
  },
  notificationsCard: {
    gap: 12,
  },
  notificationList: {
    gap: 12,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  notificationLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
    color: ST_TEXT_SECONDARY,
  },
  monthSection: {
    gap: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthLabel: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: ST_TEXT,
  },
  monthCount: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  eventCard: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  eventDatePill: {
    width: 58,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.82),
  },
  eventDateDay: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 20,
    color: ST_ACCENT_LIGHT,
  },
  eventDateMonth: {
    fontFamily: ST_FONTS.medium,
    fontSize: 10,
    color: ST_TEXT_TERTIARY,
    letterSpacing: 1.1,
  },
  eventContent: {
    flex: 1,
    gap: 8,
  },
  eventTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'flex-start',
  },
  eventTitleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flex: 1,
  },
  eventIconShell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    flex: 1,
    fontFamily: ST_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 22,
    color: ST_TEXT,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.14),
  },
  typeChipText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 10,
    color: ST_ACCENT_LIGHT,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  eventMetaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  eventBody: {
    flex: 1,
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  impactBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT_LIGHT, 0.12),
  },
  impactBadgeText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
  },
  emptyCard: {
    gap: 10,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: ST_TEXT,
  },
  emptyBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
    textAlign: 'center',
  },
  calendarCard: {
    gap: 14,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.72),
  },
  calendarTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 22,
    color: ST_TEXT,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
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
  calendarGrid: {
    gap: 6,
  },
  calendarRow: {
    flexDirection: 'row',
    gap: 6,
  },
  calendarSpacer: {
    flex: 1,
  },
  calendarCell: {
    flex: 1,
    minHeight: 68,
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: withAlpha(ST_SURFACES.low, 0.82),
  },
  calendarCellActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
  },
  calendarCellDay: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_TEXT,
  },
  calendarMarkers: {
    flexDirection: 'row',
    gap: 4,
  },
  calendarMarkerDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_SURFACES.lowest, 0.82),
    padding: 18,
  },
  modalCard: {
    gap: 14,
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
    color: ST_ACCENT_LIGHT,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
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
  modalDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalDateText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  modalSignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  modalSectionLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  detailImpactCard: {
    gap: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: withAlpha(ST_ACCENT_LIGHT, 0.08),
  },
  detailImpactTitle: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 13,
    color: ST_ACCENT_LIGHT,
  },
  detailImpactBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  modalJournalButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: ST_ACCENT,
  },
  modalJournalText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 12,
    color: '#140C27',
    letterSpacing: 0.3,
  },
});
