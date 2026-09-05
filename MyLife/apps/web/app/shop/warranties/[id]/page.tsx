import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  deleteWarranty,
  fileClaim,
  getDaysUntilExpiry,
  getPurchaseById,
  getWarrantyById,
  getWarrantyStatus,
  type WarrantyStatus,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const STATUS_COLOR: Record<WarrantyStatus, string> = {
  active: '#34D399',
  'expiring-soon': '#FFB877',
  expired: 'rgba(255,255,255,0.5)',
  claimed: '#8BCFF0',
};

const STATUS_LABEL: Record<WarrantyStatus, string> = {
  active: 'Active',
  'expiring-soon': 'Expiring soon',
  expired: 'Expired',
  claimed: 'Claim filed',
};

function formatMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default async function WarrantyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getAdapter();
  const warranty = getWarrantyById(db, id);
  if (!warranty) notFound();

  const linkedPurchase = warranty.purchaseId
    ? getPurchaseById(db, warranty.purchaseId)
    : null;

  const status = getWarrantyStatus(warranty);
  const days = getDaysUntilExpiry(warranty.expiryDate);

  async function fileClaimAction(formData: FormData) {
    'use server';
    const claimDate = String(formData.get('claimDate') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const outcome = String(formData.get('outcome') ?? 'pending').trim();
    if (!description) return;

    const notes = [
      `Filed ${claimDate || new Date().toISOString().slice(0, 10)}`,
      `Outcome: ${outcome}`,
      '',
      description,
    ].join('\n');

    const adapter = getAdapter();
    try {
      fileClaim(adapter, id, { notes });
      revalidatePath(`/shop/warranties/${id}`);
      revalidatePath('/shop/warranties');
      redirect(`/shop/warranties/${id}`);
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      throw err;
    }
  }

  async function deleteAction() {
    'use server';
    const adapter = getAdapter();
    deleteWarranty(adapter, id);
    revalidatePath('/shop/warranties');
    redirect('/shop/warranties');
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>{warranty.coverageType}</p>
        <h2 style={styles.title}>{warranty.itemName}</h2>
        <div style={styles.badgeRow}>
          <span
            style={{
              ...styles.statusBadge,
              color: STATUS_COLOR[status],
              borderColor: STATUS_COLOR[status],
            }}
          >
            {STATUS_LABEL[status]}
          </span>
          {status !== 'claimed' && status !== 'expired' ? (
            <span style={styles.daysLabel}>
              {days >= 0
                ? `${days}d until expiry`
                : `expired ${Math.abs(days)}d ago`}
            </span>
          ) : null}
        </div>
      </header>

      {linkedPurchase ? (
        <Link
          href={`/shop/purchases/${linkedPurchase.id}`}
          style={styles.linkedCard}
        >
          <span style={styles.sectionTitle}>Linked purchase</span>
          <span style={styles.linkedName}>{linkedPurchase.name}</span>
          <span style={styles.linkedMeta}>
            {linkedPurchase.purchaseDate.slice(0, 10)}
            {linkedPurchase.store ? ` · ${linkedPurchase.store}` : ''}
            {` · ${formatCents(linkedPurchase.priceCents)}`}
          </span>
        </Link>
      ) : null}

      <section style={styles.detailCard}>
        <Row label="Start" value={formatMs(warranty.startDate)} />
        <Row label="Expiry" value={formatMs(warranty.expiryDate)} />
        <Row
          label="Reminder"
          value={`${warranty.reminderDaysBefore}d before expiry`}
        />
        <Row label="Serial" value={warranty.serialNumber} />
        <Row label="Registration" value={warranty.registrationNumber} />
      </section>

      {warranty.coverageDetailsMd ? (
        <section style={styles.detailCard}>
          <p style={styles.sectionTitle}>Coverage details</p>
          <p style={styles.paragraph}>{warranty.coverageDetailsMd}</p>
        </section>
      ) : null}

      {warranty.claimFiled ? (
        <section style={styles.claimCard}>
          <p style={styles.sectionTitle}>Claim history</p>
          <p style={styles.paragraph}>
            {warranty.claimNotes ?? 'Claim filed. No notes recorded.'}
          </p>
          <p style={styles.claimMeta}>
            Filed {formatMs(warranty.updatedAt)}
          </p>
        </section>
      ) : (
        <form action={fileClaimAction} style={styles.claimForm}>
          <p style={styles.sectionTitle}>File a claim</p>
          <div style={styles.rowTwo}>
            <label style={styles.label}>
              Claim date
              <input
                name="claimDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Outcome
              <select name="outcome" defaultValue="pending" style={styles.input}>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="denied">denied</option>
                <option value="repaired">repaired</option>
                <option value="replaced">replaced</option>
              </select>
            </label>
          </div>
          <label style={styles.label}>
            Description *
            <textarea
              required
              name="description"
              placeholder="Screen cracked after drop. Contacted support on..."
              style={{ ...styles.input, minHeight: 100 }}
            />
          </label>
          <button type="submit" style={styles.primary}>
            Submit claim
          </button>
        </form>
      )}

      <form action={deleteAction}>
        <button type="submit" style={styles.danger}>
          Delete warranty
        </button>
      </form>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 14 },
  header: { display: 'grid', gap: 6 },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.6rem' },
  badgeRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  daysLabel: { color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 },
  linkedCard: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text)',
    textDecoration: 'none',
  },
  linkedName: { color: 'var(--text)', fontSize: 15, fontWeight: 700 },
  linkedMeta: { color: 'var(--text-secondary)', fontSize: 12 },
  detailCard: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  claimCard: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(139,207,240,0.1)',
    border: '1px solid rgba(139,207,240,0.28)',
  },
  claimForm: {
    display: 'grid',
    gap: 10,
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
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  row: { display: 'flex', justifyContent: 'space-between' },
  rowLabel: { color: 'var(--text-secondary)', fontSize: 13 },
  rowValue: { color: 'var(--text)', fontSize: 13, fontWeight: 600 },
  paragraph: { margin: 0, color: 'var(--text)', fontSize: 14, lineHeight: 1.5 },
  claimMeta: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  rowTwo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  label: {
    display: 'grid',
    gap: 5,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
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
  primary: {
    padding: '0.7rem 1.1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
  },
  danger: {
    padding: '0.6rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(239,68,68,0.4)',
    background: 'transparent',
    color: '#FF6B6B',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
