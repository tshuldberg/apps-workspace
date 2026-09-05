// BestChef push registration client (audit H13).
//
// This is the ONLY module that imports expo-notifications, so the native module
// stays out of the wider test graph (the router + settings import this wrapper;
// its own test mocks expo-notifications + expo-constants). Every path returns
// the house result shape ({ ok: true, ... } | { ok: false, reason, error });
// no path fakes a registered token or a "push enabled" state.
//
// Honesty rules:
//   * A real Expo push token needs the EAS projectId. app.json carries the real
//     BestChef projectId, but if a build ever ships without one, registration
//     returns { ok: false, reason: 'not_provisioned' } rather than a fake token.
//   * The DEVICE LOCALE is captured here and stored on the token row via the
//     bc_register_push_token RPC, because the fanout worker renders push copy
//     server-side (the device may be asleep at send time). The locale passed in
//     is the user's chosen BestChef language, falling back to the device locale.
//   * There is no server-side per-kind opt-out table: BestChef push is a single
//     master toggle. Turning it off unregisters the device token so nothing is
//     sent; the fanout worker also prunes DeviceNotRegistered tokens, so a
//     missed unregister self-heals.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { SupabaseClient } from '@supabase/supabase-js';

const PROJECT_ID_PLACEHOLDER = 'REPLACE_WITH_EAS_PROJECT_ID';
const REGISTER_RPC = 'bc_register_push_token';
const UNREGISTER_RPC = 'bc_unregister_push_token';

export type PushPlatform = 'ios' | 'android';

export type PushUnavailableReason =
  | 'not_provisioned' // EAS projectId is still the placeholder
  | 'permission_denied' // the OS denied notification permission
  | 'unsupported' // no token available (e.g. simulator / unsupported device)
  | 'cloud_unavailable' // no cloud session to attach the token to
  | 'error';

export type PushRegistrationResult =
  | { ok: true; token: string; platform: PushPlatform }
  | { ok: false; reason: PushUnavailableReason; error: string };

export type PushMutationResult = { ok: true } | { ok: false; error: string };

interface ExpoConfigSource {
  expoConfig?: { extra?: { eas?: { projectId?: unknown } } } | null;
  easConfig?: { projectId?: unknown } | null;
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

// Resolves the EAS projectId that getExpoPushTokenAsync requires. Returns null
// when absent or still the app.json placeholder so callers surface an honest
// "not provisioned" state rather than crash on request.
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

export function isPushProvisioned(): boolean {
  return resolvePushProjectId() !== null;
}

function isGranted(status: Notifications.PermissionStatus | string | undefined): boolean {
  return status === 'granted';
}

export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (isGranted(current.status)) return 'granted';
    if (current.status === 'undetermined') return 'undetermined';
    return 'denied';
  } catch {
    return 'undetermined';
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'BestChef',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch {
    // A missing channel is not fatal to token registration.
  }
}

export interface RegisterPushOptions {
  // The user's BestChef language (from useI18n().language). Stored on the token
  // row so the fanout worker can render push copy server-side. Defaults to 'en'.
  locale?: string;
  // When false, never trigger the OS permission prompt: only refresh the token
  // if permission was already granted. Used for the silent sign-in refresh so
  // we do not ambush the user with a system dialog at launch.
  promptIfNeeded?: boolean;
}

// Registers this device's Expo push token against the signed-in user via the
// bc_register_push_token RPC (which re-owns a token that moved devices and
// stores the locale). Honest at every gate: no projectId, no permission, or no
// token each return a distinct { ok: false, reason }.
export async function registerPushToken(
  supabase: SupabaseClient | null,
  userId: string | null,
  options: RegisterPushOptions = {},
): Promise<PushRegistrationResult> {
  const promptIfNeeded = options.promptIfNeeded ?? true;
  const locale = options.locale?.trim() || 'en';

  if (!supabase || !userId) {
    return { ok: false, reason: 'cloud_unavailable', error: 'Sign in to enable notifications.' };
  }

  const projectId = resolvePushProjectId();
  if (!projectId) {
    return {
      ok: false,
      reason: 'not_provisioned',
      error: 'Push notifications become available once the app is provisioned for the store.',
    };
  }

  await ensureAndroidChannel();

  try {
    let status = (await Notifications.getPermissionsAsync()).status;
    if (!isGranted(status)) {
      if (!promptIfNeeded) {
        return { ok: false, reason: 'permission_denied', error: 'Notifications are turned off.' };
      }
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (!isGranted(status)) {
      return {
        ok: false,
        reason: 'permission_denied',
        error: 'Notifications are turned off. Enable them in your device Settings.',
      };
    }
  } catch (error) {
    return { ok: false, reason: 'error', error: errMessage(error) };
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (error) {
    // getExpoPushTokenAsync throws on unsupported targets (e.g. simulators);
    // surface that honestly rather than as a spurious error toast.
    return { ok: false, reason: 'unsupported', error: errMessage(error) };
  }

  if (!token) {
    return { ok: false, reason: 'unsupported', error: 'No push token was returned by the device.' };
  }

  const platform = currentPushPlatform();
  const { error } = await supabase.rpc(REGISTER_RPC, {
    p_token: token,
    p_platform: platform,
    p_locale: locale,
  });
  if (error) {
    return { ok: false, reason: 'error', error: error.message };
  }
  return { ok: true, token, platform };
}

// Silent sign-in refresh: only re-registers when permission is already granted
// and the app is provisioned, so it never prompts. Also refreshes the stored
// locale for an already-registered device when the user changes language.
export async function refreshPushTokenIfEnabled(
  supabase: SupabaseClient | null,
  userId: string | null,
  locale?: string,
): Promise<PushRegistrationResult> {
  return registerPushToken(supabase, userId, { promptIfNeeded: false, locale });
}

// Whether this device's Expo token is registered for the signed-in user. The
// settings screen uses it to show the toggle's real state without prompting.
export async function isDeviceRegistered(
  supabase: SupabaseClient | null,
  userId: string | null,
): Promise<{ ok: true; registered: boolean } | { ok: false; error: string }> {
  if (!supabase || !userId) return { ok: true, registered: false };
  if (!isPushProvisioned()) return { ok: true, registered: false };
  try {
    if ((await getPushPermissionStatus()) !== 'granted') {
      return { ok: true, registered: false };
    }
    const projectId = resolvePushProjectId();
    if (!projectId) return { ok: true, registered: false };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = data;
    if (!token) return { ok: true, registered: false };
    const { data: rows, error } = await supabase
      .from('bc_push_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('token', token)
      .limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true, registered: Array.isArray(rows) && rows.length > 0 };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Removes this device's token (settings toggle OFF / sign-out). Best-effort:
// unregisters the CURRENT device token when resolvable, and always clears any
// token rows owned by this user as a fallback so the toggle reliably stops push.
export async function unregisterPushToken(
  supabase: SupabaseClient | null,
  userId: string | null,
): Promise<PushMutationResult> {
  if (!supabase || !userId) return { ok: true };
  try {
    const projectId = resolvePushProjectId();
    if (projectId && (await getPushPermissionStatus()) === 'granted') {
      try {
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (data) {
          const { error } = await supabase.rpc(UNREGISTER_RPC, { p_token: data });
          if (error) return { ok: false, error: error.message };
          return { ok: true };
        }
      } catch {
        // Fall through to the owner-scoped bulk delete below.
      }
    }
    // Fallback: owner RLS scopes this delete to auth.uid()'s own rows.
    const { error } = await supabase.from('bc_push_tokens').delete().eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
