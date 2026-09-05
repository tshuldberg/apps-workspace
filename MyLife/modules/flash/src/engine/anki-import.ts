import type { CreateDeckInput, CreateFlashcardInput } from '../types';

// ── Anki Data Types ──────────────────────────────────────────────────
// These mirror the structure inside a .apkg (collection.anki21 SQLite DB).

/** Raw Anki note from the `notes` table */
export interface AnkiNote {
  id: number;
  /** Model (note type) ID */
  mid: number;
  /** Tab-separated field values */
  flds: string;
  /** Space-separated tags */
  tags: string;
}

/** Raw Anki card from the `cards` table */
export interface AnkiCard {
  id: number;
  nid: number;
  did: number;
  /** Card ordinal within the note */
  ord: number;
  /** Card type: 0=new, 1=learning, 2=review, 3=relearning */
  type: number;
  /** Queue: -1=suspended, -2=buried, 0=new, 1=learning, 2=review, 3=day-learn */
  queue: number;
  /** Due date (day number for review, position for new) */
  due: number;
  /** Interval in days (negative = seconds for learning cards) */
  ivl: number;
  /** Ease factor (permille, e.g. 2500 = 2.5) */
  factor: number;
  /** Number of reviews */
  reps: number;
  /** Number of lapses */
  lapses: number;
}

/** Raw Anki deck from the `decks` JSON in `col` table */
export interface AnkiDeck {
  id: number;
  name: string;
  /** Parent deck indicated by '::' separator in name */
}

/** Raw Anki model (note type) from the `models` JSON in `col` table */
export interface AnkiModel {
  id: number;
  name: string;
  /** Field names */
  flds: Array<{ name: string }>;
  /** Template type: 0 = standard, 1 = cloze */
  type: number;
}

// ── Parse Result Types ───────────────────────────────────────────────

export interface ApkgParseWarning {
  type: 'unsupported_model' | 'missing_fields' | 'empty_card' | 'unknown_queue';
  message: string;
  ankiNoteId?: number;
  ankiCardId?: number;
}

export interface AnkiSchedulingState {
  queue: 'new' | 'learning' | 'review' | 'suspended' | 'buried';
  intervalDays: number;
  ease: number;
  lapseCount: number;
  reviewCount: number;
}

export interface ApkgMetadata {
  deckCount: number;
  cardCount: number;
  noteCount: number;
  modelCount: number;
  mediaCount: number;
}

export interface ApkgParseResult {
  metadata: ApkgMetadata;
  decks: CreateDeckInput[];
  cards: Array<CreateFlashcardInput & { ankiScheduling: AnkiSchedulingState }>;
  warnings: ApkgParseWarning[];
  skippedCount: number;
}

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const ANKI_EASE_DIVISOR = 1000;

// ── Pure Functions ───────────────────────────────────────────────────

/**
 * Extract metadata from Anki data structures without doing a full parse.
 * Useful for showing a preview before committing to import.
 */
export function parseApkgMetadata(
  decks: ReadonlyArray<AnkiDeck>,
  notes: ReadonlyArray<AnkiNote>,
  cards: ReadonlyArray<AnkiCard>,
  models: ReadonlyArray<AnkiModel>,
  mediaCount: number,
): ApkgMetadata {
  return {
    deckCount: decks.length,
    cardCount: cards.length,
    noteCount: notes.length,
    modelCount: models.length,
    mediaCount,
  };
}

/**
 * Map Anki deck hierarchy to MyFlash CreateDeckInput[].
 * Anki uses '::' in deck names to indicate hierarchy (e.g., 'Languages::Japanese::Vocab').
 * We flatten the hierarchy and set parentId references.
 */
export function parseApkgDecks(
  ankiDecks: ReadonlyArray<AnkiDeck>,
): Array<CreateDeckInput & { ankiDeckId: number }> {
  // Build full hierarchy from '::' separated names
  const deckMap = new Map<string, { ankiId: number; name: string; parentName: string | null }>();

  for (const deck of ankiDecks) {
    const parts = deck.name.split('::');
    const name = parts[parts.length - 1];
    const parentName = parts.length > 1 ? parts.slice(0, -1).join('::') : null;
    deckMap.set(deck.name, { ankiId: deck.id, name, parentName });
  }

  // Sort by depth so parents are created before children
  const sorted = [...deckMap.entries()].sort(
    ([a], [b]) => a.split('::').length - b.split('::').length,
  );

  return sorted.map(([fullName, { ankiId, name, parentName }]) => ({
    name,
    description: fullName !== name ? `Imported from Anki: ${fullName}` : null,
    parentId: parentName, // Resolved to actual ID during import
    ankiDeckId: ankiId,
  }));
}

/**
 * Map Anki notes and cards to MyFlash CreateFlashcardInput[].
 * Handles basic (type 0) and cloze (type 1) models.
 */
export function parseApkgCards(
  notes: ReadonlyArray<AnkiNote>,
  cards: ReadonlyArray<AnkiCard>,
  models: ReadonlyArray<AnkiModel>,
  ankiDeckIdToFlashDeckId: ReadonlyMap<number, string>,
): ApkgParseResult['cards'] & { warnings: ApkgParseWarning[] } {
  const modelMap = new Map(models.map((m) => [m.id, m]));
  const noteMap = new Map(notes.map((n) => [n.id, n]));
  const result: ApkgParseResult['cards'] = [];
  const warnings: ApkgParseWarning[] = [];
  let skipped = 0;

  for (const card of cards) {
    const note = noteMap.get(card.nid);
    if (!note) {
      warnings.push({
        type: 'missing_fields',
        message: `Card ${card.id} references missing note ${card.nid}`,
        ankiCardId: card.id,
      });
      skipped++;
      continue;
    }

    const model = modelMap.get(note.mid);
    if (!model) {
      warnings.push({
        type: 'unsupported_model',
        message: `Note ${note.id} uses unknown model ${note.mid}`,
        ankiNoteId: note.id,
      });
      skipped++;
      continue;
    }

    const fields = note.flds.split('\x1f');
    const deckId = ankiDeckIdToFlashDeckId.get(card.did) ?? 'fl_deck_default';
    const tags = note.tags.trim().split(/\s+/).filter(Boolean);

    if (model.type === 1) {
      // Cloze model: front = cloze text, back = extra field if present
      const front = fields[0] ?? '';
      if (!front.trim()) {
        warnings.push({
          type: 'empty_card',
          message: `Cloze note ${note.id} has empty text`,
          ankiNoteId: note.id,
        });
        skipped++;
        continue;
      }

      result.push({
        deckId,
        front: convertAnkiCloze(front),
        back: fields[1]?.trim() ?? '',
        cardType: 'cloze',
        tags: [...tags, 'anki-import'],
        ankiScheduling: mapAnkiScheduling(card),
      });
    } else {
      // Standard model: first field = front, second field = back
      const front = fields[0]?.trim() ?? '';
      const back = fields[1]?.trim() ?? '';

      if (!front) {
        warnings.push({
          type: 'empty_card',
          message: `Note ${note.id} has empty front field`,
          ankiNoteId: note.id,
        });
        skipped++;
        continue;
      }

      result.push({
        deckId,
        front: stripHtml(front),
        back: stripHtml(back),
        cardType: 'basic',
        tags: [...tags, 'anki-import'],
        ankiScheduling: mapAnkiScheduling(card),
      });
    }
  }

  return Object.assign(result, { warnings });
}

/**
 * Convert Anki's scheduling state to MyFlash scheduling state.
 * Maps queue numbers, ease permille to decimal, and interval.
 */
export function mapAnkiScheduling(card: AnkiCard): AnkiSchedulingState {
  let queue: AnkiSchedulingState['queue'];
  switch (card.queue) {
    case -1:
      queue = 'suspended';
      break;
    case -2:
      queue = 'buried';
      break;
    case 0:
      queue = 'new';
      break;
    case 1:
    case 3:
      queue = 'learning';
      break;
    case 2:
      queue = 'review';
      break;
    default:
      queue = 'new';
  }

  return {
    queue,
    intervalDays: Math.max(0, card.ivl),
    ease: Math.max(MIN_EASE, card.factor / ANKI_EASE_DIVISOR || DEFAULT_EASE),
    lapseCount: card.lapses,
    reviewCount: card.reps,
  };
}

// ── Internal Helpers ─────────────────────────────────────────────────

/**
 * Convert Anki cloze syntax {{c1::answer}} to MyFlash syntax {{c1::answer}}.
 * Anki uses the same syntax, so this is mostly a passthrough with HTML stripping.
 */
function convertAnkiCloze(text: string): string {
  return stripHtml(text);
}

/**
 * Strip HTML tags from Anki card content.
 * Anki stores rich text as HTML; MyFlash uses plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
