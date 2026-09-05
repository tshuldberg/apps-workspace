import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import {
  checkInteractions,
  createMedicationExtended,
  createRemindersForMedication,
  getActiveMedications,
  recordRefill,
  type MedFrequency,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CYAN_GLOW_STYLE,
  MD_FONTS,
  MD_PILL_RADIUS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildTimeSlots,
  FORM_OPTIONS,
  FREQUENCY_PRESETS,
  getAutocompleteSuggestions,
  REMINDER_OFFSETS,
  REMINDER_SOUNDS,
  ROUTE_OPTIONS,
  SNOOZE_OPTIONS,
  WIZARD_STEPS,
  type FrequencyPresetKey,
} from '../../lib/meds/phase2';
import { uuid } from '../../lib/uuid';

type ToggleCardProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
};

function ToggleCard({ label, selected, onPress, compact = false }: ToggleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggleCard,
        compact ? styles.toggleCardCompact : null,
        selected ? styles.toggleCardSelected : null,
      ]}
    >
      <Text style={[styles.toggleCardText, selected ? styles.toggleCardTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MD_TEXT_TERTIARY}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
      />
    </View>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillLabel}>{label}</Text>
      <Text style={styles.metaPillValue}>{value}</Text>
    </View>
  );
}

export default function AddMedScreen() {
  const db = useDatabase();
  const router = useRouter();
  const navigation = useNavigation();
  const allowNavigationRef = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);

  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState<(typeof FORM_OPTIONS)[number]>('Tablet');
  const [routeName, setRouteName] = useState<(typeof ROUTE_OPTIONS)[number]>('Oral');
  const [condition, setCondition] = useState('');
  const [prescriber, setPrescriber] = useState('');
  const [pharmacy, setPharmacy] = useState('');

  const [frequencyPreset, setFrequencyPreset] = useState<FrequencyPresetKey>('once_daily');
  const [intervalHours, setIntervalHours] = useState('4');
  const [pillsPerDose, setPillsPerDose] = useState('1');
  const [timeSlots, setTimeSlots] = useState<string[]>(['08:00']);
  const [withFood, setWithFood] = useState(false);
  const [emptyStomach, setEmptyStomach] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderOffset, setReminderOffset] = useState(REMINDER_OFFSETS[1]);
  const [reminderSound, setReminderSound] = useState(REMINDER_SOUNDS[1]);
  const [snoozeDuration, setSnoozeDuration] = useState(SNOOZE_OPTIONS[2]);
  const [locationReminder, setLocationReminder] = useState(false);

  const [refillEnabled, setRefillEnabled] = useState(true);
  const [quantityPerFill, setQuantityPerFill] = useState('30');
  const [daysSupply, setDaysSupply] = useState('30');
  const [refillThreshold, setRefillThreshold] = useState('7');

  const [interactionAcknowledged, setInteractionAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () =>
      Boolean(
        name.trim() ||
          strength.trim() ||
          condition.trim() ||
          prescriber.trim() ||
          pharmacy.trim() ||
          startDate.trim() ||
          endDate.trim() ||
          frequencyPreset !== 'once_daily' ||
          intervalHours !== '4' ||
          pillsPerDose !== '1' ||
          withFood ||
          emptyStomach ||
          !remindersEnabled ||
          reminderOffset !== REMINDER_OFFSETS[1] ||
          reminderSound !== REMINDER_SOUNDS[1] ||
          snoozeDuration !== SNOOZE_OPTIONS[2] ||
          locationReminder ||
          !refillEnabled ||
          quantityPerFill !== '30' ||
          daysSupply !== '30' ||
          refillThreshold !== '7'
      ),
    [
      condition,
      daysSupply,
      emptyStomach,
      endDate,
      frequencyPreset,
      intervalHours,
      locationReminder,
      name,
      pharmacy,
      pillsPerDose,
      prescriber,
      quantityPerFill,
      refillEnabled,
      refillThreshold,
      reminderOffset,
      reminderSound,
      remindersEnabled,
      snoozeDuration,
      startDate,
      strength,
      withFood,
    ],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isDirty || allowNavigationRef.current) {
        return;
      }

      event.preventDefault();
      Alert.alert(
        'Discard medication setup?',
        'Your medication wizard has unsaved changes.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              allowNavigationRef.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [isDirty, navigation]);

  useEffect(() => {
    setTimeSlots((current) =>
      buildTimeSlots(
        frequencyPreset,
        Number.parseInt(intervalHours, 10) || 4,
        current,
      ),
    );
  }, [frequencyPreset, intervalHours]);

  const activeMedicationNames = useMemo(() => {
    try {
      return getActiveMedications(db)
        .map((medication) => medication.name)
        .filter((medication) => medication.toLowerCase() !== name.trim().toLowerCase());
    } catch {
      return [];
    }
  }, [db, name]);

  const interactionWarnings = useMemo(() => {
    if (!name.trim()) {
      return [];
    }

    try {
      return checkInteractions(db, name.trim(), activeMedicationNames);
    } catch {
      return [];
    }
  }, [activeMedicationNames, db, name]);

  const suggestions = useMemo(
    () => getAutocompleteSuggestions(name, name.trim() || undefined),
    [name],
  );

  const stepConfig = WIZARD_STEPS[stepIndex];

  const canAdvance = useMemo(() => {
    if (stepIndex === 0) {
      return Boolean(name.trim());
    }

    if (stepIndex === 1) {
      if (frequencyPreset === 'as_needed') {
        return true;
      }

      const validSlots = timeSlots.every((slot) => /^\d{2}:\d{2}$/.test(slot.trim()));
      return validSlots && Number.parseInt(pillsPerDose, 10) > 0;
    }

    if (stepIndex === 3 && refillEnabled) {
      return Number.parseInt(quantityPerFill, 10) > 0;
    }

    if (stepIndex === 4 && interactionWarnings.length > 0) {
      return interactionAcknowledged;
    }

    return true;
  }, [
    frequencyPreset,
    interactionAcknowledged,
    interactionWarnings.length,
    name,
    pillsPerDose,
    quantityPerFill,
    refillEnabled,
    stepIndex,
    timeSlots,
  ]);

  const medFrequency = FREQUENCY_PRESETS[frequencyPreset].medFrequency as MedFrequency;

  const summaryNotes = useMemo(() => {
    const lines = [
      condition.trim() ? `Reason: ${condition.trim()}` : null,
      `Route: ${routeName}`,
      withFood ? 'Take with food' : null,
      emptyStomach ? 'Take on an empty stomach' : null,
      startDate.trim() ? `Start date: ${startDate.trim()}` : null,
      endDate.trim() ? `End date: ${endDate.trim()}` : null,
      frequencyPreset === 'every_x_hours'
        ? `Interval schedule: every ${intervalHours || '4'} hours`
        : null,
      remindersEnabled
        ? `Reminder: ${reminderOffset}, ${reminderSound}, snooze ${snoozeDuration}${locationReminder ? ', location-aware' : ''}`
        : 'Reminders disabled',
      refillEnabled
        ? `Refills: ${quantityPerFill || '0'} per fill, ${daysSupply || '?'} day supply, remind at ${refillThreshold || '?'} days`
        : 'Refill tracking disabled',
      interactionWarnings.length > 0
        ? `Interaction review acknowledged for ${interactionWarnings.length} warning${interactionWarnings.length === 1 ? '' : 's'}`
        : null,
    ].filter(Boolean);

    return lines.join('\n');
  }, [
    condition,
    daysSupply,
    emptyStomach,
    endDate,
    frequencyPreset,
    interactionWarnings.length,
    intervalHours,
    locationReminder,
    quantityPerFill,
    refillEnabled,
    refillThreshold,
    reminderOffset,
    reminderSound,
    remindersEnabled,
    routeName,
    snoozeDuration,
    startDate,
    withFood,
  ]);

  const closeWizard = () => {
    if (!isDirty) {
      allowNavigationRef.current = true;
      router.back();
      return;
    }

    Alert.alert(
      'Discard medication setup?',
      'Your medication wizard has unsaved changes.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            allowNavigationRef.current = true;
            router.back();
          },
        },
      ],
    );
  };

  const handleSave = () => {
    if (saving) {
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Medication name required', 'Choose a medication before saving.');
      return;
    }

    setSaving(true);

    try {
      const medicationId = uuid();
      const normalizedSlots = buildTimeSlots(
        frequencyPreset,
        Number.parseInt(intervalHours, 10) || 4,
        timeSlots,
      ).map((slot) => slot.trim());
      const parsedPillsPerDose = Math.max(1, Number.parseInt(pillsPerDose, 10) || 1);

      createMedicationExtended(db, medicationId, {
        name: cleanName,
        dosage: strength.trim() || undefined,
        unit: form,
        frequency: medFrequency,
        instructions: summaryNotes || undefined,
        prescriber: prescriber.trim() || undefined,
        pharmacy: pharmacy.trim() || undefined,
        pillsPerDose: parsedPillsPerDose,
        timeSlots: normalizedSlots,
        endDate: endDate.trim() || undefined,
        notes: summaryNotes || undefined,
      });

      if (remindersEnabled && normalizedSlots.length > 0 && medFrequency !== 'as_needed') {
        createRemindersForMedication(db, medicationId, uuid);
      }

      if (refillEnabled && Number.parseInt(quantityPerFill, 10) > 0) {
        recordRefill(db, uuid(), {
          medicationId,
          quantity: Number.parseInt(quantityPerFill, 10),
          refillDate: startDate.trim() || undefined,
          pharmacy: pharmacy.trim() || undefined,
          notes: `Initial fill • ${daysSupply || '30'} day supply`,
        });
      }

      allowNavigationRef.current = true;
      router.back();
    } catch (error) {
      Alert.alert(
        'Unable to save medication',
        error instanceof Error ? error.message : 'Please try again.',
      );
      setSaving(false);
    }
  };

  const updateTimeSlot = (index: number, value: string) => {
    setTimeSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? value : slot)),
    );
  };

  const renderDrugStep = () => (
    <>
      <GlassCard style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Step 1</Text>
        <Text style={styles.heroTitle}>What medication?</Text>
        <Text style={styles.heroBody}>
          Start with the drug, then layer in the clinical details that matter for adherence and refills.
        </Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.searchField}>
          <MaterialSymbol name="search" size={18} color={MD_TEXT_TERTIARY} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Start typing a medication name..."
            placeholderTextColor={MD_TEXT_TERTIARY}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.suggestionRow}>
          {suggestions.map((suggestion) => (
            <ToggleCard
              key={suggestion}
              label={suggestion}
              compact
              selected={suggestion.toLowerCase() === name.trim().toLowerCase()}
              onPress={() => setName(suggestion)}
            />
          ))}
        </View>
      </GlassCard>

      <View style={styles.twoColumnGrid}>
        <GlassCard style={styles.sectionCard}>
          <Field
            label="Strength"
            value={strength}
            onChangeText={setStrength}
            placeholder="10 mg"
          />
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.fieldLabel}>Form</Text>
          <View style={styles.toggleWrap}>
            {FORM_OPTIONS.map((option) => (
              <ToggleCard
                key={option}
                label={option}
                compact
                selected={option === form}
                onPress={() => setForm(option)}
              />
            ))}
          </View>
        </GlassCard>
      </View>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.fieldLabel}>Route</Text>
        <View style={styles.toggleWrap}>
          {ROUTE_OPTIONS.map((option) => (
            <ToggleCard
              key={option}
              label={option}
              compact
              selected={option === routeName}
              onPress={() => setRouteName(option)}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Field
          label="Condition / reason"
          value={condition}
          onChangeText={setCondition}
          placeholder="Hypertension, cholesterol, blood sugar..."
        />
        <View style={styles.twoColumnGrid}>
          <Field
            label="Prescriber"
            value={prescriber}
            onChangeText={setPrescriber}
            placeholder="Dr. Smith"
          />
          <Field
            label="Pharmacy"
            value={pharmacy}
            onChangeText={setPharmacy}
            placeholder="CVS West 42nd"
          />
        </View>
      </GlassCard>
    </>
  );

  const renderScheduleStep = () => (
    <>
      <GlassCard style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Step 2</Text>
        <Text style={styles.heroTitle}>Build the schedule</Text>
        <Text style={styles.heroBody}>
          Choose the cadence, review reminder times, and capture how each dose fits into the day.
        </Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.fieldLabel}>Frequency</Text>
        <View style={styles.frequencyGrid}>
          {Object.entries(FREQUENCY_PRESETS).map(([key, preset]) => (
            <ToggleCard
              key={key}
              label={preset.label}
              selected={frequencyPreset === key}
              onPress={() => setFrequencyPreset(key as FrequencyPresetKey)}
            />
          ))}
        </View>
      </GlassCard>

      {frequencyPreset === 'every_x_hours' ? (
        <GlassCard style={styles.sectionCard}>
          <Field
            label="Interval hours"
            value={intervalHours}
            onChangeText={setIntervalHours}
            placeholder="4"
            keyboardType="numeric"
          />
        </GlassCard>
      ) : null}

      {FREQUENCY_PRESETS[frequencyPreset].slots > 0 ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.fieldLabel}>Dose times</Text>
          <View style={styles.timeList}>
            {timeSlots.map((slot, index) => (
              <View key={`${frequencyPreset}-${index}`} style={styles.timeRow}>
                <View style={styles.timeIcon}>
                  <MaterialSymbol name="schedule" size={16} color={MD_ACCENT_LIGHT} />
                </View>
                <TextInput
                  value={slot}
                  onChangeText={(value) => updateTimeSlot(index, value)}
                  placeholder="08:00"
                  placeholderTextColor={MD_TEXT_TERTIARY}
                  style={styles.timeInput}
                />
              </View>
            ))}
          </View>
          <Field
            label="Units per dose"
            value={pillsPerDose}
            onChangeText={setPillsPerDose}
            placeholder="1"
            keyboardType="numeric"
          />
        </GlassCard>
      ) : null}

      <GlassCard style={styles.sectionCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Take with food</Text>
            <Text style={styles.switchBody}>Flag this dose as part of a meal routine.</Text>
          </View>
          <Switch
            value={withFood}
            onValueChange={(value) => {
              setWithFood(value);
              if (value) {
                setEmptyStomach(false);
              }
            }}
            thumbColor={withFood ? MD_ACCENT : '#FFFFFF'}
            trackColor={{ false: withAlpha('#FFFFFF', 0.18), true: withAlpha(MD_ACCENT, 0.4) }}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Empty stomach</Text>
            <Text style={styles.switchBody}>Use when timing before food matters.</Text>
          </View>
          <Switch
            value={emptyStomach}
            onValueChange={(value) => {
              setEmptyStomach(value);
              if (value) {
                setWithFood(false);
              }
            }}
            thumbColor={emptyStomach ? MD_ACCENT : '#FFFFFF'}
            trackColor={{ false: withAlpha('#FFFFFF', 0.18), true: withAlpha(MD_ACCENT, 0.4) }}
          />
        </View>
      </GlassCard>

      <View style={styles.twoColumnGrid}>
        <GlassCard style={styles.sectionCard}>
          <Field
            label="Start date"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-04-07"
          />
        </GlassCard>
        <GlassCard style={styles.sectionCard}>
          <Field
            label="End date"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="Optional"
          />
        </GlassCard>
      </View>
    </>
  );

  const renderReminderStep = () => (
    <>
      <GlassCard style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Step 3</Text>
        <Text style={styles.heroTitle}>Reminder controls</Text>
        <Text style={styles.heroBody}>
          Turn reminders on, then tune the offset, sound, and snooze behavior for this medication.
        </Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Enable reminders</Text>
            <Text style={styles.switchBody}>MyMeds will schedule reminders from your saved time slots.</Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            thumbColor={remindersEnabled ? MD_ACCENT : '#FFFFFF'}
            trackColor={{ false: withAlpha('#FFFFFF', 0.18), true: withAlpha(MD_ACCENT, 0.4) }}
          />
        </View>
      </GlassCard>

      {remindersEnabled ? (
        <>
          <GlassCard style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Reminder offset</Text>
            <View style={styles.toggleWrap}>
              {REMINDER_OFFSETS.map((option) => (
                <ToggleCard
                  key={option}
                  label={option}
                  compact
                  selected={option === reminderOffset}
                  onPress={() => setReminderOffset(option)}
                />
              ))}
            </View>
          </GlassCard>

          <GlassCard style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Notification sound</Text>
            <View style={styles.toggleWrap}>
              {REMINDER_SOUNDS.map((option) => (
                <ToggleCard
                  key={option}
                  label={option}
                  compact
                  selected={option === reminderSound}
                  onPress={() => setReminderSound(option)}
                />
              ))}
            </View>
          </GlassCard>

          <GlassCard style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>Snooze duration</Text>
            <View style={styles.toggleWrap}>
              {SNOOZE_OPTIONS.map((option) => (
                <ToggleCard
                  key={option}
                  label={option}
                  compact
                  selected={option === snoozeDuration}
                  onPress={() => setSnoozeDuration(option)}
                />
              ))}
            </View>
          </GlassCard>

          <GlassCard style={styles.sectionCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>Location-aware reminders</Text>
                <Text style={styles.switchBody}>Save a clinical note that this medication depends on place or routine.</Text>
              </View>
              <Switch
                value={locationReminder}
                onValueChange={setLocationReminder}
                thumbColor={locationReminder ? MD_ACCENT : '#FFFFFF'}
                trackColor={{ false: withAlpha('#FFFFFF', 0.18), true: withAlpha(MD_ACCENT, 0.4) }}
              />
            </View>
          </GlassCard>
        </>
      ) : null}
    </>
  );

  const renderRefillStep = () => (
    <>
      <GlassCard style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Step 4</Text>
        <Text style={styles.heroTitle}>Refill readiness</Text>
        <Text style={styles.heroBody}>
          Add the fill quantity and threshold so the refill tracker can predict when you are running low.
        </Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Track refills</Text>
            <Text style={styles.switchBody}>Create an initial fill history entry when you save this medication.</Text>
          </View>
          <Switch
            value={refillEnabled}
            onValueChange={setRefillEnabled}
            thumbColor={refillEnabled ? MD_ACCENT : '#FFFFFF'}
            trackColor={{ false: withAlpha('#FFFFFF', 0.18), true: withAlpha(MD_ACCENT, 0.4) }}
          />
        </View>
      </GlassCard>

      {refillEnabled ? (
        <>
          <View style={styles.twoColumnGrid}>
            <GlassCard style={styles.sectionCard}>
              <Field
                label="Quantity per fill"
                value={quantityPerFill}
                onChangeText={setQuantityPerFill}
                placeholder="30"
                keyboardType="numeric"
              />
            </GlassCard>
            <GlassCard style={styles.sectionCard}>
              <Field
                label="Days supply"
                value={daysSupply}
                onChangeText={setDaysSupply}
                placeholder="30"
                keyboardType="numeric"
              />
            </GlassCard>
          </View>

          <View style={styles.twoColumnGrid}>
            <GlassCard style={styles.sectionCard}>
              <Field
                label="Refill threshold"
                value={refillThreshold}
                onChangeText={setRefillThreshold}
                placeholder="7"
                keyboardType="numeric"
              />
            </GlassCard>
            <GlassCard style={styles.sectionCard}>
              <Field
                label="Pharmacy contact"
                value={pharmacy}
                onChangeText={setPharmacy}
                placeholder="Store name or phone"
              />
            </GlassCard>
          </View>
        </>
      ) : null}
    </>
  );

  const renderInteractionsStep = () => (
    <>
      <GlassCard style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Step 5</Text>
        <Text style={styles.heroTitle}>Interaction review</Text>
        <Text style={styles.heroBody}>
          MyMeds checks the new medication against everything already active on the device before it saves.
        </Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.metaRow}>
          <MetaPill label="Current meds" value={String(activeMedicationNames.length)} />
          <MetaPill label="Warnings" value={String(interactionWarnings.length)} />
        </View>

        {interactionWarnings.length === 0 ? (
          <View style={styles.safeState}>
            <View style={styles.safeIcon}>
              <MaterialSymbol name="check_circle" size={20} color="#30D158" />
            </View>
            <View style={styles.safeCopy}>
              <Text style={styles.safeTitle}>No known conflicts found</Text>
              <Text style={styles.safeBody}>
                You can save this medication without additional acknowledgement.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.warningList}>
            {interactionWarnings.map((warning, index) => (
              <View
                key={`${warning.drug}-${index}`}
                style={[
                  styles.warningCard,
                  {
                    backgroundColor: withAlpha(
                      warning.severity === 'severe' ? '#FF453A' : warning.severity === 'moderate' ? '#FFB877' : '#8BCFF0',
                      0.12,
                    ),
                  },
                ]}
              >
                <View style={styles.warningHeader}>
                  <Text style={styles.warningBadge}>{warning.severity.toUpperCase()}</Text>
                  <Text style={styles.warningDrug}>{warning.drug}</Text>
                </View>
                <Text style={styles.warningBody}>{warning.description}</Text>
              </View>
            ))}
          </View>
        )}
      </GlassCard>

      {interactionWarnings.length > 0 ? (
        <Pressable
          onPress={() => setInteractionAcknowledged((current) => !current)}
          style={[
            styles.ackCard,
            interactionAcknowledged ? styles.ackCardSelected : null,
          ]}
        >
          <View style={styles.ackIcon}>
            <MaterialSymbol
              name={interactionAcknowledged ? 'check_circle' : 'warning'}
              size={20}
              color={interactionAcknowledged ? MD_ACCENT_LIGHT : '#FFB877'}
            />
          </View>
          <View style={styles.ackCopy}>
            <Text style={styles.switchTitle}>I reviewed the interaction warnings</Text>
            <Text style={styles.switchBody}>
              Save is enabled only after acknowledging the risks shown above.
            </Text>
          </View>
        </Pressable>
      ) : null}
    </>
  );

  const renderReviewStep = () => (
    <>
      <GlassCard style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Step 6</Text>
        <Text style={styles.heroTitle}>Review and save</Text>
        <Text style={styles.heroBody}>
          Final pass before MyMeds creates the medication, reminder schedule, and optional refill record.
        </Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.reviewHeading}>{name || 'Medication name'}</Text>
        <Text style={styles.reviewSubheading}>
          {strength || 'Strength pending'} • {form} • {routeName}
        </Text>
        <View style={styles.metaRow}>
          <MetaPill label="Frequency" value={FREQUENCY_PRESETS[frequencyPreset].label} />
          <MetaPill label="Times" value={timeSlots.length ? timeSlots.join(', ') : 'As needed'} />
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.fieldLabel}>Clinical summary</Text>
        <Text style={styles.summaryText}>{summaryNotes || 'No extra clinical notes captured yet.'}</Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.metaRow}>
          <MetaPill label="Reminders" value={remindersEnabled ? 'Enabled' : 'Disabled'} />
          <MetaPill label="Refills" value={refillEnabled ? 'Tracked' : 'Off'} />
          <MetaPill label="Warnings" value={interactionWarnings.length ? 'Reviewed' : 'None'} />
        </View>
      </GlassCard>
    </>
  );

  const renderStep = () => {
    switch (stepConfig.key) {
      case 'drug':
        return renderDrugStep();
      case 'schedule':
        return renderScheduleStep();
      case 'reminders':
        return renderReminderStep();
      case 'refills':
        return renderRefillStep();
      case 'interactions':
        return renderInteractionsStep();
      case 'review':
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <View style={styles.topBar}>
          <Pressable onPress={closeWizard} style={styles.closeButton}>
            <MaterialSymbol name="close" size={18} color={MD_TEXT} />
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.topEyebrow}>Add medication</Text>
            <Text style={styles.topTitle}>{stepConfig.label}</Text>
          </View>
          <View style={styles.stepCounter}>
            <Text style={styles.stepCounterText}>{stepIndex + 1}/6</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          {WIZARD_STEPS.map((step, index) => (
            <View
              key={step.key}
              style={[
                styles.progressDot,
                index <= stepIndex ? styles.progressDotActive : null,
                index === stepIndex ? styles.progressDotCurrent : null,
              ]}
            />
          ))}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => (stepIndex === 0 ? closeWizard() : setStepIndex((current) => current - 1))}
            style={styles.footerSecondary}
          >
            <Text style={styles.footerSecondaryText}>{stepIndex === 0 ? 'Cancel' : 'Back'}</Text>
          </Pressable>

          {stepIndex < WIZARD_STEPS.length - 1 ? (
            <Pressable
              onPress={() => setStepIndex((current) => current + 1)}
              disabled={!canAdvance}
              style={[
                styles.footerPrimary,
                !canAdvance ? styles.footerPrimaryDisabled : null,
              ]}
            >
              <Text style={styles.footerPrimaryText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSave}
              disabled={!canAdvance || saving}
              style={[
                styles.footerPrimary,
                (!canAdvance || saving) ? styles.footerPrimaryDisabled : null,
              ]}
            >
              <Text style={styles.footerPrimaryText}>
                {saving ? 'Saving...' : 'Save Medication'}
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.06),
    borderRadius: 18,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topCopy: {
    flex: 1,
    gap: 2,
  },
  topEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  topTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  stepCounter: {
    backgroundColor: withAlpha(MD_ACCENT, 0.14),
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stepCounterText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  progressDot: {
    backgroundColor: withAlpha('#FFFFFF', 0.12),
    borderRadius: 999,
    flex: 1,
    height: 8,
  },
  progressDotActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.38),
  },
  progressDotCurrent: {
    ...MD_CYAN_GLOW_STYLE,
    backgroundColor: MD_ACCENT,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  heroCard: {
    gap: 10,
    padding: 20,
  },
  heroEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTitle: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 34,
    lineHeight: 38,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  sectionCard: {
    gap: 14,
    padding: 18,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  searchInput: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_ACCENT_LIGHT,
    flex: 1,
    padding: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  twoColumnGrid: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  input: {
    ...MD_TYPOGRAPHY.titleMd,
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    color: MD_TEXT,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputMultiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  toggleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    minWidth: '48%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toggleCardCompact: {
    minWidth: undefined,
    paddingVertical: 12,
  },
  toggleCardSelected: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
  },
  toggleCardText: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  toggleCardTextSelected: {
    color: MD_ACCENT_LIGHT,
  },
  frequencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeList: {
    gap: 10,
  },
  timeRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  timeIcon: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  timeInput: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    flex: 1,
    padding: 0,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  switchCopy: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  switchBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaPill: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: MD_PILL_RADIUS,
    gap: 4,
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metaPillLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  metaPillValue: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  safeState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  safeIcon: {
    alignItems: 'center',
    backgroundColor: withAlpha('#30D158', 0.14),
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  safeCopy: {
    flex: 1,
    gap: 4,
  },
  safeTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  safeBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  warningList: {
    gap: 10,
  },
  warningCard: {
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  warningHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  warningBadge: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT,
  },
  warningDrug: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  warningBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  ackCard: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  ackCardSelected: {
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
  },
  ackIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackCopy: {
    flex: 1,
    gap: 4,
  },
  reviewHeading: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  reviewSubheading: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  summaryText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    lineHeight: 22,
  },
  footer: {
    backgroundColor: withAlpha(MD_SURFACES.base, 0.92),
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 26 : 18,
  },
  footerSecondary: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.06),
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  footerSecondaryText: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  footerPrimary: {
    ...MD_CYAN_GLOW_STYLE,
    alignItems: 'center',
    backgroundColor: MD_ACCENT,
    borderRadius: 20,
    flex: 1.4,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  footerPrimaryDisabled: {
    backgroundColor: withAlpha(MD_ACCENT, 0.28),
    shadowOpacity: 0,
  },
  footerPrimaryText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    color: '#052029',
  },
});
