import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  DifficultyChip,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  calculateDifficulty,
  createSegment,
  formatDuration,
  getEffortsBySegment,
  getPersonalBest,
  getSegmentsByTrail,
  getTrails,
  haversineDistance,
  type Segment,
  type SegmentEffort,
  type Trail,
} from '@mylife/trails';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { TrailsChip, TrailsHero, TrailsScreen, TRAILS_ACCENT } from './_ui';

type SegmentTab = 'your' | 'nearby' | 'starred';
type NearbySort = 'distance' | 'popularity' | 'new';

type SegmentItem = {
  trail: Trail;
  segment: Segment;
  efforts: SegmentEffort[];
  personalBest: SegmentEffort | null;
  proximityMeters: number;
};

export default function SegmentsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<SegmentTab>('your');
  const [nearbySort, setNearbySort] = useState<NearbySort>('distance');
  const [createVisible, setCreateVisible] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [distanceKm, setDistanceKm] = useState('1.2');
  const [elevationGain, setElevationGain] = useState('120');
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  const trails = useMemo(() => getTrails(db), [db, tick]);
  const referencePoint = useMemo(() => deriveReferencePoint(trails), [trails]);

  const segmentItems = useMemo(() => {
    return trails.flatMap((trail) =>
      getSegmentsByTrail(db, trail.id).map((segment) => {
        const efforts = getEffortsBySegment(db, segment.id);
        const centerLat = (segment.startLat + segment.endLat) / 2;
        const centerLng = (segment.startLng + segment.endLng) / 2;

        return {
          trail,
          segment,
          efforts,
          personalBest: getPersonalBest(db, segment.id),
          proximityMeters: haversineDistance(
            centerLat,
            centerLng,
            referencePoint.lat,
            referencePoint.lng,
          ),
        } satisfies SegmentItem;
      }),
    );
  }, [db, referencePoint.lat, referencePoint.lng, trails]);

  const createdSegments = segmentItems;
  const completedSegments = useMemo(
    () => segmentItems.filter((item) => item.efforts.length > 0),
    [segmentItems],
  );
  const starredSegments = useMemo(
    () => segmentItems.filter((item) => item.trail.isSaved),
    [segmentItems],
  );
  const nearbySegments = useMemo(() => {
    const sorted = [...segmentItems];

    switch (nearbySort) {
      case 'popularity':
        sorted.sort((left, right) => right.efforts.length - left.efforts.length);
        break;
      case 'new':
        sorted.sort(
          (left, right) =>
            new Date(right.segment.createdAt).getTime() - new Date(left.segment.createdAt).getTime(),
        );
        break;
      default:
        sorted.sort((left, right) => left.proximityMeters - right.proximityMeters);
    }

    return sorted;
  }, [nearbySort, segmentItems]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const handleOpenCreate = useCallback(() => {
    if (trails.length === 0) {
      Alert.alert('Add a trail first', 'Create or save a trail before drafting a segment.');
      return;
    }

    setSelectedTrailId((current) => current ?? trails[0]?.id ?? null);
    setCreateVisible(true);
  }, [trails]);

  const handleCreateSegment = useCallback(() => {
    if (!selectedTrailId) {
      Alert.alert('Choose a trail', 'Select the parent trail for this segment.');
      return;
    }

    const trail = trails.find((entry) => entry.id === selectedTrailId);
    const parsedDistanceKm = Number.parseFloat(distanceKm);
    const parsedElevationGain = Number.parseFloat(elevationGain);

    if (!trail || !newSegmentName.trim() || !Number.isFinite(parsedDistanceKm) || parsedDistanceKm <= 0) {
      Alert.alert('Check segment details', 'Provide a name and a valid distance before saving.');
      return;
    }

    try {
      const distanceMeters = Math.round(parsedDistanceKm * 1000);
      const latOffset = Math.max(distanceMeters / 180_000, 0.0012);
      const lngOffset = latOffset * 0.85;

      createSegment(db, uuid(), {
        trailId: trail.id,
        name: newSegmentName.trim(),
        startLat: trail.lat - (latOffset / 2),
        startLng: trail.lng - (lngOffset / 2),
        endLat: trail.lat + (latOffset / 2),
        endLng: trail.lng + (lngOffset / 2),
        distanceMeters,
        elevationGainMeters: Number.isFinite(parsedElevationGain) ? Math.max(parsedElevationGain, 0) : 0,
      });

      setCreateVisible(false);
      setActiveTab('your');
      setNewSegmentName('');
      setDistanceKm('1.2');
      setElevationGain('120');
      setTick((value) => value + 1);
    } catch {
      Alert.alert('Unable to create segment', 'The segment draft could not be saved.');
    }
  }, [db, distanceKm, elevationGain, newSegmentName, selectedTrailId, trails]);

  const totalPrs = completedSegments.filter((item) => item.personalBest != null).length;

  return (
    <View style={styles.root}>
      <TrailsScreen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={TR_ACCENT_LIGHT}
          />
        }
        contentContainerStyle={styles.content}
      >
        <TrailsHero
          title="Segments"
          subtitle="Track the repeatable slices of trail that matter most, then compare your best efforts and draft new checkpoints for the next outing."
          action={<TrailsChip label="Create Segment" active onPress={handleOpenCreate} />}
        />

        <View style={styles.metricRow}>
          <SummaryCard label="Tracked Segments" value={String(segmentItems.length)} />
          <SummaryCard label="Completed" value={String(completedSegments.length)} />
          <SummaryCard label="PRs Logged" value={String(totalPrs)} />
        </View>

        <View style={styles.segmentedControl}>
          <TabChip label="Your Segments" active={activeTab === 'your'} onPress={() => setActiveTab('your')} />
          <TabChip label="Nearby" active={activeTab === 'nearby'} onPress={() => setActiveTab('nearby')} />
          <TabChip label="Starred" active={activeTab === 'starred'} onPress={() => setActiveTab('starred')} />
        </View>

        {activeTab === 'your' ? (
          <View style={styles.sectionStack}>
            <View style={styles.sectionBlock}>
              <SectionHeader title="Created" />
              {createdSegments.length === 0 ? (
                <EmptyState
                  title="No segments drafted yet"
                  copy="Use the create flow to mark a climb, sprint, or favorite checkpoint."
                />
              ) : (
                createdSegments.map((item) => (
                  <SegmentCard
                    key={item.segment.id}
                    item={item}
                    onPress={() => router.push(`/(trails)/segment/${item.segment.id}` as `/${string}`)}
                  />
                ))
              )}
            </View>

            <View style={styles.sectionBlock}>
              <SectionHeader title="Completed" />
              {completedSegments.length === 0 ? (
                <EmptyState
                  title="No efforts recorded yet"
                  copy="Once a recording matches a segment, your best time and PR chip show up here."
                />
              ) : (
                completedSegments.map((item) => (
                  <SegmentCard
                    key={`${item.segment.id}-complete`}
                    item={item}
                    onPress={() => router.push(`/(trails)/segment/${item.segment.id}` as `/${string}`)}
                    showCompletionMeta
                  />
                ))
              )}
            </View>
          </View>
        ) : null}

        {activeTab === 'nearby' ? (
          <View style={styles.sectionStack}>
            <View style={styles.sortRow}>
              <TabChip label="Distance" active={nearbySort === 'distance'} onPress={() => setNearbySort('distance')} compact />
              <TabChip label="Popularity" active={nearbySort === 'popularity'} onPress={() => setNearbySort('popularity')} compact />
              <TabChip label="New" active={nearbySort === 'new'} onPress={() => setNearbySort('new')} compact />
            </View>

            {nearbySegments.length === 0 ? (
              <EmptyState
                title="No nearby segments yet"
                copy="Save more trails locally to populate this discovery shelf."
              />
            ) : (
              nearbySegments.map((item) => (
                <SegmentCard
                  key={`${item.segment.id}-nearby`}
                  item={item}
                  onPress={() => router.push(`/(trails)/segment/${item.segment.id}` as `/${string}`)}
                  showNearbyMeta
                />
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'starred' ? (
          <View style={styles.sectionStack}>
            {starredSegments.length === 0 ? (
              <EmptyState
                title="No starred segments yet"
                copy="Star a trail from segment detail to keep its checkpoints pinned here."
              />
            ) : (
              starredSegments.map((item) => (
                <SegmentCard
                  key={`${item.segment.id}-starred`}
                  item={item}
                  onPress={() => router.push(`/(trails)/segment/${item.segment.id}` as `/${string}`)}
                  showStarredMeta
                />
              ))
            )}
          </View>
        ) : null}
      </TrailsScreen>

      <Pressable onPress={handleOpenCreate} style={styles.fab}>
        <MaterialSymbol name="add" size={22} color="#091303" />
      </Pressable>

      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <GlassCard padding={18} style={styles.modalCard}>
            <RNText style={styles.modalTitle}>Create Segment</RNText>
            <RNText style={styles.modalCopy}>
              Draft a local segment from one of your trails. Trail save state doubles as the current star system.
            </RNText>

            <Field label="Trail">
              <View style={styles.trailChipRow}>
                {trails.map((trail) => (
                  <TabChip
                    key={trail.id}
                    label={trail.name}
                    active={selectedTrailId === trail.id}
                    onPress={() => setSelectedTrailId(trail.id)}
                    compact
                  />
                ))}
              </View>
            </Field>

            <Field label="Segment name">
              <TextInput
                value={newSegmentName}
                onChangeText={setNewSegmentName}
                placeholder="Upper switchback push"
                placeholderTextColor={TR_TEXT_TERTIARY}
                style={styles.input}
              />
            </Field>

            <View style={styles.modalGrid}>
              <Field label="Distance (km)">
                <TextInput
                  value={distanceKm}
                  onChangeText={setDistanceKm}
                  placeholder="1.2"
                  placeholderTextColor={TR_TEXT_TERTIARY}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>
              <Field label="Elevation gain (m)">
                <TextInput
                  value={elevationGain}
                  onChangeText={setElevationGain}
                  placeholder="120"
                  placeholderTextColor={TR_TEXT_TERTIARY}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </Field>
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreateVisible(false)} style={styles.secondaryButton}>
                <RNText style={styles.secondaryButtonLabel}>Cancel</RNText>
              </Pressable>
              <Pressable onPress={handleCreateSegment} style={styles.primaryButton}>
                <RNText style={styles.primaryButtonLabel}>Create Segment</RNText>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

function SegmentCard({
  item,
  onPress,
  showNearbyMeta,
  showStarredMeta,
  showCompletionMeta,
}: {
  item: SegmentItem;
  onPress: () => void;
  showNearbyMeta?: boolean;
  showStarredMeta?: boolean;
  showCompletionMeta?: boolean;
}) {
  const difficulty = calculateDifficulty(
    item.segment.distanceMeters,
    item.segment.elevationGainMeters,
    null,
  );

  return (
    <Pressable onPress={onPress}>
      <GlassCard padding={16} style={styles.segmentCard}>
        <View style={styles.segmentHeader}>
          <View style={styles.segmentCopy}>
            <RNText style={styles.segmentTitle}>{item.segment.name}</RNText>
            <RNText style={styles.segmentSubtitle}>
              {item.trail.name} · {formatDistance(item.segment.distanceMeters)} · {Math.round(item.segment.elevationGainMeters)} m gain
            </RNText>
          </View>
          <DifficultyChip level={difficulty} size="sm" />
        </View>

        <View style={styles.segmentMetaRow}>
          <Pill icon="schedule" label={item.personalBest ? formatDuration(item.personalBest.durationSeconds) : 'No PB'} />
          <Pill icon="route" label={`${item.efforts.length} effort${item.efforts.length === 1 ? '' : 's'}`} />
          {item.personalBest ? <Pill icon="flag" label="PR" accent /> : null}
        </View>

        {showNearbyMeta ? (
          <RNText style={styles.tertiaryCopy}>
            {formatDistance(item.proximityMeters)} from your current trail cluster
          </RNText>
        ) : null}

        {showStarredMeta ? (
          <RNText style={styles.tertiaryCopy}>Starred because its parent trail is saved</RNText>
        ) : null}

        {showCompletionMeta ? (
          <RNText style={styles.tertiaryCopy}>
            Fastest effort: {item.personalBest ? formatDuration(item.personalBest.durationSeconds) : 'waiting for first effort'}
          </RNText>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <GlassCard padding={14} style={styles.summaryCard}>
      <RNText style={styles.summaryValue}>{value}</RNText>
      <RNText style={styles.summaryLabel}>{label}</RNText>
    </GlassCard>
  );
}

function TabChip({
  label,
  active,
  onPress,
  compact,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabChip,
        active ? styles.tabChipActive : null,
        compact ? styles.tabChipCompact : null,
      ]}
    >
      <RNText style={[styles.tabChipLabel, active ? styles.tabChipLabelActive : null]}>
        {label}
      </RNText>
    </Pressable>
  );
}

function Pill({
  icon,
  label,
  accent,
}: {
  icon: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.pill, accent ? styles.pillAccent : null]}>
      <MaterialSymbol
        name={icon}
        size={13}
        color={accent ? '#0B1505' : TR_ACCENT_LIGHT}
      />
      <RNText style={[styles.pillLabel, accent ? styles.pillLabelAccent : null]}>{label}</RNText>
    </View>
  );
}

function EmptyState({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <GlassCard padding={18} style={styles.emptyCard}>
      <RNText style={styles.emptyTitle}>{title}</RNText>
      <RNText style={styles.emptyCopy}>{copy}</RNText>
    </GlassCard>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <RNText style={styles.fieldLabel}>{label}</RNText>
      {children}
    </View>
  );
}

function deriveReferencePoint(trails: Trail[]) {
  if (trails.length === 0) {
    return { lat: 37.7749, lng: -122.4194 };
  }

  const preferred = trails.find((trail) => trail.isSaved) ?? trails[0];
  return { lat: preferred.lat, lng: preferred.lng };
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    minHeight: 94,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 20, 11, 0.78)',
  },
  summaryValue: {
    fontFamily: TR_FONTS.extraBold,
    color: TR_ACCENT_LIGHT,
    fontSize: 28,
  },
  summaryLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_SECONDARY,
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabChipActive: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  tabChipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabChipLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_SECONDARY,
  },
  tabChipLabelActive: {
    color: '#081303',
  },
  sectionStack: {
    gap: 16,
  },
  sectionBlock: {
    gap: 10,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentCard: {
    gap: 12,
    marginBottom: 10,
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  segmentCopy: {
    flex: 1,
    gap: 3,
  },
  segmentTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  segmentSubtitle: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  segmentMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillAccent: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  pillLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  pillLabelAccent: {
    color: '#0B1505',
    fontFamily: TR_FONTS.semiBold,
  },
  tertiaryCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
    marginBottom: 4,
  },
  emptyCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TR_ACCENT_LIGHT,
    shadowColor: TRAILS_ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  modalCard: {
    gap: 14,
    backgroundColor: 'rgba(18,19,24,0.9)',
  },
  modalTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  modalCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  trailChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: TR_TEXT,
    fontFamily: TR_FONTS.medium,
    fontSize: 14,
  },
  modalGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryButtonLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  primaryButtonLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: '#091303',
    fontFamily: TR_FONTS.bold,
  },
});
