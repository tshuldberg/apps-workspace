import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  Search,
  Calendar as CalendarIcon,
  Plus,
  Minus,
  Ruler,
  Check,
} from 'lucide-react-native';
import {
  createPlant,
  getZones,
  type GardenZone,
  GARDEN_ACCENT,
  GARDEN_ACCENT_DIM,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  JAKARTA_FONTS,
  GradientButton,
  ZoneChip,
} from '@mylife/garden';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const SPECIES_CATALOG: { botanical: string; common: string }[] = [
  { botanical: 'Solanum lycopersicum', common: 'Tomato' },
  { botanical: 'Ocimum basilicum', common: 'Basil' },
  { botanical: 'Mentha spicata', common: 'Spearmint' },
  { botanical: 'Capsicum annuum', common: 'Pepper' },
  { botanical: 'Lactuca sativa', common: 'Lettuce' },
  { botanical: 'Cucumis sativus', common: 'Cucumber' },
  { botanical: 'Fragaria x ananassa', common: 'Strawberry' },
  { botanical: 'Rosmarinus officinalis', common: 'Rosemary' },
  { botanical: 'Thymus vulgaris', common: 'Thyme' },
  { botanical: 'Monstera deliciosa', common: 'Monstera' },
  { botanical: 'Ficus lyrata', common: 'Fiddle Leaf Fig' },
  { botanical: 'Epipremnum aureum', common: 'Pothos' },
];

const SOIL_TYPES = ['Loam', 'Clay', 'Sandy', 'Silty', 'Peaty', 'Chalky'] as const;
type SoilType = (typeof SOIL_TYPES)[number];

const SUN_LEVELS = [
  { key: 'full', label: 'Full Sun' },
  { key: 'partial', label: 'Partial' },
  { key: 'shade', label: 'Shade' },
] as const;
type SunKey = (typeof SUN_LEVELS)[number]['key'];

const SPACING_UNITS = ['in', 'cm'] as const;
type SpacingUnit = (typeof SPACING_UNITS)[number];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function AddPlantScreen() {
  const db = useDatabase();
  const router = useRouter();

  const existingZones: GardenZone[] = useMemo(() => {
    try {
      return getZones(db);
    } catch {
      return [];
    }
  }, [db]);

  const [speciesQuery, setSpeciesQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<
    { botanical: string; common: string } | null
  >(null);
  const [speciesDropdownOpen, setSpeciesDropdownOpen] = useState(false);

  const [variety, setVariety] = useState('');
  const [plantingDate, setPlantingDate] = useState<Date>(new Date());

  const [zone, setZone] = useState<string>('');
  const [soil, setSoil] = useState<SoilType>('Loam');
  const [soilOpen, setSoilOpen] = useState(false);
  const [sun, setSun] = useState<SunKey>('full');
  const [spacing, setSpacing] = useState('12');
  const [spacingUnit, setSpacingUnit] = useState<SpacingUnit>('in');
  const [waterDays, setWaterDays] = useState(3);

  const [saving, setSaving] = useState(false);

  const filteredSpecies = useMemo(() => {
    const q = speciesQuery.trim().toLowerCase();
    if (q.length === 0) return SPECIES_CATALOG.slice(0, 6);
    return SPECIES_CATALOG.filter(
      (s) =>
        s.botanical.toLowerCase().includes(q) ||
        s.common.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [speciesQuery]);

  const isValid =
    selectedSpecies != null && zone.trim().length > 0 && waterDays >= 1;

  const handleSelectSpecies = (item: { botanical: string; common: string }) => {
    setSelectedSpecies(item);
    setSpeciesQuery(`${item.common} (${item.botanical})`);
    setSpeciesDropdownOpen(false);
  };

  const handleClearSpecies = () => {
    setSelectedSpecies(null);
    setSpeciesQuery('');
    setSpeciesDropdownOpen(true);
  };

  const bumpDate = (days: number) => {
    const next = new Date(plantingDate);
    next.setDate(next.getDate() + days);
    setPlantingDate(next);
  };

  const bumpWater = (delta: number) => {
    setWaterDays((prev) => Math.max(1, prev + delta));
  };

  const handleSave = () => {
    if (!isValid || saving) return;
    if (selectedSpecies == null) return;
    setSaving(true);
    try {
      const commonName = selectedSpecies.common;
      const plantName = variety.trim().length > 0 ? variety.trim() : commonName;
      const notes = [
        `Soil: ${soil}`,
        `Sun: ${SUN_LEVELS.find((s) => s.key === sun)?.label ?? sun}`,
        `Spacing: ${spacing} ${spacingUnit}`,
      ].join(' | ');

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      createPlant(db, id, {
        name: plantName,
        species: selectedSpecies.botanical,
        location: 'outdoor',
        zone: zone.trim(),
        waterFrequencyDays: waterDays,
        status: 'healthy',
        acquiredDate: toIsoDate(plantingDate),
        notes,
      });
      router.back();
    } catch {
      Alert.alert('Save failed', 'Please check your inputs and try again.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Save affordance in content (header already has back via BackToHubButton) */}
        <View style={styles.topRow}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleSave}
            disabled={!isValid || saving}
            hitSlop={12}
            style={[
              styles.saveIconBtn,
              { opacity: isValid && !saving ? 1 : 0.35 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save plant"
          >
            <Check size={20} color={GARDEN_ACCENT} strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* Photo Upload Hero */}
        <Pressable
          style={styles.photoHero}
          onPress={() =>
            Alert.alert(
              'Photo capture',
              'Plant photo capture is coming soon. Add photos from the plant detail screen after saving.',
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Add a photograph (coming soon)"
        >
          <View style={styles.photoInner}>
            <Camera size={40} color={GARDEN_ACCENT} strokeWidth={1.5} />
            <Text
              style={[styles.photoLabel, styles.uppercase]}
              numberOfLines={1}
            >
              Add a photograph
            </Text>
          </View>
        </Pressable>

        {/* Species Search */}
        <View style={styles.field}>
          <Text style={styles.label}>SPECIES</Text>
          <View style={styles.searchWrap}>
            <Search
              size={16}
              color={colors.textSecondary}
              strokeWidth={1.75}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search botanical database..."
              placeholderTextColor="rgba(214, 195, 181, 0.4)"
              value={speciesQuery}
              onChangeText={(t) => {
                setSpeciesQuery(t);
                setSelectedSpecies(null);
                setSpeciesDropdownOpen(true);
              }}
              onFocus={() => setSpeciesDropdownOpen(true)}
            />
            {selectedSpecies != null && (
              <Pressable onPress={handleClearSpecies} hitSlop={8}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            )}
          </View>
          {speciesDropdownOpen && selectedSpecies == null && (
            <View style={styles.dropdown}>
              {filteredSpecies.map((item) => (
                <Pressable
                  key={item.botanical}
                  onPress={() => handleSelectSpecies(item)}
                  style={styles.dropdownRow}
                >
                  <Text style={styles.dropdownCommon}>{item.common}</Text>
                  <Text style={styles.dropdownBotanical}>{item.botanical}</Text>
                </Pressable>
              ))}
              {filteredSpecies.length === 0 && (
                <Text style={styles.dropdownEmpty}>No matches</Text>
              )}
            </View>
          )}
        </View>

        {/* Variety */}
        <View style={styles.field}>
          <Text style={styles.label}>VARIETY</Text>
          <View style={styles.pillInput}>
            <TextInput
              style={styles.pillInputField}
              placeholder="e.g., Heirloom Cherry"
              placeholderTextColor="rgba(214, 195, 181, 0.4)"
              value={variety}
              onChangeText={setVariety}
              maxLength={80}
            />
          </View>
        </View>

        {/* Planting Date */}
        <View style={styles.field}>
          <Text style={styles.label}>PLANTING DATE</Text>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => bumpDate(-1)}
              hitSlop={8}
              style={styles.dateStepper}
            >
              <Minus size={16} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
            <View style={styles.dateCenter}>
              <CalendarIcon
                size={16}
                color={GARDEN_ACCENT}
                strokeWidth={1.75}
              />
              <Text style={styles.dateText}>{formatDate(plantingDate)}</Text>
            </View>
            <Pressable
              onPress={() => bumpDate(1)}
              hitSlop={8}
              style={styles.dateStepper}
            >
              <Plus size={16} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* Zone Assignment */}
        <View style={styles.field}>
          <Text style={styles.label}>ZONE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.zoneRow}
          >
            {existingZones.map((z) => (
              <ZoneChip
                key={z.id}
                label={z.name}
                active={zone === z.name}
                onPress={() => setZone(z.name)}
              />
            ))}
            {existingZones.length === 0 && (
              <>
                <ZoneChip
                  label="Patio"
                  active={zone === 'Patio'}
                  onPress={() => setZone('Patio')}
                />
                <ZoneChip
                  label="Kitchen"
                  active={zone === 'Kitchen'}
                  onPress={() => setZone('Kitchen')}
                />
                <ZoneChip
                  label="Yard"
                  active={zone === 'Yard'}
                  onPress={() => setZone('Yard')}
                />
              </>
            )}
            <Pressable
              onPress={() => {
                const name = `Zone ${existingZones.length + 1}`;
                setZone(name);
              }}
              style={styles.newZoneBtn}
              hitSlop={4}
            >
              <Plus size={14} color={GARDEN_ACCENT} strokeWidth={2.2} />
              <Text style={styles.newZoneText}>New Zone</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Soil Type */}
        <View style={styles.field}>
          <Text style={styles.label}>SOIL</Text>
          <Pressable
            style={styles.soilPill}
            onPress={() => setSoilOpen((v) => !v)}
          >
            <Text style={styles.soilText}>{soil}</Text>
            <Text style={styles.soilChevron}>{soilOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {soilOpen && (
            <View style={styles.soilMenu}>
              {SOIL_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={styles.soilMenuRow}
                  onPress={() => {
                    setSoil(type);
                    setSoilOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.soilMenuText,
                      soil === type && { color: GARDEN_ACCENT },
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Sun Requirement */}
        <View style={styles.field}>
          <Text style={styles.label}>SUNLIGHT</Text>
          <View style={styles.segmented}>
            {SUN_LEVELS.map((level) => {
              const active = sun === level.key;
              return (
                <Pressable
                  key={level.key}
                  onPress={() => setSun(level.key)}
                  style={[
                    styles.segment,
                    active && styles.segmentActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Spacing */}
        <View style={styles.field}>
          <Text style={styles.label}>SPACING</Text>
          <View style={styles.spacingRow}>
            <View style={styles.spacingInputWrap}>
              <TextInput
                style={styles.spacingInput}
                value={spacing}
                onChangeText={(t) => setSpacing(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Ruler
                size={16}
                color="rgba(214, 195, 181, 0.5)"
                strokeWidth={1.75}
              />
            </View>
            <View style={styles.unitToggle}>
              {SPACING_UNITS.map((u) => {
                const active = spacingUnit === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => setSpacingUnit(u)}
                    style={[
                      styles.unitBtn,
                      active && styles.unitBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitText,
                        active && styles.unitTextActive,
                      ]}
                    >
                      {u}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Watering Interval */}
        <View style={styles.field}>
          <Text style={styles.label}>WATERING</Text>
          <View style={styles.waterRow}>
            <Pressable
              onPress={() => bumpWater(-1)}
              style={styles.waterStepper}
              hitSlop={8}
            >
              <Minus size={18} color={colors.text} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.waterCenter}>
              <Text style={styles.waterBig}>Every {waterDays}</Text>
              <Text style={styles.waterUnit}>
                {waterDays === 1 ? 'DAY' : 'DAYS'}
              </Text>
            </View>
            <Pressable
              onPress={() => bumpWater(1)}
              style={styles.waterStepper}
              hitSlop={8}
            >
              <Plus size={18} color={colors.text} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        {/* Save CTA */}
        <View style={styles.cta}>
          {isValid ? (
            <GradientButton
              title={saving ? 'SAVING...' : 'SAVE PLANT'}
              onPress={handleSave}
              variant="primary"
            />
          ) : (
            <View style={[styles.cta, styles.ctaDisabled]}>
              <Text style={styles.ctaDisabledText}>SAVE PLANT</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 140,
    gap: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  saveIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GARDEN_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Photo hero
  photoHero: {
    aspectRatio: 1,
    width: '100%',
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(159, 142, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInner: {
    alignItems: 'center',
    gap: 10,
  },
  photoLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  uppercase: {
    textTransform: 'uppercase',
  },

  // Field shared
  field: {
    gap: 10,
  },
  label: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
    marginLeft: 4,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 20,
    minHeight: 52,
    gap: 10,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 14,
  },
  clearText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: GARDEN_ACCENT,
  },
  dropdown: {
    backgroundColor: GARDEN_SURFACES.focus,
    borderRadius: 16,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownRow: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  dropdownCommon: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.text,
  },
  dropdownBotanical: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  dropdownEmpty: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    padding: 16,
    textAlign: 'center',
  },

  // Pill input
  pillInput: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 999,
    paddingHorizontal: 22,
    minHeight: 52,
    justifyContent: 'center',
  },
  pillInputField: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 14,
  },

  // Date row
  dateRow: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 52,
  },
  dateStepper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GARDEN_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dateText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },

  // Zones
  zoneRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    paddingLeft: 4,
    alignItems: 'center',
  },
  newZoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.focus,
  },
  newZoneText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: GARDEN_ACCENT,
  },

  // Soil
  soilPill: {
    backgroundColor: GARDEN_SURFACES.focus,
    borderRadius: 999,
    paddingHorizontal: 22,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  soilText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  soilChevron: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  soilMenu: {
    marginTop: 4,
    backgroundColor: GARDEN_SURFACES.focus,
    borderRadius: 16,
    overflow: 'hidden',
  },
  soilMenuRow: {
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  soilMenuText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
  },

  // Segmented
  segmented: {
    flexDirection: 'row',
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 999,
    padding: 6,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(132, 204, 22, 0.2)',
  },
  segmentText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  segmentTextActive: {
    color: GARDEN_ACCENT,
  },

  // Spacing row
  spacingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spacingInputWrap: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 999,
    paddingHorizontal: 22,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacingInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 10,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 999,
    padding: 4,
    gap: 2,
  },
  unitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 44,
    alignItems: 'center',
  },
  unitBtnActive: {
    backgroundColor: GARDEN_SURFACES.focus,
  },
  unitText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  unitTextActive: {
    color: GARDEN_ACCENT,
  },

  // Watering
  waterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 999,
    padding: 8,
    minHeight: 60,
  },
  waterStepper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GARDEN_SURFACES.highest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  waterBig: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    color: GARDEN_ACCENT,
    letterSpacing: -0.5,
  },
  waterUnit: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
  },

  // CTA
  cta: {
    marginTop: 16,
  },
  ctaDisabled: {
    backgroundColor: GARDEN_SURFACES.focus,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaDisabledText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 13,
    letterSpacing: 0.2 * 13,
    color: 'rgba(214, 195, 181, 0.4)',
    fontFamily: JAKARTA_FONTS.extraBold,
  },
});

// Suppress unused import warning for GARDEN_ACCENT_DIM (kept for future polish)
void GARDEN_ACCENT_DIM;
