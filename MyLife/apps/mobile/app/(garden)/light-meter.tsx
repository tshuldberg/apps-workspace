import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  MoveRight,
  Sparkles,
  SunMedium,
} from 'lucide-react-native';
import {
  GARDEN_ACCENT,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  SectionHeader,
  ZoneChip,
  classifyLight,
  createLightReading,
  getLightReadingsForZone,
  getPlants,
  getZoneAverageLux,
  getZones,
  type GardenZone,
  type LightLevel,
  type Plant,
} from '@mylife/garden';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type Requirement = {
  label: string;
  min: number;
  max: number;
};

type CurvePoint = {
  label: string;
  lux: number;
};

const MAX_LUX = 15000;
const CURVE_HOURS = ['6a', '9a', '12p', '3p', '6p', '9p'];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lightLabel(level: LightLevel): string {
  switch (level) {
    case 'low':
      return 'Low Light';
    case 'medium':
      return 'Partial Shade';
    case 'bright_indirect':
      return 'Bright Indirect';
    case 'direct':
      return 'Full Sun';
  }
}

function requirementForPlant(plant: Plant): Requirement {
  const species = `${plant.name} ${plant.species ?? ''}`.toLowerCase();
  if (species.includes('cactus') || species.includes('succulent') || species.includes('pepper') || species.includes('tomato')) {
    return { label: 'Full Sun', min: 9000, max: 15000 };
  }
  if (species.includes('fern') || species.includes('calathea') || species.includes('peace lily')) {
    return { label: 'Shade', min: 250, max: 1800 };
  }
  if (species.includes('monstera') || species.includes('philodendron') || species.includes('orchid') || species.includes('pothos')) {
    return { label: 'Bright Indirect', min: 2500, max: 9000 };
  }
  if (plant.location === 'outdoor' || plant.location === 'balcony') {
    return { label: 'Outdoor Bright', min: 6000, max: 14000 };
  }
  if (plant.location === 'greenhouse') {
    return { label: 'Greenhouse', min: 5000, max: 13000 };
  }
  return { label: 'Partial Shade', min: 1000, max: 5000 };
}

function inferredBaseLux(zone: GardenZone | undefined, average: number | null, date: Date) {
  if (average != null) return average;
  const hour = date.getHours();
  const daylightFactor = hour >= 10 && hour <= 15 ? 1.1 : hour <= 8 || hour >= 18 ? 0.62 : 0.85;
  const locationBase =
    zone?.location === 'outdoor'
      ? 11000
      : zone?.location === 'balcony'
        ? 7200
        : zone?.location === 'greenhouse'
          ? 6800
          : 2100;
  const name = zone?.name.toLowerCase() ?? '';
  const directionalBoost =
    name.includes('south') || name.includes('terrace')
      ? 1800
      : name.includes('east')
        ? 900
        : name.includes('north')
          ? -700
          : 0;
  return Math.round((locationBase + directionalBoost) * daylightFactor);
}

function captureLux(zone: GardenZone | undefined, average: number | null) {
  const now = new Date();
  const base = inferredBaseLux(zone, average, now);
  const minuteVariance = (now.getMinutes() % 7) * 120 - 300;
  return clamp(Math.round(base + minuteVariance), 120, MAX_LUX);
}

function buildCurve(baseLux: number) {
  const ratios = [0.38, 0.64, 1, 0.92, 0.68, 0.28];
  return CURVE_HOURS.map((label, index) => ({
    label,
    lux: clamp(Math.round(baseLux * ratios[index]), 120, MAX_LUX),
  }));
}

function directSunHours(zone: GardenZone | undefined, requirement: Requirement, month: number) {
  const seasonalBoost = month >= 4 && month <= 8 ? 1.15 : month <= 1 || month >= 10 ? 0.72 : 0.92;
  const locationBoost =
    zone?.location === 'outdoor'
      ? 6.4
      : zone?.location === 'balcony'
        ? 5.1
        : zone?.location === 'greenhouse'
          ? 4.3
          : 2.6;
  const requirementPenalty = requirement.max <= 1800 ? -1.2 : requirement.min >= 9000 ? 1.1 : 0;
  return Math.max(1.2, Math.round((locationBoost * seasonalBoost + requirementPenalty) * 10) / 10);
}

export default function LightMeterScreen() {
  const db = useDatabase();
  const params = useLocalSearchParams<{ zoneId?: string }>();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [tick, setTick] = useState(0);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(params.zoneId ?? null);

  const zones = useMemo(() => getZones(db), [db, tick]);
  const plants = useMemo(() => getPlants(db), [db, tick]);

  const zoneStats = useMemo(() => {
    return zones.map((zone) => {
      const avg = getZoneAverageLux(db, zone.id);
      const inferred = inferredBaseLux(zone, avg, new Date());
      const level = classifyLight(inferred);
      return {
        zone,
        average: inferred,
        level,
        readings: getLightReadingsForZone(db, zone.id),
      };
    });
  }, [db, zones, tick]);

  const activeZone =
    zoneStats.find((item) => item.zone.id === selectedZoneId) ??
    zoneStats[0] ??
    null;

  const selectedPlant =
    plants.find((plant) => plant.id === selectedPlantId) ??
    plants.find((plant) => plant.zone != null && plant.zone === activeZone?.zone.name) ??
    plants[0] ??
    null;

  const latestReading =
    activeZone?.readings[0]?.readingLux ??
    (activeZone != null ? activeZone.average : 0);

  const currentLevel = latestReading > 0 ? classifyLight(latestReading) : 'medium';
  const curve = useMemo<CurvePoint[]>(() => buildCurve(latestReading || 2200), [latestReading]);
  const maxCurve = Math.max(...curve.map((point) => point.lux), 1);
  const selectedRequirement = selectedPlant != null ? requirementForPlant(selectedPlant) : { label: 'Partial Shade', min: 1000, max: 5000 };
  const sunHours = directSunHours(activeZone?.zone, selectedRequirement, selectedMonth);

  const plantComparisons = useMemo(() => {
    return plants.map((plant) => {
      const requirement = requirementForPlant(plant);
      const zoneAverage = zoneStats.find((item) => item.zone.name === plant.zone)?.average ?? latestReading;
      const withinRange = zoneAverage >= requirement.min && zoneAverage <= requirement.max;
      return {
        plant,
        requirement,
        actual: zoneAverage,
        withinRange,
      };
    });
  }, [latestReading, plants, zoneStats]);

  const captureCurrentReading = () => {
    if (activeZone == null) return;
    const reading = captureLux(activeZone.zone, activeZone.average);
    createLightReading(db, `light-${Date.now().toString(36)}`, {
      zoneId: activeZone.zone.id,
      readingLux: reading,
    });
    setTick((value) => value + 1);
  };

  if (zones.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.emptyContent}>
        <GlassCard level={2} style={styles.emptyCard}>
          <RNText style={styles.emptyTitle}>No zones configured</RNText>
          <RNText style={styles.emptyBody}>
            Add a garden zone first, then return to map luminance and compare plant placement.
          </RNText>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <RNText style={styles.headerTitle}>Light Levels</RNText>
        <RNText style={styles.headerSubtitle}>Optimize your sanctuary&apos;s luminescence</RNText>
      </View>

      <GlassCard level={2} style={styles.readingHero}>
        <View style={styles.readingHeroTop}>
          <View style={styles.readingCopy}>
            <RNText style={styles.readingValue}>{latestReading.toLocaleString()}</RNText>
            <RNText style={styles.readingUnit}>lux</RNText>
            <RNText style={styles.readingLabel}>{lightLabel(currentLevel)}</RNText>
          </View>
          <View style={styles.gauge}>
            <View style={styles.gaugeOuter}>
              <View
                style={[
                  styles.gaugeInner,
                  { transform: [{ scale: clamp((latestReading || 1) / MAX_LUX, 0.3, 1) }] },
                ]}
              />
            </View>
          </View>
        </View>
        <View style={styles.zoneChipRow}>
          {zoneStats.map((item) => (
            <ZoneChip
              key={item.zone.id}
              label={item.zone.name}
              active={item.zone.id === activeZone?.zone.id}
              onPress={() => setSelectedZoneId(item.zone.id)}
            />
          ))}
        </View>
        <GradientButton title="Take Reading" onPress={captureCurrentReading} />
      </GlassCard>

      <SectionHeader label="Zone Luminance" title="Garden sectors" />
      <View style={styles.zoneGrid}>
        {zoneStats.map((item) => (
          <GlassCard
            key={item.zone.id}
            level={1}
            style={[
              styles.zoneCard,
              item.zone.id === activeZone?.zone.id && styles.zoneCardActive,
            ]}
          >
            <RNText style={styles.zoneName}>{item.zone.name}</RNText>
            <RNText style={styles.zoneMeta}>{item.zone.location.toUpperCase()}</RNText>
            <RNText style={styles.zoneLux}>{item.average.toLocaleString()} lux</RNText>
            <View style={styles.zoneFooter}>
              <RNText style={styles.zoneLevel}>{lightLabel(item.level)}</RNText>
              <RNText style={styles.zoneDelta}>
                {item.readings.length} readings
              </RNText>
            </View>
          </GlassCard>
        ))}
      </View>

      <SectionHeader label="Curated Compatibility" title="Plant light needs vs actual" />
      <View style={styles.comparisonStack}>
        {plantComparisons.slice(0, 8).map((comparison) => {
          const markerLeft = `${clamp((comparison.actual / MAX_LUX) * 100, 4, 96)}%` as const;
          const rangeLeft = `${(comparison.requirement.min / MAX_LUX) * 100}%` as const;
          const rangeWidth = `${((comparison.requirement.max - comparison.requirement.min) / MAX_LUX) * 100}%` as const;
          return (
            <GlassCard key={comparison.plant.id} level={1} style={styles.comparisonCard}>
              <View style={styles.comparisonHeader}>
                <View style={styles.comparisonIdentity}>
                  {comparison.plant.imageUri != null ? (
                    <Image source={{ uri: comparison.plant.imageUri }} style={styles.comparisonThumb} />
                  ) : (
                    <View style={styles.comparisonPlaceholder}>
                      <SunMedium size={16} color={GARDEN_GOLD} strokeWidth={1.8} />
                    </View>
                  )}
                  <View style={styles.comparisonCopy}>
                    <RNText style={styles.comparisonPlant}>{comparison.plant.name}</RNText>
                    <RNText style={styles.comparisonSpecies}>
                      {comparison.requirement.label} · {comparison.actual.toLocaleString()} lux
                    </RNText>
                  </View>
                </View>
                <View style={[styles.matchBadge, comparison.withinRange ? styles.matchBadgeGood : styles.matchBadgeWarn]}>
                  <RNText style={styles.matchBadgeText}>{comparison.withinRange ? 'Match' : 'Move'}</RNText>
                </View>
              </View>
              <View style={styles.rangeTrack}>
                <View style={[styles.rangeRecommended, { left: rangeLeft, width: rangeWidth }]} />
                <View style={[styles.rangeMarker, { left: markerLeft }]} />
              </View>
            </GlassCard>
          );
        })}
      </View>

      <SectionHeader label="Daily Light Curve" title="Sunrise to sunset" />
      <GlassCard level={1} style={styles.curveCard}>
        <View style={styles.curveChart}>
          {curve.map((point) => (
            <View key={point.label} style={styles.curveColumn}>
              <RNText style={styles.curveLux}>{Math.round(point.lux / 100) / 10}k</RNText>
              <View style={[styles.curveBar, { height: Math.max(24, (point.lux / maxCurve) * 120) }]} />
              <RNText style={styles.curveLabel}>{point.label}</RNText>
            </View>
          ))}
        </View>
      </GlassCard>

      <SectionHeader label="Exposure Calculator" title="Optimal move" />
      <GlassCard level={1} style={styles.calculatorCard}>
        <View style={styles.calculatorSelectors}>
          <View style={styles.selectorGroup}>
            <RNText style={styles.selectorLabel}>Zone</RNText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
              {zoneStats.map((item) => (
                <ZoneChip
                  key={`calc-${item.zone.id}`}
                  label={item.zone.name}
                  active={item.zone.id === activeZone?.zone.id}
                  onPress={() => setSelectedZoneId(item.zone.id)}
                />
              ))}
            </ScrollView>
          </View>
          <View style={styles.selectorGroup}>
            <RNText style={styles.selectorLabel}>Plant</RNText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
              {plants.map((plant) => (
                <ZoneChip
                  key={`plant-${plant.id}`}
                  label={plant.name}
                  active={plant.id === selectedPlant?.id}
                  onPress={() => setSelectedPlantId(plant.id)}
                />
              ))}
            </ScrollView>
          </View>
          <View style={styles.selectorGroup}>
            <RNText style={styles.selectorLabel}>Date</RNText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
              {MONTHS.map((month, index) => (
                <ZoneChip
                  key={month}
                  label={month}
                  active={index === selectedMonth}
                  onPress={() => setSelectedMonth(index)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={styles.calculatorResult}>
          <View style={styles.calculatorResultCopy}>
            <RNText style={styles.calculatorHours}>{sunHours.toFixed(1)}h</RNText>
            <RNText style={styles.calculatorBody}>
              Predicted direct sun in {activeZone?.zone.name ?? 'this zone'} for {selectedPlant?.name ?? 'the selected plant'}.
            </RNText>
          </View>
          <View style={styles.calculatorArrow}>
            <MoveRight size={20} color={GARDEN_ACCENT} strokeWidth={1.8} />
          </View>
        </View>
        <View style={styles.calculatorAdvice}>
          <Sparkles size={16} color={GARDEN_GOLD} strokeWidth={1.8} />
          <RNText style={styles.calculatorAdviceText}>
            {sunHours < 3
              ? 'Move this plant closer to a brighter window for a more stable growth profile.'
              : sunHours > 6
                ? 'Provide afternoon protection if leaves begin to bleach or curl.'
                : 'Placement is well balanced for the selected plant profile.'}
          </RNText>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.base,
  },
  content: {
    paddingTop: 104,
    paddingBottom: 140,
    paddingHorizontal: 16,
    gap: 16,
  },
  emptyContent: {
    paddingTop: 104,
    paddingHorizontal: 16,
    paddingBottom: 64,
  },
  emptyCard: {
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: colors.text,
  },
  emptyBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  header: {
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
  readingHero: {
    padding: 18,
    gap: 16,
  },
  readingHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  readingCopy: {
    gap: 4,
  },
  readingValue: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  readingUnit: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_GOLD,
  },
  readingLabel: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.textSecondary,
  },
  gauge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 10,
    borderColor: 'rgba(132, 204, 22, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GARDEN_ACCENT,
    opacity: 0.85,
  },
  zoneChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  zoneCard: {
    width: '47%',
    padding: 16,
    gap: 6,
  },
  zoneCardActive: {
    borderWidth: 1,
    borderColor: 'rgba(132, 204, 22, 0.28)',
  },
  zoneName: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  zoneMeta: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  zoneLux: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 26,
    color: colors.text,
  },
  zoneFooter: {
    gap: 2,
  },
  zoneLevel: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: GARDEN_GOLD,
  },
  zoneDelta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textTertiary,
  },
  comparisonStack: {
    gap: 12,
  },
  comparisonCard: {
    padding: 14,
    gap: 12,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  comparisonIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  comparisonThumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  comparisonPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  comparisonCopy: {
    flex: 1,
    gap: 2,
  },
  comparisonPlant: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  comparisonSpecies: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  matchBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  matchBadgeGood: {
    backgroundColor: 'rgba(132, 204, 22, 0.16)',
  },
  matchBadgeWarn: {
    backgroundColor: 'rgba(255, 180, 171, 0.12)',
  },
  matchBadgeText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.text,
  },
  rangeTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.depth,
    position: 'relative',
    overflow: 'hidden',
  },
  rangeRecommended: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: 'rgba(132, 204, 22, 0.26)',
  },
  rangeMarker: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 18,
    borderRadius: 999,
    marginLeft: -7,
    backgroundColor: GARDEN_GOLD,
  },
  curveCard: {
    padding: 16,
  },
  curveChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
  },
  curveColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  curveLux: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    color: colors.textSecondary,
  },
  curveBar: {
    width: 18,
    borderRadius: 999,
    backgroundColor: GARDEN_ACCENT,
  },
  curveLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    color: colors.textTertiary,
  },
  calculatorCard: {
    padding: 16,
    gap: 16,
  },
  calculatorSelectors: {
    gap: 14,
  },
  selectorGroup: {
    gap: 8,
  },
  selectorLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  selectorScroll: {
    gap: 8,
    paddingRight: 12,
  },
  calculatorResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  calculatorResultCopy: {
    flex: 1,
    gap: 4,
  },
  calculatorHours: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 26,
    color: colors.text,
  },
  calculatorBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  calculatorArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(132, 204, 22, 0.12)',
  },
  calculatorAdvice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  calculatorAdviceText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    flex: 1,
    color: colors.textSecondary,
  },
});
