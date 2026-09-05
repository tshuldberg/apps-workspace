import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AreaChip,
  GlassCard,
  HABIT_TEMPLATES,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_HABIT_TYPES,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  createArea,
  createHabit,
  createHabitLink,
  createReminder,
  getAreas,
  getHabits,
  parseMagicFill,
  type DayOfWeek,
  type Frequency,
  type HabitTemplate,
  type HabitType,
  type TimeOfDay,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const STEP_LABELS = [
  'Name',
  'Type',
  'Frequency',
  'Area',
  'Reminders',
  'Stack',
  'Preview',
] as const;

const TYPE_OPTIONS: Array<{
  value: HabitType;
  title: string;
  subtitle: string;
  tint: string;
  icon: string;
}> = [
  {
    value: 'standard',
    title: 'Binary',
    subtitle: 'Simple yes / no habit like meditate.',
    tint: HB_ACCENT_LIGHT,
    icon: 'check_circle',
  },
  {
    value: 'timed',
    title: 'Timed',
    subtitle: 'Track a duration goal like read 30 min.',
    tint: HB_HABIT_TYPES.timed,
    icon: 'timer',
  },
  {
    value: 'measurable',
    title: 'Measurement',
    subtitle: 'Track a numeric target like 8 glasses.',
    tint: HB_HABIT_TYPES.measurement,
    icon: 'bar_chart',
  },
  {
    value: 'negative',
    title: 'Sobriety',
    subtitle: 'Avoid a trigger or abstain from a behavior.',
    tint: HB_HABIT_TYPES.sobriety,
    icon: 'close',
  },
];

const FREQUENCY_OPTIONS: Array<{
  value: Frequency;
  title: string;
  subtitle: string;
}> = [
  { value: 'daily', title: 'Daily', subtitle: 'Every day with a consistent cue.' },
  { value: 'specific_days', title: 'Specific Days', subtitle: 'Choose exact weekdays.' },
  { value: 'weekly', title: 'Weekly', subtitle: 'One anchor moment each week.' },
  { value: 'monthly', title: 'Monthly', subtitle: 'A lower-frequency custom cadence.' },
];

const TIME_OPTIONS: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'anytime'];
const DAY_OPTIONS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const AREA_COLORS = [
  '#30D158',
  '#A78BFA',
  '#FFB4AB',
  '#84CC16',
  '#FFB877',
  '#8BCFF0',
  '#9F8E81',
];

const AREA_ICONS = ['favorite', 'psychology', 'fitness_center', 'attach_money', 'people', 'eco'] as const;

const DEFAULT_TYPE_CONFIG: Record<HabitType, { icon: string; color: string }> = {
  standard: { icon: '✅', color: HB_ACCENT },
  timed: { icon: '⏱️', color: HB_HABIT_TYPES.timed },
  measurable: { icon: '📈', color: HB_HABIT_TYPES.measurement },
  negative: { icon: '🛡️', color: HB_HABIT_TYPES.sobriety },
};

type ReminderDraft = {
  time: string;
  label: string;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatFrequencyLabel(frequency: Frequency, specificDays: DayOfWeek[]) {
  if (frequency === 'specific_days' && specificDays.length > 0) {
    return specificDays.map((day) => DAY_LABELS[day]).join(' • ');
  }
  return frequency.replace('_', ' ');
}

function getTemplateDifficulty(template: HabitTemplate) {
  if (template.habitType === 'negative') return 'Disciplined';
  if (template.habitType === 'timed' && template.targetCount >= 1800) return 'Deep';
  if (template.habitType === 'measurable' && template.targetCount >= 8) return 'Steady';
  return 'Easy Start';
}

function getTemplateDescription(template: HabitTemplate) {
  if (template.habitType === 'timed') {
    return `${Math.round(template.targetCount / 60)} minutes ${template.timeOfDay}.`;
  }
  if (template.habitType === 'measurable' && template.unit) {
    return `${template.targetCount} ${template.unit} on a ${template.frequency} cadence.`;
  }
  if (template.habitType === 'negative') {
    return 'A sobriety-style habit focused on protecting your streak.';
  }
  return `A ${template.frequency} ritual for ${template.areaName.toLowerCase()}.`;
}

function Tile({
  title,
  subtitle,
  selected,
  onPress,
  tint,
  icon,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  tint: string;
  icon?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tile,
        selected ? { backgroundColor: `${tint}24` } : null,
      ]}
    >
      <View style={styles.tileHeader}>
        {icon ? (
          <View style={[styles.tileIcon, { backgroundColor: `${tint}24` }]}>
            <MaterialSymbol name={icon} size={18} color={tint} filled />
          </View>
        ) : null}
        <Text style={styles.tileTitle}>
          {title}
        </Text>
      </View>
      <Text style={styles.tileSubtitle}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

export default function AddHabitScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    templateId?: string | string[];
  }>();
  const mode = firstParam(params.mode);
  const templateId = firstParam(params.templateId);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [habitType, setHabitType] = useState<HabitType>('standard');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [specificDays, setSpecificDays] = useState<DayOfWeek[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('anytime');
  const [targetCount, setTargetCount] = useState('1');
  const [unit, setUnit] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaColor, setNewAreaColor] = useState(AREA_COLORS[0]);
  const [newAreaIcon, setNewAreaIcon] = useState<(typeof AREA_ICONS)[number]>('favorite');
  const [reminders, setReminders] = useState<ReminderDraft[]>([]);
  const [newReminderTime, setNewReminderTime] = useState('');
  const [newReminderLabel, setNewReminderLabel] = useState('');
  const [stackAfterHabitId, setStackAfterHabitId] = useState<string | null>(null);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const [magicFillPreview, setMagicFillPreview] = useState<ReturnType<typeof parseMagicFill> | null>(null);
  const [templateFilter, setTemplateFilter] = useState<string>('All');
  const [templateSearch, setTemplateSearch] = useState('');
  const appliedTemplateRef = useRef<string | null>(null);

  const areas = useMemo(() => getAreas(db), [db, step, areaId, newAreaName, reminders.length, selectedTemplateIndex]);
  const activeHabits = useMemo(() => getHabits(db, { isArchived: false }), [db, step, stackAfterHabitId]);
  const templates = useMemo(() => HABIT_TEMPLATES, []);

  useEffect(() => {
    if (!templateId || appliedTemplateRef.current === templateId) {
      return;
    }

    const templateIndex = Number.parseInt(templateId, 10);
    if (Number.isNaN(templateIndex) || templateIndex < 0 || templateIndex >= templates.length) {
      return;
    }

    const template = templates[templateIndex];
    appliedTemplateRef.current = templateId;
    setSelectedTemplateIndex(templateIndex);
    setName(template.name);
    setHabitType(template.habitType);
    setFrequency(template.frequency);
    setTimeOfDay(template.timeOfDay);
    setTargetCount(String(template.habitType === 'timed' ? Math.round(template.targetCount / 60) : template.targetCount));
    setUnit(template.unit ?? '');
    setStep(1);

    const matchingArea = areas.find((area) => area.name.toLowerCase() === template.areaName.toLowerCase());
    if (matchingArea) {
      setAreaId(matchingArea.id);
    }
  }, [areas, templateId, templates]);

  const hasUnsavedChanges = useMemo(() => {
    return Boolean(
      name.trim()
      || reminders.length > 0
      || stackAfterHabitId
      || areaId
      || selectedTemplateIndex != null
      || specificDays.length > 0
      || targetCount !== '1'
      || unit.trim(),
    );
  }, [areaId, name, reminders.length, selectedTemplateIndex, specificDays.length, stackAfterHabitId, targetCount, unit]);

  const progress = ((step + 1) / STEP_LABELS.length) * 100;
  const resolvedTypeConfig = DEFAULT_TYPE_CONFIG[habitType];
  const selectedTemplate = selectedTemplateIndex != null ? templates[selectedTemplateIndex] : null;
  const filteredTemplates = templates.filter((template) => {
    if (templateFilter !== 'All' && template.areaName.toLowerCase() !== templateFilter.toLowerCase()) {
      return false;
    }
    if (!templateSearch.trim()) {
      return true;
    }
    return `${template.name} ${template.areaName}`.toLowerCase().includes(templateSearch.toLowerCase());
  });

  const handleClose = () => {
    if (!hasUnsavedChanges) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard changes?',
      'You have unsaved habit setup changes.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ],
    );
  };

  const handleMagicFill = () => {
    if (!name.trim()) {
      Alert.alert('MyHabits', 'Start with a habit name before using Magic Fill.');
      return;
    }
    const result = parseMagicFill(name);
    setMagicFillPreview(result);
  };

  const applyMagicFill = () => {
    if (!magicFillPreview) {
      return;
    }

    setName(magicFillPreview.name);
    setHabitType(magicFillPreview.habitType);
    setFrequency(magicFillPreview.frequency);
    setTimeOfDay(magicFillPreview.timeOfDay);
    setTargetCount(String(
      magicFillPreview.habitType === 'timed'
        ? Math.round(magicFillPreview.targetCount / 60)
        : magicFillPreview.targetCount,
    ));
    setUnit(magicFillPreview.unit ?? '');
    setSpecificDays(magicFillPreview.specificDays ?? []);
    setMagicFillPreview(null);
    setStep(1);
  };

  const applyTemplate = (template: HabitTemplate, index: number) => {
    setSelectedTemplateIndex(index);
    setName(template.name);
    setHabitType(template.habitType);
    setFrequency(template.frequency);
    setTimeOfDay(template.timeOfDay);
    setTargetCount(String(template.habitType === 'timed' ? Math.round(template.targetCount / 60) : template.targetCount));
    setUnit(template.unit ?? '');
    const matchingArea = areas.find((area) => area.name.toLowerCase() === template.areaName.toLowerCase());
    if (matchingArea) {
      setAreaId(matchingArea.id);
    }
    setStep(1);
  };

  const toggleDay = (day: DayOfWeek) => {
    setSpecificDays((current) => (
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day]
    ));
  };

  const createAreaInline = () => {
    if (!newAreaName.trim()) {
      Alert.alert('MyHabits', 'Enter an area name first.');
      return;
    }

    try {
      const id = uuid();
      createArea(db, id, {
        name: newAreaName.trim(),
        color: newAreaColor,
        icon: newAreaIcon,
      });
      setAreaId(id);
      setNewAreaName('');
    } catch (error) {
      Alert.alert('MyHabits', error instanceof Error ? error.message : 'Unable to create this area.');
    }
  };

  const addReminder = () => {
    if (!/^\d{2}:\d{2}$/.test(newReminderTime)) {
      Alert.alert('MyHabits', 'Use HH:MM for reminder time.');
      return;
    }

    setReminders((current) => [
      ...current,
      {
        time: newReminderTime,
        label: newReminderLabel.trim(),
      },
    ]);
    setNewReminderTime('');
    setNewReminderLabel('');
  };

  const validateStep = () => {
    if (step === 0 && !name.trim()) {
      Alert.alert('MyHabits', 'Give this habit a name before continuing.');
      return false;
    }
    if (step === 2 && frequency === 'specific_days' && specificDays.length === 0) {
      Alert.alert('MyHabits', 'Choose at least one day for a specific-days schedule.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }
    setStep((current) => Math.min(current + 1, STEP_LABELS.length - 1));
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('MyHabits', 'This habit needs a name.');
      return;
    }

    try {
      const habitId = uuid();
      createHabit(db, habitId, {
        name: name.trim(),
        icon: selectedTemplate?.icon ?? resolvedTypeConfig.icon,
        color: selectedTemplate?.color ?? resolvedTypeConfig.color,
        habitType,
        frequency,
        timeOfDay,
        targetCount: habitType === 'timed'
          ? (Number.parseInt(targetCount, 10) || 1) * 60
          : (Number.parseInt(targetCount, 10) || 1),
        specificDays: frequency === 'specific_days' ? specificDays : undefined,
        unit: habitType === 'measurable' ? (unit.trim() || undefined) : undefined,
        areaId: areaId ?? undefined,
        description: selectedTemplate
          ? getTemplateDescription(selectedTemplate)
          : magicFillPreview?.name
            ? `Magic Fill suggestion based on ${magicFillPreview.name}.`
            : undefined,
      });

      for (const reminder of reminders) {
        createReminder(db, uuid(), habitId, reminder.time, reminder.label || undefined);
      }

      if (stackAfterHabitId) {
        createHabitLink(db, {
          parentHabitId: stackAfterHabitId,
          childHabitId: habitId,
          linkType: 'after',
          sortOrder: 0,
        });
      }

      router.replace(`/(habits)/${habitId}`);
    } catch (error) {
      Alert.alert('MyHabits', error instanceof Error ? error.message : 'Unable to create this habit.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <GlassCard level={2} contentStyle={styles.headerCard}>
        <Pressable onPress={handleClose} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Close</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>
            Step {step + 1} of {STEP_LABELS.length}
          </Text>
          <Text style={styles.headerTitle}>
            {STEP_LABELS[step]}
          </Text>
        </View>
        <View style={styles.headerProgressWrap}>
          <View style={styles.headerProgressTrack}>
            <View style={[styles.headerProgressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </GlassCard>

      <GlassCard level={4} contentStyle={styles.heroCard}>
        <Text style={styles.heroTitle}>
          Craft a habit that feels inevitable.
        </Text>
        <Text style={styles.heroCopy}>
          Use templates, Magic Fill, reminders, and stacking to build a habit that already fits your day.
        </Text>
        {selectedTemplate ? (
          <View style={styles.templateBanner}>
            <Text style={styles.templateBannerEyebrow}>Template selected</Text>
            <Text style={styles.templateBannerTitle}>{selectedTemplate.name}</Text>
            <Text style={styles.templateBannerCopy}>{getTemplateDescription(selectedTemplate)}</Text>
          </View>
        ) : null}
      </GlassCard>

      {step === 0 ? (
        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="What habit?" action={{ label: 'Templates', onPress: () => router.push('/(habits)/templates') }} />
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Deep work block"
            placeholderTextColor={HB_TEXT_TERTIARY}
            style={styles.nameInput}
          />
          <View style={styles.inlineButtons}>
            <Pressable onPress={handleMagicFill} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Magic Fill</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(habits)/templates?source=wizard')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Choose from Template</Text>
            </Pressable>
          </View>

          {magicFillPreview ? (
            <GlassCard level={1} contentStyle={styles.magicCard}>
              <SectionHeader title="Magic Fill Suggestion" action={{ label: 'Apply', onPress: applyMagicFill }} />
              <Text style={styles.magicName}>{magicFillPreview.name}</Text>
              <View style={styles.metaRail}>
                <AreaChip area={{ name: magicFillPreview.habitType, color: TYPE_OPTIONS.find((option) => option.value === magicFillPreview.habitType)?.tint ?? HB_ACCENT_LIGHT }} />
                <AreaChip area={{ name: magicFillPreview.frequency, color: HB_ACCENT_LIGHT }} />
                <AreaChip area={{ name: magicFillPreview.timeOfDay, color: HB_HABIT_TYPES.timed }} />
              </View>
              <Text style={styles.magicCopy}>
                Confidence {Math.round(magicFillPreview.confidence * 100)}%.
              </Text>
            </GlassCard>
          ) : null}

          {(mode === 'template' || templateSearch.length > 0) ? (
            <GlassCard level={1} contentStyle={styles.templateModeCard}>
              <SectionHeader title="Template Mode" />
              <View style={styles.filterRail}>
                {['All', 'Health', 'Mindfulness', 'Fitness', 'Work', 'Personal', 'Learning'].map((filter) => (
                  <Pressable
                    key={filter}
                    onPress={() => setTemplateFilter(filter)}
                    style={[styles.filterChip, templateFilter === filter ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterChipText, templateFilter === filter ? styles.filterChipTextActive : null]}>
                      {filter}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={templateSearch}
                onChangeText={setTemplateSearch}
                placeholder="Search template names"
                placeholderTextColor={HB_TEXT_TERTIARY}
                style={styles.inlineInput}
              />
              <View style={styles.templateList}>
                {filteredTemplates.slice(0, 4).map((template) => {
                  const actualIndex = templates.findIndex((entry) => entry.name === template.name);
                  return (
                    <Pressable key={template.name} onPress={() => applyTemplate(template, actualIndex)} style={styles.templateCard}>
                      <View>
                        <Text style={styles.templateCardTitle}>{template.name}</Text>
                        <Text style={styles.templateCardCopy}>{getTemplateDescription(template)}</Text>
                      </View>
                      <Text style={styles.templateCardDifficulty}>{getTemplateDifficulty(template)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          ) : null}
        </GlassCard>
      ) : null}

      {step === 1 ? (
        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Choose a type" />
          <View style={styles.tileGrid}>
            {TYPE_OPTIONS.map((option) => (
              <Tile
                key={option.value}
                title={option.title}
                subtitle={option.subtitle}
                tint={option.tint}
                icon={option.icon}
                selected={habitType === option.value}
                onPress={() => setHabitType(option.value)}
              />
            ))}
          </View>
        </GlassCard>
      ) : null}

      {step === 2 ? (
        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Frequency + goal" />
          <View style={styles.tileGrid}>
            {FREQUENCY_OPTIONS.map((option) => (
              <Tile
                key={option.value}
                title={option.title}
                subtitle={option.subtitle}
                tint={HB_ACCENT_LIGHT}
                selected={frequency === option.value}
                onPress={() => setFrequency(option.value)}
              />
            ))}
          </View>
          {frequency === 'specific_days' ? (
            <View style={styles.dayRail}>
              {DAY_OPTIONS.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(day)}
                  style={[styles.dayChip, specificDays.includes(day) ? styles.dayChipActive : null]}
                >
                  <Text style={[styles.dayChipText, specificDays.includes(day) ? styles.dayChipTextActive : null]}>
                    {DAY_LABELS[day]}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.timeRail}>
            {TIME_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setTimeOfDay(option)}
                style={[styles.filterChip, timeOfDay === option ? styles.filterChipActive : null]}
              >
                <Text style={[styles.filterChipText, timeOfDay === option ? styles.filterChipTextActive : null]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          {habitType === 'timed' ? (
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Target duration (minutes)</Text>
              <TextInput
                value={targetCount}
                onChangeText={setTargetCount}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={HB_TEXT_TERTIARY}
                style={styles.inlineInput}
              />
            </View>
          ) : null}

          {habitType === 'measurable' ? (
            <View style={styles.goalStack}>
              <Text style={styles.goalLabel}>Target value</Text>
              <View style={styles.goalInputs}>
                <TextInput
                  value={targetCount}
                  onChangeText={setTargetCount}
                  keyboardType="number-pad"
                  placeholder="8"
                  placeholderTextColor={HB_TEXT_TERTIARY}
                  style={[styles.inlineInput, styles.goalInput]}
                />
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="glasses"
                  placeholderTextColor={HB_TEXT_TERTIARY}
                  style={[styles.inlineInput, styles.goalInput]}
                />
              </View>
            </View>
          ) : null}
        </GlassCard>
      ) : null}

      {step === 3 ? (
        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Choose an area" action={{ label: 'Manage', onPress: () => router.push('/(habits)/areas') }} />
          <View style={styles.metaRail}>
            <Pressable onPress={() => setAreaId(null)} style={[styles.filterChip, areaId == null ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, areaId == null ? styles.filterChipTextActive : null]}>None</Text>
            </Pressable>
            {areas.map((area) => (
              <AreaChip
                key={area.id}
                area={{ name: area.name, color: area.color, icon: area.icon }}
                selected={areaId === area.id}
                onPress={() => setAreaId(area.id)}
              />
            ))}
          </View>
          <GlassCard level={1} contentStyle={styles.newAreaCard}>
            <SectionHeader title="Custom area" />
            <TextInput
              value={newAreaName}
              onChangeText={setNewAreaName}
              placeholder="Create a new area"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.inlineInput}
            />
            <View style={styles.colorRail}>
              {AREA_COLORS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setNewAreaColor(color)}
                  style={[styles.colorDot, { backgroundColor: color }, newAreaColor === color ? styles.colorDotActive : null]}
                />
              ))}
            </View>
            <View style={styles.filterRail}>
              {AREA_ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  onPress={() => setNewAreaIcon(icon)}
                  style={[styles.iconChip, newAreaIcon === icon ? styles.iconChipActive : null]}
                >
                  <MaterialSymbol name={icon} size={16} color={newAreaIcon === icon ? HB_SURFACES.lowest : HB_TEXT_SECONDARY} filled />
                </Pressable>
              ))}
            </View>
            <Pressable onPress={createAreaInline} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Add Area</Text>
            </Pressable>
          </GlassCard>
        </GlassCard>
      ) : null}

      {step === 4 ? (
        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Reminders" action={{ label: 'Skip', onPress: () => setStep(5) }} />
          <View style={styles.listSection}>
            {reminders.map((reminder, index) => (
              <GlassCard key={`${reminder.time}-${index}`} level={1} contentStyle={styles.templateCard}>
                <View>
                  <Text style={styles.templateCardTitle}>{reminder.time}</Text>
                  <Text style={styles.templateCardCopy}>{reminder.label || 'Daily cue'}</Text>
                </View>
                <Pressable onPress={() => setReminders((current) => current.filter((_, value) => value !== index))}>
                  <Text style={styles.dangerText}>Remove</Text>
                </Pressable>
              </GlassCard>
            ))}
          </View>
          <TextInput
            value={newReminderTime}
            onChangeText={setNewReminderTime}
            placeholder="08:30"
            placeholderTextColor={HB_TEXT_TERTIARY}
            style={styles.inlineInput}
          />
          <TextInput
            value={newReminderLabel}
            onChangeText={setNewReminderLabel}
            placeholder="Morning cue"
            placeholderTextColor={HB_TEXT_TERTIARY}
            style={styles.inlineInput}
          />
          <Pressable onPress={addReminder} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Add Reminder</Text>
          </Pressable>
        </GlassCard>
      ) : null}

      {step === 5 ? (
        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Habit Stack" action={{ label: 'Later', onPress: () => setStackAfterHabitId(null) }} />
          <Text style={styles.sectionCopy}>
            Stack this new habit after an existing routine so it has a natural cue.
          </Text>
          <View style={styles.listSection}>
            {activeHabits.filter((habit) => habit.name !== name.trim()).slice(0, 8).map((habit) => (
              <Pressable
                key={habit.id}
                onPress={() => setStackAfterHabitId(habit.id)}
                style={[styles.templateCard, stackAfterHabitId === habit.id ? styles.selectedCard : null]}
              >
                <View>
                  <Text style={styles.templateCardTitle}>{habit.name}</Text>
                  <Text style={styles.templateCardCopy}>{formatFrequencyLabel(habit.frequency, habit.specificDays ?? [])}</Text>
                </View>
                <Text style={styles.templateCardDifficulty}>
                  {stackAfterHabitId === habit.id ? 'Selected' : 'Use'}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      ) : null}

      {step === 6 ? (
        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Preview + Save" />
          <GlassCard level={1} contentStyle={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={[styles.previewIcon, { backgroundColor: `${resolvedTypeConfig.color}24` }]}>
                <Text style={styles.previewIconText}>{selectedTemplate?.icon ?? resolvedTypeConfig.icon}</Text>
              </View>
              <View style={styles.previewCopy}>
                <Text style={styles.previewTitle}>{name || 'New Habit'}</Text>
                <Text style={styles.previewSubtitle}>
                  {TYPE_OPTIONS.find((option) => option.value === habitType)?.title} • {formatFrequencyLabel(frequency, specificDays)}
                </Text>
              </View>
            </View>
            <View style={styles.metaRail}>
              <AreaChip area={{ name: timeOfDay, color: HB_HABIT_TYPES.timed }} />
              {areaId ? (
                <AreaChip
                  area={{
                    name: areas.find((area) => area.id === areaId)?.name ?? 'Area',
                    color: areas.find((area) => area.id === areaId)?.color,
                    icon: areas.find((area) => area.id === areaId)?.icon,
                  }}
                />
              ) : null}
              {reminders.length > 0 ? <AreaChip area={{ name: `${reminders.length} reminder${reminders.length === 1 ? '' : 's'}`, color: HB_ACCENT_LIGHT }} /> : null}
            </View>
            <Text style={styles.previewNote}>
              {selectedTemplate ? getTemplateDescription(selectedTemplate) : 'This setup will save directly into your habits list with the selected cues and reminders.'}
            </Text>
            {stackAfterHabitId ? (
              <Text style={styles.previewStack}>
                Stacked after {activeHabits.find((habit) => habit.id === stackAfterHabitId)?.name ?? 'selected habit'}.
              </Text>
            ) : null}
          </GlassCard>
          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save Habit</Text>
          </Pressable>
        </GlassCard>
      ) : null}

      <View style={styles.footerNav}>
        <Pressable
          onPress={() => setStep((current) => Math.max(current - 1, 0))}
          style={[styles.secondaryButton, step === 0 ? styles.disabledButton : null]}
          disabled={step === 0}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Pressable
          onPress={step === STEP_LABELS.length - 1 ? handleSave : handleNext}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{step === STEP_LABELS.length - 1 ? 'Save Habit' : 'Continue'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.base,
  },
  content: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 140,
  },
  headerCard: {
    gap: 12,
  },
  headerAction: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: `${HB_ACCENT}18`,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerActionText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  headerCopy: {
    gap: 6,
  },
  headerEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  headerTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  headerProgressWrap: {
    gap: 8,
  },
  headerProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.lowest,
    overflow: 'hidden',
  },
  headerProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
  },
  heroCard: {
    gap: 10,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  heroCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  templateBanner: {
    marginTop: 6,
    borderRadius: 18,
    backgroundColor: `${HB_ACCENT}18`,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  templateBannerEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  templateBannerTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  templateBannerCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  sectionCard: {
    gap: 12,
  },
  nameInput: {
    ...HB_TYPOGRAPHY.displayLg,
    borderRadius: 20,
    backgroundColor: HB_SURFACES.lowest,
    color: HB_TEXT,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_SURFACES.lowest,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: HB_SURFACES.lowest,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
  },
  disabledButton: {
    opacity: 0.45,
  },
  magicCard: {
    gap: 10,
  },
  magicName: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  magicCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  templateModeCard: {
    gap: 10,
  },
  filterRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.lowest,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: HB_ACCENT,
  },
  filterChipText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: HB_SURFACES.lowest,
  },
  inlineInput: {
    ...HB_TYPOGRAPHY.bodyMd,
    borderRadius: 16,
    backgroundColor: HB_SURFACES.lowest,
    color: HB_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  templateList: {
    gap: 10,
  },
  templateCard: {
    alignItems: 'center',
    backgroundColor: HB_SURFACES.lowest,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectedCard: {
    backgroundColor: `${HB_ACCENT}18`,
  },
  templateCardTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
  },
  templateCardCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginTop: 4,
    maxWidth: 240,
  },
  templateCardDifficulty: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  tileGrid: {
    gap: 10,
  },
  tile: {
    borderRadius: 20,
    backgroundColor: HB_SURFACES.lowest,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  tileIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  tileTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  tileSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  dayRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: HB_SURFACES.lowest,
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayChipActive: {
    backgroundColor: HB_ACCENT,
  },
  dayChipText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
  },
  dayChipTextActive: {
    color: HB_SURFACES.lowest,
  },
  timeRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalRow: {
    gap: 8,
  },
  goalStack: {
    gap: 8,
  },
  goalLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  goalInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  goalInput: {
    flex: 1,
  },
  metaRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  newAreaCard: {
    gap: 12,
  },
  colorRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    borderRadius: 14,
    height: 28,
    width: 28,
  },
  colorDotActive: {
    borderColor: HB_TEXT,
    borderWidth: 2,
  },
  iconChip: {
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: HB_SURFACES.lowest,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 38,
  },
  iconChipActive: {
    backgroundColor: HB_ACCENT,
  },
  listSection: {
    gap: 10,
  },
  sectionCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  dangerText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_HABIT_TYPES.sobriety,
  },
  previewCard: {
    gap: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewIcon: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  previewIconText: {
    fontSize: 22,
  },
  previewCopy: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  previewSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  previewNote: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  previewStack: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_ACCENT_LIGHT,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  saveButtonText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_SURFACES.lowest,
  },
  footerNav: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
  },
});
