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
  getBucketList,
  markVisited,
  type DestinationRecord,
} from '@mylife/travel';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  TRAVEL_ACCENT,
  WISHLIST_GOLD,
  countryFlag,
  isVisited,
} from './_components/dest-helpers';

export default function TravelBucketListScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [rows, setRows] = useState<DestinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(() => {
    try {
      setError(null);
      setRows(getBucketList(db));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bucket list');
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

  const visitedCount = useMemo(() => rows.filter(isVisited).length, [rows]);

  function handleVisit(id: string) {
    if (working) return;
    setWorking(id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      markVisited(db, id, today);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark visited');
    } finally {
      setWorking(null);
    }
  }

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
            tintColor={WISHLIST_GOLD}
          />
        }
      >
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Bucket list</Text>
          <Text style={styles.title}>Places you want to see</Text>
          <Text style={styles.summary}>
            {rows.length === 0
              ? 'Everything stays local and private. Add wishlist destinations from the list view.'
              : `${visitedCount} of ${rows.length} visited so far.`}
          </Text>
          <View style={styles.navRow}>
            <Pressable
              style={styles.navLink}
              onPress={() => router.push('/(travel)/destinations')}
            >
              <Text style={styles.navLinkText}>All destinations</Text>
            </Pressable>
            <Pressable
              style={styles.navLink}
              onPress={() => router.push('/(travel)/map')}
            >
              <Text style={styles.navLinkText}>World map</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={WISHLIST_GOLD} />
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load bucket list</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No wishlist yet</Text>
            <Text style={styles.emptyBody}>
              Start a list of dream destinations. Everything stays on this device.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push('/(travel)/destinations')}
            >
              <Text style={styles.primaryBtnText}>Add a destination</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {rows.map((d) => {
              const visited = isVisited(d);
              return (
                <View key={d.id} style={styles.card}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(travel)/destination/[id]',
                        params: { id: d.id },
                      })
                    }
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.flag}>{countryFlag(d.country_code)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {d.name}
                        </Text>
                        <Text style={styles.cardMeta} numberOfLines={1}>
                          {d.country ?? 'Unknown location'}
                          {d.priority != null ? `  \u00B7  Priority ${d.priority}` : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          {
                            borderColor: visited ? TRAVEL_ACCENT : WISHLIST_GOLD,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: visited ? TRAVEL_ACCENT : WISHLIST_GOLD },
                          ]}
                        >
                          {visited ? 'Visited' : 'Wishlist'}
                        </Text>
                      </View>
                    </View>
                  </Pressable>

                  {!visited ? (
                    <Pressable
                      onPress={() => handleVisit(d.id)}
                      style={[
                        styles.visitBtn,
                        working === d.id && { opacity: 0.5 },
                      ]}
                      disabled={working === d.id}
                    >
                      <Text style={styles.visitBtnText}>
                        {working === d.id ? 'Saving...' : 'Mark visited'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  headerCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,184,119,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,119,0.25)',
    gap: 6,
  },
  eyebrow: {
    color: WISHLIST_GOLD,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  summary: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  navRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  navLink: {},
  navLinkText: { color: TRAVEL_ACCENT, fontSize: 13, fontWeight: '600' },
  grid: { gap: 10 },
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
  cardName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textSecondary, fontSize: 13 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  visitBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TRAVEL_ACCENT,
    backgroundColor: 'rgba(14,165,233,0.14)',
  },
  visitBtnText: { color: TRAVEL_ACCENT, fontWeight: '700', fontSize: 12 },
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
    marginTop: 8,
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
