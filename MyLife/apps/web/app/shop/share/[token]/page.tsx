import Link from 'next/link';
import {
  getWishlistByShareToken,
  listItemsByWishlist,
  type WishlistItem,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

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

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getAdapter();
  const list = getWishlistByShareToken(db, token);

  if (!list) {
    return (
      <div style={styles.page}>
        <h2 style={styles.title}>List not found</h2>
        <p style={styles.subtitle}>
          This shared wishlist is no longer available or the link is invalid.
        </p>
        <Link href="/" style={styles.secondary}>Home</Link>
      </div>
    );
  }

  const items = listItemsByWishlist(db, list.id);
  const openItems = items.filter((i) => !i.isPurchased);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.eyebrow}>Shared wishlist</span>
        <h1 style={styles.title}>{list.name}</h1>
        {list.description ? <p style={styles.subtitle}>{list.description}</p> : null}
        <div style={styles.meta}>
          {list.occasion ? <span style={styles.chip}>{list.occasion}</span> : null}
          <span style={styles.chip}>{openItems.length} open</span>
        </div>
      </header>

      {openItems.length === 0 ? (
        <p style={styles.emptyBody}>All items on this list have been taken care of.</p>
      ) : (
        <ul style={styles.itemList}>
          {openItems.map((item) => (
            <li key={item.id} style={styles.itemCard}>
              <div style={styles.itemHeader}>
                <span
                  aria-hidden
                  style={{ ...styles.priorityDot, background: PRIORITY_COLOR[item.priority] }}
                />
                <span style={styles.itemName}>{item.name}</span>
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
                {item.brand ? (
                  <>
                    <span style={styles.metaDot}>·</span>
                    <span>{item.brand}</span>
                  </>
                ) : null}
              </div>
              {item.sizeNotes ? (
                <p style={styles.itemNote}>Size: {item.sizeNotes}</p>
              ) : null}
              {item.notesMd ? <p style={styles.itemNote}>{item.notesMd}</p> : null}
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  View product
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <footer style={styles.footer}>
        <span style={styles.footerText}>Shared privately via MyLife</span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 18, maxWidth: 720, margin: '0 auto', padding: '24px 20px 120px' },
  header: { display: 'grid', gap: 6 },
  eyebrow: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.9rem' },
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
  itemHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  priorityDot: { display: 'inline-block', width: 10, height: 10, borderRadius: '50%' },
  itemName: { color: 'var(--text)', fontSize: 15, fontWeight: 700 },
  itemMeta: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12, flexWrap: 'wrap' as const },
  itemCategory: { textTransform: 'capitalize' as const },
  itemPrice: { color: 'var(--text)', fontWeight: 700 },
  metaDot: {},
  itemNote: { margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 },
  link: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: 4,
  },
  secondary: {
    padding: '0.65rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 700,
    display: 'inline-block',
    width: 'fit-content',
  },
  footer: { marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' },
  footerText: { color: 'var(--text-secondary)', fontSize: 12 },
};
