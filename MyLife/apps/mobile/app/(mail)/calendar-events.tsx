import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import {
  getAccounts,
  getCalendarEventsByAccount,
  updateRsvpStatus,
} from '@mylife/mail';
import type { CalendarEvent, RSVPStatus } from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

type Filter = 'all' | 'pending' | 'accepted' | 'declined';
type ViewMode = 'list' | 'month';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarEventsScreen() {
  const db = useDatabase();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const accounts = useMemo(() => getAccounts(db), [db]);

  const loadData = useCallback(() => {
    try {
      const all: CalendarEvent[] = [];
      for (const a of accounts) {
        all.push(...getCalendarEventsByAccount(db, a.id));
      }
      all.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setEvents(all);
    } catch { /* ignored */ } finally { setLoading(false); }
  }, [db, accounts]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => e.rsvpStatus === filter);
  }, [events, filter]);

  // Group events by date for calendar dots
  const eventDateMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const dateKey = new Date(e.startTime).toISOString().slice(0, 10);
      map[dateKey] = (map[dateKey] || 0) + 1;
    }
    return map;
  }, [events]);

  // Pending events awaiting confirmation
  const pendingEvents = useMemo(
    () => events.filter((e) => e.rsvpStatus === 'pending'),
    [events],
  );

  const sections = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    for (const e of filtered) {
      const date = new Date(e.startTime).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(e);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  // Month calendar grid generation
  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [selectedMonth]);

  const handleRsvp = useCallback((eventId: string, status: RSVPStatus) => {
    try { updateRsvpStatus(db, eventId, status); loadData(); } catch { /* ignored */ }
  }, [db, loadData]);

  const statusColor = (status: RSVPStatus) => {
    switch (status) {
      case 'accepted': return colors.success;
      case 'declined': return colors.danger;
      case 'tentative': return ACCENT;
      default: return '#F59E0B';
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  const filterOptions: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending RSVP' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'declined', label: 'Declined' },
  ];

  return (
    <View style={styles.screen}>
      {/* View toggle + filter chips */}
      <View style={styles.topBar}>
        <View style={styles.filterRow}>
          {filterOptions.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text variant="caption" color={filter === f.key ? ACCENT : colors.textSecondary}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleActive]}
            onPress={() => setViewMode('list')}
          >
            <Text variant="caption" color={viewMode === 'list' ? ACCENT : colors.textTertiary}>List</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'month' && styles.toggleActive]}
            onPress={() => setViewMode('month')}
          >
            <Text variant="caption" color={viewMode === 'month' ? ACCENT : colors.textTertiary}>Month</Text>
          </Pressable>
        </View>
      </View>

      {/* Pending events awaiting confirmation */}
      {pendingEvents.length > 0 && filter === 'all' && viewMode === 'list' && (
        <View style={styles.pendingBanner}>
          <Text variant="caption" color="#F59E0B">
            {pendingEvents.length} event{pendingEvents.length !== 1 ? 's' : ''} awaiting your RSVP
          </Text>
        </View>
      )}

      {events.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="heading">📅</Text>
          <Text variant="subheading" color={colors.textSecondary}>
            No calendar events found
          </Text>
          <Text variant="body" color={colors.textTertiary} style={styles.emptyText}>
            Events are automatically detected from .ics attachments and meeting invitations
          </Text>
        </View>
      ) : viewMode === 'month' ? (
        /* Month calendar view */
        <View style={styles.monthContainer}>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}>
              <Text variant="body" color={ACCENT}>{'<'}</Text>
            </Pressable>
            <Text variant="subheading" color={colors.text}>
              {selectedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable onPress={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}>
              <Text variant="body" color={ACCENT}>{'>'}</Text>
            </Pressable>
          </View>
          <View style={styles.weekHeader}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} variant="caption" color={colors.textTertiary} style={styles.weekDay}>{d}</Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {calendarDays.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={styles.calCell} />;
              const dateKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = eventDateMap[dateKey] || 0;
              const isToday = dateKey === new Date().toISOString().slice(0, 10);
              return (
                <View key={dateKey} style={[styles.calCell, isToday && styles.calToday]}>
                  <Text variant="caption" color={isToday ? ACCENT : colors.text}>{day}</Text>
                  {count > 0 && (
                    <View style={[styles.calDot, { backgroundColor: ACCENT }]} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="body" color={colors.textSecondary}>
            No events match this filter
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text variant="label" color={colors.textTertiary}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const startDate = new Date(item.startTime);
            const sColor = statusColor(item.rsvpStatus);

            return (
              <View style={styles.eventRow}>
                <View style={styles.dateBlock}>
                  <Text variant="caption" color={colors.textSecondary}>
                    {startDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                  </Text>
                  <Text variant="heading" color={colors.text}>
                    {startDate.getDate()}
                  </Text>
                </View>

                <View style={styles.eventInfo}>
                  <Text variant="subheading" color={colors.text} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {item.isAllDay ? 'All Day' : startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  {item.location && (
                    <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
                      📍 {item.location}
                    </Text>
                  )}
                  {item.organizer && (
                    <Text variant="caption" color={colors.textTertiary} numberOfLines={1}>
                      {item.organizer}
                    </Text>
                  )}
                  {item.attendees.length > 0 && (
                    <Text variant="caption" color={colors.textTertiary}>
                      {item.attendees.length} attendee{item.attendees.length !== 1 ? 's' : ''}
                    </Text>
                  )}

                  <View style={styles.rsvpRow}>
                    {(['accepted', 'tentative', 'declined'] as const).map((status) => (
                      <Pressable
                        key={status}
                        style={[
                          styles.rsvpBtn,
                          item.rsvpStatus === status && { backgroundColor: `${statusColor(status)}20`, borderColor: statusColor(status) },
                        ]}
                        onPress={() => handleRsvp(item.id, status)}
                      >
                        <Text
                          variant="caption"
                          color={item.rsvpStatus === status ? statusColor(status) : colors.textSecondary}
                        >
                          {status === 'accepted' ? 'Accept' : status === 'declined' ? 'Decline' : 'Tentative'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: `${sColor}20` }]}>
                  <Text variant="caption" color={sColor} style={{ fontSize: 10 }}>
                    {item.rsvpStatus.charAt(0).toUpperCase() + item.rsvpStatus.slice(1)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md,
  },
  emptyText: { textAlign: 'center' },
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  filterRow: {
    flexDirection: 'row', gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  viewToggle: { flexDirection: 'row', gap: spacing.xs },
  toggleBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: 8, backgroundColor: colors.surface,
  },
  toggleActive: { backgroundColor: `${ACCENT}20` },
  pendingBanner: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: 'rgba(245,158,11,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(245,158,11,0.2)',
  },
  monthContainer: { padding: spacing.md },
  monthNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekHeader: { flexDirection: 'row', marginBottom: spacing.xs },
  weekDay: { flex: 1, textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
  },
  calToday: { backgroundColor: `${ACCENT}15`, borderRadius: 8 },
  calDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  sectionHeader: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  eventRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  dateBlock: { alignItems: 'center', width: 48 },
  eventInfo: { flex: 1, gap: 2 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rsvpRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  rsvpBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border,
  },
});
