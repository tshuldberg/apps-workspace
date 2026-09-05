'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS_ACCENT } from '../../../_ui';
import {
  sportsAddScheduleEntry,
  sportsDeleteRecLeague,
  sportsUpdateRecLeagueRecord,
} from '../../../actions';

type Props = {
  id: string;
  wins: number;
  losses: number;
  ties: number;
};

function parseDateInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isFinite(ts) ? ts : null;
}

export function LeagueActionsClient({ id, wins, losses, ties }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [opponent, setOpponent] = useState('');
  const [startsAtRaw, setStartsAtRaw] = useState('');
  const [location, setLocation] = useState('');
  const [gameError, setGameError] = useState<string | null>(null);

  const bumpRecord = (key: 'wins' | 'losses' | 'ties') => {
    setError(null);
    startTransition(async () => {
      const patch =
        key === 'wins'
          ? { wins: wins + 1 }
          : key === 'losses'
            ? { losses: losses + 1 }
            : { ties: ties + 1 };
      const res = await sportsUpdateRecLeagueRecord(id, patch);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleAddGame = () => {
    const opp = opponent.trim();
    const ts = parseDateInput(startsAtRaw);
    if (!opp) {
      setGameError('Opponent is required');
      return;
    }
    if (ts === null) {
      setGameError('Start time must be a valid date (e.g. 2026-05-10 19:00)');
      return;
    }
    setGameError(null);
    startTransition(async () => {
      const res = await sportsAddScheduleEntry(id, {
        opponent: opp,
        starts_at: ts,
        location: location.trim() === '' ? null : location.trim(),
        result: null,
      });
      if (!res.ok) {
        setGameError(res.error);
        return;
      }
      setOpponent('');
      setStartsAtRaw('');
      setLocation('');
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        'Delete this league? The schedule and record will be removed. Cannot be undone.',
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await sportsDeleteRecLeague(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/sports/play/leagues');
      router.refresh();
    });
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.recordCard}>
        <div style={styles.recordCol}>
          <span style={styles.recordLabel}>Wins</span>
          <span style={styles.recordValue}>{wins}</span>
          <button
            type="button"
            onClick={() => bumpRecord('wins')}
            style={styles.bumpBtn}
            disabled={isPending}
          >
            +1
          </button>
        </div>
        <div style={styles.recordCol}>
          <span style={styles.recordLabel}>Losses</span>
          <span style={styles.recordValue}>{losses}</span>
          <button
            type="button"
            onClick={() => bumpRecord('losses')}
            style={styles.bumpBtn}
            disabled={isPending}
          >
            +1
          </button>
        </div>
        <div style={styles.recordCol}>
          <span style={styles.recordLabel}>Ties</span>
          <span style={styles.recordValue}>{ties}</span>
          <button
            type="button"
            onClick={() => bumpRecord('ties')}
            style={styles.bumpBtn}
            disabled={isPending}
          >
            +1
          </button>
        </div>
      </div>

      <div style={styles.addGame}>
        <p style={styles.addGameLabel}>Add game</p>
        <input
          type="text"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder="Opponent"
          style={styles.input}
        />
        <input
          type="text"
          value={startsAtRaw}
          onChange={(e) => setStartsAtRaw(e.target.value)}
          placeholder="Start (YYYY-MM-DD HH:MM)"
          style={styles.input}
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          style={styles.input}
        />
        {gameError ? <p style={styles.error}>{gameError}</p> : null}
        <button
          type="button"
          onClick={handleAddGame}
          style={styles.primaryBtn}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Add to schedule'}
        </button>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      <button
        type="button"
        onClick={handleDelete}
        style={styles.destructiveBtn}
        disabled={isPending}
      >
        {isPending ? 'Working…' : 'Delete league'}
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14, marginTop: 4 },
  recordCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
  },
  recordCol: {
    display: 'grid',
    justifyItems: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  recordLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  recordValue: {
    color: 'var(--text)',
    fontSize: 28,
    fontWeight: 800,
  },
  bumpBtn: {
    padding: '6px 14px',
    borderRadius: 10,
    border: `1px solid ${SPORTS_ACCENT}`,
    background: 'transparent',
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  addGame: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  addGameLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.14em',
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
  primaryBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  destructiveBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid #F87171',
    background: 'var(--surface)',
    color: '#F87171',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  error: { margin: 0, color: '#F87171', fontSize: 13 },
};
