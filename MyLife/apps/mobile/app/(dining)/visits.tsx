import { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { Text } from '@mylife/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  listVisitsChronological,
  getRestaurant,
} from '@mylife/dining';
import type { Visit } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

type VisitSection = { type: 'header'; title: string } | { type: 'visit'; visit: Visit };

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DiningVisitsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const { sections, isEmpty } = useMemo(() => {
    const visits = listVisitsChronological(db, { limit: 200 });
    if (visits.length === 0) return { sections: [], isEmpty: true };

    const result: VisitSection[] = [];
    let currentMonth = '';
    for (const visit of visits) {
      const month = formatMonthYear(visit.visited_at);
      if (month !== currentMonth) {
        currentMonth = month;
        result.push({ type: 'header', title: month });
      }
      result.push({ type: 'visit', visit });
    }
    return { sections: result, isEmpty: false };
  }, [db, tick]);

  // Cache restaurant names
  const restaurantNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const item of sections) {
      if (item.type === 'visit') {
        const rid = item.visit.restaurant_id;
        if (!names[rid]) {
          const r = getRestaurant(db, rid);
          names[rid] = r?.name ?? 'Unknown';
        }
      }
    }
    return names;
  }, [db, sections]);

  const renderItem = useCallback(
    ({ item }: { item: VisitSection }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{item.title}</Text>
          </View>
        );
      }

      const { visit } = item;
      const name = restaurantNames[visit.restaurant_id] ?? 'Unknown';
      const stars = '\u2605'.repeat(visit.overall_rating) +
        '\u2606'.repeat(5 - visit.overall_rating);

      return (
        <Pressable
          style={styles.card}
          onPress={() =>
            router.push(`/(dining)/visit/${visit.id}` as `/${string}`)
          }
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.cardDate}>
                {formatShortDate(visit.visited_at)}
              </Text>
            </View>
            <Text style={styles.cardStars}>{stars}</Text>
          </View>
          {visit.occasion && (
            <View style={styles.occasionBadge}>
              <Text style={styles.occasionBadgeText}>{visit.occasion}</Text>
            </View>
          )}
        </Pressable>
      );
    },
    [router, restaurantNames],
  );

  if (isEmpty) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{'\uD83D\uDCDD'}</Text>
            <Text style={styles.emptyTitle}>No visits yet</Text>
            <Text style={styles.emptySubtext}>
              After you add a restaurant, log your visits with ratings, photos, and notes.
            </Text>
            <Pressable
              style={styles.addButton}
              onPress={() =>
                router.push('/(dining)/visit/add' as `/${string}`)
              }
            >
              <Text style={styles.addButtonText}>Log a visit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={(item) =>
          item.type === 'header' ? `h-${item.title}` : `v-${item.visit.id}`
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push('/(dining)/visit/add' as `/${string}`)
        }
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
    gap: 8,
  },
  sectionHeader: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  cardDate: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  cardStars: {
    fontSize: 14,
    color: '#FFB877',
  },
  occasionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  occasionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 12,
    maxWidth: 340,
    width: '100%',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 30,
  },
});
