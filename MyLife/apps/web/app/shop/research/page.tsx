import Link from 'next/link';
import { listComparisons, type Comparison } from '@mylife/shop';
import { getAdapter } from '@/lib/db';
import { ShopPanel, styles as uiStyles } from '../_ui';

export default async function ResearchListPage() {
  const db = getAdapter();
  let comparisons: Comparison[] = [];
  try {
    comparisons = listComparisons(db);
  } catch {
    comparisons = [];
  }

  const grouped = new Map<string, Comparison[]>();
  for (const c of comparisons) {
    const list = grouped.get(c.category) ?? [];
    list.push(c);
    grouped.set(c.category, list);
  }
  const sections = Array.from(grouped.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ShopPanel
        eyebrow="Research"
        title="Compare before you buy"
        body="Side-by-side pros and cons for the things you are weighing. Pick a winner, then link the comparison to the purchase you made."
      >
        <Link href="/shop/research/add" style={uiStyles.primaryLink}>
          + New comparison
        </Link>
      </ShopPanel>

      {comparisons.length === 0 ? (
        <section style={styles.empty}>
          <h3 style={styles.emptyTitle}>No comparisons yet</h3>
          <p style={styles.emptyBody}>
            Start one the next time you are evaluating options. The recap stays
            for the next year you shop the same category.
          </p>
        </section>
      ) : (
        sections.map(([category, list]) => (
          <section key={category} style={{ display: 'grid', gap: 8 }}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionLabel}>{category}</span>
              <span style={styles.sectionCount}>{list.length}</span>
            </div>
            {list.map((c) => (
              <Link key={c.id} href={`/shop/research/${c.id}`} style={styles.row}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <span style={styles.rowTitle}>{c.title}</span>
                  <span style={styles.rowMeta}>
                    {c.items.length} option{c.items.length === 1 ? '' : 's'}
                    {c.winner ? ` · winner: ${c.winner}` : ''}
                  </span>
                </div>
                {c.winner ? (
                  <span style={styles.winnerBadge}>Decided</span>
                ) : null}
              </Link>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  empty: {
    padding: 22,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  emptyTitle: { margin: 0, fontSize: 17, color: 'var(--text)' },
  emptyBody: {
    margin: '6px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  sectionLabel: {
    color: 'var(--text)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  sectionCount: {
    marginLeft: 'auto',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    textDecoration: 'none',
  },
  rowTitle: { color: 'var(--text)', fontSize: 15, fontWeight: 700 },
  rowMeta: { color: 'var(--text-secondary)', fontSize: 12 },
  winnerBadge: {
    padding: '3px 10px',
    borderRadius: 999,
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid rgba(16,185,129,0.4)',
    color: '#34D399',
    fontSize: 11,
    fontWeight: 800,
  },
};
