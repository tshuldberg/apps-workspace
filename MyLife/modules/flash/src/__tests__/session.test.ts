import { describe, it, expect } from 'vitest';
import {
  detectSessions,
  createSessionSummary,
  estimateSessionDuration,
  getOptimalStudyTime,
  calculateSessionXP,
} from '../engine/session';
import type { StudySession } from '../engine/session';

describe('detectSessions', () => {
  it('returns empty array for no logs', () => {
    expect(detectSessions([])).toEqual([]);
  });

  it('groups consecutive reviews into one session', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'easy' as const, reviewedAt: '2026-03-20T10:01:00Z' },
      { rating: 'hard' as const, reviewedAt: '2026-03-20T10:02:00Z' },
    ];
    const sessions = detectSessions(logs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].cardsReviewed).toBe(3);
  });

  it('splits sessions at 5+ minute gaps', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:01:00Z' },
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:10:00Z' }, // 9 min gap
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:11:00Z' },
    ];
    const sessions = detectSessions(logs);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].cardsReviewed).toBe(2);
    expect(sessions[1].cardsReviewed).toBe(2);
  });

  it('handles unsorted input', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:02:00Z' },
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:01:00Z' },
    ];
    const sessions = detectSessions(logs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].startedAt).toBe('2026-03-20T10:00:00Z');
    expect(sessions[0].endedAt).toBe('2026-03-20T10:02:00Z');
  });

  it('calculates accuracy per session', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'again' as const, reviewedAt: '2026-03-20T10:01:00Z' },
    ];
    const sessions = detectSessions(logs);
    expect(sessions[0].accuracy).toBe(0.5);
    expect(sessions[0].correctCount).toBe(1);
    expect(sessions[0].incorrectCount).toBe(1);
  });

  it('counts lapse cards', () => {
    const logs = [
      { rating: 'again' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'again' as const, reviewedAt: '2026-03-20T10:01:00Z' },
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:02:00Z' },
    ];
    const sessions = detectSessions(logs);
    expect(sessions[0].lapseCards).toBe(2);
  });
});

describe('createSessionSummary', () => {
  it('creates summary from a set of logs', () => {
    const logs = [
      { rating: 'good' as const, reviewedAt: '2026-03-20T10:02:00Z' },
      { rating: 'easy' as const, reviewedAt: '2026-03-20T10:00:00Z' },
      { rating: 'hard' as const, reviewedAt: '2026-03-20T10:01:00Z' },
    ];
    const summary = createSessionSummary(logs);
    expect(summary.cardsReviewed).toBe(3);
    expect(summary.startedAt).toBe('2026-03-20T10:00:00Z');
    expect(summary.endedAt).toBe('2026-03-20T10:02:00Z');
    expect(summary.durationMinutes).toBe(2);
  });
});

describe('estimateSessionDuration', () => {
  it('uses default pace for no history', () => {
    const result = estimateSessionDuration(20, []);
    expect(result.dueCards).toBe(20);
    expect(result.avgSecondsPerCard).toBe(8);
    expect(result.estimatedMinutes).toBeCloseTo(2.7, 0);
  });

  it('uses historical pace when available', () => {
    const pastSessions: StudySession[] = [
      {
        startedAt: '2026-03-20T10:00:00Z',
        endedAt: '2026-03-20T10:05:00Z',
        durationMinutes: 5,
        cardsReviewed: 30,
        newCards: 0,
        reviewCards: 30,
        lapseCards: 0,
        correctCount: 25,
        incorrectCount: 5,
        accuracy: 0.83,
      },
    ];
    const result = estimateSessionDuration(30, pastSessions);
    expect(result.avgSecondsPerCard).toBe(10); // 5min * 60s / 30 cards
    expect(result.estimatedMinutes).toBe(5); // 30 cards * 10s / 60
  });
});

describe('getOptimalStudyTime', () => {
  it('returns empty array for no sessions', () => {
    expect(getOptimalStudyTime([])).toEqual([]);
  });

  it('skips trivial sessions (< 3 cards)', () => {
    const sessions: StudySession[] = [
      makeSession('2026-03-20T10:00:00Z', 2, 1.0),
    ];
    expect(getOptimalStudyTime(sessions)).toEqual([]);
  });

  it('ranks hours by accuracy', () => {
    const sessions: StudySession[] = [
      makeSession('2026-03-20T10:00:00Z', 10, 0.9), // 10 AM
      makeSession('2026-03-20T14:00:00Z', 10, 0.7), // 2 PM
      makeSession('2026-03-21T10:00:00Z', 10, 0.8), // 10 AM again
    ];
    const result = getOptimalStudyTime(sessions);
    expect(result[0].hour).toBe(10); // 10 AM has avg 0.85
    expect(result[0].sessionCount).toBe(2);
  });
});

describe('calculateSessionXP', () => {
  const session: StudySession = {
    startedAt: '2026-03-20T10:00:00Z',
    endedAt: '2026-03-20T10:05:00Z',
    durationMinutes: 5,
    cardsReviewed: 10,
    newCards: 0,
    reviewCards: 10,
    lapseCards: 2,
    correctCount: 8,
    incorrectCount: 2,
    accuracy: 0.8,
  };

  it('awards base XP per card', () => {
    const xp = calculateSessionXP(session, 0);
    expect(xp.cardsReviewed).toBe(100); // 10 cards * 10 XP
  });

  it('awards correct bonus', () => {
    const xp = calculateSessionXP(session, 0);
    expect(xp.correctBonus).toBe(40); // 8 correct * 5 XP
  });

  it('applies streak multiplier', () => {
    const xp = calculateSessionXP(session, 5);
    expect(xp.streakBonus).toBe(70); // (100+40) * 0.5 = 70
  });

  it('caps streak multiplier at 100%', () => {
    const xp = calculateSessionXP(session, 20);
    expect(xp.streakBonus).toBe(140); // (100+40) * 1.0 = 140
  });

  it('returns zero streak bonus with no streak', () => {
    const xp = calculateSessionXP(session, 0);
    expect(xp.streakBonus).toBe(0);
  });

  it('calculates total XP correctly', () => {
    const xp = calculateSessionXP(session, 5);
    expect(xp.totalXP).toBe(xp.cardsReviewed + xp.correctBonus + xp.streakBonus);
  });
});

// Helper
function makeSession(startedAt: string, cards: number, accuracy: number): StudySession {
  return {
    startedAt,
    endedAt: startedAt,
    durationMinutes: 5,
    cardsReviewed: cards,
    newCards: 0,
    reviewCards: cards,
    lapseCards: 0,
    correctCount: Math.round(cards * accuracy),
    incorrectCount: cards - Math.round(cards * accuracy),
    accuracy,
  };
}
