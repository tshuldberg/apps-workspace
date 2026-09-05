import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  deleteWishlist,
  deleteWishlistItem,
  generateShareToken,
  getWishlistById,
  listItemsByWishlist,
  type Category,
  type WishlistItem,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const CATEGORIES: Array<'all' | Category> = [
  'all', 'tech', 'clothing', 'books', 'home', 'kitchen',
  'gaming', 'music', 'sports', 'gifts', 'hobby', 'other',
];

const PRIORITY_COLOR: Record<string, string> = {
  need: '#EF4444',
  want: '#FFB877',
  someday: '#8BCFF0',
  dream: '#A78BFA',
};

function formatCents(cents: number | null): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function priceLabel(item: WishlistItem): string {
  if (item.priceCents != null) return formatCents(item.priceCents);
  if (item.priceRangeLow != null && item.priceRangeHigh != null) {
    return `${formatCents(item.priceRangeLow)}–${formatCents(item.priceRangeHigh)}`;
  }
  return '';
}

export default async function WishlistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { listId } = await params;
  const { category: catParam } = await searchParams;
  const category =
    catParam && CATEGORIES.includes(catParam as Category) ? (catParam as Category) : undefined;

  const db = getAdapter();
  const list = getWishlistById(db, listId);

  if (!list) {
    return (
      <div style={styles.page}>
        <p style={styles.emptyBody}>List not found.</p>
        <Link href="/shop" style={styles.secondary}>Back to wishlists</Link>
      </div>
    );
  }

  const items = listItemsByWishlist(db, listId, category ? { category } : undefined);

  async function shareAction() {
    'use server';
    generateShareToken(getAdapter(), listId);
    revalidatePath(`/shop/wishlist/${listId}`);
  }

  async function deleteListAction() {
    'use server';
    deleteWishlist(getAdapter(), listId);
    revalidatePath('/shop');
    redirect('/shop');
  }

  async function deleteItemAction(formData: FormData) {
    'use server';
    const itemId = String(formData.get('itemId') ?? '');
    if (!itemId) return;
    deleteWishlistItem(getAdapter(), itemId);
    revalidatePath(`/shop/wishlist/${listId}`);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>{list.name}</h2>
        {list.description ? <p style={styles.subtitle}>{list.description}</p> : null}
        <div style={styles.meta}>
          {list.occasion ? <span style={styles.chip}>{list.occasion}</span> : null}
          {list.personId ? <span style={styles.chip}>for {list.personId}</span> : null}
          {list.shareToken ? (
            <span style={{ ...styles.chip, color: '#34D399', borderColor: 'rgba(16,185,129,0.35)' }}>shared</span>
          ) : null}
        </div>
      </header>

      <div style={styles.actions}>
        <Link
          href={{ pathname: '/shop/wishlist/add', query: { listId } }}
          style={styles.primary}
        >
          + Add item
        </Link>
        <form action={shareAction}>
          <button type="submit" style={styles.secondary}>
            {list.shareToken ? 'Re-roll share' : 'Share'}
          </button>
        </form>
        {list.shareToken ? (
          <Link href={`/shop/share/${list.shareToken}`} style={styles.secondary}>
            View public
          </Link>
        ) : null}
        <form action={deleteListAction}>
          <button type="submit" style={styles.danger}>Delete list</button>
        </form>
      </div>

      <nav style={styles.filterRow}>
        {CATEGORIES.map((c) => {
          const active = c === 'all' ? !category : category === c;
          const href = c === 'all' ? `/shop/wishlist/${listId}` : `/shop/wishlist/${listId}?category=${c}`;
          return (
            <Link
              key={c}
              href={href}
              style={{ ...styles.filterPill, ...(active ? styles.filterPillActive : {}) }}
            >
              {c}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <p style={styles.emptyBody}>No items yet. Add your first wish.</p>
      ) : (
        <ul style={styles.itemList}>
          {items.map((item) => (
            <li key={item.id} style={{ ...styles.itemCard, ...(item.isPurchased ? styles.itemPurchased : {}) }}>
              <div style={styles.itemHeader}>
                <span
                  aria-hidden
                  style={{ ...styles.priorityDot, background: PRIORITY_COLOR[item.priority] }}
                />
                <Link href={`/shop/wishlist/${listId}/item/${item.id}`} style={styles.itemName}>
                  {item.name}
                </Link>
                {item.isPurchased ? <span style={styles.doneBadge}>done</span> : null}
              </div>
              <div style={styles.itemMeta}>
                <span style={styles.itemCategory}>{item.category}</span>
                {priceLabel(item) ? (
                  <>
                    <span style={styles.metaDot}>·</span>
                    <span style={styles.itemPrice}>{priceLabel(item)}</span>
                  </>
                ) : null}
                {item.store ? (
                  <>
                    <span style={styles.metaDot}>·</span>
                    <span>{item.store}</span>
                  </>
                ) : null}
              </div>
              <div style={styles.itemActions}>
                {!item.isPurchased ? (
                  <Link
                    href={{ pathname: '/shop/purchases/log', query: { wishlistItemId: item.id } }}
                    style={styles.smallBtn}
                  >
                    Log purchase
                  </Link>
                ) : null}
                <form action={deleteItemAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <button type="submit" style={{ ...styles.smallBtn, ...styles.smallDanger }}>Remove</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 16 },
  header: { display: 'grid', gap: 6 },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.75rem' },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 },
  meta: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 6 },
  chip: {
    padding: '3px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  primary: {
    padding: '0.65rem 1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  secondary: {
    padding: '0.65rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 700,
    cursor: 'pointer',
  },
  danger: {
    padding: '0.65rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(239,68,68,0.4)',
    background: 'transparent',
    color: '#FF6B6B',
    fontWeight: 700,
    cursor: 'pointer',
  },
  filterRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  filterPill: {
    padding: '5px 12px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'capitalize',
    textDecoration: 'none',
  },
  filterPillActive: { background: '#10B981', color: '#0E0E13', borderColor: '#10B981' },
  emptyBody: { color: 'var(--text-secondary)', fontSize: 14 },
  itemList: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 },
  itemCard: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  itemPurchased: { opacity: 0.55 },
  itemHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  priorityDot: { display: 'inline-block', width: 10, height: 10, borderRadius: '50%' },
  itemName: { color: 'var(--text)', fontSize: 15, fontWeight: 700, textDecoration: 'none' },
  doneBadge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
  },
  itemMeta: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12 },
  itemCategory: { textTransform: 'capitalize' as const },
  itemPrice: { color: 'var(--text)', fontWeight: 700 },
  metaDot: {},
  itemActions: { display: 'flex', gap: 8, marginTop: 4 },
  smallBtn: {
    padding: '0.35rem 0.75rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: '#34D399',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  smallDanger: {
    borderColor: 'rgba(239,68,68,0.4)',
    color: '#FF6B6B',
  },
};
