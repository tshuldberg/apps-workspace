import { useCallback, useMemo, useState } from 'react';
import { View, SectionList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, Card, Button, EmptyState } from '@mylife/ui';
import { getPlans, type PlanRow } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function relativeDayLabel(startAt: string): string {
  const startDay = startAt.slice(0, 10);
  const now = new Date();
  const today = dayKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (startDay === today) return 'Today';
  if (startDay === dayKey(tomorrow)) return 'Tomorrow';
  const parsed = new Date(`${startDay}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return startDay;
  return `${WEEKDAYS[parsed.getDay()]}, ${startDay}`;
}

function timeLabel(startAt: string): string {
  const time = startAt.slice(11, 16);
  return time || 'All day';
}

interface PlanSection {
  title: string;
  data: PlanRow[];
}

export default function PlansScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<PlanRow[]>([]);

  const refresh = useCallback(() => {
    setPlans(getPlans(db));
  }, [db]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const sections = useMemo<PlanSection[]>(() => {
    const groups = new Map<string, PlanRow[]>();
    const order: string[] = [];
    for (const plan of plans) {
      const label = relativeDayLabel(plan.start_at);
      if (!groups.has(label)) {
        groups.set(label, []);
        order.push(label);
      }
      groups.get(label)!.push(plan);
    }
    return order.map((title) => ({ title, data: groups.get(title)! }));
  }, [plans]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text variant="heading">Plans</Text>
      </View>
      {plans.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="🗓️"
            title="No plans yet"
            message="Organize an outing and pick a time."
            actionLabel="New plan"
            onAction={() => router.push('/plan/new')}
            accentColor="#E4572E"
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text variant="label" color="#9F8E81" style={styles.sectionHeader}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open plan ${item.title}`}
              onPress={() => router.push(`/plan/${item.id}`)}
            >
              <Card>
                <Text variant="subheading">{item.title}</Text>
                <Text variant="caption" color="#D6C3B5">{timeLabel(item.start_at)}</Text>
              </Card>
            </Pressable>
          )}
        />
      )}
      {plans.length > 0 ? (
        <View style={styles.fab}>
          <Button title="New plan" onPress={() => router.push('/plan/new')} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { padding: 16, gap: 8, paddingBottom: 96 },
  sectionHeader: { marginTop: 12, marginBottom: 4 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
