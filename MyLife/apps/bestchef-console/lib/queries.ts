import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  assembleProofQueueItems,
  buildFlagLabels,
  flagLabelKey,
  signedUrlKey,
  type FlagSubmissionLabelRow,
  type JobHealthPayload,
  type ModerationQueueRow,
  type ProofJoinRow,
  type ProofQueueItem,
} from './mappers';
import {
  shapeMetricsWindow,
  utcDayStrings,
  type DailyMetricRow,
  type MetricsWindow,
} from './metrics';
import { PROOF_QUEUE_OPEN_STATUSES, REPORT_OPEN_STATUSES } from './statuses';

export type { ProofQueueItem } from './mappers';
export type { MetricSeries, MetricsWindow } from './metrics';

const SIGNED_URL_TTL_SECONDS = 600;
export const QUEUE_PAGE_SIZE = 50;

/**
 * Errors thrown here carry machine codes (safe to render); the raw
 * PostgREST detail is logged server-side only (review finding: pages must
 * not disclose schema internals in banners).
 */
function queryFailure(code: string, detail: string): Error {
  console.error(`bestchef-console: ${code}: ${detail}`);
  return new Error(code);
}

/** A queue page plus the TRUE total so the UI can say "oldest 50 of N". */
export interface QueuePage<T> {
  items: T[];
  total: number;
}

// ── Vote-proof queue ──────────────────────────────────────────────────

export async function fetchProofQueue(
  admin: SupabaseClient,
  languageFilter?: string | null,
): Promise<QueuePage<ProofQueueItem>> {
  let queueQuery = admin
    .from('bc_moderation_queue')
    .select('id,target_id,status,attempts,failure_reason,metadata,created_at', {
      count: 'exact',
    })
    .eq('kind', 'vote_proof')
    .in('status', [...PROOF_QUEUE_OPEN_STATUSES])
    .order('created_at', { ascending: true })
    .limit(QUEUE_PAGE_SIZE);
  if (languageFilter) {
    queueQuery = queueQuery.eq('metadata->>language', languageFilter);
  }
  const { data: queueRows, error: queueError, count } = await queueQuery;
  if (queueError) throw queryFailure('proof_queue_query_failed', queueError.message);
  const rows = (queueRows ?? []) as unknown as ModerationQueueRow[];
  if (rows.length === 0) return { items: [], total: count ?? 0 };

  const proofIds = rows.map((r) => r.target_id);
  const { data: proofRows, error: proofError } = await admin
    .from('bc_vote_proofs')
    .select(
      'id,vote_id,submission_id,content_hash,status,captured_at,' +
        'social_profiles(handle,display_name),' +
        'bc_media_assets(id,storage_bucket,storage_key,media_kind),' +
        'bc_submissions(bc_dishes(name))',
    )
    .in('id', proofIds);
  if (proofError) throw queryFailure('vote_proofs_query_failed', proofError.message);

  const proofsById = new Map<string, ProofJoinRow>();
  for (const row of (proofRows ?? []) as unknown as ProofJoinRow[]) {
    proofsById.set(row.id, row);
  }

  // Sign evidence URLs in one batch per bucket (proof media is private by
  // design, TS-05). A signing failure is logged and surfaces in the UI as
  // "evidence unavailable", never as "no evidence file".
  const byBucket = new Map<string, string[]>();
  for (const proof of Array.from(proofsById.values())) {
    const media = proof.bc_media_assets;
    if (media?.storage_bucket && media.storage_key) {
      const keys = byBucket.get(media.storage_bucket) ?? [];
      keys.push(media.storage_key);
      byBucket.set(media.storage_bucket, keys);
    }
  }
  const signedByBucketKey = new Map<string, string>();
  for (const [bucket, keys] of Array.from(byBucket.entries())) {
    const { data: signed, error: signError } = await admin.storage
      .from(bucket)
      .createSignedUrls(keys, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(
        `bestchef-console: evidence signing failed for bucket ${bucket}: ${signError.message}`,
      );
      continue;
    }
    for (const entry of signed ?? []) {
      if (entry.signedUrl && entry.path) {
        signedByBucketKey.set(signedUrlKey(bucket, entry.path), entry.signedUrl);
      }
    }
  }

  return {
    items: assembleProofQueueItems(rows, proofsById, signedByBucketKey),
    total: count ?? rows.length,
  };
}

// ── Pending submission videos (plan 33 video promotion) ──────────────

export interface PendingVideoQueueItem {
  assetId: string;
  submissionId: string;
  createdAt: string;
  byteSize: number | null;
  durationMs: number | null;
  dishName: string | null;
  title: string | null;
  chefHandle: string | null;
  /** Short-lived signed preview URL; null when signing failed. */
  previewUrl: string | null;
  hasStorageObject: boolean;
  /** 'pending' for fresh review; 'approved' means URL-patch recovery. */
  moderationStatus: string;
  /** The OWNING submission's moderation status (null = submission gone). */
  submissionStatus: string | null;
}

interface PendingVideoAssetRow {
  id: string;
  owner_id: string;
  storage_bucket: string | null;
  storage_key: string | null;
  byte_size: number | null;
  duration_ms: number | null;
  created_at: string;
  moderation_status: string;
  remote_url: string | null;
}

interface PendingVideoSubmissionRow {
  id: string;
  dish_id: string | null;
  recipe_snapshot_id: string | null;
  profile_id: string | null;
  moderation_status: string;
}

export async function fetchPendingSubmissionVideos(
  admin: SupabaseClient,
): Promise<QueuePage<PendingVideoQueueItem>> {
  const { data: assetRows, error: assetError, count } = await admin
    .from('bc_media_assets')
    .select('id, owner_id, storage_bucket, storage_key, byte_size, duration_ms, created_at, moderation_status, remote_url', {
      count: 'exact',
    })
    .eq('owner_kind', 'submission')
    .eq('media_kind', 'video')
    // Pending review, plus approved rows whose playback-URL patch failed
    // (recovery: re-running approve only re-signs, no duplicate decision).
    .or('and(upload_status.eq.uploaded,moderation_status.eq.pending),and(moderation_status.eq.approved,remote_url.is.null)')
    .order('created_at', { ascending: true })
    .limit(QUEUE_PAGE_SIZE);
  if (assetError) throw queryFailure('pending_videos_query_failed', assetError.message);
  const assets = (assetRows ?? []) as unknown as PendingVideoAssetRow[];
  if (assets.length === 0) return { items: [], total: count ?? 0 };

  const submissionIds = [...new Set(assets.map((a) => a.owner_id))];
  const { data: subRows, error: subError } = await admin
    .from('bc_submissions')
    .select('id, dish_id, recipe_snapshot_id, profile_id, moderation_status')
    .in('id', submissionIds);
  if (subError) throw queryFailure('pending_videos_submissions_failed', subError.message);
  const submissions = new Map<string, PendingVideoSubmissionRow>();
  for (const row of (subRows ?? []) as unknown as PendingVideoSubmissionRow[]) {
    submissions.set(row.id, row);
  }

  const dishIds = [...new Set([...submissions.values()].map((r) => r.dish_id).filter(Boolean))] as string[];
  const snapshotIds = [...new Set([...submissions.values()].map((r) => r.recipe_snapshot_id).filter(Boolean))] as string[];
  const profileIds = [...new Set([...submissions.values()].map((r) => r.profile_id).filter(Boolean))] as string[];

  const [dishesRes, snapshotsRes, profilesRes] = await Promise.all([
    dishIds.length
      ? admin.from('bc_dishes').select('id, name').in('id', dishIds)
      : Promise.resolve({ data: [], error: null }),
    snapshotIds.length
      ? admin.from('bc_recipe_snapshots').select('id, title').in('id', snapshotIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? admin.from('social_profiles').select('id, handle').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const joinError = dishesRes.error ?? snapshotsRes.error ?? profilesRes.error;
  if (joinError) throw queryFailure('pending_videos_join_failed', joinError.message);

  const dishes = new Map((dishesRes.data ?? []).map((row) => {
    const r = row as { id: string; name: string | null };
    return [r.id, r.name] as const;
  }));
  const snapshots = new Map((snapshotsRes.data ?? []).map((row) => {
    const r = row as { id: string; title: string | null };
    return [r.id, r.title] as const;
  }));
  const profiles = new Map((profilesRes.data ?? []).map((row) => {
    const r = row as { id: string; handle: string | null };
    return [r.id, r.handle] as const;
  }));

  // Short-lived preview URLs, batch-signed per bucket (same convention as
  // the proof queue: a signing failure surfaces as unavailable, never as
  // "no video").
  const byBucket = new Map<string, string[]>();
  for (const asset of assets) {
    if (asset.storage_bucket && asset.storage_key) {
      const keys = byBucket.get(asset.storage_bucket) ?? [];
      keys.push(asset.storage_key);
      byBucket.set(asset.storage_bucket, keys);
    }
  }
  const signedByBucketKey = new Map<string, string>();
  for (const [bucket, keys] of Array.from(byBucket.entries())) {
    const { data: signed, error: signError } = await admin.storage
      .from(bucket)
      .createSignedUrls(keys, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(
        `bestchef-console: video preview signing failed for bucket ${bucket}: ${signError.message}`,
      );
      continue;
    }
    for (const entry of signed ?? []) {
      if (entry.signedUrl && entry.path) {
        signedByBucketKey.set(signedUrlKey(bucket, entry.path), entry.signedUrl);
      }
    }
  }

  const items: PendingVideoQueueItem[] = assets.map((asset) => {
    const submission = submissions.get(asset.owner_id);
    const hasStorageObject = Boolean(asset.storage_bucket && asset.storage_key);
    return {
      assetId: asset.id,
      submissionId: asset.owner_id,
      createdAt: asset.created_at,
      byteSize: asset.byte_size,
      durationMs: asset.duration_ms,
      dishName: submission?.dish_id ? dishes.get(submission.dish_id) ?? null : null,
      title: submission?.recipe_snapshot_id ? snapshots.get(submission.recipe_snapshot_id) ?? null : null,
      chefHandle: submission?.profile_id ? profiles.get(submission.profile_id) ?? null : null,
      previewUrl: hasStorageObject
        ? signedByBucketKey.get(signedUrlKey(asset.storage_bucket!, asset.storage_key!)) ?? null
        : null,
      hasStorageObject,
      moderationStatus: asset.moderation_status,
      submissionStatus: submission?.moderation_status ?? null,
    };
  });

  return { items, total: count ?? items.length };
}

// ── Pending media images (audit C4: image screening) ──────────────────

export interface PendingMediaImageItem {
  assetId: string;
  ownerKind: string;
  ownerId: string;
  createdAt: string;
  byteSize: number | null;
  /** Short-lived signed preview URL; null when signing failed. */
  previewUrl: string | null;
  hasStorageObject: boolean;
  /** Human-review routing signal from the screening worker, when present. */
  screeningStatus: string | null;
  /** The owning submission's moderation status when ownerKind='submission'. */
  submissionStatus: string | null;
}

interface PendingMediaImageAssetRow {
  id: string;
  owner_kind: string;
  owner_id: string;
  storage_bucket: string | null;
  storage_key: string | null;
  byte_size: number | null;
  created_at: string;
}

/**
 * Pending image assets across the public UGC owner kinds (submission, comment,
 * post). These land private/pending and are enqueued for screening; the
 * screening worker routes them here for a human decision (it never
 * auto-approves). Images stay non-public until a moderator approves.
 */
export async function fetchPendingMediaImages(
  admin: SupabaseClient,
): Promise<QueuePage<PendingMediaImageItem>> {
  const { data: assetRows, error: assetError, count } = await admin
    .from('bc_media_assets')
    .select('id, owner_kind, owner_id, storage_bucket, storage_key, byte_size, created_at', {
      count: 'exact',
    })
    .eq('media_kind', 'image')
    .in('owner_kind', ['submission', 'comment', 'post'])
    .eq('moderation_status', 'pending')
    .eq('upload_status', 'uploaded')
    .order('created_at', { ascending: true })
    .limit(QUEUE_PAGE_SIZE);
  if (assetError) throw queryFailure('pending_images_query_failed', assetError.message);
  const assets = (assetRows ?? []) as unknown as PendingMediaImageAssetRow[];
  if (assets.length === 0) return { items: [], total: count ?? 0 };

  // Screening-worker routing signals (failure_reason='needs_human_review').
  const assetIds = assets.map((a) => a.id);
  const { data: queueRows, error: queueError } = await admin
    .from('bc_moderation_queue')
    .select('target_id, failure_reason')
    .eq('kind', 'media_asset')
    .in('target_id', assetIds);
  if (queueError) throw queryFailure('pending_images_queue_failed', queueError.message);
  const screeningByAsset = new Map<string, string | null>();
  for (const row of (queueRows ?? []) as Array<{ target_id: string; failure_reason: string | null }>) {
    screeningByAsset.set(row.target_id, row.failure_reason ?? null);
  }

  // The owning submission's visibility (submission-owned images only).
  const submissionIds = [
    ...new Set(assets.filter((a) => a.owner_kind === 'submission').map((a) => a.owner_id)),
  ];
  const submissionStatus = new Map<string, string>();
  if (submissionIds.length > 0) {
    const { data: subRows, error: subError } = await admin
      .from('bc_submissions')
      .select('id, moderation_status')
      .in('id', submissionIds);
    if (subError) throw queryFailure('pending_images_submissions_failed', subError.message);
    for (const row of (subRows ?? []) as Array<{ id: string; moderation_status: string }>) {
      submissionStatus.set(row.id, row.moderation_status);
    }
  }

  // Batch-sign preview URLs per bucket (private bucket, same convention as the
  // video/proof queues: a signing failure surfaces as unavailable, never as
  // "no image").
  const byBucket = new Map<string, string[]>();
  for (const asset of assets) {
    if (asset.storage_bucket && asset.storage_key) {
      const keys = byBucket.get(asset.storage_bucket) ?? [];
      keys.push(asset.storage_key);
      byBucket.set(asset.storage_bucket, keys);
    }
  }
  const signedByBucketKey = new Map<string, string>();
  for (const [bucket, keys] of Array.from(byBucket.entries())) {
    const { data: signed, error: signError } = await admin.storage
      .from(bucket)
      .createSignedUrls(keys, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(
        `bestchef-console: image preview signing failed for bucket ${bucket}: ${signError.message}`,
      );
      continue;
    }
    for (const entry of signed ?? []) {
      if (entry.signedUrl && entry.path) {
        signedByBucketKey.set(signedUrlKey(bucket, entry.path), entry.signedUrl);
      }
    }
  }

  const items: PendingMediaImageItem[] = assets.map((asset) => {
    const hasStorageObject = Boolean(asset.storage_bucket && asset.storage_key);
    return {
      assetId: asset.id,
      ownerKind: asset.owner_kind,
      ownerId: asset.owner_id,
      createdAt: asset.created_at,
      byteSize: asset.byte_size,
      previewUrl: hasStorageObject
        ? signedByBucketKey.get(signedUrlKey(asset.storage_bucket!, asset.storage_key!)) ?? null
        : null,
      hasStorageObject,
      screeningStatus: screeningByAsset.get(asset.id) ?? null,
      submissionStatus:
        asset.owner_kind === 'submission' ? submissionStatus.get(asset.owner_id) ?? null : null,
    };
  });

  return { items, total: count ?? items.length };
}

// ── Pending submissions (audit C2: content review) ────────────────────

export interface PendingSubmissionItem {
  submissionId: string;
  createdAt: string;
  dishName: string | null;
  title: string | null;
  chefHandle: string | null;
  /** Signed preview of the submission's primary image, when present. */
  previewUrl: string | null;
}

/**
 * Submissions awaiting first-pass content review. After audit C2 new
 * submissions default moderation_status='pending' and are invisible to the
 * public until a moderator approves them here (a separate decision from the
 * per-asset media review).
 */
export async function fetchPendingSubmissions(
  admin: SupabaseClient,
): Promise<QueuePage<PendingSubmissionItem>> {
  const { data, error, count } = await admin
    .from('bc_submissions')
    .select(
      'id, photo_url, created_at, bc_dishes(name), bc_recipe_snapshots(title), social_profiles(handle)',
      { count: 'exact' },
    )
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(QUEUE_PAGE_SIZE);
  if (error) throw queryFailure('pending_submissions_query_failed', error.message);

  interface PendingSubmissionRow {
    id: string;
    photo_url: string | null;
    created_at: string;
    bc_dishes: { name: string } | null;
    bc_recipe_snapshots: { title: string } | null;
    social_profiles: { handle: string } | null;
  }
  const rows = (data ?? []) as unknown as PendingSubmissionRow[];
  if (rows.length === 0) return { items: [], total: count ?? 0 };

  // photo_url is a stored path/URL in the now-private submission-images bucket
  // (audit C1). Re-sign it for the moderator preview. Parse the key out and
  // batch-sign; a signing failure surfaces as no preview, never a broken image.
  const bucket = 'bestchef-submission-images';
  const marker = `/${bucket}/`;
  const pathBySubmission = new Map<string, string>();
  for (const row of rows) {
    const stored = row.photo_url?.trim();
    if (!stored) continue;
    let key: string | null = null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(stored)) {
      key = stored.replace(/^\/+/, '');
    } else {
      try {
        const idx = new URL(stored).pathname.indexOf(marker);
        if (idx !== -1) key = new URL(stored).pathname.slice(idx + marker.length).replace(/^\/+/, '');
      } catch {
        key = null;
      }
    }
    if (key) {
      try {
        pathBySubmission.set(row.id, decodeURIComponent(key));
      } catch {
        pathBySubmission.set(row.id, key);
      }
    }
  }

  const signedByPath = new Map<string, string>();
  const uniquePaths = [...new Set(pathBySubmission.values())];
  if (uniquePaths.length > 0) {
    const { data: signed, error: signError } = await admin.storage
      .from(bucket)
      .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(
        `bestchef-console: pending submission preview signing failed: ${signError.message}`,
      );
    } else {
      for (const entry of signed ?? []) {
        if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
      }
    }
  }

  return {
    items: rows.map((row) => {
      const path = pathBySubmission.get(row.id);
      return {
        submissionId: row.id,
        createdAt: row.created_at,
        dishName: row.bc_dishes?.name ?? null,
        title: row.bc_recipe_snapshots?.title ?? null,
        chefHandle: row.social_profiles?.handle ?? null,
        previewUrl: path ? signedByPath.get(path) ?? null : null,
      };
    }),
    total: count ?? rows.length,
  };
}

// ── Flags queue ───────────────────────────────────────────────────────

export interface FlagQueueItem {
  flagId: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  reason: string;
  status: string;
  flaggerHandle: string | null;
  createdAt: string;
}

interface FlagRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  social_profiles: { handle: string } | null;
}

export async function fetchOpenFlags(admin: SupabaseClient): Promise<QueuePage<FlagQueueItem>> {
  const {
    data,
    error,
    count,
  } = await admin
    .from('bc_flags')
    .select('id,target_type,target_id,reason,status,created_at,social_profiles(handle)', {
      count: 'exact',
    })
    .in('status', [...REPORT_OPEN_STATUSES])
    .order('created_at', { ascending: true })
    .limit(QUEUE_PAGE_SIZE);
  if (error) throw queryFailure('flags_query_failed', error.message);
  const flags = (data ?? []) as unknown as FlagRow[];
  if (flags.length === 0) return { items: [], total: count ?? 0 };

  const idsByType = new Map<string, string[]>();
  for (const flag of flags) {
    const ids = idsByType.get(flag.target_type) ?? [];
    ids.push(flag.target_id);
    idsByType.set(flag.target_type, ids);
  }

  const submissionIds = idsByType.get('submission') ?? [];
  const commentIds = idsByType.get('comment') ?? [];
  const profileIds = idsByType.get('profile') ?? [];
  const [submissions, comments, profiles] = await Promise.all([
    submissionIds.length > 0
      ? admin
          .from('bc_submissions')
          .select('id,bc_dishes(name),social_profiles(handle)')
          .in('id', submissionIds)
      : Promise.resolve({ data: [] }),
    commentIds.length > 0
      ? admin.from('bc_comments').select('id,body').in('id', commentIds)
      : Promise.resolve({ data: [] }),
    profileIds.length > 0
      ? admin.from('social_profiles').select('id,handle,display_name').in('id', profileIds)
      : Promise.resolve({ data: [] }),
  ]);

  const labels = buildFlagLabels(
    (submissions.data ?? []) as unknown as FlagSubmissionLabelRow[],
    (comments.data ?? []) as unknown as Array<{ id: string; body: string }>,
    (profiles.data ?? []) as unknown as Array<{
      id: string;
      handle: string;
      display_name: string;
    }>,
  );

  return {
    items: flags.map((flag) => ({
      flagId: flag.id,
      targetType: flag.target_type,
      targetId: flag.target_id,
      targetLabel: labels.get(flagLabelKey(flag.target_type, flag.target_id)) ?? flag.target_id,
      reason: flag.reason,
      status: flag.status,
      flaggerHandle: flag.social_profiles?.handle ?? null,
      createdAt: flag.created_at,
    })),
    total: count ?? flags.length,
  };
}

/**
 * Authoritative flag lookup for actions. Decision targets are ALWAYS derived
 * from this row, never from form fields (review finding: hidden-field
 * tampering must not be able to mis-target enforcement).
 */
export interface FlagTargetRow {
  targetType: string;
  targetId: string;
  status: string;
}

export async function fetchFlagTarget(
  admin: SupabaseClient,
  flagId: string,
): Promise<FlagTargetRow | null> {
  const { data, error } = await admin
    .from('bc_flags')
    .select('target_type,target_id,status')
    .eq('id', flagId)
    .maybeSingle();
  if (error) throw queryFailure('flag_lookup_failed', error.message);
  if (!data) return null;
  return {
    targetType: data.target_type as string,
    targetId: data.target_id as string,
    status: data.status as string,
  };
}

// ── Photo reports queue ───────────────────────────────────────────────

export interface PhotoReportItem {
  reportId: string;
  submissionId: string;
  submissionLabel: string;
  reason: string;
  reporterHandle: string | null;
  createdAt: string;
}

export async function fetchOpenPhotoReports(
  admin: SupabaseClient,
): Promise<QueuePage<PhotoReportItem>> {
  const {
    data,
    error,
    count,
  } = await admin
    .from('bc_photo_reports')
    .select(
      'id,submission_id,reason,created_at,' +
        'social_profiles(handle),' +
        'bc_submissions(bc_dishes(name),social_profiles(handle))',
      { count: 'exact' },
    )
    .in('status', [...REPORT_OPEN_STATUSES])
    .order('created_at', { ascending: true })
    .limit(QUEUE_PAGE_SIZE);
  if (error) throw queryFailure('photo_reports_query_failed', error.message);

  interface PhotoReportRow {
    id: string;
    submission_id: string;
    reason: string;
    created_at: string;
    social_profiles: { handle: string } | null;
    bc_submissions: {
      bc_dishes: { name: string } | null;
      social_profiles: { handle: string } | null;
    } | null;
  }
  const rows = (data ?? []) as unknown as PhotoReportRow[];
  return {
    items: rows.map((row) => ({
      reportId: row.id,
      submissionId: row.submission_id,
      submissionLabel: `${row.bc_submissions?.bc_dishes?.name ?? 'unknown dish'} by @${
        row.bc_submissions?.social_profiles?.handle ?? '?'
      }`,
      reason: row.reason,
      reporterHandle: row.social_profiles?.handle ?? null,
      createdAt: row.created_at,
    })),
    total: count ?? rows.length,
  };
}

// ── Appeals queue ─────────────────────────────────────────────────────

export interface AppealQueueItem {
  appealId: string;
  body: string;
  createdAt: string;
  appellantHandle: string | null;
  decision: {
    id: string;
    kind: string;
    targetId: string;
    decision: string;
    reason: string | null;
    decidedAt: string;
  } | null;
}

export async function fetchOpenAppeals(
  admin: SupabaseClient,
): Promise<QueuePage<AppealQueueItem>> {
  const {
    data,
    error,
    count,
  } = await admin
    .from('bc_appeals')
    .select(
      'id,body,created_at,' +
        'social_profiles(handle),' +
        'bc_moderation_decisions(id,kind,target_id,decision,reason,created_at)',
      { count: 'exact' },
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(QUEUE_PAGE_SIZE);
  if (error) throw queryFailure('appeals_query_failed', error.message);

  interface AppealRow {
    id: string;
    body: string;
    created_at: string;
    social_profiles: { handle: string } | null;
    bc_moderation_decisions: {
      id: string;
      kind: string;
      target_id: string;
      decision: string;
      reason: string | null;
      created_at: string;
    } | null;
  }
  const rows = (data ?? []) as unknown as AppealRow[];
  return {
    items: rows.map((row) => {
      const decision = row.bc_moderation_decisions;
      return {
        appealId: row.id,
        body: row.body,
        createdAt: row.created_at,
        appellantHandle: row.social_profiles?.handle ?? null,
        decision: decision
          ? {
              id: decision.id,
              kind: decision.kind,
              targetId: decision.target_id,
              decision: decision.decision,
              reason: decision.reason,
              decidedAt: decision.created_at,
            }
          : null,
      };
    }),
    total: count ?? rows.length,
  };
}

/**
 * Authoritative appeal + original-decision lookup for resolveAppeal. The
 * reversal plan is ALWAYS derived from this, never from form fields.
 */
export interface AppealDecisionInfo {
  appealStatus: string;
  decision: { kind: string; targetId: string; decision: string } | null;
}

export async function fetchAppealDecision(
  admin: SupabaseClient,
  appealId: string,
): Promise<AppealDecisionInfo | null> {
  const { data, error } = await admin
    .from('bc_appeals')
    .select('status,bc_moderation_decisions(kind,target_id,decision)')
    .eq('id', appealId)
    .maybeSingle();
  if (error) throw queryFailure('appeal_lookup_failed', error.message);
  if (!data) return null;
  const decision = data.bc_moderation_decisions as unknown as {
    kind: string;
    target_id: string;
    decision: string;
  } | null;
  return {
    appealStatus: data.status as string,
    decision: decision
      ? { kind: decision.kind, targetId: decision.target_id, decision: decision.decision }
      : null,
  };
}

// ── Dish translations (editorial, plan 33 Phase 2.3) ─────────────────

export interface DishRow {
  id: string;
  name: string;
  nativeName: string | null;
  slug: string;
  category: string;
  cuisine: string;
  status: string;
  submissionCount: number;
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function searchDishRows(admin: SupabaseClient, query: string): Promise<DishRow[]> {
  let dishQuery = admin
    .from('bc_dishes')
    .select('id,name,native_name,slug,category,cuisine,status,submission_count')
    .order('submission_count', { ascending: false })
    .limit(30);
  const trimmed = query.trim();
  if (trimmed) {
    // Single parameterized ilike filter (never a composed .or() string).
    dishQuery = dishQuery.ilike('name', `%${escapeLikePattern(trimmed)}%`);
  }
  const { data, error } = await dishQuery;
  if (error) throw queryFailure('dish_search_query_failed', error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    nativeName: (row.native_name as string | null) ?? null,
    slug: row.slug as string,
    category: row.category as string,
    cuisine: row.cuisine as string,
    status: row.status as string,
    submissionCount: (row.submission_count as number) ?? 0,
  }));
}

export interface DishTranslationRow {
  locale: string;
  name: string;
  description: string | null;
  status: string;
  source: string;
  updatedBy: string | null;
  updatedAt: string;
}

export async function fetchDishTranslations(
  admin: SupabaseClient,
  dishId: string,
): Promise<Map<string, DishTranslationRow>> {
  const { data, error } = await admin
    .from('bc_dish_translations')
    .select('locale,name,description,status,source,updated_by,updated_at')
    .eq('dish_id', dishId);
  if (error) throw queryFailure('dish_translations_query_failed', error.message);
  const byLocale = new Map<string, DishTranslationRow>();
  for (const row of data ?? []) {
    byLocale.set(row.locale as string, {
      locale: row.locale as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      status: row.status as string,
      source: row.source as string,
      updatedBy: (row.updated_by as string | null) ?? null,
      updatedAt: row.updated_at as string,
    });
  }
  return byLocale;
}

// ── Overview: counts, job health, ops levers ──────────────────────────

export interface QueueCounts {
  voteProofs: number;
  flags: number;
  photoReports: number;
  appeals: number;
  pendingVideos: number;
  pendingImages: number;
  pendingSubmissions: number;
}

export async function fetchQueueCounts(admin: SupabaseClient): Promise<QueueCounts> {
  const [proofs, flags, photoReports, appeals, pendingVideos, pendingImages, pendingSubmissions] =
    await Promise.all([
    admin
      .from('bc_moderation_queue')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'vote_proof')
      .in('status', [...PROOF_QUEUE_OPEN_STATUSES]),
    admin
      .from('bc_flags')
      .select('id', { count: 'exact', head: true })
      .in('status', [...REPORT_OPEN_STATUSES]),
    admin
      .from('bc_photo_reports')
      .select('id', { count: 'exact', head: true })
      .in('status', [...REPORT_OPEN_STATUSES]),
    admin.from('bc_appeals').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    admin
      .from('bc_media_assets')
      .select('id', { count: 'exact', head: true })
      .eq('owner_kind', 'submission')
      .eq('media_kind', 'video')
      .or('and(upload_status.eq.uploaded,moderation_status.eq.pending),and(moderation_status.eq.approved,remote_url.is.null)'),
    admin
      .from('bc_media_assets')
      .select('id', { count: 'exact', head: true })
      .eq('media_kind', 'image')
      .in('owner_kind', ['submission', 'comment', 'post'])
      .eq('moderation_status', 'pending')
      .eq('upload_status', 'uploaded'),
    admin
      .from('bc_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('moderation_status', 'pending'),
  ]);
  const firstError =
    proofs.error ??
    flags.error ??
    photoReports.error ??
    appeals.error ??
    pendingVideos.error ??
    pendingImages.error ??
    pendingSubmissions.error;
  if (firstError) throw queryFailure('queue_counts_query_failed', firstError.message);
  return {
    voteProofs: proofs.count ?? 0,
    flags: flags.count ?? 0,
    photoReports: photoReports.count ?? 0,
    pendingVideos: pendingVideos.count ?? 0,
    pendingImages: pendingImages.count ?? 0,
    pendingSubmissions: pendingSubmissions.count ?? 0,
    appeals: appeals.count ?? 0,
  };
}

export async function fetchJobHealth(admin: SupabaseClient): Promise<JobHealthPayload> {
  const { data, error } = await admin.rpc('bc_job_health');
  if (error) throw queryFailure('job_health_rpc_failed', error.message);
  return (data ?? {}) as JobHealthPayload;
}

export interface ActionLimitRow {
  action: string;
  maxCount: number;
  windowSeconds: number;
  enabled: boolean;
  updatedAt: string;
}

export interface OpsLevers {
  actionKillSwitch: boolean;
  providerKillSwitch: boolean;
  providerGlobalDailyCap: number;
  actionLimits: ActionLimitRow[];
}

export async function fetchOpsLevers(admin: SupabaseClient): Promise<OpsLevers> {
  const [controls, provider, limits] = await Promise.all([
    admin.from('bc_action_controls').select('kill_switch').eq('id', true).maybeSingle(),
    admin
      .from('bc_provider_controls')
      .select('kill_switch,global_daily_cap')
      .eq('id', true)
      .maybeSingle(),
    admin
      .from('bc_action_limits')
      .select('action,max_count,window_seconds,enabled,updated_at')
      .order('action', { ascending: true }),
  ]);
  const firstError = controls.error ?? provider.error ?? limits.error;
  if (firstError) throw queryFailure('ops_levers_query_failed', firstError.message);
  return {
    actionKillSwitch: controls.data?.kill_switch === true,
    providerKillSwitch: provider.data?.kill_switch === true,
    providerGlobalDailyCap: provider.data?.global_daily_cap ?? 0,
    actionLimits: (limits.data ?? []).map((row) => ({
      action: row.action as string,
      maxCount: row.max_count as number,
      windowSeconds: row.window_seconds as number,
      enabled: row.enabled as boolean,
      updatedAt: row.updated_at as string,
    })),
  };
}

// ── Aggregate launch metrics (plan 45 item 2.5) ──────────────────────

/**
 * Aggregate daily metrics for the last `windowDays` UTC days. Pure aggregate
 * integers: no device IDs, no per-user rows, no client SDK feed this table.
 * Shaping is delegated to the pure helpers in lib/metrics.ts.
 */
export async function fetchAggregateMetrics(
  admin: SupabaseClient,
  windowDays = 30,
): Promise<MetricsWindow> {
  const days = utcDayStrings(windowDays);
  const since = days[0];
  const { data, error } = await admin
    .from('bc_daily_metrics')
    .select('day,metric,count')
    .gte('day', since)
    .order('day', { ascending: true });
  if (error) throw queryFailure('metrics_query_failed', error.message);

  return shapeMetricsWindow(days, (data ?? []) as unknown as DailyMetricRow[]);
}
