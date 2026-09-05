import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getPlantById,
  getEntriesForPlant,
  getPlants,
  waterPlant,
  calculateNextWaterDate,
  isDaysOverdue,
  adjustFrequencyForSeason,
  getSeason,
  deletePlant,
  getCompanions,
  getAntagonists,
  GARDEN_ACCENT,
  GARDEN_DANGER,
  GARDEN_SURFACES,
  GARDEN_TERTIARY,
  GARDEN_TYPOGRAPHY,
  GARDEN_HEALTH_COLORS,
  GlassCard,
  GradientButton,
  HealthDot,
  SectionHeader,
  WateringTimer,
  ZoneChip,
  GardenTimelineEntry,
  type Plant,
  type GardenEntry,
  type GardenHealthStatus,
} from '@mylife/garden';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const STATUS_TO_HEALTH: Record<string, GardenHealthStatus> = {
  healthy: 'healthy',
  needs_attention: 'needsWater',
  dormant: 'dormant',
  dead: 'dormant',
};

const FILTERS = [
  { key: 'all', label: 'ALL' },
  { key: 'water', label: 'WATERING' },
  { key: 'harvest', label: 'HARVESTS' },
  { key: 'note', label: 'NOTES' },
  { key: 'photo', label: 'PHOTOS' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const ACTION_ICON: Record<string, string> = {
  water: '💧',
  fertilize: '🌱',
  prune: '✂️',
  repot: '🪴',
  harvest: '🌽',
  pest_treatment: '🛡️',
  photo: '📷',
  note: '📝',
};

const ACTION_LABEL: Record<string, string> = {
  water: 'Watered',
  fertilize: 'Fertilized',
  prune: 'Pruned',
  repot: 'Repotted',
  harvest: 'Harvested',
  pest_treatment: 'Pest Treatment',
  photo: 'Photo Added',
  note: 'Note',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function monthsBetween(fromIso: string | null | undefined): string | null {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  const now = new Date();
  const months =
    (now.getFullYear() - from.getFullYear()) * 12 +
    (now.getMonth() - from.getMonth());
  if (months < 1) return 'New';
  if (months < 12) return `${months}mo`;
  const years = months / 12;
  return `${years.toFixed(1)}y`;
}

export default function PlantDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<FilterKey>('all');

  const plant: Plant | null = useMemo(() => {
    if (!id) return null;
    try {
      return getPlantById(db, id);
    } catch {
      return null;
    }
  }, [db, id, tick]);

  const entries: GardenEntry[] = useMemo(() => {
    if (!id) return [];
    try {
      return getEntriesForPlant(db, id, 50);
    } catch {
      return [];
    }
  }, [db, id, tick]);

  const allPlants: Plant[] = useMemo(() => {
    try {
      return getPlants(db);
    } catch {
      return [];
    }
  }, [db, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.action === filter);
  }, [entries, filter]);

  const photoEntries = useMemo(
    () => entries.filter((e) => e.imageUri != null || e.action === 'photo'),
    [entries],
  );

  // Companions (lowercase match on species or name)
  const companionKey = plant
    ? (plant.species ?? plant.name).toLowerCase()
    : '';
  const companionEntries = useMemo(() => {
    if (!companionKey) return [];
    try {
      return getCompanions(companionKey);
    } catch {
      return [];
    }
  }, [companionKey, tick]);
  const antagonistEntries = useMemo(() => {
    if (!companionKey) return [];
    try {
      return getAntagonists(companionKey);
    } catch {
      return [];
    }
  }, [companionKey, tick]);

  // Companions available in user's garden
  const plantId = plant?.id;
  const gardenCompanions = useMemo(() => {
    if (!companionKey) return [];
    const companionNames = new Set(
      companionEntries.flatMap((c) => [c.plantA, c.plantB]),
    );
    companionNames.delete(companionKey);
    return allPlants.filter((p) => {
      const key = (p.species ?? p.name).toLowerCase();
      return companionNames.has(key) && p.id !== plantId;
    });
  }, [companionEntries, allPlants, companionKey, plantId]);

  if (!plant) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="subheading">Plant not found</Text>
      </View>
    );
  }

  const currentSeason = getSeason(new Date().getMonth());
  const freq = plant.waterFrequencyDays ?? 7;
  const today = new Date().toISOString().split('T')[0];
  const nextWaterIso = plant.lastWatered
    ? calculateNextWaterDate(plant.lastWatered, freq)
    : null;
  const overdueDays = isDaysOverdue(plant.lastWatered, freq, today);
  const seasonalFreq = adjustFrequencyForSeason(freq, currentSeason);

  const healthStatus: GardenHealthStatus =
    STATUS_TO_HEALTH[plant.status] ?? 'dormant';
  const healthLabel = plant.status
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
  const healthColor = GARDEN_HEALTH_COLORS[healthStatus];

  // Health score (local, derived): healthy = 95, needs_attention = 60, dormant = 45, dead = 15.
  const healthScore = (() => {
    if (plant.status === 'healthy') {
      return overdueDays > 0 ? 70 : 95;
    }
    if (plant.status === 'needs_attention') return 60;
    if (plant.status === 'dormant') return 45;
    return 15;
  })();

  const nextWaterDate = nextWaterIso ? new Date(nextWaterIso) : null;
  const lastWateredDate = plant.lastWatered ? new Date(plant.lastWatered) : null;

  const handleWater = () => {
    try {
      waterPlant(db, plant.id);
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't save watering.");
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Plant', `Remove ${plant.name} from your garden?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deletePlant(db, plant.id);
            router.back();
          } catch {
            Alert.alert('Error', "Couldn't delete plant.");
          }
        },
      },
    ]);
  };

  const handleArchive = () => {
    Alert.alert('Archive Plant', 'Archive support coming soon.');
  };

  const age = monthsBetween(plant.acquiredDate);
  const ageValue = age ?? '—';

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.hero}>
          {plant.imageUri ? (
            <Image source={{ uri: plant.imageUri }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Text style={{ fontSize: 72 }}>🌿</Text>
            </View>
          )}
          <LinearGradient
            colors={['rgba(19,19,24,0)', 'rgba(19,19,24,0.95)']}
            style={styles.heroGradient}
          />

          {/* top actions */}
          <View style={styles.heroTopBar}>
            <Pressable
              onPress={() => router.back()}
              style={styles.heroBtn}
              hitSlop={8}
            >
              <Text style={styles.heroBtnIcon}>‹</Text>
            </Pressable>
            <View style={styles.heroTopRight}>
              <Pressable
                onPress={() => Alert.alert('Share', 'Share coming soon.')}
                style={styles.heroBtn}
                hitSlop={8}
              >
                <Text style={styles.heroBtnIcon}>↗</Text>
              </Pressable>
              <Pressable
                onPress={() => Alert.alert('Edit', 'Edit coming soon.')}
                style={styles.heroBtn}
                hitSlop={8}
              >
                <Text style={styles.heroBtnIcon}>✎</Text>
              </Pressable>
            </View>
          </View>

          {/* title block */}
          <View style={styles.heroContent}>
            <View style={[styles.healthChip, { backgroundColor: `${healthColor}22` }]}>
              <HealthDot status={healthStatus} size={8} />
              <Text style={[styles.healthChipText, { color: healthColor }]}>
                {healthLabel.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {plant.name}
            </Text>
            {plant.species != null && (
              <Text style={styles.heroSpecies}>{plant.species}</Text>
            )}
            <View style={styles.heroMeta}>
              {plant.zone != null && <ZoneChip label={plant.zone} active />}
              <Text style={styles.heroMetaText}>
                {plant.location.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
        </View>

        {/* HEALTH + WATERING STATS ROW */}
        <View style={styles.statsRow}>
          <GlassCard level={2} style={styles.statHalf}>
            <Text style={styles.statLabel}>HEALTH SCORE</Text>
            <View style={styles.healthRingWrap}>
              <View style={styles.healthRingOuter}>
                <View
                  style={[
                    styles.healthRingFill,
                    {
                      borderColor: healthColor,
                      opacity: healthScore / 100,
                    },
                  ]}
                />
                <Text style={[styles.healthRingValue, { color: healthColor }]}>
                  {healthScore}
                </Text>
              </View>
              <Text style={styles.statSubText}>
                {healthLabel}
              </Text>
            </View>
          </GlassCard>

          <View style={styles.statHalf}>
            {nextWaterDate && lastWateredDate ? (
              <WateringTimer
                nextWaterAt={nextWaterDate}
                lastWateredAt={lastWateredDate}
                intervalDays={freq}
                onWater={handleWater}
              />
            ) : (
              <GlassCard level={2}>
                <Text style={styles.statLabel}>NEXT WATERING</Text>
                <Text style={styles.neverText}>NOT YET</Text>
                <Text style={styles.statSubText}>
                  Mark first watering to start the timer.
                </Text>
                <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
                  <GradientButton title="Water Now" onPress={handleWater} />
                </View>
              </GlassCard>
            )}
          </View>
        </View>

        {/* CARE STATS BENTO */}
        <View style={styles.bentoGrid}>
          <GlassCard level={2} style={styles.bentoCell}>
            <Text style={styles.bentoIcon}>☀️</Text>
            <Text style={styles.bentoLabel}>SUNLIGHT</Text>
            <Text style={styles.bentoValue}>
              {plant.location === 'indoor' ? 'Indirect' : 'Full Sun'}
            </Text>
          </GlassCard>
          <GlassCard level={2} style={styles.bentoCell}>
            <Text style={styles.bentoIcon}>💧</Text>
            <Text style={styles.bentoLabel}>WATERING</Text>
            <Text style={styles.bentoValue}>
              Every {freq}d
            </Text>
            {seasonalFreq !== freq && (
              <Text style={styles.bentoSub}>
                {currentSeason}: {seasonalFreq}d
              </Text>
            )}
          </GlassCard>
          <GlassCard level={2} style={styles.bentoCell}>
            <Text style={styles.bentoIcon}>🪨</Text>
            <Text style={styles.bentoLabel}>SOIL</Text>
            <Text style={styles.bentoValue}>Loamy</Text>
          </GlassCard>
          <GlassCard level={2} style={styles.bentoCell}>
            <Text style={styles.bentoIcon}>🌱</Text>
            <Text style={styles.bentoLabel}>FEED</Text>
            <Text style={styles.bentoValue}>Monthly</Text>
          </GlassCard>
        </View>

        {/* BOTANICAL ARCHIVE */}
        <SectionHeader label="BOTANICAL ARCHIVE" title="Metadata" />
        <GlassCard level={2} style={styles.metaCard}>
          <MetaRow label="SCIENTIFIC" value={plant.species ?? 'Unknown'} italic />
          <MetaRow label="LOCATION" value={plant.location.replace(/_/g, ' ')} />
          <MetaRow label="ZONE" value={plant.zone ?? '—'} />
          <MetaRow
            label="PLANTED"
            value={plant.acquiredDate ? formatDate(plant.acquiredDate) : '—'}
          />
          <MetaRow label="AGE" value={ageValue} />
          <MetaRow
            label="LAST WATERED"
            value={plant.lastWatered ? formatDate(plant.lastWatered) : 'Never'}
          />
          <MetaRow label="STATUS" value={healthLabel} last />
        </GlassCard>

        {/* CHRONICLE (journal timeline) */}
        <SectionHeader
          label="CHRONICLE"
          title="Growth Journal"
          action={{
            text: 'VIEW ALL',
            onPress: () => router.push('/(garden)/journal'),
          }}
        />
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <ZoneChip
                key={f.key}
                label={f.label}
                active={active}
                onPress={() => setFilter(f.key)}
              />
            );
          })}
        </View>
        <GlassCard level={2} style={styles.timelineCard}>
          {filteredEntries.length === 0 ? (
            <Text style={styles.emptyText}>No entries yet.</Text>
          ) : (
            filteredEntries.slice(0, 6).map((entry, idx) => (
              <GardenTimelineEntry
                key={entry.id}
                icon={ACTION_ICON[entry.action] ?? '•'}
                title={ACTION_LABEL[entry.action] ?? entry.action}
                subtitle={entry.notes ?? undefined}
                time={formatDate(entry.date)}
                photoUri={entry.imageUri ?? undefined}
                isLast={idx === Math.min(filteredEntries.length, 6) - 1}
              />
            ))
          )}
        </GlassCard>

        {/* COMPANIONS */}
        <SectionHeader
          label="COMPANIONS"
          title="Compatible Plants"
          action={{
            text: 'MATRIX',
            onPress: () => router.push('/(garden)/companion-matrix'),
          }}
        />
        {antagonistEntries.length > 0 && (
          <GlassCard level={2} style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>
                {antagonistEntries.length} incompatible neighbor
                {antagonistEntries.length === 1 ? '' : 's'}
              </Text>
              <Text style={styles.warningSub}>
                {antagonistEntries
                  .slice(0, 3)
                  .map((a) => (a.plantA === companionKey ? a.plantB : a.plantA))
                  .join(', ')}
              </Text>
            </View>
          </GlassCard>
        )}
        {gardenCompanions.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.companionRow}
          >
            {gardenCompanions.map((c) => (
              <GlassCard
                key={c.id}
                level={2}
                style={styles.companionCard}
                onPress={() => router.push(`/(garden)/plant/${c.id}`)}
              >
                <Text style={styles.companionIcon}>🌿</Text>
                <Text style={styles.companionName} numberOfLines={1}>
                  {c.name}
                </Text>
                {c.species != null && (
                  <Text style={styles.companionSpecies} numberOfLines={1}>
                    {c.species}
                  </Text>
                )}
              </GlassCard>
            ))}
          </ScrollView>
        ) : companionEntries.length > 0 ? (
          <GlassCard level={1} style={styles.hintCard}>
            <Text style={styles.hintText}>
              {companionEntries.length} known companion
              {companionEntries.length === 1 ? '' : 's'} — none in your garden yet.
            </Text>
          </GlassCard>
        ) : (
          <GlassCard level={1} style={styles.hintCard}>
            <Text style={styles.hintText}>
              No companion data for this species.
            </Text>
          </GlassCard>
        )}

        {/* GROWTH ARCHIVE (photo gallery strip) */}
        <SectionHeader label="GROWTH ARCHIVE" title="Photos" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}
        >
          <Pressable
            style={styles.photoAddTile}
            onPress={() => Alert.alert('Photo', 'Upload coming soon.')}
          >
            <Text style={styles.photoAddIcon}>+</Text>
            <Text style={styles.photoAddLabel}>ADD</Text>
          </Pressable>
          {photoEntries.length === 0 ? (
            <View style={styles.photoEmpty}>
              <Text style={styles.photoEmptyText}>No photos yet.</Text>
            </View>
          ) : (
            photoEntries.map((e) => (
              <View key={e.id} style={styles.photoTile}>
                {e.imageUri ? (
                  <Image
                    source={{ uri: e.imageUri }}
                    style={styles.photoImage}
                  />
                ) : (
                  <View style={[styles.photoImage, styles.photoPlaceholder]}>
                    <Text style={{ fontSize: 20 }}>🌿</Text>
                  </View>
                )}
                <Text style={styles.photoDate}>{formatDate(e.date)}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* DANGER ZONE */}
        <SectionHeader label="DANGER ZONE" title="Irreversible Actions" />
        <View style={styles.dangerRow}>
          <Pressable style={styles.archiveBtn} onPress={handleArchive}>
            <Text style={styles.archiveBtnText}>Archive Plant</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete Plant</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function MetaRow({
  label,
  value,
  italic,
  last,
}: {
  label: string;
  value: string;
  italic?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.metaRow, last && styles.metaRowLast]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text
        style={[styles.metaValue, italic && { fontStyle: 'italic' }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GARDEN_SURFACES.base },
  scroll: { flex: 1 },
  content: { paddingBottom: 40, gap: 20 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GARDEN_SURFACES.base,
  },

  // HERO
  hero: {
    width: '100%',
    aspectRatio: 4 / 5,
    position: 'relative',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.lift,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  heroTopBar: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTopRight: {
    flexDirection: 'row',
    gap: 10,
  },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(14,14,19,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnIcon: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '500',
  },
  heroContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    gap: 8,
  },
  healthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  healthChipText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
  },
  heroTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 34,
    letterSpacing: -0.02 * 34,
    color: colors.text,
  },
  heroSpecies: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  heroMetaText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },

  // STATS ROW
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  statHalf: {
    flex: 1,
  },
  statLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  statSubText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  neverText: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 28,
    letterSpacing: -0.02 * 28,
    color: GARDEN_TERTIARY,
    marginTop: 8,
  },
  healthRingWrap: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  healthRingOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  healthRingFill: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 50,
    borderWidth: 6,
  },
  healthRingValue: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 28,
    letterSpacing: -0.02 * 28,
  },

  // BENTO
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
  bentoCell: {
    width: '47%',
    minHeight: 96,
    flexGrow: 1,
    gap: 4,
  },
  bentoIcon: {
    fontSize: 20,
  },
  bentoLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bentoValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  bentoSub: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    color: GARDEN_TERTIARY,
  },

  // META
  metaCard: {
    marginHorizontal: 20,
    gap: 0,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  metaRowLast: {
    borderBottomWidth: 0,
  },
  metaLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  metaValue: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },

  // FILTERS
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },

  // TIMELINE
  timelineCard: {
    marginHorizontal: 20,
    gap: 0,
  },
  emptyText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: 8,
  },

  // COMPANIONS
  companionRow: {
    gap: 12,
    paddingHorizontal: 20,
  },
  companionCard: {
    width: 130,
    gap: 4,
    alignItems: 'flex-start',
  },
  companionIcon: {
    fontSize: 22,
  },
  companionName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  companionSpecies: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  warningCard: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningIcon: {
    fontSize: 22,
  },
  warningTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_DANGER,
  },
  warningSub: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  hintCard: {
    marginHorizontal: 20,
  },
  hintText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // PHOTOS
  photoRow: {
    gap: 10,
    paddingHorizontal: 20,
  },
  photoAddTile: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: GARDEN_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddIcon: {
    fontSize: 28,
    color: GARDEN_ACCENT,
    lineHeight: 30,
  },
  photoAddLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
  },
  photoTile: {
    width: 88,
    gap: 4,
  },
  photoImage: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDate: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
  },
  photoEmpty: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  photoEmptyText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // DANGER
  dangerRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  archiveBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  archiveBtnText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  deleteBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_DANGER,
  },
});
