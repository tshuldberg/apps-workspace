/**
 * Photo verification engine -- report, verify, and check authenticity of
 * submission photos.
 *
 * Pure helpers (checkExifData, runAiDetectionHeuristics) are exported for
 * direct testing. Cloud functions follow the ok/err BestChefResult pattern.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { PhotoReport, Submission } from './types';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Row mapper ──────────────────────────────────────────────────────

function mapPhotoReport(row: Record<string, unknown>): PhotoReport {
  return {
    id: row.id as string,
    submissionId: row.submission_id as string,
    reporterId: row.reporter_id as string,
    reason: row.reason as PhotoReport['reason'],
    status: row.status as PhotoReport['status'],
    createdAt: new Date(row.created_at as string),
  };
}

// ── Photo reports ───────────────────────────────────────────────────

export type PhotoReportReasonValue =
  | 'ai_generated'
  | 'stolen'
  | 'inappropriate'
  | 'wrong_dish'
  | 'other';

/**
 * Submit a report against a submission's photo.
 */
export async function submitPhotoReport(
  submissionId: string,
  reporterId: string,
  reason: PhotoReportReasonValue,
): Promise<BestChefResult<PhotoReport>> {
  const { data, error: dbErr } = await from('bc_photo_reports')
    .insert({
      submission_id: submissionId,
      reporter_id: reporterId,
      reason,
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapPhotoReport(data));
}

/**
 * Get all reports for a submission.
 */
export async function getPhotoReports(
  submissionId: string,
): Promise<BestChefResult<PhotoReport[]>> {
  const { data, error: dbErr } = await from('bc_photo_reports')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false });

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapPhotoReport));
}

export interface OpenReportsOptions {
  limit?: number;
  offset?: number;
}

/**
 * Get all open reports across submissions.
 */
export async function getOpenReports(
  options?: OpenReportsOptions,
): Promise<BestChefResult<PhotoReport[]>> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error: dbErr } = await from('bc_photo_reports')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapPhotoReport));
}

// ── Verification status ─────────────────────────────────────────────

/**
 * Mark a submission's photo as verified.
 */
export async function verifySubmissionPhoto(
  submissionId: string,
  method: 'exif' | 'ai_detection' | 'community' | 'manual',
): Promise<BestChefResult<Submission>> {
  const { data, error: dbErr } = await from('bc_submissions')
    .update({
      photo_verified: true,
      photo_verified_at: new Date().toISOString(),
      verification_method: method,
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapSubmission(data));
}

/**
 * Remove verified status from a submission's photo.
 */
export async function revokePhotoVerification(
  submissionId: string,
): Promise<BestChefResult<Submission>> {
  const { data, error: dbErr } = await from('bc_submissions')
    .update({
      photo_verified: false,
      photo_verified_at: null,
      verification_method: null,
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapSubmission(data));
}

/**
 * Check if a submission's photo is verified.
 */
export async function isPhotoVerified(
  submissionId: string,
): Promise<BestChefResult<boolean>> {
  const { data, error: dbErr } = await from('bc_submissions')
    .select('photo_verified')
    .eq('id', submissionId)
    .single();

  if (dbErr) return err(dbErr.message);
  return ok((data?.photo_verified as boolean) ?? false);
}

// ── Verification status detail ──────────────────────────────────────

export interface VerificationStatus {
  verified: boolean;
  method: string | null;
  reports: number;
  reportsResolved: number;
}

/**
 * Detailed verification status for a submission, including report counts.
 */
export async function getVerificationStatus(
  submissionId: string,
): Promise<BestChefResult<VerificationStatus>> {
  // Fetch submission verification fields
  const { data: sub, error: subErr } = await from('bc_submissions')
    .select('photo_verified, verification_method')
    .eq('id', submissionId)
    .single();

  if (subErr) return err(subErr.message);

  // Count total reports
  const { count: totalReports, error: totalErr } = await from('bc_photo_reports')
    .select('*', { count: 'exact', head: true })
    .eq('submission_id', submissionId);

  if (totalErr) return err(totalErr.message);

  // Count resolved reports
  const { count: resolvedReports, error: resolvedErr } = await from(
    'bc_photo_reports',
  )
    .select('*', { count: 'exact', head: true })
    .eq('submission_id', submissionId)
    .in('status', ['resolved', 'dismissed']);

  if (resolvedErr) return err(resolvedErr.message);

  return ok({
    verified: (sub.photo_verified as boolean) ?? false,
    method: (sub.verification_method as string) ?? null,
    reports: totalReports ?? 0,
    reportsResolved: resolvedReports ?? 0,
  });
}

// ── Pure helpers (no DB) ────────────────────────────────────────────

export interface ExifAnalysis {
  hasOriginalExif: boolean;
  hasGpsData: boolean;
  cameraMake: string | null;
  isEdited: boolean;
  confidence: number;
}

/**
 * Analyze EXIF metadata from an image URL for authenticity signals.
 *
 * Pure function. In production this would fetch the image and parse EXIF
 * binary data. Currently returns a heuristic based on URL patterns as a
 * placeholder for real EXIF extraction.
 */
export function checkExifData(imageUrl: string): ExifAnalysis {
  // Heuristic: URLs from known camera upload services likely have EXIF
  const hasOriginalExif = !imageUrl.includes('stock') && !imageUrl.includes('generated');
  const hasGpsData = imageUrl.includes('geo') || imageUrl.includes('location');

  // Detect editing indicators in URL
  const isEdited =
    imageUrl.includes('edited') ||
    imageUrl.includes('photoshop') ||
    imageUrl.includes('filtered');

  // Extract camera make from URL pattern (placeholder)
  const cameraMatch = imageUrl.match(/camera[_-](\w+)/i);
  const cameraMake = cameraMatch ? cameraMatch[1] : null;

  // Confidence: higher when we have more authentic signals
  let confidence = 0.5;
  if (hasOriginalExif) confidence += 0.2;
  if (hasGpsData) confidence += 0.15;
  if (cameraMake) confidence += 0.1;
  if (isEdited) confidence -= 0.3;

  // Clamp
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    hasOriginalExif,
    hasGpsData,
    cameraMake,
    isEdited,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export interface AiDetectionResult {
  isLikelyAiGenerated: boolean;
  confidence: number;
  signals: string[];
}

/**
 * Stub for AI-generated image detection.
 *
 * In production, this would call a classifier model. Currently returns
 * conservative defaults indicating no AI detection was performed.
 */
export function runAiDetectionHeuristics(imageUrl: string): AiDetectionResult {
  const signals: string[] = [];

  // Basic URL-based heuristics as placeholders
  const aiKeywords = ['dalle', 'midjourney', 'stable-diffusion', 'generated', 'ai-image'];
  let isLikelyAi = false;

  for (const keyword of aiKeywords) {
    if (imageUrl.toLowerCase().includes(keyword)) {
      signals.push(`URL contains AI keyword: ${keyword}`);
      isLikelyAi = true;
    }
  }

  // Very high resolution round numbers can indicate AI
  if (imageUrl.includes('1024x1024') || imageUrl.includes('512x512')) {
    signals.push('Resolution matches common AI output dimensions');
  }

  const confidence = isLikelyAi ? 0.6 : 0.1;

  return {
    isLikelyAiGenerated: isLikelyAi,
    confidence: Math.round(confidence * 100) / 100,
    signals,
  };
}

// ── Submission row mapper (local) ───────────────────────────────────

function mapSubmission(row: Record<string, unknown>): Submission {
  return {
    id: row.id as string,
    dishId: row.dish_id as string,
    recipeSnapshotId: row.recipe_snapshot_id as string,
    profileId: row.profile_id as string,
    photoUrl: (row.photo_url as string) ?? null,
    photoVerified: (row.photo_verified as boolean) ?? false,
    photoVerifiedAt: row.photo_verified_at
      ? new Date(row.photo_verified_at as string)
      : null,
    verificationMethod:
      (row.verification_method as Submission['verificationMethod']) ?? null,
    chefLocation: (row.chef_location as string) ?? null,
    chefLocationLat: (row.chef_location_lat as number) ?? null,
    chefLocationLng: (row.chef_location_lng as number) ?? null,
    chefOrigin: (row.chef_origin as string) ?? null,
    countryCode: (row.country_code as string) ?? null,
    voteScore: (row.vote_score as number) ?? 0,
    likeCount: (row.like_count as number) ?? 0,
    rank: (row.rank as number) ?? null,
    moderationStatus:
      (row.moderation_status as Submission['moderationStatus']) ?? 'approved',
    region: (row.region as string) ?? null,
    isRestaurant: (row.is_restaurant as boolean) ?? false,
    upvoteCount: (row.upvote_count as number) ?? 0,
    downvoteCount: (row.downvote_count as number) ?? 0,
    reviewedCount: (row.reviewed_count as number) ?? 0,
    tapCount: (row.tap_count as number) ?? 0,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
