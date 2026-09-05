import { afterEach, describe, expect, it } from 'vitest';
import {
  startHumanityService,
  type HumanityServiceServer,
} from '../humanity-service-http';
import type { HumanityService } from '../humanity-service';
import {
  startPersonaService,
  type PersonaServiceServer,
} from '../persona-service-http';
import type { PersonaRegistryService } from '../persona-registry';
import { PostgresStoreUnavailableError } from '../postgres/store-context';

const servers: Array<HumanityServiceServer | PersonaServiceServer> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function unavailable(operation: string): PostgresStoreUnavailableError {
  return new PostgresStoreUnavailableError(operation, new Error('database detail is private'));
}

describe('state authority HTTP boundaries', () => {
  it('returns an explicit 503 when humanity state is unavailable', async () => {
    const service = {
      stats: async () => Promise.reject(unavailable('humanity stats')),
      sweep: async () => undefined,
    } as unknown as HumanityService;
    const server = await startHumanityService({ service, host: '127.0.0.1' });
    servers.push(server);

    const response = await fetch(`${server.url}/healthz`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: 'state_authority_unavailable',
    });
  });

  it('returns an explicit 503 when persona state is unavailable', async () => {
    const service = {
      stats: async () => Promise.reject(unavailable('persona stats')),
      sweep: async () => undefined,
    } as unknown as PersonaRegistryService;
    const server = await startPersonaService({
      service,
      host: '127.0.0.1',
      corsAllowedOrigins: ['https://app.example.test'],
    });
    servers.push(server);

    const response = await fetch(`${server.url}/healthz`, {
      headers: { Origin: 'https://app.example.test' },
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: 'state_authority_unavailable',
    });
  });
});
