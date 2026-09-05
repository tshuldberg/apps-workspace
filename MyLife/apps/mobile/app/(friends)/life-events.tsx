import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Text } from '@mylife/ui';
import {
  listEventsForPerson,
  acknowledgeEvent,
  deleteLifeEvent,
  formatLifeEventLabel,
  getLifeEventIcon,
  type LifeEventRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#EC4899';
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SUCCESS = '#30D158';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function LifeEventsScreen() {
  const router = useRouter();
  const { personId, personName } = useLocalSearchParams<{
    personId: string;
    personName: string;
  }>();
  const db = useDatabase();

  const [events, setEvents] = useState<LifeEventRecord[]>([]);

  const load = useCallback(() => {
    if (!personId) return;
    setEvents(listEventsForPerson(db, personId));
  }, [db, personId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleAcknowledge = useCallback(
    (id: string) => {
      acknowledgeEvent(db, id);
      load();
    },
    [db, load],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteLifeEvent(db, id);
      load();
    },
    [db, load],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Life Events</Text>
            {personName && (
              <Text style={styles.headerSubtitle}>for {personName}</Text>
            )}
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {events.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No life events yet</Text>
              <Text style={styles.emptySubtext}>
                Tap + to record a milestone
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <View key={event.id} style={styles.card}>
                <View style={styles.cardIcon}>
                  <Text style={styles.iconText}>
                    {getLifeEventIcon(event.type)}
                  </Text>
                </View>
                <View style={styles.cardMain}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardLabel}>
                      {formatLifeEventLabel(event.type)}
                    </Text>
                    {event.acknowledged && (
                      <View style={styles.acknowledgedBadge}>
                        <Text style={styles.acknowledgedText}>{'\u2713'}</Text>
                      </View>
                    )}
                  </View>
                  {event.description && (
                    <Text style={styles.cardDescription}>
                      {event.description}
                    </Text>
                  )}
                  <Text style={styles.cardDate}>
                    {formatDate(event.happened_at)}
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  {!event.acknowledged && (
                    <Pressable
                      style={styles.ackButton}
                      onPress={() => handleAcknowledge(event.id)}
                      hitSlop={8}
                    >
                      <Text style={styles.ackButtonText}>{'\u2713'}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => handleDelete(event.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.deleteText}>{'\u00D7'}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* FAB */}
        <Pressable
          style={styles.fab}
          onPress={() =>
            router.push({
              pathname: '/(friends)/add-life-event',
              params: { personId, personName },
            })
          }
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 8,
  },
  card: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  cardMain: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  acknowledgedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: `${SUCCESS}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acknowledgedText: {
    fontSize: 11,
    fontWeight: '700',
    color: SUCCESS,
  },
  cardDescription: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginTop: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#9F8E81',
    marginTop: 4,
  },
  cardActions: {
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  ackButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${SUCCESS}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: SUCCESS,
  },
  deleteText: {
    fontSize: 20,
    color: '#9F8E81',
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9F8E81',
    marginTop: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 30,
  },
});
