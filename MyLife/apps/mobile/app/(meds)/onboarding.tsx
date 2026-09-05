import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createMedication, getSetting, setSetting, updateMedication } from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_CYAN_GLOW_STYLE,
  MD_FONTS,
  MD_SURFACES,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { requestMedsNotificationPermissionAsync } from '../../lib/meds-notifications';

const STEPS = [
  'Welcome',
  'Conditions',
  'Medication',
  'Vitals',
  'Reminders',
  'Caregiver',
  'Done',
] as const;

const CONDITION_OPTIONS = [
  'Diabetes',
  'Hypertension',
  'Heart Disease',
  'Asthma',
  'Arthritis',
  'Mental Health',
  'Thyroid',
  'Other',
] as const;

const VITAL_OPTIONS = [
  'BP',
  'Glucose',
  'Insulin',
  'Weight',
  'Heart Rate',
  'Temperature',
  'Pain',
  'Mood',
] as const;

const REMINDER_SLOT_OPTIONS = [
  { label: 'Morning', time: '08:00', icon: 'wb_twilight' },
  { label: 'Midday', time: '12:00', icon: 'restaurant' },
  { label: 'Evening', time: '18:00', icon: 'dark_mode' },
  { label: 'Bedtime', time: '21:30', icon: 'bedtime' },
] as const;

const FREQUENCY_OPTIONS = ['daily', 'twice_daily', 'weekly', 'as_needed'] as const;
const RELATIONSHIP_OPTIONS = ['spouse', 'parent', 'child', 'sibling', 'friend', 'doctor', 'other'] as const;

function buildDefaultVitals(selectedConditions: string[]) {
  const recommended = new Set<string>();
  if (selectedConditions.includes('Diabetes')) {
    recommended.add('Glucose');
    recommended.add('Insulin');
    recommended.add('Weight');
  }
  if (selectedConditions.includes('Hypertension') || selectedConditions.includes('Heart Disease')) {
    recommended.add('BP');
    recommended.add('Heart Rate');
    recommended.add('Weight');
  }
  if (selectedConditions.includes('Arthritis')) {
    recommended.add('Pain');
    recommended.add('Mood');
  }
  if (selectedConditions.includes('Mental Health')) {
    recommended.add('Mood');
  }
  return Array.from(recommended);
}

function frequencyLabel(value: string) {
  switch (value) {
    case 'daily':
      return 'Daily';
    case 'twice_daily':
      return 'Twice Daily';
    case 'weekly':
      return 'Weekly';
    default:
      return 'As Needed';
  }
}

export default function OnboardingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [conditions, setConditions] = useState<string[]>([]);
  const [medicationId, setMedicationId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<(typeof FREQUENCY_OPTIONS)[number]>('daily');
  const [trackedVitals, setTrackedVitals] = useState<string[]>([]);
  const [reminderSlots, setReminderSlots] = useState<string[]>(['Morning', 'Evening']);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [caregiverRelationship, setCaregiverRelationship] = useState('friend');
  const [saving, setSaving] = useState(false);
  const transition = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const storedConditions = getSetting(db, 'onboarding.conditions');
    const storedVitals = getSetting(db, 'onboarding.tracked_vitals');
    const storedSlots = getSetting(db, 'onboarding.reminder_slots');
    const storedStatus = getSetting(db, 'onboarding.permission_status');
    const storedMedicationId = getSetting(db, 'onboarding.medication_id');
    const storedCaregiverId = getSetting(db, 'onboarding.caregiver_id');

    if (storedConditions) {
      setConditions(JSON.parse(storedConditions));
    }
    if (storedVitals) {
      setTrackedVitals(JSON.parse(storedVitals));
    }
    if (storedSlots) {
      setReminderSlots(JSON.parse(storedSlots));
    }
    if (storedStatus === 'granted' || storedStatus === 'denied') {
      setPermissionStatus(storedStatus);
    }
    if (storedMedicationId) {
      setMedicationId(storedMedicationId);
    }
    if (storedCaregiverId) {
      setCaregiverId(storedCaregiverId);
    }
  }, [db]);

  useEffect(() => {
    transition.setValue(0);
    Animated.spring(transition, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
  }, [step, transition]);

  const animatedStyle = useMemo(
    () => ({
      opacity: transition,
      transform: [
        {
          translateY: transition.interpolate({
            inputRange: [0, 1],
            outputRange: [24, 0],
          }),
        },
      ],
    }),
    [transition],
  );

  const recommendedVitals = useMemo(() => buildDefaultVitals(conditions), [conditions]);

  useEffect(() => {
    if (recommendedVitals.length === 0) {
      return;
    }

    setTrackedVitals((current) => {
      const next = new Set([...current, ...recommendedVitals]);
      return Array.from(next);
    });
  }, [recommendedVitals]);

  const persistCurrentStep = async () => {
    if (step === 1) {
      setSetting(db, 'onboarding.conditions', JSON.stringify(conditions));
    }

    if (step === 2) {
      if (medName.trim()) {
        if (medicationId) {
          updateMedication(db, medicationId, {
            name: medName.trim(),
            dosage: dosage.trim(),
            frequency,
          });
        } else {
          const nextId = uuid();
          createMedication(db, nextId, {
            name: medName.trim(),
            dosage: dosage.trim() || undefined,
            frequency,
          });
          setMedicationId(nextId);
          setSetting(db, 'onboarding.medication_id', nextId);
        }
      }
    }

    if (step === 3) {
      setSetting(db, 'onboarding.tracked_vitals', JSON.stringify(trackedVitals));
    }

    if (step === 4) {
      const slotTimes = REMINDER_SLOT_OPTIONS
        .filter((slot) => reminderSlots.includes(slot.label))
        .map((slot) => slot.time);
      setSetting(db, 'onboarding.reminder_slots', JSON.stringify(reminderSlots));
      setSetting(db, 'notifications.default_times', JSON.stringify(slotTimes));
      setSetting(db, 'onboarding.permission_status', permissionStatus);
    }

    if (step === 5) {
      if (caregiverName.trim()) {
        if (!caregiverPhone.trim() && !caregiverEmail.trim()) {
          Alert.alert('Add a contact method', 'Include a phone number or email for the caregiver, or skip this step.');
          throw new Error('caregiver-contact-required');
        }

        const id = caregiverId ?? uuid();
        const now = new Date().toISOString();
        db.execute(
          `INSERT INTO md_caregivers (id, name, phone, email, relationship, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             phone = excluded.phone,
             email = excluded.email,
             relationship = excluded.relationship,
             updated_at = excluded.updated_at`,
          [
            id,
            caregiverName.trim(),
            caregiverPhone.trim() || null,
            caregiverEmail.trim() || null,
            caregiverRelationship,
            now,
            now,
          ],
        );
        setCaregiverId(id);
        setSetting(db, 'onboarding.caregiver_id', id);
      }
    }
  };

  const nextStep = async () => {
    setSaving(true);
    try {
      await persistCurrentStep();
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    } catch (error) {
      if (!(error instanceof Error && error.message === 'caregiver-contact-required')) {
        Alert.alert('Save failed', 'MyMeds could not save this onboarding step.');
      }
    } finally {
      setSaving(false);
    }
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      setSetting(db, 'onboarding.conditions', JSON.stringify(conditions));
      setSetting(db, 'onboarding.tracked_vitals', JSON.stringify(trackedVitals));
      setSetting(db, 'onboarding.reminder_slots', JSON.stringify(reminderSlots));
      setSetting(db, 'onboarding.permission_status', permissionStatus);
      setSetting(db, 'onboarding_complete', 'true');
      router.replace('/(meds)/(tabs)/index');
    } catch {
      Alert.alert('Finish failed', 'MyMeds could not complete onboarding.');
    } finally {
      setSaving(false);
    }
  };

  const requestPermission = async () => {
    try {
      const status = await requestMedsNotificationPermissionAsync();
      const nextStatus = status === 'granted' ? 'granted' : 'denied';
      setPermissionStatus(nextStatus);
      setSetting(db, 'onboarding.permission_status', nextStatus);
      setSetting(db, 'notifications.master_enabled', nextStatus === 'granted' ? 'true' : 'false');
    } catch {
      Alert.alert('Permission request failed', 'MyMeds could not request notification access.');
    }
  };

  const toggleSelection = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <View style={styles.header}>
        <Text style={styles.stepLabel}>{`Step ${step + 1} of ${STEPS.length}`}</Text>
        <View style={styles.progressRow}>
          {STEPS.map((label, index) => (
            <View
              key={label}
              style={[
                styles.progressDot,
                index === step ? styles.progressDotActive : null,
                index < step ? styles.progressDotComplete : null,
              ]}
            />
          ))}
        </View>
      </View>

      <Animated.View style={animatedStyle}>
        {step === 0 ? (
          <GlassCard style={styles.heroCard}>
            <View style={styles.logoShell}>
              <View style={styles.logoOrb}>
                <MaterialSymbol color="#003345" name="shield_person" size={36} />
              </View>
            </View>
            <Text style={styles.heroTitle}>Your private health command center</Text>
            <Text style={styles.heroBody}>
              MyMeds keeps your medications, vitals, symptoms, and care timeline local-first and under your control.
            </Text>

            <View style={styles.promiseStack}>
              <PromiseRow icon="verified_user" title="Encrypted on device" body="Your medication history stays private and device-local." />
              <PromiseRow icon="notifications" title="Clinical reminders" body="Prep notifications, refill nudges, and care alerts around your schedule." />
              <PromiseRow icon="family_restroom" title="Caregiver ready" body="Share missed-dose context with a trusted person when you want backup." />
            </View>

            <PrimaryButton label="Get Started" onPress={() => setStep(1)} />
          </GlassCard>
        ) : null}

        {step === 1 ? (
          <GlassCard style={styles.panelCard}>
            <Text style={styles.panelTitle}>Do you manage any conditions?</Text>
            <Text style={styles.panelBody}>This pre-configures the vitals and insights MyMeds will prioritize first.</Text>
            <View style={styles.chipWrap}>
              {CONDITION_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option}
                  active={conditions.includes(option)}
                  label={option}
                  onPress={() => toggleSelection(option, conditions, setConditions)}
                />
              ))}
            </View>
            <FooterActions
              backLabel="Back"
              nextLabel="Continue"
              onBack={() => setStep(0)}
              onNext={() => void nextStep()}
              saving={saving}
            />
          </GlassCard>
        ) : null}

        {step === 2 ? (
          <GlassCard style={styles.panelCard}>
            <Text style={styles.panelTitle}>Let&apos;s add your first medication</Text>
            <Text style={styles.panelBody}>Start with one medication now, or skip and add the rest later from the main meds list.</Text>

            <Field label="Medication name">
              <TextInput
                onChangeText={setMedName}
                placeholder="Rosuvastatin"
                placeholderTextColor="#9F8E81"
                style={styles.input}
                value={medName}
              />
            </Field>

            <Field label="Dosage">
              <TextInput
                onChangeText={setDosage}
                placeholder="10mg"
                placeholderTextColor="#9F8E81"
                style={styles.input}
                value={dosage}
              />
            </Field>

            <Field label="Frequency">
              <View style={styles.chipWrap}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option}
                    active={frequency === option}
                    label={frequencyLabel(option)}
                    onPress={() => setFrequency(option)}
                  />
                ))}
              </View>
            </Field>

            <FooterActions
              backLabel="Back"
              nextLabel={medName.trim() ? 'Save Medication' : 'Skip for Now'}
              onBack={() => setStep(1)}
              onNext={() => void nextStep()}
              saving={saving}
            />
          </GlassCard>
        ) : null}

        {step === 3 ? (
          <GlassCard style={styles.panelCard}>
            <Text style={styles.panelTitle}>Which vitals do you track?</Text>
            <Text style={styles.panelBody}>Recommended vitals are preselected from the conditions you chose, but you can add or remove anything here.</Text>
            <View style={styles.chipWrap}>
              {VITAL_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option}
                  active={trackedVitals.includes(option)}
                  label={recommendedVitals.includes(option) ? `${option} • Suggested` : option}
                  onPress={() => toggleSelection(option, trackedVitals, setTrackedVitals)}
                />
              ))}
            </View>
            <FooterActions
              backLabel="Back"
              nextLabel="Continue"
              onBack={() => setStep(2)}
              onNext={() => void nextStep()}
              saving={saving}
            />
          </GlassCard>
        ) : null}

        {step === 4 ? (
          <GlassCard style={styles.panelCard}>
            <Text style={styles.panelTitle}>Set up reminders</Text>
            <Text style={styles.panelBody}>Choose the dayparts MyMeds should anchor around and request notification permission now if you want live alerts.</Text>

            <Field label="Default reminder slots">
              <View style={styles.chipWrap}>
                {REMINDER_SLOT_OPTIONS.map((slot) => (
                  <ChoiceChip
                    key={slot.label}
                    active={reminderSlots.includes(slot.label)}
                    icon={slot.icon}
                    label={`${slot.label} • ${slot.time}`}
                    onPress={() => toggleSelection(slot.label, reminderSlots, setReminderSlots)}
                  />
                ))}
              </View>
            </Field>

            <GlassCard style={styles.permissionCard}>
              <View style={styles.permissionHeader}>
                <View style={styles.permissionIconShell}>
                  <MaterialSymbol
                    color={permissionStatus === 'granted' ? MD_ACCENT_LIGHT : MD_CHROME_GOLD}
                    name={permissionStatus === 'granted' ? 'check_circle' : 'notifications'}
                    size={20}
                  />
                </View>
                <View style={styles.permissionCopy}>
                  <Text style={styles.fieldTitle}>Notification access</Text>
                  <Text style={styles.fieldBody}>
                    {permissionStatus === 'granted'
                      ? 'Notifications are enabled for MyMeds reminders.'
                      : 'Request permission now so the reminder channel is ready before you finish setup.'}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => void requestPermission()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>
                  {permissionStatus === 'granted' ? 'Permission Granted' : 'Request Permission'}
                </Text>
              </Pressable>
            </GlassCard>

            <FooterActions
              backLabel="Back"
              nextLabel="Continue"
              onBack={() => setStep(3)}
              onNext={() => void nextStep()}
              saving={saving}
            />
          </GlassCard>
        ) : null}

        {step === 5 ? (
          <GlassCard style={styles.panelCard}>
            <Text style={styles.panelTitle}>Share with a caregiver?</Text>
            <Text style={styles.panelBody}>Optional. Add a trusted person so missed-dose and wellness alerts can escalate when you need backup.</Text>

            <Field label="Caregiver name">
              <TextInput
                onChangeText={setCaregiverName}
                placeholder="Jordan Rivera"
                placeholderTextColor="#9F8E81"
                style={styles.input}
                value={caregiverName}
              />
            </Field>

            <View style={styles.inlineFields}>
              <Field label="Phone" style={styles.inlineField}>
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={setCaregiverPhone}
                  placeholder="(555) 010-2200"
                  placeholderTextColor="#9F8E81"
                  style={styles.input}
                  value={caregiverPhone}
                />
              </Field>
              <Field label="Email" style={styles.inlineField}>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setCaregiverEmail}
                  placeholder="jordan@example.com"
                  placeholderTextColor="#9F8E81"
                  style={styles.input}
                  value={caregiverEmail}
                />
              </Field>
            </View>

            <Field label="Relationship">
              <View style={styles.chipWrap}>
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option}
                    active={caregiverRelationship === option}
                    label={option.replace(/_/g, ' ')}
                    onPress={() => setCaregiverRelationship(option)}
                  />
                ))}
              </View>
            </Field>

            <FooterActions
              backLabel="Back"
              nextLabel={caregiverName.trim() ? 'Save Caregiver' : 'Skip Caregiver'}
              onBack={() => setStep(4)}
              onNext={() => void nextStep()}
              saving={saving}
            />
          </GlassCard>
        ) : null}

        {step === 6 ? (
          <GlassCard style={styles.heroCard}>
            <View style={styles.logoShell}>
              <View style={[styles.logoOrb, styles.doneOrb]}>
                <MaterialSymbol color="#003345" name="check_circle" size={36} />
              </View>
            </View>
            <Text style={styles.heroTitle}>You&apos;re ready</Text>
            <Text style={styles.heroBody}>MyMeds now has the basics it needs to build your Today view, reminder schedule, and care timeline.</Text>

            <View style={styles.summaryStack}>
              <SummaryRow label="Conditions" value={conditions.length > 0 ? conditions.join(', ') : 'None selected'} />
              <SummaryRow label="Medication" value={medName.trim() || 'Add later'} />
              <SummaryRow label="Vitals" value={trackedVitals.length > 0 ? trackedVitals.join(', ') : 'None selected'} />
              <SummaryRow label="Reminders" value={reminderSlots.join(', ')} />
              <SummaryRow label="Caregiver" value={caregiverName.trim() || 'Not added'} />
            </View>

            <PrimaryButton label={saving ? 'Finishing...' : 'Continue to Today'} onPress={() => void finishOnboarding()} />
            <Pressable onPress={() => setStep(5)} style={styles.ghostLink}>
              <Text style={styles.ghostLinkText}>Back to review</Text>
            </Pressable>
          </GlassCard>
        ) : null}
      </Animated.View>
    </ScrollView>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChoiceChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceChip, active ? styles.choiceChipActive : null]}>
      {icon ? (
        <MaterialSymbol color={active ? '#E4E1E9' : '#9F8E81'} name={icon} size={14} />
      ) : null}
      <Text style={[styles.choiceChipText, active ? styles.choiceChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function PromiseRow({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.promiseRow}>
      <View style={styles.promiseIconShell}>
        <MaterialSymbol color={MD_ACCENT_LIGHT} name={icon} size={18} />
      </View>
      <View style={styles.promiseCopy}>
        <Text style={styles.promiseTitle}>{title}</Text>
        <Text style={styles.promiseBody}>{body}</Text>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function FooterActions({
  backLabel,
  nextLabel,
  onBack,
  onNext,
  saving,
}: {
  backLabel: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <View style={styles.footerActions}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>{backLabel}</Text>
      </Pressable>
      <PrimaryButton label={saving ? 'Saving...' : nextLabel} onPress={onNext} compact />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.primaryButton, compact ? styles.primaryButtonCompact : null]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
      <MaterialSymbol color="#4B2700" name="arrow_forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  backgroundGlowTop: {
    ...MD_CYAN_GLOW_STYLE,
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
    borderRadius: 220,
    height: 220,
    left: -80,
    position: 'absolute',
    top: -40,
    width: 220,
  },
  backgroundGlowBottom: {
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.08),
    borderRadius: 220,
    bottom: -60,
    height: 220,
    position: 'absolute',
    right: -80,
    width: 220,
  },
  header: {
    gap: 10,
    marginBottom: 18,
  },
  stepLabel: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    backgroundColor: withAlpha('#FFFFFF', 0.08),
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  progressDotActive: {
    backgroundColor: MD_ACCENT_LIGHT,
    width: 30,
  },
  progressDotComplete: {
    backgroundColor: withAlpha(MD_ACCENT, 0.4),
  },
  heroCard: {
    alignItems: 'center',
    gap: 14,
    padding: 22,
  },
  panelCard: {
    gap: 16,
    padding: 20,
  },
  logoShell: {
    marginTop: 6,
  },
  logoOrb: {
    ...MD_CYAN_GLOW_STYLE,
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 28,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  doneOrb: {
    backgroundColor: MD_CHROME_GOLD,
  },
  heroTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.extraBold,
    fontSize: 32,
    letterSpacing: -0.8,
    lineHeight: 36,
    textAlign: 'center',
  },
  heroBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  promiseStack: {
    gap: 12,
    width: '100%',
  },
  promiseRow: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  promiseIconShell: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  promiseCopy: {
    flex: 1,
  },
  promiseTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
  },
  promiseBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  panelTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  panelBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  fieldLabel: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  fieldTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
  },
  fieldBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  input: {
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 18,
    color: '#E4E1E9',
    fontFamily: MD_FONTS.regular,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  choiceChipActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.2),
  },
  choiceChipText: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  choiceChipTextActive: {
    color: '#E4E1E9',
  },
  permissionCard: {
    gap: 14,
    padding: 16,
  },
  permissionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  permissionIconShell: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.06),
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  permissionCopy: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.12),
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 42,
  },
  secondaryButtonText: {
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineField: {
    flex: 1,
  },
  footerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  backButtonText: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: MD_CHROME_GOLD,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 20,
    width: '100%',
  },
  primaryButtonCompact: {
    flex: 1.35,
    width: undefined,
  },
  primaryButtonText: {
    color: '#4B2700',
    fontFamily: MD_FONTS.bold,
    fontSize: 15,
  },
  summaryStack: {
    gap: 10,
    width: '100%',
  },
  summaryRow: {
    alignItems: 'flex-start',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 18,
    gap: 2,
    padding: 14,
    width: '100%',
  },
  summaryLabel: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  ghostLink: {
    marginTop: 2,
  },
  ghostLinkText: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
});
