/**
 * Profile engine: username validation, avatar generation, badge eligibility.
 */

import type { BadgeType } from '../models/profile';

// ── Username Validation ─────────────────────────────────────────────

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < USERNAME_MIN) {
    return { valid: false, error: `Username must be at least ${USERNAME_MIN} characters` };
  }
  if (username.length > USERNAME_MAX) {
    return { valid: false, error: `Username must be at most ${USERNAME_MAX} characters` };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, error: 'Username must be lowercase alphanumeric with hyphens only' };
  }
  return { valid: true };
}

// ── Default Avatar Color ────────────────────────────────────────────

const AVATAR_COLORS = [
  '#F43F5E', '#8B5CF6', '#3B82F6', '#14B8A6', '#22C55E',
  '#F97316', '#EF4444', '#6366F1', '#EC4899', '#06B6D4',
];

/**
 * Deterministic color from username hash.
 * Same username always produces the same color.
 */
export function getDefaultAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Badge Eligibility ───────────────────────────────────────────────

interface ProfileStats {
  threadCount: number;
  replyCount: number;
  karma: number;
  accountAgeMs: number;
  isModerator: boolean;
}

const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export function getEligibleBadges(stats: ProfileStats): BadgeType[] {
  const badges: BadgeType[] = [];

  if (stats.threadCount >= 1) badges.push('first_post');
  if (stats.replyCount >= 1) badges.push('first_reply');
  if (stats.karma >= 100) badges.push('karma_100');
  if (stats.karma >= 1000) badges.push('karma_1000');
  if (stats.karma >= 10000) badges.push('karma_10000');
  if (stats.accountAgeMs >= ONE_YEAR_MS) badges.push('veteran');
  if (stats.isModerator) badges.push('moderator');
  if (stats.threadCount >= 100) badges.push('prolific');

  return badges;
}

export function getBadgeLabel(badge: BadgeType): string {
  const labels: Record<BadgeType, string> = {
    first_post: 'First Post',
    first_reply: 'First Reply',
    karma_100: '100 Karma',
    karma_1000: '1K Karma',
    karma_10000: '10K Karma',
    veteran: 'Veteran',
    moderator: 'Moderator',
    prolific: 'Prolific',
  };
  return labels[badge];
}

export function getBadgeColor(badge: BadgeType): string {
  const colorMap: Record<BadgeType, string> = {
    first_post: '#3B82F6',
    first_reply: '#14B8A6',
    karma_100: '#22C55E',
    karma_1000: '#F97316',
    karma_10000: '#EF4444',
    veteran: '#8B5CF6',
    moderator: '#F43F5E',
    prolific: '#6366F1',
  };
  return colorMap[badge];
}
