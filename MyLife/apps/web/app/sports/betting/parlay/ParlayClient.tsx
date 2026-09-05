'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
  type BetLegInsertInput,
  type BetLimits,
} from '@mylife/sports';
import { SPORTS_ACCENT } from '../../_ui';
import { sportsCheckBetAllowance, sportsCreateBet } from '../../actions';

type Props = {
  limits: BetLimits;
};

type LegDraft = {
  description: string;
  leg_type: 'moneyline' | 'spread' | 'total' | 'prop';
  oddsSign: '+' | '-';
  oddsMag: string;
};

const LEG_TYPES: Array<{ key: LegDraft['leg_type']; label: string }> = [
  { key: 'moneyline', label: 'ML' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
  { key: 'prop', label: 'Prop' },
];

function emptyLeg(): LegDraft {
  return { description: '', leg_type: 'moneyline', oddsSign: '+', oddsMag: '110' };
}

function legOddsAmerican(leg: LegDraft): number {
  const n = parseInt(leg.oddsMag, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return leg.oddsSign === '-' ? -n : n;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function ParlayClient({ limits }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [legs, setLegs] = useState<LegDraft[]>([emptyLeg(), emptyLeg()]);
  const [stakeDollars, setStakeDollars] = useState('');
  const [notes, setNotes] = useState('');

  const stakeCents = useMemo(() => {
    const n = parseFloat(stakeDollars);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [stakeDollars]);

  const legsValid = useMemo(
    () =>
      legs.every(
        (l) => l.description.trim().length > 0 && legOddsAmerican(l) !== 0,
      ),
    [legs],
  );

  const combinedDecimal = useMemo(() => {
    if (!legsValid) return 1;
    return combineDecimalOdds(legs.map((l) => americanToDecimal(legOddsAmerican(l))));
  }, [legs, legsValid]);

  const combinedAmerican = useMemo(
    () => (legsValid ? decimalToAmerican(combinedDecimal) : 0),
    [combinedDecimal, legsValid],
  );

  const potentialPayoutCents = useMemo(
    () => Math.round(stakeCents * combinedDecimal),
    [stakeCents, combinedDecimal],
  );
  const units = useMemo(
    () => (limits.unit_size_cents > 0 ? stakeCents / limits.unit_size_cents : 0),
    [stakeCents, limits.unit_size_cents],
  );

  const canSubmit =
    !isPending && legs.length >= 2 && legsValid && stakeCents > 0;

  function updateLeg(idx: number, patch: Partial<LegDraft>) {
    setLegs((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLeg() {
    setLegs((prev) => [...prev, emptyLeg()]);
  }

  function removeLeg(idx: number) {
    if (legs.length <= 2) return;
    setLegs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(override = false) {
    setError(null);
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

    const legsPayload: BetLegInsertInput[] = legs.map((l) => ({
      description: l.description.trim(),
      leg_type: l.leg_type,
      odds_american: legOddsAmerican(l),
    }));

    startTransition(async () => {
      try {
        await sportsCreateBet(
          {
            sport: 'mixed',
            league: 'mixed',
            bet_type: 'parlay',
            description: `${legs.length}-leg parlay`,
            sportsbook: 'other',
            odds_american: combinedAmerican,
            stake_cents: stakeCents,
            units,
            notes_md: notes.trim() || null,
          },
          legsPayload,
        );
        router.push('/sports/betting');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save parlay');
      }
    });
  }

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>Parlay</p>
      <h2 style={styles.title}>Parlay builder</h2>

      {legs.map((leg, idx) => (
        <section key={idx} style={styles.legCard}>
          <div style={styles.legHeader}>
            <span style={styles.legBadge}>Leg {idx + 1}</span>
            {legs.length > 2 ? (
              <button
                type="button"
                onClick={() => removeLeg(idx)}
                style={styles.legRemove}
                aria-label="Remove leg"
              >
                ×
              </button>
            ) : null}
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Leg type</label>
            <div style={styles.segmentRow}>
              {LEG_TYPES.map((t) => {
                const active = leg.leg_type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => updateLeg(idx, { leg_type: t.key })}
                    style={{
                      ...styles.segmentBtn,
                      ...(active ? styles.segmentBtnActive : {}),
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Description</label>
            <input
              type="text"
              value={leg.description}
              onChange={(e) => updateLeg(idx, { description: e.target.value })}
              placeholder="Chiefs ML"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Odds</label>
            <div style={styles.rowWrap}>
              <div style={styles.signSegment}>
                <button
                  type="button"
                  onClick={() => updateLeg(idx, { oddsSign: '+' })}
                  style={{
                    ...styles.signBtn,
                    ...(leg.oddsSign === '+' ? styles.signBtnActive : {}),
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => updateLeg(idx, { oddsSign: '-' })}
                  style={{
                    ...styles.signBtn,
                    ...(leg.oddsSign === '-' ? styles.signBtnActive : {}),
                  }}
                >
                  −
                </button>
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={leg.oddsMag}
                onChange={(e) =>
                  updateLeg(idx, {
                    oddsMag: e.target.value.replace(/[^0-9]/g, ''),
                  })
                }
                placeholder="110"
                style={{ ...styles.input, flex: 1 }}
              />
            </div>
          </div>
        </section>
      ))}

      <button type="button" onClick={addLeg} style={styles.addLegBtn}>
        + Add leg
      </button>

      <section style={styles.summary}>
        <div>
          <p style={styles.fieldLabel}>Combined odds</p>
          <p style={styles.summaryBig}>
            {combinedAmerican > 0 ? '+' : ''}
            {combinedAmerican} <span style={styles.summarySub}>({combinedDecimal.toFixed(3)}×)</span>
          </p>
        </div>
        <div>
          <p style={styles.fieldLabel}>Potential payout</p>
          <p style={styles.summaryBig}>
            {stakeCents > 0 ? formatMoney(potentialPayoutCents) : '—'}
          </p>
          <p style={styles.fieldSub}>
            Profit {stakeCents > 0 ? formatMoney(potentialPayoutCents - stakeCents) : '—'}
          </p>
        </div>
      </section>

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
          <p style={styles.fieldSub}>{units.toFixed(2)}U</p>
        ) : null}
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
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
          disabled={!canSubmit}
          style={{ ...styles.primaryBtn, opacity: canSubmit ? 1 : 0.5 }}
        >
          {isPending ? 'Saving…' : 'Save parlay'}
        </button>
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
  title: { margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text)' },
  legCard: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 10,
  },
  legHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(22,163,74,0.18)',
    color: SPORTS_ACCENT,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  legRemove: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
  },
  field: { display: 'grid', gap: 6 },
  fieldLabel: {
    margin: 0,
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
  segmentRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  segmentBtn: {
    flex: 1,
    minWidth: 70,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    fontSize: 12,
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
  signBtnActive: { background: SPORTS_ACCENT, color: '#0E0E13' },
  addLegBtn: {
    padding: '12px',
    borderRadius: 12,
    border: `1px dashed ${SPORTS_ACCENT}`,
    background: 'transparent',
    color: SPORTS_ACCENT,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  summary: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryBig: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--text)',
  },
  summarySub: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontWeight: 600,
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
