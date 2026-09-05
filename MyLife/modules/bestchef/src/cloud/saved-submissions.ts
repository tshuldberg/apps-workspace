/**
 * Cloud bookmarks (plan 33 Phase 5.6, F-010).
 *
 * bc_saved_submissions is private library data: RLS restricts reads to the
 * owner, so every call here operates on the signed-in profile. Plain table
 * operations (no RPC) - the unique constraint makes saves idempotent and
 * the CHF-1 quota trigger enforces the durable rate limit.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { err, getBestChefClient, ok, type BestChefResult } from './client';
import { resolveSubmissionImageUrls } from './submission-image-url';

export interface SavedSubmissionInput {
  submissionId: string;
  profileId: string;
}

export interface SavedSubmissionSummary {
  submissionId: string;
  savedAt: string;
  dishId: string | null;
  dishName: string | null;
  title: string | null;
  photoUrl: string | null;
  chefHandle: string | null;
  chefName: string | null;
}

export interface ListSavedSubmissionsOptions {
  profileId: string;
  limit?: number;
}

function clientOrDefault(supabase?: SupabaseClient): SupabaseClient {
  return supabase ?? (getBestChefClient() as unknown as SupabaseClient);
}

function normalizeError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.includes('rate_limited')) return 'rate_limited';
  return message;
}

export async function saveSubmission(
  input: SavedSubmissionInput,
  supabase?: SupabaseClient,
): Promise<BestChefResult<true>> {
  if (!input.submissionId || !input.profileId) return err('Submission and profile ids are required.');

  const { error } = await clientOrDefault(supabase)
    .from('bc_saved_submissions')
    .insert({ submission_id: input.submissionId, profile_id: input.profileId });

  // Unique violation means it is already saved: idempotent success.
  if (error && error.code !== '23505') {
    return err(normalizeError(error.message, 'Could not save this recipe.'));
  }
  return ok(true);
}

export async function unsaveSubmission(
  input: SavedSubmissionInput,
  supabase?: SupabaseClient,
): Promise<BestChefResult<true>> {
  if (!input.submissionId || !input.profileId) return err('Submission and profile ids are required.');

  const { error } = await clientOrDefault(supabase)
    .from('bc_saved_submissions')
    .delete()
    .eq('submission_id', input.submissionId)
    .eq('profile_id', input.profileId);

  if (error) return err(normalizeError(error.message, 'Could not remove this save.'));
  return ok(true);
}

/** Which of the given submissions the profile has saved (feed button state). */
export async function getSavedSubmissionIds(
  input: { profileId: string; submissionIds: string[] },
  supabase?: SupabaseClient,
): Promise<BestChefResult<string[]>> {
  if (!input.profileId) return err('Profile id is required.');
  if (input.submissionIds.length === 0) return ok([]);

  const { data, error } = await clientOrDefault(supabase)
    .from('bc_saved_submissions')
    .select('submission_id')
    .eq('profile_id', input.profileId)
    .in('submission_id', input.submissionIds);

  if (error) return err(normalizeError(error.message, 'Could not load saved state.'));
  const rows = (data ?? []) as { submission_id: string }[];
  return ok(rows.map((row) => row.submission_id));
}

interface SavedRow {
  submission_id: string;
  created_at: string;
}

interface SavedSubmissionRow {
  id: string;
  dish_id: string | null;
  recipe_snapshot_id: string | null;
  profile_id: string | null;
  photo_url: string | null;
}

export async function listSavedSubmissions(
  options: ListSavedSubmissionsOptions,
  supabase?: SupabaseClient,
): Promise<BestChefResult<SavedSubmissionSummary[]>> {
  if (!options.profileId) return err('Profile id is required.');
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const client = clientOrDefault(supabase);

  const { data: savedData, error: savedError } = await client
    .from('bc_saved_submissions')
    .select('submission_id, created_at')
    .eq('profile_id', options.profileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (savedError) return err(normalizeError(savedError.message, 'Could not load saved recipes.'));

  const saved = (savedData ?? []) as SavedRow[];
  if (saved.length === 0) return ok([]);

  const submissionIds = saved.map((row) => row.submission_id);
  const { data: subData, error: subError } = await client
    .from('bc_submissions')
    .select('id, dish_id, recipe_snapshot_id, profile_id, photo_url')
    .in('id', submissionIds);
  if (subError) return err(normalizeError(subError.message, 'Could not load saved recipes.'));

  const submissions = new Map<string, SavedSubmissionRow>();
  for (const row of (subData ?? []) as SavedSubmissionRow[]) {
    submissions.set(row.id, row);
  }

  const snapshotIds = [...submissions.values()]
    .map((row) => row.recipe_snapshot_id)
    .filter((id): id is string => Boolean(id));
  const dishIds = [...new Set(
    [...submissions.values()].map((row) => row.dish_id).filter((id): id is string => Boolean(id)),
  )];
  const profileIds = [...new Set(
    [...submissions.values()].map((row) => row.profile_id).filter((id): id is string => Boolean(id)),
  )];

  const [snapshotsRes, dishesRes, profilesRes] = await Promise.all([
    snapshotIds.length
      ? client.from('bc_recipe_snapshots').select('id, title').in('id', snapshotIds)
      : Promise.resolve({ data: [], error: null }),
    dishIds.length
      ? client.from('bc_dishes').select('id, name').in('id', dishIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      // The public view, not social_profiles: RLS hides non-discoverable
      // profiles from other users and would blank chef names here.
      ? client.from('bc_public_profiles_v').select('id, handle, display_name').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (snapshotsRes.error) return err(normalizeError(snapshotsRes.error.message, 'Could not load saved recipes.'));
  if (dishesRes.error) return err(normalizeError(dishesRes.error.message, 'Could not load saved recipes.'));
  if (profilesRes.error) return err(normalizeError(profilesRes.error.message, 'Could not load saved recipes.'));

  const snapshots = new Map((snapshotsRes.data ?? []).map((row) => {
    const r = row as { id: string; title: string | null };
    return [r.id, r] as const;
  }));
  const dishes = new Map((dishesRes.data ?? []).map((row) => {
    const r = row as { id: string; name: string | null };
    return [r.id, r] as const;
  }));
  const profiles = new Map((profilesRes.data ?? []).map((row) => {
    const r = row as { id: string; handle: string | null; display_name: string | null };
    return [r.id, r] as const;
  }));

  // Sign submission images (audit C1: private bucket). A saved submission only
  // survives the RLS read above when it is approved (or owned/unblocked for the
  // viewer), so signing every returned row is safe; a stored public URL would
  // otherwise 404 now that the bucket is private.
  const signedPhotos = await resolveSubmissionImageUrls(
    [...submissions.values()].map((submission) => ({
      id: submission.id,
      storedValue: submission.photo_url,
      approved: true,
    })),
    client,
  );

  const out: SavedSubmissionSummary[] = [];
  for (const row of saved) {
    const submission = submissions.get(row.submission_id);
    // A save whose submission is gone (deleted, moderated away) is skipped;
    // the ON DELETE CASCADE cleans the cloud row on true deletion.
    if (!submission) continue;
    const snapshot = submission.recipe_snapshot_id ? snapshots.get(submission.recipe_snapshot_id) : undefined;
    const dish = submission.dish_id ? dishes.get(submission.dish_id) : undefined;
    const chef = submission.profile_id ? profiles.get(submission.profile_id) : undefined;
    out.push({
      submissionId: row.submission_id,
      savedAt: row.created_at,
      dishId: submission.dish_id,
      dishName: dish?.name ?? null,
      title: snapshot?.title ?? null,
      photoUrl: signedPhotos.get(submission.id) ?? null,
      chefHandle: chef?.handle ?? null,
      chefName: chef?.display_name ?? null,
    });
  }
  return ok(out);
}
