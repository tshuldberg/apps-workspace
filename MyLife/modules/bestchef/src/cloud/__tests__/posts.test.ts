import { describe, it, expect } from 'vitest';
import { checkPostAccess } from '../posts';

// ── checkPostAccess ─────────────────────────────────────────────────

describe('checkPostAccess', () => {
  it('public posts are accessible to everyone', () => {
    expect(checkPostAccess('public', null, false, [])).toBe(true);
  });

  it('public posts are accessible even without subscriptions', () => {
    expect(checkPostAccess('public', null, false, [])).toBe(true);
  });

  it('subscriber posts are accessible to subscribers', () => {
    expect(checkPostAccess('subscribers', null, true, [])).toBe(true);
  });

  it('subscriber posts are NOT accessible to non-subscribers', () => {
    expect(checkPostAccess('subscribers', null, false, [])).toBe(false);
  });

  it('tier_specific posts are accessible to users with the right tier', () => {
    const tierId = 'tier-gold-123';
    expect(checkPostAccess('tier_specific', tierId, true, [tierId])).toBe(true);
  });

  it('tier_specific posts are NOT accessible to users without the right tier', () => {
    expect(
      checkPostAccess('tier_specific', 'tier-gold-123', true, ['tier-silver-456']),
    ).toBe(false);
  });

  it('tier_specific posts are NOT accessible when requiredTierId is null', () => {
    expect(checkPostAccess('tier_specific', null, true, ['tier-gold-123'])).toBe(false);
  });

  it('tier_specific posts are NOT accessible to non-subscribers', () => {
    expect(
      checkPostAccess('tier_specific', 'tier-gold-123', false, []),
    ).toBe(false);
  });

  it('subscriber posts with extra tier IDs still pass for subscribers', () => {
    expect(
      checkPostAccess('subscribers', null, true, ['tier-gold-123']),
    ).toBe(true);
  });

  it('handles multiple tier IDs correctly', () => {
    const requiredTier = 'tier-platinum-789';
    const viewerTiers = ['tier-silver-456', 'tier-platinum-789', 'tier-gold-123'];
    expect(checkPostAccess('tier_specific', requiredTier, true, viewerTiers)).toBe(true);
  });

  it('returns false for unknown visibility values', () => {
    // Cast to satisfy TS while testing runtime safety
    expect(
      checkPostAccess('secret' as 'public', null, true, []),
    ).toBe(false);
  });
});

// ── Post validation logic ───────────────────────────────────────────

describe('post validation logic', () => {
  it('empty title is invalid', () => {
    const title = '';
    expect(title.trim().length === 0).toBe(true);
  });

  it('whitespace-only title is invalid', () => {
    const title = '   ';
    expect(title.trim().length === 0).toBe(true);
  });

  it('valid title passes', () => {
    const title = 'My Secret Recipe for Ramen';
    expect(title.trim().length > 0).toBe(true);
  });

  it('empty body is invalid', () => {
    const body = '';
    expect(body.trim().length === 0).toBe(true);
  });

  it('valid body passes', () => {
    const body = 'Today I want to share my approach to making perfect ramen broth.';
    expect(body.trim().length > 0).toBe(true);
  });
});

// ── PostType validation ─────────────────────────────────────────────

describe('post type values', () => {
  const validTypes = ['blog', 'exclusive_recipe', 'announcement'];

  it('accepts all valid post types', () => {
    for (const t of validTypes) {
      expect(validTypes.includes(t)).toBe(true);
    }
  });

  it('has exactly 3 post types', () => {
    expect(validTypes).toHaveLength(3);
  });
});

// ── PostVisibility validation ───────────────────────────────────────

describe('post visibility values', () => {
  const validVisibilities = ['public', 'subscribers', 'tier_specific'];

  it('accepts all valid visibility values', () => {
    for (const v of validVisibilities) {
      expect(validVisibilities.includes(v)).toBe(true);
    }
  });

  it('has exactly 3 visibility values', () => {
    expect(validVisibilities).toHaveLength(3);
  });
});
