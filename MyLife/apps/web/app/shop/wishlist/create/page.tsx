import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createWishlist, type Occasion, type Wishlist } from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const OCCASIONS: Array<Occasion | ''> = [
  '',
  'birthday',
  'holiday',
  'graduation',
  'housewarming',
  'thank_you',
  'general',
  'other',
];

async function createAction(formData: FormData) {
  'use server';
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const description = String(formData.get('description') ?? '').trim();
  const occasion = String(formData.get('occasion') ?? '').trim();
  const personId = String(formData.get('personId') ?? '').trim();
  let created: Wishlist;
  try {
    created = createWishlist(getAdapter(), {
      name,
      description: description || null,
      occasion: (occasion || null) as Occasion | null,
      personId: personId || null,
    });
  } finally {
    revalidatePath('/shop');
  }
  redirect(`/shop/wishlist/${created.id}`);
}

export default function CreateWishlistPage() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>New wishlist</h2>
        <p style={styles.subtitle}>
          Group wishes by occasion, person, or theme. You can toggle sharing later.
        </p>
      </header>

      <form action={createAction} style={styles.form}>
        <label style={styles.label}>
          Name
          <input required name="name" placeholder="e.g. Birthday 2026" style={styles.input} />
        </label>
        <label style={styles.label}>
          Description (optional)
          <textarea name="description" placeholder="What is this list for?" style={{ ...styles.input, minHeight: 80 }} />
        </label>
        <label style={styles.label}>
          Occasion
          <select name="occasion" style={styles.input} defaultValue="">
            {OCCASIONS.map((o) => (
              <option key={o || 'none'} value={o}>
                {o || 'None'}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Gift for person (optional ID)
          <input name="personId" placeholder="Friends module person id" style={styles.input} />
        </label>
        <div style={styles.actions}>
          <button type="submit" style={styles.primary}>Create wishlist</button>
          <Link href="/shop" style={styles.secondary}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 16 },
  header: { display: 'grid', gap: 6 },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.75rem' },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 },
  form: { display: 'grid', gap: 12 },
  label: {
    display: 'grid',
    gap: 6,
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  input: {
    padding: '0.75rem 0.9rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--text)',
    fontSize: 14,
    textTransform: 'none',
  },
  actions: { display: 'flex', gap: 10, marginTop: 8 },
  primary: {
    padding: '0.8rem 1.1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondary: {
    padding: '0.8rem 1.1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 700,
  },
};
