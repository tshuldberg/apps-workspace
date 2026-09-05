import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  browseFlashcards,
  buryFlashcard,
  listDecks,
  listFlashTags,
  suspendFlashcard,
  unsuspendFlashcard,
} from '@mylife/flash';
import type { FlashBrowserSort } from '@mylife/flash';
import { getAdapter } from '@/lib/db';

const SORTS: FlashBrowserSort[] = ['updated', 'due', 'alphabetical', 'lapses'];
const QUICK_FILTERS = [
  { label: 'Due', value: 'is:due' },
  { label: 'New', value: 'is:new' },
  { label: 'Suspended', value: 'is:suspended' },
  { label: 'Buried', value: 'is:buried' },
  { label: 'Leeches', value: 'prop:lapses>7' },
];

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' },
  line: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 },
  searchForm: { display: 'grid', gap: '0.75rem' },
  row: { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'minmax(220px, 2fr) repeat(2, minmax(160px, 1fr)) auto' },
  input: { padding: '0.7rem 0.85rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' },
  button: { background: 'var(--accent-flash)', color: 'var(--background)', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 700, cursor: 'pointer' },
  chipRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const, marginTop: '0.75rem' },
  chip: { padding: '0.45rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-secondary)', background: 'var(--surface)' },
  resultList: { display: 'grid', gap: '0.75rem' },
  resultCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1rem', display: 'grid', gap: '0.5rem' },
  resultTitle: { color: 'var(--text)', fontWeight: 600 },
  actionRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const, marginTop: '0.25rem' },
  secondaryButton: { background: 'var(--surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.5rem 0.85rem', fontWeight: 600, cursor: 'pointer' },
};

export default async function FlashBrowserPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string | string[]; q?: string | string[]; sort?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] ?? '' : params.q ?? '';
  const deckId = Array.isArray(params.deckId) ? params.deckId[0] : params.deckId;
  const requestedSort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort = SORTS.includes((requestedSort ?? 'updated') as FlashBrowserSort)
    ? (requestedSort as FlashBrowserSort)
    : 'updated';
  const db = getAdapter();
  const decks = listDecks(db);
  const tags = listFlashTags(db);
  const cards = browseFlashcards(db, { query: q, deckId: deckId ?? null, sort, limit: 150 });

  async function manageCard(formData: FormData) {
    'use server';

    const cardId = String(formData.get('cardId') ?? '');
    const actionType = String(formData.get('actionType') ?? '');
    if (!cardId) {
      return;
    }

    try {
      const actionDb = getAdapter();
      if (actionType === 'suspend') {
        suspendFlashcard(actionDb, cardId);
      } else if (actionType === 'unsuspend') {
        unsuspendFlashcard(actionDb, cardId);
      } else if (actionType === 'bury') {
        buryFlashcard(actionDb, cardId, new Date().toISOString());
      }
    } catch {
      return;
    } finally {
      revalidatePath('/flash');
      revalidatePath('/flash/browser');
      revalidatePath('/flash/decks');
      revalidatePath('/flash/stats');
      revalidatePath('/flash/settings');
    }
  }

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Search</div>
        <div style={styles.line}>
          Operators supported now: deck:, tag:, is:new|learn|review|due|suspended|buried, prop:lapses&gt;N, prop:interval&gt;N.
        </div>
        <form method="get" style={styles.searchForm}>
          <div style={styles.row}>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search cards or enter deck:Spanish tag:exam"
              style={styles.input}
            />
            <select name="deckId" defaultValue={deckId ?? ''} style={styles.input}>
              <option value="">All decks</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>{deck.name}</option>
              ))}
            </select>
            <select name="sort" defaultValue={sort} style={styles.input}>
              {SORTS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button type="submit" style={styles.button}>Apply</button>
          </div>
        </form>
        <div style={styles.chipRow}>
          {QUICK_FILTERS.map((filter) => (
            <Link key={filter.value} href={`/flash/browser?q=${encodeURIComponent(filter.value)}`} style={styles.chip}>
              {filter.label}
            </Link>
          ))}
        </div>
        <div style={styles.chipRow}>
          {tags.slice(0, 12).map((tag) => (
            <Link key={tag} href={`/flash/browser?q=${encodeURIComponent(`tag:${tag}`)}`} style={styles.chip}>
              #{tag}
            </Link>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Results</div>
        <div style={styles.line}>{cards.length} cards matched</div>
        <div style={styles.resultList}>
          {cards.length === 0 ? (
            <div style={styles.line}>No cards match the current search.</div>
          ) : cards.map((card) => (
            <div key={card.id} style={styles.resultCard}>
              <div style={styles.resultTitle}>{card.front}</div>
              <div style={styles.line}>{card.back}</div>
              <div style={styles.line}>
                {card.deckName} · {card.queue}
                {card.isDue ? ' · due now' : ''}
                {card.tags.length > 0 ? ` · ${card.tags.join(', ')}` : ''}
                {card.lapseCount > 0 ? ` · ${card.lapseCount} lapses` : ''}
              </div>
              <form action={manageCard} style={styles.actionRow}>
                <input type="hidden" name="cardId" value={card.id} />
                {card.queue === 'suspended' ? (
                  <button type="submit" name="actionType" value="unsuspend" style={styles.button}>
                    Unsuspend
                  </button>
                ) : (
                  <button type="submit" name="actionType" value="suspend" style={styles.secondaryButton}>
                    Suspend
                  </button>
                )}
                {card.queue === 'suspended' ? null : (
                  <button type="submit" name="actionType" value="bury" style={styles.secondaryButton}>
                    {card.queue === 'buried' ? 'Bury Again' : 'Bury'}
                  </button>
                )}
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
