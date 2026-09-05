import type { DatabaseAdapter } from '@mylife/db';
import {
  type BrowseFlashcardsInput,
  BrowseFlashcardsInputSchema,
  CardRatingSchema,
  CreateDeckInputSchema,
  CreateFlashcardInputSchema,
  ExportFlashDataInputSchema,
  FlashBrowserCardSchema,
  FlashDashboardSchema,
  FlashExportRecordSchema,
  FlashSettingSchema,
  FlashcardSchema,
  type CardQueue,
  type CardRating,
  type CreateDeckInput,
  type CreateFlashcardInput,
  type Deck,
  type ExportFlashDataInput,
  type FlashBrowserCard,
  type FlashDashboard,
  type FlashExportBundle,
  type FlashExportRecord,
  type FlashSetting,
  type Flashcard,
  type ReviewLog,
  type UpdateDeckInput,
  UpdateDeckInputSchema,
} from '../types';
import { buildClozeFlashcards } from '../engine/cloze';
import { parseFlashSearchQuery } from '../engine/search';
import { DEFAULT_FLASH_DECK_ID } from './schema';
import { calculateStudyStreak, scheduleFlashcard } from '../engine/scheduler';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function nextDayIso(referenceAt: string): string {
  const date = new Date(referenceAt);
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
}

function buildPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'flash-export';
}

function inferQueueFromCard(card: Pick<Flashcard, 'intervalDays' | 'lastReviewAt' | 'reviewCount'>): CardQueue {
  if (card.reviewCount === 0 && card.intervalDays === 0 && !card.lastReviewAt) {
    return 'new';
  }
  if (card.intervalDays <= 0) {
    return 'learning';
  }
  return 'review';
}

function rowToDeck(row: Record<string, unknown>): Deck {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    parentId: (row.parent_id as string) ?? null,
    isDefault: Boolean(row.is_default),
    cardCount: Number(row.card_count ?? 0),
    newCount: Number(row.new_count ?? 0),
    dueCount: Number(row.due_count ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToFlashcard(row: Record<string, unknown>): Flashcard {
  return FlashcardSchema.parse({
    id: row.id,
    noteId: row.note_id,
    deckId: row.deck_id,
    cardType: row.card_type,
    templateOrdinal: row.template_ordinal,
    front: row.front,
    back: row.back,
    tags: parseTags(row.tags_json),
    queue: row.queue,
    queueBeforeSuspend: row.queue_before_suspend ?? null,
    queueBeforeBury: row.queue_before_bury ?? null,
    buriedUntil: row.buried_until ?? null,
    intervalDays: Number(row.interval_days ?? 0),
    ease: Number(row.ease ?? 2.5),
    dueAt: (row.due_at as string) ?? null,
    lastReviewAt: (row.last_review_at as string) ?? null,
    reviewCount: Number(row.review_count ?? 0),
    lapseCount: Number(row.lapse_count ?? 0),
    starred: Boolean(row.starred),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToReviewLog(row: Record<string, unknown>): ReviewLog {
  return {
    id: row.id as string,
    cardId: row.card_id as string,
    rating: CardRatingSchema.parse(row.rating),
    scheduledBeforeAt: (row.scheduled_before_at as string) ?? null,
    scheduledAfterAt: (row.scheduled_after_at as string) ?? null,
    reviewedAt: row.reviewed_at as string,
  };
}

function rowToFlashSetting(row: Record<string, unknown>): FlashSetting {
  return FlashSettingSchema.parse({
    key: row.key,
    value: row.value,
  });
}

function rowToExportRecord(row: Record<string, unknown>): FlashExportRecord {
  return FlashExportRecordSchema.parse({
    id: row.id,
    deckId: row.deck_id ?? null,
    fileName: row.file_name,
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    cardsExported: Number(row.cards_exported ?? 0),
    mediaExported: Number(row.media_exported ?? 0),
    includeScheduling: Boolean(row.include_scheduling),
    includeMedia: Boolean(row.include_media),
    includeTags: Boolean(row.include_tags),
    exportedAt: row.exported_at,
    durationMs: Number(row.duration_ms ?? 0),
  });
}

function rowToBrowserCard(row: Record<string, unknown>, leechThreshold: number): FlashBrowserCard {
  return FlashBrowserCardSchema.parse({
    ...rowToFlashcard(row),
    deckName: row.deck_name,
    isDue: Boolean(row.is_due),
    isLeech: Number(row.lapse_count ?? 0) >= leechThreshold,
  });
}

function unburyExpiredCardsInternal(db: DatabaseAdapter, referenceAt = nowIso()): number {
  const count =
    db.query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM fl_cards
       WHERE queue = 'buried'
         AND buried_until IS NOT NULL
         AND buried_until <= ?`,
      [referenceAt],
    )[0]?.count ?? 0;

  if (count === 0) {
    return 0;
  }

  db.execute(
    `UPDATE fl_cards
     SET queue = COALESCE(
           queue_before_bury,
           CASE
             WHEN review_count = 0 AND interval_days = 0 AND last_review_at IS NULL THEN 'new'
             WHEN interval_days <= 0 THEN 'learning'
             ELSE 'review'
           END
         ),
         queue_before_bury = NULL,
         buried_until = NULL,
         updated_at = ?
     WHERE queue = 'buried'
       AND buried_until IS NOT NULL
       AND buried_until <= ?`,
    [referenceAt, referenceAt],
  );

  return count;
}

export function listDecks(db: DatabaseAdapter, referenceAt = nowIso()): Deck[] {
  unburyExpiredCardsInternal(db, referenceAt);
  return db
    .query<Record<string, unknown>>(
      `SELECT
         d.*,
         COUNT(c.id) AS card_count,
         SUM(CASE WHEN c.queue = 'new' THEN 1 ELSE 0 END) AS new_count,
         SUM(
           CASE
             WHEN c.queue NOT IN ('new', 'suspended', 'buried')
               AND c.due_at IS NOT NULL
               AND c.due_at <= ?
             THEN 1
             ELSE 0
           END
         ) AS due_count
       FROM fl_decks d
       LEFT JOIN fl_cards c ON c.deck_id = d.id
       GROUP BY d.id
       ORDER BY d.is_default DESC, d.name ASC`,
      [referenceAt],
    )
    .map(rowToDeck);
}

export function getDeckById(db: DatabaseAdapter, deckId: string, referenceAt = nowIso()): Deck | null {
  unburyExpiredCardsInternal(db, referenceAt);
  return (
    db
      .query<Record<string, unknown>>(
        `SELECT
           d.*,
           COUNT(c.id) AS card_count,
           SUM(CASE WHEN c.queue = 'new' THEN 1 ELSE 0 END) AS new_count,
           SUM(
             CASE
               WHEN c.queue NOT IN ('new', 'suspended', 'buried')
                 AND c.due_at IS NOT NULL
                 AND c.due_at <= ?
               THEN 1
               ELSE 0
             END
           ) AS due_count
         FROM fl_decks d
         LEFT JOIN fl_cards c ON c.deck_id = d.id
         WHERE d.id = ?
         GROUP BY d.id`,
        [referenceAt, deckId],
      )
      .map(rowToDeck)[0] ?? null
  );
}

export function createDeck(db: DatabaseAdapter, id: string, rawInput: CreateDeckInput): Deck {
  const input = CreateDeckInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO fl_decks (id, name, description, parent_id, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [id, input.name.trim(), input.description, input.parentId, now, now],
  );

  return getDeckById(db, id)!;
}

export function updateDeck(db: DatabaseAdapter, deckId: string, rawInput: UpdateDeckInput): Deck | null {
  const existing = getDeckById(db, deckId);
  if (!existing) {
    return null;
  }
  const input = UpdateDeckInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `UPDATE fl_decks
     SET name = ?, description = ?, parent_id = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.name?.trim() ?? existing.name,
      input.description === undefined ? existing.description : input.description,
      input.parentId === undefined ? existing.parentId : input.parentId,
      now,
      deckId,
    ],
  );

  return getDeckById(db, deckId);
}

export function createFlashcards(db: DatabaseAdapter, rawInput: CreateFlashcardInput): Flashcard[] {
  const input = CreateFlashcardInputSchema.parse(rawInput);
  const now = nowIso();
  const noteId = createId('fl_note');
  const normalizedTags = [...new Set(input.tags.map(normalizeTag).filter(Boolean))];
  const deckId = input.deckId || DEFAULT_FLASH_DECK_ID;
  const front = input.front.trim();
  const back = input.back.trim();

  let cards: Array<{
    id: string;
    front: string;
    back: string;
    templateOrdinal: number;
  }> = [
    {
      id: createId('fl_card'),
      front,
      back,
      templateOrdinal: 0,
    },
  ];

  if (input.cardType === 'reversed' && back) {
    cards = [
      cards[0],
      {
        id: createId('fl_card'),
        front: back,
        back: front,
        templateOrdinal: 1,
      },
    ];
  }

  if (input.cardType === 'cloze') {
    const clozeCards = buildClozeFlashcards(front, back);
    if (clozeCards.length === 0) {
      throw new Error('Add at least one cloze deletion.');
    }
    cards = clozeCards.map((card) => ({
      ...card,
      id: createId('fl_card'),
    }));
  }

  db.transaction(() => {
    for (const card of cards) {
      db.execute(
        `INSERT INTO fl_cards (
          id, note_id, deck_id, card_type, template_ordinal, front, back, tags_json, queue,
          queue_before_suspend, queue_before_bury, buried_until, interval_days, ease, due_at,
          last_review_at, review_count, lapse_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', NULL, NULL, NULL, 0, 2.5, NULL, NULL, 0, 0, ?, ?)`,
        [
          card.id,
          noteId,
          deckId,
          input.cardType,
          card.templateOrdinal,
          card.front,
          card.back,
          JSON.stringify(normalizedTags),
          now,
          now,
        ],
      );
    }
  });

  return listCardsForDeck(db, deckId).filter((card) => card.noteId === noteId);
}

export function listCardsForDeck(db: DatabaseAdapter, deckId: string, limit = 500): Flashcard[] {
  unburyExpiredCardsInternal(db);
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM fl_cards
       WHERE deck_id = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
      [deckId, limit],
    )
    .map(rowToFlashcard);
}

export function listFlashTags(db: DatabaseAdapter, limit = 500): string[] {
  const tagSet = new Set<string>();
  const rows = db.query<{ tags_json: string }>(
    `SELECT DISTINCT tags_json FROM fl_cards WHERE tags_json != '[]' LIMIT ?`,
    [limit],
  );
  for (const row of rows) {
    for (const tag of parseTags(row.tags_json)) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort((left, right) => left.localeCompare(right));
}

export function browseFlashcards(
  db: DatabaseAdapter,
  rawInput: Partial<BrowseFlashcardsInput> = {},
): FlashBrowserCard[] {
  const input = BrowseFlashcardsInputSchema.parse(rawInput);
  const referenceAt = input.referenceAt ?? nowIso();
  const parsed = parseFlashSearchQuery(input.query);
  const conditions: string[] = [];
  const params: unknown[] = [referenceAt];

  unburyExpiredCardsInternal(db, referenceAt);

  if (input.deckId) {
    conditions.push(`c.deck_id = ?`);
    params.push(input.deckId);
  }

  for (const token of parsed.tokens) {
    let clause = '';
    let values: unknown[] = [];

    if (token.kind === 'deck') {
      clause = `LOWER(d.name) LIKE ? ESCAPE '\\'`;
      values = [`%${escapeLike(token.value)}%`];
    } else if (token.kind === 'tag') {
      clause = `LOWER(c.tags_json) LIKE ? ESCAPE '\\'`;
      values = [`%"${escapeLike(token.value)}"%`];
    } else if (token.kind === 'state') {
      if (token.value === 'learn') {
        clause = `c.queue = 'learning'`;
      } else if (token.value === 'due') {
        clause = `c.queue NOT IN ('new', 'suspended', 'buried') AND c.due_at IS NOT NULL AND c.due_at <= ?`;
        values = [referenceAt];
      } else {
        clause = `c.queue = ?`;
        values = [token.value];
      }
    } else if (token.kind === 'property') {
      const columnMap = {
        lapses: 'c.lapse_count',
        interval: 'c.interval_days',
        ease: 'c.ease',
        reps: 'c.review_count',
      } as const;
      clause = `${columnMap[token.field]} ${token.operator} ?`;
      values = [token.value];
    } else {
      clause = `(LOWER(c.front) LIKE ? ESCAPE '\\' OR LOWER(c.back) LIKE ? ESCAPE '\\')`;
      values = [`%${escapeLike(token.value)}%`, `%${escapeLike(token.value)}%`];
    }

    if (!clause) {
      continue;
    }

    conditions.push(token.negated ? `NOT (${clause})` : clause);
    params.push(...values);
  }

  const sortSql = {
    updated: `c.updated_at DESC, c.created_at DESC`,
    created: `c.created_at DESC`,
    due: `CASE WHEN c.due_at IS NULL THEN 1 ELSE 0 END ASC, c.due_at ASC, c.updated_at DESC`,
    alphabetical: `LOWER(c.front) ASC, c.created_at DESC`,
    interval: `c.interval_days DESC, c.updated_at DESC`,
    lapses: `c.lapse_count DESC, c.updated_at DESC`,
  }[input.sort];

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .query<Record<string, unknown>>(
      `SELECT
         c.*,
         d.name AS deck_name,
         CASE
           WHEN c.queue NOT IN ('new', 'suspended', 'buried')
             AND c.due_at IS NOT NULL
             AND c.due_at <= ?
           THEN 1
           ELSE 0
         END AS is_due
       FROM fl_cards c
       JOIN fl_decks d ON d.id = c.deck_id
       ${whereSql}
       ORDER BY ${sortSql}
       LIMIT ?`,
      [...params, input.limit],
    )
    .map((row) => rowToBrowserCard(row, input.leechThreshold));
}

export function listDueFlashcards(
  db: DatabaseAdapter,
  deckId?: string,
  referenceAt = nowIso(),
  limit = 25,
): Flashcard[] {
  const conditions = [
    `(queue = 'new' OR (queue NOT IN ('suspended', 'buried') AND due_at IS NOT NULL AND due_at <= ?))`,
  ];
  const params: unknown[] = [referenceAt];

  unburyExpiredCardsInternal(db, referenceAt);

  if (deckId) {
    conditions.push(`deck_id = ?`);
    params.push(deckId);
  }

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM fl_cards
       WHERE ${conditions.join(' AND ')}
       ORDER BY CASE WHEN queue = 'new' THEN 1 ELSE 0 END ASC, COALESCE(due_at, created_at) ASC
       LIMIT ?`,
      [...params, limit],
    )
    .map(rowToFlashcard);
}

export function getFlashcardById(db: DatabaseAdapter, cardId: string): Flashcard | null {
  const row = db.query<Record<string, unknown>>(`SELECT * FROM fl_cards WHERE id = ?`, [cardId])[0];
  return row ? rowToFlashcard(row) : null;
}

export function rateFlashcard(
  db: DatabaseAdapter,
  cardId: string,
  rawRating: CardRating,
  reviewedAt = nowIso(),
): Flashcard | null {
  const card = getFlashcardById(db, cardId);
  if (!card) {
    return null;
  }
  const rating = CardRatingSchema.parse(rawRating);
  const next = scheduleFlashcard(card, rating, reviewedAt);
  const reviewLogId = createId('fl_review_log');
  const shouldBurySiblings = (getFlashSetting(db, 'autoBurySiblings') ?? '1') !== '0';
  const buryUntil = nextDayIso(reviewedAt);

  db.transaction(() => {
    db.execute(
      `UPDATE fl_cards
       SET queue = ?, queue_before_bury = NULL, buried_until = NULL, interval_days = ?, ease = ?,
           due_at = ?, last_review_at = ?, review_count = ?, lapse_count = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.queue,
        next.intervalDays,
        next.ease,
        next.dueAt,
        next.lastReviewAt,
        next.reviewCount,
        next.lapseCount,
        reviewedAt,
        cardId,
      ],
    );

    db.execute(
      `INSERT INTO fl_review_logs (
        id, card_id, rating, scheduled_before_at, scheduled_after_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        reviewLogId,
        cardId,
        rating,
        JSON.stringify({
          queue: card.queue,
          intervalDays: card.intervalDays,
          ease: card.ease,
          dueAt: card.dueAt,
          lastReviewAt: card.lastReviewAt,
          reviewCount: card.reviewCount,
          lapseCount: card.lapseCount,
        }),
        next.dueAt,
        reviewedAt,
      ],
    );

    if (shouldBurySiblings) {
      db.execute(
        `UPDATE fl_cards
         SET queue_before_bury = CASE WHEN queue = 'buried' THEN queue_before_bury ELSE queue END,
             queue = CASE WHEN queue = 'suspended' THEN queue ELSE 'buried' END,
             buried_until = CASE WHEN queue = 'suspended' THEN buried_until ELSE ? END,
             updated_at = ?
         WHERE note_id = ?
           AND id != ?
           AND queue != 'suspended'`,
        [buryUntil, reviewedAt, card.noteId, cardId],
      );
    }
  });

  return getFlashcardById(db, cardId);
}

export function suspendFlashcard(db: DatabaseAdapter, cardId: string): Flashcard | null {
  const card = getFlashcardById(db, cardId);
  if (!card) {
    return null;
  }
  if (card.queue === 'suspended') {
    return card;
  }

  const now = nowIso();
  db.execute(
    `UPDATE fl_cards
     SET queue_before_suspend = ?, queue = 'suspended', updated_at = ?
     WHERE id = ?`,
    [card.queue, now, cardId],
  );

  return getFlashcardById(db, cardId);
}

export function unsuspendFlashcard(db: DatabaseAdapter, cardId: string): Flashcard | null {
  const card = getFlashcardById(db, cardId);
  if (!card) {
    return null;
  }
  if (card.queue !== 'suspended') {
    return card;
  }

  const restoredQueue = card.queueBeforeSuspend ?? inferQueueFromCard(card);
  const now = nowIso();
  db.execute(
    `UPDATE fl_cards
     SET queue = ?, queue_before_suspend = NULL, updated_at = ?
     WHERE id = ?`,
    [restoredQueue, now, cardId],
  );

  return getFlashcardById(db, cardId);
}

export function buryFlashcard(
  db: DatabaseAdapter,
  cardId: string,
  referenceAt = nowIso(),
): Flashcard | null {
  const card = getFlashcardById(db, cardId);
  if (!card) {
    return null;
  }
  if (card.queue === 'suspended') {
    return card;
  }

  db.execute(
    `UPDATE fl_cards
     SET queue_before_bury = CASE WHEN queue = 'buried' THEN queue_before_bury ELSE queue END,
         queue = 'buried',
         buried_until = ?,
         updated_at = ?
     WHERE id = ?`,
    [nextDayIso(referenceAt), referenceAt, cardId],
  );

  return getFlashcardById(db, cardId);
}

export function buryFlashNote(
  db: DatabaseAdapter,
  cardId: string,
  referenceAt = nowIso(),
): Flashcard[] {
  const card = getFlashcardById(db, cardId);
  if (!card) {
    return [];
  }

  db.execute(
    `UPDATE fl_cards
     SET queue_before_bury = CASE WHEN queue = 'buried' THEN queue_before_bury ELSE queue END,
         queue = CASE WHEN queue = 'suspended' THEN queue ELSE 'buried' END,
         buried_until = CASE WHEN queue = 'suspended' THEN buried_until ELSE ? END,
         updated_at = ?
     WHERE note_id = ?
       AND queue != 'suspended'`,
    [nextDayIso(referenceAt), referenceAt, card.noteId],
  );

  return db
    .query<Record<string, unknown>>(`SELECT * FROM fl_cards WHERE note_id = ? ORDER BY template_ordinal ASC`, [card.noteId])
    .map(rowToFlashcard);
}

export function unburyFlashcards(db: DatabaseAdapter, referenceAt = nowIso()): number {
  return unburyExpiredCardsInternal(db, referenceAt);
}

export function listReviewLogsForCard(db: DatabaseAdapter, cardId: string, limit = 200): ReviewLog[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM fl_review_logs WHERE card_id = ? ORDER BY reviewed_at DESC LIMIT ?`,
      [cardId, limit],
    )
    .map(rowToReviewLog);
}

export function getFlashSetting(db: DatabaseAdapter, key: string): string | null {
  const row = db.query<{ value: string }>(`SELECT value FROM fl_settings WHERE key = ?`, [key])[0];
  return row?.value ?? null;
}

export function setFlashSetting(db: DatabaseAdapter, key: string, value: string): FlashSetting {
  db.execute(
    `INSERT INTO fl_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );

  return FlashSettingSchema.parse({ key, value });
}

export function listFlashSettings(db: DatabaseAdapter): FlashSetting[] {
  return db
    .query<Record<string, unknown>>(`SELECT key, value FROM fl_settings ORDER BY key ASC`)
    .map(rowToFlashSetting);
}

export function exportFlashData(
  db: DatabaseAdapter,
  rawInput: Partial<ExportFlashDataInput> = {},
): FlashExportBundle {
  const input = ExportFlashDataInputSchema.parse(rawInput);
  const startedAt = Date.now();
  const exportedAt = nowIso();
  const deck = input.deckId ? getDeckById(db, input.deckId) : null;
  const decks = input.deckId ? (deck ? [deck] : []) : listDecks(db, exportedAt);
  const cardRows = input.deckId
    ? db.query<Record<string, unknown>>(
        `SELECT * FROM fl_cards WHERE deck_id = ? ORDER BY created_at ASC, template_ordinal ASC`,
        [input.deckId],
      )
    : db.query<Record<string, unknown>>(
        `SELECT * FROM fl_cards ORDER BY deck_id ASC, created_at ASC, template_ordinal ASC`,
      );
  const cards = cardRows.map(rowToFlashcard).map((card) => {
    const withoutScheduling = input.includeScheduling
      ? card
      : {
          ...card,
          queue: 'new' as const,
          queueBeforeSuspend: null,
          queueBeforeBury: null,
          buriedUntil: null,
          intervalDays: 0,
          ease: 2.5,
          dueAt: null,
          lastReviewAt: null,
          reviewCount: 0,
          lapseCount: 0,
        };

    return input.includeTags ? withoutScheduling : { ...withoutScheduling, tags: [] };
  });
  const cardIds = cards.map((card) => card.id);
  let reviewLogs: ReviewLog[] = [];
  if (input.includeScheduling && cardIds.length > 0) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
      const batch = cardIds.slice(i, i + BATCH_SIZE);
      const rows = db
        .query<Record<string, unknown>>(
          `SELECT * FROM fl_review_logs
           WHERE card_id IN (${buildPlaceholders(batch.length)})
           ORDER BY reviewed_at DESC`,
          batch,
        )
        .map(rowToReviewLog);
      reviewLogs.push(...rows);
    }
  }
  const settings = listFlashSettings(db);
  const exportPreview = {
    deck,
    decks,
    cards,
    reviewLogs,
    settings,
  };
  const fileName = `${sanitizeFilePart(deck?.name ?? 'flash-collection')}-${exportedAt.slice(0, 10)}.json`;
  const durationMs = Date.now() - startedAt;
  const fileSizeBytes = new TextEncoder().encode(JSON.stringify(exportPreview)).length;
  const exportRecord = FlashExportRecordSchema.parse({
    id: createId('fl_export'),
    deckId: deck?.id ?? null,
    fileName,
    fileSizeBytes,
    cardsExported: cards.length,
    mediaExported: 0,
    includeScheduling: input.includeScheduling,
    includeMedia: input.includeMedia,
    includeTags: input.includeTags,
    exportedAt,
    durationMs,
  });

  db.execute(
    `INSERT INTO fl_export_records (
      id, deck_id, file_name, file_size_bytes, cards_exported, media_exported,
      include_scheduling, include_media, include_tags, exported_at, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exportRecord.id,
      exportRecord.deckId,
      exportRecord.fileName,
      exportRecord.fileSizeBytes,
      exportRecord.cardsExported,
      exportRecord.mediaExported,
      exportRecord.includeScheduling ? 1 : 0,
      exportRecord.includeMedia ? 1 : 0,
      exportRecord.includeTags ? 1 : 0,
      exportRecord.exportedAt,
      exportRecord.durationMs,
    ],
  );

  return {
    exportRecord,
    deck,
    decks,
    cards,
    reviewLogs,
    settings,
  };
}

export function listFlashExportRecords(db: DatabaseAdapter, limit = 50): FlashExportRecord[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM fl_export_records ORDER BY exported_at DESC LIMIT ?`,
      [limit],
    )
    .map(rowToExportRecord);
}

export function undoLastRating(
  db: DatabaseAdapter,
  cardId: string,
): { undone: boolean; restoredCardId?: string } {
  const log = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_review_logs WHERE card_id = ? ORDER BY reviewed_at DESC LIMIT 1`,
    [cardId],
  )[0];

  if (!log) return { undone: false };

  const beforeRaw = log.scheduled_before_at as string | null;
  if (!beforeRaw) return { undone: false };

  let before: {
    queue: string;
    intervalDays: number;
    ease: number;
    dueAt: string | null;
    lastReviewAt: string | null;
    reviewCount: number;
    lapseCount: number;
  };
  try {
    before = JSON.parse(beforeRaw);
  } catch {
    return { undone: false };
  }

  const now = nowIso();
  db.transaction(() => {
    db.execute(`DELETE FROM fl_review_logs WHERE id = ?`, [log.id]);
    db.execute(
      `UPDATE fl_cards
       SET queue = ?, interval_days = ?, ease = ?, due_at = ?,
           last_review_at = ?, review_count = ?, lapse_count = ?, updated_at = ?
       WHERE id = ?`,
      [
        before.queue,
        before.intervalDays,
        before.ease,
        before.dueAt,
        before.lastReviewAt,
        before.reviewCount,
        before.lapseCount,
        now,
        cardId,
      ],
    );
  });

  return { undone: true, restoredCardId: cardId };
}

export function starFlashcard(db: DatabaseAdapter, cardId: string): Flashcard | null {
  const card = getFlashcardById(db, cardId);
  if (!card) return null;
  db.execute(`UPDATE fl_cards SET starred = 1, updated_at = ? WHERE id = ?`, [nowIso(), cardId]);
  return getFlashcardById(db, cardId);
}

export function unstarFlashcard(db: DatabaseAdapter, cardId: string): Flashcard | null {
  const card = getFlashcardById(db, cardId);
  if (!card) return null;
  db.execute(`UPDATE fl_cards SET starred = 0, updated_at = ? WHERE id = ?`, [nowIso(), cardId]);
  return getFlashcardById(db, cardId);
}

export function listStarredFlashcards(db: DatabaseAdapter, deckId?: string): Flashcard[] {
  const conditions = ['starred = 1'];
  const params: unknown[] = [];
  if (deckId) {
    conditions.push('deck_id = ?');
    params.push(deckId);
  }
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM fl_cards WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`,
      params,
    )
    .map(rowToFlashcard);
}

export function getLastStudiedDeck(
  db: DatabaseAdapter,
  referenceAt = nowIso(),
): { deckId: string; deckName: string; lastStudiedAt: string; dueCount: number; totalCount: number } | null {
  const row = db.query<Record<string, unknown>>(
    `SELECT
       d.id AS deck_id,
       d.name AS deck_name,
       MAX(r.reviewed_at) AS last_reviewed_at
     FROM fl_review_logs r
     JOIN fl_cards c ON c.id = r.card_id
     JOIN fl_decks d ON d.id = c.deck_id
     GROUP BY d.id
     ORDER BY last_reviewed_at DESC
     LIMIT 1`,
  )[0];

  if (!row) return null;

  const deckId = row.deck_id as string;
  const deckName = row.deck_name as string;
  const lastStudiedAt = row.last_reviewed_at as string;

  const counts = db.query<{ total: number; due: number }>(
    `SELECT
       COUNT(*) AS total,
       SUM(
         CASE
           WHEN queue NOT IN ('suspended', 'buried')
             AND (queue = 'new' OR (due_at IS NOT NULL AND due_at <= ?))
           THEN 1
           ELSE 0
         END
       ) AS due
     FROM fl_cards
     WHERE deck_id = ?`,
    [referenceAt, deckId],
  )[0] ?? { total: 0, due: 0 };

  return {
    deckId,
    deckName,
    lastStudiedAt,
    dueCount: Number(counts.due),
    totalCount: Number(counts.total),
  };
}

export function getFlashDashboard(
  db: DatabaseAdapter,
  referenceDate = dateOnly(nowIso()),
): FlashDashboard {
  const referenceAt = `${referenceDate}T23:59:59.999Z`;
  unburyExpiredCardsInternal(db, referenceAt);

  const deckCount = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM fl_decks`)[0]?.count ?? 0;
  const cardCount = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM fl_cards`)[0]?.count ?? 0;
  const newCount = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM fl_cards WHERE queue = 'new'`)[0]?.count ?? 0;
  const dueCount =
    db.query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM fl_cards
       WHERE queue NOT IN ('new', 'suspended', 'buried')
         AND due_at IS NOT NULL
         AND due_at <= ?`,
      [referenceAt],
    )[0]?.count ?? 0;
  const reviewedToday =
    db.query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM fl_review_logs
       WHERE substr(reviewed_at, 1, 10) = ?`,
      [referenceDate],
    )[0]?.count ?? 0;
  const dailyTarget = Number(getFlashSetting(db, 'dailyStudyTarget') ?? '1');
  const studyDates = db
    .query<{ review_date: string }>(
      `SELECT substr(reviewed_at, 1, 10) as review_date
       FROM fl_review_logs
       GROUP BY substr(reviewed_at, 1, 10)
       HAVING COUNT(*) >= ?
       ORDER BY review_date DESC`,
      [dailyTarget],
    )
    .map((row) => row.review_date);
  const streak = calculateStudyStreak(studyDates, referenceDate);

  return FlashDashboardSchema.parse({
    deckCount,
    cardCount,
    newCount,
    dueCount,
    reviewedToday,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
  });
}
