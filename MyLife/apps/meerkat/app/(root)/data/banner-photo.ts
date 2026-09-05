// Plan 38 Phase 1c: pick + downscale a community banner photo. Mirrors
// avatar-photo.ts (expo-image-picker + expo-image-manipulator, lazy-required,
// null out when absent so the editor degrades instead of crashing). A banner is
// wider than an avatar and is NOT stored in-row: the caller seals it as a
// library object, so this module returns base64 JPEG bytes that fit the sealed
// banner plaintext cap (COMMUNITY_BANNER_MAX_BYTES). The final byte-size gate is
// re-enforced when the sealed object's manifest.size is validated in @mylife/sync.
import { decodeBase64 } from 'tweetnacl-util';
import { COMMUNITY_BANNER_MAX_BYTES } from '@mylife/sync';

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
  resize(size: { width: number; height?: number }): ManipulateContext;
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

/** Downscale width in px. Banners render full-bleed across a header. */
const BANNER_WIDTH = 1024;

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
export function isBannerPhotoSupported(): boolean {
  return loadImagePicker() !== null && loadImageManipulator() !== null;
}

async function resizeToBannerBase64(
  uri: string,
  mod: ImageManipulatorModule,
  compress: number,
): Promise<string | null> {
  const format = mod.SaveFormat?.JPEG ?? 'jpeg';
  const saveOptions = { compress, format, base64: true };
  // New context API (Expo SDK 52+): width-only resize preserves aspect ratio.
  const manipulate = mod.manipulate
    ?? (mod.ImageManipulator ? mod.ImageManipulator.manipulate.bind(mod.ImageManipulator) : undefined);
  if (typeof manipulate === 'function') {
    const rendered = await manipulate(uri).resize({ width: BANNER_WIDTH }).renderAsync();
    const saved = await rendered.saveAsync(saveOptions);
    return saved.base64 ?? null;
  }
  if (typeof mod.manipulateAsync === 'function') {
    const saved = await mod.manipulateAsync(uri, [{ resize: { width: BANNER_WIDTH } }], saveOptions);
    return saved.base64 ?? null;
  }
  return null;
}

/** Decoded byte length of a base64 string (0 when it does not decode). */
function base64ByteLength(base64: string): number {
  try {
    return decodeBase64(base64).length;
  } catch {
    return 0;
  }
}

export type BannerPickResult =
  | { ok: true; base64: string }
  | { ok: false; reason: 'unavailable' | 'permission' | 'canceled' | 'too_large' | 'failed' };

/**
 * Pick a photo and downscale it to a JPEG that fits the sealed-banner plaintext
 * cap. Re-compresses once at a lower quality if the first pass is over cap before
 * giving up as 'too_large'. Never throws; every failure is a typed reason so the
 * editor can show honest recovery copy.
 */
export async function pickAndResizeBanner(): Promise<BannerPickResult> {
  const picker = loadImagePicker();
  const manipulator = loadImageManipulator();
  if (!picker || !manipulator) return { ok: false, reason: 'unavailable' };
  try {
    const permission = await picker.requestMediaLibraryPermissionsAsync();
    if (!permission?.granted) return { ok: false, reason: 'permission' };
    const picked = await picker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets || picked.assets.length === 0) {
      return { ok: false, reason: 'canceled' };
    }
    const uri = picked.assets[0].uri;
    for (const compress of [0.7, 0.5, 0.35]) {
      const base64 = await resizeToBannerBase64(uri, manipulator, compress);
      if (!base64) return { ok: false, reason: 'failed' };
      const bytes = base64ByteLength(base64);
      if (bytes >= 1 && bytes <= COMMUNITY_BANNER_MAX_BYTES) return { ok: true, base64 };
    }
    return { ok: false, reason: 'too_large' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
