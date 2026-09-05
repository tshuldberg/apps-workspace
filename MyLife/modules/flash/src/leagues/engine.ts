import type { LeagueScore, LeagueTier, PromotionResult, XPBreakdown } from './types';
import { getNextTier, getPreviousTier } from './tiers';

interface ReviewLogEntry {
  cardId: string;
  rating: string;
  reviewedAt: string;
}

const MAX_XP_PER_CARD_PER_DAY = 10;

export function calculateXP(
  reviewLogs: ReviewLogEntry[],
  streakDays: number,
  activityBonuses: { practiceTests: number; mcSessions: number; matchSessions: number } = { practiceTests: 0, mcSessions: 0, matchSessions: 0 },
): XPBreakdown {
  // Group reviews by card+day to enforce per-card daily cap
  const cardDayMap = new Map<string, number>();

  let reviewXP = 0;
  let bonusXP = 0;

  for (const log of reviewLogs) {
    const day = log.reviewedAt.slice(0, 10);
    const key = `${log.cardId}:${day}`;
    const current = cardDayMap.get(key) ?? 0;

    if (current >= MAX_XP_PER_CARD_PER_DAY) continue;

    const baseXP = 10;
    const bonus = (log.rating === 'good' || log.rating === 'easy') ? 5 : 0;
    const totalForCard = Math.min(baseXP + bonus, MAX_XP_PER_CARD_PER_DAY - current);

    reviewXP += Math.min(baseXP, MAX_XP_PER_CARD_PER_DAY - current);
    bonusXP += Math.max(0, totalForCard - Math.min(baseXP, MAX_XP_PER_CARD_PER_DAY - current));
    cardDayMap.set(key, current + totalForCard);
  }

  const streakXP = streakDays * 50;

  // Activity bonuses (capped)
  const testXP = Math.min(activityBonuses.practiceTests, 3) * 100;
  const mcXP = activityBonuses.mcSessions * 25;
  const matchXP = activityBonuses.matchSessions * 25;
  const activityXP = testXP + mcXP + matchXP;

  return {
    cardsReviewed: reviewLogs.length,
    reviewXP,
    bonusXP,
    streakXP,
    activityXP,
    totalXP: reviewXP + bonusXP + streakXP + activityXP,
  };
}

export function determinePromotions(
  scores: LeagueScore[],
  tier: LeagueTier,
): PromotionResult[] {
  if (scores.length === 0) return [];

  const sorted = [...scores].sort((a, b) => b.xpEarned - a.xpEarned);
  const promoteCount = Math.max(1, Math.ceil(sorted.length / 6));
  const demoteCount = Math.max(1, Math.ceil(sorted.length / 6));

  const nextTier = getNextTier(tier);
  const prevTier = getPreviousTier(tier);

  return sorted.map((score, idx): PromotionResult => {
    const rank = idx + 1;
    const promoted = nextTier !== null && rank <= promoteCount;
    const demoted = prevTier !== null && rank > sorted.length - demoteCount;

    return {
      userId: score.userId,
      previousTier: tier,
      newTier: promoted ? nextTier : demoted ? prevTier : tier,
      promoted,
      demoted,
    };
  });
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString().slice(0, 10);
}
