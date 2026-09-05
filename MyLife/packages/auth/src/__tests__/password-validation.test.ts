import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  getPasswordStrength,
  generatePassphraseSuggestion,
} from '../password-validation';

describe('validatePassword', () => {
  // ── Empty / Too Short ───────────────────────────────────────────────

  it('rejects empty password', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password is required.');
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = validatePassword('Ab1!xyz');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters.');
  });

  // ── Under 16 chars: Complexity Required ─────────────────────────────

  it('rejects short password missing uppercase', () => {
    const result = validatePassword('abcd1234!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Include at least one uppercase letter.');
  });

  it('rejects short password missing lowercase', () => {
    const result = validatePassword('ABCD1234!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Include at least one lowercase letter.');
  });

  it('rejects short password missing digit', () => {
    const result = validatePassword('Abcdefgh!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Include at least one number.');
  });

  it('rejects short password missing special character', () => {
    const result = validatePassword('Abcdefg1');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Include at least one special character.');
  });

  it('reports multiple errors at once', () => {
    const result = validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts valid complex 8-char password', () => {
    const result = validatePassword('Abcdef1!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid complex 15-char password', () => {
    const result = validatePassword('MyP@ssword1234x');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ── 16+ chars: No Complexity Required (Passphrase Tier) ─────────────

  it('accepts 16+ char password with only lowercase', () => {
    const result = validatePassword('abcdefghijklmnop');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts 16+ char password with only digits', () => {
    const result = validatePassword('1234567890123456');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts passphrase with spaces', () => {
    const result = validatePassword('amber brook cedar dream');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts passphrase with mixed content', () => {
    const result = validatePassword('my favorite color is blue');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ── Edge Cases ────────────────────────────────────────────────────────

  it('accepts exactly 16 characters with no complexity', () => {
    const result = validatePassword('aaaaaaaaaaaaaaaa');
    expect(result.valid).toBe(true);
  });

  it('rejects exactly 15 chars without complexity', () => {
    const result = validatePassword('aaaaaaaaaaaaaaa');
    expect(result.valid).toBe(false);
  });

  it('allows spaces in short passwords (as special chars)', () => {
    const result = validatePassword('Ab 12345');
    expect(result.valid).toBe(true);
  });

  it('allows unicode characters', () => {
    const result = validatePassword('Abc12345\u00e9\u00f1!');
    expect(result.valid).toBe(true);
  });
});

describe('getPasswordStrength', () => {
  it('returns weak for empty string', () => {
    expect(getPasswordStrength('')).toBe('weak');
  });

  it('returns weak for very short simple password', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
  });

  it('returns fair for moderate password', () => {
    const strength = getPasswordStrength('Abcdef12');
    expect(['fair', 'strong']).toContain(strength);
  });

  it('returns strong or very_strong for complex 12+ char password', () => {
    const strength = getPasswordStrength('MyP@ssword12');
    expect(['strong', 'very_strong']).toContain(strength);
  });

  it('returns very_strong for 20+ char complex password', () => {
    expect(getPasswordStrength('MyVeryLongP@ssw0rd!!')).toBe('very_strong');
  });

  it('scores long all-lowercase passphrase reasonably', () => {
    const strength = getPasswordStrength('amber brook cedar dream');
    // 20+ chars (3 pts) + lowercase (1 pt) + special/space (1 pt) = 5 = strong
    expect(['strong', 'very_strong']).toContain(strength);
  });
});

describe('generatePassphraseSuggestion', () => {
  it('returns a string with 4 words separated by spaces', () => {
    const passphrase = generatePassphraseSuggestion();
    const words = passphrase.split(' ');
    expect(words).toHaveLength(4);
  });

  it('generates passphrases of at least 16 characters', () => {
    // Run multiple times to account for randomness
    for (let i = 0; i < 10; i++) {
      const passphrase = generatePassphraseSuggestion();
      expect(passphrase.length).toBeGreaterThanOrEqual(16);
    }
  });

  it('generates valid passwords according to the policy', () => {
    for (let i = 0; i < 10; i++) {
      const passphrase = generatePassphraseSuggestion();
      const result = validatePassword(passphrase);
      expect(result.valid).toBe(true);
    }
  });

  it('generates different passphrases on successive calls', () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(generatePassphraseSuggestion());
    }
    // With 118 words and 4-word combos, collisions are astronomically unlikely
    expect(results.size).toBeGreaterThan(1);
  });

  it('uses only lowercase words', () => {
    const passphrase = generatePassphraseSuggestion();
    const words = passphrase.split(' ');
    for (const word of words) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});
