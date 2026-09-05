import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  calculateCostPerUse,
  calculateDueReviews,
  deletePurchase,
  getPhotoById,
  getPurchaseById,
  getUsageCount,
  getWorthItStatus,
  logUse,
  markReturned,
  updateSatisfaction,
  type SatisfactionPeriod,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function StarsDisplay({ rating }: { rating: number | null }) {
  if (rating == null) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  return (
    <span style={{ color: '#34D399', fontWeight: 700 }}>
      {'★'.repeat(rating)}
      <span style={{ color: 'rgba(255,255,255,0.2)' }}>{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getAdapter();
  const purchase = getPurchaseById(db, id);

  if (!purchase) {
    return (
      <div style={styles.page}>
        <p style={styles.emptyBody}>Purchase not found.</p>
        <Link href="/shop/purchases" style={styles.secondary}>
          Back to purchases
        </Link>
      </div>
    );
  }

  const dueReviews = calculateDueReviews([purchase]).map((d) => d.period);
  const receiptUri = purchase.receiptPhotoId
    ? getPhotoById(db, purchase.receiptPhotoId)?.localUri ?? null
    : null;
  const productUri = purchase.photoId
    ? getPhotoById(db, purchase.photoId)?.localUri ?? null
    : null;

  const usageCount = getUsageCount(db, id);
  const costPerUseCents = calculateCostPerUse(purchase.priceCents, usageCount);
  const worthItStatus = getWorthItStatus(costPerUseCents);
  const initialCpuCents = calculateCostPerUse(purchase.priceCents, 1);

  async function rateAction(formData: FormData) {
    'use server';
    const period = String(formData.get('period') ?? '') as SatisfactionPeriod;
    const rating = Number(formData.get('rating'));
    if (!['initial', '30day', '90day'].includes(period)) return;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    updateSatisfaction(getAdapter(), id, period, rating);
    revalidatePath(`/shop/purchases/${id}`);
  }

  async function returnAction(formData: FormData) {
    'use server';
    const reason = String(formData.get('reason') ?? '').trim();
    markReturned(getAdapter(), id, {
      returnReason: reason || null,
      returnedAt: new Date().toISOString(),
    });
    revalidatePath(`/shop/purchases/${id}`);
  }

  async function deleteAction() {
    'use server';
    deletePurchase(getAdapter(), id);
    revalidatePath('/shop/purchases');
    redirect('/shop/purchases');
  }

  async function logUseAction() {
    'use server';
    logUse(getAdapter(), { purchaseId: id });
    revalidatePath(`/shop/purchases/${id}`);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>{purchase.category}</p>
        <h2 style={styles.title}>{purchase.name}</h2>
        <p style={styles.price}>{formatCents(purchase.priceCents)}</p>
        <div style={styles.badgeRow}>
          {purchase.isImpulse ? <span style={styles.impulseBadge}>impulse</span> : null}
          {purchase.returned ? <span style={styles.returnedBadge}>returned</span> : null}
        </div>
      </header>

      {dueReviews.length > 0 && !purchase.returned ? (
        <section style={styles.reviewPrompt}>
          <h3 style={styles.reviewPromptTitle}>How do you feel about this now?</h3>
          <p style={styles.reviewPromptBody}>
            {dueReviews.includes('30day')
              ? 'It has been at least 30 days. Rate your current satisfaction.'
              : 'It has been at least 90 days. How is this holding up?'}
          </p>
          <form action={rateAction} style={styles.ratingForm}>
            <input
              type="hidden"
              name="period"
              value={dueReviews.includes('30day') ? '30day' : '90day'}
            />
            <div style={styles.ratingPillRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="submit" name="rating" value={n} style={styles.ratePill}>
                  {n} {'★'.repeat(n)}
                </button>
              ))}
            </div>
          </form>
        </section>
      ) : null}

      <section style={styles.card}>
        <DetailRow label="Date" value={purchase.purchaseDate.slice(0, 10)} />
        <DetailRow label="Store" value={purchase.store} />
        <DetailRow label="Brand" value={purchase.brand} />
        <DetailRow
          label="Payment"
          value={purchase.paymentMethod?.replace('_', ' ') ?? null}
        />
        <DetailRow
          label="Return deadline"
          value={purchase.returnDeadline?.slice(0, 10) ?? null}
        />
      </section>

      <section style={styles.card}>
        <div style={styles.cpuHeaderRow}>
          <p style={styles.sectionTitle}>Cost-per-use</p>
          {usageCount > 0 && worthItStatus === 'worth-it' ? (
            <span style={styles.worthItBadge}>worth it</span>
          ) : null}
          {usageCount > 0 && worthItStatus === 'approaching' ? (
            <span style={styles.approachingBadge}>approaching</span>
          ) : null}
        </div>
        <p style={styles.cpuPrimary}>
          {usageCount > 0
            ? `${formatCents(Math.round(costPerUseCents))} per use`
            : 'No uses logged yet'}
        </p>
        <p style={styles.cpuMeta}>
          Used {usageCount} time{usageCount === 1 ? '' : 's'}
        </p>
        {usageCount > 1 ? (
          <p style={styles.cpuTrend}>
            Cost-per-use: {formatCents(Math.round(initialCpuCents))} →{' '}
            {formatCents(Math.round(costPerUseCents))} after {usageCount} uses
          </p>
        ) : null}
        <form action={logUseAction}>
          <button type="submit" style={styles.primary}>
            Log a use
          </button>
        </form>
      </section>

      {receiptUri ? (
        <section style={styles.card}>
          <p style={styles.sectionTitle}>Receipt</p>
          <img src={receiptUri} alt="Receipt" style={styles.photo} />
        </section>
      ) : null}

      {productUri ? (
        <section style={styles.card}>
          <p style={styles.sectionTitle}>Product photo</p>
          <img src={productUri} alt="Product" style={styles.photo} />
        </section>
      ) : null}

      <section style={styles.card}>
        <p style={styles.sectionTitle}>Satisfaction</p>
        {(['initial', '30day', '90day'] as SatisfactionPeriod[]).map((period) => {
          const rating =
            period === 'initial'
              ? purchase.satisfactionInitial
              : period === '30day'
                ? purchase.satisfaction30day
                : purchase.satisfaction90day;
          return (
            <div key={period} style={styles.satRow}>
              <span style={styles.satLabel}>
                {period === 'initial' ? 'Initial' : period === '30day' ? '30-day' : '90-day'}
              </span>
              <StarsDisplay rating={rating} />
              <form action={rateAction} style={styles.inlineForm}>
                <input type="hidden" name="period" value={period} />
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="submit" name="rating" value={n} style={styles.starBtn}>
                    {n}
                  </button>
                ))}
              </form>
            </div>
          );
        })}
      </section>

      {purchase.researchNotesMd ? (
        <section style={styles.card}>
          <p style={styles.sectionTitle}>Research notes</p>
          <p style={styles.paragraph}>{purchase.researchNotesMd}</p>
        </section>
      ) : null}

      {purchase.notesMd ? (
        <section style={styles.card}>
          <p style={styles.sectionTitle}>Notes</p>
          <p style={styles.paragraph}>{purchase.notesMd}</p>
        </section>
      ) : null}

      {purchase.returned ? (
        <section style={styles.card}>
          <p style={styles.sectionTitle}>Return reason</p>
          <p style={styles.paragraph}>{purchase.returnReason || '—'}</p>
        </section>
      ) : (
        <section style={styles.card}>
          <p style={styles.sectionTitle}>Mark as returned</p>
          <form action={returnAction} style={styles.inlineForm}>
            <input
              name="reason"
              placeholder="Why are you returning?"
              style={styles.input}
            />
            <button type="submit" style={styles.secondary}>Mark returned</button>
          </form>
        </section>
      )}

      <div style={styles.actions}>
        <Link href={`/shop/purchases/${purchase.id}/edit`} style={styles.secondary}>
          Edit
        </Link>
        {purchase.url ? (
          <a href={purchase.url} target="_blank" rel="noopener noreferrer" style={styles.secondary}>
            Open link
          </a>
        ) : null}
        <form action={deleteAction}>
          <button type="submit" style={styles.danger}>Delete purchase</button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 14 },
  header: { display: 'grid', gap: 4 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.75rem' },
  price: { margin: 0, color: '#34D399', fontSize: '1.25rem', fontWeight: 800 },
  badgeRow: { display: 'flex', gap: 8, marginTop: 4 },
  impulseBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(239,68,68,0.14)',
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
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
  reviewPrompt: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
  },
  reviewPromptTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 17,
    fontWeight: 800,
  },
  reviewPromptBody: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  ratingForm: { display: 'grid' },
  ratingPillRow: { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  ratePill: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  card: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  row: { display: 'flex', justifyContent: 'space-between' },
  rowLabel: { color: 'var(--text-secondary)', fontSize: 13 },
  rowValue: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'capitalize' as const,
  },
  paragraph: { margin: 0, color: 'var(--text)', fontSize: 14, lineHeight: 1.6 },
  photo: { width: '100%', borderRadius: 10, maxHeight: 520, objectFit: 'contain' as const },
  satRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  satLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    minWidth: 60,
  },
  inlineForm: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const },
  starBtn: {
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
  },
  input: {
    flex: 1,
    padding: '0.55rem 0.75rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--text)',
    fontSize: 13,
  },
  cpuHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cpuPrimary: {
    margin: 0,
    color: '#34D399',
    fontSize: 20,
    fontWeight: 800,
  },
  cpuMeta: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  cpuTrend: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.5,
  },
  worthItBadge: {
    padding: '2px 10px',
    borderRadius: 999,
    background: 'rgba(16,185,129,0.18)',
    color: '#34D399',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  approachingBadge: {
    padding: '2px 10px',
    borderRadius: 999,
    background: 'rgba(255,184,119,0.16)',
    color: '#FFB877',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  primary: {
    padding: '0.55rem 0.9rem',
    borderRadius: 10,
    border: '1px solid #34D399',
    background: '#34D399',
    color: '#0E0E13',
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 13,
  },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  secondary: {
    padding: '0.55rem 0.9rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
  },
  danger: {
    padding: '0.55rem 0.9rem',
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.4)',
    background: 'transparent',
    color: '#FF6B6B',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
  },
  emptyBody: { color: 'var(--text-secondary)', fontSize: 14 },
};
