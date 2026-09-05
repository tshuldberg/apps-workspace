/**
 * @mylife/auth -- Password validation with tiered policy.
 *
 * Policy:
 *   - Under 16 chars: min 8 chars, require 1 uppercase, 1 lowercase,
 *     1 number, 1 special character.
 *   - 16+ chars: just need 16+ chars of any mix (passphrase-friendly).
 *   - Always allowed: letters, numbers, symbols, spaces.
 *
 * Also provides strength scoring and passphrase generation.
 */

import type { PasswordStrength, PasswordValidationResult } from './types';

// ── Constants ───────────────────────────────────────────────────────

const MIN_LENGTH = 8;
const PASSPHRASE_THRESHOLD = 16;

const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

// ── Password Validation ─────────────────────────────────────────────

/**
 * Validate a password against the tiered policy.
 *
 * Under 16 chars: 8+ chars with uppercase, lowercase, digit, special.
 * 16+ chars: just length is enough.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length === 0) {
    return {
      valid: false,
      errors: ['Password is required.'],
      strength: 'weak',
    };
  }

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
  }

  // Under the passphrase threshold: enforce complexity
  if (password.length < PASSPHRASE_THRESHOLD) {
    if (!HAS_UPPERCASE.test(password)) {
      errors.push('Include at least one uppercase letter.');
    }
    if (!HAS_LOWERCASE.test(password)) {
      errors.push('Include at least one lowercase letter.');
    }
    if (!HAS_DIGIT.test(password)) {
      errors.push('Include at least one number.');
    }
    if (!HAS_SPECIAL.test(password)) {
      errors.push('Include at least one special character.');
    }
  }

  const strength = getPasswordStrength(password);

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

// ── Password Strength ───────────────────────────────────────────────

/**
 * Score password strength for UI feedback.
 *
 * Scoring:
 *   - Length contribution (up to 3 points for 20+ chars)
 *   - Character variety (up to 4 points for uppercase, lowercase, digit, special)
 *   - Mapped to: weak (0-2), fair (3-4), strong (5-6), very_strong (7)
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return 'weak';

  let score = 0;

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 20) score += 1;

  // Character variety scoring
  if (HAS_UPPERCASE.test(password)) score += 1;
  if (HAS_LOWERCASE.test(password)) score += 1;
  if (HAS_DIGIT.test(password)) score += 1;
  if (HAS_SPECIAL.test(password)) score += 1;

  if (score <= 2) return 'weak';
  if (score <= 4) return 'fair';
  if (score <= 6) return 'strong';
  return 'very_strong';
}

// ── Passphrase Generation ───────────────────────────────────────────

/**
 * Curated word list for passphrase generation.
 *
 * Each word is 4-7 letters, common enough to remember,
 * distinct enough to avoid confusion.
 */
const WORD_LIST = [
  'amber', 'apple', 'arrow', 'atlas', 'beach',
  'berry', 'blaze', 'bloom', 'brave', 'brick',
  'brook', 'brush', 'cabin', 'candy', 'cargo',
  'cedar', 'charm', 'chess', 'choir', 'cider',
  'cliff', 'cloud', 'coral', 'crane', 'creek',
  'crown', 'dance', 'delta', 'diver', 'dream',
  'drift', 'eagle', 'ember', 'fable', 'feast',
  'fern', 'flame', 'fleet', 'flint', 'float',
  'forge', 'frost', 'glass', 'globe', 'grain',
  'grape', 'grove', 'haven', 'hazel', 'heron',
  'honey', 'ivory', 'jewel', 'kayak', 'latch',
  'lemon', 'light', 'linen', 'lodge', 'lunar',
  'maple', 'marsh', 'medal', 'mirth', 'mount',
  'night', 'north', 'novel', 'ocean', 'olive',
  'orbit', 'otter', 'oxide', 'pearl', 'penny',
  'piano', 'pilot', 'plume', 'polar', 'prism',
  'quail', 'quest', 'rapid', 'raven', 'ridge',
  'river', 'robin', 'rowan', 'royal', 'rustic',
  'sage', 'satin', 'scope', 'shore', 'silk',
  'slate', 'solar', 'spark', 'spire', 'steel',
  'stone', 'storm', 'swift', 'table', 'thorn',
  'tiger', 'trail', 'tulip', 'vapor', 'velvet',
  'viola', 'vivid', 'waltz', 'wheat', 'whirl',
  'willow', 'yacht', 'zephyr',
] as const;

/**
 * Generate a passphrase suggestion from 4 random words.
 * Uses crypto.getRandomValues for secure randomness.
 * Returns words joined by spaces (always 16+ chars, meeting the passphrase threshold).
 */
export function generatePassphraseSuggestion(): string {
  const words: string[] = [];
  const randomValues = new Uint32Array(4);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < 4; i++) {
    const index = randomValues[i]! % WORD_LIST.length;
    words.push(WORD_LIST[index]!);
  }

  return words.join(' ');
}
