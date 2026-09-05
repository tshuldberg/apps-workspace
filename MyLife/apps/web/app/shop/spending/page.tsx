import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  listPurchases,
  getMonthlySummary,
  getCategoryBreakdown,
  getSixMonthTrend,
  getImpulseStats,
  getSaleRatio,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatCents(cents: number): string {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function SpendingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = new Date();
  const year = Number(params.year) || today.getFullYear();
  const month = Number(params.month) || today.getMonth() + 1;

  async function navAction(formData: FormData) {
    'use server';
    const y = String(formData.get('year') ?? '');
    const m = String(formData.get('month') ?? '');
    redirect(`/shop/spending?year=${y}&month=${m}`);
  }

  const db = getAdapter();
  const purchases = listPurchases(db);
  const summary = getMonthlySummary(purchases, year, month);
  const categories = getCategoryBreakdown(purchases, year, month);
  const trend = getSixMonthTrend(purchases, year, month);
  const monthRange = {
    fromMs: Date.UTC(year, month - 1, 1),
    toMs: Date.UTC(year, month, 1) - 1,
  };
  const impulse = getImpulseStats(purchases, monthRange);
  const sale = getSaleRatio(purchases, monthRange);

  const trendMax = Math.max(1, ...trend.map((t) => t.totalCents));
  const categoryMax = Math.max(1, ...categories.map((c) => c.totalCents));

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Spending</p>
        <div style={styles.monthRow}>
          <form action={navAction}>
            <input type="hidden" name="year" value={prev.y} />
            <input type="hidden" name="month" value={prev.m} />
            <button style={styles.monthBtn} type="submit" aria-label="Previous month">
              {'\u2039'}
            </button>
          </form>
          <h2 style={styles.monthLabel}>
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <form action={navAction}>
            <input type="hidden" name="year" value={next.y} />
            <input type="hidden" name="month" value={next.m} />
            <button style={styles.monthBtn} type="submit" aria-label="Next month">
              {'\u203A'}
            </button>
          </form>
        </div>
        <p style={styles.bigTotal}>{formatCents(summary.totalCents)}</p>
        <p style={styles.subtitle}>
          {summary.itemCount} purchase{summary.itemCount === 1 ? '' : 's'} this month
        </p>
      </header>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Last 6 months</h3>
        {summary.itemCount === 0 && trend.every((t) => t.totalCents === 0) ? (
          <p style={styles.empty}>No purchases yet in this window.</p>
        ) : (
          <div style={styles.trendRow}>
            {trend.map((t) => {
              const heightPct = (t.totalCents / trendMax) * 100;
              const isAnchor = t.year === year && t.month === month;
              return (
                <div key={`${t.year}-${t.month}`} style={styles.trendCol}>
                  <div style={styles.trendBarTrack}>
                    <div
                      style={{
                        ...styles.trendBarFill,
                        height: `${Math.max(2, heightPct)}%`,
                        background: isAnchor ? '#10B981' : 'rgba(16,185,129,0.4)',
                      }}
                    />
                  </div>
                  <div style={styles.trendLabel}>{MONTH_NAMES[t.month - 1]}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>By category</h3>
        {categories.length === 0 ? (
          <p style={styles.empty}>No spending by category this month.</p>
        ) : (
          <div style={styles.catList}>
            {categories.map((c) => {
              const widthPct = (c.totalCents / categoryMax) * 100;
              return (
                <div key={c.category} style={styles.catRow}>
                  <div style={styles.catLabelRow}>
                    <span style={styles.catLabel}>{c.category}</span>
                    <span style={styles.catValue}>
                      {formatCents(c.totalCents)} · {c.percentage}%
                    </span>
                  </div>
                  <div style={styles.catBarTrack}>
                    <div
                      style={{ ...styles.catBarFill, width: `${Math.max(2, widthPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div style={styles.ratioRow}>
        <div style={{ ...styles.ratioCard, borderColor: 'rgba(245,158,11,0.35)' }}>
          <p style={styles.ratioLabel}>Impulse</p>
          <p style={{ ...styles.ratioValue, color: '#F59E0B' }}>
            {impulse.impulsePercentage}%
          </p>
          <p style={styles.ratioMeta}>{formatCents(impulse.impulseCents)}</p>
        </div>
        <div style={{ ...styles.ratioCard, borderColor: 'rgba(16,185,129,0.35)' }}>
          <p style={styles.ratioLabel}>On sale</p>
          <p style={{ ...styles.ratioValue, color: '#10B981' }}>
            {sale.salePercentage}%
          </p>
          <p style={styles.ratioMeta}>
            {sale.saleCount}/{sale.saleCount + sale.fullPriceCount}
          </p>
        </div>
      </div>

      <div style={styles.linkRow}>
        <Link href="/shop/spending/impulse" style={styles.linkBtn}>
          Impulse log
        </Link>
        <Link href="/shop/spending/thirty-day-rule" style={styles.linkBtn}>
          30-day rule
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 16 },
  header: { display: 'grid', gap: 8 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  monthRow: { display: 'flex', alignItems: 'center', gap: 12 },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text)',
    fontSize: 18,
    cursor: 'pointer',
  },
  monthLabel: { margin: 0, color: 'var(--text)', fontSize: 18 },
  bigTotal: { margin: 0, color: 'var(--text)', fontSize: 40, fontWeight: 800 },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 14 },
  card: {
    display: 'grid',
    gap: 12,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardTitle: { margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  empty: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  trendRow: { display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 },
  trendCol: {
    flex: 1,
    display: 'grid',
    gap: 6,
    justifyItems: 'center',
  },
  trendBarTrack: {
    width: '100%',
    height: 110,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: { width: '100%', borderRadius: 8 },
  trendLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 },
  catList: { display: 'grid', gap: 12 },
  catRow: { display: 'grid', gap: 6 },
  catLabelRow: { display: 'flex', justifyContent: 'space-between' },
  catLabel: { color: 'var(--text)', fontSize: 13, fontWeight: 700, textTransform: 'capitalize' },
  catValue: { color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 },
  catBarTrack: {
    height: 8,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  catBarFill: { height: '100%', background: '#10B981', borderRadius: 4 },
  ratioRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  ratioCard: {
    display: 'grid',
    gap: 4,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  ratioLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-secondary)',
  },
  ratioValue: { margin: 0, fontSize: 26, fontWeight: 800 },
  ratioMeta: { margin: 0, color: 'var(--text-secondary)', fontSize: 12 },
  linkRow: { display: 'flex', gap: 12 },
  linkBtn: {
    flex: 1,
    textAlign: 'center',
    padding: '12px 14px',
    borderRadius: 14,
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#34D399',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 14,
  },
};
