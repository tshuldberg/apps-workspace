import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBestChefClient } from '../cloud/client';

export const VOTE_PROOF_DRAFT_TTL_DAYS = 7;
export const VOTE_PROOF_MAX_BYTES = 2 * 1024 * 1024;
export const VOTE_PROOF_DRAIN_STATES = ['draft', 'uploading', 'committing'] as const;

export type VoteProofTier = 'gold' | 'silver' | 'bronze' | 'like';
export type LocalVoteProofState =
  | 'draft'
  | 'uploading'
  | 'committing'
  | 'committed'
  | 'failed'
  | 'expired';

export type CastVoteProofErrorCode =
  | 'unauthenticated'
  | 'profile_not_found'
  | 'submission_not_found'
  | 'invalid_tier'
  | 'invalid_proof_asset'
  | 'cannot_vote_on_own'
  | 'vote_already_exists'
  | 'proof_duplicate'
  | 'rate_limited'
  | 'recast_cooldown'
  | 'network'
  | 'unknown';

export interface PreparedVoteProof {
  compressedUri: string;
  contentHash: string;
  byteSize: number;
}

export interface PrepareProofDeps {
  readFileBytes?: (uri: string) => Promise<Uint8Array>;
  processImage?: (input: {
    uri: string;
    bytes: Uint8Array;
    maxBytes: number;
  }) => Promise<{ uri: string; bytes: Uint8Array }>;
  hashBytes?: (bytes: Uint8Array) => Promise<string>;
}

export interface LocalVoteProofDraft {
  id: string;
  submissionId: string;
  tier: VoteProofTier;
  localImageUri: string;
  contentHash: string;
  state: LocalVoteProofState;
  failureReason: string | null;
  /** Set once the upload leg finalizes; retries skip straight to the cast leg. */
  mediaAssetId: string | null;
  verdict: ReviewVerdict | null;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface CreateLocalVoteProofDraftInput {
  id?: string;
  submissionId: string;
  tier: VoteProofTier;
  localImageUri: string;
  contentHash: string;
  verdict?: ReviewVerdict;
  rating?: number;
  notes?: string;
  createdAt?: string;
  expiresAt?: string;
}

export type ReviewVerdict = 'liked' | 'loved' | 'mixed' | 'disliked';

export interface CastVoteWithProofInput {
  submissionId: string;
  tier: VoteProofTier;
  contentHash: string;
  mediaAssetId: string;
  supabase?: SupabaseClient | VoteProofRpcClient;
  /** Optional reviewed-vote fields -- persisted when present. */
  verdict?: ReviewVerdict;
  rating?: number;
  notes?: string;
}

export interface DeleteVoteWithProofInput {
  submissionId: string;
  supabase?: SupabaseClient | VoteProofRpcClient;
}

export type CastVoteWithProofResult =
  | {
      ok: true;
      voteId: string;
      proofId: string;
      status: 'pending';
    }
  | {
      ok: false;
      code: CastVoteProofErrorCode;
      message: string;
      retryable: boolean;
    };

export type DeleteVoteWithProofResult =
  | { ok: true }
  | { ok: false; message: string; retryable: boolean };

export type VoteProofUploadResult =
  | { ok: true; mediaAssetId: string }
  | { ok: false; error: string; retryable: boolean };

export interface DrainPendingProofsDeps {
  now?: () => Date | string;
  uploadProof: (draft: LocalVoteProofDraft) => Promise<VoteProofUploadResult>;
  castVote?: (input: {
    submissionId: string;
    tier: VoteProofTier;
    contentHash: string;
    mediaAssetId: string;
    verdict?: ReviewVerdict;
    rating?: number;
    notes?: string;
  }) => Promise<CastVoteWithProofResult>;
  stopOnFailure?: boolean;
}

export interface DrainPendingProofsResult {
  processed: number;
  committed: number;
  failed: number;
  expired: number;
  stoppedOnFailure: boolean;
}

type VoteProofRpcRow = {
  vote_id?: unknown;
  proof_id?: unknown;
  status?: unknown;
  error_code?: unknown;
};

export interface VoteProofRpcClient {
  rpc<T>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: { message?: string } | null }>;
}

interface LocalVoteProofRow {
  id: string;
  submission_id: string;
  tier: string;
  local_image_uri: string;
  content_hash: string;
  state: string;
  failure_reason: string | null;
  media_asset_id: string | null;
  verdict: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// tap_up and tap_down are explicitly excluded -- tap votes carry no proof.
function isVoteProofTier(value: string): value is VoteProofTier {
  return value === 'gold' || value === 'silver' || value === 'bronze' || value === 'like';
}

function isReviewVerdict(value: string): value is ReviewVerdict {
  return value === 'liked' || value === 'loved' || value === 'mixed' || value === 'disliked';
}

function isLocalVoteProofState(value: string): value is LocalVoteProofState {
  return value === 'draft' ||
    value === 'uploading' ||
    value === 'committing' ||
    value === 'committed' ||
    value === 'failed' ||
    value === 'expired';
}

function mapRow(row: LocalVoteProofRow): LocalVoteProofDraft {
  const tier = isVoteProofTier(row.tier) ? row.tier : 'like';
  const state = isLocalVoteProofState(row.state) ? row.state : 'failed';
  return {
    id: row.id,
    submissionId: row.submission_id,
    tier,
    localImageUri: row.local_image_uri,
    contentHash: row.content_hash,
    state,
    failureReason: row.failure_reason,
    mediaAssetId: row.media_asset_id ?? null,
    verdict: row.verdict && isReviewVerdict(row.verdict) ? row.verdict : null,
    rating: typeof row.rating === 'number' && Number.isFinite(row.rating) ? row.rating : null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function nowIso(now: Date | string = new Date()): string {
  return now instanceof Date ? now.toISOString() : now;
}

function defaultId(): string {
  const maybeCrypto = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  };
  return maybeCrypto.crypto?.randomUUID?.() ?? `vote-proof-${Date.now()}`;
}

async function defaultReadFileBytes(uri: string): Promise<Uint8Array> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Unable to read vote proof image: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);
}

function pushRange(target: number[], bytes: Uint8Array, start: number, end: number): void {
  for (let i = start; i < end; i += 1) target.push(bytes[i]);
}

export function stripJpegExifSegments(bytes: Uint8Array): Uint8Array {
  if (!isJpeg(bytes)) return bytes;

  const output: number[] = [0xff, 0xd8];
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff || offset + 1 >= bytes.length) {
      pushRange(output, bytes, offset, bytes.length);
      break;
    }

    const marker = bytes[offset + 1];
    if (isStandaloneJpegMarker(marker)) {
      pushRange(output, bytes, offset, Math.min(offset + 2, bytes.length));
      offset += 2;
      continue;
    }

    if (offset + 3 >= bytes.length) {
      pushRange(output, bytes, offset, bytes.length);
      break;
    }

    const segmentLength = (bytes[offset + 2] << 8) + bytes[offset + 3];
    const segmentEnd = offset + 2 + segmentLength;
    if (segmentLength < 2 || segmentEnd > bytes.length) {
      pushRange(output, bytes, offset, bytes.length);
      break;
    }

    if (marker !== 0xe1) {
      pushRange(output, bytes, offset, segmentEnd);
    }

    offset = segmentEnd;
  }

  return new Uint8Array(output);
}

async function defaultHashBytes(bytes: Uint8Array): Promise<string> {
  const maybeCrypto = globalThis as typeof globalThis & {
    crypto?: { subtle?: { digest: (algorithm: string, data: ArrayBuffer) => Promise<ArrayBuffer> } };
  };
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = await maybeCrypto.crypto?.subtle?.digest('SHA-256', digestInput.buffer as ArrayBuffer);
  if (!digest) {
    throw new Error('SHA-256 is unavailable in this runtime.');
  }
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function prepareProof(
  uri: string,
  deps: PrepareProofDeps = {},
): Promise<PreparedVoteProof> {
  const sourceBytes = await (deps.readFileBytes ?? defaultReadFileBytes)(uri);
  const processed = deps.processImage
    ? await deps.processImage({ uri, bytes: sourceBytes, maxBytes: VOTE_PROOF_MAX_BYTES })
    : { uri, bytes: stripJpegExifSegments(sourceBytes) };

  if (processed.bytes.byteLength > VOTE_PROOF_MAX_BYTES) {
    throw new Error(`Vote proof exceeds the ${VOTE_PROOF_MAX_BYTES} byte limit.`);
  }

  return {
    compressedUri: processed.uri,
    contentHash: await (deps.hashBytes ?? defaultHashBytes)(processed.bytes),
    byteSize: processed.bytes.byteLength,
  };
}

export function createLocalVoteProofDraft(
  db: DatabaseAdapter,
  input: CreateLocalVoteProofDraftInput,
): LocalVoteProofDraft {
  if (!isVoteProofTier(input.tier)) {
    throw new Error(`Unsupported vote proof tier: ${input.tier}`);
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  const expiresAt = input.expiresAt ?? addDays(new Date(createdAt), VOTE_PROOF_DRAFT_TTL_DAYS).toISOString();
  const draft: LocalVoteProofDraft = {
    id: input.id ?? defaultId(),
    submissionId: input.submissionId,
    tier: input.tier,
    localImageUri: input.localImageUri,
    contentHash: input.contentHash,
    state: 'draft',
    failureReason: null,
    mediaAssetId: null,
    verdict: input.verdict ?? null,
    rating: input.rating ?? null,
    notes: input.notes ?? null,
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  };

  db.execute(
    `INSERT INTO rc_local_vote_proofs (
      id,
      submission_id,
      tier,
      local_image_uri,
      content_hash,
      state,
      failure_reason,
      media_asset_id,
      verdict,
      rating,
      notes,
      created_at,
      updated_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id,
      draft.submissionId,
      draft.tier,
      draft.localImageUri,
      draft.contentHash,
      draft.state,
      draft.failureReason,
      draft.mediaAssetId,
      draft.verdict,
      draft.rating,
      draft.notes,
      draft.createdAt,
      draft.updatedAt,
      draft.expiresAt,
    ],
  );

  return draft;
}

export function getLocalVoteProofDraft(
  db: DatabaseAdapter,
  id: string,
): LocalVoteProofDraft | null {
  const row = db.query<LocalVoteProofRow>(
    `SELECT * FROM rc_local_vote_proofs WHERE id = ? LIMIT 1`,
    [id],
  )[0];
  return row ? mapRow(row) : null;
}

export function listPendingVoteProofDrafts(db: DatabaseAdapter): LocalVoteProofDraft[] {
  return db.query<LocalVoteProofRow>(
    `SELECT * FROM rc_local_vote_proofs
     WHERE state IN ('draft', 'uploading', 'committing')
     ORDER BY created_at ASC`,
  ).map(mapRow);
}

export function updateLocalVoteProofState(
  db: DatabaseAdapter,
  id: string,
  state: LocalVoteProofState,
  failureReason: string | null = null,
  updatedAt: Date | string = new Date(),
): void {
  db.execute(
    `UPDATE rc_local_vote_proofs
     SET state = ?, failure_reason = ?, updated_at = ?
     WHERE id = ?`,
    [state, failureReason, nowIso(updatedAt), id],
  );
}

function setLocalVoteProofMediaAsset(
  db: DatabaseAdapter,
  id: string,
  mediaAssetId: string | null,
  updatedAt: Date | string = new Date(),
): void {
  db.execute(
    `UPDATE rc_local_vote_proofs
     SET media_asset_id = ?, updated_at = ?
     WHERE id = ?`,
    [mediaAssetId, nowIso(updatedAt), id],
  );
}

function rpcClient(supabase?: SupabaseClient | VoteProofRpcClient): VoteProofRpcClient {
  return (supabase ?? getBestChefClient()) as unknown as VoteProofRpcClient;
}

function mapRpcErrorCode(value: unknown): CastVoteProofErrorCode {
  if (typeof value !== 'string') return 'unknown';
  if (
    value === 'unauthenticated' ||
    value === 'profile_not_found' ||
    value === 'submission_not_found' ||
    value === 'invalid_tier' ||
    value === 'invalid_proof_asset' ||
    value === 'cannot_vote_on_own' ||
    value === 'vote_already_exists' ||
    value === 'proof_duplicate' ||
    value === 'rate_limited' ||
    value === 'recast_cooldown'
  ) {
    return value;
  }
  return 'unknown';
}

export function describeVoteProofError(code: CastVoteProofErrorCode): { message: string; retryable: boolean } {
  switch (code) {
    case 'unauthenticated':
      return { message: 'Sign in before voting.', retryable: false };
    case 'profile_not_found':
      return { message: 'Create a BestChef profile before voting.', retryable: false };
    case 'submission_not_found':
      return { message: 'This recipe submission is no longer available.', retryable: false };
    case 'invalid_tier':
      return { message: 'Choose a valid vote tier.', retryable: false };
    case 'invalid_proof_asset':
      return { message: 'Upload a valid proof photo before voting.', retryable: false };
    case 'cannot_vote_on_own':
      return { message: 'You cannot vote on your own submission.', retryable: false };
    case 'vote_already_exists':
      return { message: 'You already voted on this submission.', retryable: false };
    case 'proof_duplicate':
      return { message: 'Use a new proof photo for this submission.', retryable: false };
    case 'rate_limited':
      return { message: 'You are doing that too quickly. Try again later.', retryable: false };
    case 'recast_cooldown':
      return { message: 'You removed your vote on this recipe recently. You can vote again in 24 hours.', retryable: false };
    case 'network':
      return { message: 'Network connection failed. The vote will retry.', retryable: true };
    case 'unknown':
      return { message: 'Vote proof could not be committed.', retryable: true };
  }
}

function firstRpcRow(data: VoteProofRpcRow | VoteProofRpcRow[] | null): VoteProofRpcRow | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function castVoteWithProof(
  input: CastVoteWithProofInput,
): Promise<CastVoteWithProofResult> {
  if (!isVoteProofTier(input.tier)) {
    const details = describeVoteProofError('invalid_tier');
    return { ok: false, code: 'invalid_tier', ...details };
  }
  if (!input.contentHash || !input.mediaAssetId) {
    const details = describeVoteProofError('invalid_proof_asset');
    return { ok: false, code: 'invalid_proof_asset', ...details };
  }

  try {
    const rpcArgs: Record<string, unknown> = {
      p_submission_id: input.submissionId,
      p_tier: input.tier,
      p_media_asset_id: input.mediaAssetId,
    };
    if (input.verdict !== undefined) rpcArgs['p_verdict'] = input.verdict;
    if (input.rating !== undefined) rpcArgs['p_rating'] = input.rating;
    if (input.notes !== undefined) rpcArgs['p_notes'] = input.notes;

    const { data, error } = await rpcClient(input.supabase).rpc<VoteProofRpcRow | VoteProofRpcRow[]>(
      'bc_cast_vote',
      rpcArgs,
    );

    if (error) {
      const details = describeVoteProofError('network');
      return {
        ok: false,
        code: 'network',
        message: error.message ?? details.message,
        retryable: details.retryable,
      };
    }

    const row = firstRpcRow(data);
    const errorCode = mapRpcErrorCode(row?.error_code);
    if (errorCode !== 'unknown' || row?.error_code) {
      const details = describeVoteProofError(errorCode);
      return { ok: false, code: errorCode, ...details };
    }

    const voteId = stringValue(row?.vote_id);
    const proofId = stringValue(row?.proof_id);
    if (!voteId || !proofId) {
      const details = describeVoteProofError('unknown');
      return { ok: false, code: 'unknown', ...details };
    }

    return {
      ok: true,
      voteId,
      proofId,
      status: 'pending',
    };
  } catch {
    const details = describeVoteProofError('network');
    return { ok: false, code: 'network', ...details };
  }
}

export async function deleteVoteWithProof(
  input: DeleteVoteWithProofInput,
): Promise<DeleteVoteWithProofResult> {
  if (!input.submissionId) {
    return {
      ok: false,
      message: 'Submission id is required.',
      retryable: false,
    };
  }

  try {
    const { error } = await rpcClient(input.supabase).rpc<null>(
      'bc_delete_vote',
      { p_submission_id: input.submissionId },
    );

    if (error) {
      // bc_delete_vote raises machine codes; map the durable throttle (plan 33
      // Phase 1.2) to a human message instead of leaking the raw code.
      if ((error.message ?? '').includes('vote_delete_rate_limited')) {
        return {
          ok: false,
          message: 'You have removed several votes today. Try again tomorrow.',
          retryable: false,
        };
      }
      return {
        ok: false,
        message: error.message ?? 'Unable to delete this CookProof vote.',
        retryable: true,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'Network connection failed. Try deleting again when you are online.',
      retryable: true,
    };
  }
}

function isExpired(draft: LocalVoteProofDraft, now: Date): boolean {
  return new Date(draft.expiresAt).getTime() <= now.getTime();
}

export async function drainPendingProofs(
  db: DatabaseAdapter,
  deps: DrainPendingProofsDeps,
): Promise<DrainPendingProofsResult> {
  const nowValue = deps.now?.() ?? new Date();
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const result: DrainPendingProofsResult = {
    processed: 0,
    committed: 0,
    failed: 0,
    expired: 0,
    stoppedOnFailure: false,
  };

  for (const draft of listPendingVoteProofDrafts(db)) {
    result.processed += 1;

    if (isExpired(draft, now)) {
      updateLocalVoteProofState(db, draft.id, 'expired', null, now);
      result.expired += 1;
      continue;
    }

    // A stored media_asset_id means a previous pass already finalized the
    // upload; skip straight to the cast leg instead of orphaning a fresh
    // asset (and burning upload quota) on every retry.
    const reusedStoredAsset = !!draft.mediaAssetId;
    let mediaAssetId = draft.mediaAssetId;
    if (!mediaAssetId) {
      updateLocalVoteProofState(db, draft.id, 'uploading', null, now);
      const upload = await deps.uploadProof(draft);
      if (!upload.ok) {
        updateLocalVoteProofState(
          db,
          draft.id,
          upload.retryable ? 'draft' : 'failed',
          upload.error,
          now,
        );
        result.failed += 1;
        if (deps.stopOnFailure !== false) {
          result.stoppedOnFailure = true;
          break;
        }
        continue;
      }
      mediaAssetId = upload.mediaAssetId;
      setLocalVoteProofMediaAsset(db, draft.id, mediaAssetId, now);
    }

    updateLocalVoteProofState(db, draft.id, 'committing', null, now);
    const cast = await (deps.castVote ?? castVoteWithProof)({
      submissionId: draft.submissionId,
      tier: draft.tier,
      contentHash: draft.contentHash,
      mediaAssetId,
      ...(draft.verdict ? { verdict: draft.verdict } : {}),
      ...(draft.rating != null ? { rating: draft.rating } : {}),
      ...(draft.notes ? { notes: draft.notes } : {}),
    });

    if (cast.ok) {
      updateLocalVoteProofState(db, draft.id, 'committed', null, now);
      result.committed += 1;
      continue;
    }

    if (!cast.ok && cast.code === 'invalid_proof_asset' && reusedStoredAsset) {
      // The stored asset went away server-side (e.g. moderation removal).
      // Clear it and retry the full upload on the next pass.
      setLocalVoteProofMediaAsset(db, draft.id, null, now);
      updateLocalVoteProofState(db, draft.id, 'draft', cast.code, now);
      result.failed += 1;
      if (deps.stopOnFailure !== false) {
        result.stoppedOnFailure = true;
        break;
      }
      continue;
    }

    updateLocalVoteProofState(
      db,
      draft.id,
      cast.retryable ? 'committing' : 'failed',
      cast.code,
      now,
    );
    result.failed += 1;
    if (deps.stopOnFailure !== false) {
      result.stoppedOnFailure = true;
      break;
    }
  }

  return result;
}
