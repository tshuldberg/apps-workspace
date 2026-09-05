'use client';

import { useActionState, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { COUNTRIES, type Country } from '@mylife/travel';
import {
  createDestinationAction,
  type CreateDestinationResult,
} from '../actions';
import { TRAVEL_ACCENT, countryFlag } from './dest-helpers';

export function DestAddForm({ onDoneAction }: { onDoneAction?: () => void }) {
  const [open, setOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [kind, setKind] = useState<'wishlist' | 'visited'>('wishlist');
  const [state, formAction, pending] = useActionState<
    CreateDestinationResult | null,
    FormData
  >(async (prev, data) => {
    const res = await createDestinationAction(prev, data);
    if (res.ok) {
      setCountry(null);
      setCountryQuery('');
      setKind('wishlist');
      setOpen(false);
      onDoneAction?.();
    }
    return res;
  }, null);

  const matches = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return [] as Country[];
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    ).slice(0, 6);
  }, [countryQuery]);

  if (!open) {
    return (
      <button type="button" style={styles.addBtn} onClick={() => setOpen(true)}>
        + Add destination
      </button>
    );
  }

  return (
    <form action={formAction} style={styles.sheet}>
      <div style={styles.sheetHeader}>
        <h3 style={styles.sheetTitle}>Add destination</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={styles.close}
        >
          Close
        </button>
      </div>

      <label style={styles.label}>
        Name
        <input
          name="name"
          required
          maxLength={200}
          placeholder="Tokyo, Patagonia, Zion..."
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Country
        <input
          value={
            country ? `${countryFlag(country.code)}  ${country.name}` : countryQuery
          }
          onChange={(e) => {
            setCountry(null);
            setCountryQuery(e.target.value);
          }}
          placeholder="Type to search..."
          style={styles.input}
          autoComplete="off"
        />
      </label>
      <input type="hidden" name="country" value={country?.name ?? ''} />
      <input type="hidden" name="country_code" value={country?.code ?? ''} />
      <input type="hidden" name="region" value={country?.region ?? ''} />

      {matches.length > 0 ? (
        <div style={styles.suggestions}>
          {matches.map((c) => (
            <button
              type="button"
              key={c.code}
              style={styles.suggestion}
              onClick={() => {
                setCountry(c);
                setCountryQuery('');
              }}
            >
              <span style={{ fontSize: 20 }}>{countryFlag(c.code)}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                {c.region}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Type</legend>
        <div style={styles.chipRow}>
          {(['wishlist', 'visited'] as const).map((k) => (
            <label
              key={k}
              style={{
                ...styles.chip,
                ...(kind === k ? styles.chipActive : {}),
              }}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                style={{ display: 'none' }}
              />
              {k === 'wishlist' ? 'Wishlist' : 'Visited'}
            </label>
          ))}
        </div>
      </fieldset>

      <div style={styles.row2}>
        <label style={styles.label}>
          Latitude
          <input
            name="lat"
            type="number"
            step="any"
            min={-90}
            max={90}
            style={styles.input}
            placeholder="optional"
          />
        </label>
        <label style={styles.label}>
          Longitude
          <input
            name="lng"
            type="number"
            step="any"
            min={-180}
            max={180}
            style={styles.input}
            placeholder="optional"
          />
        </label>
      </div>

      {state?.error ? <p style={styles.error}>{state.error}</p> : null}

      <button type="submit" disabled={pending} style={styles.save}>
        {pending ? 'Saving...' : 'Save destination'}
      </button>
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  addBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    border: 'none',
    background: TRAVEL_ACCENT,
    color: '#0E0E13',
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  sheet: {
    display: 'grid',
    gap: 12,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  sheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { margin: 0, fontSize: 18, color: 'var(--text)' },
  close: {
    background: 'transparent',
    border: 'none',
    color: TRAVEL_ACCENT,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  label: {
    display: 'grid',
    gap: 6,
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    outline: 'none',
  },
  suggestions: {
    display: 'grid',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
    background: 'rgba(0,0,0,0.25)',
  },
  suggestion: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    color: 'var(--text)',
    fontSize: 14,
    cursor: 'pointer',
  },
  fieldset: {
    display: 'grid',
    gap: 6,
    border: 'none',
    padding: 0,
    margin: 0,
  },
  legend: {
    padding: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  chipRow: { display: 'flex', gap: 8 },
  chip: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {
    background: 'rgba(14,165,233,0.18)',
    borderColor: TRAVEL_ACCENT,
    color: TRAVEL_ACCENT,
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  error: { margin: 0, color: '#FFB4AB', fontSize: 13 },
  save: {
    marginTop: 6,
    padding: '12px 18px',
    background: TRAVEL_ACCENT,
    color: '#0E0E13',
    fontWeight: 800,
    fontSize: 14,
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
};
