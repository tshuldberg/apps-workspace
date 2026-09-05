import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createWarranty,
  getPurchaseById,
  listPurchases,
  type CoverageType,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const COVERAGE_TYPES: CoverageType[] = [
  'manufacturer',
  'extended',
  'protection',
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoToMs(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export default async function AddWarrantyPage({
  searchParams,
}: {
  searchParams: Promise<{ purchaseId?: string }>;
}) {
  const { purchaseId } = await searchParams;

  const db = getAdapter();
  const purchases = listPurchases(db);
  const linkedPurchase = purchaseId ? getPurchaseById(db, purchaseId) : null;

  async function addAction(formData: FormData) {
    'use server';
    const itemName = String(formData.get('itemName') ?? '').trim();
    const coverageTypeRaw = String(formData.get('coverageType') ?? '');
    const coverageType: CoverageType = COVERAGE_TYPES.includes(
      coverageTypeRaw as CoverageType,
    )
      ? (coverageTypeRaw as CoverageType)
      : 'manufacturer';

    const startMs = isoToMs(String(formData.get('startDate') ?? ''));
    const expiryMs = isoToMs(String(formData.get('expiryDate') ?? ''));
    if (!itemName || startMs == null || expiryMs == null) return;
    if (expiryMs < startMs) return;

    const reminderRaw = String(formData.get('reminderDaysBefore') ?? '30');
    const reminder = Number.isFinite(Number(reminderRaw))
      ? Math.max(0, Math.floor(Number(reminderRaw)))
      : 30;

    const rawPurchaseId = String(formData.get('purchaseId') ?? '').trim();

    const adapter = getAdapter();
    try {
      const w = createWarranty(adapter, {
        purchaseId: rawPurchaseId || null,
        itemName,
        coverageType,
        startDate: startMs,
        expiryDate: expiryMs,
        coverageDetailsMd:
          String(formData.get('coverageDetailsMd') ?? '').trim() || null,
        serialNumber:
          String(formData.get('serialNumber') ?? '').trim() || null,
        registrationNumber:
          String(formData.get('registrationNumber') ?? '').trim() || null,
        reminderDaysBefore: reminder,
      });
      revalidatePath('/shop/warranties');
      redirect(`/shop/warranties/${w.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      throw err;
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>Add a warranty</h2>
        <p style={styles.subtitle}>
          Only item name, start, and expiry are required. Link to a purchase to
          pre-fill and tie coverage to the receipt.
        </p>
      </header>

      <form action={addAction} style={styles.form}>
        <label style={styles.label}>
          Link purchase (optional)
          <select
            name="purchaseId"
            defaultValue={linkedPurchase?.id ?? ''}
            style={styles.input}
          >
            <option value="">— None —</option>
            {purchases.slice(0, 100).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.purchaseDate.slice(0, 10)}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Item name *
          <input
            required
            name="itemName"
            defaultValue={linkedPurchase?.name ?? ''}
            placeholder="MacBook Pro 14"
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Coverage type *
          <select
            required
            name="coverageType"
            defaultValue="manufacturer"
            style={styles.input}
          >
            {COVERAGE_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Start date *
            <input
              required
              name="startDate"
              type="date"
              defaultValue={
                linkedPurchase?.purchaseDate?.slice(0, 10) ?? todayIso()
              }
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Expiry date *
            <input
              required
              name="expiryDate"
              type="date"
              style={styles.input}
            />
          </label>
        </div>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Serial number
            <input
              name="serialNumber"
              placeholder="C02XG..."
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Registration number
            <input
              name="registrationNumber"
              placeholder="APL-..."
              style={styles.input}
            />
          </label>
        </div>

        <label style={styles.label}>
          Coverage details
          <textarea
            name="coverageDetailsMd"
            placeholder="1-year limited, accidental damage excluded..."
            style={{ ...styles.input, minHeight: 90 }}
          />
        </label>

        <label style={styles.label}>
          Reminder lead time (days before expiry)
          <input
            name="reminderDaysBefore"
            type="number"
            min="0"
            defaultValue={30}
            style={styles.input}
          />
        </label>

        <div style={styles.buttonRow}>
          <button type="submit" style={styles.primary}>
            Save warranty
          </button>
          <Link href="/shop/warranties" style={styles.secondary}>
            Cancel
          </Link>
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
  buttonRow: { display: 'flex', gap: 10, marginTop: 8 },
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
};
