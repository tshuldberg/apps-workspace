/**
 * Typed media upload/finalize failures (plan 33 Phase 2.2).
 *
 * Mirrors the CastVoteWithProofResult pattern from Phase 1.2b: modules
 * return `{ code, message, retryable, params? }` where `message` is an
 * English natural i18n key the app renders with `t(message, params)`.
 * `retryable` drives the offline-draft path: permanent validation failures
 * must never queue a draft that retries forever.
 */

import { classifyEdgeStatus, parseEdgeFunctionError, type ParsedEdgeError } from './edge-errors';

export type MediaUploadErrorCode =
  | 'file_too_large'
  | 'unsupported_media_type'
  | 'invalid_input'
  | 'auth'
  | 'profile_required'
  | 'rate_limited'
  | 'not_found'
  | 'service_unavailable'
  | 'network'
  | 'unknown';

export interface MediaUploadFailure {
  ok: false;
  code: MediaUploadErrorCode;
  /** English natural i18n key; render with t(message, params). */
  message: string;
  retryable: boolean;
  params?: Record<string, string | number>;
}

export type MediaUploadResult<T> = { ok: true; data: T } | MediaUploadFailure;

/**
 * retryable drives the offline-draft affordance. rate_limited is
 * deliberately NOT retryable, matching the Phase 1.2b vote-flow precedent:
 * the user is told to try later instead of stacking drafts that hammer the
 * durable quota the moment they sweep.
 */
const KNOWN_MEDIA_ERROR_CODES: readonly MediaUploadErrorCode[] = [
  'file_too_large',
  'unsupported_media_type',
  'invalid_input',
  'auth',
  'profile_required',
  'rate_limited',
  'not_found',
  'service_unavailable',
  'network',
  'unknown',
];

/** Collapse arbitrary error strings (queue lastError etc.) to a known code. */
export function normalizeMediaUploadErrorCode(value: string | null | undefined): MediaUploadErrorCode {
  return (KNOWN_MEDIA_ERROR_CODES as readonly string[]).includes(value ?? '')
    ? (value as MediaUploadErrorCode)
    : 'unknown';
}

export function describeMediaUploadError(
  code: MediaUploadErrorCode,
): { message: string; retryable: boolean } {
  switch (code) {
    case 'file_too_large':
      return { message: 'This file is too large. The limit is {maxMb} MB.', retryable: false };
    case 'unsupported_media_type':
      return { message: 'This file type is not supported.', retryable: false };
    case 'invalid_input':
      return { message: 'The upload request was invalid. Try again with a new photo.', retryable: false };
    case 'auth':
      return { message: 'Sign in before uploading.', retryable: false };
    case 'profile_required':
      return { message: 'Create your BestChef profile before uploading.', retryable: false };
    case 'rate_limited':
      return { message: 'Upload limit reached. Try again later.', retryable: false };
    case 'not_found':
      return { message: 'The uploaded photo could not be found. Try uploading again.', retryable: false };
    case 'service_unavailable':
      return { message: 'The upload service is temporarily unavailable. Try again soon.', retryable: true };
    case 'network':
      return { message: 'Network error. Try again when you are online.', retryable: true };
    case 'unknown':
      return { message: 'Upload failed. Try again.', retryable: true };
  }
}

export function mediaUploadFailure(
  code: MediaUploadErrorCode,
  params?: Record<string, string | number>,
): MediaUploadFailure {
  const details = describeMediaUploadError(code);
  return { ok: false, code, ...details, ...(params ? { params } : {}) };
}

function toMegabytes(bytes: number): number {
  // floor, never round: the displayed limit must never exceed the enforced
  // one (a rounded-up limit invites uploads the server will reject).
  return Math.max(1, Math.floor(bytes / (1024 * 1024)));
}

/** Map a parsed edge error onto the media code family (+ display params). */
export function mediaFailureFromParsedError(parsed: ParsedEdgeError): MediaUploadFailure {
  if (parsed.kind === 'file_too_large') {
    const maxBytes = typeof parsed.params.maxBytes === 'number' ? parsed.params.maxBytes : null;
    return mediaUploadFailure(
      'file_too_large',
      maxBytes !== null ? { maxMb: toMegabytes(maxBytes) } : undefined,
    );
  }
  if (parsed.kind === 'unsupported_media_type') return mediaUploadFailure('unsupported_media_type');
  if (parsed.kind === 'invalid_input') return mediaUploadFailure('invalid_input');
  if (parsed.kind === 'auth') {
    // The media functions emit kind 'auth' both for a missing/invalid JWT
    // (401) and for "signed in but no BestChef profile yet" (403). Telling
    // an already-signed-in user to sign in is wrong; split by status.
    return mediaUploadFailure(parsed.status === 403 ? 'profile_required' : 'auth');
  }
  if (parsed.kind === 'rate_limited' || parsed.kind === 'rate_limit') {
    return mediaUploadFailure('rate_limited');
  }
  if (parsed.kind === 'not_found') return mediaUploadFailure('not_found');
  if (parsed.kind === 'config' || parsed.kind === 'provider_outage') {
    return mediaUploadFailure('service_unavailable');
  }
  if (parsed.network) return mediaUploadFailure('network');
  const byStatus = classifyEdgeStatus(parsed.status);
  return mediaUploadFailure(byStatus);
}

/** One-call helper for invoke error objects. */
export async function mediaFailureFromInvokeError(error: unknown): Promise<MediaUploadFailure> {
  return mediaFailureFromParsedError(await parseEdgeFunctionError(error));
}
