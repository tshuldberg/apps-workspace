import { expect, test } from '@playwright/test';
import { readUnhandled, setFixtureMode } from './fixture-control';

/**
 * Query-drift guard.
 *
 * The fixture answers only the exact endpoints and `select` strings the console
 * builds today, and records anything else. Without this, a drifted select would
 * look like an empty queue, and "the queue is clear" is the most dangerous wrong
 * answer a moderation tool can give.
 *
 * Named `zz-` so it runs after the authorization specs in the single worker.
 */

test('every read the console performed was one the fixture recognises', async ({ request }) => {
  await setFixtureMode(request, 'ok');
  const unhandled = await readUnhandled(request);
  expect(
    unhandled,
    `The console sent requests the fixture does not model. Either a query changed (update e2e/fixture-server.mjs to match) or a page is reading something new:\n${JSON.stringify(unhandled, null, 2)}`,
  ).toEqual([]);
});
