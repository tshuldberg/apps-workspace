import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listTrips, type TripRow } from '@mylife/travel';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from './_ui';

type FilterKey = 'all' | 'upcoming' | 'past' | 'draft';

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'draft', label: 'Draft' },
];

function parseDestinations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Dates not set';
  if (start && end) return `${start} to ${end}`;
  return start ?? end ?? 'Dates not set';
}

function matchesFilter(trip: TripRow, filter: FilterKey): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'upcoming':
      return trip.status === 'upcoming' || trip.status === 'active';
    case 'past':
      return trip.status === 'completed';
    case 'draft':
      return trip.status === 'planning';
    default:
      return true;
  }
}

function sortByStart(a: TripRow, b: TripRow): number {
  const ak = a.start_date ?? a.created_at;
  const bk = b.start_date ?? b.created_at;
  if (ak === bk) return 0;
  return ak < bk ? 1 : -1;
}

export default function TravelTripsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  useFocusEffect(
    useCallback(() => {
      try {
        setError(null);
        const rows = listTrips(db);
        setTrips(rows);
      } catch {
        setError('Failed to load trips.');
      } finally {
        setLoading(false);
      }
    }, [db]),
  );

  const visibleTrips = useMemo(
    () => trips.filter((t) => matchesFilter(t, filter)).sort(sortByStart),
    [trips, filter],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Trips</Text>
        <Text style={styles.title}>
          {trips.length > 0 ? 'Your trips' : 'Plan your first trip'}
        </Text>
        <Text style={styles.subtitle}>
          {trips.length > 0
            ? 'Past, present, and future trips live here.'
            : 'Start with a name and dates. You can fill in the rest later.'}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/(travel)/trip/create')}
        >
          <Text style={styles.primaryButtonText}>+ New trip</Text>
        </Pressable>
      </View>

      {trips.length > 0 ? (
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={TRAVEL_ACCENT} />
        </View>
      ) : error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptyBody}>
            Tap "+ New trip" to plan your first itinerary. Everything stays on
            this device.
          </Text>
        </View>
      ) : visibleTrips.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>No trips match this filter</Text>
          <Text style={styles.emptyBody}>
            Try a different filter above or create a new trip.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleTrips.map((trip) => {
            const destinations = parseDestinations(trip.destination_ids);
            return (
              <Pressable
                key={trip.id}
                style={styles.card}
                onPress={() => router.push(`/(travel)/trip/${trip.id}`)}
              >
                <Text style={styles.cardStatus}>{trip.status.toUpperCase()}</Text>
                <Text style={styles.cardTitle}>{trip.name}</Text>
                <Text style={styles.cardMeta}>
                  {destinations.length > 0
                    ? destinations.join(', ')
                    : 'Destination not set'}
                </Text>
                <Text style={styles.cardMeta}>
                  {formatDateRange(trip.start_date, trip.end_date)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: TRAVEL_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: TRAVEL_ACCENT,
    borderColor: TRAVEL_ACCENT,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: { color: '#0E0E13' },
  centerBlock: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBlock: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,180,171,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.3)',
  },
  errorText: {
    color: '#FFB4AB',
    fontSize: 14,
  },
  emptyBlock: {
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  list: { gap: 12 },
  card: {
    gap: 6,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardStatus: {
    color: TRAVEL_ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
