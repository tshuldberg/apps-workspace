import { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  GlassCard,
  MaterialSymbol,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  getPhotos,
  getRecordings,
  getTrails,
  type Trail,
  type TrailPhoto,
  type TrailRecording,
} from '@mylife/trails';
import { Text, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { TrailsChip, TrailsHero, TrailsScreen, TrailsSection } from './_ui';

type GalleryMode = 'grid' | 'map' | 'timeline';
type FilterMode = 'all' | 'hasLocation' | 'favorites' | 'trail';

type GalleryItem = {
  id: string;
  trailId: string | null;
  trailName: string;
  takenAt: string;
  lat: number;
  lng: number;
  uri: string | null;
  caption: string | null;
  source: 'photo' | 'memory';
  palette: readonly [string, string];
  locationLabel: string;
};

type GalleryCluster = {
  id: string;
  left: number;
  top: number;
  items: GalleryItem[];
};

const LIGHTBOX_WIDTH = Dimensions.get('window').width;
const ART_PALETTES = [
  ['#3B82F6', '#1E293B'],
  ['#F59E0B', '#7C2D12'],
  ['#14B8A6', '#134E4A'],
  ['#84CC16', '#14532D'],
  ['#F97316', '#7C2D12'],
  ['#A855F7', '#312E81'],
] as const;

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function paletteFor(value: string) {
  return ART_PALETTES[hashSeed(value) % ART_PALETTES.length];
}

function buildRecordingMemories(recordings: TrailRecording[], trails: Trail[]) {
  return recordings.slice(0, 18).map((recording) => {
    const trail = trails.find((entry) => entry.id === recording.trailId);
    const palette = paletteFor(recording.id);

    return {
      id: `memory-${recording.id}`,
      trailId: trail?.id ?? null,
      trailName: trail?.name ?? recording.name,
      takenAt: recording.startedAt,
      lat: trail?.lat ?? 37.7 + (hashSeed(recording.id) % 20) / 100,
      lng: trail?.lng ?? -122.4 - (hashSeed(recording.id + 'lng') % 20) / 100,
      uri: null,
      caption: recording.name,
      source: 'memory' as const,
      palette,
      locationLabel: trail?.region ?? 'Trail memory',
    };
  });
}

function buildPhotoItems(photos: TrailPhoto[], recordings: TrailRecording[], trails: Trail[]): GalleryItem[] {
  if (photos.length === 0) {
    return buildRecordingMemories(recordings, trails);
  }

  return photos.map((photo) => {
    const trail = trails.find((entry) => entry.id === photo.trailId)
      ?? trails.find((entry) => entry.id === recordings.find((recording) => recording.id === photo.recordingId)?.trailId);

    return {
      id: photo.id,
      trailId: trail?.id ?? photo.trailId,
      trailName: trail?.name ?? 'Trail capture',
      takenAt: photo.takenAt,
      lat: photo.lat,
      lng: photo.lng,
      uri: photo.uri,
      caption: photo.caption,
      source: 'photo' as const,
      palette: paletteFor(photo.id),
      locationLabel: trail?.region ?? 'Saved from trail',
    };
  });
}

function groupByDate(items: GalleryItem[]) {
  const groups = new Map<string, GalleryItem[]>();
  items.forEach((item) => {
    const label = new Date(item.takenAt).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const existing = groups.get(label) ?? [];
    existing.push(item);
    groups.set(label, existing);
  });
  return Array.from(groups.entries());
}

function clusterItems(items: GalleryItem[]): GalleryCluster[] {
  if (items.length === 0) {
    return [];
  }

  const latitudes = items.map((item) => item.lat);
  const longitudes = items.map((item) => item.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = Math.max(maxLat - minLat, 0.02);
  const lngSpan = Math.max(maxLng - minLng, 0.02);
  const cellLat = latSpan / 3;
  const cellLng = lngSpan / 3;

  const buckets = new Map<string, GalleryItem[]>();
  items.forEach((item) => {
    const row = Math.floor((item.lat - minLat) / cellLat);
    const column = Math.floor((item.lng - minLng) / cellLng);
    const key = `${row}:${column}`;
    const existing = buckets.get(key) ?? [];
    existing.push(item);
    buckets.set(key, existing);
  });

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const avgLat = bucket.reduce((sum, item) => sum + item.lat, 0) / bucket.length;
    const avgLng = bucket.reduce((sum, item) => sum + item.lng, 0) / bucket.length;
    const left = 8 + ((avgLng - minLng) / lngSpan) * 84;
    const top = 10 + ((maxLat - avgLat) / latSpan) * 62;

    return {
      id: key,
      left,
      top,
      items: bucket,
    };
  });
}

function relativeMemoryCallout(takenAt: string) {
  const photoDate = new Date(takenAt);
  const now = new Date();
  const sameDay =
    photoDate.getMonth() === now.getMonth()
    && photoDate.getDate() === now.getDate();

  if (sameDay) {
    const years = Math.max(now.getFullYear() - photoDate.getFullYear(), 1);
    return `${years} year${years === 1 ? '' : 's'} ago today`;
  }

  return new Date(takenAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function GalleryArt({
  item,
  large = false,
}: {
  item: GalleryItem;
  large?: boolean;
}) {
  if (item.uri) {
    return (
      <Image
        source={{ uri: item.uri }}
        contentFit="cover"
        style={StyleSheet.absoluteFillObject}
      />
    );
  }

  return (
    <LinearGradient
      colors={[item.palette[0], item.palette[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    >
      <View style={styles.placeholderOverlay}>
        <MaterialSymbol
          name={large ? 'collections' : 'image'}
          size={large ? 36 : 20}
          color="rgba(255,255,255,0.88)"
        />
      </View>
    </LinearGradient>
  );
}

function MapBackdrop() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 220">
      <Rect width="320" height="220" rx="28" fill="#101117" />
      <Path
        d="M18 86 C42 30, 82 130, 120 72 S194 18, 302 52"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M8 164 C58 124, 92 194, 142 150 S222 124, 308 164"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M22 94 C68 62, 114 120, 160 76 S238 34, 292 58"
        stroke="rgba(132,204,22,0.18)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function TrailsPhotosScreen() {
  const db = useDatabase();
  const [mode, setMode] = useState<GalleryMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Record<string, true>>({});
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const photos = useMemo(() => getPhotos(db, { limit: 240 }), [db]);
  const recordings = useMemo(() => getRecordings(db, { limit: 80 }), [db]);
  const trails = useMemo(() => getTrails(db, { limit: 80 }), [db]);
  const items = useMemo(() => buildPhotoItems(photos, recordings, trails), [photos, recordings, trails]);

  const featuredItem = items[0] ?? null;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterMode === 'hasLocation') {
        return Number.isFinite(item.lat) && Number.isFinite(item.lng);
      }
      if (filterMode === 'favorites') {
        return Boolean(favoriteIds[item.id]);
      }
      if (filterMode === 'trail' && selectedTrailId) {
        return item.trailId === selectedTrailId;
      }
      return true;
    });
  }, [favoriteIds, filterMode, items, selectedTrailId]);

  const clusters = useMemo(() => clusterItems(filteredItems), [filteredItems]);
  const activeCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  );

  const timelineGroups = useMemo(() => groupByDate(filteredItems), [filteredItems]);
  const trailCollections = useMemo(() => {
    const map = new Map<string, GalleryItem[]>();
    items.forEach((item) => {
      const key = item.trailId ?? item.trailName;
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    });
    return Array.from(map.entries()).slice(0, 6);
  }, [items]);

  const openLightbox = (targetId: string) => {
    const nextIndex = filteredItems.findIndex((item) => item.id === targetId);
    if (nextIndex === -1) {
      return;
    }

    setLightboxIndex(nextIndex);
    setLightboxVisible(true);
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = { ...current };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <TrailsScreen>
        <TrailsSection eyebrow="Photos" title="Trail Memories">
          <GlassCard style={styles.emptyCard}>
            <MaterialSymbol name="photo_library" size={28} color={TR_ACCENT_LIGHT} />
            <Text variant="body" style={styles.emptyTitle}>
              No trail memories yet
            </Text>
            <Text variant="caption" color={TR_TEXT_SECONDARY} style={styles.emptyCopy}>
              Photos will appear here once you capture them during a recording or attach them to trail memories.
            </Text>
          </GlassCard>
        </TrailsSection>
      </TrailsScreen>
    );
  }

  return (
    <View style={styles.root}>
      <TrailsScreen contentContainerStyle={styles.content}>
        <TrailsHero
          title="Photos"
          subtitle="Switch between grid, map, and timeline modes to revisit your trail memories."
        />

        {featuredItem ? (
          <Pressable onPress={() => openLightbox(featuredItem.id)}>
            <GlassCard style={styles.featuredCard}>
              <View style={styles.featuredImage}>
                <GalleryArt item={featuredItem} large />
                <View style={styles.featuredOverlay}>
                  <Text variant="caption" style={styles.eyebrow}>
                    featured capture
                  </Text>
                  <Text variant="heading" style={styles.featuredTitle}>
                    {featuredItem.caption ?? featuredItem.trailName}
                  </Text>
                  <View style={styles.featuredMeta}>
                    <Text variant="caption" color={TR_TEXT_SECONDARY}>
                      {new Date(featuredItem.takenAt).toLocaleDateString()}
                    </Text>
                    <Text variant="caption" color={TR_TEXT_SECONDARY}>
                      {featuredItem.locationLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        ) : null}

        <TrailsSection eyebrow="View" title="Browse Mode">
          <View style={styles.segmentedControl}>
            {([
              ['grid', 'Grid', 'grid_view'],
              ['map', 'Map', 'place'],
              ['timeline', 'Timeline', 'timeline'],
            ] as const).map(([value, label, icon]) => (
              <Pressable
                key={value}
                onPress={() => setMode(value)}
                style={[
                  styles.segment,
                  mode === value ? styles.segmentActive : null,
                ]}
              >
                <MaterialSymbol
                  name={icon}
                  size={16}
                  color={mode === value ? TR_ACCENT_LIGHT : TR_TEXT_TERTIARY}
                />
                <Text variant="caption" style={mode === value ? styles.segmentTextActive : styles.segmentText}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </TrailsSection>

        <TrailsSection eyebrow="Filter" title="Collections">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            {([
              ['all', 'All'],
              ['hasLocation', 'Has Location'],
              ['favorites', 'Favorites'],
              ['trail', 'By Trail'],
            ] as const).map(([value, label]) => (
              <TrailsChip
                key={value}
                label={label}
                active={filterMode === value}
                onPress={() => setFilterMode(value)}
              />
            ))}
          </ScrollView>

          {filterMode === 'trail' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
              {trailCollections.map(([key, collection]) => {
                const label = collection[0]?.trailName ?? key;
                return (
                  <TrailsChip
                    key={key}
                    label={label}
                    active={selectedTrailId === collection[0]?.trailId}
                    onPress={() => setSelectedTrailId(collection[0]?.trailId ?? null)}
                  />
                );
              })}
            </ScrollView>
          ) : null}
        </TrailsSection>

        {mode === 'grid' ? (
          <TrailsSection eyebrow="Grid" title="Recent Memories">
            <View style={styles.grid}>
              {filteredItems.map((item) => (
                <Pressable key={item.id} onPress={() => openLightbox(item.id)} style={styles.gridTile}>
                  <GlassCard style={styles.gridCard}>
                    <View style={styles.gridImage}>
                      <GalleryArt item={item} />
                    </View>
                    <Text variant="caption" style={styles.gridLabel} numberOfLines={1}>
                      {item.trailName}
                    </Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          </TrailsSection>
        ) : null}

        {mode === 'map' ? (
          <TrailsSection eyebrow="Map" title="Photo Locations">
            <GlassCard style={styles.mapCard}>
              <View style={styles.mapSurface}>
                <MapBackdrop />
                {clusters.map((cluster) => {
                  const active = activeCluster?.id === cluster.id;
                  return (
                    <Pressable
                      key={cluster.id}
                      onPress={() => setSelectedClusterId(cluster.id)}
                      style={[
                        styles.clusterPin,
                        {
                          left: `${cluster.left}%`,
                          top: `${cluster.top}%`,
                          backgroundColor: cluster.items.length > 1 ? 'rgba(132,204,22,0.16)' : 'rgba(255,184,119,0.16)',
                          borderColor: cluster.items.length > 1 ? TR_ACCENT_LIGHT : '#FFB877',
                          width: cluster.items.length > 1 ? 44 : 38,
                          height: cluster.items.length > 1 ? 44 : 38,
                        },
                        active ? styles.clusterPinActive : null,
                      ]}
                    >
                      {cluster.items.length > 1 ? (
                        <Text variant="caption" style={styles.clusterCount}>
                          {cluster.items.length}
                        </Text>
                      ) : (
                        <MaterialSymbol name="photo_camera" size={18} color="#FFB877" />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {activeCluster ? (
                <Pressable onPress={() => openLightbox(activeCluster.items[0].id)}>
                  <GlassCard style={styles.clusterPreview}>
                    <View style={styles.clusterPreviewImage}>
                      <GalleryArt item={activeCluster.items[0]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" style={styles.clusterTitle}>
                        {activeCluster.items[0].trailName}
                      </Text>
                      <Text variant="caption" color={TR_TEXT_SECONDARY}>
                        {activeCluster.items.length > 1
                          ? `${activeCluster.items.length} memories in this area`
                          : activeCluster.items[0].locationLabel}
                      </Text>
                    </View>
                  </GlassCard>
                </Pressable>
              ) : null}
            </GlassCard>
          </TrailsSection>
        ) : null}

        {mode === 'timeline' ? (
          <TrailsSection eyebrow="Timeline" title="Day-by-Day Memories">
            <View style={styles.timeline}>
              {timelineGroups.map(([dateLabel, dateItems]) => (
                <GlassCard key={dateLabel} style={styles.timelineCard}>
                  <Text variant="body" style={styles.timelineDate}>
                    {dateLabel}
                  </Text>
                  <View style={styles.timelineItems}>
                    {dateItems.map((item) => (
                      <Pressable key={item.id} onPress={() => openLightbox(item.id)} style={styles.timelineRow}>
                        <View style={styles.timelineThumb}>
                          <GalleryArt item={item} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text variant="body" style={styles.timelineTitle}>
                            {item.caption ?? item.trailName}
                          </Text>
                          <Text variant="caption" color={TR_TEXT_SECONDARY}>
                            {item.trailName} · {new Date(item.takenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </Text>
                        </View>
                        <Text variant="caption" color={TR_ACCENT_LIGHT}>
                          {relativeMemoryCallout(item.takenAt)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </GlassCard>
              ))}
            </View>
          </TrailsSection>
        ) : null}

        <TrailsSection eyebrow="Collections" title="Trail Memories Gallery">
          <View style={styles.collections}>
            {trailCollections.map(([key, collection]) => {
              const cover = collection[0];
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setFilterMode('trail');
                    setSelectedTrailId(cover?.trailId ?? null);
                    setMode('grid');
                  }}
                >
                  <GlassCard style={styles.collectionCard}>
                    <View style={styles.collectionImage}>
                      {cover ? <GalleryArt item={cover} /> : null}
                    </View>
                    <View style={styles.collectionBody}>
                      <Text variant="body" style={styles.collectionTitle}>
                        {cover?.trailName ?? key}
                      </Text>
                      <Text variant="caption" color={TR_TEXT_SECONDARY}>
                        {collection.length} photo{collection.length === 1 ? '' : 's'} · {relativeMemoryCallout(cover?.takenAt ?? new Date().toISOString())}
                      </Text>
                    </View>
                  </GlassCard>
                </Pressable>
              );
            })}
          </View>
        </TrailsSection>
      </TrailsScreen>

      <Pressable style={styles.cameraFab}>
        <MaterialSymbol name="photo_camera" size={22} color="#091303" />
      </Pressable>

      <Modal
        visible={lightboxVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View style={styles.lightboxBackdrop}>
          <View style={styles.lightboxHeader}>
            <Pressable onPress={() => setLightboxVisible(false)} style={styles.lightboxAction}>
              <MaterialSymbol name="close" size={18} color={TR_TEXT} />
            </Pressable>
            <Text variant="caption" color={TR_TEXT_SECONDARY}>
              {lightboxIndex + 1} / {filteredItems.length}
            </Text>
          </View>

          <FlatList
            data={filteredItems}
            horizontal
            pagingEnabled
            initialScrollIndex={lightboxIndex}
            getItemLayout={(_, index) => ({
              length: LIGHTBOX_WIDTH,
              offset: LIGHTBOX_WIDTH * index,
              index,
            })}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / LIGHTBOX_WIDTH);
              setLightboxIndex(nextIndex);
            }}
            renderItem={({ item }) => (
              <View style={styles.lightboxPage}>
                <View style={styles.lightboxImageWrap}>
                  <GalleryArt item={item} large />
                </View>
              </View>
            )}
          />

          {filteredItems[lightboxIndex] ? (
            <GlassCard style={styles.lightboxInfo}>
              <View style={styles.lightboxInfoHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={styles.lightboxTitle}>
                    {filteredItems[lightboxIndex].caption ?? filteredItems[lightboxIndex].trailName}
                  </Text>
                  <Text variant="caption" color={TR_TEXT_SECONDARY}>
                    {filteredItems[lightboxIndex].trailName} · {filteredItems[lightboxIndex].locationLabel}
                  </Text>
                </View>
                <Pressable
                  onPress={() => toggleFavorite(filteredItems[lightboxIndex].id)}
                  style={styles.lightboxAction}
                >
                  <MaterialSymbol
                    name="favorite"
                    size={18}
                    color={favoriteIds[filteredItems[lightboxIndex].id] ? '#FFB877' : TR_TEXT_SECONDARY}
                    filled={Boolean(favoriteIds[filteredItems[lightboxIndex].id])}
                  />
                </Pressable>
              </View>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>
                {new Date(filteredItems[lightboxIndex].takenAt).toLocaleString()}
              </Text>
            </GlassCard>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: TR_SURFACES.base,
  },
  content: {
    gap: spacing.md,
  },
  eyebrow: {
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    backgroundColor: TR_SURFACES.low,
  },
  emptyTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  emptyCopy: {
    textAlign: 'center',
  },
  featuredCard: {
    padding: 0,
    overflow: 'hidden',
  },
  featuredImage: {
    height: 280,
    borderRadius: 26,
    overflow: 'hidden',
  },
  featuredOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  featuredTitle: {
    color: '#FFFFFF',
    fontFamily: TR_FONTS.extraBold,
  },
  featuredMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  segmentActive: {
    backgroundColor: `${TR_ACCENT}33`,
  },
  segmentText: {
    color: TR_TEXT_TERTIARY,
  },
  segmentTextActive: {
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.bold,
  },
  filterRail: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridTile: {
    width: '31%',
  },
  gridCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: TR_SURFACES.low,
  },
  gridImage: {
    height: 112,
    borderRadius: 18,
    overflow: 'hidden',
  },
  gridLabel: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
    color: TR_TEXT_SECONDARY,
  },
  mapCard: {
    gap: spacing.md,
    backgroundColor: TR_SURFACES.low,
  },
  mapSurface: {
    height: 260,
    borderRadius: 26,
    overflow: 'hidden',
  },
  clusterPin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 999,
    borderWidth: 2,
  },
  clusterPinActive: {
    transform: [{ scale: 1.08 }],
  },
  clusterCount: {
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.bold,
  },
  clusterPreview: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  clusterPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: 'hidden',
  },
  clusterTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineCard: {
    gap: spacing.md,
    backgroundColor: TR_SURFACES.low,
  },
  timelineDate: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  timelineItems: {
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  timelineThumb: {
    width: 62,
    height: 62,
    borderRadius: 18,
    overflow: 'hidden',
  },
  timelineTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.semiBold,
  },
  collections: {
    gap: spacing.sm,
  },
  collectionCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: TR_SURFACES.low,
  },
  collectionImage: {
    width: 92,
    height: 92,
    borderRadius: 22,
    overflow: 'hidden',
  },
  collectionBody: {
    flex: 1,
    gap: 4,
  },
  collectionTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  placeholderOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFab: {
    position: 'absolute',
    right: 20,
    bottom: 112,
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TR_ACCENT_LIGHT,
  },
  lightboxBackdrop: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  lightboxHeader: {
    paddingTop: 58,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lightboxAction: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lightboxPage: {
    width: LIGHTBOX_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  lightboxImageWrap: {
    width: LIGHTBOX_WIDTH - spacing.md * 2,
    height: LIGHTBOX_WIDTH - spacing.md * 2,
    borderRadius: 28,
    overflow: 'hidden',
  },
  lightboxInfo: {
    margin: spacing.md,
    backgroundColor: 'rgba(18,18,24,0.92)',
  },
  lightboxInfoHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  lightboxTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
});
