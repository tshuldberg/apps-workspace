import type { DatabaseAdapter } from '@mylife/db';
import type { Conversation, ConversationMessage, ConversationMode, ConversationDifficulty, ConversationStatus, MessageRole } from '../conversation/types';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseJsonArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function rowToConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    mode: row.mode as ConversationMode,
    difficulty: row.difficulty as ConversationDifficulty,
    language: (row.language as string) ?? 'en',
    topicSummary: (row.topic_summary as string) ?? '',
    messageCount: (row.message_count as number) ?? 0,
    cardsReferenced: (row.cards_referenced as number) ?? 0,
    durationSeconds: (row.duration_seconds as number) ?? 0,
    performanceRating: (row.performance_rating as number) ?? null,
    status: row.status as ConversationStatus,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
  };
}

function rowToMessage(row: Record<string, unknown>): ConversationMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as MessageRole,
    content: row.content as string,
    cardIds: parseJsonArray(row.card_ids_json),
    tokensUsed: (row.tokens_used as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

export function createConversation(
  db: DatabaseAdapter,
  deckId: string,
  mode: ConversationMode,
  difficulty: ConversationDifficulty = 'medium',
  language = 'en',
): Conversation {
  const id = createId('fl_conv');
  const now = nowIso();
  db.execute(
    `INSERT INTO fl_conversations (id, deck_id, mode, difficulty, language, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [id, deckId, mode, difficulty, language, now],
  );
  return {
    id, deckId, mode, difficulty, language, topicSummary: '',
    messageCount: 0, cardsReferenced: 0, durationSeconds: 0,
    performanceRating: null, status: 'active', startedAt: now, completedAt: null,
  };
}

export function addConversationMessage(
  db: DatabaseAdapter,
  conversationId: string,
  role: MessageRole,
  content: string,
  cardIds: string[] = [],
  tokensUsed = 0,
): ConversationMessage {
  const id = createId('fl_msg');
  const now = nowIso();
  db.transaction(() => {
    db.execute(
      `INSERT INTO fl_conversation_messages (id, conversation_id, role, content, card_ids_json, tokens_used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, conversationId, role, content, JSON.stringify(cardIds), tokensUsed, now],
    );
    db.execute(
      `UPDATE fl_conversations SET message_count = message_count + 1 WHERE id = ?`,
      [conversationId],
    );
  });
  return { id, conversationId, role, content, cardIds, tokensUsed, createdAt: now };
}

export function completeConversation(
  db: DatabaseAdapter,
  conversationId: string,
  topicSummary: string,
  performanceRating: number | null,
  durationSeconds: number,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE fl_conversations SET status = 'completed', topic_summary = ?, performance_rating = ?, duration_seconds = ?, completed_at = ? WHERE id = ?`,
    [topicSummary, performanceRating, durationSeconds, now, conversationId],
  );
}

export function abandonConversation(db: DatabaseAdapter, conversationId: string): void {
  const now = nowIso();
  db.execute(
    `UPDATE fl_conversations SET status = 'abandoned', completed_at = ? WHERE id = ?`,
    [now, conversationId],
  );
}

export function getConversationById(db: DatabaseAdapter, conversationId: string): Conversation | null {
  const row = db.query<Record<string, unknown>>(`SELECT * FROM fl_conversations WHERE id = ?`, [conversationId])[0];
  return row ? rowToConversation(row) : null;
}

export function listConversations(db: DatabaseAdapter, deckId?: string, limit = 100): Conversation[] {
  if (deckId) {
    return db.query<Record<string, unknown>>(
      `SELECT * FROM fl_conversations WHERE deck_id = ? ORDER BY started_at DESC LIMIT ?`,
      [deckId, limit],
    ).map(rowToConversation);
  }
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_conversations ORDER BY started_at DESC LIMIT ?`,
    [limit],
  ).map(rowToConversation);
}

export function listMessagesForConversation(db: DatabaseAdapter, conversationId: string, limit = 500): ConversationMessage[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?`,
    [conversationId, limit],
  ).map(rowToMessage);
}
