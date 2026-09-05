import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  LAUNCH_LEAGUES,
  fetchStandingsForLeagues,
  findTeamRecord,
  followTeam,
  listFollowedTeams,
  searchTeams,
  unfollowTeam,
  type FollowTier,
  type LeagueId,
  type StandingGroup,
  type StandingRow,
  type Team,
  type TeamSearchResult,
} from '@mylife/sports';
import { useDatabase } from '../../components/DatabaseProvider';
import { SPORTS_ACCENT } from './_ui';

const TIER_LABELS: Record<FollowTier, string> = {
  diehard: 'Die-hard',
  casual: 'Casual',
  occasional: 'Occasional',
};

const TIER_ORDER: FollowTier[] = ['diehard', 'casual', 'occasional'];

export default function SportsTeamsScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [query, setQuery] = useState('');
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | null>(null);
  const [searchResults, setSearchResults] = useState<TeamSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Team[]>([]);
  const followedIds = useMemo(
    () => new Set(followed.map((t) => t.id)),
    [followed],
  );

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFollowed = useCallback(() => {
    try {
      setFollowed(listFollowedTeams(db));
    } catch (err) {
      console.error('[MySports] failed to list followed teams', err);
    }
  }, [db]);

  useEffect(() => {
    refreshFollowed();
  }, [refreshFollowed]);

  // Debounce the search by 250ms and cancel any in-flight request on each
  // new keystroke or league-filter change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    setSearchError(null);

    debounceRef.current = setTimeout(() => {
      void searchTeams({
        query: trimmed,
        leagues: leagueFilter ? [leagueFilter] : undefined,
        signal: controller.signal,
      })
        .then((results) => {
          if (controller.signal.aborted) return;
          setSearchResults(results.slice(0, 25));
          setIsSearching(false);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setIsSearching(false);
          setSearchError(
            err instanceof Error ? err.message : 'Search failed',
          );
        });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [query, leagueFilter]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleFollow = useCallback(
    (result: TeamSearchResult) => {
      followTeam(db, {
        id: result.id,
        name: result.name,
        league: result.league,
        sport: result.sport,
        conference: result.conference ?? null,
        division: result.division ?? null,
        logo_url: result.logoUrl ?? null,
        primary_color: result.primaryColor ?? null,
        secondary_color: result.secondaryColor ?? null,
      });
      refreshFollowed();
    },
    [db, refreshFollowed],
  );

  const handleUnfollow = useCallback(
    (id: string) => {
      unfollowTeam(db, id);
      refreshFollowed();
    },
    [db, refreshFollowed],
  );

  // ── "My Season Records" strip ──────────────────────────────────
  const [recordsByTeam, setRecordsByTeam] = useState<Record<string, StandingRow | null>>({});
  const recordsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (followed.length === 0) {
      setRecordsByTeam({});
      return;
    }
    recordsAbortRef.current?.abort();
    const controller = new AbortController();
    recordsAbortRef.current = controller;
    const leagues = Array.from(
      new Set(followed.map((t) => t.league as LeagueId)),
    );
    void fetchStandingsForLeagues({ leagues, signal: controller.signal })
      .then((byLeague) => {
        if (controller.signal.aborted) return;
        const next: Record<string, StandingRow | null> = {};
        for (const team of followed) {
          const groups: StandingGroup[] = byLeague[team.league] ?? [];
          next[team.id] = findTeamRecord(groups, team.id);
        }
        setRecordsByTeam(next);
      })
      .catch(() => {
        // Silent failure -- strip simply renders no pills.
      });
    return () => {
      controller.abort();
    };
  }, [followed]);

  const groupedFollowed = useMemo(() => {
    const groups = new Map<FollowTier, Team[]>();
    for (const tier of TIER_ORDER) groups.set(tier, []);
    for (const team of followed) {
      groups.get(team.follow_tier)?.push(team);
    }
    return groups;
  }, [followed]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Teams</Text>
        <Text style={styles.title}>Follow the teams that matter to you</Text>
        <Text style={styles.subtitle}>
          Search across the NFL, NBA, MLB, NHL, and MLS. Mark die-hard vs
          casual follows and flag rivals. Notifications arrive in a later
          phase.
        </Text>
        <Pressable
          onPress={() => router.push('/(sports)/schedule' as never)}
          style={styles.scheduleLink}
          accessibilityRole="button"
          accessibilityLabel="View full schedule"
        >
          <Text style={styles.scheduleLinkText}>View full schedule →</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder="Search teams (e.g. Cowboys, Lakers)"
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search teams"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <LeagueChip
          label="All leagues"
          active={leagueFilter === null}
          onPress={() => setLeagueFilter(null)}
        />
        {LAUNCH_LEAGUES.map((league) => (
          <LeagueChip
            key={league.id}
            label={league.label}
            active={leagueFilter === league.id}
            onPress={() => setLeagueFilter(league.id)}
          />
        ))}
      </ScrollView>

      {query.trim().length >= 2 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search results</Text>
          {isSearching ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={SPORTS_ACCENT} />
              <Text style={styles.loadingText}>Searching ESPN…</Text>
            </View>
          ) : searchError ? (
            <Text style={styles.errorText}>{searchError}</Text>
          ) : searchResults.length === 0 ? (
            <Text style={styles.emptyText}>No teams matched that search.</Text>
          ) : (
            searchResults.map((result) => (
              <SearchResultRow
                key={result.id}
                result={result}
                isFollowed={followedIds.has(result.id)}
                onFollow={() => handleFollow(result)}
                onUnfollow={() => handleUnfollow(result.id)}
              />
            ))
          )}
        </View>
      ) : null}

      {followed.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.stripHeaderRow}>
            <Text style={styles.sectionTitle}>My season records</Text>
            <Pressable
              onPress={() => router.push('/(sports)/standings' as never)}
              accessibilityRole="button"
              accessibilityLabel="Open standings"
            >
              <Text style={styles.standingsLink}>Standings →</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recordStrip}
          >
            {followed.map((team) => {
              const row = recordsByTeam[team.id] ?? null;
              const label = row
                ? `${row.wins}-${row.losses}${row.ties > 0 ? `-${row.ties}` : ''}`
                : '—';
              const abbr =
                row?.teamAbbreviation ??
                team.name.split(' ').pop() ??
                team.name;
              return (
                <Pressable
                  key={team.id}
                  onPress={() =>
                    router.push(
                      `/(sports)/team/${encodeURIComponent(team.id)}` as never,
                    )
                  }
                  style={styles.recordPill}
                  accessibilityRole="button"
                >
                  <Text style={styles.recordPillAbbr}>{abbr}</Text>
                  <Text style={styles.recordPillValue}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Following {followed.length > 0 ? `(${followed.length})` : ''}
        </Text>
        {followed.length === 0 ? (
          <Text style={styles.emptyText}>
            You're not following any teams yet. Search above to add one.
          </Text>
        ) : (
          TIER_ORDER.map((tier) => {
            const teams = groupedFollowed.get(tier) ?? [];
            if (teams.length === 0) return null;
            return (
              <View key={tier} style={styles.tierGroup}>
                <Text style={styles.tierHeader}>{TIER_LABELS[tier]}</Text>
                {teams.map((team) => (
                  <Pressable
                    key={team.id}
                    style={styles.teamRow}
                    onPress={() =>
                      router.push(
                        `/(sports)/team/${encodeURIComponent(team.id)}` as never,
                      )
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.teamMeta}>
                        {team.league.toUpperCase()}
                        {team.is_rival ? '  ·  Rival' : ''}
                      </Text>
                    </View>
                    <Text style={styles.teamChevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function LeagueChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SearchResultRow({
  result,
  isFollowed,
  onFollow,
  onUnfollow,
}: {
  result: TeamSearchResult;
  isFollowed: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
}) {
  return (
    <View style={styles.resultRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.teamName}>{result.name}</Text>
        <Text style={styles.teamMeta}>
          {result.league.toUpperCase()}
          {result.conference ? `  ·  ${result.conference}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={isFollowed ? onUnfollow : onFollow}
        style={[
          styles.followButton,
          isFollowed && styles.followButtonActive,
        ]}
        accessibilityRole="button"
        accessibilityLabel={isFollowed ? 'Unfollow' : 'Follow'}
      >
        <Text
          style={[
            styles.followButtonText,
            isFollowed && styles.followButtonTextActive,
          ]}
        >
          {isFollowed ? 'Following' : 'Follow'}
        </Text>
      </Pressable>
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
  scheduleLink: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  scheduleLinkText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
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
  searchInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
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
  section: {
    gap: 10,
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  teamMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  teamChevron: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: '400',
  },
  tierGroup: {
    gap: 8,
  },
  tierHeader: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SPORTS_ACCENT,
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
  },
  followButtonText: {
    color: '#0E0E13',
    fontSize: 13,
    fontWeight: '800',
  },
  followButtonTextActive: {
    color: SPORTS_ACCENT,
  },
  stripHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  standingsLink: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  recordStrip: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  recordPill: {
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  recordPillAbbr: {
    color: SPORTS_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  recordPillValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
});
