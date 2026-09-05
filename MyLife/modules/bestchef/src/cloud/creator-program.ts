/**
 * Creator application and analytics engine.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { CreatorApplication } from './types';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mapper ──────────────────────────────────────────────────────

function mapApplication(row: Record<string, unknown>): CreatorApplication {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    platformLinks: row.platform_links,
    bio: row.bio as string,
    specialties: row.specialties as string[],
    status: (row.status as CreatorApplication['status']) ?? 'submitted',
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : null,
    reviewerNote: (row.reviewer_note as string) ?? null,
    reviewNotes: (row.review_notes as string) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

// ── Options ─────────────────────────────────────────────────────────

export interface GetCreatorListOptions {
  limit?: number;
  offset?: number;
}

// ── Analytics types ─────────────────────────────────────────────────

export interface CreatorAnalytics {
  totalViews: number;
  totalVotes: number;
  totalFollowers: number;
  totalRevenue: number;
  totalTips: number;
  totalSubscribers: number;
  topRecipe: { submissionId: string; title: string; score: number } | null;
  revenueByMonth: Array<{ month: string; amountCents: number }>;
}

/** Build a zero-valued analytics object (useful for tests and defaults). */
export function emptyAnalytics(): CreatorAnalytics {
  return {
    totalViews: 0,
    totalVotes: 0,
    totalFollowers: 0,
    totalRevenue: 0,
    totalTips: 0,
    totalSubscribers: 0,
    topRecipe: null,
    revenueByMonth: [],
  };
}

// ── Pure helpers ────────────────────────────────────────────────────

/**
 * Aggregate monthly revenue from a list of tip records.
 * Each record must have `created_at` (ISO string) and `amount_cents` (number).
 */
export function aggregateRevenueByMonth(
  records: Array<{ createdAt: string; amountCents: number }>,
): Array<{ month: string; amountCents: number }> {
  const map = new Map<string, number>();
  for (const r of records) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + r.amountCents);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amountCents]) => ({ month, amountCents }));
}

/**
 * Validate that required application fields are present.
 */
export function validateApplicationFields(
  bio: string,
  specialties: string[],
): string | null {
  if (bio.trim().length === 0) return 'Bio cannot be empty';
  if (specialties.length === 0) return 'At least one specialty is required';
  if (specialties.some((s) => s.trim().length === 0)) return 'Specialties cannot contain empty strings';
  return null;
}

// ── Application operations ──────────────────────────────────────────

export async function applyForCreator(
  profileId: string,
  platformLinks: unknown,
  bio: string,
  specialties: string[],
): Promise<BestChefResult<CreatorApplication>> {
  const validationError = validateApplicationFields(bio, specialties);
  if (validationError) return err(validationError);

  const { data, error: dbErr } = await from('bc_creator_applications')
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

export async function getApplication(
  profileId: string,
): Promise<BestChefResult<CreatorApplication>> {
  const { data, error: dbErr } = await from('bc_creator_applications')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapApplication(data));
}

export async function updateApplicationStatus(
  applicationId: string,
  status: CreatorApplication['status'],
  reviewerNote?: string,
): Promise<BestChefResult<CreatorApplication>> {
  const { data, error: dbErr } = await from('bc_creator_applications')
    .update({
      status,
      reviewer_note: reviewerNote ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapApplication(data));
}

export async function isCreator(
  profileId: string,
): Promise<BestChefResult<boolean>> {
  const { count, error: dbErr } = await from('bc_creator_applications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('status', 'approved');

  if (dbErr) return err(dbErr.message);
  return ok((count ?? 0) > 0);
}

// ── Entitlement (server-truth) ──────────────────────────────────────

export type CreatorEntitlementTier = 'none' | 'verified' | 'pro';

export interface CreatorEntitlement {
  tier: CreatorEntitlementTier;
  features: string[];
}

const VERIFIED_FEATURES = ['tips', 'subscriptions', 'analytics', 'creator_dashboard'] as const;

/**
 * Server-truth gating for creator-only surfaces. Returns the caller's
 * entitlement derived from approved creator applications. UI surfaces must
 * gate on this rather than a local flag.
 */
export async function getCreatorEntitlement(
  profileId: string,
): Promise<BestChefResult<CreatorEntitlement>> {
  const { count, error: dbErr } = await from('bc_creator_applications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('status', 'approved');

  if (dbErr) return err(dbErr.message);
  if ((count ?? 0) > 0) {
    return ok({ tier: 'verified', features: [...VERIFIED_FEATURES] });
  }
  return ok({ tier: 'none', features: [] });
}

// ── Analytics ───────────────────────────────────────────────────────

export async function getCreatorAnalytics(
  profileId: string,
): Promise<BestChefResult<CreatorAnalytics>> {
  const analytics = emptyAnalytics();

  // Total votes on the creator's submissions
  const { data: submissions, error: subErr } = await from('bc_submissions')
    .select('id, vote_score')
    .eq('profile_id', profileId);

  if (subErr) return err(subErr.message);

  const submissionIds = (submissions ?? []).map((s: Record<string, unknown>) => s.id as string);
  analytics.totalVotes = (submissions ?? []).reduce(
    (sum: number, s: Record<string, unknown>) => sum + ((s.vote_score as number) ?? 0),
    0,
  );

  // Top recipe by vote_score
  if (submissions && submissions.length > 0) {
    const sorted = [...submissions].sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.vote_score as number) ?? 0) - ((a.vote_score as number) ?? 0),
    );
    const top = sorted[0];
    if (top) {
      analytics.topRecipe = {
        submissionId: top.id as string,
        title: '', // Would need a join to recipe_snapshots; left blank for now
        score: (top.vote_score as number) ?? 0,
      };
    }
  }

  // Total views: sum of vote counts on all submissions
  if (submissionIds.length > 0) {
    const { count: voteCount, error: voteErr } = await from('bc_votes')
      .select('*', { count: 'exact', head: true })
      .in('submission_id', submissionIds);

    if (!voteErr) {
      analytics.totalViews = voteCount ?? 0;
    }
  }

  // Subscribers
  const { count: subCount, error: subCountErr } = await from('bc_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('chef_id', profileId)
    .eq('status', 'active');

  if (!subCountErr) {
    analytics.totalSubscribers = subCount ?? 0;
    analytics.totalFollowers = subCount ?? 0;
  }

  // Tips
  const { data: tips, error: tipErr } = await from('bc_tips')
    .select('amount_cents, platform_fee_cents, created_at')
    .eq('chef_id', profileId)
    .eq('status', 'completed');

  if (!tipErr && tips) {
    analytics.totalTips = tips.reduce(
      (sum: number, t: Record<string, unknown>) =>
        sum + ((t.amount_cents as number) - (t.platform_fee_cents as number)),
      0,
    );
  }

  // Subscription revenue
  const { data: subs, error: revenueErr } = await from('bc_subscriptions')
    .select('price_cents, platform_fee_cents')
    .eq('chef_id', profileId)
    .eq('status', 'active');

  if (!revenueErr && subs) {
    const subRevenue = subs.reduce(
      (sum: number, s: Record<string, unknown>) =>
        sum + ((s.price_cents as number) - (s.platform_fee_cents as number)),
      0,
    );
    analytics.totalRevenue = analytics.totalTips + subRevenue;
  }

  // Revenue by month from tips
  if (tips && tips.length > 0) {
    analytics.revenueByMonth = aggregateRevenueByMonth(
      tips.map((t: Record<string, unknown>) => ({
        createdAt: t.created_at as string,
        amountCents: (t.amount_cents as number) - (t.platform_fee_cents as number),
      })),
    );
  }

  return ok(analytics);
}

// ── Discovery ───────────────────────────────────────────────────────

export async function getCreatorList(
  options?: GetCreatorListOptions,
): Promise<BestChefResult<CreatorApplication[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error: dbErr } = await from('bc_creator_applications')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapApplication));
}
