'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  FantasyLeague,
  FantasyPlayer,
  FantasyTransaction,
} from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import {
  sportsDeleteFantasyLeague,
  sportsUpdateFantasyLeague,
} from '../../actions';

interface Props {
  league: FantasyLeague;
  transactions: FantasyTransaction[];
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseIntOrZero(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseFloatOrZero(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatRecord(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

export function LeagueDetailClient({ league, transactions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [editingHeader, setEditingHeader] = useState(false);
  const [teamName, setTeamName] = useState(league.team_name);
  const [wins, setWins] = useState(String(league.record_wins));
  const [losses, setLosses] = useState(String(league.record_losses));
  const [ties, setTies] = useState(String(league.record_ties));
  const [pos, setPos] = useState(
    league.standings_position === null ? '' : String(league.standings_position),
  );
  const [pf, setPf] = useState(String(league.points_for));
  const [pa, setPa] = useState(String(league.points_against));
  const [buyIn, setBuyIn] = useState(
    league.buy_in_cents === null ? '' : String(league.buy_in_cents / 100),
  );
  const [prize, setPrize] = useState(
    league.prize_cents === null ? '' : String(league.prize_cents / 100),
  );

  const [notes, setNotes] = useState(league.notes_md ?? '');
  const notesDirty = notes !== (league.notes_md ?? '');

  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState('');
  const [newTeam, setNewTeam] = useState('');

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      }
    });
  }

  function saveHeader() {
    run(async () => {
      const posNum = pos.trim() === '' ? null : parseInt(pos, 10);
      await sportsUpdateFantasyLeague(league.id, {
        team_name: teamName.trim() || league.team_name,
        record_wins: parseIntOrZero(wins),
        record_losses: parseIntOrZero(losses),
        record_ties: parseIntOrZero(ties),
        points_for: parseFloatOrZero(pf),
        points_against: parseFloatOrZero(pa),
        standings_position:
          posNum !== null && Number.isFinite(posNum) ? posNum : null,
        buy_in_cents: buyIn.trim() === '' ? null : parseCents(buyIn),
        prize_cents: prize.trim() === '' ? null : parseCents(prize),
      });
      setEditingHeader(false);
    });
  }

  function addPlayer() {
    const name = newName.trim();
    const position = newPos.trim();
    if (!name || !position) return;
    const player: FantasyPlayer = {
      name,
      position,
      team: newTeam.trim() || null,
    };
    run(async () => {
      await sportsUpdateFantasyLeague(league.id, {
        roster: [...league.roster, player],
      });
      setNewName('');
      setNewPos('');
      setNewTeam('');
    });
  }

  function removePlayer(index: number) {
    run(async () => {
      await sportsUpdateFantasyLeague(league.id, {
        roster: league.roster.filter((_, i) => i !== index),
      });
    });
  }

  function saveNotes() {
    run(async () => {
      await sportsUpdateFantasyLeague(league.id, {
        notes_md: notes.trim() === '' ? null : notes,
      });
    });
  }

  function confirmDelete() {
    if (
      !window.confirm(
        'Delete this league? This permanently removes the league and all logged transactions.',
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await sportsDeleteFantasyLeague(league.id);
        router.push('/sports/fantasy');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.backRow}>
        <Link href="/sports/fantasy" style={styles.backLink}>
          ← Leagues
        </Link>
      </div>

      {/* Header */}
      <section style={styles.card}>
        <div style={styles.headerRow}>
          <span style={styles.eyebrow}>{league.platform.toUpperCase()}</span>
          <button
            type="button"
            onClick={() => {
              if (editingHeader) {
                // cancel and reset
                setTeamName(league.team_name);
                setWins(String(league.record_wins));
                setLosses(String(league.record_losses));
                setTies(String(league.record_ties));
                setPos(
                  league.standings_position === null
                    ? ''
                    : String(league.standings_position),
                );
                setPf(String(league.points_for));
                setPa(String(league.points_against));
                setBuyIn(
                  league.buy_in_cents === null
                    ? ''
                    : String(league.buy_in_cents / 100),
                );
                setPrize(
                  league.prize_cents === null
                    ? ''
                    : String(league.prize_cents / 100),
                );
              }
              setEditingHeader((v) => !v);
            }}
            style={styles.linkBtn}
          >
            {editingHeader ? 'Cancel' : 'Edit'}
          </button>
        </div>
        <h2 style={styles.title}>{league.league_name}</h2>
        {editingHeader ? (
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            style={styles.input}
            placeholder="Team name"
          />
        ) : (
          <p style={styles.subtitle}>{league.team_name}</p>
        )}
        <div style={styles.chipRow}>
          <span style={styles.chip}>{league.format.toUpperCase()}</span>
          <span style={styles.chip}>{league.sport.toUpperCase()}</span>
          <span style={styles.chip}>{league.season}</span>
        </div>
      </section>

      {/* Record */}
      <section style={styles.card}>
        <h3 style={styles.label}>Record</h3>
        {editingHeader ? (
          <div style={styles.rowGap}>
            <Field label="W">
              <input
                value={wins}
                onChange={(e) => setWins(e.target.value)}
                inputMode="numeric"
                style={styles.input}
              />
            </Field>
            <Field label="L">
              <input
                value={losses}
                onChange={(e) => setLosses(e.target.value)}
                inputMode="numeric"
                style={styles.input}
              />
            </Field>
            <Field label="T">
              <input
                value={ties}
                onChange={(e) => setTies(e.target.value)}
                inputMode="numeric"
                style={styles.input}
              />
            </Field>
          </div>
        ) : (
          <p style={styles.bigRecord}>
            {formatRecord(
              league.record_wins,
              league.record_losses,
              league.record_ties,
            )}
          </p>
        )}

        <div style={styles.rowGap}>
          <Field label="Position">
            {editingHeader ? (
              <input
                value={pos}
                onChange={(e) => setPos(e.target.value)}
                inputMode="numeric"
                style={styles.input}
                placeholder="—"
              />
            ) : (
              <p style={styles.metricValue}>
                {league.standings_position === null
                  ? '—'
                  : `#${league.standings_position}`}
              </p>
            )}
          </Field>
          <Field label="Points for">
            {editingHeader ? (
              <input
                value={pf}
                onChange={(e) => setPf(e.target.value)}
                inputMode="decimal"
                style={styles.input}
              />
            ) : (
              <p style={styles.metricValue}>{league.points_for.toFixed(1)}</p>
            )}
          </Field>
          <Field label="Points against">
            {editingHeader ? (
              <input
                value={pa}
                onChange={(e) => setPa(e.target.value)}
                inputMode="decimal"
                style={styles.input}
              />
            ) : (
              <p style={styles.metricValue}>
                {league.points_against.toFixed(1)}
              </p>
            )}
          </Field>
        </div>

        <div style={styles.rowGap}>
          <Field label="Buy-in">
            {editingHeader ? (
              <input
                value={buyIn}
                onChange={(e) => setBuyIn(e.target.value)}
                inputMode="decimal"
                style={styles.input}
                placeholder="—"
              />
            ) : (
              <p style={styles.metricValue}>
                {league.buy_in_cents === null
                  ? '—'
                  : formatMoney(league.buy_in_cents)}
              </p>
            )}
          </Field>
          <Field label="Prize">
            {editingHeader ? (
              <input
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                inputMode="decimal"
                style={styles.input}
                placeholder="—"
              />
            ) : (
              <p style={styles.metricValue}>
                {league.prize_cents === null
                  ? '—'
                  : formatMoney(league.prize_cents)}
              </p>
            )}
          </Field>
        </div>

        {editingHeader ? (
          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={saveHeader}
              style={styles.primaryBtn}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : null}
      </section>

      {/* Roster */}
      <section style={styles.card}>
        <h3 style={styles.label}>Roster ({league.roster.length})</h3>
        {league.roster.length === 0 ? (
          <p style={styles.muted}>No players on roster yet.</p>
        ) : (
          <div style={styles.rosterList}>
            {league.roster.map((p, idx) => (
              <div key={`${p.name}-${idx}`} style={styles.rosterRow}>
                <div>
                  <div style={styles.rosterName}>{p.name}</div>
                  <div style={styles.rosterMeta}>
                    {p.position}
                    {p.team ? ` · ${p.team}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePlayer(idx)}
                  style={styles.removeBtn}
                  disabled={isPending}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={styles.addPlayerBlock}>
          <p style={styles.sublabel}>Add player</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            style={styles.input}
          />
          <input
            value={newPos}
            onChange={(e) => setNewPos(e.target.value)}
            placeholder="Position (QB, RB, PG…)"
            style={styles.input}
          />
          <input
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            placeholder="Team (optional)"
            style={styles.input}
          />
          <button
            type="button"
            onClick={addPlayer}
            style={{
              ...styles.primaryBtn,
              opacity:
                newName.trim() && newPos.trim() && !isPending ? 1 : 0.5,
            }}
            disabled={!newName.trim() || !newPos.trim() || isPending}
          >
            Add
          </button>
        </div>
      </section>

      {/* Notes */}
      <section style={styles.card}>
        <h3 style={styles.label}>Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Reasoning, matchup notes, trade targets…"
          style={styles.textarea}
        />
        {notesDirty ? (
          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={saveNotes}
              style={styles.primaryBtn}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save notes'}
            </button>
            <button
              type="button"
              onClick={() => setNotes(league.notes_md ?? '')}
              style={styles.secondaryBtn}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </section>

      {/* Transactions */}
      <section style={styles.card}>
        <h3 style={styles.label}>Recent transactions</h3>
        {transactions.length === 0 ? (
          <p style={styles.muted}>
            No transactions yet. Drafts, trades, and waivers will appear here.
          </p>
        ) : (
          <div style={styles.txList}>
            {transactions.map((tx) => (
              <div key={tx.id} style={styles.txRow}>
                <div style={styles.txHead}>
                  <span style={styles.txTypeBadge}>
                    {tx.type.toUpperCase().replace('_', ' ')}
                  </span>
                  <span style={styles.txDate}>
                    {new Date(tx.happened_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p style={styles.txDescription}>{tx.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {error ? <p style={styles.error}>{error}</p> : null}

      <button
        type="button"
        onClick={confirmDelete}
        style={styles.deleteBtn}
        disabled={isPending}
      >
        Delete league
      </button>
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
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  backRow: { marginBottom: 4 },
  backLink: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  },
  card: {
    display: 'grid',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: SPORTS_ACCENT,
  },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    padding: 0,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--text)',
  },
  subtitle: { margin: 0, fontSize: 14, color: '#D6C3B5' },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: {
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    fontSize: 11,
    fontWeight: 700,
    color: '#D6C3B5',
    letterSpacing: 0.8,
  },
  label: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#D6C3B5',
  },
  sublabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#9F8E81',
  },
  muted: { margin: 0, fontSize: 13, color: '#9F8E81' },
  bigRecord: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: 'var(--text)',
  },
  rowGap: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  field: { display: 'grid', gap: 4, flex: 1, minWidth: 100 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#9F8E81',
  },
  metricValue: {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--text)',
  },
  input: {
    padding: '8px 10px',
    borderRadius: 10,
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
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  primaryBtn: {
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  rosterList: { display: 'grid', gap: 0 },
  rosterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderTop: '1px solid var(--border)',
  },
  rosterName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
  },
  rosterMeta: { fontSize: 12, color: '#9F8E81', marginTop: 2 },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#E57373',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  addPlayerBlock: {
    display: 'grid',
    gap: 6,
    paddingTop: 10,
    borderTop: '1px solid var(--border)',
    marginTop: 6,
  },
  txList: { display: 'grid', gap: 0 },
  txRow: {
    display: 'grid',
    gap: 4,
    padding: '10px 0',
    borderTop: '1px solid var(--border)',
  },
  txHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txTypeBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    border: `1px solid ${SPORTS_ACCENT}`,
    color: SPORTS_ACCENT,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.8,
  },
  txDate: { fontSize: 12, color: '#9F8E81' },
  txDescription: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--text)',
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
  deleteBtn: {
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid #E57373',
    background: 'transparent',
    color: '#E57373',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    marginTop: 4,
  },
};
