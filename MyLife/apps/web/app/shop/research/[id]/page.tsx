import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  deleteComparison,
  getComparisonById,
  linkComparisonToPurchase,
  listPurchases,
  type Comparison,
  type Purchase,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default async function ComparisonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const db = getAdapter();
  let comparison: Comparison | null = null;
  try {
    comparison = getComparisonById(db, id);
  } catch {
    comparison = null;
  }
  if (!comparison) notFound();
  const safeComparison: Comparison = comparison;

  let purchaseMatches: Purchase[] = [];
  const queryStr = (q ?? '').trim().toLowerCase();
  if (queryStr && !safeComparison.purchaseId) {
    try {
      purchaseMatches = listPurchases(db)
        .filter((p) => p.name.toLowerCase().includes(queryStr))
        .slice(0, 8);
    } catch {
      purchaseMatches = [];
    }
  }

  async function linkAction(formData: FormData) {
    'use server';
    const purchaseId = String(formData.get('purchaseId') ?? '').trim();
    if (!purchaseId) return;
    try {
      linkComparisonToPurchase(getAdapter(), id, purchaseId);
    } finally {
      revalidatePath(`/shop/research/${id}`);
    }
    redirect(`/shop/research/${id}`);
  }

  async function deleteAction() {
    'use server';
    try {
      deleteComparison(getAdapter(), id);
    } finally {
      revalidatePath('/shop/research');
    }
    redirect('/shop/research');
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>{safeComparison.category}</p>
        <h2 style={styles.title}>{safeComparison.title}</h2>
        {safeComparison.winner ? (
          <p style={styles.winnerLine}>
            Winner: <strong style={styles.winnerName}>{safeComparison.winner}</strong>
          </p>
        ) : null}
      </header>

      <section style={styles.itemsGrid}>
        {safeComparison.items.map((item, idx) => {
          const isWinner =
            safeComparison.winner != null && safeComparison.winner === item.name;
          return (
            <article
              key={`${item.name}-${idx}`}
              style={{ ...styles.itemCard, ...(isWinner ? styles.itemCardWinner : {}) }}
            >
              <div style={styles.itemHead}>
                <span style={styles.itemName}>{item.name}</span>
                {isWinner ? (
                  <span style={styles.pickedBadge}>Picked</span>
                ) : null}
              </div>
              {item.priceCents != null || item.rating != null ? (
                <p style={styles.itemMeta}>
                  {item.priceCents != null ? formatCents(item.priceCents) : ''}
                  {item.priceCents != null && item.rating != null ? ' · ' : ''}
                  {item.rating != null ? `${item.rating}/5` : ''}
                </p>
              ) : null}
              {item.pros.length > 0 ? (
                <div>
                  <p style={styles.sectionLabel}>Pros</p>
                  {item.pros.map((p, i) => (
                    <p key={i} style={styles.proRow}>+ {p}</p>
                  ))}
                </div>
              ) : null}
              {item.cons.length > 0 ? (
                <div>
                  <p style={styles.sectionLabel}>Cons</p>
                  {item.cons.map((c, i) => (
                    <p key={i} style={styles.conRow}>− {c}</p>
                  ))}
                </div>
              ) : null}
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" style={styles.url}>
                  {item.url}
                </a>
              ) : null}
            </article>
          );
        })}
      </section>

      {safeComparison.reasoningMd ? (
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Reasoning</h3>
          <p style={styles.body}>{safeComparison.reasoningMd}</p>
        </section>
      ) : null}

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Link to a purchase</h3>
        {safeComparison.purchaseId ? (
          <p style={styles.body}>
            Linked to purchase id {safeComparison.purchaseId}.
          </p>
        ) : (
          <>
            <form method="get" style={styles.searchForm}>
              <input
                name="q"
                defaultValue={q ?? ''}
                placeholder="Search purchases by name"
                style={styles.input}
              />
              <button type="submit" style={styles.secondary}>Search</button>
            </form>
            {queryStr && purchaseMatches.length === 0 ? (
              <p style={styles.body}>No matching purchases.</p>
            ) : null}
            {purchaseMatches.map((p) => (
              <form key={p.id} action={linkAction} style={styles.matchForm}>
                <input type="hidden" name="purchaseId" value={p.id} />
                <button type="submit" style={styles.matchBtn}>
                  <span style={styles.matchName}>{p.name}</span>
                  <span style={styles.matchMeta}>
                    {p.purchaseDate} · {formatCents(p.priceCents)}
                  </span>
                </button>
              </form>
            ))}
          </>
        )}
      </section>

      <div style={styles.actions}>
        <Link href="/shop/research" style={styles.secondary}>Back</Link>
        <form action={deleteAction}>
          <button type="submit" style={styles.danger}>Delete</button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'grid',
    gap: 6,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  eyebrow: {
    margin: 0,
    color: '#34D399',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  title: { margin: 0, color: 'var(--text)', fontSize: 22 },
  winnerLine: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  winnerName: { color: '#34D399' },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },
  itemCard: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  itemCardWinner: { border: '2px solid #10B981' },
  itemHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: { color: 'var(--text)', fontSize: 15, fontWeight: 800 },
  pickedBadge: {
    padding: '3px 10px',
    borderRadius: 999,
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid #10B981',
    color: '#34D399',
    fontSize: 11,
    fontWeight: 800,
  },
  itemMeta: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  sectionLabel: {
    margin: '6px 0 2px',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  proRow: { margin: 0, color: 'var(--text)', fontSize: 13, lineHeight: 1.4 },
  conRow: { margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.4 },
  url: { color: '#34D399', fontSize: 12, wordBreak: 'break-all' },
  card: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardTitle: { margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  body: { margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 },
  searchForm: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '0.6rem 0.85rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--text)',
    fontSize: 14,
  },
  matchForm: { width: '100%' },
  matchBtn: {
    width: '100%',
    display: 'grid',
    gap: 2,
    textAlign: 'left',
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  matchName: { color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  matchMeta: { color: 'var(--text-secondary)', fontSize: 12 },
  actions: { display: 'flex', justifyContent: 'space-between', gap: 10 },
  secondary: {
    padding: '0.6rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    background: 'transparent',
    textDecoration: 'none',
    fontWeight: 700,
    cursor: 'pointer',
  },
  danger: {
    padding: '0.6rem 1rem',
    borderRadius: 12,
    border: '1px solid #EF4444',
    color: '#EF4444',
    background: 'transparent',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
