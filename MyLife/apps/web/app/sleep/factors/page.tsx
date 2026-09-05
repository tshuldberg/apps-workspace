import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  formatFactorClockTime,
  formatSleepEntryDateLabel,
  getEntry,
  getFactorRoomLightMeta,
  getFactorRoomNoiseMeta,
  getFactorRoomTempMeta,
  getPreSleepActivityMeta,
  getSleepSupplementMeta,
  getStressLevelMeta,
  listFactors,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepPanel } from '../_ui';

const FACTOR_LIMIT = 24;

export default function SleepFactorsPage() {
  const adapter = getAdapter();
  const factors = listFactors(adapter, { limit: FACTOR_LIMIT });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SleepPanel
        eyebrow="Factors"
        title="Evening and retrospective factor logs"
        body="Use the full log when you want richer nightly context, or the quick path when you only want stress, caffeine, and exercise captured before the memory fades."
      >
        <div style={styles.ctaRow}>
          <Link href="/sleep/factors/log" style={styles.primaryLink}>
            Full Log
          </Link>
          <Link href="/sleep/factors/log?quick=1" style={styles.secondaryLink}>
            Quick Log
          </Link>
        </div>
      </SleepPanel>

      {factors.length === 0 ? (
        <SleepPanel
          eyebrow="No Logs Yet"
          title="Your factor archive is waiting"
          body="The first saved factor log becomes the nightly context layer for caffeine timing, exercise, room conditions, stress, and other pre-sleep variables."
        >
          <div style={styles.ctaRow}>
            <Link href="/sleep/factors/log" style={styles.primaryLink}>
              Start Factor Log
            </Link>
          </div>
        </SleepPanel>
      ) : (
        <section style={styles.list}>
          {factors.map((factor) => {
            const linkedEntry = factor.sleep_entry_id
              ? getEntry(adapter, factor.sleep_entry_id)
              : null;
            const stress = getStressLevelMeta(factor.stress_level);
            const roomSummary = [
              factor.room_temp
                ? getFactorRoomTempMeta(factor.room_temp).label
                : null,
              factor.room_light
                ? getFactorRoomLightMeta(factor.room_light).label
                : null,
              factor.room_noise
                ? getFactorRoomNoiseMeta(factor.room_noise).label
                : null,
            ].filter(Boolean).join(' / ');

            return (
              <article key={factor.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <p style={styles.cardEyebrow}>Factor log</p>
                    <h2 style={styles.cardTitle}>
                      {formatSleepEntryDateLabel(factor.date)}
                    </h2>
                  </div>
                  <Link
                    href={
                      factor.sleep_entry_id
                        ? `/sleep/factors/log?entryId=${factor.sleep_entry_id}`
                        : `/sleep/factors/log?date=${factor.date}`
                    }
                    style={styles.inlineLink}
                  >
                    Edit
                  </Link>
                </div>

                <div style={styles.metricRow}>
                  <span style={styles.metricPill}>
                    Caffeine {formatFactorClockTime(factor.last_caffeine_time) ?? 'not logged'}
                  </span>
                  <span style={styles.metricPill}>
                    Exercise{' '}
                    {factor.exercise_today
                      ? formatFactorClockTime(factor.exercise_time) ?? 'yes'
                      : 'no'}
                  </span>
                  <span style={styles.metricPill}>
                    Stress {stress ? `${stress.emoji} ${stress.label}` : 'not logged'}
                  </span>
                </div>

                <div style={styles.summaryGrid}>
                  <SummaryTile
                    label="Activities"
                    value={
                      factor.pre_sleep_activities.length > 0
                        ? factor.pre_sleep_activities
                            .slice(0, 3)
                            .map((value) => getPreSleepActivityMeta(value).label)
                            .join(', ')
                        : 'None selected'
                    }
                  />
                  <SummaryTile
                    label="Supplements"
                    value={
                      factor.supplements.length > 0
                        ? factor.supplements
                            .slice(0, 3)
                            .map((value) => getSleepSupplementMeta(value).label)
                            .join(', ')
                        : 'None selected'
                    }
                  />
                  <SummaryTile
                    label="Environment"
                    value={roomSummary || 'Not logged'}
                  />
                </div>

                <p style={styles.cardBody}>
                  {linkedEntry
                    ? `Linked to sleep entry ${formatSleepEntryDateLabel(linkedEntry.date)}.`
                    : 'Saved before the matching sleep entry existed, or kept as a standalone nightly context log.'}
                </p>
              </article>
            );
          })}
        </section>
      )}
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
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  primaryLink: {
    borderRadius: 999,
    background: '#7DD3FC',
    color: '#03121C',
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
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  list: {
    display: 'grid',
    gap: 12,
  },
  card: {
    display: 'grid',
    gap: 14,
    padding: 18,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(15,23,42,0.42), rgba(15,23,42,0.28))',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEyebrow: {
    margin: 0,
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  cardTitle: {
    margin: '6px 0 0',
    color: 'var(--text)',
    fontSize: 24,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
  },
  inlineLink: {
    color: '#D8F3FF',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  metricRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '9px 12px',
    fontSize: 13,
    fontWeight: 700,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
  cardBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
};
