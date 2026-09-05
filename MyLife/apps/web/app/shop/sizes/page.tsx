import Link from 'next/link';
import { listSizes, type Size, type SizeType } from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const TYPE_ORDER: Array<{ key: SizeType; label: string }> = [
  { key: 'clothing', label: 'Clothing' },
  { key: 'shoe', label: 'Shoes' },
  { key: 'ring', label: 'Rings' },
  { key: 'other', label: 'Other' },
];

export default async function ShopSizesPage() {
  const db = getAdapter();
  const all = listSizes(db);

  const grouped = new Map<SizeType, Size[]>();
  for (const t of TYPE_ORDER) grouped.set(t.key, []);
  for (const s of all) grouped.get(s.type)!.push(s);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Sizes</p>
        <h2 style={styles.title}>
          {all.length === 0 ? 'Remember what fits' : 'Your fit memory'}
        </h2>
        <p style={styles.subtitle}>
          Never guess a size again. Clothing, shoe, ring, and custom sizes per
          brand with fit notes.
        </p>
      </header>

      <div style={styles.actions}>
        <Link href="/shop/sizes/add" style={styles.primary}>
          + Add size
        </Link>
      </div>

      {all.length === 0 ? (
        <p style={styles.emptyBody}>
          No sizes saved yet. Add your go-to brands and sizes, and MyShop will
          surface them when you save wishlist items.
        </p>
      ) : (
        TYPE_ORDER.map((t) => {
          const list = grouped.get(t.key) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={t.key} style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionLabel}>{t.label}</span>
                <span style={styles.sectionCount}>{list.length}</span>
              </div>
              <ul style={styles.pillGrid}>
                {list.map((s) => (
                  <li key={s.id} style={styles.pill}>
                    <Link href={`/shop/sizes/${s.id}`} style={styles.pillLink}>
                      <div style={styles.pillBrand}>{s.brand}</div>
                      <div style={styles.pillValue}>{s.sizeValue}</div>
                      {s.fitNotes ? (
                        <div style={styles.pillNotes}>{s.fitNotes}</div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
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
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6,
  },
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
  emptyBody: { color: 'var(--text-secondary)', fontSize: 14 },
  section: { display: 'grid', gap: 8 },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sectionLabel: {
    color: 'var(--text)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  sectionCount: {
    marginLeft: 'auto',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  pillGrid: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 8,
  },
  pill: {
    padding: 12,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  pillLink: {
    display: 'grid',
    gap: 2,
    color: 'var(--text)',
    textDecoration: 'none',
  },
  pillBrand: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  pillValue: {
    color: 'var(--text)',
    fontSize: 16,
    fontWeight: 800,
  },
  pillNotes: { color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 },
};
