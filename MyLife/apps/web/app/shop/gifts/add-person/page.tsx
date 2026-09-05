import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createGiftPerson, type GiftOccasion } from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const OCCASIONS: GiftOccasion[] = [
  'birthday',
  'holiday',
  'graduation',
  'housewarming',
  'thank_you',
  'other',
];

function parseDateISO(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isNaN(ts) ? null : ts;
}

export default function AddGiftPersonPage() {
  async function addPersonAction(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;
    const relationship = String(formData.get('relationship') ?? '').trim() || null;
    const nextOccasion = String(formData.get('nextOccasion') ?? '').trim() || null;
    const nextOccasionDate = parseDateISO(String(formData.get('nextOccasionDate') ?? ''));
    const notes = String(formData.get('notes') ?? '').trim() || null;
    try {
      createGiftPerson(getAdapter(), {
        name,
        relationship,
        nextOccasion: nextOccasion as GiftOccasion | null,
        nextOccasionDate,
        notes,
      });
    } finally {
      revalidatePath('/shop/gifts');
    }
    redirect('/shop/gifts');
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>Add a person</h2>
        <p style={styles.subtitle}>
          Who do you gift? Add a relationship and upcoming occasion to stay ahead.
        </p>
      </header>

      <form action={addPersonAction} style={styles.form}>
        <label style={styles.label}>
          Name
          <input required name="name" placeholder="Mom" style={styles.input} />
        </label>

        <label style={styles.label}>
          Relationship
          <input name="relationship" placeholder="Mom, partner, best friend…" style={styles.input} />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Next occasion
            <select name="nextOccasion" defaultValue="" style={styles.input}>
              <option value="">None</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>{o.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Date
            <input name="nextOccasionDate" type="date" style={styles.input} />
          </label>
        </div>

        <label style={styles.label}>
          Notes
          <textarea
            name="notes"
            placeholder="Loves books, collects vinyl…"
            style={{ ...styles.input, minHeight: 80 }}
          />
        </label>

        <div style={styles.actions}>
          <button type="submit" style={styles.primary}>Save person</button>
          <Link href="/shop/gifts" style={styles.secondary}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 14 },
  header: { display: 'grid', gap: 4 },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.5rem' },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 14 },
  form: { display: 'grid', gap: 10 },
  rowTwo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  label: {
    display: 'grid',
    gap: 5,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  input: {
    padding: '0.7rem 0.85rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--text)',
    fontSize: 14,
    textTransform: 'none',
  },
  actions: { display: 'flex', gap: 10, marginTop: 8 },
  primary: {
    padding: '0.75rem 1.1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondary: {
    padding: '0.75rem 1.1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 700,
  },
};
