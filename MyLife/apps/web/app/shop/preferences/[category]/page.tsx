import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createPreference,
  deletePreference,
  listPreferencesByCategory,
  updatePreference,
  PreferenceCategorySchema,
  type PreferenceCategory,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const CATEGORY_LABELS: Record<PreferenceCategory, string> = {
  tech: 'Tech',
  household: 'Household',
  color: 'Color',
  brand: 'Brand',
  material: 'Material',
  allergy: 'Allergy',
};

export default async function PreferenceCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: raw } = await params;
  const parse = PreferenceCategorySchema.safeParse(raw);
  if (!parse.success) notFound();
  const category = parse.data;

  const db = getAdapter();
  const list = listPreferencesByCategory(db, category);

  async function addAction(formData: FormData) {
    'use server';
    const key = String(formData.get('key') ?? '').trim();
    const value = String(formData.get('value') ?? '').trim();
    if (!key || !value) return;
    const notes = String(formData.get('notes') ?? '').trim() || null;

    const adapter = getAdapter();
    try {
      createPreference(adapter, { category, key, value, notes });
      revalidatePath(`/shop/preferences/${category}`);
      redirect(`/shop/preferences/${category}`);
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      throw err;
    }
  }

  async function updateAction(formData: FormData) {
    'use server';
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const value = String(formData.get('value') ?? '').trim();
    if (!value) return;
    const notes = String(formData.get('notes') ?? '').trim() || null;

    const adapter = getAdapter();
    updatePreference(adapter, id, { value, notes });
    revalidatePath(`/shop/preferences/${category}`);
    redirect(`/shop/preferences/${category}`);
  }

  async function deleteAction(formData: FormData) {
    'use server';
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const adapter = getAdapter();
    deletePreference(adapter, id);
    revalidatePath(`/shop/preferences/${category}`);
    redirect(`/shop/preferences/${category}`);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>{CATEGORY_LABELS[category]}</p>
        <h2 style={styles.title}>
          {list.length === 0
            ? `Add your first ${CATEGORY_LABELS[category].toLowerCase()} preference`
            : `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`}
        </h2>
        <Link href="/shop/preferences" style={styles.backLink}>
          Back to all categories
        </Link>
      </header>

      {list.length === 0 ? (
        <p style={styles.emptyBody}>
          Store key + value pairs with optional notes. Keys must be unique per
          category.
        </p>
      ) : (
        <ul style={styles.list}>
          {list.map((p) => (
            <li key={p.id} style={styles.card}>
              <div style={styles.cardKey}>{p.key}</div>
              <form action={updateAction} style={styles.form}>
                <input type="hidden" name="id" value={p.id} />
                <label style={styles.label}>
                  Value
                  <input
                    name="value"
                    defaultValue={p.value}
                    required
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  Notes
                  <input
                    name="notes"
                    defaultValue={p.notes ?? ''}
                    style={styles.input}
                  />
                </label>
                <div style={styles.rowActions}>
                  <button type="submit" style={styles.primarySmall}>
                    Save
                  </button>
                </div>
              </form>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" style={styles.danger}>
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <section style={styles.addPanel}>
        <h3 style={styles.addTitle}>
          New {CATEGORY_LABELS[category].toLowerCase()} preference
        </h3>
        <form action={addAction} style={styles.form}>
          <div style={styles.rowTwo}>
            <label style={styles.label}>
              Key *
              <input required name="key" placeholder="Key" style={styles.input} />
            </label>
            <label style={styles.label}>
              Value *
              <input
                required
                name="value"
                placeholder="Value"
                style={styles.input}
              />
            </label>
          </div>
          <label style={styles.label}>
            Notes
            <input name="notes" placeholder="Optional" style={styles.input} />
          </label>
          <div style={styles.buttonRow}>
            <button type="submit" style={styles.primary}>
              Add preference
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 14 },
  header: { display: 'grid', gap: 6 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.5rem' },
  backLink: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    textDecoration: 'none',
  },
  emptyBody: { color: 'var(--text-secondary)', fontSize: 14 },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gap: 10,
  },
  card: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  cardKey: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  form: { display: 'grid', gap: 8 },
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
    padding: '0.6rem 0.8rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--text)',
    fontSize: 14,
    textTransform: 'none',
  },
  rowActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  buttonRow: { display: 'flex', gap: 10, marginTop: 4 },
  primary: {
    padding: '0.7rem 1.1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
  },
  primarySmall: {
    padding: '0.45rem 0.9rem',
    borderRadius: 10,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 13,
  },
  danger: {
    padding: '0.45rem 0.9rem',
    borderRadius: 10,
    background: 'transparent',
    color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.3)',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 12,
  },
  addPanel: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    background: 'rgba(16,185,129,0.06)',
    border: '1px solid rgba(16,185,129,0.2)',
  },
  addTitle: { margin: 0, color: 'var(--text)', fontSize: '1.1rem' },
};
