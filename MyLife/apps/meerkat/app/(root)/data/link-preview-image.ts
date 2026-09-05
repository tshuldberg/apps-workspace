// Plan 32 T3.2: sender-side og:image downscale for link previews. expo-image-
// manipulator is a native SDK module (dev/EAS build only); it is lazy-required
// and nulls out when absent (Expo Go / a build without it), mirroring
// avatar-photo.ts, so a preview still carries text (no image) instead of
// crashing. This runs on the SENDER only; the receiver never touches it.
//
// The manipulator accepts bounded local image bytes and returns a <=320px JPEG
// base64. All of this is sender-device-only work; the resulting bytes ride the
// verified attachment/blob pipeline, so the receiver renders from local blob
// bytes and never fetches the remote image.
import { LINK_PREVIEW_IMAGE_MAX_DIMENSION } from './link-preview';

interface ManipulatedImage {
  uri: string;
  base64?: string | null;
}
interface ImageRef {
  saveAsync(options: Record<string, unknown>): Promise<ManipulatedImage>;
}
interface ManipulateContext {
  resize(size: { width?: number; height?: number }): ManipulateContext;
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

function loadImageManipulator(): ImageManipulatorModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-manipulator') as ImageManipulatorModule;
  } catch {
    return null;
  }
}

/**
 * Downscale a downloaded og:image to a <=320px-wide JPEG and return its base64, or
 * null when the native module is absent or the image is unusable. NEVER throws.
 * Intended to be passed as buildLinkPreview's downscaleImage hook (sender only).
 */
export async function downscaleLinkPreviewImage(imageUrl: string): Promise<string | null> {
  if (!/^data:image\/(?:jpeg|png|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(imageUrl)) return null;
  const mod = loadImageManipulator();
  if (!mod) return null;
  try {
    const format = mod.SaveFormat?.JPEG ?? 'jpeg';
    const saveOptions = { compress: 0.7, format, base64: true };
    // Resize by width only so the aspect ratio is kept; cap the long edge at 320.
    const resize = { width: LINK_PREVIEW_IMAGE_MAX_DIMENSION };
    const manipulate = mod.manipulate
      ?? (mod.ImageManipulator ? mod.ImageManipulator.manipulate.bind(mod.ImageManipulator) : undefined);
    if (typeof manipulate === 'function') {
      const rendered = await manipulate(imageUrl).resize(resize).renderAsync();
      const saved = await rendered.saveAsync(saveOptions);
      return saved.base64 ?? null;
    }
    if (typeof mod.manipulateAsync === 'function') {
      const saved = await mod.manipulateAsync(imageUrl, [{ resize }], saveOptions);
      return saved.base64 ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
