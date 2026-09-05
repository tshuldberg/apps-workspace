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
import { useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  fetchTeamSchedule,
  listFollowedTeams,
  upsertGames,
  type Game,
  type LeagueId,
  type Team,
} from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import { SPORTS_ACCENT } from './_ui';

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function groupByDateKey(games: readonly Game[]): Array<{ key: string; label: string; items: Game[] }> {
  const groups = new Map<string, Game[]>();
  for (const g of games) {
    const d = new Date(g.startAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = groups.get(key) ?? [];
    list.push(g);
    groups.set(key, list);
  }
  const sortedKeys = Array.from(groups.keys()).sort();
  return sortedKeys.map((key) => {
    const sample = groups.get(key)![0];
    const d = new Date(sample.startAt);
    const label = d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return {
      key,
      label,
      items: groups.get(key)!.sort((a, b) => a.startAt - b.startAt),
    };
  });
}

function formatKickoff(startAt: number): string {
  return new Date(startAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SportsScheduleScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [followed, setFollowed] = useState<Team[]>(() => {
    try {
      return listFollowedTeams(db);
    } catch {
      return [];
    }
  });
  const [games, setGames] = useState<Game[]>([]);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async (teams: readonly Team[]) => {
      if (teams.length === 0) {
        setIsLoading(false);
        setGames([]);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setError(null);
      try {
        const perTeam = await Promise.all(
          teams.map((team) =>
            fetchTeamSchedule({
              teamId: team.id,
              league: team.league as LeagueId,
              signal: controller.signal,
            }).catch(() => [] as Game[]),
          ),
        );
        if (controller.signal.aborted) return;
        const dedup = new Map<string, Game>();
        for (const list of perTeam) {
          for (const g of list) dedup.set(g.id, g);
        }
        const merged = Array.from(dedup.values());
        upsertGames(db, merged);
        const now = Date.now();
        const windowed = merged
          .filter(
            (g) => g.startAt >= now - WINDOW_MS && g.startAt <= now + WINDOW_MS,
          )
          .sort((a, b) => a.startAt - b.startAt);
        setGames(windowed);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
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
    void refresh(current);
    return () => abortRef.current?.abort();
  }, [db, refresh]);

  const filtered = useMemo(() => {
    if (!teamFilter) return games;
    return games.filter(
      (g) => g.home.id === teamFilter || g.away.id === teamFilter,
    );
  }, [games, teamFilter]);

  const grouped = useMemo(() => groupByDateKey(filtered), [filtered]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => void refresh(followed)}
          tintColor={SPORTS_ACCENT}
        />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Schedule</Text>
        <Text style={styles.title}>All upcoming games</Text>
        <Text style={styles.subtitle}>
          Next 30 days across every team you follow. Tap a game for the box
          score.
        </Text>
        <Pressable
          onPress={() => router.push('/(sports)/history' as never)}
          style={styles.historyLink}
          accessibilityRole="button"
        >
          <Text style={styles.historyLinkText}>View history →</Text>
        </Pressable>
      </View>

      {followed.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            onPress={() => setTeamFilter(null)}
            style={[styles.chip, teamFilter === null && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: teamFilter === null }}
          >
            <Text
              style={[
                styles.chipText,
                teamFilter === null && styles.chipTextActive,
              ]}
            >
              All teams
            </Text>
          </Pressable>
          {followed.map((team) => {
            const externalId = team.id.split(':').pop() ?? team.id;
            const active = teamFilter === externalId;
            return (
              <Pressable
                key={team.id}
                onPress={() => setTeamFilter(active ? null : externalId)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {team.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading && games.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={SPORTS_ACCENT} />
          <Text style={styles.loadingText}>Loading schedule…</Text>
        </View>
      ) : null}

      {!isLoading && grouped.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {followed.length === 0
              ? "You're not following any teams yet. Head to the Teams tab to follow one."
              : 'No scheduled games in the next 30 days. Pull to refresh.'}
          </Text>
        </View>
      ) : null}

      {grouped.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.groupHeader}>{group.label}</Text>
          {group.items.map((g) => (
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
                <Text style={styles.statusText}>
                  {g.status === 'live'
                    ? g.period ?? 'Live'
                    : g.status === 'final'
                      ? 'Final'
                      : formatKickoff(g.startAt)}
                </Text>
              </View>
              <View style={styles.teamRow}>
                <Text style={styles.teamName} numberOfLines={1}>
                  {g.away.name}
                </Text>
                <Text style={styles.scoreText}>
                  {g.away.score ?? '—'}
                </Text>
              </View>
              <View style={styles.teamRow}>
                <Text style={styles.teamName} numberOfLines={1}>
                  {g.home.name}
                </Text>
                <Text style={styles.scoreText}>
                  {g.home.score ?? '—'}
                </Text>
              </View>
              {g.broadcast ? (
                <Text style={styles.broadcastText}>{g.broadcast}</Text>
              ) : null}
            </Pressable>
          ))}
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
  broadcastText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  historyLink: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  historyLinkText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
});
