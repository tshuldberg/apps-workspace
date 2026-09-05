import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Text, EmptyState, LoadingState, colors, spacing } from '@mylife/ui';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';
import { getRsvpSummary, type Event, type RsvpSummary } from '@mylife/rsvp';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.rsvp;

function isPast(event: Event): boolean {
  return new Date(event.startAt) < new Date();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function EventCard({
  event,
  summary,
  isSelected,
  onPress,
  onDetail,
}: {
  event: Event;
  summary: RsvpSummary | null;
  isSelected: boolean;
  onPress: () => void;
  onDetail: () => void;
}) {
  const past = isPast(event);
  return (
    <Pressable onPress={onPress} style={[styles.eventCard, isSelected && styles.eventCardSelected]}>
      <View style={styles.eventHeader}>
        <View style={styles.dateBadge}>
          <Text variant="caption" color={ACCENT} style={styles.dateBadgeMonth}>
            {new Date(event.startAt).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
          </Text>
          <Text style={styles.dateBadgeDay}>
            {new Date(event.startAt).getDate()}
          </Text>
        </View>
        <View style={styles.eventInfo}>
          <Text variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
            {event.title}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {formatDate(event.startAt)} at {formatTime(event.startAt)}
          </Text>
          {event.locationName ? (
            <Text variant="caption" color={colors.textTertiary} numberOfLines={1}>
              {event.locationName}
            </Text>
          ) : null}
        </View>
        {past ? (
          <View style={styles.pastBadge}>
            <Text variant="caption" color={colors.textTertiary}>Past</Text>
          </View>
        ) : null}
      </View>
      {summary ? (
        <View style={styles.summaryRow}>
          <MiniStat label="Going" value={summary.going} />
          <MiniStat label="Maybe" value={summary.maybe} />
          <MiniStat label="Declined" value={summary.declined} />
          <MiniStat label="+1s" value={summary.plusOnes} />
        </View>
      ) : null}
      <Pressable onPress={onDetail} style={styles.detailLink}>
        <Text variant="caption" color={ACCENT}>View Details</Text>
      </Pressable>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text variant="caption" color={colors.textTertiary}>{label}</Text>
    </View>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { events, eventsLoading, selectedEventId, selectEvent, refreshEvents } = useRsvpContext();
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const summariesMap = useMemo(() => {
    const map = new Map<string, RsvpSummary>();
    for (const event of events) {
      try {
        map.set(event.id, getRsvpSummary(db, event.id));
      } catch {
        // skip
      }
    }
    return map;
  }, [db, events]);

  const upcoming = useMemo(() => events.filter((e) => !isPast(e)), [events]);
  const past = useMemo(() => events.filter((e) => isPast(e)), [events]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => requestAnimationFrame(r));
    refreshEvents();
    setRefreshing(false);
  }, [refreshEvents]);

  if (eventsLoading && !refreshing) {
    return (
      <View style={styles.center}>
        <LoadingState rows={4} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ACCENT}
          colors={[ACCENT]}
        />
      }
    >
      <View style={styles.topRow}>
        <Text variant="heading">Events</Text>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <ScrollView bounces={false}>
              {[
                { label: 'Calendar Sync', route: '/(rsvp)/calendar-sync' },
                { label: 'Templates', route: '/(rsvp)/templates' },
                { label: 'Check-In', route: '/(rsvp)/check-in' },
                { label: 'Dietary', route: '/(rsvp)/dietary' },
                { label: 'Expenses', route: '/(rsvp)/expenses' },
                { label: 'Invitation Design', route: '/(rsvp)/invitation-design' },
                { label: 'Messaging', route: '/(rsvp)/messaging' },
                { label: 'Registry', route: '/(rsvp)/registry' },
                { label: 'Seating', route: '/(rsvp)/seating' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => { setMenuOpen(false); router.push(item.route as never); }}
                >
                  <Text variant="body" color={colors.text}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Event Button */}
      <Pressable
        style={styles.createButton}
        onPress={() => router.push('/(rsvp)/event/new')}
      >
        <Text variant="label" color={colors.background}>+ New Event</Text>
      </Pressable>

      {/* Empty State */}
      {events.length === 0 ? (
        <EmptyState
          icon={'\uD83C\uDF89'}
          title="No events yet"
          message="Create your first event to start tracking RSVPs, sending invites, and managing your guest list."
          actionLabel="+ New Event"
          onAction={() => router.push('/(rsvp)/event/new')}
          accentColor={ACCENT}
        />
      ) : null}

      {/* Upcoming Events */}
      {upcoming.length > 0 ? (
        <View style={styles.section}>
          <Text variant="label" color={colors.textTertiary}>UPCOMING</Text>
          {upcoming.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              summary={summariesMap.get(event.id) ?? null}
              isSelected={event.id === selectedEventId}
              onPress={() => selectEvent(event.id)}
              onDetail={() => router.push(`/(rsvp)/event/${event.id}`)}
            />
          ))}
        </View>
      ) : null}

      {/* Past Events */}
      {past.length > 0 ? (
        <View style={styles.section}>
          <Text variant="label" color={colors.textTertiary}>PAST</Text>
          {past.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              summary={summariesMap.get(event.id) ?? null}
              isSelected={event.id === selectedEventId}
              onPress={() => selectEvent(event.id)}
              onDetail={() => router.push(`/(rsvp)/event/${event.id}`)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  createButton: {
    borderRadius: 10,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  section: { gap: spacing.sm },
  eventCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  eventCardSelected: { borderColor: ACCENT },
  eventHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dateBadge: {
    width: 44,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeMonth: { fontSize: 10, fontWeight: '700' },
  dateBadgeDay: { fontSize: 20, fontWeight: '700', color: colors.text },
  eventInfo: { flex: 1, gap: 2 },
  pastBadge: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  miniStat: { alignItems: 'center', gap: 1 },
  miniStatValue: { fontSize: 16, fontWeight: '700', color: ACCENT },
  detailLink: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
