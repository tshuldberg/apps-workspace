import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createPurchase,
  getWishlistItemById,
  markAsPurchased,
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

function parseRating(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function LogPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ wishlistItemId?: string }>;
}) {
  const { wishlistItemId } = await searchParams;

  const db = getAdapter();
  const prefill = wishlistItemId ? getWishlistItemById(db, wishlistItemId) : null;

  async function logAction(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    const category = String(formData.get('category') ?? 'other') as Category;
    const priceCents = parseCents(String(formData.get('priceCents') ?? ''));
    const purchaseDate = String(formData.get('purchaseDate') ?? '').trim();
    if (!name || priceCents == null || !purchaseDate) return;
    if (!CATEGORIES.includes(category)) return;

    const paymentMethodRaw = String(formData.get('paymentMethod') ?? '');
    const paymentMethod = PAYMENT_METHODS.includes(paymentMethodRaw as PaymentMethod)
      ? (paymentMethodRaw as PaymentMethod)
      : null;

    const policyDaysRaw = String(formData.get('policyDays') ?? '').trim();
    const policyDays =
      policyDaysRaw.length > 0 && Number.isFinite(Number(policyDaysRaw))
        ? Number(policyDaysRaw)
        : undefined;

    const rawDeadline = String(formData.get('returnDeadline') ?? '').trim();
    const adapter = getAdapter();
    try {
      const purchase = createPurchase(adapter, {
        name,
        category,
        priceCents,
        purchaseDate,
        store: String(formData.get('store') ?? '').trim() || null,
        paymentMethod,
        brand: String(formData.get('brand') ?? '').trim() || null,
        url: String(formData.get('url') ?? '').trim() || null,
        isImpulse: formData.get('isImpulse') === 'on',
        researchNotesMd: String(formData.get('researchNotesMd') ?? '').trim() || null,
        notesMd: String(formData.get('notesMd') ?? '').trim() || null,
        satisfactionInitial: parseRating(String(formData.get('satisfactionInitial') ?? '')),
        returnDeadline: rawDeadline || null,
        policyDays: rawDeadline ? undefined : policyDays,
        wishlistItemId: wishlistItemId ?? null,
      });

      if (wishlistItemId) {
        try {
          markAsPurchased(adapter, wishlistItemId, {
            purchaseId: purchase.id,
            purchasedAt: new Date().toISOString(),
          });
        } catch { /* ignore */ }
      }

      revalidatePath('/shop/purchases');
      redirect(`/shop/purchases/${purchase.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      // Let Next.js surface errors by throwing.
      throw err;
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>Log a purchase</h2>
        <p style={styles.subtitle}>
          Only name, category, price, and date are required. Everything else is optional.
        </p>
      </header>

      <form action={logAction} style={styles.form}>
        <label style={styles.label}>
          Name *
          <input
            required
            name="name"
            defaultValue={prefill?.name ?? ''}
            placeholder="AirPods Pro"
            style={styles.input}
          />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Category *
            <select
              required
              name="category"
              defaultValue={prefill?.category ?? 'other'}
              style={styles.input}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Price (USD) *
            <input
              required
              name="priceCents"
              type="number"
              step="0.01"
              min="0"
              defaultValue={prefill?.priceCents != null ? (prefill.priceCents / 100).toFixed(2) : ''}
              style={styles.input}
            />
          </label>
        </div>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Purchase date *
            <input
              required
              name="purchaseDate"
              type="date"
              defaultValue={todayIso()}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Return deadline
            <input name="returnDeadline" type="date" style={styles.input} />
          </label>
        </div>

        <label style={styles.label}>
          Or policy days (auto-calculated)
          <input
            name="policyDays"
            type="number"
            min="0"
            placeholder="30"
            style={styles.input}
          />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Store
            <input
              name="store"
              defaultValue={prefill?.store ?? ''}
              placeholder="Apple"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Brand
            <input
              name="brand"
              defaultValue={prefill?.brand ?? ''}
              placeholder="Apple"
              style={styles.input}
            />
          </label>
        </div>

        <label style={styles.label}>
          Payment method
          <select name="paymentMethod" defaultValue="" style={styles.input}>
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
            defaultValue={prefill?.url ?? ''}
            placeholder="https://"
            style={styles.input}
          />
        </label>

        <label style={{ ...styles.label, flexDirection: 'row', alignItems: 'center', gap: 10, textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>
          <input name="isImpulse" type="checkbox" />
          <span>
            <strong>Impulse purchase</strong> — tag if this was unplanned. Helps track regret
            rate over time.
          </span>
        </label>

        <label style={styles.label}>
          Initial satisfaction (1-5)
          <select name="satisfactionInitial" defaultValue="" style={styles.input}>
            <option value="">Skip for now</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {'★'.repeat(n)}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Research notes
          <textarea
            name="researchNotesMd"
            placeholder="What did you compare? Why this one?"
            style={{ ...styles.input, minHeight: 80 }}
          />
        </label>

        <label style={styles.label}>
          Notes
          <textarea
            name="notesMd"
            placeholder="Anything else to remember…"
            style={{ ...styles.input, minHeight: 60 }}
          />
        </label>

        <div style={styles.buttonRow}>
          <button type="submit" style={styles.primary}>Save purchase</button>
          <Link href="/shop/purchases" style={styles.secondary}>Cancel</Link>
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
