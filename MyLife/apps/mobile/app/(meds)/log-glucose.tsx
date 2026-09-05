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
import type {
  GlucoseRangeStatus,
  GlucoseUnit,
  MealContext,
  MealType,
} from '@mylife/meds';
import {
  classifyGlucose,
  convertGlucose,
  getActiveMedications,
  getInsulinEntries,
  getSetting,
  logGlucoseReading,
  setSetting,
} from '@mylife/meds';
import {
  GlassCard,
  GlucoseRange,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CARD_RADIUS,
  MD_FONTS,
  MD_GLUCOSE_STATUS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const MEAL_CONTEXT_OPTIONS: Array<{
  value: MealContext;
  label: string;
  icon: string;
}> = [
  { value: 'fasting', label: 'Fasting', icon: 'schedule' },
  { value: 'before_meal', label: 'Before meal', icon: 'restaurant_menu' },
  { value: 'after_meal', label: 'After meal', icon: 'assignment' },
  { value: 'bedtime', label: 'Bedtime', icon: 'alarm' },
  { value: 'random', label: 'Random', icon: 'bloodtype' },
  { value: 'after_exercise', label: 'Post-workout', icon: 'favorite' },
] as const;

const MEAL_TYPE_OPTIONS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const STATUS_META: Record<GlucoseRangeStatus, { label: string; color: string; note: string }> = {
  very_low: {
    label: 'Urgent low',
    color: '#FF453A',
    note: 'Below 54 mg/dL. Treat immediately if symptomatic.',
  },
  low: {
    label: 'Low',
    color: MD_GLUCOSE_STATUS.low,
    note: 'Below the standard target floor.',
  },
  in_range: {
    label: 'In range',
    color: MD_GLUCOSE_STATUS.normal,
    note: 'Inside the 70 to 180 mg/dL clinical band.',
  },
  high: {
    label: 'High',
    color: '#FF8A6B',
    note: 'Above target. Review meal timing and medication response.',
  },
  very_high: {
    label: 'Urgent high',
    color: '#FF453A',
    note: 'Sustained severe hyperglycemia may need rapid follow-up.',
  },
};

function parseDisplayValue(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatContextLabel(value: MealContext | MealType | string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function LogGlucoseScreen() {
  const db = useDatabase();
  const initialUnit = (getSetting(db, 'glucoseUnit') as GlucoseUnit | null) ?? 'mg/dL';
  const [unit, setUnit] = useState<GlucoseUnit>(initialUnit);
  const [valueText, setValueText] = useState('');
  const [mealContext, setMealContext] = useState<MealContext>('before_meal');
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [notes, setNotes] = useState('');
  const nowLabel = useMemo(() => formatTime(new Date().toISOString()), []);

  const parsedValue = parseDisplayValue(valueText);
  const hasValue = parsedValue !== null;
  const normalizedMgDl = useMemo(() => {
    if (parsedValue === null) {
      return null;
    }

    return unit === 'mg/dL' ? parsedValue : convertGlucose(parsedValue, unit, 'mg/dL');
  }, [parsedValue, unit]);

  const rangeStatus = useMemo(() => {
    if (parsedValue === null) {
      return null;
    }

    return classifyGlucose(parsedValue, unit);
  }, [parsedValue, unit]);

  const recentInsulin = useMemo(() => {
    const from = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    return getInsulinEntries(db, { from, limit: 1 })[0] ?? null;
  }, [db]);

  const insulinMedication = useMemo(() => {
    const meds = getActiveMedications(db);
    return meds.find((med) => med.name.toLowerCase().includes('insulin')) ?? null;
  }, [db]);

  const userUsesInsulin = Boolean(recentInsulin || insulinMedication);
  const selectedStatusMeta = rangeStatus ? STATUS_META[rangeStatus] : null;
  const needsMealType = mealContext === 'before_meal' || mealContext === 'after_meal';

  function handleUnitChange(nextUnit: GlucoseUnit) {
    if (nextUnit === unit) {
      return;
    }

    if (parsedValue !== null) {
      const converted = convertGlucose(parsedValue, unit, nextUnit);
      setValueText(nextUnit === 'mg/dL' ? Math.round(converted).toString() : converted.toFixed(1));
    }

    setUnit(nextUnit);
    setSetting(db, 'glucoseUnit', nextUnit);
  }

  function handleSave() {
    if (parsedValue === null) {
      return;
    }

    try {
      const id = `glu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      logGlucoseReading(db, id, {
        value: parsedValue,
        unit,
        mealContext,
        mealType: needsMealType ? mealType ?? undefined : undefined,
        notes: notes.trim() || undefined,
        measuredAt: new Date().toISOString(),
      });

      if ((rangeStatus === 'high' || rangeStatus === 'very_high') && userUsesInsulin) {
        Alert.alert(
          'Glucose logged',
          'This reading is above target. Do you want to jump into insulin logging next?',
          [
            { text: 'Not now', onPress: () => router.back() },
            { text: 'Log insulin', onPress: () => router.replace('/(meds)/log-insulin' as never) },
          ],
        );
        return;
      }

      if (rangeStatus === 'very_low') {
        Alert.alert(
          'Urgent low detected',
          'Treat lows per your care plan and seek help if symptoms are severe.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      router.back();
    } catch (error) {
      Alert.alert(
        'Unable to save reading',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
    >
      <View style={styles.heroGlow} />

      <GlassCard intensity={28} padding={22} style={styles.heroCard}>
        <Text style={styles.eyebrow}>Log Glucose</Text>
        <Text style={styles.heroTitle}>Fast capture for meals, sleep, and recovery.</Text>

        <View style={styles.displayWrap}>
          <TextInput
            keyboardType="decimal-pad"
            maxLength={unit === 'mg/dL' ? 3 : 4}
            onChangeText={setValueText}
            placeholder="0"
            placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.35)}
            style={styles.valueInput}
            value={valueText}
          />
          <View style={styles.unitRow}>
            {(['mg/dL', 'mmol/L'] as GlucoseUnit[]).map((option) => {
              const active = option === unit;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleUnitChange(option)}
                  style={[styles.unitChip, active ? styles.unitChipActive : null]}
                >
                  <Text style={[styles.unitChipText, active ? styles.unitChipTextActive : null]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {hasValue && normalizedMgDl !== null && selectedStatusMeta ? (
          <View style={styles.rangeSection}>
            <GlucoseRange
              context={formatContextLabel(mealContext)}
              unit="mg/dL"
              value={Math.round(normalizedMgDl)}
            />
            <View style={[styles.statusRow, { backgroundColor: withAlpha(selectedStatusMeta.color, 0.12) }]}>
              <View style={[styles.statusDot, { backgroundColor: selectedStatusMeta.color }]} />
              <Text style={styles.statusLabel}>{selectedStatusMeta.label}</Text>
              <Text style={styles.statusNote}>{selectedStatusMeta.note}</Text>
            </View>
          </View>
        ) : null}
      </GlassCard>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Meal Context" />
        <View style={styles.contextGrid}>
          {MEAL_CONTEXT_OPTIONS.map((option) => {
            const active = option.value === mealContext;
            return (
              <Pressable
                key={option.value}
                onPress={() => setMealContext(option.value)}
                style={[
                  styles.contextCard,
                  active ? styles.contextCardActive : null,
                ]}
              >
                <View style={[styles.contextIcon, active ? styles.contextIconActive : null]}>
                  <MaterialSymbol
                    color={active ? '#041317' : MD_ACCENT_LIGHT}
                    filled={active}
                    name={option.icon}
                    size={18}
                  />
                </View>
                <Text style={[styles.contextLabel, active ? styles.contextLabelActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {needsMealType ? (
        <View style={styles.sectionWrap}>
          <SectionHeader title="Meal Type" />
          <View style={styles.pillRow}>
            {MEAL_TYPE_OPTIONS.map((option) => {
              const active = option === mealType;
              return (
                <Pressable
                  key={option}
                  onPress={() => setMealType(active ? null : option)}
                  style={[styles.pill, active ? styles.pillActive : null]}
                >
                  <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>
                    {formatContextLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.sectionWrap}>
        <SectionHeader title="Session Details" />
        <GlassCard intensity={18} padding={18} style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name="schedule" size={18} />
            </View>
            <View style={styles.metaCopy}>
              <Text style={styles.metaLabel}>Entry time</Text>
              <Text style={styles.metaValue}>{nowLabel}</Text>
            </View>
          </View>

          {recentInsulin ? (
            <View style={styles.metaRow}>
              <View style={styles.metaIconWrap}>
                <MaterialSymbol color={MD_ACCENT_LIGHT} name="vaccines" size={18} />
              </View>
              <View style={styles.metaCopy}>
                <Text style={styles.metaLabel}>Recent insulin dose</Text>
                <Text style={styles.metaValue}>
                  {recentInsulin.units} units {formatContextLabel(recentInsulin.insulinType)} insulin
                </Text>
              </View>
            </View>
          ) : null}

          {insulinMedication ? (
            <View style={styles.metaRow}>
              <View style={styles.metaIconWrap}>
                <MaterialSymbol color={MD_ACCENT_LIGHT} name="medication" size={18} />
              </View>
              <View style={styles.metaCopy}>
                <Text style={styles.metaLabel}>Insulin therapy on file</Text>
                <Text style={styles.metaValue}>{insulinMedication.name}</Text>
              </View>
            </View>
          ) : null}
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Clinical Notes" />
        <GlassCard intensity={16} padding={14}>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Symptoms, meal response, exercise, or how this reading feels."
            placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.5)}
            style={styles.notesInput}
            textAlignVertical="top"
            value={notes}
          />
        </GlassCard>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!hasValue}
        onPress={handleSave}
        style={({ pressed }) => [
          styles.savePressable,
          !hasValue ? styles.saveDisabled : null,
          pressed && hasValue ? styles.savePressed : null,
        ]}
      >
        <LinearGradient
          colors={[MD_ACCENT_LIGHT, MD_ACCENT]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.saveButton}
        >
          <Text style={styles.saveButtonText}>Log Glucose Level</Text>
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
    padding: 20,
    paddingBottom: 120,
    gap: 20,
  },
  heroGlow: {
    position: 'absolute',
    top: 28,
    right: -12,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.12),
    opacity: 0.7,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_SURFACES.lowest, 0.7),
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
  displayWrap: {
    alignItems: 'center',
    gap: 14,
  },
  valueInput: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 72,
    fontVariant: ['tabular-nums'],
    lineHeight: 78,
    minWidth: 180,
    textAlign: 'center',
  },
  unitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  unitChip: {
    backgroundColor: withAlpha(MD_TEXT_SECONDARY, 0.08),
    borderRadius: MD_CARD_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unitChipActive: {
    backgroundColor: MD_ACCENT,
  },
  unitChipText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  unitChipTextActive: {
    color: '#041317',
  },
  rangeSection: {
    gap: 14,
  },
  statusRow: {
    borderRadius: 18,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  statusNote: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  sectionWrap: {
    gap: 14,
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  contextCard: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 22,
    gap: 10,
    minWidth: '30%',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  contextCardActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.92),
    transform: [{ scale: 1.02 }],
  },
  contextIcon: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  contextIconActive: {
    backgroundColor: withAlpha('#FFFFFF', 0.72),
  },
  contextLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  contextLabelActive: {
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
    backgroundColor: withAlpha(MD_ACCENT, 0.9),
  },
  pillText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  pillTextActive: {
    color: '#041317',
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
  notesInput: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
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
    fontFamily: MD_FONTS.bold,
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: '#031014',
  },
});
