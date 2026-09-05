import { expect, test } from '@playwright/test';
import { readUnhandled, setFixtureMode } from './fixture-control';

/**
 * Query-drift guard, and the reason the fixture is strict.
 *
 * The fixture answers only the exact PostgREST paths and `select` strings the app
 * builds today. Anything else gets a 501 and is recorded. Without this spec a
 * drifted select would look like a missing record, and the page would render an
 * honest-looking empty state that is actually a broken query.
 *
 * Named `zz-` so it runs after the surface specs in the single worker.
 */

test('every read the site performed was one the fixture recognises', async ({ request }) => {
  await setFixtureMode(request, 'ok');
  const unhandled = await readUnhandled(request);
  expect(
    unhandled,
    `The app sent requests the fixture does not model. Either the app's query changed (update e2e/fixture-server.mjs to match) or a page is reading something new:\n${JSON.stringify(unhandled, null, 2)}`,
  ).toEqual([]);
});
