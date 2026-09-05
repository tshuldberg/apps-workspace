import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, X } from 'lucide-react-native';
import {
  createEntry,
  deleteEntry,
  getEntriesByDate,
  getHarvests,
  getPlants,
  getZones,
  GARDEN_ACCENT,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  MasonryGallery,
  ZoneChip,
  type GardenEntry,
  type HarvestRecord,
  type Plant,
} from '@mylife/garden';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type PhotoSource = 'plant' | 'entry' | 'harvest';
type DateFilter = 'all' | '30d' | '90d' | 'year';
type ViewMode = 'grid' | 'before-after';
type OpenFilter = 'plant' | 'date' | 'zone' | null;

type PhotoItem = {
  id: string;
  source: PhotoSource;
  sourceId: string;
  uri: string;
  title: string;
  subtitle: string;
  date: string;
  plantId: string | null;
  plantName: string | null;
  zone: string | null;
  note: string | null;
};

function withinDateRange(date: string, filter: DateFilter) {
  if (filter === 'all') return true;
  const current = new Date();
  const value = new Date(`${date}T00:00:00`);
  const days =
    filter === '30d'
      ? 30
      : filter === '90d'
        ? 90
        : 365;
  const threshold = new Date(current);
  threshold.setDate(threshold.getDate() - days);
  return value >= threshold;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function GardenPhotosScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const [plantFilter, setPlantFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

  const plants = useMemo<Plant[]>(() => getPlants(db), [db, tick]);
  const entries = useMemo<GardenEntry[]>(
    () => getEntriesByDate(db, '1900-01-01', '2999-12-31'),
    [db, tick],
  );
  const harvests = useMemo<HarvestRecord[]>(() => getHarvests(db), [db, tick]);
  const zones = useMemo(() => getZones(db), [db, tick]);

  const plantById = useMemo(() => {
    const map = new Map<string, Plant>();
    for (const plant of plants) map.set(plant.id, plant);
    return map;
  }, [plants]);

  const photos = useMemo<PhotoItem[]>(() => {
    const list: PhotoItem[] = [];

    for (const plant of plants) {
      if (plant.imageUri == null) continue;
      list.push({
        id: `plant-${plant.id}`,
        source: 'plant',
        sourceId: plant.id,
        uri: plant.imageUri,
        title: plant.name,
        subtitle: plant.species ?? 'Plant portrait',
        date: plant.acquiredDate ?? plant.createdAt.slice(0, 10),
        plantId: plant.id,
        plantName: plant.name,
        zone: plant.zone,
        note: plant.notes,
      });
    }

    for (const entry of entries) {
      if (entry.imageUri == null) continue;
      const plant = entry.plantId != null ? plantById.get(entry.plantId) ?? null : null;
      list.push({
        id: `entry-${entry.id}`,
        source: 'entry',
        sourceId: entry.id,
        uri: entry.imageUri,
        title: plant?.name ?? 'Garden capture',
        subtitle: entry.action.replace(/_/g, ' ').toUpperCase(),
        date: entry.date,
        plantId: entry.plantId,
        plantName: plant?.name ?? null,
        zone: plant?.zone ?? null,
        note: entry.notes,
      });
    }

    for (const harvest of harvests) {
      if (harvest.imageUri == null) continue;
      const plant = plantById.get(harvest.plantId) ?? null;
      list.push({
        id: `harvest-${harvest.id}`,
        source: 'harvest',
        sourceId: harvest.id,
        uri: harvest.imageUri,
        title: harvest.cropType ?? plant?.name ?? 'Harvest',
        subtitle: `${harvest.quantity} ${harvest.unit}`,
        date: harvest.date,
        plantId: harvest.plantId,
        plantName: plant?.name ?? null,
        zone: plant?.zone ?? null,
        note: harvest.notes,
      });
    }

    return list.sort((left, right) => right.date.localeCompare(left.date));
  }, [entries, harvests, plantById, plants]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (plantFilter !== 'all' && photo.plantId !== plantFilter) return false;
      if (zoneFilter !== 'all' && photo.zone !== zoneFilter) return false;
      if (!withinDateRange(photo.date, dateFilter)) return false;
      return true;
    });
  }, [dateFilter, photos, plantFilter, zoneFilter]);

  const beforeAfterPairs = useMemo(() => {
    const groups = new Map<string, PhotoItem[]>();
    for (const photo of filteredPhotos) {
      if (photo.plantId == null) continue;
      if (!groups.has(photo.plantId)) groups.set(photo.plantId, []);
      groups.get(photo.plantId)!.push(photo);
    }

    return Array.from(groups.values())
      .filter((items) => items.length >= 2)
      .map((items) => {
        const sorted = [...items].sort((left, right) => left.date.localeCompare(right.date));
        return {
          before: sorted[0],
          after: sorted[sorted.length - 1],
        };
      });
  }, [filteredPhotos]);

  const featuredPhoto = filteredPhotos[0] ?? null;

  const galleryItems = filteredPhotos.slice(1).map((photo, index) => ({
    uri: photo.uri,
    title: photo.title,
    date: photo.date,
    featured: index === 1,
    onPress: () => setSelectedPhoto(photo),
  }));

  const handleCapturePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to add captures to your archive.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });

    if (result.canceled || result.assets[0] == null) return;
    const asset = result.assets[0];
    createEntry(db, makeId('photo'), {
      plantId: plantFilter !== 'all' ? plantFilter : null,
      action: 'photo',
      imageUri: asset.uri,
      notes: 'Captured from Garden Photos',
    });
    setTick((value) => value + 1);
  };

  const handleDeletePhoto = (photo: PhotoItem) => {
    Alert.alert('Delete Photo', 'Remove this photo from the archive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (photo.source === 'plant') {
            db.execute('UPDATE gd_plants SET image_uri = NULL WHERE id = ?', [photo.sourceId]);
          } else if (photo.source === 'harvest') {
            db.execute('UPDATE gd_harvests SET image_uri = NULL WHERE id = ?', [photo.sourceId]);
          } else {
            const row = db.query<Record<string, unknown>>('SELECT action FROM gd_entries WHERE id = ?', [photo.sourceId])[0];
            if ((row?.action as string | undefined) === 'photo') {
              deleteEntry(db, photo.sourceId);
            } else {
              db.execute('UPDATE gd_entries SET image_uri = NULL WHERE id = ?', [photo.sourceId]);
            }
          }
          setSelectedPhoto(null);
          setTick((value) => value + 1);
        },
      },
    ]);
  };

  const handleSharePhoto = async (photo: PhotoItem) => {
    await Share.share({
      title: photo.title,
      url: photo.uri,
      message: `${photo.title} · ${photo.date}`,
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <RNText style={styles.headerTitle}>Garden Photos</RNText>
            <RNText style={styles.headerMeta}>{filteredPhotos.length} captures</RNText>
          </View>
          <Pressable style={styles.cameraButton} onPress={handleCapturePhoto}>
            <Camera size={18} color={GARDEN_GOLD} strokeWidth={1.8} />
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <FilterButton
            label={plantFilter === 'all' ? 'Plant Type' : plants.find((plant) => plant.id === plantFilter)?.name ?? 'Plant'}
            active={openFilter === 'plant'}
            onPress={() => setOpenFilter((current) => (current === 'plant' ? null : 'plant'))}
          />
          <FilterButton
            label={
              dateFilter === 'all'
                ? 'Date Range'
                : dateFilter === '30d'
                  ? 'Last 30d'
                  : dateFilter === '90d'
                    ? 'Last 90d'
                    : 'Last Year'
            }
            active={openFilter === 'date'}
            onPress={() => setOpenFilter((current) => (current === 'date' ? null : 'date'))}
          />
          <FilterButton
            label={zoneFilter === 'all' ? 'Growth Zone' : zoneFilter}
            active={openFilter === 'zone'}
            onPress={() => setOpenFilter((current) => (current === 'zone' ? null : 'zone'))}
          />
        </View>

        <View style={styles.viewToggleRow}>
          <ToggleChip
            label="Grid View"
            active={viewMode === 'grid'}
            onPress={() => setViewMode('grid')}
          />
          <ToggleChip
            label="Before/After"
            active={viewMode === 'before-after'}
            onPress={() => setViewMode('before-after')}
          />
        </View>

        {openFilter === 'plant' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
            <ZoneChip label="All Plants" active={plantFilter === 'all'} onPress={() => setPlantFilter('all')} />
            {plants.map((plant) => (
              <ZoneChip
                key={plant.id}
                label={plant.name}
                active={plantFilter === plant.id}
                onPress={() => setPlantFilter(plant.id)}
              />
            ))}
          </ScrollView>
        )}

        {openFilter === 'zone' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
            <ZoneChip label="All Zones" active={zoneFilter === 'all'} onPress={() => setZoneFilter('all')} />
            {zones.map((zone) => (
              <ZoneChip
                key={zone.id}
                label={zone.name}
                active={zoneFilter === zone.name}
                onPress={() => setZoneFilter(zone.name)}
              />
            ))}
          </ScrollView>
        )}

        {openFilter === 'date' && (
          <View style={styles.filterChipRow}>
            <ZoneChip label="All Time" active={dateFilter === 'all'} onPress={() => setDateFilter('all')} />
            <ZoneChip label="30 Days" active={dateFilter === '30d'} onPress={() => setDateFilter('30d')} />
            <ZoneChip label="90 Days" active={dateFilter === '90d'} onPress={() => setDateFilter('90d')} />
            <ZoneChip label="Year" active={dateFilter === 'year'} onPress={() => setDateFilter('year')} />
          </View>
        )}

        {featuredPhoto != null && (
          <Pressable onPress={() => setSelectedPhoto(featuredPhoto)}>
            <GlassCard level={2} style={styles.heroCard}>
              <Image source={{ uri: featuredPhoto.uri }} style={styles.heroImage} />
              <View style={styles.heroOverlay}>
                <View style={styles.heroBadge}>
                  <RNText style={styles.heroBadgeText}>Featured</RNText>
                </View>
                <RNText style={styles.heroTitle}>{featuredPhoto.title}</RNText>
                <RNText style={styles.heroSubtitle}>
                  {featuredPhoto.subtitle} · {featuredPhoto.date}
                </RNText>
              </View>
            </GlassCard>
          </Pressable>
        )}

        {viewMode === 'grid' ? (
          filteredPhotos.length > 0 ? (
            <MasonryGallery items={galleryItems} columns={2} gap={12} />
          ) : (
            <GlassCard level={1} style={styles.emptyCard}>
              <Images size={20} color={GARDEN_GOLD} strokeWidth={1.8} />
              <RNText style={styles.emptyTitle}>No photos match these filters</RNText>
              <RNText style={styles.emptyBody}>Import a new capture or loosen the archive filters.</RNText>
            </GlassCard>
          )
        ) : beforeAfterPairs.length > 0 ? (
          <View style={styles.beforeAfterStack}>
            {beforeAfterPairs.map((pair) => (
              <GlassCard key={`${pair.before.id}-${pair.after.id}`} level={1} style={styles.beforeAfterCard}>
                <RNText style={styles.beforeAfterTitle}>
                  {pair.after.plantName ?? pair.after.title}
                </RNText>
                <View style={styles.beforeAfterImages}>
                  <View style={styles.beforeAfterPane}>
                    <Image source={{ uri: pair.before.uri }} style={styles.beforeAfterImage} />
                    <RNText style={styles.beforeAfterLabel}>{pair.before.date}</RNText>
                  </View>
                  <View style={styles.beforeAfterDivider} />
                  <View style={styles.beforeAfterPane}>
                    <Image source={{ uri: pair.after.uri }} style={styles.beforeAfterImage} />
                    <RNText style={styles.beforeAfterLabel}>{pair.after.date}</RNText>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        ) : (
          <GlassCard level={1} style={styles.emptyCard}>
            <RNText style={styles.emptyTitle}>Before/after needs repeat captures</RNText>
            <RNText style={styles.emptyBody}>Capture the same plant twice to unlock growth comparisons.</RNText>
          </GlassCard>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={handleCapturePhoto}>
        <Camera size={20} color={colors.background} strokeWidth={2} />
      </Pressable>

      <Modal visible={selectedPhoto != null} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle}>{selectedPhoto?.title}</RNText>
              <Pressable onPress={() => setSelectedPhoto(null)}>
                <X size={18} color={colors.textSecondary} strokeWidth={1.8} />
              </Pressable>
            </View>
            {selectedPhoto != null && (
              <>
                <Image source={{ uri: selectedPhoto.uri }} style={styles.modalImage} />
                <View style={styles.modalMeta}>
                  <RNText style={styles.modalMetaText}>{selectedPhoto.date}</RNText>
                  {selectedPhoto.plantName != null && (
                    <RNText style={styles.modalMetaText}>{selectedPhoto.plantName}</RNText>
                  )}
                  {selectedPhoto.zone != null && (
                    <RNText style={styles.modalMetaText}>{selectedPhoto.zone}</RNText>
                  )}
                </View>
                {selectedPhoto.note != null && (
                  <RNText style={styles.modalNote}>{selectedPhoto.note}</RNText>
                )}
                <View style={styles.modalActions}>
                  <ActionButton label="Export" onPress={() => handleSharePhoto(selectedPhoto)} />
                  <ActionButton label="Delete" destructive onPress={() => handleDeletePhoto(selectedPhoto)} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterButton, active && styles.filterButtonActive]}>
      <RNText style={styles.filterButtonText}>{label}</RNText>
    </Pressable>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.toggleChip, active && styles.toggleChipActive]}>
      <RNText style={[styles.toggleChipText, active && styles.toggleChipTextActive]}>{label}</RNText>
    </Pressable>
  );
}

function ActionButton({
  label,
  destructive = false,
  onPress,
}: {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionButton, destructive && styles.actionButtonDanger]}
    >
      <RNText style={[styles.actionButtonText, destructive && styles.actionButtonTextDanger]}>
        {label}
      </RNText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 104,
    paddingHorizontal: 16,
    paddingBottom: 160,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerMeta: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_GOLD,
  },
  cameraButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: GARDEN_SURFACES.depth,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(132, 204, 22, 0.18)',
  },
  filterButtonText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  viewToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  toggleChipActive: {
    backgroundColor: GARDEN_GOLD,
  },
  toggleChipText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  toggleChipTextActive: {
    color: colors.background,
  },
  filterChipRow: {
    gap: 8,
    paddingRight: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heroCard: {
    overflow: 'hidden',
    padding: 0,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1.4,
  },
  heroOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    gap: 6,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 184, 119, 0.88)',
  },
  heroBadgeText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.background,
  },
  heroTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: colors.text,
  },
  heroSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.text,
  },
  beforeAfterStack: {
    gap: 12,
  },
  beforeAfterCard: {
    padding: 16,
    gap: 12,
  },
  beforeAfterTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: colors.text,
  },
  beforeAfterImages: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  beforeAfterPane: {
    flex: 1,
    gap: 8,
  },
  beforeAfterImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
  },
  beforeAfterDivider: {
    width: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  beforeAfterLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  emptyCard: {
    padding: 20,
    gap: 8,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptyBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 34,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_GOLD,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.78)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 28,
    padding: 18,
    gap: 14,
    backgroundColor: GARDEN_SURFACES.base,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: colors.text,
    flex: 1,
  },
  modalImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
  },
  modalMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalMetaText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_GOLD,
  },
  modalNote: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(255, 180, 171, 0.12)',
  },
  actionButtonText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  actionButtonTextDanger: {
    color: GARDEN_DANGER,
  },
});
