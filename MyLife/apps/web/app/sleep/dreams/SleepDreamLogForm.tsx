'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Dream,
  DreamType,
  SleepEntryRecord,
} from '@mylife/sleep';
import {
  addDreamLog,
  updateDreamLog,
} from '../actions';
import {
  DREAM_EMOTION_OPTIONS,
  DREAM_THEME_TAXONOMY,
  findRecurringDreamCandidates,
  formatDurationLabel,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  getDreamExcerpt,
  getDreamPeopleSuggestions,
  getDreamTypeMeta,
  getRecurringDreamGroupId,
  getSleepWakeFeelingMeta,
  renderSleepQualityStars,
  type DreamCreateInput,
} from '@mylife/sleep';
import { SLEEP_DREAM_TYPE_TONES } from '../presentation';
import { SleepPanel } from '../_ui';

const DREAM_TYPES: DreamType[] = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
];

function appendUniqueValue(values: string[], nextValue: string): string[] {
  const trimmed = nextValue.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return values;
  }
  if (
    values.some((value) => value.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
  ) {
    return values;
  }
  return [...values, trimmed];
}

function removeValue(values: string[], target: string): string[] {
  return values.filter((value) => value !== target);
}

function buildEntryLabel(entry: SleepEntryRecord): string {
  return `${formatSleepEntryDateLabel(entry.date)} • ${formatDurationLabel(entry.duration_minutes)}`;
}

function buildEntrySummary(entry: SleepEntryRecord): string {
  return `${formatSleepTimeLabel(entry.bedtime)} to ${formatSleepTimeLabel(entry.wake_time)} • ${renderSleepQualityStars(entry.quality_rating)} • ${getSleepWakeFeelingMeta(entry.wake_feeling).emoji} ${getSleepWakeFeelingMeta(entry.wake_feeling).label}`;
}

export function SleepDreamLogForm({
  mode,
  dream,
  archiveDreams,
  entryOptions,
  initialEntryId,
  closeHref,
}: {
  mode: 'create' | 'edit';
  dream: Dream | null;
  archiveDreams: Dream[];
  entryOptions: SleepEntryRecord[];
  initialEntryId?: string | null;
  closeHref: string;
}) {
  const router = useRouter();
  const [contentMd, setContentMd] = useState(dream?.content_md ?? '');
  const [type, setType] = useState<DreamType>(dream?.type ?? 'normal');
  const [themes, setThemes] = useState<string[]>(dream?.themes ?? []);
  const [themeInput, setThemeInput] = useState('');
  const [people, setPeople] = useState<string[]>(dream?.people ?? []);
  const [personInput, setPersonInput] = useState('');
  const [emotions, setEmotions] = useState<string[]>(dream?.emotions ?? []);
  const [isLucid, setIsLucid] = useState(dream?.is_lucid ?? false);
  const [isRecurring, setIsRecurring] = useState(dream?.is_recurring ?? false);
  const [recurringGroupId, setRecurringGroupId] = useState<string | null>(
    dream?.recurring_group_id ?? (dream?.is_recurring ? dream.id : null),
  );
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    dream?.sleep_entry_id ?? initialEntryId ?? entryOptions[0]?.id ?? null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedEntry = useMemo(
    () => entryOptions.find((entry) => entry.id === selectedEntryId) ?? null,
    [entryOptions, selectedEntryId],
  );

  const peopleSuggestions = useMemo(() => {
    return getDreamPeopleSuggestions(archiveDreams, 8).filter(
      (value) =>
        !people.some(
          (selected) =>
            selected.toLocaleLowerCase() === value.toLocaleLowerCase(),
        ),
    );
  }, [archiveDreams, people]);

  const recurringCandidates = useMemo(() => {
    return findRecurringDreamCandidates(
      {
        content_md: contentMd,
        themes,
      },
      archiveDreams.filter((candidate) => candidate.id !== dream?.id),
      4,
    );
  }, [archiveDreams, contentMd, dream?.id, themes]);

  useEffect(() => {
    if (!isRecurring) {
      setRecurringGroupId(null);
      return;
    }

    const validGroupIds = recurringCandidates
      .map((candidate) => getRecurringDreamGroupId(candidate))
      .filter((value): value is string => Boolean(value));

    if (recurringGroupId && validGroupIds.includes(recurringGroupId)) {
      return;
    }

    if (
      dream?.recurring_group_id &&
      recurringGroupId === dream.recurring_group_id
    ) {
      return;
    }

    if (dream?.id && recurringGroupId === dream.id) {
      return;
    }

    setRecurringGroupId(validGroupIds[0] ?? null);
  }, [dream?.id, isRecurring, recurringCandidates, recurringGroupId]);

  function handleThemeAdd(nextTheme?: string): void {
    const theme = nextTheme ?? themeInput;
    setThemes((current) => appendUniqueValue(current, theme));
    setThemeInput('');
  }

  function handlePersonAdd(nextPerson?: string): void {
    const person = nextPerson ?? personInput;
    setPeople((current) => appendUniqueValue(current, person));
    setPersonInput('');
  }

  function handleSave(): void {
    const trimmedContent = contentMd.trim();
    if (!trimmedContent) {
      setSaveError('Write the dream before saving it.');
      return;
    }

    const payload: DreamCreateInput = {
      sleep_entry_id: selectedEntryId ?? undefined,
      date: selectedEntry?.date ?? dream?.date ?? new Date().toISOString().slice(0, 10),
      content_md: trimmedContent,
      type,
      themes,
      people,
      emotions,
      is_lucid: isLucid,
      is_recurring: isRecurring,
      recurring_group_id: isRecurring ? recurringGroupId ?? undefined : undefined,
    };

    startTransition(() => {
      const savePromise = dream
        ? updateDreamLog(dream.id, payload)
        : addDreamLog(payload);

      void savePromise
        .then((savedDream) => {
          router.replace(`/sleep/dreams/${savedDream.id}`);
        })
        .catch((reason) => {
          setSaveError(
            reason instanceof Error
              ? reason.message
              : 'Could not save this dream.',
          );
        });
    });
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <button type="button" onClick={() => router.replace(closeHref)} style={styles.secondaryButton}>
          Close
        </button>
        <p style={styles.stepBadge}>
          {mode === 'edit' ? 'Edit Dream' : 'Fast Dream Log'}
        </p>
      </div>

      <SleepPanel
        eyebrow={mode === 'edit' ? 'Dream Detail' : 'Morning Dream Capture'}
        title="Write it before it fades."
        body="Start with the raw memory, then tag the type, themes, people, and emotions while the details are still close."
      />

      <section style={styles.grid}>
        <div style={styles.column}>
          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Dream content</h2>
            <textarea
              value={contentMd}
              onChange={(event) => setContentMd(event.target.value)}
              placeholder="Write your dream before it fades..."
              autoFocus={mode === 'create'}
              style={styles.dreamInput}
            />
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Dream type</h2>
            <div style={styles.chipWrap}>
              {DREAM_TYPES.map((option) => {
                const meta = getDreamTypeMeta(option);
                const selected = option === type;
                const tone = SLEEP_DREAM_TYPE_TONES[meta.tone];
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setType(option);
                      if (option === 'lucid') {
                        setIsLucid(true);
                      }
                      if (option === 'recurring') {
                        setIsRecurring(true);
                      }
                    }}
                    style={{
                      ...styles.filterChip,
                      ...(selected
                        ? {
                            background: tone.background,
                            borderColor: tone.borderColor,
                          }
                        : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.filterChipText,
                        ...(selected ? { color: tone.color } : {}),
                      }}
                    >
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Themes</h2>
            {themes.length > 0 && (
              <div style={styles.selectedWrap}>
                {themes.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setThemes((current) => removeValue(current, theme))}
                    style={styles.selectedTag}
                  >
                    {theme} ×
                  </button>
                ))}
              </div>
            )}
            <div style={styles.inlineInputRow}>
              <input
                value={themeInput}
                onChange={(event) => setThemeInput(event.target.value)}
                placeholder="Add custom theme"
                style={styles.inlineInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleThemeAdd();
                  }
                }}
              />
              <button type="button" onClick={() => handleThemeAdd()} style={styles.inlineButton}>
                Add
              </button>
            </div>
            <div style={styles.chipWrap}>
              {DREAM_THEME_TAXONOMY.map((theme) => {
                const selected = themes.includes(theme);
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() =>
                      setThemes((current) =>
                        selected
                          ? removeValue(current, theme)
                          : appendUniqueValue(current, theme),
                      )
                    }
                    style={{
                      ...styles.filterChip,
                      ...(selected ? styles.filterChipSelected : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.filterChipText,
                        ...(selected ? styles.filterChipTextSelected : {}),
                      }}
                    >
                      {theme}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>People</h2>
            {people.length > 0 && (
              <div style={styles.selectedWrap}>
                {people.map((person) => (
                  <button
                    key={person}
                    type="button"
                    onClick={() => setPeople((current) => removeValue(current, person))}
                    style={styles.selectedTag}
                  >
                    {person} ×
                  </button>
                ))}
              </div>
            )}
            <div style={styles.inlineInputRow}>
              <input
                value={personInput}
                onChange={(event) => setPersonInput(event.target.value)}
                placeholder="Add person"
                style={styles.inlineInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handlePersonAdd();
                  }
                }}
              />
              <button type="button" onClick={() => handlePersonAdd()} style={styles.inlineButton}>
                Add
              </button>
            </div>
            {peopleSuggestions.length > 0 && (
              <div style={styles.chipWrap}>
                {peopleSuggestions.map((person) => (
                  <button
                    key={person}
                    type="button"
                    onClick={() => handlePersonAdd(person)}
                    style={styles.filterChip}
                  >
                    <span style={styles.filterChipText}>{person}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div style={styles.column}>
          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Emotions</h2>
            <div style={styles.chipWrap}>
              {DREAM_EMOTION_OPTIONS.map((emotion) => {
                const selected = emotions.includes(emotion);
                return (
                  <button
                    key={emotion}
                    type="button"
                    onClick={() =>
                      setEmotions((current) =>
                        selected
                          ? removeValue(current, emotion)
                          : appendUniqueValue(current, emotion),
                      )
                    }
                    style={{
                      ...styles.filterChip,
                      ...(selected ? styles.filterChipSelected : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.filterChipText,
                        ...(selected ? styles.filterChipTextSelected : {}),
                      }}
                    >
                      {emotion}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Flags</h2>
            <div style={styles.toggleGrid}>
              <button
                type="button"
                onClick={() =>
                  setIsLucid((value) => {
                    const nextValue = !value;
                    if (!nextValue && type === 'lucid') {
                      setType('normal');
                    }
                    return nextValue;
                  })
                }
                style={{
                  ...styles.toggleCard,
                  ...(isLucid ? styles.toggleCardSelected : {}),
                }}
              >
                <strong style={styles.toggleTitle}>Lucid</strong>
                <span style={styles.toggleBody}>
                  Mark this if you knew you were dreaming while it happened.
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setIsRecurring((value) => {
                    const nextValue = !value;
                    if (!nextValue && type === 'recurring') {
                      setType('normal');
                    }
                    return nextValue;
                  })
                }
                style={{
                  ...styles.toggleCard,
                  ...(isRecurring ? styles.toggleCardSelected : {}),
                }}
              >
                <strong style={styles.toggleTitle}>Recurring</strong>
                <span style={styles.toggleBody}>
                  Turn this on if the setting, pattern, or plotline has come back before.
                </span>
              </button>
            </div>
          </section>

          {isRecurring && (
            <section style={styles.panel}>
              <h2 style={styles.sectionTitle}>Recurring thread</h2>
              <p style={styles.helperText}>
                Link this dream to an older recurring pattern or start a new thread.
              </p>
              <div style={styles.toggleGrid}>
                <button
                  type="button"
                  onClick={() => setRecurringGroupId(null)}
                  style={{
                    ...styles.toggleCard,
                    ...(!recurringGroupId ? styles.toggleCardSelected : {}),
                  }}
                >
                  <strong style={styles.toggleTitle}>Start a new recurring thread</strong>
                  <span style={styles.toggleBody}>
                    Use this if the pattern feels new even though you want it tracked as recurring.
                  </span>
                </button>
                {recurringCandidates.map((candidate) => {
                  const candidateGroupId = getRecurringDreamGroupId(candidate);
                  if (!candidateGroupId) {
                    return null;
                  }

                  return (
                    <button
                      key={candidateGroupId}
                      type="button"
                      onClick={() => setRecurringGroupId(candidateGroupId)}
                      style={{
                        ...styles.toggleCard,
                        ...(recurringGroupId === candidateGroupId
                          ? styles.toggleCardSelected
                          : {}),
                      }}
                    >
                      <strong style={styles.toggleTitle}>
                        {formatSleepEntryDateLabel(candidate.date)} • {getDreamTypeMeta(candidate.type).label}
                      </strong>
                      <span style={styles.toggleBody}>
                        {getDreamExcerpt(candidate.content_md, 92)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Sketch or photo</h2>
            <div style={styles.noteCard}>
              <strong style={styles.noteTitle}>Attachment slot reserved</strong>
              <span style={styles.noteBody}>
                The schema already has `sketch_photo_id`, but image capture is waiting on the later media bridge.
              </span>
            </div>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Linked sleep entry</h2>
            {selectedEntry ? (
              <div style={styles.entryCard}>
                <strong style={styles.entryLabel}>{buildEntryLabel(selectedEntry)}</strong>
                <span style={styles.entryBody}>{buildEntrySummary(selectedEntry)}</span>
              </div>
            ) : (
              <p style={styles.helperText}>No sleep entry linked. This dream will use today as its date.</p>
            )}
            <div style={styles.chipWrap}>
              <button
                type="button"
                onClick={() => setSelectedEntryId(null)}
                style={{
                  ...styles.filterChip,
                  ...(!selectedEntryId ? styles.filterChipSelected : {}),
                }}
              >
                <span
                  style={{
                    ...styles.filterChipText,
                    ...(!selectedEntryId ? styles.filterChipTextSelected : {}),
                  }}
                >
                  No linked night
                </span>
              </button>
              {entryOptions.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedEntryId(entry.id)}
                  style={{
                    ...styles.filterChip,
                    ...(selectedEntryId === entry.id ? styles.filterChipSelected : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.filterChipText,
                      ...(selectedEntryId === entry.id ? styles.filterChipTextSelected : {}),
                    }}
                  >
                    {buildEntryLabel(entry)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>

      {saveError && (
        <div style={styles.errorCard}>
          <p style={styles.errorText}>{saveError}</p>
        </div>
      )}

      <div style={styles.footerRow}>
        <button type="button" onClick={() => router.replace(closeHref)} style={styles.footerSecondary}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          style={{
            ...styles.footerPrimary,
            ...(isPending ? styles.footerPrimaryDisabled : {}),
          }}
        >
          {isPending
            ? 'Saving...'
            : mode === 'edit'
              ? 'Save Dream Changes'
              : 'Save Dream'}
        </button>
      </div>
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
    minHeight: 44,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '0 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  stepBadge: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  column: {
    display: 'grid',
    gap: 16,
    alignContent: 'start',
  },
  panel: {
    display: 'grid',
    gap: 12,
    padding: 18,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 16,
    lineHeight: 1.4,
    fontWeight: 700,
  },
  dreamInput: {
    minHeight: 260,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(10,10,15,0.32)',
    color: 'var(--text)',
    padding: '16px',
    fontSize: 16,
    lineHeight: 1.6,
    resize: 'vertical',
  },
  chipWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    minHeight: 38,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    padding: '0 12px',
    cursor: 'pointer',
  },
  filterChipSelected: {
    background: 'rgba(167,139,250,0.16)',
    borderColor: 'rgba(167,139,250,0.36)',
  },
  filterChipText: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 700,
  },
  filterChipTextSelected: {
    color: '#E9DDFF',
  },
  selectedWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTag: {
    minHeight: 34,
    borderRadius: 999,
    border: '1px solid rgba(167,139,250,0.32)',
    background: 'rgba(167,139,250,0.18)',
    color: '#E9DDFF',
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  inlineInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  inlineInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(10,10,15,0.32)',
    color: 'var(--text)',
    padding: '0 14px',
    fontSize: 15,
  },
  inlineButton: {
    minHeight: 48,
    borderRadius: 16,
    border: '1px solid rgba(167,139,250,0.34)',
    background: 'rgba(167,139,250,0.18)',
    color: '#E9DDFF',
    padding: '0 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  toggleGrid: {
    display: 'grid',
    gap: 10,
  },
  toggleCard: {
    display: 'grid',
    gap: 6,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(10,10,15,0.32)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  toggleCardSelected: {
    borderColor: 'rgba(167,139,250,0.36)',
    background: 'rgba(167,139,250,0.14)',
  },
  toggleTitle: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.4,
  },
  toggleBody: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  noteCard: {
    display: 'grid',
    gap: 6,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(167,139,250,0.24)',
    background: 'rgba(167,139,250,0.1)',
  },
  noteTitle: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.4,
  },
  noteBody: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  helperText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  entryCard: {
    display: 'grid',
    gap: 6,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(10,10,15,0.32)',
  },
  entryLabel: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.4,
  },
  entryBody: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  errorCard: {
    padding: '16px 18px',
    borderRadius: 16,
    border: '1px solid rgba(255,69,58,0.28)',
    background: 'rgba(255,69,58,0.12)',
  },
  errorText: {
    margin: 0,
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 700,
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerSecondary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  footerPrimary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    border: '1px solid rgba(167,139,250,0.24)',
    background: '#A78BFA',
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
  footerPrimaryDisabled: {
    opacity: 0.65,
  },
};
