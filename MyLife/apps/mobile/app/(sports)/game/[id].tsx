import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  LAUNCH_LEAGUES,
  fetchGameDetail,
  fetchGameTimeline,
  isMajorEvent,
  type GameDetail,
  type LeagueId,
  type TimelineEvent,
} from '@mylife/sports';
import { SPORTS_ACCENT } from '../_ui';

const TIMELINE_POLL_MS = 15_000;

function isLeagueId(raw: unknown): raw is LeagueId {
  return typeof raw === 'string' && LAUNCH_LEAGUES.some((l) => l.id === raw);
}

function extractLeagueFromId(id: string): LeagueId | null {
  const parts = id.split(':');
  if (parts.length === 3 && parts[0] === 'espn' && isLeagueId(parts[1])) {
    return parts[1];
  }
  return null;
}

export default function SportsGameDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; league?: string }>();
  const gameId =
    typeof params.id === 'string' ? decodeURIComponent(params.id) : '';
  const league: LeagueId | null = isLeagueId(params.league)
    ? params.league
    : extractLeagueFromId(gameId);

  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const pendingTimelineRef = useRef(false);

  useEffect(() => {
    if (!gameId || !league) {
      setIsLoading(false);
      setError('Missing game id or league');
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    void fetchGameDetail({ gameId, league, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setDetail(result);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load game');
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [gameId, league]);

  // Timeline fetch + live polling (status=live + foregrounded only).
  useEffect(() => {
    if (!gameId || !league || !detail) return;
    const status = detail.status;
    let cancelled = false;

    const refresh = async () => {
      if (pendingTimelineRef.current) return;
      pendingTimelineRef.current = true;
      try {
        const events = await fetchGameTimeline({ gameId, league, status });
        if (!cancelled) setTimeline(events);
      } catch {
        // Swallow -- keep the last-known timeline so the UI doesn't thrash.
      } finally {
        pendingTimelineRef.current = false;
      }
    };

    void refresh();

    if (status !== 'live') return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isActive = AppState.currentState === 'active';

    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        void refresh();
      }, TIMELINE_POLL_MS);
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
          isActive = true;
          void refresh();
          start();
        }
      } else {
        isActive = false;
        stop();
      }
    });

    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, [gameId, league, detail]);

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={SPORTS_ACCENT} />
        <Text style={styles.loadingText}>Loading game…</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingTitle}>Game unavailable</Text>
        <Text style={styles.missingSubtitle}>
          {error ?? 'Box-score data is not available for this game right now.'}
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusLabel =
    detail.status === 'live'
      ? detail.period ?? 'Live'
      : detail.status === 'final'
        ? 'Final'
        : 'Scheduled';
  const pillStyle =
    detail.status === 'live'
      ? [styles.statusPill, styles.statusPillLive]
      : [styles.statusPill];
  const pillTextStyle =
    detail.status === 'live'
      ? [styles.statusPillText, styles.statusPillTextLive]
      : [styles.statusPillText];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.eyebrow}>{detail.league.toUpperCase()}</Text>
          <View style={pillStyle}>
            <Text style={pillTextStyle}>{statusLabel}</Text>
          </View>
        </View>
        <View style={styles.scoreRow}>
          <View style={styles.scoreSide}>
            <Text style={styles.sideName}>{detail.away.name}</Text>
            {detail.away.abbreviation ? (
              <Text style={styles.sideAbbr}>{detail.away.abbreviation}</Text>
            ) : null}
          </View>
          <Text style={styles.scoreValue}>{detail.away.score ?? '—'}</Text>
        </View>
        <View style={styles.scoreRow}>
          <View style={styles.scoreSide}>
            <Text style={styles.sideName}>{detail.home.name}</Text>
            {detail.home.abbreviation ? (
              <Text style={styles.sideAbbr}>{detail.home.abbreviation}</Text>
            ) : null}
          </View>
          <Text style={styles.scoreValue}>{detail.home.score ?? '—'}</Text>
        </View>
        {detail.status === 'live' && detail.clock ? (
          <Text style={styles.clockText}>{detail.clock}</Text>
        ) : null}
      </View>

      {detail.periods.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By period</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellTeam, styles.tableHeaderText]}>Team</Text>
            {detail.periods.map((p, i) => (
              <Text
                key={`${p.period}-${i}`}
                style={[styles.tableCellPeriod, styles.tableHeaderText]}
              >
                {String(p.period)}
              </Text>
            ))}
            <Text style={[styles.tableCellPeriod, styles.tableHeaderText]}>T</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellTeam}>
              {detail.away.abbreviation ?? detail.away.name}
            </Text>
            {detail.periods.map((p, i) => (
              <Text
                key={`a-${i}`}
                style={[styles.tableCellPeriod, styles.tableCellValue]}
              >
                {p.awayScore}
              </Text>
            ))}
            <Text style={[styles.tableCellPeriod, styles.tableCellTotal]}>
              {detail.away.score ?? '—'}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellTeam}>
              {detail.home.abbreviation ?? detail.home.name}
            </Text>
            {detail.periods.map((p, i) => (
              <Text
                key={`h-${i}`}
                style={[styles.tableCellPeriod, styles.tableCellValue]}
              >
                {p.homeScore}
              </Text>
            ))}
            <Text style={[styles.tableCellPeriod, styles.tableCellTotal]}>
              {detail.home.score ?? '—'}
            </Text>
          </View>
        </View>
      ) : null}

      {detail.leaders && detail.leaders.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leaders</Text>
          {detail.leaders.map((l, i) => (
            <View key={`${l.teamSide}-${l.category}-${i}`} style={styles.leaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.leaderCategory}>
                  {l.teamSide === 'home'
                    ? detail.home.abbreviation ?? 'Home'
                    : detail.away.abbreviation ?? 'Away'}
                  {' · '}
                  {l.category}
                </Text>
                {l.athleteName ? (
                  <Text style={styles.leaderAthlete}>{l.athleteName}</Text>
                ) : null}
              </View>
              <Text style={styles.leaderValue}>{l.displayValue}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {detail.venue || detail.broadcast || detail.weather ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Game info</Text>
          {detail.venue ? (
            <InfoRow label="Venue" value={detail.venue} />
          ) : null}
          {detail.broadcast ? (
            <InfoRow label="Broadcast" value={detail.broadcast} />
          ) : null}
          {detail.weather ? (
            <InfoRow label="Weather" value={detail.weather} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.timelineHeader}>
          <Text style={styles.sectionTitle}>Plays</Text>
          <View style={styles.timelineCountPill}>
            <Text style={styles.timelineCountText}>{timeline.length}</Text>
          </View>
        </View>
        {timeline.length === 0 ? (
          <View style={styles.timelineEmpty}>
            <Text style={styles.timelineEmptyText}>
              Play-by-play unavailable for this game.
            </Text>
          </View>
        ) : (
          timeline.map((ev) => (
            <TimelineRow
              key={ev.id}
              event={ev}
              homeAbbr={detail.home.abbreviation}
              awayAbbr={detail.away.abbreviation}
            />
          ))
        )}
      </View>

      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonLabel}>Coming soon</Text>
        <Text style={styles.comingSoonHint}>
          Attendance + game notes (P6)
        </Text>
      </View>
    </ScrollView>
  );
}

function TimelineRow({
  event,
  homeAbbr,
  awayAbbr,
}: {
  event: TimelineEvent;
  homeAbbr?: string | null;
  awayAbbr?: string | null;
}) {
  const major = isMajorEvent(event);
  const sideLabel =
    event.team === 'home'
      ? homeAbbr ?? 'HOME'
      : event.team === 'away'
        ? awayAbbr ?? 'AWAY'
        : null;
  return (
    <View
      style={[styles.timelineRow, major ? styles.timelineRowMajor : null]}
    >
      <View style={styles.timelineMeta}>
        <Text
          style={[
            styles.timelinePeriod,
            major ? styles.timelinePeriodMajor : null,
          ]}
        >
          {String(event.period ?? '—')}
        </Text>
        {event.clock ? (
          <Text style={styles.timelineClock}>{event.clock}</Text>
        ) : null}
      </View>
      <View style={styles.timelineBody}>
        {sideLabel ? (
          <Text style={styles.timelineSide}>{sideLabel}</Text>
        ) : null}
        <Text
          style={[
            styles.timelineDescription,
            major ? styles.timelineDescriptionMajor : null,
          ]}
        >
          {event.description}
        </Text>
        {event.isScoring &&
        (event.homeScoreAfter !== null && event.homeScoreAfter !== undefined) &&
        (event.awayScoreAfter !== null && event.awayScoreAfter !== undefined) ? (
          <Text style={styles.timelineScoreAfter}>
            {awayAbbr ?? 'AWAY'} {event.awayScoreAfter} · {homeAbbr ?? 'HOME'}{' '}
            {event.homeScoreAfter}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: surfaceTiers.lowest,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  heroCard: {
    gap: 10,
    padding: 20,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPillLive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  statusPillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextLive: {
    color: '#0E0E13',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreSide: {
    flex: 1,
  },
  sideName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sideAbbr: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    minWidth: 56,
    textAlign: 'right',
  },
  clockText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tableHeaderText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableCellTeam: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  tableCellPeriod: {
    width: 40,
    textAlign: 'center',
    color: colors.text,
    fontSize: 13,
  },
  tableCellValue: {
    fontWeight: '600',
  },
  tableCellTotal: {
    fontWeight: '900',
    color: SPORTS_ACCENT,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leaderCategory: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  leaderAthlete: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  leaderValue: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  comingSoon: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  comingSoonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  comingSoonHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineCountPill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
  },
  timelineCountText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  timelineEmpty: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  timelineEmptyText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineRowMajor: {
    borderColor: SPORTS_ACCENT,
    backgroundColor: 'rgba(22,163,74,0.12)',
  },
  timelineMeta: {
    width: 64,
    gap: 2,
  },
  timelinePeriod: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  timelinePeriodMajor: {
    color: SPORTS_ACCENT,
  },
  timelineClock: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  timelineBody: {
    flex: 1,
    gap: 2,
  },
  timelineSide: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  timelineDescription: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  timelineDescriptionMajor: {
    fontWeight: '700',
  },
  timelineScoreAfter: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
});
