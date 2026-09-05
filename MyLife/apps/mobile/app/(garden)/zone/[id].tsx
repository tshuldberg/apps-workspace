import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  PlantCard,
  deleteZone,
  getLightReadingsForZone,
  getPlants,
  getZoneAverageLux,
  getZoneStats,
  updateZone,
  type Plant,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  ExtendedZone,
  getExtendedZones,
  zoneMatchesPlant,
} from '../phase3-utils';

type FilterKey = 'all' | 'attention' | 'healthy';

export default function ZoneDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [draftName, setDraftName] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftLocation, setDraftLocation] = useState<
    'indoor' | 'outdoor' | 'greenhouse' | 'balcony'
  >('indoor');

  const zone: ExtendedZone | null = useMemo(() => {
    if (!id) return null;
    return getExtendedZones(db).find((entry) => entry.id === id) ?? null;
  }, [db, id, tick]);

  const plants: Plant[] = useMemo(() => {
    if (!zone) return [];
    return getPlants(db).filter((plant) => zoneMatchesPlant(plant, zone));
  }, [db, zone, tick]);

  const stats = useMemo(() => {
    if (!id) return null;
    return getZoneStats(db, id);
  }, [db, id, tick]);

  const averageLux = useMemo(() => {
    if (!id) return null;
    return getZoneAverageLux(db, id);
  }, [db, id, tick]);

  const readings = useMemo(() => {
    if (!id) return [];
    return getLightReadingsForZone(db, id).slice(0, 7);
  }, [db, id, tick]);

  const filteredPlants = useMemo(() => {
    if (filter === 'attention') {
      return plants.filter((plant) => plant.status === 'needs_attention');
    }
    if (filter === 'healthy') {
      return plants.filter((plant) => plant.status === 'healthy');
    }
    return plants;
  }, [filter, plants]);

  if (!zone || !stats) {
    return (
      <View style={styles.emptyState}>
        <RNText style={styles.emptyTitle}>Zone not found</RNText>
      </View>
    );
  }

  const handleSave = () => {
    updateZone(db, zone.id, {
      name: draftName.trim() || zone.name,
      location: draftLocation,
      description: draftNotes.trim() || null,
    });
    setEditing(false);
    setTick((value) => value + 1);
  };

  const handleDelete = () => {
    Alert.alert('Delete zone?', 'Plants will keep their saved zone labels until reassigned.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteZone(db, zone.id);
          router.back();
        },
      },
    ]);
  };

  const healthStatus = (plant: Plant) => {
    if (plant.status === 'needs_attention') return 'needsWater' as const;
    if (plant.status === 'dormant') return 'dormant' as const;
    return 'healthy' as const;
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <RNText style={styles.headerTitle}>{zone.name}</RNText>
          <RNText style={styles.headerSubtitle}>{zone.location}</RNText>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              if (!editing) {
                setDraftName(zone.name);
                setDraftNotes(zone.description ?? '');
                setDraftLocation(zone.location);
              }
              setEditing((value) => !value);
            }}
          >
            <RNText style={styles.headerAction}>{editing ? 'Cancel' : 'Edit'}</RNText>
          </Pressable>
          <Pressable onPress={handleDelete}>
            <RNText style={[styles.headerAction, { color: GARDEN_DANGER }]}>Delete</RNText>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <MiniStat label="Plants" value={`${stats.plantCount}`} />
        <MiniStat label="Healthy" value={`${stats.healthyCount}`} />
        <MiniStat label="Overdue" value={`${stats.overdueCount}`} />
        <MiniStat label="Light" value={averageLux != null ? `${averageLux}` : '--'} />
      </View>

      {editing ? (
        <GlassCard level={2} style={styles.editorCard}>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            style={styles.input}
            placeholder="Zone name"
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
          />
          <TextInput
            value={draftNotes}
            onChangeText={setDraftNotes}
            style={[styles.input, styles.notesInput]}
            placeholder="Morning sun, afternoon shade"
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
            multiline
          />
          <View style={styles.locationRow}>
            {(['indoor', 'outdoor', 'greenhouse', 'balcony'] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => setDraftLocation(option)}
                style={[
                  styles.locationChip,
                  draftLocation === option && styles.locationChipActive,
                ]}
              >
                <RNText
                  style={[
                    styles.locationChipText,
                    draftLocation === option && styles.locationChipTextActive,
                  ]}
                >
                  {option}
                </RNText>
              </Pressable>
            ))}
          </View>
          <GradientButton title="Save Zone" onPress={handleSave} />
        </GlassCard>
      ) : (
        <GlassCard level={1} style={styles.notesCard}>
          <RNText style={styles.notesTitle}>Microclimate notes</RNText>
          <RNText style={styles.notesBody}>
            {zone.description || zone.temperatureNotes || 'No notes yet for this zone.'}
          </RNText>
        </GlassCard>
      )}

      <GlassCard level={1} style={styles.chartCard}>
        <RNText style={styles.notesTitle}>Environment snapshot</RNText>
        <View style={styles.chartBars}>
          {readings.length === 0 ? (
            <RNText style={styles.notesBody}>Take a few light readings to populate this zone history.</RNText>
          ) : (
            readings.map((reading) => {
              const height = Math.max(24, Math.min(92, reading.readingLux / 120));
              return (
                <View key={reading.id} style={styles.chartColumn}>
                  <View style={[styles.chartBar, { height }]} />
                  <RNText style={styles.chartLabel}>
                    {reading.readingDate.slice(5)}
                  </RNText>
                </View>
              );
            })
          )}
        </View>
      </GlassCard>

      <View style={styles.filterRow}>
        {([
          ['all', 'All'],
          ['attention', 'Needs Attention'],
          ['healthy', 'Healthy'],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.filterChip, filter === key && styles.filterChipActive]}
          >
            <RNText
              style={[
                styles.filterChipText,
                filter === key && styles.filterChipTextActive,
              ]}
            >
              {label}
            </RNText>
          </Pressable>
        ))}
      </View>

      <View style={styles.plantGrid}>
        {filteredPlants.map((plant) => (
          <PlantCard
            key={plant.id}
            name={plant.name}
            species={plant.species ?? undefined}
            zone={zone.name}
            healthStatus={healthStatus(plant)}
            lastWatered={plant.lastWatered ?? undefined}
            onPress={() => router.push(`/(garden)/plant/${plant.id}`)}
          />
        ))}
      </View>

      <Pressable
        style={styles.readingButton}
        onPress={() => router.push(`/(garden)/light-meter?zoneId=${zone.id}`)}
      >
        <RNText style={styles.readingButtonText}>Take light reading</RNText>
      </Pressable>
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <RNText style={styles.statLabel}>{label}</RNText>
      <RNText style={styles.statValue}>{value}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  emptyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  headerAction: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    minWidth: '22%',
    padding: 12,
    borderRadius: 16,
    backgroundColor: GARDEN_SURFACES.lift,
    gap: 4,
  },
  statLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  statValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  editorCard: {
    gap: spacing.md,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: GARDEN_SURFACES.lift,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  locationChipActive: {
    backgroundColor: `${GARDEN_ACCENT}24`,
  },
  locationChipText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  locationChipTextActive: {
    color: GARDEN_ACCENT_LIGHT,
  },
  notesCard: {
    gap: 8,
  },
  notesTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  notesBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chartCard: {
    gap: spacing.md,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  chartColumn: {
    alignItems: 'center',
    gap: 6,
  },
  chartBar: {
    width: 22,
    borderRadius: 11,
    backgroundColor: `${GARDEN_ACCENT}55`,
  },
  chartLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.textTertiary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
  },
  filterChipActive: {
    backgroundColor: `${GARDEN_ACCENT}24`,
  },
  filterChipText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: GARDEN_ACCENT_LIGHT,
  },
  plantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  readingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  readingButtonText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
});
