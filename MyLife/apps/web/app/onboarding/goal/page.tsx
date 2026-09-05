'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { selectGoalsAction } from '@/app/actions';

// ── Tokens (Cool Obsidian) ──────────────────────────────────────────

const BACKGROUND = '#131318';
const SURFACE = '#2A292F';
const SURFACE_ELEVATED = '#35343A';
const TEXT = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const PRIMARY = '#FFB877';
const PRIMARY_CONTAINER = '#C9894D';
const BORDER = 'rgba(255,255,255,0.06)';

type Cluster = 'body' | 'mind' | 'home' | 'money' | 'social' | 'outdoor' | 'knowledge';

const CLUSTERS: ReadonlyArray<{
  id: Cluster;
  icon: string;
  label: string;
  description: string;
}> = [
  { id: 'body', icon: '\u{1F4AA}', label: 'Body & energy', description: 'Workouts, nutrition, sleep, sports, mood' },
  { id: 'mind', icon: '\u{1F9E0}', label: 'Mind & reflection', description: 'Mood and reading' },
  { id: 'home', icon: '\u{1F3E1}', label: 'Home & things', description: 'Garden and plant care' },
  { id: 'money', icon: '\u{1F4B0}', label: 'Money & spending', description: 'Envelope budgeting' },
  { id: 'social', icon: '\u{1F465}', label: 'People & events', description: 'Events and RSVPs' },
  { id: 'outdoor', icon: '\u{1F332}', label: 'Outdoors & nature', description: 'Trails, stars, garden' },
  { id: 'knowledge', icon: '\u{1F4DA}', label: 'Learning & reading', description: 'Books, classes, habits' },
];

const MAX_SELECTIONS = 3;
const MIN_SELECTIONS = 1;

export default function GoalOnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<Cluster>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggle = useCallback((id: Cluster) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTIONS) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const canContinue = selected.size >= MIN_SELECTIONS;

  const handleContinue = useCallback(async () => {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    try {
      const ordered = CLUSTERS.filter((c) => selected.has(c.id)).map((c) => c.id);
      await selectGoalsAction(ordered);
      const csv = ordered.join(',');
      router.push(`/onboarding/kit?clusters=${encodeURIComponent(csv)}`);
    } finally {
      setSubmitting(false);
    }
  }, [canContinue, router, selected, submitting]);

  const hint = useMemo(() => {
    if (selected.size === 0) return 'Pick one to three.';
    if (selected.size === MAX_SELECTIONS) return `Maximum ${MAX_SELECTIONS} selected.`;
    return `${selected.size} selected. Add up to ${MAX_SELECTIONS - selected.size} more.`;
  }, [selected.size]);

  return (
    <main style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>What matters to you?</h1>
        <p style={styles.subtitle}>
          Pick up to three. We'll tailor your home screen to show what you care about.
        </p>
      </header>

      <div role="group" aria-label="Goals" style={styles.grid}>
        {CLUSTERS.map((c) => {
          const isSelected = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(c.id)}
              style={{
                ...styles.tile,
                background: isSelected ? SURFACE_ELEVATED : SURFACE,
                borderColor: isSelected ? PRIMARY : BORDER,
                boxShadow: isSelected ? `0 0 0 1px ${PRIMARY} inset` : 'none',
              }}
            >
              <span style={styles.tileIcon} aria-hidden>{c.icon}</span>
              <span style={styles.tileLabel}>{c.label}</span>
              <span style={styles.tileDescription}>{c.description}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.hint}>{hint}</div>

      <div style={styles.footer}>
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={!canContinue || submitting}
          style={{
            ...styles.primaryButton,
            opacity: canContinue && !submitting ? 1 : 0.4,
            cursor: canContinue && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          Continue
        </button>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: BACKGROUND,
    color: TEXT,
    minHeight: '100vh',
    maxWidth: 720,
    margin: '0 auto',
    padding: '48px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    lineHeight: '38px',
    color: TEXT,
  },
  subtitle: {
    margin: 0,
    color: TEXT_SECONDARY,
    fontSize: 16,
    lineHeight: '24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'flex-start',
    textAlign: 'left',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    color: TEXT,
    border: `1px solid ${BORDER}`,
    cursor: 'pointer',
    transition: 'background 120ms ease, border-color 120ms ease',
  },
  tileIcon: {
    fontSize: 26,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: TEXT,
  },
  tileDescription: {
    fontSize: 13,
    lineHeight: '18px',
    color: TEXT_SECONDARY,
  },
  hint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  primaryButton: {
    border: 'none',
    background: PRIMARY,
    color: BACKGROUND,
    borderRadius: 10,
    padding: '14px 24px',
    fontWeight: 700,
    fontSize: 16,
    boxShadow: `0 1px 0 ${PRIMARY_CONTAINER}`,
  },
};
