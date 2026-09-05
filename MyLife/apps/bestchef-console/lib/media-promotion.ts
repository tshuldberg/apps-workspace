import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Playback-URL promotion for approved submission videos, shared by the
 * /media queue and the appeal-reversal path (an overturned rejection sets
 * approved/public/ready via the decision RPC but remote_url stays null,
 * so without this step a restored video never reaches the feed).
 *
 * Attribution-free by design: approved asset rows are world-readable.
 * The 365-day signed URL is the interim delivery until the Phase 4.1
 * CDN pipeline (founder F4). Re-signing before expiry is handled by the
 * bestchef-url-resign worker (audit H6), which reads/writes
 * playback_url_expires_at set here at sign time.
 */

/** ~1 year. */
export const PROMOTED_URL_TTL_SECONDS = 365 * 24 * 60 * 60;

export type PromotionResult =
  | 'ok'
  | 'not_submission_video'
  | 'asset_purged'
  | 'signing_failed'
  | 'update_failed';

export interface PromotableAssetRow {
  id: string;
  owner_id: string;
  owner_kind: string;
  media_kind: string;
  moderation_status: string;
  remote_url: string | null;
  storage_bucket: string | null;
  storage_key: string | null;
  metadata: Record<string, unknown> | null;
}

export async function loadVideoAsset(
  admin: SupabaseClient,
  assetId: string,
): Promise<PromotableAssetRow | null> {
  const { data, error } = await admin
    .from('bc_media_assets')
    .select('id, owner_id, owner_kind, media_kind, moderation_status, remote_url, storage_bucket, storage_key, metadata')
    .eq('id', assetId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as PromotableAssetRow;
}

/**
 * Sign and attach the playback URL to an APPROVED asset. Guarded on
 * moderation_status so a concurrent decision cannot be overwritten.
 */
export async function attachPlaybackUrl(
  admin: SupabaseClient,
  asset: PromotableAssetRow,
): Promise<PromotionResult> {
  if (asset.owner_kind !== 'submission' || asset.media_kind !== 'video') {
    return 'not_submission_video';
  }
  if (!asset.storage_bucket || !asset.storage_key) {
    // The purge worker nulled the pointers: the object is gone (e.g. a
    // rejection overturned after the 183-day evidence window).
    return 'asset_purged';
  }

  const { data: signed, error: signError } = await admin.storage
    .from(asset.storage_bucket)
    .createSignedUrl(asset.storage_key, PROMOTED_URL_TTL_SECONDS);
  if (signError || !signed?.signedUrl || !signed.signedUrl.startsWith('https://')) {
    console.error(
      `bestchef-console: promotion signing failed for asset ${asset.id}${
        signError ? `: ${signError.message}` : ''
      }`,
    );
    return 'signing_failed';
  }

  const metadata = {
    ...(asset.metadata ?? {}),
    promotion_delivery: 'signed_url_v1',
    promoted_at: new Date().toISOString(),
  };
  const expiresAt = new Date(Date.now() + PROMOTED_URL_TTL_SECONDS * 1000).toISOString();

  const { data: updated, error: updateError } = await admin
    .from('bc_media_assets')
    .update({
      remote_url: signed.signedUrl,
      metadata,
      playback_url_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', asset.id)
    .eq('moderation_status', 'approved')
    .select('id');
  if (updateError || !updated || updated.length !== 1) {
    console.error(
      `bestchef-console: playback URL patch failed for asset ${asset.id}${
        updateError ? `: ${updateError.message}` : ''
      }`,
    );
    return 'update_failed';
  }
  return 'ok';
}
