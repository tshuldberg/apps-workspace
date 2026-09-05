'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchJournalEntryAction, doDeleteJournalEntry } from '../../actions';
import type { JournalEntryRow } from '@mylife/stars';

const MOON_PHASE_EMOJIS: Record<string, string> = {
  new_moon: '\u{1F311}', waxing_crescent: '\u{1F312}', first_quarter: '\u{1F313}',
  waxing_gibbous: '\u{1F314}', full_moon: '\u{1F315}', waning_gibbous: '\u{1F316}',
  last_quarter: '\u{1F317}', waning_crescent: '\u{1F318}',
};

const MOON_PHASE_LABELS: Record<string, string> = {
  new_moon: 'New Moon', waxing_crescent: 'Waxing Crescent', first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous', full_moon: 'Full Moon', waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter', waning_crescent: 'Waning Crescent',
};

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function deriveTitle(entry: JournalEntryRow): string {
  if (entry.title?.trim()) {
    return entry.title.trim();
  }
  const firstSentence = entry.content
    .split(/[.!?]/)
    .map((part) => part.trim())
    .find(Boolean);
  return firstSentence ?? 'Untitled Reflection';
}

const glassCard: CSSProperties = { padding: 20, borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', backgroundColor: 'var(--glass)' };

export default function JournalEntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [entry, setEntry] = useState<JournalEntryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const e = await fetchJournalEntryAction(id);
        if (!cancelled) setEntry(e);
      } catch {
        if (!cancelled) setError('Failed to load entry');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const handleDelete = async () => {
    try {
      await doDeleteJournalEntry(id);
      router.push('/stars/journal');
    } catch {
      setError('Failed to delete entry');
    }
  };

  if (error) {
    return (
      <div style={{ ...glassCard, textAlign: 'center', padding: 48 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>Something went wrong</h2>
        <button type="button" onClick={() => location.reload()}
          style={{ marginTop: 16, padding: '10px 20px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--accent-stars)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }
  if (loading) {
    return <div style={{ display: 'grid', gap: 16 }}><div style={{ height: 24, width: 200, borderRadius: 8, backgroundColor: 'var(--glass)' }} /><div style={{ height: 300, borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--glass)' }} /></div>;
  }
  if (!entry) {
    return (
      <div style={{ ...glassCard, textAlign: 'center', padding: 48 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>Entry not found</h2>
        <Link href="/stars/journal" style={{ marginTop: 16, display: 'inline-block', color: 'var(--accent-stars)', fontWeight: 600, textDecoration: 'none' }}>&larr; Back to Journal</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/stars/journal" style={{ color: 'var(--text-secondary)', fontSize: 14, textDecoration: 'none' }}>&larr; Back to Journal</Link>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleDelete} style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Confirm Delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={{ color: 'var(--text-secondary)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--danger)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
        )}
      </div>

      <div style={{ ...glassCard, backgroundColor: 'var(--surface)', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{deriveTitle(entry)}</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{formatDateFull(entry.date)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {entry.mood && (
            <span style={{ justifySelf: 'start', padding: '4px 14px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(139,92,246,0.15)', fontSize: 13, color: 'var(--accent-stars)', fontWeight: 600 }}>
              {entry.mood}
            </span>
          )}
          {entry.intention && (
            <span style={{ padding: '4px 14px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(255,184,119,0.14)', fontSize: 13, color: '#FFCC9F', fontWeight: 600 }}>
              {entry.intention}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>{MOON_PHASE_EMOJIS[entry.moonPhase] ?? ''} {MOON_PHASE_LABELS[entry.moonPhase] ?? entry.moonPhase}</span>
          <span>Sun in {capitalize(entry.sunSign)}</span>
          <span>Moon in {capitalize(entry.moonSign)}</span>
          {entry.retrogradePlanets && entry.retrogradePlanets !== '[]' && (
            <span style={{ color: 'var(--warning)' }}>Retrogrades active</span>
          )}
          {entry.tarotCardName && <span style={{ color: 'var(--accent-stars)' }}>{entry.tarotCardName}</span>}
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
        <p style={{ margin: 0, fontSize: 16, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{entry.content}</p>
        {entry.photoUris.length > 0 && (
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Attachments</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {entry.photoUris.map((uri) => (
                <img
                  key={uri}
                  src={uri}
                  alt="Journal attachment"
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 18, backgroundColor: 'var(--glass)' }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
