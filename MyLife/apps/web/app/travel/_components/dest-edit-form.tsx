'use client';

import { useActionState, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { COUNTRIES, type Country, type DestinationRecord } from '@mylife/travel';
import {
  deleteDestinationAction,
  unvisitDestinationAction,
  updateDestinationAction,
  visitDestinationAction,
  type MutationResult,
} from '../actions';
import {
  TRAVEL_ACCENT,
  countryFlag,
  isVisited,
} from '../destinations/_components/dest-helpers';

export function DestEditForm({ record }: { record: DestinationRecord }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [country, setCountry] = useState<Country | null>(() => {
    if (!record.country_code) return null;
    return (
      COUNTRIES.find(
        (c) => c.code.toUpperCase() === record.country_code!.toUpperCase(),
      ) ?? null
    );
  });
  const [countryQuery, setCountryQuery] = useState('');

  const [editState, editAction, editPending] = useActionState<
    MutationResult | null,
    FormData
  >(async (_prev, data) => {
    const res = await updateDestinationAction(data);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
    return res;
  }, null);

  const [visitState, visitAction, visitPending] = useActionState<
    MutationResult | null,
    FormData
  >(async (_prev, data) => {
    const res = await visitDestinationAction(data);
    if (res.ok) router.refresh();
    return res;
  }, null);

  const [unvisitState, unvisitAction, unvisitPending] = useActionState<
    MutationResult | null,
    FormData
  >(async (_prev, data) => {
    const res = await unvisitDestinationAction(data);
    if (res.ok) router.refresh();
    return res;
  }, null);

  const [deleteState, deleteAction, deletePending] = useActionState<
    MutationResult | null,
    FormData
  >(async (_prev, data) => {
    return deleteDestinationAction(data);
  }, null);

  const matches = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return [] as Country[];
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    ).slice(0, 6);
  }, [countryQuery]);

  const visited = isVisited(record);
  const err =
    editState?.error ??
    visitState?.error ??
    unvisitState?.error ??
    deleteState?.error;

  return (
    <section style={styles.panel}>
      <div style={styles.actionsRow}>
        <button
          type="button"
          style={styles.primaryBtn}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>

        <form action={visitAction}>
          <input type="hidden" name="id" value={record.id} />
          <button type="submit" style={styles.secondaryBtn} disabled={visitPending}>
            {visitPending ? 'Saving...' : visited ? 'Mark visited again' : 'Mark as visited'}
          </button>
        </form>

        {record.bucket_list ? (
          <form action={unvisitAction}>
            <input type="hidden" name="id" value={record.id} />
            <button type="submit" style={styles.secondaryBtn} disabled={unvisitPending}>
              {unvisitPending ? 'Saving...' : 'Remove from wishlist'}
            </button>
          </form>
        ) : null}

        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!window.confirm(`Delete ${record.name}? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={record.id} />
          <button type="submit" style={styles.dangerBtn} disabled={deletePending}>
            {deletePending ? 'Deleting...' : 'Delete'}
          </button>
        </form>
      </div>

      {err ? <p style={styles.error}>{err}</p> : null}

      {editing ? (
        <form action={editAction} style={styles.form}>
          <input type="hidden" name="id" value={record.id} />
          <input
            type="hidden"
            name="bucket_list"
            value={String(record.bucket_list)}
          />

          <label style={styles.label}>
            Name
            <input
              name="name"
              required
              defaultValue={record.name}
              maxLength={200}
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
              placeholder={record.country ?? 'Type to search...'}
              style={styles.input}
              autoComplete="off"
            />
          </label>
          <input type="hidden" name="country" value={country?.name ?? record.country ?? ''} />
          <input
            type="hidden"
            name="country_code"
            value={country?.code ?? record.country_code ?? ''}
          />
          <input type="hidden" name="region" value={country?.region ?? record.region ?? ''} />

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

          <div style={styles.row2}>
            <label style={styles.label}>
              Latitude
              <input
                name="lat"
                type="number"
                step="any"
                min={-90}
                max={90}
                defaultValue={record.lat ?? ''}
                style={styles.input}
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
                defaultValue={record.lng ?? ''}
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.label}>
            Best season
            <input
              name="best_season"
              maxLength={50}
              defaultValue={record.best_season ?? ''}
              style={styles.input}
              placeholder="e.g. Spring, October-November"
            />
          </label>

          <label style={styles.label}>
            Notes
            <textarea
              name="notes_md"
              defaultValue={record.notes_md ?? ''}
              style={{ ...styles.input, minHeight: 120, fontFamily: 'inherit' }}
              placeholder="Favorite spots, recommendations, memories..."
            />
          </label>

          <button type="submit" disabled={editPending} style={styles.save}>
            {editPending ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  actionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 999,
    border: 'none',
    background: TRAVEL_ACCENT,
    color: '#0E0E13',
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryBtn: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  dangerBtn: {
    borderRadius: 999,
    border: '1px solid rgba(255,180,171,0.4)',
    background: 'rgba(147,0,10,0.3)',
    color: '#FFB4AB',
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  form: { display: 'grid', gap: 10 },
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
