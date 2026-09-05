'use client';

import { useRouter } from 'next/navigation';
import {
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import type { Bet, BetLeg, BetResult } from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import {
  sportsDeleteBet,
  sportsSettleBet,
  sportsSettleBetLeg,
  sportsUpdateBetNotes,
} from '../../actions';

type Props = {
  bet: Bet;
  legs: BetLeg[];
};

const DANGER = '#E57373';
const MUTED = '#9F8E81';

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatSignedMoney(cents: number): string {
  const sign = cents > 0 ? '+' : '';
  return `${sign}${formatMoney(cents)}`;
}

function statusColor(result: BetResult): string {
  if (result === 'won') return SPORTS_ACCENT;
  if (result === 'lost') return DANGER;
  return MUTED;
}

const SETTLE_OPTIONS: Array<{ key: BetResult; label: string }> = [
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Mark as Lost' },
  { key: 'push', label: 'Push' },
  { key: 'void', label: 'Void' },
];

export function BetDetailClient({ bet: initialBet, legs: initialLegs }: Props) {
  const router = useRouter();
  const [bet, setBet] = useState<Bet>(initialBet);
  const [legs, setLegs] = useState<BetLeg[]>(initialLegs);
  const [notes, setNotes] = useState<string>(bet.notes_md ?? '');
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSettle(result: BetResult) {
    if (!window.confirm(`Settle this bet as ${result.toUpperCase()}?`)) return;
    startTransition(async () => {
      try {
        const next = await sportsSettleBet(bet.id, result);
        setBet(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settle failed');
      }
    });
  }

  function handleSettleLeg(legId: string, result: BetResult) {
    startTransition(async () => {
      try {
        const { leg, parent } = await sportsSettleBetLeg(legId, result);
        setLegs((prev) => prev.map((l) => (l.id === legId ? leg : l)));
        if (parent) setBet(parent);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Leg settle failed');
      }
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      try {
        await sportsUpdateBetNotes(bet.id, notes.trim() || null);
        setBet({ ...bet, notes_md: notes.trim() || null });
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Notes save failed');
      }
    });
  }

  function handleDelete() {
    if (!window.confirm('Delete this bet? This cannot be undone.')) return;
    startTransition(async () => {
      try {
        await sportsDeleteBet(bet.id);
        router.push('/sports/betting');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  }

  const isParlay = bet.bet_type === 'parlay';

  return (
    <div style={styles.wrap}>
      <section style={styles.header}>
        <div style={styles.headerTop}>
          <p style={styles.eyebrow}>{bet.bet_type.toUpperCase()}</p>
          <span
            style={{
              ...styles.badge,
              borderColor: statusColor(bet.result),
              color: statusColor(bet.result),
            }}
          >
            {bet.result.toUpperCase()}
          </span>
        </div>
        <h2 style={styles.title}>{bet.description}</h2>
        <p style={styles.metaLine}>
          {bet.league.toUpperCase()} · {bet.sportsbook} ·{' '}
          {new Date(bet.placed_at).toLocaleString()}
        </p>
      </section>

      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <p style={styles.metricLabel}>Stake</p>
          <p style={styles.metricValue}>{formatMoney(bet.stake_cents)}</p>
        </div>
        <div style={styles.metricCard}>
          <p style={styles.metricLabel}>Odds</p>
          <p style={styles.metricValue}>
            {bet.odds_american > 0 ? '+' : ''}
            {bet.odds_american}
          </p>
        </div>
        <div style={styles.metricCard}>
          <p style={styles.metricLabel}>Payout</p>
          <p style={styles.metricValue}>
            {formatMoney(bet.potential_payout_cents)}
          </p>
        </div>
        <div style={styles.metricCard}>
          <p style={styles.metricLabel}>P/L</p>
          <p
            style={{
              ...styles.metricValue,
              color:
                bet.result === 'pending'
                  ? MUTED
                  : bet.profit_loss_cents > 0
                    ? SPORTS_ACCENT
                    : bet.profit_loss_cents < 0
                      ? DANGER
                      : MUTED,
            }}
          >
            {bet.result === 'pending'
              ? '—'
              : formatSignedMoney(bet.profit_loss_cents)}
          </p>
        </div>
      </div>

      {isParlay && legs.length > 0 ? (
        <section style={styles.legsCard}>
          <h3 style={styles.sectionTitle}>Legs ({legs.length})</h3>
          {legs.map((leg) => (
            <div key={leg.id} style={styles.legRow}>
              <div style={styles.legRowHeader}>
                <span
                  style={{
                    ...styles.badge,
                    borderColor: statusColor(leg.result),
                    color: statusColor(leg.result),
                  }}
                >
                  {leg.result.toUpperCase()}
                </span>
                <span style={styles.legType}>
                  {leg.leg_type.toUpperCase()}
                </span>
                <span style={styles.legOdds}>
                  {leg.odds_american > 0 ? '+' : ''}
                  {leg.odds_american}
                </span>
              </div>
              <p style={styles.legDesc}>{leg.description}</p>
              {leg.result === 'pending' ? (
                <div style={styles.legActions}>
                  {SETTLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSettleLeg(leg.id, opt.key)}
                      disabled={isPending}
                      style={styles.smallBtn}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {!isParlay && bet.result === 'pending' ? (
        <section style={styles.settleCard}>
          <h3 style={styles.sectionTitle}>Settle</h3>
          <div style={styles.settleRow}>
            {SETTLE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleSettle(opt.key)}
                disabled={isPending}
                style={styles.settleBtn}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section style={styles.notesCard}>
        <div style={styles.notesHeader}>
          <h3 style={styles.sectionTitle}>Notes</h3>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={styles.linkBtn}
            >
              {bet.notes_md ? 'Edit' : 'Add'}
            </button>
          ) : null}
        </div>
        {editing ? (
          <>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={styles.textarea}
            />
            <div style={styles.notesActions}>
              <button
                type="button"
                onClick={() => {
                  setNotes(bet.notes_md ?? '');
                  setEditing(false);
                }}
                style={styles.secondaryBtn}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                style={styles.primaryBtn}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        ) : (
          <p style={styles.notesText}>
            {bet.notes_md ?? 'No notes yet.'}
          </p>
        )}
      </section>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.dangerRow}>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          style={styles.deleteBtn}
        >
          Delete bet
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 12 },
  header: {
    padding: 18,
    borderRadius: 18,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 6,
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#4ADE80',
  },
  badge: {
    padding: '3px 10px',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
    fontSize: 11,
    fontWeight: 800,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--text)',
    lineHeight: 1.3,
  },
  metaLine: { margin: 0, fontSize: 13, color: 'var(--text-secondary)' },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  metricCard: {
    padding: 12,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 2,
  },
  metricLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  metricValue: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--text)',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--text)',
  },
  legsCard: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 10,
  },
  legRow: { display: 'grid', gap: 6, paddingBottom: 10, borderBottom: '1px solid var(--border)' },
  legRowHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  legType: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
  },
  legOdds: {
    marginLeft: 'auto',
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontWeight: 700,
  },
  legDesc: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text)',
    fontWeight: 600,
  },
  legActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  smallBtn: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  settleCard: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 10,
  },
  settleRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  settleBtn: {
    flex: 1,
    minWidth: 100,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  notesCard: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 8,
  },
  notesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: SPORTS_ACCENT,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  notesText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  notesActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  primaryBtn: {
    padding: '8px 14px',
    borderRadius: 10,
    border: 'none',
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
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
  dangerRow: { display: 'flex', justifyContent: 'center', marginTop: 6 },
  deleteBtn: {
    padding: '10px 18px',
    borderRadius: 12,
    border: '1px solid rgba(229,115,115,0.4)',
    background: 'transparent',
    color: DANGER,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
  },
};
