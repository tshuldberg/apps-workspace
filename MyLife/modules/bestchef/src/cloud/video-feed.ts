/**
 * Cloud video feed catalog (F-046).
 *
 * Surfaces cook-along videos from approved, public submission media in
 * `bc_media_assets`, joined to their submissions, recipe snapshots, dishes,
 * and chef profiles. Only HTTPS `remote_url` assets are served; storage-key
 * assets become eligible once media promotion publishes a remote URL.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';

function from(table: string) {
  return getBestChefClient().from(table);
}

export interface FeedVideo {
  /** bc_media_assets id (stable route id for /video/[id]). */
  id: string;
  submissionId: string;
  videoUrl: string;
  durationSeconds: number | null;
  dishId: string | null;
  dishName: string | null;
  cuisine: string | null;
  chefName: string | null;
  chefHandle: string | null;
  chefProfileId: string | null;
  title: string;
  description: string;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
}

export interface ListFeedVideosOptions {
  dishId?: string;
  cuisine?: string;
  limit?: number;
}

interface VideoAssetRow {
  id: string;
  owner_id: string;
  remote_url: string;
  duration_ms: number | null;
  created_at: string;
}

function mapRows(
  assets: VideoAssetRow[],
  submissions: Map<string, Record<string, unknown>>,
  snapshots: Map<string, Record<string, unknown>>,
  dishes: Map<string, Record<string, unknown>>,
  profiles: Map<string, Record<string, unknown>>,
): FeedVideo[] {
  const out: FeedVideo[] = [];
  for (const asset of assets) {
    const submission = submissions.get(asset.owner_id);
    if (!submission) continue;
    const snapshot = snapshots.get((submission.recipe_snapshot_id as string) ?? '');
    const dish = dishes.get((submission.dish_id as string) ?? '');
    const profile = profiles.get((submission.profile_id as string) ?? '');
    out.push({
      id: asset.id,
      submissionId: asset.owner_id,
      videoUrl: asset.remote_url,
      durationSeconds:
        typeof asset.duration_ms === 'number' && asset.duration_ms > 0
          ? Math.round(asset.duration_ms / 1000)
          : null,
      dishId: (submission.dish_id as string) ?? null,
      dishName: (dish?.name as string) ?? null,
      cuisine: (dish?.cuisine as string) ?? null,
      chefName: (profile?.display_name as string) ?? null,
      chefHandle: (profile?.handle as string) ?? null,
      chefProfileId: (submission.profile_id as string) ?? null,
      title: (snapshot?.title as string) ?? (dish?.name as string) ?? 'Cook-along',
      description: (snapshot?.description as string) ?? '',
      likeCount: (submission.like_count as number) ?? 0,
      commentCount: (submission.comment_count as number) ?? 0,
      createdAt: new Date(asset.created_at),
    });
  }
  return out;
}

async function loadRelated(
  assets: VideoAssetRow[],
  opts: ListFeedVideosOptions,
): Promise<BestChefResult<FeedVideo[]>> {
  if (assets.length === 0) return ok<FeedVideo[]>([]);

  const submissionIds = [...new Set(assets.map((a) => a.owner_id))];
  const { data: subRows, error: subErr } = await from('bc_submissions')
    .select('id, dish_id, recipe_snapshot_id, profile_id, like_count, comment_count, moderation_status')
    .in('id', submissionIds)
    .eq('moderation_status', 'approved');
  if (subErr) return err(subErr.message);

  const submissions = new Map<string, Record<string, unknown>>();
  for (const row of (subRows ?? []) as Record<string, unknown>[]) {
    submissions.set(row.id as string, row);
  }

  const snapshotIds = [
    ...new Set(
      [...submissions.values()]
        .map((s) => s.recipe_snapshot_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const dishIds = [
    ...new Set(
      [...submissions.values()]
        .map((s) => s.dish_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const profileIds = [
    ...new Set(
      [...submissions.values()]
        .map((s) => s.profile_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const snapshots = new Map<string, Record<string, unknown>>();
  if (snapshotIds.length > 0) {
    const { data, error: snapErr } = await from('bc_recipe_snapshots')
      .select('id, title, description')
      .in('id', snapshotIds);
    if (snapErr) return err(snapErr.message);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      snapshots.set(row.id as string, row);
    }
  }

  const dishes = new Map<string, Record<string, unknown>>();
  if (dishIds.length > 0) {
    const { data, error: dishErr } = await from('bc_dishes')
      .select('id, name, cuisine')
      .in('id', dishIds);
    if (dishErr) return err(dishErr.message);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      dishes.set(row.id as string, row);
    }
  }

  const profiles = new Map<string, Record<string, unknown>>();
  if (profileIds.length > 0) {
    const { data, error: profErr } = await from('social_profiles')
      .select('id, display_name, handle')
      .in('id', profileIds);
    if (profErr) return err(profErr.message);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      profiles.set(row.id as string, row);
    }
  }

  let videos = mapRows(assets, submissions, snapshots, dishes, profiles);
  if (opts.dishId) {
    videos = videos.filter((v) => v.dishId === opts.dishId);
  }
  if (opts.cuisine) {
    const wanted = opts.cuisine.toLowerCase();
    videos = videos.filter((v) => (v.cuisine ?? '').toLowerCase() === wanted);
  }
  return ok(videos);
}

/** Approved, public cook-along videos, newest first. */
export async function listFeedVideos(
  opts: ListFeedVideosOptions = {},
): Promise<BestChefResult<FeedVideo[]>> {
  const limit = opts.limit ?? 50;
  const { data, error: dbErr } = await from('bc_media_assets')
    .select('id, owner_id, remote_url, duration_ms, created_at')
    .eq('owner_kind', 'submission')
    .eq('media_kind', 'video')
    .eq('moderation_status', 'approved')
    .eq('visibility', 'public')
    .in('upload_status', ['uploaded', 'ready'])
    .not('remote_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (dbErr) return err(dbErr.message);
  return loadRelated((data ?? []) as VideoAssetRow[], opts);
}

/** Single feed video by media asset id. */
export async function getFeedVideoById(
  id: string,
): Promise<BestChefResult<FeedVideo | null>> {
  const { data, error: dbErr } = await from('bc_media_assets')
    .select('id, owner_id, remote_url, duration_ms, created_at')
    .eq('id', id)
    .eq('owner_kind', 'submission')
    .eq('media_kind', 'video')
    .eq('moderation_status', 'approved')
    .eq('visibility', 'public')
    .not('remote_url', 'is', null)
    .maybeSingle();

  if (dbErr) return err(dbErr.message);
  if (!data) return ok<FeedVideo | null>(null);
  const result = await loadRelated([data as VideoAssetRow], {});
  if (!result.ok) return err(result.error);
  return ok(result.data[0] ?? null);
}
