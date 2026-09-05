// Plan 32 T2.3: pick + downscale a community avatar photo. expo-image-picker and
// expo-image-manipulator are Expo SDK modules that exist only in a dev/EAS build
// with them installed; they are lazy-required and null out when absent (Expo Go /
// a build without them), mirroring lan-backend.ts, so the editor degrades to the
// initial flow instead of crashing. The downscale + cap check happen here; the
// signed-event cap is re-enforced in @mylife/sync (create AND verify).
import { isValidCommunityAvatarImage } from '@mylife/sync';

interface ImagePickerAsset {
  uri: string;
  base64?: string | null;
}
interface ImagePickerResult {
  canceled: boolean;
  assets?: ImagePickerAsset[] | null;
}
interface ImagePickerModule {
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  launchImageLibraryAsync(options: Record<string, unknown>): Promise<ImagePickerResult>;
}

interface ManipulatedImage {
  uri: string;
  base64?: string | null;
}
interface ImageRef {
  saveAsync(options: Record<string, unknown>): Promise<ManipulatedImage>;
}
interface ManipulateContext {
  resize(size: { width: number; height: number }): ManipulateContext;
  renderAsync(): Promise<ImageRef>;
}
interface ImageManipulatorModule {
  SaveFormat?: { JPEG?: unknown };
  ImageManipulator?: { manipulate(uri: string): ManipulateContext };
  manipulate?(uri: string): ManipulateContext;
  manipulateAsync?(
    uri: string,
    actions: unknown[],
    options: Record<string, unknown>,
  ): Promise<ManipulatedImage>;
}

function loadImagePicker(): ImagePickerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker') as ImagePickerModule;
  } catch {
    return null;
  }
}

function loadImageManipulator(): ImageManipulatorModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-manipulator') as ImageManipulatorModule;
  } catch {
    return null;
  }
}

/** True only when BOTH native image modules are present (dev/EAS build). */
export function isAvatarPhotoSupported(): boolean {
  return loadImagePicker() !== null && loadImageManipulator() !== null;
}

async function resizeToAvatarBase64(
  uri: string,
  mod: ImageManipulatorModule,
): Promise<string | null> {
  const format = mod.SaveFormat?.JPEG ?? 'jpeg';
  const saveOptions = { compress: 0.7, format, base64: true };
  // New context API (Expo SDK 52+): manipulate -> resize -> render -> save.
  const manipulate = mod.manipulate
    ?? (mod.ImageManipulator ? mod.ImageManipulator.manipulate.bind(mod.ImageManipulator) : undefined);
  if (typeof manipulate === 'function') {
    const rendered = await manipulate(uri).resize({ width: 128, height: 128 }).renderAsync();
    const saved = await rendered.saveAsync(saveOptions);
    return saved.base64 ?? null;
  }
  // Legacy manipulateAsync fallback.
  if (typeof mod.manipulateAsync === 'function') {
    const saved = await mod.manipulateAsync(uri, [{ resize: { width: 128, height: 128 } }], saveOptions);
    return saved.base64 ?? null;
  }
  return null;
}

export type AvatarPickResult =
  | { ok: true; base64: string }
  | { ok: false; reason: 'unavailable' | 'permission' | 'canceled' | 'too_large' | 'failed' };

/**
 * Pick a square photo, downscale it to a 128x128 JPEG, and return the base64 when
 * it is a valid, in-cap avatar. Never throws; every failure is a typed reason so
 * the editor can show honest recovery copy and keep the initial flow.
 */
export async function pickAndResizeAvatar(): Promise<AvatarPickResult> {
  const picker = loadImagePicker();
  const manipulator = loadImageManipulator();
  if (!picker || !manipulator) return { ok: false, reason: 'unavailable' };
  try {
    const permission = await picker.requestMediaLibraryPermissionsAsync();
    if (!permission?.granted) return { ok: false, reason: 'permission' };
    const picked = await picker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets || picked.assets.length === 0) {
      return { ok: false, reason: 'canceled' };
    }
    const base64 = await resizeToAvatarBase64(picked.assets[0].uri, manipulator);
    if (!base64) return { ok: false, reason: 'failed' };
    if (!isValidCommunityAvatarImage(base64)) return { ok: false, reason: 'too_large' };
    return { ok: true, base64 };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
