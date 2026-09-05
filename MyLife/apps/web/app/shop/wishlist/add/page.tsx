import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createWishlistItem,
  listGiftPeople,
  listSizes,
  type Category,
  type GiftPerson,
  type Priority,
  type Size,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const CATEGORIES: Category[] = [
  'tech', 'clothing', 'books', 'home', 'kitchen',
  'gaming', 'music', 'sports', 'gifts', 'hobby', 'other',
];
const PRIORITIES: Priority[] = ['need', 'want', 'someday', 'dream'];

function parseCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default async function AddWishlistItemPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const { listId } = await searchParams;
  const db = getAdapter();
  const storedSizes: Size[] = (() => {
    try {
      return listSizes(db);
    } catch {
      return [];
    }
  })();
  const giftPeople: GiftPerson[] = (() => {
    try {
      return listGiftPeople(db);
    } catch {
      return [];
    }
  })();
  if (!listId) {
    return (
      <div>
        <p style={styles.emptyBody}>Missing list id.</p>
        <Link href="/shop" style={styles.secondary}>Back</Link>
      </div>
    );
  }

  async function addItemAction(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;
    const category = String(formData.get('category') ?? 'other') as Category;
    const priority = String(formData.get('priority') ?? 'want') as Priority;
    if (!CATEGORIES.includes(category) || !PRIORITIES.includes(priority)) return;

    try {
      createWishlistItem(getAdapter(), {
        listId: listId!,
        name,
        category,
        priority,
        priceCents: parseCents(String(formData.get('priceCents') ?? '')),
        priceRangeLow: parseCents(String(formData.get('priceRangeLow') ?? '')),
        priceRangeHigh: parseCents(String(formData.get('priceRangeHigh') ?? '')),
        url: (String(formData.get('url') ?? '').trim() || null),
        store: (String(formData.get('store') ?? '').trim() || null),
        brand: (String(formData.get('brand') ?? '').trim() || null),
        notesMd: (String(formData.get('notesMd') ?? '').trim() || null),
        sizeNotes: (String(formData.get('sizeNotes') ?? '').trim() || null),
        occasionTag: (String(formData.get('occasionTag') ?? '').trim() || null),
        giftForPersonId: (String(formData.get('giftForPersonId') ?? '').trim() || null),
      });
    } finally {
      revalidatePath(`/shop/wishlist/${listId}`);
    }
    redirect(`/shop/wishlist/${listId}`);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>Add item</h2>
        <p style={styles.subtitle}>Give it a name and (optionally) a price or range.</p>
      </header>

      <form action={addItemAction} style={styles.form}>
        <label style={styles.label}>
          Name
          <input required name="name" placeholder="What do you want?" style={styles.input} />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Category
            <select name="category" style={styles.input} defaultValue="other">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Priority
            <select name="priority" style={styles.input} defaultValue="want">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={styles.label}>
          Price (USD)
          <input name="priceCents" type="number" step="0.01" placeholder="49.99" style={styles.input} />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Range low
            <input name="priceRangeLow" type="number" step="0.01" style={styles.input} />
          </label>
          <label style={styles.label}>
            Range high
            <input name="priceRangeHigh" type="number" step="0.01" style={styles.input} />
          </label>
        </div>

        <label style={styles.label}>
          URL
          <input name="url" type="url" placeholder="https://" style={styles.input} />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Store
            <input name="store" placeholder="Amazon" style={styles.input} />
          </label>
          <label style={styles.label}>
            Brand
            <input name="brand" placeholder="Apple" style={styles.input} />
          </label>
        </div>

        <label style={styles.label}>
          Notes
          <textarea name="notesMd" placeholder="Why you want it, reminders…" style={{ ...styles.input, minHeight: 80 }} />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Size notes
            <input name="sizeNotes" placeholder="M, 10.5, 30x32…" style={styles.input} />
          </label>
          <label style={styles.label}>
            Occasion tag
            <input name="occasionTag" placeholder="birthday, housewarming…" style={styles.input} />
          </label>
        </div>

        {giftPeople.length > 0 ? (
          <label style={styles.label}>
            Gift for (optional)
            <select name="giftForPersonId" defaultValue="" style={styles.input}>
              <option value="">No one in particular</option>
              {giftPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.relationship ? ` (${p.relationship})` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {storedSizes.length > 0 ? (
          <details style={styles.lookupPanel}>
            <summary style={styles.lookupSummary}>
              Size lookup ({storedSizes.length} stored)
            </summary>
            <ul style={styles.lookupList}>
              {storedSizes.slice(0, 40).map((s) => (
                <li key={s.id} style={styles.lookupItem}>
                  <span style={styles.lookupBrand}>
                    {s.brand} · {s.type}
                  </span>
                  <span style={styles.lookupValue}>{s.sizeValue}</span>
                  {s.fitNotes ? (
                    <span style={styles.lookupNotes}>{s.fitNotes}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <Link href="/shop/sizes" style={styles.lookupLink}>
              Manage stored sizes
            </Link>
          </details>
        ) : null}

        <div style={styles.actions}>
          <button type="submit" style={styles.primary}>Add to wishlist</button>
          <Link href={`/shop/wishlist/${listId}`} style={styles.secondary}>Cancel</Link>
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
  emptyBody: { color: 'var(--text-secondary)' },
  lookupPanel: {
    padding: 12,
    borderRadius: 12,
    background: 'rgba(16,185,129,0.06)',
    border: '1px solid rgba(16,185,129,0.2)',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  lookupSummary: {
    cursor: 'pointer',
    fontWeight: 700,
    color: '#34D399',
  },
  lookupList: {
    listStyle: 'none',
    padding: 0,
    margin: '10px 0 6px',
    display: 'grid',
    gap: 6,
  },
  lookupItem: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 6,
    padding: '6px 0',
    borderTop: '1px dashed rgba(255,255,255,0.08)',
    alignItems: 'baseline',
  },
  lookupBrand: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'capitalize' as const,
  },
  lookupValue: {
    color: '#34D399',
    fontWeight: 800,
    fontSize: 14,
  },
  lookupNotes: {
    gridColumn: '1 / -1',
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  lookupLink: {
    color: '#34D399',
    fontSize: 12,
    textDecoration: 'none',
  },
};
