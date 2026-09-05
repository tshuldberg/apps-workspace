import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  deleteSize,
  getSizeById,
  updateSize,
  type SizeType,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const SIZE_TYPES: SizeType[] = ['clothing', 'shoe', 'ring', 'other'];

function formatMs(ms: number | null): string {
  if (ms == null) return 'never';
  return new Date(ms).toISOString().slice(0, 10);
}

export default async function EditSizePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getAdapter();
  const size = getSizeById(db, id);
  if (!size) notFound();

  async function saveAction(formData: FormData) {
    'use server';
    const raw = String(formData.get('type') ?? '');
    const type: SizeType = SIZE_TYPES.includes(raw as SizeType)
      ? (raw as SizeType)
      : size!.type;
    const brand = String(formData.get('brand') ?? '').trim();
    const sizeValue = String(formData.get('sizeValue') ?? '').trim();
    if (!brand || !sizeValue) return;
    const markVerified = String(formData.get('markVerified') ?? '') === 'on';

    const adapter = getAdapter();
    try {
      updateSize(adapter, id, {
        type,
        brand,
        sizeValue,
        fitNotes: String(formData.get('fitNotes') ?? '').trim() || null,
        ...(markVerified ? { lastVerified: Date.now() } : {}),
      });
      revalidatePath('/shop/sizes');
      redirect('/shop/sizes');
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      throw err;
    }
  }

  async function deleteAction() {
    'use server';
    const adapter = getAdapter();
    deleteSize(adapter, id);
    revalidatePath('/shop/sizes');
    redirect('/shop/sizes');
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>
          {size.brand} · {size.sizeValue}
        </h2>
        <p style={styles.subtitle}>
          Last verified {formatMs(size.lastVerified)}. Update fields to reflect
          a new fit.
        </p>
      </header>

      <form action={saveAction} style={styles.form}>
        <label style={styles.label}>
          Type *
          <select required name="type" defaultValue={size.type} style={styles.input}>
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
            <input
              required
              name="brand"
              defaultValue={size.brand}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Size value *
            <input
              required
              name="sizeValue"
              defaultValue={size.sizeValue}
              style={styles.input}
            />
          </label>
        </div>

        <label style={styles.label}>
          Fit notes
          <textarea
            name="fitNotes"
            defaultValue={size.fitNotes ?? ''}
            style={{ ...styles.input, minHeight: 90 }}
          />
        </label>

        <label style={styles.checkboxRow}>
          <input type="checkbox" name="markVerified" />
          <span>Mark as verified today</span>
        </label>

        <div style={styles.buttonRow}>
          <button type="submit" style={styles.primary}>
            Save changes
          </button>
          <Link href="/shop/sizes" style={styles.secondary}>
            Cancel
          </Link>
        </div>
      </form>

      <form action={deleteAction}>
        <button type="submit" style={styles.danger}>
          Delete size
        </button>
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
  danger: {
    padding: '0.65rem 1rem',
    borderRadius: 12,
    background: 'transparent',
    color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.3)',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
