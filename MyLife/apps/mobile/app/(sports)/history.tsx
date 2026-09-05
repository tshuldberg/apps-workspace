import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  computeCoveredDates,
  fetchHistorySlice,
  listByDateRange,
  listFollowedTeams,
  upsertGames,
  type Game,
  type LeagueId,
  type Team,
} from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import { SPORTS_ACCENT } from './_ui';

type RangeKey = '7d' | '30d' | '90d';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const RESULT_COLORS = {
  win: SPORTS_ACCENT,
  loss: '#E57373',
  draw: colors.outline,
  neutral: colors.textSecondary,
} as const;

interface BadgeSpec {
  label: 'W' | 'L' | 'D' | '—';
  color: string;
}

function resultFor(
  game: Game,
  followedSet: ReadonlySet<string>,
): BadgeSpec | null {
  if (game.status !== 'final') return null;
  const homeId = game.home.id ?? null;
  const awayId = game.away.id ?? null;
  const side: 'home' | 'away' | null =
    homeId && followedSet.has(homeId)
      ? 'home'
      : awayId && followedSet.has(awayId)
        ? 'away'
        : null;
  if (!side) return null;
  const hs = game.home.score ?? null;
  const as = game.away.score ?? null;
  if (hs === null || as === null) return { label: '—', color: RESULT_COLORS.neutral };
  if (hs === as) return { label: 'D', color: RESULT_COLORS.draw };
  const home = side === 'home';
  const won = home ? hs > as : as > hs;
  return won
    ? { label: 'W', color: RESULT_COLORS.win }
    : { label: 'L', color: RESULT_COLORS.loss };
}

function groupByDateKey(
  games: readonly Game[],
): Array<{ key: string; label: string; items: Game[] }> {
  const groups = new Map<string, Game[]>();
  for (const g of games) {
    const d = new Date(g.startAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = groups.get(key) ?? [];
    list.push(g);
    groups.set(key, list);
  }
  // Descending date order for history.
  const sortedKeys = Array.from(groups.keys()).sort().reverse();
  return sortedKeys.map((key) => {
    const items = groups.get(key)!.sort((a, b) => b.startAt - a.startAt);
    const d = new Date(items[0].startAt);
    const label = d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return { key, label, items };
  });
}

function uniqueLeagues(teams: readonly Team[]): LeagueId[] {
  const seen = new Set<LeagueId>();
  for (const t of teams) seen.add(t.league as LeagueId);
  return Array.from(seen);
}

export default function SportsHistoryScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { teamId: teamIdParam } = useLocalSearchParams<{ teamId?: string }>();
  const teamIdFilter = typeof teamIdParam === 'string' ? teamIdParam : null;

  const [followed, setFollowed] = useState<Team[]>(() => {
    try {
      return listFollowedTeams(db);
    } catch {
      return [];
    }
  });
  const [range, setRange] = useState<RangeKey>('30d');
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const teamIds = useMemo(() => {
    if (teamIdFilter) {
      return followed
        .filter((t) => t.id === teamIdFilter || t.id.endsWith(`:${teamIdFilter}`))
        .map((t) => t.id);
    }
    return followed.map((t) => t.id);
  }, [followed, teamIdFilter]);

  const followedSet = useMemo(() => new Set(teamIds), [teamIds]);

  const load = useCallback(
    async (opts: { teams: readonly Team[]; activeIds: readonly string[]; key: RangeKey }) => {
      if (opts.activeIds.length === 0) {
        setGames([]);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setError(null);

      const now = Date.now();
      const since = now - RANGE_DAYS[opts.key] * DAY_MS;
      const until = now;

      try {
        // 1. Read local cache.
        let cached: Game[] = [];
        try {
          cached = listByDateRange(db, opts.activeIds, { since, until });
        } catch {
          /* ignore cache read failure */
        }
        if (!controller.signal.aborted) setGames(cached);

        // 2. Gap-fill missing days.
        const covered = computeCoveredDates(cached, opts.activeIds);
        const leagues = uniqueLeagues(opts.teams);
        const fresh = await fetchHistorySlice({
          teamIds: opts.activeIds,
          leagues,
          since,
          until,
          coveredDates: covered,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        // 3. Upsert + re-read to merge cache.
        if (fresh.length > 0) {
          try {
            upsertGames(db, fresh);
          } catch {
            /* ignore cache write failure */
          }
        }
        let merged: Game[] = cached;
        try {
          merged = listByDateRange(db, opts.activeIds, { since, until });
        } catch {
          /* ignore */
        }
        if (!controller.signal.aborted) setGames(merged);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [db],
  );

  useEffect(() => {
    let current: Team[] = [];
    try {
      current = listFollowedTeams(db);
      setFollowed(current);
    } catch {
      /* ignore */
    }
    const activeIds = teamIdFilter
      ? current
          .filter((t) => t.id === teamIdFilter || t.id.endsWith(`:${teamIdFilter}`))
          .map((t) => t.id)
      : current.map((t) => t.id);
    void load({ teams: current, activeIds, key: range });
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, range, teamIdFilter]);

  const grouped = useMemo(() => groupByDateKey(games), [games]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() =>
            void load({ teams: followed, activeIds: teamIds, key: range })
          }
          tintColor={SPORTS_ACCENT}
        />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>History</Text>
        <Text style={styles.title}>Past games</Text>
        <Text style={styles.subtitle}>
          Final scores for every team you follow. Pull to refresh.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {(Object.keys(RANGE_DAYS) as RangeKey[]).map((key) => {
          const active = range === key;
          return (
            <Pressable
              key={key}
              onPress={() => setRange(key)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {key === '7d' ? 'Last 7 days' : key === '30d' ? 'Last 30 days' : 'Last 90 days'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading && games.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={SPORTS_ACCENT} />
          <Text style={styles.loadingText}>Loading history…</Text>
        </View>
      ) : null}

      {!isLoading && grouped.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {followed.length === 0
              ? "You're not following any teams yet. Head to the Teams tab to follow one."
              : 'No final scores in this window yet. Pull to refresh or widen the range.'}
          </Text>
        </View>
      ) : null}

      {grouped.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.groupHeader}>{group.label}</Text>
          {group.items.map((g) => {
            const badge = resultFor(g, followedSet);
            return (
              <Pressable
                key={g.id}
                onPress={() =>
                  router.push(
                    `/(sports)/game/${encodeURIComponent(g.id)}?league=${g.league}` as never,
                  )
                }
                style={styles.card}
                accessibilityRole="button"
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.leagueText}>{g.league.toUpperCase()}</Text>
                  <Text style={styles.statusText}>Final</Text>
                </View>
                <View style={styles.teamRow}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {g.away.name}
                  </Text>
                  <Text style={styles.scoreText}>{g.away.score ?? '—'}</Text>
                </View>
                <View style={styles.teamRow}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {g.home.name}
                  </Text>
                  <Text style={styles.scoreText}>{g.home.score ?? '—'}</Text>
                </View>
                {badge ? (
                  <View
                    style={[styles.badge, { borderColor: badge.color }]}
                  >
                    <Text style={[styles.badgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  heroCard: {
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0E0E13',
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  group: {
    gap: 8,
    marginTop: 4,
  },
  groupHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  card: {
    gap: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leagueText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  scoreText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'right',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
