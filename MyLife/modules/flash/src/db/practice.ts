import type { DatabaseAdapter } from '@mylife/db';
import type { PracticeTest, PracticeAnswer, QuestionType, TestStatus } from '../practice/types';

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

function rowToTest(row: Record<string, unknown>): PracticeTest {
  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    title: row.title as string,
    questionCount: row.question_count as number,
    timeLimitSeconds: (row.time_limit_seconds as number) ?? null,
    questionTypes: parseJsonArray(row.question_types_json) as QuestionType[],
    totalScore: (row.total_score as number) ?? null,
    maxScore: (row.max_score as number) ?? null,
    scorePercent: (row.score_percent as number) ?? null,
    timeTakenSeconds: (row.time_taken_seconds as number) ?? null,
    weakTags: parseJsonArray(row.weak_tags_json),
    status: row.status as TestStatus,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
  };
}

function rowToAnswer(row: Record<string, unknown>): PracticeAnswer {
  return {
    id: row.id as string,
    testId: row.test_id as string,
    questionIndex: row.question_index as number,
    sourceCardId: (row.source_card_id as string) ?? null,
    questionType: row.question_type as QuestionType,
    questionText: row.question_text as string,
    options: parseJsonArray(row.options_json),
    correctAnswer: row.correct_answer as string,
    userAnswer: (row.user_answer as string) ?? null,
    isCorrect: row.is_correct === null ? null : Boolean(row.is_correct),
    timeSpentSeconds: (row.time_spent_seconds as number) ?? 0,
    explanation: (row.explanation as string) ?? '',
    answeredAt: (row.answered_at as string) ?? null,
  };
}

export function createPracticeTest(
  db: DatabaseAdapter,
  deckId: string,
  questionCount: number,
  timeLimitSeconds: number | null,
  questionTypes: QuestionType[],
): PracticeTest {
  const id = createId('fl_pt');
  const now = nowIso();
  db.execute(
    `INSERT INTO fl_practice_tests (id, deck_id, question_count, time_limit_seconds, question_types_json, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'in_progress', ?)`,
    [id, deckId, questionCount, timeLimitSeconds, JSON.stringify(questionTypes), now],
  );
  return {
    id, deckId, title: 'Practice Test', questionCount, timeLimitSeconds,
    questionTypes, totalScore: null, maxScore: null, scorePercent: null,
    timeTakenSeconds: null, weakTags: [], status: 'in_progress', startedAt: now, completedAt: null,
  };
}

export function savePracticeAnswer(
  db: DatabaseAdapter,
  testId: string,
  questionIndex: number,
  sourceCardId: string | null,
  questionType: QuestionType,
  questionText: string,
  options: string[],
  correctAnswer: string,
): PracticeAnswer {
  const id = createId('fl_pa');
  db.execute(
    `INSERT INTO fl_practice_answers (id, test_id, question_index, source_card_id, question_type, question_text, options_json, correct_answer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, testId, questionIndex, sourceCardId, questionType, questionText, JSON.stringify(options), correctAnswer],
  );
  return {
    id, testId, questionIndex, sourceCardId, questionType, questionText,
    options, correctAnswer, userAnswer: null, isCorrect: null,
    timeSpentSeconds: 0, explanation: '', answeredAt: null,
  };
}

export function submitAnswer(
  db: DatabaseAdapter,
  answerId: string,
  userAnswer: string,
  isCorrect: boolean,
  timeSpentSeconds: number,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE fl_practice_answers SET user_answer = ?, is_correct = ?, time_spent_seconds = ?, answered_at = ? WHERE id = ?`,
    [userAnswer, isCorrect ? 1 : 0, timeSpentSeconds, now, answerId],
  );
}

export function completePracticeTest(
  db: DatabaseAdapter,
  testId: string,
  totalScore: number,
  maxScore: number,
  scorePercent: number,
  timeTakenSeconds: number,
  weakTags: string[],
): void {
  const now = nowIso();
  db.execute(
    `UPDATE fl_practice_tests SET total_score = ?, max_score = ?, score_percent = ?, time_taken_seconds = ?, weak_tags_json = ?, status = 'completed', completed_at = ? WHERE id = ?`,
    [totalScore, maxScore, scorePercent, timeTakenSeconds, JSON.stringify(weakTags), now, testId],
  );
}

export function abandonPracticeTest(db: DatabaseAdapter, testId: string): void {
  const now = nowIso();
  db.execute(
    `UPDATE fl_practice_tests SET status = 'abandoned', completed_at = ? WHERE id = ?`,
    [now, testId],
  );
}

export function getPracticeTestById(db: DatabaseAdapter, testId: string): PracticeTest | null {
  const row = db.query<Record<string, unknown>>(`SELECT * FROM fl_practice_tests WHERE id = ?`, [testId])[0];
  return row ? rowToTest(row) : null;
}

export function listPracticeTests(db: DatabaseAdapter, deckId?: string, limit = 100): PracticeTest[] {
  if (deckId) {
    return db.query<Record<string, unknown>>(
      `SELECT * FROM fl_practice_tests WHERE deck_id = ? ORDER BY started_at DESC LIMIT ?`,
      [deckId, limit],
    ).map(rowToTest);
  }
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_practice_tests ORDER BY started_at DESC LIMIT ?`,
    [limit],
  ).map(rowToTest);
}

export function listAnswersForTest(db: DatabaseAdapter, testId: string, limit = 200): PracticeAnswer[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_practice_answers WHERE test_id = ? ORDER BY question_index ASC LIMIT ?`,
    [testId, limit],
  ).map(rowToAnswer);
}
