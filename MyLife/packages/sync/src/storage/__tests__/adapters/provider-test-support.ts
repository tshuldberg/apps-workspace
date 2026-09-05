import type { StorageAdapterOperation } from '../../fakes';
import type {
  StorageDestinationAdapter,
  StorageHealth,
} from '../../types';
import { StorageAdapterError } from '../../types';
import type { StorageAdapterConformanceFixture } from '../../conformance';
import type { HttpTransportRequest, HttpTransportResponse } from '../../adapters/http';
import { responseHeader } from '../../adapters/http';

export interface ProviderConformanceControls {
  setQuota(usedBytes: number | null, capBytes: number | null): void;
  setVerificationMode(mode: 'read_back' | 'provider_checksum' | 'none'): void;
  setPartialPutBytes(bytes: number | null): void;
}

export function createProviderConformanceFixture(
  core: StorageDestinationAdapter,
  provider: ProviderConformanceControls,
): StorageAdapterConformanceFixture {
  const faults = new Map<StorageAdapterOperation, StorageAdapterError[]>();
  let healthOverride: StorageHealth['state'] | null = null;
  let healthErrorCode: string | undefined;
  const invoke = async <Result>(
    operation: StorageAdapterOperation,
    callback: () => Promise<Result>,
  ): Promise<Result> => {
    const queued = faults.get(operation);
    const fault = queued?.shift();
    if (queued !== undefined && queued.length === 0) faults.delete(operation);
    if (fault) throw fault;
    return callback();
  };
  const adapter: StorageDestinationAdapter = {
    authorize: (input) => invoke('authorize', () => core.authorize(input)),
    revoke: (options) => invoke('revoke', () => core.revoke(options)),
    capabilities: () => invoke('capabilities', () => core.capabilities()),
    health: () => invoke('health', async () => healthOverride === null
      ? core.health()
      : {
        state: healthOverride,
        verifiedReadWrite: false,
        checkedAt: '2026-07-14T12:00:00.000Z',
        ...(healthErrorCode === undefined ? {} : { errorCode: healthErrorCode }),
      }),
    quota: () => invoke('quota', () => core.quota()),
    putObject: (input, resume) => invoke('putObject', () => core.putObject(input, resume)),
    headObject: (ref) => invoke('headObject', () => core.headObject(ref)),
    getObject: (ref, range) => invoke('getObject', () => core.getObject(ref, range)),
    listObjects: (cursor) => invoke('listObjects', () => core.listObjects(cursor)),
    deleteObject: (ref) => invoke('deleteObject', () => core.deleteObject(ref)),
  };
  return {
    adapter,
    controls: {
      failNext(operation, error) {
        const queued = faults.get(operation) ?? [];
        queued.push(error);
        faults.set(operation, queued);
      },
      setQuota: (usedBytes, capBytes) => provider.setQuota(usedBytes, capBytes),
      setVerificationMode: (mode) => provider.setVerificationMode(mode),
      setPartialPutBytes: (bytes) => provider.setPartialPutBytes(bytes),
      setConflictMode() {},
      setHealthState(state, errorCode) {
        healthOverride = state;
        healthErrorCode = errorCode;
      },
    },
  };
}

export function response(
  status: number,
  headers: Record<string, string> = {},
  body: Uint8Array = new Uint8Array(0),
): HttpTransportResponse {
  return { status, headers, body };
}

export function jsonResponse(
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
): HttpTransportResponse {
  return response(status, { 'Content-Type': 'application/json', ...headers }, jsonBytes(value));
}

export function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

export function parseRequestObject(body: Uint8Array | undefined): Record<string, unknown> {
  if (!body) return {};
  const parsed = JSON.parse(new TextDecoder().decode(body)) as unknown;
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

export function header(headers: Readonly<Record<string, string>>, name: string): string | null {
  return responseHeader(headers, name);
}

export function copyRequest(request: HttpTransportRequest): HttpTransportRequest {
  return {
    ...request,
    headers: { ...request.headers },
    ...(request.body === undefined ? {} : { body: request.body.slice() }),
  };
}

export function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const output = new Uint8Array(left.length + right.length);
  output.set(left);
  output.set(right, left.length);
  return output;
}

export function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
