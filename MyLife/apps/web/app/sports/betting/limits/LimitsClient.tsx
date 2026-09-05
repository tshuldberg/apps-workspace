'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import type { BetLimits, BetLimitsPatch } from '@mylife/sports';
import {
  sportsGetBettingLimits,
  sportsSetBettingLimits,
} from '../../actions';
import { SPORTS_ACCENT } from '../../_ui';

type Props = {
  initial: BetLimits;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MUTED = '#9F8E81';
const DANGER = '#E57373';

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseDollarsToCents(
  raw: string,
): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return Math.round(n * 100);
}

function centsToDollarString(cents: number | null): string {
  if (cents === null) return '';
  return (cents / 100).toString();
}

function toDateInputString(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateInputToMs(iso: string): number | null {
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  const ms = dt.getTime();
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function formatCooldownPill(until: number | null): string {
  if (until === null || until <= Date.now()) return 'None';
  return `Active until ${new Date(until).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`;
}

export function LimitsClient({ initial }: Props) {
  const [limits, setLimits] = useState<BetLimits>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dailyInput, setDailyInput] = useState<string>(
    centsToDollarString(initial.daily_cents),
  );
  const [weeklyInput, setWeeklyInput] = useState<string>(
    centsToDollarString(initial.weekly_cents),
  );
  const [unitInput, setUnitInput] = useState<string>(
    centsToDollarString(initial.unit_size_cents),
  );
  const [customDate, setCustomDate] = useState<string>('');

  useEffect(() => {
    setDailyInput(centsToDollarString(limits.daily_cents));
    setWeeklyInput(centsToDollarString(limits.weekly_cents));
    setUnitInput(centsToDollarString(limits.unit_size_cents));
  }, [limits]);

  const cooldownActive = useMemo(
    () => limits.cooldown_until !== null && limits.cooldown_until > Date.now(),
    [limits],
  );

  const applyPatch = useCallback((patch: BetLimitsPatch) => {
    setError(null);
    startTransition(async () => {
      try {
        await sportsSetBettingLimits(patch);
        const next = await sportsGetBettingLimits();
        setLimits(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }, []);

  const onSaveDaily = () => {
    const parsed = parseDollarsToCents(dailyInput);
    if (parsed === 'invalid') {
      setError('Enter a whole-dollar amount, or leave blank to clear.');
      return;
    }
    applyPatch({ daily_cents: parsed });
  };

  const onClearDaily = () => {
    setDailyInput('');
    applyPatch({ daily_cents: null });
  };

  const onSaveWeekly = () => {
    const parsed = parseDollarsToCents(weeklyInput);
    if (parsed === 'invalid') {
      setError('Enter a whole-dollar amount, or leave blank to clear.');
      return;
    }
    applyPatch({ weekly_cents: parsed });
  };

  const onClearWeekly = () => {
    setWeeklyInput('');
    applyPatch({ weekly_cents: null });
  };

  const onSaveUnit = () => {
    const parsed = parseDollarsToCents(unitInput);
    if (parsed === 'invalid' || parsed === null || parsed < 1) {
      setError('Unit size must be at least $0.01.');
      return;
    }
    applyPatch({ unit_size_cents: parsed });
  };

  const onPreset = (days: number) => {
    applyPatch({ cooldown_until: Date.now() + days * DAY_MS });
  };

  const onClearPause = () => {
    setCustomDate('');
    applyPatch({ cooldown_until: null });
  };

  const onSaveCustomDate = () => {
    const ms = parseDateInputToMs(customDate);
    if (ms === null) {
      setError('Pick a date.');
      return;
    }
    if (ms <= Date.now()) {
      setError('Pick a date in the future.');
      return;
    }
    applyPatch({ cooldown_until: ms });
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <Link href="/sports/betting" style={styles.backBtn} aria-label="Back">
          &lsaquo; Back
        </Link>
        <div>
          <p style={styles.eyebrow}>Betting</p>
          <h2 style={styles.title}>Betting limits</h2>
        </div>
      </div>

      <p style={styles.intro}>
        Set your own guardrails. Limits are private, stored on this device, and
        never shared.
      </p>

      {error ? <p style={styles.errorText}>{error}</p> : null}

      <section style={styles.card}>
        <p style={styles.cardLabel}>Daily limit</p>
        <p style={styles.cardHelper}>
          When your day&apos;s wagers approach 80% of this, the dashboard shows
          a soft banner.
        </p>
        <div style={styles.inputRow}>
          <span style={styles.prefix}>$</span>
          <input
            style={styles.input}
            value={dailyInput}
            onChange={(e) => setDailyInput(e.target.value)}
            onBlur={onSaveDaily}
            placeholder="None"
            inputMode="decimal"
            disabled={isPending}
          />
          <button
            type="button"
            style={styles.saveChip}
            onClick={onSaveDaily}
            disabled={isPending}
          >
            Save
          </button>
        </div>
        {limits.daily_cents !== null ? (
          <button
            type="button"
            style={styles.clearChip}
            onClick={onClearDaily}
            disabled={isPending}
          >
            Clear daily limit
          </button>
        ) : null}
      </section>

      <section style={styles.card}>
        <p style={styles.cardLabel}>Weekly limit</p>
        <p style={styles.cardHelper}>Rolling 7-day window from now.</p>
        <div style={styles.inputRow}>
          <span style={styles.prefix}>$</span>
          <input
            style={styles.input}
            value={weeklyInput}
            onChange={(e) => setWeeklyInput(e.target.value)}
            onBlur={onSaveWeekly}
            placeholder="None"
            inputMode="decimal"
            disabled={isPending}
          />
          <button
            type="button"
            style={styles.saveChip}
            onClick={onSaveWeekly}
            disabled={isPending}
          >
            Save
          </button>
        </div>
        {limits.weekly_cents !== null ? (
          <button
            type="button"
            style={styles.clearChip}
            onClick={onClearWeekly}
            disabled={isPending}
          >
            Clear weekly limit
          </button>
        ) : null}
      </section>

      <section style={styles.card}>
        <p style={styles.cardLabel}>Unit size</p>
        <p style={styles.cardHelper}>
          Used to convert stakes into units (e.g. 3U = 3 x unit size). Defaults
          to $10.
        </p>
        <div style={styles.inputRow}>
          <span style={styles.prefix}>$</span>
          <input
            style={styles.input}
            value={unitInput}
            onChange={(e) => setUnitInput(e.target.value)}
            onBlur={onSaveUnit}
            placeholder="10"
            inputMode="decimal"
            disabled={isPending}
          />
          <button
            type="button"
            style={styles.saveChip}
            onClick={onSaveUnit}
            disabled={isPending}
          >
            Save
          </button>
        </div>
        <p style={styles.currentValue}>
          Current: {formatMoney(limits.unit_size_cents)}
        </p>
      </section>

      <section style={styles.card}>
        <p style={styles.cardLabel}>Pause logging</p>
        <p style={styles.cardHelper}>
          While paused, the dashboard hides log CTAs and new bets are blocked.
        </p>
        <div>
          <span
            style={{
              ...styles.statusPill,
              borderColor: cooldownActive ? SPORTS_ACCENT : 'var(--border)',
              color: cooldownActive ? SPORTS_ACCENT : MUTED,
            }}
          >
            {formatCooldownPill(limits.cooldown_until)}
          </span>
        </div>
        <div style={styles.presetRow}>
          <button
            type="button"
            style={styles.presetBtn}
            onClick={() => onPreset(1)}
            disabled={isPending}
          >
            Pause 24h
          </button>
          <button
            type="button"
            style={styles.presetBtn}
            onClick={() => onPreset(7)}
            disabled={isPending}
          >
            Pause 7 days
          </button>
          <button
            type="button"
            style={styles.presetBtn}
            onClick={() => onPreset(30)}
            disabled={isPending}
          >
            Pause 30 days
          </button>
        </div>
        <p style={styles.subCardLabel}>Custom date</p>
        <div style={styles.inputRow}>
          <input
            type="date"
            style={styles.input}
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            disabled={isPending}
            min={toDateInputString(Date.now() + DAY_MS)}
          />
          <button
            type="button"
            style={styles.saveChip}
            onClick={onSaveCustomDate}
            disabled={isPending}
          >
            Set
          </button>
        </div>
        {cooldownActive ? (
          <button
            type="button"
            style={{ ...styles.clearChip, borderColor: DANGER, color: DANGER }}
            onClick={onClearPause}
            disabled={isPending}
          >
            Clear pause
          </button>
        ) : null}
      </section>

      <section style={styles.supportCard}>
        <p style={styles.supportText}>
          If betting is hurting you, call or text the National Problem Gambling
          Helpline: 1-800-GAMBLER.
        </p>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 14,
    justifyContent: 'flex-start',
  },
  backBtn: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
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
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--text)',
  },
  intro: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  errorText: {
    margin: 0,
    color: DANGER,
    fontSize: 13,
  },
  card: {
    padding: 18,
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'grid',
    gap: 10,
  },
  cardLabel: {
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  subCardLabel: {
    margin: '6px 0 0',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  cardHelper: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.4,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  prefix: {
    color: 'var(--text-secondary)',
    fontSize: 16,
    fontWeight: 700,
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg, #0E0E13)',
    color: 'var(--text)',
    fontSize: 14,
  },
  saveChip: {
    padding: '10px 14px',
    borderRadius: 10,
    background: SPORTS_ACCENT,
    color: '#0E0E13',
    fontSize: 13,
    fontWeight: 800,
    border: 'none',
    cursor: 'pointer',
  },
  clearChip: {
    alignSelf: 'flex-start',
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  currentValue: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  statusPill: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
  },
  presetRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg, #0E0E13)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  supportCard: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: 'var(--bg, #0E0E13)',
  },
  supportText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.5,
  },
};
