// Yearn push registration client (plan 47 Phase 4).
//
// The ONLY module that imports expo-notifications, mirroring the BestChef
// push wrapper so the native module stays out of the wider test graph.
// Every path returns an honest result shape; no path fakes a registered
// token or a "push enabled" state.
//
// Honesty rules:
//   * A real Expo push token needs the EAS projectId. Until the founder
//     provisions one in app.json, registration returns
//     { ok: false, reason: 'not_provisioned' } rather than a fake token.
//   * Push is a single master toggle. Turning it off deletes THIS device's
//     token row (other devices keep their own registrations); the fanout
//     worker also prunes DeviceNotRegistered tokens, so a missed
//     unregister self-heals.
//   * Pushes carry no content (chat is E2EE); the server composes copy from
//     the kind alone, so nothing here handles message bodies.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { yearnSecureStorage } from './supabase';

const PROJECT_ID_PLACEHOLDER = 'REPLACE_WITH_EAS_PROJECT_ID';
const REGISTER_RPC = 'register_device_token';
const LAST_TOKEN_KEY = 'yearn.push.lastToken';
const ENABLED_KEY = 'yearn.push.enabled';

export type PushPlatform = 'ios' | 'android';

export type PushUnavailableReason =
  | 'not_provisioned' // EAS projectId absent or still the placeholder
  | 'permission_denied' // the OS denied notification permission
  | 'unsupported' // no token available (e.g. simulator)
  | 'error';

export type PushRegistrationResult =
  | { ok: true; token: string; platform: PushPlatform }
  | { ok: false; reason: PushUnavailableReason; error: string };

export type PushMutationResult = { ok: true } | { ok: false; error: string };

/** Minimal client surface so tests need no supabase-js instance. */
export interface PushSupabaseClient {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<{ error: unknown }>;
  from(table: string): {
    delete(): {
      eq(column: string, value: string): PromiseLike<{ error: unknown }>;
    };
  };
}

interface ExpoConfigSource {
  expoConfig?: { extra?: { eas?: { projectId?: unknown } } } | null;
  easConfig?: { projectId?: unknown } | null;
}

export interface PushRuntime {
  getPermissionsAsync(): Promise<{ status: string; canAskAgain?: boolean }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  getExpoPushTokenAsync(options: { projectId: string }): Promise<{ data: string }>;
}

interface PushStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

export function currentPushPlatform(): PushPlatform {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

/**
 * Resolves the EAS projectId that getExpoPushTokenAsync requires. Returns
 * null when absent or still the placeholder so callers surface an honest
 * "not provisioned" state rather than crash on request.
 */
export function resolvePushProjectId(
  source: ExpoConfigSource = Constants as ExpoConfigSource,
): string | null {
  const candidates = [source.expoConfig?.extra?.eas?.projectId, source.easConfig?.projectId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed && trimmed !== PROJECT_ID_PLACEHOLDER) return trimmed;
    }
  }
  return null;
}

const defaultRuntime: PushRuntime = {
  getPermissionsAsync: () => Notifications.getPermissionsAsync(),
  requestPermissionsAsync: () => Notifications.requestPermissionsAsync(),
  getExpoPushTokenAsync: (options) => Notifications.getExpoPushTokenAsync(options),
};

/**
 * Register this device for push: permission, Expo token, then the
 * register_device_token RPC (definer-pinned to auth.uid()). Persists the
 * token locally so unregister can remove exactly this device's row.
 */
export async function registerForYearnPush(
  client: PushSupabaseClient,
  runtime: PushRuntime = defaultRuntime,
  storage: PushStorage = yearnSecureStorage,
  projectId: string | null = resolvePushProjectId(),
): Promise<PushRegistrationResult> {
  if (!projectId) {
    return {
      ok: false,
      reason: 'not_provisioned',
      error: 'This build has no EAS project id, so push tokens cannot be issued yet.',
    };
  }

  try {
    let { status } = await runtime.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await runtime.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') {
      return {
        ok: false,
        reason: 'permission_denied',
        error: 'Notification permission was denied. Enable it in Settings to get pushes.',
      };
    }

    const token = (await runtime.getExpoPushTokenAsync({ projectId })).data?.trim();
    if (!token) {
      return { ok: false, reason: 'unsupported', error: 'No push token is available on this device.' };
    }

    const platform = currentPushPlatform();
    const { error } = await client.rpc(REGISTER_RPC, { p_token: token, p_platform: platform });
    if (error) {
      return { ok: false, reason: 'error', error: errMessage(error) };
    }

    await storage.setItem(LAST_TOKEN_KEY, token);
    await storage.setItem(ENABLED_KEY, 'true');
    return { ok: true, token, platform };
  } catch (error) {
    return { ok: false, reason: 'error', error: errMessage(error) };
  }
}

/**
 * Unregister this device: deletes the locally remembered token's row
 * (RLS delete-own policy) and clears the local flag. Succeeds when no
 * token was stored (nothing to remove).
 */
export async function unregisterYearnPush(
  client: PushSupabaseClient,
  storage: PushStorage = yearnSecureStorage,
): Promise<PushMutationResult> {
  try {
    const token = await storage.getItem(LAST_TOKEN_KEY);
    if (token) {
      const { error } = await client.from('device_tokens').delete().eq('token', token);
      if (error) return { ok: false, error: errMessage(error) };
      await storage.removeItem(LAST_TOKEN_KEY);
    }
    await storage.setItem(ENABLED_KEY, 'false');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

/** Local master-toggle state; never claims a live registration by itself. */
export async function isYearnPushEnabled(
  storage: PushStorage = yearnSecureStorage,
): Promise<boolean> {
  try {
    return (await storage.getItem(ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/**
 * Foreground presentation: show banners while the app is open. Called once
 * from the root layout; safe anywhere (no permissions required).
 */
export function configureYearnNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
