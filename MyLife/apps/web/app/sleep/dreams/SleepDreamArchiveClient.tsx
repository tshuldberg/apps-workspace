'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';
import type {
  Dream,
  DreamType,
} from '@mylife/sleep';
import {
  buildDreamTimelineSections,
  DREAM_EMOTION_OPTIONS,
  getDreamExcerpt,
  getDreamTypeMeta,
} from '@mylife/sleep';
import { queryDreamArchive } from '../actions';
import { SLEEP_DREAM_TYPE_TONES } from '../presentation';
import { SleepPanel } from '../_ui';

const DREAM_TYPES: DreamType[] = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
];

function buildThemeOptions(dreams: Dream[]): string[] {
  const counts = new Map<string, number>();

  for (const dream of dreams) {
    for (const theme of dream.themes) {
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 8)
    .map(([theme]) => theme);
}

export function SleepDreamArchiveClient({
  initialDreams,
}: {
  initialDreams: Dream[];
}) {
  const [queryInput, setQueryInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DreamType | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [lucidOnly, setLucidOnly] = useState(false);
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [results, setResults] = useState(initialDreams);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredResults = useDeferredValue(results);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(queryInput.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [queryInput]);

  useEffect(() => {
    const isInitialView = !debouncedQuery &&
      !selectedType &&
      !selectedTheme &&
      !selectedEmotion &&
      !lucidOnly &&
      !recurringOnly;

    if (isInitialView) {
      setResults(initialDreams);
      setError(null);
      return;
    }

    startTransition(() => {
      void queryDreamArchive({
        query: debouncedQuery,
        type: selectedType,
        theme: selectedTheme,
        emotion: selectedEmotion,
        lucidOnly,
        recurringOnly,
      })
        .then((nextResults) => {
          setResults(nextResults);
          setError(null);
        })
        .catch((reason) => {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not query the dream archive.',
          );
        });
    });
  }, [
    debouncedQuery,
    initialDreams,
    lucidOnly,
    recurringOnly,
    selectedEmotion,
    selectedTheme,
    selectedType,
  ]);

  const sections = useMemo(
    () => buildDreamTimelineSections(deferredResults),
    [deferredResults],
  );
  const themeOptions = useMemo(
    () => buildThemeOptions(initialDreams),
    [initialDreams],
  );
  const hasActiveFilters = Boolean(
    queryInput.trim() ||
      selectedType ||
      selectedTheme ||
      selectedEmotion ||
      lucidOnly ||
      recurringOnly,
  );
  const latestDream = results[0] ?? initialDreams[0] ?? null;
  const isLoading = isPending || queryInput.trim() !== debouncedQuery;

  if (initialDreams.length === 0) {
    return (
      <SleepPanel
        eyebrow="Dreams"
        title="Record your first dream"
        body="Dream capture is ready for fast morning recall, but the archive starts with one saved entry."
      >
        <div style={styles.ctaRow}>
          <Link href="/sleep/dreams/log" style={styles.primaryLink}>
            Log Dream
          </Link>
        </div>
        <ul style={styles.list}>
          <li>Large text-first logging flow optimized for just-woke-up capture</li>
          <li>Type, theme, people, emotion, and recurring-thread metadata</li>
          <li>DB-backed search and linked sleep-entry summaries</li>
        </ul>
      </SleepPanel>
    );
  }

  return (
    <div style={styles.page}>
      <SleepPanel
        eyebrow="Dream Archive"
        title="Search the dreams that stayed with you"
        body="Instant search hits the dream index, then the filters refine by type, theme, emotion, and recurring flags."
      >
        <div style={styles.ctaRow}>
          <Link href="/sleep/dreams/log" style={styles.primaryLink}>
            Log Dream
          </Link>
          <Link href="/sleep/dreams/patterns" style={styles.secondaryLink}>
            Dream Patterns
          </Link>
          <Link href="/sleep/dreams/dictionary" style={styles.secondaryLink}>
            Dream Dictionary
          </Link>
          <div style={styles.statPill}>{results.length} results</div>
          <div style={styles.statPill}>{initialDreams.length} loaded</div>
        </div>
      </SleepPanel>

      <section style={styles.searchCard}>
        <input
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Search dream content, themes, or people"
          style={styles.searchInput}
        />
        <p style={styles.helperCopy}>
          Search updates after 300ms so the archive responds as you type without flickering.
        </p>
      </section>

      <FilterGroup
        label="Type"
        options={DREAM_TYPES.map((type) => ({
          key: type,
          label: getDreamTypeMeta(type).label,
          selected: selectedType === type,
          onClick: () => setSelectedType((current) => (current === type ? null : type)),
        }))}
      />

      {themeOptions.length > 0 && (
        <FilterGroup
          label="Themes"
          options={themeOptions.map((theme) => ({
            key: theme,
            label: theme,
            selected: selectedTheme === theme,
            onClick: () => setSelectedTheme((current) => (current === theme ? null : theme)),
          }))}
        />
      )}

      <FilterGroup
        label="Emotions"
        options={DREAM_EMOTION_OPTIONS.map((emotion) => ({
          key: emotion,
          label: emotion,
          selected: selectedEmotion === emotion,
          onClick: () => setSelectedEmotion((current) => (current === emotion ? null : emotion)),
        }))}
      />

      <FilterGroup
        label="Focus"
        options={[
          {
            key: 'lucid',
            label: 'Lucid only',
            selected: lucidOnly,
            onClick: () => setLucidOnly((value) => !value),
          },
          {
            key: 'recurring',
            label: 'Recurring only',
            selected: recurringOnly,
            onClick: () => setRecurringOnly((value) => !value),
          },
        ]}
      />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            setQueryInput('');
            setDebouncedQuery('');
            setSelectedType(null);
            setSelectedTheme(null);
            setSelectedEmotion(null);
            setLucidOnly(false);
            setRecurringOnly(false);
          }}
          style={styles.secondaryButton}
        >
          Clear Filters
        </button>
      )}

      {latestDream && !hasActiveFilters && (
        <Link href={`/sleep/dreams/${latestDream.id}`} style={styles.latestCard}>
          <div style={styles.latestHeader}>
            <div>
              <p style={styles.cardEyebrow}>Latest Dream</p>
              <h2 style={styles.latestTitle}>{latestDream.date}</h2>
            </div>
            <DreamTypeBadge type={latestDream.type} />
          </div>
          <p style={styles.latestCopy}>
            {getDreamExcerpt(latestDream.content_md, 160)}
          </p>
        </Link>
      )}

      {error && (
        <div style={styles.errorCard}>
          <p style={styles.errorText}>{error}</p>
        </div>
      )}

      {sections.length > 0 ? (
        sections.map((section) => (
          <section key={section.monthKey} style={styles.sectionCard}>
            <p style={styles.sectionTitle}>{section.label}</p>
            <div style={styles.sectionList}>
              {section.dreams.map((dream) => (
                <Link key={dream.id} href={`/sleep/dreams/${dream.id}`} style={styles.dreamCard}>
                  <div style={styles.dreamCardHeader}>
                    <div style={styles.dreamCardCopy}>
                      <strong style={styles.dreamDate}>{dream.date}</strong>
                      <p style={styles.dreamExcerpt}>
                        {getDreamExcerpt(dream.content_md, 140)}
                      </p>
                    </div>
                    <DreamTypeBadge type={dream.type} />
                  </div>

                  {dream.themes.length > 0 && (
                    <div style={styles.chipWrap}>
                      {dream.themes.slice(0, 3).map((theme) => (
                        <span key={`${dream.id}-${theme}`} style={styles.themeChip}>
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}

                  {dream.emotions.length > 0 && (
                    <div style={styles.emotionRow}>
                      {dream.emotions.slice(0, 3).map((emotion) => (
                        <span key={`${dream.id}-${emotion}`} style={styles.emotionText}>
                          {emotion}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div style={styles.emptyCard}>
          <strong style={styles.emptyTitle}>
            {isLoading ? 'Searching...' : 'No dreams match this view'}
          </strong>
          <p style={styles.emptyBody}>
            {isLoading
              ? 'The archive is updating.'
              : 'Try a different search or clear a few filters to widen the archive again.'}
          </p>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  options,
}: {
  label: string;
  options: Array<{
    key: string;
    label: string;
    selected: boolean;
    onClick: () => void;
  }>;
}) {
  return (
    <section style={styles.filterGroup}>
      <p style={styles.filterLabel}>{label}</p>
      <div style={styles.chipWrap}>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={option.onClick}
            style={{
              ...styles.filterChip,
              ...(option.selected ? styles.filterChipSelected : {}),
            }}
          >
            <span
              style={{
                ...styles.filterChipText,
                ...(option.selected ? styles.filterChipTextSelected : {}),
              }}
            >
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DreamTypeBadge({ type }: { type: DreamType }) {
  const meta = getDreamTypeMeta(type);
  const tone = SLEEP_DREAM_TYPE_TONES[meta.tone];

  return (
    <div
      style={{
        ...styles.typeBadge,
        background: tone.background,
        borderColor: tone.borderColor,
        color: tone.color,
      }}
    >
      {meta.label}
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
  secondaryButton: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    justifySelf: 'start',
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
    gap: 8,
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
  helperCopy: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  filterGroup: {
    display: 'grid',
    gap: 10,
  },
  filterLabel: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
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
    borderColor: 'rgba(167,139,250,0.36)',
    background: 'rgba(167,139,250,0.16)',
  },
  filterChipText: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 700,
  },
  filterChipTextSelected: {
    color: '#E9DDFF',
  },
  latestCard: {
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(167,139,250,0.28)',
    background: 'rgba(167,139,250,0.12)',
    textDecoration: 'none',
  },
  latestHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardEyebrow: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  latestTitle: {
    margin: '6px 0 0',
    color: 'var(--text)',
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
  },
  latestCopy: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.6,
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
  sectionCard: {
    display: 'grid',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  sectionList: {
    display: 'grid',
    gap: 12,
  },
  dreamCard: {
    display: 'grid',
    gap: 12,
    padding: 18,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    textDecoration: 'none',
  },
  dreamCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  dreamCardCopy: {
    flex: 1,
    display: 'grid',
    gap: 6,
  },
  dreamDate: {
    color: 'var(--text)',
    fontSize: 16,
    lineHeight: 1.4,
  },
  dreamExcerpt: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  typeBadge: {
    borderRadius: 999,
    border: '1px solid transparent',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 800,
  },
  themeChip: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: '#E9DDFF',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
  },
  emotionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionText: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 700,
  },
  emptyCard: {
    display: 'grid',
    gap: 8,
    padding: 24,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  emptyTitle: {
    color: 'var(--text)',
    fontSize: 18,
    lineHeight: 1.4,
  },
  emptyBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    display: 'grid',
    gap: 8,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
};
