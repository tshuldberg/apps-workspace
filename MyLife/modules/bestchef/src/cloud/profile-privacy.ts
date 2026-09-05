/**
 * Profile privacy controls -- toggles social_profiles.is_public and exposes
 * the public read view used by the marketing /c/[handle] web route.
 *
 * P13-B (F-020): chefs can hide their profile from logged-out viewers.
 * The toggle defaults to ON via the migration so existing chefs stay public.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';

export interface SetProfilePrivacyInput {
  isPublic: boolean;
}

export interface GetProfilePrivacyInput {
  userId: string;
}

export interface PublicProfileSummary {
  profileId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  cuisine: string | null;
  region: string | null;
}

export interface GetPublicProfileByHandleInput {
  handle: string;
}

/**
 * Update the is_public flag on the caller's social_profiles row.
 */
export async function setProfilePrivacy({
  isPublic,
}: SetProfilePrivacyInput): Promise<BestChefResult<{ isPublic: boolean }>> {
  const supabase = getBestChefClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return err('Not authenticated');

  const { error: updateErr } = await supabase
    .from('social_profiles')
    .update({ is_public: isPublic })
    .eq('user_id', user.id);

  if (updateErr) return err(updateErr.message);
  return ok({ isPublic });
}

/**
 * Read the is_public flag for a given social profile id. Returns true when
 * the row is missing or the flag is null (the column default is true).
 */
export async function getProfilePrivacy({
  userId,
}: GetProfilePrivacyInput): Promise<BestChefResult<boolean>> {
  const supabase = getBestChefClient();
  const { data, error: selectErr } = await supabase
    .from('social_profiles')
    .select('is_public')
    .eq('id', userId)
    .maybeSingle();

  if (selectErr) return err(selectErr.message);
  if (!data) return ok(true);
  return ok((data.is_public as boolean | null) ?? true);
}

/**
 * Resolve a handle via the public read view. Anonymous-safe -- the underlying
 * view filters out private profiles and is granted to anon + authenticated.
 */
export async function getPublicProfileByHandle({
  handle,
}: GetPublicProfileByHandleInput): Promise<BestChefResult<PublicProfileSummary | null>> {
  const supabase = getBestChefClient();
  const cleaned = handle.replace(/^@/, '').trim();
  if (!cleaned) return ok(null);

  const { data, error: selectErr } = await supabase
    .from('bc_public_profiles_v')
    .select('id, handle, display_name, bio, avatar_url, cuisine, region')
    .eq('handle', cleaned)
    .maybeSingle();

  if (selectErr) return err(selectErr.message);
  if (!data) return ok(null);

  return ok({
    profileId: data.id as string,
    handle: data.handle as string,
    displayName: data.display_name as string,
    bio: (data.bio as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    cuisine: (data.cuisine as string | null) ?? null,
    region: (data.region as string | null) ?? null,
  });
}
