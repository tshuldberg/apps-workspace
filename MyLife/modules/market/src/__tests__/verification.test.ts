import { describe, expect, it } from 'vitest';
import {
  calculateVerificationLevel,
  resolveEffectiveLevel,
  canCreateListing,
  LISTING_LIMITS,
} from '../verification/engine';
import type { VerificationStats } from '../verification/engine';

function makeStats(overrides: Partial<VerificationStats> = {}): VerificationStats {
  return {
    emailVerified: false,
    phoneVerified: false,
    photoVerified: false,
    idVerified: false,
    completedSales: 0,
    totalReviews: 0,
    averageRating: null,
    responseRate: null,
    accountAgeDays: 0,
    ...overrides,
  };
}

describe('calculateVerificationLevel', () => {
  it('returns unverified when nothing is verified', () => {
    expect(calculateVerificationLevel(makeStats())).toBe('unverified');
  });

  it('returns basic when only email is verified', () => {
    expect(calculateVerificationLevel(makeStats({ emailVerified: true }))).toBe('basic');
  });

  it('returns verified when email + phone + photo verified', () => {
    expect(calculateVerificationLevel(makeStats({
      emailVerified: true,
      phoneVerified: true,
      photoVerified: true,
    }))).toBe('verified');
  });

  it('returns trusted when verified + 5 sales + 4.0 rating', () => {
    expect(calculateVerificationLevel(makeStats({
      emailVerified: true,
      phoneVerified: true,
      photoVerified: true,
      completedSales: 5,
      averageRating: 4.0,
    }))).toBe('trusted');
  });

  it('returns top_seller when all requirements met', () => {
    expect(calculateVerificationLevel(makeStats({
      emailVerified: true,
      phoneVerified: true,
      photoVerified: true,
      completedSales: 25,
      averageRating: 4.5,
      responseRate: 95,
      accountAgeDays: 60,
    }))).toBe('top_seller');
  });

  it('stays verified if sales below 5', () => {
    expect(calculateVerificationLevel(makeStats({
      emailVerified: true,
      phoneVerified: true,
      photoVerified: true,
      completedSales: 4,
      averageRating: 4.5,
    }))).toBe('verified');
  });

  it('stays trusted if response rate below 90', () => {
    expect(calculateVerificationLevel(makeStats({
      emailVerified: true,
      phoneVerified: true,
      photoVerified: true,
      completedSales: 30,
      averageRating: 4.8,
      responseRate: 80,
      accountAgeDays: 60,
    }))).toBe('trusted');
  });
});

describe('resolveEffectiveLevel', () => {
  it('promotes when calculated is higher', () => {
    expect(resolveEffectiveLevel('basic', 'verified')).toBe('verified');
  });

  it('keeps current when calculated is lower (no demotion)', () => {
    expect(resolveEffectiveLevel('trusted', 'verified')).toBe('trusted');
  });

  it('stays same when equal', () => {
    expect(resolveEffectiveLevel('verified', 'verified')).toBe('verified');
  });
});

describe('canCreateListing', () => {
  it('allows unverified with fewer than 5 listings', () => {
    expect(canCreateListing('unverified', 4)).toBe(true);
  });

  it('blocks unverified at 5 listings', () => {
    expect(canCreateListing('unverified', 5)).toBe(false);
  });

  it('allows basic with 24 listings', () => {
    expect(canCreateListing('basic', 24)).toBe(true);
  });

  it('blocks basic at 25 listings', () => {
    expect(canCreateListing('basic', 25)).toBe(false);
  });

  it('allows trusted with 99 listings', () => {
    expect(canCreateListing('trusted', 99)).toBe(true);
  });
});

describe('LISTING_LIMITS', () => {
  it('has correct limits per level', () => {
    expect(LISTING_LIMITS.unverified).toBe(5);
    expect(LISTING_LIMITS.basic).toBe(25);
    expect(LISTING_LIMITS.verified).toBe(50);
    expect(LISTING_LIMITS.trusted).toBe(100);
    expect(LISTING_LIMITS.top_seller).toBe(100);
  });
});
