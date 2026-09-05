/**
 * Shared BestChef media upload validation.
 *
 * Public launch media must be server-mediated. The client may hold local
 * `file://` drafts, but public cloud rows must use Supabase Storage keys and
 * approved HTTPS delivery URLs only.
 */

export type BestChefMediaOwnerKind =
  | 'dish'
  | 'submission'
  | 'recipe_snapshot'
  | 'comment'
  | 'post'
  | 'vote_proof'
  | 'product_record'
  | 'product_contribution'
  | 'product_evidence';

export type BestChefMediaKind = 'image' | 'video';

export interface MediaUploadIntent {
  ownerKind: BestChefMediaOwnerKind;
  ownerId: string;
  mediaKind: BestChefMediaKind;
  mimeType: string;
  byteSize: number;
  contentHash: string | null;
  evidenceKind: 'product' | 'receipt' | null;
}

/**
 * Machine error codes for upload-intent rejections (plan 33 Phase 2.2).
 * Clients render localized copy from `code` + `params`; `message` stays as
 * the English ops/debug detail and old-client fallback, never for display.
 */
export type MediaUploadRejectionCode =
  | 'invalid_input'
  | 'unsupported_media_type'
  | 'file_too_large';

export interface MediaUploadRejection {
  ok: false;
  code: MediaUploadRejectionCode;
  message: string;
  params?: Record<string, string | number>;
}

export type MediaValidationResult =
  | { ok: true; intent: MediaUploadIntent; bucket: string; maxBytes: number; extension: string }
  | MediaUploadRejection;

const OWNER_KINDS = new Set<BestChefMediaOwnerKind>([
  'dish',
  'submission',
  'recipe_snapshot',
  'comment',
  'post',
  'vote_proof',
  'product_record',
  'product_contribution',
  'product_evidence',
]);

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

const VIDEO_MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

const IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const VOTE_PROOF_MAX_BYTES = 2 * 1024 * 1024;
const VIDEO_MAX_BYTES = 150 * 1024 * 1024;
const EVIDENCE_MAX_BYTES = 15 * 1024 * 1024;

export const BESTCHEF_MEDIA_BUCKETS = {
  submissionImages: 'bestchef-submission-images',
  submissionVideos: 'bestchef-submission-videos',
  thumbnails: 'bestchef-thumbnails',
  productEvidence: 'bestchef-product-evidence',
  receiptEvidence: 'bestchef-receipt-evidence',
  quarantine: 'bestchef-quarantine',
  voteProofs: 'bestchef-vote-proofs',
} as const;

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mediaKindOrNull(value: unknown): BestChefMediaKind | null {
  return value === 'image' || value === 'video' ? value : null;
}

function ownerKindOrNull(value: unknown): BestChefMediaOwnerKind | null {
  return typeof value === 'string' && OWNER_KINDS.has(value as BestChefMediaOwnerKind)
    ? value as BestChefMediaOwnerKind
    : null;
}

function evidenceKindOrNull(value: unknown): 'product' | 'receipt' | null {
  return value === 'product' || value === 'receipt' ? value : null;
}

function isEvidenceOwner(ownerKind: BestChefMediaOwnerKind): boolean {
  return ownerKind === 'product_record' ||
    ownerKind === 'product_contribution' ||
    ownerKind === 'product_evidence';
}

function bucketForIntent(intent: MediaUploadIntent): string {
  // Vote "proof of cook" photos are camera-captured and can include faces/people,
  // so they go to a private owner-only bucket, never the anon-readable image bucket (TS-05).
  if (intent.ownerKind === 'vote_proof') {
    return BESTCHEF_MEDIA_BUCKETS.voteProofs;
  }
  if (isEvidenceOwner(intent.ownerKind)) {
    return intent.evidenceKind === 'receipt'
      ? BESTCHEF_MEDIA_BUCKETS.receiptEvidence
      : BESTCHEF_MEDIA_BUCKETS.productEvidence;
  }
  return intent.mediaKind === 'video'
    ? BESTCHEF_MEDIA_BUCKETS.submissionVideos
    : BESTCHEF_MEDIA_BUCKETS.submissionImages;
}

function maxBytesForIntent(intent: MediaUploadIntent): number {
  if (intent.ownerKind === 'vote_proof') return VOTE_PROOF_MAX_BYTES;
  if (isEvidenceOwner(intent.ownerKind)) return EVIDENCE_MAX_BYTES;
  return intent.mediaKind === 'video' ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
}

function extensionForMime(mediaKind: BestChefMediaKind, mimeType: string): string | null {
  if (mediaKind === 'image') return IMAGE_MIME_EXTENSIONS[mimeType] ?? null;
  return VIDEO_MIME_EXTENSIONS[mimeType] ?? null;
}

export function validateMediaUploadIntent(body: Record<string, unknown>): MediaValidationResult {
  if (stringOrNull(body.remoteUrl) || stringOrNull(body.localUri)) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Upload intent must not include local or remote media URLs.',
    };
  }

  const ownerKind = ownerKindOrNull(body.ownerKind ?? body.owner_kind);
  if (!ownerKind) {
    return { ok: false, code: 'invalid_input', message: 'Unsupported media owner kind.' };
  }

  const ownerId = stringOrNull(body.ownerId ?? body.owner_id);
  if (!ownerId || ownerId.length > 160) {
    return {
      ok: false,
      code: 'invalid_input',
      message: 'Media owner id is required and must be 160 characters or fewer.',
    };
  }

  const mediaKind = mediaKindOrNull(body.mediaKind ?? body.media_kind);
  if (!mediaKind) {
    return { ok: false, code: 'invalid_input', message: 'Media kind must be image or video.' };
  }

  const mimeType = stringOrNull(body.mimeType ?? body.mime_type)?.toLowerCase() ?? null;
  if (!mimeType) {
    return { ok: false, code: 'invalid_input', message: 'MIME type is required.' };
  }

  const extension = extensionForMime(mediaKind, mimeType);
  if (!extension) {
    return {
      ok: false,
      code: 'unsupported_media_type',
      message: 'Unsupported media MIME type.',
      params: { mimeType, mediaKind },
    };
  }

  const byteSize = numberOrNull(body.byteSize ?? body.byte_size);
  if (!byteSize || byteSize <= 0) {
    return { ok: false, code: 'invalid_input', message: 'Byte size is required.' };
  }

  const contentHash = stringOrNull(body.contentHash ?? body.content_hash);
  const evidenceKind = evidenceKindOrNull(body.evidenceKind ?? body.evidence_kind);
  const intent: MediaUploadIntent = {
    ownerKind,
    ownerId,
    mediaKind,
    mimeType,
    byteSize,
    contentHash,
    evidenceKind,
  };
  const maxBytes = maxBytesForIntent(intent);
  if (byteSize > maxBytes) {
    return {
      ok: false,
      code: 'file_too_large',
      message: `Media exceeds the ${maxBytes} byte upload limit.`,
      params: { maxBytes, byteSize, mediaKind },
    };
  }

  return {
    ok: true,
    intent,
    bucket: bucketForIntent(intent),
    maxBytes,
    extension,
  };
}

export function safeMediaPathSegment(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe.slice(0, 96) || 'unknown';
}

export function buildMediaStorageKey(input: {
  userId: string;
  ownerKind: BestChefMediaOwnerKind;
  ownerId: string;
  uploadId: string;
  extension: string;
}): string {
  return [
    safeMediaPathSegment(input.userId),
    input.ownerKind,
    safeMediaPathSegment(input.ownerId),
    `${safeMediaPathSegment(input.uploadId)}.${input.extension}`,
  ].join('/');
}
