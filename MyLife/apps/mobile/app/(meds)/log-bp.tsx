import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  classifyBP,
  getWellnessScore,
  logBPReading,
  validateBP,
  type BPArm,
  type BPCategory,
  type BPContext,
  type BPPosition,
} from '@mylife/meds';
import {
  BPClassification,
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_GLOW,
  MD_ACCENT_LIGHT,
  MD_BP_STATUS,
  MD_CARD_RADIUS,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import {
  BP_CATEGORY_COLORS,
  BP_CATEGORY_LABELS,
  formatBPDateTime,
} from '../../lib/meds/phase3';
import { uuid } from '../../lib/uuid';
import { useDatabase } from '../../components/DatabaseProvider';

const ARMS: Array<{ value: BPArm; label: string }> = [
  { value: 'left', label: 'Left Arm' },
  { value: 'right', label: 'Right Arm' },
];

const POSITIONS: Array<{ value: BPPosition; label: string; icon: string }> = [
  { value: 'sitting', label: 'Sitting', icon: 'event_seat' },
  { value: 'standing', label: 'Standing', icon: 'accessibility_new' },
  { value: 'lying', label: 'Lying', icon: 'bed' },
];

const CONTEXTS: Array<{ value: BPContext; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'after_medication', label: 'After Med' },
  { value: 'after_exercise', label: 'After Exercise' },
  { value: 'routine', label: 'Routine' },
];

interface CaregiverAlertTarget {
  caregiverId: string;
  caregiverName: string;
  method: 'sms' | 'email' | 'both';
}

function ChoicePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choicePill,
        selected && styles.choicePillActive,
      ]}
    >
      <Text style={[styles.choicePillText, selected && styles.choicePillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DeviceSnapshot({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.snapshotCard}>
      <View style={styles.snapshotIconWrap}>
        <MaterialSymbol color={MD_ACCENT_LIGHT} name={icon} size={18} />
      </View>
      <View style={styles.snapshotCopy}>
        <Text style={styles.snapshotLabel}>{label}</Text>
        <Text style={styles.snapshotValue}>{value}</Text>
      </View>
      {onPress ? (
        <MaterialSymbol color={MD_TEXT_TERTIARY} name="schedule" size={18} />
      ) : null}
    </Pressable>
  );
}

function getCaregiverAlertTargets(
  db: ReturnType<typeof useDatabase>,
): CaregiverAlertTarget[] {
  const caregivers = db.query<{
    id: string;
    name: string;
  }>(
    'SELECT id, name FROM md_caregivers WHERE is_active = 1 ORDER BY created_at ASC',
  );

  const configs = db.query<{
    caregiver_id: string;
    alert_method: 'sms' | 'email' | 'both';
  }>(
    'SELECT caregiver_id, alert_method FROM md_caregiver_alert_config WHERE is_active = 1 ORDER BY created_at ASC',
  );

  const configMap = new Map<string, 'sms' | 'email' | 'both'>();
  configs.forEach((config) => {
    if (!configMap.has(config.caregiver_id)) {
      configMap.set(config.caregiver_id, config.alert_method);
    }
  });

  return caregivers.map((caregiver) => ({
    caregiverId: caregiver.id,
    caregiverName: caregiver.name,
    method: configMap.get(caregiver.id) ?? 'sms',
  }));
}

function queueCrisisCaregiverAlerts(
  db: ReturnType<typeof useDatabase>,
  reading: { systolic: number; diastolic: number; measuredAt: string },
) {
  const now = new Date().toISOString();
  const targets = getCaregiverAlertTargets(db);

  targets.forEach((target) => {
    const methods = target.method === 'both' ? ['sms', 'email'] as const : [target.method];

    methods.forEach((method) => {
      db.execute(
        `INSERT INTO md_caregiver_alerts (
          id,
          caregiver_id,
          medication_id,
          alert_type,
          message,
          sent_at,
          delivery_method,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          target.caregiverId,
          null,
          'custom',
          `Critical blood pressure reading ${reading.systolic}/${reading.diastolic} recorded at ${formatBPDateTime(reading.measuredAt)}.`,
          now,
          method,
          'pending',
          now,
        ],
      );
    });
  });

  return targets.length;
}

export default function LogBPScreen() {
  const db = useDatabase();
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [arm, setArm] = useState<BPArm>('left');
  const [position, setPosition] = useState<BPPosition>('sitting');
  const [context, setContext] = useState<BPContext>('routine');
  const [notes, setNotes] = useState('');
  const [capturedAt, setCapturedAt] = useState(() => new Date());
  const [caregiverAlertEnabled, setCaregiverAlertEnabled] = useState(false);

  const previousCategory = useRef<BPCategory | null>(null);

  const sys = Number.parseInt(systolic, 10);
  const dia = Number.parseInt(diastolic, 10);
  const hasBoth = Number.isFinite(sys) && Number.isFinite(dia) && sys > 0 && dia > 0;
  const category = useMemo(
    () => (hasBoth ? classifyBP(sys, dia) : null),
    [dia, hasBoth, sys],
  );

  useEffect(() => {
    if (!category || previousCategory.current === category) {
      return;
    }

    if (category === 'crisis') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setCaregiverAlertEnabled(true);
    } else {
      void Haptics.selectionAsync();
      if (previousCategory.current === 'crisis') {
        setCaregiverAlertEnabled(false);
      }
    }

    previousCategory.current = category;
  }, [category]);

  const handleSave = useCallback(() => {
    if (!hasBoth || !category) {
      return;
    }

    const validation = validateBP(sys, dia);
    if (!validation.valid) {
      Alert.alert('Invalid reading', validation.error);
      return;
    }

    try {
      const measuredAt = capturedAt.toISOString();
      const reading = logBPReading(db, uuid(), {
        systolic: sys,
        diastolic: dia,
        pulse: pulse ? Number.parseInt(pulse, 10) : undefined,
        arm,
        position,
        context,
        notes: notes.trim() || undefined,
        measuredAt,
      });

      let queuedAlertCount = 0;
      if (category === 'crisis' && caregiverAlertEnabled) {
        queuedAlertCount = queueCrisisCaregiverAlerts(db, {
          systolic: reading.systolic,
          diastolic: reading.diastolic,
          measuredAt: reading.measuredAt,
        });
      }

      const wellness = getWellnessScore(db);
      const wellnessCopy = wellness
        ? `Wellness now reads ${wellness.composite}/100.`
        : 'Wellness will refresh the next time you open the dashboard.';

      if (category === 'crisis') {
        const alertCopy = caregiverAlertEnabled
          ? queuedAlertCount > 0
            ? `${queuedAlertCount} caregiver alert${queuedAlertCount === 1 ? '' : 's'} queued for follow-up.`
            : 'No active caregiver contacts are configured yet, so no alerts were queued.'
          : 'Caregiver follow-up was left off for this entry.';

        Alert.alert(
          'Crisis reading saved',
          `${reading.systolic}/${reading.diastolic} is in the crisis range. ${alertCopy} ${wellnessCopy}`,
          [
            {
              text: 'Review Caregivers',
              onPress: () => router.replace('/(meds)/caregivers'),
            },
            {
              text: 'Done',
              style: 'default',
              onPress: () => router.back(),
            },
          ],
        );
        return;
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save reading.';
      Alert.alert('Save failed', message);
    }
  }, [
    arm,
    capturedAt,
    caregiverAlertEnabled,
    category,
    context,
    db,
    dia,
    hasBoth,
    notes,
    position,
    pulse,
    sys,
  ]);

  const categoryMeta = category
    ? {
        label: BP_CATEGORY_LABELS[category],
        color: BP_CATEGORY_COLORS[category],
      }
    : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Clinical Entry</Text>
        <Text style={styles.title}>Log Blood Pressure</Text>
        <Text style={styles.subtitle}>
          Capture a precise blood-pressure reading with context, pulse, and urgent follow-up.
        </Text>
      </View>

      <View style={styles.snapshotRow}>
        <DeviceSnapshot
          icon="schedule"
          label="Captured"
          onPress={() => setCapturedAt(new Date())}
          value={formatBPDateTime(capturedAt.toISOString())}
        />
        <DeviceSnapshot
          icon="monitor_heart"
          label="Source"
          value="Manual cuff"
        />
      </View>

      <GlassCard style={styles.readingCard}>
        <Text style={styles.sectionLabel}>Blood Pressure</Text>
        <View style={styles.readingGrid}>
          <View style={styles.readingBlock}>
            <Text style={styles.readingBlockLabel}>Systolic</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setSystolic}
              placeholder="120"
              placeholderTextColor={withAlpha(MD_TEXT, 0.2)}
              selectionColor={MD_ACCENT}
              style={styles.bigInput}
              value={systolic}
            />
            <Text style={styles.readingUnit}>mmHg</Text>
          </View>

          <Text style={styles.slash}>/</Text>

          <View style={styles.readingBlock}>
            <Text style={styles.readingBlockLabel}>Diastolic</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setDiastolic}
              placeholder="80"
              placeholderTextColor={withAlpha(MD_TEXT, 0.2)}
              selectionColor={MD_ACCENT}
              style={styles.bigInput}
              value={diastolic}
            />
            <Text style={styles.readingUnit}>mmHg</Text>
          </View>
        </View>

        <View style={styles.classificationWrap}>
          {category ? (
            <View style={styles.classificationPill}>
              <BPClassification diastolic={dia} systolic={sys} />
              <Text style={[styles.classificationCopy, { color: categoryMeta?.color ?? MD_ACCENT_LIGHT }]}>
                {categoryMeta?.label}
              </Text>
            </View>
          ) : (
            <Text style={styles.classificationHint}>
              Enter both values to classify the reading automatically.
            </Text>
          )}
        </View>
      </GlassCard>

      <GlassCard style={styles.pulseCard}>
        <View style={styles.pulseHeader}>
          <View>
            <Text style={styles.sectionLabel}>Pulse Rate</Text>
            <Text style={styles.pulseSupport}>Optional heart-rate context for the same entry.</Text>
          </View>
          <View style={styles.pulseIconWrap}>
            <MaterialSymbol color={MD_ACCENT} filled name="favorite" size={30} />
          </View>
        </View>
        <View style={styles.pulseRow}>
          <TextInput
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={setPulse}
            placeholder="72"
            placeholderTextColor={withAlpha(MD_TEXT, 0.2)}
            selectionColor={MD_ACCENT}
            style={styles.pulseInput}
            value={pulse}
          />
          <Text style={styles.pulseUnit}>bpm</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.selectorCard}>
        <Text style={styles.sectionLabel}>Arm</Text>
        <View style={styles.pillRow}>
          {ARMS.map((option) => (
            <ChoicePill
              key={option.value}
              label={option.label}
              onPress={() => setArm(option.value)}
              selected={arm === option.value}
            />
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Position</Text>
        <View style={styles.positionGrid}>
          {POSITIONS.map((option) => {
            const selected = position === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPosition(option.value)}
                style={[styles.positionCard, selected && styles.positionCardActive]}
              >
                <MaterialSymbol
                  color={selected ? MD_ACCENT_LIGHT : MD_TEXT_TERTIARY}
                  name={option.icon}
                  size={22}
                />
                <Text style={[styles.positionLabel, selected && styles.positionLabelActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Context</Text>
        <View style={styles.pillRow}>
          {CONTEXTS.map((option) => (
            <ChoicePill
              key={option.value}
              label={option.label}
              onPress={() => setContext(option.value)}
              selected={context === option.value}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.notesCard}>
        <Text style={styles.sectionLabel}>Additional Notes</Text>
        <TextInput
          multiline
          onChangeText={setNotes}
          placeholder="Feeling stressed, dehydrated, post-workout, or just after coffee?"
          placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.8)}
          selectionColor={MD_ACCENT}
          style={styles.notesInput}
          value={notes}
        />
      </GlassCard>

      {category === 'crisis' ? (
        <GlassCard style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <View style={styles.warningIconWrap}>
              <MaterialSymbol color={MD_BP_STATUS.crisis} filled name="warning" size={22} />
            </View>
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Crisis range detected</Text>
              <Text style={styles.warningBody}>
                This reading should be reviewed immediately. Queue caregiver follow-up and seek urgent care if symptoms are present.
              </Text>
            </View>
          </View>

          <View style={styles.warningToggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Queue caregiver alert</Text>
              <Text style={styles.toggleBody}>
                Save a pending caregiver alert record for each active caregiver contact.
              </Text>
            </View>
            <Switch
              onValueChange={setCaregiverAlertEnabled}
              thumbColor={caregiverAlertEnabled ? MD_ACCENT_LIGHT : '#f4f3f4'}
              trackColor={{ false: withAlpha(MD_TEXT_TERTIARY, 0.32), true: withAlpha(MD_ACCENT, 0.44) }}
              value={caregiverAlertEnabled}
            />
          </View>
        </GlassCard>
      ) : null}

      <Pressable
        disabled={!hasBoth}
        onPress={handleSave}
        style={({ pressed }) => [
          styles.saveButton,
          !hasBoth && styles.saveButtonDisabled,
          pressed && hasBoth && styles.saveButtonPressed,
        ]}
      >
        <Text style={styles.saveButtonText}>Save Reading</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 16,
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  title: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: MD_TEXT,
  },
  subtitle: {
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: MD_TEXT_SECONDARY,
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: 12,
  },
  snapshotCard: {
    flex: 1,
    minHeight: 84,
    borderRadius: MD_CARD_RADIUS,
    backgroundColor: MD_SURFACES.low,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  snapshotIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapshotCopy: {
    flex: 1,
    gap: 2,
  },
  snapshotLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  snapshotValue: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: MD_TEXT,
  },
  readingCard: {
    gap: 20,
    backgroundColor: MD_SURFACES.low,
  },
  sectionLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  readingGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  readingBlock: {
    flex: 1,
    backgroundColor: withAlpha(MD_ACCENT, 0.06),
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  readingBlockLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  bigInput: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -1.2,
    color: MD_TEXT,
    textAlign: 'center',
    minWidth: 110,
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  readingUnit: {
    fontFamily: MD_FONTS.medium,
    fontSize: 11,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: MD_TEXT_TERTIARY,
  },
  slash: {
    fontFamily: MD_FONTS.regular,
    fontSize: 48,
    lineHeight: 54,
    color: withAlpha(MD_TEXT, 0.25),
  },
  classificationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  classificationPill: {
    alignItems: 'center',
    gap: 10,
  },
  classificationCopy: {
    fontFamily: MD_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  classificationHint: {
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_TERTIARY,
  },
  pulseCard: {
    backgroundColor: MD_SURFACES.low,
    gap: 18,
  },
  pulseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pulseSupport: {
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
    marginTop: 4,
  },
  pulseIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  pulseInput: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: MD_TEXT,
    fontVariant: ['tabular-nums'],
    minWidth: 110,
    paddingVertical: 0,
  },
  pulseUnit: {
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  selectorCard: {
    backgroundColor: MD_SURFACES.low,
  },
  sectionSpacing: {
    marginTop: 20,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: MD_SURFACES.mid,
  },
  choicePillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
    shadowColor: MD_ACCENT,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  choicePillText: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
  },
  choicePillTextActive: {
    color: MD_ACCENT_LIGHT,
  },
  positionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  positionCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    backgroundColor: MD_SURFACES.mid,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
  },
  positionCardActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
  },
  positionLabel: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
  },
  positionLabelActive: {
    color: MD_TEXT,
  },
  notesCard: {
    backgroundColor: MD_SURFACES.low,
    gap: 12,
  },
  notesInput: {
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: MD_TEXT,
    minHeight: 108,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  warningCard: {
    backgroundColor: withAlpha(MD_BP_STATUS.crisis, 0.12),
    gap: 18,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  warningIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: withAlpha(MD_BP_STATUS.crisis, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCopy: {
    flex: 1,
    gap: 6,
  },
  warningTitle: {
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: MD_TEXT,
  },
  warningBody: {
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: MD_TEXT_SECONDARY,
  },
  warningToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  toggleTitle: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: MD_TEXT,
  },
  toggleBody: {
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: MD_TEXT_SECONDARY,
    marginTop: 3,
    maxWidth: 240,
  },
  saveButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: MD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MD_ACCENT_GLOW,
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.38,
  },
  saveButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  saveButtonText: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: '#001F2A',
  },
});
