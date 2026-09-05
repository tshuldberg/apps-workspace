'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  deleteTranscriptionAction,
  deleteVoiceNoteAction,
  fetchTranscriptionsAction,
  fetchVoiceNotesAction,
  toggleFavoriteAction,
} from '../actions';
import {
  buildRecordingRows,
  matchesSearch,
  type RecordingRow,
  type VoiceNoteRow,
  type VoiceTranscriptionRow,
} from '../model';
import {
  ACCENT,
  TEXT,
  TEXT_SEC,
  BORDER,
  glassCard,
  heroStyle,
  pillButton,
  formatDuration,
  formatDateShort,
  getLanguageColor,
  getLanguageName,
} from '../ui';

type SortField = 'date' | 'duration' | 'words' | 'title';
type DurationFilter = 'all' | 'short' | 'medium' | 'long';

function withinDuration(row: RecordingRow, filter: DurationFilter) {
  if (filter === 'all') return true;
  if (filter === 'short') return row.durationSeconds < 5 * 60;
  if (filter === 'medium') return row.durationSeconds >= 5 * 60 && row.durationSeconds <= 20 * 60;
  return row.durationSeconds > 20 * 60;
}

export default function RecordingsPage() {
  const [transcriptions, setTranscriptions] = useState<VoiceTranscriptionRow[]>([]);
  const [notes, setNotes] = useState<VoiceNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [transcriptionData, noteData] = await Promise.all([
        fetchTranscriptionsAction({ limit: 500 }),
        fetchVoiceNotesAction({ limit: 500 }),
      ]);
      setTranscriptions(transcriptionData as VoiceTranscriptionRow[]);
      setNotes(noteData as VoiceNoteRow[]);
    } catch {
      setError('Could not load recordings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => buildRecordingRows(transcriptions, notes), [transcriptions, notes]);
  const languages = useMemo(
    () => Array.from(new Set(rows.map((row) => row.language).filter(Boolean))) as string[],
    [rows],
  );
  const tags = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.tags))).sort((left, right) => left.localeCompare(right)),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows
      .filter((row) => (query.trim() ? matchesSearch(row, query.trim()) : true))
      .filter((row) => (languageFilter ? row.language === languageFilter : true))
      .filter((row) => (tagFilter ? row.tags.includes(tagFilter) : true))
      .filter((row) => withinDuration(row, durationFilter))
      .sort((left, right) => {
        if (sortField === 'duration') return right.durationSeconds - left.durationSeconds;
        if (sortField === 'words') return right.wordCount - left.wordCount;
        if (sortField === 'title') return left.title.localeCompare(right.title);
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [durationFilter, languageFilter, query, rows, sortField, tagFilter]);

  const selectedRows = filtered.filter((row) => selectedIds.includes(row.id));

  const toggleSelection = (rowId: string) => {
    setSelectedIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filtered.map((row) => row.id));
  };

  const handleBulkDelete = async () => {
    const rowsToDelete = rows.filter((row) => selectedIds.includes(row.id));
    await Promise.all(
      rowsToDelete.flatMap((row) => [
        row.noteId ? deleteVoiceNoteAction(row.noteId) : Promise.resolve(true),
        row.transcriptionId ? deleteTranscriptionAction(row.transcriptionId) : Promise.resolve(true),
      ]),
    );
    setSelectedIds([]);
    await load();
  };

  const handleFavorite = async (row: RecordingRow) => {
    if (!row.noteId) return;
    await toggleFavoriteAction(row.noteId);
    await load();
  };

  if (loading) {
    return <div style={{ ...glassCard(), minHeight: 220, opacity: 0.65, animation: 'pulse 2s infinite' }} />;
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
        <div style={{ display: 'grid', gap: 10 }}>
          <h1 style={{ color: TEXT, fontSize: 38, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>Recordings</h1>
          <p style={{ color: TEXT_SEC, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
            Browse every memo in one place, filter by language and tags, and batch-delete or export the captures you need.
          </p>
        </div>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, transcripts, or tags"
          style={{
            width: 320,
            maxWidth: '100%',
            borderRadius: 999,
            border: `1px solid ${BORDER}`,
            background: 'var(--surface)',
            color: TEXT,
            padding: '12px 18px',
            fontSize: 14,
            outline: 'none',
          }}
        />
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" onClick={() => setLanguageFilter(null)} style={pillButton(languageFilter === null)}>All languages</button>
          {languages.map((language) => (
            <button key={language} type="button" onClick={() => setLanguageFilter(language)} style={pillButton(languageFilter === language)}>
              {getLanguageName(language)}
            </button>
          ))}
        </div>
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" onClick={() => setTagFilter(null)} style={pillButton(tagFilter === null)}>All tags</button>
          {tags.slice(0, 10).map((tag) => (
            <button key={tag} type="button" onClick={() => setTagFilter(tag)} style={pillButton(tagFilter === tag)}>
              {tag}
            </button>
          ))}
        </div>
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['all', 'short', 'medium', 'long'] as DurationFilter[]).map((filter) => (
            <button key={filter} type="button" onClick={() => setDurationFilter(filter)} style={pillButton(durationFilter === filter)}>
              {filter === 'all' ? 'Any length' : filter}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['date', 'duration', 'words', 'title'] as SortField[]).map((field) => (
              <button key={field} type="button" onClick={() => setSortField(field)} style={pillButton(sortField === field)}>
                Sort: {field}
              </button>
            ))}
          </span>
        </div>
      </div>

      <div style={glassCard()}>
        <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: 0 }}>{filtered.length} results</h2>
            <p style={{ color: TEXT_SEC, fontSize: 13, margin: '6px 0 0' }}>Select recordings to export or delete in bulk.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={toggleSelectAll} style={pillButton(false)}>
              {selectedRows.length === filtered.length && filtered.length > 0 ? 'Clear selection' : 'Select all'}
            </button>
            <Link
              href={selectedIds.length > 0 ? `/voice/export?ids=${selectedIds.join(',')}` : '/voice/export'}
              style={{ ...pillButton(false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              Bulk export
            </Link>
            <button type="button" disabled={selectedIds.length === 0} onClick={() => void handleBulkDelete()} style={pillButton(false)}>
              Delete selected
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((row) => (
            <div
              key={row.id}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 18,
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                padding: '14px 16px',
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(row.id)}
                onChange={() => toggleSelection(row.id)}
                style={{ marginTop: 4 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ alignItems: 'center', display: 'flex', gap: 8, marginBottom: 8 }}>
                  {row.transcriptionId ? (
                    <Link href={`/voice/recordings/${row.transcriptionId}`} style={{ color: TEXT, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
                      {row.title}
                    </Link>
                  ) : (
                    <span style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>{row.title}</span>
                  )}
                  {row.isFavorite ? <span style={{ color: ACCENT, fontSize: 16 }}>★</span> : null}
                </div>
                <p style={{ color: TEXT_SEC, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{row.preview}</p>
                <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <span style={{ color: TEXT_SEC, fontSize: 12 }}>{formatDuration(row.durationSeconds)}</span>
                  <span style={{ color: getLanguageColor(row.language), fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                    {getLanguageName(row.language)}
                  </span>
                  <span style={{ color: TEXT_SEC, fontSize: 12 }}>{row.wordCount} words</span>
                  {row.tags.map((tag) => (
                    <span key={`${row.id}-${tag}`} style={{ borderRadius: 999, border: `1px solid ${BORDER}`, color: TEXT_SEC, fontSize: 11, padding: '3px 8px' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ alignItems: 'flex-end', display: 'grid', gap: 8 }}>
                <span style={{ color: TEXT_SEC, fontSize: 12 }}>{formatDateShort(row.createdAt)}</span>
                {row.noteId ? (
                  <button type="button" onClick={() => void handleFavorite(row)} style={{ ...pillButton(false), padding: '6px 10px' }}>
                    {row.isFavorite ? 'Unstar' : 'Star'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
