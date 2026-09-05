'use client';

import type { CSSProperties } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { createTripAction, type CreateTripFormResult } from '../../actions';

const TRIP_TYPES = [
  'vacation',
  'business',
  'family',
  'solo',
  'road_trip',
  'backpacking',
] as const;

const initialState: CreateTripFormResult = { ok: true };

export function CreateTripForm() {
  const [state, formAction, isPending] = useActionState(
    createTripAction,
    initialState,
  );

  return (
    <section style={styles.panel}>
      <p style={styles.eyebrow}>New Trip</p>
      <h2 style={styles.title}>Plan a new trip</h2>
      <p style={styles.body}>
        Name your trip, add a destination and dates. You can fill in itinerary
        and logistics later.
      </p>

      <form action={formAction} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.label}>Trip name</span>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. Kyoto in the fall"
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Destination</span>
          <input
            type="text"
            name="destination"
            placeholder="e.g. Kyoto, Japan"
            style={styles.input}
          />
        </label>

        <div style={styles.row}>
          <label style={{ ...styles.field, flex: 1 }}>
            <span style={styles.label}>Start date</span>
            <input type="date" name="start_date" style={styles.input} />
          </label>
          <label style={{ ...styles.field, flex: 1 }}>
            <span style={styles.label}>End date</span>
            <input type="date" name="end_date" style={styles.input} />
          </label>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>Vibe</span>
          <select name="trip_type" defaultValue="" style={styles.input}>
            <option value="">None</option>
            {TRIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>

        {state && state.ok === false && state.error ? (
          <p style={styles.error}>{state.error}</p>
        ) : null}

        <div style={styles.ctaRow}>
          <button type="submit" disabled={isPending} style={styles.primaryButton}>
            {isPending ? 'Creating...' : 'Create trip'}
          </button>
          <Link href="/travel" style={styles.secondaryLink}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#7DD3FC',
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
    color: 'var(--text)',
  },
  body: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
  },
  form: {
    display: 'grid',
    gap: 12,
    marginTop: 8,
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
  },
  row: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  error: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,180,171,0.3)',
    background: 'rgba(255,180,171,0.08)',
    color: '#FFB4AB',
    fontSize: 14,
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButton: {
    borderRadius: 999,
    background: '#0EA5E9',
    color: '#0E0E13',
    border: 'none',
    padding: '11px 18px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryLink: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text)',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
};
