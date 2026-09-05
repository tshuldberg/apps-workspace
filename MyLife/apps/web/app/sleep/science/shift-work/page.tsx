import type { CSSProperties } from 'react';
import type { ExpectedSleepWindow } from '@mylife/sleep';
import {
  evaluateShiftSleep,
  getExpectedSleepWindow,
  listEntries,
  setShiftPattern,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';

type SearchParams = {
  date?: string | string[];
  start?: string | string[];
  end?: string | string[];
  day?: string | string[];
};

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function paramValue(
  value: string | string[] | undefined,
  fallback: string,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function parseDays(value: string | string[] | undefined): number[] {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const parsed = rawValues
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return parsed.length > 0 ? parsed : [1, 2, 3, 4, 5];
}

function buildWindow(
  selectedDate: string,
  startTime: string,
  endTime: string,
  daysOfWeek: readonly number[],
): { window: ExpectedSleepWindow | null; error: string | null } {
  try {
    const pattern = setShiftPattern([
      {
        startTime,
        endTime,
        daysOfWeek,
      },
    ]);
    return {
      window: getExpectedSleepWindow(selectedDate, pattern),
      error: null,
    };
  } catch (error) {
    return {
      window: null,
      error: error instanceof Error ? error.message : 'Unable to build shift window.',
    };
  }
}

export default async function SleepShiftWorkPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const selectedDate = paramValue(params.date, todayDate());
  const startTime = paramValue(params.start, '22:00');
  const endTime = paramValue(params.end, '06:00');
  const daysOfWeek = parseDays(params.day);
  const entries = listEntries(getAdapter(), { limit: 30 });
  const latestEntry = entries[0] ?? null;
  const windowResult = buildWindow(selectedDate, startTime, endTime, daysOfWeek);
  const evaluation =
    latestEntry && windowResult.window
      ? evaluateShiftSleep(latestEntry, windowResult.window)
      : null;

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Sleep Science</p>
        <h2 style={styles.heroTitle}>Shift work mode</h2>
        <p style={styles.body}>
          Define a shift block and MySleep estimates when the recovery sleep window should land.
        </p>
      </section>

      <form method="get" style={styles.card}>
        <p style={styles.eyebrow}>Shift pattern</p>
        <div style={styles.formGrid}>
          <Field label="Date" name="date" defaultValue={selectedDate} />
          <Field label="Start" name="start" defaultValue={startTime} />
          <Field label="End" name="end" defaultValue={endTime} />
        </div>
        <div style={styles.dayRow}>
          {DAY_OPTIONS.map((day) => (
            <label key={day.value} style={styles.dayPill}>
              <input
                name="day"
                type="checkbox"
                value={String(day.value)}
                defaultChecked={daysOfWeek.includes(day.value)}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </div>
        <button type="submit" style={styles.primaryButton}>
          Update Shift
        </button>
      </form>

      {windowResult.error ? (
        <section style={styles.card}>
          <p style={styles.eyebrow}>Check pattern</p>
          <p style={styles.body}>{windowResult.error}</p>
        </section>
      ) : windowResult.window ? (
        <>
          <section style={styles.resultCard}>
            <p style={styles.eyebrow}>Expected sleep</p>
            <h3 style={styles.resultTitle}>
              {windowResult.window.sleepStartTime} - {windowResult.window.sleepEndTime}
            </h3>
            <p style={styles.body}>
              After a {startTime} to {endTime} shift on {selectedDate}.
            </p>
          </section>

          <section style={styles.metricGrid}>
            <Metric label="Shift start" value={startTime} />
            <Metric label="Shift end" value={endTime} />
            <Metric label="Sleep duration" value={`${windowResult.window.sleepDurationMinutes / 60}h`} />
            <Metric label="Recent logs" value={String(entries.length)} />
          </section>

          <section style={styles.card}>
            <p style={styles.eyebrow}>Latest match</p>
            {evaluation ? (
              <>
                <h3 style={styles.cardTitle}>{evaluation.score}% aligned</h3>
                <p style={styles.body}>
                  {evaluation.rating.replace('_', ' ')} with {evaluation.overlapMinutes} minutes overlapping the expected window.
                </p>
              </>
            ) : (
              <p style={styles.body}>
                Log sleep after this shift to score alignment.
              </p>
            )}
          </section>
        </>
      ) : (
        <section style={styles.card}>
          <p style={styles.eyebrow}>No shift today</p>
          <p style={styles.body}>
            The selected date does not match the active shift days.
          </p>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input name={name} defaultValue={defaultValue} style={styles.input} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: 'grid',
    gap: 16,
  },
  hero: {
    display: 'grid',
    gap: 10,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(167,139,250,0.10)',
  },
  eyebrow: {
    margin: 0,
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 30,
    lineHeight: 1.08,
  },
  body: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  card: {
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 22,
    lineHeight: 1.2,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text)',
    padding: '0 12px',
    fontSize: 14,
  },
  dayRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    border: '1px solid rgba(167,139,250,0.28)',
    background: 'rgba(167,139,250,0.10)',
    color: '#E9DDFF',
    padding: '8px 10px',
    fontSize: 13,
    fontWeight: 700,
  },
  primaryButton: {
    justifySelf: 'start',
    border: '1px solid rgba(167,139,250,0.42)',
    background: 'rgba(167,139,250,0.18)',
    color: '#F5F0FF',
    borderRadius: 12,
    padding: '10px 14px',
    fontWeight: 800,
  },
  resultCard: {
    display: 'grid',
    gap: 10,
    padding: 22,
    borderRadius: 20,
    border: '1px solid rgba(167,139,250,0.30)',
    background: 'rgba(167,139,250,0.12)',
  },
  resultTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 34,
    lineHeight: 1.05,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  metricCard: {
    display: 'grid',
    gap: 6,
    padding: 18,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  metricValue: {
    color: 'var(--text)',
    fontSize: 24,
  },
};
