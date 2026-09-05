import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  findRelatedDreams,
  formatDurationLabel,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  getDream,
  getDreamExcerpt,
  getDreamTypeMeta,
  getEntry,
  getSleepDurationTone,
  getSleepWakeFeelingMeta,
  listDreams,
  renderSleepQualityStars,
  type DreamType,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepPanel } from '../../_ui';
import {
  readSleepTargetHours,
  SLEEP_DREAM_TYPE_TONES,
  SLEEP_DURATION_TONES,
} from '../../presentation';
import { SleepDreamActions } from '../SleepDreamActions';

const DREAM_LIMIT = 250;

export default async function SleepDreamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const adapter = getAdapter();
  const dream = getDream(adapter, id);

  if (!dream) {
    notFound();
  }

  const relatedDreams = findRelatedDreams(
    dream,
    listDreams(adapter, { limit: DREAM_LIMIT }),
    4,
  );
  const linkedEntry = dream.sleep_entry_id
    ? getEntry(adapter, dream.sleep_entry_id)
    : null;
  const targetHours = linkedEntry ? readSleepTargetHours(adapter) : 8;
  const typeMeta = getDreamTypeMeta(dream.type);
  const typeTone = SLEEP_DREAM_TYPE_TONES[typeMeta.tone];
  const durationTone = linkedEntry
    ? SLEEP_DURATION_TONES[
        getSleepDurationTone(linkedEntry.duration_minutes, targetHours)
      ]
    : null;

  return (
    <div style={styles.page}>
      <div style={styles.backRow}>
        <Link href="/sleep/dreams" style={styles.backLink}>
          Back to Dreams
        </Link>
      </div>

      <section style={styles.hero}>
        <div style={styles.heroHeader}>
          <div>
            <p style={styles.eyebrow}>Dream Detail</p>
            <h1 style={styles.title}>{formatSleepEntryDateLabel(dream.date)}</h1>
            <p style={styles.subtitle}>Saved privately inside your local dream archive.</p>
          </div>
          <div
            style={{
              ...styles.typeBadge,
              background: typeTone.background,
              borderColor: typeTone.borderColor,
              color: typeTone.color,
            }}
          >
            {typeMeta.label}
          </div>
        </div>

        <div style={styles.metricRow}>
          {dream.is_lucid && <div style={styles.metricPill}>Lucid</div>}
          {dream.is_recurring && <div style={styles.metricPill}>Recurring</div>}
          {dream.emotions.slice(0, 3).map((emotion) => (
            <div key={emotion} style={styles.metricPill}>
              {emotion}
            </div>
          ))}
        </div>
      </section>

      <div style={styles.contentGrid}>
        <SleepPanel
          eyebrow="Dream"
          title="Full entry"
          body="Markdown stays rendered so headings, lists, and emphasis remain readable after the groggy morning capture."
        >
          <div style={styles.markdownShell}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{dream.content_md}</ReactMarkdown>
          </div>
        </SleepPanel>

        <div style={styles.sidebar}>
          <SleepPanel
            eyebrow="Metadata"
            title="Dream tags"
            body="These labels drive search, related-dream matching, and later pattern analysis."
          >
            <MetadataRow label="Type" value={typeMeta.label} />
            <MetadataRow
              label="Themes"
              value={dream.themes.length > 0 ? dream.themes.join(', ') : 'None'}
            />
            <MetadataRow
              label="People"
              value={dream.people.length > 0 ? dream.people.join(', ') : 'None'}
            />
            <MetadataRow
              label="Emotions"
              value={dream.emotions.length > 0 ? dream.emotions.join(', ') : 'None'}
            />
            <MetadataRow label="Lucid" value={dream.is_lucid ? 'Yes' : 'No'} />
            <MetadataRow
              label="Recurring"
              value={dream.is_recurring ? 'Yes' : 'No'}
            />
          </SleepPanel>

          <SleepPanel
            eyebrow="Linked Night"
            title="Sleep entry summary"
            body={
              linkedEntry
                ? 'The dream keeps its linked night nearby so the memory and the sleep data remain attached.'
                : 'This dream was saved without a linked sleep entry.'
            }
          >
            {linkedEntry ? (
              <Link href={`/sleep/entry/${linkedEntry.id}`} style={styles.entryLink}>
                <div style={styles.relatedHeader}>
                  <div>
                    <strong style={styles.entryTitle}>
                      {formatSleepEntryDateLabel(linkedEntry.date)}
                    </strong>
                    <p style={styles.entryBody}>
                      {formatSleepTimeLabel(linkedEntry.bedtime)} to {formatSleepTimeLabel(linkedEntry.wake_time)}
                    </p>
                  </div>
                  {durationTone && (
                    <div
                      style={{
                        ...styles.inlineBadge,
                        background: durationTone.background,
                        borderColor: durationTone.borderColor,
                        color: durationTone.color,
                      }}
                    >
                      {formatDurationLabel(linkedEntry.duration_minutes)}
                    </div>
                  )}
                </div>
                <p style={styles.entryBody}>
                  {renderSleepQualityStars(linkedEntry.quality_rating)} • {getSleepWakeFeelingMeta(linkedEntry.wake_feeling).emoji}{' '}
                  {getSleepWakeFeelingMeta(linkedEntry.wake_feeling).label}
                </p>
              </Link>
            ) : null}
          </SleepPanel>

          <SleepDreamActions
            dreamId={dream.id}
            linkedEntryId={linkedEntry?.id ?? null}
          />
        </div>
      </div>

      <SleepPanel
        eyebrow="Related"
        title="Related dreams"
        body="Recurring groups surface first, then shared themes, so the archive starts to feel like a connected pattern instead of isolated notes."
      >
        {relatedDreams.length > 0 ? (
          <div style={styles.relatedGrid}>
            {relatedDreams.map((relatedDream) => (
              <Link
                key={relatedDream.id}
                href={`/sleep/dreams/${relatedDream.id}`}
                style={styles.relatedCard}
              >
                <div style={styles.relatedHeader}>
                  <strong style={styles.relatedTitle}>
                    {formatSleepEntryDateLabel(relatedDream.date)}
                  </strong>
                  <DreamTypeBadge type={relatedDream.type} />
                </div>
                <p style={styles.relatedBody}>
                  {getDreamExcerpt(relatedDream.content_md, 120)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p style={styles.emptyBody}>
            No related dreams surfaced yet. Keep logging and tagging to make the archive more connected.
          </p>
        )}
      </SleepPanel>
    </div>
  );
}

function MetadataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.metadataRow}>
      <span style={styles.metadataLabel}>{label}</span>
      <span style={styles.metadataValue}>{value}</span>
    </div>
  );
}

function DreamTypeBadge({ type }: { type: DreamType }) {
  const meta = getDreamTypeMeta(type);
  const tone = SLEEP_DREAM_TYPE_TONES[meta.tone];

  return (
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
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 16,
  },
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
    border: '1px solid rgba(167,139,250,0.24)',
    background: 'rgba(167,139,250,0.1)',
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
  typeBadge: {
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
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  sidebar: {
    display: 'grid',
    gap: 16,
    alignContent: 'start',
  },
  markdownShell: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.8,
  },
  metadataRow: {
    display: 'grid',
    gap: 4,
  },
  metadataLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  metadataValue: {
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  entryLink: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'inherit',
    textDecoration: 'none',
  },
  relatedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  relatedCard: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'inherit',
    textDecoration: 'none',
  },
  relatedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  relatedTitle: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.4,
  },
  relatedBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  inlineBadge: {
    borderRadius: 999,
    border: '1px solid transparent',
    padding: '7px 10px',
    fontSize: 11,
    fontWeight: 800,
  },
  entryTitle: {
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.4,
  },
  entryBody: {
    margin: '6px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  emptyBody: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
};
