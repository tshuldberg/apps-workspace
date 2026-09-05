import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  getPurchaseById,
  updatePurchase,
  type Category,
  type PaymentMethod,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const CATEGORIES: Category[] = [
  'tech', 'clothing', 'books', 'home', 'kitchen',
  'gaming', 'music', 'sports', 'gifts', 'hobby', 'other',
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'credit_card', 'debit_card', 'cash', 'gift_card', 'financing', 'other',
];

function parseCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default async function EditPurchasePage({
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
        <p style={styles.subtitle}>Purchase not found.</p>
        <Link href="/shop/purchases" style={styles.secondary}>Back</Link>
      </div>
    );
  }

  async function updateAction(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;
    const category = String(formData.get('category') ?? 'other') as Category;
    if (!CATEGORIES.includes(category)) return;
    const priceCents = parseCents(String(formData.get('priceCents') ?? ''));
    if (priceCents == null) return;
    const purchaseDate = String(formData.get('purchaseDate') ?? '').trim();
    if (!purchaseDate) return;

    const paymentMethodRaw = String(formData.get('paymentMethod') ?? '');
    const paymentMethod = PAYMENT_METHODS.includes(paymentMethodRaw as PaymentMethod)
      ? (paymentMethodRaw as PaymentMethod)
      : null;

    updatePurchase(getAdapter(), id, {
      name,
      category,
      priceCents,
      purchaseDate,
      store: String(formData.get('store') ?? '').trim() || null,
      paymentMethod,
      brand: String(formData.get('brand') ?? '').trim() || null,
      url: String(formData.get('url') ?? '').trim() || null,
      isImpulse: formData.get('isImpulse') === 'on',
      notesMd: String(formData.get('notesMd') ?? '').trim() || null,
      returnDeadline: String(formData.get('returnDeadline') ?? '').trim() || null,
    });
    revalidatePath(`/shop/purchases/${id}`);
    revalidatePath('/shop/purchases');
    redirect(`/shop/purchases/${id}`);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>Edit purchase</h2>
      </header>

      <form action={updateAction} style={styles.form}>
        <label style={styles.label}>
          Name
          <input
            required
            name="name"
            defaultValue={purchase.name}
            style={styles.input}
          />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Category
            <select name="category" defaultValue={purchase.category} style={styles.input}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Price (USD)
            <input
              required
              name="priceCents"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(purchase.priceCents / 100).toFixed(2)}
              style={styles.input}
            />
          </label>
        </div>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Purchase date
            <input
              required
              name="purchaseDate"
              type="date"
              defaultValue={purchase.purchaseDate.slice(0, 10)}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Return deadline
            <input
              name="returnDeadline"
              type="date"
              defaultValue={purchase.returnDeadline?.slice(0, 10) ?? ''}
              style={styles.input}
            />
          </label>
        </div>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Store
            <input name="store" defaultValue={purchase.store ?? ''} style={styles.input} />
          </label>
          <label style={styles.label}>
            Brand
            <input name="brand" defaultValue={purchase.brand ?? ''} style={styles.input} />
          </label>
        </div>

        <label style={styles.label}>
          Payment method
          <select
            name="paymentMethod"
            defaultValue={purchase.paymentMethod ?? ''}
            style={styles.input}
          >
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m.replace('_', ' ')}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          URL
          <input
            name="url"
            type="url"
            defaultValue={purchase.url ?? ''}
            style={styles.input}
          />
        </label>

        <label
          style={{
            ...styles.label,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            textTransform: 'none',
            letterSpacing: 0,
            fontSize: 13,
          }}
        >
          <input name="isImpulse" type="checkbox" defaultChecked={purchase.isImpulse} />
          Mark as impulse purchase
        </label>

        <label style={styles.label}>
          Notes
          <textarea
            name="notesMd"
            defaultValue={purchase.notesMd ?? ''}
            style={{ ...styles.input, minHeight: 80 }}
          />
        </label>

        <div style={styles.buttonRow}>
          <button type="submit" style={styles.primary}>Save changes</button>
          <Link href={`/shop/purchases/${id}`} style={styles.secondary}>Cancel</Link>
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
