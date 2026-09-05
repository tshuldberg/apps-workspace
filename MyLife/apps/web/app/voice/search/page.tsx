'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchTranscriptionsAction, fetchVoiceNotesAction } from '../actions';
import {
  buildExcerpt,
  buildRecordingRows,
  matchesSearch,
  parseSearchQuery,
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
  getLanguageColor,
  getLanguageName,
} from '../ui';

export default function VoiceSearchPage() {
  const [transcriptions, setTranscriptions] = useState<VoiceTranscriptionRow[]>([]);
  const [notes, setNotes] = useState<VoiceNoteRow[]>([]);
  const [query, setQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

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

  const rows = useMemo(() => buildRecordingRows(transcriptions, notes), [transcriptions, notes]);
  const languages = useMemo(
    () => Array.from(new Set(rows.map((row) => row.language).filter(Boolean))) as string[],
    [rows],
  );
  const parsed = useMemo(() => parseSearchQuery(deferredQuery), [deferredQuery]);
  const results = useMemo(() => {
    return rows
      .filter((row) => (deferredQuery.trim() ? matchesSearch(row, deferredQuery.trim()) : true))
      .filter((row) => (languageFilter ? row.language === languageFilter : true))
      .slice(0, 60);
  }, [deferredQuery, languageFilter, rows]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={heroStyle()}>
        <div style={{ display: 'grid', gap: 10, maxWidth: 640 }}>
          <h1 style={{ color: TEXT, fontSize: 38, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>Search</h1>
          <p style={{ color: TEXT_SEC, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
            Search titles, transcript text, and note tags. Use quotes for exact phrases and prefix a term with a minus sign to exclude it.
          </p>
          <div style={{ color: TEXT_SEC, fontSize: 12 }}>
            Example: <code>"meeting recap" -draft</code>
          </div>
        </div>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all transcriptions"
          style={{
            width: 360,
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

      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={() => setLanguageFilter(null)} style={pillButton(languageFilter === null)}>
          All languages
        </button>
        {languages.map((language) => (
          <button key={language} type="button" onClick={() => setLanguageFilter(language)} style={pillButton(languageFilter === language)}>
            {getLanguageName(language)}
          </button>
        ))}
        <span style={{ color: TEXT_SEC, fontSize: 13, marginLeft: 'auto' }}>
          {results.length} result{results.length === 1 ? '' : 's'}
        </span>
      </div>

      {(parsed.exact.length > 0 || parsed.exclude.length > 0) ? (
        <div style={glassCard()}>
          <p style={{ color: TEXT_SEC, fontSize: 13, margin: 0 }}>
            Exact phrases: {parsed.exact.length > 0 ? parsed.exact.join(', ') : 'none'} · Excluded terms: {parsed.exclude.length > 0 ? parsed.exclude.join(', ') : 'none'}
          </p>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 14 }}>
        {results.map((row) => (
          <Link
            key={row.id}
            href={row.transcriptionId ? `/voice/recordings/${row.transcriptionId}?query=${encodeURIComponent(query)}` : '/voice/notes'}
            style={{
              ...glassCard(),
              color: TEXT,
              display: 'block',
              textDecoration: 'none',
            }}
          >
            <div style={{ alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ alignItems: 'center', display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>{row.title}</span>
                  <span style={{ color: getLanguageColor(row.language), fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                    {getLanguageName(row.language)}
                  </span>
                </div>
                <p style={{ color: TEXT_SEC, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  {buildExcerpt(row.preview, query)}
                </p>
              </div>
              <div style={{ color: TEXT_SEC, fontSize: 12, textAlign: 'right' }}>
                <div>{row.wordCount} words</div>
                <div>{row.tags.join(', ') || 'untagged'}</div>
              </div>
            </div>
          </Link>
        ))}
        {results.length === 0 ? (
          <div style={{ ...glassCard(), textAlign: 'center' }}>
            <p style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: 0 }}>No matches</p>
            <p style={{ color: TEXT_SEC, fontSize: 14, margin: '10px 0 0' }}>
              Try fewer terms, remove exclusions, or search by a tag you already use.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
