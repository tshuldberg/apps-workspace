'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  createVoiceNoteAction,
  deleteTranscriptionAction,
  deleteVoiceNoteAction,
  fetchLanguageBreakdownAction,
  fetchSpeakerSegmentsAction,
  fetchTranscriptionAction,
  fetchVoiceNotesAction,
  updateTranscriptionAction,
  updateVoiceNoteAction,
} from '../../actions';
import {
  calculateReadingTime,
  extractKeywords,
} from '@mylife/voice';
import { deriveTitle, splitTags, type VoiceNoteRow, type VoiceTranscriptionRow } from '../../model';
import {
  ACCENT,
  TEXT,
  TEXT_SEC,
  BORDER,
  glassCard,
  glassStrong,
  formatDuration,
  formatDate,
  getLanguageColor,
  getLanguageName,
  heroStyle,
  primaryButton,
  ghostButton,
} from '../../ui';

interface SpeakerSegment {
  id: string;
  speakerLabel: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

interface LanguageBreakdown {
  language: string;
  percentage: number;
  totalSeconds: number;
}

function highlightText(text: string, query: string | null) {
  if (!query) return text;
  const tokens = query
    .replace(/"([^"]+)"/g, '$1')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (tokens.length === 0) return text;

  const regex = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(regex).map((part, index) => {
    const matched = tokens.some((token) => token.toLowerCase() === part.toLowerCase());
    return matched ? (
      <mark key={`${part}-${index}`} style={{ background: 'rgba(239,68,68,0.2)', color: TEXT }}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

function RecordingDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('query');
  const id = params.id as string;

  const [transcription, setTranscription] = useState<VoiceTranscriptionRow | null>(null);
  const [linkedNote, setLinkedNote] = useState<VoiceNoteRow | null>(null);
  const [segments, setSegments] = useState<SpeakerSegment[]>([]);
  const [languageBreakdown, setLanguageBreakdown] = useState<LanguageBreakdown[]>([]);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftTags, setDraftTags] = useState('');

  const load = useCallback(async () => {
    const [transcriptionData, notesData, speakerData, languageData] = await Promise.all([
      fetchTranscriptionAction(id),
      fetchVoiceNotesAction({ limit: 500 }),
      fetchSpeakerSegmentsAction(id),
      fetchLanguageBreakdownAction(id),
    ]);

    const currentTranscription = transcriptionData as VoiceTranscriptionRow | null;
    const currentNote = (notesData as VoiceNoteRow[]).find((note) => note.transcriptionId === id) ?? null;
    setTranscription(currentTranscription);
    setLinkedNote(currentNote);
    setSegments(speakerData as SpeakerSegment[]);
    setLanguageBreakdown(languageData as LanguageBreakdown[]);
    setDraftTitle(currentNote?.title ?? deriveTitle(currentTranscription?.text ?? '', 'Voice recording'));
    setDraftText(currentTranscription?.text ?? '');
    setDraftTags(currentNote?.tags ?? '');
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const wordCount = useMemo(() => draftText.trim().split(/\s+/).filter(Boolean).length, [draftText]);
  const readingTime = useMemo(() => calculateReadingTime(draftText), [draftText]);
  const keywords = useMemo(() => extractKeywords(draftText, 8), [draftText]);

  if (!transcription) {
    return (
      <div style={{ ...glassCard(), padding: 36, textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', fontSize: 18, margin: 0 }}>Recording not found.</p>
      </div>
    );
  }

  const saveChanges = async () => {
    await updateTranscriptionAction(id, { text: draftText });
    if (linkedNote) {
      await updateVoiceNoteAction(linkedNote.id, { title: draftTitle, tags: draftTags || null });
    } else {
      await createVoiceNoteAction({ title: draftTitle, tags: draftTags || null, transcriptionId: id });
    }
    setEditing(false);
    await load();
  };

  const deleteRecording = async () => {
    if (linkedNote) await deleteVoiceNoteAction(linkedNote.id);
    await deleteTranscriptionAction(id);
    router.push('/voice/recordings');
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/voice/recordings" style={{ color: TEXT_SEC, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          ← Back to recordings
        </Link>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/voice/export?ids=${id}`} style={ghostButton()}>
            Export
          </Link>
          <button type="button" onClick={() => void deleteRecording()} style={ghostButton()}>
            Delete
          </button>
        </div>
      </div>

      <section style={heroStyle()}>
        <div style={{ display: 'grid', gap: 12, maxWidth: 700 }}>
          {editing ? (
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              style={{
                borderRadius: 14,
                border: `1px solid ${BORDER}`,
                background: 'var(--surface)',
                color: TEXT,
                fontSize: 28,
                fontWeight: 800,
                padding: '14px 18px',
                outline: 'none',
              }}
            />
          ) : (
            <h1 style={{ color: TEXT, fontSize: 38, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>{draftTitle}</h1>
          )}
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ color: TEXT_SEC, fontSize: 13 }}>{formatDate(transcription.createdAt)}</span>
            <span style={{ color: ACCENT, fontSize: 13, fontWeight: 700 }}>{formatDuration(transcription.durationSeconds)}</span>
            <span style={{ color: getLanguageColor(transcription.language), fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
              {getLanguageName(transcription.language)}
            </span>
            <span style={{ color: TEXT_SEC, fontSize: 13 }}>{wordCount} words</span>
            <span style={{ color: TEXT_SEC, fontSize: 13 }}>{readingTime} min read</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {splitTags(draftTags || null).map((tag) => (
              <span key={tag} style={{ borderRadius: 999, border: `1px solid ${BORDER}`, color: TEXT_SEC, fontSize: 11, padding: '4px 8px' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, minWidth: 260 }}>
          <div style={{ ...glassCard(), background: 'rgba(255,255,255,0.05)' }}>
            <p style={{ color: TEXT_SEC, fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>Playback</p>
            <div style={{ alignItems: 'center', display: 'flex', gap: 12, marginTop: 12 }}>
              <button type="button" style={{ ...primaryButton(), padding: '10px 14px' }}>
                ▶
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div style={{ background: ACCENT, width: transcription.audioUri ? '38%' : '0%', height: '100%' }} />
                </div>
                <p style={{ color: TEXT_SEC, fontSize: 12, margin: '8px 0 0' }}>
                  {transcription.audioUri ? 'Playback controls available for this capture.' : 'No audio file is attached to this transcript yet.'}
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {editing ? (
              <>
                <button type="button" onClick={() => void saveChanges()} style={primaryButton()}>
                  Save changes
                </button>
                <button type="button" onClick={() => setEditing(false)} style={ghostButton()}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setEditing(true)} style={ghostButton()}>
                Edit transcript
              </button>
            )}
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.65fr)' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={glassStrong()}>
            {editing ? (
              <textarea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                style={{
                  width: '100%',
                  minHeight: 320,
                  borderRadius: 16,
                  border: `1px solid ${BORDER}`,
                  background: 'var(--surface)',
                  color: TEXT,
                  fontSize: 15,
                  lineHeight: 1.7,
                  padding: 18,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            ) : (
              <div style={{ color: TEXT, fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {highlightText(transcription.text, query)}
              </div>
            )}
          </div>

          {segments.length > 0 ? (
            <div style={glassCard()}>
              <h2 style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>Speaker segments</h2>
              <div style={{ display: 'grid', gap: 14 }}>
                {segments.map((segment) => (
                  <div key={segment.id} style={{ borderLeft: `2px solid ${ACCENT}`, paddingLeft: 14 }}>
                    <div style={{ alignItems: 'center', display: 'flex', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        {segment.speakerLabel}
                      </span>
                      <span style={{ color: TEXT_SEC, fontSize: 12 }}>
                        {formatDuration(segment.startSeconds)} - {formatDuration(segment.endSeconds)}
                      </span>
                    </div>
                    <p style={{ color: TEXT, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{segment.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={glassCard()}>
            <h2 style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>Metadata</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['Duration', formatDuration(transcription.durationSeconds)],
                ['Language', getLanguageName(transcription.language)],
                ['Word count', `${wordCount}`],
                ['Confidence', transcription.confidence != null ? `${Math.round(transcription.confidence * 100)}%` : 'N/A'],
              ].map(([label, value]) => (
                <div key={label} style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>{label}</span>
                  <span style={{ color: TEXT, fontSize: 14, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={glassCard()}>
            <h2 style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>Tags</h2>
            {editing ? (
              <input
                value={draftTags}
                onChange={(event) => setDraftTags(event.target.value)}
                placeholder="comma, separated, tags"
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: 'var(--surface)',
                  color: TEXT,
                  padding: '12px 14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {splitTags(draftTags || null).length > 0 ? splitTags(draftTags || null).map((tag) => (
                  <span key={tag} style={{ borderRadius: 999, border: `1px solid ${BORDER}`, color: TEXT_SEC, fontSize: 11, padding: '4px 8px' }}>
                    {tag}
                  </span>
                )) : <span style={{ color: TEXT_SEC, fontSize: 13 }}>No tags yet.</span>}
              </div>
            )}
          </div>

          {keywords.length > 0 ? (
            <div style={glassCard()}>
              <h2 style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>Keywords</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {keywords.map((keyword) => (
                  <span key={keyword} style={{ background: 'rgba(239,68,68,0.16)', borderRadius: 999, color: TEXT, fontSize: 12, padding: '5px 9px' }}>
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {languageBreakdown.length > 0 ? (
            <div style={glassCard()}>
              <h2 style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>Language mix</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {languageBreakdown.map((entry) => (
                  <div key={entry.language} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: TEXT, fontSize: 14 }}>{getLanguageName(entry.language)}</span>
                      <span style={{ color: TEXT_SEC, fontSize: 12 }}>{entry.percentage}%</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                      <div style={{ background: getLanguageColor(entry.language), height: '100%', width: `${entry.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function RecordingDetailPage() {
  return (
    <Suspense fallback={null}>
      <RecordingDetailPageContent />
    </Suspense>
  );
}
