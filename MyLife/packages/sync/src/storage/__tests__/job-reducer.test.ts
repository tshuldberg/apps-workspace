import { describe, expect, it } from 'vitest';
import {
  STORAGE_MANIFEST_OBJECT_ID,
  StorageJobTransitionError,
  reduceStorageJob,
  type StorageJob,
  type StorageJobEvent,
} from '../job-reducer';

const T0 = '2026-07-14T12:00:00.000Z';
const T1 = '2026-07-14T12:01:00.000Z';
const T2 = '2026-07-14T12:02:00.000Z';

function queuedJob(overrides: Partial<StorageJob> = {}): StorageJob {
  return {
    id: 'job-1',
    kind: 'backup',
    destination_id: 'dest-1',
    state: 'queued',
    phase: null,
    cursor_json: null,
    total_objects: 2,
    completed_objects: 0,
    total_bytes: 20,
    completed_bytes: 0,
    attempts: 0,
    last_error_code: null,
    created_at: T0,
    updated_at: T0,
    required_object_ids: ['object-a', 'object-b'],
    verified_objects: [],
    manifest_verification: null,
    ...overrides,
  };
}

function verifyingJob(): StorageJob {
  const running = reduceStorageJob(queuedJob(), { type: 'start', at: T1 });
  return reduceStorageJob(running, {
    type: 'checkpoint',
    completed_objects: 2,
    completed_bytes: 20,
    cursor_json: '{"resume":"done"}',
    at: T2,
  });
}

describe('reduceStorageJob', () => {
  it('moves queued -> running/writing and checkpoints bounded progress', () => {
    const running = reduceStorageJob(queuedJob(), { type: 'start', at: T1 });
    expect(running).toMatchObject({ state: 'running', phase: 'writing', updated_at: T1 });
    const checkpointed = reduceStorageJob(running, {
      type: 'checkpoint',
      completed_objects: 1,
      completed_bytes: 10,
      cursor_json: '{"offset":10}',
      at: T2,
    });
    expect(checkpointed).toMatchObject({
      completed_objects: 1,
      completed_bytes: 10,
      cursor_json: '{"offset":10}',
      phase: 'writing',
    });
  });

  it('enters verifying only when object and byte totals are complete', () => {
    expect(verifyingJob()).toMatchObject({
      state: 'running',
      phase: 'verifying',
      completed_objects: 2,
      completed_bytes: 20,
    });
  });

  it('pauses and resumes while preserving the running sub-phase', () => {
    const verifying = verifyingJob();
    const paused = reduceStorageJob(verifying, { type: 'pause', at: T1 });
    expect(paused).toMatchObject({ state: 'paused', phase: 'verifying' });
    const resumed = reduceStorageJob(paused, { type: 'resume', at: T2 });
    expect(resumed).toMatchObject({ state: 'running', phase: 'verifying' });
  });

  it('retryable errors increment attempts and preserve the resume cursor and phase', () => {
    const writing = reduceStorageJob(queuedJob({ cursor_json: '{"session":"opaque"}' }), {
      type: 'start',
      at: T1,
    });
    const retrying = reduceStorageJob(writing, {
      type: 'retryable_error',
      error_code: 'unreachable',
      retry_state: 'queued',
      at: T2,
    });
    expect(retrying).toMatchObject({
      state: 'queued',
      phase: 'writing',
      attempts: 1,
      cursor_json: '{"session":"opaque"}',
      last_error_code: 'unreachable',
    });
    expect(reduceStorageJob(retrying, { type: 'start', at: T2 }).phase).toBe('writing');
  });

  it('succeeds only after every object and manifest has strong verification evidence', () => {
    let job = verifyingJob();
    job = reduceStorageJob(job, {
      type: 'verify_pass',
      target: { kind: 'object', object_id: 'object-a' },
      verification: { kind: 'read_back', ciphertextHash: 'aa'.repeat(64) },
      at: T1,
    });
    job = reduceStorageJob(job, {
      type: 'verify_pass',
      target: { kind: 'object', object_id: 'object-b' },
      verification: { kind: 'provider_checksum', algorithm: 'sha512', value: 'bb'.repeat(64) },
      at: T1,
    });
    expect(() => reduceStorageJob(job, { type: 'succeed', at: T2 })).toThrow(StorageJobTransitionError);
    job = reduceStorageJob(job, {
      type: 'verify_pass',
      target: { kind: 'manifest' },
      verification: { kind: 'read_back', ciphertextHash: 'cc'.repeat(64) },
      at: T2,
    });
    expect(reduceStorageJob(job, { type: 'succeed', at: T2 })).toMatchObject({
      state: 'succeeded',
      phase: null,
    });
  });

  it("rejects verification 'none' at runtime even if an untyped caller bypasses TypeScript", () => {
    const event = {
      type: 'verify_pass',
      target: { kind: 'manifest' },
      verification: { kind: 'none' },
      at: T2,
    } as unknown as StorageJobEvent;
    expect(() => reduceStorageJob(verifyingJob(), event)).toThrowError(
      expect.objectContaining({ code: 'invalid_verification' }),
    );
    const emptyReadBack = {
      type: 'verify_pass',
      target: { kind: 'manifest' },
      verification: { kind: 'read_back', ciphertextHash: '' },
      at: T2,
    } as StorageJobEvent;
    expect(() => reduceStorageJob(verifyingJob(), emptyReadBack)).toThrowError(
      expect.objectContaining({ code: 'invalid_verification' }),
    );
  });

  it('verification failure marks ciphertext corrupt and fails terminally', () => {
    const failed = reduceStorageJob(verifyingJob(), {
      type: 'verify_fail',
      object_id: 'object-a',
      at: T2,
    });
    expect(failed).toMatchObject({
      state: 'failed',
      phase: null,
      last_error_code: 'corrupt_ciphertext',
    });
    expect(() => reduceStorageJob(failed, { type: 'start', at: T2 })).toThrow(StorageJobTransitionError);
  });

  it('cancellation is terminal for new writes and retains verified object evidence', () => {
    let job = verifyingJob();
    job = reduceStorageJob(job, {
      type: 'verify_pass',
      target: { kind: 'object', object_id: 'object-a' },
      verification: { kind: 'read_back', ciphertextHash: 'aa'.repeat(64) },
      at: T1,
    });
    const cancelled = reduceStorageJob(job, { type: 'cancel', at: T2 });
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.verified_objects.map((item) => item.object_id)).toEqual(['object-a']);
    expect(() => reduceStorageJob(cancelled, { type: 'resume', at: T2 })).toThrowError(
      expect.objectContaining({ code: 'illegal_transition' }),
    );
  });

  it('partial completion persists the exact missing list and rejects omissions', () => {
    let job = verifyingJob();
    job = reduceStorageJob(job, {
      type: 'verify_pass',
      target: { kind: 'object', object_id: 'object-a' },
      verification: { kind: 'read_back', ciphertextHash: 'aa'.repeat(64) },
      at: T1,
    });
    expect(() => reduceStorageJob(job, {
      type: 'partial_complete',
      missing_object_ids: ['object-b'],
      at: T2,
    })).toThrowError(expect.objectContaining({ code: 'invalid_partial' }));
    const partial = reduceStorageJob(job, {
      type: 'partial_complete',
      missing_object_ids: ['object-b', STORAGE_MANIFEST_OBJECT_ID],
      at: T2,
    });
    expect(partial).toMatchObject({ state: 'partial', phase: null });
    expect(partial.cursor_json).toBe(
      `{"missingObjectIds":["${STORAGE_MANIFEST_OBJECT_ID}","object-b"]}`,
    );
  });

  it('fails closed on checkpoint while paused and on counter overflow', () => {
    const running = reduceStorageJob(queuedJob(), { type: 'start', at: T1 });
    const paused = reduceStorageJob(running, { type: 'pause', at: T1 });
    expect(() => reduceStorageJob(paused, {
      type: 'checkpoint',
      completed_objects: 1,
      completed_bytes: 1,
      cursor_json: '{}',
      at: T2,
    })).toThrowError(expect.objectContaining({ code: 'illegal_transition' }));
    expect(() => reduceStorageJob(running, {
      type: 'checkpoint',
      completed_objects: 3,
      completed_bytes: 21,
      cursor_json: '{}',
      at: T2,
    })).toThrowError(expect.objectContaining({ code: 'invalid_checkpoint' }));
  });
});
