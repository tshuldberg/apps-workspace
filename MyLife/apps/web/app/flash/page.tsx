import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  buryFlashNote,
  buryFlashcard,
  getFlashDashboard,
  listDecks,
  listDueFlashcards,
  rateFlashcard,
  suspendFlashcard,
} from '@mylife/flash';
import type { CardRating } from '@mylife/flash';
import { getAdapter } from '@/lib/db';

const RATINGS: CardRating[] = ['again', 'hard', 'good', 'easy'];

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  statValue: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-flash)' },
  small: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' },
  chipRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const, marginTop: '0.75rem' },
  chip: { padding: '0.45rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-secondary)', background: 'var(--surface)' },
  answerBox: { marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' },
  actionRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const, marginTop: '1rem' },
  ratingRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const, marginTop: '1rem' },
  button: { background: 'var(--accent-flash)', color: 'var(--background)', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.55rem 0.9rem', fontWeight: 600, cursor: 'pointer' },
};

export default async function FlashPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string | string[] }>;
}) {
  const params = await searchParams;
  const selectedDeckId = Array.isArray(params.deckId) ? params.deckId[0] : params.deckId;
  const db = getAdapter();
  const decks = listDecks(db);
  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null;
  const dueCards = listDueFlashcards(db, selectedDeck?.id, new Date().toISOString(), 20);
  const currentCard = dueCards[0] ?? null;
  const dashboard = getFlashDashboard(db);

  async function submitRating(formData: FormData) {
    'use server';

    const cardId = String(formData.get('cardId') ?? '');
    const rating = String(formData.get('rating') ?? '') as CardRating;
    if (!cardId || !RATINGS.includes(rating)) {
      return;
    }

    try {
      rateFlashcard(getAdapter(), cardId, rating, new Date().toISOString());
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
      } else if (actionType === 'bury') {
        buryFlashcard(actionDb, cardId, new Date().toISOString());
      } else if (actionType === 'bury-note') {
        buryFlashNote(actionDb, cardId, new Date().toISOString());
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
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.dueCount}</div>
          <div style={styles.small}>Due reviews</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.newCount}</div>
          <div style={styles.small}>New cards</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.currentStreak}</div>
          <div style={styles.small}>Current streak</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Deck filter</div>
        <div style={styles.chipRow}>
          <Link href="/flash" style={styles.chip}>All decks</Link>
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/flash?deckId=${encodeURIComponent(deck.id)}`}
              style={{
                ...styles.chip,
                color: deck.id === selectedDeck?.id ? 'var(--background)' : 'var(--text-secondary)',
                background: deck.id === selectedDeck?.id ? 'var(--accent-flash)' : 'var(--surface)',
                borderColor: deck.id === selectedDeck?.id ? 'var(--accent-flash)' : 'var(--border)',
              }}
            >
              {deck.name}
            </Link>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>
          {selectedDeck ? `${selectedDeck.name} study` : 'Next card'}
        </div>
        {!currentCard ? (
          <div style={styles.small}>All caught up for now. Add more cards in Decks or come back when reviews are due.</div>
        ) : (
          <>
            <div style={styles.small}>Prompt</div>
            <div style={{ color: 'var(--text)', fontSize: '1.8rem', fontWeight: 700 }}>
              {currentCard.front}
            </div>
            <div style={styles.small}>
              {currentCard.cardType}
              {currentCard.tags.length > 0 ? ` · ${currentCard.tags.join(', ')}` : ''}
            </div>
            <div style={styles.answerBox}>
              <div style={styles.small}>Answer</div>
              <div style={{ color: 'var(--text)', fontSize: '1.2rem', fontWeight: 600 }}>
                {currentCard.back || 'No answer yet'}
              </div>
            </div>
            <form action={manageCard} style={styles.actionRow}>
              <input type="hidden" name="cardId" value={currentCard.id} />
              <button type="submit" name="actionType" value="suspend" style={styles.secondaryButton}>
                Suspend
              </button>
              <button type="submit" name="actionType" value="bury" style={styles.secondaryButton}>
                Bury Card
              </button>
              <button type="submit" name="actionType" value="bury-note" style={styles.secondaryButton}>
                Bury Note
              </button>
            </form>
            <form action={submitRating} style={styles.ratingRow}>
              <input type="hidden" name="cardId" value={currentCard.id} />
              {RATINGS.map((rating) => (
                <button key={rating} type="submit" name="rating" value={rating} style={styles.button}>
                  {rating.charAt(0).toUpperCase() + rating.slice(1)}
                </button>
              ))}
            </form>
          </>
        )}
      </div>
    </div>
  );
}