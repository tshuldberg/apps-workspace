import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createWishlist,
  listWishlists,
  listItemsByWishlist,
  type Occasion,
  type Wishlist,
  type WishlistItem,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';
import { ShopPanel, styles as uiStyles } from './_ui';

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

function itemEstimate(item: WishlistItem): number {
  if (item.priceCents != null) return item.priceCents;
  if (item.priceRangeLow != null && item.priceRangeHigh != null) {
    return Math.round((item.priceRangeLow + item.priceRangeHigh) / 2);
  }
  return item.priceRangeLow ?? item.priceRangeHigh ?? 0;
}

function formatCents(cents: number): string {
  if (!cents) return '—';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

async function createListAction(formData: FormData) {
  'use server';
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const occasion = String(formData.get('occasion') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  let created: Wishlist;
  try {
    created = createWishlist(getAdapter(), {
      name,
      description: description || null,
      occasion: (occasion || null) as Occasion | null,
    });
  } finally {
    revalidatePath('/shop');
  }
  redirect(`/shop/wishlist/${created.id}`);
}

export default async function ShopWishlistsPage() {
  const db = getAdapter();
  let lists: Wishlist[] = [];
  try {
    lists = listWishlists(db);
  } catch {
    lists = [];
  }

  const rows = lists.map((list) => {
    const items = listItemsByWishlist(db, list.id);
    const open = items.filter((i) => !i.isPurchased);
    const estimated = open.reduce((sum, i) => sum + itemEstimate(i), 0);
    return { list, openCount: open.length, estimatedCents: estimated };
  });

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <ShopPanel
        eyebrow="Wishlist"
        title="Your wishlists"
        body="Private wishlists for gifts, birthdays, housewarming, and every store. Local only."
      >
        <Link href="/shop/wishlist/create" style={uiStyles.primaryLink}>
          + New wishlist
        </Link>
      </ShopPanel>

      {rows.length === 0 ? (
        <section style={styles.emptyState}>
          <h3 style={styles.emptyTitle}>No wishlists yet</h3>
          <p style={styles.emptyBody}>Create your first wishlist to start saving things.</p>
        </section>
      ) : (
        <section style={styles.grid}>
          {rows.map(({ list, openCount, estimatedCents }) => (
            <Link key={list.id} href={`/shop/wishlist/${list.id}`} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>{list.name}</span>
                {list.occasion ? (
                  <span style={styles.occasionBadge}>{list.occasion}</span>
                ) : null}
              </div>
              {list.description ? (
                <p style={styles.cardDescription}>{list.description}</p>
              ) : null}
              <div style={styles.cardMeta}>
                <span style={styles.metaPrimary}>{openCount} open</span>
                <span style={styles.metaDot}>·</span>
                <span style={styles.metaSecondary}>{formatCents(estimatedCents)} est.</span>
                {list.isShareable ? (
                  <>
                    <span style={styles.metaDot}>·</span>
                    <span style={styles.shareBadge}>shared</span>
                  </>
                ) : null}
              </div>
            </Link>
          ))}
        </section>
      )}

      <details style={styles.quickAdd}>
        <summary style={styles.quickAddSummary}>Quick create list</summary>
        <form action={createListAction} style={styles.form}>
          <input
            required
            name="name"
            placeholder="Wishlist name"
            style={styles.input}
          />
          <input name="description" placeholder="Description (optional)" style={styles.input} />
          <select name="occasion" style={styles.input} defaultValue="">
            {OCCASIONS.map((o) => (
              <option key={o || 'none'} value={o}>
                {o || 'No occasion'}
              </option>
            ))}
          </select>
          <button type="submit" style={styles.submitBtn}>Create</button>
        </form>
      </details>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 14,
  },
  card: {
    display: 'grid',
    gap: 8,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    textDecoration: 'none',
    backdropFilter: 'blur(12px)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitle: { color: 'var(--text)', fontSize: 17, fontWeight: 700 },
  occasionBadge: {
    padding: '3px 10px',
    borderRadius: 999,
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid rgba(16,185,129,0.35)',
    color: '#34D399',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  cardDescription: { color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, margin: 0 },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
  metaPrimary: { color: 'var(--text)', fontWeight: 700 },
  metaSecondary: { color: 'var(--text-secondary)' },
  metaDot: { color: 'var(--text-secondary)' },
  shareBadge: { color: '#34D399', fontWeight: 700, fontSize: 12 },
  emptyState: {
    padding: 22,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  emptyTitle: { margin: 0, fontSize: 17, color: 'var(--text)' },
  emptyBody: { margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 },
  quickAdd: {
    padding: 16,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  quickAddSummary: {
    cursor: 'pointer',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: 14,
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    marginTop: 12,
  },
  input: {
    padding: '0.65rem 0.85rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--text)',
    fontSize: 14,
  },
  submitBtn: {
    padding: '0.75rem 1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
