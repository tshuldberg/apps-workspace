import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  Factor,
  FactorCreateInput,
  FactorLogDraft,
  FactorLogMode,
  SleepEntryRecord,
} from '@mylife/sleep';
import {
  buildFactorCreateInput,
  FACTOR_ROOM_LIGHT_OPTIONS,
  FACTOR_ROOM_NOISE_OPTIONS,
  FACTOR_ROOM_TEMP_OPTIONS,
  formatFactorClockTime,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  getDefaultFactorLogMode,
  getFactorLogDraftFromFactor,
  getFactorRoomLightMeta,
  getFactorRoomNoiseMeta,
  getFactorRoomTempMeta,
  getPreSleepActivityMeta,
  getSleepSupplementMeta,
  getStressLevelMeta,
  PRE_SLEEP_ACTIVITY_OPTIONS,
  resolveFactorLogDate,
  SLEEP_SUPPLEMENT_OPTIONS,
  STRESS_LEVEL_OPTIONS,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { SLEEP_ACCENT } from './_ui';

type DraftUpdater = (draft: FactorLogDraft) => FactorLogDraft;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseTime(value: string): { hours: number; minutes: number } {
  const [hours, minutes] = value.split(':').map(Number);
  return { hours, minutes };
}

function formatTimeValue(hours: number, minutes: number): string {
  return `${pad(hours)}:${pad(minutes)}`;
}

function getDisplayTime(value: string): {
  hours12: number;
  minutes: number;
  period: 'AM' | 'PM';
} {
  const { hours, minutes } = parseTime(value || '00:00');
  return {
    hours12: hours % 12 || 12,
    minutes,
    period: hours >= 12 ? 'PM' : 'AM',
  };
}

function fromDisplayTime(
  hours12: number,
  minutes: number,
  period: 'AM' | 'PM',
): string {
  const normalized = hours12 % 12;
  const hours = period === 'PM' ? normalized + 12 : normalized;
  return formatTimeValue(hours % 24, minutes);
}

function shiftHours(value: string, delta: number): string {
  const { hours, minutes } = parseTime(value || '00:00');
  return formatTimeValue((hours + delta + 24) % 24, minutes);
}

function shiftMinutes(value: string, delta: number): string {
  const { hours, minutes } = parseTime(value || '00:00');
  const total = (hours * 60) + minutes + delta;
  const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  return formatTimeValue(
    Math.floor(normalized / 60),
    normalized % 60,
  );
}

function toggleChip<T extends string>(
  values: readonly T[],
  value: T,
): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function SleepFactorForm({
  closeLabel,
  factorsByMode,
  initialMode,
  initialQuick,
  linkedEntry,
  onClose,
  onSave,
  referenceNow,
}: {
  closeLabel: string;
  factorsByMode: Partial<Record<FactorLogMode, Factor | null>>;
  initialMode?: FactorLogMode;
  initialQuick?: boolean;
  linkedEntry: SleepEntryRecord | null;
  onClose: () => void;
  onSave: (input: FactorCreateInput) => Promise<void> | void;
  referenceNow: Date;
}) {
  const [mode, setMode] = useState<FactorLogMode>(
    initialMode ?? getDefaultFactorLogMode(referenceNow),
  );
  const [quickMode, setQuickMode] = useState(Boolean(initialQuick));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<FactorLogMode, FactorLogDraft>>({
    tonight: getFactorLogDraftFromFactor(factorsByMode.tonight ?? null),
    last_night: getFactorLogDraftFromFactor(factorsByMode.last_night ?? null),
  });

  const currentFactor = linkedEntry
    ? factorsByMode.last_night ?? null
    : factorsByMode[mode] ?? null;
  const targetDate = linkedEntry?.date ?? resolveFactorLogDate(mode, referenceNow);
  const currentDraft = linkedEntry ? drafts.last_night : drafts[mode];
  const targetDateLabel = formatSleepEntryDateLabel(targetDate);
  const stressMeta = getStressLevelMeta(currentDraft.stressLevel);

  function updateDraft(updater: DraftUpdater): void {
    const key: FactorLogMode = linkedEntry ? 'last_night' : mode;
    setDrafts((current) => ({
      ...current,
      [key]: updater(current[key]),
    }));
  }

  async function handleSave(): Promise<void> {
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSave(
        buildFactorCreateInput(currentDraft, {
          date: targetDate,
          sleepEntryId: linkedEntry?.id ?? currentFactor?.sleep_entry_id ?? null,
        }),
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Could not save this factor log.',
      );
      setIsSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{closeLabel}</Text>
        </Pressable>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {linkedEntry ? 'Linked night' : mode === 'tonight' ? 'Tonight' : 'Last night'}
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{linkedEntry ? 'Sleep Factors' : 'Evening Factors'}</Text>
        <Text style={styles.heroTitle}>
          {quickMode ? 'Quick factor check-in' : `Factor log for ${targetDateLabel}`}
        </Text>
        <Text style={styles.heroSubtitle}>
          {quickMode
            ? 'Quick log keeps the focus on stress, caffeine, and exercise so you can save in a few taps.'
            : 'Everything stays optional. Save only the context that actually feels memorable.'}
        </Text>

        <View style={styles.heroPillRow}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>Target night {targetDateLabel}</Text>
          </View>
          {stressMeta ? (
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                Stress {stressMeta.emoji} {stressMeta.label}
              </Text>
            </View>
          ) : null}
        </View>

        {linkedEntry ? (
          <Text style={styles.linkedCopy}>
            Linked sleep window: {formatSleepTimeLabel(linkedEntry.bedtime)} to{' '}
            {formatSleepTimeLabel(linkedEntry.wake_time)}
          </Text>
        ) : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleGrid}>
          <ModeCard
            active={!quickMode}
            label="Full log"
            detail="All optional fields visible."
            onPress={() => setQuickMode(false)}
          />
          <ModeCard
            active={quickMode}
            label="Quick log"
            detail="Stress, caffeine, and exercise only."
            onPress={() => setQuickMode(true)}
          />
        </View>

        {!linkedEntry ? (
          <View style={styles.toggleGrid}>
            <ModeCard
              active={mode === 'tonight'}
              label="Tonight"
              detail="For the sleep you are about to have."
              onPress={() => setMode('tonight')}
            />
            <ModeCard
              active={mode === 'last_night'}
              label="Last night"
              detail="For the sleep you just finished."
              onPress={() => setMode('last_night')}
            />
          </View>
        ) : null}

        <Text style={styles.helperText}>
          {currentFactor
            ? currentFactor.sleep_entry_id
              ? 'Saving again updates the factor log already attached to this sleep entry.'
              : 'Saving again updates the existing factor log for this night.'
            : 'Nothing is required here. Save a three-field quick check-in or the full evening log.'}
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Quick log</Text>
        <TimeControl
          helper="When was the last coffee, tea, soda, or energy drink?"
          label="Caffeine cutoff"
          value={currentDraft.lastCaffeineTime}
          onChange={(value) =>
            updateDraft((draft) => ({ ...draft, lastCaffeineTime: value }))
          }
        />

        <View style={styles.fieldCard}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldTitle}>Exercise</Text>
            <Switch
              value={currentDraft.exerciseToday}
              onValueChange={(value) =>
                updateDraft((draft) => ({
                  ...draft,
                  exerciseToday: value,
                  exerciseTime: value ? draft.exerciseTime : '',
                }))
              }
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.border, true: SLEEP_ACCENT }}
            />
          </View>
          <Text style={styles.helperText}>
            Toggle on if you exercised at any point during the day.
          </Text>
          {currentDraft.exerciseToday ? (
            <TimeControl
              compact
              helper="Optional time if it feels relevant."
              label="Exercise time"
              value={currentDraft.exerciseTime}
              onChange={(value) =>
                updateDraft((draft) => ({ ...draft, exerciseTime: value }))
              }
            />
          ) : null}
        </View>

        <View style={styles.fieldCard}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldTitle}>Stress level</Text>
            <Text style={styles.fieldValue}>
              {stressMeta ? `${stressMeta.emoji} ${stressMeta.label}` : 'Optional'}
            </Text>
          </View>
          <Text style={styles.helperText}>
            Pick the stress load that best matches the evening or the morning after.
          </Text>
          <View style={styles.stressGrid}>
            {STRESS_LEVEL_OPTIONS.map((option) => {
              const selected = currentDraft.stressLevel === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    updateDraft((draft) => ({
                      ...draft,
                      stressLevel: selected ? null : option.value,
                    }))
                  }
                  style={[
                    styles.stressCard,
                    selected ? styles.stressCardSelected : null,
                  ]}
                >
                  <Text style={styles.stressEmoji}>{option.emoji}</Text>
                  <Text style={styles.stressLabel}>{option.label}</Text>
                  <Text style={styles.stressDetail}>{option.detail}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {!quickMode ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Cutoffs and substances</Text>
            <TimeControl
              helper="When did you last eat anything substantial?"
              label="Meal cutoff"
              value={currentDraft.lastMealTime}
              onChange={(value) =>
                updateDraft((draft) => ({ ...draft, lastMealTime: value }))
              }
            />
            <TimeControl
              helper="When did screens go down for the night?"
              label="Screen cutoff"
              value={currentDraft.screenCutoffTime}
              onChange={(value) =>
                updateDraft((draft) => ({ ...draft, screenCutoffTime: value }))
              }
            />
            <StepperField
              label="Alcohol"
              detail="Count drinks between 0 and 10."
              value={currentDraft.alcoholDrinks}
              onChange={(value) =>
                updateDraft((draft) => ({ ...draft, alcoholDrinks: value }))
              }
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Pre-sleep activities</Text>
            <ChipGrid
              options={PRE_SLEEP_ACTIVITY_OPTIONS.map((option) => ({
                ...option,
                selected: currentDraft.preSleepActivities.includes(option.value),
                onPress: () =>
                  updateDraft((draft) => ({
                    ...draft,
                    preSleepActivities: toggleChip(
                      draft.preSleepActivities,
                      option.value,
                    ),
                  })),
              }))}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Room conditions</Text>
            <ChoiceColumn
              label="Temperature"
              options={FACTOR_ROOM_TEMP_OPTIONS.map((option) => ({
                ...option,
                selected: currentDraft.roomTemp === option.value,
                onPress: () =>
                  updateDraft((draft) => ({
                    ...draft,
                    roomTemp:
                      draft.roomTemp === option.value ? null : option.value,
                  })),
              }))}
            />
            <ChoiceColumn
              label="Light"
              options={FACTOR_ROOM_LIGHT_OPTIONS.map((option) => ({
                ...option,
                selected: currentDraft.roomLight === option.value,
                onPress: () =>
                  updateDraft((draft) => ({
                    ...draft,
                    roomLight:
                      draft.roomLight === option.value ? null : option.value,
                  })),
              }))}
            />
            <ChoiceColumn
              label="Noise"
              options={FACTOR_ROOM_NOISE_OPTIONS.map((option) => ({
                ...option,
                selected: currentDraft.roomNoise === option.value,
                onPress: () =>
                  updateDraft((draft) => ({
                    ...draft,
                    roomNoise:
                      draft.roomNoise === option.value ? null : option.value,
                  })),
              }))}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Supplements</Text>
            <ChipGrid
              options={SLEEP_SUPPLEMENT_OPTIONS.map((option) => ({
                ...option,
                selected: currentDraft.supplements.includes(option.value),
                onPress: () =>
                  updateDraft((draft) => ({
                    ...draft,
                    supplements: toggleChip(draft.supplements, option.value),
                  })),
              }))}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Disturbances note</Text>
            <Text style={styles.helperText}>
              Bed partner, pet, temperature drift, noise spike, or anything else worth remembering later.
            </Text>
            <TextInput
              multiline
              onChangeText={(value) =>
                updateDraft((draft) => ({
                  ...draft,
                  disturbancesNote: value,
                }))
              }
              placeholder="Optional note"
              placeholderTextColor={colors.textSecondary}
              style={styles.notesInput}
              textAlignVertical="top"
              value={currentDraft.disturbancesNote}
            />
          </View>
        </>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>What will be saved</Text>
        <View style={styles.summaryGrid}>
          <SummaryTile
            label="Caffeine"
            value={formatFactorClockTime(currentDraft.lastCaffeineTime) ?? 'Not logged'}
          />
          <SummaryTile
            label="Exercise"
            value={
              currentDraft.exerciseToday
                ? formatFactorClockTime(currentDraft.exerciseTime) ?? 'Yes'
                : 'No'
            }
          />
          <SummaryTile
            label="Stress"
            value={stressMeta ? `${stressMeta.emoji} ${stressMeta.label}` : 'Not logged'}
          />
          {!quickMode ? (
            <>
              <SummaryTile
                label="Activities"
                value={
                  currentDraft.preSleepActivities.length > 0
                    ? currentDraft.preSleepActivities
                        .slice(0, 3)
                        .map((value) => getPreSleepActivityMeta(value).label)
                        .join(', ')
                    : 'None selected'
                }
              />
              <SummaryTile
                label="Supplements"
                value={
                  currentDraft.supplements.length > 0
                    ? currentDraft.supplements
                        .slice(0, 3)
                        .map((value) => getSleepSupplementMeta(value).label)
                        .join(', ')
                    : 'None selected'
                }
              />
              <SummaryTile
                label="Environment"
                value={[
                  currentDraft.roomTemp
                    ? getFactorRoomTempMeta(currentDraft.roomTemp).label
                    : null,
                  currentDraft.roomLight
                    ? getFactorRoomLightMeta(currentDraft.roomLight).label
                    : null,
                  currentDraft.roomNoise
                    ? getFactorRoomNoiseMeta(currentDraft.roomNoise).label
                    : null,
                ].filter(Boolean).join(' / ') || 'Not logged'}
              />
            </>
          ) : null}
        </View>

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <Pressable
          onPress={() => {
            void handleSave();
          }}
          style={[
            styles.primaryButton,
            isSaving ? styles.primaryButtonDisabled : null,
          ]}
          disabled={isSaving}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving
              ? 'Saving…'
              : quickMode
                ? 'Save Quick Log'
                : 'Save Factor Log'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ModeCard({
  active,
  detail,
  label,
  onPress,
}: {
  active: boolean;
  detail: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeCard, active ? styles.modeCardSelected : null]}
    >
      <Text style={styles.modeTitle}>{label}</Text>
      <Text style={styles.modeBody}>{detail}</Text>
    </Pressable>
  );
}

function TimeControl({
  compact = false,
  helper,
  label,
  onChange,
  value,
}: {
  compact?: boolean;
  helper: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const { hours12, minutes, period } = getDisplayTime(value || '00:00');

  return (
    <View style={compact ? styles.compactTimeCard : styles.timeCard}>
      <Text style={styles.fieldTitle}>{label}</Text>
      <Text style={styles.timeValue}>{formatFactorClockTime(value) ?? 'Optional'}</Text>
      <Text style={styles.helperText}>{helper}</Text>

      <View style={styles.timeGrid}>
        <StepperTile
          label="Hour"
          value={String(hours12)}
          onDecrement={() => onChange(shiftHours(value || '00:00', -1))}
          onIncrement={() => onChange(shiftHours(value || '00:00', 1))}
        />
        <StepperTile
          label="Minutes"
          value={pad(minutes)}
          onDecrement={() => onChange(shiftMinutes(value || '00:00', -5))}
          onIncrement={() => onChange(shiftMinutes(value || '00:00', 5))}
        />
      </View>

      <View style={styles.periodRow}>
        {(['AM', 'PM'] as const).map((candidate) => (
          <Pressable
            key={candidate}
            onPress={() => onChange(fromDisplayTime(hours12, minutes, candidate))}
            style={[
              styles.periodButton,
              candidate === period ? styles.periodButtonSelected : null,
            ]}
          >
            <Text
              style={[
                styles.periodButtonText,
                candidate === period ? styles.periodButtonTextSelected : null,
              ]}
            >
              {candidate}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function StepperTile({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.timeTile}>
      <Text style={styles.timeTileLabel}>{label}</Text>
      <View style={styles.timeTileControls}>
        <Pressable onPress={onDecrement} style={styles.timeTileButton}>
          <Text style={styles.timeTileButtonText}>-</Text>
        </Pressable>
        <Text style={styles.timeTileValue}>{value}</Text>
        <Pressable onPress={onIncrement} style={styles.timeTileButton}>
          <Text style={styles.timeTileButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StepperField({
  detail,
  label,
  onChange,
  value,
}: {
  detail: string;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <View style={styles.fieldCard}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldTitle}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
      <Text style={styles.helperText}>{detail}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          style={styles.stepperButton}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <View style={styles.stepperValue}>
          <Text style={styles.stepperValueText}>{value} drinks</Text>
        </View>
        <Pressable
          onPress={() => onChange(Math.min(10, value + 1))}
          style={styles.stepperButton}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ChipGrid({
  options,
}: {
  options: Array<{
    detail: string;
    label: string;
    onPress: () => void;
    selected: boolean;
    value: string;
  }>;
}) {
  return (
    <View style={styles.chipGrid}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={option.onPress}
          style={[
            styles.chipCard,
            option.selected ? styles.chipCardSelected : null,
          ]}
        >
          <Text style={styles.chipTitle}>{option.label}</Text>
          <Text style={styles.chipBody}>{option.detail}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChoiceColumn({
  label,
  options,
}: {
  label: string;
  options: Array<{
    detail: string;
    label: string;
    onPress: () => void;
    selected: boolean;
    value: string;
  }>;
}) {
  return (
    <View style={styles.choiceColumn}>
      <Text style={styles.choiceLabel}>{label}</Text>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={option.onPress}
          style={[
            styles.choiceCard,
            option.selected ? styles.choiceCardSelected : null,
          ]}
        >
          <Text style={styles.choiceTitle}>{option.label}</Text>
          <Text style={styles.choiceBody}>{option.detail}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  headerBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(125,211,252,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBadgeText: {
    color: '#D8F3FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  eyebrow: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(125,211,252,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPillText: {
    color: '#D8F3FF',
    fontSize: 13,
    fontWeight: '700',
  },
  linkedCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  panel: {
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleGrid: {
    gap: 10,
  },
  modeCard: {
    gap: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeCardSelected: {
    backgroundColor: 'rgba(125,211,252,0.12)',
    borderColor: 'rgba(125,211,252,0.28)',
  },
  modeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modeBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  fieldCard: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  fieldTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  fieldValue: {
    color: '#D8F3FF',
    fontSize: 13,
    fontWeight: '700',
  },
  timeCard: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactTimeCard: {
    gap: 10,
  },
  timeValue: {
    color: '#D8F3FF',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  timeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  timeTile: {
    flex: 1,
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(7,12,22,0.5)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeTileLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timeTileControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeTileButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeTileButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  timeTileValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  periodButtonSelected: {
    borderColor: 'rgba(125,211,252,0.28)',
    backgroundColor: 'rgba(125,211,252,0.12)',
  },
  periodButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  periodButtonTextSelected: {
    color: colors.text,
  },
  stressGrid: {
    gap: 8,
  },
  stressCard: {
    gap: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stressCardSelected: {
    borderColor: 'rgba(167,139,250,0.3)',
    backgroundColor: 'rgba(167,139,250,0.14)',
  },
  stressEmoji: {
    fontSize: 20,
  },
  stressLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stressDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  stepperValue: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(7,12,22,0.52)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chipGrid: {
    gap: 8,
  },
  chipCard: {
    gap: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipCardSelected: {
    borderColor: 'rgba(94,234,212,0.26)',
    backgroundColor: 'rgba(94,234,212,0.1)',
  },
  chipTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chipBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  choiceColumn: {
    gap: 8,
  },
  choiceLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceCard: {
    gap: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceCardSelected: {
    borderColor: 'rgba(125,211,252,0.26)',
    backgroundColor: 'rgba(125,211,252,0.1)',
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  notesInput: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(7,12,22,0.72)',
    color: colors.text,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryGrid: {
    gap: 10,
  },
  summaryTile: {
    gap: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  errorText: {
    color: '#FECACA',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#7DD3FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#03121C',
    fontSize: 15,
    fontWeight: '800',
  },
});
