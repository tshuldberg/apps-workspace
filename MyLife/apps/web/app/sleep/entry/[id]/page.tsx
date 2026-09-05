import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatFactorClockTime,
  formatDurationLabel,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  getEntry,
  getFactorByEntry,
  getFactorRoomLightMeta,
  getFactorRoomNoiseMeta,
  getFactorRoomTempMeta,
  getPreSleepActivityMeta,
  getSleepSupplementMeta,
  getStressLevelMeta,
  getDreamExcerpt,
  getDreamTypeMeta,
  getDreamsByEntry,
  getSleepDurationTone,
  getSleepWakeFeelingMeta,
  renderSleepQualityStars,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepPanel } from '../../_ui';
import {
  readSleepTargetHours,
  SLEEP_DREAM_TYPE_TONES,
  SLEEP_DURATION_TONES,
} from '../../presentation';
import { SleepEntryActions } from './SleepEntryActions';

export default async function SleepEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const adapter = getAdapter();
  const entry = getEntry(adapter, id);

  if (!entry) {
    notFound();
  }

  const targetHours = readSleepTargetHours(adapter);
  const linkedDreams = getDreamsByEntry(adapter, entry.id);
  const factor = getFactorByEntry(adapter, entry.id);
  const durationTone = getSleepDurationTone(entry.duration_minutes, targetHours);
  const durationToneStyle = SLEEP_DURATION_TONES[durationTone];
  const feeling = getSleepWakeFeelingMeta(entry.wake_feeling);
  const alarmLabel = entry.alarm_time
    ? `${formatSleepTimeLabel(entry.alarm_time)}${entry.snooze_count > 0 ? ` • ${entry.snooze_count} snoozes` : ''}`
    : entry.snooze_count > 0
      ? `${entry.snooze_count} snoozes logged`
      : 'No alarm recorded';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={styles.backRow}>
        <Link href="/sleep" style={styles.backLink}>
          Back to Sleep Log
        </Link>
      </div>

      <section style={styles.hero}>
        <div style={styles.heroHeader}>
          <div>
            <p style={styles.eyebrow}>Sleep Entry</p>
            <h1 style={styles.title}>{formatSleepEntryDateLabel(entry.date)}</h1>
            <p style={styles.subtitle}>
              {formatSleepTimeLabel(entry.bedtime)} to {formatSleepTimeLabel(entry.wake_time)}
            </p>
          </div>
          <div
            style={{
              ...styles.durationBadge,
              background: durationToneStyle.background,
              borderColor: durationToneStyle.borderColor,
              color: durationToneStyle.color,
            }}
          >
            {formatDurationLabel(entry.duration_minutes)}
          </div>
        </div>

        <div style={styles.metricRow}>
          <div style={styles.metricPill}>{renderSleepQualityStars(entry.quality_rating)}</div>
          <div style={styles.metricPill}>
            {feeling.emoji} {feeling.label}
          </div>
          <div style={styles.metricPill}>Target {targetHours}h</div>
        </div>
      </section>

      <section style={styles.metricGrid}>
        <MetricCard
          label="Duration"
          value={formatDurationLabel(entry.duration_minutes)}
          detail="Computed from bedtime to wake time"
        />
        <MetricCard
          label="Quality"
          value={`${entry.quality_rating}/5`}
          detail={renderSleepQualityStars(entry.quality_rating)}
        />
        <MetricCard
          label="Wake-ups"
          value={String(entry.wake_count)}
          detail="Interrupted moments remembered"
        />
        <MetricCard
          label="Latency"
          value={
            entry.sleep_latency_minutes != null
              ? `${entry.sleep_latency_minutes}m`
              : 'Not logged'
          }
          detail="Time between bed and sleep onset"
        />
        <MetricCard
          label="Wake Feeling"
          value={`${feeling.emoji} ${feeling.label}`}
          detail="Saved in the morning check-in"
        />
        <MetricCard
          label="Alarm"
          value={alarmLabel}
          detail="Captured when an alarm was used"
        />
      </section>

      <SleepPanel
        eyebrow="Notes"
        title="Night notes"
        body={entry.notes_md?.trim() || 'No notes were saved for this night.'}
      />

      <SleepPanel
        eyebrow="Dreams"
        title="Dreams logged this night"
        body={
          linkedDreams.length > 0
            ? 'Dreams linked to this night stay one click away so the memory and the sleep metrics remain attached.'
            : 'No dreams are linked to this night yet.'
        }
      >
        {linkedDreams.length > 0 ? (
          <div style={styles.linkedList}>
            {linkedDreams.map((dream) => {
              const meta = getDreamTypeMeta(dream.type);
              const tone = SLEEP_DREAM_TYPE_TONES[meta.tone];
              return (
                <Link
                  key={dream.id}
                  href={`/sleep/dreams/${dream.id}`}
                  style={styles.linkedDreamCard}
                >
                  <div style={styles.latestHeader}>
                    <strong style={styles.entryDate}>
                      {formatSleepEntryDateLabel(dream.date)}
                    </strong>
                    <div
                      style={{
                        ...styles.inlineBadge,
                        background: tone.background,
                        borderColor: tone.borderColor,
                        color: tone.color,
                      }}
                    >
                      {meta.label}
                    </div>
                  </div>
                  <span style={styles.entryMeta}>
                    {getDreamExcerpt(dream.content_md, 120)}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={styles.paginationRow}>
            <Link href={`/sleep/dreams/log?entryId=${entry.id}`} style={styles.primaryLink}>
              Log Dream From This Night
            </Link>
          </div>
        )}
      </SleepPanel>

      <SleepPanel
        eyebrow="Factors"
        title="Pre-sleep context"
        body={
          factor
            ? 'This factor log is attached to the same night as the sleep entry, so the nightly context and the next-morning outcome stay paired.'
            : 'No factor log is attached to this night yet.'
        }
      >
        {factor ? (
          <>
            <div style={styles.factorGrid}>
              <MetricCard
                label="Caffeine"
                value={formatFactorClockTime(factor.last_caffeine_time) ?? 'Not logged'}
                detail="Last caffeine cutoff"
              />
              <MetricCard
                label="Meal"
                value={formatFactorClockTime(factor.last_meal_time) ?? 'Not logged'}
                detail="Last meal cutoff"
              />
              <MetricCard
                label="Screens"
                value={formatFactorClockTime(factor.screen_cutoff_time) ?? 'Not logged'}
                detail="Screen cutoff"
              />
              <MetricCard
                label="Alcohol"
                value={factor.alcohol_drinks > 0 ? `${factor.alcohol_drinks} drinks` : 'None'}
                detail="Drinks before bed"
              />
              <MetricCard
                label="Exercise"
                value={
                  factor.exercise_today
                    ? formatFactorClockTime(factor.exercise_time) ?? 'Yes'
                    : 'No'
                }
                detail="Exercise that day"
              />
              <MetricCard
                label="Stress"
                value={
                  factor.stress_level
                    ? `${getStressLevelMeta(factor.stress_level)?.emoji ?? ''} ${getStressLevelMeta(factor.stress_level)?.label ?? factor.stress_level}`.trim()
                    : 'Not logged'
                }
                detail="Evening or retrospective check-in"
              />
            </div>

            <div style={styles.summaryGrid}>
              <SummaryTile
                label="Activities"
                value={
                  factor.pre_sleep_activities.length > 0
                    ? factor.pre_sleep_activities
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
                        .map((value) => getSleepSupplementMeta(value).label)
                        .join(', ')
                    : 'None selected'
                }
              />
              <SummaryTile
                label="Environment"
                value={[
                  factor.room_temp
                    ? getFactorRoomTempMeta(factor.room_temp).label
                    : null,
                  factor.room_light
                    ? getFactorRoomLightMeta(factor.room_light).label
                    : null,
                  factor.room_noise
                    ? getFactorRoomNoiseMeta(factor.room_noise).label
                    : null,
                ].filter(Boolean).join(' / ') || 'Not logged'}
              />
            </div>

            <p style={styles.entryMeta}>
              {factor.notes?.trim() || 'No disturbance note was saved for this night.'}
            </p>
            <div style={styles.paginationRow}>
              <Link href={`/sleep/factors/log?entryId=${entry.id}`} style={styles.primaryLink}>
                Edit Factors
              </Link>
            </div>
          </>
        ) : (
          <div style={styles.paginationRow}>
            <Link href={`/sleep/factors/log?entryId=${entry.id}`} style={styles.primaryLink}>
              Log Factors For This Night
            </Link>
          </div>
        )}
      </SleepPanel>

      <SleepEntryActions entryId={entry.id} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricDetail}>{detail}</span>
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
  backRow: {
    display: 'flex',
    alignItems: 'center',
  },
  backLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  hero: {
    display: 'grid',
    gap: 14,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  heroHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: {
    margin: 0,
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '8px 0 0',
    color: 'var(--text)',
    fontSize: 32,
    lineHeight: 1.05,
    letterSpacing: '-0.05em',
  },
  subtitle: {
    margin: '8px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  durationBadge: {
    borderRadius: 999,
    border: '1px solid transparent',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 800,
  },
  metricRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(10,10,15,0.3)',
    color: 'var(--text)',
    padding: '9px 12px',
    fontSize: 13,
    fontWeight: 700,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  metricCard: {
    display: 'grid',
    gap: 6,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: 'var(--text)',
    fontSize: 16,
    lineHeight: 1.4,
  },
  metricDetail: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  linkedList: {
    display: 'grid',
    gap: 12,
  },
  factorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
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
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
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
    lineHeight: 1.5,
  },
  linkedDreamCard: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'inherit',
    textDecoration: 'none',
  },
  inlineBadge: {
    borderRadius: 999,
    border: '1px solid transparent',
    padding: '7px 10px',
    fontSize: 11,
    fontWeight: 800,
  },
  paginationRow: {
    display: 'flex',
    flexWrap: 'wrap',
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
  entryDate: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.4,
  },
  entryMeta: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
};
