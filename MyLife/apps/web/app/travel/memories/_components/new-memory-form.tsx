'use client';

import { useActionState, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { JournalMemoryKind } from '@mylife/travel';
import {
  createJournalMemoryAction,
  type MutationResult,
} from '../../actions';

const KINDS: JournalMemoryKind[] = [
  'photo',
  'quote',
  'souvenir',
  'video',
  'audio',
  'other',
];

const KIND_ICONS: Record<JournalMemoryKind, string> = {
  photo: '\u{1F4F7}',
  quote: '\u{1F4AC}',
  souvenir: '\u{1F381}',
  video: '\u{1F3A5}',
  audio: '\u{1F3A7}',
  other: '\u{2728}',
};

export interface EntryOption {
  id: string;
  entry_date: string;
  title: string | null;
}

export function NewMemoryForm({ entries }: { entries: EntryOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<JournalMemoryKind>('photo');
  const [entryId, setEntryId] = useState<string>(
    entries.length > 0 ? entries[0]!.id : '',
  );

  const [state, action, pending] = useActionState<
    MutationResult | null,
    FormData
  >(async (_prev, data) => {
    if (!entryId) {
      return { ok: false, error: 'Pick an entry.' };
    }
    data.set('kind', kind);
    const res = await createJournalMemoryAction(entryId, data);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
    return res;
  }, null);

  if (entries.length === 0) {
    return (
      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Add memory</h3>
        <p style={styles.muted}>
          Memories attach to journal entries. Create an entry first.
        </p>
      </section>
    );
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          style={styles.newBtn}
          onClick={() => setOpen(true)}
        >
          + New memory
        </button>
      </div>
    );
  }

  return (
    <section style={styles.panel}>
      <div style={styles.headerRow}>
        <h3 style={styles.sectionTitle}>New memory</h3>
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>

      <form action={action} style={styles.form}>
        <div style={styles.fieldLabel}>Kind</div>
        <div style={styles.chipRow}>
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              style={{
                ...styles.chip,
                ...(kind === k ? styles.chipActive : {}),
              }}
              onClick={() => setKind(k)}
            >
              {KIND_ICONS[k]} {k}
            </button>
          ))}
        </div>

        <label style={styles.label}>
          Entry
          <select
            name="entry_id"
            style={styles.input}
            value={entryId}
            onChange={(e) => setEntryId(e.target.value)}
            required
          >
            {entries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.entry_date}
                {e.title ? ` - ${e.title}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Media ref (optional)
          <input
            name="media_ref"
            maxLength={500}
            placeholder="url, file path, or id"
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Caption (optional)
          <textarea
            name="caption"
            maxLength={500}
            style={{ ...styles.input, minHeight: 100, fontFamily: 'inherit' }}
            placeholder="A short caption..."
          />
        </label>

        {state?.error ? <p style={styles.error}>{state.error}</p> : null}

        <button type="submit" style={styles.saveBtn} disabled={pending}>
          {pending ? 'Saving...' : 'Save memory'}
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
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textTransform: 'capitalize',
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
  muted: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
};
