import Link from 'next/link';
import {
  getDaysUntilExpiry,
  getWarrantyStatus,
  listWarranties,
  type Warranty,
  type WarrantyStatus,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const STATUS_ORDER: Array<{
  status: WarrantyStatus;
  label: string;
  color: string;
}> = [
  { status: 'expiring-soon', label: 'Expiring soon', color: '#FFB877' },
  { status: 'active', label: 'Active', color: '#34D399' },
  { status: 'claimed', label: 'Claimed', color: '#8BCFF0' },
  { status: 'expired', label: 'Expired', color: 'rgba(255,255,255,0.4)' },
];

const COVERAGE_COLOR: Record<string, string> = {
  manufacturer: '#8BCFF0',
  extended: '#A78BFA',
  protection: '#34D399',
};

function formatMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'today';
  if (days === 1) return '1d left';
  return `${days}d left`;
}

export default async function ShopWarrantiesPage() {
  const db = getAdapter();
  const all = listWarranties(db);

  const grouped = new Map<WarrantyStatus, Warranty[]>();
  for (const { status } of STATUS_ORDER) grouped.set(status, []);
  for (const w of all) {
    grouped.get(getWarrantyStatus(w))!.push(w);
  }
  for (const { status } of STATUS_ORDER) {
    grouped.get(status)!.sort((a, b) => a.expiryDate - b.expiryDate);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Warranties</p>
        <h2 style={styles.title}>
          {all.length === 0 ? 'Track your first warranty' : 'Warranty vault'}
        </h2>
        <p style={styles.subtitle}>
          Never miss an expiration or return window. Coverage lives locally,
          alerts fire before the deadline.
        </p>
      </header>

      <div style={styles.actions}>
        <Link href="/shop/warranties/add" style={styles.primary}>
          + Add warranty
        </Link>
      </div>

      {all.length === 0 ? (
        <p style={styles.emptyBody}>
          Add a warranty and MyShop will flag expiring coverage and help you file
          claims when things break.
        </p>
      ) : (
        STATUS_ORDER.map(({ status, label, color }) => {
          const list = grouped.get(status) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={status} style={styles.section}>
              <div style={styles.sectionHeader}>
                <span
                  style={{ ...styles.sectionDot, background: color }}
                  aria-hidden
                />
                <span style={styles.sectionLabel}>{label}</span>
                <span style={styles.sectionCount}>{list.length}</span>
              </div>
              <ul style={styles.itemList}>
                {list.map((w) => {
                  const days = getDaysUntilExpiry(w.expiryDate);
                  const coverageColor =
                    COVERAGE_COLOR[w.coverageType] ?? 'rgba(255,255,255,0.6)';
                  const dimmed = status === 'expired';
                  return (
                    <li
                      key={w.id}
                      style={{
                        ...styles.card,
                        ...(dimmed ? { opacity: 0.55 } : {}),
                      }}
                    >
                      <div style={styles.cardTop}>
                        <Link
                          href={`/shop/warranties/${w.id}`}
                          style={styles.cardName}
                        >
                          {w.itemName}
                        </Link>
                        <span
                          style={{
                            ...styles.coverageBadge,
                            color: coverageColor,
                            borderColor: coverageColor,
                          }}
                        >
                          {w.coverageType}
                        </span>
                      </div>
                      <div style={styles.cardMeta}>
                        <span>exp {formatMs(w.expiryDate)}</span>
                        <span>·</span>
                        <span
                          style={
                            status === 'expiring-soon'
                              ? { color: '#FFB877', fontWeight: 700 }
                              : undefined
                          }
                        >
                          {status === 'claimed'
                            ? 'claim filed'
                            : daysLabel(days)}
                        </span>
                      </div>
                    </li>
                  );
                })}
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
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    display: 'inline-block',
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
  itemList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gap: 8,
  },
  card: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardName: {
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
    flex: 1,
  },
  coverageBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
};
