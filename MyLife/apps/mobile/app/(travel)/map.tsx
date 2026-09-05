import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  listDestinations,
  COUNTRIES,
  type DestinationRecord,
  type Country,
} from '@mylife/travel';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  TRAVEL_ACCENT,
  WISHLIST_GOLD,
  BOTH_GREEN,
  computeStats,
  countryFlag,
  isVisited,
} from './_components/dest-helpers';

/**
 * Mobile Map screen. Mapbox is not installed in apps/mobile, so this
 * ships a dep-free world-grid fallback: countries grouped by continent,
 * each country tile shaded by its travel state. This still surfaces the
 * core product value (what you have been to / dream of) without pulling
 * a new native dep. Pin color coding matches the spec.
 */

const CONTINENTS: { code: Country['continent']; label: string }[] = [
  { code: 'EU', label: 'Europe' },
  { code: 'NA', label: 'North America' },
  { code: 'SA', label: 'South America' },
  { code: 'AS', label: 'Asia' },
  { code: 'AF', label: 'Africa' },
  { code: 'OC', label: 'Oceania' },
  { code: 'AN', label: 'Antarctica' },
];

type CountryState = 'none' | 'wishlist' | 'visited' | 'both';

function buildCountryStates(rows: DestinationRecord[]): Map<string, CountryState> {
  const map = new Map<string, CountryState>();
  for (const r of rows) {
    if (!r.country_code) continue;
    const cc = r.country_code.toUpperCase();
    const prev = map.get(cc) ?? 'none';
    const visited = isVisited(r);
    const wishlist = r.bucket_list;
    const next: CountryState =
      prev === 'both' || (visited && wishlist) || (prev === 'visited' && wishlist) || (prev === 'wishlist' && visited)
        ? 'both'
        : visited || prev === 'visited'
        ? 'visited'
        : wishlist || prev === 'wishlist'
        ? 'wishlist'
        : 'none';
    map.set(cc, next);
  }
  return map;
}

function stateColor(s: CountryState): string {
  switch (s) {
    case 'visited':
      return TRAVEL_ACCENT;
    case 'wishlist':
      return WISHLIST_GOLD;
    case 'both':
      return BOTH_GREEN;
    default:
      return 'rgba(255,255,255,0.06)';
  }
}

export default function TravelMapScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [rows, setRows] = useState<DestinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    try {
      setError(null);
      setRows(listDestinations(db));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load map data');
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

  const states = useMemo(() => buildCountryStates(rows), [rows]);
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
        {/* Stats overlay */}
        <View style={styles.statsBadge}>
          <Text style={styles.statsText}>
            <Text style={styles.statsEmph}>{stats.countriesVisited}</Text> countries
            visited
            {'  \u00B7  '}
            <Text style={[styles.statsEmph, { color: WISHLIST_GOLD }]}>
              {stats.wishlistCount}
            </Text>{' '}
            on wishlist
          </Text>
        </View>

        {/* View toggle */}
        <View style={styles.viewToggleRow}>
          <Pressable
            style={styles.viewToggle}
            onPress={() => router.push('/(travel)/destinations')}
          >
            <Text style={styles.viewToggleText}>List</Text>
          </Pressable>
          <Pressable style={[styles.viewToggle, styles.viewToggleActive]}>
            <Text style={styles.viewToggleTextActive}>Map</Text>
          </Pressable>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <LegendDot color={TRAVEL_ACCENT} label="Visited" />
          <LegendDot color={WISHLIST_GOLD} label="Wishlist" />
          <LegendDot color={BOTH_GREEN} label="Both" />
        </View>

        <Text style={styles.note}>
          Tile-based world map. Tap a tile to filter destinations by country.
          Mapbox pins unlock when the native map module is added.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={TRAVEL_ACCENT} />
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Map failed to load</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No destinations yet</Text>
            <Text style={styles.emptyBody}>
              Add a destination from the list view to see it pinned on your map.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push('/(travel)/destinations')}
            >
              <Text style={styles.primaryBtnText}>Go to list</Text>
            </Pressable>
          </View>
        ) : (
          CONTINENTS.map((cont) => {
            const countries = COUNTRIES.filter((c) => c.continent === cont.code);
            const touched = countries.filter(
              (c) => (states.get(c.code) ?? 'none') !== 'none',
            );
            if (touched.length === 0) return null;
            return (
              <View key={cont.code} style={styles.continent}>
                <Text style={styles.continentLabel}>{cont.label}</Text>
                <View style={styles.tileGrid}>
                  {countries.map((c) => {
                    const s = states.get(c.code) ?? 'none';
                    return (
                      <View
                        key={c.code}
                        style={[
                          styles.tile,
                          { backgroundColor: stateColor(s) },
                          s === 'none' && styles.tileMuted,
                        ]}
                      >
                        <Text style={styles.tileFlag}>{countryFlag(c.code)}</Text>
                        <Text
                          style={[
                            styles.tileCode,
                            s !== 'none' && styles.tileCodeActive,
                          ]}
                        >
                          {c.code}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        {/* Pin list (when destinations have lat/lng) */}
        {rows.some((r) => r.lat != null && r.lng != null) ? (
          <View style={styles.pinList}>
            <Text style={styles.pinListLabel}>Pinned destinations</Text>
            {rows
              .filter((r) => r.lat != null && r.lng != null)
              .map((r) => (
                <View key={r.id} style={styles.pinRow}>
                  <View
                    style={[
                      styles.pinOuter,
                      !isVisited(r) && styles.pinOuterHollow,
                      { borderColor: TRAVEL_ACCENT },
                    ]}
                  >
                    {isVisited(r) ? (
                      <View
                        style={[styles.pinInner, { backgroundColor: TRAVEL_ACCENT }]}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pinName}>{r.name}</Text>
                    <Text style={styles.pinCoords}>
                      {r.lat?.toFixed(2)}, {r.lng?.toFixed(2)}
                      {'  \u00B7  '}
                      {r.country ?? 'Unknown'}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  statsBadge: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.28)',
  },
  statsText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  statsEmph: { fontWeight: '800', color: TRAVEL_ACCENT },
  viewToggleRow: { flexDirection: 'row', gap: 8 },
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
  viewToggleText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  viewToggleTextActive: { color: TRAVEL_ACCENT, fontWeight: '700', fontSize: 13 },
  legend: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: colors.textSecondary, fontSize: 12 },
  note: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  continent: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continentLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tile: {
    width: 54,
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: 4,
  },
  tileMuted: { opacity: 0.4 },
  tileFlag: { fontSize: 16 },
  tileCode: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  tileCodeActive: { color: '#0E0E13' },
  pinList: {
    padding: 14,
    gap: 10,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinListLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinOuterHollow: { backgroundColor: 'transparent' },
  pinInner: { width: 8, height: 8, borderRadius: 4 },
  pinName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pinCoords: { color: colors.textSecondary, fontSize: 12 },
  center: { paddingVertical: 60, alignItems: 'center' },
  empty: {
    padding: 24,
    gap: 10,
    alignItems: 'center',
    backgroundColor: surfaceTiers.container,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: TRAVEL_ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryBtnText: { color: '#0E0E13', fontWeight: '800', fontSize: 14 },
  errorCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(147,0,10,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.3)',
    gap: 10,
  },
  errorTitle: { color: '#FFB4AB', fontSize: 15, fontWeight: '700' },
  errorBody: { color: colors.textSecondary, fontSize: 13 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
