/**
 * Community Notes moderation engine -- flagging, notes, consensus, and
 * auto-action for content moderation.
 *
 * Pure helpers (evaluateNoteConsensus, checkAutoAction) are exported for
 * direct testing. Cloud functions follow the ok/err BestChefResult pattern.
 */

import {
  BESTCHEF_PRODUCT_CACHE_TABLES,
  PRIVATE_PRODUCT_CONTRIBUTION_KEYS,
  getBestChefClient,
  ok,
  err,
  type BestChefResult,
} from './client';
import type {
  Flag,
  Note,
  NoteRating,
  ContentModerationStatus,
  ProductContribution,
  ProductContributionStatus,
  ProductEvidenceConsentStatus,
  ProductModerationStatus,
} from './types';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

const PRIVATE_PRODUCT_CONTRIBUTION_KEY_SET = new Set<string>(
  PRIVATE_PRODUCT_CONTRIBUTION_KEYS,
);

// ── Row mappers ─────────────────────────────────────────────────────

function mapFlag(row: Record<string, unknown>): Flag {
  return {
    id: row.id as string,
    targetType: row.target_type as Flag['targetType'],
    targetId: row.target_id as string,
    flaggerId: row.flagger_id as string,
    reason: row.reason as string,
    status: row.status as Flag['status'],
    resolution: (row.resolution as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date((row.updated_at as string) ?? (row.created_at as string)),
  };
}

function mapNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    flagId: row.flag_id as string,
    authorId: row.author_id as string,
    body: row.body as string,
    helpfulCount: (row.helpful_count as number) ?? 0,
    unhelpfulCount: (row.unhelpful_count as number) ?? 0,
    status: row.status as Note['status'],
    createdAt: new Date(row.created_at as string),
  };
}

function mapNoteRating(row: Record<string, unknown>): NoteRating {
  return {
    noteId: row.note_id as string,
    raterId: row.rater_id as string,
    rating: row.rating as NoteRating['rating'],
    createdAt: new Date(row.created_at as string),
  };
}

function mapProductContribution(row: Record<string, unknown>): ProductContribution {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    productId: (row.product_id as string) ?? null,
    localProductId: (row.local_product_id as string) ?? null,
    contributionType: row.contribution_type as ProductContribution['contributionType'],
    proposedProductJson: (row.proposed_product_json as Record<string, unknown>) ?? {},
    proposedAliasJson: (row.proposed_alias_json as Record<string, unknown>) ?? {},
    proposedNutritionJson: (row.proposed_nutrition_json as Record<string, unknown>) ?? {},
    status: row.status as ProductContributionStatus,
    shareOptIn: (row.share_opt_in as boolean) ?? false,
    evidenceOptIn: (row.evidence_opt_in as boolean) ?? false,
    source: row.source as ProductContribution['source'],
    sourceId: (row.source_id as string) ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    license: row.license as string,
    attribution: (row.attribution as string) ?? null,
    openFoodFactsExportStatus:
      row.open_food_facts_export_status as ProductContribution['openFoodFactsExportStatus'],
    moderationStatus:
      row.moderation_status as ProductContribution['moderationStatus'],
    moderationNotes: (row.moderation_notes as string) ?? null,
    reviewedByProfileId: (row.reviewed_by_profile_id as string) ?? null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at as string) : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at as string) : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at as string) : null,
    supersededByContributionId:
      (row.superseded_by_contribution_id as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export interface ProductContributionPayloads {
  product?: Record<string, unknown>;
  alias?: Record<string, unknown>;
  nutrition?: Record<string, unknown>;
}

export interface ProductContributionSubmissionInput {
  shareOptIn: boolean;
  license?: string | null;
  attribution?: string | null;
  payloads?: ProductContributionPayloads;
  hasImageEvidence?: boolean;
  evidenceOptIn?: boolean;
  imageLicense?: string | null;
  imageConsentStatus?: ProductEvidenceConsentStatus | null;
}

export interface ProductContributionValidation {
  ok: boolean;
  errors: string[];
  privateKeys: string[];
}

function sanitizeContributionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeContributionValue);
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (PRIVATE_PRODUCT_CONTRIBUTION_KEY_SET.has(key)) continue;
      output[key] = sanitizeContributionValue(nestedValue);
    }
    return output;
  }

  return value;
}

export function sanitizeProductContributionPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeContributionValue(payload) as Record<string, unknown>;
}

function collectPrivateContributionKeys(
  value: unknown,
  prefix = '',
  found: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectPrivateContributionKeys(entry, `${prefix}[${index}]`, found);
    });
    return found;
  }

  if (!value || typeof value !== 'object') {
    return found;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (PRIVATE_PRODUCT_CONTRIBUTION_KEY_SET.has(key)) {
      found.push(path);
      continue;
    }
    collectPrivateContributionKeys(nestedValue, path, found);
  }

  return found;
}

export function validateProductContributionSubmission(
  input: ProductContributionSubmissionInput,
): ProductContributionValidation {
  const errors: string[] = [];
  const payloads = input.payloads ?? {};
  const privateKeys = [
    ...collectPrivateContributionKeys(payloads.product),
    ...collectPrivateContributionKeys(payloads.alias),
    ...collectPrivateContributionKeys(payloads.nutrition),
  ];

  if (!input.shareOptIn) {
    errors.push('Product contributions require explicit sharing opt-in.');
  }

  if (!input.license?.trim()) {
    errors.push('Product contributions require license metadata.');
  }

  if (privateKeys.length > 0) {
    errors.push('Product contributions cannot include pantry, receipt, or raw image data.');
  }

  if (input.hasImageEvidence) {
    if (!input.evidenceOptIn) {
      errors.push('Image evidence requires explicit evidence sharing opt-in.');
    }
    if (!input.imageLicense?.trim()) {
      errors.push('Image evidence requires image license metadata.');
    }
    if (!input.imageConsentStatus || input.imageConsentStatus === 'not_granted') {
      errors.push('Image evidence requires ownership, permission, public-domain, or not-required consent.');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    privateKeys,
  };
}

export interface ProductEvidencePublicationInput {
  shareOptIn: boolean;
  moderationStatus: ProductModerationStatus;
  visibility: 'private' | 'unlisted' | 'public';
  imageConsentStatus: ProductEvidenceConsentStatus;
}

export function canPublishProductEvidence(
  input: ProductEvidencePublicationInput,
): boolean {
  return (
    input.shareOptIn
    && input.moderationStatus === 'approved'
    && input.visibility !== 'private'
    && input.imageConsentStatus !== 'not_granted'
  );
}

export type ProductContributionTransitionAction =
  | 'submit'
  | 'verify'
  | 'reject'
  | 'supersede';

export interface ProductContributionTransitionOptions {
  nowIso: string;
  reviewerProfileId?: string;
  moderationNotes?: string;
  supersededByContributionId?: string;
}

export function buildProductContributionStatusPatch(
  currentStatus: ProductContributionStatus,
  action: ProductContributionTransitionAction,
  options: ProductContributionTransitionOptions,
): BestChefResult<Record<string, unknown>> {
  if (action === 'submit') {
    if (currentStatus !== 'private_draft') {
      return err('Only private drafts can be submitted.');
    }
    return ok({
      status: 'submitted',
      share_opt_in: true,
      submitted_at: options.nowIso,
    });
  }

  if (action === 'verify') {
    if (currentStatus !== 'submitted') {
      return err('Only submitted contributions can be verified.');
    }
    return ok({
      status: 'verified',
      moderation_status: 'approved',
      reviewed_by_profile_id: options.reviewerProfileId ?? null,
      moderation_notes: options.moderationNotes ?? null,
      reviewed_at: options.nowIso,
      verified_at: options.nowIso,
    });
  }

  if (action === 'reject') {
    if (currentStatus !== 'submitted') {
      return err('Only submitted contributions can be rejected.');
    }
    return ok({
      status: 'rejected',
      moderation_status: 'rejected',
      reviewed_by_profile_id: options.reviewerProfileId ?? null,
      moderation_notes: options.moderationNotes ?? null,
      reviewed_at: options.nowIso,
      rejected_at: options.nowIso,
    });
  }

  if (currentStatus !== 'submitted' && currentStatus !== 'verified') {
    return err('Only submitted or verified contributions can be superseded.');
  }

  if (!options.supersededByContributionId) {
    return err('Superseded contributions require a replacement contribution id.');
  }

  return ok({
    status: 'superseded',
    moderation_status: 'approved',
    reviewed_by_profile_id: options.reviewerProfileId ?? null,
    moderation_notes: options.moderationNotes ?? null,
    reviewed_at: options.nowIso,
    superseded_by_contribution_id: options.supersededByContributionId,
  });
}

export interface CreateProductContributionDraftInput {
  profileId: string;
  productId?: string | null;
  localProductId?: string | null;
  contributionType: ProductContribution['contributionType'];
  payloads?: ProductContributionPayloads;
  source?: ProductContribution['source'];
  sourceId?: string | null;
  sourceUrl?: string | null;
  license: string;
  attribution?: string | null;
}

export async function createProductContributionDraft(
  input: CreateProductContributionDraftInput,
): Promise<BestChefResult<ProductContribution>> {
  const { data, error: dbErr } = await from(BESTCHEF_PRODUCT_CACHE_TABLES.contributions)
    .insert({
      profile_id: input.profileId,
      product_id: input.productId ?? null,
      local_product_id: input.localProductId ?? null,
      contribution_type: input.contributionType,
      proposed_product_json: sanitizeProductContributionPayload(input.payloads?.product ?? {}),
      proposed_alias_json: sanitizeProductContributionPayload(input.payloads?.alias ?? {}),
      proposed_nutrition_json: sanitizeProductContributionPayload(input.payloads?.nutrition ?? {}),
      status: 'private_draft',
      share_opt_in: false,
      evidence_opt_in: false,
      source: input.source ?? 'manual',
      source_id: input.sourceId ?? null,
      source_url: input.sourceUrl ?? null,
      license: input.license,
      attribution: input.attribution ?? null,
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapProductContribution(data));
}

export async function submitProductContribution(
  contributionId: string,
  profileId: string,
  input: ProductContributionSubmissionInput,
): Promise<BestChefResult<ProductContribution>> {
  const validation = validateProductContributionSubmission(input);
  if (!validation.ok) {
    return err(validation.errors.join(' '));
  }

  const nowIso = new Date().toISOString();
  const patch = buildProductContributionStatusPatch('private_draft', 'submit', { nowIso });
  if (!patch.ok) return err(patch.error);

  const { data, error: dbErr } = await from(BESTCHEF_PRODUCT_CACHE_TABLES.contributions)
    .update({
      ...patch.data,
      evidence_opt_in: input.evidenceOptIn ?? false,
      license: input.license,
      attribution: input.attribution ?? null,
    })
    .eq('id', contributionId)
    .eq('profile_id', profileId)
    .eq('status', 'private_draft')
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapProductContribution(data));
}

export async function moderateProductContribution(
  contributionId: string,
  currentStatus: ProductContributionStatus,
  action: Exclude<ProductContributionTransitionAction, 'submit'>,
  options: Omit<ProductContributionTransitionOptions, 'nowIso'>,
): Promise<BestChefResult<ProductContribution>> {
  const patch = buildProductContributionStatusPatch(currentStatus, action, {
    ...options,
    nowIso: new Date().toISOString(),
  });
  if (!patch.ok) return err(patch.error);

  const { data, error: dbErr } = await from(BESTCHEF_PRODUCT_CACHE_TABLES.contributions)
    .update(patch.data)
    .eq('id', contributionId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapProductContribution(data));
}

// ── Launch moderation operations ─────────────────────────────────────

export const BESTCHEF_MODERATION_RATE_LIMITS = {
  providerCallsPerProfilePerMinute: 20,
  mediaUploadsPerProfilePerHour: 30,
  submissionsPerProfilePerHour: 12,
  commentsPerProfilePerMinute: 6,
  votesPerProfilePerMinute: 30,
  reportsPerProfilePerHour: 10,
  profileEditsPerProfilePerHour: 12,
} as const;

export type ModerationTargetKind =
  | 'submission'
  | 'comment'
  | 'profile'
  | 'media_asset'
  | 'product_contribution'
  | 'product_evidence'
  | 'vote_proof'
  | 'photo';

export type ModerationDecisionAction =
  | 'approved'
  | 'rejected'
  | 'hidden'
  | 'removed'
  | 'restored'
  | 'dismissed';

export interface PublicContentModerationStatusPatch {
  moderation_status?: ContentModerationStatus;
  updated_at?: string;
}

export function buildPublicContentModerationStatusPatch(
  currentStatus: ContentModerationStatus,
  action: ModerationDecisionAction,
  nowIso: string,
): BestChefResult<PublicContentModerationStatusPatch> {
  if (action === 'dismissed') {
    return ok({});
  }

  if (action === 'approved' || action === 'restored') {
    return ok({ moderation_status: 'approved', updated_at: nowIso });
  }

  if (action === 'hidden' || action === 'removed') {
    return ok({ moderation_status: 'hidden', updated_at: nowIso });
  }

  if (action === 'rejected') {
    return ok({ moderation_status: 'rejected', updated_at: nowIso });
  }

  return ok({ moderation_status: currentStatus, updated_at: nowIso });
}

export interface ModerationReportInput {
  targetKind: ModerationTargetKind;
  targetId: string;
  reason: string;
  reporterProfileId?: string | null;
}

export interface ModerationReportResult {
  flagId: string | null;
  queueId: string | null;
  errorCode: string | null;
}

export interface ModerationDecisionInput {
  kind: Exclude<ModerationTargetKind, 'photo'>;
  targetId: string;
  decision: ModerationDecisionAction;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ModerationDecisionResult {
  targetId: string;
  decisionId: string | null;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  errorCode: string | null;
}

type ModerationReportRow = {
  flag_id?: unknown;
  queue_id?: unknown;
  error_code?: unknown;
};

type ModerationDecisionRow = {
  target_id?: unknown;
  decision_id?: unknown;
  previous_state?: unknown;
  new_state?: unknown;
  error_code?: unknown;
};

function firstRpcRow<T>(data: T[] | T | null): T {
  if (Array.isArray(data)) return data[0] ?? ({} as T);
  return data ?? ({} as T);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function reportContentToModeration(
  input: ModerationReportInput,
): Promise<BestChefResult<ModerationReportResult>> {
  const { data, error: dbErr } = await getBestChefClient().rpc('bc_report_content', {
    p_target_kind: input.targetKind,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_reporter_profile_id: input.reporterProfileId ?? null,
  });

  if (dbErr) return err(dbErr.message);

  const row = firstRpcRow((data ?? null) as ModerationReportRow[] | ModerationReportRow | null);
  return ok({
    flagId: stringOrNull(row.flag_id),
    queueId: stringOrNull(row.queue_id),
    errorCode: stringOrNull(row.error_code),
  });
}

export async function applyModerationDecision(
  input: ModerationDecisionInput,
): Promise<BestChefResult<ModerationDecisionResult>> {
  const { data, error: dbErr } = await getBestChefClient().rpc('bc_apply_moderation_decision', {
    p_kind: input.kind,
    p_target_id: input.targetId,
    p_decision: input.decision,
    p_reason: input.reason ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (dbErr) return err(dbErr.message);

  const row = firstRpcRow((data ?? null) as ModerationDecisionRow[] | ModerationDecisionRow | null);
  return ok({
    targetId: stringOrNull(row.target_id) ?? input.targetId,
    decisionId: stringOrNull(row.decision_id),
    previousState: recordOrEmpty(row.previous_state),
    newState: recordOrEmpty(row.new_state),
    errorCode: stringOrNull(row.error_code),
  });
}

// ── Flags ───────────────────────────────────────────────────────────

export type FlagTargetTypeValue = Flag['targetType'];

/**
 * Flag content for moderation review.
 */
export async function createFlag(
  targetType: FlagTargetTypeValue,
  targetId: string,
  flaggerId: string,
  reason: string,
): Promise<BestChefResult<Flag>> {
  const { data, error: dbErr } = await from('bc_flags')
    .insert({
      target_type: targetType,
      target_id: targetId,
      flagger_id: flaggerId,
      reason,
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapFlag(data));
}

export interface GetFlagsOptions {
  targetType?: FlagTargetTypeValue;
  status?: 'open' | 'noted' | 'actioned' | 'dismissed';
  limit?: number;
  offset?: number;
}

/**
 * List flags with optional filters.
 */
export async function getFlags(
  options?: GetFlagsOptions,
): Promise<BestChefResult<Flag[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = from('bc_flags')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.targetType) {
    query = query.eq('target_type', options.targetType);
  }
  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error: dbErr } = await query;

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapFlag));
}

/**
 * All flags on a specific content item.
 */
export async function getFlagsForTarget(
  targetType: FlagTargetTypeValue,
  targetId: string,
): Promise<BestChefResult<Flag[]>> {
  const { data, error: dbErr } = await from('bc_flags')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapFlag));
}

// ── Notes ───────────────────────────────────────────────────────────

/**
 * Write a Community Note on a flag. Body capped at 1000 characters.
 */
export async function createNote(
  flagId: string,
  authorId: string,
  body: string,
): Promise<BestChefResult<Note>> {
  if (body.length > 1000) {
    return err('Note body must be 1000 characters or fewer');
  }

  const { data, error: dbErr } = await from('bc_notes')
    .insert({
      flag_id: flagId,
      author_id: authorId,
      body,
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapNote(data));
}

/**
 * All notes attached to a flag.
 */
export async function getNotesForFlag(
  flagId: string,
): Promise<BestChefResult<Note[]>> {
  const { data, error: dbErr } = await from('bc_notes')
    .select('*')
    .eq('flag_id', flagId)
    .order('created_at', { ascending: true });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapNote));
}

// ── Note ratings ────────────────────────────────────────────────────

/**
 * Rate a note as helpful or unhelpful. Upserts: one rating per rater per note.
 */
export async function rateNote(
  noteId: string,
  raterId: string,
  rating: 'helpful' | 'unhelpful',
): Promise<BestChefResult<NoteRating>> {
  const { data, error: dbErr } = await from('bc_note_ratings')
    .upsert(
      {
        note_id: noteId,
        rater_id: raterId,
        rating,
      },
      { onConflict: 'note_id,rater_id' },
    )
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapNoteRating(data));
}

/**
 * Notes that have reached "shown" status, for display on content.
 */
export async function getPublicNotes(
  targetType: FlagTargetTypeValue,
  targetId: string,
): Promise<BestChefResult<Note[]>> {
  // Get flags for this target, then get shown notes for those flags
  const { data: flags, error: flagErr } = await from('bc_flags')
    .select('id')
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  if (flagErr) return err(flagErr.message);

  const flagIds = (flags ?? []).map(
    (f: Record<string, unknown>) => f.id as string,
  );
  if (flagIds.length === 0) return ok([]);

  const { data: notes, error: noteErr } = await from('bc_notes')
    .select('*')
    .in('flag_id', flagIds)
    .eq('status', 'shown')
    .order('created_at', { ascending: true });

  if (noteErr) return err(noteErr.message);
  return ok((notes ?? []).map(mapNote));
}

// ── Consensus engine (pure) ─────────────────────────────────────────

export interface ConsensusResult {
  shouldShow: boolean;
  helpfulRatio: number;
  totalRatings: number;
  uniqueRaters: number;
}

export const MIN_RATINGS = 5;
export const MIN_HELPFUL_RATIO = 0.7;
export const MIN_UNIQUE_RATERS = 3;

/**
 * Determine if a note should be shown publicly based on its ratings.
 *
 * Algorithm:
 * 1. Need minimum 5 ratings
 * 2. Helpful ratio must be >= 0.7 (70% helpful)
 * 3. Must have ratings from at least 3 unique raters
 */
export function evaluateNoteConsensus(ratings: NoteRating[]): ConsensusResult {
  const totalRatings = ratings.length;
  const uniqueRaters = new Set(ratings.map((r) => r.raterId)).size;
  const helpfulCount = ratings.filter((r) => r.rating === 'helpful').length;
  const helpfulRatio = totalRatings > 0 ? helpfulCount / totalRatings : 0;

  const shouldShow =
    totalRatings >= MIN_RATINGS &&
    helpfulRatio >= MIN_HELPFUL_RATIO &&
    uniqueRaters >= MIN_UNIQUE_RATERS;

  return {
    shouldShow,
    helpfulRatio: Math.round(helpfulRatio * 1000) / 1000,
    totalRatings,
    uniqueRaters,
  };
}

/**
 * Run consensus check and update note status (pending -> shown or hidden).
 */
export async function processConsensus(
  noteId: string,
): Promise<BestChefResult<ConsensusResult>> {
  // Fetch all ratings for this note
  const { data: ratingRows, error: ratingErr } = await from('bc_note_ratings')
    .select('*')
    .eq('note_id', noteId);

  if (ratingErr) return err(ratingErr.message);

  const ratings = (ratingRows ?? []).map(mapNoteRating);
  const consensus = evaluateNoteConsensus(ratings);

  // Only update if we have enough ratings to make a decision
  if (ratings.length >= MIN_RATINGS) {
    const newStatus = consensus.shouldShow ? 'shown' : 'hidden';
    const { error: updateErr } = await from('bc_notes')
      .update({
        status: newStatus,
        helpful_count: ratings.filter((r) => r.rating === 'helpful').length,
        unhelpful_count: ratings.filter((r) => r.rating === 'unhelpful').length,
      })
      .eq('id', noteId);

    if (updateErr) return err(updateErr.message);
  }

  return ok(consensus);
}

// ── Auto-action ─────────────────────────────────────────────────────

export interface AutoActionResult {
  shouldAct: boolean;
  action: 'demote' | 'hide' | 'none';
}

/**
 * Check if a flag's notes have reached consensus for auto-action.
 *
 * If a critical note is shown (status = 'shown'), auto-demote the target.
 * A note is considered critical when its consensus helpfulRatio is >= 0.8.
 */
export function checkAutoAction(
  notes: Note[],
  ratingsPerNote: Map<string, NoteRating[]>,
): AutoActionResult {
  for (const note of notes) {
    if (note.status !== 'shown') continue;

    const ratings = ratingsPerNote.get(note.id) ?? [];
    const consensus = evaluateNoteConsensus(ratings);

    // A shown note with very high consensus triggers auto-action
    if (consensus.shouldShow && consensus.helpfulRatio >= 0.8) {
      return { shouldAct: true, action: 'demote' };
    }
  }

  return { shouldAct: false, action: 'none' };
}

/**
 * Resolve a flag with a status and optional resolution note.
 */
export async function resolveFlag(
  flagId: string,
  status: 'actioned' | 'dismissed',
  resolution?: string,
): Promise<BestChefResult<Flag>> {
  const updatePayload: Record<string, unknown> = { status };
  if (resolution !== undefined) {
    updatePayload.resolution = resolution;
  }

  const { data, error: dbErr } = await from('bc_flags')
    .update(updatePayload)
    .eq('id', flagId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapFlag(data));
}

// ── Dashboard stats ─────────────────────────────────────────────────

export interface ModerationStats {
  openFlags: number;
  pendingNotes: number;
  actionsThisWeek: number;
}

/**
 * Dashboard-level moderation stats.
 */
export async function getModerationStats(): Promise<
  BestChefResult<ModerationStats>
> {
  // Open flags
  const { count: openFlags, error: flagErr } = await from('bc_flags')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  if (flagErr) return err(flagErr.message);

  // Pending notes
  const { count: pendingNotes, error: noteErr } = await from('bc_notes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (noteErr) return err(noteErr.message);

  // Actions this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: actionsThisWeek, error: actionErr } = await from('bc_flags')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'actioned')
    .gte('created_at', weekAgo.toISOString());

  if (actionErr) return err(actionErr.message);

  return ok({
    openFlags: openFlags ?? 0,
    pendingNotes: pendingNotes ?? 0,
    actionsThisWeek: actionsThisWeek ?? 0,
  });
}
