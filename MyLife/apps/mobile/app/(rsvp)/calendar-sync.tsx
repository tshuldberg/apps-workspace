import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  generateICalString,
  generateGoogleCalendarUrl,
  getCalendarEventId,
  setCalendarEventId,
  getEvents,
} from '@mylife/rsvp';
import type { Event } from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.rsvp;

type SyncStatus = 'synced' | 'pending' | 'not_synced';

function StatusBadge({ status }: { status: SyncStatus }) {
  const bgColor = status === 'synced' ? colors.success : status === 'pending' ? colors.warning : colors.textTertiary;
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text variant="caption" color={colors.background}>
        {status.replace('_', ' ').toUpperCase()}
      </Text>
    </View>
  );
}

export default function CalendarSyncScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((v) => v + 1);

  const events = useMemo(() => getEvents(db), [db, tick]);

  const eventsWithSync = useMemo(() => {
    return events.map((event) => {
      const calId = getCalendarEventId(db, event.id);
      const status: SyncStatus = calId ? 'synced' : 'not_synced';
      return { event, calId, status };
    });
  }, [db, events]);

  const handleExport = (event: Event) => {
    const icsString = generateICalString(event);
    // In production, this would share via Share API. For now, mark as synced.
    const fakeCalId = `cal_${event.id}`;
    setCalendarEventId(db, event.id, fakeCalId);
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Calendar Sync</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Export events to your device calendar or generate .ics files for sharing.
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Events</Text>
        <View style={styles.list}>
          {eventsWithSync.length === 0 ? (
            <EmptyState
              icon={'\uD83D\uDCC5'}
              title="No events to sync"
              message="Create an event first."
            />
          ) : (
            eventsWithSync.map(({ event, status }) => (
              <View key={event.id} style={styles.eventRow}>
                <View style={styles.mainCopy}>
                  <Text variant="body">{event.title}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {event.startAt.slice(0, 16).replace('T', ' ')}
                  </Text>
                </View>
                <StatusBadge status={status} />
                {status !== 'synced' && (
                  <Pressable style={styles.exportButton} onPress={() => handleExport(event)}>
                    <Text variant="label" color={colors.background}>Export</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Google Calendar Links</Text>
        <View style={styles.list}>
          {events.slice(0, 10).map((event) => {
            const url = generateGoogleCalendarUrl(event);
            return (
              <View key={event.id} style={styles.eventRow}>
                <View style={styles.mainCopy}>
                  <Text variant="body">{event.title}</Text>
                  <Text variant="caption" color={ACCENT} numberOfLines={1}>
                    {url.slice(0, 60)}...
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  exportButton: {
    backgroundColor: ACCENT, borderRadius: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
});
