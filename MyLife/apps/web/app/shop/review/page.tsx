import Link from 'next/link';
import { listPurchases } from '@mylife/shop';
import { getAdapter } from '@/lib/db';
import { ShopPanel } from '../_ui';

function parseYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})/.exec(dateStr);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

export default async function ReviewIndexPage() {
  const db = getAdapter();
  const set = new Set<number>();
  try {
    for (const p of listPurchases(db)) {
      const y = parseYear(p.purchaseDate);
      if (y != null) set.add(y);
    }
  } catch {
    // empty
  }
  set.add(new Date().getFullYear());
  const years = Array.from(set).sort((a, b) => b - a);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ShopPanel
        eyebrow="Year in Review"
        title="Look back at a year of buying"
        body="Total spend, top categories, best and worst purchases, gift summary, warranty wins, and the impulse audit. Pick a year."
      />
      {years.map((year) => (
        <Link key={year} href={`/shop/review/${year}`} style={styles.row}>
          <span style={styles.year}>{year}</span>
          <span style={styles.chevron}>{'>'}</span>
        </Link>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    textDecoration: 'none',
  },
  year: { color: 'var(--text)', fontSize: 18, fontWeight: 800 },
  chevron: { color: 'var(--text-secondary)', fontSize: 20, fontWeight: 700 },
};
