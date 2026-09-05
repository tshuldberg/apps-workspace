// Onboarding v2 core (Plan 31 Phase 3, T3.3). The browse path completes
// onboarding exactly once with no identity-adjacent side effects; the choice list
// is the four design-decision-7 rows; the suggested name is offline.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createSyncTables, listCommunities } from '@mylife/sync';
import { ONBOARDING_COMPLETE_KEY, ensureMeerkatTables, getSetting } from '../(root)/data/db';
import {
  ONBOARDING_START_ROWS,
  getDeepLinkInvitePending,
  isOnboardingComplete,
  markOnboardingComplete,
  persistOnboardingComplete,
  setDeepLinkInvitePending,
  subscribeDeepLinkInvitePending,
  subscribeOnboardingComplete,
  suggestedDisplayName,
} from '../(root)/data/onboarding-core';

let testDb: InMemoryTestDatabase | null = null;
let db: InMemoryTestDatabase['adapter'];

beforeEach(() => {
  testDb = createInMemoryTestDatabase();
  db = testDb.adapter;
  ensureMeerkatTables(db);
  createSyncTables(db);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe('ONBOARDING_START_ROWS', () => {
  it('is the four design-decision-7 choices in order', () => {
    expect(ONBOARDING_START_ROWS.map((r) => r.option)).toEqual(['create', 'join', 'add_friend', 'browse']);
    expect(ONBOARDING_START_ROWS.map((r) => r.title)).toEqual([
      'Create a community',
      'Join with an invite',
      'Add a friend',
      'Just look around',
    ]);
  });
});

describe('markOnboardingComplete (browse path)', () => {
  it('completes onboarding exactly once with no community side effects', () => {
    expect(isOnboardingComplete(db)).toBe(false);
    markOnboardingComplete(db);
    expect(isOnboardingComplete(db)).toBe(true);
    expect(getSetting(db, ONBOARDING_COMPLETE_KEY)).toBe('1');
    // Browse path writes ONLY the flag: no community, no identity-adjacent rows.
    expect(listCommunities(db)).toHaveLength(0);
    // Idempotent.
    markOnboardingComplete(db);
    expect(isOnboardingComplete(db)).toBe(true);
  });
});

describe('M1: onboarding-completion signal (deep-link join dismisses the gate)', () => {
  it('markOnboardingComplete writes the flag AND notifies subscribers', () => {
    let fired = 0;
    const unsubscribe = subscribeOnboardingComplete(() => { fired += 1; });
    markOnboardingComplete(db);
    expect(fired).toBe(1);
    expect(isOnboardingComplete(db)).toBe(true);
    unsubscribe();
    markOnboardingComplete(db);
    expect(fired).toBe(1); // no longer notified after unsubscribe
  });

  it('persistOnboardingComplete writes the flag WITHOUT notifying (m2: gate stays for first-message)', () => {
    let fired = 0;
    const unsubscribe = subscribeOnboardingComplete(() => { fired += 1; });
    persistOnboardingComplete(db);
    expect(isOnboardingComplete(db)).toBe(true);
    expect(fired).toBe(0);
    unsubscribe();
  });
});

describe('M1: deep-link invite pending store (gate suppression)', () => {
  it('reflects set state and notifies on change only', () => {
    setDeepLinkInvitePending(false);
    let fired = 0;
    const unsubscribe = subscribeDeepLinkInvitePending(() => { fired += 1; });
    setDeepLinkInvitePending(true);
    expect(getDeepLinkInvitePending()).toBe(true);
    expect(fired).toBe(1);
    setDeepLinkInvitePending(true); // no-op, no extra notification
    expect(fired).toBe(1);
    setDeepLinkInvitePending(false);
    expect(getDeepLinkInvitePending()).toBe(false);
    expect(fired).toBe(2);
    unsubscribe();
  });
});

describe('suggestedDisplayName', () => {
  it('offers the current name, falling back to a default', () => {
    expect(suggestedDisplayName('Ada')).toBe('Ada');
    expect(suggestedDisplayName('  Ada  ')).toBe('Ada');
    expect(suggestedDisplayName('')).toBe('My Meerkat');
    expect(suggestedDisplayName('   ')).toBe('My Meerkat');
  });
});
