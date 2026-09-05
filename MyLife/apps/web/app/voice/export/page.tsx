'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fetchSpeakerSegmentsAction,
  fetchTranscriptionsAction,
  fetchVoiceNotesAction,
} from '../actions';
import {
  buildRecordingRows,
  splitTags,
  type RecordingRow,
  type VoiceNoteRow,
  type VoiceTranscriptionRow,
} from '../model';
import {
  TEXT,
  TEXT_SEC,
  BORDER,
  glassCard,
  heroStyle,
  pillButton,
  formatDate,
  formatDuration,
  getLanguageName,
} from '../ui';

type ExportFormat = 'txt' | 'md' | 'pdf';

function downloadFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function VoiceExportPageContent() {
  const searchParams = useSearchParams();
  const preselectedIds = useMemo(() => searchParams.get('ids')?.split(',').filter(Boolean) ?? [], [searchParams]);

  const [transcriptions, setTranscriptions] = useState<VoiceTranscriptionRow[]>([]);
  const [notes, setNotes] = useState<VoiceNoteRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedIds);
  const [format, setFormat] = useState<ExportFormat>('md');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeSpeakers, setIncludeSpeakers] = useState(true);

  useEffect(() => {
    async function load() {
      const [transcriptionData, noteData] = await Promise.all([
        fetchTranscriptionsAction({ limit: 500 }),
        fetchVoiceNotesAction({ limit: 500 }),
      ]);
      setTranscriptions(transcriptionData as VoiceTranscriptionRow[]);
      setNotes(noteData as VoiceNoteRow[]);
    }

    void load();
  }, []);

  useEffect(() => {
    setSelectedIds(preselectedIds);
  }, [preselectedIds]);

  const rows = useMemo(() => buildRecordingRows(transcriptions, notes), [transcriptions, notes]);
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));

  const buildExportBody = async (recordings: RecordingRow[]) => {
    const sections = await Promise.all(
      recordings.map(async (recording) => {
        const speakerSegments = recording.transcriptionId && includeTimestamps
          ? (await fetchSpeakerSegmentsAction(recording.transcriptionId)) as Array<{ speakerLabel: string; startSeconds: number; text: string }>
          : [];

        const header = includeMetadata
          ? [
              `Title: ${recording.title}`,
              `Date: ${formatDate(recording.createdAt)}`,
              `Duration: ${formatDuration(recording.durationSeconds)}`,
              `Language: ${getLanguageName(recording.language)}`,
              `Tags: ${splitTags(recording.tags.join(',')).join(', ') || 'None'}`,
            ].join('\n')
          : '';

        const body = includeTimestamps && speakerSegments.length > 0
          ? speakerSegments
              .map((segment) => {
                const prefix = includeSpeakers ? `[${segment.speakerLabel}] ` : '';
                return `${formatDuration(segment.startSeconds)} ${prefix}${segment.text}`;
              })
              .join('\n')
          : recording.preview;

        if (format === 'md') {
          return `## ${recording.title}\n\n${header ? `${header}\n\n` : ''}${body}`;
        }
        return `${recording.title}\n${header ? `${header}\n\n` : ''}${body}`;
      }),
    );

    return sections.join(format === 'md' ? '\n\n---\n\n' : '\n\n====================\n\n');
  };

  const preview = useMemo(() => {
    if (selectedRows.length === 0) return 'Select one or more recordings to preview the export.';
    const first = selectedRows[0];
    const header = includeMetadata
      ? `Title: ${first.title}\nDate: ${formatDate(first.createdAt)}\nDuration: ${formatDuration(first.durationSeconds)}\nLanguage: ${getLanguageName(first.language)}`
      : '';
    return `${header}${header ? '\n\n' : ''}${first.preview}`;
  }, [includeMetadata, selectedRows]);

  const handleExport = async () => {
    const body = await buildExportBody(selectedRows);
    if (format === 'pdf') {
      const popup = window.open('', '_blank', 'noopener,noreferrer');
      popup?.document.write(`<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; padding: 32px; background: #fff; color: #111;">${body.replace(/</g, '&lt;')}</pre>`);
      popup?.document.close();
      popup?.print();
      return;
    }

    downloadFile(
      `myvoice-export.${format}`,
      body,
      format === 'md' ? 'text/markdown' : 'text/plain',
    );
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={heroStyle()}>
        <div style={{ display: 'grid', gap: 10, maxWidth: 640 }}>
          <h1 style={{ color: TEXT, fontSize: 38, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>Export</h1>
          <p style={{ color: TEXT_SEC, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
            Bundle one recording or your entire archive with metadata, timestamps, and speaker labels when they are available.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['txt', 'md', 'pdf'] as ExportFormat[]).map((value) => (
            <button key={value} type="button" onClick={() => setFormat(value)} style={pillButton(format === value)}>
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(0, 1.1fr)' }}>
        <div style={glassCard()}>
          <h2 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: '0 0 14px' }}>Selection</h2>
          <div style={{ display: 'grid', gap: 10, maxHeight: 480, overflow: 'auto' }}>
            {rows.map((row) => {
              const active = selectedIds.includes(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setSelectedIds((current) =>
                      current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id],
                    );
                  }}
                  style={{
                    background: active ? 'rgba(239,68,68,0.16)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(239,68,68,0.3)' : BORDER}`,
                    borderRadius: 16,
                    color: TEXT,
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 6,
                    padding: '12px 14px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{row.title}</span>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>{formatDate(row.createdAt)} · {formatDuration(row.durationSeconds)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={glassCard()}>
            <h2 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: '0 0 14px' }}>Options</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {([
                ['Include metadata header', includeMetadata, setIncludeMetadata],
                ['Include timestamps', includeTimestamps, setIncludeTimestamps],
                ['Include speaker labels', includeSpeakers, setIncludeSpeakers],
              ] as const).map(([label, value, setter]) => (
                <label key={label as string} style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
                  <input type="checkbox" checked={value} onChange={(event) => setter(event.target.checked)} />
                  <span style={{ color: TEXT, fontSize: 14 }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={glassCard()}>
            <h2 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: '0 0 14px' }}>Preview</h2>
            <pre
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 18,
                border: `1px solid ${BORDER}`,
                color: TEXT_SEC,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                lineHeight: 1.7,
                margin: 0,
                minHeight: 220,
                overflow: 'auto',
                padding: 16,
                whiteSpace: 'pre-wrap',
              }}
            >
              {preview}
            </pre>
            <button
              type="button"
              disabled={selectedRows.length === 0}
              onClick={() => void handleExport()}
              style={{
                marginTop: 14,
                borderRadius: 14,
                border: 'none',
                background: 'var(--accent-voice)',
                color: 'var(--background)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 800,
                padding: '12px 16px',
              }}
            >
              Export {selectedRows.length} recording{selectedRows.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VoiceExportPage() {
  return (
    <Suspense fallback={null}>
      <VoiceExportPageContent />
    </Suspense>
  );
}
