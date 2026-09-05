'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchOrCreateDailyNote, fetchDailyDates, updateNoteAction } from '../actions';
import type { Note } from '@mylife/notes';

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const SUCCESS = '#30D158';

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function offsetDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DailyNotePage() {
  const [currentDate, setCurrentDate] = useState(getTodayIso);
  const [note, setNote] = useState<Note | null>(null);
  const [body, setBody] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isToday = currentDate === getTodayIso();

  const loadNote = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const [n, d] = await Promise.all([fetchOrCreateDailyNote(date), fetchDailyDates()]);
      setNote(n);
      setBody(n.body);
      setDates(d);
    } catch {
      setError('Failed to load daily note.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNote(currentDate); }, [currentDate, loadNote]);

  function handleBodyChange(newBody: string) {
    setBody(newBody);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!note) return;
      setSaveStatus('saving');
      try {
        await updateNoteAction(note.id, { body: newBody });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 500);
  }

  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textAlign: 'center' }}>
        <p style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</p>
        <button type="button" onClick={() => loadNote(currentDate)}
          style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button type="button" onClick={() => setCurrentDate((d) => offsetDate(d, -1))}
          style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: GLASS, color: TEXT, cursor: 'pointer', fontSize: 18, fontWeight: 600 }}>
          &larr;
        </button>
        <button type="button" onClick={() => setCurrentDate(getTodayIso())}
          style={{ padding: '8px 20px', borderRadius: 12, backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: isToday ? ACCENT : TEXT, fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentDate}
          {isToday && <span style={{ fontSize: 11, backgroundColor: 'rgba(100,116,139,0.15)', padding: '2px 6px', borderRadius: 4, color: ACCENT }}>Today</span>}
        </button>
        <button type="button" onClick={() => setCurrentDate((d) => offsetDate(d, 1))}
          style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: GLASS, color: TEXT, cursor: 'pointer', fontSize: 18, fontWeight: 600 }}>
          &rarr;
        </button>
      </div>

      {saveStatus !== 'idle' && (
        <p style={{ textAlign: 'center', fontSize: 12, color: saveStatus === 'saved' ? SUCCESS : TEXT_SEC, margin: 0 }}>
          {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
        </p>
      )}

      {loading ? (
        <div style={{ height: 400, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }}>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder={`Write your daily note for ${currentDate}...`}
          style={{
            width: '100%', minHeight: 400, padding: 20, borderRadius: 16,
            border: `1px solid ${BORDER}`, backgroundColor: SURFACE,
            color: TEXT, fontSize: 15, lineHeight: 1.7,
            fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
            resize: 'vertical', outline: 'none',
          }}
        />
      )}

      {dates.length > 0 && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: TEXT_SEC }}>Previous Daily Notes</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dates.filter((d) => d !== currentDate).slice(0, 14).map((d) => (
              <button key={d} type="button" onClick={() => setCurrentDate(d)}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: GLASS, color: TEXT_SEC, cursor: 'pointer', fontSize: 13 }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
