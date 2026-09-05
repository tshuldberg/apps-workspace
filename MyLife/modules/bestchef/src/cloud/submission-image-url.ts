/**
 * Signed-URL delivery for BestChef submission images (audit finding C1).
 *
 * The `bestchef-submission-images` bucket is private after
 * 20260711000002_bestchef_storage_privacy.sql. A stored public URL no longer
 * resolves, so submission images must be served through short-lived signed URLs
 * minted at render time - and ONLY for content the viewer is allowed to see:
 * approved submissions, or the owner's own pending submission.
 *
 * This module is transport: it parses the storage path out of whatever was
 * stored in `bc_submissions.photo_url` (a legacy public URL, an already-signed
 * URL, or a bare path) and re-signs it. Visibility is decided by the caller
 * (pass `approved`); a non-approved, non-owned image resolves to null.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBestChefClient } from './client';

export const SUBMISSION_IMAGE_BUCKET = 'bestchef-submission-images';

/** Short-lived; images are re-signed on each fetch/render pass. */
export const SUBMISSION_IMAGE_SIGNED_TTL_SECONDS = 60 * 60;

interface SignStorageClient {
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: { message?: string } | null }>;
      createSignedUrls(
        paths: string[],
        expiresIn: number,
      ): Promise<{
        data: Array<{ path: string | null; signedUrl: string | null; error?: string | null }> | null;
        error: { message?: string } | null;
      }>;
    };
  };
}

function clientOrDefault(supabase?: SupabaseClient | SignStorageClient): SignStorageClient {
  return (supabase ?? getBestChefClient()) as unknown as SignStorageClient;
}

/**
 * Extract the object key (path within the submission-images bucket) from a
 * stored value. Handles:
 *   - Supabase public URLs:  .../storage/v1/object/public/<bucket>/<key>
 *   - Supabase signed URLs:  .../storage/v1/object/sign/<bucket>/<key>?token=...
 *   - Bare storage keys:     <user_id>/<file>
 * Returns null when the value does not reference this bucket.
 */
export function submissionImageStoragePath(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;

  // Bare path (no scheme): accept only if it is not some other absolute URL.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const cleaned = text.replace(/^\/+/, '');
    return cleaned.length > 0 ? decodeURIComponent(cleaned) : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }

  const marker = `/${SUBMISSION_IMAGE_BUCKET}/`;
  const idx = parsed.pathname.indexOf(marker);
  if (idx === -1) return null;

  const rawKey = parsed.pathname.slice(idx + marker.length).replace(/^\/+/, '');
  if (!rawKey) return null;
  try {
    return decodeURIComponent(rawKey);
  } catch {
    return rawKey;
  }
}

/**
 * Resolve a single submission image to a signed https URL, or null.
 *
 * `approved` gates delivery: only approved content (or the owner's own view,
 * which the caller signals by passing approved=true after an ownership check)
 * gets a URL. Non-approved content returns null so a private/pending image can
 * never leak.
 */
export async function resolveSubmissionImageUrl(
  storedValue: string | null | undefined,
  options: { approved: boolean },
  supabase?: SupabaseClient | SignStorageClient,
): Promise<string | null> {
  if (!options.approved) return null;
  const path = submissionImageStoragePath(storedValue);
  if (!path) return null;

  const client = clientOrDefault(supabase);
  const { data, error } = await client.storage
    .from(SUBMISSION_IMAGE_BUCKET)
    .createSignedUrl(path, SUBMISSION_IMAGE_SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl || !data.signedUrl.startsWith('https://')) {
    return null;
  }
  return data.signedUrl;
}

export interface SubmissionImageRef {
  /** Caller-chosen key (e.g. submission id) echoed back on the result. */
  id: string;
  storedValue: string | null | undefined;
  approved: boolean;
}

/**
 * Batch-resolve submission images. Signs one request per bucket, mirroring the
 * console queue batching. Only approved refs are signed; everything else maps
 * to null. Returns a Map keyed by ref id.
 */
export async function resolveSubmissionImageUrls(
  refs: SubmissionImageRef[],
  supabase?: SupabaseClient | SignStorageClient,
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const pathById = new Map<string, string>();
  const pathsToSign: string[] = [];

  for (const ref of refs) {
    out.set(ref.id, null);
    if (!ref.approved) continue;
    const path = submissionImageStoragePath(ref.storedValue);
    if (!path) continue;
    pathById.set(ref.id, path);
    if (!pathsToSign.includes(path)) pathsToSign.push(path);
  }

  if (pathsToSign.length === 0) return out;

  const client = clientOrDefault(supabase);
  const { data, error } = await client.storage
    .from(SUBMISSION_IMAGE_BUCKET)
    .createSignedUrls(pathsToSign, SUBMISSION_IMAGE_SIGNED_TTL_SECONDS);
  if (error || !data) return out;

  const signedByPath = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl && entry.signedUrl.startsWith('https://')) {
      signedByPath.set(entry.path, entry.signedUrl);
    }
  }

  for (const [id, path] of pathById) {
    out.set(id, signedByPath.get(path) ?? null);
  }
  return out;
}
