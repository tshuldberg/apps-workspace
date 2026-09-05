import type { CSSProperties } from 'react';
import type { JetLagTracker } from '@mylife/sleep';
import {
  createJetLagTracker,
  getAdjustmentProgress,
  getRecommendation,
  listEntries,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';

type SearchParams = {
  origin?: string | string[];
  destination?: string | string[];
  arrival?: string | string[];
  target?: string | string[];
};

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

function buildTracker(
  originTimeZone: string,
  destinationTimeZone: string,
  arrivalDate: string,
  targetBedtime: string,
): { tracker: JetLagTracker | null; error: string | null } {
  try {
    return {
      tracker: createJetLagTracker(
        originTimeZone,
        destinationTimeZone,
        arrivalDate,
        targetBedtime,
      ),
      error: null,
    };
  } catch (error) {
    return {
      tracker: null,
      error: error instanceof Error ? error.message : 'Unable to build tracker.',
    };
  }
}

export default async function SleepJetLagPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const originTimeZone = paramValue(params.origin, 'America/Los_Angeles');
  const destinationTimeZone = paramValue(params.destination, 'America/New_York');
  const arrivalDate = paramValue(params.arrival, todayDate());
  const targetBedtime = paramValue(params.target, '23:00');
  const entries = listEntries(getAdapter(), { limit: 90 });
  const trackerResult = buildTracker(
    originTimeZone,
    destinationTimeZone,
    arrivalDate,
    targetBedtime,
  );
  const tracker = trackerResult.tracker;
  const progress = tracker ? getAdjustmentProgress(tracker, entries) : 0;
  const recommendations = tracker
    ? [0, 1, 2, 3].map((day) => ({
        day,
        message: getRecommendation(tracker, day),
      }))
    : [];

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Sleep Science</p>
        <h2 style={styles.heroTitle}>Jet lag tracker</h2>
        <p style={styles.body}>
          Build a local adjustment plan from timezone difference, arrival date, target bedtime, and your recent sleep timing.
        </p>
      </section>

      <form method="get" style={styles.card}>
        <p style={styles.eyebrow}>Trip</p>
        <div style={styles.formGrid}>
          <Field label="Origin timezone" name="origin" defaultValue={originTimeZone} />
          <Field label="Destination timezone" name="destination" defaultValue={destinationTimeZone} />
          <Field label="Arrival date" name="arrival" defaultValue={arrivalDate} />
          <Field label="Target bedtime" name="target" defaultValue={targetBedtime} />
        </div>
        <button type="submit" style={styles.primaryButton}>
          Update Tracker
        </button>
      </form>

      {tracker ? (
        <>
          <section style={styles.resultCard}>
            <p style={styles.eyebrow}>Adjustment</p>
            <h3 style={styles.resultTitle}>{progress}% adjusted</h3>
            <p style={styles.body}>
              {tracker.timeZoneDifferenceHours}h {tracker.direction}, about {tracker.estimatedAdjustmentDays} days to adapt.
            </p>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
          </section>

          <section style={styles.metricGrid}>
            <Metric label="Body bedtime" value={tracker.bodyAlignedBedtime} />
            <Metric label="Target" value={tracker.targetBedtime} />
            <Metric label="Daily shift" value={`${tracker.dailyAdjustmentHours}h`} />
            <Metric label="Entries" value={String(entries.length)} />
          </section>

          <section style={styles.card}>
            <p style={styles.eyebrow}>Tonight plan</p>
            {recommendations.map((recommendation) => (
              <p key={recommendation.day} style={styles.recommendation}>
                Day {recommendation.day + 1}: {recommendation.message}
              </p>
            ))}
          </section>
        </>
      ) : (
        <section style={styles.card}>
          <p style={styles.eyebrow}>Check trip</p>
          <p style={styles.body}>{trackerResult.error}</p>
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
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
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
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: '#A78BFA',
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
  recommendation: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.55,
  },
};
