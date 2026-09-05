'use client';

import type { CSSProperties } from 'react';
import { useActionState } from 'react';
import {
  createLoyaltyAction,
  type LogisticsFormResult,
} from './actions';

const TYPES = ['airline', 'hotel', 'car'] as const;

const initialState: LogisticsFormResult = { ok: true };

export function LoyaltyForm() {
  const [state, formAction, isPending] = useActionState(
    createLoyaltyAction,
    initialState,
  );

  return (
    <section style={styles.panel}>
      <p style={styles.eyebrow}>New Loyalty Program</p>
      <h3 style={styles.title}>Add a loyalty program</h3>
      <form action={formAction} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.label}>Type</span>
          <select name="type" defaultValue="airline" style={styles.input}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.label}>Provider</span>
          <input
            type="text"
            name="provider"
            required
            placeholder="United, Marriott, Hertz..."
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          <span style={styles.label}>Member number</span>
          <input type="text" name="member_number" style={styles.input} />
        </label>
        <label style={styles.field}>
          <span style={styles.label}>Status tier</span>
          <input type="text" name="status_tier" style={styles.input} />
        </label>
        <div style={styles.row}>
          <label style={{ ...styles.field, flex: 1 }}>
            <span style={styles.label}>Points</span>
            <input
              type="number"
              name="points_balance"
              min={0}
              defaultValue={0}
              style={styles.input}
            />
          </label>
          <label style={{ ...styles.field, flex: 1 }}>
            <span style={styles.label}>Miles</span>
            <input
              type="number"
              name="miles_balance"
              min={0}
              defaultValue={0}
              style={styles.input}
            />
          </label>
        </div>
        <label style={styles.field}>
          <span style={styles.label}>Expiry date</span>
          <input type="date" name="expiry_date" style={styles.input} />
        </label>
        {state && state.ok === false && state.error ? (
          <p style={styles.error}>{state.error}</p>
        ) : null}
        <button type="submit" disabled={isPending} style={styles.primaryButton}>
          {isPending ? 'Saving...' : '+ Add loyalty program'}
        </button>
      </form>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#7DD3FC',
  },
  title: { margin: 0, fontSize: 18, color: 'var(--text)' },
  form: { display: 'grid', gap: 10, marginTop: 4 },
  field: { display: 'grid', gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
  },
  row: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  error: {
    margin: 0,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(255,180,171,0.3)',
    background: 'rgba(255,180,171,0.08)',
    color: '#FFB4AB',
    fontSize: 13,
  },
  primaryButton: {
    borderRadius: 999,
    background: '#0EA5E9',
    color: '#0E0E13',
    border: 'none',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    justifySelf: 'start',
  },
};
