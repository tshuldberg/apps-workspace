// Plan 38 Phase 4 (Track B): the WEB container/ID3 probe seam. This is NOT a
// byte-identical twin -- it is a per-surface adapter mirroring the mobile
// library-probe.ts null-out pattern. The web app ships no bundled container
// prober, so probeContainer resolves to null; the pure library-extract-core path
// already returns usable metadata with ZERO setup, so a null probe never blocks
// ingest -- it just means no container-derived extras. A future build may wire a
// WASM prober behind this same seam without touching the store or the twin cores.

/** Container-derived extras a prober may supply. All optional. */
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

/**
 * Probe a media file for container-level metadata. The web build ships no
 * prober, so this resolves null (honest, Expo-Go-parallel default). Never throws.
 */
export const probeContainer: ProbeContainerFn = async () => null;
