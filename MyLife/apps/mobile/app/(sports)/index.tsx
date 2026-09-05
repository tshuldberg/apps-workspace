import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
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
  decideNotifications,
  fetchLiveScores,
  getGameById,
  listFollowedTeams,
  listGamesForTeams,
  pickInterval,
  upsertGames,
  type Game,
  type LeagueId,
  type Team,
} from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  dispatchLiveIntents,
  getSportsNotificationPermissionStatus,
  scheduleGameStart,
} from '../../lib/sports-notifications';
import { SPORTS_ACCENT } from './_ui';

const DAY_MS = 24 * 60 * 60 * 1000;
const ENABLED_KEY = 'sports.notifications.enabled';

function isNotificationsEnabled(
  db: ReturnType<typeof useDatabase>,
): boolean {
  try {
    const rows = db.query<{ value: string }>(
      'SELECT value FROM hub_settings WHERE key = ?',
      [ENABLED_KEY],
    );
    // Default ON -- per-team toggles control what actually fires.
    return rows[0]?.value !== '0';
  } catch {
    return false;
  }
}

type Grouped = {
  live: Game[];
  upcoming: Game[];
  final: Game[];
};

function uniqueLeagues(teams: readonly Team[]): LeagueId[] {
  const seen = new Set<LeagueId>();
  for (const t of teams) {
    seen.add(t.league as LeagueId);
  }
  return Array.from(seen);
}

function groupGames(games: readonly Game[]): Grouped {
  const live: Game[] = [];
  const upcoming: Game[] = [];
  const final: Game[] = [];
  for (const g of games) {
    if (g.status === 'live') live.push(g);
    else if (g.status === 'final') final.push(g);
    else upcoming.push(g);
  }
  live.sort((a, b) => a.startAt - b.startAt);
  upcoming.sort((a, b) => a.startAt - b.startAt);
  final.sort((a, b) => b.startAt - a.startAt);
  return { live, upcoming, final };
}

function formatKickoff(startAt: number): string {
  const d = new Date(startAt);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function SportsScoresScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [followed, setFollowed] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const readFollowed = useCallback((): Team[] => {
    try {
      const rows = listFollowedTeams(db);
      setFollowed(rows);
      return rows;
    } catch (err) {
      console.error('[MySports] failed to read followed teams', err);
      return [];
    }
  }, [db]);

  const readCachedGames = useCallback((teams: readonly Team[]): Game[] => {
    if (teams.length === 0) {
      setGames([]);
      return [];
    }
    const teamIds = teams.map((t) => t.id);
    const now = Date.now();
    const rows = listGamesForTeams(db, teamIds, {
      since: now - DAY_MS,
      until: now + DAY_MS,
    });
    setGames(rows);
    return rows;
  }, [db]);

  const refresh = useCallback(
    async (teams: readonly Team[]) => {
      if (teams.length === 0) {
        setIsRefreshing(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsRefreshing(true);
      setError(null);
      try {
        const leagues = uniqueLeagues(teams);
        const fresh = await fetchLiveScores({
          leagues,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        // Collect pre-upsert rows per game so the rule engine has a prev
        // state to diff against. Dispatch AFTER upsert so the cache is
        // consistent even if the dispatcher throws.
        const prevByGameId = new Map<string, Game | null>();
        for (const g of fresh) {
          prevByGameId.set(g.id, getGameById(db, g.id));
        }

        upsertGames(db, fresh);
        readCachedGames(teams);

        // Fire live intents. Safe-guarded: never let notification errors
        // break the scoreboard.
        if (isNotificationsEnabled(db)) {
          try {
            const permission = await getSportsNotificationPermissionStatus();
            if (permission === 'granted') {
              const teamById = new Map(teams.map((t) => [t.id, t]));
              const allIntents = [] as ReturnType<typeof decideNotifications>;
              for (const g of fresh) {
                for (const side of ['home', 'away'] as const) {
                  const teamId = g[side].id;
                  if (!teamId) continue;
                  const t = teamById.get(teamId);
                  if (!t) continue;
                  allIntents.push(
                    ...decideNotifications({
                      team: t,
                      prevGame: prevByGameId.get(g.id) ?? null,
                      nextGame: g,
                    }),
                  );
                }
              }
              if (allIntents.length > 0) {
                await dispatchLiveIntents(db, allIntents);
              }
            }
          } catch (err) {
            console.error('[MySports] notification dispatch failed', err);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to refresh');
      } finally {
        if (!controller.signal.aborted) setIsRefreshing(false);
      }
    },
    [db, readCachedGames],
  );

  // Initial load -- read followed teams, seed from cache, then kick off a refresh.
  useEffect(() => {
    const teams = readFollowed();
    readCachedGames(teams);
    if (teams.length > 0) {
      void refresh(teams);
    }
    return () => {
      abortRef.current?.abort();
    };
    // readFollowed / readCachedGames / refresh are stable by `db` identity.
  }, [readFollowed, readCachedGames, refresh]);

  // Schedule upcoming-game notifications for followed teams within 24h.
  // Idempotent via sp_notifications_log dedupe; safe to run on every games change.
  useEffect(() => {
    if (!isNotificationsEnabled(db)) return;
    if (followed.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const permission = await getSportsNotificationPermissionStatus();
        if (cancelled || permission !== 'granted') return;
        const now = Date.now();
        const teamById = new Map(followed.map((t) => [t.id, t]));
        for (const g of games) {
          if (g.status !== 'scheduled') continue;
          if (g.startAt - now > DAY_MS) continue;
          if (g.startAt - now < 5 * 60 * 1000) continue;
          for (const side of ['home', 'away'] as const) {
            const teamId = g[side].id;
            if (!teamId) continue;
            const t = teamById.get(teamId);
            if (!t) continue;
            try {
              await scheduleGameStart(db, t, g);
            } catch (err) {
              console.error('[MySports] scheduleGameStart failed', err);
            }
          }
        }
      } catch (err) {
        console.error('[MySports] schedule upcoming failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, followed, games]);

  const grouped = useMemo(() => groupGames(games), [games]);

  // Polling driven by pickInterval + AppState.
  const pollMs = useMemo(() => pickInterval(games), [games]);

  useEffect(() => {
    if (followed.length === 0) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isActive = AppState.currentState === 'active';

    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        void refresh(followed);
      }, pollMs);
    };

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    if (isActive) start();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        if (!isActive) {
          // Resume: do an immediate refresh and restart the interval.
          isActive = true;
          void refresh(followed);
          start();
        }
      } else {
        isActive = false;
        stop();
      }
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [followed, pollMs, refresh]);

  if (followed.length === 0) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Scores</Text>
          <Text style={styles.title}>Your sports day, in one quiet place</Text>
          <Text style={styles.subtitle}>
            Follow a team to see live scores, upcoming games, and finals
            without ads, sponsored picks, or dark-pattern betting funnels.
          </Text>
        </View>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/(sports)/teams' as never)}
          accessibilityRole="button"
          accessibilityLabel="Follow your first team"
        >
          <Text style={styles.primaryButtonText}>Follow your first team</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void refresh(followed)}
          tintColor={SPORTS_ACCENT}
        />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Today</Text>
        <Text style={styles.title}>
          {followed.length === 1
            ? `1 team followed`
            : `${followed.length} teams followed`}
        </Text>
        <Text style={styles.subtitle}>
          Live, upcoming, and final scores for the teams you follow.
        </Text>
        <View style={styles.heroLinks}>
          <Pressable
            onPress={() => router.push('/(sports)/standings' as never)}
            style={styles.standingsLink}
            accessibilityRole="button"
            accessibilityLabel="View standings"
          >
            <Text style={styles.standingsLinkText}>View standings →</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(sports)/schedule' as never)}
            style={styles.standingsLink}
            accessibilityRole="button"
            accessibilityLabel="View full schedule"
          >
            <Text style={styles.standingsLinkText}>
              View full schedule →
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {grouped.live.length > 0 ? (
        <ScoreGroup title="Live" accent games={grouped.live} />
      ) : null}
      {grouped.upcoming.length > 0 ? (
        <ScoreGroup title="Upcoming today" games={grouped.upcoming} />
      ) : null}
      {grouped.final.length > 0 ? (
        <ScoreGroup title="Final" games={grouped.final} />
      ) : null}

      {grouped.live.length === 0 &&
      grouped.upcoming.length === 0 &&
      grouped.final.length === 0 ? (
        <View style={styles.emptyCard}>
          {isRefreshing ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={SPORTS_ACCENT} />
              <Text style={styles.emptyText}>Checking scores…</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No games today for your followed teams. Pull to refresh.
            </Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function ScoreGroup({
  title,
  games,
  accent,
}: {
  title: string;
  games: Game[];
  accent?: boolean;
}) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupHeader, accent && styles.groupHeaderAccent]}>
        {title}
      </Text>
      {games.map((g) => (
        <ScoreCard key={g.id} game={g} />
      ))}
    </View>
  );
}

function ScoreCard({ game }: { game: Game }) {
  const pillStyle =
    game.status === 'live'
      ? [styles.statusPill, styles.statusPillLive]
      : [styles.statusPill];
  const pillTextStyle =
    game.status === 'live'
      ? [styles.statusText, styles.statusTextLive]
      : [styles.statusText];

  const statusLabel =
    game.status === 'live'
      ? game.period ?? 'Live'
      : game.status === 'final'
        ? 'Final'
        : formatKickoff(game.startAt);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.leagueText}>{game.league.toUpperCase()}</Text>
        <View style={pillStyle}>
          <Text style={pillTextStyle}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.teamRow}>
        <Text style={styles.teamName} numberOfLines={1}>
          {game.away.name}
        </Text>
        <Text style={styles.scoreText}>
          {game.away.score !== null && game.away.score !== undefined
            ? game.away.score
            : '—'}
        </Text>
      </View>
      <View style={styles.teamRow}>
        <Text style={styles.teamName} numberOfLines={1}>
          {game.home.name}
        </Text>
        <Text style={styles.scoreText}>
          {game.home.score !== null && game.home.score !== undefined
            ? game.home.score
            : '—'}
        </Text>
      </View>
      {game.status === 'live' && game.clock ? (
        <Text style={styles.clockText}>{game.clock}</Text>
      ) : null}
      {game.broadcast ? (
        <Text style={styles.broadcastText}>{game.broadcast}</Text>
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
  primaryButton: {
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: SPORTS_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  heroLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 4,
  },
  standingsLink: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  standingsLinkText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
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
  groupHeaderAccent: {
    color: SPORTS_ACCENT,
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
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPillLive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextLive: {
    color: '#0E0E13',
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
  clockText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  broadcastText: {
    color: colors.textSecondary,
    fontSize: 12,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
