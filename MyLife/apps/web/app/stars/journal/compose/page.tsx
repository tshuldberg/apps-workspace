'use client';

import { useState, useMemo, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { doCreateJournalEntry, fetchProfiles } from '../../actions';
import {
  captureAstrologicalContext,
  computeRetrogradeStatuses,
  getActiveRetrogrades,
  JOURNAL_MOODS,
  type BirthProfile,
} from '@mylife/stars';
import { useEffect } from 'react';

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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const glassCard: CSSProperties = {
  padding: 20, borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', backgroundColor: 'var(--glass)',
};

export default function JournalComposePage() {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const retroStatuses = useMemo(() => computeRetrogradeStatuses(today), [today]);
  const activeRetrogrades = useMemo(() => getActiveRetrogrades(retroStatuses), [retroStatuses]);
  const retroPlanets = activeRetrogrades.map((r) => r.body);
  const astroContext = useMemo(() => captureAstrologicalContext(today, retroPlanets), [today, retroPlanets]);

  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [date, setDate] = useState(today);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProfiles().then(setProfiles).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!content.trim()) { setError('Write something before saving'); return; }
    if (content.trim().length > 5000) { setError('Content exceeds 5,000 character limit'); return; }
    setError(null);
    setSaving(true);
    try {
      await doCreateJournalEntry({
        profileId: selectedProfileId || null,
        date,
        content: content.trim(),
        mood: mood || null,
        moonPhase: astroContext.moonPhase,
        moonSign: astroContext.moonSign,
        sunSign: astroContext.sunSign,
        retrogradePlanets: retroPlanets.length > 0 ? JSON.stringify(retroPlanets) : null,
        tarotCardName: astroContext.tarotCardName,
      });
      router.push('/stars/journal');
    } catch {
      setError('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: 14, outline: 'none',
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>New Journal Entry</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--accent-stars)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => router.push('/stars/journal')}
            style={{ padding: '10px 20px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', backgroundColor: 'var(--glass)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
        </div>
      </div>

      {error && <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Editor */}
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Mood</label>
              <select style={inputStyle} value={mood} onChange={(e) => setMood(e.target.value)}>
                <option value="">Select mood...</option>
                {JOURNAL_MOODS.map((m) => <option key={m} value={m}>{capitalize(m)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Profile</label>
              <select style={inputStyle} value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
                <option value="">No profile</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your thoughts..."
            style={{
              ...inputStyle,
              minHeight: 300,
              resize: 'vertical',
              lineHeight: 1.7,
              fontFamily: 'inherit',
            }}
          />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{content.length} / 5,000</p>
        </div>

        {/* Astrological Context Sidebar */}
        <div style={{ ...glassCard, backgroundColor: 'var(--surface)', display: 'grid', gap: 12, alignContent: 'start' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Today&apos;s Sky</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>
              {MOON_PHASE_EMOJIS[astroContext.moonPhase]} {MOON_PHASE_LABELS[astroContext.moonPhase]}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>Moon in {capitalize(astroContext.moonSign)}</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>Sun in {capitalize(astroContext.sunSign)}</p>
          </div>
          {retroPlanets.length > 0 && (
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Retrogrades:</p>
              {retroPlanets.map((p) => (
                <p key={p} style={{ margin: '2px 0', fontSize: 13, color: 'var(--warning)' }}>{capitalize(p)} Rx</p>
              ))}
            </div>
          )}
          {astroContext.tarotCardName && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--accent-stars)' }}>Card: {astroContext.tarotCardName}</p>
          )}
        </div>
      </div>
    </div>
  );
}
