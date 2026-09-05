import { useEffect, useMemo, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  GlassCard,
  MaterialSymbol,
  REGION_CATALOG,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  createOfflineRegion,
  deleteOfflineRegion,
  estimateRegionSizeBytes,
  formatBytes,
  getCatalogEntry,
  getOfflineRegions,
  markRegionReady,
  resetRegionToPending,
  summarizeStorageUsage,
  updateRegionProgress,
  type OfflineRegion,
} from '@mylife/trails';
import { Text, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { TrailsHero, TrailsPrimaryButton, TrailsScreen, TrailsSection } from './_ui';

const STORAGE_CAPACITY_BYTES = 18 * 1024 * 1024 * 1024;

function statusTone(status: OfflineRegion['status']) {
  switch (status) {
    case 'ready':
      return '#30D158';
    case 'downloading':
      return TR_ACCENT_LIGHT;
    case 'error':
      return '#FFB4AB';
    case 'stale':
      return '#FFB877';
    default:
      return TR_TEXT_TERTIARY;
  }
}

function statusLabel(status: OfflineRegion['status']) {
  switch (status) {
    case 'ready':
      return 'Downloaded';
    case 'downloading':
      return 'Downloading';
    case 'error':
      return 'Failed';
    case 'stale':
      return 'Needs Refresh';
    default:
      return 'Queued';
  }
}

function RegionArtwork({ accent = TR_ACCENT_LIGHT }: { accent?: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 112">
      <Rect x="0" y="0" width="160" height="112" rx="20" fill="rgba(10,10,15,0.92)" />
      <Path
        d="M12 78 C42 32, 60 108, 88 58 S126 24, 150 42"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M10 90 C34 62, 62 102, 94 72 S134 40, 152 54"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
      />
      <Rect x="32" y="28" width="92" height="52" rx="18" fill="rgba(101,163,13,0.1)" stroke={accent} strokeWidth="2" />
      <Path
        d="M32 54 H124"
        stroke={accent}
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeDasharray="6 6"
      />
      <Path
        d="M78 28 V80"
        stroke={accent}
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeDasharray="6 6"
      />
    </Svg>
  );
}

function RegionPreviewCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <GlassCard style={styles.previewCard}>
      <View style={styles.previewArtwork}>
        <RegionArtwork />
      </View>
      <View style={styles.previewCopy}>
        <Text variant="body" style={styles.previewTitle}>
          {title}
        </Text>
        <Text variant="caption" color={TR_TEXT_SECONDARY}>
          {subtitle}
        </Text>
      </View>
      {children}
    </GlassCard>
  );
}

export default function OfflineRegionsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [selectedRegionKey, setSelectedRegionKey] = useState(REGION_CATALOG[0]?.regionKey ?? '');
  const [customName, setCustomName] = useState('');
  const [zoomPreset, setZoomPreset] = useState<'regional' | 'detail' | 'wide'>('detail');
  const [autoDeleteOld, setAutoDeleteOld] = useState(true);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);

  const regions = useMemo(() => getOfflineRegions(db), [db, tick]);
  const storage = useMemo(
    () => summarizeStorageUsage(regions, STORAGE_CAPACITY_BYTES),
    [regions],
  );

  const availableEntries = useMemo(
    () => REGION_CATALOG.filter((entry) => !regions.some((region) => region.regionKey === entry.regionKey)),
    [regions],
  );

  const activeEntry = useMemo(
    () => availableEntries.find((entry) => entry.regionKey === selectedRegionKey) ?? availableEntries[0] ?? null,
    [availableEntries, selectedRegionKey],
  );

  const previewRegion = useMemo(
    () => regions.find((region) => region.id === selectedPreviewId) ?? null,
    [regions, selectedPreviewId],
  );

  useEffect(() => {
    const activeDownloads = regions.filter(
      (region) => region.status === 'pending' || region.status === 'downloading',
    );

    if (activeDownloads.length === 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      activeDownloads.forEach((region) => {
        const catalogEntry = getCatalogEntry(region.regionKey);
        const totalTiles = catalogEntry?.estimatedTiles ?? Math.max(region.tileCount, 15000);
        const nextProgress = Math.min(
          region.status === 'pending' ? 0.16 : region.progress + 0.18,
          1,
        );

        if (nextProgress >= 0.98) {
          markRegionReady(
            db,
            region.id,
            estimateRegionSizeBytes(totalTiles),
            totalTiles,
          );
          return;
        }

        updateRegionProgress(
          db,
          region.id,
          nextProgress,
          Math.round(totalTiles * nextProgress),
        );
      });

      setTick((value) => value + 1);
    }, 850);

    return () => clearTimeout(timer);
  }, [db, regions]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleDelete = (region: OfflineRegion) => {
    Alert.alert(
      'Delete region',
      `Remove ${region.name} and its cached tiles from this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteOfflineRegion(db, region.id);
            if (selectedPreviewId === region.id) {
              setSelectedPreviewId(null);
            }
            setTick((value) => value + 1);
          },
        },
      ],
    );
  };

  const handleRefreshRegion = (region: OfflineRegion) => {
    resetRegionToPending(db, region.id);
    setTick((value) => value + 1);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear offline cache',
      'Delete every offline region from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            regions.forEach((region) => deleteOfflineRegion(db, region.id));
            setSelectedPreviewId(null);
            setTick((value) => value + 1);
          },
        },
      ],
    );
  };

  const handleStartDownload = () => {
    if (!activeEntry) {
      return;
    }

    const name = customName.trim() || activeEntry.name;
    const zoomRange = zoomPreset === 'wide'
      ? { minZoom: 2, maxZoom: 9 }
      : zoomPreset === 'regional'
        ? { minZoom: 6, maxZoom: 12 }
        : { minZoom: 9, maxZoom: 15 };

    try {
      createOfflineRegion(db, uuid(), {
        name,
        regionKey: activeEntry.regionKey,
        minLat: activeEntry.minLat,
        maxLat: activeEntry.maxLat,
        minLng: activeEntry.minLng,
        maxLng: activeEntry.maxLng,
        minZoom: zoomRange.minZoom,
        maxZoom: zoomRange.maxZoom,
      });

      setComposerVisible(false);
      setCustomName('');
      setTick((value) => value + 1);
    } catch (error) {
      Alert.alert(
        'Could not queue download',
        error instanceof Error ? error.message : 'Try a different region name.',
      );
    }
  };

  return (
    <View style={styles.root}>
      <TrailsScreen
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={TR_ACCENT_LIGHT}
          />
        )}
      >
        <TrailsHero
          title="Offline Maps"
          subtitle="Manage downloaded trail regions, monitor storage, and queue the next pack before you lose signal."
        />

        <GlassCard elevated style={styles.storageHero}>
          <View style={styles.storageHeader}>
            <View>
              <Text variant="caption" style={styles.eyebrow}>Device Storage</Text>
              <Text variant="heading" style={styles.storageValue}>
                {formatBytes(storage.usedBytes)}
              </Text>
              <Text variant="caption" color={TR_TEXT_SECONDARY}>
                used across {storage.downloadedCount} downloaded region{storage.downloadedCount === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.storageBadge}>
              <MaterialSymbol name="storage" size={18} color={TR_ACCENT_LIGHT} />
              <Text variant="caption" color={TR_TEXT_SECONDARY}>
                {formatBytes(storage.freeBytes)} free
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(storage.usageRatio * 100, 6)}%` },
              ]}
            />
          </View>

          <View style={styles.storageMetrics}>
            <View style={styles.storageMetric}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Active</Text>
              <Text variant="body" style={styles.metricValue}>
                {storage.activeCount}
              </Text>
            </View>
            <View style={styles.storageMetric}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Capacity</Text>
              <Text variant="body" style={styles.metricValue}>
                {formatBytes(storage.totalBytes)}
              </Text>
            </View>
            <View style={styles.storageMetric}>
              <Text variant="caption" color={TR_TEXT_TERTIARY}>Status</Text>
              <Text variant="body" style={styles.metricValue}>
                {storage.lowStorage ? 'Low' : 'Healthy'}
              </Text>
            </View>
          </View>
        </GlassCard>

        {previewRegion ? (
          <TrailsSection eyebrow="Bounds" title="Selected Region">
            <RegionPreviewCard
              title={previewRegion.name}
              subtitle={`${statusLabel(previewRegion.status)} · Zoom ${previewRegion.minZoom}-${previewRegion.maxZoom}`}
            >
              <View style={styles.previewMeta}>
                <Text variant="caption" color={TR_TEXT_TERTIARY}>
                  {previewRegion.minLat.toFixed(3)} to {previewRegion.maxLat.toFixed(3)}
                </Text>
                <Text variant="caption" color={TR_TEXT_TERTIARY}>
                  {previewRegion.minLng.toFixed(3)} to {previewRegion.maxLng.toFixed(3)}
                </Text>
              </View>
            </RegionPreviewCard>
          </TrailsSection>
        ) : null}

        <TrailsSection eyebrow="Library" title="My Offline Maps">
          {regions.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <MaterialSymbol name="download_for_offline" size={28} color={TR_ACCENT_LIGHT} />
              <Text variant="body" style={styles.emptyTitle}>
                No regions downloaded yet
              </Text>
              <Text variant="caption" color={TR_TEXT_SECONDARY} style={styles.emptyCopy}>
                Queue a trail region now so route previews, saved trails, and navigation stay available without service.
              </Text>
            </GlassCard>
          ) : (
            <View style={styles.regionList}>
              {regions.map((region) => {
                const accent = statusTone(region.status);
                return (
                  <Pressable
                    key={region.id}
                    onPress={() => setSelectedPreviewId(region.id)}
                    style={styles.regionPressable}
                  >
                    <GlassCard style={styles.regionCard}>
                      <View style={styles.regionThumb}>
                        <RegionArtwork accent={accent} />
                      </View>
                      <View style={styles.regionBody}>
                        <View style={styles.regionHeader}>
                          <View style={{ flex: 1 }}>
                            <Text variant="body" style={styles.regionName}>
                              {region.name}
                            </Text>
                            <Text variant="caption" color={TR_TEXT_SECONDARY}>
                              Zoom {region.minZoom}-{region.maxZoom} · {formatBytes(region.sizeBytes || estimateRegionSizeBytes(region.tileCount || 12000))}
                            </Text>
                          </View>
                          <View style={[styles.statusPill, { backgroundColor: `${accent}22` }]}>
                            <Text variant="caption" style={[styles.statusText, { color: accent }]}>
                              {statusLabel(region.status)}
                            </Text>
                          </View>
                        </View>

                        {region.status === 'downloading' || region.status === 'pending' ? (
                          <View style={styles.inlineProgressWrap}>
                            <View style={styles.inlineProgressTrack}>
                              <View
                                style={[
                                  styles.inlineProgressFill,
                                  { width: `${Math.max(region.progress * 100, 8)}%` },
                                ]}
                              />
                            </View>
                            <Text variant="caption" color={TR_TEXT_TERTIARY}>
                              {Math.round(region.progress * 100)}%
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.regionFooter}>
                          <Text variant="caption" color={TR_TEXT_TERTIARY}>
                            {region.tileCount.toLocaleString()} tiles
                          </Text>
                          <View style={styles.regionActions}>
                            <Pressable onPress={() => handleRefreshRegion(region)} style={styles.iconAction}>
                              <MaterialSymbol name="refresh" size={16} color={TR_TEXT_SECONDARY} />
                            </Pressable>
                            <Pressable onPress={() => handleDelete(region)} style={styles.iconAction}>
                              <MaterialSymbol name="delete" size={16} color="#FFB4AB" />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })}
            </View>
          )}
        </TrailsSection>

        <TrailsSection eyebrow="Maintenance" title="Storage Management">
          <GlassCard style={styles.manageCard}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={styles.toggleTitle}>
                  Auto-delete stale regions
                </Text>
                <Text variant="caption" color={TR_TEXT_SECONDARY}>
                  Remove packs older than 30 days after they fall out of rotation.
                </Text>
              </View>
              <Pressable
                onPress={() => setAutoDeleteOld((value) => !value)}
                style={[
                  styles.togglePill,
                  autoDeleteOld ? styles.togglePillOn : null,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    autoDeleteOld ? styles.toggleKnobOn : null,
                  ]}
                />
              </Pressable>
            </View>

            <TrailsPrimaryButton label="Clear Cache" onPress={handleClearCache} />
          </GlassCard>
        </TrailsSection>
      </TrailsScreen>

      <Pressable onPress={() => setComposerVisible(true)} style={styles.fab}>
        <MaterialSymbol name="add" size={24} color="#091303" />
      </Pressable>

      <Modal
        visible={composerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setComposerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setComposerVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text variant="caption" style={styles.eyebrow}>Selector</Text>
                <Text variant="heading" style={styles.modalTitle}>
                  Download New Region
                </Text>
              </View>
              <Pressable onPress={() => setComposerVisible(false)} style={styles.iconAction}>
                <MaterialSymbol name="close" size={18} color={TR_TEXT_SECONDARY} />
              </Pressable>
            </View>

            {activeEntry ? (
              <RegionPreviewCard
                title={activeEntry.name}
                subtitle={`${activeEntry.area} · ~${activeEntry.estimatedSizeMb} MB`}
              />
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRail}>
              {availableEntries.map((entry) => (
                <Pressable
                  key={entry.regionKey}
                  onPress={() => setSelectedRegionKey(entry.regionKey)}
                  style={[
                    styles.regionSelector,
                    entry.regionKey === activeEntry?.regionKey ? styles.regionSelectorActive : null,
                  ]}
                >
                  <Text variant="caption" style={entry.regionKey === activeEntry?.regionKey ? styles.regionSelectorTextActive : styles.regionSelectorText}>
                    {entry.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder={activeEntry?.name ?? 'Region name'}
              placeholderTextColor={TR_TEXT_TERTIARY}
              style={styles.nameInput}
            />

            <View style={styles.zoomRail}>
              {([
                ['wide', 'Wide'],
                ['regional', 'Regional'],
                ['detail', 'Detail'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setZoomPreset(value)}
                  style={[
                    styles.zoomChip,
                    zoomPreset === value ? styles.zoomChipActive : null,
                  ]}
                >
                  <Text variant="caption" style={zoomPreset === value ? styles.zoomChipTextActive : styles.zoomChipText}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <GlassCard style={styles.downloadSummary}>
              <View style={styles.downloadSummaryRow}>
                <Text variant="caption" color={TR_TEXT_TERTIARY}>Tiles</Text>
                <Text variant="body" style={styles.metricValue}>
                  {activeEntry?.estimatedTiles.toLocaleString() ?? '--'}
                </Text>
              </View>
              <View style={styles.downloadSummaryRow}>
                <Text variant="caption" color={TR_TEXT_TERTIARY}>Estimated Size</Text>
                <Text variant="body" style={styles.metricValue}>
                  ~{activeEntry?.estimatedSizeMb ?? '--'} MB
                </Text>
              </View>
            </GlassCard>

            <TrailsPrimaryButton label="Start Download" onPress={handleStartDownload} />
          </View>
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
  eyebrow: {
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  storageHero: {
    gap: spacing.md,
    backgroundColor: 'rgba(18, 22, 16, 0.86)',
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  storageValue: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.extraBold,
  },
  storageBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  storageMetrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  storageMetric: {
    flex: 1,
  },
  metricValue: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.semiBold,
  },
  previewCard: {
    gap: spacing.md,
    backgroundColor: TR_SURFACES.low,
  },
  previewArtwork: {
    height: 164,
    borderRadius: 24,
    overflow: 'hidden',
  },
  previewCopy: {
    gap: 4,
  },
  previewTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  previewMeta: {
    gap: 4,
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
  regionList: {
    gap: spacing.sm,
  },
  regionPressable: {
    borderRadius: 24,
  },
  regionCard: {
    gap: spacing.md,
    backgroundColor: TR_SURFACES.low,
  },
  regionThumb: {
    height: 120,
    borderRadius: 22,
    overflow: 'hidden',
  },
  regionBody: {
    gap: spacing.sm,
  },
  regionHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  regionName: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  statusText: {
    fontFamily: TR_FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inlineProgressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inlineProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  regionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regionActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconAction: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  manageCard: {
    gap: spacing.md,
    backgroundColor: TR_SURFACES.low,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.semiBold,
  },
  togglePill: {
    width: 56,
    height: 32,
    padding: 4,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  togglePillOn: {
    backgroundColor: `${TR_ACCENT}88`,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: TR_TEXT_TERTIARY,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
    backgroundColor: '#081403',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 112,
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TR_ACCENT_LIGHT,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: TR_SURFACES.base,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  modalTitle: {
    color: TR_TEXT,
    fontFamily: TR_FONTS.bold,
  },
  selectorRail: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  regionSelector: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  regionSelectorActive: {
    backgroundColor: `${TR_ACCENT}33`,
  },
  regionSelectorText: {
    color: TR_TEXT_SECONDARY,
  },
  regionSelectorTextActive: {
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.bold,
  },
  nameInput: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: TR_TEXT,
    fontFamily: TR_FONTS.medium,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  zoomRail: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  zoomChip: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  zoomChipActive: {
    backgroundColor: `${TR_ACCENT}33`,
  },
  zoomChipText: {
    color: TR_TEXT_SECONDARY,
  },
  zoomChipTextActive: {
    color: TR_ACCENT_LIGHT,
    fontFamily: TR_FONTS.bold,
  },
  downloadSummary: {
    gap: spacing.xs,
    backgroundColor: TR_SURFACES.low,
  },
  downloadSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
