import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  getGiftPersonById,
  listGiftsByPerson,
  listItemsByGiftForPerson,
  getGiftBudget,
  setGiftBudget,
  getRemainingBudget,
  getOverBudgetWarning,
  summarizePersonSpending,
  type Gift,
  type GiftBudget,
  type WishlistItem,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function parseCents(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default async function GiftPersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { personId } = await params;
  const { tab } = await searchParams;
  const active = tab === 'past' || tab === 'budget' ? tab : 'ideas';
  const db = getAdapter();

  const person = (() => {
    try {
      return getGiftPersonById(db, personId);
    } catch {
      return null;
    }
  })();
  if (!person) return notFound();

  const gifts: Gift[] = (() => {
    try {
      return listGiftsByPerson(db, personId);
    } catch {
      return [];
    }
  })();

  const ideas: WishlistItem[] = (() => {
    try {
      return listItemsByGiftForPerson(db, personId);
    } catch {
      return [];
    }
  })();

  const budget: GiftBudget | null = (() => {
    try {
      return getGiftBudget(db, personId, null);
    } catch {
      return null;
    }
  })();

  const summary = summarizePersonSpending(gifts);
  const remaining = budget ? getRemainingBudget(budget, gifts) : null;
  const warning = budget ? getOverBudgetWarning(budget, gifts) : null;
  const pct = budget
    ? Math.min(100, Math.round(((budget.amountCents - (remaining ?? 0)) / budget.amountCents) * 100))
    : 0;

  async function setBudgetAction(formData: FormData) {
    'use server';
    const amountCents = parseCents(String(formData.get('amount') ?? '0'));
    if (amountCents <= 0) return;
    try {
      setGiftBudget(getAdapter(), {
        personId,
        occasion: null,
        amountCents,
      });
    } finally {
      revalidatePath(`/shop/gifts/${personId}`);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Gift recipient</p>
        <h2 style={styles.title}>{person.name}</h2>
        {person.relationship ? (
          <p style={styles.meta}>{person.relationship}</p>
        ) : null}
        <p style={styles.meta}>
          {gifts.length} gifts logged · {formatCurrency(summary.totalMyShare)} spent
        </p>
      </header>

      <div style={styles.tabs}>
        <Link
          href={`/shop/gifts/${personId}?tab=ideas`}
          style={active === 'ideas' ? styles.tabActive : styles.tab}
        >
          Ideas ({ideas.length})
        </Link>
        <Link
          href={`/shop/gifts/${personId}?tab=past`}
          style={active === 'past' ? styles.tabActive : styles.tab}
        >
          Past gifts ({gifts.length})
        </Link>
        <Link
          href={`/shop/gifts/${personId}?tab=budget`}
          style={active === 'budget' ? styles.tabActive : styles.tab}
        >
          Budget
        </Link>
      </div>

      {active === 'ideas' ? (
        <section style={styles.section}>
          {ideas.length === 0 ? (
            <div style={styles.empty}>
              <h3 style={styles.emptyTitle}>No ideas yet</h3>
              <p style={styles.emptyBody}>
                Tag wishlist items as &quot;Gift for {person.name}&quot; to surface them here.
              </p>
            </div>
          ) : (
            <ul style={styles.list}>
              {ideas.map((item) => (
                <li key={item.id} style={styles.row}>
                  <Link
                    href={`/shop/wishlist/item/${item.id}`}
                    style={styles.rowLink}
                  >
                    <span style={styles.rowTitle}>{item.name}</span>
                    <span style={styles.rowMeta}>
                      {item.priority}
                      {item.priceCents != null ? ` · ${formatCurrency(item.priceCents)}` : ''}
                      {item.isPurchased ? ' · purchased' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {active === 'past' ? (
        <section style={styles.section}>
          <Link href={`/shop/gifts/add?personId=${personId}`} style={styles.primaryBtn}>
            Log a gift
          </Link>
          {gifts.length === 0 ? (
            <div style={styles.empty}>
              <h3 style={styles.emptyTitle}>No gifts yet</h3>
              <p style={styles.emptyBody}>
                Start logging what you give so you can remember patterns and avoid repeats.
              </p>
            </div>
          ) : (
            <ul style={styles.list}>
              {gifts.map((g) => (
                <li key={g.id} style={styles.row}>
                  <div style={styles.rowCard}>
                    <div style={styles.rowHeader}>
                      <span style={styles.rowTitle}>{g.itemDescription}</span>
                      <span style={styles.rowAmount}>
                        {formatCurrency(g.isGroupGift ? g.myShareCents : g.amountCents)}
                      </span>
                    </div>
                    <span style={styles.rowMeta}>
                      {g.occasion.replace('_', ' ')} · {formatDate(g.giftDate)}
                      {g.isGroupGift ? ` · group (total ${formatCurrency(g.groupTotalCents)})` : ''}
                    </span>
                    {g.reactionNotes ? (
                      <span style={styles.rowNotes}>{g.reactionNotes}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {active === 'budget' ? (
        <section style={styles.section}>
          {budget ? (
            <div style={styles.budgetCard}>
              <div style={styles.budgetHeader}>
                <span style={styles.budgetLabel}>Annual budget</span>
                <span style={styles.budgetAmount}>
                  {formatCurrency(budget.amountCents)}
                </span>
              </div>
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${pct}%`,
                    background: warning?.overBudget ? '#F87171' : '#10B981',
                  }}
                />
              </div>
              <span style={styles.budgetMeta}>
                {formatCurrency(summary.totalMyShare)} spent · {formatCurrency(remaining)} remaining
              </span>
              {warning?.overBudget ? (
                <span style={styles.warning}>
                  Over by {formatCurrency(warning.overAmount)} ({warning.percentage}%)
                </span>
              ) : null}
            </div>
          ) : (
            <div style={styles.empty}>
              <h3 style={styles.emptyTitle}>No budget set</h3>
              <p style={styles.emptyBody}>
                Set an annual budget for {person.name} to track how close you are.
              </p>
            </div>
          )}

          <form action={setBudgetAction} style={styles.form}>
            <label style={styles.formLabel}>
              {budget ? 'Update' : 'Set'} annual budget (USD)
              <input
                required
                name="amount"
                type="number"
                step="0.01"
                placeholder="500.00"
                defaultValue={budget ? (budget.amountCents / 100).toFixed(2) : ''}
                style={styles.input}
              />
            </label>
            <button type="submit" style={styles.primaryBtn}>
              Save budget
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 16 },
  header: { display: 'grid', gap: 4 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#34D399',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.7rem' },
  meta: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
  tabActive: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid #10B981',
    background: '#10B981',
    color: '#0E0E13',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 800,
  },
  section: { display: 'grid', gap: 12 },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 },
  row: { margin: 0 },
  rowLink: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    textDecoration: 'none',
    color: 'var(--text)',
  },
  rowCard: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  rowHeader: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: 'var(--text)', fontSize: 15, fontWeight: 700 },
  rowAmount: { color: '#34D399', fontWeight: 800 },
  rowMeta: { color: 'var(--text-secondary)', fontSize: 12 },
  rowNotes: { color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 },
  empty: {
    padding: 20,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: 6,
  },
  emptyTitle: { margin: 0, color: 'var(--text)' },
  emptyBody: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  budgetCard: {
    padding: 18,
    borderRadius: 18,
    background: 'rgba(16,185,129,0.06)',
    border: '1px solid rgba(16,185,129,0.2)',
    display: 'grid',
    gap: 10,
  },
  budgetHeader: { display: 'flex', justifyContent: 'space-between' },
  budgetLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  budgetAmount: { color: 'var(--text)', fontSize: 20, fontWeight: 800 },
  budgetMeta: { color: 'var(--text-secondary)', fontSize: 13 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  warning: { color: '#F87171', fontSize: 13, fontWeight: 700 },
  form: { display: 'grid', gap: 10 },
  formLabel: {
    display: 'grid',
    gap: 5,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
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
  primaryBtn: {
    padding: '0.65rem 1.1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: 14,
    justifySelf: 'start',
  },
};
