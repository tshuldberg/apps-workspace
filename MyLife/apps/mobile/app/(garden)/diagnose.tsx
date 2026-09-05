import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import {
  ChevronLeft,
  History,
  Camera,
  Check,
  Sparkles,
  Shield,
  BookmarkPlus,
  Info,
} from 'lucide-react-native';
import {
  createDiagnosis,
  getPlants,
  matchSymptoms,
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  SectionHeader,
  type Plant,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

interface DiagnosisMatch {
  entry: {
    name: string;
    type: 'disease' | 'pest' | 'nutrient_deficiency' | 'environmental';
    severity: 'mild' | 'moderate' | 'severe' | 'critical';
    description: string;
    treatment: string[];
  };
  confidence: number;
}

interface SymptomOption {
  code: string;
  label: string;
}

// User-friendly symptom labels mapped to the engine's symptom codes.
const SYMPTOM_OPTIONS: SymptomOption[] = [
  { code: 'yellowing_leaves', label: 'Yellow Leaves' },
  { code: 'brown_spots', label: 'Brown Spots' },
  { code: 'wilting', label: 'Wilting' },
  { code: 'drooping', label: 'Drooping' },
  { code: 'white_deposits', label: 'White Powder' },
  { code: 'discoloration', label: 'Black Spots' },
  { code: 'leaf_drop', label: 'Leaf Drop' },
  { code: 'sticky_residue', label: 'Sticky Residue' },
  { code: 'fine_webbing', label: 'Webbing' },
  { code: 'soft_stems', label: 'Soft Stems' },
  { code: 'leaf_curling', label: 'Curling' },
  { code: 'stunted_growth', label: 'Stunted Growth' },
];

const SEVERITY_LABEL: Record<string, string> = {
  mild: 'LOW',
  moderate: 'MEDIUM',
  severe: 'HIGH',
  critical: 'CRITICAL',
};

const SEVERITY_COLOR: Record<string, string> = {
  mild: GARDEN_ACCENT,
  moderate: GARDEN_GOLD,
  severe: GARDEN_DANGER,
  critical: GARDEN_DANGER,
};

// Generic prevention tips shown after analysis.
const PREVENTION_TIPS = [
  'Inspect leaves weekly for early signs of pests or disease.',
  'Water at soil level to keep foliage dry and discourage fungus.',
  'Maintain good air circulation between plants.',
  'Quarantine new plants for two weeks before adding them.',
];

export default function DiagnoseScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plantId } = useLocalSearchParams<{ plantId?: string }>();

  const plants: Plant[] = useMemo(() => {
    try {
      return getPlants(db);
    } catch {
      return [];
    }
  }, [db]);

  const [selectedPlantId, setSelectedPlantId] = useState<string>(
    plantId ?? '',
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [recentWatering, setRecentWatering] = useState(false);
  const [directSun, setDirectSun] = useState(false);
  const [recentRepot, setRecentRepot] = useState(false);
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor'>(
    'indoor',
  );
  const [results, setResults] = useState<DiagnosisMatch[]>([]);
  const [diagnosed, setDiagnosed] = useState(false);

  const toggleSymptom = (code: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );
    setDiagnosed(false);
  };

  const handleAnalyze = () => {
    if (selectedSymptoms.length === 0) {
      Alert.alert('Select symptoms', 'Choose at least one visible symptom.');
      return;
    }
    try {
      const matches = matchSymptoms(selectedSymptoms);
      setResults(matches.slice(0, 5));
      setDiagnosed(true);
    } catch {
      Alert.alert('Error', 'Diagnosis failed.');
    }
  };

  const handleSave = useCallback(
    (result: DiagnosisMatch) => {
      try {
        const id =
          Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        createDiagnosis(db, id, {
          plantId: selectedPlantId || null,
          symptoms: selectedSymptoms,
          diagnosisName: result.entry.name,
          diagnosisConfidence: result.confidence,
          severity: result.entry.severity,
          type: result.entry.type,
        });
        Alert.alert('Logged', 'Diagnosis saved to journal.');
      } catch {
        Alert.alert('Error', "Couldn't save diagnosis.");
      }
    },
    [db, selectedPlantId, selectedSymptoms],
  );

  const topResult = results[0];
  const relatedResults = results.slice(1);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.headerBtn}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Plant Diagnosis</Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              'History',
              'Your past diagnoses are shown in the journal tab.',
            )
          }
          hitSlop={12}
          style={styles.headerBtn}
        >
          <History size={22} color={GARDEN_ACCENT} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Intake */}
        <GlassCard level={1} style={styles.heroCard}>
          <Text style={styles.sectionLabel}>SELECT AFFECTED PLANT</Text>
          {plants.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.plantPillRow}
            >
              <Pressable
                onPress={() => setSelectedPlantId('')}
                style={[
                  styles.plantPill,
                  selectedPlantId === '' && styles.plantPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.plantPillLabel,
                    selectedPlantId === '' && styles.plantPillLabelActive,
                  ]}
                >
                  Any
                </Text>
              </Pressable>
              {plants.map((p) => {
                const active = selectedPlantId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedPlantId(p.id)}
                    style={[
                      styles.plantPill,
                      active && styles.plantPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.plantPillLabel,
                        active && styles.plantPillLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptyPlantsLabel}>
              No plants yet. Add one to link a diagnosis.
            </Text>
          )}

          <Pressable
            onPress={() =>
              Alert.alert(
                'Camera',
                'Photo capture coming soon. Use the symptom checklist below.',
              )
            }
            style={styles.captureBtn}
          >
            <Camera size={20} color={GARDEN_ACCENT} />
            <Text style={styles.captureBtnLabel}>Capture Symptom</Text>
          </Pressable>
        </GlassCard>

        {/* Symptom checklist */}
        <SectionHeader label="VISIBLE SYMPTOMS" title="What do you see?" />
        <View style={styles.symptomGrid}>
          {SYMPTOM_OPTIONS.map((s) => {
            const active = selectedSymptoms.includes(s.code);
            return (
              <Pressable
                key={s.code}
                onPress={() => toggleSymptom(s.code)}
                style={[styles.symptomChip, active && styles.symptomChipActive]}
              >
                {active && (
                  <Check
                    size={12}
                    color={GARDEN_ACCENT}
                    strokeWidth={3}
                    style={styles.symptomCheck}
                  />
                )}
                <Text
                  style={[
                    styles.symptomLabel,
                    active && styles.symptomLabelActive,
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Environmental questions */}
        <SectionHeader label="CONTEXT" title="Environment" />
        <GlassCard level={1} style={styles.envCard}>
          <EnvToggle
            label="Recent watering change?"
            value={recentWatering}
            onToggle={() => setRecentWatering((v) => !v)}
          />
          <View style={styles.divider} />
          <EnvToggle
            label="Direct sun exposure?"
            value={directSun}
            onToggle={() => setDirectSun((v) => !v)}
          />
          <View style={styles.divider} />
          <EnvToggle
            label="Recent repotting?"
            value={recentRepot}
            onToggle={() => setRecentRepot((v) => !v)}
          />
          <View style={styles.divider} />
          <View style={styles.segmentRow}>
            <Text style={styles.envLabel}>Location</Text>
            <View style={styles.segment}>
              <Pressable
                onPress={() => setEnvironment('indoor')}
                style={[
                  styles.segmentBtn,
                  environment === 'indoor' && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    environment === 'indoor' && styles.segmentLabelActive,
                  ]}
                >
                  Indoor
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setEnvironment('outdoor')}
                style={[
                  styles.segmentBtn,
                  environment === 'outdoor' && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    environment === 'outdoor' && styles.segmentLabelActive,
                  ]}
                >
                  Outdoor
                </Text>
              </Pressable>
            </View>
          </View>
        </GlassCard>

        {/* Analyze button */}
        <View style={styles.analyzeWrap}>
          <GradientButton
            title="Analyze Symptoms"
            onPress={handleAnalyze}
            variant="primary"
          />
          <View style={styles.analyzeIcon} pointerEvents="none">
            <Sparkles size={16} color="#0B1a04" />
          </View>
        </View>

        {/* Results */}
        {diagnosed && topResult != null && (
          <>
            <SectionHeader label="RESULT" title="Most Likely Cause" />
            <GlassCard level={2} style={styles.resultCard} ghostBorder>
              <View style={styles.resultHeader}>
                <View style={styles.resultHeaderText}>
                  <Text style={styles.resultName}>{topResult.entry.name}</Text>
                  <Text style={styles.resultType}>
                    {topResult.entry.type.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
                <ConfidenceRing value={topResult.confidence} />
              </View>

              <Text style={styles.resultDescription}>
                {topResult.entry.description}
              </Text>

              <View style={styles.severityRow}>
                <View
                  style={[
                    styles.severityBadge,
                    {
                      backgroundColor:
                        SEVERITY_COLOR[topResult.entry.severity] + '22',
                      borderColor:
                        SEVERITY_COLOR[topResult.entry.severity] + '55',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityLabel,
                      { color: SEVERITY_COLOR[topResult.entry.severity] },
                    ]}
                  >
                    {SEVERITY_LABEL[topResult.entry.severity] ?? 'MODERATE'}
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Treatment Plan */}
            <SectionHeader label="PROTOCOL" title="Treatment Plan" />
            <GlassCard level={1} style={styles.treatmentCard}>
              {topResult.entry.treatment.map((step, idx) => (
                <View key={idx} style={styles.treatmentStep}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </GlassCard>

            {/* Prevention Tips */}
            <SectionHeader label="FOLLOW-UP" title="Prevention" />
            <View style={styles.preventionGrid}>
              {PREVENTION_TIPS.map((tip, i) => (
                <GlassCard key={i} level={1} style={styles.preventionCard}>
                  <Shield size={16} color={GARDEN_ACCENT} />
                  <Text style={styles.preventionText}>{tip}</Text>
                </GlassCard>
              ))}
            </View>

            {/* Related issues */}
            {relatedResults.length > 0 && (
              <>
                <SectionHeader
                  label="ALSO CONSIDER"
                  title="Related Issues"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.relatedRow}
                >
                  {relatedResults.map((r, i) => (
                    <Pressable
                      key={i}
                      onPress={() => handleSave(r)}
                      style={styles.relatedCardWrap}
                    >
                      <GlassCard level={2} style={styles.relatedCard}>
                        <Text style={styles.relatedConfidence}>
                          {Math.round(r.confidence * 100)}% MATCH
                        </Text>
                        <Text style={styles.relatedName} numberOfLines={2}>
                          {r.entry.name}
                        </Text>
                        <Text style={styles.relatedType}>
                          {r.entry.type.replace(/_/g, ' ')}
                        </Text>
                      </GlassCard>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Save to journal */}
            <View style={styles.saveWrap}>
              <GradientButton
                title="Log to Journal"
                onPress={() => handleSave(topResult)}
                variant="primary"
              />
              <View style={styles.analyzeIcon} pointerEvents="none">
                <BookmarkPlus size={16} color="#0B1a04" />
              </View>
            </View>
          </>
        )}

        {diagnosed && topResult == null && (
          <GlassCard level={1} style={styles.emptyResult}>
            <Info size={20} color={GARDEN_ACCENT} />
            <Text style={styles.emptyResultText}>
              No matching conditions. Try selecting additional symptoms.
            </Text>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

function EnvToggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.envRow} hitSlop={4}>
      <Text style={styles.envLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </Pressable>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const size = 64;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const dash = c * pct;

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={GARDEN_SURFACES.highest}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={GARDEN_ACCENT}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeDashoffset={c / 4}
          fill="none"
        />
      </Svg>
      <View style={styles.ringLabelWrap}>
        <Text style={styles.ringValue}>{Math.round(pct * 100)}%</Text>
        <Text style={styles.ringCaption}>MATCH</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  // Hero
  heroCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
  },
  plantPillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  plantPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.highest,
    minHeight: 36,
    justifyContent: 'center',
  },
  plantPillActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  plantPillLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: colors.textSecondary,
  },
  plantPillLabelActive: {
    color: '#0B1a04',
  },
  emptyPlantsLabel: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: GARDEN_SURFACES.focus,
  },
  captureBtnLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    color: GARDEN_ACCENT,
  },
  // Symptoms
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  symptomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.focus,
    minHeight: 40,
    gap: 6,
  },
  symptomChipActive: {
    backgroundColor: 'rgba(132, 204, 22, 0.15)',
    shadowColor: GARDEN_ACCENT,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  symptomCheck: {
    marginRight: 2,
  },
  symptomLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  symptomLabelActive: {
    color: GARDEN_ACCENT_LIGHT,
    fontWeight: '700',
  },
  // Environmental
  envCard: {
    padding: spacing.md,
  },
  envRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  envLabel: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: GARDEN_SURFACES.focus,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: GARDEN_SURFACES.highest,
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm + 2,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 999,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 72,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  segmentLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: '#0B1a04',
  },
  // Analyze
  analyzeWrap: {
    marginTop: spacing.xs,
    position: 'relative',
  },
  analyzeIcon: {
    position: 'absolute',
    left: spacing.md + 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  // Result
  resultCard: {
    padding: spacing.md + 2,
    gap: spacing.sm + 2,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  resultHeaderText: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 26,
    color: GARDEN_GOLD,
  },
  resultType: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textSecondary,
  },
  resultDescription: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 14 * 1.6,
    color: colors.textSecondary,
  },
  severityRow: {
    flexDirection: 'row',
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  severityLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    fontWeight: '800',
  },
  ringWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringValue: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    color: GARDEN_ACCENT,
  },
  ringCaption: {
    fontFamily: GARDEN_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    marginTop: 1,
  },
  // Treatment
  treatmentCard: {
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  treatmentStep: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: GARDEN_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(132, 204, 22, 0.25)',
  },
  stepBadgeText: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: GARDEN_ACCENT,
  },
  stepText: {
    flex: 1,
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    lineHeight: 14 * 1.6,
    color: colors.textSecondary,
  },
  // Prevention
  preventionGrid: {
    gap: spacing.xs,
  },
  preventionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 2,
  },
  preventionText: {
    flex: 1,
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 13 * 1.55,
    color: colors.textSecondary,
  },
  // Related
  relatedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  relatedCardWrap: {
    width: 180,
  },
  relatedCard: {
    padding: spacing.sm + 2,
    gap: 4,
    minHeight: 96,
  },
  relatedConfidence: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    color: GARDEN_ACCENT,
  },
  relatedName: {
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  relatedType: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  saveWrap: {
    position: 'relative',
    marginTop: spacing.sm,
  },
  emptyResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  emptyResultText: {
    flex: 1,
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
