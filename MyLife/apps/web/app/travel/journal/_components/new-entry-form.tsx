'use client';

import { useActionState, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  createJournalEntryAction,
  type MutationResult,
} from '../../actions';

const MOOD_ICONS: Record<number, string> = {
  1: '\u{1F614}',
  2: '\u{1F615}',
  3: '\u{1F610}',
  4: '\u{1F642}',
  5: '\u{1F604}',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewJournalEntryForm({
  trips,
  destinations,
}: {
  trips: Array<{ id: string; name: string }>;
  destinations: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<number | null>(null);

  const [state, action, pending] = useActionState<
    MutationResult | null,
    FormData
  >(async (_prev, data) => {
    if (mood != null) data.set('mood', String(mood));
    const res = await createJournalEntryAction(data);
    if (res.ok) {
      setOpen(false);
      setMood(null);
      router.refresh();
    }
    return res;
  }, null);

  if (!open) {
    return (
      <div>
        <button
          type="button"
          style={styles.newBtn}
          onClick={() => setOpen(true)}
        >
          + New entry
        </button>
      </div>
    );
  }

  return (
    <section style={styles.panel}>
      <div style={styles.headerRow}>
        <h3 style={styles.sectionTitle}>New entry</h3>
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>

      <form action={action} style={styles.form}>
        <label style={styles.label}>
          Date
          <input
            name="entry_date"
            type="date"
            required
            defaultValue={todayIso()}
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Title (optional)
          <input
            name="title"
            maxLength={300}
            placeholder="A day in Kyoto..."
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Body
          <textarea
            name="body_md"
            style={{ ...styles.input, minHeight: 140, fontFamily: 'inherit' }}
            placeholder="What happened today..."
          />
        </label>

        <div style={styles.fieldLabel}>Mood</div>
        <div style={styles.chipRow}>
          {[1, 2, 3, 4, 5].map((m) => (
            <button
              key={m}
              type="button"
              style={{
                ...styles.chip,
                ...(mood === m ? styles.chipActive : {}),
              }}
              onClick={() => setMood(mood === m ? null : m)}
            >
              {MOOD_ICONS[m]}
            </button>
          ))}
        </div>

        <label style={styles.label}>
          Trip (optional)
          <select name="trip_id" style={styles.input} defaultValue="">
            <option value="">None</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Destination (optional)
          <select
            name="destination_id"
            style={styles.input}
            defaultValue=""
          >
            <option value="">None</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div style={styles.row2}>
          <label style={styles.label}>
            Weather
            <input
              name="weather"
              maxLength={100}
              placeholder="Sunny, 72F"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Location label
            <input
              name="location_label"
              maxLength={200}
              placeholder="Café de Flore, Paris"
              style={styles.input}
            />
          </label>
        </div>

        {state?.error ? <p style={styles.error}>{state.error}</p> : null}

        <button type="submit" style={styles.saveBtn} disabled={pending}>
          {pending ? 'Saving...' : 'Save entry'}
        </button>
      </form>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  newBtn: {
    borderRadius: 999,
    border: 'none',
    background: '#0EA5E9',
    color: '#0E0E13',
    padding: '12px 22px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  panel: {
    display: 'grid',
    gap: 12,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { margin: 0, color: 'var(--text)', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '6px 14px',
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
  fieldLabel: {
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
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '8px 12px',
    fontSize: 16,
    cursor: 'pointer',
  },
  chipActive: {
    background: 'rgba(14,165,233,0.22)',
    borderColor: '#0EA5E9',
  },
  error: { margin: 0, color: '#FFB4AB', fontSize: 13 },
  saveBtn: {
    marginTop: 4,
    padding: '12px 18px',
    background: '#0EA5E9',
    color: '#0E0E13',
    fontWeight: 800,
    fontSize: 14,
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
  },
};
