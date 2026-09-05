'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchTranscriptionStatsAction,
  fetchTranscriptionsAction,
  fetchVoiceNotesAction,
} from './actions';
import { buildRecordingRows, type VoiceNoteRow, type VoiceTranscriptionRow } from './model';
import {
  ACCENT,
  TEXT,
  TEXT_SEC,
  BORDER,
  glassCard,
  heroStyle,
  primaryButton,
  ghostButton,
  formatDuration,
  formatDateShort,
} from './ui';

interface Stats {
  totalCount: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  byLanguage: Array<{ language: string; count: number }>;
}

function weekBuckets(createdAtValues: string[]) {
  const now = new Date();
  return Array.from({ length: 8 }, (_, offset) => {
    const start = new Date(now);
    start.setDate(start.getDate() - (7 * (7 - offset)));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const count = createdAtValues.filter((value) => {
      const date = new Date(value);
      return date >= start && date <= end;
    }).length;
    return {
      label: offset === 7 ? 'Now' : `W${offset + 1}`,
      count,
    };
  });
}

export default function VoiceDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [transcriptions, setTranscriptions] = useState<VoiceTranscriptionRow[]>([]);
  const [notes, setNotes] = useState<VoiceNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [statsData, transcriptionData, noteData] = await Promise.all([
          fetchTranscriptionStatsAction(),
          fetchTranscriptionsAction({ limit: 160 }),
          fetchVoiceNotesAction({ limit: 160 }),
        ]);
        if (cancelled) return;
        setStats(statsData as Stats);
        setTranscriptions(transcriptionData as VoiceTranscriptionRow[]);
        setNotes(noteData as VoiceNoteRow[]);
      } catch {
        if (!cancelled) setError('Could not load the MyVoice dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordings = useMemo(
    () => buildRecordingRows(transcriptions, notes),
    [transcriptions, notes],
  );
  const totalWords = useMemo(
    () => recordings.reduce((sum, row) => sum + row.wordCount, 0),
    [recordings],
  );
  const activity = useMemo(
    () => weekBuckets(transcriptions.map((row) => row.createdAt)),
    [transcriptions],
  );
  const maxBucket = Math.max(...activity.map((bucket) => bucket.count), 1);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ ...heroStyle(), minHeight: 160, opacity: 0.65 }} />
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {[1, 2, 3].map((key) => (
            <div key={key} style={{ ...glassCard(), height: 120, opacity: 0.6, animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...glassCard(), padding: 36, textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', fontSize: 18, margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={heroStyle()}>
        <div style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
          <span
            style={{
              width: 'fit-content',
              borderRadius: 999,
              border: '1px solid var(--accent-voice-border)',
              background: 'var(--accent-voice-dim)',
              color: ACCENT,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.8,
              padding: '6px 10px',
              textTransform: 'uppercase',
            }}
          >
            Private capture stack
          </span>
          <h1 style={{ color: TEXT, fontSize: 42, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>
            Recordings, transcripts, notes, and exports in one red-line workspace.
          </h1>
          <p style={{ color: TEXT_SEC, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
            Every capture stays on-device, searchable by transcript text, tag, and language. Use the dashboard to jump into recordings, export sessions, or tune command and speaker metadata.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/voice/recordings" style={primaryButton()}>
              Browse recordings
            </Link>
            <Link href="/voice/search" style={ghostButton()}>
              Search transcriptions
            </Link>
            <Link href="/voice/export" style={ghostButton()}>
              Export archive
            </Link>
          </div>
        </div>
        <div
          style={{
            minWidth: 280,
            flex: '1 1 280px',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ ...glassCard(), background: 'rgba(255,255,255,0.04)' }}>
            <p style={{ color: TEXT_SEC, fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Recent capture
            </p>
            <p style={{ color: TEXT, fontSize: 18, fontWeight: 700, lineHeight: 1.4, margin: '12px 0 0' }}>
              {recordings[0]?.title ?? 'No recordings yet'}
            </p>
            <p style={{ color: TEXT_SEC, fontSize: 14, margin: '6px 0 0' }}>
              {recordings[0] ? `${formatDuration(recordings[0].durationSeconds)} · ${formatDateShort(recordings[0].createdAt)}` : 'Create your first voice memo on mobile.'}
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            }}
          >
            <MetricCard label="Recordings" value={String(recordings.length)} />
            <MetricCard label="Duration" value={formatDuration(stats?.totalDurationSeconds ?? 0)} />
            <MetricCard label="Words" value={totalWords.toLocaleString()} />
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.2fr 0.8fr' }}>
        <div style={glassCard()}>
          <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: 0 }}>Recent transcriptions</h2>
              <p style={{ color: TEXT_SEC, fontSize: 13, margin: '6px 0 0' }}>
                Last 6 recordings with title, word count, and status.
              </p>
            </div>
            <Link href="/voice/recordings" style={{ color: ACCENT, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {recordings.slice(0, 6).map((row) => (
              <Link
                key={row.id}
                href={row.transcriptionId ? `/voice/recordings/${row.transcriptionId}` : '/voice/notes'}
                style={{
                  alignItems: 'center',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  color: TEXT,
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  padding: '14px 16px',
                  textDecoration: 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ alignItems: 'center', display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: TEXT, fontSize: 15, fontWeight: 700 }}>{row.title}</span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p style={{ color: TEXT_SEC, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.preview}
                  </p>
                </div>
                <div style={{ alignItems: 'flex-end', display: 'grid', gap: 4, textAlign: 'right' }}>
                  <span style={{ color: ACCENT, fontSize: 13, fontWeight: 700 }}>{formatDuration(row.durationSeconds)}</span>
                  <span style={{ color: TEXT_SEC, fontSize: 12 }}>{row.wordCount} words</span>
                  <span style={{ color: TEXT_SEC, fontSize: 12 }}>{formatDateShort(row.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={glassCard()}>
            <h2 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: 0 }}>Quick actions</h2>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {[
                { href: '/voice/recordings', label: 'Review recordings', detail: 'Filter by title, tag, duration, and language.' },
                { href: '/voice/search', label: 'Search transcripts', detail: 'Jump to the exact phrase you need.' },
                { href: '/voice/export', label: 'Export archive', detail: 'Download TXT, Markdown, or print-ready PDFs.' },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 18,
                    color: TEXT,
                    display: 'block',
                    padding: '14px 16px',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{action.label}</div>
                  <div style={{ color: TEXT_SEC, fontSize: 13, marginTop: 4 }}>{action.detail}</div>
                </Link>
              ))}
            </div>
          </div>

          <div style={glassCard()}>
            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: 0 }}>Activity</h2>
              <span style={{ color: TEXT_SEC, fontSize: 12 }}>Last 8 weeks</span>
            </div>
            <div style={{ alignItems: 'end', display: 'grid', gap: 10, gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', marginTop: 18 }}>
              {activity.map((bucket) => (
                <div key={bucket.label} style={{ alignItems: 'center', display: 'grid', gap: 8 }}>
                  <div
                    style={{
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 14,
                      display: 'flex',
                      height: 104,
                      justifyContent: 'flex-end',
                      padding: 8,
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        borderRadius: 999,
                        background: ACCENT,
                        height: `${Math.max((bucket.count / maxBucket) * 84, bucket.count > 0 ? 16 : 4)}px`,
                      }}
                    />
                  </div>
                  <span style={{ color: TEXT_SEC, fontSize: 12 }}>{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...glassCard(), background: 'rgba(255,255,255,0.05)', padding: 14 }}>
      <p style={{ color: TEXT_SEC, fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</p>
      <p style={{ color: TEXT, fontSize: 24, fontWeight: 800, margin: '8px 0 0' }}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: 'Transcribed' | 'Audio Only' | 'Note Only' }) {
  const styles = {
    Transcribed: { bg: 'rgba(48,209,88,0.16)', color: '#8EF6B1' },
    'Audio Only': { bg: 'rgba(255,255,255,0.08)', color: TEXT_SEC },
    'Note Only': { bg: 'rgba(239,68,68,0.16)', color: '#FCA5A5' },
  }[status];

  return (
    <span
      style={{
        background: styles.bg,
        borderRadius: 999,
        color: styles.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        padding: '4px 8px',
        textTransform: 'uppercase',
      }}
    >
      {status}
    </span>
  );
}
