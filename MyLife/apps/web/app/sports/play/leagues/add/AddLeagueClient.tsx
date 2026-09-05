'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS_ACCENT } from '../../../_ui';
import { sportsCreateRecLeague } from '../../../actions';

const SPORTS: Array<{ key: string; label: string }> = [
  { key: 'basketball', label: 'Basketball' },
  { key: 'soccer', label: 'Soccer' },
  { key: 'softball', label: 'Softball' },
  { key: 'baseball', label: 'Baseball' },
  { key: 'volleyball', label: 'Volleyball' },
  { key: 'hockey', label: 'Hockey' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'other', label: 'Other' },
];

export function AddLeagueClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [sport, setSport] = useState<string>('softball');
  const [leagueName, setLeagueName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [season, setSeason] = useState('');
  const [notes, setNotes] = useState('');

  const canSave =
    leagueName.trim() !== '' && teamName.trim() !== '' && season.trim() !== '';

  const handleSave = () => {
    if (!canSave) {
      setError('League, team, and season are required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await sportsCreateRecLeague({
        sport,
        league_name: leagueName.trim(),
        team_name: teamName.trim(),
        season: season.trim(),
        notes_md: notes.trim() === '' ? null : notes.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/sports/play/leagues/${encodeURIComponent(res.league.id)}`);
      router.refresh();
    });
  };

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Rec leagues</p>
      <h2 style={styles.title}>Add league</h2>

      <Field label="Sport">
        <div style={styles.chipRow}>
          {SPORTS.map((s) => {
            const active = s.key === sport;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSport(s.key)}
                style={{
                  ...styles.chip,
                  ...(active ? styles.chipActive : {}),
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="League name">
        <input
          type="text"
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value)}
          placeholder="Monday Night Softball"
          style={styles.input}
        />
      </Field>

      <Field label="Team name">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="The Benchwarmers"
          style={styles.input}
        />
      </Field>

      <Field label="Season">
        <input
          type="text"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="Spring 2026"
          style={styles.input}
        />
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Field location, teammates, league rules…"
          style={styles.textarea}
        />
      </Field>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.actionRow}>
        <button
          type="button"
          onClick={() => router.back()}
          style={styles.secondaryBtn}
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={styles.primaryBtn}
          disabled={isPending || !canSave}
        >
          {isPending ? 'Saving…' : 'Save league'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: SPORTS_ACCENT,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--text)',
  },
  field: { display: 'grid', gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {
    background: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
  actionRow: { display: 'flex', gap: 10, marginTop: 6 },
  primaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
};
