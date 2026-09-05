import type { PracticeAnswer, QuestionType, TestScoreResult } from './types';

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/[.,!?;:'"]/g, '');
}

export function scoreShortAnswer(
  userAnswer: string,
  correctAnswer: string,
  threshold = 0.8,
): boolean {
  const normalized = normalizeAnswer(userAnswer);
  const expected = normalizeAnswer(correctAnswer);
  if (!normalized || !expected) return false;
  if (normalized === expected) return true;

  const distance = levenshteinDistance(normalized, expected);
  const maxLen = Math.max(normalized.length, expected.length);
  if (maxLen === 0) return true;

  const similarity = 1 - distance / maxLen;
  return similarity >= threshold;
}

export function calculateTestScore(
  answers: PracticeAnswer[],
  cardTags?: Map<string, string[]>,
): TestScoreResult {
  const perType: Record<QuestionType, { correct: number; total: number }> = {
    mc: { correct: 0, total: 0 },
    tf: { correct: 0, total: 0 },
    short_answer: { correct: 0, total: 0 },
    fill_blank: { correct: 0, total: 0 },
  };

  let totalCorrect = 0;

  for (const answer of answers) {
    if (answer.isCorrect === null) continue;
    const bucket = perType[answer.questionType];
    if (bucket) {
      bucket.total += 1;
      if (answer.isCorrect) {
        bucket.correct += 1;
        totalCorrect += 1;
      }
    }
  }

  const totalAnswered = answers.filter((a) => a.isCorrect !== null).length;
  const scorePercent = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Find weak tags
  const tagScores = new Map<string, { correct: number; total: number }>();
  if (cardTags) {
    for (const answer of answers) {
      if (answer.isCorrect === null || !answer.sourceCardId) continue;
      const tags = cardTags.get(answer.sourceCardId) ?? [];
      for (const tag of tags) {
        const ts = tagScores.get(tag) ?? { correct: 0, total: 0 };
        ts.total += 1;
        if (answer.isCorrect) ts.correct += 1;
        tagScores.set(tag, ts);
      }
    }
  }

  const weakTags = [...tagScores.entries()]
    .filter(([, s]) => s.total >= 2 && s.correct / s.total < 0.6)
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
    .map(([tag]) => tag);

  return {
    totalScore: totalCorrect,
    maxScore: totalAnswered,
    scorePercent,
    weakTags,
    perType,
  };
}
