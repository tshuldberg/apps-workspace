/**
 * Creator application workflow -- submit, status fetch, withdraw.
 *
 * P13-D (F-027, F-028): the standalone app now talks to these helpers
 * instead of opening a mailto: link. Submissions land directly in
 * bc_creator_applications, the user can poll their status, and approval
 * gates creator-only surfaces via getCreatorEntitlement.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ok, err, type BestChefResult } from './client';
import type { CreatorApplication } from './types';

// ── Row mapper ──────────────────────────────────────────────────────

function mapApplication(row: Record<string, unknown>): CreatorApplication {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    platformLinks: row.platform_links,
    bio: row.bio as string,
    specialties: (row.specialties as string[]) ?? [],
    status: (row.status as CreatorApplication['status']) ?? 'submitted',
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : null,
    reviewerNote: (row.reviewer_note as string) ?? null,
    reviewNotes: (row.review_notes as string) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

// ── Inputs ──────────────────────────────────────────────────────────

export interface SubmitCreatorApplicationInput {
  /** Free-text motivation -- "why do you want to be a creator". */
  reason: string;
  /** Portfolio URL, social handles, etc. Stored as a single jsonb blob. */
  links: {
    portfolio?: string | null;
    social?: string | null;
  };
  /** Audience description, typically a short blurb. */
  audience?: string | null;
}

export interface WithdrawCreatorApplicationInput {
  applicationId: string;
}

// ── Profile resolution ─────────────────────────────────────────────

/**
 * Resolve the social profile id for the currently signed-in supabase user.
 * Returns an error result if the caller is not authenticated or has no
 * social_profiles row.
 */
async function getCallerProfileId(
  supabase: SupabaseClient,
): Promise<BestChefResult<string>> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return err('Not authenticated');

  const { data, error: profileErr } = await supabase
    .from('social_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileErr) return err(profileErr.message);
  if (!data) return err('Social profile not found');
  return ok(data.id as string);
}

// ── Write operations ────────────────────────────────────────────────

/**
 * Submit a creator application via Supabase. Idempotent -- if the caller
 * already has an open application (status not in 'declined','approved',
 * 'withdrawn') the existing row is returned instead of inserting a new one.
 */
export async function submitCreatorApplication(
  supabase: SupabaseClient,
  input: SubmitCreatorApplicationInput,
): Promise<BestChefResult<CreatorApplication>> {
  const reason = input.reason.trim();
  if (reason.length === 0) return err('Reason cannot be empty');

  const profileResult = await getCallerProfileId(supabase);
  if (!profileResult.ok) return err(profileResult.error);
  const profileId = profileResult.data;

  // Idempotency: return any existing open application instead of duplicating.
  const { data: existing, error: existingErr } = await supabase
    .from('bc_creator_applications')
    .select('*')
    .eq('profile_id', profileId)
    .not('status', 'in', '(declined,approved,withdrawn)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingErr) return err(existingErr.message);
  if (existing) return ok(mapApplication(existing));

  const platformLinks = {
    portfolio: input.links.portfolio?.trim() ?? null,
    social: input.links.social?.trim() ?? null,
    audience: input.audience?.trim() ?? null,
  };

  const { data, error: insertErr } = await supabase
    .from('bc_creator_applications')
    .insert({
      profile_id: profileId,
      platform_links: platformLinks,
      bio: reason,
      specialties: [],
      status: 'submitted',
    })
    .select()
    .single();

  if (insertErr) return err(insertErr.message);
  return ok(mapApplication(data));
}

/**
 * Withdraw the caller's open application. Sets status to 'withdrawn' so the
 * applicant can re-apply later without leaving stale "open" state behind.
 */
export async function withdrawCreatorApplication(
  supabase: SupabaseClient,
  { applicationId }: WithdrawCreatorApplicationInput,
): Promise<BestChefResult<CreatorApplication>> {
  const profileResult = await getCallerProfileId(supabase);
  if (!profileResult.ok) return err(profileResult.error);

  const { data, error: updateErr } = await supabase
    .from('bc_creator_applications')
    .update({
      status: 'withdrawn',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('profile_id', profileResult.data)
    .select()
    .single();

  if (updateErr) return err(updateErr.message);
  return ok(mapApplication(data));
}

// ── Read operations ─────────────────────────────────────────────────

/**
 * Fetch the latest creator application for the caller, or null when the
 * caller has never applied.
 */
export async function getMyCreatorApplication(
  supabase: SupabaseClient,
): Promise<BestChefResult<CreatorApplication | null>> {
  const profileResult = await getCallerProfileId(supabase);
  if (!profileResult.ok) return err(profileResult.error);

  const { data, error: selectErr } = await supabase
    .from('bc_creator_applications')
    .select('*')
    .eq('profile_id', profileResult.data)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectErr) return err(selectErr.message);
  if (!data) return ok(null);
  return ok(mapApplication(data));
}

// ── Legacy helpers retained for back-compat with creator-program.ts ─

/**
 * @deprecated use `submitCreatorApplication` for the supabase-explicit form.
 *
 * Apply for the creator program using the implicit `getBestChefClient()`
 * connection. Kept so existing call sites in `creator-program.ts` continue
 * to compile. New code should pass an explicit `SupabaseClient`.
 */
export async function applyForCreator(
  profileId: string,
  platformLinks: unknown,
  bio: string,
  specialties: string[],
): Promise<BestChefResult<CreatorApplication>> {
  const { getBestChefClient } = await import('./client');
  const supabase = getBestChefClient();

  if (bio.trim().length === 0) return err('Bio cannot be empty');
  if (specialties.length === 0) return err('At least one specialty is required');

  const { count, error: countErr } = await supabase
    .from('bc_creator_applications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId);

  if (countErr) return err(countErr.message);
  if ((count ?? 0) > 0) return err('You already have an application on file');

  const { data, error: dbErr } = await supabase
    .from('bc_creator_applications')
    .insert({
      profile_id: profileId,
      platform_links: platformLinks,
      bio: bio.trim(),
      specialties,
      status: 'submitted',
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapApplication(data));
}

/**
 * @deprecated use `getMyCreatorApplication` for the supabase-explicit form.
 */
export async function getApplication(
  profileId: string,
): Promise<BestChefResult<CreatorApplication | null>> {
  const { getBestChefClient } = await import('./client');
  const { data, error: dbErr } = await getBestChefClient()
    .from('bc_creator_applications')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dbErr) return err(dbErr.message);
  if (!data) return ok(null);
  return ok(mapApplication(data));
}
