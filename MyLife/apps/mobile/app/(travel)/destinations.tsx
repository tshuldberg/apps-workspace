import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  listDestinations,
  REGION_DEFINITIONS,
  type DestinationRecord,
} from '@mylife/travel';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  TRAVEL_ACCENT,
  WISHLIST_GOLD,
  BOTH_GREEN,
  applyFilter,
  computeStats,
  countryFlag,
  isVisited,
  pinColor,
  type FilterKey,
} from './_components/dest-helpers';
import { DestAddForm } from './_components/dest-add-form';

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'visited', label: 'Visited' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'us_states', label: 'US States' },
  { key: 'eu_countries', label: 'EU' },
  { key: 'schengen', label: 'Schengen' },
];

export default function TravelDestinationsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [rows, setRows] = useState<DestinationRecord[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    try {
      setError(null);
      const next = listDestinations(db);
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load destinations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const regionCodes = REGION_DEFINITIONS[filter]?.countryCodes;
    return applyFilter(rows, filter, regionCodes);
  }, [rows, filter]);

  const stats = useMemo(() => computeStats(rows), [rows]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={TRAVEL_ACCENT}
          />
        }
      >
        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{stats.countriesVisited}</Text>
            <Text style={styles.statLabel}>Countries visited</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: WISHLIST_GOLD }]}>
              {stats.wishlistCount}
            </Text>
            <Text style={styles.statLabel}>Wishlist</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{stats.totalDestinations}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* View toggle: list/map */}
        <View style={styles.viewToggleRow}>
          <Pressable
            style={[styles.viewToggle, styles.viewToggleActive]}
            onPress={() => {}}
          >
            <Text style={styles.viewToggleTextActive}>List</Text>
          </Pressable>
          <Pressable
            style={styles.viewToggle}
            onPress={() => router.push('/(travel)/map')}
          >
            <Text style={styles.viewToggleText}>Map</Text>
          </Pressable>
          <Pressable
            style={styles.viewToggle}
            onPress={() => router.push('/(travel)/bucket-list')}
          >
            <Text style={styles.viewToggleText}>Bucket list</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTER_CHIPS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* List / states */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={TRAVEL_ACCENT} />
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {rows.length === 0
                ? 'Start your travel map'
                : 'No destinations match this filter'}
            </Text>
            <Text style={styles.emptyBody}>
              {rows.length === 0
                ? 'Add places you have been, or dream of going. Everything stays local and private.'
                : 'Try a different filter, or add a destination to this group.'}
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.primaryBtnText}>Add destination</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((d) => (
              <Pressable
                key={d.id}
                onPress={() =>
                  router.push({
                    pathname: '/(travel)/destination/[id]',
                    params: { id: d.id },
                  })
                }
              >
                <DestCard record={d} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <DestAddForm
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={load}
      />
    </View>
  );
}

function DestCard({ record }: { record: DestinationRecord }) {
  const visited = isVisited(record);
  const color = pinColor(record);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.flag}>{countryFlag(record.country_code)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>
            {record.name}
          </Text>
          <Text style={styles.cardCountry} numberOfLines={1}>
            {record.country ?? 'Unknown location'}
          </Text>
        </View>
        <View style={[styles.pinDot, { backgroundColor: color }]} />
      </View>

      <View style={styles.badgeRow}>
        {visited ? (
          <View style={[styles.badge, { backgroundColor: 'rgba(14,165,233,0.15)' }]}>
            <Text style={[styles.badgeText, { color: TRAVEL_ACCENT }]}>
              Visited {record.visit_count > 1 ? `\u00D7${record.visit_count}` : ''}
            </Text>
          </View>
        ) : null}
        {record.bucket_list ? (
          <View style={[styles.badge, { backgroundColor: 'rgba(255,184,119,0.15)' }]}>
            <Text style={[styles.badgeText, { color: WISHLIST_GOLD }]}>
              Wishlist
            </Text>
          </View>
        ) : null}
        {visited && record.bucket_list ? (
          <View style={[styles.badge, { backgroundColor: 'rgba(48,209,88,0.15)' }]}>
            <Text style={[styles.badgeText, { color: BOTH_GREEN }]}>Both</Text>
          </View>
        ) : null}
      </View>

      {record.last_visited ? (
        <Text style={styles.cardMeta}>
          Last visit {record.last_visited.slice(0, 10)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 14,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: surfaceTiers.container,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: TRAVEL_ACCENT,
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.low,
  },
  viewToggleActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderColor: TRAVEL_ACCENT,
  },
  viewToggleText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  viewToggleTextActive: {
    color: TRAVEL_ACCENT,
    fontWeight: '700',
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: TRAVEL_ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnText: {
    color: '#0E0E13',
    fontWeight: '800',
    fontSize: 13,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.low,
  },
  chipActive: {
    borderColor: TRAVEL_ACCENT,
    backgroundColor: 'rgba(14,165,233,0.15)',
  },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: TRAVEL_ACCENT },
  grid: {
    gap: 10,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flag: { fontSize: 28 },
  cardName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardCountry: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  center: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  empty: {
    padding: 24,
    gap: 10,
    alignItems: 'center',
    backgroundColor: surfaceTiers.container,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: TRAVEL_ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontWeight: '800',
    fontSize: 14,
  },
  errorCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(147,0,10,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.3)',
    gap: 10,
  },
  errorTitle: {
    color: '#FFB4AB',
    fontSize: 15,
    fontWeight: '700',
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
