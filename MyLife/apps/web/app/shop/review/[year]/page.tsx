import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  generateReview,
  listGifts,
  listItemsByWishlist,
  listPurchases,
  listWarranties,
  listWishlists,
  type WishlistItem,
  type YearReview,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default async function YearReviewPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yearNum = Number(year);
  if (!Number.isFinite(yearNum)) notFound();

  const db = getAdapter();
  let review: YearReview | null = null;
  try {
    const purchases = listPurchases(db);
    const gifts = listGifts(db);
    const warranties = listWarranties(db);
    const wishlists = listWishlists(db);
    const wishlistItems: WishlistItem[] = wishlists.flatMap((w) =>
      listItemsByWishlist(db, w.id),
    );
    review = generateReview({
      year: yearNum,
      purchases,
      gifts,
      warranties,
      wishlistItems,
    });
  } catch {
    review = null;
  }

  if (!review) notFound();
  const safeReview: YearReview = review;

  const maxMonth = Math.max(
    ...safeReview.monthlyTrend.map((m) => m.totalCents),
    1,
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>{safeReview.year}</p>
        <h2 style={styles.title}>Year in review</h2>
      </header>

      <section style={styles.heroRow}>
        <div style={styles.heroCard}>
          <p style={styles.heroLabel}>Total spent</p>
          <p style={styles.heroValue}>{formatCents(safeReview.totalCents)}</p>
        </div>
        <div style={styles.heroCard}>
          <p style={styles.heroLabel}>Items</p>
          <p style={styles.heroValue}>{safeReview.itemCount}</p>
        </div>
        <div style={styles.heroCard}>
          <p style={styles.heroLabel}>Avg / item</p>
          <p style={styles.heroValue}>{formatCents(safeReview.avgCents)}</p>
        </div>
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Monthly trend</h3>
        <div style={styles.barRow}>
          {safeReview.monthlyTrend.map((m) => {
            const h = Math.max(2, Math.round((m.totalCents / maxMonth) * 80));
            return (
              <div key={m.month} style={styles.barCol}>
                <div style={{ ...styles.bar, height: h }} />
                <span style={styles.barLabel}>
                  {MONTH_LABELS[m.month - 1] ?? m.month}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Categories</h3>
        {safeReview.categoryBreakdown.length === 0 ? (
          <p style={styles.body}>Nothing logged this year.</p>
        ) : (
          safeReview.categoryBreakdown.map((c) => (
            <div key={c.category} style={styles.catRow}>
              <span style={styles.catName}>{c.category}</span>
              <span style={styles.catMeta}>
                {formatCents(c.totalCents)} · {c.percentage.toFixed(0)}%
              </span>
            </div>
          ))
        )}
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Best purchases</h3>
        {safeReview.bestPurchases.length === 0 ? (
          <p style={styles.body}>No standout favorites yet.</p>
        ) : (
          safeReview.bestPurchases.map((p) => (
            <div key={p.id} style={styles.catRow}>
              <span style={styles.catName}>{p.name}</span>
              <span style={styles.catMeta}>{formatCents(p.priceCents)}</span>
            </div>
          ))
        )}
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Worst purchases</h3>
        {safeReview.worstPurchases.length === 0 ? (
          <p style={styles.body}>Nothing flagged as a regret.</p>
        ) : (
          safeReview.worstPurchases.map((p) => (
            <div key={p.id} style={styles.catRow}>
              <span style={styles.catName}>{p.name}</span>
              <span style={styles.catMeta}>{formatCents(p.priceCents)}</span>
            </div>
          ))
        )}
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Gifts</h3>
        <p style={styles.body}>
          {safeReview.giftSummary.peopleCount} people ·{' '}
          {formatCents(safeReview.giftSummary.totalSpentCents)} spent
        </p>
        {safeReview.giftSummary.mostGenerousOccasion ? (
          <p style={styles.body}>
            Most generous occasion: {safeReview.giftSummary.mostGenerousOccasion}
          </p>
        ) : null}
        {safeReview.giftSummary.occasionBreakdown.map((o) => (
          <div key={o.occasion} style={styles.catRow}>
            <span style={styles.catName}>{o.occasion}</span>
            <span style={styles.catMeta}>
              {o.count} · {formatCents(o.totalCents)}
            </span>
          </div>
        ))}
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Warranty wins</h3>
        <p style={styles.body}>
          {safeReview.warrantyUtilization.claimsFiledCount} claim
          {safeReview.warrantyUtilization.claimsFiledCount === 1 ? '' : 's'} filed,
          {' '}
          {formatCents(safeReview.warrantyUtilization.savedCents)} saved
        </p>
        <p style={styles.body}>
          {safeReview.warrantyUtilization.expiredUnusedCount} expired without use
        </p>
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Wishlist conversion</h3>
        <p style={styles.body}>
          {safeReview.wishlistConversion.purchasedCount} of{' '}
          {safeReview.wishlistConversion.wishlistedCount} wishlisted items bought (
          {safeReview.wishlistConversion.conversionPercentage.toFixed(0)}%)
        </p>
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Impulse audit</h3>
        <p style={styles.body}>
          {safeReview.impulseAudit.impulseCount} impulse buys ·{' '}
          {(safeReview.impulseAudit.impulseRegretRate * 100).toFixed(0)}% regretted
        </p>
        <p style={styles.body}>
          {formatCents(safeReview.impulseAudit.regrettedSpendCents)} regretted spend
        </p>
      </section>

      <div>
        <Link href="/shop/review" style={styles.secondary}>Back</Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'grid',
    gap: 4,
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
  title: { margin: 0, color: 'var(--text)', fontSize: 24 },
  heroRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  heroCard: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  heroLabel: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  heroValue: { margin: 0, color: 'var(--text)', fontSize: 18, fontWeight: 800 },
  card: {
    display: 'grid',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardTitle: { margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  body: { margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 },
  barRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    gap: 4,
  },
  barCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  bar: {
    width: '85%',
    background: '#10B981',
    borderRadius: 3,
    minHeight: 2,
  },
  barLabel: { color: 'var(--text-secondary)', fontSize: 9, fontWeight: 700 },
  catRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  catName: { color: 'var(--text)', fontSize: 13, fontWeight: 700 },
  catMeta: { color: 'var(--text-secondary)', fontSize: 12 },
  secondary: {
    padding: '0.6rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 700,
  },
};
