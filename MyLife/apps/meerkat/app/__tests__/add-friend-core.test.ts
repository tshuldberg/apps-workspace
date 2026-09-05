/**
 * Add-friend relay resolution (Plan 31 Phase 0, T0.4 / TC-2).
 *
 * The add-friend flow reads a dialable relay ONLY through effectiveRelayUrl(db),
 * never the raw relay setting, so the health gate + opt-out govern whether the
 * flow can resolve a friend or must fall back to the ConnectionStatusCard no-
 * server state. Mirrors effective-relay-url.test.ts: mock the app sync-core
 * DEFAULT_RELAY_URL so the health-gated free-default branch runs under Node.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { DEFAULT_URL } = vi.hoisted(() => ({ DEFAULT_URL: 'wss://default.test' }));

vi.mock('../(root)/data/sync-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../(root)/data/sync-core')>();
  return { ...actual, DEFAULT_RELAY_URL: DEFAULT_URL };
});

import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateFriendCode } from '@mylife/sync';
import {
  DEFAULT_RELAY_OPTOUT_KEY,
  ensureMeerkatTables,
  setSetting,
  writeRelayProbe,
} from '../(root)/data/db';
import { RELAY_URL_SETTING_KEY } from '../(root)/data/sync-core';
import {
  ADD_FRIEND_NEEDS_SERVER_LINE,
  isPlausibleFriendCode,
  resolveAddFriendRelay,
} from '../(root)/data/add-friend-core';

const USER_URL = 'wss://mine.example/relay';

let testDb: InMemoryTestDatabase | null = null;
let db: InMemoryTestDatabase['adapter'];

beforeEach(() => {
  testDb = createInMemoryTestDatabase();
  db = testDb.adapter;
  ensureMeerkatTables(db);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe('resolveAddFriendRelay', () => {
  it('no-server state when nothing is dialable (unconfigured, no probe)', () => {
    const state = resolveAddFriendRelay(db);
    expect(state.relayUrl).toBe('');
    expect(state.canResolve).toBe(false);
  });

  it('resolves a user-set relay', () => {
    setSetting(db, RELAY_URL_SETTING_KEY, USER_URL);
    const state = resolveAddFriendRelay(db);
    expect(state.relayUrl).toBe(USER_URL);
    expect(state.canResolve).toBe(true);
  });

  it('resolves the free default only after a healthy probe (health gate)', () => {
    expect(resolveAddFriendRelay(db).canResolve).toBe(false);
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: true, latencyMs: 8 });
    expect(resolveAddFriendRelay(db)).toEqual({ relayUrl: DEFAULT_URL, canResolve: true });
  });

  it('stays no-server when opted out even with a reachable default (AC-4)', () => {
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: true, latencyMs: 8 });
    setSetting(db, DEFAULT_RELAY_OPTOUT_KEY, '1');
    const state = resolveAddFriendRelay(db);
    expect(state.canResolve).toBe(false);
    expect(state.relayUrl).toBe('');
  });

  it('exposes the single honest no-server line, no roadmap promise (NC-3)', () => {
    expect(ADD_FRIEND_NEEDS_SERVER_LINE).toBe('Adding a friend needs a connection server.');
    expect(ADD_FRIEND_NEEDS_SERVER_LINE).not.toMatch(/free|coming|soon|will be/i);
  });
});

describe('isPlausibleFriendCode (scan front gate)', () => {
  it('accepts a well-formed standard checksummed code', () => {
    const { code } = generateFriendCode();
    expect(isPlausibleFriendCode(code)).toBe(true);
    expect(isPlausibleFriendCode(`  ${code}  `)).toBe(true);
  });

  it('accepts a custom vanity code (>= 12 normalized chars)', () => {
    expect(isPlausibleFriendCode('FRIENDLYCODE')).toBe(true);
  });

  it('rejects garbage, empty, and too-short standard-shaped input instantly', () => {
    expect(isPlausibleFriendCode('hello world!!!')).toBe(false);
    expect(isPlausibleFriendCode('')).toBe(false);
    expect(isPlausibleFriendCode('MEER-ABCD')).toBe(false);
  });
});
