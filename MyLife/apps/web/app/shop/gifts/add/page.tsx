import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createGift,
  listGiftPeople,
  type GiftOccasion,
  type GiftPerson,
} from '@mylife/shop';
import { getAdapter } from '@/lib/db';

const OCCASIONS: GiftOccasion[] = [
  'birthday',
  'holiday',
  'graduation',
  'housewarming',
  'thank_you',
  'other',
];

function parseCents(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function parseDateISO(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isNaN(ts) ? null : ts;
}

export default async function AddGiftPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId: preselected } = await searchParams;
  const db = getAdapter();
  const people: GiftPerson[] = (() => {
    try {
      return listGiftPeople(db);
    } catch {
      return [];
    }
  })();

  if (people.length === 0) {
    return (
      <div style={styles.page}>
        <h2 style={styles.title}>Add a person first</h2>
        <p style={styles.subtitle}>
          You need at least one gift recipient before logging a gift.
        </p>
        <Link href="/shop/gifts/add-person" style={styles.primaryLink}>
          Add a person
        </Link>
      </div>
    );
  }

  async function addGiftAction(formData: FormData) {
    'use server';
    const personId = String(formData.get('personId') ?? '').trim();
    if (!personId) return;
    const adapter = getAdapter();
    const match = listGiftPeople(adapter).find((p) => p.id === personId);
    if (!match) return;
    const itemDescription = String(formData.get('itemDescription') ?? '').trim();
    if (!itemDescription) return;
    const occasion = String(formData.get('occasion') ?? 'birthday') as GiftOccasion;
    if (!OCCASIONS.includes(occasion)) return;
    const amountCents = parseCents(String(formData.get('amount') ?? '0'));
    const giftDate =
      parseDateISO(String(formData.get('giftDate') ?? '')) ?? Date.now();
    const reactionNotes = String(formData.get('reactionNotes') ?? '').trim() || null;
    const isGroupGift = formData.get('isGroupGift') === 'on';
    const groupTotalCents = isGroupGift
      ? parseCents(String(formData.get('groupTotal') ?? '0'))
      : null;
    const myShareCents = isGroupGift
      ? parseCents(String(formData.get('myShare') ?? '0'))
      : null;

    try {
      createGift(adapter, {
        personId,
        personName: match.name,
        itemDescription,
        occasion,
        amountCents,
        giftDate,
        reactionNotes,
        isGroupGift,
        groupTotalCents,
        myShareCents,
      });
    } finally {
      revalidatePath(`/shop/gifts/${personId}`);
      revalidatePath('/shop/gifts');
    }
    redirect(`/shop/gifts/${personId}`);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.title}>Log a gift</h2>
        <p style={styles.subtitle}>
          Track what you gave, when, and how they reacted.
        </p>
      </header>

      <form action={addGiftAction} style={styles.form}>
        <label style={styles.label}>
          Person
          <select
            name="personId"
            defaultValue={preselected ?? people[0]?.id ?? ''}
            style={styles.input}
            required
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.relationship ? ` (${p.relationship})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Item
          <input
            required
            name="itemDescription"
            placeholder="Cashmere scarf"
            style={styles.input}
          />
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Occasion
            <select name="occasion" defaultValue="birthday" style={styles.input}>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {o.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Date
            <input
              name="giftDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              style={styles.input}
            />
          </label>
        </div>

        <label style={styles.label}>
          Amount (USD)
          <input
            required
            name="amount"
            type="number"
            step="0.01"
            placeholder="89.00"
            style={styles.input}
          />
        </label>

        <label style={styles.checkboxLabel}>
          <input type="checkbox" name="isGroupGift" />
          <span style={styles.checkboxText}>
            Group gift (splits cost; your share counts toward budgets)
          </span>
        </label>

        <div style={styles.rowTwo}>
          <label style={styles.label}>
            Group total (USD)
            <input
              name="groupTotal"
              type="number"
              step="0.01"
              placeholder="300.00"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            My share (USD)
            <input
              name="myShare"
              type="number"
              step="0.01"
              placeholder="50.00"
              style={styles.input}
            />
          </label>
        </div>

        <label style={styles.label}>
          Reaction notes
          <textarea
            name="reactionNotes"
            placeholder="How did they react?"
            style={{ ...styles.input, minHeight: 70 }}
          />
        </label>

        <div style={styles.actions}>
          <button type="submit" style={styles.primary}>Save gift</button>
          <Link href="/shop/gifts" style={styles.secondary}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 14 },
  header: { display: 'grid', gap: 4 },
  title: { margin: 0, color: 'var(--text)', fontSize: '1.5rem' },
  subtitle: { margin: 0, color: 'var(--text-secondary)', fontSize: 14 },
  form: { display: 'grid', gap: 10 },
  rowTwo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  label: {
    display: 'grid',
    gap: 5,
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
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
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-secondary)',
    fontSize: 13,
    padding: '6px 0',
  },
  checkboxText: { color: 'var(--text-secondary)' },
  actions: { display: 'flex', gap: 10, marginTop: 8 },
  primary: {
    padding: '0.75rem 1.1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondary: {
    padding: '0.75rem 1.1rem',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text)',
    textDecoration: 'none',
    fontWeight: 700,
  },
  primaryLink: {
    padding: '0.75rem 1.1rem',
    borderRadius: 12,
    background: '#10B981',
    color: '#0E0E13',
    textDecoration: 'none',
    fontWeight: 800,
    justifySelf: 'start',
  },
};
