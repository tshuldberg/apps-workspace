// PushPrompt persistence + gate contract tests.
//
// The card's KV helpers and the shouldOfferPushPrompt decision are pure, but
// they live in a .tsx that pulls in react-native / expo / workspace UI. Mock
// those so the module loads in a node test the same way push.test.ts does, then
// exercise the pure exports directly.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s },
  View: () => null,
  Text: () => null,
  Pressable: () => null,
  ActivityIndicator: () => null,
  Linking: { openSettings: vi.fn() },
}));
vi.mock('lucide-react-native', () => ({ Bell: () => null, Check: () => null, X: () => null }));
vi.mock('@mylife/workouts', () => ({
  WK_FONTS: { regular: '', medium: '', semiBold: '', bold: '', extraBold: '' },
}));
vi.mock('../../providers/DatabaseProvider', () => ({ useDatabase: () => ({}) }));
vi.mock('../../providers/DoWorkCloudProvider', () => ({ useDoWorkCloud: () => ({}) }));
vi.mock('../push', () => ({
  isPushProvisioned: vi.fn(() => false),
  hasPushTokens: vi.fn(async () => ({ ok: true, exists: false })),
  registerPushToken: vi.fn(),
}));
vi.mock('../../theme/tokens', () => ({
  DW_ACCENT: '#FF6B00',
  DW_BORDER: { subtle: '', default: '', strong: '' },
  DW_ON_ACCENT: '',
  DW_SURFACES: { base: '', low: '', mid: '', high: '' },
  DW_TEXT: { primary: '', secondary: '', tertiary: '', disabled: '' },
}));

import {
  markPushPromptDismissed,
  markPushPromptRegistered,
  pushPromptKvKey,
  readPushPromptState,
  shouldOfferPushPrompt,
  type PushPromptState,
} from '../../components/PushPrompt';

// In-memory stand-in for the hub_settings KV table (mirrors pending-queues.test).
function makeKvDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    query: <T>(sql: string, params: unknown[] = []): T[] => {
      if (sql.includes('FROM hub_settings')) {
        const value = store.get(String(params[0]));
        return (value === undefined ? [] : [{ value }]) as T[];
      }
      return [] as T[];
    },
    execute: (sql: string, params: unknown[] = []) => {
      if (sql.includes('INTO hub_settings')) {
        store.set(String(params[0]), String(params[1]));
      }
    },
  } as unknown as DatabaseAdapter;
}

const ANSWERED_NONE: PushPromptState = { dismissed: false, registered: false };

afterEach(() => vi.clearAllMocks());

describe('readPushPromptState', () => {
  it('returns the empty state when nothing is persisted', () => {
    expect(readPushPromptState(makeKvDb(), 'user-a')).toEqual(ANSWERED_NONE);
  });

  it('round-trips a dismissal', () => {
    const db = makeKvDb();
    markPushPromptDismissed(db, 'user-a');
    expect(readPushPromptState(db, 'user-a')).toEqual({ dismissed: true, registered: false });
  });

  it('round-trips a registration', () => {
    const db = makeKvDb();
    markPushPromptRegistered(db, 'user-a');
    expect(readPushPromptState(db, 'user-a')).toEqual({ dismissed: false, registered: true });
  });

  it('preserves the other flag when both are set over time', () => {
    const db = makeKvDb();
    markPushPromptDismissed(db, 'user-a');
    markPushPromptRegistered(db, 'user-a');
    expect(readPushPromptState(db, 'user-a')).toEqual({ dismissed: true, registered: true });
  });

  it('treats a corrupt payload as unanswered instead of throwing', () => {
    const db = makeKvDb();
    db.execute(
      `INSERT INTO hub_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [pushPromptKvKey('user-a'), 'not-json{{{'],
    );
    expect(() => readPushPromptState(db, 'user-a')).not.toThrow();
    expect(readPushPromptState(db, 'user-a')).toEqual(ANSWERED_NONE);
  });

  it('coerces non-boolean fields to false', () => {
    const db = makeKvDb();
    db.execute(
      `INSERT INTO hub_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [pushPromptKvKey('user-a'), JSON.stringify({ dismissed: 'yes', registered: 1 })],
    );
    expect(readPushPromptState(db, 'user-a')).toEqual(ANSWERED_NONE);
  });

  it('scopes answers per user: another account on the same device is unanswered', () => {
    const db = makeKvDb();
    markPushPromptDismissed(db, 'user-a');
    expect(readPushPromptState(db, 'user-a')).toEqual({ dismissed: true, registered: false });
    expect(readPushPromptState(db, 'user-b')).toEqual(ANSWERED_NONE);
  });

  it('ignores the legacy un-keyed row (its answerer is unknowable)', () => {
    const db = makeKvDb();
    db.execute(
      `INSERT INTO hub_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['dowork.push_prompt.v1', JSON.stringify({ dismissed: true, registered: true })],
    );
    expect(readPushPromptState(db, 'user-a')).toEqual(ANSWERED_NONE);
  });
});

describe('shouldOfferPushPrompt', () => {
  const base = { state: ANSWERED_NONE, cloudReady: true, provisioned: true, alreadyRegistered: false };

  it('offers when unanswered, provisioned, signed in, and not registered', () => {
    expect(shouldOfferPushPrompt(base)).toBe(true);
  });

  it('stays hidden without a cloud session', () => {
    expect(shouldOfferPushPrompt({ ...base, cloudReady: false })).toBe(false);
  });

  it('stays hidden until the app is provisioned for the store', () => {
    expect(shouldOfferPushPrompt({ ...base, provisioned: false })).toBe(false);
  });

  it('stays hidden when the device already has a token', () => {
    expect(shouldOfferPushPrompt({ ...base, alreadyRegistered: true })).toBe(false);
  });

  it('stays hidden once the user dismissed it', () => {
    expect(shouldOfferPushPrompt({ ...base, state: { dismissed: true, registered: false } })).toBe(false);
  });

  it('stays hidden once the user enabled it', () => {
    expect(shouldOfferPushPrompt({ ...base, state: { dismissed: false, registered: true } })).toBe(false);
  });
});
