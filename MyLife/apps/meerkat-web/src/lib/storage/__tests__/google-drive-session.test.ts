import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OAuthBrokerClientError,
  type AccessTokenOperation,
  type HttpTransportRequest,
  type HttpTransportResponse,
} from '@mylife/sync';
import {
  GOOGLE_DRIVE_BROKER_TRUST_DISCLOSURE,
  createGoogleDriveBrokerSessionSource,
  createGoogleDriveWebSessionSource,
  type GoogleDriveBrokerSessionClient,
} from '../google-drive-session';

const encoder = new TextEncoder();

describe('Google Drive web broker session source', () => {
  it('discloses the broker token and encrypted-object trust boundary', () => {
    expect(GOOGLE_DRIVE_BROKER_TRUST_DISCLOSURE).toContain('broker can access the provider token');
    expect(GOOGLE_DRIVE_BROKER_TRUST_DISCLOSURE).toContain('encrypted Meerkat objects');
    expect(GOOGLE_DRIVE_BROKER_TRUST_DISCLOSURE).toContain('self-hosted broker');
  });

  it('requests a fresh destination and operation-bound session without persistence', async () => {
    const calls: Array<{ vaultId: string; operation: AccessTokenOperation; destinationId: string }> = [];
    const client: GoogleDriveBrokerSessionClient = {
      async session(input) {
        calls.push(input);
        return { accessToken: `provider-token-${calls.length}` };
      },
      async revoke() {},
    };
    const source = createGoogleDriveBrokerSessionSource({
      client,
      vaultId: 'vault-1',
      destinationId: 'destination-1',
    });

    await expect(source.getAccessToken('read')).resolves.toBe('provider-token-1');
    await expect(source.getAccessToken('write')).resolves.toBe('provider-token-2');
    expect(calls).toEqual([
      { vaultId: 'vault-1', destinationId: 'destination-1', operation: 'read' },
      { vaultId: 'vault-1', destinationId: 'destination-1', operation: 'write' },
    ]);
    expect(source.credentialRef).toBe('broker://oauth/vault-1');
    expect(Object.keys(source).sort()).toEqual(['credentialRef', 'getAccessToken', 'revoke']);
  });

  it('contains no browser token persistence path', () => {
    const source = readFileSync(resolve(__dirname, '..', 'google-drive-session.ts'), 'utf8');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('indexedDB');
  });

  it('maps revoked or absent broker vaults to auth-required null', async () => {
    const source = createGoogleDriveBrokerSessionSource({
      client: {
        async session() {
          throw new OAuthBrokerClientError('vault_not_found', 404, false);
        },
        async revoke() {},
      },
      vaultId: 'vault-1',
      destinationId: 'destination-1',
    });

    await expect(source.getAccessToken('list')).resolves.toBeNull();
  });

  it('passes revoke through to the broker and never returns its response', async () => {
    const revoked: string[] = [];
    const source = createGoogleDriveBrokerSessionSource({
      client: {
        async session() {
          return { accessToken: 'provider-token' };
        },
        async revoke(vaultId) {
          revoked.push(vaultId);
          return { revoked: true, providerRevoked: true };
        },
      },
      vaultId: 'vault-2',
      destinationId: 'destination-2',
    });

    await expect(source.revoke()).resolves.toBeUndefined();
    expect(revoked).toEqual(['vault-2']);
  });

  it('wires a fresh device-signed hosted bearer into each broker session call', async () => {
    const requests: HttpTransportRequest[] = [];
    let bearerCalls = 0;
    const source = createGoogleDriveWebSessionSource({
      brokerBaseUrl: 'https://broker.example.test/',
      vaultId: 'vault-3',
      destinationId: 'destination-3',
      getHostedAuthBearer: () => {
        bearerCalls += 1;
        return `device.signed.bearer${bearerCalls}`;
      },
      transport: async (request) => {
        requests.push(copyRequest(request));
        const requestBody = JSON.parse(new TextDecoder().decode(request.body)) as {
          operation?: unknown;
          destinationId?: unknown;
        };
        return jsonResponse(200, {
          accessToken: `short-lived-${String(requestBody.operation)}`,
          tokenType: 'Bearer',
          sessionId: `session-${bearerCalls}`,
          destinationId: requestBody.destinationId,
          operations: [requestBody.operation],
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        });
      },
    });

    await expect(source.getAccessToken('quota')).resolves.toBe('short-lived-quota');
    await expect(source.getAccessToken('read')).resolves.toBe('short-lived-read');
    expect(bearerCalls).toBe(2);
    expect(requests.map((request) => request.headers.Authorization)).toEqual([
      'Bearer device.signed.bearer1',
      'Bearer device.signed.bearer2',
    ]);
    expect(requests.every((request) => new URL(request.url).pathname === '/api/oauth/v1/session')).toBe(true);
  });

  it('fails before transport when hosted subject authorization is absent', async () => {
    let transportCalls = 0;
    const source = createGoogleDriveWebSessionSource({
      brokerBaseUrl: 'https://broker.example.test/',
      vaultId: 'vault-4',
      destinationId: 'destination-4',
      getHostedAuthBearer: () => null,
      transport: async () => {
        transportCalls += 1;
        return jsonResponse(500, { error: 'internal_error' });
      },
    });

    await expect(source.getAccessToken('health')).resolves.toBeNull();
    expect(transportCalls).toBe(0);
  });
});

function jsonResponse(status: number, value: unknown): HttpTransportResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: encoder.encode(JSON.stringify(value)),
  };
}

function copyRequest(request: HttpTransportRequest): HttpTransportRequest {
  return {
    ...request,
    headers: { ...request.headers },
    ...(request.body === undefined ? {} : { body: request.body.slice() }),
  };
}
