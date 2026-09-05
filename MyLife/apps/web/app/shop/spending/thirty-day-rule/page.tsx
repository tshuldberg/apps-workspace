import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addToWaitList,
  listAllWaitItems,
  markBought,
  markSkipped,
  getConversionRate,
  getTotalSavedBySkipping,
  getDaysRemaining,
  isReadyForDecision,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

function formatCents(cents: number): string {
  if (!cents) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function parsePriceToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default async function ThirtyDayRulePage() {
  async function addAction(formData: FormData) {
    'use server';
    const itemName = String(formData.get('itemName') ?? '').trim();
    const priceRaw = String(formData.get('price') ?? '');
    const reason = String(formData.get('reason') ?? '').trim();
    const cents = parsePriceToCents(priceRaw);
    if (!itemName || cents == null) return;
    const adapter = getAdapter();
    try {
      addToWaitList(adapter, {
        itemName,
        priceCents: cents,
        reasonMd: reason || null,
      });
      revalidatePath('/shop/spending/thirty-day-rule');
      redirect('/shop/spending/thirty-day-rule');
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      throw err;
    }
  }

  async function buyAction(formData: FormData) {
    'use server';
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const adapter = getAdapter();
    try {
      markBought(adapter, id);
      revalidatePath('/shop/spending/thirty-day-rule');
      redirect('/shop/spending/thirty-day-rule');
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      throw err;
    }
  }

  async function skipAction(formData: FormData) {
    'use server';
    const id = String(formData.get('id') ?? '');
    if (!id) return;
    const adapter = getAdapter();
    try {
      markSkipped(adapter, id);
      revalidatePath('/shop/spending/thirty-day-rule');
      redirect('/shop/spending/thirty-day-rule');
    } catch (err) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
      throw err;
    }
  }

  const db = getAdapter();
  const allItems = listAllWaitItems(db);
  const waiting = allItems.filter((i) => i.decision === 'waiting');
  const conversion = getConversionRate(allItems);
  const saved = getTotalSavedBySkipping(allItems);
  const now = Date.now();

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <p style={styles.eyebrow}>30-day rule</p>
        <h2 style={styles.title}>Park it, then decide</h2>
        <p style={styles.subtitle}>
          Wait 30 days before buying non-essentials. If you still want it, buy.
          Otherwise, skip and keep the cash.
        </p>
      </header>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>I want to buy...</h3>
        <form action={addAction} style={styles.form}>
          <input
            name="itemName"
            placeholder="Item name"
            required
            style={styles.input}
          />
          <input
            name="price"
            placeholder="Price (e.g. 249.99)"
            inputMode="decimal"
            required
            style={styles.input}
          />
          <textarea
            name="reason"
            placeholder="Why do you want this?"
            style={{ ...styles.input, minHeight: 70 }}
          />
          <button type="submit" style={styles.primary}>
            + Add to 30-day wait
          </button>
        </form>
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Waiting ({waiting.length})</h3>
        {waiting.length === 0 ? (
          <p style={styles.empty}>
            Nothing waiting right now. Add an item above and see how you feel in 30 days.
          </p>
        ) : (
          <div style={styles.waitList}>
            {waiting.map((item) => {
              const remaining = getDaysRemaining({ addedAt: item.addedAt }, now);
              const ready = isReadyForDecision(
                { addedAt: item.addedAt, decision: item.decision },
                now,
              );
              const badgeColor = ready ? '#10B981' : '#F59E0B';
              const badgeLabel = ready ? 'Ready to decide' : `${remaining} days left`;
              return (
                <div key={item.id} style={styles.waitItem}>
                  <div style={styles.waitHeader}>
                    <div style={styles.waitName}>{item.itemName}</div>
                    <div
                      style={{
                        ...styles.countdown,
                        background: badgeColor + '22',
                        borderColor: badgeColor,
                        color: badgeColor,
                      }}
                    >
                      {badgeLabel}
                    </div>
                  </div>
                  <div style={styles.waitPrice}>{formatCents(item.priceCents)}</div>
                  {item.reasonMd ? (
                    <div style={styles.waitReason}>{item.reasonMd}</div>
                  ) : null}
                  <div style={styles.actionsRow}>
                    <form action={buyAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" style={styles.buyBtn}>Buy it</button>
                    </form>
                    <form action={skipAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" style={styles.passBtn}>Pass</button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Conversion</p>
          <p style={styles.statValue}>
            {Math.round(conversion.conversionRate * 100)}%
          </p>
          <p style={styles.statMeta}>
            {conversion.bought} bought / {conversion.decided} decided
          </p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Saved by skipping</p>
          <p style={{ ...styles.statValue, color: '#10B981' }}>
            {formatCents(saved)}
          </p>
          <p style={styles.statMeta}>{conversion.skipped} items skipped</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 16 },
  hero: {
    display: 'grid',
    gap: 8,
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
  title: { margin: 0, color: 'var(--text)', fontSize: 26, lineHeight: 1.1 },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 },
  card: {
    display: 'grid',
    gap: 12,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardTitle: { margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  form: { display: 'grid', gap: 10 },
  input: {
    padding: '0.7rem 0.85rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.25)',
    color: 'var(--text)',
    fontSize: 14,
  },
  primary: {
    padding: '0.75rem 1.1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
  },
  empty: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  waitList: { display: 'grid', gap: 12 },
  waitItem: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  waitHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  waitName: { flex: 1, color: 'var(--text)', fontSize: 15, fontWeight: 700 },
  waitPrice: { color: '#10B981', fontSize: 13, fontWeight: 700 },
  waitReason: { color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 },
  countdown: {
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 800,
  },
  actionsRow: { display: 'flex', gap: 10, marginTop: 4 },
  buyBtn: {
    padding: '0.55rem 1rem',
    borderRadius: 10,
    background: '#10B981',
    border: '1px solid #10B981',
    color: '#0E0E13',
    fontWeight: 800,
    cursor: 'pointer',
  },
  passBtn: {
    padding: '0.55rem 1rem',
    borderRadius: 10,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  statCard: {
    display: 'grid',
    gap: 4,
    padding: 16,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  statLabel: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  statValue: { margin: 0, color: 'var(--text)', fontSize: 22, fontWeight: 800 },
  statMeta: { margin: 0, color: 'var(--text-secondary)', fontSize: 11 },
};
