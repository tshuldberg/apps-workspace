import { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { Text } from '@mylife/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  listUpcomingReservations,
  listReservations,
  getRestaurant,
} from '@mylife/dining';
import type { Reservation } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

const STATUS_COLORS: Record<string, string> = {
  upcoming: '#8BCFF0',
  completed: '#30D158',
  cancelled: 'rgba(228,225,233,0.35)',
  no_show: '#FFB4AB',
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const PLATFORM_LABELS: Record<string, string> = {
  resy: 'Resy',
  opentable: 'OpenTable',
  tock: 'Tock',
  yelp: 'Yelp',
  phone: 'Phone',
  walkin: 'Walk-in',
  other: 'Other',
};

type ListItem =
  | { type: 'header'; title: string }
  | { type: 'reservation'; reservation: Reservation };

export default function ReservationsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const { items, isEmpty } = useMemo(() => {
    const upcoming = listUpcomingReservations(db);
    const past = listReservations(db, { sort_by: 'reserved_at', sort_dir: 'DESC', limit: 100 })
      .filter((r: Reservation) => r.status !== 'upcoming');

    if (upcoming.length === 0 && past.length === 0) {
      return { items: [], isEmpty: true };
    }

    const result: ListItem[] = [];

    if (upcoming.length > 0) {
      result.push({ type: 'header', title: 'Upcoming' });
      for (const r of upcoming) {
        result.push({ type: 'reservation', reservation: r });
      }
    }

    if (past.length > 0) {
      result.push({ type: 'header', title: 'Past' });
      for (const r of past) {
        result.push({ type: 'reservation', reservation: r });
      }
    }

    return { items: result, isEmpty: false };
  }, [db, tick]);

  // Cache restaurant names
  const restaurantNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const item of items) {
      if (item.type === 'reservation') {
        const rid = item.reservation.restaurant_id;
        if (!names[rid]) {
          const r = getRestaurant(db, rid);
          names[rid] = r?.name ?? 'Unknown';
        }
      }
    }
    return names;
  }, [db, items]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{item.title}</Text>
          </View>
        );
      }

      const { reservation } = item;
      const name = restaurantNames[reservation.restaurant_id] ?? 'Unknown';
      const reservedDate = new Date(reservation.reserved_at);
      const dateLabel = reservedDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timeLabel = reservedDate.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      const statusColor = STATUS_COLORS[reservation.status] ?? TEXT_SECONDARY;
      const statusLabel = STATUS_LABELS[reservation.status] ?? reservation.status;

      return (
        <Pressable
          style={styles.card}
          onPress={() =>
            router.push(
              `/(dining)/reservation/${reservation.id}` as `/${string}`,
            )
          }
        >
          <View style={styles.cardTop}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.cardDateTime}>
                {dateLabel} at {timeLabel}
              </Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusChipText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardParty}>
              {reservation.party_size} {reservation.party_size === 1 ? 'guest' : 'guests'}
            </Text>
            {reservation.platform && (
              <View style={styles.platformBadge}>
                <Text style={styles.platformBadgeText}>
                  {PLATFORM_LABELS[reservation.platform] ?? reservation.platform}
                </Text>
              </View>
            )}
          </View>
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
            <Text style={styles.emptyIcon}>{'\uD83D\uDCC5'}</Text>
            <Text style={styles.emptyTitle}>No reservations yet</Text>
            <Text style={styles.emptySubtext}>
              Add a reservation manually or import one from a confirmation email.
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                style={styles.addButton}
                onPress={() =>
                  router.push('/(dining)/reservation/add' as `/${string}`)
                }
              >
                <Text style={styles.addButtonText}>Add Reservation</Text>
              </Pressable>
              <Pressable
                style={styles.importButton}
                onPress={() =>
                  router.push('/(dining)/reservation/import' as `/${string}`)
                }
              >
                <Text style={styles.importButtonText}>Import from Email</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Import header button */}
      <View style={styles.headerRow}>
        <Pressable
          style={styles.importLink}
          onPress={() =>
            router.push('/(dining)/reservation/import' as `/${string}`)
          }
        >
          <Text style={styles.importLinkText}>Import</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) =>
          item.type === 'header'
            ? `h-${item.title}`
            : `r-${item.reservation.id}`
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push('/(dining)/reservation/add' as `/${string}`)
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  importLink: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  importLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
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
    gap: 10,
  },
  cardTop: {
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
  cardDateTime: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardParty: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  platformBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  platformBadgeText: {
    fontSize: 11,
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
  emptyActions: {
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  addButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  importButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
  },
  importButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
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
