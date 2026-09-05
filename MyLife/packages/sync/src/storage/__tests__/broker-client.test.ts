import { describe, expect, it } from 'vitest';
import {
  OAuthBrokerClient,
  OAuthBrokerClientError,
  OAUTH_BROKER_CLIENT_PATHS,
} from '../broker-client';
import type { HttpTransportRequest, HttpTransportResponse } from '../adapters/http';

const encoder = new TextEncoder();

describe('OAuthBrokerClient', () => {
  it('sends typed connect requests with caller-provided hosted authorization', async () => {
    const requests: HttpTransportRequest[] = [];
    const client = clientFor(async (request) => {
      requests.push(copyRequest(request));
      return jsonResponse(200, {
        authorizationUrl: 'https://accounts.example.test/oauth?state=opaque',
        expiresAt: '2099-07-14T12:10:00.000Z',
      });
    });

    await expect(client.connectStart({
      provider: 'google',
      destinationLabel: 'My Drive',
      redirectUri: 'https://app.example.test/oauth/callback',
      codeChallenge: 'a'.repeat(43),
      state: 'state-value-long-enough',
    })).resolves.toEqual({
      authorizationUrl: 'https://accounts.example.test/oauth?state=opaque',
      expiresAt: '2099-07-14T12:10:00.000Z',
    });

    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? '').pathname).toBe(OAUTH_BROKER_CLIENT_PATHS.connectStart);
    expect(requests[0]?.headers.Authorization).toBe('Bearer hosted-subject-token');
    expect(JSON.parse(new TextDecoder().decode(requests[0]?.body)) as unknown).toMatchObject({
      provider: 'google',
      destinationLabel: 'My Drive',
    });
  });

  it('returns the provider token only through the session result', async () => {
    const client = clientFor(async (request) => {
      const path = new URL(request.url).pathname;
      if (path === OAUTH_BROKER_CLIENT_PATHS.connectComplete) {
        return jsonResponse(200, { vaultId: 'vault-1', accountHint: 'a***@example.test' });
      }
      return jsonResponse(200, {
        accessToken: 'short-lived-provider-token',
        tokenType: 'Bearer',
        sessionId: 'session-1',
        destinationId: 'destination-1',
        operations: ['read'],
        expiresAt: '2026-07-14T12:10:00.000Z',
      });
    });

    await expect(client.connectComplete({
      state: 'state-value-long-enough',
      code: 'authorization-code',
      codeVerifier: 'v'.repeat(43),
    })).resolves.toEqual({ vaultId: 'vault-1', accountHint: 'a***@example.test' });
    await expect(client.session({
      vaultId: 'vault-1',
      destinationId: 'destination-1',
      operation: 'read',
    })).resolves.toMatchObject({ accessToken: 'short-lived-provider-token', operations: ['read'] });
  });

  it('fails closed when a session response changes its destination or operation binding', async () => {
    const client = clientFor(async () => jsonResponse(200, {
      accessToken: 'provider-token',
      tokenType: 'Bearer',
      sessionId: 'session-1',
      destinationId: 'other-destination',
      operations: ['write'],
      expiresAt: '2026-07-14T12:10:00.000Z',
    }));

    await expect(client.session({
      vaultId: 'vault-1',
      destinationId: 'destination-1',
      operation: 'read',
    })).rejects.toMatchObject({ code: 'internal_error', status: 502, retryable: false });
  });

  it('rejects expanded operation grants and sessions longer than ten minutes', async () => {
    const expanded = clientFor(async () => jsonResponse(200, {
      accessToken: 'provider-token',
      tokenType: 'Bearer',
      sessionId: 'session-1',
      destinationId: 'destination-1',
      operations: ['read', 'delete'],
      expiresAt: '2026-07-14T12:10:00.000Z',
    }));
    await expect(expanded.session({
      vaultId: 'vault-1',
      destinationId: 'destination-1',
      operation: 'read',
    })).rejects.toMatchObject({ code: 'internal_error', status: 502 });

    const longLived = clientFor(async () => jsonResponse(200, {
      accessToken: 'provider-token',
      tokenType: 'Bearer',
      sessionId: 'session-1',
      destinationId: 'destination-1',
      operations: ['read'],
      expiresAt: '2026-07-14T12:10:00.001Z',
    }));
    await expect(longLived.session({
      vaultId: 'vault-1',
      destinationId: 'destination-1',
      operation: 'read',
    })).rejects.toMatchObject({ code: 'internal_error', status: 502 });
  });

  it('rejects missing authorization without sending a request', async () => {
    let calls = 0;
    const client = new OAuthBrokerClient({
      baseUrl: 'https://broker.example.test/',
      transport: async () => {
        calls += 1;
        return jsonResponse(500, { error: 'internal_error' });
      },
      getAuthorizationHeader: () => null,
    });

    await expect(client.revoke('vault-1')).rejects.toMatchObject({
      code: 'auth_required',
      status: 401,
      retryable: false,
    });
    expect(calls).toBe(0);
  });

  it('maps typed broker errors and retryability', async () => {
    const client = clientFor(async () => jsonResponse(503, { error: 'provider_not_configured' }));

    const error = await client.revoke('vault-1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OAuthBrokerClientError);
    expect(error).toMatchObject({ code: 'provider_not_configured', status: 503, retryable: false });
  });

  it('rejects expired sessions and malformed success bodies', async () => {
    const client = clientFor(async () => jsonResponse(200, {
      accessToken: 'provider-token',
      tokenType: 'Bearer',
      sessionId: 'session-1',
      destinationId: 'destination-1',
      operations: ['read'],
      expiresAt: '2025-01-01T00:00:00.000Z',
    }));

    await expect(client.session({
      vaultId: 'vault-1',
      destinationId: 'destination-1',
      operation: 'read',
    })).rejects.toMatchObject({ code: 'internal_error', status: 502 });
  });
});

function clientFor(
  transport: (request: HttpTransportRequest) => Promise<HttpTransportResponse>,
): OAuthBrokerClient {
  return new OAuthBrokerClient({
    baseUrl: 'https://broker.example.test/',
    transport,
    getAuthorizationHeader: () => 'Bearer hosted-subject-token',
    now: () => Date.parse('2026-07-14T12:00:00.000Z'),
  });
}

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
