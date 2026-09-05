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
  LAUNCH_LEAGUES,
  fetchStandings,
  listFollowedTeams,
  type LeagueId,
  type StandingGroup,
  type Team,
} from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import { SPORTS_ACCENT } from './_ui';

function defaultLeague(followed: readonly Team[]): LeagueId {
  const first = followed[0];
  if (first) return first.league as LeagueId;
  return 'nfl';
}

export default function SportsStandingsScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ league?: string }>();

  const [followed, setFollowed] = useState<Team[]>(() => {
    try {
      return listFollowedTeams(db);
    } catch {
      return [];
    }
  });
  const followedIds = useMemo(
    () => new Set(followed.map((t) => t.id)),
    [followed],
  );

  const initialLeague = useMemo<LeagueId>(() => {
    const fromParam = typeof params.league === 'string' ? params.league : null;
    const valid = LAUNCH_LEAGUES.some((l) => l.id === fromParam);
    if (valid && fromParam) return fromParam as LeagueId;
    return defaultLeague(followed);
  }, [params.league, followed]);

  const [league, setLeague] = useState<LeagueId>(initialLeague);
  const [groups, setGroups] = useState<StandingGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async (target: LeagueId) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setError(null);
      try {
        const next = await fetchStandings({
          league: target,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setGroups(next);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load standings');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    try {
      setFollowed(listFollowedTeams(db));
    } catch {
      /* ignore */
    }
  }, [db]);

  useEffect(() => {
    void refresh(league);
    return () => {
      abortRef.current?.abort();
    };
  }, [league, refresh]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => void refresh(league)}
          tintColor={SPORTS_ACCENT}
        />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Standings</Text>
        <Text style={styles.title}>League tables</Text>
        <Text style={styles.subtitle}>
          Conference and division records across the NFL, NBA, MLB, NHL, and MLS.
          Followed teams are highlighted.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {LAUNCH_LEAGUES.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => setLeague(l.id)}
            style={[styles.chip, league === l.id && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: league === l.id }}
          >
            <Text
              style={[
                styles.chipText,
                league === l.id && styles.chipTextActive,
              ]}
            >
              {l.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading && groups.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={SPORTS_ACCENT} />
          <Text style={styles.loadingText}>Loading standings…</Text>
        </View>
      ) : groups.length === 0 && !error ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No standings available right now. Pull to refresh.
          </Text>
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={`${g.conference ?? ''}|${g.division ?? ''}`} style={styles.group}>
          <Text style={styles.groupHeader}>
            {g.division ?? g.conference ?? league.toUpperCase()}
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.colTeam, styles.headerText]}>Team</Text>
            <Text style={[styles.colRecord, styles.headerText]}>W-L-T</Text>
            <Text style={[styles.colPct, styles.headerText]}>PCT</Text>
          </View>
          {g.rows.map((row) => {
            const isFollowed = followedIds.has(row.teamId);
            return (
              <Pressable
                key={row.teamId}
                onPress={() =>
                  router.push(
                    `/(sports)/team/${encodeURIComponent(row.teamId)}` as never,
                  )
                }
                style={[styles.row, isFollowed && styles.rowFollowed]}
                accessibilityRole="button"
              >
                <View style={styles.colTeam}>
                  <Text
                    style={[styles.teamName, isFollowed && styles.teamNameFollowed]}
                    numberOfLines={1}
                  >
                    {row.teamAbbreviation
                      ? `${row.teamAbbreviation} · `
                      : ''}
                    {row.teamName}
                  </Text>
                  {row.streak ? (
                    <Text style={styles.meta}>Streak: {row.streak}</Text>
                  ) : null}
                </View>
                <Text style={[styles.colRecord, styles.numText]}>
                  {row.wins}-{row.losses}
                  {row.ties > 0 ? `-${row.ties}` : ''}
                </Text>
                <Text style={[styles.colPct, styles.numText]}>
                  {row.winPct.toFixed(3).replace(/^0/, '')}
                </Text>
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
    gap: 6,
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
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  headerText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  colTeam: {
    flex: 1,
  },
  colRecord: {
    width: 72,
    textAlign: 'right',
  },
  colPct: {
    width: 56,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowFollowed: {
    borderColor: SPORTS_ACCENT,
    backgroundColor: 'rgba(22,163,74,0.08)',
  },
  teamName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  teamNameFollowed: {
    color: SPORTS_ACCENT,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  numText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
