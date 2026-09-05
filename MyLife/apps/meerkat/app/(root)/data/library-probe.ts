// Plan 38 Phase 4 (Track B): the MOBILE container/ID3 probe seam. This is NOT a
// byte-identical twin -- it is a per-surface native adapter, exactly the
// lan-backend.ts null-out pattern. Deep container probing (MP4/MKV duration +
// dimensions, ID3 tags) needs a native module that exists only in a dev/EAS
// build; in Expo Go (or any build without it) the module is absent, so the
// lazy require fails and probeContainer resolves to null. The pure
// library-extract-core path already returns usable metadata with ZERO setup, so
// a null probe never blocks ingest -- it just means no container-derived extras.

/** Container-derived extras a native prober may supply. All optional. */
export interface ContainerProbe {
  durationMs?: number;
  width?: number;
  height?: number;
  title?: string;
  artist?: string;
  album?: string;
  trackNumber?: number;
}

/** The injectable shape (tests + the store adapter depend on this, not the impl). */
export type ProbeContainerFn = (
  bytes: Uint8Array,
  mimeType: string | null,
) => Promise<ContainerProbe | null>;

interface NativeProberModule {
  probe(bytes: Uint8Array, mimeType: string | null): Promise<ContainerProbe | null>;
}

/** Lazy-load a native prober module, or null when it is absent (Expo Go safe). */
function loadNativeProber(): NativeProberModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-media-probe') as NativeProberModule;
    return mod && typeof mod.probe === 'function' ? mod : null;
  } catch {
    return null;
  }
}

/**
 * Probe a media file for container-level metadata. Resolves null when no native
 * prober is installed (the honest default in Expo Go and any build without the
 * module). Never throws.
 */
export const probeContainer: ProbeContainerFn = async (bytes, mimeType) => {
  const prober = loadNativeProber();
  if (!prober) return null;
  try {
    return await prober.probe(bytes, mimeType);
  } catch {
    return null;
  }
};
