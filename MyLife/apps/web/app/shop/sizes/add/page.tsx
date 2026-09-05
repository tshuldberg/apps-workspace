import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSize, type SizeType } from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const SIZE_TYPES: SizeType[] = ['clothing', 'shoe', 'ring', 'other'];

export default async function AddSizePage() {
  async function addAction(formData: FormData) {
    'use server';
    const raw = String(formData.get('type') ?? '');
    const type: SizeType = SIZE_TYPES.includes(raw as SizeType)
      ? (raw as SizeType)
      : 'clothing';
    const brand = String(formData.get('brand') ?? '').trim();
    const sizeValue = String(formData.get('sizeValue') ?? '').trim();
    if (!brand || !sizeValue) return;
    const verifyToday = String(formData.get('verifyToday') ?? '') === 'on';

    const adapter = getAdapter();
    try {
      createSize(adapter, {
        type,
        brand,
        sizeValue,
        fitNotes: String(formData.get('fitNotes') ?? '').trim() || null,
        lastVerified: verifyToday ? Date.now() : null,
      });
      revalidatePath('/shop/sizes');
      redirect('/shop/sizes');
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      throw err;
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>Add a size</h2>
        <p style={styles.subtitle}>
          Store a size per brand with optional fit notes. MyShop surfaces
          matching entries when you save wishlist items.
        </p>
      </header>

      <form action={addAction} style={styles.form}>
        <label style={styles.label}>
          Type *
          <select required name="type" defaultValue="clothing" style={styles.input}>
            {SIZE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Brand *
            <input required name="brand" placeholder="Nike" style={styles.input} />
          </label>
          <label style={styles.label}>
            Size value *
            <input
              required
              name="sizeValue"
              placeholder="M, 10.5, 7..."
              style={styles.input}
            />
          </label>
        </div>

        <label style={styles.label}>
          Fit notes
          <textarea
            name="fitNotes"
            placeholder="runs small, long sleeves..."
            style={{ ...styles.input, minHeight: 90 }}
          />
        </label>

        <label style={styles.checkboxRow}>
          <input type="checkbox" name="verifyToday" />
          <span>Mark as verified today</span>
        </label>

        <div style={styles.buttonRow}>
          <button type="submit" style={styles.primary}>
            Save size
          </button>
          <Link href="/shop/sizes" style={styles.secondary}>
            Cancel
          </Link>
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
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  buttonRow: { display: 'flex', gap: 10, marginTop: 8 },
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
