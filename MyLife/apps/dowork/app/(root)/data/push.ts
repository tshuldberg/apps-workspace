// DoWork push registration + notification preferences client.
//
// This is the ONLY module that imports expo-notifications, expo-secure-store,
// and expo-crypto, so those native modules stay out of the wider test graph
// (screens and the provider import this wrapper; its own test mocks all
// three plus expo-constants). Everything returns the house result shape
// ({ ok: true, ... } | { ok: false, ... }); no path fakes a registered token
// or a "push enabled" state.
//
// Honesty rules baked in here:
//   * A real Expo push token needs the EAS projectId. Until the app is
//     provisioned (founder-ops F2) app.json carries a placeholder, so
//     registration returns { ok: false, reason: 'not_provisioned' } with a
//     clear message. We never write a fake token.
//   * Per-type opt-outs are meaningless on-device (Expo cannot filter after
//     delivery), so they live in dw_notification_prefs and are enforced by the
//     dowork-notify function. This client only reads/writes that table.
//   * Push tokens are scoped to THIS device via a SecureStore-persisted id
//     (getPushDeviceId). Sign-out or notifications-off on one device must
//     never deregister push on a user's other signed-in devices (RT-7).

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { SupabaseClient } from '@supabase/supabase-js';

const PUSH_TOKENS_TABLE = 'dw_push_tokens';
const PREFS_TABLE = 'dw_notification_prefs';
const PROJECT_ID_PLACEHOLDER = 'REPLACE_WITH_EAS_PROJECT_ID';
const ANDROID_CHANNEL_ID = 'default';
const DEVICE_ID_KEY = 'dowork.push.deviceId';

// Stable per-install identifier, generated once and kept in SecureStore (not
// hub_settings: it must survive independently of any single app-data reset
// and never sync between devices). Scoping push-token reads/deletes to this
// id is what keeps sign-out or notifications-off on ONE device from
// deregistering push on every device the user is signed into (RT-7).
let cachedDeviceId: string | null = null;

export async function getPushDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }
  } catch {
    // fall through to generating a fresh id for this session
  }
  const generated = Crypto.randomUUID();
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  } catch {
    // SecureStore write failed (e.g. unsupported target); the id still works
    // for this session, it just will not survive an app restart.
  }
  cachedDeviceId = generated;
  return generated;
}

export type PushPlatform = 'ios' | 'android';

// Maps a notification's data payload (the shape dowork-notify sends) to an
// in-app route for tap handling. Returns null for anything malformed so a
// crafted or truncated payload can never navigate somewhere unexpected. Kept
// pure so the routing contract is unit-tested without the native listeners.
export function resolveNotificationRoute(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const type = record.type;
  const asId = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  if (type === 'new_video') {
    const videoId = asId(record.videoId);
    return videoId ? `/(root)/player?videoId=${encodeURIComponent(videoId)}` : null;
  }
  if (type === 'form_check' || type === 'form_feedback') {
    const formCheckId = asId(record.formCheckId);
    return formCheckId ? `/(root)/form-check/${encodeURIComponent(formCheckId)}` : null;
  }
  return null;
}

export type NotificationTypeKey = 'new_video' | 'form_check' | 'form_feedback' | 'marketing';

export interface NotificationPrefs {
  new_video: boolean;
  form_check: boolean;
  form_feedback: boolean;
  marketing: boolean;
}

// Mirrors the dw_notification_prefs defaults (marketing is opt-in). A missing
// row is treated as these values on both the server and here.
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  new_video: true,
  form_check: true,
  form_feedback: true,
  marketing: false,
};

export type PushUnavailableReason =
  | 'not_provisioned' // EAS projectId is still the placeholder (founder-ops F2)
  | 'permission_denied' // the OS denied notification permission
  | 'unsupported' // no token available (e.g. simulator / unsupported device)
  | 'cloud_unavailable' // no cloud session to attach the token to
  | 'error'; // an unexpected failure

export type PushRegistrationResult =
  | { ok: true; token: string; platform: PushPlatform }
  | { ok: false; reason: PushUnavailableReason; error: string };

export type PushMutationResult = { ok: true } | { ok: false; error: string };

export type NotificationPrefsResult =
  | { ok: true; prefs: NotificationPrefs; hasRow: boolean }
  | { ok: false; error: string };

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
// when the value is absent or still the app.json placeholder, so callers can
// surface an honest "not provisioned yet" state rather than crash on request.
export function resolvePushProjectId(source: ExpoConfigSource = Constants as ExpoConfigSource): string | null {
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
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'DoWork',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch {
    // A missing channel is not fatal to token registration.
  }
}

async function upsertPushToken(
  supabase: SupabaseClient,
  userId: string,
  token: string,
  platform: PushPlatform,
): Promise<PushMutationResult> {
  const deviceId = await getPushDeviceId();
  const { error } = await supabase
    .from(PUSH_TOKENS_TABLE)
    .upsert(
      { user_id: userId, expo_token: token, platform, device_id: deviceId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,expo_token' },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface RegisterPushOptions {
  // When false, never trigger the OS permission prompt: only refresh the token
  // if permission was already granted. Used for the silent sign-in refresh so
  // we do not ambush the user with a system dialog at launch.
  promptIfNeeded?: boolean;
}

// Registers this device's Expo push token against the signed-in user. Honest at
// every gate: no projectId, no permission, or no token each return a distinct
// { ok: false, reason } instead of pretending push is on.
export async function registerPushToken(
  supabase: SupabaseClient | null,
  userId: string | null,
  options: RegisterPushOptions = {},
): Promise<PushRegistrationResult> {
  const promptIfNeeded = options.promptIfNeeded ?? true;

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
  const write = await upsertPushToken(supabase, userId, token, platform);
  if (!write.ok) {
    return { ok: false, reason: 'error', error: write.error };
  }
  return { ok: true, token, platform };
}

// Silent sign-in refresh: only re-registers when permission is already granted
// and the app is provisioned, so it never prompts. Safe to call on every session.
export async function refreshPushTokenIfEnabled(
  supabase: SupabaseClient | null,
  userId: string | null,
): Promise<PushRegistrationResult> {
  return registerPushToken(supabase, userId, { promptIfNeeded: false });
}

// Whether THIS DEVICE already has a registered token. The screen uses it to
// show the master toggle's real state, and the provider uses it to refresh
// only an existing registration on sign-in (never to resurrect one the user
// turned off). Scoped to this device's id so another signed-in device's
// registration never leaks into this device's toggle state. Owner RLS scopes
// the read to the caller on top of that.
export async function hasPushTokens(
  supabase: SupabaseClient | null,
  userId: string | null,
): Promise<{ ok: true; exists: boolean } | { ok: false; error: string }> {
  if (!supabase || !userId) return { ok: true, exists: false };
  try {
    const deviceId = await getPushDeviceId();
    const { data, error } = await supabase
      .from(PUSH_TOKENS_TABLE)
      .select('expo_token')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true, exists: Array.isArray(data) && data.length > 0 };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

// Removes THIS DEVICE's push tokens only (owner RLS scopes the delete to
// auth.uid(); device_id further scopes it to this install). Called on
// sign-out and when the master toggle is turned off. Deliberately does NOT
// touch other devices' registrations for the same user: signing out or
// muting notifications on a phone must not silently kill push on a tablet.
// dowork-notify also prunes DeviceNotRegistered tokens, so a missed delete
// self-heals.
export async function removePushTokens(
  supabase: SupabaseClient | null,
  userId: string | null,
): Promise<PushMutationResult> {
  if (!supabase || !userId) return { ok: true };
  try {
    const deviceId = await getPushDeviceId();
    const { error } = await supabase
      .from(PUSH_TOKENS_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

function coercePrefs(row: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFS };
  return {
    new_video: typeof row.new_video === 'boolean' ? row.new_video : DEFAULT_NOTIFICATION_PREFS.new_video,
    form_check: typeof row.form_check === 'boolean' ? row.form_check : DEFAULT_NOTIFICATION_PREFS.form_check,
    form_feedback:
      typeof row.form_feedback === 'boolean' ? row.form_feedback : DEFAULT_NOTIFICATION_PREFS.form_feedback,
    marketing: typeof row.marketing === 'boolean' ? row.marketing : DEFAULT_NOTIFICATION_PREFS.marketing,
  };
}

export async function getNotificationPrefs(
  supabase: SupabaseClient | null,
  userId: string | null,
): Promise<NotificationPrefsResult> {
  if (!supabase || !userId) {
    return { ok: true, prefs: { ...DEFAULT_NOTIFICATION_PREFS }, hasRow: false };
  }
  try {
    const { data, error } = await supabase
      .from(PREFS_TABLE)
      .select('new_video,form_check,form_feedback,marketing')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, prefs: coercePrefs(data as Partial<NotificationPrefs> | null), hasRow: Boolean(data) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function saveNotificationPrefs(
  supabase: SupabaseClient | null,
  userId: string | null,
  prefs: NotificationPrefs,
): Promise<PushMutationResult> {
  if (!supabase || !userId) {
    return { ok: false, error: 'Sign in to save your notification preferences.' };
  }
  try {
    const { error } = await supabase
      .from(PREFS_TABLE)
      .upsert(
        {
          user_id: userId,
          new_video: prefs.new_video,
          form_check: prefs.form_check,
          form_feedback: prefs.form_feedback,
          marketing: prefs.marketing,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
