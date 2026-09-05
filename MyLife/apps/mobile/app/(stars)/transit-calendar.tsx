import { useMemo, useState, useCallback } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getTransitEventsByProfile,
  getBirthProfiles,
  type TransitEvent,
} from '@mylife/stars';

const ACCENT = colors.modules.stars;
const MAJOR_COLOR = colors.warning;
const MINOR_COLOR = colors.textTertiary;

const WEEKDAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TransitCalendarScreen() {
  const db = useDatabase();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayParts = todayStr.split('-');

  const [currentYear, setCurrentYear] = useState(parseInt(todayParts[0], 10));
  const [currentMonth, setCurrentMonth] = useState(parseInt(todayParts[1], 10));
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const profiles = useMemo(() => getBirthProfiles(db), [db]);
  const primaryProfile = profiles.length > 0 ? profiles[0] : null;

  // Date range for the month
  const dateRange = useMemo(() => {
    const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const end = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return { start, end, daysInMonth };
  }, [currentYear, currentMonth]);

  const transits = useMemo(() => {
    if (!primaryProfile) return [];
    return getTransitEventsByProfile(db, primaryProfile.id, dateRange.start, dateRange.end);
  }, [db, primaryProfile, dateRange]);

  // Group transits by date
  const transitsByDate = useMemo(() => {
    const map: Record<string, TransitEvent[]> = {};
    for (const t of transits) {
      if (!map[t.exactDate]) map[t.exactDate] = [];
      map[t.exactDate].push(t);
    }
    return map;
  }, [transits]);

  const selectedDayTransits = useMemo(
    () => transitsByDate[selectedDate] ?? [],
    [transitsByDate, selectedDate],
  );

  // Build calendar grid
  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth - 1, 1).getDay();
  }, [currentYear, currentMonth]);

  const gridCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= dateRange.daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDayOfWeek, dateRange.daysInMonth]);

  const gridRows = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < gridCells.length; i += 7) {
      rows.push(gridCells.slice(i, i + 7));
    }
    return rows;
  }, [gridCells]);

  const navigateMonth = useCallback((delta: number) => {
    setCurrentMonth((prev) => {
      let newMonth = prev + delta;
      if (newMonth < 1) {
        setCurrentYear((y) => y - 1);
        return 12;
      }
      if (newMonth > 12) {
        setCurrentYear((y) => y + 1);
        return 1;
      }
      return newMonth;
    });
  }, []);

  function dateStringForDay(day: number): string {
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  if (!primaryProfile) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text variant="body" color={colors.textSecondary}>
          Add a birth profile to view transit calendar
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Pressable onPress={() => navigateMonth(-1)} style={styles.navArrow}>
          <Text style={styles.navArrowText}>{'\u2039'}</Text>
        </Pressable>
        <Text variant="subheading">
          {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </Text>
        <Pressable onPress={() => navigateMonth(1)} style={styles.navArrow}>
          <Text style={styles.navArrowText}>{'\u203A'}</Text>
        </Pressable>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_HEADERS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text variant="caption" color={colors.textTertiary}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      {gridRows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.calendarRow}>
          {row.map((day, colIdx) => {
            if (day === null) {
              return <View key={`empty-${colIdx}`} style={styles.dayCell} />;
            }

            const dateStr = dateStringForDay(day);
            const dayTransits = transitsByDate[dateStr] ?? [];
            const hasMajor = dayTransits.some((t) => t.significance === 'major');
            const hasMinor = dayTransits.some((t) => t.significance === 'minor');
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <Pressable
                key={dateStr}
                style={[
                  styles.dayCell,
                  isToday && styles.dayCellToday,
                  isSelected && styles.dayCellSelected,
                ]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text
                  variant="caption"
                  color={isSelected ? colors.text : colors.textSecondary}
                  style={isSelected ? styles.dayNumSelected : undefined}
                >
                  {day}
                </Text>
                <View style={styles.dotRow}>
                  {hasMajor && <View style={[styles.dot, { backgroundColor: MAJOR_COLOR }]} />}
                  {hasMinor && <View style={[styles.dot, { backgroundColor: MINOR_COLOR }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Detail Panel */}
      <View style={[styles.detailPanel, glass.card]}>
        <Text variant="label" color={ACCENT} style={styles.detailLabel}>
          {formatDate(selectedDate).toUpperCase()}
        </Text>
        {selectedDayTransits.length === 0 ? (
          <Text variant="body" color={colors.textTertiary}>
            No transits on this date
          </Text>
        ) : (
          selectedDayTransits.map((t) => (
            <View key={t.id} style={styles.transitRow}>
              <View
                style={[
                  styles.sigDot,
                  { backgroundColor: t.significance === 'major' ? MAJOR_COLOR : MINOR_COLOR },
                ]}
              />
              <View style={styles.transitInfo}>
                <Text variant="body" color={colors.text}>
                  {capitalize(t.transitingBody)} {t.aspectType} {capitalize(t.natalBody)}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Orb: {t.currentOrb}{'\u00B0'} {'\u00B7'} {t.interpretationBrief}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  navArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  navArrowText: { fontSize: 24, color: colors.text },
  weekdayRow: { flexDirection: 'row' },
  weekdayCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  calendarRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minHeight: 48,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  dayCellSelected: {
    backgroundColor: `${ACCENT}26`,
  },
  dayNumSelected: { fontWeight: '700' },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
    height: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detailPanel: {
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  detailLabel: {
    marginBottom: spacing.xs,
  },
  transitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sigDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  transitInfo: {
    flex: 1,
    gap: 2,
  },
});
