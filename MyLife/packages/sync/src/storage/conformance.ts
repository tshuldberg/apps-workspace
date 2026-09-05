import { sha512Hex } from '../node/hkdf';
import type {
  EncryptedStorageObject,
  StorageAuthorizationInput,
  StorageDestinationAdapter,
  StorageHealth,
} from './types';
import { StorageAdapterError } from './types';
import type {
  InMemoryVerificationMode,
  StorageAdapterOperation,
} from './fakes';

export interface StorageConformanceTestApi {
  describe(name: string, suite: () => void): void;
  it(name: string, test: () => void | Promise<void>): void;
}

export interface StorageAdapterConformanceControls {
  failNext(operation: StorageAdapterOperation, error: StorageAdapterError): void;
  setQuota(usedBytes: number | null, capBytes: number | null): void;
  setVerificationMode(mode: InMemoryVerificationMode): void;
  setPartialPutBytes(bytes: number | null): void;
  setConflictMode(code: 'conflict' | 'corrupt_ciphertext'): void;
  setHealthState(state: StorageHealth['state'] | null, errorCode?: string): void;
}

export interface StorageAdapterConformanceFixture {
  adapter: StorageDestinationAdapter;
  controls: StorageAdapterConformanceControls;
}

export type StorageAdapterConformanceFactory = () =>
  | StorageDestinationAdapter
  | StorageAdapterConformanceFixture;

export interface StorageAdapterConformanceOptions {
  testApi: StorageConformanceTestApi;
  authorizeInput?: StorageAuthorizationInput;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`storage conformance assertion failed: ${message}`);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function object(objectId: string, bytes: Uint8Array): EncryptedStorageObject {
  return {
    objectId,
    dataClass: 'conformance',
    ciphertext: bytes,
    ciphertextHash: sha512Hex(bytes),
    encryptedBytes: bytes.length,
  };
}

function isFixture(value: StorageDestinationAdapter | StorageAdapterConformanceFixture): value is StorageAdapterConformanceFixture {
  return 'adapter' in value && 'controls' in value;
}

function normalizeFixture(
  value: StorageDestinationAdapter | StorageAdapterConformanceFixture,
): StorageAdapterConformanceFixture {
  if (isFixture(value)) return value;
  const controlled = value as StorageDestinationAdapter & Partial<StorageAdapterConformanceControls>;
  assert(typeof controlled.failNext === 'function', 'factory must provide failNext control');
  assert(typeof controlled.setQuota === 'function', 'factory must provide setQuota control');
  assert(typeof controlled.setVerificationMode === 'function', 'factory must provide verification control');
  assert(typeof controlled.setPartialPutBytes === 'function', 'factory must provide resume control');
  assert(typeof controlled.setConflictMode === 'function', 'factory must provide conflict control');
  assert(typeof controlled.setHealthState === 'function', 'factory must provide health control');
  return {
    adapter: value,
    controls: {
      failNext: controlled.failNext.bind(value),
      setQuota: controlled.setQuota.bind(value),
      setVerificationMode: controlled.setVerificationMode.bind(value),
      setPartialPutBytes: controlled.setPartialPutBytes.bind(value),
      setConflictMode: controlled.setConflictMode.bind(value),
      setHealthState: controlled.setHealthState.bind(value),
    },
  };
}

async function authorize(
  adapter: StorageDestinationAdapter,
  input: StorageAuthorizationInput,
): Promise<void> {
  const result = await adapter.authorize(input);
  assert(result.kind === 'authorized', 'adapter did not authorize');
  assert(result.credentialRef !== undefined, 'authorized result omitted credentialRef');
}

async function expectStorageError(
  operation: () => Promise<unknown>,
  codes: readonly StorageAdapterError['code'][],
  retryable?: boolean,
): Promise<StorageAdapterError> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof StorageAdapterError, 'operation threw an untyped error');
    assert(codes.includes(error.code), `unexpected storage error code ${error.code}`);
    if (retryable !== undefined) assert(error.retryable === retryable, 'retryable flag is dishonest');
    return error;
  }
  throw new Error('storage conformance assertion failed: operation unexpectedly succeeded');
}

/** Register the provider-neutral adapter contract as named Vitest-compatible cases. */
export function runStorageAdapterConformance(
  name: string,
  factory: StorageAdapterConformanceFactory,
  options: StorageAdapterConformanceOptions,
): void {
  const { describe, it } = options.testApi;
  const authorizeInput = options.authorizeInput ?? { kind: 'interactive' as const };

  describe(`${name} storage adapter conformance`, () => {
    it('authorize happy + revoked', async () => {
      const { adapter } = normalizeFixture(factory());
      const authorized = await adapter.authorize(authorizeInput);
      assert(authorized.kind === 'authorized', 'interactive authorization did not succeed');
      assert(authorized.credentialRef !== undefined, 'authorization returned no custody reference');
      await adapter.revoke({ deleteRemoteData: false });
      const revoked = await adapter.authorize({
        kind: 'stored_credential',
        credentialRef: authorized.credentialRef,
        accountHint: authorized.accountHint,
      });
      assert(revoked.kind === 'revoked', 'revoked stored authorization was accepted');
    });

    it('capabilities shape', async () => {
      const { adapter } = normalizeFixture(factory());
      const capabilities = await adapter.capabilities();
      for (const value of [
        capabilities.backgroundWrite,
        capabilities.resumableUpload,
        capabilities.list,
        capabilities.delete,
        capabilities.quota,
        capabilities.serverChecksum,
      ]) {
        assert(typeof value === 'boolean', 'capability flags must be booleans');
      }
      assert(
        Number.isSafeInteger(capabilities.maximumObjectBytes) && capabilities.maximumObjectBytes > 0,
        'maximumObjectBytes must be a positive safe integer',
      );
    });

    it('health honest states', async () => {
      const { adapter, controls } = normalizeFixture(factory());
      const before = await adapter.health();
      assert(before.state === 'auth_required', 'unauthorized health must say auth_required');
      assert(before.verifiedReadWrite === false, 'unauthorized health cannot claim verified read/write');
      await authorize(adapter, authorizeInput);
      const ready = await adapter.health();
      assert(ready.state === 'ok', 'authorized healthy adapter must report ok');
      controls.setHealthState('degraded', 'slow_provider');
      const degraded = await adapter.health();
      assert(degraded.state === 'degraded' && degraded.errorCode === 'slow_provider', 'degraded state was hidden');
      controls.setHealthState('unreachable', 'offline');
      const unreachable = await adapter.health();
      assert(unreachable.state === 'unreachable', 'unreachable state was hidden');
      assert(unreachable.verifiedReadWrite === false, 'unreachable state claimed verified read/write');
    });

    it('quota', async () => {
      const { adapter, controls } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      controls.setQuota(128, 1024);
      const quota = await adapter.quota();
      assert(quota.usedBytes === 128, 'quota usedBytes mismatch');
      assert(quota.capBytes === 1024, 'quota capBytes mismatch');
      assert(quota.estimated === false, 'exact fake quota was labeled estimated');
    });

    it('putObject + read-back verification evidence', async () => {
      const { adapter, controls } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      controls.setVerificationMode('read_back');
      const input = object('read-back', new Uint8Array([1, 2, 3, 4]));
      const result = await adapter.putObject(input);
      assert(result.complete && result.verified, 'verified put did not complete');
      assert(result.verification.kind === 'read_back', 'put did not return read-back evidence');
      assert(result.verification.ciphertextHash === input.ciphertextHash, 'read-back hash mismatch');
      const stored = await adapter.getObject({ objectId: input.objectId });
      assert(stored !== null && equalBytes(stored, input.ciphertext), 'read-back bytes mismatch');
    });

    it('putObject resume from a persisted token', async () => {
      const { adapter, controls } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      controls.setPartialPutBytes(4);
      const input = object('resume', new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
      let result = await adapter.putObject(input);
      let rounds = 0;
      while (!result.complete) {
        assert(result.resumeToken.offset === result.encryptedBytes, 'resume offset was not persisted');
        result = await adapter.putObject(input, result.resumeToken);
        rounds += 1;
        assert(rounds < 10, 'resumable put did not converge');
      }
      assert(result.verified, 'completed resumed put lacks verification');
      const stored = await adapter.getObject({ objectId: input.objectId });
      assert(stored !== null && equalBytes(stored, input.ciphertext), 'resumed object bytes mismatch');
    });

    it('headObject present/absent', async () => {
      const { adapter } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      assert(await adapter.headObject({ objectId: 'absent' }) === null, 'absent head returned metadata');
      const input = object('present', new Uint8Array([9, 8, 7]));
      await adapter.putObject(input);
      const metadata = await adapter.headObject({ objectId: input.objectId });
      assert(metadata !== null, 'present head returned null');
      assert(
        metadata.ciphertextHash === null || metadata.ciphertextHash === input.ciphertextHash,
        'head ciphertext hash mismatch',
      );
      assert(metadata.encryptedBytes === input.encryptedBytes, 'head size mismatch');
      if (metadata.ciphertextHash === null) {
        const bytes = await adapter.getObject({ objectId: input.objectId, remoteRef: metadata.remoteRef });
        assert(bytes !== null && equalBytes(bytes, input.ciphertext), 'null-hash metadata lacked read-back proof');
      }
    });

    it('getObject full + ranged', async () => {
      const { adapter } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      const input = object('ranges', new Uint8Array([10, 11, 12, 13, 14, 15]));
      await adapter.putObject(input);
      const full = await adapter.getObject({ objectId: input.objectId });
      const ranged = await adapter.getObject({ objectId: input.objectId }, { offset: 2, length: 3 });
      assert(full !== null && equalBytes(full, input.ciphertext), 'full get mismatch');
      assert(ranged !== null && equalBytes(ranged, new Uint8Array([12, 13, 14])), 'ranged get mismatch');
    });

    it('listObjects pagination via cursor', async () => {
      const { adapter } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      for (const id of ['list-a', 'list-b', 'list-c']) {
        await adapter.putObject(object(id, encoderBytes(id)));
      }
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await adapter.listObjects(cursor);
        ids.push(...page.items.map((item) => item.objectId));
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);
      assert(ids.join(',') === 'list-a,list-b,list-c', 'pagination lost or reordered objects');
    });

    it('deleteObject + idempotent second delete', async () => {
      const { adapter } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      const input = object('delete', new Uint8Array([4, 2]));
      await adapter.putObject(input);
      const first = await adapter.deleteObject({ objectId: input.objectId });
      const second = await adapter.deleteObject({ objectId: input.objectId });
      assert(first.deleted, 'first delete did not report deletion');
      assert(!second.deleted, 'second delete was not idempotent');
    });

    it('conflict (same id different bytes) fails closed', async () => {
      const { adapter, controls } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      controls.setConflictMode('corrupt_ciphertext');
      await adapter.putObject(object('conflict', new Uint8Array([1, 1, 1])));
      await expectStorageError(
        () => adapter.putObject(object('conflict', new Uint8Array([2, 2, 2]))),
        ['conflict', 'corrupt_ciphertext'],
        false,
      );
      const stored = await adapter.getObject({ objectId: 'conflict' });
      assert(stored !== null && equalBytes(stored, new Uint8Array([1, 1, 1])), 'conflict overwrote good bytes');
    });

    it('revoke stops subsequent ops with auth_required', async () => {
      const { adapter } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      await adapter.revoke({ deleteRemoteData: false });
      await expectStorageError(
        () => adapter.putObject(object('after-revoke', new Uint8Array([1]))),
        ['auth_required'],
        false,
      );
      const health = await adapter.health();
      assert(health.state === 'revoked', 'health did not retain revoked state');
    });

    it('outage surfaces retryable unreachable and never a fake success', async () => {
      const { adapter, controls } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      controls.failNext(
        'putObject',
        new StorageAdapterError('unreachable', 'injected destination outage', true),
      );
      await expectStorageError(
        () => adapter.putObject(object('outage', new Uint8Array([3, 3, 3]))),
        ['unreachable'],
        true,
      );
      assert(await adapter.headObject({ objectId: 'outage' }) === null, 'failed outage put created an object');
    });

    it("verification 'none' never yields verified", async () => {
      const { adapter, controls } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      controls.setVerificationMode('none');
      const result = await adapter.putObject(object('unverified', new Uint8Array([5, 5])));
      assert(result.complete, 'none-verification put did not finish writing');
      assert(!result.verified, 'none-verification result claimed verified');
      assert(result.verification.kind === 'none', 'none-verification evidence was fabricated');
    });

    it('large object chunking boundary (maximumObjectBytes respected)', async () => {
      const { adapter, controls } = normalizeFixture(factory());
      await authorize(adapter, authorizeInput);
      controls.setPartialPutBytes(257);
      const capabilities = await adapter.capabilities();
      const atLimit = object('at-limit', new Uint8Array(capabilities.maximumObjectBytes));
      let result = await adapter.putObject(atLimit);
      let rounds = 0;
      while (!result.complete) {
        result = await adapter.putObject(atLimit, result.resumeToken);
        rounds += 1;
        assert(rounds <= Math.ceil(capabilities.maximumObjectBytes / 257) + 1, 'boundary upload stalled');
      }
      assert(result.verified, 'maximum-sized object did not verify');
      await expectStorageError(
        () => adapter.putObject(object('over-limit', new Uint8Array(capabilities.maximumObjectBytes + 1))),
        ['quota_exceeded', 'provider_error'],
        false,
      );
    });
  });
}

function encoderBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
