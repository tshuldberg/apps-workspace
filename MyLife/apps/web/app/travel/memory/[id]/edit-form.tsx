'use client';

import { useActionState, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type {
  JournalMemoryKind,
  JournalMemoryRow,
} from '@mylife/travel';
import {
  updateJournalMemoryAction,
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

export function EditMemoryForm({ memory }: { memory: JournalMemoryRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<JournalMemoryKind>(memory.kind);

  const [state, action, pending] = useActionState<
    MutationResult | null,
    FormData
  >(async (_prev, data) => {
    data.set('kind', kind);
    data.set('entry_id', memory.entry_id);
    const res = await updateJournalMemoryAction(memory.id, data);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
    return res;
  }, null);

  if (!open) {
    return (
      <div>
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => setOpen(true)}
        >
          Edit memory
        </button>
      </div>
    );
  }

  return (
    <section style={styles.panel}>
      <div style={styles.headerRow}>
        <h3 style={styles.sectionTitle}>Edit memory</h3>
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
          Media ref
          <input
            name="media_ref"
            defaultValue={memory.media_ref ?? ''}
            maxLength={500}
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Caption
          <textarea
            name="caption"
            defaultValue={memory.caption ?? ''}
            maxLength={500}
            style={{ ...styles.input, minHeight: 100, fontFamily: 'inherit' }}
          />
        </label>

        {state?.error ? <p style={styles.error}>{state.error}</p> : null}

        <button type="submit" style={styles.saveBtn} disabled={pending}>
          {pending ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
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
};
