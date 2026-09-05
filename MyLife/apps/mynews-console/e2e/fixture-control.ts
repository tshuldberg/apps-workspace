import type { APIRequestContext, BrowserContext } from '@playwright/test';

/**
 * Control plane for the local Supabase fixture (`e2e/fixture-server.mjs`).
 *
 * `signInAs` installs the cookie a real moderator's browser would hold after
 * clicking an emailed sign-in link. Everything downstream of that cookie is the
 * app's own code: middleware verifies it with `getUser()` against the fixture,
 * `lib/auth.ts` reads the `aal` claim out of that verified token, and the role
 * comes from the `nw_moderator_role` RPC.
 */

const FIXTURE_PORT = Number(process.env.MYNEWS_CONSOLE_E2E_FIXTURE_PORT ?? 4311);
export const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;

export type Identity =
  /** Allowlisted, no second factor presented on this session. */
  | 'moderator-aal1'
  /** Allowlisted, aal2, active `admin` role. */
  | 'moderator-aal2'
  /** Allowlisted, aal2, no active role row. */
  | 'moderator-norole'
  /** A real session whose email is not on the moderator allowlist. */
  | 'outsider';

export const MODERATOR_EMAIL = 'moderator@example.org';
export const NO_ROLE_EMAIL = 'norole@example.org';
export const OUTSIDER_EMAIL = 'outsider@example.org';

/** Mirrors the row in `e2e/fixture-server.mjs`. */
export const FIXTURE = {
  headline: 'Fixture article named in a takedown notice',
  articleId: 'a-fixture-copyright',
  profileHandle: 'fixturetarget',
  complainant: 'Fixture Rights Holder',
  infringingUrl: 'https://mynews.app/a/fixture-takedown-target',
} as const;

export async function signInAs(
  context: BrowserContext,
  request: APIRequestContext,
  identity: Identity,
): Promise<void> {
  const response = await request.get(`${FIXTURE_ORIGIN}/__fixture/session/${identity}`);
  if (!response.ok()) {
    throw new Error(`fixture session build failed: ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as { cookie: { name: string; value: string } };
  await context.clearCookies();
  await context.addCookies([
    {
      name: body.cookie.name,
      value: body.cookie.value,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

export interface UnhandledEntry {
  method: string;
  path: string;
  detail: string | null;
}

export async function readUnhandled(request: APIRequestContext): Promise<UnhandledEntry[]> {
  const response = await request.get(`${FIXTURE_ORIGIN}/__fixture/unhandled`);
  const body = (await response.json()) as { unhandled: UnhandledEntry[] };
  return body.unhandled;
}

/**
 * Health snapshot mode, independent of the REST outage mode: the /health page
 * must stay reachable and honest exactly when the rest of the console is not.
 */
export async function setFixtureHealthMode(
  request: APIRequestContext,
  mode: 'ok' | 'degraded' | 'unavailable',
): Promise<void> {
  const response = await request.post(`${FIXTURE_ORIGIN}/__fixture/health-mode`, {
    data: { mode },
  });
  if (!response.ok()) {
    throw new Error(`fixture health mode switch failed: ${response.status()}`);
  }
}

export async function setFixtureMode(
  request: APIRequestContext,
  mode: 'ok' | 'outage',
): Promise<void> {
  const response = await request.post(`${FIXTURE_ORIGIN}/__fixture/mode`, { data: { mode } });
  if (!response.ok()) {
    throw new Error(`fixture mode switch failed: ${response.status()}`);
  }
}
