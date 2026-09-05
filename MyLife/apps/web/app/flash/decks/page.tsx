import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createDeck, createFlashcards, listCardsForDeck, listDecks } from '@mylife/flash';
import type { FlashCardType } from '@mylife/flash';
import { getAdapter } from '@/lib/db';

const CARD_TYPES: FlashCardType[] = ['basic', 'reversed', 'cloze'];

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' },
  form: { display: 'grid', gap: '0.75rem' },
  row: { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' },
  input: { padding: '0.7rem 0.85rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' },
  textarea: { minHeight: '140px', resize: 'vertical' as const },
  button: { background: 'var(--accent-flash)', color: 'var(--background)', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 700, cursor: 'pointer' },
  small: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 },
  list: { display: 'grid', gap: '0.75rem' },
};

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default async function FlashDecksPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedDeckId = Array.isArray(params.deckId) ? params.deckId[0] : params.deckId;
  const db = getAdapter();
  const decks = listDecks(db);
  const activeDeck = decks.find((deck) => deck.id === requestedDeckId) ?? decks[0] ?? null;
  const cards = activeDeck ? listCardsForDeck(db, activeDeck.id).slice(0, 10) : [];

  async function addDeck(formData: FormData) {
    'use server';

    const name = String(formData.get('name') ?? '').trim();
    if (!name) {
      return;
    }

    try {
      createDeck(getAdapter(), crypto.randomUUID(), {
        name,
        description: String(formData.get('description') ?? '').trim() || null,
      });
    } catch {
      return;
    } finally {
      revalidatePath('/flash');
      revalidatePath('/flash/decks');
      revalidatePath('/flash/stats');
      revalidatePath('/flash/settings');
    }
  }

  async function addCard(formData: FormData) {
    'use server';

    const deckId = String(formData.get('deckId') ?? '').trim();
    const front = String(formData.get('front') ?? '').trim();
    const back = String(formData.get('back') ?? '').trim();
    const cardType = String(formData.get('cardType') ?? 'basic') as FlashCardType;
    if (!deckId || !front || !CARD_TYPES.includes(cardType)) {
      return;
    }

    try {
      createFlashcards(getAdapter(), {
        deckId,
        front,
        back,
        cardType,
        tags: splitTags(String(formData.get('tags') ?? '')),
      });
    } catch {
      return;
    } finally {
      revalidatePath('/flash');
      revalidatePath('/flash/decks');
      revalidatePath('/flash/stats');
    }
  }

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Create deck</div>
        <form action={addDeck} style={styles.form}>
          <div style={styles.row}>
            <input name="name" placeholder="Deck name" style={styles.input} />
            <input name="description" placeholder="Description (optional)" style={styles.input} />
          </div>
          <button type="submit" style={styles.button}>Save deck</button>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Deck browser</div>
        <div style={styles.list}>
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/flash/decks?deckId=${encodeURIComponent(deck.id)}`}
              style={{
                ...styles.card,
                marginBottom: 0,
                textDecoration: 'none',
                borderColor: deck.id === activeDeck?.id ? 'var(--accent-flash)' : 'var(--border)',
              }}
            >
              <div style={{ color: 'var(--text)', fontWeight: 600 }}>{deck.name}</div>
              <div style={styles.small}>{deck.cardCount} cards · {deck.newCount} new · {deck.dueCount} due</div>
            </Link>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Add card</div>
        {!activeDeck ? (
          <div style={styles.small}>Create a deck first.</div>
        ) : (
          <form action={addCard} style={styles.form}>
            <input type="hidden" name="deckId" value={activeDeck.id} />
            <div style={styles.small}>Target deck: {activeDeck.name}</div>
            <div style={styles.small}>Cloze syntax: {'{{c1::answer}}'} creates one card per cloze marker.</div>
            <div style={styles.row}>
              <select name="cardType" defaultValue="basic" style={styles.input}>
                {CARD_TYPES.map((cardType) => (
                  <option key={cardType} value={cardType}>{cardType}</option>
                ))}
              </select>
              <input name="tags" placeholder="Tags, comma separated" style={styles.input} />
            </div>
            <input name="front" placeholder="Front" style={styles.input} />
            <textarea name="back" placeholder="Back" style={{ ...styles.input, ...styles.textarea }} />
            <button type="submit" style={styles.button}>Save card</button>
          </form>
        )}
      </div>

      {activeDeck ? (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>{activeDeck.name} recent cards</div>
          <div style={styles.list}>
            {cards.length === 0 ? (
              <div style={styles.small}>No cards yet in this deck.</div>
            ) : cards.map((card) => (
              <div key={card.id} style={{ ...styles.card, marginBottom: 0 }}>
                <div style={{ color: 'var(--text)', fontWeight: 600 }}>{card.front}</div>
                <div style={styles.small}>
                  {card.cardType}
                  {card.queue !== 'new' ? ` · ${card.queue}` : ''}
                  {card.templateOrdinal === 1 ? ' · reverse' : ''}
                  {card.cardType === 'cloze' ? ` · cloze ${card.templateOrdinal + 1}` : ''}
                  {card.tags.length > 0 ? ` · ${card.tags.join(', ')}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
