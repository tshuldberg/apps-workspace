import Link from 'next/link';
import { listStoreNotes, type StoreNote } from '@mylife/shop';
import { getAdapter } from '@/lib/db';
import { ShopPanel } from '../_ui';

function summarize(n: StoreNote): string {
  const bits: string[] = [];
  if (n.returnsPolicy) bits.push('returns');
  if (n.shippingNotes) bits.push('shipping');
  if (n.rewardsNotes) bits.push('rewards');
  if (bits.length === 0) return 'Empty note. Open to add details.';
  return bits.join(' · ');
}

export default async function StoreNotesListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const db = getAdapter();
  let notes: StoreNote[] = [];
  try {
    notes = listStoreNotes(db);
  } catch {
    notes = [];
  }
  const queryStr = (q ?? '').trim();
  const filtered = queryStr
    ? notes.filter((n) =>
        n.storeName.toLowerCase().includes(queryStr.toLowerCase()),
      )
    : notes;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ShopPanel
        eyebrow="Stores"
        title="Remember the fine print"
        body="Stash returns policies, shipping quirks, and rewards perks for the stores you actually use. Local only."
      />

      <form method="get" style={styles.searchCard}>
        <input
          name="q"
          defaultValue={queryStr}
          placeholder="Search a store name"
          style={styles.input}
        />
        <button type="submit" style={styles.secondary}>Search</button>
        {queryStr ? (
          <Link
            href={`/shop/stores/${encodeURIComponent(queryStr)}`}
            style={styles.primary}
          >
            + Add or open &quot;{queryStr}&quot;
          </Link>
        ) : null}
      </form>

      {notes.length === 0 ? (
        <section style={styles.empty}>
          <h3 style={styles.emptyTitle}>No stores yet</h3>
          <p style={styles.emptyBody}>
            Type a store name above to start a note.
          </p>
        </section>
      ) : (
        filtered.map((n) => (
          <Link
            key={n.id}
            href={`/shop/stores/${encodeURIComponent(n.storeName)}`}
            style={styles.row}
          >
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={styles.rowTitle}>{n.storeName}</span>
              <span style={styles.rowMeta}>{summarize(n)}</span>
            </div>
            <span style={styles.rowChevron}>{'>'}</span>
          </Link>
        ))
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  searchCard: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  input: {
    flex: 1,
    minWidth: 200,
    padding: '0.6rem 0.85rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--text)',
    fontSize: 14,
  },
  secondary: {
    padding: '0.6rem 1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    background: 'transparent',
    fontWeight: 700,
    cursor: 'pointer',
  },
  primary: {
    padding: '0.6rem 1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    textDecoration: 'none',
    fontWeight: 800,
  },
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
  rowChevron: { color: 'var(--text-secondary)', fontSize: 18, fontWeight: 700 },
};
