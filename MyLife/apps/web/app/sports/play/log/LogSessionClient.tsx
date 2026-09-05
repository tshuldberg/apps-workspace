'use client';

import {
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  METRICS_BY_SPORT,
  type ActivityType,
  type SessionStats,
  type StatMetric,
} from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import { sportsLogSession } from '../../actions';

const SPORTS: Array<{ key: string; label: string }> = [
  { key: 'basketball', label: 'Basketball' },
  { key: 'soccer', label: 'Soccer' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'golf', label: 'Golf' },
  { key: 'running', label: 'Running' },
  { key: 'volleyball', label: 'Volleyball' },
  { key: 'other', label: 'Other' },
];

const ACTIVITIES: Array<{ key: ActivityType; label: string }> = [
  { key: 'game', label: 'Game' },
  { key: 'practice', label: 'Practice' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'training', label: 'Training' },
];

function formatMetricLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseNumeric(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LogSessionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [sport, setSport] = useState<string>('basketball');
  const [activity, setActivity] = useState<ActivityType>('pickup');
  const [playedAtLocal, setPlayedAtLocal] = useState<string>(() =>
    toDatetimeLocal(Date.now()),
  );
  const [duration, setDuration] = useState<string>('');
  const [statValues, setStatValues] = useState<Record<string, string>>({});
  const [customStats, setCustomStats] = useState<
    Array<{ key: string; value: string }>
  >([{ key: '', value: '' }]);
  const [notes, setNotes] = useState('');

  const presetMetrics = useMemo<readonly StatMetric[]>(
    () => METRICS_BY_SPORT[sport] ?? [],
    [sport],
  );

  const buildStats = (): SessionStats => {
    const result: SessionStats = {};
    for (const metric of presetMetrics) {
      const raw = statValues[metric.name];
      if (raw === undefined) continue;
      const n = parseNumeric(raw);
      if (n !== null) result[metric.name] = n;
    }
    for (const row of customStats) {
      const k = row.key.trim();
      if (!k) continue;
      const n = parseNumeric(row.value);
      if (n !== null) result[k] = n;
    }
    return result;
  };

  const handleSave = () => {
    setError(null);
    const startedAt = new Date(playedAtLocal).getTime();
    if (!Number.isFinite(startedAt)) {
      setError('Invalid date/time');
      return;
    }
    const dur = parseNumeric(duration);
    const stats = buildStats();

    startTransition(async () => {
      const res = await sportsLogSession({
        sport,
        activity,
        started_at: startedAt,
        duration_minutes: dur,
        stats,
        notes_md: notes.trim() === '' ? null : notes.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // We persist with personal_best=false by default; the detail view
      // recomputes from siblings on load so the badge self-heals.
      router.push(`/sports/play/${encodeURIComponent(res.id)}`);
      router.refresh();
    });
  };

  const updateCustomRow = (
    idx: number,
    patch: Partial<{ key: string; value: string }>,
  ) => {
    setCustomStats((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );
  };

  // Read-only: searchParams exposure lets future callers prefill values
  // without reworking this island. We inspect but don't mutate.
  void searchParams;

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Log session</p>
      <h2 style={styles.title}>New session</h2>

      <Field label="Sport">
        <div style={styles.chipRow}>
          {SPORTS.map((s) => {
            const active = s.key === sport;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSport(s.key)}
                style={{
                  ...styles.chip,
                  ...(active ? styles.chipActive : {}),
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Activity">
        <div style={styles.segmentRow}>
          {ACTIVITIES.map((a) => {
            const active = a.key === activity;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => setActivity(a.key)}
                style={{
                  ...styles.segment,
                  ...(active ? styles.segmentActive : {}),
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Played at">
        <input
          type="datetime-local"
          value={playedAtLocal}
          onChange={(e) => setPlayedAtLocal(e.target.value)}
          style={styles.input}
        />
      </Field>

      <Field label="Duration (minutes)">
        <input
          type="number"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="60"
          style={styles.input}
        />
      </Field>

      {presetMetrics.length > 0 ? (
        <Field label="Stats">
          <div style={styles.statGrid}>
            {presetMetrics.map((metric) => (
              <div key={metric.name} style={styles.statRow}>
                <label style={styles.statLabel}>
                  {formatMetricLabel(metric.name)}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={statValues[metric.name] ?? ''}
                  onChange={(e) =>
                    setStatValues((prev) => ({
                      ...prev,
                      [metric.name]: e.target.value,
                    }))
                  }
                  placeholder="0"
                  style={{ ...styles.input, width: 120 }}
                />
              </div>
            ))}
          </div>
        </Field>
      ) : null}

      <Field label="Custom stats">
        <div style={styles.customWrap}>
          {customStats.map((row, idx) => (
            <div key={idx} style={styles.customRow}>
              <input
                type="text"
                value={row.key}
                onChange={(e) => updateCustomRow(idx, { key: e.target.value })}
                placeholder="metric name"
                style={{ ...styles.input, flex: 1 }}
              />
              <input
                type="number"
                inputMode="decimal"
                value={row.value}
                onChange={(e) =>
                  updateCustomRow(idx, { value: e.target.value })
                }
                placeholder="value"
                style={{ ...styles.input, width: 120 }}
              />
              {customStats.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCustomStats((prev) =>
                      prev.filter((_, i) => i !== idx),
                    )
                  }
                  style={styles.removeBtn}
                  aria-label="Remove stat"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCustomStats((prev) => [...prev, { key: '', value: '' }])
            }
            style={styles.addBtn}
          >
            + Add custom stat
          </button>
        </div>
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="How did it go? Weather, teammates, takeaways…"
          style={styles.textarea}
        />
      </Field>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.actionRow}>
        <button
          type="button"
          onClick={() => router.back()}
          style={styles.secondaryBtn}
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={styles.primaryBtn}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Save session'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#4ADE80',
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--text)',
  },
  field: { display: 'grid', gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {
    background: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  segmentRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  segment: {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  segmentActive: {
    background: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  statGrid: {
    display: 'grid',
    gap: 8,
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statLabel: {
    color: 'var(--text)',
    fontSize: 14,
  },
  customWrap: {
    display: 'grid',
    gap: 8,
  },
  customRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
  },
  addBtn: {
    alignSelf: 'flex-start',
    padding: '4px 0',
    background: 'transparent',
    border: 'none',
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: {
    margin: 0,
    color: '#F87171',
    fontSize: 13,
  },
  actionRow: {
    display: 'flex',
    gap: 10,
    marginTop: 6,
  },
  primaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
};
