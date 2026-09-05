import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  createZone,
  getFrostConfig,
  getLightReadingsForZone,
  getPlants,
  getZoneAverageLux,
  getZoneStats,
  type Plant,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  createLocalId,
  formatRelativeDate,
  getExtendedZones,
  initials,
  zoneMatchesPlant,
} from './phase3-utils';

export default function ZonesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState<'indoor' | 'outdoor' | 'greenhouse' | 'balcony'>(
    'indoor',
  );
  const [description, setDescription] = useState('');

  const zones = useMemo(() => getExtendedZones(db), [db, tick]);
  const plants: Plant[] = useMemo(() => getPlants(db), [db, tick]);
  const frostConfig = useMemo(() => getFrostConfig(db), [db, tick]);

  const zoneCards = useMemo(() => {
    return zones.map((zone) => {
      const zonePlants = plants.filter((plant) => zoneMatchesPlant(plant, zone));
      const stats = getZoneStats(db, zone.id);
      const averageLux = getZoneAverageLux(db, zone.id);
      const lastReading = getLightReadingsForZone(db, zone.id)[0] ?? null;
      return {
        zone,
        zonePlants,
        stats,
        averageLux,
        lastReading,
      };
    });
  }, [db, plants, zones]);

  const handleCreateZone = () => {
    if (!name.trim()) return;
    createZone(db, createLocalId(), {
      name: name.trim(),
      location,
      description: description.trim() || null,
      sortOrder: zones.length,
    });
    setTick((value) => value + 1);
    setShowComposer(false);
    setName('');
    setDescription('');
    setLocation('indoor');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <RNText style={styles.headerLabel}>MICROCLIMATES</RNText>
          <RNText style={styles.headerTitle}>Garden Zones</RNText>
        </View>
        <Pressable onPress={() => setShowComposer((value) => !value)}>
          <RNText style={styles.headerAction}>
            {showComposer ? 'Close' : '+ New Zone'}
          </RNText>
        </Pressable>
      </View>

      <RNText style={styles.headerBody}>
        Track every room, patio, greenhouse, and bed with light snapshots,
        health ratios, and plant counts.
      </RNText>

      {showComposer && (
        <GlassCard level={2} style={styles.composerCard}>
          <RNText style={styles.composerTitle}>Create a new zone</RNText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Kitchen Window"
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
            style={styles.input}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Morning sun, afternoon shade"
            placeholderTextColor="rgba(214, 195, 181, 0.45)"
            style={[styles.input, styles.notesInput]}
            multiline
          />
          <View style={styles.locationRow}>
            {(['indoor', 'outdoor', 'greenhouse', 'balcony'] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => setLocation(option)}
                style={[
                  styles.locationChip,
                  location === option && styles.locationChipActive,
                ]}
              >
                <RNText
                  style={[
                    styles.locationChipText,
                    location === option && styles.locationChipTextActive,
                  ]}
                >
                  {option}
                </RNText>
              </Pressable>
            ))}
          </View>
          <GradientButton title="Save Zone" onPress={handleCreateZone} />
        </GlassCard>
      )}

      <View style={styles.zoneList}>
        {zoneCards.map(({ zone, zonePlants, stats, averageLux, lastReading }) => (
          <Pressable
            key={zone.id}
            onPress={() => router.push(`/(garden)/zone/${zone.id}`)}
          >
            <GlassCard level={1} style={styles.zoneCard}>
              <View style={styles.zoneTopRow}>
                <View style={styles.zoneCopy}>
                  <RNText style={styles.zoneName}>{zone.name}</RNText>
                  <RNText style={styles.zoneMeta}>
                    {stats.plantCount} plants · {zone.location}
                  </RNText>
                </View>
                <View style={styles.countBadge}>
                  <RNText style={styles.countBadgeText}>{stats.plantCount}</RNText>
                </View>
              </View>

              <View style={styles.statRow}>
                <MiniStat label="Healthy" value={`${stats.healthyCount}/${Math.max(stats.plantCount, 1)}`} />
                <MiniStat label="Overdue" value={`${stats.overdueCount}`} />
                <MiniStat label="Light" value={averageLux != null ? `${averageLux} lux` : 'No data'} />
              </View>

              <RNText style={styles.zoneDescription}>
                {zone.description || zone.temperatureNotes || 'Add notes to capture this microclimate.'}
              </RNText>

              <View style={styles.thumbnailRow}>
                {zonePlants.slice(0, 4).map((plant) => (
                  <View key={plant.id} style={styles.thumbCircle}>
                    <RNText style={styles.thumbText}>{initials(plant.name)}</RNText>
                  </View>
                ))}
                {zonePlants.length === 0 && (
                  <RNText style={styles.zoneMeta}>No plants assigned yet</RNText>
                )}
              </View>

              <RNText style={styles.readingMeta}>
                {lastReading != null
                  ? `Last light reading ${formatRelativeDate(lastReading.readingDate)}`
                  : 'No light readings yet'}
              </RNText>
            </GlassCard>
          </Pressable>
        ))}
      </View>

      <GlassCard level={2} style={styles.hardinessCard}>
        <RNText style={styles.headerLabel}>USDA HARDINESS</RNText>
        <RNText style={styles.hardinessValue}>
          Zone {frostConfig?.usdaZone ?? '7a'}
        </RNText>
        <RNText style={styles.hardinessBody}>
          {frostConfig?.zipCode
            ? `Configured for ${frostConfig.zipCode}`
            : 'Location not configured yet'}
        </RNText>
        <Pressable onPress={() => router.push('/(garden)/frost')}>
          <RNText style={styles.hardinessLink}>Edit frost location</RNText>
        </Pressable>
      </GlassCard>
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <RNText style={styles.miniStatLabel}>{label}</RNText>
      <RNText style={styles.miniStatValue}>{value}</RNText>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 1.1,
    color: GARDEN_ACCENT,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerAction: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
  headerBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  composerCard: {
    gap: spacing.md,
  },
  composerTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
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
  zoneList: {
    gap: spacing.md,
  },
  zoneCard: {
    gap: spacing.md,
  },
  zoneTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  zoneCopy: {
    flex: 1,
    gap: 4,
  },
  zoneName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  zoneMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  countBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${GARDEN_ACCENT}18`,
  },
  countBadgeText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: GARDEN_ACCENT_LIGHT,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  miniStat: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: GARDEN_SURFACES.lift,
    gap: 4,
  },
  miniStatLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  miniStatValue: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  zoneDescription: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  thumbnailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thumbCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.focus,
  },
  thumbText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text,
  },
  readingMeta: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  hardinessCard: {
    gap: 8,
  },
  hardinessValue: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
    fontSize: 28,
  },
  hardinessBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  hardinessLink: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: GARDEN_ACCENT_LIGHT,
  },
});
