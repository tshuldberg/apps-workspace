import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  fetchFuturesOdds,
  getSetting,
  listBets,
  type Bet,
  type LeagueId,
  type OddsSnapshot,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

const DANGER = '#E57373';
const MUTED = '#9F8E81';

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatAmerican(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function normalizeLeague(raw: string): LeagueId | null {
  const lo = raw.toLowerCase();
  if (
    lo === 'nfl' ||
    lo === 'nba' ||
    lo === 'mlb' ||
    lo === 'nhl' ||
    lo === 'mls'
  )
    return lo;
  return null;
}

export default function SportsFuturesScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [bets, setBets] = useState<Bet[]>([]);
  const [currentOdds, setCurrentOdds] = useState<
    Map<LeagueId, OddsSnapshot[] | null>
  >(new Map());
  const [loaded, setLoaded] = useState(false);

  const loadBets = useCallback(() => {
    try {
      const rows = listBets(db, { bet_type: 'future', limit: 200 });
      setBets(rows);
    } catch (err) {
      console.error('[MySports] futures load failed', err);
    }
  }, [db]);

  useEffect(() => {
    loadBets();
  }, [loadBets]);

  // Fetch current odds for the leagues covered by any OPEN future.
  useEffect(() => {
    const openLeagues = new Set<LeagueId>();
    for (const b of bets) {
      if (b.result !== 'pending') continue;
      const lid = normalizeLeague(b.league);
      if (lid) openLeagues.add(lid);
    }
    if (openLeagues.size === 0) {
      setLoaded(true);
      return;
    }
    let apiKey: string | null = null;
    try {
      apiKey = getSetting(db, 'odds_api_key');
    } catch (err) {
      console.warn('[MySports] futures: could not read api key', err);
    }
    const controller = new AbortController();
    (async () => {
      const next = new Map<LeagueId, OddsSnapshot[] | null>();
      await Promise.all(
        Array.from(openLeagues).map(async (lid) => {
          try {
            const snaps = await fetchFuturesOdds({
              league: lid,
              apiKey,
              signal: controller.signal,
            });
            next.set(lid, snaps);
          } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              console.warn('[MySports] futures fetch failed', lid, err);
            }
            next.set(lid, null);
          }
        }),
      );
      setCurrentOdds(next);
      setLoaded(true);
    })();
    return () => controller.abort();
  }, [bets, db]);

  const { pending, settled } = useMemo(() => {
    const pending: Bet[] = [];
    const settled: Bet[] = [];
    for (const b of bets) {
      if (b.result === 'pending') pending.push(b);
      else settled.push(b);
    }
    return { pending, settled };
  }, [bets]);

  function currentOddsForBet(bet: Bet): number | null {
    const lid = normalizeLeague(bet.league);
    if (!lid) return null;
    const snaps = currentOdds.get(lid);
    if (!snaps) return null;
    // Naive match: team/player name appears in description (case-insensitive).
    const desc = bet.description.toLowerCase();
    let best: OddsSnapshot | null = null;
    for (const s of snaps) {
      if (desc.includes(s.team.toLowerCase())) {
        if (!best || s.fetched_at > best.fetched_at) best = s;
      }
    }
    return best ? best.price_american : null;
  }

  function deltaChip(taken: number, current: number | null): React.ReactNode {
    if (current === null) return null;
    // For futures, a "better" line generally means longer odds on our side
    // (higher positive, or less-negative). Keep the heuristic simple.
    const delta = current - taken;
    if (delta === 0) {
      return (
        <View style={[styles.deltaChip, { borderColor: MUTED }]}>
          <Text style={[styles.deltaText, { color: MUTED }]}>flat</Text>
        </View>
      );
    }
    const favored = delta > 0;
    return (
      <View
        style={[
          styles.deltaChip,
          { borderColor: favored ? SPORTS_ACCENT : DANGER },
        ]}
      >
        <Text
          style={[
            styles.deltaText,
            { color: favored ? SPORTS_ACCENT : DANGER },
          ]}
        >
          {favored ? '↑' : '↓'} {formatAmerican(current)}
        </Text>
      </View>
    );
  }

  const hasAnyCurrent = useMemo(() => {
    for (const v of currentOdds.values()) if (v !== null) return true;
    return false;
  }, [currentOdds]);
  const anyPendingAwaiting =
    loaded && pending.length > 0 && !hasAnyCurrent;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Futures</Text>
      <Text style={styles.title}>Long-shot journal</Text>

      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push('/(sports)/bet/log?type=future' as never)
        }
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+ Log a future</Text>
      </Pressable>

      <Text style={styles.sectionHeader}>Open</Text>
      {pending.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No open futures. Tap "Log a future" to track championship or
            season-long wagers.
          </Text>
        </View>
      ) : null}
      {pending.map((bet) => {
        const cur = currentOddsForBet(bet);
        return (
          <Pressable
            key={bet.id}
            style={styles.row}
            onPress={() =>
              router.push(
                `/(sports)/bet/${encodeURIComponent(bet.id)}` as never,
              )
            }
          >
            <View style={styles.rowHeader}>
              <Text style={styles.rowType}>FUTURE</Text>
              <Text style={styles.rowLeague}>{bet.league.toUpperCase()}</Text>
              <Text style={styles.rowDate}>
                {new Date(bet.placed_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <Text style={styles.rowDescription} numberOfLines={3}>
              {bet.description}
            </Text>
            <View style={styles.rowFoot}>
              <Text style={styles.rowOdds}>
                Taken {formatAmerican(bet.odds_american)} ·{' '}
                {formatMoney(bet.stake_cents)}
              </Text>
              {deltaChip(bet.odds_american, cur)}
            </View>
          </Pressable>
        );
      })}

      {anyPendingAwaiting ? (
        <Pressable
          style={styles.unavailableCard}
          onPress={() => router.push('/(sports)/settings' as never)}
          accessibilityRole="button"
        >
          <Text style={styles.unavailableText}>
            Current odds unavailable — add an Odds API key in Settings to
            show delta chips.
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionHeader}>Settled</Text>
      {settled.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Settled futures will appear here once they are resolved.
          </Text>
        </View>
      ) : null}
      {settled.map((bet) => (
        <Pressable
          key={bet.id}
          style={styles.row}
          onPress={() =>
            router.push(`/(sports)/bet/${encodeURIComponent(bet.id)}` as never)
          }
        >
          <View style={styles.rowHeader}>
            <Text style={styles.rowType}>FUTURE</Text>
            <Text style={styles.rowLeague}>{bet.league.toUpperCase()}</Text>
            <Text style={styles.rowDate}>
              {new Date(bet.settled_at ?? bet.placed_at).toLocaleDateString(
                [],
                { month: 'short', day: 'numeric' },
              )}
            </Text>
          </View>
          <Text style={styles.rowDescription} numberOfLines={3}>
            {bet.description}
          </Text>
          <View style={styles.rowFoot}>
            <Text style={styles.rowOdds}>
              {formatAmerican(bet.odds_american)} ·{' '}
              {formatMoney(bet.stake_cents)}
            </Text>
            <Text
              style={[
                styles.rowOdds,
                {
                  color:
                    bet.profit_loss_cents > 0
                      ? SPORTS_ACCENT
                      : bet.profit_loss_cents < 0
                        ? DANGER
                        : MUTED,
                  fontWeight: '800',
                },
              ]}
            >
              {bet.result.toUpperCase()}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 160, gap: 10 },
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
    marginBottom: 4,
  },
  fab: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: SPORTS_ACCENT,
    marginBottom: 6,
  },
  fabText: { color: '#0E0E13', fontWeight: '800', fontSize: 14 },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  emptyCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowType: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  rowLeague: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  rowDate: {
    marginLeft: 'auto',
    color: colors.textSecondary,
    fontSize: 12,
  },
  rowDescription: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  rowFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowOdds: { color: colors.textSecondary, fontSize: 13 },
  deltaChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  deltaText: { fontSize: 12, fontWeight: '800' },
  unavailableCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.lowest,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  unavailableText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
