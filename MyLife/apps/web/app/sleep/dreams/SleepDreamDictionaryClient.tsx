'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import type {
  Dream,
  DreamDictionaryNotesMap,
  DreamDictionarySort,
} from '@mylife/sleep';
import {
  getDreamDictionary,
  searchDreamDictionary,
  sortDreamDictionary,
} from '@mylife/sleep';
import { saveDreamDictionaryThemeNote } from '../actions';
import { SleepPanel } from '../_ui';

const SORT_OPTIONS: DreamDictionarySort[] = [
  'frequency',
  'recency',
  'alphabetical',
];

export function SleepDreamDictionaryClient({
  initialDreams,
  initialNotes,
}: {
  initialDreams: Dream[];
  initialNotes: DreamDictionaryNotesMap;
}) {
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [sort, setSort] = useState<DreamDictionarySort>('frequency');
  const [notes, setNotes] = useState<DreamDictionaryNotesMap>(initialNotes);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(
    () => ({ ...initialNotes }),
  );
  const [savingTheme, setSavingTheme] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dictionary = useMemo(() => {
    const entries = getDreamDictionary(initialDreams, notes);
    return sortDreamDictionary(
      searchDreamDictionary(entries, deferredSearch),
      sort,
    );
  }, [deferredSearch, initialDreams, notes, sort]);

  if (initialDreams.length === 0) {
    return (
      <SleepPanel
        eyebrow="Dream Dictionary"
        title="The dictionary builds itself from saved themes"
        body="Log a few dreams with theme tags and the dictionary will begin to collect recurring symbols, emotions, and personal notes."
      >
        <div style={styles.ctaRow}>
          <Link href="/sleep/dreams/log" style={styles.primaryLink}>
            Log Dream
          </Link>
          <Link href="/sleep/dreams" style={styles.secondaryLink}>
            Back to Archive
          </Link>
        </div>
      </SleepPanel>
    );
  }

  return (
    <div style={styles.page}>
      <SleepPanel
        eyebrow="Dream Dictionary"
        title="Build a private symbol library from your own archive"
        body="Each entry is derived from logged themes, then enriched with your own interpretation notes."
      >
        <div style={styles.ctaRow}>
          <Link href="/sleep/dreams/patterns" style={styles.secondaryLink}>
            Dream Patterns
          </Link>
          <Link href="/sleep/dreams/log" style={styles.primaryLink}>
            Log Dream
          </Link>
          <div style={styles.statPill}>{dictionary.length} themes</div>
        </div>
      </SleepPanel>

      <section style={styles.searchCard}>
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search themes, notes, emotions, or excerpts"
          style={styles.searchInput}
        />
        <div style={styles.sortRow}>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              style={{
                ...styles.sortChip,
                ...(sort === option ? styles.sortChipActive : {}),
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div style={styles.errorCard}>
          <p style={styles.errorText}>{error}</p>
        </div>
      )}

      <div style={styles.dictionaryGrid}>
        {dictionary.map((entry) => {
          const draftValue = draftNotes[entry.theme] ?? entry.note ?? '';
          const isDirty = draftValue !== (notes[entry.theme] ?? '');
          const isSaving = isPending && savingTheme === entry.theme;

          return (
            <article key={entry.theme} style={styles.entryCard}>
              <div style={styles.entryHeader}>
                <div>
                  <p style={styles.entryEyebrow}>Theme</p>
                  <h2 style={styles.entryTitle}>{entry.theme}</h2>
                </div>
                <div style={styles.countPill}>{entry.count} dreams</div>
              </div>

              <div style={styles.metaGrid}>
                <div>
                  <p style={styles.metaLabel}>First logged</p>
                  <p style={styles.metaValue}>{entry.firstOccurrence}</p>
                </div>
                <div>
                  <p style={styles.metaLabel}>Last logged</p>
                  <p style={styles.metaValue}>{entry.lastOccurrence}</p>
                </div>
              </div>

              <div style={styles.chipWrap}>
                {entry.emotionCounts.map((emotion) => (
                  <span key={`${entry.theme}-${emotion.emotion}`} style={styles.chip}>
                    {emotion.emotion} · {emotion.count}
                  </span>
                ))}
              </div>

              <div style={styles.excerptList}>
                {entry.exampleExcerpts.map((excerpt) => (
                  <p key={`${entry.theme}-${excerpt}`} style={styles.excerptCard}>
                    {excerpt}
                  </p>
                ))}
              </div>

              <label style={styles.noteLabel} htmlFor={`note-${entry.theme}`}>
                Your interpretation
              </label>
              <textarea
                id={`note-${entry.theme}`}
                value={draftValue}
                onChange={(event) =>
                  setDraftNotes((current) => ({
                    ...current,
                    [entry.theme]: event.target.value,
                  }))
                }
                placeholder={`What does ${entry.theme} usually mean in your dreams?`}
                style={styles.textarea}
              />

              <div style={styles.entryActions}>
                <button
                  type="button"
                  disabled={!isDirty || isSaving}
                  onClick={() => {
                    setSavingTheme(entry.theme);
                    setError(null);

                    startTransition(() => {
                      void saveDreamDictionaryThemeNote(entry.theme, draftValue)
                        .then((nextNotes) => {
                          setNotes(nextNotes);
                          setDraftNotes((current) => ({
                            ...current,
                            [entry.theme]: nextNotes[entry.theme] ?? '',
                          }));
                        })
                        .catch((reason) => {
                          setError(
                            reason instanceof Error
                              ? reason.message
                              : 'Could not save that dictionary note.',
                          );
                        })
                        .finally(() => {
                          setSavingTheme(null);
                        });
                    });
                  }}
                  style={{
                    ...styles.saveButton,
                    ...((!isDirty || isSaving) ? styles.saveButtonDisabled : {}),
                  }}
                >
                  {isSaving ? 'Saving...' : draftValue.trim() ? 'Save Note' : 'Clear Note'}
                </button>
                <Link href={`/sleep/dreams/${entry.latestDreamId}`} style={styles.secondaryLinkInline}>
                  Latest Dream
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 16,
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  primaryLink: {
    borderRadius: 999,
    background: '#A78BFA',
    color: '#0E0E13',
    padding: '11px 18px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
  secondaryLink: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '11px 18px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  secondaryLinkInline: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 14px',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
  statPill: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 700,
  },
  searchCard: {
    display: 'grid',
    gap: 12,
    padding: 18,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  searchInput: {
    minHeight: 52,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(10,10,15,0.32)',
    color: 'var(--text)',
    padding: '0 16px',
    fontSize: 15,
  },
  sortRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'capitalize',
    cursor: 'pointer',
  },
  sortChipActive: {
    borderColor: 'rgba(167,139,250,0.36)',
    background: 'rgba(167,139,250,0.16)',
    color: '#E9DDFF',
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
  dictionaryGrid: {
    display: 'grid',
    gap: 12,
  },
  entryCard: {
    display: 'grid',
    gap: 14,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  entryEyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#C4B5FD',
  },
  entryTitle: {
    margin: '6px 0 0',
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
    color: 'var(--text)',
    textTransform: 'capitalize',
  },
  countPill: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--text)',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
  },
  metaLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  metaValue: {
    margin: '6px 0 0',
    fontSize: 14,
    color: 'var(--text)',
  },
  chipWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  excerptList: {
    display: 'grid',
    gap: 8,
  },
  excerptCard: {
    margin: 0,
    padding: 12,
    borderRadius: 14,
    background: 'rgba(167,139,250,0.1)',
    color: 'var(--text)',
    fontSize: 13,
    lineHeight: 1.6,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
  },
  textarea: {
    minHeight: 112,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(10,10,15,0.32)',
    color: 'var(--text)',
    padding: 14,
    fontSize: 14,
    lineHeight: 1.6,
    resize: 'vertical',
  },
  entryActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  saveButton: {
    borderRadius: 999,
    border: '1px solid rgba(167,139,250,0.32)',
    background: 'rgba(167,139,250,0.18)',
    color: '#E9DDFF',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  saveButtonDisabled: {
    opacity: 0.55,
    cursor: 'default',
  },
};
