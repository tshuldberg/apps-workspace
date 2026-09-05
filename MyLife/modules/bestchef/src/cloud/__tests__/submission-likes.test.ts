import { describe, expect, it, vi } from 'vitest';
import {
  getSubmissionLikeState,
  setSubmissionLike,
} from '../submission-likes';
import type { SubmissionLikeRpcClient } from '../submission-likes';

function rpcClient(
  data: unknown,
  message: string | null = null,
): SubmissionLikeRpcClient {
  return {
    rpc: vi.fn(async () => ({
      data,
      error: message ? { message } : null,
    })),
  } as unknown as SubmissionLikeRpcClient;
}

describe('submission like cloud helpers', () => {
  it('reads like state from the cloud RPC', async () => {
    const client = rpcClient([{
      submission_id: 'submission-1',
      like_count: 12,
      liked: true,
      error_code: null,
    }]);

    await expect(getSubmissionLikeState({ submissionId: 'submission-1' }, client)).resolves.toEqual({
      ok: true,
      data: {
        submissionId: 'submission-1',
        likeCount: 12,
        liked: true,
      },
    });
    expect(client.rpc).toHaveBeenCalledWith('bc_get_submission_like_state', {
      p_submission_id: 'submission-1',
    });
  });

  it('sets the desired like state through the cloud RPC', async () => {
    const client = rpcClient({
      submission_id: 'submission-1',
      like_count: 13,
      liked: true,
      error_code: null,
    });

    await expect(setSubmissionLike({
      submissionId: 'submission-1',
      liked: true,
    }, client)).resolves.toEqual({
      ok: true,
      data: {
        submissionId: 'submission-1',
        likeCount: 13,
        liked: true,
      },
    });
    expect(client.rpc).toHaveBeenCalledWith('bc_set_submission_like', {
      p_submission_id: 'submission-1',
      p_liked: true,
    });
  });

  it('maps typed RPC errors to failed results', async () => {
    const client = rpcClient([{
      submission_id: 'missing',
      like_count: 0,
      liked: false,
      error_code: 'submission_not_found',
    }]);

    await expect(getSubmissionLikeState({ submissionId: 'missing' }, client)).resolves.toEqual({
      ok: false,
      error: 'submission_not_found',
    });
  });

  it('rejects empty submission ids before calling the network', async () => {
    const client = rpcClient(null);

    await expect(setSubmissionLike({ submissionId: '', liked: true }, client)).resolves.toEqual({
      ok: false,
      error: 'Submission id is required.',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
