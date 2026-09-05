import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { MorningLogDraft, MorningLogSummary } from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { SLEEP_ACCENT } from './_ui';

const STEPS = [
  { title: 'When did you get in bed?', detail: 'Start with the part you are most likely to remember.' },
  { title: 'When did you wake up?', detail: 'Wake time stays quick to adjust so the morning flow does not turn into a report.' },
  { title: 'How was the night overall?', detail: 'Pick the quality score that feels true, not idealized.' },
  { title: 'How do you feel right now?', detail: 'Wake feeling is required because it anchors later insight.' },
  { title: 'How many wake-ups happened?', detail: 'Zero is the default. Use the stepper if you remember interruptions.' },
  { title: 'Any notes worth keeping?', detail: 'Notes are optional and collapsed until you want them.' },
  { title: 'Review before save', detail: 'This should still feel like a 30-second morning check-in.' },
] as const;

const QUALITY_COPY: Record<number, string> = {
  1: 'Rough',
  2: 'Light',
  3: 'Okay',
  4: 'Solid',
  5: 'Excellent',
};

const FEELING_OPTIONS = [
  { value: 'refreshed', emoji: '🌤️', label: 'Refreshed', detail: 'Ready to get moving.' },
  { value: 'groggy', emoji: '🥱', label: 'Groggy', detail: 'Still shaking off the night.' },
  { value: 'exhausted', emoji: '😵', label: 'Exhausted', detail: 'The sleep did not land.' },
  { value: 'energized', emoji: '⚡', label: 'Energized', detail: 'More pop than usual this morning.' },
] as const;

interface SleepEntryWizardProps {
  eyebrow: string;
  initialDraft: MorningLogDraft;
  saveLabel: string;
  buildSummary: (draft: MorningLogDraft) => MorningLogSummary;
  onSubmit: (draft: MorningLogDraft) => Promise<void> | void;
  onClose: () => void;
}

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
  const { hours, minutes } = parseTime(value);
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
  const { hours, minutes } = parseTime(value);
  return formatTimeValue((hours + delta + 24) % 24, minutes);
}

function shiftMinutes(value: string, delta: number): string {
  const { hours, minutes } = parseTime(value);
  const total = (hours * 60) + minutes + delta;
  const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  return formatTimeValue(
    Math.floor(normalized / 60),
    normalized % 60,
  );
}

function formatTimeDisplay(value: string): string {
  const { hours12, minutes, period } = getDisplayTime(value);
  return `${hours12}:${pad(minutes)} ${period}`;
}

export function SleepEntryWizard({
  eyebrow,
  initialDraft,
  saveLabel,
  buildSummary,
  onSubmit,
  onClose,
}: SleepEntryWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(
    Boolean(initialDraft.notesMd?.trim()),
  );
  const [draft, setDraft] = useState<MorningLogDraft>({
    ...initialDraft,
    notesMd: initialDraft.notesMd ?? '',
  });

  const summary = useMemo(() => {
    try {
      return buildSummary(draft);
    } catch {
      return null;
    }
  }, [buildSummary, draft]);

  const currentStep = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const canContinue = useMemo(() => {
    switch (stepIndex) {
      case 2:
        return draft.qualityRating != null;
      case 3:
        return draft.wakeFeeling != null;
      case 6:
        return summary != null && !isSaving;
      default:
        return !isSaving;
    }
  }, [draft.qualityRating, draft.wakeFeeling, isSaving, stepIndex, summary]);

  async function handleSave(): Promise<void> {
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSubmit(draft);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Could not save this sleep log.';
      setSaveError(message);
      setIsSaving(false);
    }
  }

  function handleContinue(): void {
    if (stepIndex === STEPS.length - 1) {
      void handleSave();
      return;
    }
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }

  function handleBack(): void {
    if (stepIndex === 0) {
      onClose();
      return;
    }
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleBack} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {stepIndex === 0 ? 'Close' : 'Back'}
            </Text>
          </Pressable>
          <Text style={styles.stepBadge}>
            Step {stepIndex + 1} of {STEPS.length}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.subtitle}>{currentStep.detail}</Text>
      </View>

      <View style={styles.panel}>
        {stepIndex === 0 && (
          <TimeControl
            label="Bedtime"
            helper="The bedtime step stays first so edits can keep the same quick mental model as the morning log."
            value={draft.bedtimeTime}
            onChange={(value) =>
              setDraft((current) => ({ ...current, bedtimeTime: value }))
            }
          />
        )}

        {stepIndex === 1 && (
          <TimeControl
            label="Wake time"
            helper="Adjust the wake clock in one place and let MySleep keep the rest of the nightly math aligned."
            value={draft.wakeTime}
            onChange={(value) =>
              setDraft((current) => ({ ...current, wakeTime: value }))
            }
          />
        )}

        {stepIndex === 2 && (
          <View style={styles.choiceGrid}>
            {([1, 2, 3, 4, 5] as const).map((rating) => {
              const selected = draft.qualityRating === rating;
              return (
                <Pressable
                  key={rating}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      qualityRating: rating,
                    }))
                  }
                  style={[
                    styles.choiceCard,
                    selected && styles.choiceCardSelected,
                  ]}
                >
                  <Text style={styles.choiceStars}>{'★'.repeat(rating)}</Text>
                  <Text style={styles.choiceTitle}>{QUALITY_COPY[rating]}</Text>
                  <Text style={styles.choiceBody}>{rating}/5 quality</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {stepIndex === 3 && (
          <View style={styles.choiceGrid}>
            {FEELING_OPTIONS.map((option) => {
              const selected = draft.wakeFeeling === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      wakeFeeling: option.value,
                    }))
                  }
                  style={[
                    styles.choiceCard,
                    selected && styles.choiceCardSelected,
                  ]}
                >
                  <Text style={styles.choiceEmoji}>{option.emoji}</Text>
                  <Text style={styles.choiceTitle}>{option.label}</Text>
                  <Text style={styles.choiceBody}>{option.detail}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {stepIndex === 4 && (
          <View style={styles.stepperCard}>
            <Text style={styles.stepperLabel}>Wake-ups</Text>
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    wakeCount: Math.max(0, current.wakeCount - 1),
                  }))
                }
                style={styles.stepperButton}
              >
                <Text style={styles.stepperButtonText}>-</Text>
              </Pressable>

              <View style={styles.stepperValueShell}>
                <Text style={styles.stepperValue}>{draft.wakeCount}</Text>
                <Text style={styles.stepperHint}>Times you remember waking</Text>
              </View>

              <Pressable
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    wakeCount: Math.min(10, current.wakeCount + 1),
                  }))
                }
                style={styles.stepperButton}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        )}

        {stepIndex === 5 && (
          <View style={styles.notesCard}>
            {!notesExpanded && draft.notesMd?.trim().length === 0 ? (
              <Pressable
                onPress={() => setNotesExpanded(true)}
                style={styles.addNotesButton}
              >
                <Text style={styles.addNotesButtonText}>Add notes</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.notesLabel}>Notes</Text>
                <TextInput
                  multiline
                  placeholder="Optional details: noise, stress, dreams, or anything else worth remembering."
                  placeholderTextColor={colors.textSecondary}
                  value={draft.notesMd}
                  onChangeText={(value) =>
                    setDraft((current) => ({ ...current, notesMd: value }))
                  }
                  style={styles.notesInput}
                  textAlignVertical="top"
                />
              </>
            )}
          </View>
        )}

        {stepIndex === 6 && summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryHeadline}>
              You slept {summary.durationLabel}, quality {summary.qualityRating}/5, feeling {summary.wakeFeeling}.
            </Text>

            <View style={styles.summaryMetricRow}>
              <SummaryMetric
                label="Bedtime"
                value={formatTimeDisplay(draft.bedtimeTime)}
              />
              <SummaryMetric
                label="Wake"
                value={formatTimeDisplay(draft.wakeTime)}
              />
            </View>

            <View style={styles.summaryMetricRow}>
              <SummaryMetric
                label="Wake-ups"
                value={String(summary.wakeCount)}
              />
              <SummaryMetric
                label="Notes"
                value={summary.notesMd ? 'Added' : 'Skipped'}
              />
            </View>
          </View>
        )}
      </View>

      {saveError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Pressable onPress={handleBack} style={styles.footerSecondary}>
          <Text style={styles.footerSecondaryText}>
            {stepIndex === 0 ? 'Cancel' : 'Previous'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={[
            styles.footerPrimary,
            !canContinue && styles.footerPrimaryDisabled,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#0E0E13" />
          ) : (
            <Text style={styles.footerPrimaryText}>
              {stepIndex === 5 && draft.notesMd?.trim().length === 0
                ? 'Skip'
                : stepIndex === STEPS.length - 1
                  ? saveLabel
                  : 'Next'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function TimeControl({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { hours12, minutes, period } = getDisplayTime(value);

  return (
    <View style={styles.timeCard}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeValue}>{formatTimeDisplay(value)}</Text>
      <Text style={styles.timeHelper}>{helper}</Text>

      <View style={styles.timeGrid}>
        <StepperTile
          label="Hour"
          value={String(hours12)}
          onDecrement={() => onChange(shiftHours(value, -1))}
          onIncrement={() => onChange(shiftHours(value, 1))}
        />
        <StepperTile
          label="Minutes"
          value={pad(minutes)}
          onDecrement={() => onChange(shiftMinutes(value, -5))}
          onIncrement={() => onChange(shiftMinutes(value, 5))}
        />
      </View>

      <View style={styles.periodRow}>
        {(['AM', 'PM'] as const).map((candidate) => (
          <Pressable
            key={candidate}
            onPress={() => onChange(fromDisplayTime(hours12, minutes, candidate))}
            style={[
              styles.periodButton,
              candidate === period && styles.periodButtonSelected,
            ]}
          >
            <Text
              style={[
                styles.periodButtonText,
                candidate === period && styles.periodButtonTextSelected,
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

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
      <Text style={styles.summaryMetricValue}>{value}</Text>
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
    paddingBottom: 140,
    gap: 16,
  },
  header: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stepBadge: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: SLEEP_ACCENT,
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    gap: 16,
  },
  timeCard: {
    gap: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timeValue: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  timeHelper: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  timeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  timeTile: {
    flex: 1,
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeTileLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timeTileControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeTileButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeTileButtonText: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '700',
  },
  timeTileValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodButtonSelected: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  periodButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  periodButtonTextSelected: {
    color: colors.text,
  },
  choiceGrid: {
    gap: 12,
  },
  choiceCard: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceCardSelected: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  choiceStars: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  choiceEmoji: {
    fontSize: 30,
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  choiceBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  stepperCard: {
    gap: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperLabel: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperButtonText: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '700',
  },
  stepperValueShell: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepperValue: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 44,
    fontWeight: '800',
  },
  stepperHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  notesCard: {
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addNotesButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addNotesButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  notesLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 180,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  summaryCard: {
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  summaryHeadline: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
  },
  summaryMetricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryMetric: {
    flex: 1,
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(10,10,15,0.3)',
  },
  summaryMetricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryMetricValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  errorCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.24)',
  },
  errorText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  footerSecondary: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerSecondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  footerPrimary: {
    flex: 1.4,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
  },
  footerPrimaryDisabled: {
    opacity: 0.45,
  },
  footerPrimaryText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
});
