import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  deleteStoreNote,
  getStoreNoteByName,
  upsertStoreNote,
  type StoreNote,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

export default async function StoreNoteDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const storeName = decodeURIComponent(name ?? '');
  const db = getAdapter();
  let existing: StoreNote | null = null;
  try {
    existing = getStoreNoteByName(db, storeName);
  } catch {
    existing = null;
  }

  async function saveAction(formData: FormData) {
    'use server';
    const trimmed = storeName.trim();
    if (!trimmed) return;
    const returnsPolicy =
      String(formData.get('returnsPolicy') ?? '').trim() || null;
    const shippingNotes =
      String(formData.get('shippingNotes') ?? '').trim() || null;
    const rewardsNotes =
      String(formData.get('rewardsNotes') ?? '').trim() || null;
    try {
      upsertStoreNote(getAdapter(), {
        storeName: trimmed,
        returnsPolicy,
        shippingNotes,
        rewardsNotes,
      });
    } finally {
      revalidatePath(`/shop/stores/${name}`);
      revalidatePath('/shop/stores');
    }
    redirect('/shop/stores');
  }

  async function deleteAction() {
    'use server';
    const note = getStoreNoteByName(getAdapter(), storeName);
    if (!note) return;
    try {
      deleteStoreNote(getAdapter(), note.id);
    } finally {
      revalidatePath('/shop/stores');
    }
    redirect('/shop/stores');
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Store note</p>
        <h2 style={styles.title}>{storeName}</h2>
        <p style={styles.subtitle}>
          Stuff you want to remember next time you shop here.
        </p>
      </header>

      <form action={saveAction} style={styles.form}>
        <label style={styles.label}>
          Returns policy
          <textarea
            name="returnsPolicy"
            defaultValue={existing?.returnsPolicy ?? ''}
            placeholder="30 days with receipt, free in-store..."
            style={{ ...styles.input, minHeight: 80 }}
          />
        </label>
        <label style={styles.label}>
          Shipping notes
          <textarea
            name="shippingNotes"
            defaultValue={existing?.shippingNotes ?? ''}
            placeholder="Free over $50, ground takes 5 days..."
            style={{ ...styles.input, minHeight: 80 }}
          />
        </label>
        <label style={styles.label}>
          Rewards notes
          <textarea
            name="rewardsNotes"
            defaultValue={existing?.rewardsNotes ?? ''}
            placeholder="2x points on weekends, birthday $10..."
            style={{ ...styles.input, minHeight: 80 }}
          />
        </label>
        <div style={styles.actions}>
          <button type="submit" style={styles.primary}>
            {existing ? 'Save changes' : 'Create store note'}
          </button>
          <Link href="/shop/stores" style={styles.secondary}>Cancel</Link>
        </div>
      </form>

      {existing ? (
        <form action={deleteAction} style={styles.deleteRow}>
          <button type="submit" style={styles.danger}>Delete</button>
        </form>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 14 },
  header: {
    display: 'grid',
    gap: 6,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  eyebrow: {
    margin: 0,
    color: '#34D399',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: 22 },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 14 },
  form: { display: 'grid', gap: 10 },
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
  deleteRow: { display: 'flex', justifyContent: 'flex-end' },
  danger: {
    padding: '0.6rem 1rem',
    borderRadius: 12,
    border: '1px solid #EF4444',
    color: '#EF4444',
    background: 'transparent',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
