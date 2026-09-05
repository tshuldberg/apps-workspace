import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  getUpcomingGames,
  listRecLeagues,
  type RecLeague,
  type ScheduleEntry,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

type UpcomingRow = {
  league: RecLeague;
  entry: ScheduleEntry;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function sportIcon(sport: string): string {
  const map: Record<string, string> = {
    basketball: '🏀',
    soccer: '⚽️',
    tennis: '🎾',
    golf: '⛳️',
    running: '🏃',
    volleyball: '🏐',
    softball: '🥎',
    baseball: '⚾️',
    hockey: '🏒',
  };
  return map[sport] ?? '🏟️';
}

function nextGameForLeague(league: RecLeague, nowMs: number): ScheduleEntry | null {
  const upcoming = league.schedule
    .filter((e) => e.starts_at > nowMs)
    .slice()
    .sort((a, b) => a.starts_at - b.starts_at);
  return upcoming[0] ?? null;
}

export default function SportsRecLeaguesScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [leagues, setLeagues] = useState<RecLeague[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);

  const reload = useCallback(() => {
    const rows = listRecLeagues(db);
    setLeagues(rows);
    const now = Date.now();
    const strip: UpcomingRow[] = [];
    for (const league of rows) {
      const entries = getUpcomingGames(db, league.id, now);
      for (const entry of entries) {
        strip.push({ league, entry });
      }
    }
    strip.sort((a, b) => a.entry.starts_at - b.entry.starts_at);
    setUpcoming(strip.slice(0, 5));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const nowMs = useMemo(() => Date.now(), []);
  const hasLeagues = leagues.length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Rec leagues</Text>
      <Text style={styles.title}>Your seasons</Text>
      <Text style={styles.subtitle}>
        Track rec-league games, record, and upcoming matchups. Private to this device.
      </Text>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push('/(sports)/play/leagues/add' as never)}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>Add league</Text>
      </Pressable>

      {upcoming.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Upcoming games</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripRow}
          >
            {upcoming.map((row, idx) => (
              <Pressable
                key={`${row.league.id}-${idx}`}
                style={styles.stripCard}
                onPress={() =>
                  router.push(`/(sports)/play/leagues/${row.league.id}` as never)
                }
              >
                <Text style={styles.stripIcon}>{sportIcon(row.league.sport)}</Text>
                <Text style={styles.stripOpp}>vs {row.entry.opponent}</Text>
                <Text style={styles.stripLeague}>{row.league.league_name}</Text>
                <Text style={styles.stripDate}>
                  {formatDate(row.entry.starts_at)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.blockLabel}>Leagues</Text>
        {hasLeagues ? (
          leagues.map((league) => {
            const next = nextGameForLeague(league, nowMs);
            return (
              <Pressable
                key={league.id}
                style={styles.leagueRow}
                onPress={() =>
                  router.push(`/(sports)/play/leagues/${league.id}` as never)
                }
                accessibilityRole="button"
              >
                <Text style={styles.leagueIcon}>{sportIcon(league.sport)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leagueName}>{league.league_name}</Text>
                  <Text style={styles.leagueMeta}>
                    {league.team_name} · {league.season}
                  </Text>
                  <Text style={styles.leagueRecord}>
                    {league.record_wins}-{league.record_losses}-
                    {league.record_ties}
                    {next ? ` · next ${formatDate(next.starts_at)}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No rec leagues yet. Tap Add league to start tracking your season.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
    gap: 12,
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
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: SPORTS_ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  block: {
    gap: 10,
    marginTop: 8,
  },
  blockLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  stripRow: {
    gap: 10,
    paddingRight: 4,
  },
  stripCard: {
    width: 170,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  stripIcon: {
    fontSize: 22,
  },
  stripOpp: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stripLeague: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  stripDate: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leagueIcon: {
    fontSize: 24,
  },
  leagueName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  leagueMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  leagueRecord: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
