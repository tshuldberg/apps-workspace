import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OAuthBrokerClientError, type AccessTokenOperation } from '@mylife/sync';
import {
  BOX_BROKER_TRUST_DISCLOSURE,
  createBoxBrokerSessionSource,
  createBoxWebSessionSource,
  type BoxBrokerSessionClient,
} from '../box-session';

describe('Box web broker session source', () => {
  it('discloses the broker trust boundary', () => {
    expect(BOX_BROKER_TRUST_DISCLOSURE).toContain('broker can access the provider token');
    expect(BOX_BROKER_TRUST_DISCLOSURE).toContain('encrypted Meerkat objects');
    expect(BOX_BROKER_TRUST_DISCLOSURE).toContain('self-hosted broker');
  });

  it('requests fresh operation-bound tokens without browser persistence', async () => {
    const calls: Array<{ vaultId: string; destinationId: string; operation: AccessTokenOperation }> = [];
    const client: BoxBrokerSessionClient = {
      async session(input) { calls.push(input); return { accessToken: `token-${calls.length}` }; },
      async revoke() {},
    };
    const source = createBoxBrokerSessionSource({ client, vaultId: 'vault-1', destinationId: 'destination-1' });
    await expect(source.getAccessToken('read')).resolves.toBe('token-1');
    await expect(source.getAccessToken('write')).resolves.toBe('token-2');
    expect(calls).toEqual([
      { vaultId: 'vault-1', destinationId: 'destination-1', operation: 'read' },
      { vaultId: 'vault-1', destinationId: 'destination-1', operation: 'write' },
    ]);
    const text = readFileSync(resolve(__dirname, '..', 'box-session.ts'), 'utf8');
    expect(text).not.toContain('localStorage');
    expect(text).not.toContain('sessionStorage');
    expect(text).not.toContain('indexedDB');
  });

  it('maps absent broker custody and malformed tokens to honest null', async () => {
    const missing = createBoxBrokerSessionSource({
      client: {
        async session() { throw new OAuthBrokerClientError('vault_not_found', 404, false); },
        async revoke() {},
      },
      vaultId: 'vault-1',
      destinationId: 'destination-1',
    });
    await expect(missing.getAccessToken('list')).resolves.toBeNull();
    const malformed = createBoxBrokerSessionSource({
      client: { async session() { return { accessToken: 'bad\0token' }; }, async revoke() {} },
      vaultId: 'vault-2',
      destinationId: 'destination-2',
    });
    await expect(malformed.getAccessToken('read')).resolves.toBeNull();
  });

  it('does not call the broker without a hosted authorization bearer', async () => {
    let transportCalls = 0;
    const source = createBoxWebSessionSource({
      brokerBaseUrl: 'https://broker.example.test/',
      vaultId: 'vault-3',
      destinationId: 'destination-3',
      getHostedAuthBearer: () => null,
      transport: async () => {
        transportCalls += 1;
        return { status: 500, headers: {}, body: new Uint8Array() };
      },
    });
    await expect(source.getAccessToken('health')).resolves.toBeNull();
    expect(transportCalls).toBe(0);
  });
});
