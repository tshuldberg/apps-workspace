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

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-notifications', () => notif);
vi.mock('expo-constants', () => ({ __esModule: true, default: constants }));

import {
  isDeviceRegistered,
  isPushProvisioned,
  registerPushToken,
  resolvePushProjectId,
  unregisterPushToken,
} from '../push';

interface RpcResult {
  error?: { message: string } | null;
}

function makeSupabase(config: {
  rpcError?: { message: string } | null;
  selectData?: unknown;
  selectError?: { message: string } | null;
  deleteError?: { message: string } | null;
} = {}) {
  const captured = {
    rpcs: [] as Array<{ fn: string; args: unknown }>,
    deletes: [] as Array<{ table: string; column: string; value: unknown }>,
    selects: [] as Array<{ table: string }>,
  };
  const rpc = vi.fn(async (fn: string, args: unknown): Promise<RpcResult> => {
    captured.rpcs.push({ fn, args });
    return { error: config.rpcError ?? null };
  });
  const from = vi.fn((table: string) => {
    let op: 'select' | 'delete' = 'select';
    const chain: Record<string, unknown> = {
      select() {
        op = 'select';
        captured.selects.push({ table });
        return chain;
      },
      delete() {
        op = 'delete';
        return chain;
      },
      eq(column: string, value: unknown) {
        if (op === 'delete') captured.deletes.push({ table, column, value });
        return chain;
      },
      limit() {
        return { data: config.selectData ?? null, error: config.selectError ?? null };
      },
      then(resolve: (v: { error: unknown }) => void) {
        // delete terminal (awaited without .limit)
        resolve({ error: config.deleteError ?? null });
      },
    };
    return chain;
  });
  return { supabase: { rpc, from } as unknown as SupabaseClient, captured, rpcMock: rpc };
}

beforeEach(() => {
  notif.getPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  notif.requestPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  notif.getExpoPushTokenAsync.mockReset().mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  notif.setNotificationChannelAsync.mockReset().mockResolvedValue(undefined);
  constants.expoConfig = { extra: { eas: { projectId: 'real-project-id' } } };
});

describe('resolvePushProjectId / isPushProvisioned', () => {
  it('returns the real projectId', () => {
    expect(resolvePushProjectId()).toBe('real-project-id');
    expect(isPushProvisioned()).toBe(true);
  });

  it('treats the placeholder as not provisioned', () => {
    constants.expoConfig = { extra: { eas: { projectId: 'REPLACE_WITH_EAS_PROJECT_ID' } } };
    expect(resolvePushProjectId()).toBeNull();
    expect(isPushProvisioned()).toBe(false);
  });
});

describe('registerPushToken', () => {
  it('registers via the bc_register_push_token RPC with token, platform, and locale', async () => {
    const { supabase, captured } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1', { locale: 'pt-BR' });
    expect(result).toEqual({ ok: true, token: 'ExponentPushToken[abc]', platform: 'ios' });
    expect(captured.rpcs).toEqual([
      {
        fn: 'bc_register_push_token',
        args: { p_token: 'ExponentPushToken[abc]', p_platform: 'ios', p_locale: 'pt-BR' },
      },
    ]);
  });

  it('defaults the locale to en when none is given', async () => {
    const { supabase, captured } = makeSupabase();
    await registerPushToken(supabase, 'user-1');
    expect((captured.rpcs[0]?.args as { p_locale: string }).p_locale).toBe('en');
  });

  it('returns cloud_unavailable without a session', async () => {
    const result = await registerPushToken(null, null);
    expect(result).toEqual({
      ok: false,
      reason: 'cloud_unavailable',
      error: expect.any(String),
    });
  });

  it('returns not_provisioned when the projectId is the placeholder', async () => {
    constants.expoConfig = { extra: { eas: { projectId: 'REPLACE_WITH_EAS_PROJECT_ID' } } };
    const { supabase } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_provisioned');
  });

  it('returns permission_denied when the OS denies and does not write a token', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    notif.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const { supabase, rpcMock } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('permission_denied');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('does not prompt when promptIfNeeded is false and permission is undetermined', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    const { supabase } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1', { promptIfNeeded: false });
    expect(result.ok).toBe(false);
    expect(notif.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns unsupported when the device yields no token (e.g. simulator)', async () => {
    notif.getExpoPushTokenAsync.mockRejectedValue(new Error('must use a physical device'));
    const { supabase } = makeSupabase();
    const result = await registerPushToken(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported');
  });

  it('surfaces an RPC error honestly', async () => {
    const { supabase } = makeSupabase({ rpcError: { message: 'rls denied' } });
    const result = await registerPushToken(supabase, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('error');
      expect(result.error).toBe('rls denied');
    }
  });
});

describe('unregisterPushToken', () => {
  it('unregisters the current device token via the RPC', async () => {
    const { supabase, captured } = makeSupabase();
    const result = await unregisterPushToken(supabase, 'user-1');
    expect(result).toEqual({ ok: true });
    expect(captured.rpcs[0]).toEqual({
      fn: 'bc_unregister_push_token',
      args: { p_token: 'ExponentPushToken[abc]' },
    });
  });

  it('falls back to an owner-scoped bulk delete when no token resolves', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const { supabase, captured } = makeSupabase();
    const result = await unregisterPushToken(supabase, 'user-1');
    expect(result).toEqual({ ok: true });
    expect(captured.deletes).toEqual([{ table: 'bc_push_tokens', column: 'user_id', value: 'user-1' }]);
  });

  it('is a no-op without a session', async () => {
    const result = await unregisterPushToken(null, null);
    expect(result).toEqual({ ok: true });
  });
});

describe('isDeviceRegistered', () => {
  it('reports registered when a matching token row exists', async () => {
    const { supabase } = makeSupabase({ selectData: [{ token: 'ExponentPushToken[abc]' }] });
    const result = await isDeviceRegistered(supabase, 'user-1');
    expect(result).toEqual({ ok: true, registered: true });
  });

  it('reports not registered when no row exists', async () => {
    const { supabase } = makeSupabase({ selectData: [] });
    const result = await isDeviceRegistered(supabase, 'user-1');
    expect(result).toEqual({ ok: true, registered: false });
  });

  it('reports not registered when permission is not granted (never prompts)', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    const { supabase } = makeSupabase();
    const result = await isDeviceRegistered(supabase, 'user-1');
    expect(result).toEqual({ ok: true, registered: false });
    expect(notif.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
