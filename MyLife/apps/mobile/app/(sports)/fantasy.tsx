import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import { listFantasyLeagues, type FantasyLeague } from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import { SPORTS_ACCENT } from './_ui';

function formatRecord(
  wins: number,
  losses: number,
  ties: number,
): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function sportLabel(sport: string): string {
  const key = sport.toLowerCase();
  if (key === 'nfl' || key === 'nba' || key === 'mlb' || key === 'nhl' || key === 'mls') {
    return key.toUpperCase();
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function SportsFantasyScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [leagues, setLeagues] = useState<FantasyLeague[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    try {
      setLeagues(listFantasyLeagues(db));
      setError(null);
    } catch (err) {
      console.error('[MySports] fantasy leagues load failed', err);
      setError(err instanceof Error ? err.message : 'Could not load leagues');
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const buckets = new Map<string, FantasyLeague[]>();
    for (const l of leagues) {
      const key = l.sport.toLowerCase();
      const list = buckets.get(key) ?? [];
      list.push(l);
      buckets.set(key, list);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, items]) => ({
        key,
        label: sportLabel(key),
        items,
      }));
  }, [leagues]);

  const isEmpty = leagues.length === 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Fantasy</Text>
        <Text style={styles.title}>Your leagues</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isEmpty ? (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>No leagues yet</Text>
            <Text style={styles.emptyBody}>
              Add your fantasy leagues to track records, rosters, and
              transactions in one place.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push('/(sports)/fantasy/add' as never)}
              accessibilityRole="button"
              accessibilityLabel="Add a league"
            >
              <Text style={styles.primaryBtnText}>Add a league</Text>
            </Pressable>
          </View>
        ) : (
          grouped.map((g) => (
            <View key={g.key} style={styles.group}>
              <Text style={styles.groupHeader}>{g.label}</Text>
              {g.items.map((l) => (
                <Pressable
                  key={l.id}
                  style={styles.row}
                  onPress={() =>
                    router.push(
                      `/(sports)/fantasy/${encodeURIComponent(l.id)}` as never,
                    )
                  }
                >
                  <View style={styles.rowHead}>
                    <Text style={styles.rowLeague} numberOfLines={1}>
                      {l.league_name}
                    </Text>
                    <Text style={styles.rowRecord}>
                      {formatRecord(l.record_wins, l.record_losses, l.record_ties)}
                    </Text>
                  </View>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {l.team_name} · {l.season} · {l.platform.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {!isEmpty ? (
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/(sports)/fantasy/add' as never)}
          accessibilityRole="button"
          accessibilityLabel="Add a league"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    padding: 20,
    paddingBottom: 160,
    gap: 10,
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  emptyHero: {
    gap: 12,
    padding: 24,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 36,
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  emptyBody: {
    color: '#D6C3B5',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  primaryBtn: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  group: {
    gap: 6,
    marginTop: 6,
  },
  groupHeader: {
    color: '#9F8E81',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  row: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLeague: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  rowRecord: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '800',
  },
  rowMeta: {
    color: '#D6C3B5',
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: {
    color: '#0E0E13',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 32,
  },
});
