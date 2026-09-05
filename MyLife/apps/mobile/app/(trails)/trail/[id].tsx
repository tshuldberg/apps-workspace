import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createOfflineRegion,
  deleteTrail,
  DifficultyChip,
  ElevationMiniChart,
  estimateRegionSizeBytes,
  estimateRegionTileCount,
  exceedsTileLimit,
  getNearbyTrails,
  getRecordingsByTrail,
  getReviewCount,
  getReviewsByTrail,
  getSegmentsByTrail,
  getTrail,
  getTrailPhotos,
  getWaypointsByRecording,
  GlassCard,
  markRegionReady,
  MaterialSymbol,
  MiniMapCard,
  SectionHeader,
  StatDisplay,
  TrailCard,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  updateTrail,
  type Trail,
  type TrailPhoto,
  type TrailRecording,
  type TrailReview,
  type Waypoint,
  withAlpha,
} from '@mylife/trails';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = Math.min(420, SCREEN_WIDTH * 1.04);

type TrailTypeLabel = 'Loop' | 'Out & Back' | 'Point to Point';

export default function TrailDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingOffline, setDownloadingOffline] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const trail = useMemo(() => {
    if (!id) {
      return null;
    }

    try {
      return getTrail(db, id);
    } catch {
      setError('Failed to load trail detail.');
      return null;
    }
  }, [db, id, refreshKey]);

  const recordings = useMemo(() => {
    if (!id) {
      return [] as TrailRecording[];
    }

    try {
      return getRecordingsByTrail(db, id);
    } catch {
      setError('Failed to load trail recordings.');
      return [] as TrailRecording[];
    }
  }, [db, id, refreshKey]);

  const reviews = useMemo(() => {
    if (!id) {
      return [] as TrailReview[];
    }

    try {
      return getReviewsByTrail(db, id);
    } catch {
      setError('Failed to load trail reviews.');
      return [] as TrailReview[];
    }
  }, [db, id, refreshKey]);

  const photos = useMemo(() => {
    if (!id) {
      return [] as TrailPhoto[];
    }

    try {
      return getTrailPhotos(db, id, 8);
    } catch {
      setError('Failed to load trail photos.');
      return [] as TrailPhoto[];
    }
  }, [db, id, refreshKey]);

  const nearbyTrails = useMemo(() => {
    if (!id) {
      return [] as Trail[];
    }

    try {
      return getNearbyTrails(db, id, 6);
    } catch {
      setError('Failed to load nearby trails.');
      return [] as Trail[];
    }
  }, [db, id, refreshKey]);

  const segmentCount = useMemo(() => {
    if (!id) {
      return 0;
    }

    try {
      return getSegmentsByTrail(db, id).length;
    } catch {
      return 0;
    }
  }, [db, id, refreshKey]);

  const reviewCount = useMemo(() => {
    if (!id) {
      return 0;
    }

    try {
      return getReviewCount(db, id);
    } catch {
      return reviews.length;
    }
  }, [db, id, reviews.length]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) {
      return null;
    }

    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  const elevationPreview = useMemo(() => {
    if (!trail) {
      return [];
    }

    try {
      for (const recording of recordings) {
        const waypoints = getWaypointsByRecording(db, recording.id).filter(
          (waypoint) => waypoint.elevation !== null,
        );
        if (waypoints.length >= 3) {
          return buildWaypointElevationPreview(waypoints);
        }
      }
    } catch {
      setError('Failed to build elevation preview.');
    }

    return buildSyntheticElevationPreview(trail);
  }, [db, recordings, trail]);

  const maxElevation = useMemo(() => {
    if (elevationPreview.length === 0) {
      return trail ? Math.round(trail.elevationGainMeters + 1200) : 0;
    }

    return Math.round(
      Math.max(...elevationPreview.map((point) => point.elevation)),
    );
  }, [elevationPreview, trail]);

  const estimatedMinutes = trail?.estimatedMinutes ?? Math.max(
    45,
    Math.round((trail?.distanceMeters ?? 0) / 80),
  );
  const activityTags = useMemo(() => deriveActivityTags(trail, recordings), [recordings, trail]);
  const trailType = useMemo(() => deriveTrailType(trail), [trail]);
  const description = trail?.description?.trim() ?? '';
  const shouldClampDescription = description.length > 180;
  const visibleDescription = !shouldClampDescription || expandedDescription
    ? description
    : `${description.slice(0, 180).trimEnd()}...`;

  const saved = Boolean(trail?.isSaved);
  const selectedPhoto = photos[selectedPhotoIndex] ?? null;

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const handleToggleSaved = useCallback(() => {
    if (!trail || !id) {
      return;
    }

    try {
      updateTrail(db, id, { isSaved: !trail.isSaved });
      refresh();
    } catch {
      Alert.alert('Could not update trail', 'Try saving this trail again.');
    }
  }, [db, id, refresh, trail]);

  const handleShare = useCallback(async () => {
    if (!trail) {
      return;
    }

    try {
      await Share.share({
        message: `${trail.name} · ${trail.region ?? 'MyTrails'} · ${formatDistance(trail.distanceMeters)} · ${Math.round(trail.elevationGainMeters)} m gain`,
      });
    } catch {
      Alert.alert('Share unavailable', 'This trail could not be shared right now.');
    }
  }, [trail]);

  const handleDelete = useCallback(() => {
    if (!id || !trail) {
      return;
    }

    Alert.alert(
      'Delete Trail',
      `Delete "${trail.name}" and all of its local detail data?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteTrail(db, id);
              router.back();
            } catch {
              Alert.alert('Delete failed', 'The trail could not be deleted.');
            }
          },
        },
      ],
    );
  }, [db, id, router, trail]);

  const handleDownloadOffline = useCallback(() => {
    if (!trail || downloadingOffline) {
      return;
    }

    const regionId = `trail-region-${trail.id}`;
    const regionKey = `trail-${trail.id}`;
    const bounds = buildTrailBounds(trail);
    const minZoom = 10;
    const initialMaxZoom = 15;
    const maxZoom = exceedsTileLimit(
      estimateRegionTileCount(
        bounds.minLat,
        bounds.maxLat,
        bounds.minLng,
        bounds.maxLng,
        minZoom,
        initialMaxZoom,
      ),
    )
      ? 13
      : initialMaxZoom;
    const tileCount = estimateRegionTileCount(
      bounds.minLat,
      bounds.maxLat,
      bounds.minLng,
      bounds.maxLng,
      minZoom,
      maxZoom,
    );
    const sizeBytes = estimateRegionSizeBytes(tileCount);

    setDownloadingOffline(true);
    try {
      createOfflineRegion(db, regionId, {
        name: `${trail.name} Offline`,
        regionKey,
        minLat: bounds.minLat,
        maxLat: bounds.maxLat,
        minLng: bounds.minLng,
        maxLng: bounds.maxLng,
        minZoom,
        maxZoom,
      });
      markRegionReady(db, regionId, sizeBytes, tileCount);
      refresh();
      Alert.alert(
        'Offline region ready',
        `${trail.name} is now cached for offline map access.`,
        [
          {
            text: 'View Downloads',
            onPress: () => router.push('/(trails)/offline-regions'),
          },
          { text: 'Done' },
        ],
      );
    } catch {
      Alert.alert(
        'Offline download unavailable',
        'This trail may already be downloaded. Open Offline Maps to manage regions.',
        [
          {
            text: 'Open Offline Maps',
            onPress: () => router.push('/(trails)/offline-regions'),
          },
          { text: 'OK' },
        ],
      );
    } finally {
      setDownloadingOffline(false);
    }
  }, [db, downloadingOffline, refresh, router, trail]);

  const handleMore = useCallback(() => {
    if (!trail) {
      return;
    }

    Alert.alert(
      trail.name,
      'Trail actions',
      [
        {
          text: saved ? 'Unsave Trail' : 'Save Trail',
          onPress: handleToggleSaved,
        },
        {
          text: 'Download Offline',
          onPress: handleDownloadOffline,
        },
        {
          text: 'Delete Trail',
          style: 'destructive',
          onPress: handleDelete,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  }, [handleDelete, handleDownloadOffline, handleToggleSaved, saved, trail]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>⚠️</Text>
        <Text style={styles.emptyTitle}>{error}</Text>
        <Text style={styles.emptyCopy}>
          Reload the trail and try again.
        </Text>
        <PrimaryAction label="Retry" onPress={refresh} />
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>🥾</Text>
        <Text style={styles.emptyTitle}>Trail not found</Text>
        <Text style={styles.emptyCopy}>
          This trail may have been removed from your local collection.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroShell}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setSelectedPhotoIndex(nextIndex);
            }}
            scrollEventThrottle={16}
          >
            {photos.length > 0 ? (
              photos.map((photo) => (
                <View key={photo.id} style={styles.photoSlide}>
                  <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.photoImage} />
                </View>
              ))
            ) : (
              <View style={styles.photoSlide}>
                <LinearGradient
                  colors={['rgba(132,204,22,0.34)', 'rgba(41,61,12,0.46)', '#0E0E13']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.photoImage}
                >
                  <MaterialSymbol name="landscape" size={54} color={TR_ACCENT_LIGHT} />
                  <Text style={styles.placeholderTitle}>Trail Cover</Text>
                  <Text style={styles.placeholderCopy}>
                    Photos from recordings and trail memories surface here.
                  </Text>
                </LinearGradient>
              </View>
            )}
          </ScrollView>

          <LinearGradient
            colors={['rgba(14,14,19,0.04)', 'rgba(14,14,19,0.24)', 'rgba(14,14,19,0.92)']}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.heroHeader}>
            <HeaderIcon name="arrow_back" onPress={() => router.back()} />
            <View style={styles.heroHeaderActions}>
              <HeaderIcon name="star" filled={saved} onPress={handleToggleSaved} />
              <HeaderIcon name="share" onPress={() => void handleShare()} />
              <HeaderIcon name="more_vert" onPress={handleMore} />
            </View>
          </View>

          <View style={styles.heroChips}>
            <DifficultyChip level={trail.difficulty} />
            <Chip
              icon="route"
              label={trailType}
              color={withAlpha(TR_ACCENT_LIGHT, 0.14)}
              textColor={TR_ACCENT_LIGHT}
            />
          </View>

          <View style={styles.pageDots}>
            {(photos.length > 0 ? photos : [{ id: 'placeholder' }]).map((photo, index) => (
              <View
                key={photo.id}
                style={[
                  styles.pageDot,
                  index === selectedPhotoIndex ? styles.pageDotActive : null,
                ]}
              />
            ))}
          </View>
        </View>

        <GlassCard elevated style={styles.titleCard}>
          <Text style={styles.trailName}>{trail.name}</Text>
          <View style={styles.locationRow}>
            <MaterialSymbol name="place" size={16} color={TR_ACCENT_LIGHT} />
            <Text style={styles.locationCopy}>{trail.region ?? 'Offline local trail'}</Text>
          </View>
          <View style={styles.ratingRow}>
            <View style={styles.starRow}>
              {Array.from({ length: 5 }, (_, index) => (
                <MaterialSymbol
                  key={`rating-${index + 1}`}
                  name="star"
                  filled={averageRating !== null && index < Math.round(averageRating)}
                  size={16}
                  color={TR_ACCENT_LIGHT}
                />
              ))}
            </View>
            <Text style={styles.ratingValue}>
              {averageRating !== null ? averageRating.toFixed(1) : 'No ratings yet'}
            </Text>
            <Text style={styles.ratingCopy}>
              {reviewCount} review{reviewCount === 1 ? '' : 's'}
            </Text>
          </View>
        </GlassCard>

        <View style={styles.statGrid}>
          <MetricTile label="Distance" value={(trail.distanceMeters / 1000).toFixed(1)} unit="km" />
          <MetricTile label="Elevation" value={Math.round(trail.elevationGainMeters)} unit="m" />
          <MetricTile label="Duration" value={estimatedMinutes} unit="min" />
          <MetricTile label="Max Elev." value={maxElevation} unit="m" />
        </View>

        <View style={styles.rowWrap}>
          <DifficultyChip level={trail.difficulty} size="sm" />
          <Chip label={trailType} icon="route" />
          {activityTags.map((tag) => (
            <Chip key={tag} label={tag} icon="hiking" />
          ))}
        </View>

        {description ? (
          <GlassCard style={styles.copyCard}>
            <SectionHeader title="Overview" />
            <Text style={styles.descriptionCopy}>{visibleDescription}</Text>
            {shouldClampDescription ? (
              <Pressable onPress={() => setExpandedDescription((value) => !value)} hitSlop={8}>
                <Text style={styles.inlineLink}>
                  {expandedDescription ? 'Read Less' : 'Read More'}
                </Text>
              </Pressable>
            ) : null}
          </GlassCard>
        ) : null}

        <View style={styles.mapShell}>
          <SectionHeader
            title="Map Preview"
            action={{
              label: 'Record Here',
              onPress: () => router.push({ pathname: '/(trails)/record', params: { trailId: trail.id } }),
            }}
          />
          <View>
            <MiniMapCard
              center={{ lat: trail.lat, lng: trail.lng }}
              trail={{ name: trail.name }}
              showLiveGPS={recordings.some((recording) => recording.endedAt === null)}
              style={styles.mapCard}
            />
            <View style={styles.mapOverlay}>
              <PrimaryAction
                label="Start Recording"
                icon="play_arrow"
                onPress={() => router.push({ pathname: '/(trails)/record', params: { trailId: trail.id } })}
              />
            </View>
          </View>
        </View>

        <GlassCard style={styles.chartCard}>
          <SectionHeader
            title="Elevation Profile"
            action={{
              label: 'Full View',
              onPress: () => router.push({ pathname: '/(trails)/elevation-profile', params: { trailId: trail.id } }),
            }}
          />
          <ElevationMiniChart points={elevationPreview} height={92} />
          <View style={styles.chartMeta}>
            <Text style={styles.captionCopy}>
              {formatDistance(trail.distanceMeters)} route preview
            </Text>
            <Text style={styles.captionCopy}>
              {Math.round(trail.elevationGainMeters)} m gain
            </Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.reviewCard}>
          <SectionHeader
            title={`Reviews Preview`}
            action={{
              label: 'See All',
              onPress: () => router.push({ pathname: '/(trails)/reviews', params: { trailId: trail.id } }),
            }}
          />
          <View style={styles.reviewSummaryRow}>
            <Text style={styles.reviewHeadline}>
              {averageRating !== null ? averageRating.toFixed(1) : '--'}
            </Text>
            <Text style={styles.reviewSummaryCopy}>
              from {reviewCount} hiker review{reviewCount === 1 ? '' : 's'}
            </Text>
          </View>
          {reviews.length > 0 ? (
            <View style={styles.reviewPreviewList}>
              {reviews.slice(0, 2).map((review) => (
                <View key={review.id} style={styles.reviewPreviewItem}>
                  <View style={styles.reviewPreviewHeader}>
                    <Text style={styles.previewStars}>
                      {'★'.repeat(review.rating)}
                    </Text>
                    <Text style={styles.captionCopy}>
                      {formatDate(review.createdAt)}
                    </Text>
                  </View>
                  {review.title ? (
                    <Text style={styles.reviewTitle}>{review.title}</Text>
                  ) : null}
                  {review.body ? (
                    <Text style={styles.reviewBody} numberOfLines={3}>
                      {review.body}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyInlineCopy}>
              No community reviews yet. Be the first to leave trail notes and conditions.
            </Text>
          )}
        </GlassCard>

        {nearbyTrails.length > 0 ? (
          <View style={styles.nearbySection}>
            <SectionHeader title="Nearby Trails" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRail}>
              {nearbyTrails.map((nearbyTrail) => (
                <View key={nearbyTrail.id} style={styles.nearbyCard}>
                  <TrailCard
                    trail={{
                      id: nearbyTrail.id,
                      name: nearbyTrail.name,
                      difficulty: nearbyTrail.difficulty,
                      distanceMeters: nearbyTrail.distanceMeters,
                      elevationGainMeters: nearbyTrail.elevationGainMeters,
                      region: nearbyTrail.region,
                      description: nearbyTrail.description,
                      coverUri: selectedPhoto?.uri ?? null,
                    }}
                    variant="row"
                    onPress={() => router.push(`/(trails)/trail/${nearbyTrail.id}` as `/${string}`)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <GlassCard style={styles.quickFactsCard}>
          <SectionHeader title="Trail Data" />
          <View style={styles.quickFactsGrid}>
            <FactPill icon="activity" label={`${recordings.length} recording${recordings.length === 1 ? '' : 's'}`} />
            <FactPill icon="terrain" label={`${segmentCount} segments`} />
            <FactPill icon="photo_camera" label={`${photos.length} photos`} />
            <FactPill icon="download_for_offline" label={downloadingOffline ? 'Saving offline...' : 'Offline ready in 1 tap'} />
          </View>
        </GlassCard>
      </ScrollView>

      <View pointerEvents="box-none" style={styles.bottomActionShell}>
        <View style={styles.bottomActionBar}>
          <BlurView
            tint="dark"
            intensity={70}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(132,204,22,0.16)', 'rgba(19,19,24,0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <PrimaryAction
            label="Start Recording"
            icon="play_arrow"
            style={styles.primaryBottomAction}
            onPress={() => router.push({ pathname: '/(trails)/record', params: { trailId: trail.id } })}
          />
          <SecondaryAction
            label={downloadingOffline ? 'Saving...' : 'Download Offline'}
            icon="download_for_offline"
            onPress={handleDownloadOffline}
          />
          <SecondaryAction
            label={saved ? 'Saved' : 'Save'}
            icon="star"
            filled={saved}
            onPress={handleToggleSaved}
          />
        </View>
      </View>
    </View>
  );
}

function HeaderIcon({
  name,
  filled = false,
  onPress,
}: {
  name: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.headerIconButton} hitSlop={10}>
      <MaterialSymbol name={name} size={20} color={TR_TEXT} filled={filled} />
    </Pressable>
  );
}

function MetricTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string;
  unit: string;
}) {
  return (
    <GlassCard style={styles.metricTile} padding={14}>
      <StatDisplay label={label} value={value} unit={unit} size="sm" color={TR_ACCENT_LIGHT} />
    </GlassCard>
  );
}

function Chip({
  label,
  icon,
  color = 'rgba(255,255,255,0.06)',
  textColor = TR_TEXT_SECONDARY,
}: {
  label: string;
  icon?: string;
  color?: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      {icon ? <MaterialSymbol name={icon} size={13} color={textColor} /> : null}
      <Text style={[styles.chipLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function FactPill({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.factPill}>
      <MaterialSymbol name={icon} size={14} color={TR_ACCENT_LIGHT} />
      <Text style={styles.factPillCopy}>{label}</Text>
    </View>
  );
}

function PrimaryAction({
  label,
  icon,
  onPress,
  style,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.primaryAction, style]}>
      <LinearGradient
        colors={[TR_ACCENT_LIGHT, TR_ACCENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionFill}
      >
        {icon ? <MaterialSymbol name={icon} size={18} color="#102108" filled /> : null}
        <Text style={styles.primaryActionLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryAction({
  label,
  icon,
  filled = false,
  onPress,
}: {
  label: string;
  icon?: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryAction}>
      {icon ? <MaterialSymbol name={icon} size={16} color={TR_TEXT_SECONDARY} filled={filled} /> : null}
      <Text style={styles.secondaryActionLabel}>{label}</Text>
    </Pressable>
  );
}

function buildTrailBounds(trail: Trail) {
  const latRadius = Math.max(0.015, Math.min(0.06, trail.distanceMeters / 120000));
  const lngScale = Math.max(0.25, Math.cos((trail.lat * Math.PI) / 180));
  const lngRadius = latRadius / lngScale;

  return {
    minLat: trail.lat - latRadius,
    maxLat: trail.lat + latRadius,
    minLng: trail.lng - lngRadius,
    maxLng: trail.lng + lngRadius,
  };
}

function buildWaypointElevationPreview(waypoints: Waypoint[]) {
  const preview = [{ distance: 0, elevation: waypoints[0].elevation ?? 0 }];
  let totalDistance = 0;

  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1];
    const current = waypoints[index];
    totalDistance += approximateDistance(previous, current);
    preview.push({
      distance: Math.round(totalDistance),
      elevation: current.elevation ?? preview[preview.length - 1]?.elevation ?? 0,
    });
  }

  return preview;
}

function approximateDistance(previous: Waypoint, current: Waypoint) {
  const latDelta = current.lat - previous.lat;
  const lngDelta = current.lng - previous.lng;
  return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) * 111_000;
}

function buildSyntheticElevationPreview(trail: Trail) {
  const baseElevation = Math.round(900 + trail.elevationGainMeters * 0.3);
  const steps = [0, 0.12, 0.24, 0.38, 0.52, 0.7, 0.86, 1];
  const profileShape =
    trail.difficulty === 'expert'
      ? [0, 0.18, 0.34, 0.76, 1, 0.82, 0.58, 0.46]
      : trail.difficulty === 'hard'
        ? [0, 0.12, 0.3, 0.66, 0.88, 0.72, 0.5, 0.34]
        : trail.difficulty === 'moderate'
          ? [0, 0.1, 0.22, 0.42, 0.62, 0.58, 0.4, 0.24]
          : [0, 0.06, 0.16, 0.28, 0.4, 0.36, 0.22, 0.12];

  return steps.map((step, index) => ({
    distance: Math.round(trail.distanceMeters * step),
    elevation: baseElevation + Math.round(profileShape[index] * trail.elevationGainMeters),
  }));
}

function deriveTrailType(trail: Trail | null): TrailTypeLabel {
  const haystack = `${trail?.name ?? ''} ${trail?.description ?? ''}`.toLowerCase();

  if (haystack.includes('loop')) {
    return 'Loop';
  }
  if (haystack.includes('point to point')) {
    return 'Point to Point';
  }
  return 'Out & Back';
}

function deriveActivityTags(trail: Trail | null, recordings: TrailRecording[]) {
  const tags = new Set<string>();

  if (recordings.some((recording) => recording.activityType === 'run')) {
    tags.add('Trail Run');
  }
  if (trail && trail.distanceMeters >= 16000) {
    tags.add('Backpacking');
  }
  tags.add('Hiking');

  return Array.from(tags).slice(0, 3);
}

function formatDistance(distanceMeters: number) {
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
  },
  content: {
    paddingBottom: 152,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 42,
  },
  emptyTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
    textAlign: 'center',
  },
  emptyCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  heroShell: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  photoSlide: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  placeholderTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  placeholderCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
    maxWidth: 260,
  },
  heroHeader: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(14,14,19,0.54)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChips: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pageDots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  pageDotActive: {
    width: 20,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  titleCard: {
    marginHorizontal: 16,
    marginTop: -24,
    gap: 10,
  },
  trailName: {
    ...TR_TYPOGRAPHY.displayLg,
    fontSize: 32,
    lineHeight: 34,
    color: TR_TEXT,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingValue: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  ratingCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  metricTile: {
    width: (SCREEN_WIDTH - 44) / 2,
    minHeight: 92,
    justifyContent: 'center',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    ...TR_TYPOGRAPHY.caption,
    fontFamily: TR_FONTS.semiBold,
  },
  copyCard: {
    marginHorizontal: 16,
    gap: 12,
  },
  descriptionCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  inlineLink: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  mapShell: {
    gap: 12,
    paddingHorizontal: 16,
  },
  mapCard: {
    minHeight: 210,
  },
  mapOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  chartCard: {
    marginHorizontal: 16,
    gap: 14,
  },
  chartMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  captionCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  reviewCard: {
    marginHorizontal: 16,
    gap: 14,
  },
  reviewSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewHeadline: {
    ...TR_TYPOGRAPHY.displayLg,
    fontSize: 34,
    lineHeight: 34,
    color: TR_ACCENT_LIGHT,
  },
  reviewSummaryCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    flex: 1,
  },
  reviewPreviewList: {
    gap: 12,
  },
  reviewPreviewItem: {
    gap: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
  },
  reviewPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  previewStars: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  reviewTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  reviewBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  emptyInlineCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  nearbySection: {
    gap: 12,
    paddingLeft: 16,
  },
  nearbyRail: {
    paddingRight: 16,
    gap: 12,
  },
  nearbyCard: {
    width: Math.min(320, SCREEN_WIDTH - 56),
  },
  quickFactsCard: {
    marginHorizontal: 16,
    gap: 14,
  },
  quickFactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  factPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  factPillCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  bottomActionShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  bottomActionBar: {
    minHeight: 76,
    borderRadius: 28,
    overflow: 'hidden',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryBottomAction: {
    flex: 1.2,
  },
  primaryAction: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  actionFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryActionLabel: {
    ...TR_TYPOGRAPHY.titleMd,
    color: '#102108',
    fontFamily: TR_FONTS.bold,
  },
  secondaryAction: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
  },
  secondaryActionLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    fontFamily: TR_FONTS.semiBold,
  },
});
