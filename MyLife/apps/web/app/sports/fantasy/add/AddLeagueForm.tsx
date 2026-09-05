'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { FantasyFormat, FantasyPlatform } from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import { sportsCreateFantasyLeague } from '../../actions';

const PLATFORMS: Array<{ key: FantasyPlatform; label: string }> = [
  { key: 'espn', label: 'ESPN' },
  { key: 'yahoo', label: 'Yahoo' },
  { key: 'sleeper', label: 'Sleeper' },
  { key: 'nfl', label: 'NFL' },
  { key: 'cbs', label: 'CBS' },
  { key: 'custom', label: 'Custom' },
];

const SPORTS: Array<{ key: string; label: string }> = [
  { key: 'nfl', label: 'NFL' },
  { key: 'nba', label: 'NBA' },
  { key: 'mlb', label: 'MLB' },
  { key: 'nhl', label: 'NHL' },
  { key: 'mls', label: 'MLS' },
];

const FORMATS: Array<{ key: FantasyFormat; label: string }> = [
  { key: 'redraft', label: 'Redraft' },
  { key: 'dynasty', label: 'Dynasty' },
  { key: 'keeper', label: 'Keeper' },
  { key: 'bestball', label: 'Best ball' },
];

function parseCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function AddLeagueForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [platform, setPlatform] = useState<FantasyPlatform>('espn');
  const [sport, setSport] = useState<string>('nfl');
  const [leagueName, setLeagueName] = useState('');
  const [season, setSeason] = useState('');
  const [format, setFormat] = useState<FantasyFormat>('redraft');
  const [teamName, setTeamName] = useState('');
  const [buyInText, setBuyInText] = useState('');

  const canSave =
    !isPending &&
    leagueName.trim().length > 0 &&
    season.trim().length > 0 &&
    teamName.trim().length > 0;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const league = await sportsCreateFantasyLeague({
          platform,
          sport,
          league_name: leagueName.trim(),
          season: season.trim(),
          format,
          team_name: teamName.trim(),
          buy_in_cents: parseCents(buyInText),
        });
        router.replace(`/sports/fantasy/${encodeURIComponent(league.id)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save league');
      }
    });
  }

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Add league</p>
      <h2 style={styles.title}>New fantasy league</h2>

      <Segment
        label="Platform"
        value={platform}
        onChange={(v) => setPlatform(v as FantasyPlatform)}
        options={PLATFORMS}
      />

      <Segment
        label="Sport"
        value={sport}
        onChange={setSport}
        options={SPORTS}
      />

      <div style={styles.field}>
        <label style={styles.fieldLabel}>League name</label>
        <input
          type="text"
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value)}
          placeholder="Monday Night Dynasty"
          style={styles.input}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Season</label>
        <input
          type="text"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="2025 or 2025-26"
          style={styles.input}
        />
      </div>

      <Segment
        label="Format"
        value={format}
        onChange={(v) => setFormat(v as FantasyFormat)}
        options={FORMATS}
      />

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Team name</label>
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="The Gridiron Ghosts"
          style={styles.input}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Buy-in (USD, optional)</label>
        <input
          type="number"
          inputMode="decimal"
          value={buyInText}
          onChange={(e) => setBuyInText(e.target.value)}
          placeholder="50"
          style={styles.input}
        />
      </div>

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
          style={{ ...styles.primaryBtn, opacity: canSave ? 1 : 0.5 }}
          disabled={!canSave}
        >
          {isPending ? 'Saving…' : 'Save league'}
        </button>
      </div>
    </div>
  );
}

function Segment({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ key: string; label: string }>;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      <div style={styles.segmentRow}>
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              style={{
                ...styles.segmentBtn,
                ...(active ? styles.segmentBtnActive : {}),
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
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
    color: '#4ADE80',
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
    letterSpacing: '0.1em',
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
  segmentRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  segmentBtn: {
    flex: 1,
    minWidth: 70,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  segmentBtnActive: {
    borderColor: SPORTS_ACCENT,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  error: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(229,115,115,0.14)',
    border: '1px solid rgba(229,115,115,0.4)',
    color: '#FCA5A5',
    fontSize: 13,
  },
  actionRow: { display: 'flex', gap: 10, marginTop: 6 },
  primaryBtn: {
    flex: 1,
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
};
