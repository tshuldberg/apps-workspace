import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  DifficultyChip,
  ElevationMiniChart,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  StatDisplay,
  TR_ACCENT_GLOW,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  calculateDifficulty,
  formatDuration,
  getEffortsBySegment,
  getPersonalBest,
  getRecordings,
  getSegmentsByTrail,
  getTrails,
  updateTrail,
  type ActivityType,
  type Segment,
  type SegmentEffort,
  type Trail,
} from '@mylife/trails';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TrailsChip, TrailsScreen } from '../_ui';

type DetailTab = 'leaderboard' | 'efforts' | 'about';
type PeriodFilter = 'all' | 'year' | 'month';
type ActivityFilter = 'all' | ActivityType;

type LeaderboardEntry = {
  rank: number;
  effort: SegmentEffort;
  label: string;
  isYou: boolean;
  activity: ActivityType;
};

export default function SegmentDetailScreen() {
  const db = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<DetailTab>('leaderboard');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  const trails = useMemo(() => getTrails(db), [db, tick]);
  const bundle = useMemo(() => findSegmentBundle(trails, db, id), [db, id, trails]);
  const recordings = useMemo(() => getRecordings(db), [db, tick]);
  const recordingsById = useMemo(
    () => new Map(recordings.map((recording) => [recording.id, recording])),
    [recordings],
  );

  const efforts = useMemo(
    () => (id ? getEffortsBySegment(db, id) : []),
    [db, id, tick],
  );
  const personalBest = useMemo(
    () => (id ? getPersonalBest(db, id) : null),
    [db, id, tick],
  );

  const leaderboardEntries = useMemo(() => {
    const now = Date.now();

    return [...efforts]
      .filter((effort) => {
        const recording = recordingsById.get(effort.recordingId);
        const activity = recording?.activityType ?? 'hike';

        if (activityFilter !== 'all' && activity !== activityFilter) {
          return false;
        }

        if (periodFilter === 'all') {
          return true;
        }

        const effortTime = new Date(effort.startedAt).getTime();
        if (Number.isNaN(effortTime)) {
          return false;
        }

        const age = now - effortTime;
        const limit = periodFilter === 'year' ? 365 * 24 * 60 * 60 * 1000 : 31 * 24 * 60 * 60 * 1000;
        return age <= limit;
      })
      .sort((left, right) => left.durationSeconds - right.durationSeconds)
      .map((effort, index) => ({
        rank: index + 1,
        effort,
        label: personalBest?.id === effort.id ? 'You' : `Trail Scout ${String(index + 1).padStart(2, '0')}`,
        isYou: personalBest?.id === effort.id,
        activity: recordingsById.get(effort.recordingId)?.activityType ?? 'hike',
      }));
  }, [activityFilter, efforts, periodFilter, personalBest?.id, recordingsById]);

  const chronologicalEfforts = useMemo(
    () =>
      [...efforts].sort(
        (left, right) =>
          new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime(),
      ),
    [efforts],
  );

  const personalRank = useMemo(() => {
    if (!personalBest) {
      return null;
    }

    const sorted = [...efforts].sort((left, right) => left.durationSeconds - right.durationSeconds);
    const index = sorted.findIndex((effort) => effort.id === personalBest.id);
    return index === -1 ? null : index + 1;
  }, [efforts, personalBest]);

  const difficulty = bundle?.segment
    ? calculateDifficulty(bundle.segment.distanceMeters, bundle.segment.elevationGainMeters, null)
    : 'moderate';
  const isStarred = bundle?.trail.isSaved ?? false;

  const handleToggleStar = useCallback(() => {
    if (!bundle?.trail) {
      return;
    }

    try {
      updateTrail(db, bundle.trail.id, { isSaved: !bundle.trail.isSaved });
      setTick((value) => value + 1);
    } catch {
      Alert.alert('Unable to update star', 'The trail save state could not be changed.');
    }
  }, [bundle?.trail, db]);

  const handleShare = useCallback(async () => {
    if (!bundle?.segment || !bundle?.trail) {
      return;
    }

    await Share.share({
      message: `MyTrails segment: ${bundle.segment.name} on ${bundle.trail.name} · ${(bundle.segment.distanceMeters / 1000).toFixed(1)} km · ${Math.round(bundle.segment.elevationGainMeters)} m gain`,
    });
  }, [bundle?.segment, bundle?.trail]);

  if (!bundle) {
    return (
      <View style={styles.centered}>
        <RNText style={styles.emptyIcon}>🏁</RNText>
        <RNText style={styles.emptyTitle}>Segment not found</RNText>
        <RNText style={styles.emptyCopy}>
          The selected trail checkpoint could not be found in local storage.
        </RNText>
      </View>
    );
  }

  const aboutProfile = buildSegmentElevationProfile(bundle.segment);
  const conditions = buildRecommendedConditions(bundle.segment, difficulty);

  return (
    <>
      <Stack.Screen
        options={{
          title: bundle.segment.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable hitSlop={10} onPress={handleToggleStar}>
                <MaterialSymbol
                  name="star"
                  size={20}
                  color={isStarred ? TR_ACCENT_LIGHT : TR_TEXT_TERTIARY}
                  filled={isStarred}
                />
              </Pressable>
              <Pressable hitSlop={10} onPress={() => void handleShare()}>
                <MaterialSymbol name="route" size={20} color={TR_TEXT_TERTIARY} />
              </Pressable>
            </View>
          ),
        }}
      />

      <TrailsScreen contentContainerStyle={styles.content}>
        <SegmentMapHero segment={bundle.segment} />

        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <RNText style={styles.kicker}>{bundle.trail.name.toUpperCase()}</RNText>
            <RNText style={styles.title}>{bundle.segment.name}</RNText>
          </View>
          <DifficultyChip level={difficulty} />
        </View>

        <View style={styles.statRow}>
          <StatPill icon="straighten" label={`${(bundle.segment.distanceMeters / 1000).toFixed(1)} km`} />
          <StatPill icon="terrain" label={`${Math.round(bundle.segment.elevationGainMeters)} m gain`} />
          <StatPill icon="flag" label={`${efforts.length} effort${efforts.length === 1 ? '' : 's'}`} />
        </View>

        <GlassCard padding={18} style={styles.pbCard}>
          <View style={styles.pbTopRow}>
            <View style={styles.flex}>
              <RNText style={styles.pbEyebrow}>Your Personal Best</RNText>
              <RNText style={styles.pbCopy}>
                Ranked against every recorded attempt on this segment.
              </RNText>
            </View>
            {personalRank ? (
              <View style={styles.rankBadge}>
                <RNText style={styles.rankBadgeLabel}>#{personalRank}</RNText>
              </View>
            ) : null}
          </View>

          <View style={styles.pbStatsRow}>
            <StatDisplay
              value={personalBest ? formatDuration(personalBest.durationSeconds) : '--'}
              label="Best Time"
              size="md"
            />
            <StatDisplay
              value={personalBest?.paceMinPerKm ? personalBest.paceMinPerKm.toFixed(1) : '--'}
              unit={personalBest?.paceMinPerKm ? 'min/km' : undefined}
              label="Pace"
              size="md"
            />
          </View>
        </GlassCard>

        <View style={styles.segmentedRow}>
          <TrailsChip label="Leaderboard" active={activeTab === 'leaderboard'} onPress={() => setActiveTab('leaderboard')} />
          <TrailsChip label="Your Efforts" active={activeTab === 'efforts'} onPress={() => setActiveTab('efforts')} />
          <TrailsChip label="About" active={activeTab === 'about'} onPress={() => setActiveTab('about')} />
        </View>

        {activeTab === 'leaderboard' ? (
          <View style={styles.sectionStack}>
            <View style={styles.filterRow}>
              <TrailsChip label="All Time" active={periodFilter === 'all'} onPress={() => setPeriodFilter('all')} />
              <TrailsChip label="This Year" active={periodFilter === 'year'} onPress={() => setPeriodFilter('year')} />
              <TrailsChip label="This Month" active={periodFilter === 'month'} onPress={() => setPeriodFilter('month')} />
            </View>
            <View style={styles.filterRow}>
              <TrailsChip label="All" active={activityFilter === 'all'} onPress={() => setActivityFilter('all')} />
              <TrailsChip label="Hiking" active={activityFilter === 'hike'} onPress={() => setActivityFilter('hike')} />
              <TrailsChip label="Running" active={activityFilter === 'run'} onPress={() => setActivityFilter('run')} />
              <TrailsChip label="Bike" active={activityFilter === 'bike'} onPress={() => setActivityFilter('bike')} />
            </View>

            {leaderboardEntries.length === 0 ? (
              <GlassCard padding={18} style={styles.emptyCard}>
                <RNText style={styles.emptyTitle}>No leaderboard efforts for this filter</RNText>
                <RNText style={styles.emptyCopy}>
                  Adjust the period or activity filters to reveal more attempts.
                </RNText>
              </GlassCard>
            ) : (
              leaderboardEntries.map((entry) => (
                <LeaderboardRow key={entry.effort.id} entry={entry} />
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'efforts' ? (
          <View style={styles.sectionStack}>
            <SectionHeader title="Improvement Curve" />
            <EffortTrendChart efforts={chronologicalEfforts} />

            <SectionHeader title="Attempt History" />
            {chronologicalEfforts.length === 0 ? (
              <GlassCard padding={18} style={styles.emptyCard}>
                <RNText style={styles.emptyTitle}>No personal efforts yet</RNText>
                <RNText style={styles.emptyCopy}>
                  Record this trail and let the segment matcher capture your first pass.
                </RNText>
              </GlassCard>
            ) : (
              chronologicalEfforts.map((effort, index) => {
                const recording = recordingsById.get(effort.recordingId);

                return (
                  <GlassCard key={effort.id} padding={16} style={styles.effortCard}>
                    <View style={styles.effortHeader}>
                      <View style={styles.effortIndex}>
                        <RNText style={styles.effortIndexLabel}>{index + 1}</RNText>
                      </View>
                      <View style={styles.flex}>
                        <RNText style={styles.effortDuration}>{formatDuration(effort.durationSeconds)}</RNText>
                        <RNText style={styles.effortMeta}>
                          {new Date(effort.startedAt).toLocaleDateString()} · {(recording?.activityType ?? 'hike').toUpperCase()}
                        </RNText>
                      </View>
                      {effort.isPersonalBest ? (
                        <View style={styles.prChip}>
                          <RNText style={styles.prChipLabel}>PR</RNText>
                        </View>
                      ) : null}
                    </View>
                  </GlassCard>
                );
              })
            )}
          </View>
        ) : null}

        {activeTab === 'about' ? (
          <View style={styles.sectionStack}>
            <GlassCard padding={18} style={styles.aboutCard}>
              <SectionHeader title="Origin" />
              <InfoRow label="Trail" value={bundle.trail.name} />
              <InfoRow label="Created" value={new Date(bundle.segment.createdAt).toLocaleDateString()} />
              <InfoRow
                label="Coordinates"
                value={`${bundle.segment.startLat.toFixed(4)}, ${bundle.segment.startLng.toFixed(4)} → ${bundle.segment.endLat.toFixed(4)}, ${bundle.segment.endLng.toFixed(4)}`}
              />
            </GlassCard>

            <GlassCard padding={18} style={styles.aboutCard}>
              <SectionHeader title="Elevation Profile" />
              <ElevationMiniChart points={aboutProfile} height={104} />
            </GlassCard>

            <GlassCard padding={18} style={styles.aboutCard}>
              <SectionHeader title="Recommended Conditions" />
              <View style={styles.conditionsList}>
                {conditions.map((condition) => (
                  <View key={condition} style={styles.conditionRow}>
                    <MaterialSymbol name="flag" size={14} color={TR_ACCENT_LIGHT} />
                    <RNText style={styles.conditionCopy}>{condition}</RNText>
                  </View>
                ))}
              </View>
            </GlassCard>
          </View>
        ) : null}
      </TrailsScreen>
    </>
  );
}

function SegmentMapHero({ segment }: { segment: Segment }) {
  const points = [
    { x: 32, y: 152 },
    { x: 90, y: 118 },
    { x: 146, y: 124 },
    { x: 214, y: 78 },
    { x: 288, y: 58 },
  ];

  return (
    <GlassCard padding={0} style={styles.mapHero}>
      <View style={styles.mapHeroInner}>
        <Svg width="100%" height="100%" viewBox="0 0 320 180">
          <Polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            stroke={TR_ACCENT_GLOW}
            strokeWidth={18}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            stroke={TR_ACCENT_LIGHT}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={points[0].x} cy={points[0].y} r={8} fill="#0C1605" stroke={TR_ACCENT_LIGHT} strokeWidth={3} />
          <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={8} fill={TR_ACCENT_LIGHT} />
        </Svg>
        <View style={styles.mapHeroBadge}>
          <MaterialSymbol name="route" size={14} color={TR_ACCENT_LIGHT} />
          <RNText style={styles.mapHeroBadgeLabel}>Segment Line</RNText>
        </View>
        <View style={styles.mapHeroFooter}>
          <RNText style={styles.mapHeroFooterText}>
            {(segment.distanceMeters / 1000).toFixed(1)} km · {Math.round(segment.elevationGainMeters)} m gain
          </RNText>
        </View>
      </View>
    </GlassCard>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;

  return (
    <GlassCard
      padding={16}
      style={[
        styles.leaderboardRow,
        entry.isYou ? styles.leaderboardRowYou : null,
      ]}
    >
      <View style={styles.rankSlot}>
        <RNText style={styles.rankText}>{medal ?? `#${entry.rank}`}</RNText>
      </View>
      <View style={styles.flex}>
        <RNText style={styles.leaderName}>{entry.label}</RNText>
        <RNText style={styles.leaderMeta}>
          {new Date(entry.effort.startedAt).toLocaleDateString()} · {entry.activity.toUpperCase()}
        </RNText>
      </View>
      <RNText style={styles.leaderTime}>{formatDuration(entry.effort.durationSeconds)}</RNText>
    </GlassCard>
  );
}

function EffortTrendChart({ efforts }: { efforts: SegmentEffort[] }) {
  if (efforts.length === 0) {
    return (
      <GlassCard padding={18} style={styles.emptyCard}>
        <RNText style={styles.emptyTitle}>No effort curve yet</RNText>
        <RNText style={styles.emptyCopy}>The chart appears once at least one segment effort is logged.</RNText>
      </GlassCard>
    );
  }

  const width = 320;
  const height = 120;
  const durations = efforts.map((effort) => effort.durationSeconds);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const spread = Math.max(maxDuration - minDuration, 1);
  const points = efforts.map((effort, index) => {
    const x = efforts.length === 1 ? width / 2 : 12 + ((index / (efforts.length - 1)) * (width - 24));
    const y = 18 + (((effort.durationSeconds - minDuration) / spread) * (height - 36));
    return { x, y, isPr: effort.isPersonalBest };
  });

  return (
    <GlassCard padding={18} style={styles.chartCard}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          stroke={TR_ACCENT_LIGHT}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <Circle
            key={`${point.x}-${point.y}`}
            cx={point.x}
            cy={point.y}
            r={point.isPr ? 5 : 4}
            fill={point.isPr ? TR_ACCENT_LIGHT : TR_TEXT}
          />
        ))}
      </Svg>
      <View style={styles.chartLegend}>
        <RNText style={styles.chartLegendCopy}>First effort</RNText>
        <RNText style={styles.chartLegendCopy}>Latest effort</RNText>
      </View>
    </GlassCard>
  );
}

function StatPill({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  return (
    <View style={styles.statPill}>
      <MaterialSymbol name={icon} size={14} color={TR_ACCENT_LIGHT} />
      <RNText style={styles.statPillLabel}>{label}</RNText>
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <RNText style={styles.infoLabel}>{label}</RNText>
      <RNText style={styles.infoValue}>{value}</RNText>
    </View>
  );
}

function findSegmentBundle(
  trails: Trail[],
  db: ReturnType<typeof useDatabase>,
  id: string | undefined,
) {
  if (!id) {
    return null;
  }

  for (const trail of trails) {
    const segment = getSegmentsByTrail(db, trail.id).find((entry) => entry.id === id);
    if (segment) {
      return { trail, segment };
    }
  }

  return null;
}

function buildSegmentElevationProfile(segment: Segment) {
  return [
    { distance: 0, elevation: 820 },
    { distance: segment.distanceMeters * 0.24, elevation: 830 + (segment.elevationGainMeters * 0.22) },
    { distance: segment.distanceMeters * 0.58, elevation: 820 + (segment.elevationGainMeters * 0.7) },
    { distance: segment.distanceMeters, elevation: 820 + segment.elevationGainMeters },
  ];
}

function buildRecommendedConditions(
  segment: Segment,
  difficulty: ReturnType<typeof calculateDifficulty>,
) {
  const conditions = [`Best tackled in ${difficulty === 'easy' ? 'recovery' : 'focused'} effort mode.`];

  if (segment.elevationGainMeters >= 250) {
    conditions.push('Start early and carry water because the climbing load is front-foot dominant.');
  }

  if (segment.distanceMeters >= 1800) {
    conditions.push('Warm up first. This segment is long enough to punish cold pacing.');
  }

  if (difficulty === 'expert' || difficulty === 'hard') {
    conditions.push('Use dry footing and good visibility for your cleanest split.');
  } else {
    conditions.push('Works well for repeatable checks after a broader trail workout.');
  }

  return conditions;
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 96,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0E0E13',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  emptyCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mapHero: {
    overflow: 'hidden',
    backgroundColor: '#12170E',
  },
  mapHeroInner: {
    minHeight: 220,
    justifyContent: 'space-between',
  },
  mapHeroBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(18,19,24,0.68)',
  },
  mapHeroBadgeLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT,
  },
  mapHeroFooter: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  mapHeroFooterText: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  kicker: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
    marginBottom: 6,
  },
  title: {
    fontFamily: TR_FONTS.extraBold,
    color: TR_TEXT,
    fontSize: 32,
    lineHeight: 34,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statPillLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  pbCard: {
    gap: 14,
    backgroundColor: 'rgba(16, 20, 11, 0.82)',
  },
  pbTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pbEyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
    marginBottom: 4,
  },
  pbCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  rankBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  rankBadgeLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: '#0B1505',
    fontFamily: TR_FONTS.bold,
  },
  pbStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionStack: {
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  leaderboardRowYou: {
    backgroundColor: 'rgba(132,204,22,0.14)',
  },
  rankSlot: {
    width: 42,
    alignItems: 'center',
  },
  rankText: {
    fontFamily: TR_FONTS.bold,
    color: TR_TEXT,
    fontSize: 18,
  },
  leaderName: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  leaderMeta: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    marginTop: 2,
  },
  leaderTime: {
    fontFamily: TR_FONTS.extraBold,
    color: TR_ACCENT_LIGHT,
    fontSize: 18,
  },
  chartCard: {
    gap: 10,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLegendCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  effortCard: {
    gap: 8,
  },
  effortHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  effortIndex: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(132,204,22,0.18)',
  },
  effortIndexLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  effortDuration: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  effortMeta: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    marginTop: 2,
  },
  prChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  prChipLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: '#091303',
    fontFamily: TR_FONTS.bold,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  aboutCard: {
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_TERTIARY,
  },
  infoValue: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT,
  },
  conditionsList: {
    gap: 10,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  conditionCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    flex: 1,
  },
});
