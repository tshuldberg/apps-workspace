import { useCallback, useMemo, useState } from 'react';
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
import * as Notifications from 'expo-notifications';
import {
  createArea,
  createHabit,
  createReminder,
  ensurePetState,
  getAreas,
  PET_SPECIES_CATALOG,
  setSetting,
  updatePetName,
  updatePetSpecies,
  type PetSpeciesKey,
  type TimeOfDay,
  GlassCard,
  HB_AREAS,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  MaterialSymbol,
  PetAvatar,
  SectionHeader,
  withAlpha,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type GoalKey =
  | 'health'
  | 'mind'
  | 'body'
  | 'money'
  | 'social'
  | 'learning'
  | 'spiritual';

type AreaDraft = {
  key: GoalKey;
  name: string;
  icon: string;
  color: string;
};

type HabitFrequency = 'daily' | 'specific_days' | 'weekly';

const GOAL_OPTIONS: Array<{
  key: GoalKey;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  defaultArea: string;
}> = [
  {
    key: 'health',
    title: 'Health',
    subtitle: 'Hydration, movement, sleep',
    icon: 'fitness_center',
    color: HB_AREAS.health,
    defaultArea: 'Health',
  },
  {
    key: 'mind',
    title: 'Mind',
    subtitle: 'Meditation, focus, calm',
    icon: 'psychology',
    color: HB_AREAS.mind,
    defaultArea: 'Mind',
  },
  {
    key: 'body',
    title: 'Body',
    subtitle: 'Recovery, posture, care',
    icon: 'favorite',
    color: HB_AREAS.body,
    defaultArea: 'Body',
  },
  {
    key: 'money',
    title: 'Money',
    subtitle: 'Save, budget, invest',
    icon: 'attach_money',
    color: HB_AREAS.money,
    defaultArea: 'Money',
  },
  {
    key: 'social',
    title: 'Social',
    subtitle: 'Reach out, connect, host',
    icon: 'people',
    color: HB_AREAS.social,
    defaultArea: 'Social',
  },
  {
    key: 'learning',
    title: 'Learning',
    subtitle: 'Study, read, practice',
    icon: 'psychology',
    color: HB_AREAS.learning,
    defaultArea: 'Learning',
  },
  {
    key: 'spiritual',
    title: 'Spiritual',
    subtitle: 'Reflect, gratitude, intention',
    icon: 'eco',
    color: HB_AREAS.spiritual,
    defaultArea: 'Spiritual',
  },
];

const HABIT_TEMPLATES = [
  { label: 'Drink water', icon: '💧', name: 'Drink Water', goalKey: 'health' as GoalKey },
  { label: 'Read 10 pages', icon: '📚', name: 'Read 10 Pages', goalKey: 'learning' as GoalKey },
  { label: 'Stretch', icon: '🧘', name: 'Stretch', goalKey: 'body' as GoalKey },
  { label: 'Meditate', icon: '🫁', name: 'Meditate', goalKey: 'mind' as GoalKey },
];

const REMINDER_PRESETS = ['07:30', '12:00', '18:00', '21:00'];

function deriveTimeOfDay(time: string): TimeOfDay {
  const hour = Number.parseInt(time.split(':')[0] ?? '8', 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function makeAreaDrafts(goalKeys: GoalKey[], previousDrafts: AreaDraft[]) {
  return goalKeys.map((goalKey) => {
    const previous = previousDrafts.find((draft) => draft.key === goalKey);
    const goal = GOAL_OPTIONS.find((option) => option.key === goalKey)!;
    return previous ?? {
      key: goal.key,
      name: goal.defaultArea,
      icon: goal.icon,
      color: goal.color,
    };
  });
}

export default function OnboardingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<GoalKey[]>(['health', 'mind']);
  const [areaDrafts, setAreaDrafts] = useState<AreaDraft[]>(
    makeAreaDrafts(['health', 'mind'], []),
  );
  const [habitName, setHabitName] = useState('Drink Water');
  const [habitIcon, setHabitIcon] = useState('💧');
  const [habitFrequency, setHabitFrequency] = useState<HabitFrequency>('daily');
  const [selectedAreaKey, setSelectedAreaKey] = useState<GoalKey>('health');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('07:30');
  const [notificationStatus, setNotificationStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [petSpecies, setPetSpecies] = useState<PetSpeciesKey>('fox');
  const [petName, setPetName] = useState('Nova');
  const [saving, setSaving] = useState(false);

  const progress = (step + 1) / 7;

  const selectedAreaOptions = useMemo(
    () => areaDrafts.filter((draft) => draft.name.trim().length > 0),
    [areaDrafts],
  );

  const toggleGoal = useCallback((goalKey: GoalKey) => {
    setSelectedGoals((current) => {
      if (current.includes(goalKey)) {
        const next = current.filter((item) => item !== goalKey);
        return next.length > 0 ? next : current;
      }
      return [...current, goalKey];
    });
  }, []);

  const syncAreaDrafts = useCallback(() => {
    setAreaDrafts((current) => makeAreaDrafts(selectedGoals, current));
    if (!selectedGoals.includes(selectedAreaKey)) {
      setSelectedAreaKey(selectedGoals[0] ?? 'health');
    }
  }, [selectedAreaKey, selectedGoals]);

  const requestNotifications = useCallback(async () => {
    try {
      const result = await Notifications.requestPermissionsAsync();
      setNotificationStatus(result.status === 'granted' ? 'granted' : 'denied');
    } catch {
      setNotificationStatus('denied');
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    setSaving(true);

    try {
      const existingAreas = getAreas(db);
      const areaIdsByKey = new Map<GoalKey, string>();

      for (const draft of areaDrafts) {
        const name = draft.name.trim();
        if (!name) continue;
        const existing = existingAreas.find(
          (area) => area.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          areaIdsByKey.set(draft.key, existing.id);
          continue;
        }

        const id = uuid();
        createArea(db, id, {
          name,
          color: draft.color,
          icon: draft.icon,
        });
        areaIdsByKey.set(draft.key, id);
      }

      const habitId = uuid();
      createHabit(db, habitId, {
        name: habitName.trim(),
        frequency: habitFrequency,
        icon: habitIcon.trim() || '✨',
        targetCount: 1,
        timeOfDay: deriveTimeOfDay(reminderTime),
        areaId: areaIdsByKey.get(selectedAreaKey) ?? undefined,
      });

      if (reminderEnabled && reminderTime.trim()) {
        createReminder(db, uuid(), habitId, reminderTime.trim(), 'Daily nudge');
      }

      ensurePetState(db);
      updatePetSpecies(db, petSpecies);
      updatePetName(db, petName.trim() || 'Nova');

      setSetting(db, 'onboarding_goals', JSON.stringify(selectedGoals));
      setSetting(db, 'onboarding_complete', 'true');
      setStep(6);
    } catch (error) {
      Alert.alert(
        'Setup Failed',
        `MyHabits could not finish onboarding. ${String(error)}`,
      );
    } finally {
      setSaving(false);
    }
  }, [
    areaDrafts,
    db,
    habitFrequency,
    habitIcon,
    habitName,
    petName,
    petSpecies,
    reminderEnabled,
    reminderTime,
    selectedAreaKey,
    selectedGoals,
  ]);

  const goNext = useCallback(async () => {
    if (step === 1) {
      if (selectedGoals.length === 0) {
        Alert.alert('Choose a Goal', 'Pick at least one focus area to continue.');
        return;
      }
      syncAreaDrafts();
      setStep(2);
      return;
    }

    if (step === 2) {
      if (selectedAreaOptions.length === 0) {
        Alert.alert('Add an Area', 'Keep at least one named area for your first habit.');
        return;
      }
      if (!selectedAreaOptions.some((draft) => draft.key === selectedAreaKey)) {
        setSelectedAreaKey(selectedAreaOptions[0]?.key ?? 'health');
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!habitName.trim()) {
        Alert.alert('Name Your Habit', 'Give your first habit a clear name.');
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      if (reminderEnabled && !reminderTime.trim()) {
        Alert.alert('Reminder Time', 'Pick a reminder time or turn reminders off.');
        return;
      }
      setStep(5);
      return;
    }

    if (step === 5) {
      await completeOnboarding();
      return;
    }

    setStep((current) => Math.min(6, current + 1));
  }, [
    completeOnboarding,
    habitName,
    reminderEnabled,
    reminderTime,
    selectedAreaKey,
    selectedAreaOptions,
    selectedGoals.length,
    step,
    syncAreaDrafts,
  ]);

  const skipAll = useCallback(() => {
    setSetting(db, 'onboarding_complete', 'true');
    router.replace('/(habits)/');
  }, [db, router]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={skipAll}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.stepLabel}>{step + 1}/7</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 0 ? (
          <View style={styles.centerStep}>
            <View style={styles.logoOrb}>
              <MaterialSymbol name="check_circle" size={40} color={HB_TEXT} filled />
            </View>
            <Text style={styles.heroTitle}>Build habits that stick</Text>
            <Text style={styles.heroBody}>
              MyHabits helps you pick a direction, set the first routine, and start with a companion that grows beside you.
            </Text>
            <GlassCard level={3} style={styles.welcomeCard} contentStyle={styles.welcomeCardContent}>
              <Text style={styles.welcomeCardTitle}>What you will set up</Text>
              {[
                'Your focus goals',
                'Areas that organize the habit list',
                'Your first reminder',
                'A pet companion that grows with streaks',
              ].map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </GlassCard>
          </View>
        ) : null}

        {step === 1 ? (
          <GlassCard level={3} contentStyle={styles.sectionCard}>
            <SectionHeader title="What do you want to improve?" />
            <View style={styles.goalGrid}>
              {GOAL_OPTIONS.map((goal) => {
                const selected = selectedGoals.includes(goal.key);
                return (
                  <Pressable
                    key={goal.key}
                    style={[
                      styles.goalCard,
                      selected ? { backgroundColor: withAlpha(goal.color, 0.22) } : null,
                    ]}
                    onPress={() => toggleGoal(goal.key)}
                  >
                    <View
                      style={[
                        styles.goalIconWrap,
                        { backgroundColor: withAlpha(goal.color, 0.18) },
                      ]}
                    >
                      <MaterialSymbol name={goal.icon} size={20} color={goal.color} filled />
                    </View>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalSubtitle}>{goal.subtitle}</Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        ) : null}

        {step === 2 ? (
          <GlassCard level={3} contentStyle={styles.sectionCard}>
            <SectionHeader title="Customize your areas" />
            <Text style={styles.helperText}>
              These become the violet chips you will use to filter your habits later.
            </Text>
            <View style={styles.areaList}>
              {areaDrafts.map((draft) => (
                <View key={draft.key} style={styles.areaEditorRow}>
                  <View
                    style={[
                      styles.areaSwatch,
                      { backgroundColor: withAlpha(draft.color, 0.22) },
                    ]}
                  >
                    <MaterialSymbol name={draft.icon} size={18} color={draft.color} filled />
                  </View>
                  <TextInput
                    placeholder={draft.name}
                    placeholderTextColor={HB_TEXT_TERTIARY}
                    style={styles.areaInput}
                    value={draft.name}
                    onChangeText={(name) => {
                      setAreaDrafts((current) =>
                        current.map((item) =>
                          item.key === draft.key ? { ...item, name } : item,
                        ),
                      );
                    }}
                  />
                </View>
              ))}
            </View>
          </GlassCard>
        ) : null}

        {step === 3 ? (
          <GlassCard level={3} contentStyle={styles.sectionCard}>
            <SectionHeader title="Create your first habit" />
            <TextInput
              placeholder="Habit name"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.input}
              value={habitName}
              onChangeText={setHabitName}
            />
            <TextInput
              placeholder="Emoji icon"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.input}
              value={habitIcon}
              onChangeText={setHabitIcon}
            />

            <Text style={styles.fieldLabel}>Area</Text>
            <View style={styles.chipRow}>
              {selectedAreaOptions.map((draft) => {
                const selected = selectedAreaKey === draft.key;
                return (
                  <Pressable
                    key={draft.key}
                    style={[
                      styles.choiceChip,
                      selected ? { backgroundColor: withAlpha(draft.color, 0.24) } : null,
                    ]}
                    onPress={() => setSelectedAreaKey(draft.key)}
                  >
                    <Text style={styles.choiceChipText}>{draft.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Frequency</Text>
            <View style={styles.chipRow}>
              {(['daily', 'specific_days', 'weekly'] as HabitFrequency[]).map((frequency) => {
                const selected = habitFrequency === frequency;
                return (
                  <Pressable
                    key={frequency}
                    style={[
                      styles.choiceChip,
                      selected ? styles.choiceChipSelected : null,
                    ]}
                    onPress={() => setHabitFrequency(frequency)}
                  >
                    <Text style={styles.choiceChipText}>
                      {frequency === 'specific_days' ? 'Specific days' : frequency}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Quick templates</Text>
            <View style={styles.templateGrid}>
              {HABIT_TEMPLATES.map((template) => (
                <Pressable
                  key={template.label}
                  style={styles.templateCard}
                  onPress={() => {
                    setHabitName(template.name);
                    setHabitIcon(template.icon);
                    setSelectedAreaKey(template.goalKey);
                  }}
                >
                  <Text style={styles.templateIcon}>{template.icon}</Text>
                  <Text style={styles.templateLabel}>{template.label}</Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        ) : null}

        {step === 4 ? (
          <GlassCard level={3} contentStyle={styles.sectionCard}>
            <SectionHeader title="When should we nudge you?" />
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Daily reminder</Text>
                <Text style={styles.toggleBody}>
                  Keep it simple. You can add more reminders later in the habit editor.
                </Text>
              </View>
              <Pressable
                style={[
                  styles.switchPill,
                  reminderEnabled ? styles.switchPillActive : null,
                ]}
                onPress={() => setReminderEnabled((current) => !current)}
              >
                <View
                  style={[
                    styles.switchKnob,
                    reminderEnabled ? styles.switchKnobActive : null,
                  ]}
                />
              </Pressable>
            </View>

            {reminderEnabled ? (
              <>
                <View style={styles.chipRow}>
                  {REMINDER_PRESETS.map((time) => {
                    const selected = reminderTime === time;
                    return (
                      <Pressable
                        key={time}
                        style={[
                          styles.choiceChip,
                          selected ? styles.choiceChipSelected : null,
                        ]}
                        onPress={() => setReminderTime(time)}
                      >
                        <Text style={styles.choiceChipText}>{time}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  placeholder="Custom time (HH:MM)"
                  placeholderTextColor={HB_TEXT_TERTIARY}
                  style={styles.input}
                  value={reminderTime}
                  onChangeText={setReminderTime}
                />
              </>
            ) : null}

            <GlassCard level={1} style={styles.permissionCallout} contentStyle={styles.permissionCalloutContent}>
              <Text style={styles.permissionLabel}>Notifications</Text>
              <Text style={styles.permissionBody}>
                Status: {notificationStatus}
              </Text>
              <Pressable style={styles.inlineButton} onPress={() => void requestNotifications()}>
                <Text style={styles.inlineButtonText}>Request Permission</Text>
              </Pressable>
            </GlassCard>
          </GlassCard>
        ) : null}

        {step === 5 ? (
          <GlassCard level={3} contentStyle={styles.sectionCard}>
            <SectionHeader title="Meet your habit buddy" />
            <PetAvatar
              animate={false}
              pet={{ name: petName || 'Nova', species: petSpecies, level: 1 }}
              stats={{ hunger: 0.8, happiness: 0.7, energy: 0.6 }}
              size={112}
            />
            <TextInput
              placeholder="Pet name"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.input}
              value={petName}
              onChangeText={setPetName}
            />
            <View style={styles.petGrid}>
              {PET_SPECIES_CATALOG.map((species) => {
                const selected = petSpecies === species.key;
                return (
                  <Pressable
                    key={species.key}
                    style={[
                      styles.petCard,
                      selected ? styles.choiceChipSelected : null,
                    ]}
                    onPress={() => setPetSpecies(species.key)}
                  >
                    <Text style={styles.petEmoji}>{species.emoji}</Text>
                    <Text style={styles.petNameLabel}>{species.key}</Text>
                    <Text style={styles.petDescription}>{species.description}</Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        ) : null}

        {step === 6 ? (
          <View style={styles.centerStep}>
            <View style={styles.logoOrb}>
              <MaterialSymbol name="check_circle" size={40} color={HB_TEXT} filled />
            </View>
            <Text style={styles.heroTitle}>You are ready</Text>
            <Text style={styles.heroBody}>
              Your first habit, reminder, and companion are set. The Today tab will now show your day one routine.
            </Text>
            <Pressable style={styles.primaryCta} onPress={() => router.replace('/(habits)/')}>
              <Text style={styles.primaryCtaText}>Continue to Today</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {step < 6 ? (
        <View style={styles.bottomBar}>
          <Pressable style={styles.primaryCta} onPress={() => void goNext()} disabled={saving}>
            <Text style={styles.primaryCtaText}>
              {saving ? 'Saving...' : step === 5 ? 'Finish Setup' : step === 0 ? 'Get Started' : 'Continue'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  skipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.14),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
  },
  stepLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 18,
  },
  centerStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoOrb: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: withAlpha(HB_ACCENT, 0.22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
    textAlign: 'center',
  },
  heroBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
    maxWidth: 320,
  },
  welcomeCard: {
    width: '100%',
  },
  welcomeCardContent: {
    gap: 10,
  },
  welcomeCardTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HB_ACCENT_LIGHT,
  },
  bulletText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  sectionCard: {
    gap: 16,
  },
  helperText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  goalCard: {
    width: '47%' as unknown as number,
    borderRadius: 22,
    backgroundColor: HB_SURFACES.high,
    padding: 16,
    gap: 10,
  },
  goalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    color: HB_TEXT,
  },
  goalSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  areaList: {
    gap: 12,
  },
  areaEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  areaSwatch: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaInput: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  input: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  fieldLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceChip: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceChipSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.24),
  },
  choiceChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    width: '47%' as unknown as number,
    borderRadius: 18,
    backgroundColor: HB_SURFACES.high,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  templateIcon: {
    fontSize: 24,
  },
  templateLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT,
  },
  toggleBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  switchPill: {
    width: 58,
    height: 34,
    borderRadius: 17,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  switchPillActive: {
    backgroundColor: withAlpha(HB_ACCENT, 0.3),
  },
  switchKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: HB_TEXT_TERTIARY,
  },
  switchKnobActive: {
    backgroundColor: HB_ACCENT_LIGHT,
    transform: [{ translateX: 24 }],
  },
  permissionCallout: {
    backgroundColor: withAlpha(HB_ACCENT, 0.08),
  },
  permissionCalloutContent: {
    gap: 8,
  },
  permissionLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  permissionBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  inlineButton: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  inlineButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT,
  },
  petGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  petCard: {
    width: '47%' as unknown as number,
    borderRadius: 18,
    backgroundColor: HB_SURFACES.high,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
  },
  petEmoji: {
    fontSize: 28,
  },
  petNameLabel: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
    textTransform: 'capitalize',
  },
  petDescription: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  primaryCta: {
    borderRadius: 20,
    backgroundColor: HB_ACCENT,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryCtaText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT,
  },
});
