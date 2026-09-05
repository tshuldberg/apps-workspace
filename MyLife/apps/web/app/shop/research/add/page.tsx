import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createComparison, type ComparisonItem } from '@mylife/shop';
import { getAdapter } from '@/lib/db';

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parsePriceCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseRating(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

async function createAction(formData: FormData) {
  'use server';
  const title = String(formData.get('title') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  if (!title || !category) return;
  const winnerRaw = String(formData.get('winner') ?? '').trim();
  const reasoning = String(formData.get('reasoning') ?? '').trim() || null;

  const items: ComparisonItem[] = [];
  for (let i = 0; i < 6; i += 1) {
    const name = String(formData.get(`name${i}`) ?? '').trim();
    if (!name) continue;
    items.push({
      name,
      pros: splitLines(String(formData.get(`pros${i}`) ?? '')),
      cons: splitLines(String(formData.get(`cons${i}`) ?? '')),
      priceCents: parsePriceCents(String(formData.get(`price${i}`) ?? '')),
      rating: parseRating(String(formData.get(`rating${i}`) ?? '')),
      url: String(formData.get(`url${i}`) ?? '').trim() || null,
    });
  }
  if (items.length === 0) return;
  const winner = winnerRaw && items.some((it) => it.name === winnerRaw)
    ? winnerRaw
    : null;

  let createdId: string | null = null;
  try {
    const created = createComparison(getAdapter(), {
      title,
      category,
      items,
      winner,
      reasoningMd: reasoning,
      decidedAt: winner ? Date.now() : null,
    });
    createdId = created.id;
  } catch (err) {
    console.error('createComparison failed', err);
    return;
  } finally {
    revalidatePath('/shop/research');
  }
  if (createdId) redirect(`/shop/research/${createdId}`);
}

export default function AddComparisonPage() {
  const itemSlots = [0, 1, 2, 3, 4, 5];
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>New comparison</h2>
        <p style={styles.subtitle}>
          Lay out the options. Empty option slots are skipped.
        </p>
      </header>

      <form action={createAction} style={styles.form}>
        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Title
            <input
              required
              name="title"
              placeholder="WH-1000XM5 vs QC45"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Category
            <input
              required
              name="category"
              placeholder="headphones"
              style={styles.input}
            />
          </label>
        </div>

        {itemSlots.map((i) => (
          <fieldset key={i} style={styles.fieldset}>
            <legend style={styles.legend}>Option {i + 1}</legend>
            <input
              name={`name${i}`}
              placeholder="Item name"
              style={styles.input}
            />
            <div style={styles.rowTwo}>
              <input
                name={`price${i}`}
                placeholder="Price (e.g. 399.99)"
                inputMode="decimal"
                style={styles.input}
              />
              <input
                name={`rating${i}`}
                placeholder="Rating 1-5"
                inputMode="numeric"
                style={styles.input}
              />
            </div>
            <textarea
              name={`pros${i}`}
              placeholder="Pros (one per line)"
              style={{ ...styles.input, minHeight: 60 }}
            />
            <textarea
              name={`cons${i}`}
              placeholder="Cons (one per line)"
              style={{ ...styles.input, minHeight: 60 }}
            />
            <input
              name={`url${i}`}
              placeholder="URL (optional)"
              style={styles.input}
            />
          </fieldset>
        ))}

        <label style={styles.label}>
          Winner (must match an item name)
          <input name="winner" placeholder="Optional" style={styles.input} />
        </label>
        <label style={styles.label}>
          Reasoning
          <textarea
            name="reasoning"
            placeholder="Why this option, in your own words..."
            style={{ ...styles.input, minHeight: 90 }}
          />
        </label>

        <div style={styles.actions}>
          <button type="submit" style={styles.primary}>Save comparison</button>
          <Link href="/shop/research" style={styles.secondary}>Cancel</Link>
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
  form: { display: 'grid', gap: 12 },
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
  fieldset: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  legend: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 800,
    padding: '0 6px',
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
  actions: { display: 'flex', gap: 10, marginTop: 8 },
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
