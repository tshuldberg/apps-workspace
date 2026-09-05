import type { SupabaseClient, User } from '@supabase/supabase-js';
import { err, getBestChefClient, ok, type BestChefResult } from './client';

export type BestChefAccountProvider = 'anonymous' | 'email' | 'phone' | string;

export interface BestChefIdentityStatus {
  userId: string;
  profileId: string | null;
  isAnonymous: boolean;
  providers: BestChefAccountProvider[];
  hasDurableProvider: boolean;
  requiresAccountLinking: boolean;
  role: string;
  roles: string[];
}

export interface BestChefCloudDeletionRequest {
  id: string;
  userId: string;
  profileId: string | null;
  status: string;
  reason: string | null;
  requestedAt: Date;
  completedAt: Date | null;
}

export const BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS = [
  'bc_recipe_snapshots.profile_id',
  'bc_media_assets.owner_profile_id',
  'bc_product_records.created_by_profile_id',
  'bc_product_records.verified_by_profile_id',
  'bc_product_contributions.profile_id',
  'bc_product_contributions.reviewed_by_profile_id',
  'bc_product_evidence.owner_profile_id',
  'bc_submissions.profile_id',
  'bc_submission_likes.profile_id',
  'bc_saved_submissions.profile_id',
  'bc_votes.voter_profile_id',
  'bc_comments.profile_id',
  'bc_comment_helpful.voter_profile_id',
  'bc_photo_reports.reporter_id',
  'bc_flags.flagger_id',
  'bc_notes.author_id',
  'bc_note_ratings.rater_id',
  'bc_chef_badges.profile_id',
  'bc_creator_applications.profile_id',
  'bc_tips.tipper_id',
  'bc_tips.chef_id',
  'bc_subscription_tiers.chef_id',
  'bc_subscriptions.subscriber_id',
  'bc_subscriptions.chef_id',
  'bc_posts.author_id',
  'bc_recipe_forks.forked_by_profile_id',
  'bc_affiliate_orders.chef_id',
  'bc_hubs.owner_profile_id',
  'bc_submission_aliases.created_by_profile_id',
] as const;

type IdentityStatusRow = {
  user_id?: unknown;
  profile_id?: unknown;
  is_anonymous?: unknown;
  role?: unknown;
  roles?: unknown;
};

type DeletionRequestRow = {
  id?: unknown;
  user_id?: unknown;
  profile_id?: unknown;
  status?: unknown;
  reason?: unknown;
  requested_at?: unknown;
  completed_at?: unknown;
};

function getProvidersFromUser(user: Pick<User, 'email' | 'phone' | 'identities' | 'is_anonymous'> | null): BestChefAccountProvider[] {
  if (!user) return [];

  const providers = new Set<BestChefAccountProvider>();
  if (user.is_anonymous) providers.add('anonymous');
  if (user.email) providers.add('email');
  if (user.phone) providers.add('phone');

  for (const identity of user.identities ?? []) {
    if (identity.provider) providers.add(identity.provider);
  }

  return [...providers];
}

function hasDurableProvider(providers: BestChefAccountProvider[]): boolean {
  return providers.some((provider) => provider !== 'anonymous');
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 'true';
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function mapDeletionRequest(row: DeletionRequestRow): BestChefCloudDeletionRequest {
  return {
    id: stringOrNull(row.id) ?? '',
    userId: stringOrNull(row.user_id) ?? '',
    profileId: stringOrNull(row.profile_id),
    status: stringOrNull(row.status) ?? 'requested',
    reason: stringOrNull(row.reason),
    requestedAt: new Date(stringOrNull(row.requested_at) ?? Date.now()),
    completedAt: row.completed_at ? new Date(String(row.completed_at)) : null,
  };
}

export function classifyBestChefIdentity(
  user: Pick<User, 'id' | 'email' | 'phone' | 'identities' | 'is_anonymous'>,
  profileId: string | null = null,
): BestChefIdentityStatus {
  const providers = getProvidersFromUser(user);
  const durable = hasDurableProvider(providers);

  return {
    userId: user.id,
    profileId,
    isAnonymous: user.is_anonymous === true || !durable,
    providers,
    hasDurableProvider: durable,
    requiresAccountLinking: !durable,
    role: 'authenticated',
    roles: [],
  };
}

export async function getCurrentBestChefIdentityStatus(
  supabase: SupabaseClient = getBestChefClient(),
): Promise<BestChefResult<BestChefIdentityStatus>> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return err(userError.message);
  if (!userData.user) return err('Not authenticated');

  const { data, error } = await supabase.rpc('bc_current_identity_status');
  if (error) return err(error.message);

  const row = (data ?? {}) as IdentityStatusRow;
  const providers = getProvidersFromUser(userData.user);
  const durable = hasDurableProvider(providers);

  return ok({
    userId: stringOrNull(row.user_id) ?? userData.user.id,
    profileId: stringOrNull(row.profile_id),
    isAnonymous: booleanValue(row.is_anonymous) || !durable,
    providers,
    hasDurableProvider: durable,
    requiresAccountLinking: !durable,
    role: stringOrNull(row.role) ?? 'authenticated',
    roles: stringArray(row.roles),
  });
}

export async function requestBestChefAccountDeletion(
  input: { reason?: string; metadata?: Record<string, unknown> } = {},
  supabase: SupabaseClient = getBestChefClient(),
): Promise<BestChefResult<BestChefCloudDeletionRequest>> {
  const { data, error } = await supabase.rpc('bc_request_account_deletion', {
    p_reason: input.reason ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) return err(error.message);
  return ok(mapDeletionRequest((data ?? {}) as DeletionRequestRow));
}

export async function getBestChefProfileOwnedRowCounts(
  profileId: string,
  supabase: SupabaseClient = getBestChefClient(),
): Promise<BestChefResult<Record<string, number>>> {
  const { data, error } = await supabase.rpc('bc_profile_owned_row_counts', {
    p_profile_id: profileId,
  });

  if (error) return err(error.message);
  return ok((data ?? {}) as Record<string, number>);
}

export async function getBestChefProfileMergeConflicts(
  sourceProfileId: string,
  targetProfileId: string,
  supabase: SupabaseClient = getBestChefClient(),
): Promise<BestChefResult<Record<string, number>>> {
  const { data, error } = await supabase.rpc('bc_profile_merge_conflicts', {
    p_source_profile_id: sourceProfileId,
    p_target_profile_id: targetProfileId,
  });

  if (error) return err(error.message);
  return ok((data ?? {}) as Record<string, number>);
}
