import type { APIRequestContext } from '@playwright/test';

/**
 * Control plane for the local PostgREST fixture (`e2e/fixture-server.mjs`).
 *
 * The fixture is the network boundary the app already reads from, so switching
 * it between healthy and failing is how the outage surface gets exercised
 * without touching a line of application code.
 */

const FIXTURE_PORT = Number(process.env.MYNEWS_WEB_E2E_FIXTURE_PORT ?? 4310);
export const FIXTURE_ORIGIN = `https://127.0.0.1:${FIXTURE_PORT}`;

export type FixtureMode = 'ok' | 'outage';

export async function setFixtureMode(
  request: APIRequestContext,
  mode: FixtureMode,
): Promise<void> {
  const response = await request.post(`${FIXTURE_ORIGIN}/__fixture/mode`, { data: { mode } });
  if (!response.ok()) {
    throw new Error(`fixture mode switch failed: ${response.status()} ${await response.text()}`);
  }
}

export interface UnhandledEntry {
  method: string;
  path: string;
  detail: string | null;
}

/** Requests the fixture could not answer: query drift shows up here. */
export async function readUnhandled(request: APIRequestContext): Promise<UnhandledEntry[]> {
  const response = await request.get(`${FIXTURE_ORIGIN}/__fixture/unhandled`);
  const body = (await response.json()) as { unhandled: UnhandledEntry[] };
  return body.unhandled;
}

export async function clearUnhandled(request: APIRequestContext): Promise<void> {
  await request.delete(`${FIXTURE_ORIGIN}/__fixture/unhandled`);
}

/** Fixture row values the specs assert against. */
export const FIXTURE = {
  authorName: 'Ada Fixture',
  authorHandle: 'ada',
  topHeadline: 'Fixture city budget passes after two corrections',
  secondHeadline: 'Fixture transit board publishes its raw ridership data',
  topSlug: 'fixture-city-budget',
  bio: 'Fixture reporter covering the harness beat.',
} as const;
