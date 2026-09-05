'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { americanToDecimal, type BetLimits, type BetType } from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import { sportsCheckBetAllowance, sportsCreateBet } from '../../actions';

type Props = {
  limits: BetLimits;
};

const BET_TYPES: Array<{ key: BetType; label: string }> = [
  { key: 'moneyline', label: 'ML' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
  { key: 'prop', label: 'Prop' },
  { key: 'future', label: 'Futures' },
];

const LEAGUES: Array<{ key: string; sport: string; label: string }> = [
  { key: 'nfl', sport: 'football', label: 'NFL' },
  { key: 'nba', sport: 'basketball', label: 'NBA' },
  { key: 'mlb', sport: 'baseball', label: 'MLB' },
  { key: 'nhl', sport: 'hockey', label: 'NHL' },
  { key: 'mls', sport: 'soccer', label: 'MLS' },
  { key: 'other', sport: 'other', label: 'Other' },
];

const BOOKS = [
  'fanduel',
  'draftkings',
  'betmgm',
  'caesars',
  'espnbet',
  'fanatics',
  'local',
  'other',
] as const;

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function LogClient({ limits }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [betType, setBetType] = useState<BetType>('moneyline');
  const [leagueKey, setLeagueKey] = useState<string>('nfl');
  const [description, setDescription] = useState('');
  const [sportsbook, setSportsbook] = useState<(typeof BOOKS)[number]>(
    'fanduel',
  );
  const [oddsSign, setOddsSign] = useState<'+' | '-'>('+');
  const [oddsMag, setOddsMag] = useState<string>('110');
  const [stakeDollars, setStakeDollars] = useState<string>('');
  const [notes, setNotes] = useState('');

  const oddsAmerican = useMemo(() => {
    const n = parseInt(oddsMag, 10);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return oddsSign === '-' ? -n : n;
  }, [oddsSign, oddsMag]);

  const stakeCents = useMemo(() => {
    const n = parseFloat(stakeDollars);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [stakeDollars]);

  const decimal = useMemo(() => {
    if (oddsAmerican === 0) return 1;
    return americanToDecimal(oddsAmerican);
  }, [oddsAmerican]);

  const potentialPayoutCents = useMemo(
    () => Math.round(stakeCents * decimal),
    [stakeCents, decimal],
  );
  const units = useMemo(
    () => (limits.unit_size_cents > 0 ? stakeCents / limits.unit_size_cents : 0),
    [stakeCents, limits.unit_size_cents],
  );

  const canSubmit =
    !isPending &&
    description.trim().length > 0 &&
    stakeCents > 0 &&
    oddsAmerican !== 0;

  async function handleSave(override = false) {
    setError(null);
    const leagueMeta = LEAGUES.find((l) => l.key === leagueKey) ?? LEAGUES[0];

    const allowance = await sportsCheckBetAllowance(stakeCents);
    if (!allowance.allowed && !override) {
      if (allowance.reason === 'cooldown') {
        setError('Cooldown active. Cannot log bets right now.');
        return;
      }
      const proceed = window.confirm(
        `${allowance.reason === 'daily' ? 'Daily' : 'Weekly'} limit exceeded (spent ${formatMoney(allowance.spentCents)} of ${formatMoney(allowance.limitCents ?? 0)}). Log anyway?`,
      );
      if (!proceed) return;
    }

    startTransition(async () => {
      try {
        await sportsCreateBet({
          sport: leagueMeta.sport,
          league: leagueMeta.key,
          bet_type: betType,
          description: description.trim(),
          sportsbook,
          odds_american: oddsAmerican,
          stake_cents: stakeCents,
          units,
          notes_md: notes.trim() || null,
        });
        router.push('/sports/betting');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save bet');
      }
    });
  }

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Log bet</p>
      <h2 style={styles.title}>Single bet</h2>

      <Segment
        label="Bet type"
        value={betType}
        onChange={(v) => setBetType(v as BetType)}
        options={BET_TYPES.map((t) => ({ key: t.key, label: t.label }))}
      />

      <Segment
        label="League"
        value={leagueKey}
        onChange={setLeagueKey}
        options={LEAGUES.map((l) => ({ key: l.key, label: l.label }))}
      />

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Chiefs -3.5"
          style={styles.input}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Sportsbook</label>
        <div style={styles.chipRow}>
          {BOOKS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setSportsbook(b)}
              style={{
                ...styles.chip,
                ...(sportsbook === b ? styles.chipActive : {}),
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Odds (American)</label>
        <div style={styles.rowWrap}>
          <div style={styles.signSegment}>
            <button
              type="button"
              onClick={() => setOddsSign('+')}
              style={{
                ...styles.signBtn,
                ...(oddsSign === '+' ? styles.signBtnActive : {}),
              }}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setOddsSign('-')}
              style={{
                ...styles.signBtn,
                ...(oddsSign === '-' ? styles.signBtnActive : {}),
              }}
            >
              −
            </button>
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={oddsMag}
            onChange={(e) => setOddsMag(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="110"
            style={{ ...styles.input, flex: 1 }}
          />
        </div>
        <p style={styles.fieldSub}>
          = {decimal.toFixed(3)}× decimal
        </p>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Stake (USD)</label>
        <input
          type="number"
          inputMode="decimal"
          value={stakeDollars}
          onChange={(e) => setStakeDollars(e.target.value)}
          placeholder="25"
          style={styles.input}
        />
        {stakeCents > 0 ? (
          <p style={styles.fieldSub}>
            {units.toFixed(2)}U · Potential payout{' '}
            {formatMoney(potentialPayoutCents)}
          </p>
        ) : null}
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Why you liked this bet"
          style={styles.textarea}
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
          onClick={() => handleSave(false)}
          style={{
            ...styles.primaryBtn,
            opacity: canSubmit ? 1 : 0.5,
          }}
          disabled={!canSubmit}
        >
          {isPending ? 'Saving…' : 'Save bet'}
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
  fieldSub: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
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
  rowWrap: { display: 'flex', gap: 8 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'capitalize',
  },
  chipActive: {
    borderColor: SPORTS_ACCENT,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
  },
  segmentRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
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
  signSegment: {
    display: 'flex',
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  signBtn: {
    padding: '10px 14px',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
  },
  signBtnActive: {
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
  actionRow: {
    display: 'flex',
    gap: 10,
    marginTop: 6,
  },
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
