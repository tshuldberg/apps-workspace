'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchNotes, fetchStats, createNoteAction } from './actions';
import type { Note, NotesStats } from '@mylife/notes';

const ACCENT = 'var(--accent-notes)';
const ACCENT_BORDER = 'rgba(100,116,139,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [pinned, setPinned] = useState<Note[]>([]);
  const [stats, setStats] = useState<NotesStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchStats(),
      fetchNotes({ limit: 20, sortBy: 'updated' }),
      fetchNotes({ isPinned: true, limit: 10 }),
    ])
      .then(([s, n, p]) => {
        if (!cancelled) {
          setStats(s);
          setNotes(n);
          setPinned(p);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Something went wrong loading your notes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  async function handleNewNote() {
    try {
      const id = await createNoteAction({ title: '', body: '' });
      window.location.href = `/notes/${id}/edit`;
    } catch {
      setError('Failed to create note.');
    }
  }

  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textAlign: 'center' }}>
        <p style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 80, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 64, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  const hasNotes = notes.length > 0;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MetricCard label="Notes" value={stats ? String(stats.totalNotes) : '0'} />
        <MetricCard label="Folders" value={stats ? String(stats.totalFolders) : '0'} />
        <MetricCard label="Tags" value={stats ? String(stats.totalTags) : '0'} />
        <MetricCard label="Words" value={stats ? (stats.totalWords > 999 ? `${(stats.totalWords / 1000).toFixed(1)}k` : String(stats.totalWords)) : '0'} />
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleNewNote}
          style={{ borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 16px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          + New Note
        </button>
        <Link
          href="/notes/daily"
          style={{ borderRadius: 999, backgroundColor: GLASS, color: TEXT_SEC, padding: '10px 16px', fontWeight: 600, textDecoration: 'none', border: `1px solid ${BORDER}` }}
        >
          Today&apos;s Note
        </Link>
        <Link
          href="/notes/clipper"
          style={{ borderRadius: 999, backgroundColor: GLASS, color: TEXT_SEC, padding: '10px 16px', fontWeight: 600, textDecoration: 'none', border: `1px solid ${BORDER}` }}
        >
          Clip URL
        </Link>
      </div>

      {/* Pinned notes */}
      {pinned.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: TEXT_SEC }}>Pinned</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {pinned.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </section>
      )}

      {/* Recent notes */}
      <section>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: TEXT_SEC }}>Recent Notes</h2>
        {!hasNotes ? (
          <div
            style={{
              padding: 32,
              borderRadius: 20,
              border: `1px dashed ${ACCENT_BORDER}`,
              backgroundColor: GLASS,
              textAlign: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 24, color: TEXT }}>Your notes are waiting</h3>
            <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>
              Start writing with plain markdown. No lock-in, no cloud, just your thoughts.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleNewNote}
                style={{ color: '#0A0A0F', backgroundColor: ACCENT, fontWeight: 700, textDecoration: 'none', padding: '10px 16px', borderRadius: 999, border: 'none', cursor: 'pointer' }}
              >
                Create your first note
              </button>
              <Link href="/notes/clipper" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none', padding: '10px 16px' }}>
                Or clip a webpage
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  const preview = note.body.slice(0, 120).replace(/\n/g, ' ').replace(/[#*_~`]/g, '');
  const timeAgo = formatTimeAgo(note.updatedAt);

  return (
    <Link
      href={`/notes/${note.id}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        backgroundColor: SURFACE,
        textDecoration: 'none',
        color: TEXT,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {note.isPinned && <span style={{ fontSize: 12, color: ACCENT }}>pin</span>}
          <span style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note.title || 'Untitled'}
          </span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_SEC, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preview || 'Empty note'}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: TEXT_SEC }}>{timeAgo}</span>
        <span style={{ fontSize: 12, color: ACCENT }}>{note.wordCount}w</span>
      </div>
    </Link>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
      <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 700, color: ACCENT }}>{value}</p>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
