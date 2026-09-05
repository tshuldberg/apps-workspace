'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Factor,
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
  isFactorLogMode,
  PRE_SLEEP_ACTIVITY_OPTIONS,
  resolveFactorLogDate,
  SLEEP_SUPPLEMENT_OPTIONS,
  STRESS_LEVEL_OPTIONS,
} from '@mylife/sleep';
import { saveSleepFactorLog } from '../actions';
import { SleepPanel } from '../_ui';

type DraftUpdater = (draft: FactorLogDraft) => FactorLogDraft;

export function SleepFactorLogForm({
  closeHref,
  factorsByMode,
  fixedDate,
  initialMode,
  initialQuick,
  linkedEntry,
  referenceNowIso,
}: {
  closeHref: string;
  factorsByMode: Partial<Record<FactorLogMode, Factor | null>>;
  fixedDate?: string | null;
  initialMode?: FactorLogMode;
  initialQuick?: boolean;
  linkedEntry: SleepEntryRecord | null;
  referenceNowIso: string;
}) {
  const router = useRouter();
  const referenceNow = useMemo(() => new Date(referenceNowIso), [referenceNowIso]);
  const startingMode = initialMode && isFactorLogMode(initialMode)
    ? initialMode
    : getDefaultFactorLogMode(referenceNow);
  const [mode, setMode] = useState<FactorLogMode>(startingMode);
  const [quickMode, setQuickMode] = useState(Boolean(initialQuick));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<FactorLogMode, FactorLogDraft>>({
    tonight: getFactorLogDraftFromFactor(factorsByMode.tonight ?? null),
    last_night: getFactorLogDraftFromFactor(factorsByMode.last_night ?? null),
  });

  const isFixedNight = Boolean(fixedDate);
  const currentFactor = linkedEntry || isFixedNight
    ? factorsByMode.last_night ?? null
    : factorsByMode[mode] ?? null;
  const targetDate = linkedEntry?.date
    ?? fixedDate
    ?? resolveFactorLogDate(mode, referenceNow);
  const targetDateLabel = formatSleepEntryDateLabel(targetDate);
  const currentDraft = linkedEntry || isFixedNight ? drafts.last_night : drafts[mode];

  function updateDraft(updater: DraftUpdater): void {
    const key: FactorLogMode = linkedEntry || isFixedNight ? 'last_night' : mode;
    setDrafts((current) => ({
      ...current,
      [key]: updater(current[key]),
    }));
  }

  function toggleChip<T extends string>(
    values: readonly T[],
    value: T,
  ): T[] {
    return values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  }

  function handleSave(): void {
    const input = buildFactorCreateInput(currentDraft, {
      date: targetDate,
      sleepEntryId: linkedEntry?.id ?? currentFactor?.sleep_entry_id ?? null,
    });

    startTransition(() => {
      setSaveError(null);
      void saveSleepFactorLog(input)
        .then((saved) => {
          router.replace(
            saved.sleep_entry_id
              ? `/sleep/entry/${saved.sleep_entry_id}`
              : '/sleep/factors',
          );
        })
        .catch((error) => {
          setSaveError(
            error instanceof Error
              ? error.message
              : 'Could not save this factor log.',
          );
        });
    });
  }

  const stressMeta = getStressLevelMeta(currentDraft.stressLevel);
  const savedHint = currentFactor
    ? currentFactor.sleep_entry_id
      ? 'Saving again updates the factor log already attached to this sleep entry.'
      : 'Saving again updates the existing factor log for this night.'
    : 'Nothing is required here. Save a three-field quick check-in or the full evening log.';

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <button
          type="button"
          onClick={() => router.replace(closeHref)}
          style={styles.secondaryButton}
        >
          Close
        </button>
        <span style={styles.headerBadge}>
          {linkedEntry ? 'Linked night' : mode === 'tonight' ? 'Tonight' : 'Last night'}
        </span>
      </div>

      <SleepPanel
        eyebrow={linkedEntry ? 'Sleep Factors' : 'Evening Factors'}
        title={quickMode ? 'Quick factor check-in' : `Factor log for ${targetDateLabel}`}
        body={
          quickMode
            ? 'Quick log keeps the focus on stress, caffeine, and exercise so you can save in a few taps.'
            : 'Everything is optional. Capture only what feels memorable enough to help the next morning make sense.'
        }
      >
        <div style={styles.metaRow}>
          <div style={styles.metaPill}>Target night: {targetDateLabel}</div>
          {stressMeta ? (
            <div style={styles.metaPill}>
              Stress: {stressMeta.emoji} {stressMeta.label}
            </div>
          ) : null}
          {currentFactor ? (
            <div style={styles.metaPillMuted}>Existing log will be updated</div>
          ) : null}
        </div>
        {linkedEntry ? (
          <p style={styles.linkedCopy}>
            Linked sleep window: {formatSleepTimeLabel(linkedEntry.bedtime)} to{' '}
            {formatSleepTimeLabel(linkedEntry.wake_time)}
          </p>
        ) : null}
      </SleepPanel>

      <section style={styles.panel}>
        <div style={styles.controlRow}>
          <ModeToggleButton
            active={!quickMode}
            label="Full Log"
            onPress={() => setQuickMode(false)}
          />
          <ModeToggleButton
            active={quickMode}
            label="Quick Log"
            onPress={() => setQuickMode(true)}
          />
        </div>

        {!linkedEntry && !isFixedNight ? (
          <div style={styles.controlRow}>
            <ModeToggleButton
              active={mode === 'tonight'}
              label="Tonight"
              detail="For the sleep you are about to have."
              onPress={() => setMode('tonight')}
            />
            <ModeToggleButton
              active={mode === 'last_night'}
              label="Last night"
              detail="For the sleep you just finished."
              onPress={() => setMode('last_night')}
            />
          </div>
        ) : null}

        <p style={styles.helperText}>{savedHint}</p>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Quick log</h2>
        <div style={styles.grid}>
          <TimeField
            helper="When was the last coffee, tea, soda, or energy drink?"
            label="Caffeine cutoff"
            value={currentDraft.lastCaffeineTime}
            onChange={(value) =>
              updateDraft((draft) => ({ ...draft, lastCaffeineTime: value }))
            }
          />

          <div style={styles.fieldCard}>
            <div style={styles.fieldHeader}>
              <strong style={styles.fieldTitle}>Exercise</strong>
              <label style={styles.switchRow}>
                <input
                  checked={currentDraft.exerciseToday}
                  onChange={(event) =>
                    updateDraft((draft) => ({
                      ...draft,
                      exerciseToday: event.target.checked,
                      exerciseTime: event.target.checked ? draft.exerciseTime : '',
                    }))
                  }
                  type="checkbox"
                />
                <span>{currentDraft.exerciseToday ? 'Yes' : 'No'}</span>
              </label>
            </div>
            <p style={styles.fieldHelper}>
              Toggle on if you exercised at any point during the day.
            </p>
            {currentDraft.exerciseToday ? (
              <TimeField
                compact
                helper="Optional time if it feels relevant."
                label="Exercise time"
                value={currentDraft.exerciseTime}
                onChange={(value) =>
                  updateDraft((draft) => ({ ...draft, exerciseTime: value }))
                }
              />
            ) : null}
          </div>
        </div>

        <div style={styles.fieldCard}>
          <div style={styles.fieldHeader}>
            <strong style={styles.fieldTitle}>Stress level</strong>
            <span style={styles.fieldValue}>
              {stressMeta ? `${stressMeta.emoji} ${stressMeta.label}` : 'Optional'}
            </span>
          </div>
          <p style={styles.fieldHelper}>
            Pick the stress load that best matches the evening or the morning after.
          </p>
          <div style={styles.stressGrid}>
            {STRESS_LEVEL_OPTIONS.map((option) => {
              const selected = currentDraft.stressLevel === option.value;
              return (
                <button
                  key={option.value}
                  aria-label={`Stress level ${option.value}: ${option.label}`}
                  aria-pressed={selected}
                  type="button"
                  onClick={() =>
                    updateDraft((draft) => ({
                      ...draft,
                      stressLevel: selected ? null : option.value,
                    }))
                  }
                  style={{
                    ...styles.stressCard,
                    ...(selected ? styles.stressCardSelected : {}),
                  }}
                >
                  <span style={styles.stressEmoji}>{option.emoji}</span>
                  <strong style={styles.stressLabel}>{option.label}</strong>
                  <span style={styles.stressDetail}>{option.detail}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {!quickMode ? (
        <>
          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Cutoffs and substances</h2>
            <div style={styles.grid}>
              <TimeField
                helper="When did you last eat anything substantial?"
                label="Meal cutoff"
                value={currentDraft.lastMealTime}
                onChange={(value) =>
                  updateDraft((draft) => ({ ...draft, lastMealTime: value }))
                }
              />
              <TimeField
                helper="When did screens go down for the night?"
                label="Screen cutoff"
                value={currentDraft.screenCutoffTime}
                onChange={(value) =>
                  updateDraft((draft) => ({ ...draft, screenCutoffTime: value }))
                }
              />
              <StepperField
                label="Alcohol"
                value={currentDraft.alcoholDrinks}
                detail="Count drinks between 0 and 10."
                onChange={(value) =>
                  updateDraft((draft) => ({ ...draft, alcoholDrinks: value }))
                }
              />
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Pre-sleep activities</h2>
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
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Room conditions</h2>
            <div style={styles.choiceColumns}>
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
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Supplements</h2>
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
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Disturbances note</h2>
            <label style={styles.textAreaStack}>
              <span style={styles.fieldHelper}>
                Bed partner, pet, temperature drift, noise spike, or anything else worth remembering later.
              </span>
              <textarea
                aria-label="Disturbances note"
                onChange={(event) =>
                  updateDraft((draft) => ({
                    ...draft,
                    disturbancesNote: event.target.value,
                  }))
                }
                rows={4}
                style={styles.textArea}
                value={currentDraft.disturbancesNote}
              />
            </label>
          </section>
        </>
      ) : null}

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>What will be saved</h2>
        <div style={styles.summaryGrid}>
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
            value={
              stressMeta
                ? `${stressMeta.emoji} ${stressMeta.label}`
                : 'Not logged'
            }
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
        </div>

        {saveError ? <p style={styles.errorText}>{saveError}</p> : null}

        <div style={styles.footerRow}>
          <button
            disabled={isPending}
            onClick={handleSave}
            style={{
              ...styles.primaryButton,
              ...(isPending ? styles.primaryButtonDisabled : {}),
            }}
            type="button"
          >
            {isPending ? 'Saving…' : quickMode ? 'Save Quick Log' : 'Save Factor Log'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ModeToggleButton({
  active,
  detail,
  label,
  onPress,
}: {
  active: boolean;
  detail?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        ...styles.toggleCard,
        ...(active ? styles.toggleCardSelected : {}),
      }}
    >
      <strong style={styles.toggleTitle}>{label}</strong>
      {detail ? <span style={styles.toggleBody}>{detail}</span> : null}
    </button>
  );
}

function TimeField({
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
  return (
    <label style={compact ? styles.compactTimeField : styles.fieldCard}>
      <div style={styles.fieldHeader}>
        <strong style={styles.fieldTitle}>{label}</strong>
        <span style={styles.fieldValue}>
          {formatFactorClockTime(value) ?? 'Optional'}
        </span>
      </div>
      <span style={styles.fieldHelper}>{helper}</span>
      <input
        aria-label={label}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={styles.timeInput}
      />
    </label>
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
    <div style={styles.fieldCard}>
      <div style={styles.fieldHeader}>
        <strong style={styles.fieldTitle}>{label}</strong>
        <span style={styles.fieldValue}>{value}</span>
      </div>
      <p style={styles.fieldHelper}>{detail}</p>
      <div style={styles.stepperRow}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          style={styles.stepperButton}
        >
          −
        </button>
        <div style={styles.stepperValue}>{value} drinks</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(10, value + 1))}
          style={styles.stepperButton}
        >
          +
        </button>
      </div>
    </div>
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
    <div style={styles.chipGrid}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={option.onPress}
          style={{
            ...styles.chipCard,
            ...(option.selected ? styles.chipCardSelected : {}),
          }}
        >
          <strong style={styles.chipTitle}>{option.label}</strong>
          <span style={styles.chipBody}>{option.detail}</span>
        </button>
      ))}
    </div>
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
    <div style={styles.choiceColumn}>
      <strong style={styles.choiceLabel}>{label}</strong>
      <div style={styles.choiceList}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={option.onPress}
            style={{
              ...styles.choiceCard,
              ...(option.selected ? styles.choiceCardSelected : {}),
            }}
          >
            <strong style={styles.choiceTitle}>{option.label}</strong>
            <span style={styles.choiceBody}>{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
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
    <div style={styles.summaryTile}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  headerBadge: {
    borderRadius: 999,
    border: '1px solid rgba(125, 211, 252, 0.2)',
    background: 'rgba(125, 211, 252, 0.08)',
    color: '#D8F3FF',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  metaPill: {
    borderRadius: 999,
    border: '1px solid rgba(125, 211, 252, 0.2)',
    background: 'rgba(125, 211, 252, 0.08)',
    color: '#D8F3FF',
    padding: '9px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  metaPillMuted: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    padding: '9px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  linkedCopy: {
    margin: '4px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  panel: {
    display: 'grid',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(15,23,42,0.48), rgba(15,23,42,0.3))',
    backdropFilter: 'blur(18px)',
  },
  controlRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  helperText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  toggleCard: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  },
  toggleCardSelected: {
    border: '1px solid rgba(125, 211, 252, 0.32)',
    background: 'rgba(125, 211, 252, 0.12)',
  },
  toggleTitle: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.3,
  },
  toggleBody: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 18,
    lineHeight: 1.2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  fieldCard: {
    display: 'grid',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.03)',
  },
  compactTimeField: {
    display: 'grid',
    gap: 10,
  },
  fieldHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  fieldTitle: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.3,
  },
  fieldValue: {
    color: '#D8F3FF',
    fontSize: 13,
    fontWeight: 700,
  },
  fieldHelper: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.55,
  },
  timeInput: {
    width: '100%',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(7, 12, 22, 0.72)',
    color: 'var(--text)',
    padding: '10px 12px',
    fontSize: 14,
  },
  switchRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  stressGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
    gap: 10,
  },
  stressCard: {
    display: 'grid',
    gap: 4,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  },
  stressCardSelected: {
    border: '1px solid rgba(167,139,250,0.35)',
    background: 'rgba(167,139,250,0.14)',
  },
  stressEmoji: {
    fontSize: 20,
  },
  stressLabel: {
    color: 'var(--text)',
    fontSize: 14,
  },
  stressDetail: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.45,
  },
  stepperRow: {
    display: 'grid',
    gridTemplateColumns: '48px 1fr 48px',
    gap: 10,
    alignItems: 'center',
  },
  stepperButton: {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    height: 44,
    fontSize: 24,
    fontWeight: 700,
    cursor: 'pointer',
  },
  stepperValue: {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(7, 12, 22, 0.52)',
    color: 'var(--text)',
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
  },
  chipGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 10,
  },
  chipCard: {
    display: 'grid',
    gap: 4,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  },
  chipCardSelected: {
    border: '1px solid rgba(94, 234, 212, 0.28)',
    background: 'rgba(94, 234, 212, 0.1)',
  },
  chipTitle: {
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.3,
  },
  chipBody: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.45,
  },
  choiceColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  choiceColumn: {
    display: 'grid',
    gap: 10,
  },
  choiceLabel: {
    color: 'var(--text)',
    fontSize: 14,
  },
  choiceList: {
    display: 'grid',
    gap: 8,
  },
  choiceCard: {
    display: 'grid',
    gap: 4,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  },
  choiceCardSelected: {
    border: '1px solid rgba(125, 211, 252, 0.28)',
    background: 'rgba(125, 211, 252, 0.1)',
  },
  choiceTitle: {
    color: 'var(--text)',
    fontSize: 14,
  },
  choiceBody: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.45,
  },
  textAreaStack: {
    display: 'grid',
    gap: 10,
  },
  textArea: {
    width: '100%',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(7, 12, 22, 0.72)',
    color: 'var(--text)',
    padding: 12,
    fontSize: 14,
    lineHeight: 1.55,
    resize: 'vertical',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
  },
  summaryTile: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.03)',
  },
  summaryLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.45,
  },
  errorText: {
    margin: 0,
    color: '#FECACA',
    fontSize: 14,
    lineHeight: 1.5,
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  primaryButton: {
    borderRadius: 999,
    border: '1px solid rgba(125, 211, 252, 0.24)',
    background: 'linear-gradient(180deg, #7DD3FC 0%, #38BDF8 100%)',
    color: '#03121C',
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
    cursor: 'wait',
  },
};
