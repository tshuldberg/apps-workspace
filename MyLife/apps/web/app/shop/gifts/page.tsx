import Link from 'next/link';
import {
  listGiftPeople,
  listGiftsByPerson,
  getGiftBudget,
  getRemainingBudget,
  type GiftPerson,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatNextOccasion(p: GiftPerson): string {
  if (!p.nextOccasion) return 'No upcoming occasion';
  const base = p.nextOccasion;
  if (!p.nextOccasionDate) return base;
  const d = new Date(p.nextOccasionDate);
  const now = Date.now();
  const days = Math.round((p.nextOccasionDate - now) / 86400000);
  const dateStr = d.toISOString().slice(0, 10);
  if (days < 0) return `${base} · ${dateStr}`;
  if (days === 0) return `${base} · today`;
  if (days === 1) return `${base} · tomorrow`;
  return `${base} · in ${days} days`;
}

export default function GiftsIndexPage() {
  const db = getAdapter();
  const people: GiftPerson[] = (() => {
    try {
      return listGiftPeople(db);
    } catch {
      return [];
    }
  })();

  const rows = people.map((p) => {
    const gifts = (() => {
      try {
        return listGiftsByPerson(db, p.id);
      } catch {
        return [];
      }
    })();
    const budget = (() => {
      try {
        return getGiftBudget(db, p.id, null);
      } catch {
        return null;
      }
    })();
    const remaining = budget ? getRemainingBudget(budget, gifts) : null;
    const overBudget = remaining != null && remaining < 0;
    return { person: p, giftCount: gifts.length, budget, remaining, overBudget };
  });

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Gift shopping</p>
          <h2 style={styles.title}>People</h2>
          <p style={styles.subtitle}>
            Track who you gift, what you gave, and how much you spend per person.
          </p>
        </div>
        <div style={styles.actions}>
          <Link href="/shop/gifts/add-person" style={styles.primary}>Add person</Link>
          <Link href="/shop/gifts/add" style={styles.secondary}>Log a gift</Link>
        </div>
      </header>

      {people.length === 0 ? (
        <div style={styles.empty}>
          <h3 style={styles.emptyTitle}>No people yet</h3>
          <p style={styles.emptyBody}>
            Add someone you gift to. Track ideas, past gifts, and a per-person budget.
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {rows.map(({ person, giftCount, budget, remaining, overBudget }) => (
            <Link
              key={person.id}
              href={`/shop/gifts/${person.id}`}
              style={styles.card}
            >
              <div style={styles.avatar}>
                {person.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={styles.cardBody}>
                <span style={styles.cardTitle}>{person.name}</span>
                {person.relationship ? (
                  <span style={styles.cardMeta}>{person.relationship}</span>
                ) : null}
                <span style={styles.cardMeta}>{formatNextOccasion(person)}</span>
                <span style={styles.cardMeta}>{giftCount} gifts logged</span>
                {budget ? (
                  <span
                    style={{
                      ...styles.budgetPill,
                      color: overBudget ? '#F87171' : '#34D399',
                      borderColor: overBudget
                        ? 'rgba(248,113,113,0.3)'
                        : 'rgba(52,211,153,0.3)',
                      background: overBudget
                        ? 'rgba(248,113,113,0.08)'
                        : 'rgba(52,211,153,0.08)',
                    }}
                  >
                    {overBudget
                      ? `Over by ${formatCurrency(Math.abs(remaining ?? 0))}`
                      : `${formatCurrency(remaining)} left`}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'grid', gap: 16 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 12,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.6rem' },
  subtitle: { margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 },
  actions: { display: 'flex', gap: 10 },
  primary: {
    borderRadius: 999,
    background: '#10B981',
    color: '#0E0E13',
    padding: '10px 18px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
  secondary: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    padding: '10px 18px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
  },
  empty: {
    padding: 24,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: 8,
  },
  emptyTitle: { margin: 0, color: 'var(--text)' },
  emptyBody: { margin: 0, color: 'var(--text-secondary)', fontSize: 14 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 12,
  },
  card: {
    display: 'grid',
    gridTemplateColumns: '52px 1fr',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    textDecoration: 'none',
    color: 'var(--text)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    background: 'rgba(16,185,129,0.18)',
    color: '#34D399',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 800,
  },
  cardBody: { display: 'grid', gap: 3 },
  cardTitle: { color: 'var(--text)', fontSize: 16, fontWeight: 700 },
  cardMeta: { color: 'var(--text-secondary)', fontSize: 12 },
  budgetPill: {
    marginTop: 4,
    padding: '3px 8px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 700,
    justifySelf: 'start',
  },
};
