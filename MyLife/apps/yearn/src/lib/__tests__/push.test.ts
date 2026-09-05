import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: {} } }, easConfig: null },
}));

const notifications = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
}));
vi.mock('expo-notifications', () => notifications);

const secureStore = vi.hoisted(() => new Map<string, string>());
vi.mock('../supabase', () => ({
  yearnSecureStorage: {
    getItem: (key: string) => Promise.resolve(secureStore.get(key) ?? null),
    setItem: (key: string, value: string) => {
      secureStore.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      secureStore.delete(key);
      return Promise.resolve();
    },
  },
}));

import {
  isYearnPushEnabled,
  registerForYearnPush,
  resolvePushProjectId,
  unregisterYearnPush,
  type PushSupabaseClient,
} from '../push';

const PROJECT_ID = 'e1111111-2222-4333-8444-555555555555';
const TOKEN = 'ExponentPushToken[abc123]';

function makeClient(overrides: { rpcError?: unknown; deleteError?: unknown } = {}) {
  const eq = vi.fn().mockResolvedValue({ error: overrides.deleteError ?? null });
  const del = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ delete: del });
  const rpc = vi.fn().mockResolvedValue({ error: overrides.rpcError ?? null });
  const client: PushSupabaseClient = { rpc, from };
  return { client, rpc, from, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
  secureStore.clear();
  notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  notifications.getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN });
});

describe('resolvePushProjectId', () => {
  it('returns null when the projectId is absent or the placeholder', () => {
    expect(resolvePushProjectId({ expoConfig: { extra: { eas: {} } } })).toBeNull();
    expect(
      resolvePushProjectId({
        expoConfig: { extra: { eas: { projectId: 'REPLACE_WITH_EAS_PROJECT_ID' } } },
      }),
    ).toBeNull();
  });

  it('returns a real projectId', () => {
    expect(
      resolvePushProjectId({ expoConfig: { extra: { eas: { projectId: PROJECT_ID } } } }),
    ).toBe(PROJECT_ID);
  });
});

describe('registerForYearnPush', () => {
  it('fails honestly as not_provisioned without an EAS projectId (never fakes a token)', async () => {
    const { client, rpc } = makeClient();
    const result = await registerForYearnPush(client, notifications, undefined, null);
    expect(result).toMatchObject({ ok: false, reason: 'not_provisioned' });
    expect(rpc).not.toHaveBeenCalled();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('fails as permission_denied when the OS denies and never registers a token', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const { client, rpc } = makeClient();
    const result = await registerForYearnPush(client, notifications, undefined, PROJECT_ID);
    expect(result).toMatchObject({ ok: false, reason: 'permission_denied' });
    expect(rpc).not.toHaveBeenCalled();
    expect(await isYearnPushEnabled()).toBe(false);
  });

  it('registers the token through the RPC and persists the local state', async () => {
    const { client, rpc } = makeClient();
    const result = await registerForYearnPush(client, notifications, undefined, PROJECT_ID);
    expect(result).toEqual({ ok: true, token: TOKEN, platform: 'ios' });
    expect(rpc).toHaveBeenCalledWith('register_device_token', {
      p_token: TOKEN,
      p_platform: 'ios',
    });
    expect(await isYearnPushEnabled()).toBe(true);
  });

  it('does not enable the local flag when the RPC fails', async () => {
    const { client } = makeClient({ rpcError: { message: 'rls denied' } });
    const result = await registerForYearnPush(client, notifications, undefined, PROJECT_ID);
    expect(result).toMatchObject({ ok: false, reason: 'error', error: 'rls denied' });
    expect(await isYearnPushEnabled()).toBe(false);
  });
});

describe('unregisterYearnPush', () => {
  it('deletes exactly the remembered token row and disables the flag', async () => {
    const { client } = makeClient();
    await registerForYearnPush(client, notifications, undefined, PROJECT_ID);

    const { client: second, from, eq } = makeClient();
    const result = await unregisterYearnPush(second);
    expect(result).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith('device_tokens');
    expect(eq).toHaveBeenCalledWith('token', TOKEN);
    expect(await isYearnPushEnabled()).toBe(false);
  });

  it('keeps the flag on when the delete fails so the UI stays honest', async () => {
    const { client } = makeClient();
    await registerForYearnPush(client, notifications, undefined, PROJECT_ID);

    const { client: failing } = makeClient({ deleteError: { message: 'network down' } });
    const result = await unregisterYearnPush(failing);
    expect(result).toMatchObject({ ok: false, error: 'network down' });
    expect(await isYearnPushEnabled()).toBe(true);
  });

  it('succeeds with nothing to remove when no token was stored', async () => {
    const { client, from } = makeClient();
    const result = await unregisterYearnPush(client);
    expect(result).toEqual({ ok: true });
    expect(from).not.toHaveBeenCalled();
    expect(await isYearnPushEnabled()).toBe(false);
  });
});
