import type { SupabaseClient } from '@supabase/supabase-js';

export interface CookProofViewModel {
  id: string;
  voteId: string;
  submissionId: string;
  profileId: string;
  mediaAssetId: string;
  imageUrl: string | null;
  authorName: string;
  authorHandle: string;
  submissionTitle: string;
  tier: 'gold' | 'silver' | 'bronze' | 'like';
  capturedAt: string;
  width: number | null;
  height: number | null;
}

export interface CookProofGalleryResult {
  proofs: CookProofViewModel[];
  totalCount: number;
}

interface VoteProofRow {
  id: string;
  vote_id: string;
  submission_id: string;
  profile_id: string;
  media_asset_id: string;
  captured_at: string;
}

interface MediaAssetRow {
  id: string;
  remote_url: string | null;
  storage_bucket: string | null;
  storage_key: string | null;
  width: number | null;
  height: number | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  handle: string | null;
}

interface VoteRow {
  id: string;
  tier: number | null;
}

interface SubmissionRow {
  id: string;
  recipe_snapshot_id: string | null;
}

interface RecipeSnapshotRow {
  id: string;
  title: string | null;
}

interface CookProofRelations {
  assets: MediaAssetRow[];
  profiles: ProfileRow[];
  votes: VoteRow[];
  submissions: SubmissionRow[];
  snapshots: RecipeSnapshotRow[];
}

function rowsById<T extends { id: string }>(rows: T[] | null | undefined): Map<string, T> {
  return new Map((rows ?? []).map((row) => [row.id, row]));
}

function publicAssetUrl(
  supabase: SupabaseClient,
  asset: MediaAssetRow | null | undefined,
): string | null {
  if (!asset) return null;
  if (asset.remote_url) return asset.remote_url;
  if (!asset.storage_bucket || !asset.storage_key) return null;

  const { data } = supabase.storage
    .from(asset.storage_bucket)
    .getPublicUrl(asset.storage_key);
  return data.publicUrl || null;
}

function tierFromNumber(value: number | null | undefined): CookProofViewModel['tier'] {
  switch (value) {
    case 3:
      return 'gold';
    case 2:
      return 'silver';
    case 1:
      return 'bronze';
    case 0:
    default:
      return 'like';
  }
}

function mapProofs(
  supabase: SupabaseClient,
  proofs: VoteProofRow[],
  relations: CookProofRelations,
): CookProofViewModel[] {
  const assetMap = rowsById(relations.assets);
  const profileMap = rowsById(relations.profiles);
  const voteMap = rowsById(relations.votes);
  const submissionMap = rowsById(relations.submissions);
  const snapshotMap = rowsById(relations.snapshots);

  return proofs.map((proof) => {
    const asset = assetMap.get(proof.media_asset_id);
    const profile = profileMap.get(proof.profile_id);
    const vote = voteMap.get(proof.vote_id);
    const submission = submissionMap.get(proof.submission_id);
    const snapshot = submission?.recipe_snapshot_id
      ? snapshotMap.get(submission.recipe_snapshot_id)
      : null;
    return {
      id: proof.id,
      voteId: proof.vote_id,
      submissionId: proof.submission_id,
      profileId: proof.profile_id,
      mediaAssetId: proof.media_asset_id,
      imageUrl: publicAssetUrl(supabase, asset),
      authorName: profile?.display_name?.trim() || 'BestChef Cook',
      authorHandle: profile?.handle?.trim() || 'bestchef',
      submissionTitle: snapshot?.title?.trim() || 'BestChef recipe',
      tier: tierFromNumber(vote?.tier),
      capturedAt: proof.captured_at,
      width: asset?.width ?? null,
      height: asset?.height ?? null,
    };
  });
}

async function loadProofRelations(
  supabase: SupabaseClient,
  proofs: VoteProofRow[],
): Promise<CookProofRelations> {
  const assetIds = [...new Set(proofs.map((proof) => proof.media_asset_id))];
  const profileIds = [...new Set(proofs.map((proof) => proof.profile_id))];
  const voteIds = [...new Set(proofs.map((proof) => proof.vote_id))];
  const submissionIds = [...new Set(proofs.map((proof) => proof.submission_id))];

  const [{ data: assets }, { data: profiles }, { data: votes }, { data: submissions }] = await Promise.all([
    assetIds.length > 0
      ? supabase
        .from('bc_media_assets')
        .select('id, remote_url, storage_bucket, storage_key, width, height')
        .in('id', assetIds)
      : Promise.resolve({ data: [] as MediaAssetRow[] }),
    profileIds.length > 0
      ? supabase
        .from('social_profiles')
        .select('id, display_name, handle')
        .in('id', profileIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    voteIds.length > 0
      ? supabase
        .from('bc_votes')
        .select('id, tier')
        .in('id', voteIds)
      : Promise.resolve({ data: [] as VoteRow[] }),
    submissionIds.length > 0
      ? supabase
        .from('bc_submissions')
        .select('id, recipe_snapshot_id')
        .in('id', submissionIds)
      : Promise.resolve({ data: [] as SubmissionRow[] }),
  ]);

  const normalizedSubmissions = (submissions ?? []) as SubmissionRow[];
  const snapshotIds = [...new Set(
    normalizedSubmissions
      .map((submission) => submission.recipe_snapshot_id)
      .filter((id): id is string => Boolean(id)),
  )];
  const { data: snapshots } = snapshotIds.length > 0
    ? await supabase
      .from('bc_recipe_snapshots')
      .select('id, title')
      .in('id', snapshotIds)
    : { data: [] as RecipeSnapshotRow[] };

  return {
    assets: (assets ?? []) as MediaAssetRow[],
    profiles: (profiles ?? []) as ProfileRow[],
    votes: (votes ?? []) as VoteRow[],
    submissions: normalizedSubmissions,
    snapshots: (snapshots ?? []) as RecipeSnapshotRow[],
  };
}

async function getApprovedProofCount(
  supabase: SupabaseClient | null,
  submissionId: string | null | undefined,
): Promise<number> {
  if (!supabase || !submissionId) return 0;

  const { count, error } = await supabase
    .from('bc_vote_proofs')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId)
    .eq('status', 'approved');

  if (error) return 0;
  return count ?? 0;
}

async function getFocusedProof(
  supabase: SupabaseClient,
  submissionId: string,
  proofId: string | null | undefined,
): Promise<VoteProofRow | null> {
  if (!proofId) return null;

  const { data, error } = await supabase
    .from('bc_vote_proofs')
    .select('id, vote_id, submission_id, profile_id, media_asset_id, captured_at')
    .eq('id', proofId)
    .eq('submission_id', submissionId)
    .eq('status', 'approved')
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as VoteProofRow;
}

export async function getSubmissionCookProofGallery(
  supabase: SupabaseClient | null,
  submissionId: string | null | undefined,
  options: {
    limit?: number;
    includeAll?: boolean;
    focusedProofId?: string | null;
  } = {},
): Promise<CookProofGalleryResult> {
  if (!supabase || !submissionId) return { proofs: [], totalCount: 0 };

  const totalCount = await getApprovedProofCount(supabase, submissionId);
  const limit = options.includeAll
    ? Math.max(totalCount, options.limit ?? 12, 1)
    : Math.max(options.limit ?? 12, 1);

  const { data, error } = await supabase
    .from('bc_vote_proofs')
    .select('id, vote_id, submission_id, profile_id, media_asset_id, captured_at')
    .eq('submission_id', submissionId)
    .eq('status', 'approved')
    .order('captured_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return { proofs: [], totalCount };

  let proofs = data as VoteProofRow[];
  const focused = await getFocusedProof(supabase, submissionId, options.focusedProofId);
  if (focused) {
    proofs = [focused, ...proofs.filter((proof) => proof.id !== focused.id)];
  }

  const relations = await loadProofRelations(supabase, proofs);
  return { proofs: mapProofs(supabase, proofs, relations), totalCount };
}

export async function getSubmissionCookProofs(
  supabase: SupabaseClient | null,
  submissionId: string | null | undefined,
  limit = 12,
): Promise<CookProofViewModel[]> {
  return (await getSubmissionCookProofGallery(supabase, submissionId, { limit })).proofs;
}

export async function getProfileCookProofs(
  supabase: SupabaseClient | null,
  profileId: string | null | undefined,
  limit = 9,
): Promise<CookProofViewModel[]> {
  if (!supabase || !profileId) return [];

  const { data, error } = await supabase
    .from('bc_vote_proofs')
    .select('id, vote_id, submission_id, profile_id, media_asset_id, captured_at')
    .eq('profile_id', profileId)
    .eq('status', 'approved')
    .order('captured_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return [];

  const proofs = data as VoteProofRow[];
  const relations = await loadProofRelations(supabase, proofs);
  return mapProofs(supabase, proofs, relations);
}
