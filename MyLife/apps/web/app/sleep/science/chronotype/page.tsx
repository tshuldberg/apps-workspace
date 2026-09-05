import type { CSSProperties } from 'react';
import type { CircadianProfilePoint } from '@mylife/sleep';
import {
  getChronotypeAssessment,
  getCircadianProfile,
  listEntries,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';

function formatChronotype(value: string | null): string {
  if (!value) {
    return 'Keep logging';
  }

  return value
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function getPhasePoint(
  points: readonly CircadianProfilePoint[],
  phase: CircadianProfilePoint['phase'],
): CircadianProfilePoint | null {
  return points.find((point) => point.phase === phase) ?? null;
}

export default function SleepChronotypePage() {
  const entries = listEntries(getAdapter(), { limit: 500 });
  const assessment = getChronotypeAssessment(entries);
  const profile = getCircadianProfile(entries);
  const peak = getPhasePoint(profile.points, 'peak');
  const dip = getPhasePoint(profile.points, 'dip');
  const secondWind = getPhasePoint(profile.points, 'secondary_peak');
  const neededEntries = Math.max(
    0,
    assessment.requiredFreeDayEntries - assessment.freeDaySampleSize,
  );

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Sleep Science</p>
        <h2 style={styles.heroTitle}>Chronotype and circadian rhythm</h2>
        <p style={styles.body}>
          MySleep estimates your natural rhythm from weekend sleep timing, then maps a simple 24 hour alertness curve from your typical wake time.
        </p>
      </section>

      <section style={styles.resultCard}>
        <p style={styles.eyebrow}>Chronotype</p>
        <h3 style={styles.resultTitle}>{formatChronotype(assessment.chronotype)}</h3>
        <p style={styles.body}>{assessment.description}</p>
        <p style={styles.highlight}>
          {assessment.status === 'insufficient_data'
            ? `Log ${neededEntries} more weekend or free-day nights to unlock a confident chronotype.`
            : `${assessment.confidence} confidence from ${assessment.freeDaySampleSize} free-day nights.`}
        </p>
      </section>

      <section style={styles.metricGrid}>
        <Metric label="Free-day nights" value={String(assessment.freeDaySampleSize)} />
        <Metric label="Median bedtime" value={assessment.medianBedtime ?? '--'} />
        <Metric label="Median wake" value={assessment.medianWakeTime ?? '--'} />
        <Metric label="Midpoint" value={assessment.midpoint ?? '--'} />
      </section>

      <section style={styles.card}>
        <p style={styles.eyebrow}>Circadian profile</p>
        <h3 style={styles.cardTitle}>Typical wake time {profile.recommendedWakeTime}</h3>
        <div style={styles.phaseList}>
          <PhaseRow label="Peak" point={peak} />
          <PhaseRow label="Dip" point={dip} />
          <PhaseRow label="Second wind" point={secondWind} />
        </div>
      </section>
    </div>
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

function PhaseRow({
  label,
  point,
}: {
  label: string;
  point: CircadianProfilePoint | null;
}) {
  return (
    <div style={styles.phaseRow}>
      <span>{label}</span>
      <strong>{point ? `${point.clockTime} (${point.alertness}/100)` : '--'}</strong>
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
  highlight: {
    margin: 0,
    color: '#E9DDFF',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.5,
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
  phaseList: {
    display: 'grid',
    gap: 8,
  },
  phaseRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
};
