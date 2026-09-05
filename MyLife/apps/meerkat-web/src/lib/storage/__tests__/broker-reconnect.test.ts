import type { HttpTransport, HttpTransportRequest } from '@mylife/sync';
import { describe, expect, it, vi } from 'vitest';
import {
  reconnectBrokerVault,
  type BrokerReconnectRuntime,
} from '../broker-reconnect';

const NOW = Date.parse('2026-07-15T12:00:00.000Z');
const EXPIRES = '2026-07-15T12:05:00.000Z';

function jsonResponse(body: object) {
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: new TextEncoder().encode(JSON.stringify(body)),
  };
}

function fixture(callbackUrl: string, overrides: Partial<BrokerReconnectRuntime> = {}) {
  const requests: HttpTransportRequest[] = [];
  const transport: HttpTransport = async (request) => {
    requests.push(request);
    if (request.url.endsWith('/connect/start')) {
      return jsonResponse({ authorizationUrl: 'https://accounts.example/authorize', expiresAt: EXPIRES });
    }
    return jsonResponse({ vaultId: 'vault-1', accountHint: 'owner@example.com' });
  };
  const popup = {
    closed: false,
    close: vi.fn(),
    location: { href: callbackUrl },
  } as unknown as Window;
  const runtime: BrokerReconnectRuntime = {
    randomBytes: (length) => new Uint8Array(length).fill(1),
    sha256: async () => new Uint8Array(32).fill(2),
    randomUUID: () => 'state-1',
    locationHref: () => 'https://app.example/settings?old=1#fragment',
    transport,
    delay: vi.fn(async () => undefined),
    ...overrides,
  };
  return { requests, popup, runtime };
}

function requestBody(request: HttpTransportRequest): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(request.body)) as Record<string, unknown>;
}

describe('reconnectBrokerVault', () => {
  it('binds PKCE, exact redirect, state, bearer, callback code, and closes the popup', async () => {
    const env = fixture('https://app.example/?meerkat_storage_oauth=1&state=state-1&code=provider-code');
    const result = await reconnectBrokerVault({
      brokerBaseUrl: 'https://broker.example',
      provider: 'google',
      destinationLabel: 'Drive',
      getHostedAuthBearer: () => 'hosted-token',
      openPopup: () => env.popup,
      now: () => NOW,
      runtime: env.runtime,
    });

    expect(result).toEqual({ vaultId: 'vault-1', accountHint: 'owner@example.com' });
    expect(env.requests).toHaveLength(2);
    expect(env.requests[0]?.headers.Authorization).toBe('Bearer hosted-token');
    expect(requestBody(env.requests[0]!)).toMatchObject({
      provider: 'google',
      redirectUri: 'https://app.example/settings?meerkat_storage_oauth=1',
      state: 'state-1',
      codeChallenge: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
    });
    expect(requestBody(env.requests[1]!)).toMatchObject({
      state: 'state-1', code: 'provider-code',
    });
    expect(requestBody(env.requests[1]!).codeVerifier).toMatch(/^[A-Za-z0-9_-]{64}$/u);
    expect(env.popup.close).toHaveBeenCalledOnce();
  });

  it('ignores a cross-origin page until the popup returns to the exact app origin', async () => {
    const env = fixture('https://evil.example/?meerkat_storage_oauth=1&state=state-1&code=stolen');
    env.runtime.delay = vi.fn(async () => {
      (env.popup.location as { href: string }).href =
        'https://app.example/?meerkat_storage_oauth=1&state=state-1&code=real';
    });
    await expect(reconnectBrokerVault({
      brokerBaseUrl: 'https://broker.example', provider: 'box', destinationLabel: 'Box',
      getHostedAuthBearer: () => 'token', openPopup: () => env.popup,
      now: () => NOW, runtime: env.runtime,
    })).resolves.toEqual({ vaultId: 'vault-1', accountHint: 'owner@example.com' });
    expect(env.runtime.delay).toHaveBeenCalledWith(250);
    expect(requestBody(env.requests[1]!).code).toBe('real');
  });

  it.each([
    ['wrong state', 'https://app.example/?meerkat_storage_oauth=1&state=other&code=code', 'callback was invalid'],
    ['provider error', 'https://app.example/?meerkat_storage_oauth=1&state=state-1&error=access_denied', 'access_denied'],
  ])('rejects %s and closes the popup', async (_label, callbackUrl, message) => {
    const env = fixture(callbackUrl);
    await expect(reconnectBrokerVault({
      brokerBaseUrl: 'https://broker.example', provider: 'onedrive', destinationLabel: 'OneDrive',
      getHostedAuthBearer: () => 'token', openPopup: () => env.popup,
      now: () => NOW, runtime: env.runtime,
    })).rejects.toThrow(message);
    expect(env.popup.close).toHaveBeenCalledOnce();
    expect(env.requests).toHaveLength(1);
  });

  it('fails before completion when the popup is blocked or closed', async () => {
    const blocked = fixture('about:blank');
    await expect(reconnectBrokerVault({
      brokerBaseUrl: 'https://broker.example', provider: 'dropbox', destinationLabel: 'Dropbox',
      getHostedAuthBearer: () => 'token', openPopup: () => null,
      now: () => NOW, runtime: blocked.runtime,
    })).rejects.toThrow('window was blocked');

    const closed = fixture('about:blank');
    Object.assign(closed.popup, { closed: true });
    await expect(reconnectBrokerVault({
      brokerBaseUrl: 'https://broker.example', provider: 'dropbox', destinationLabel: 'Dropbox',
      getHostedAuthBearer: () => 'token', openPopup: () => closed.popup,
      now: () => NOW, runtime: closed.runtime,
    })).rejects.toThrow('was closed');
    expect(closed.popup.close).toHaveBeenCalledOnce();
  });
});
