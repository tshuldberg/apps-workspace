import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  fetchStandings,
  fetchTeamSchedule,
  findTeamRecord,
  getTeamById,
  setTeamRival,
  unfollowTeam,
  updateTeamNotifications,
  updateTeamTier,
  upsertGames,
  type FollowTier,
  type Game,
  type LeagueId,
  type StandingRow,
  type Team,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

const TIERS: Array<{ id: FollowTier; label: string; subtitle: string }> = [
  { id: 'diehard', label: 'Die-hard', subtitle: 'Every game. Every trade.' },
  { id: 'casual', label: 'Casual', subtitle: 'Playoffs and big matchups.' },
  { id: 'occasional', label: 'Occasional', subtitle: 'Just the headlines.' },
];

export default function SportsTeamDetailScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teamId = typeof id === 'string' ? decodeURIComponent(id) : '';

  const [team, setTeam] = useState<Team | null>(null);
  const [record, setRecord] = useState<StandingRow | null>(null);
  const [schedule, setSchedule] = useState<Game[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const reload = useCallback(() => {
    setTeam(getTeamById(db, teamId));
  }, [db, teamId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // P1-C: non-blocking season record badge from the standings engine.
  useEffect(() => {
    if (!team) return;
    const controller = new AbortController();
    void fetchStandings({
      league: team.league as LeagueId,
      signal: controller.signal,
    })
      .then((groups) => {
        if (controller.signal.aborted) return;
        setRecord(findTeamRecord(groups, team.id));
      })
      .catch(() => {
        // Silent fallback -- badge simply doesn't render.
      });
    return () => controller.abort();
  }, [team]);

  // P1-D: fetch team schedule -> upsert into sp_games cache + local state.
  useEffect(() => {
    if (!team) return;
    const controller = new AbortController();
    setScheduleLoading(true);
    void fetchTeamSchedule({
      teamId: team.id,
      league: team.league as LeagueId,
      signal: controller.signal,
    })
      .then((games) => {
        if (controller.signal.aborted) return;
        try {
          upsertGames(db, games);
        } catch {
          /* ignore cache write failure */
        }
        setSchedule(games);
        setScheduleLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setScheduleLoading(false);
      });
    return () => controller.abort();
  }, [team, db]);

  const { upcoming, recent } = useMemo(() => {
    if (!team) return { upcoming: [] as Game[], recent: [] as Game[] };
    const now = Date.now();
    const up: Game[] = [];
    const rc: Game[] = [];
    for (const g of schedule) {
      if (g.status === 'final' || g.startAt < now) rc.push(g);
      else up.push(g);
    }
    up.sort((a, b) => a.startAt - b.startAt);
    rc.sort((a, b) => b.startAt - a.startAt);
    return { upcoming: up.slice(0, 10), recent: rc.slice(0, 10) };
  }, [schedule, team]);

  const heroTint = team?.primary_color ?? null;
  const heroBackground =
    heroTint && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(heroTint)
      ? heroTint
      : surfaceTiers.container;
  const heroBorder = heroTint
    ? heroTint
    : colors.border;

  if (!team) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingTitle}>Team not found</Text>
        <Text style={styles.missingSubtitle}>
          This team may have been unfollowed. Head back to the Teams tab.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back to teams</Text>
        </Pressable>
      </View>
    );
  }

  const setTier = (tier: FollowTier) => {
    updateTeamTier(db, team.id, tier);
    reload();
  };

  const toggleRival = (next: boolean) => {
    setTeamRival(db, team.id, next);
    reload();
  };

  const toggleNotification = (
    key: 'notify_start' | 'notify_end' | 'notify_close' | 'notify_trades',
    next: boolean,
  ) => {
    updateTeamNotifications(db, team.id, { [key]: next ? 1 : 0 });
    reload();
  };

  const handleUnfollow = () => {
    unfollowTeam(db, team.id);
    router.back();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.heroCard,
          { backgroundColor: heroBackground, borderColor: heroBorder },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{team.league.toUpperCase()}</Text>
            <Text style={styles.title}>{team.name}</Text>
            <Text style={styles.subtitle}>
              {[team.conference, team.division].filter(Boolean).join(' · ') ||
                'Team details'}
            </Text>
          </View>
          {team.logo_url ? (
            <Image
              source={{ uri: team.logo_url }}
              style={styles.heroLogo}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        {record ? (
          <View style={styles.recordBadge}>
            <Text style={styles.recordBadgeText}>
              Season: {record.wins}-{record.losses}
              {record.ties > 0 ? `-${record.ties}` : ''}
              {'  ·  '}
              {record.winPct.toFixed(3).replace(/^0/, '')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Follow tier</Text>
        {TIERS.map((tier) => {
          const active = team.follow_tier === tier.id;
          return (
            <Pressable
              key={tier.id}
              onPress={() => setTier(tier.id)}
              style={[styles.tierCard, active && styles.tierCardActive]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.tierLabel}>{tier.label}</Text>
                <Text style={styles.tierSubtitle}>{tier.subtitle}</Text>
              </View>
              <Text
                style={[styles.tierDot, active && styles.tierDotActive]}
              >
                {active ? '●' : '○'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rivalry</Text>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Mark as rival</Text>
            <Text style={styles.switchHint}>
              Rival tuning powers smarter alerts in a later phase.
            </Text>
          </View>
          <Switch
            value={team.is_rival === 1}
            onValueChange={toggleRival}
            trackColor={{ false: colors.border, true: SPORTS_ACCENT }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Text style={styles.sectionCaption}>
          Preferences are stored now; dispatch goes live in P2.
        </Text>
        <NotificationRow
          label="Game start"
          value={team.notify_start === 1}
          onChange={(v) => toggleNotification('notify_start', v)}
        />
        <NotificationRow
          label="Final score"
          value={team.notify_end === 1}
          onChange={(v) => toggleNotification('notify_end', v)}
        />
        <NotificationRow
          label="Close games"
          value={team.notify_close === 1}
          onChange={(v) => toggleNotification('notify_close', v)}
        />
        <NotificationRow
          label="Trades and transactions"
          value={team.notify_trades === 1}
          onChange={(v) => toggleNotification('notify_trades', v)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        {scheduleLoading && schedule.length === 0 ? (
          <Text style={styles.sectionCaption}>Loading schedule…</Text>
        ) : null}
        {!scheduleLoading && schedule.length === 0 ? (
          <Text style={styles.sectionCaption}>No games found.</Text>
        ) : null}
        {upcoming.length > 0 ? (
          <>
            <Text style={styles.scheduleHeader}>Upcoming</Text>
            {upcoming.map((g) => (
              <GameRow
                key={g.id}
                game={g}
                teamId={team.id}
                onPress={() =>
                  router.push(
                    `/(sports)/game/${encodeURIComponent(g.id)}?league=${g.league}` as never,
                  )
                }
              />
            ))}
          </>
        ) : null}
        {recent.length > 0 ? (
          <>
            <Text style={styles.scheduleHeader}>Recent</Text>
            {recent.map((g) => (
              <GameRow
                key={g.id}
                game={g}
                teamId={team.id}
                onPress={() =>
                  router.push(
                    `/(sports)/game/${encodeURIComponent(g.id)}?league=${g.league}` as never,
                  )
                }
              />
            ))}
          </>
        ) : null}
        <Pressable
          onPress={() => {
            const externalId = team.id.split(':').pop() ?? team.id;
            router.push({
              pathname: '/(sports)/history',
              params: { teamId: externalId },
            } as never);
          }}
          style={styles.historyLink}
          accessibilityRole="button"
        >
          <Text style={styles.historyLinkText}>Season history →</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coming in later phases</Text>
        <View style={styles.placeholderList}>
          <PlaceholderRow label="Roster" hint="Depth chart and injuries" />
          <PlaceholderRow label="Stats" hint="Standings and season rolls" />
        </View>
      </View>

      <Pressable
        style={styles.destructiveButton}
        onPress={handleUnfollow}
        accessibilityRole="button"
      >
        <Text style={styles.destructiveButtonText}>Unfollow this team</Text>
      </Pressable>
    </ScrollView>
  );
}

function NotificationRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: SPORTS_ACCENT }}
      />
    </View>
  );
}

function GameRow({
  game,
  teamId,
  onPress,
}: {
  game: Game;
  teamId: string;
  onPress: () => void;
}) {
  const isHome = game.home.id === teamId;
  const opponent = isHome ? game.away : game.home;
  const date = new Date(game.startAt);
  const dateLabel = date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const statusLabel =
    game.status === 'live'
      ? game.period ?? 'Live'
      : game.status === 'final'
        ? 'Final'
        : timeLabel;
  const scoreLabel =
    game.status === 'scheduled'
      ? null
      : `${game.away.score ?? '—'} – ${game.home.score ?? '—'}`;
  return (
    <Pressable
      onPress={onPress}
      style={styles.gameRow}
      accessibilityRole="button"
    >
      <View style={styles.gameRowTop}>
        <Text style={styles.gameOpponent} numberOfLines={1}>
          {isHome ? 'vs ' : '@ '}
          {opponent.name}
        </Text>
        <Text style={styles.gameStatus}>{statusLabel}</Text>
      </View>
      <View style={styles.gameRowBottom}>
        <Text style={styles.gameDate}>{dateLabel}</Text>
        {scoreLabel ? (
          <Text style={styles.gameScore}>{scoreLabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function PlaceholderRow({ label, hint }: { label: string; hint: string }) {
  return (
    <View style={styles.placeholderRow}>
      <Text style={styles.placeholderLabel}>{label}</Text>
      <Text style={styles.placeholderHint}>{hint}</Text>
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
    gap: 16,
  },
  heroCard: {
    gap: 6,
    padding: 20,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  recordBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
    backgroundColor: 'rgba(22,163,74,0.08)',
  },
  recordBadgeText: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCaption: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierCardActive: {
    borderColor: SPORTS_ACCENT,
  },
  tierLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  tierSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  tierDot: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  tierDotActive: {
    color: SPORTS_ACCENT,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  switchHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  scheduleHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  gameRow: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  gameRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameOpponent: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  gameStatus: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  gameDate: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  gameScore: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  placeholderList: {
    gap: 10,
  },
  placeholderRow: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  placeholderLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  placeholderHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  destructiveButton: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  destructiveButtonText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '700',
  },
  missing: {
    flex: 1,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.lowest,
  },
  missingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  missingSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: SPORTS_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: '800',
  },
  historyLink: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  historyLinkText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
});
