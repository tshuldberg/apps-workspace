import Link from 'next/link';
import {
  calculateDueReviews,
  getExpiringReturns,
  listPurchases,
  type Purchase,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

type Filter = 'all' | 'impulse' | 'pending_return';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

function renderStars(rating: number | null): string {
  if (rating == null) return '';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default async function ShopPurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = rawFilter === 'impulse' || rawFilter === 'pending_return'
    ? rawFilter
    : 'all';

  const db = getAdapter();
  const all = listPurchases(db);
  const expiringIds = new Set(getExpiringReturns(all, 14).map((p) => p.id));
  const dueReviewIds = new Set(calculateDueReviews(all).map((d) => d.purchaseId));

  let items: Purchase[] = all;
  if (filter === 'impulse') items = all.filter((p) => p.isImpulse);
  if (filter === 'pending_return')
    items = all.filter((p) => !p.returned && p.returnDeadline);

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'impulse', label: 'Impulse' },
    { key: 'pending_return', label: 'Pending return' },
  ];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Purchases</p>
        <h2 style={styles.title}>
          {all.length === 0 ? 'Log your first purchase' : 'Purchase journal'}
        </h2>
        <p style={styles.subtitle}>
          Track what you bought, how you feel about it, and which returns are about to lapse.
        </p>
      </header>

      <div style={styles.actions}>
        <Link href="/shop/purchases/log" style={styles.primary}>
          + Log purchase
        </Link>
      </div>

      <nav style={styles.filterRow}>
        {filters.map((f) => {
          const active = filter === f.key;
          const href =
            f.key === 'all' ? '/shop/purchases' : `/shop/purchases?filter=${f.key}`;
          return (
            <Link
              key={f.key}
              href={href}
              style={{ ...styles.filterPill, ...(active ? styles.filterPillActive : {}) }}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <p style={styles.emptyBody}>
          {all.length === 0
            ? 'Log your first purchase to start building your private shopping memory.'
            : 'Nothing matches this filter.'}
        </p>
      ) : (
        <ul style={styles.itemList}>
          {items.map((p) => {
            const daysLeft = p.returnDeadline ? daysUntil(p.returnDeadline) : null;
            const expiring = expiringIds.has(p.id);
            const needsReview = dueReviewIds.has(p.id);
            return (
              <li key={p.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <Link href={`/shop/purchases/${p.id}`} style={styles.cardName}>
                    {p.name}
                  </Link>
                  <span style={styles.cardPrice}>{formatCents(p.priceCents)}</span>
                </div>
                <div style={styles.cardMeta}>
                  <span style={styles.metaCap}>{p.category}</span>
                  {p.store ? (
                    <>
                      <span>·</span>
                      <span>{p.store}</span>
                    </>
                  ) : null}
                  <span>·</span>
                  <span>{p.purchaseDate.slice(0, 10)}</span>
                </div>
                <div style={styles.badgeRow}>
                  {p.satisfactionInitial ? (
                    <span style={styles.stars}>{renderStars(p.satisfactionInitial)}</span>
                  ) : null}
                  {p.isImpulse ? <span style={styles.impulseBadge}>impulse</span> : null}
                  {p.returned ? <span style={styles.returnedBadge}>returned</span> : null}
                  {daysLeft != null && !p.returned ? (
                    <span
                      style={expiring ? styles.returnBadgeWarn : styles.returnBadge}
                    >
                      {daysLeft >= 0 ? `return in ${daysLeft}d` : 'return lapsed'}
                    </span>
                  ) : null}
                  {needsReview && !p.returned ? (
                    <span style={styles.reviewBadge}>review due</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 16 },
  header: { display: 'grid', gap: 6 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.75rem' },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  primary: {
    padding: '0.65rem 1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    textDecoration: 'none',
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
    textDecoration: 'none',
  },
  filterPillActive: {
    background: '#10B981',
    color: '#0E0E13',
    borderColor: '#10B981',
  },
  emptyBody: { color: 'var(--text-secondary)', fontSize: 14 },
  itemList: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 },
  card: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardName: { color: 'var(--text)', fontSize: 15, fontWeight: 700, textDecoration: 'none' },
  cardPrice: { color: '#34D399', fontSize: 15, fontWeight: 800 },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  metaCap: { textTransform: 'capitalize' as const },
  badgeRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const, marginTop: 2 },
  stars: { color: '#34D399', fontSize: 13, fontWeight: 700 },
  impulseBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(239,68,68,0.14)',
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  returnedBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-secondary)',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
  },
  returnBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(139,207,240,0.12)',
    color: '#8BCFF0',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
  },
  returnBadgeWarn: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(255,184,119,0.2)',
    color: '#FFB877',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
  },
  reviewBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(16,185,129,0.18)',
    color: '#34D399',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
  },
};
