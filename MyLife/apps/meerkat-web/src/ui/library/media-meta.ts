// Plan 38 Phase 5 (WEB): per-media-type display metadata for the browse UI (icon
// + label). The behavioral registry (schema / sort fields / card shape) lives in
// the data agent's library-metadata-core.ts; this is display-only sugar.

import type { KnownMediaType } from '../../lib/library-metadata-core';

export interface MediaTypeMeta {
  icon: string;
  label: string;
}

export const MEDIA_TYPE_META: Record<KnownMediaType, MediaTypeMeta> = {
  movie: { icon: '🎬', label: 'Movies' },
  show: { icon: '📺', label: 'Shows' },
  music: { icon: '🎵', label: 'Music' },
  photo: { icon: '🖼', label: 'Photos' },
  book: { icon: '📚', label: 'Books' },
  document: { icon: '📄', label: 'Documents' },
  custom: { icon: '🗂', label: 'Custom' },
};
