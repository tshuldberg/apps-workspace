import {
  listPurchases,
  getImpulseRegretRate,
  getTopImpulseCategories,
  type Purchase,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

function formatCents(cents: number): string {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function regretColor(rate: number): string {
  if (rate >= 0.5) return '#EF4444';
  if (rate >= 0.25) return '#F59E0B';
  return '#10B981';
}

function latestSatisfaction(p: Purchase): number | null {
  return p.satisfaction90day ?? p.satisfaction30day ?? p.satisfactionInitial ?? null;
}

function satColor(rating: number | null): string {
  if (rating == null) return 'rgba(255,255,255,0.3)';
  if (rating <= 2) return '#EF4444';
  if (rating === 3) return '#F59E0B';
  return '#10B981';
}

export default async function ImpulsePage() {
  const db = getAdapter();
  const purchases = listPurchases(db);
  const impulseList = purchases
    .filter((p) => p.isImpulse)
    .slice()
    .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1));
  const regret = getImpulseRegretRate(purchases);
  const topCategories = getTopImpulseCategories(purchases, 5);

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <p style={styles.eyebrow}>Impulse log</p>
        <p style={styles.regretLabel}>Regret rate</p>
        <p style={{ ...styles.bigNum, color: regretColor(regret.regretRate) }}>
          {Math.round(regret.regretRate * 100)}%
        </p>
        <p style={styles.subtitle}>
          {regret.regretted} of {regret.totalImpulse} impulse purchase
          {regret.totalImpulse === 1 ? '' : 's'} rated below 3
        </p>
      </header>

      {topCategories.length > 0 ? (
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Top impulse categories</h3>
          <div style={styles.catList}>
            {topCategories.map((c) => (
              <div key={c.category} style={styles.catRow}>
                <span style={styles.catLabel}>{c.category}</span>
                <span style={styles.catCount}>{c.count}x</span>
                <span style={styles.catValue}>{formatCents(c.totalCents)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>All impulse purchases</h3>
        {impulseList.length === 0 ? (
          <p style={styles.empty}>No impulse purchases logged yet.</p>
        ) : (
          <ul style={styles.list}>
            {impulseList.map((p) => {
              const sat = latestSatisfaction(p);
              const color = satColor(sat);
              return (
                <li key={p.id} style={styles.row}>
                  <div>
                    <div style={styles.itemName}>{p.name}</div>
                    <div style={styles.itemMeta}>
                      {p.purchaseDate} · {formatCents(p.priceCents)}
                    </div>
                  </div>
                  <div
                    style={{
                      ...styles.satBadge,
                      borderColor: color,
                      background: color + '22',
                      color,
                    }}
                  >
                    {sat == null ? '—' : `${sat}/5`}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 16 },
  hero: {
    display: 'grid',
    gap: 6,
    padding: 20,
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  regretLabel: { margin: 0, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 },
  bigNum: { margin: 0, fontSize: 48, fontWeight: 800, lineHeight: 1.1 },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  card: {
    display: 'grid',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardTitle: { margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  empty: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  catList: { display: 'grid', gap: 8 },
  catRow: { display: 'flex', alignItems: 'center', gap: 12 },
  catLabel: {
    flex: 1,
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  catCount: { color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 },
  catValue: { color: '#10B981', fontSize: 13, fontWeight: 700, minWidth: 80, textAlign: 'right' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  itemName: { color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  itemMeta: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 },
  satBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 800,
  },
};
