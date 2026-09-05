import { useCallback, useState } from 'react';
import { View, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, Card, EmptyState, Button } from '@mylife/ui';
import { getPlansOnDay, type PlanRow } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';
import { syncDeviceCalendar } from '../lib/device-calendar';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function headerLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function timeLabel(startAt: string): string {
  return startAt.slice(11, 16) || 'All day';
}

export default function CalendarScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    setPlans(getPlansOnDay(db, dayKey(selectedDay)));
  }, [db, selectedDay]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncDeviceCalendar(db);
      const failedNote = result.failed > 0
        ? ` ${result.failed} plans could not be written.`
        : '';
      const importNote = result.importSkipped
        ? ' Device calendar import is off in Data & Sync.'
        : ` Imported ${result.imported} events.`;
      Alert.alert(
        'Calendar synced',
        `Sent ${result.exported} plans to your device calendar.${importNote}${failedNote}`,
      );
      refresh();
    } catch (err) {
      Alert.alert(
        'Sync unavailable',
        err instanceof Error ? err.message : 'Could not sync the device calendar.',
      );
    } finally {
      setSyncing(false);
    }
  };

  const shiftDay = (delta: number) => {
    setSelectedDay((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text variant="heading">Calendar</Text>
        <Button
          title={syncing ? 'Syncing...' : 'Sync device'}
          variant="secondary"
          onPress={() => { void handleSync(); }}
          disabled={syncing}
        />
      </View>

      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          style={styles.navButton}
          onPress={() => shiftDay(-1)}
        >
          <Text variant="subheading" color="#E4572E">‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to today"
          style={styles.navButton}
          onPress={() => setSelectedDay(new Date())}
        >
          <Text variant="subheading">{headerLabel(selectedDay)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          style={styles.navButton}
          onPress={() => shiftDay(1)}
        >
          <Text variant="subheading" color="#E4572E">›</Text>
        </Pressable>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="📅"
            title="Nothing planned"
            message="Plans you schedule for this day will show up here."
          />
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open plan ${item.title}`}
              onPress={() => router.push(`/plan/${item.id}`)}
            >
              <Card>
                <Text variant="caption" color="#E4572E">{timeLabel(item.start_at)}</Text>
                <Text variant="subheading">{item.title}</Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  navButton: { paddingVertical: 8, paddingHorizontal: 4 },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
});
