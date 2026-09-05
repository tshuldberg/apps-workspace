'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MorningLogDraft, SleepEntryRecord } from '@mylife/sleep';
import {
  buildMorningLogEntryInput,
  buildMorningLogEntryInputForDate,
  getMorningLogDraftFromEntry,
  getMorningLogSummary,
  getMorningLogSummaryForDate,
} from '@mylife/sleep';
import {
  addMorningLogEntry,
  updateMorningLogEntry,
} from '../actions';
import { SleepPanel } from '../_ui';

const STEPS = [
  { title: 'When did you get in bed?', detail: 'Start with the part you are most likely to remember.' },
  { title: 'When did you wake up?', detail: 'Wake time stays quick to adjust so the morning flow does not turn into a report.' },
  { title: 'How was the night overall?', detail: 'Pick the quality score that feels true, not idealized.' },
  { title: 'How do you feel right now?', detail: 'Wake feeling is required because it anchors later insight.' },
  { title: 'How many wake-ups happened?', detail: 'Zero is the default. If you remember interruptions, add them quickly.' },
  { title: 'Any notes worth keeping?', detail: 'Notes stay optional and collapsed by default.' },
  { title: 'Review before save', detail: 'The summary should still read like a quick morning checkpoint.' },
] as const;

const QUALITY_COPY: Record<number, string> = {
  1: 'Rough',
  2: 'Light',
  3: 'Okay',
  4: 'Solid',
  5: 'Excellent',
};

const FEELING_OPTIONS = [
  { value: 'refreshed', emoji: '🌤️', label: 'Refreshed', detail: 'Ready to start the day.' },
  { value: 'groggy', emoji: '🥱', label: 'Groggy', detail: 'Still warming up.' },
  { value: 'exhausted', emoji: '😵', label: 'Exhausted', detail: 'The sleep did not do the job.' },
  { value: 'energized', emoji: '⚡', label: 'Energized', detail: 'More lift than usual.' },
] as const;

type SleepMorningLogFormProps =
  | {
      mode: 'create';
      latestEntry: SleepEntryRecord | null;
    }
  | {
      mode: 'edit';
      entry: SleepEntryRecord;
    };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function currentTimeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimeDisplay(value: string): string {
  const [rawHours, rawMinutes] = value.split(':').map(Number);
  const period = rawHours >= 12 ? 'PM' : 'AM';
  const hours12 = rawHours % 12 || 12;
  return `${hours12}:${pad(rawMinutes)} ${period}`;
}

export function SleepMorningLogForm(props: SleepMorningLogFormProps) {
  const router = useRouter();
  const isEditMode = props.mode === 'edit';
  const entry = isEditMode ? props.entry : null;
  const [referenceNow] = useState(() => new Date());
  const [stepIndex, setStepIndex] = useState(0);
  const [notesExpanded, setNotesExpanded] = useState(
    props.mode === 'edit' ? Boolean(props.entry.notes_md?.trim()) : false,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<MorningLogDraft>(() => {
    if (props.mode === 'edit') {
      return getMorningLogDraftFromEntry(props.entry);
    }

    const latestDraft = props.latestEntry
      ? getMorningLogDraftFromEntry(props.latestEntry)
      : null;

    return {
      bedtimeTime: latestDraft?.bedtimeTime ?? '22:30',
      wakeTime: currentTimeValue(referenceNow),
      qualityRating: null,
      wakeFeeling: null,
      wakeCount: 0,
      notesMd: '',
    };
  });

  const summary = useMemo(() => {
    try {
      return isEditMode && entry
        ? getMorningLogSummaryForDate(draft, entry.date)
        : getMorningLogSummary(draft, referenceNow);
    } catch {
      return null;
    }
  }, [draft, entry, isEditMode, referenceNow]);

  const currentStep = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const canContinue = stepIndex === 2
    ? draft.qualityRating != null
    : stepIndex === 3
      ? draft.wakeFeeling != null
      : stepIndex === 6
        ? summary != null && !isPending
        : !isPending;

  function handleBack(): void {
    if (stepIndex === 0) {
      router.replace(
        isEditMode && entry ? `/sleep/entry/${entry.id}` : '/sleep',
      );
      return;
    }
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function handleContinue(): void {
    if (stepIndex === STEPS.length - 1) {
      if (!summary) {
        return;
      }

      startTransition(() => {
        const savePromise = isEditMode && entry
          ? updateMorningLogEntry(
            entry.id,
            buildMorningLogEntryInputForDate(draft, entry.date),
          )
          : addMorningLogEntry(buildMorningLogEntryInput(draft, referenceNow));

        void savePromise
          .then(() => {
            router.replace(
              isEditMode && entry ? `/sleep/entry/${entry.id}` : '/sleep',
            );
          })
          .catch((error) => {
            setSaveError(
              error instanceof Error
                ? error.message
                : 'Could not save this sleep log.',
            );
          });
      });
      return;
    }

    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <button type="button" onClick={handleBack} style={styles.secondaryButton}>
          {stepIndex === 0 ? 'Close' : 'Back'}
        </button>
        <p style={styles.stepBadge}>
          Step {stepIndex + 1} of {STEPS.length}
        </p>
      </div>

      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
      </div>

      <SleepPanel
        eyebrow={isEditMode ? 'Edit Sleep Log' : 'Morning Log'}
        title={currentStep.title}
        body={currentStep.detail}
      />

      <section style={styles.panel}>
        {stepIndex === 0 && (
          <label style={styles.fieldStack}>
            <span style={styles.fieldLabel}>Bedtime</span>
            <input
              type="time"
              value={draft.bedtimeTime}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  bedtimeTime: event.target.value,
                }))
              }
              style={styles.timeInput}
            />
            <span style={styles.helperText}>
              The bedtime step stays first so the edit flow matches the same mental model as the morning log.
            </span>
          </label>
        )}

        {stepIndex === 1 && (
          <label style={styles.fieldStack}>
            <span style={styles.fieldLabel}>Wake time</span>
            <input
              type="time"
              value={draft.wakeTime}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  wakeTime: event.target.value,
                }))
              }
              style={styles.timeInput}
            />
            <span style={styles.helperText}>
              Adjust the wake clock in one place and let MySleep keep the nightly math aligned.
            </span>
          </label>
        )}

        {stepIndex === 2 && (
          <div style={styles.choiceGrid}>
            {([1, 2, 3, 4, 5] as const).map((rating) => {
              const selected = draft.qualityRating === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      qualityRating: rating,
                    }))
                  }
                  style={{
                    ...styles.choiceCard,
                    ...(selected ? styles.choiceCardSelected : {}),
                  }}
                >
                  <span style={styles.choiceStars}>{'★'.repeat(rating)}</span>
                  <span style={styles.choiceTitle}>{QUALITY_COPY[rating]}</span>
                  <span style={styles.choiceBody}>{rating}/5 quality</span>
                </button>
              );
            })}
          </div>
        )}

        {stepIndex === 3 && (
          <div style={styles.choiceGrid}>
            {FEELING_OPTIONS.map((option) => {
              const selected = draft.wakeFeeling === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      wakeFeeling: option.value,
                    }))
                  }
                  style={{
                    ...styles.choiceCard,
                    ...(selected ? styles.choiceCardSelected : {}),
                  }}
                >
                  <span style={styles.choiceEmoji}>{option.emoji}</span>
                  <span style={styles.choiceTitle}>{option.label}</span>
                  <span style={styles.choiceBody}>{option.detail}</span>
                </button>
              );
            })}
          </div>
        )}

        {stepIndex === 4 && (
          <div style={styles.stepperShell}>
            <span style={styles.stepperLabel}>Wake-ups</span>
            <div style={styles.stepperRow}>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    wakeCount: Math.max(0, current.wakeCount - 1),
                  }))
                }
                style={styles.stepperButton}
              >
                -
              </button>
              <div style={styles.stepperValueShell}>
                <strong style={styles.stepperValue}>{draft.wakeCount}</strong>
                <span style={styles.helperText}>Times you remember waking</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    wakeCount: Math.min(10, current.wakeCount + 1),
                  }))
                }
                style={styles.stepperButton}
              >
                +
              </button>
            </div>
          </div>
        )}

        {stepIndex === 5 && (
          <div style={styles.notesShell}>
            {!notesExpanded && draft.notesMd?.trim().length === 0 ? (
              <button
                type="button"
                onClick={() => setNotesExpanded(true)}
                style={styles.addNotesButton}
              >
                Add notes
              </button>
            ) : (
              <label style={styles.fieldStack}>
                <span style={styles.fieldLabel}>Notes</span>
                <textarea
                  value={draft.notesMd}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notesMd: event.target.value,
                    }))
                  }
                  placeholder="Optional details: stress, noise, dreams, or anything else worth remembering."
                  style={styles.notesInput}
                />
              </label>
            )}
          </div>
        )}

        {stepIndex === 6 && summary && (
          <div style={styles.summaryCard}>
            <p style={styles.summaryHeadline}>
              You slept {summary.durationLabel}, quality {summary.qualityRating}/5, feeling {summary.wakeFeeling}.
            </p>
            <div style={styles.summaryMetricRow}>
              <SummaryMetric label="Bedtime" value={formatTimeDisplay(draft.bedtimeTime)} />
              <SummaryMetric label="Wake" value={formatTimeDisplay(draft.wakeTime)} />
            </div>
            <div style={styles.summaryMetricRow}>
              <SummaryMetric label="Wake-ups" value={String(summary.wakeCount)} />
              <SummaryMetric label="Notes" value={summary.notesMd ? 'Added' : 'Skipped'} />
            </div>
          </div>
        )}
      </section>

      {saveError && (
        <div style={styles.errorCard}>
          <p style={styles.errorText}>{saveError}</p>
        </div>
      )}

      <div style={styles.footerRow}>
        <button type="button" onClick={handleBack} style={styles.footerSecondary}>
          {stepIndex === 0 ? 'Cancel' : 'Previous'}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          style={{
            ...styles.footerPrimary,
            ...(!canContinue ? styles.footerPrimaryDisabled : {}),
          }}
        >
          {isPending
            ? 'Saving...'
            : stepIndex === 5 && draft.notesMd?.trim().length === 0
              ? 'Skip'
              : stepIndex === STEPS.length - 1
                ? isEditMode
                  ? 'Save Changes'
                  : 'Save Sleep Log'
                : 'Next'}
        </button>
      </div>
    </div>
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
    <div style={styles.summaryMetric}>
      <span style={styles.summaryMetricLabel}>{label}</span>
      <strong style={styles.summaryMetricValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 16,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  secondaryButton: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  stepBadge: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: '#A78BFA',
  },
  panel: {
    display: 'grid',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  fieldStack: {
    display: 'grid',
    gap: 10,
  },
  fieldLabel: {
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
  },
  helperText: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.6,
  },
  timeInput: {
    minHeight: 56,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text)',
    padding: '0 16px',
    fontSize: 18,
    fontWeight: 700,
  },
  choiceGrid: {
    display: 'grid',
    gap: 12,
  },
  choiceCard: {
    display: 'grid',
    gap: 8,
    textAlign: 'left',
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  choiceCardSelected: {
    border: '1px solid rgba(167,139,250,0.4)',
    background: 'rgba(167,139,250,0.16)',
  },
  choiceStars: {
    fontSize: 28,
    lineHeight: 1,
  },
  choiceEmoji: {
    fontSize: 30,
    lineHeight: 1,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: 800,
  },
  choiceBody: {
    fontSize: 14,
    lineHeight: 1.55,
    color: 'var(--text-secondary)',
  },
  stepperShell: {
    display: 'grid',
    gap: 16,
  },
  stepperLabel: {
    color: 'var(--text)',
    fontSize: 16,
    fontWeight: 800,
  },
  stepperRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text)',
    fontSize: 28,
    fontWeight: 700,
    cursor: 'pointer',
  },
  stepperValueShell: {
    flex: 1,
    display: 'grid',
    justifyItems: 'center',
    gap: 6,
  },
  stepperValue: {
    color: 'var(--text)',
    fontSize: 40,
    lineHeight: 1,
  },
  notesShell: {
    display: 'grid',
    gap: 12,
  },
  addNotesButton: {
    minHeight: 54,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  notesInput: {
    minHeight: 180,
    resize: 'vertical',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text)',
    padding: 16,
    fontSize: 15,
    lineHeight: 1.6,
  },
  summaryCard: {
    display: 'grid',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(167,139,250,0.28)',
    background: 'rgba(167,139,250,0.12)',
  },
  summaryHeadline: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 18,
    lineHeight: 1.5,
    fontWeight: 800,
  },
  summaryMetricRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  summaryMetric: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 16,
    background: 'rgba(10,10,15,0.3)',
  },
  summaryMetricLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  summaryMetricValue: {
    color: 'var(--text)',
    fontSize: 15,
  },
  errorCard: {
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,69,58,0.24)',
    background: 'rgba(255,69,58,0.12)',
  },
  errorText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 600,
  },
  footerRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
    gap: 12,
  },
  footerSecondary: {
    minHeight: 54,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  footerPrimary: {
    minHeight: 54,
    borderRadius: 16,
    border: 'none',
    background: '#A78BFA',
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
  footerPrimaryDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
};
