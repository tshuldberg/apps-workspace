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
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BodyRegionId } from '@mylife/meds/ui';
import type { DoseCategory, InjectionSiteName, InsulinType } from '@mylife/meds';
import {
  convertGlucose,
  getActiveMedications,
  getInjectionSites,
  getLatestGlucoseReading,
  getSetting,
  getSiteRecency,
  getSuggestedSite,
  logInsulinEntry,
} from '@mylife/meds';
import {
  BodyDiagram,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const INSULIN_TYPE_OPTIONS: Array<{ value: InsulinType; label: string }> = [
  { value: 'rapid', label: 'Rapid' },
  { value: 'short', label: 'Short' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'long', label: 'Long-acting' },
  { value: 'mixed', label: 'Pre-mixed' },
  { value: 'ultra_rapid', label: 'Ultra rapid' },
];

const DOSE_CATEGORY_OPTIONS: DoseCategory[] = ['basal', 'bolus', 'correction', 'mixed'];

const SITE_LABELS: Record<InjectionSiteName, string> = {
  abdomen_left: 'Left abdomen',
  abdomen_right: 'Right abdomen',
  thigh_left: 'Left thigh',
  thigh_right: 'Right thigh',
  arm_left: 'Left arm',
  arm_right: 'Right arm',
  buttock_left: 'Left glute',
  buttock_right: 'Right glute',
};

const SITE_REGION_MAP: Record<InjectionSiteName, { region: BodyRegionId; side: 'front' | 'back' }> = {
  abdomen_left: { region: 'abdomen', side: 'front' },
  abdomen_right: { region: 'abdomen', side: 'front' },
  thigh_left: { region: 'left_leg', side: 'front' },
  thigh_right: { region: 'right_leg', side: 'front' },
  arm_left: { region: 'left_arm', side: 'front' },
  arm_right: { region: 'right_arm', side: 'front' },
  buttock_left: { region: 'back', side: 'back' },
  buttock_right: { region: 'back', side: 'back' },
};

const REGION_SITE_MAP: Partial<Record<BodyRegionId, InjectionSiteName[]>> = {
  abdomen: ['abdomen_left', 'abdomen_right'],
  left_leg: ['thigh_left'],
  right_leg: ['thigh_right'],
  left_arm: ['arm_left'],
  right_arm: ['arm_right'],
  back: ['buttock_left', 'buttock_right'],
};

const RECENCY_COLOR = {
  recent: '#FF453A',
  moderate: '#FFD60A',
  available: '#30D158',
} as const;

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseUnits(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function LogInsulinScreen() {
  const db = useDatabase();
  const glucoseUnit = ((getSetting(db, 'glucoseUnit') as 'mg/dL' | 'mmol/L' | null) ?? 'mg/dL');
  const [unitsText, setUnitsText] = useState('');
  const [insulinType, setInsulinType] = useState<InsulinType>('rapid');
  const [doseCategory, setDoseCategory] = useState<DoseCategory>('bolus');
  const [selectedSite, setSelectedSite] = useState<InjectionSiteName | null>(null);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null);
  const [carbsText, setCarbsText] = useState('');
  const [notes, setNotes] = useState('');

  const siteHistory = useMemo(() => getInjectionSites(db), [db]);
  const recentGlucose = useMemo(() => getLatestGlucoseReading(db, 180), [db]);
  const insulinMeds = useMemo(
    () => getActiveMedications(db).filter((med) => med.name.toLowerCase().includes('insulin')),
    [db],
  );

  const suggestedSite = useMemo(() => getSuggestedSite(siteHistory), [siteHistory]);
  const siteMap = useMemo(() => new Map(siteHistory.map((site) => [site.siteName, site])), [siteHistory]);
  const parsedUnits = parseUnits(unitsText);
  const canSave = parsedUnits !== null;
  const linkedGlucoseValue = recentGlucose
    ? Math.round(convertGlucose(recentGlucose.value, recentGlucose.unit, 'mg/dL'))
    : null;

  const diagramRegions = useMemo(() => {
    const regions = Object.entries(SITE_REGION_MAP).map(([siteName, regionInfo]) => {
      const site = siteMap.get(siteName as InjectionSiteName);
      const recency = getSiteRecency(site?.lastUsedAt ?? null);
      const isSelected = selectedSite === siteName;
      const isSuggested = suggestedSite === siteName;

      return {
        id: regionInfo.region,
        side: regionInfo.side,
        tone: isSelected
          ? MD_ACCENT
          : isSuggested
            ? RECENCY_COLOR.available
            : withAlpha(RECENCY_COLOR[recency], recency === 'available' ? 0.18 : 0.6),
      };
    });

    const unique = new Map<string, (typeof regions)[number]>();
    regions.forEach((region) => {
      const key = `${region.id}-${region.side}`;
      const existing = unique.get(key);
      if (!existing || region.tone === MD_ACCENT) {
        unique.set(key, region);
      }
    });

    return Array.from(unique.values());
  }, [selectedSite, siteMap, suggestedSite]);

  const selectedSiteRecency = selectedSite
    ? getSiteRecency(siteMap.get(selectedSite)?.lastUsedAt ?? null)
    : null;

  const mealContextLabel = recentGlucose
    ? formatLabel(recentGlucose.mealContext ?? 'random')
    : null;
  const mealTypeLabel = recentGlucose?.mealType ? formatLabel(recentGlucose.mealType) : null;

  function selectFromRegion(regionId: BodyRegionId) {
    const candidates = REGION_SITE_MAP[regionId];
    if (!candidates?.length) {
      return;
    }

    if (suggestedSite && candidates.includes(suggestedSite)) {
      setSelectedSite(suggestedSite);
      return;
    }

    const sorted = [...candidates].sort((left, right) => {
      const leftUsed = siteMap.get(left)?.lastUsedAt ?? '';
      const rightUsed = siteMap.get(right)?.lastUsedAt ?? '';
      return leftUsed.localeCompare(rightUsed);
    });
    setSelectedSite(sorted[0] ?? null);
  }

  function adjustDose(step: number) {
    const current = parsedUnits ?? 0;
    const next = Math.max(0, current + step);
    setUnitsText(next === 0 ? '' : next.toFixed(next % 1 === 0 ? 0 : 1));
  }

  function handleSave() {
    if (parsedUnits === null) {
      return;
    }

    try {
      const id = `ins-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      logInsulinEntry(db, id, {
        medicationId: selectedMedicationId ?? undefined,
        insulinType,
        units: parsedUnits,
        doseCategory,
        injectionSite: selectedSite ?? undefined,
        carbsCovered: carbsText ? Number.parseInt(carbsText, 10) : undefined,
        bloodGlucoseBefore: linkedGlucoseValue ?? undefined,
        notes: notes.trim() || undefined,
        administeredAt: new Date().toISOString(),
      });

      router.back();
    } catch (error) {
      Alert.alert(
        'Unable to save insulin dose',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <GlassCard intensity={26} padding={22} style={styles.heroCard}>
        <Text style={styles.eyebrow}>Log Insulin</Text>
        <Text style={styles.heroTitle}>Capture dose, site rotation, and linked glucose in one pass.</Text>

        <View style={styles.doseDisplay}>
          <Pressable onPress={() => adjustDose(-0.5)} style={styles.adjustButton}>
            <Text style={styles.adjustButtonText}>−0.5</Text>
          </Pressable>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setUnitsText}
            placeholder="0"
            placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.35)}
            style={styles.unitsInput}
            value={unitsText}
          />
          <Pressable onPress={() => adjustDose(0.5)} style={styles.adjustButton}>
            <Text style={styles.adjustButtonText}>+0.5</Text>
          </Pressable>
        </View>

        <View style={styles.unitsBadge}>
          <Text style={styles.unitsBadgeText}>Units</Text>
        </View>
      </GlassCard>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Insulin Type" />
        <View style={styles.typeGrid}>
          {INSULIN_TYPE_OPTIONS.map((option) => {
            const active = option.value === insulinType;
            return (
              <Pressable
                key={option.value}
                onPress={() => setInsulinType(option.value)}
                style={[styles.typeCard, active ? styles.typeCardActive : null]}
              >
                <MaterialSymbol
                  color={active ? '#041317' : MD_ACCENT_LIGHT}
                  filled={active}
                  name="vaccines"
                  size={18}
                />
                <Text style={[styles.typeLabel, active ? styles.typeLabelActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Dose Category" />
        <View style={styles.pillRow}>
          {DOSE_CATEGORY_OPTIONS.map((option) => {
            const active = option === doseCategory;
            return (
              <Pressable
                key={option}
                onPress={() => setDoseCategory(option)}
                style={[styles.pill, active ? styles.pillActive : null]}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>
                  {formatLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {insulinMeds.length ? (
        <View style={styles.sectionWrap}>
          <SectionHeader title="Linked Medication" />
          <View style={styles.pillRow}>
            {insulinMeds.map((medication) => {
              const active = medication.id === selectedMedicationId;
              return (
                <Pressable
                  key={medication.id}
                  onPress={() => setSelectedMedicationId(active ? null : medication.id)}
                  style={[styles.pill, active ? styles.pillActive : null]}
                >
                  <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>
                    {medication.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.sectionWrap}>
        <SectionHeader title="Injection Site" />
        <GlassCard intensity={18} padding={18} style={styles.diagramCard}>
          <Text style={styles.helperCopy}>
            Tap the body map or pick a specific site below. Green is the recommended rotation target.
          </Text>
          <BodyDiagram
            onPress={selectFromRegion}
            regions={diagramRegions}
            selected={selectedSite ? [SITE_REGION_MAP[selectedSite].region] : []}
          />

          <View style={styles.siteList}>
            {(Object.keys(SITE_LABELS) as InjectionSiteName[]).map((siteName) => {
              const site = siteMap.get(siteName);
              const recency = getSiteRecency(site?.lastUsedAt ?? null);
              const active = selectedSite === siteName;
              const recommended = suggestedSite === siteName;

              return (
                <Pressable
                  key={siteName}
                  onPress={() => setSelectedSite(active ? null : siteName)}
                  style={[styles.siteChip, active ? styles.siteChipActive : null]}
                >
                  <View style={[styles.siteDot, { backgroundColor: RECENCY_COLOR[recency] }]} />
                  <View style={styles.siteChipCopy}>
                    <Text style={[styles.siteLabel, active ? styles.siteLabelActive : null]}>
                      {SITE_LABELS[siteName]}
                    </Text>
                    <Text style={[styles.siteMeta, active ? styles.siteMetaActive : null]}>
                      {site?.useCount ?? 0} uses
                    </Text>
                  </View>
                  {recommended ? (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>Rotate here</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {selectedSiteRecency === 'recent' && selectedSite ? (
          <GlassCard intensity={12} padding={16} style={styles.warningCard}>
            <MaterialSymbol color="#FF453A" name="warning" size={18} />
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Recent site reuse</Text>
              <Text style={styles.warningBody}>
                {SITE_LABELS[selectedSite]} was used recently. Rotate to {suggestedSite ? SITE_LABELS[suggestedSite] : 'a different site'} to reduce irritation.
              </Text>
            </View>
          </GlassCard>
        ) : null}
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Linked Context" />
        <GlassCard intensity={16} padding={18} style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name="bloodtype" size={18} />
            </View>
            <View style={styles.metaCopy}>
              <Text style={styles.metaLabel}>Recent glucose</Text>
              <Text style={styles.metaValue}>
                {linkedGlucoseValue !== null
                  ? `${linkedGlucoseValue} mg/dL${recentGlucose ? ` • ${formatTimestamp(recentGlucose.measuredAt)}` : ''}`
                  : 'No recent glucose reading found'}
              </Text>
            </View>
          </View>

          {(mealContextLabel || mealTypeLabel) ? (
            <View style={styles.metaRow}>
              <View style={styles.metaIconWrap}>
                <MaterialSymbol color={MD_ACCENT_LIGHT} name="restaurant_menu" size={18} />
              </View>
              <View style={styles.metaCopy}>
                <Text style={styles.metaLabel}>Linked meal context</Text>
                <Text style={styles.metaValue}>
                  {[mealContextLabel, mealTypeLabel].filter(Boolean).join(' • ')}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name="schedule" size={18} />
            </View>
            <View style={styles.metaCopy}>
              <Text style={styles.metaLabel}>Dose time</Text>
              <Text style={styles.metaValue}>{formatTimestamp(new Date().toISOString())}</Text>
            </View>
          </View>
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Additional Notes" />
        <GlassCard intensity={16} padding={14} style={styles.inputCard}>
          <View style={styles.splitInputs}>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Carbs covered</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setCarbsText}
                placeholder="0"
                placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.45)}
                style={styles.inlineInput}
                value={carbsText}
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Linked glucose unit</Text>
              <Text style={styles.inlineStatic}>{glucoseUnit}</Text>
            </View>
          </View>

          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Meal notes, exercise, symptoms, or dosing rationale."
            placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.45)}
            style={styles.notesInput}
            textAlignVertical="top"
            value={notes}
          />
        </GlassCard>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={handleSave}
        style={({ pressed }) => [
          styles.savePressable,
          !canSave ? styles.saveDisabled : null,
          pressed && canSave ? styles.savePressed : null,
        ]}
      >
        <LinearGradient
          colors={[MD_ACCENT_LIGHT, MD_ACCENT]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.saveButton}
        >
          <Text style={styles.saveButtonText}>Save Insulin Dose</Text>
          <MaterialSymbol color="#031014" filled name="check_circle" size={20} />
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_SURFACES.lowest, 0.72),
    borderRadius: 24,
    gap: 18,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  doseDisplay: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  adjustButton: {
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    borderRadius: 18,
    minWidth: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  adjustButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
    textAlign: 'center',
  },
  unitsInput: {
    color: MD_TEXT,
    flex: 1,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 68,
    fontVariant: ['tabular-nums'],
    lineHeight: 74,
    textAlign: 'center',
  },
  unitsBadge: {
    alignSelf: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unitsBadgeText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  sectionWrap: {
    gap: 14,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 22,
    gap: 10,
    minWidth: '30%',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  typeCardActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.92),
    transform: [{ scale: 1.02 }],
  },
  typeLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  typeLabelActive: {
    color: '#041317',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    backgroundColor: withAlpha(MD_TEXT_SECONDARY, 0.08),
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.92),
  },
  pillText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  pillTextActive: {
    color: '#041317',
  },
  diagramCard: {
    gap: 16,
  },
  helperCopy: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  siteList: {
    gap: 10,
  },
  siteChip: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  siteChipActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
  },
  siteDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  siteChipCopy: {
    flex: 1,
    gap: 2,
  },
  siteLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  siteLabelActive: {
    color: MD_ACCENT_LIGHT,
  },
  siteMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  siteMetaActive: {
    color: MD_TEXT_SECONDARY,
  },
  recommendedBadge: {
    backgroundColor: withAlpha(RECENCY_COLOR.available, 0.16),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recommendedBadgeText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: RECENCY_COLOR.available,
  },
  warningCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  warningCopy: {
    flex: 1,
    gap: 4,
  },
  warningTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  warningBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  metaCard: {
    gap: 14,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  metaIconWrap: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  metaCopy: {
    flex: 1,
    gap: 4,
  },
  metaLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  metaValue: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
  },
  inputCard: {
    gap: 14,
  },
  splitInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: {
    flex: 1,
    gap: 8,
  },
  inlineLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  inlineInput: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 16,
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 22,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineStatic: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 16,
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  notesInput: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 110,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  savePressable: {
    marginTop: 4,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 20,
  },
  saveDisabled: {
    opacity: 0.38,
  },
  savePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  saveButtonText: {
    color: '#031014',
    fontFamily: MD_FONTS.bold,
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
});
