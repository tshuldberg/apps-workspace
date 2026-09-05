import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// expo-notifications + expo-constants are native; mock them so push.ts stays
// testable and no other module drags them into the test graph. Constants is a
// mutable object so a test can flip the projectId between real and placeholder.
const notif = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: vi.fn(async () => ({ data: 'ExponentPushToken[abc]' })),
  setNotificationChannelAsync: vi.fn(async () => {}),
  AndroidImportance: { DEFAULT: 3 },
}));
const constants = vi.hoisted(() => ({
  expoConfig: { extra: { eas: { projectId: 'real-project-id' } } },
}));

// expo-secure-store backs the per-install device id (RT-7). push.ts caches
// the resolved id at module scope for the process lifetime (mirroring one
// real device holding one id for its whole install), so this store only
// needs to seed the FIRST lookup consistently; it is not reset per test.
const secureStore = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
});
const crypto = vi.hoisted(() => ({
  randomUUID: vi.fn(() => 'device-uuid-1'),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-notifications', () => notif);
vi.mock('expo-constants', () => ({ __esModule: true, default: constants }));
vi.mock('expo-secure-store', () => secureStore);
vi.mock('expo-crypto', () => crypto);

import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  getPushDeviceId,
  hasPushTokens,
  refreshPushTokenIfEnabled,
  registerPushToken,
  removePushTokens,
  resolveNotificationRoute,
  resolvePushProjectId,
  saveNotificationPrefs,
} from '../push';

interface SupabaseMockConfig {
  upsertError?: { message: string } | null;
  deleteError?: { message: string } | null;
  selectData?: unknown;
  selectError?: { message: string } | null;
}

function makeSupabase(config: SupabaseMockConfig = {}) {
  const captured = {
    upserts: [] as Array<{ table: string; payload: unknown; options: unknown }>,
    deletes: [] as Array<{ table: string; column: string; value: unknown }>,
    selects: [] as Array<{ table: string; columns: unknown }>,
    selectEqs: [] as Array<{ table: string; column: string; value: unknown }>,
  };
  const from = vi.fn((table: string) => {
    let op: 'select' | 'upsert' | 'delete' = 'select';
    let eqColumn = '';
    let eqValue: unknown = null;
    const terminal = () => {
      if (op === 'upsert') return { error: config.upsertError ?? null };
      if (op === 'delete') return { error: config.deleteError ?? null };
      return { data: config.selectData ?? null, error: config.selectError ?? null };
    };
    const obj: Record<string, unknown> = {
      upsert(payload: unknown, options: unknown) {
        op = 'upsert';
        captured.upserts.push({ table, payload, options });
        return obj;
      },
      delete() {
        op = 'delete';
        return obj;
      },
      select(columns: unknown) {
        op = 'select';
        captured.selects.push({ table, columns });
        return obj;
      },
      limit() {
        return obj;
      },
      eq(column: string, value: unknown) {
        eqColumn = column;
        eqValue = value;
        if (op === 'delete') captured.deletes.push({ table, column, value });
        if (op === 'select') captured.selectEqs.push({ table, column, value });
        return obj;
      },
      maybeSingle() {
        void eqColumn;
        void eqValue;
        return Promise.resolve(terminal());
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(terminal()).then(onFulfilled, onRejected);
      },
    };
    return obj;
  });
  return { supabase: { from } as unknown as SupabaseClient, from, captured };
}

beforeEach(() => {
  vi.clearAllMocks();
  constants.expoConfig.extra.eas.projectId = 'real-project-id';
  notif.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  notif.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  notif.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
});

describe('resolvePushProjectId', () => {
  it('returns null for the app.json placeholder', () => {
    expect(
      resolvePushProjectId({ expoConfig: { extra: { eas: { projectId: 'REPLACE_WITH_EAS_PROJECT_ID' } } } }),
    ).toBeNull();
  });

  it('returns null when the projectId is missing', () => {
    expect(resolvePushProjectId({ expoConfig: { extra: {} } })).toBeNull();
  });

  it('returns a real projectId', () => {
    expect(resolvePushProjectId({ expoConfig: { extra: { eas: { projectId: 'abc-123' } } } })).toBe('abc-123');
  });
});

describe('resolveNotificationRoute', () => {
  it('routes new_video to the player', () => {
    expect(resolveNotificationRoute({ type: 'new_video', videoId: 'v-1' })).toBe(
      '/(root)/player?videoId=v-1',
    );
  });

  it('routes form_check and form_feedback to the form-check screen', () => {
    expect(resolveNotificationRoute({ type: 'form_check', formCheckId: 'fc-1' })).toBe(
      '/(root)/form-check/fc-1',
    );
    expect(resolveNotificationRoute({ type: 'form_feedback', formCheckId: 'fc-2', feedbackId: 'fb-9' })).toBe(
      '/(root)/form-check/fc-2',
    );
  });

  it('encodes ids and rejects malformed payloads', () => {
    expect(resolveNotificationRoute({ type: 'new_video', videoId: 'a/b?c' })).toBe(
      '/(root)/player?videoId=a%2Fb%3Fc',
    );
    expect(resolveNotificationRoute({ type: 'new_video' })).toBeNull();
    expect(resolveNotificationRoute({ type: 'form_check', formCheckId: '' })).toBeNull();
    expect(resolveNotificationRoute({ type: 'unknown', videoId: 'x' })).toBeNull();
    expect(resolveNotificationRoute(null)).toBeNull();
    expect(resolveNotificationRoute('nope')).toBeNull();
  });
});

describe('registerPushToken', () => {
  it('reports cloud_unavailable without a session', async () => {
    const result = await registerPushToken(null, null);
    expect(result).toEqual({ ok: false, reason: 'cloud_unavailable', error: expect.any(String) });
  });

  it('reports not_provisioned while the projectId is the placeholder', async () => {
    constants.expoConfig.extra.eas.projectId = 'REPLACE_WITH_EAS_PROJECT_ID';
    const { supabase } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_provisioned');
    expect(notif.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('reports permission_denied when the OS declines', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    notif.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const { supabase } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('permission_denied');
  });

  it('registers and upserts the token on the happy path, tagged with this device id', async () => {
    const { supabase, captured } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1');
    expect(result).toEqual({ ok: true, token: 'ExponentPushToken[abc]', platform: 'ios' });
    expect(captured.upserts).toHaveLength(1);
    expect(captured.upserts[0]?.table).toBe('dw_push_tokens');
    const deviceId = await getPushDeviceId();
    expect(captured.upserts[0]?.payload).toMatchObject({
      user_id: 'user-1',
      expo_token: 'ExponentPushToken[abc]',
      platform: 'ios',
      device_id: deviceId,
    });
  });

  it('reports unsupported when the device has no token', async () => {
    notif.getExpoPushTokenAsync.mockRejectedValue(new Error('must use physical device'));
    const { supabase } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported');
  });

  it('reports error when the token upsert fails', async () => {
    const { supabase } = makeSupabase({ upsertError: { message: 'rls denied' } });
    const result = await registerPushToken(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('error');
      expect(result.error).toBe('rls denied');
    }
  });
});

describe('refreshPushTokenIfEnabled', () => {
  it('never prompts and bails when permission is not already granted', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    const { supabase } = makeSupabase();
    const result = await refreshPushTokenIfEnabled(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('permission_denied');
    expect(notif.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('refreshes silently when permission is already granted', async () => {
    const { supabase, captured } = makeSupabase();
    const result = await refreshPushTokenIfEnabled(supabase, 'user-1');
    expect(result.ok).toBe(true);
    expect(notif.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(captured.upserts).toHaveLength(1);
  });
});

describe('removePushTokens', () => {
  it('is a no-op without a session', async () => {
    const result = await removePushTokens(null, null);
    expect(result).toEqual({ ok: true });
  });

  it('deletes only this device row, scoped by user_id AND device_id (RT-7)', async () => {
    const { supabase, captured } = makeSupabase();
    const result = await removePushTokens(supabase, 'user-1');
    expect(result).toEqual({ ok: true });
    const deviceId = await getPushDeviceId();
    expect(captured.deletes).toEqual([
      { table: 'dw_push_tokens', column: 'user_id', value: 'user-1' },
      { table: 'dw_push_tokens', column: 'device_id', value: deviceId },
    ]);
  });

  it('surfaces a delete error', async () => {
    const { supabase } = makeSupabase({ deleteError: { message: 'boom' } });
    const result = await removePushTokens(supabase, 'user-1');
    expect(result).toEqual({ ok: false, error: 'boom' });
  });
});

describe('hasPushTokens', () => {
  it('is false without a session', async () => {
    expect(await hasPushTokens(null, null)).toEqual({ ok: true, exists: false });
  });

  it('is true when a token row exists for this device', async () => {
    const { supabase } = makeSupabase({ selectData: [{ expo_token: 'ExponentPushToken[abc]' }] });
    expect(await hasPushTokens(supabase, 'user-1')).toEqual({ ok: true, exists: true });
  });

  it('is false when no token rows exist', async () => {
    const { supabase } = makeSupabase({ selectData: [] });
    expect(await hasPushTokens(supabase, 'user-1')).toEqual({ ok: true, exists: false });
  });

  it('scopes the select query to this device id, not just the user', async () => {
    const { supabase, captured } = makeSupabase({ selectData: [] });
    await hasPushTokens(supabase, 'user-1');
    const deviceId = await getPushDeviceId();
    expect(captured.selects[0]?.table).toBe('dw_push_tokens');
    expect(captured.selectEqs).toEqual([
      { table: 'dw_push_tokens', column: 'user_id', value: 'user-1' },
      { table: 'dw_push_tokens', column: 'device_id', value: deviceId },
    ]);
  });
});

describe('getPushDeviceId', () => {
  it('persists a generated id in SecureStore and returns it consistently', async () => {
    const id = await getPushDeviceId();
    expect(id).toBeTruthy();
    const again = await getPushDeviceId();
    expect(again).toBe(id);
  });
});

describe('notification preferences', () => {
  it('returns defaults with no session', async () => {
    const result = await getNotificationPrefs(null, null);
    expect(result).toEqual({ ok: true, prefs: DEFAULT_NOTIFICATION_PREFS, hasRow: false });
  });

  it('returns defaults when there is no row', async () => {
    const { supabase } = makeSupabase({ selectData: null });
    const result = await getNotificationPrefs(supabase, 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hasRow).toBe(false);
      expect(result.prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
    }
  });

  it('maps a stored row and keeps marketing opt-in explicit', async () => {
    const { supabase } = makeSupabase({
      selectData: { new_video: false, form_check: true, form_feedback: true, marketing: true },
    });
    const result = await getNotificationPrefs(supabase, 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hasRow).toBe(true);
      expect(result.prefs).toEqual({
        new_video: false,
        form_check: true,
        form_feedback: true,
        marketing: true,
      });
    }
  });

  it('saves preferences by upserting the prefs table', async () => {
    const { supabase, captured } = makeSupabase();
    const result = await saveNotificationPrefs(supabase, 'user-1', {
      new_video: true,
      form_check: false,
      form_feedback: true,
      marketing: false,
    });
    expect(result).toEqual({ ok: true });
    expect(captured.upserts[0]?.table).toBe('dw_notification_prefs');
    expect(captured.upserts[0]?.payload).toMatchObject({ user_id: 'user-1', form_check: false });
  });

  it('refuses to save without a session', async () => {
    const result = await saveNotificationPrefs(null, null, DEFAULT_NOTIFICATION_PREFS);
    expect(result.ok).toBe(false);
  });
});
