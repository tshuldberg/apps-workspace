import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../definition';
import {
  castVoteWithProof,
  createLocalVoteProofDraft,
  deleteVoteWithProof,
  describeVoteProofError,
  drainPendingProofs,
  getLocalVoteProofDraft,
  prepareProof,
  stripJpegExifSegments,
  type CastVoteWithProofResult,
  type VoteProofRpcClient,
  type VoteProofUploadResult,
} from '../social/vote-proof';
import {
  completeVoteProofUpload,
  createVoteProofMediaAsset,
  VOTE_PROOF_MAX_BYTES,
} from '../cloud/vote-proof';

const NOW = '2026-04-27T12:00:00.000Z';

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function fakeJpegWithExif(): Uint8Array {
  return bytes([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0xff, 0xda, 0x00, 0x04, 0x00, 0x00,
    0x01, 0x02, 0xff, 0xd9,
  ]);
}

function fakeRpc(row: Record<string, unknown>, captured?: Record<string, unknown>[]): VoteProofRpcClient {
  return {
    rpc: async <T,>(_fn: string, args: Record<string, unknown>) => {
      captured?.push(args);
      return { data: [row] as T, error: null };
    },
  };
}

function fakeRpcError(message = 'network down'): VoteProofRpcClient {
  return {
    async rpc() {
      return { data: null, error: { message } };
    },
  };
}

class FakeFunctionClient {
  calls: Array<{ fn: string; body: Record<string, unknown> }> = [];

  constructor(private readonly responses: Record<string, Record<string, unknown>>) {}

  functions = {
    invoke: async <T,>(fn: string, options: { body: Record<string, unknown> }) => {
      this.calls.push({ fn, body: options.body });
      return {
        data: (this.responses[fn] ?? null) as T | null,
        error: null,
      };
    },
  };
}

describe('BestChef vote proof helpers', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('creates the local vote proof draft table in schema v18', () => {
    const rows = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name = 'rc_local_vote_proofs'`,
    );
    const indexRows = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'index' AND name = 'rc_local_vote_proofs_submission_idx'`,
    );

    expect(rows.map((row) => row.name)).toEqual(['rc_local_vote_proofs']);
    expect(indexRows.map((row) => row.name)).toEqual(['rc_local_vote_proofs_submission_idx']);
    expect(RECIPES_MODULE.schemaVersion).toBe(34);
  });

  it('strips JPEG EXIF segments before hashing', async () => {
    const source = fakeJpegWithExif();
    const stripped = stripJpegExifSegments(source);

    expect(stripped.byteLength).toBeLessThan(source.byteLength);
    expect([...stripped]).not.toEqual(expect.arrayContaining([0xe1, 0x45, 0x78, 0x69, 0x66]));

    const prepared = await prepareProof('file:///proof.jpg', {
      readFileBytes: async () => source,
    });
    const preparedAgain = await prepareProof('file:///proof.jpg', {
      readFileBytes: async () => source,
    });

    expect(prepared.compressedUri).toBe('file:///proof.jpg');
    expect(prepared.byteSize).toBe(stripped.byteLength);
    expect(prepared.contentHash).toBe(preparedAgain.contentHash);
  });

  it('allows a platform image processor to produce deterministic compressed bytes', async () => {
    const compressed = bytes([1, 2, 3, 4]);
    const first = await prepareProof('file:///raw.heic', {
      readFileBytes: async () => bytes([9, 9, 9]),
      processImage: async () => ({ uri: 'file:///compressed.jpg', bytes: compressed }),
    });
    const second = await prepareProof('file:///raw.heic', {
      readFileBytes: async () => bytes([9, 9, 9]),
      processImage: async () => ({ uri: 'file:///compressed.jpg', bytes: compressed }),
    });

    expect(first).toMatchObject({
      compressedUri: 'file:///compressed.jpg',
      byteSize: 4,
    });
    expect(first.contentHash).toBe(second.contentHash);
  });

  it('rejects processed proof bytes above the 2 MB cap', async () => {
    await expect(prepareProof('file:///huge.jpg', {
      readFileBytes: async () => new Uint8Array(VOTE_PROOF_MAX_BYTES + 1),
    })).rejects.toThrow('Vote proof exceeds');
  });

  it('persists local drafts with a seven-day TTL and state updates', () => {
    const draft = createLocalVoteProofDraft(db, {
      id: 'draft-1',
      submissionId: 'submission-1',
      tier: 'gold',
      localImageUri: 'file:///proof.jpg',
      contentHash: 'hash-1',
      createdAt: NOW,
    });

    expect(draft.expiresAt).toBe('2026-05-04T12:00:00.000Z');
    expect(getLocalVoteProofDraft(db, 'draft-1')).toMatchObject({
      state: 'draft',
      contentHash: 'hash-1',
    });
  });

  it('drains a pending draft through upload and vote commit', async () => {
    createLocalVoteProofDraft(db, {
      id: 'draft-1',
      submissionId: 'submission-1',
      tier: 'silver',
      localImageUri: 'file:///proof.jpg',
      contentHash: 'hash-1',
      createdAt: NOW,
    });

    const result = await drainPendingProofs(db, {
      now: () => NOW,
      uploadProof: async () => ({ ok: true, mediaAssetId: 'asset-1' }),
      castVote: async () => ({ ok: true, voteId: 'vote-1', proofId: 'proof-1', status: 'pending' }),
    });

    expect(result).toEqual({
      processed: 1,
      committed: 1,
      failed: 0,
      expired: 0,
      stoppedOnFailure: false,
    });
    expect(getLocalVoteProofDraft(db, 'draft-1')?.state).toBe('committed');
  });

  it('expires drafts older than their TTL without uploading', async () => {
    let uploads = 0;
    createLocalVoteProofDraft(db, {
      id: 'draft-1',
      submissionId: 'submission-1',
      tier: 'bronze',
      localImageUri: 'file:///proof.jpg',
      contentHash: 'hash-1',
      createdAt: '2026-04-01T12:00:00.000Z',
      expiresAt: '2026-04-08T12:00:00.000Z',
    });

    const result = await drainPendingProofs(db, {
      now: () => NOW,
      uploadProof: async () => {
        uploads += 1;
        return { ok: true, mediaAssetId: 'asset-1' };
      },
    });

    expect(uploads).toBe(0);
    expect(result.expired).toBe(1);
    expect(getLocalVoteProofDraft(db, 'draft-1')?.state).toBe('expired');
  });

  it('keeps retryable upload failures in draft state and stops the drain', async () => {
    createLocalVoteProofDraft(db, {
      id: 'draft-1',
      submissionId: 'submission-1',
      tier: 'like',
      localImageUri: 'file:///proof.jpg',
      contentHash: 'hash-1',
      createdAt: NOW,
    });
    createLocalVoteProofDraft(db, {
      id: 'draft-2',
      submissionId: 'submission-2',
      tier: 'gold',
      localImageUri: 'file:///proof-2.jpg',
      contentHash: 'hash-2',
      createdAt: NOW,
    });

    const result = await drainPendingProofs(db, {
      now: () => NOW,
      uploadProof: async () => ({ ok: false, error: 'offline', retryable: true }),
    });

    expect(result).toMatchObject({ processed: 1, failed: 1, stoppedOnFailure: true });
    expect(getLocalVoteProofDraft(db, 'draft-1')).toMatchObject({
      state: 'draft',
      failureReason: 'offline',
    });
    expect(getLocalVoteProofDraft(db, 'draft-2')?.state).toBe('draft');
  });

  it('marks nonretryable RPC failures as failed', async () => {
    createLocalVoteProofDraft(db, {
      id: 'draft-1',
      submissionId: 'submission-1',
      tier: 'gold',
      localImageUri: 'file:///proof.jpg',
      contentHash: 'hash-1',
      createdAt: NOW,
    });

    const result = await drainPendingProofs(db, {
      now: () => NOW,
      uploadProof: async () => ({ ok: true, mediaAssetId: 'asset-1' }),
      castVote: async (): Promise<CastVoteWithProofResult> => ({
        ok: false,
        code: 'proof_duplicate',
        message: 'Use a new proof photo for this submission.',
        retryable: false,
      }),
    });

    expect(result).toMatchObject({ failed: 1, stoppedOnFailure: true });
    expect(getLocalVoteProofDraft(db, 'draft-1')).toMatchObject({
      state: 'failed',
      failureReason: 'proof_duplicate',
    });
  });

  it('persists the finalized media asset id and skips re-upload on retry', async () => {
    createLocalVoteProofDraft(db, {
      id: 'draft-1',
      submissionId: 'submission-1',
      tier: 'gold',
      localImageUri: 'file:///proof.jpg',
      contentHash: 'hash-1',
      createdAt: NOW,
    });

    let uploads = 0;
    const deps = {
      now: () => NOW,
      uploadProof: async (): Promise<VoteProofUploadResult> => {
        uploads += 1;
        return { ok: true, mediaAssetId: 'asset-1' };
      },
    };

    // First pass: upload finalizes, cast fails retryably (network at the RPC leg).
    await drainPendingProofs(db, {
      ...deps,
      castVote: async (): Promise<CastVoteWithProofResult> => ({
        ok: false,
        code: 'network',
        message: 'Network connection failed. The vote will retry.',
        retryable: true,
      }),
    });
    expect(uploads).toBe(1);
    expect(getLocalVoteProofDraft(db, 'draft-1')).toMatchObject({
      state: 'committing',
      mediaAssetId: 'asset-1',
    });

    // Second pass: no new upload, cast succeeds with the stored asset.
    let castAssetId: string | null = null;
    await drainPendingProofs(db, {
      ...deps,
      castVote: async (input): Promise<CastVoteWithProofResult> => {
        castAssetId = input.mediaAssetId;
        return { ok: true, voteId: 'vote-1', proofId: 'proof-1', status: 'pending' };
      },
    });
    expect(uploads).toBe(1);
    expect(castAssetId).toBe('asset-1');
    expect(getLocalVoteProofDraft(db, 'draft-1')?.state).toBe('committed');
  });

  it('clears a stored media asset the server no longer accepts and retries the upload', async () => {
    createLocalVoteProofDraft(db, {
      id: 'draft-1',
      submissionId: 'submission-1',
      tier: 'gold',
      localImageUri: 'file:///proof.jpg',
      contentHash: 'hash-1',
      createdAt: NOW,
    });

    await drainPendingProofs(db, {
      now: () => NOW,
      uploadProof: async () => ({ ok: true, mediaAssetId: 'asset-1' }),
      castVote: async (): Promise<CastVoteWithProofResult> => ({
        ok: false,
        code: 'network',
        message: 'Network connection failed. The vote will retry.',
        retryable: true,
      }),
    });
    expect(getLocalVoteProofDraft(db, 'draft-1')?.mediaAssetId).toBe('asset-1');

    await drainPendingProofs(db, {
      now: () => NOW,
      uploadProof: async () => ({ ok: true, mediaAssetId: 'asset-2' }),
      castVote: async (): Promise<CastVoteWithProofResult> => ({
        ok: false,
        code: 'invalid_proof_asset',
        message: 'Upload a valid proof photo before voting.',
        retryable: false,
      }),
    });
    expect(getLocalVoteProofDraft(db, 'draft-1')).toMatchObject({
      state: 'draft',
      mediaAssetId: null,
      failureReason: 'invalid_proof_asset',
    });
  });

  it('threads the stored review payload through the cast leg', async () => {
    createLocalVoteProofDraft(db, {
      id: 'draft-1',
      submissionId: 'submission-1',
      tier: 'gold',
      localImageUri: 'file:///proof.jpg',
      contentHash: 'hash-1',
      verdict: 'loved',
      rating: 4,
      notes: 'Crispy edges, perfect crumb.',
      createdAt: NOW,
    });

    let castInput: Record<string, unknown> | null = null;
    await drainPendingProofs(db, {
      now: () => NOW,
      uploadProof: async () => ({ ok: true, mediaAssetId: 'asset-1' }),
      castVote: async (input): Promise<CastVoteWithProofResult> => {
        castInput = { ...input };
        return { ok: true, voteId: 'vote-1', proofId: 'proof-1', status: 'pending' };
      },
    });

    expect(castInput).toMatchObject({
      submissionId: 'submission-1',
      verdict: 'loved',
      rating: 4,
      notes: 'Crispy edges, perfect crumb.',
    });
  });

  it('maps bc_cast_vote success and reject rows to typed results', async () => {
    const captured: Record<string, unknown>[] = [];
    const success = await castVoteWithProof({
      submissionId: 'submission-1',
      tier: 'gold',
      contentHash: 'hash-1',
      mediaAssetId: 'asset-1',
      supabase: fakeRpc({ vote_id: 'vote-1', proof_id: 'proof-1', status: 'pending', error_code: null }, captured),
    });
    const duplicate = await castVoteWithProof({
      submissionId: 'submission-1',
      tier: 'gold',
      contentHash: 'hash-1',
      mediaAssetId: 'asset-1',
      supabase: fakeRpc({ vote_id: null, proof_id: null, status: null, error_code: 'proof_duplicate' }),
    });
    const network = await castVoteWithProof({
      submissionId: 'submission-1',
      tier: 'like',
      contentHash: 'hash-1',
      mediaAssetId: 'asset-1',
      supabase: fakeRpcError(),
    });

    expect(success).toEqual({ ok: true, voteId: 'vote-1', proofId: 'proof-1', status: 'pending' });
    expect(captured[0]).toEqual({
      p_submission_id: 'submission-1',
      p_tier: 'gold',
      p_media_asset_id: 'asset-1',
    });
    expect(duplicate).toMatchObject({ ok: false, code: 'proof_duplicate', retryable: false });
    expect(network).toMatchObject({ ok: false, code: 'network', retryable: true });
    expect(describeVoteProofError('cannot_vote_on_own').retryable).toBe(false);
  });

  it('maps the durable integrity error codes (plan 33 Phase 1.2)', async () => {
    const rateLimited = await castVoteWithProof({
      submissionId: 'submission-1',
      tier: 'gold',
      contentHash: 'hash-1',
      mediaAssetId: 'asset-1',
      supabase: fakeRpc({ vote_id: null, proof_id: null, status: null, error_code: 'rate_limited' }),
    });
    const cooldown = await castVoteWithProof({
      submissionId: 'submission-1',
      tier: 'gold',
      contentHash: 'hash-1',
      mediaAssetId: 'asset-1',
      supabase: fakeRpc({ vote_id: null, proof_id: null, status: null, error_code: 'recast_cooldown' }),
    });

    // Neither should auto-retry: retrying immediately cannot succeed.
    expect(rateLimited).toMatchObject({ ok: false, code: 'rate_limited', retryable: false });
    expect(cooldown).toMatchObject({ ok: false, code: 'recast_cooldown', retryable: false });

    // The delete throttle raise maps to a human message, not the raw code.
    const throttled = await deleteVoteWithProof({
      submissionId: 'submission-1',
      supabase: fakeRpcError('vote_delete_rate_limited'),
    });
    expect(throttled).toMatchObject({
      ok: false,
      retryable: false,
      message: 'You have removed several votes today. Try again tomorrow.',
    });
  });

  it('castVoteWithProof passes verdict, rating, and notes when provided', async () => {
    const captured: Record<string, unknown>[] = [];
    const result = await castVoteWithProof({
      submissionId: 'submission-1',
      tier: 'gold',
      contentHash: 'hash-1',
      mediaAssetId: 'asset-1',
      verdict: 'liked',
      rating: 4,
      notes: 'great crust, perfect umami',
      supabase: fakeRpc({ vote_id: 'vote-1', proof_id: 'proof-1', status: 'pending', error_code: null }, captured),
    });

    expect(result).toEqual({ ok: true, voteId: 'vote-1', proofId: 'proof-1', status: 'pending' });
    expect(captured[0]).toMatchObject({
      p_submission_id: 'submission-1',
      p_tier: 'gold',
      p_media_asset_id: 'asset-1',
      p_verdict: 'liked',
      p_rating: 4,
      p_notes: 'great crust, perfect umami',
    });
  });

  it('castVoteWithProof still works without verdict, rating, or notes (backward compat)', async () => {
    const captured: Record<string, unknown>[] = [];
    const result = await castVoteWithProof({
      submissionId: 'submission-2',
      tier: 'silver',
      contentHash: 'hash-2',
      mediaAssetId: 'asset-2',
      supabase: fakeRpc({ vote_id: 'vote-2', proof_id: 'proof-2', status: 'pending', error_code: null }, captured),
    });

    expect(result).toEqual({ ok: true, voteId: 'vote-2', proofId: 'proof-2', status: 'pending' });
    // verdict/rating/notes should NOT be in the RPC args when not provided
    expect(captured[0]).not.toHaveProperty('p_verdict');
    expect(captured[0]).not.toHaveProperty('p_rating');
    expect(captured[0]).not.toHaveProperty('p_notes');
  });

  it('wraps bc_delete_vote for user-owned proof deletion', async () => {
    const captured: Record<string, unknown>[] = [];
    const deleted = await deleteVoteWithProof({
      submissionId: 'submission-1',
      supabase: {
        rpc: async <T,>(_fn: string, args: Record<string, unknown>) => {
          captured.push(args);
          return { data: null as T, error: null };
        },
      },
    });
    const failed = await deleteVoteWithProof({
      submissionId: 'submission-1',
      supabase: fakeRpcError('delete failed'),
    });

    expect(deleted).toEqual({ ok: true });
    expect(captured[0]).toEqual({ p_submission_id: 'submission-1' });
    expect(failed).toMatchObject({ ok: false, message: 'delete failed', retryable: true });
  });

  it('wraps signed upload and finalize Edge Functions for vote proof media', async () => {
    const client = new FakeFunctionClient({
      'bestchef-media-upload': {
        ok: true,
        assetId: 'asset-1',
        bucket: 'bestchef-submission-images',
        key: 'user/vote_proof/submission-1/upload.jpg',
        signedUploadUrl: 'https://storage.example/upload',
        token: 'token-1',
        maxBytes: VOTE_PROOF_MAX_BYTES,
        uploadStatus: 'pending',
        moderationStatus: 'pending',
      },
      'bestchef-media-finalize': {
        ok: true,
        assetId: 'asset-1',
        uploadStatus: 'uploaded',
        moderationStatus: 'pending',
        visibility: 'private',
      },
    });

    const upload = await createVoteProofMediaAsset({
      submissionId: 'submission-1',
      contentHash: 'hash-1',
      byteSize: 1024,
    }, client);
    const finalized = await completeVoteProofUpload({
      assetId: 'asset-1',
      contentHash: 'hash-1',
      byteSize: 1024,
      width: 1200,
      height: 900,
    }, client);

    expect(upload).toMatchObject({
      ok: true,
      data: {
        assetId: 'asset-1',
        signedUploadUrl: 'https://storage.example/upload',
      },
    });
    expect(finalized).toMatchObject({
      ok: true,
      data: {
        assetId: 'asset-1',
        uploadStatus: 'uploaded',
        visibility: 'private',
      },
    });
    expect(client.calls[0]).toEqual({
      fn: 'bestchef-media-upload',
      body: {
        ownerKind: 'vote_proof',
        ownerId: 'submission-1',
        mediaKind: 'image',
        mimeType: 'image/jpeg',
        byteSize: 1024,
        contentHash: 'hash-1',
      },
    });
    expect(client.calls[1]).toEqual({
      fn: 'bestchef-media-finalize',
      body: {
        assetId: 'asset-1',
        width: 1200,
        height: 900,
        byteSize: 1024,
        contentHash: 'hash-1',
      },
    });
  });
});
