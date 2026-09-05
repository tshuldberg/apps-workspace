import type { SupabaseClient } from '@supabase/supabase-js';
import { err, getBestChefClient, ok, type BestChefResult } from './client';

export interface SubmissionLikeState {
  submissionId: string;
  likeCount: number;
  liked: boolean;
}

export interface SubmissionLikeInput {
  submissionId: string;
}

export interface SetSubmissionLikeInput extends SubmissionLikeInput {
  liked: boolean;
}

type FunctionInvokeResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

export interface SubmissionLikeRpcClient {
  rpc<T>(
    fn: string,
    params: Record<string, unknown>,
  ): Promise<FunctionInvokeResult<T>>;
}

interface SubmissionLikeRpcRow {
  submission_id?: unknown;
  like_count?: unknown;
  liked?: unknown;
  error_code?: unknown;
}

function clientOrDefault(supabase?: SupabaseClient | SubmissionLikeRpcClient): SubmissionLikeRpcClient {
  return (supabase ?? getBestChefClient()) as unknown as SubmissionLikeRpcClient;
}

function firstRpcRow(data: unknown): SubmissionLikeRpcRow | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  return candidate && typeof candidate === 'object'
    ? candidate as SubmissionLikeRpcRow
    : null;
}

function normalizeSubmissionLikeState(data: unknown): BestChefResult<SubmissionLikeState> {
  const row = firstRpcRow(data);
  if (!row) return err('Submission like RPC returned no result.');

  if (typeof row.error_code === 'string' && row.error_code.length > 0) {
    return err(row.error_code);
  }

  const submissionId = typeof row.submission_id === 'string' ? row.submission_id : '';
  const rawCount = typeof row.like_count === 'number' ? row.like_count : 0;
  const liked = row.liked === true;

  if (!submissionId) return err('Submission like RPC returned no submission id.');

  return ok({
    submissionId,
    likeCount: Math.max(0, Math.trunc(rawCount)),
    liked,
  });
}

export async function getSubmissionLikeState(
  input: SubmissionLikeInput,
  supabase?: SupabaseClient | SubmissionLikeRpcClient,
): Promise<BestChefResult<SubmissionLikeState>> {
  if (!input.submissionId) return err('Submission id is required.');

  const { data, error } = await clientOrDefault(supabase).rpc<unknown>(
    'bc_get_submission_like_state',
    { p_submission_id: input.submissionId },
  );

  if (error) return err(error.message ?? 'Submission like state failed.');
  return normalizeSubmissionLikeState(data);
}

export async function setSubmissionLike(
  input: SetSubmissionLikeInput,
  supabase?: SupabaseClient | SubmissionLikeRpcClient,
): Promise<BestChefResult<SubmissionLikeState>> {
  if (!input.submissionId) return err('Submission id is required.');

  const { data, error } = await clientOrDefault(supabase).rpc<unknown>(
    'bc_set_submission_like',
    {
      p_submission_id: input.submissionId,
      p_liked: input.liked,
    },
  );

  if (error) return err(error.message ?? 'Submission like toggle failed.');
  return normalizeSubmissionLikeState(data);
}
